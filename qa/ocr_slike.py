#!/usr/bin/env python3
"""Faza 2.2 — OCR preko svih slika. Sporo (~1,5 s po slici), pa se kešira.

    python qa/ocr_slike.py            # OCR nad slikama kojih nema u kešu
    python qa/ocr_slike.py --sve      # ponovo sve, ignoriši keš

Rezultat ide u qa/ocr.json: {ime_fajla: {"text": "...", "boxes": n}}.
`qa/check_slike.py` ga samo čita, pa se glavna provjera vrti u sekundi.

NAPOMENA O ALATU: koristi se `rapidocr-onnxruntime` (pip, bez sistemske
instalacije i bez admin prava), a ne Tesseract. Provjereno na kontrolnom uzorku:
iz `_backup_web_images/p039_q81.png` (original, ima odštampan tekst pitanja)
pročita „81. Na slici je prikazan saobracajni znak: a) traka za kretanje
teretnih vozila", a iz popravljene verzije ne pročita ništa.
"""

import json
import pathlib
import sys
import time

IMAGES = pathlib.Path("public/web_images")
OUT = pathlib.Path("qa/ocr.json")

sve = "--sve" in sys.argv
kes = {} if sve else (json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {})

from rapidocr_onnxruntime import RapidOCR  # noqa: E402  (spor uvoz, tek kad treba)

ocr = RapidOCR()
fajlovi = sorted(IMAGES.iterdir())
preostalo = [f for f in fajlovi if f.name not in kes]
print(f"slika: {len(fajlovi)}  u kešu: {len(kes)}  za obradu: {len(preostalo)}", flush=True)

t0 = time.time()
for i, f in enumerate(preostalo, 1):
    try:
        res, _ = ocr(str(f))
        redovi = [r[1] for r in (res or [])]
        kes[f.name] = {"text": " ".join(redovi), "boxes": len(redovi)}
    except Exception as e:  # slika koja se ne otvara je nalaz sam po sebi
        kes[f.name] = {"text": "", "boxes": 0, "greska": str(e)}
    if i % 25 == 0 or i == len(preostalo):
        proteklo = time.time() - t0
        print(f"  {i}/{len(preostalo)}  {proteklo:.0f}s  "
              f"(procjena ukupno {proteklo / i * len(preostalo):.0f}s)", flush=True)
        OUT.write_text(json.dumps(kes, ensure_ascii=False, indent=1), encoding="utf-8")

OUT.write_text(json.dumps(kes, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"upisano {OUT} — {len(kes)} slika, {time.time() - t0:.0f}s")
