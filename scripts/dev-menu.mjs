#!/usr/bin/env node
// ==============================================================================
// scripts/dev-menu.mjs
// Interactive TUI for Android Emulators & Recovery (GiftListApp)
// Powered by @clack/prompts
// ==============================================================================

import * as p from '@clack/prompts';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const devDevicesPs1 = path.join(__dirname, 'dev-devices.ps1');
const devRecoveryPs1 = path.join(__dirname, 'dev-recovery.ps1');
const reinstallPs1 = path.join(__dirname, 'reinstall-emulators.ps1');

/**
 * Execute a PowerShell script synchronously streaming stdio
 */
function runPowerShell(scriptPath, args = []) {
  return new Promise((resolve) => {
    const fullArgs = [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      ...args,
    ];

    const child = spawn('powershell.exe', fullArgs, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: false,
    });

    child.on('close', (code) => {
      resolve(code ?? 0);
    });

    child.on('error', (err) => {
      p.log.error(`Failed to launch PowerShell: ${err.message}`);
      resolve(1);
    });
  });
}

async function handleAutoRepair(avd = 'Stable_Phone_API_31', port = 5554) {
  p.log.info('Starting 5-Tier Auto-Repair Ladder...');
  const code = await runPowerShell(devRecoveryPs1, [
    '-AutoHeal',
    '-Avd',
    avd,
    '-Port',
    String(port),
  ]);

  if (code === 0) {
    p.log.success('Auto-Repair Ladder successfully restored the emulator!');
  } else {
    p.log.error('Auto-Repair Ladder could not automatically resolve the issue.');
    const tryFactory = await p.confirm({
      message: 'Would you like to run the Tier 5 Factory Reset (reinstall OS & AVDs)?',
      initialValue: true,
    });
    if (!p.isCancel(tryFactory) && tryFactory) {
      await handleFactoryReset();
    }
  }
}

async function handleFactoryReset() {
  const confirmWipe = await p.confirm({
    message: '⚠️ This will delete and recreate all AVDs with clean images. Proceed?',
    initialValue: true,
  });

  if (p.isCancel(confirmWipe) || !confirmWipe) {
    p.log.warn('Factory Reset cancelled.');
    return;
  }

  const redownloadOs = await p.confirm({
    message: 'Do you also want to re-download the Android 31 OS image from Google?',
    initialValue: false,
  });

  const args = [];
  if (redownloadOs && !p.isCancel(redownloadOs)) {
    args.push('-ReinstallSystemImage');
  }

  p.log.step('Running Factory Reinstall engine...');
  const code = await runPowerShell(reinstallPs1, args);
  if (code === 0) {
    p.log.success('Factory Reset complete! Clean AVDs are ready for use.');
  } else {
    p.log.error(`Factory Reset failed with exit code ${code}.`);
  }
}

