#!/usr/bin/env python3
"""Faza 2 — slike.

    python qa/ocr_slike.py       # prvo ovo (sporo, kešira se u qa/ocr.json)
    python qa/check_slike.py     # pa ovo

Pokriva 2.1 reference i fajlove, 2.2 OCR, 2.3 geometrijske sumnje,
2.4 slaganje slike i pitanja, 2.5 težinu.
"""

import json
import pathlib
import re
import sys
from collections import Counter, defaultdict

import numpy as np
from PIL import Image
from scipy import ndimage

QUESTIONS = pathlib.Path("public/questions.json")
IMAGES = pathlib.Path("public/web_images")
OCR = pathlib.Path("qa/ocr.json")

qs = json.loads(QUESTIONS.read_text(encoding="utf-8"))
na_disku = {f.name: f for f in IMAGES.iterdir() if f.is_file()}

nalazi, cisto = [], []
nalaz = lambda sev, n, d: nalazi.append((sev, n, d))  # noqa: E731
ok = lambda n, d="": cisto.append((n, d))  # noqa: E731


def naslov(t):
    print("\n" + "=" * 78 + f"\n{t}\n" + "=" * 78)


# ═════════════════════════════════════════════════════════════════════════════
naslov("2.1  REFERENCE I FAJLOVI")

referencirane = {q["image"]: q["id"] for q in qs if q.get("image")}
fali = sorted(set(referencirane) - set(na_disku))
sirocici = sorted(set(na_disku) - set(referencirane))

print(f"referencirano iz baze: {len(referencirane)}   na disku: {len(na_disku)}")
print(f"referencirano a NEMA na disku: {len(fali)}")
print(f"na disku a NIJE referencirano (siročići): {len(sirocici)}")
if fali:
    for f in fali[:20]:
        print(f"   {f}  (pitanje {referencirane[f]})")
    nalaz("P0", f"Slika referencirana iz baze ne postoji na disku ({len(fali)})",
          [f"{f} — pitanje {referencirane[f]}" for f in fali])
else:
    ok("Svaka slika iz baze postoji na disku", f"{len(referencirane)} fajlova")
if sirocici:
    for f in sirocici[:20]:
        print(f"   {f}")
    nalaz("P2", f"Fajl na disku koji nijedno pitanje ne koristi ({len(sirocici)})", sirocici)
else:
    ok("Nema siročića — svaki fajl je referenciran")

prazni, nemoguci = [], []
dimenzije = {}
for ime, put in sorted(na_disku.items()):
    if put.stat().st_size == 0:
        prazni.append(ime)
        continue
    try:
        with Image.open(put) as im:
            im.verify()
        with Image.open(put) as im:
            dimenzije[ime] = (im.size, im.mode, put.stat().st_size)
    except Exception as e:
        nemoguci.append((ime, str(e)))

print(f"fajlova od 0 bajta: {len(prazni)}")
print(f"fajlova koje Pillow ne može da otvori: {len(nemoguci)}")
if prazni or nemoguci:
    nalaz("P0", "Neispravan fajl slike", [str(x) for x in prazni + nemoguci])
else:
    ok("Sve slike se otvaraju i nijedna nije prazna", f"{len(dimenzije)} fajlova")

# ═════════════════════════════════════════════════════════════════════════════
naslov("2.2  OCR — TEKST UNUTAR SLIKE")

if not OCR.exists():
    print("qa/ocr.json ne postoji — pokreni prvo: python qa/ocr_slike.py")
    sys.exit(2)
ocr = json.loads(OCR.read_text(encoding="utf-8"))
print(f"OCR rezultata: {len(ocr)} / {len(na_disku)} slika")

# „Na slici", brojevi pitanja, oznake opcija — obrasci odštampanog teksta iz PDF-a.
PITANJE_RE = re.compile(r"\b\d{1,3}\.\s*(Na|U|Kako|Znak|Vozac|Vozač)", re.I)
OPCIJA_RE = re.compile(r"\b[abc]\)\s")
FRAZA_RE = re.compile(r"na slici|prikazan|saobra|situacij", re.I)

