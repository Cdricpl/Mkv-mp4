#!/usr/bin/env python3
"""Convertisseur MKV -> MP4 — interface graphique.

Fenêtre simple pour convertir des fichiers .mkv en .mp4 :
sélection à la souris, barre de progression, journal, annulation.
Copie directe des pistes quand c'est possible (rapide, sans perte),
réencodage automatique sinon.

Lancement :
    python3 convertisseur_gui.py
(sous Windows : double-cliquer sur Convertir-MKV-MP4.bat)
"""

import importlib
import os
import re
import subprocess
import sys
import threading
from pathlib import Path

try:
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk
except ModuleNotFoundError:
    raise SystemExit(
        "L'interface graphique nécessite tkinter, absent de votre Python.\n"
        "  Debian/Ubuntu : sudo apt install python3-tk\n"
        "  Fedora        : sudo dnf install python3-tkinter\n"
        "  Windows/macOS : réinstallez Python depuis python.org\n"
        "Sinon, utilisez la version en ligne de commande : mkv_to_mp4.py")

from mkv_to_mp4 import commande_ffmpeg, lister_mkv, trouver_ffmpeg

# Sous Windows, empêche l'ouverture d'une console noire à chaque conversion.
FLAGS_SANS_FENETRE = (subprocess.CREATE_NO_WINDOW
                      if os.name == "nt" else 0)

RE_DUREE = re.compile(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)")
RE_TEMPS = re.compile(r"out_time=(\d+):(\d+):(\d+(?:\.\d+)?)")

QUALITES = {
    "Auto (copie rapide)": None,
    "Haute (réencodage)": 18,
    "Moyenne (réencodage)": 23,
    "Basse (réencodage)": 28,
    "Lecteur DVD portable (DivX .avi)": "divx",
}


def en_secondes(h: str, m: str, s: str) -> float:
    return int(h) * 3600 + int(m) * 60 + float(s)


def duree_fichier(ffmpeg: str, fichier: Path) -> float | None:
    """Durée du média en secondes (lue dans la sortie de `ffmpeg -i`)."""
    resultat = subprocess.run(
        [ffmpeg, "-hide_banner", "-i", str(fichier)],
        capture_output=True, text=True, creationflags=FLAGS_SANS_FENETRE)
    trouve = RE_DUREE.search(resultat.stderr)
    return en_secondes(*trouve.groups()) if trouve else None


