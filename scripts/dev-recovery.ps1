# ==============================================================================
# scripts\dev-recovery.ps1
# 5-Tier Progressive Recovery Engine ("Auto-Repair Ladder") for Android Emulators
# ==============================================================================
param(
    [ValidateRange(1, 5)]
    [int]$Tier,
    [string]$Avd = 'Stable_Phone_API_31',
    [int]$Port = 5554,
    [switch]$AutoHeal,
    [int]$TimeoutMinutes = 6
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$adb = "$sdk\platform-tools\adb.exe"
$emulator = "$sdk\emulator\emulator.exe"
$avdHome = "$env:USERPROFILE\.android\avd"

function Write-LadderStep([int]$num, [string]$title, [string]$desc) {
    Write-Host "`n[TIER $num] $title" -ForegroundColor Cyan
    Write-Host "         $desc" -ForegroundColor DarkGray
}

function Stop-EmulatorProcesses {
    Write-Host "   Terminating any stuck emulator or QEMU instances..." -ForegroundColor Gray
    Get-Process -Name 'qemu-system-x86_64', 'emulator', 'emulator64-crash-service' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

function Clear-AvdLocks([string]$targetAvd) {
    $dir = "$avdHome\$targetAvd.avd"
    if (Test-Path $dir) {
        $locks = Get-ChildItem -Path $dir -Filter "*.lock" -Recurse -ErrorAction SilentlyContinue
        if ($locks) {
            Write-Host "   Removing $($locks.Count) lock file(s) in $targetAvd..." -ForegroundColor Gray
            $locks | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
        }
    }
}

function Wait-ForBoot([string]$serial, [string]$avdName, [int]$timeoutMins) {
    Write-Host "   Verifying boot status for $serial ($avdName)..." -ForegroundColor Yellow
    $deadline = (Get-Date).AddMinutes($timeoutMins)
    $booted = ''
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $loopCount = 0
    $portNum = if ($serial -match 'emulator-(\d+)') { [int]$matches[1] } else { 5554 }

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

        # Progress reporting every 15 seconds
        if ($loopCount % 5 -eq 0) {
            $elapsedSec = [int]$sw.Elapsed.TotalSeconds
            $animState = try { (& $adb -s $serial shell getprop init.svc.bootanim 2>$null | Out-String).Trim() } catch { '' }
            if ($animState -eq 'running') {
                Write-Host "`n   [Recovery progress: $([int]($elapsedSec / 60))m $($elapsedSec % 60)s] Compiling system packages & playing boot animation..." -ForegroundColor DarkCyan
            } else {
                Write-Host "`n   [Recovery progress: $([int]($elapsedSec / 60))m $($elapsedSec % 60)s] Initializing Android kernel & services..." -ForegroundColor DarkCyan
            }
        } else {
            Write-Host -NoNewline '.'
        }
    }
    Write-Host ''
    return ($booted -eq '1')
}

# ------------------------------------------------------------------------------
# TIER 1: Soft Reset (ADB Restart & Lock Removal)
# ------------------------------------------------------------------------------
function Invoke-Tier1([string]$avdName, [int]$portNum) {
    Write-LadderStep 1 "Soft Reset" "Restarting ADB daemon and clearing stale filesystem locks"
    try {
        & cmd.exe /c "`"$adb`" kill-server >nul 2>&1"
        Start-Sleep -Seconds 1
        & cmd.exe /c "`"$adb`" start-server >nul 2>&1"
    } catch {}
    
    Clear-AvdLocks $avdName
    Write-Host "   Tier 1 complete: ADB restarted cleanly and locks removed." -ForegroundColor Green
}

# ------------------------------------------------------------------------------
# TIER 2: Cold Boot & Dirty Snapshot Purge
# ------------------------------------------------------------------------------
function Invoke-Tier2([string]$avdName, [int]$portNum) {
    Write-LadderStep 2 "Cold Boot & Snapshot Purge" "Killing frozen processes, clearing corrupted RAM caches, cold-booting"
    Stop-EmulatorProcesses
    Clear-AvdLocks $avdName

    $dir = "$avdHome\$avdName.avd"
    if (Test-Path "$dir\snapshots\default_boot") {
        Write-Host "   Clearing fastboot snapshot state..." -ForegroundColor Gray
        Remove-Item -Path "$dir\snapshots\default_boot" -Force -Recurse -ErrorAction SilentlyContinue
    }

    $serial = "emulator-$portNum"
    $logDir = "$env:TEMP\GiftListApp_emulators"
    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
    $outLog = "$logDir\${avdName}_tier2_out.log"
    $errLog = "$logDir\${avdName}_tier2_err.log"

    Write-Host "   Spawning cold boot with -no-snapshot-load..." -ForegroundColor Yellow
    Start-Process $emulator -ArgumentList @('-avd', $avdName, '-port', $portNum, '-no-snapshot-load', '-gpu', 'host', '-no-audio') `
        -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru | Out-Null

    return (Wait-ForBoot $serial $avdName $TimeoutMinutes)
}

# ------------------------------------------------------------------------------
# TIER 3: Data Wipe & Cold Reset
# ------------------------------------------------------------------------------
function Invoke-Tier3([string]$avdName, [int]$portNum) {
    Write-LadderStep 3 "Data Wipe & Cold Reset" "Wiping /data partition to eliminate corrupted system caches"
    Stop-EmulatorProcesses
    Clear-AvdLocks $avdName

    $serial = "emulator-$portNum"
    $logDir = "$env:TEMP\GiftListApp_emulators"
    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
    $outLog = "$logDir\${avdName}_tier3_out.log"
    $errLog = "$logDir\${avdName}_tier3_err.log"

    Write-Host "   Launching with -wipe-data and -no-snapshot-load..." -ForegroundColor Yellow
    Start-Process $emulator -ArgumentList @('-avd', $avdName, '-port', $portNum, '-wipe-data', '-no-snapshot-load', '-gpu', 'host', '-no-audio') `
        -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru | Out-Null

    return (Wait-ForBoot $serial $avdName $TimeoutMinutes)
}

# ------------------------------------------------------------------------------
# TIER 4: Hardware Config & Acceleration Healing
# ------------------------------------------------------------------------------
function Invoke-Tier4([string]$avdName, [int]$portNum) {
    Write-LadderStep 4 "Hardware Config Healing" "Testing acceleration and enforcing verified 4-core / 3GB RAM profile"
    Stop-EmulatorProcesses
    Clear-AvdLocks $avdName

    # Verify acceleration
    Write-Host "   Checking hardware acceleration status..." -ForegroundColor Gray
    try {
        $accel = & $emulator -accel-check 2>&1 | Out-String
        Write-Host "   $($accel.Trim())" -ForegroundColor DarkGray
    } catch {}

    # Heal config.ini
    $configFile = "$avdHome\$avdName.avd\config.ini"
    if (Test-Path $configFile) {
        $lines = Get-Content $configFile -ErrorAction Stop
        $configDict = [ordered]@{}
        foreach ($line in $lines) {
            if ($line -match '^\s*([^=]+?)\s*=\s*(.*?)\s*$') {
                $configDict[$matches[1]] = $matches[2]
            }
        }
        $configDict['hw.cpu.ncore'] = '4'
        $configDict['hw.gpu.enabled'] = 'yes'
        $configDict['hw.gpu.mode'] = 'host'
        $configDict['hw.ramSize'] = '3072'
        $configDict['vm.heapSize'] = '576'
        $configDict['fastboot.forceColdBoot'] = 'no'
        $configDict['showDeviceFrame'] = 'no'
        $configDict['skin.path'] = '_no_skin'

        $newLines = @()
        foreach ($k in $configDict.Keys) {
            $newLines += "$k = $($configDict[$k])"
        }
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllLines($configFile, $newLines, $utf8NoBom)
        Write-Host "   Repaired config.ini: enforced 4 cores, host GPU, 3GB RAM, and headless skin." -ForegroundColor Green
    }

    $serial = "emulator-$portNum"
    $logDir = "$env:TEMP\GiftListApp_emulators"
    $outLog = "$logDir\${avdName}_tier4_out.log"
    $errLog = "$logDir\${avdName}_tier4_err.log"

    Write-Host "   Launching with healed configuration..." -ForegroundColor Yellow
    Start-Process $emulator -ArgumentList @('-avd', $avdName, '-port', $portNum, '-no-snapshot-load', '-gpu', 'host', '-no-audio') `
        -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru | Out-Null

    return (Wait-ForBoot $serial $avdName $TimeoutMinutes)
}

# ------------------------------------------------------------------------------
# TIER 5: Factory Reinstall (Guaranteed Fix)
# ------------------------------------------------------------------------------
function Invoke-Tier5([string]$avdName, [int]$portNum) {
    Write-LadderStep 5 "Factory Reinstallation" "Scorched-earth reinstall of Android OS image and AVD definitions"
    $script = "$PSScriptRoot\reinstall-emulators.ps1"
    if (-not (Test-Path $script)) {
        throw "Reinstallation script not found at: $script"
    }

    & powershell -NoProfile -ExecutionPolicy Bypass -File $script
    if ($LASTEXITCODE -ne 0) {
        throw "Tier 5 Factory Reinstall failed with exit code $LASTEXITCODE."
    }

    $serial = "emulator-$portNum"
    $logDir = "$env:TEMP\GiftListApp_emulators"
    $outLog = "$logDir\${avdName}_tier5_out.log"
    $errLog = "$logDir\${avdName}_tier5_err.log"

    Write-Host "   Launching freshly created $avdName..." -ForegroundColor Yellow
    Start-Process $emulator -ArgumentList @('-avd', $avdName, '-port', $portNum, '-gpu', 'host', '-no-audio') `
        -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru | Out-Null

    return (Wait-ForBoot $serial $avdName $TimeoutMinutes)
}

# ------------------------------------------------------------------------------
# Auto-Repair Ladder Runner
# ------------------------------------------------------------------------------
function Invoke-LadderAutoHeal([string]$avdName, [int]$portNum, [int]$timeoutMins) {
    Write-Host "=====================================================================" -ForegroundColor Magenta
    Write-Host "        INITIATING AUTO-REPAIR LADDER (TIERS 1 -> 5)                 " -ForegroundColor Magenta
    Write-Host "=====================================================================" -ForegroundColor Magenta
    Write-Host "Target: $avdName on port $portNum" -ForegroundColor Cyan

    for ($t = 1; $t -le 5; $t++) {
        Write-Host "`n>>> ATTEMPTING AUTO-RECOVERY TIER $t of 5..." -ForegroundColor Magenta
        $success = $false

        switch ($t) {
            1 {
                Invoke-Tier1 $avdName $portNum
                # After tier 1, test if already running or attempt normal launch
                $serial = "emulator-$portNum"
                $logDir = "$env:TEMP\GiftListApp_emulators"
                if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
                Start-Process $emulator -ArgumentList @('-avd', $avdName, '-port', $portNum, '-gpu', 'host', '-no-audio') `
                    -RedirectStandardOutput "$logDir\tier1_out.log" -RedirectStandardError "$logDir\tier1_err.log" -PassThru | Out-Null
                $success = Wait-ForBoot $serial $avdName 3
            }
            2 { $success = Invoke-Tier2 $avdName $portNum }
            3 { $success = Invoke-Tier3 $avdName $portNum }
            4 { $success = Invoke-Tier4 $avdName $portNum }
            5 { $success = Invoke-Tier5 $avdName $portNum }
        }

        if ($success) {
            Write-Host "`n=====================================================================" -ForegroundColor Green
            Write-Host "   SUCCESS: Emulator recovered and verified healthy at Tier $t!      " -ForegroundColor Green
            Write-Host "=====================================================================" -ForegroundColor Green
            return $true
        } else {
            Write-Warning "Tier $t did not fully resolve the boot state. Escalating to Tier $([math]::Min($t + 1, 5))..."
        }
    }

    Write-Host "Auto-Repair Ladder exhausted all 5 tiers." -ForegroundColor Red
    return $false
}

# Main entrypoint if executed directly
if ($AutoHeal) {
    $result = Invoke-LadderAutoHeal -avdName $Avd -portNum $Port -timeoutMins $TimeoutMinutes
    if (-not $result) { exit 1 }
} elseif ($Tier) {
    switch ($Tier) {
        1 { Invoke-Tier1 $Avd $Port }
        2 { $ok = Invoke-Tier2 $Avd $Port; if (-not $ok) { exit 1 } }
        3 { $ok = Invoke-Tier3 $Avd $Port; if (-not $ok) { exit 1 } }
        4 { $ok = Invoke-Tier4 $Avd $Port; if (-not $ok) { exit 1 } }
        5 { $ok = Invoke-Tier5 $Avd $Port; if (-not $ok) { exit 1 } }
    }
} else {
    Write-Host "Usage: .\dev-recovery.ps1 -AutoHeal | -Tier [1..5] [-Avd <name>] [-Port <port>]" -ForegroundColor Yellow
}