sumnjive = []
for ime, r in sorted(ocr.items()):
    t = " ".join(r.get("text", "").split())
    razlozi = []
    if len(t) > 60:
        razlozi.append(f"mnogo teksta ({len(t)} znakova)")
    if PITANJE_RE.search(t):
        razlozi.append("broj+tekst pitanja")
    if OPCIJA_RE.search(t):
        razlozi.append("oznake opcija a)/b)/c)")
    if FRAZA_RE.search(t) and len(t) > 20:
        razlozi.append("fraza iz teksta pitanja")
    if razlozi:
        sumnjive.append((ime, len(t), ", ".join(razlozi), t[:100]))

print(f"sumnjivih slika: {len(sumnjive)}")
print(f"{'fajl':<18}{'zn':>5}  razlog / pročitani tekst")
for ime, n, razlog, t in sumnjive:
    print(f"{ime:<18}{n:>5}  {razlog}")
    print(f"{'':<23}  {t!r}")
if sumnjive:
    nalaz("P1", f"Slika sadrži odštampan tekst iz kataloga ({len(sumnjive)})",
          [f"{i} ({n} zn., {r}): {t}" for i, n, r, t in sumnjive])
else:
    ok("Nijedna slika ne sadrži odštampan tekst pitanja", f"OCR preko {len(ocr)} slika")

# Koliko slika uopšte ima ikakav tekst (znakovi ga legitimno imaju: STOP, E-70, 30…)
sa_tekstom = sum(1 for r in ocr.values() if r.get("text", "").strip())
print(f"\nslika sa bilo kakvim pročitanim tekstom: {sa_tekstom} "
      f"(natpisi na znakovima su legitimni: STOP, E-70, ograničenja brzine…)")

# ═════════════════════════════════════════════════════════════════════════════
naslov("2.3  GEOMETRIJSKE SUMNJE")


def analiza(put):
    """Mjeri geometriju slike.

    Vraća (w, h, komp_grubo, komp_fino, dodiruje_dno, margine, pojasevi).

    DVA praga, jer su to dva različita pitanja:
      * `komp_grubo` (pojas > 15% visine) — kandidat za PRELIV: dvije grafike
        koje nemaju veze jedna s drugom obično razdvaja široka bijela traka.
      * `komp_fino` (pojas >= 3 px) — znak + DOPUNSKA TABLA: njih razdvaja
        tanka linija, kod p037_q65 svega 4 px na 264 px visine (1,5%).
    Grubi prag na finom pitanju daje lažan nalaz „nema dopunsku tablu" za svaki
    znak koji je uredno ima.
    """
    with Image.open(put) as im:
        a = np.asarray(im.convert("L")).astype(int)
    h, w = a.shape
    ink = a < 245
    if not ink.any():
        return w, h, 0, 0, False, (0, 0, 0, 0), []

    redovi = ink.any(axis=1)
    kolone = ink.any(axis=0)
    gore = int(np.argmax(redovi))
    dolje = h - 1 - int(np.argmax(redovi[::-1]))
    lijevo = int(np.argmax(kolone))
    desno = w - 1 - int(np.argmax(kolone[::-1]))

    def pojasevi_od(prag):
        out, y = [], gore
        while y <= dolje:
            if not redovi[y]:
                s0 = y
                while y <= dolje and not redovi[y]:
                    y += 1
                if y - s0 >= prag:
                    out.append((s0, y - 1))
            else:
                y += 1
        return out

    grubi = pojasevi_od(max(4, int(h * 0.15)))
    fini = pojasevi_od(3)
    margine = (gore, h - 1 - dolje, lijevo, w - 1 - desno)
    return w, h, len(grubi) + 1, len(fini) + 1, dolje >= h - 1, margine, grubi


