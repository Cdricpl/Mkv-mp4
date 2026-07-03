# MKV → MP3

Petit programme en ligne de commande pour extraire l'audio de fichiers `.mkv`
et l'encoder en `.mp3`. Il s'appuie sur [ffmpeg](https://ffmpeg.org/).

## Prérequis

- Python 3.10 ou plus récent
- `ffmpeg` installé et accessible dans le PATH
  - Debian/Ubuntu : `sudo apt install ffmpeg`
  - macOS (Homebrew) : `brew install ffmpeg`
  - Windows : https://ffmpeg.org/download.html

## Utilisation

```bash
# Un seul fichier
python3 mkv_to_mp3.py video.mkv

# Tous les .mkv d'un dossier, vers un dossier de sortie
python3 mkv_to_mp3.py mes_videos/ -o mes_mp3/

# Parcourir aussi les sous-dossiers, en meilleure qualité
python3 mkv_to_mp3.py mes_videos/ --recursive --bitrate 320k

# Écraser les MP3 déjà existants
python3 mkv_to_mp3.py video.mkv --overwrite
```

## Options

| Option              | Description                                           |
|---------------------|-------------------------------------------------------|
| `source`            | Fichier `.mkv` ou dossier contenant des `.mkv`        |
| `-o`, `--output`    | Dossier de sortie (par défaut : à côté du fichier)    |
| `-b`, `--bitrate`   | Débit audio du MP3 (par défaut : `192k`)              |
| `-r`, `--recursive` | Parcourir les sous-dossiers                           |
| `--overwrite`       | Écraser les `.mp3` déjà présents                      |
