#!/bin/sh
# Lanceur Mac / Linux : ./convertir-mkv-mp3.sh
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
    echo "Python 3 n'est pas installé : https://www.python.org/downloads/"
    exit 1
fi

# Installe le moteur de conversion (ffmpeg) au premier lancement.
python3 -c "import imageio_ffmpeg" 2>/dev/null || \
    python3 -m pip install --quiet --user imageio-ffmpeg

exec python3 convertisseur_gui.py