async function main() {
  console.clear();
  p.intro('📱 GiftListApp — Android Dev & Emulator Control Center');

  while (true) {
    const choice = await p.select({
      message: 'Select an action to perform:',
      options: [
        {
          value: 'dual_metro',
          label: '📱 Dual Emulators + Metro',
          hint: 'Recommended (Stable_Phone + GiftList_B)',
        },
        {
          value: 'single_metro',
          label: '📱 Single Emulator + Metro',
          hint: 'Lightweight (Stable_Phone only, lower CPU)',
        },
        {
          value: 'dual_nometro',
          label: '⚡ Dual Emulators (No Metro)',
          hint: 'When Metro is already running in another window',
        },
        {
          value: 'single_nometro',
          label: '⚡ Single Emulator (No Metro)',
          hint: 'Single AVD without launching Metro',
        },
        {
          value: 'rebuild_launch',
          label: '🔨 Rebuild Debug APK & Launch Emulators',
          hint: 'Runs gradle assembleDebug before launching',
        },
        {
          value: 'reinstall_apk',
          label: '📦 Force Reinstall APK on Active Devices',
          hint: 'Pushes latest APK to all currently connected devices',
        },
        {
          value: 'wipe_coldboot',
          label: '🧹 Wipe User Data & Cold Boot (Tier 3)',
          hint: 'Resets app storage & data partition to factory state',
        },
        {
          value: 'auto_repair',
          label: '🛠️  Auto-Repair & Diagnostic Ladder',
          hint: 'Progressively escalates Tiers 1-5 to fix black screens / boot hangs',
        },
        {
          value: 'factory_reinstall',
          label: '💥 Factory Reset: Reinstall Android OS & AVDs (Tier 5)',
          hint: 'Scorched-earth fix: wipes and freshly creates all AVDs',
        },
        {
          value: 'kill_all',
          label: '🛑 Emergency Reset: Kill All Emulators & ADB',
          hint: 'Immediately terminates all QEMU, emulator, and adb processes',
        },
        {
          value: 'exit',
          label: '🚪 Exit',
        },
      ],
    });

    if (p.isCancel(choice) || choice === 'exit') {
      p.outro('Goodbye!');
      process.exit(0);
    }

    let code = 0;

    switch (choice) {
      case 'dual_metro': {
        p.log.step('Starting Dual Emulators with Metro...');
        code = await runPowerShell(devDevicesPs1, ['-AutoRepair']);
        break;
      }
      case 'single_metro': {
        p.log.step('Starting Single Emulator with Metro...');
        code = await runPowerShell(devDevicesPs1, ['-Single', '-AutoRepair']);
        break;
      }
      case 'dual_nometro': {
        p.log.step('Starting Dual Emulators (No Metro)...');
        code = await runPowerShell(devDevicesPs1, ['-NoMetro', '-AutoRepair']);
        break;
      }
      case 'single_nometro': {
        p.log.step('Starting Single Emulator (No Metro)...');
        code = await runPowerShell(devDevicesPs1, ['-Single', '-NoMetro', '-AutoRepair']);
        break;
      }
      case 'rebuild_launch': {
        p.log.step('Rebuilding Debug APK and launching emulators...');
        code = await runPowerShell(devDevicesPs1, ['-Build', '-AutoRepair']);
        break;
      }
      case 'reinstall_apk': {
        p.log.step('Reinstalling APK across all active devices...');
        code = await runPowerShell(devDevicesPs1, ['-Reinstall', '-NoMetro']);
        break;
      }
      case 'wipe_coldboot': {
        p.log.step('Wiping emulator user data and cold booting...');
        code = await runPowerShell(devDevicesPs1, ['-WipeData', '-AutoRepair']);
        break;
      }
      case 'auto_repair': {
        await handleAutoRepair();
        break;
      }
      case 'factory_reinstall': {
        await handleFactoryReset();
        break;
      }
      case 'kill_all': {
        p.log.step('Terminating all emulator and ADB processes...');
        await runPowerShell(devDevicesPs1, ['-KillAll']);
        p.log.success('All emulator and ADB processes stopped.');
        break;
      }
    }

    if (code !== 0 && choice !== 'auto_repair' && choice !== 'factory_reinstall') {
      p.log.error(`Command exited with status code ${code}.`);
      const askRepair = await p.confirm({
        message: 'The operation failed. Would you like to run the Auto-Repair Ladder to fix it?',
        initialValue: true,
      });
      if (!p.isCancel(askRepair) && askRepair) {
        await handleAutoRepair();
      }
    }

    // After launching emulators + Metro, give user the option to return to menu or exit
    if (choice === 'dual_metro' || choice === 'single_metro') {
      p.outro('Emulators and Metro are active. Happy coding!');
      process.exit(0);
    }

    const nextAction = await p.confirm({
      message: 'Would you like to perform another action in the control center?',
      initialValue: true,
    });

    if (p.isCancel(nextAction) || !nextAction) {
      p.outro('Happy coding!');
      process.exit(0);
    }

    console.clear();
    p.intro('📱 GiftListApp — Android Dev & Emulator Control Center');
  }
}

main().catch((err) => {
  p.log.error(`Unexpected fatal error: ${err.message}`);
  process.exit(1);
});
