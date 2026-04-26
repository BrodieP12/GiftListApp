import os
import subprocess
import sys
import shutil
import platform
import json
import requests

# --- Configuration ---
PROJECT_ROOT = os.getcwd()
FUNCTIONS_DIR = os.path.join(PROJECT_ROOT, "functions")
HASH_FILE = os.path.join(PROJECT_ROOT, ".last_native_hash")
PUBLIC_DIR = os.path.join(PROJECT_ROOT, "public")
# Update this with your actual project ID
PROJECT_ID = "giftlistapp-557ce"
APK_DOWNLOAD_URL = f"https://{PROJECT_ID}.web.app/latest.apk"

class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_step(msg):
    print(f"\n{Colors.BLUE}{Colors.BOLD}>>> {msg}{Colors.ENDC}")

def run_command(command, cwd=None, shell=True, capture=False):
    """Wraps firebase commands in npx and handles correctly named remoteconfig."""
    try:
        # Force npx for firebase commands
        if "firebase " in command and not command.startswith("npx"):
            command = f"npx {command}"

        if capture:
            result = subprocess.run(command, cwd=cwd, shell=shell, check=True, capture_output=True, text=True)
            return result.stdout
        subprocess.run(command, cwd=cwd, shell=shell, check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"{Colors.FAIL}Command failed: {command}\n{e}{Colors.ENDC}")
        return None

def clear_screen():
    os.system('cls' if platform.system() == "Windows" else 'clear')

# --- Automation Logic ---

def get_current_fingerprint():
    print("Calculating native fingerprint...")
    output = run_command("npx @expo/fingerprint .", capture=True)
    if isinstance(output, str):
        try:
            data = json.loads(output)
            return data.get("id")
        except: return None
    return None

def bump_version():
    path = os.path.join(PROJECT_ROOT, "app.json")
    with open(path, 'r') as f:
        data = json.load(f)
    current_v = data['expo']['version']
    parts = current_v.split('.')
    parts[-1] = str(int(parts[-1]) + 1)
    new_v = '.'.join(parts)
    data['expo']['version'] = new_v
    if 'android' not in data['expo']: data['expo']['android'] = {}
    old_code = data['expo']['android'].get('versionCode', 1)
    new_code = old_code + 1
    data['expo']['android']['versionCode'] = new_code
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"{Colors.GREEN}🚀 Auto-bumped to v{new_v} (Build {new_code}){Colors.ENDC}")
    return new_v

def sync_to_firebase(version, message):
    """Pulls config, updates it locally, and deploys back to Firebase."""
    print_step("Syncing to Firebase (Remote Config & Hosting)...")
    config_path = os.path.join(PROJECT_ROOT, "firebase_config", "remote_config.json")

    # Note: remoteconfig (no hyphen)
    fetch_cmd = f"firebase remoteconfig:get -o firebase_config/remote_config.json --project {PROJECT_ID}"

    if run_command(fetch_cmd):
        with open(config_path, 'r') as f:
            config = json.load(f)

        config['parameters']['required_native_version'] = {'defaultValue': {'value': version}}
        config['parameters']['latest_update_message'] = {'defaultValue': {'value': message}}
        config['parameters']['apk_download_url'] = {'defaultValue': {'value': APK_DOWNLOAD_URL}}

        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)

        run_command(f"firebase deploy --only remoteconfig,hosting --project {PROJECT_ID}")
        print(f"{Colors.GREEN}✅ Firebase Synced! Message set to: \"{message}\"{Colors.ENDC}")

def download_latest_eas_build():
    print_step("Fetching latest APK from EAS...")
    cmd = "eas build:list --platform android --profile preview --status finished --limit 1 --json"
    output = run_command(cmd, capture=True)
    if not isinstance(output, str): return False
    try:
        builds = json.loads(output)
        build_url = builds[0].get("artifacts", {}).get("buildUrl")
        response = requests.get(build_url, stream=True)
        response.raise_for_status()
        if not os.path.exists(PUBLIC_DIR): os.makedirs(PUBLIC_DIR)
        dest_path = os.path.join(PUBLIC_DIR, "latest.apk")
        with open(dest_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192): f.write(chunk)
        return True
    except Exception as e:
        print(f"Download failed: {e}")
        return False

def install_on_emulator():
    """Installs the locally downloaded latest.apk onto a running emulator."""
    apk_path = os.path.join(PUBLIC_DIR, "latest.apk")
    if not os.path.exists(apk_path):
        print(f"{Colors.FAIL}❌ No APK found at {apk_path}. Run a build first.{Colors.ENDC}")
        return False

    print_step("Installing APK to Emulator...")
    # Targets the first running emulator
    return run_command(f"adb -e install -r {apk_path}")

