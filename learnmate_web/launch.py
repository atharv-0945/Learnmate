"""
launch.py – One-command launcher for LearnMate React + FastAPI.

Usage:
    python launch.py

Runs FastAPI on port 8000 and Vite on port 5173.
"""
import os
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
VENV_PYTHON = BASE_DIR / ".venv" / "Scripts" / "python.exe"
FRONTEND_DIR = BASE_DIR / "frontend"

if not VENV_PYTHON.exists():
    VENV_PYTHON = sys.executable

print("==================================================")
print("🎓 Starting LearnMate (React + FastAPI)...")
print("==================================================")

# 1. Start FastAPI backend
print("\n[1/2] Launching FastAPI Backend on http://127.0.0.1:8000 ...")
backend_proc = subprocess.Popen(
    [str(VENV_PYTHON), "-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", "8000", "--reload"],
    cwd=str(BASE_DIR),
)

time.sleep(1.5)

# 2. Start Vite frontend dev server
print("[2/2] Launching React Vite Frontend on http://localhost:5173 ...")
frontend_proc = subprocess.Popen(
    ["npm.cmd", "run", "dev"],
    cwd=str(FRONTEND_DIR),
)

time.sleep(2.0)

print("\n🚀 LearnMate is live at:")
print("   👉 Frontend: http://localhost:5173")
print("   👉 API Docs: http://127.0.0.1:8000/docs")
print("\nPress Ctrl+C to stop both servers.")

try:
    webbrowser.open("http://localhost:5173")
    backend_proc.wait()
    frontend_proc.wait()
except KeyboardInterrupt:
    print("\nShutting down LearnMate servers...")
    backend_proc.terminate()
    frontend_proc.terminate()
    print("Done. Goodbye!")
