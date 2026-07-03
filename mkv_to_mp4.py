#!/usr/bin/env python3
"""Convertisseur MKV -> MP4.

Convertit des fichiers .mkv en .mp4 en s'appuyant sur ffmpeg.
Essaie d'abord une copie directe des pistes (quasi instantanée, sans perte) ;
si le contenu n'est pas compatible MP4, réencode automatiquement.

Exemples :
    python3 mkv_to_mp4.py video.mkv
    python3 mkv_to_mp4.py dossier/ -o sorties/ --recursive
    python3 mkv_to_mp4.py video.mkv --crf 18   # force le réencodage haute qualité
"""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def trouver_ffmpeg() -> str | None:
    """Retourne le chemin de ffmpeg, ou None s'il est introuvable.

    Cherche d'abord dans le PATH, puis dans le paquet Python
    `imageio-ffmpeg` qui embarque un binaire ffmpeg autonome.
    """
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def lister_mkv(source: Path, recursif: bool) -> list[Path]:
    """Retourne la liste des fichiers .mkv à convertir à partir de `source`."""
    if source.is_file():
        return [source] if source.suffix.lower() == ".mkv" else []
    motif = "**/*" if recursif else "*"
    return sorted(p for p in source.glob(motif)
                  if p.is_file() and p.suffix.lower() == ".mkv")


def commande_ffmpeg(ffmpeg: str, fichier: Path, sortie: Path,
                    crf: int | None) -> list[str]:
    """Construit la commande ffmpeg.

    crf None : vidéo copiée telle quelle (rapide, sans perte) ; sinon
    réencodage x264 à la qualité demandée. Dans les deux cas l'audio est
    converti en AAC (les pistes DTS/FLAC des MKV ne sont pas lisibles dans
    un MP4 sur la plupart des lecteurs) et les sous-titres sont ignorés
    (-sn : les sous-titres image des BluRay ne rentrent pas dans un MP4).
    """
    if crf is None:
        video = ["-c:v", "copy"]
    else:
        video = ["-c:v", "libx264", "-crf", str(crf), "-preset", "veryfast"]
    return [ffmpeg, "-y", "-i", str(fichier), *video,
            "-c:a", "aac", "-b:a", "192k", "-sn",
            "-movflags", "+faststart", str(sortie)]


def convertir(fichier: Path, dossier_sortie: Path | None, crf: int | None,
              ecraser: bool, ffmpeg: str = "ffmpeg") -> bool:
    """Convertit un fichier .mkv en .mp4. Retourne True en cas de succès."""
    destination_dir = dossier_sortie if dossier_sortie else fichier.parent
    destination_dir.mkdir(parents=True, exist_ok=True)
    sortie = destination_dir / (fichier.stem + ".mp4")

    if sortie.exists() and not ecraser:
        print(f"  ↷ Ignoré (existe déjà) : {sortie.name}  (utilisez --overwrite)")
        return True

    print(f"  → {fichier.name}  =>  {sortie.name}")
    resultat = subprocess.run(
        commande_ffmpeg(ffmpeg, fichier, sortie, crf),
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)

    # La copie directe échoue si un codec n'est pas accepté dans un MP4 :
    # on retente alors en réencodant.
    if resultat.returncode != 0 and crf is None:
        print("    copie directe impossible, réencodage…")
        resultat = subprocess.run(
            commande_ffmpeg(ffmpeg, fichier, sortie, 23),
            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)

    if resultat.returncode != 0:
        sortie.unlink(missing_ok=True)
        print(f"  ✗ Échec pour {fichier.name} :", file=sys.stderr)
        print(resultat.stderr.strip(), file=sys.stderr)
        return False
    return True


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description="Convertit des fichiers MKV en MP4 (via ffmpeg).")
    parseur.add_argument("source",
                         help="Fichier .mkv ou dossier contenant des .mkv")
    parseur.add_argument("-o", "--output", type=Path, default=None,
                         help="Dossier de sortie (par défaut : à côté du source)")
    parseur.add_argument("--crf", type=int, default=None, metavar="N",
                         help="Force le réencodage vidéo avec cette qualité "
                              "(18 = haute, 23 = moyenne, 28 = basse). "
                              "Par défaut : copie directe sans réencodage.")
    parseur.add_argument("-r", "--recursive", action="store_true",
                         help="Parcourir les sous-dossiers")
    parseur.add_argument("--overwrite", action="store_true",
                         help="Écraser les .mp4 déjà présents")
    args = parseur.parse_args(argv)

    ffmpeg = trouver_ffmpeg()
    if not ffmpeg:
        print("Erreur : ffmpeg est introuvable. Installez-le puis réessayez.\n"
              "  Le plus simple : pip install imageio-ffmpeg\n"
              "  Debian/Ubuntu  : sudo apt install ffmpeg\n"
              "  macOS (brew)   : brew install ffmpeg\n"
              "  Windows        : https://ffmpeg.org/download.html",
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
    succes = sum(convertir(f, args.output, args.crf, args.overwrite, ffmpeg)
                 for f in fichiers)
    echecs = len(fichiers) - succes

    print(f"\nTerminé : {succes} réussi(s), {echecs} échec(s).")
    return 0 if echecs == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
