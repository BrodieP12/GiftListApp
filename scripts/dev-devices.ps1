# Boots independent emulator(s), finds any USB/wireless physical device, installs the
# dev-client APK where missing, wires each device to Metro, and opens the app on all of them.
#   .\scripts\dev-devices.ps1              start everything (dual emulators)
#   .\scripts\dev-devices.ps1 -Single      start only 1 emulator (lighter on CPU/RAM)
#   .\scripts\dev-devices.ps1 -Build       rebuild the debug APK first (needed after native changes)
#   .\scripts\dev-devices.ps1 -Reinstall   force-reinstall the APK on every device
#   .\scripts\dev-devices.ps1 -NoMetro     don't launch the Metro window
#   .\scripts\dev-devices.ps1 -WipeData    wipe emulator user data for a clean cold boot
#   .\scripts\dev-devices.ps1 -AutoRepair  run progressive auto-healing ladder if boot hangs
#   .\scripts\dev-devices.ps1 -FactoryReset reinstall Android OS and AVDs from scratch
#   .\scripts\dev-devices.ps1 -KillAll     cleanly stop all emulators and ADB
#   .\scripts\dev-devices.ps1 -Avds A,B    specify specific AVD names to launch
param(
    [switch]$Build, 
    [switch]$Reinstall, 
    [switch]$NoMetro, 
    [switch]$WipeData, 
    [switch]$Single, 
    [switch]$AutoRepair,
    [switch]$FactoryReset,
    [switch]$KillAll,
    [int]$TimeoutMinutes = 20, 
    [string[]]$Avds
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$adb = "$sdk\platform-tools\adb.exe"
$emulator = "$sdk\emulator\emulator.exe"
$apk = "$root\android\app\build\outputs\apk\debug\app-debug.apk"
$package = 'com.brodiepasker.giftlistapp'
$metroPort = 8081

# Handle KillAll
if ($KillAll) {
    Write-Host ">> Terminating all emulator, QEMU, and ADB processes..." -ForegroundColor Yellow
    Get-Process -Name 'qemu-system-x86_64', 'emulator', 'emulator64-crash-service' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    if (Test-Path $adb) { & cmd.exe /c "`"$adb`" kill-server >nul 2>&1" }
    Write-Host "All emulator and ADB processes stopped." -ForegroundColor Green
    exit 0
}

# Handle FactoryReset directly
if ($FactoryReset) {
    & powershell -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot\reinstall-emulators.ps1"
    exit $LASTEXITCODE
}

# Pre-flight check
if (-not (Test-Path $emulator)) {
    throw "Android emulator executable not found at: $emulator. Please check ANDROID_HOME or your Android SDK installation."
}
if (-not (Test-Path $adb)) {
    throw "ADB executable not found at: $adb. Please check ANDROID_HOME or your Android SDK installation."
}

function Test-AvdValid([string]$avdName, [string]$sdkPath) {
    $iniPath = "$env:USERPROFILE\.android\avd\$avdName.ini"
    if (-not (Test-Path $iniPath)) { return $false }
    $targetLine = Get-Content $iniPath -ErrorAction SilentlyContinue | Where-Object { $_ -match '^target=' }
    if (-not $targetLine) { return $true }
    $target = ($targetLine -split '=')[1].Trim()
    return (Test-Path "$sdkPath\system-images\$target")
}

# Pre-flight: query available AVDs and verify bootability
$allAvds = @(& $emulator -list-avds) | Where-Object { $_ -match '\S' } | ForEach-Object { $_.Trim() }
$availableAvds = @($allAvds | Where-Object { Test-AvdValid $_ $sdk })

if ($availableAvds.Count -eq 0) {
    throw "No valid, bootable Android Virtual Devices (AVDs) found. Installed AVDs: $($allAvds -join ', '). Please run with -FactoryReset to create them."
}

# Determine which AVDs to launch
$targetAvdNames = @()
if ($Avds -and $Avds.Count -gt 0) {
    foreach ($name in $Avds) {
        if ($availableAvds -notcontains $name) {
            throw "Requested AVD '$name' is not available or its system-image is missing. Available AVDs: $($availableAvds -join ', ')"
        }
        $targetAvdNames += $name
    }
} else {
    $preferred = if ($Single) { @('Stable_Phone_API_31') } else { @('Stable_Phone_API_31', 'GiftList_B') }
    foreach ($p in $preferred) {
        if ($availableAvds -contains $p -and $targetAvdNames -notcontains $p) {
            $targetAvdNames += $p
        }
    }
    if ($targetAvdNames.Count -eq 0) {
        $count = if ($Single) { 1 } else { 2 }
        $targetAvdNames = @($availableAvds | Select-Object -First $count)
    }
}

$ports = @(5554, 5556, 5558, 5560)
$emulators = @()
for ($i = 0; $i -lt $targetAvdNames.Count; $i++) {
    $emulators += @{
        Avd  = $targetAvdNames[$i]
        Port = $ports[$i]
    }
}

function Get-Devices {
    & $adb devices | Select-String '^(\S+)\s+(device|unauthorized|offline)$' | ForEach-Object {
        [pscustomobject]@{ Serial = $_.Matches[0].Groups[1].Value; State = $_.Matches[0].Groups[2].Value }
    }
}

& cmd.exe /c "`"$adb`" start-server >nul 2>&1"

$logDir = "$env:TEMP\GiftListApp_emulators"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

Write-Host '>> Starting and verifying emulators' -ForegroundColor Cyan

function Start-And-Wait-Emulator($e, [int]$timeoutMins) {
    $serial = "emulator-$($e.Port)"
    $runningSerials = @((Get-Devices).Serial)
    if ($runningSerials -contains $serial) {
        $alreadyBooted = try { (& $adb -s $serial shell getprop sys.boot_completed 2>$null | Out-String).Trim() } catch { '' }
        if ($alreadyBooted -eq '1') {
            Write-Host "   $serial ($($e.Avd)) is already running and ready."
            return
        }
    }

    # Clean stale locks and corrupted snapshots if the emulator is not cleanly running
    $avdDir = "$env:USERPROFILE\.android\avd\$($e.Avd).avd"
    if (Test-Path $avdDir) {
        Get-ChildItem -Path $avdDir -Filter "*.lock" -Recurse -ErrorAction SilentlyContinue | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
        $snapshotDir = "$avdDir\snapshots\default_boot"
        if (Test-Path $snapshotDir) {
            $dirtySnapshots = Get-ChildItem -Path $snapshotDir -Filter "ram.img.dirty" -Recurse -ErrorAction SilentlyContinue
            $pbFile = "$snapshotDir\snapshot.pb"
            $isCorrupted = $dirtySnapshots -or ((Test-Path $pbFile) -and ((Get-Item $pbFile).Length -lt 100))
            if ($isCorrupted) {
                Write-Host "   Purging corrupted fastboot snapshot for $($e.Avd)..." -ForegroundColor Yellow
                Remove-Item -Path $snapshotDir -Force -Recurse -ErrorAction SilentlyContinue
            }
        }
    }

    Write-Host "   Starting $($e.Avd) on port $($e.Port)..."
    $outLog = "$logDir\$($e.Avd)_$($e.Port)_out.log"
    $errLog = "$logDir\$($e.Avd)_$($e.Port)_err.log"

    $emuArgs = @('-avd', $e.Avd, '-port', $e.Port, '-gpu', 'host', '-no-audio')
    if ($WipeData) { 
        $emuArgs += @('-wipe-data', '-no-snapshot-load')
        if (Test-Path "$avdDir\snapshots") {
            Remove-Item -Path "$avdDir\snapshots" -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    $proc = Start-Process $emulator -ArgumentList $emuArgs `
        -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru

    Start-Sleep -Seconds 3
    if ($proc.HasExited -and $proc.ExitCode -ne 0) {
        $errContent = if (Test-Path $errLog) {
            $raw = Get-Content $errLog -Raw -ErrorAction SilentlyContinue
            if ($raw) { $raw.Trim() } else { '' }
        } else { '' }
        $outContent = if (Test-Path $outLog) {
            $raw = Get-Content $outLog -Raw -ErrorAction SilentlyContinue
            if ($raw) { $raw.Trim() } else { '' }
        } else { '' }
        $msg = "Failed to start emulator '$($e.Avd)': Process exited immediately (exit code $($proc.ExitCode))."
        if ($errContent) { $msg += "`nStderr: $errContent" }
        if ($outContent) { $msg += "`nStdout: $outContent" }
        throw $msg
    }

    Write-Host "   Waiting for $serial ($($e.Avd)) to boot (up to $timeoutMins minutes)..."
    $deadline = (Get-Date).AddMinutes($timeoutMins)
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $booted = ''
    $started = $false
    $qemuMissingCount = 0
    $loopCount = 0

    while ((Get-Date) -le $deadline) {
        Start-Sleep -Seconds 3
        $loopCount++

        # If the device is detected as offline, kick it with reconnect offline
        if ($loopCount % 5 -eq 0) {
            $deviceLine = & $adb devices | Select-String "^$serial\s+offline"
            if ($deviceLine) {
                & cmd.exe /c "`"$adb`" -s $serial reconnect offline >nul 2>&1"
            }
        }

        try { 
            $booted = (& $adb -s $serial shell getprop sys.boot_completed 2>$null | Out-String).Trim() 
        } catch { 
            $booted = '' 
        }
        if ($booted -eq '1') { break }

        $qemu = Get-Process -Name 'qemu-system-x86_64' -ErrorAction SilentlyContinue
        if ($qemu) { 
            $started = $true 
            $qemuMissingCount = 0
        } elseif ($started) {
            $qemuMissingCount++
            if ($qemuMissingCount -ge 3) {
                Write-Warning "   Emulator process exited unexpectedly during boot."
                break
            }
        }

        # Informative progress every 15 seconds
        if ($loopCount % 5 -eq 0) {
            $elapsedSec = [int]$sw.Elapsed.TotalSeconds
            $animState = try { (& $adb -s $serial shell getprop init.svc.bootanim 2>$null | Out-String).Trim() } catch { '' }
            if ($animState -eq 'running') {
                Write-Host "`n   [Boot progress: $([int]($elapsedSec / 60))m $($elapsedSec % 60)s] Compiling system packages & playing boot animation..." -ForegroundColor DarkCyan
            } else {
                Write-Host "`n   [Boot progress: $([int]($elapsedSec / 60))m $($elapsedSec % 60)s] Initializing Android kernel & services..." -ForegroundColor DarkCyan
            }
        } else {
            Write-Host -NoNewline '.'
        }
    }
    Write-Host ''
    if ($booted -ne '1') {
        if ($AutoRepair) {
            Write-Warning "$serial ($($e.Avd)) timed out booting. Engaging Auto-Repair Ladder..."
            & powershell -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot\dev-recovery.ps1" -AutoHeal -Avd $e.Avd -Port $e.Port
            if ($LASTEXITCODE -ne 0) {
                throw "$serial ($($e.Avd)) failed to recover via Auto-Repair Ladder."
            }
        } else {
            throw "$serial ($($e.Avd)) did not finish booting in $timeoutMins minutes. (Tip: Re-run with -AutoRepair or select Option 8 in the TUI to auto-fix)"
        }
    }
    Write-Host "   $serial ready ($([int]$sw.Elapsed.TotalSeconds)s)"
}

foreach ($e in $emulators) {
    Start-And-Wait-Emulator $e $TimeoutMinutes
}

$all = Get-Devices
foreach ($d in $all | Where-Object State -ne 'device') {
    Write-Warning "$($d.Serial) is $($d.State) - unlock the phone and accept the USB debugging prompt, then re-run."
}
$targets = @($all | Where-Object State -eq 'device')
$physical = @($targets | Where-Object { $_.Serial -notlike 'emulator-*' })
if ($physical.Count -eq 0) { Write-Host '   (no physical device found - plug in via USB, or run: adb pair <ip:port> then adb connect <ip:port>)' -ForegroundColor Yellow }
else { Write-Host ">> Physical device(s): $($physical.Serial -join ', ')" -ForegroundColor Cyan }

if ($Build) {
    Write-Host '>> Building debug APK' -ForegroundColor Cyan
    Push-Location "$root\android"
    try { & .\gradlew.bat app:assembleDebug; if ($LASTEXITCODE -ne 0) { throw 'gradle build failed' } } finally { Pop-Location }
}
if (-not (Test-Path $apk)) { throw "No APK at $apk - re-run with -Build" }

foreach ($d in $targets) {
    $has = (& $adb -s $d.Serial shell pm list packages $package | Out-String) -match [regex]::Escape($package)
    if ($Reinstall -or -not $has) {
        Write-Host ">> Installing APK on $($d.Serial)" -ForegroundColor Cyan
        & $adb -s $d.Serial install -r $apk | Out-Host
    }
    & $adb -s $d.Serial reverse "tcp:$metroPort" "tcp:$metroPort" | Out-Null
}

if (-not $NoMetro) {
    $listening = Get-NetTCPConnection -LocalPort $metroPort -State Listen -ErrorAction SilentlyContinue
    if ($listening) { Write-Host ">> Metro already running on $metroPort" }
    else {
        Write-Host '>> Starting Metro' -ForegroundColor Cyan
        Start-Process cmd -ArgumentList '/k', "npx expo start --dev-client --port $metroPort" -WorkingDirectory $root
    }
    Write-Host '   Waiting for Metro to listen...'
    $deadline = (Get-Date).AddSeconds(120)
    while (-not (Get-NetTCPConnection -LocalPort $metroPort -State Listen -ErrorAction SilentlyContinue)) {
        if ((Get-Date) -gt $deadline) { throw "Metro did not start on port $metroPort within 2 minutes" }
        Start-Sleep -Seconds 2
    }
}

$url = "exp+giftlistapp://expo-development-client/?url=http%3A%2F%2Flocalhost%3A$metroPort"
foreach ($d in $targets) {
    Write-Host ">> Opening app on $($d.Serial)" -ForegroundColor Cyan
    & $adb -s $d.Serial shell am start -a android.intent.action.VIEW -d "'$url'" | Out-Null
}
Write-Host 'Done. Edit code and all devices Fast Refresh together.' -ForegroundColor Green
