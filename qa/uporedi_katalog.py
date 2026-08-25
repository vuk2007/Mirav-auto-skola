#!/usr/bin/env python3
"""Faza 5.1 — poređenje naše baze sa ZVANIČNIM katalogom (MUP CG).

    curl -sSL "https://wapi.gov.me/download/c4096c73-e71d-4b03-931b-a8809c971772?version=1.0" -o katalog.pdf
    pdftotext -layout katalog.pdf katalog.txt
    python qa/uporedi_katalog.py katalog.txt

Katalog NE sadrži označene tačne odgovore — provjereno pretragom za (X), [x],
podvučenim i riječju „tačan": nula pogodaka. Zvjezdice su nabrajanje opcija.
Zato se ovdje NE mogu provjeriti odgovori, ali se MOŽE provjeriti vjernost
teksta: da li je parser iskrivio pitanje ili opciju.

Poređenje ide nad tekstom BEZ dijakritike, jer pdftotext gubi ć/č/š/ž iz
kataloga („saobraćaj" izlazi kao „saobraaj"). To je ograničenje izvora, ne naše
baze — zato se dijakritika ne može verifikovati ovim putem.
"""

import difflib
import json
import pathlib
import re
import sys
import unicodedata
from collections import Counter

KATALOG = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "katalog.txt")
QUESTIONS = pathlib.Path("public/questions.json")


def bez_dijakritike(s: str) -> str:
    """Skida dijakritiku i svodi na poređivi oblik.

    pdftotext iz ovog kataloga izbaci ć/č/š/ž bez zamjene („kree" umjesto
    „kreće"), pa se i naša strana svodi na isti imenilac: prvo se đ→d, ć/č→c…,
    a zatim se BRIŠU slova koja katalog gubi. Ostaje kostur riječi.
    """
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")  # skini kvačice
    s = s.replace("đ", "d").replace("dj", "d")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(s.split())


def slicnost(a: str, b: str) -> float:
    """Koliko su dva teksta slična, 0..1.

    Tačno poređenje ovdje ne radi: pdftotext iz ovog kataloga GUBI slova ć i đ
    („poveća"->„povea", „između"->„izmeu"), ali š i ž pretvara u s i z, koje
    zadržava. Nijedna jednostavna normalizacija ne pokriva oba slučaja bez
    lažnih poklapanja, pa se mjeri sličnost i prijavljuje sve ispod praga.
    """
    return difflib.SequenceMatcher(None, bez_dijakritike(a), bez_dijakritike(b)).ratio()


# Ispod ovoga se smatra da tekst STVARNO nije isti, a ne da je enkoding pojeo slovo.
PRAG = 0.90


def kostur(s: str) -> str:
    """Grubi ključ za indeksiranje — samo suglasnički kostur, za brzo traženje."""
    return re.sub(r"[csz]", "", bez_dijakritike(s))


# ── parsiranje kataloga ──────────────────────────────────────────────────────
tekst = KATALOG.read_text(encoding="utf-8", errors="replace")
linije = [l.rstrip() for l in tekst.split("\n")]

unosi = []          # [{pitanje, opcije[]}]
tekuce = None
for l in linije:
    golo = l.strip()
    if not golo:
        continue
    if golo.startswith("- "):                      # novo pitanje
        if tekuce:
            unosi.append(tekuce)
        tekuce = {"pitanje": golo[2:].strip(), "opcije": []}
    elif golo.startswith("* "):                    # opcija
        if tekuce is not None:
            tekuce["opcije"].append(re.sub(r"\.{3,}.*$", "", golo[2:]).strip())
    elif tekuce is not None and not tekuce["opcije"]:
        tekuce["pitanje"] += " " + golo           # nastavak prelomljenog pitanja
    elif tekuce is not None and tekuce["opcije"]:
        tekuce["opcije"][-1] += " " + re.sub(r"\.{3,}.*$", "", golo).strip()
if tekuce:
    unosi.append(tekuce)

unosi = [u for u in unosi if len(u["opcije"]) == 3]
print(f"iz kataloga izvučeno: {len(unosi)} pitanja sa tačno tri opcije")

qs = json.loads(QUESTIONS.read_text(encoding="utf-8"))
nasi = [q for q in qs if q.get("options")]
print(f"naša baza: {len(nasi)} pitanja sa izborom (od {len(qs)})\n")