odnos, komponente, odsjeceno, margina = [], [], [], []
for ime in sorted(dimenzije):
    w, h, komp, _fino, dno, marg, pojasevi = analiza(na_disku[ime])
    if w / h > 3:
        odnos.append((ime, f"{w}×{h}", f"{w/h:.1f}:1 široka"))
    if h / w > 3:
        odnos.append((ime, f"{w}×{h}", f"1:{h/w:.1f} visoka"))
    if komp >= 3:
        komponente.append((ime, f"{w}×{h}", komp, pojasevi))
    if dno:
        odsjeceno.append((ime, f"{w}×{h}"))
    najveca = max(marg[0] / h, marg[1] / h, marg[2] / w, marg[3] / w)
    if najveca > 0.25:
        margina.append((ime, f"{w}×{h}", f"{najveca*100:.0f}%"))

print(f"odnos stranica preko 3:1 ili 1:3 — {len(odnos)}")
for x in odnos[:15]:
    print(f"   {x[0]:<18}{x[1]:<12}{x[2]}")
print(f"\ntri ili više komponenti razdvojenih bijelim pojasom >15% visine — {len(komponente)}")
for ime, dim, k, p in komponente[:20]:
    print(f"   {ime:<18}{dim:<12}{k} komponente, pojasevi {p}")
print(f"\nsadržaj dodiruje donju ivicu (moguće odsječeno) — {len(odsjeceno)}")
for x in odsjeceno[:25]:
    print(f"   {x[0]:<18}{x[1]}")
print(f"\nbijela margina preko 25% sa neke strane — {len(margina)}")
for x in margina[:15]:
    print(f"   {x[0]:<18}{x[1]:<12}{x[2]}")

if odnos:
    nalaz("P1", f"Sumnjiv odnos stranica ({len(odnos)})", [f"{a} {b} {c}" for a, b, c in odnos])
else:
    ok("Nijedna slika nema odnos stranica preko 3:1")
if komponente:
    nalaz("P1", f"Tri ili više odvojenih komponenti — kandidat za preliv ({len(komponente)})",
          [f"{i} {d} {k} komponente, pojasevi {p}" for i, d, k, p in komponente])
else:
    ok("Nijedna slika nema tri ili više odvojenih komponenti")
if odsjeceno:
    nalaz("P1", f"Sadržaj dodiruje donju ivicu — moguće odsječeno ({len(odsjeceno)})",
          [f"{a} {b}" for a, b in odsjeceno])
else:
    ok("Nijedna slika nije odsječena na donjoj ivici")
if margina:
    nalaz("P2", f"Bijela margina preko 25% ({len(margina)})", [f"{a} {b} {c}" for a, b, c in margina])
else:
    ok("Nijedna slika nema bijelu marginu preko 25%")

# ═════════════════════════════════════════════════════════════════════════════
naslov("2.4  SLIKA I PITANJE SE POKLAPAJU")

bez_slike_znak = [q["id"] for q in qs if q["kind"] == "znak" and not q.get("image")]
sa_slikom_tekst = [q["id"] for q in qs if q["type"] == "text" and q.get("image")]
print(f"pitanja kind=znak bez slike: {bez_slike_znak or 'nijedno'}")
print(f"pitanja type=text sa slikom: {sa_slikom_tekst or 'nijedno'}")
if bez_slike_znak:
    nalaz("P0", "Pitanje o znaku nema sliku", [str(bez_slike_znak)])
else:
    ok("Svako pitanje kind=znak ima sliku")
if sa_slikom_tekst:
    nalaz("P1", "Tekstualno pitanje ima sliku", [str(sa_slikom_tekst)])
else:
    ok("Nijedno type=text pitanje nema sliku")