def manual_apk_build():
    """Forces a full EAS Build regardless of fingerprint state."""
    print_step("MANUAL APK BUILD TRIGGERED")
    msg = input("Native Update Message (Why a new build?): ") or "Manual rebuild."

    if input("Bump version and start EAS Cloud Build? (y/n): ").lower() == 'y':
        new_v = bump_version()
        # Wait flag ensures we don't try to download before it's done
        if run_command("eas build --platform android --profile preview --non-interactive --wait"):
            if download_latest_eas_build():
                # Update the hash so the next Smart Deploy knows we are fresh
                current_hash = get_current_fingerprint()
                if current_hash:
                    with open(HASH_FILE, 'w') as f:
                        f.write(current_hash)

                sync_to_firebase(new_v, msg)
                print(f"{Colors.GREEN}✅ Manual build and deployment complete!{Colors.ENDC}")
                return True
    return False

def run_app_rebuild_flow():
    """Tries local run:android first, falls back to EAS Cloud build if local fails."""
    print_step("ATTEMPTING LOCAL ANDROID REBUILD...")

    # Try local build first
    success = run_command("npx expo run:android")

    if not success:
        print(f"{Colors.WARNING}⚠️  Local rebuild failed. Falling back to EAS Cloud build...{Colors.ENDC}")
        if manual_apk_build():
            # If cloud build succeeded and downloaded, install it manually
            install_on_emulator()
    else:
        print(f"{Colors.GREEN}✅ Local rebuild successful!{Colors.ENDC}")

def smart_deploy():
    print_step("RUNNING SMART DEPLOY...")
    current_hash = get_current_fingerprint()

    with open(os.path.join(PROJECT_ROOT, "app.json"), 'r') as f:
        current_v = json.load(f)['expo']['version']

    last_hash = None
    if os.path.exists(HASH_FILE):
        with open(HASH_FILE, 'r') as f:
            last_hash = f.read().strip()

    if current_hash == last_hash:
        print(f"{Colors.GREEN}✅ No native changes. Pushing OTA Update.{Colors.ENDC}")
        msg = input("What's new in this update? ") or "Minor improvements."
        if run_command(f'eas update --branch preview --message "{msg}"'):
            sync_to_firebase(current_v, msg)
    else:
        print(f"{Colors.WARNING}⚠️ NATIVE CHANGES DETECTED!{Colors.ENDC}")
        manual_apk_build()

# --- Standard Interface ---

def show_menu():
    while True:
        clear_screen()
        print(f"{Colors.HEADER}========================================{Colors.ENDC}")
        print(f"{Colors.HEADER}   GIFT LIST APP - DEVELOPER CONSOLE    {Colors.ENDC}")
        print(f"{Colors.HEADER}========================================{Colors.ENDC}")
        print("1. 📱 Run App (Expo Start)")
        print("2. 🏗️  Run App (Rebuild: Local -> Cloud Fallback)")
        print("3. 🚀 Deploy Functions")
        print("4. 🛡️  Deploy Firestore Rules")
        print("5. ☢️  Nuclear Clean Functions")
        print("6. 📜 View Scraper Logs")
        print("7. 📦 Install App Dependencies")
        print(f"{Colors.BLUE}--- Deployment ---{Colors.ENDC}")
        print(f"8. 🧠 {Colors.BOLD}SMART DEPLOY (Auto-everything){Colors.ENDC}")
        print("9. 🏗️  MANUAL APK BUILD (Force Full Build)")
        print("10. 📜 View EAS Build Status")
        print("11. 📲 Install Latest APK to Emulator (Manual)")
        print("0. ❌ Exit")
        print(f"{Colors.HEADER}========================================{Colors.ENDC}")

        choice = input(f"{Colors.GREEN}Select an option: {Colors.ENDC}")
        if choice == "1": run_command("npx expo start -c")
        elif choice == "2": run_app_rebuild_flow(); input("\nPress Enter...")
        elif choice == "3":
            run_command("npm run build", cwd=FUNCTIONS_DIR)
            run_command("firebase deploy --only functions")
            input("\nPress Enter...")
        elif choice == "4": run_command("firebase deploy --only firestore:rules", cwd=FUNCTIONS_DIR); input("\nPress Enter...")
        elif choice == "5":
            shutil.rmtree(os.path.join(FUNCTIONS_DIR, "node_modules"), ignore_errors=True)
            run_command("npm install", cwd=FUNCTIONS_DIR)
        elif choice == "6": run_command("firebase functions:log --only scrapeProduct"); input("\nPress Enter...")
        elif choice == "7": run_command("npm install"); input("\nPress Enter...")
        elif choice == "8": smart_deploy(); input("\nPress Enter...")
        elif choice == "9": manual_apk_build(); input("\nPress Enter...")
        elif choice == "10": run_command("eas build:list --limit 5"); input("\nPress Enter...")
        elif choice == "11": install_on_emulator(); input("\nPress Enter...")
        elif choice == "0": sys.exit()

if __name__ == "__main__":
    try: show_menu()
    except KeyboardInterrupt: sys.exit()