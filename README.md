# Convertisseur MKV → MP3

Programme complet pour extraire l'audio de fichiers `.mkv` et l'encoder en
`.mp3`, avec **interface graphique** (sélection à la souris, barre de
progression, annulation) ou en ligne de commande.

Le moteur de conversion (ffmpeg) est **installé automatiquement** au premier
lancement — il suffit d'avoir Python 3.

## Démarrage rapide

1. Installer **Python 3** si besoin : https://www.python.org/downloads/
   (sous Windows, cocher **« Add Python to PATH »** pendant l'installation)
2. Télécharger ce projet (bouton vert **Code** → **Download ZIP**) et le
   décompresser
3. Lancer le programme :
   - **Windows** : double-cliquer sur `Convertir-MKV-MP3.bat`
   - **Mac / Linux** : `./convertir-mkv-mp3.sh`

Une fenêtre s'ouvre : ajoutez vos fichiers, choisissez la qualité,
cliquez sur **▶ Convertir**. Les `.mp3` sont créés à côté des vidéos
(ou dans le dossier de sortie de votre choix).

## Version ligne de commande

Pour les utilisateurs à l'aise avec le terminal :

```bash
# Un seul fichier
python3 mkv_to_mp3.py video.mkv

# Tous les .mkv d'un dossier, vers un dossier de sortie
python3 mkv_to_mp3.py mes_videos/ -o mes_mp3/

# Sous-dossiers inclus, meilleure qualité
python3 mkv_to_mp3.py mes_videos/ --recursive --bitrate 320k
```

| Option              | Description                                        |
|---------------------|----------------------------------------------------|
| `source`            | Fichier `.mkv` ou dossier contenant des `.mkv`     |
| `-o`, `--output`    | Dossier de sortie (par défaut : à côté du fichier) |
| `-b`, `--bitrate`   | Débit audio du MP3 (par défaut : `192k`)           |
| `-r`, `--recursive` | Parcourir les sous-dossiers                        |
| `--overwrite`       | Écraser les `.mp3` déjà présents                   |

## À propos de ffmpeg

La conversion s'appuie sur [ffmpeg](https://ffmpeg.org/). Le programme le
cherche dans cet ordre :

1. ffmpeg déjà installé sur la machine (dans le PATH) ;
2. le paquet Python [`imageio-ffmpeg`](https://pypi.org/project/imageio-ffmpeg/),
   installé automatiquement par les lanceurs au premier démarrage.

Si aucun des deux n'est disponible, le programme affiche la commande à taper
(`pip install imageio-ffmpeg`).

## Contenu du projet

| Fichier                  | Rôle                                      |
|--------------------------|-------------------------------------------|
| `convertisseur_gui.py`   | Interface graphique                       |
| `mkv_to_mp3.py`          | Moteur + version ligne de commande        |
| `Convertir-MKV-MP3.bat`  | Lanceur Windows (double-clic)             |
| `convertir-mkv-mp3.sh`   | Lanceur Mac / Linux                       |
