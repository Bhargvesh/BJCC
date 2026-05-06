@echo off
cd /d "%~dp0backend"
if not exist ".venv" (
  python -m venv .venv
)
call ".venv\Scripts\activate"
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8010
