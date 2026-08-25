#!/usr/bin/env python3
"""Faza 5.1 — stratifikovani uzorak od 60 pitanja za potpis instruktora.

    python qa/uzorak_za_instruktora.py

Zvanični katalog NE sadrži označene tačne odgovore (provjereno u
`qa/uporedi_katalog.py`), pa se tačnost ne može provjeriti programski. Ovo je
jedini preostali put: uzorak koji instruktor iz MIRAV-a pregleda i potpiše.

Uzorak je STRATIFIKOVAN — udio po `kind` odgovara udjelu u bazi, pa nalaz na
uzorku ima smisla prenijeti na cjelinu. Uz to su UVIJEK uključena pitanja koja
nose poseban rizik:
  * 6 pitanja kojih NEMA u zvaničnom katalogu (id 90–95),
  * pitanje 272, gdje je opcija b) pokvarena parserom.
Sjeme je fiksno, pa je uzorak ponovljiv i može se ponovo generisati identično.
"""

import json
import pathlib
import random
from collections import Counter

QUESTIONS = pathlib.Path("public/questions.json")
IZLAZ = pathlib.Path("qa/uzorak-za-instruktora.md")
VELICINA = 60
SJEME = 20260825

# Pitanja koja moraju ući bez obzira na izvlačenje — vidi qa/nalazi.md, QA-5-1 i QA-5-2.
OBAVEZNA = {
    90: "nema u zvaničnom katalogu",
    91: "nema u zvaničnom katalogu",
    92: "nema u zvaničnom katalogu",
    93: "nema u zvanicnom katalogu; uz to ima i tipfeler: sigurtosni umjesto sigurnosni",
    94: "nema u zvaničnom katalogu",
    95: "nema u zvaničnom katalogu",
    272: "opciju b) je parser pokvario — katalog daje drugačiji tekst",
}

qs = json.loads(QUESTIONS.read_text(encoding="utf-8"))
rnd = random.Random(SJEME)

obavezni = [q for q in qs if q["id"] in OBAVEZNA]
ostali = [q for q in qs if q["id"] not in OBAVEZNA]

# Koliko iz koje kategorije, srazmjerno bazi, za preostala mjesta.
preostalo = VELICINA - len(obavezni)
udio = Counter(q["kind"] for q in ostali)
ukupno = sum(udio.values())
kvota = {k: max(1, round(preostalo * n / ukupno)) for k, n in udio.items()}
# poravnaj na tačan broj
while sum(kvota.values()) > preostalo:
    kvota[max(kvota, key=lambda k: kvota[k])] -= 1
while sum(kvota.values()) < preostalo:
    kvota[max(udio, key=lambda k: udio[k])] += 1

izabrani = list(obavezni)
for kind, n in kvota.items():
    bazen = [q for q in ostali if q["kind"] == kind]
    izabrani += rnd.sample(bazen, min(n, len(bazen)))
izabrani.sort(key=lambda q: q["id"])

redovi = [
    "# Uzorak za provjeru tačnih odgovora — potpis instruktora",
    "",
    f"**{len(izabrani)} pitanja** od ukupno {len(qs)}. Generisano sa "
    f"`python qa/uzorak_za_instruktora.py` (sjeme {SJEME}, ponovljivo).",
    "",
    "Zvanični katalog MUP-a **ne sadrži označene tačne odgovore** — provjereno pretragom",
    'za `(X)`, `[x]`, podvučenim tekstom i riječju „tačan": nula pogodaka na 214 strana.',
    "Zato se tačnost ne može provjeriti programski i traži se stručna potvrda.",
    "",
    "Uzorak je stratifikovan — udio po vrsti pitanja odgovara udjelu u bazi:",
    "",
    "| Vrsta | U uzorku | U bazi |",
    "| ----- | -------- | ------ |",
]
u_uzorku = Counter(q["kind"] for q in izabrani)
u_bazi = Counter(q["kind"] for q in qs)
for k in sorted(u_bazi, key=lambda x: -u_bazi[x]):
    redovi.append(f"| {k} | {u_uzorku.get(k, 0)} | {u_bazi[k]} |")

redovi += [
    "",
    "## Kako se popunjava",
    "",
    "Uz svako pitanje stoji odgovor **koji naša aplikacija smatra tačnim**. Za svako:",
    "",
    "- ako je tačan → zaokružiti **DA**",
    "- ako nije → zaokružiti **NE** i upisati koje je slovo tačno",
    "",
    "Na kraju: ime, potpis i datum. Bez toga se ne pušta polaznicima.",
    "",
    "---",
    "",
]

for i, q in enumerate(izabrani, 1):
    upozorenje = OBAVEZNA.get(q["id"])
    redovi.append(f"### {i}. (id {q['id']})" + (f"  ⚠️ **{upozorenje}**" if upozorenje else ""))
    redovi.append("")
    if q.get("image"):
        redovi.append(f"![slika](../public/web_images/{q['image']})")
        redovi.append("")
    redovi.append(f"**{q['text']}**")
    redovi.append("")
    if q["type"] == "ordering":
        redovi.append(f"- naš odgovor (redoslijed): **{'-'.join(q['answer_sequence'])}**")
    else:
        for k in ("a", "b", "c"):
            oznaka = " **← naš odgovor**" if q["correct"] == k else ""
            redovi.append(f"- **{k})** {q['options'][k]}{oznaka}")
    redovi.append("")
    redovi.append("Tačno?   **DA**  /  **NE** → tačno je slovo: ______")
    redovi.append("")
    redovi.append("---")
    redovi.append("")

redovi += [
    "## Potvrda",
    "",
    "Potvrđujem da sam pregledao/la gore navedena pitanja i označene odgovore.",
    "",
    "Ime i prezime: ______________________________",
    "",
    "Zvanje / broj licence: ______________________",
    "",
    "Potpis: ____________________   Datum: ____________",
    "",
]

IZLAZ.write_text("\n".join(redovi), encoding="utf-8")
print(f"upisano {IZLAZ} — {len(izabrani)} pitanja")
print(f"raspodjela u uzorku: {dict(u_uzorku)}")
print(f"obavezno uključeno: {sorted(OBAVEZNA)}")
