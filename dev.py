import os
import subprocess
import sys
import shutil
import platform

# --- Configuration ---
PROJECT_ROOT = os.getcwd()
FUNCTIONS_DIR = os.path.join(PROJECT_ROOT, "functions")
IS_WINDOWS = platform.system() == "Windows"

# --- Colors for TUI ---
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

def run_command(command, cwd=None, shell=True):
    try:
        subprocess.run(command, cwd=cwd, shell=shell, check=True)
    except subprocess.CalledProcessError:
        print(f"{Colors.FAIL}Command failed: {command}{Colors.ENDC}")
        input("Press Enter to continue...")

def clear_screen():
    os.system('cls' if IS_WINDOWS else 'clear')

# --- Menu Actions ---

def start_app():
    print_step("Starting Expo App...")
    run_command("npx expo start -c")

def deploy_functions():
    print_step("Deploying Cloud Functions...")
    # We build first to catch TS errors before deploying
    run_command("npm run build", cwd=FUNCTIONS_DIR)
    run_command("firebase deploy --only functions")

def deploy_functions_debug():
    print_step("Deploying Functions (Debug Mode)...")
    run_command("firebase deploy --only functions --debug")

def view_logs():
    print_step("Streaming Function Logs...")
    # This queries only the scraper logs
    query = 'resource.type="cloud_function" resource.labels.function_name="scrapeProduct"'
    run_command(f'firebase functions:log --only scrapeProduct')

def nuclear_clean_functions():
    print_step("PERFORMING NUCLEAR CLEAN ON FUNCTIONS...")
    
    # 1. Delete node_modules and package-lock
    node_modules = os.path.join(FUNCTIONS_DIR, "node_modules")
    lock_file = os.path.join(FUNCTIONS_DIR, "package-lock.json")
    
    if os.path.exists(node_modules):
        print(f"Removing {node_modules}...")
        shutil.rmtree(node_modules)
    
    if os.path.exists(lock_file):
        print(f"Removing {lock_file}...")
        os.remove(lock_file)
        
    # 2. Reinstall
    print_step("Reinstalling Dependencies...")
    run_command("npm install", cwd=FUNCTIONS_DIR)
    
    # 3. Build
    print_step("Rebuilding TypeScript...")
    run_command("npm run build", cwd=FUNCTIONS_DIR)
    
    print(f"\n{Colors.GREEN}Clean complete! You can now try deploying.{Colors.ENDC}")
    input("Press Enter to return to menu...")

def install_root_deps():
    print_step("Installing App Dependencies...")
    run_command("npm install")

# --- Main Interface ---

def show_menu():
    while True:
        clear_screen()
        print(f"{Colors.HEADER}========================================{Colors.ENDC}")
        print(f"{Colors.HEADER}   GIFT LIST APP - DEVELOPER CONSOLE    {Colors.ENDC}")
        print(f"{Colors.HEADER}========================================{Colors.ENDC}")
        print("1. 📱 Run App (Expo Start)")
        print("2. 🚀 Deploy Functions (Standard)")
        print("3. 🐞 Deploy Functions (Debug Mode)")
        print("4. ☢️  Nuclear Clean Functions (Fixes 500/Timeout errors)")
        print("5. 📜 View Scraper Logs")
        print("6. 📦 Install App Dependencies")
        print("0. ❌ Exit")
        print(f"{Colors.HEADER}========================================{Colors.ENDC}")
        
        choice = input(f"{Colors.GREEN}Select an option: {Colors.ENDC}")

        if choice == "1":
            start_app()
        elif choice == "2":
            deploy_functions()
            input("\nPress Enter to continue...")
        elif choice == "3":
            deploy_functions_debug()
            input("\nPress Enter to continue...")
        elif choice == "4":
            nuclear_clean_functions()
        elif choice == "5":
            view_logs()
            input("\nPress Enter to continue...")
        elif choice == "6":
            install_root_deps()
            input("\nPress Enter to continue...")
        elif choice == "0":
            print("Goodbye!")
            sys.exit()
        else:
            print(f"{Colors.WARNING}Invalid option.{Colors.ENDC}")

if __name__ == "__main__":
    try:
        show_menu()
    except KeyboardInterrupt:
        print("\nGoodbye!")
        sys.exit()