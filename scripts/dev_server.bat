@echo off
REM Start development server with auto-reload
cd /d "%~dp0.."
call venv\Scripts\activate.bat
set DJANGO_SETTINGS_MODULE=config.settings.development
python manage.py runserver 0.0.0.0:8000