def krupne_komponente(put, min_udio=0.01):
    """Broj POVEZANIH komponenti većih od `min_udio` površine — pravo 2D
    povezivanje, ne vodoravne trake.

    Vodoravne trake ne rade posao: kod znaka sa dopunskom tablom između njih
    često nema nijednog potpuno bijelog reda (ivice se dodiruju kroz antialias),
    a kod tri panela jedan pored drugog razmak je uspravan, ne vodoravan.
    """
    with Image.open(put) as im:
        a = np.asarray(im.convert("L")).astype(int)
    ink = a < 235
    # Zatvori tanke pukotine unutar jedne figure, da se jedan znak ne raspadne.
    ink = ndimage.binary_closing(ink, structure=np.ones((3, 3)), iterations=2)
    lab, n = ndimage.label(ink)
    if n == 0:
        return 0
    velicine = ndimage.sum(ink, lab, range(1, n + 1))
    prag = ink.size * min_udio
    return int((velicine >= prag).sum())


# „znaci" (množina) → slika bi trebalo da ima bar dvije komponente
mnozina = [q for q in qs if q.get("image") and re.search(r"znac[ie]\b|znakov", q["text"], re.I)]
neslaganje = []
for q in mnozina:
    komp = krupne_komponente(na_disku[q["image"]])
    w, h = dimenzije[q["image"]][0]
    if komp < 2:
        neslaganje.append((q["id"], q["image"], f"{w}×{h}", komp, q["text"][:60]))
print(f"\npitanja u mnozini (znaci / znakovi): {len(mnozina)}")
print(f"   od toga sa slikom koja ima samo jednu komponentu: {len(neslaganje)}")
for x in neslaganje:
    print(f"   id={x[0]:>3} {x[1]:<18}{x[2]:<12}{x[3]} komp.  {x[4]}")
if neslaganje:
    nalaz("P1", f"Pitanje traži više znakova, a slika ima jednu komponentu ({len(neslaganje)})",
          [f"id={a} {b} {c} {d} komponenta — {e}" for a, b, c, d, e in neslaganje])
else:
    ok("Svako pitanje u množini ima sliku sa bar dvije komponente")

# ═════════════════════════════════════════════════════════════════════════════
naslov("2.5  TEŽINA")

ukupno = sum(d[2] for d in dimenzije.values())
po_tipu = defaultdict(lambda: [0, 0])
for ime, (_, _, vel) in dimenzije.items():
    t = pathlib.Path(ime).suffix.lower()
    po_tipu[t][0] += 1
    po_tipu[t][1] += vel
print(f"ukupno: {ukupno/1024/1024:.2f} MB u {len(dimenzije)} fajlova "
      f"(prosjek {ukupno/len(dimenzije)/1024:.0f} kB)")
for t, (n, v) in sorted(po_tipu.items()):
    print(f"   {t:<6}{n:>4} fajlova   {v/1024/1024:>6.2f} MB")

najveci = sorted(dimenzije.items(), key=lambda x: -x[1][2])[:20]
print("\n20 najvećih:")
for ime, ((w, h), mode, vel) in najveci:
    print(f"   {ime:<18}{vel/1024:>7.0f} kB   {w}×{h}  {mode}")
print(f"\nzbir 20 najvećih: {sum(v[2] for _, v in najveci)/1024/1024:.2f} MB "
      f"({sum(v[2] for _, v in najveci)/ukupno*100:.0f}% ukupne težine)")

# ═════════════════════════════════════════════════════════════════════════════
naslov("SAŽETAK FAZE 2")

po_sev = Counter(s for s, _, _ in nalazi)
print(f"P0: {po_sev.get('P0', 0)}   P1: {po_sev.get('P1', 0)}   P2: {po_sev.get('P2', 0)}\n")
for sev in ("P0", "P1", "P2"):
    for s, n, _ in nalazi:
        if s == sev:
            print(f"  {sev}  {n}")
print(f"\nprovjereno i čisto: {len(cisto)} stavki")
for n, d in cisto:
    print(f"  ✓ {n}" + (f" — {d}" if d else ""))

sys.exit(1 if po_sev.get("P0") else 0)
