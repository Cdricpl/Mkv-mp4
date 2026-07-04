# Convertisseur MKV → MP4

Programme complet pour convertir des fichiers vidéo `.mkv` en `.mp4`, avec
**interface graphique** (sélection à la souris, barre de progression,
annulation) ou en ligne de commande.

- **Rapide** : quand la vidéo du MKV est déjà compatible MP4 (cas le plus
  fréquent : H.264/x264, H.265/x265), elle est copiée telle quelle, sans
  aucune perte de qualité.
- **Lisible partout** : l'audio est converti en AAC (les pistes DTS ou FLAC
  des MKV ne passent pas sur la plupart des TV et lecteurs en MP4).
- **Réencodage automatique** : si la vidéo n'est pas acceptée dans un MP4,
  le programme la réencode tout seul.
- **Mode anciens lecteurs** : la qualité « Lecteur DVD portable (DivX .avi) »
  produit un fichier Xvid + MP3 lisible par les lecteurs DVD de salon et
  portables (Medion, etc.) qui ne décodent pas le H.264/H.265.
- Le moteur de conversion (ffmpeg) est **installé automatiquement** au
  premier lancement (le programme le propose lui-même) — il suffit d'avoir
  Python 3.

## Démarrage rapide

1. Installer **Python 3** si besoin : https://www.python.org/downloads/
   (sous Windows, cocher **« Add Python to PATH »** pendant l'installation)
2. Télécharger ce projet (bouton vert **Code** → **Download ZIP**) et le
   décompresser
3. Lancer le programme :
   - **Windows** : double-cliquer sur `Convertir-MKV-MP4.bat`
   - **Mac / Linux** : `./convertir-mkv-mp4.sh`

Une fenêtre s'ouvre : ajoutez vos fichiers, cliquez sur **▶ Convertir**.
Les `.mp4` sont créés à côté des vidéos (ou dans le dossier de sortie de
votre choix).

## Version ligne de commande

Pour les utilisateurs à l'aise avec le terminal :

```bash
# Un seul fichier
python3 mkv_to_mp4.py video.mkv

# Tous les .mkv d'un dossier, vers un dossier de sortie
python3 mkv_to_mp4.py mes_videos/ -o mes_mp4/

# Sous-dossiers inclus
python3 mkv_to_mp4.py mes_videos/ --recursive

# Forcer le réencodage en haute qualité
python3 mkv_to_mp4.py video.mkv --crf 18

# Pour un ancien lecteur DVD (produit un .avi Xvid + MP3)
python3 mkv_to_mp4.py video.mkv --divx
```

| Option              | Description                                            |
|---------------------|--------------------------------------------------------|
| `source`            | Fichier `.mkv` ou dossier contenant des `.mkv`         |
| `-o`, `--output`    | Dossier de sortie (par défaut : à côté du fichier)     |
| `--crf N`           | Force le réencodage (18 = haute qualité, 23 = moyenne, 28 = basse). Par défaut : copie directe sans réencodage |
| `--divx`            | Produit un `.avi` Xvid + MP3 pour les anciens lecteurs DVD |
| `-r`, `--recursive` | Parcourir les sous-dossiers                            |
| `--overwrite`       | Écraser les `.mp4` déjà présents                       |

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
| `mkv_to_mp4.py`          | Moteur + version ligne de commande        |
| `Convertir-MKV-MP4.bat`  | Lanceur Windows (double-clic)             |
| `convertir-mkv-mp4.sh`   | Lanceur Mac / Linux                       |
