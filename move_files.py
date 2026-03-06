import os
import shutil
import sys

def main():
    try:
        os.makedirs('app', exist_ok=True)
        files = ['main.py', 'alert_bot.py', 'camera_manager.py', 'config.py', 'detector.py', 'logger.py']
        for f in files:
            if os.path.exists(f):
                shutil.move(f, os.path.join('app', f))
        
        dirs = ['static', 'templates']
        for d in dirs:
            if os.path.exists(d):
                shutil.move(d, os.path.join('app', d))
                
        print("Archivos movidos con éxito.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