# ── indeksiranje kataloga ────────────────────────────────────────────────────
po_pitanju = {}
for u in unosi:
    po_pitanju.setdefault(kostur(u["pitanje"]), []).append(u)

# ── poređenje ────────────────────────────────────────────────────────────────
nadjeno, nema_pitanja, opcije_se_razlikuju, tekst_se_razlikuje = [], [], [], []
svi_kljucevi = list(po_pitanju)
for q in nasi:
    kand = po_pitanju.get(kostur(q["text"]), [])
    if not kand:
        # Rezervno traženje: tekst se možda razlikuje u jednom znaku (npr. ćirilično
        # „а" u id 36 i 52, ili tipfeler). Uzmi najbliži ključ iznad 0,88.
        blizu = difflib.get_close_matches(kostur(q["text"]), svi_kljucevi, n=1, cutoff=0.88)
        kand = po_pitanju[blizu[0]] if blizu else []
    if not kand:
        nema_pitanja.append((q["id"], q["text"]))
        continue

    # Od svih kandidata sa istim kosturom pitanja uzmi onog čije se OPCIJE
    # najbolje slažu — tako se razdvaja 70 pitanja koja dijele isti tekst.
    def skor(u):
        return sum(slicnost(q["options"][x], u["opcije"][i]) for i, x in enumerate("abc")) / 3

    najbolji = max(kand, key=skor)
    s_opcija = skor(najbolji)
    if s_opcija >= PRAG:
        nadjeno.append(q["id"])
        s_pitanja = slicnost(q["text"], najbolji["pitanje"])
        if s_pitanja < PRAG:
            tekst_se_razlikuje.append((q["id"], round(s_pitanja, 2), q["text"], najbolji["pitanje"]))
    else:
        razlike = []
        for i, x in enumerate("abc"):
            r = slicnost(q["options"][x], najbolji["opcije"][i])
            if r < PRAG:
                razlike.append((x, round(r, 2), q["options"][x], najbolji["opcije"][i]))
        opcije_se_razlikuju.append((q["id"], q["text"], round(s_opcija, 2), razlike))

print("=" * 78)
print("REZULTAT POREĐENJA")
print("=" * 78)
print(f"pitanje i sve tri opcije se poklapaju sa katalogom:  {len(nadjeno)}")
print(f"pitanje nađeno, ali se opcija razlikuje:             {len(opcije_se_razlikuju)}")
print(f"pitanje uopšte nije nađeno u katalogu:               {len(nema_pitanja)}")

if opcije_se_razlikuju:
    print("\n── OPCIJE KOJE SE RAZLIKUJU OD KATALOGA " + "─" * 38)
    for pid, tekst_p, uk, razlike in opcije_se_razlikuju:
        print(f"\nid={pid}  (slicnost opcija {uk})  {tekst_p[:80]}")
        for kljuc, r, nase, njihovo in razlike:
            print(f"   {kljuc}) [{r}] mi:      {nase[:100]}")
            print(f"            katalog: {njihovo[:100]}")

if nema_pitanja:
    print("\n── PITANJA KOJIH NEMA U KATALOGU " + "─" * 45)
    for pid, tekst_p in nema_pitanja[:40]:
        print(f"   id={pid:>3}  {tekst_p[:96]}")
    if len(nema_pitanja) > 40:
        print(f"   … i još {len(nema_pitanja) - 40}")

# ── provjera tipfelera iz faze 1: naši ili katalogovi? ───────────────────────
print("\n" + "=" * 78)
print("TIPFELERI IZ FAZE 1 — jesu li u zvaničnom katalogu?")
print("=" * 78)
TIPFELERI = ["raskrnice", "prevenstvom", "proustanja", "sitaciji", "izvrsti", "vozulo",
             "rasksnice", "propustatjuci", "cujem", "verikalno", "zaustvljanje",
             "rasksnici", "hrizontalno", "povrijednog"]
kat_plain = bez_dijakritike(tekst)
for t in TIPFELERI:
    u_katalogu = t in kat_plain
    print(f"   {t:<16} {'JESTE u katalogu — greška je zvanična' if u_katalogu else 'nije u katalogu — greška je naša'}")

kinds = Counter(q["kind"] for q in nasi if q["id"] in set(nadjeno))
print(f"\npoklapanje po kategorijama: {dict(kinds)}")
sys.exit(0 if not nema_pitanja and not opcije_se_razlikuju else 1)