class Application(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("Convertisseur MKV → MP4")
        self.minsize(560, 460)

        self.fichiers: list[Path] = []
        self.dossier_sortie: Path | None = None
        self.conversion_en_cours = False
        self.annulation_demandee = False
        self.processus: subprocess.Popen | None = None

        self._construire_interface()

    # ----- interface -----------------------------------------------------

    def _construire_interface(self) -> None:
        cadre = ttk.Frame(self, padding=12)
        cadre.pack(fill="both", expand=True)

        # Boutons de sélection
        ligne_boutons = ttk.Frame(cadre)
        ligne_boutons.pack(fill="x")
        ttk.Button(ligne_boutons, text="Ajouter des fichiers…",
                   command=self.ajouter_fichiers).pack(side="left")
        ttk.Button(ligne_boutons, text="Ajouter un dossier…",
                   command=self.ajouter_dossier).pack(side="left", padx=6)
        ttk.Button(ligne_boutons, text="Vider la liste",
                   command=self.vider_liste).pack(side="left")

        # Liste des fichiers
        self.liste = tk.Listbox(cadre, height=8)
        self.liste.pack(fill="both", expand=True, pady=(8, 8))

        # Options : qualité + dossier de sortie
        options = ttk.Frame(cadre)
        options.pack(fill="x")
        ttk.Label(options, text="Qualité :").pack(side="left")
        self.qualite = tk.StringVar(value="Auto (copie rapide)")
        ttk.Combobox(options, textvariable=self.qualite, width=28,
                     state="readonly",
                     values=list(QUALITES)).pack(side="left", padx=(4, 16))
        ttk.Button(options, text="Dossier de sortie…",
                   command=self.choisir_sortie).pack(side="left")
        self.label_sortie = ttk.Label(options,
                                      text="(à côté des fichiers d'origine)")
        self.label_sortie.pack(side="left", padx=6)

        # Boutons convertir / annuler
        actions = ttk.Frame(cadre)
        actions.pack(fill="x", pady=(10, 4))
        self.bouton_convertir = ttk.Button(actions, text="▶  Convertir",
                                           command=self.lancer_conversion)
        self.bouton_convertir.pack(side="left")
        self.bouton_annuler = ttk.Button(actions, text="Annuler",
                                         command=self.annuler,
                                         state="disabled")
        self.bouton_annuler.pack(side="left", padx=6)

        # Progression + journal
        self.progression = ttk.Progressbar(cadre, maximum=1000)
        self.progression.pack(fill="x", pady=(6, 2))
        self.statut = ttk.Label(cadre, text="Prêt.")
        self.statut.pack(anchor="w")
        self.journal = tk.Text(cadre, height=7, state="disabled")
        self.journal.pack(fill="both", expand=True, pady=(6, 0))

    # ----- actions utilisateur -------------------------------------------

    def ajouter_fichiers(self) -> None:
        chemins = filedialog.askopenfilenames(
            title="Choisir des fichiers MKV",
            filetypes=[("Fichiers MKV", "*.mkv *.MKV"), ("Tous", "*.*")])
        self._ajouter(Path(c) for c in chemins)

    def ajouter_dossier(self) -> None:
        dossier = filedialog.askdirectory(title="Choisir un dossier")
        if dossier:
            trouves = lister_mkv(Path(dossier), recursif=True)
            if not trouves:
                messagebox.showinfo("Aucun fichier",
                                    "Aucun fichier .mkv dans ce dossier.")
            self._ajouter(trouves)

    def _ajouter(self, chemins) -> None:
        for chemin in chemins:
            if chemin not in self.fichiers and chemin.suffix.lower() == ".mkv":
                self.fichiers.append(chemin)
                self.liste.insert("end", str(chemin))

    def vider_liste(self) -> None:
        self.fichiers.clear()
        self.liste.delete(0, "end")

    def choisir_sortie(self) -> None:
        dossier = filedialog.askdirectory(title="Dossier de sortie")
        if dossier:
            self.dossier_sortie = Path(dossier)
            self.label_sortie.config(text=dossier)

    def annuler(self) -> None:
        self.annulation_demandee = True
        if self.processus and self.processus.poll() is None:
            self.processus.terminate()
        self.ecrire_journal("Annulation demandée…")

    # ----- conversion -----------------------------------------------------

    def lancer_conversion(self) -> None:
        if self.conversion_en_cours:
            return
        if not self.fichiers:
            messagebox.showwarning("Aucun fichier",
                                   "Ajoutez d'abord des fichiers MKV.")
            return
        ffmpeg = trouver_ffmpeg()
        if not ffmpeg:
            if messagebox.askyesno(
                    "Moteur de conversion manquant",
                    "Le moteur de conversion (ffmpeg) n'est pas encore "
                    "installé.\n\n"
                    "Voulez-vous l'installer automatiquement maintenant ?\n"
                    "(téléchargement unique d'environ 30 Mo, puis la "
                    "conversion démarrera toute seule)"):
                self._installer_ffmpeg()
            return

        self.conversion_en_cours = True
        self.annulation_demandee = False
        self.bouton_convertir.config(state="disabled")
        self.bouton_annuler.config(state="normal")
        threading.Thread(target=self._convertir_tout, args=(ffmpeg,),
                         daemon=True).start()

    def _installer_ffmpeg(self) -> None:
        """Installe imageio-ffmpeg via pip, puis relance la conversion."""
        self.bouton_convertir.config(state="disabled")
        self.statut.config(text="Installation du moteur de conversion…")
        self.ecrire_journal("Téléchargement du moteur (imageio-ffmpeg)…")

        def _travail() -> None:
            resultat = subprocess.run(
                [sys.executable, "-m", "pip", "install", "imageio-ffmpeg"],
                capture_output=True, text=True,
                creationflags=FLAGS_SANS_FENETRE)
            importlib.invalidate_caches()  # rend le paquet importable de suite
            ok = resultat.returncode == 0 and trouver_ffmpeg() is not None
            self.after(0, self._fin_installation, ok,
                       resultat.stderr or resultat.stdout)

        threading.Thread(target=_travail, daemon=True).start()

    def _fin_installation(self, ok: bool, erreurs: str) -> None:
        self.bouton_convertir.config(state="normal")
        if ok:
            self.ecrire_journal("✓ Moteur de conversion installé.")
            self.statut.config(text="Moteur installé, conversion…")
            self.lancer_conversion()
        else:
            self.statut.config(text="Installation impossible.")
            self.ecrire_journal(f"✗ Installation impossible :\n"
                                f"{erreurs.strip()}")
            messagebox.showerror(
                "Installation impossible",
                "L'installation automatique a échoué (voir le journal).\n\n"
                "Ouvrez un terminal (cmd) et tapez :\n"
                "    pip install imageio-ffmpeg\n"
                "puis relancez ce programme.")

    def _convertir_tout(self, ffmpeg: str) -> None:
        total = len(self.fichiers)
        reussis = 0
        for index, fichier in enumerate(self.fichiers):
            if self.annulation_demandee:
                break
            self.maj_statut(f"({index + 1}/{total}) {fichier.name}")
            if self._convertir_un(ffmpeg, fichier, index, total):
                reussis += 1
        self.after(0, self._fin_conversion, reussis, total)

    def _executer(self, commande: list[str], duree: float | None,
                  index: int, total: int) -> tuple[int, str]:
        """Lance ffmpeg en suivant la progression. Retourne (code, erreurs)."""
        # -progress écrit l'avancement sur la sortie standard
        commande = commande[:1] + ["-progress", "pipe:1", "-nostats",
                                   "-loglevel", "error"] + commande[1:]
        self.processus = subprocess.Popen(
            commande, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, creationflags=FLAGS_SANS_FENETRE)
        for ligne in self.processus.stdout:
            trouve = RE_TEMPS.search(ligne)
            if trouve and duree:
                fraction = min(en_secondes(*trouve.groups()) / duree, 1.0)
                self.maj_progression((index + fraction) / total)
        erreurs = self.processus.stderr.read()
        code = self.processus.wait()
        self.processus = None
        return code, erreurs

    def _convertir_un(self, ffmpeg: str, fichier: Path,
                      index: int, total: int) -> bool:
        dossier = self.dossier_sortie or fichier.parent
        dossier.mkdir(parents=True, exist_ok=True)
        crf = QUALITES[self.qualite.get()]
        extension = ".avi" if crf == "divx" else ".mp4"
        sortie = dossier / (fichier.stem + extension)

        duree = duree_fichier(ffmpeg, fichier)
        code, erreurs = self._executer(
            commande_ffmpeg(ffmpeg, fichier, sortie, crf), duree, index, total)

        # Copie directe impossible (codec incompatible MP4) : on réencode.
        if code != 0 and crf is None and not self.annulation_demandee:
            self.ecrire_journal(f"  copie directe impossible pour "
                                f"{fichier.name}, réencodage…")
            code, erreurs = self._executer(
                commande_ffmpeg(ffmpeg, fichier, sortie, 23),
                duree, index, total)

        self.maj_progression((index + 1) / total)

        if code == 0:
            self.ecrire_journal(f"✓ {sortie.name}")
            return True
        sortie.unlink(missing_ok=True)  # fichier incomplet
        if self.annulation_demandee:
            self.ecrire_journal(f"✗ Annulé : {fichier.name}")
        else:
            self.ecrire_journal(f"✗ Échec : {fichier.name}\n{erreurs.strip()}")
        return False

    def _fin_conversion(self, reussis: int, total: int) -> None:
        self.conversion_en_cours = False
        self.bouton_convertir.config(state="normal")
        self.bouton_annuler.config(state="disabled")
        if self.annulation_demandee:
            self.statut.config(text=f"Annulé ({reussis}/{total} terminés).")
        else:
            self.statut.config(text=f"Terminé : {reussis}/{total} réussi(s).")
            messagebox.showinfo("Terminé",
                                f"{reussis}/{total} fichier(s) converti(s).")

    # ----- mises à jour de l'interface (thread-safe) ----------------------

    def maj_statut(self, texte: str) -> None:
        self.after(0, lambda: self.statut.config(text=texte))

    def maj_progression(self, fraction: float) -> None:
        self.after(0, lambda: self.progression.config(value=fraction * 1000))

    def ecrire_journal(self, texte: str) -> None:
        def _ecrire() -> None:
            self.journal.config(state="normal")
            self.journal.insert("end", texte + "\n")
            self.journal.see("end")
            self.journal.config(state="disabled")
        self.after(0, _ecrire)


if __name__ == "__main__":
    Application().mainloop()
