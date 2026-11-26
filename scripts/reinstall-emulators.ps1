# ==============================================================================
# scripts\reinstall-emulators.ps1
# Complete Android OS Image & AVD Factory Reinstallation Engine (Tier 5 Recovery)
# ==============================================================================
param(
    [switch]$ReinstallSystemImage,
    [switch]$Force,
    [switch]$SkipTestBoot
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$adb = "$sdk\platform-tools\adb.exe"
$emulator = "$sdk\emulator\emulator.exe"
$avdHome = "$env:USERPROFILE\.android\avd"

Write-Host "=====================================================================" -ForegroundColor Magenta
Write-Host "   TIER 5: FACTORY REINSTALL & RESTORATION OF ANDROID EMULATORS      " -ForegroundColor Magenta
Write-Host "=====================================================================" -ForegroundColor Magenta

# 1. Terminate all active emulator / ADB processes
Write-Host ">> [1/6] Stopping any active emulator, QEMU, and ADB processes..." -ForegroundColor Yellow
try {
    Get-Process -Name 'qemu-system-x86_64', 'emulator', 'emulator64-crash-service' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    if (Test-Path $adb) {
        & cmd.exe /c "`"$adb`" kill-server >nul 2>&1"
    }
} catch {
    # Ignore shutdown errors
}
Start-Sleep -Seconds 2

# 2. Ensure cmdline-tools/latest exists and locate tools
Write-Host ">> [2/6] Locating Android SDK command-line tools..." -ForegroundColor Yellow
$cmdlineToolsDir = "$sdk\cmdline-tools"
$latestDir = "$cmdlineToolsDir\latest"

# Ensure cmdline-tools/latest structure exists so sdkmanager and avdmanager resolve SDK root
if (-not (Test-Path $latestDir)) {
    if (Test-Path "$cmdlineToolsDir\bin") {
        Write-Host "   Structuring cmdline-tools\latest to resolve SDK root..." -ForegroundColor Gray
        New-Item -ItemType Directory -Path $latestDir -Force | Out-Null
        Copy-Item "$cmdlineToolsDir\bin" -Destination $latestDir -Recurse -Force
        Copy-Item "$cmdlineToolsDir\lib" -Destination $latestDir -Recurse -Force
        Copy-Item "$cmdlineToolsDir\source.properties" -Destination $latestDir -Force -ErrorAction SilentlyContinue
    }
}

$candidatePaths = @(
    "$sdk\cmdline-tools\latest\bin",
    "$sdk\cmdline-tools\bin",
    "$sdk\tools\bin"
)
if (Test-Path "$sdk\cmdline-tools") {
    $versioned = @(Get-ChildItem -Path "$sdk\cmdline-tools" -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne 'bin' -and $_.Name -ne 'lib' } | ForEach-Object { "$($_.FullName)\bin" })
    $candidatePaths = @($candidatePaths + $versioned | Select-Object -Unique)
}

$sdkmanager = $null
$avdmanager = $null
foreach ($cand in $candidatePaths) {
    $sm = "$cand\sdkmanager.bat"
    $am = "$cand\avdmanager.bat"
    if ((Test-Path $sm) -and (Test-Path $am)) {
        $sdkmanager = $sm
        $avdmanager = $am
        break
    }
}

if (-not $sdkmanager -or -not (Test-Path $sdkmanager)) {
    throw "Could not find 'sdkmanager.bat'. Checked locations:`n$($candidatePaths -join "`n")"
}
Write-Host "   Found tools: $sdkmanager" -ForegroundColor Gray

# 3. Handle system-image: system-images;android-31;google_apis;x86_64
$imagePkg = 'system-images;android-31;google_apis;x86_64'
$imageDir = "$sdk\system-images\android-31\google_apis\x86_64"

Write-Host ">> [3/6] Verifying Android OS System Image ($imagePkg)..." -ForegroundColor Yellow
if ($ReinstallSystemImage -or (-not (Test-Path $imageDir))) {
    Write-Host "   Accepting SDK licenses..." -ForegroundColor Cyan
    $y = ('y`n' * 50)
    $y | & $sdkmanager --sdk_root=$sdk --licenses | Out-Null

    Write-Host "   Downloading/installing system image via sdkmanager ($imagePkg)..." -ForegroundColor Cyan
    $y | & $sdkmanager --sdk_root=$sdk --install $imagePkg
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to download or install system image '$imagePkg' (Exit code $LASTEXITCODE)."
    }
    Write-Host "   System image successfully installed." -ForegroundColor Green
} else {
    Write-Host "   System image exists and is verified: $imageDir" -ForegroundColor Green
}

# 4. Wipe existing AVDs
Write-Host ">> [4/6] Wiping existing AVD definitions and storage..." -ForegroundColor Yellow
$avdList = @('Stable_Phone_API_31', 'GiftList_B')
foreach ($name in $avdList) {
    Write-Host "   Deleting AVD '$name'..." -ForegroundColor Gray
    try {
        "no" | & $avdmanager delete avd -n $name 2>$null | Out-Null
    } catch {
        # ignore
    }
    
    # Clean remnant folder and ini file
    $targetDir = "$avdHome\$name.avd"
    $targetIni = "$avdHome\$name.ini"
    if (Test-Path $targetDir) {
        Remove-Item -Path $targetDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $targetIni) {
        Remove-Item -Path $targetIni -Force -ErrorAction SilentlyContinue
    }
}

# 5. Create fresh AVDs with optimal hardware config
Write-Host ">> [5/6] Creating fresh AVD instances and applying 2-core / host-GPU profile..." -ForegroundColor Yellow

function New-FreshAvd([string]$avdName) {
    Write-Host "   Creating $avdName (Pixel 5 profile, API 31)..." -ForegroundColor Cyan
    # Create with avdmanager without interactive prompts
    "no" | & $avdmanager create avd -n $avdName -k $imagePkg --device "pixel_5" --force | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "avdmanager failed to create AVD '$avdName' (exit code $LASTEXITCODE)."
    }

    $configFile = "$avdHome\$avdName.avd\config.ini"
    if (-not (Test-Path $configFile)) {
        throw "config.ini not found after creation: $configFile"
    }

    # Read existing config into a dictionary
    $lines = Get-Content $configFile -ErrorAction Stop
    $configDict = [ordered]@{}
    foreach ($line in $lines) {
        if ($line -match '^\s*([^=]+?)\s*=\s*(.*?)\s*$') {
            $configDict[$matches[1]] = $matches[2]
        }
    }

    # Enforce optimal hardware profile:
    # 4 CPU cores (accelerates dex2oat compilation threads on 8-core host)
    $configDict['hw.cpu.ncore'] = '4'
    $configDict['hw.gpu.enabled'] = 'yes'
    $configDict['hw.gpu.mode'] = 'host'
    $configDict['hw.ramSize'] = '3072'
    $configDict['vm.heapSize'] = '576'
    $configDict['disk.dataPartition.size'] = '6442450944'
    $configDict['hw.keyboard'] = 'yes'
    $configDict['PlayStore.enabled'] = 'false'
    $configDict['fastboot.forceColdBoot'] = 'no'
    $configDict['showDeviceFrame'] = 'no'
    $configDict['skin.path'] = '_no_skin'

    # Save rewritten config WITHOUT UTF-8 BOM to keep avdmanager compatible
    $newLines = @()
    foreach ($k in $configDict.Keys) {
        $newLines += "$k = $($configDict[$k])"
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines($configFile, $newLines, $utf8NoBom)
    Write-Host "   Configured $avdName with 4 cores, host GPU, 3GB RAM, and headless skin." -ForegroundColor Green
}

foreach ($name in $avdList) {
    New-FreshAvd $name
}

# 6. Verification Boot (Optional sanity check)
if (-not $SkipTestBoot) {
    Write-Host ">> [6/6] Verifying primary emulator (Stable_Phone_API_31) bootability..." -ForegroundColor Yellow
    $testPort = 5554
    $serial = "emulator-$testPort"
    $logDir = "$env:TEMP\GiftListApp_emulators"
    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
    
    $outLog = "$logDir\testboot_out.log"
    $errLog = "$logDir\testboot_err.log"

    Write-Host "   Starting ADB daemon..." -ForegroundColor Gray
    & cmd.exe /c "`"$adb`" start-server >nul 2>&1"

    Write-Host "   Launching Stable_Phone_API_31 in cold boot mode..."
    $proc = Start-Process $emulator -ArgumentList @('-avd', 'Stable_Phone_API_31', '-port', $testPort, '-no-snapshot-load', '-gpu', 'host', '-no-audio') `
        -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru

    $deadline = (Get-Date).AddMinutes(20)
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $booted = ''
    $started = $false
    $loopCount = 0

    while ((Get-Date) -le $deadline) {
        Start-Sleep -Seconds 3
        $loopCount++

        # Active ADB socket maintenance: kick device if reported offline
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
        if ($qemu) { $started = $true }
        elseif ($started) {
            Write-Warning "   Emulator process exited unexpectedly during boot."
            break
        }

        # Progress reporting every 15 seconds
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

    if ($booted -eq '1') {
        Write-Host "   SUCCESS: Fresh Stable_Phone_API_31 booted and fully ready in $([int]$sw.Elapsed.TotalSeconds)s!" -ForegroundColor Green
        # Gracefully shutdown test instance to save fastboot snapshot
        Write-Host "   Saving fastboot snapshot and shutting down cleanly..." -ForegroundColor Gray
        & $adb -s $serial emu kill 2>$null | Out-Null
        Start-Sleep -Seconds 3
    } else {
        Write-Warning "   Verification boot timed out after 20 minutes. Check $errLog."
    }
} else {
    Write-Host ">> [6/6] SkipTestBoot specified - skipping initial boot verification." -ForegroundColor Gray
}

Write-Host "`nAll emulators freshly reinstalled and configured for optimal performance." -ForegroundColor Green
