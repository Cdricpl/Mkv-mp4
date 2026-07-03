#!/usr/bin/env python3
"""Convertisseur MKV -> MP3.

Extrait la piste audio de fichiers .mkv et l'encode en .mp3 en s'appuyant
sur ffmpeg. Gère un fichier unique ou un dossier entier (récursif ou non).

Exemples :
    python3 mkv_to_mp3.py video.mkv
    python3 mkv_to_mp3.py dossier/ -o sorties/ --recursive
    python3 mkv_to_mp3.py video.mkv --bitrate 320k
"""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def ffmpeg_disponible() -> bool:
    """Retourne True si ffmpeg est trouvable dans le PATH."""
    return shutil.which("ffmpeg") is not None


def lister_mkv(source: Path, recursif: bool) -> list[Path]:
    """Retourne la liste des fichiers .mkv à convertir à partir de `source`."""
    if source.is_file():
        return [source] if source.suffix.lower() == ".mkv" else []
    motif = "**/*" if recursif else "*"
    return sorted(p for p in source.glob(motif)
                  if p.is_file() and p.suffix.lower() == ".mkv")


def convertir(fichier: Path, dossier_sortie: Path | None, bitrate: str,
              ecraser: bool) -> bool:
    """Convertit un fichier .mkv en .mp3. Retourne True en cas de succès."""
    destination_dir = dossier_sortie if dossier_sortie else fichier.parent
    destination_dir.mkdir(parents=True, exist_ok=True)
    sortie = destination_dir / (fichier.stem + ".mp3")

    if sortie.exists() and not ecraser:
        print(f"  ↷ Ignoré (existe déjà) : {sortie.name}  (utilisez --overwrite)")
        return True

    commande = [
        "ffmpeg",
        "-y" if ecraser else "-n",
        "-i", str(fichier),
        "-vn",                 # pas de vidéo
        "-acodec", "libmp3lame",
        "-b:a", bitrate,
        str(sortie),
    ]

    print(f"  → {fichier.name}  =>  {sortie.name}")
    resultat = subprocess.run(commande, stdout=subprocess.DEVNULL,
                              stderr=subprocess.PIPE, text=True)
    if resultat.returncode != 0:
        print(f"  ✗ Échec pour {fichier.name} :", file=sys.stderr)
        print(resultat.stderr.strip(), file=sys.stderr)
        return False
    return True


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description="Convertit des fichiers MKV en MP3 (via ffmpeg).")
    parseur.add_argument("source",
                         help="Fichier .mkv ou dossier contenant des .mkv")
    parseur.add_argument("-o", "--output", type=Path, default=None,
                         help="Dossier de sortie (par défaut : à côté du source)")
    parseur.add_argument("-b", "--bitrate", default="192k",
                         help="Débit audio du MP3 (défaut : 192k)")
    parseur.add_argument("-r", "--recursive", action="store_true",
                         help="Parcourir les sous-dossiers")
    parseur.add_argument("--overwrite", action="store_true",
                         help="Écraser les .mp3 déjà présents")
    args = parseur.parse_args(argv)

    if not ffmpeg_disponible():
        print("Erreur : ffmpeg est introuvable. Installez-le puis réessayez.\n"
              "  Debian/Ubuntu : sudo apt install ffmpeg\n"
              "  macOS (brew)  : brew install ffmpeg\n"
              "  Windows       : https://ffmpeg.org/download.html",
              file=sys.stderr)
        return 1

    source = Path(args.source)
    if not source.exists():
        print(f"Erreur : chemin introuvable : {source}", file=sys.stderr)
        return 1

    fichiers = lister_mkv(source, args.recursive)
    if not fichiers:
        print("Aucun fichier .mkv trouvé.", file=sys.stderr)
        return 1

    print(f"{len(fichiers)} fichier(s) à convertir :")
    succes = sum(convertir(f, args.output, args.bitrate, args.overwrite)
                 for f in fichiers)
    echecs = len(fichiers) - succes

    print(f"\nTerminé : {succes} réussi(s), {echecs} échec(s).")
    return 0 if echecs == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
