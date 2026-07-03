@echo off
rem Lanceur Windows : double-cliquer sur ce fichier pour ouvrir le programme.
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
    echo Python n'est pas installe.
    echo Telechargez-le sur https://www.python.org/downloads/
    echo et cochez "Add Python to PATH" pendant l'installation.
    pause
    exit /b 1
)

rem Installe le moteur de conversion (ffmpeg) au premier lancement.
python -c "import imageio_ffmpeg" 2>nul || python -m pip install --quiet imageio-ffmpeg

python convertisseur_gui.py
if errorlevel 1 pause
