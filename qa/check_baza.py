#!/usr/bin/env python3
"""Faza 1 — integritet baze pitanja.

    python qa/check_baza.py

Ispisuje jedan tabelarni izvještaj. Svaka stavka koja padne ide u qa/nalazi.md.

NAPOMENA O STRUKTURI: repo nema odvojene banke me/en/ru. Postoji jedan
public/questions.json, a prevodi su inline polja (text_en / options_en / text_ru
/ text_sq). Posljedica: id, correct, points, area, kind i image postoje SAMO
JEDNOM po pitanju, pa se fizički ne mogu razići između jezika. Provjere iz
tačke 1.6 se zato svode na pokrivenost i kvalitet prevoda.
"""

import json
import pathlib
import re
import sys
import unicodedata
from collections import Counter, defaultdict

QUESTIONS = pathlib.Path("public/questions.json")
IMAGES = pathlib.Path("public/web_images")
LANGS = ["en", "ru", "sq"]  # crnogorski je osnovni zapis (text / options)
OPTION_KEYS = ["a", "b", "c"]
KINDS = {"znak", "teorija", "policajac", "kosnik", "situacija", "ostalo"}
TYPES = {"text", "image", "ordering"}

qs = json.loads(QUESTIONS.read_text(encoding="utf-8"))

# Svaki nalaz: (oznaka, ozbiljnost, naslov, [redovi dokaza])
nalazi = []
cisto = []


def nalaz(sev, naslov, dokaz):
    nalazi.append((sev, naslov, dokaz))


def ok(naslov, detalj=""):
    cisto.append((naslov, detalj))


def naslov(t):
    print()
    print("=" * 78)
    print(t)
    print("=" * 78)


def norm(s):
    """Za poređenje tekstova: mala slova, bez interpunkcije i višestrukih razmaka."""
    s = unicodedata.normalize("NFC", s).lower()
    s = re.sub(r"[^\w\s]", " ", s, flags=re.UNICODE)
    return " ".join(s.split())


def is_ordering(q):
    return q.get("type") == "ordering"


# ─────────────────────────────────────────────────────────────────────────────
naslov("1.1  SHEMA I OBAVEZNA POLJA")

OBAVEZNA = ["id", "text", "points", "type", "area", "kind"]
manjak = defaultdict(list)
prazno = defaultdict(list)
for q in qs:
    for f in OBAVEZNA:
        if f not in q:
            manjak[f].append(q.get("id", "?"))
        elif q[f] is None and f != "points":
            prazno[f].append(q.get("id", "?"))
        elif isinstance(q[f], str) and not q[f].strip():
            prazno[f].append(q.get("id", "?"))
    # odgovor: choice ima options+correct, ordering ima answer_sequence
    if is_ordering(q):
        if not q.get("answer_sequence"):
            manjak["answer_sequence"].append(q["id"])
    else:
        if not q.get("options"):
            manjak["options"].append(q.get("id", "?"))
        if not q.get("correct"):
            manjak["correct"].append(q.get("id", "?"))

print(f"pitanja: {len(qs)}")
print(f"nedostaje polje:     {dict(manjak) or 'nijedno'}")
print(f"prazno/None polje:   {dict(prazno) or 'nijedno'}")
if manjak or prazno:
    nalaz("P0", "Nedostaju ili su prazna obavezna polja",
          [f"nedostaje: {dict(manjak)}", f"prazno: {dict(prazno)}"])
else:
    ok("Sva obavezna polja postoje i nijesu prazna", f"{len(qs)} pitanja")

# points: cijeli broj 1–4
loši_points = [(q["id"], q["points"], q["type"]) for q in qs
               if not (isinstance(q.get("points"), int) and 1 <= q["points"] <= 4)]
ordering_null = [x for x in loši_points if x[2] == "ordering" and x[1] is None]
ostali = [x for x in loši_points if x not in ordering_null]
print(f"points van 1–4 ili nije int: {len(loši_points)}  "
      f"(od toga ordering sa null: {len(ordering_null)})")
if ostali:
    nalaz("P0", "points nije cijeli broj 1–4", [str(x) for x in ostali[:20]])
if ordering_null:
    print(f"   ordering sa points=null: {[x[0] for x in ordering_null]}")
    print("   → namjerno; lib/config.ts DEFAULT_ORDERING_POINTS = 4 ih boduje")
    ok("points je 1–4 svuda osim kod ordering pitanja",
       f"{len(ordering_null)} ordering pitanja ima null, što DEFAULT_ORDERING_POINTS pokriva")

loš_type = [(q["id"], q.get("type")) for q in qs if q.get("type") not in TYPES]
loš_kind = [(q["id"], q.get("kind")) for q in qs if q.get("kind") not in KINDS]
print(f"nepoznat type: {loš_type or 'nijedan'}")
print(f"nepoznat kind: {loš_kind or 'nijedan'}")
if loš_type:
    nalaz("P0", "Nepoznat type", [str(x) for x in loš_type])
if loš_kind:
    nalaz("P0", "Nepoznat kind", [str(x) for x in loš_kind])
if not loš_type and not loš_kind:
    ok("type i kind su iz poznatog skupa")

print("\nraspodjela:")
print("  type:", dict(Counter(q.get("type") for q in qs)))
print("  area:", dict(Counter(q.get("area") for q in qs)))
print("  kind:", dict(Counter(q.get("kind") for q in qs)))

# ─────────────────────────────────────────────────────────────────────────────
naslov("1.2  IDENTITET I DUPLIKATI")

dup_id = [i for i, n in Counter(q["id"] for q in qs).items() if n > 1]
print(f"duplirani id: {dup_id or 'nijedan'}")
if dup_id:
    nalaz("P0", "Duplirani id", [str(dup_id)])
else:
    ok("Svi id-evi jedinstveni", f"{len(qs)} pitanja")

# duplikati po normalizovanom tekstu
po_tekstu = defaultdict(list)
for q in qs:
    po_tekstu[norm(q["text"])].append(q)

pravi_dup, konflikt, isti_tekst_razl_opcije = [], [], []
for t, grupa in po_tekstu.items():
    if len(grupa) < 2:
        continue
    po_opcijama = defaultdict(list)
    for q in grupa:
        kljuc = tuple(norm(v) for v in (q.get("options") or {}).values()) if not is_ordering(q) \
            else ("ordering", tuple(q.get("answer_sequence", [])))
        po_opcijama[kljuc].append(q)
    for kljuc, g2 in po_opcijama.items():
        if len(g2) < 2:
            continue
        tacni = {q.get("correct") or tuple(q.get("answer_sequence", [])) for q in g2}
        if len(tacni) > 1:
            konflikt.append(g2)
        else:
            pravi_dup.append(g2)
    if len(po_opcijama) > 1:
        isti_tekst_razl_opcije.append(grupa)

print(f"grupa sa istim tekstom: {sum(1 for g in po_tekstu.values() if len(g) > 1)}")
print(f"  isti tekst + iste opcije + ISTI tačan odgovor (pravi duplikat): {len(pravi_dup)}")
print(f"  isti tekst + iste opcije + RAZLIČIT tačan odgovor (konflikt):   {len(konflikt)}")
print(f"  isti tekst, ali različite opcije (uredu — različita pitanja):   {len(isti_tekst_razl_opcije)}")

if konflikt:
    red = []
    for g in konflikt:
        red.append("  " + " | ".join(f"id={q['id']} correct={q.get('correct')}" for q in g))
        red.append(f"     tekst: {g[0]['text'][:90]}")
        for k in OPTION_KEYS:
            red.append(f"       {k}) {(g[0].get('options') or {}).get(k, '')[:80]}")
    for r in red:
        print(r)
    nalaz("P0", f"Isti tekst i iste opcije, a različit tačan odgovor ({len(konflikt)} grupa)", red)

if pravi_dup:
    red = []
    for g in pravi_dup:
        red.append(f"  id {' = '.join(str(q['id']) for q in g)}  correct={g[0].get('correct')}  "
                   f"| {g[0]['text'][:70]}")
    for r in red[:25]:
        print(r)
    if len(red) > 25:
        print(f"  … i još {len(red)-25}")
    nalaz("P1", f"Pravi duplikati — isto pitanje, iste opcije, isti odgovor ({len(pravi_dup)} grupa)", red)
else:
    ok("Nema pravih duplikata pitanja")

# duplikati po slici
po_slici = defaultdict(list)
for q in qs:
    if q.get("image"):
        po_slici[q["image"]].append(q["id"])
dup_slika = {k: v for k, v in po_slici.items() if len(v) > 1}
print(f"\nista slika na više pitanja: {len(dup_slika)}")
if dup_slika:
    for k, v in list(dup_slika.items())[:20]:
        print(f"  {k}: {v}")
    nalaz("P2", "Ista slika referencirana iz više pitanja", [f"{k}: {v}" for k, v in dup_slika.items()])
else:
    ok("Svaka slika pripada tačno jednom pitanju", f"{len(po_slici)} fajlova")

# ─────────────────────────────────────────────────────────────────────────────
naslov("1.3  ODGOVORI")

choice = [q for q in qs if not is_ordering(q)]
van_opsega = [(q["id"], q["correct"]) for q in choice
              if q["correct"] not in (q.get("options") or {})]
print(f"tačan odgovor van skupa opcija: {van_opsega or 'nijedan'}")
if van_opsega:
    nalaz("P0", "Tačan odgovor ne postoji među opcijama", [str(x) for x in van_opsega])
else:
    ok("Tačan odgovor uvijek postoji među opcijama", f"{len(choice)} pitanja sa izborom")

prazne_opcije = [(q["id"], k) for q in choice for k, v in (q.get("options") or {}).items()
                 if not str(v).strip()]
print(f"prazna opcija: {prazne_opcije or 'nijedna'}")
if prazne_opcije:
    nalaz("P0", "Prazna opcija", [str(x) for x in prazne_opcije])
else:
    ok("Nema praznih opcija")

# dvije identične opcije unutar istog pitanja
identicne = []
for q in choice:
    o = q.get("options") or {}
    c = Counter(norm(v) for v in o.values())
    for tekst, n in c.items():
        if n > 1:
            kljucevi = [k for k, v in o.items() if norm(v) == tekst]
            identicne.append((q["id"], kljucevi, o[kljucevi[0]][:70], q["correct"]))
print(f"pitanja sa dvije identične opcije: {len(identicne)}")
for x in identicne[:20]:
    print(f"  id={x[0]} opcije {x[1]} iste: {x[2]!r}  (tačan: {x[3]})")
if identicne:
    nalaz("P0", f"Dvije identične opcije u istom pitanju ({len(identicne)})",
          [f"id={x[0]} opcije {x[1]} iste: {x[2]} (tacan: {x[3]})" for x in identicne])
else:
    ok("Nijedno pitanje nema dvije identične opcije")

# broj opcija
broj_opcija = Counter(len(q.get("options") or {}) for q in choice)
print(f"broj opcija po pitanju: {dict(broj_opcija)}")
if set(broj_opcija) != {3}:
    nalaz("P1", "Pitanja nemaju sva po 3 opcije", [str(dict(broj_opcija))])

# raspodjela tačnog odgovora
MIN_N = 30


def raspodjela(pool, ime):
    c = Counter(q["correct"] for q in pool)
    n = sum(c.values())
    if n == 0:
        return None
    red = "  ".join(f"{k}={c.get(k,0):>3} ({c.get(k,0)/n*100:>5.1f}%)" for k in OPTION_KEYS)
    # Ispod 30 pitanja procenat nema statističko značenje — `kosnik` ima n=2,
    # pa bi svaki ishod „odstupao". Takav uzorak se prijavljuje zasebno.
    if n < MIN_N:
        print(f"  {ime:<12} n={n:>3}   {red}   uzorak premali za ocjenu (<{MIN_N})")
        return (ime, n, {k: c.get(k, 0) for k in OPTION_KEYS}, [])
    lose = [k for k in OPTION_KEYS if not (25.0 <= c.get(k, 0) / n * 100 <= 42.0)]
    print(f"  {ime:<12} n={n:>3}   {red}   {'ODSTUPA: ' + ','.join(lose) if lose else 'u opsegu'}")
    return (ime, n, {k: c.get(k, 0) for k in OPTION_KEYS}, lose)


print("\nraspodjela tačnog odgovora (prag: svaka pozicija 25–42%):")
ukupno_r = raspodjela(choice, "SVE")
po_kindu = []
for k in sorted({q["kind"] for q in choice}):
    r = raspodjela([q for q in choice if q["kind"] == k], k)
    if r:
        po_kindu.append(r)

odstupanja = ([ukupno_r] if ukupno_r and ukupno_r[3] else []) + [r for r in po_kindu if r[3]]
if odstupanja:
    red = []
    for ime, n, c, lose in odstupanja:
        red.append(f"{ime}: n={n} a={c['a']} ({c['a']/n*100:.1f}%) b={c['b']} ({c['b']/n*100:.1f}%) "
                   f"c={c['c']} ({c['c']/n*100:.1f}%) — van opsega: {','.join(lose)}")
    nalaz("P1", "Raspodjela tačnog odgovora po poziciji odstupa od 25–42%", red)
else:
    ok("Raspodjela tačnog odgovora je u opsegu 25–42% svuda")

# ─────────────────────────────────────────────────────────────────────────────
naslov("1.4  OSTACI PARSIRANJA (OCR SMEĆE)")

TESTOVI = [
    ("opcija duža od 120 znakova", lambda t: len(t) > 120, "opt"),
    ("tekst pitanja duži od 200 znakova", lambda t: len(t) > 200, "text"),
    ("počinje brojem i tačkom (numeracija iz PDF-a)", lambda t: re.match(r"^\s*\d{1,3}\.", t), "oba"),
    ("počinje oznakom opcije a)/b)/c)", lambda t: re.match(r"^\s*[abc]\)", t), "oba"),
    ("tri ili više tačaka (linija za popunjavanje)", lambda t: re.search(r"\.{3,}", t), "oba"),
    ("dvostruki razmak", lambda t: "  " in t, "oba"),
    ("razmak prije interpunkcije", lambda t: re.search(r"\s+[,.;:!?]", t), "oba"),
    ("meki crtica (soft hyphen U+00AD)", lambda t: "­" in t, "oba"),
    ("prelom reda unutar polja", lambda t: "\n" in t or "\r" in t, "oba"),
    ("zalijepljene riječi (malaVELIKA)", lambda t: re.search(r"[a-zćčđšž][A-ZĆČĐŠŽ]", t), "oba"),
    ("nezatvorena crtica sa razmacima ( - )", lambda t: re.search(r"\s-\s", t), "oba"),
]

for opis, test, gdje in TESTOVI:
    pogoci = []
    for q in qs:
        if gdje in ("text", "oba") and test(q["text"]):
            pogoci.append((q["id"], "text", q["text"]))
        if gdje in ("opt", "oba"):
            for k, v in (q.get("options") or {}).items():
                if test(v):
                    pogoci.append((q["id"], f"opt {k}", v))
    print(f"\n{opis}: {len(pogoci)}")
    for pid, gdje2, v in pogoci[:12]:
        print(f"   id={pid:>3} {gdje2:<6} {len(v):>4}  {v.strip()[:82]}")
    if len(pogoci) > 12:
        print(f"   … i još {len(pogoci)-12}")
    if pogoci:
        sev = "P1" if len(pogoci) <= 40 else "P2"
        nalaz(sev, f"Ostatak parsiranja: {opis} ({len(pogoci)})",
              [f"id={p} {g} ({len(v)}): {v.strip()[:110]}" for p, g, v in pogoci[:40]])
    else:
        ok(f"Nema pogodaka: {opis}")

# ── tipfeleri: rijec koja se javlja tacno jednom, a jednim potezom se svodi na
# cestu rijec iz iste baze. Hvata "sitaciji" -> "situaciji", bez rjecnika.
def jedna_izmjena(a, b):
    """Jedna izmjena, ali NE u zadnja dva znaka.

    Bez tog uslova detektor prijavi svaki padež ('krivinu' vs 'krivina') i uguši
    prave nalaze u 85 lažnih. Tipfeler je gotovo uvijek u korijenu riječi.
    """
    if abs(len(a) - len(b)) > 1:
        return False
    granica = min(len(a), len(b)) - 2
    if len(a) == len(b):
        razlike = [i for i, (x, y) in enumerate(zip(a, b)) if x != y]
        return len(razlike) == 1 and razlike[0] < granica
    kraca, duza = (a, b) if len(a) < len(b) else (b, a)
    for i in range(len(duza)):
        if duza[:i] + duza[i + 1:] == kraca:
            return i < granica
    return False


rijeci = Counter()
gdje_rijec = defaultdict(list)
for q in qs:
    polja = [("text", q["text"])] + [(f"opt {k}", v) for k, v in (q.get("options") or {}).items()]
    for gdje, v in polja:
        for w in re.findall(r"[^\W\d_]{5,}", v.lower(), flags=re.UNICODE):
            rijeci[w] += 1
            gdje_rijec[w].append((q["id"], gdje))

# Rijetko = najvise 2 pojave ("sitaciji" se ponavlja 2x); cesto = bar 3.
RIJETKO, CESTO = 2, 3
ceste = {w for w, n in rijeci.items() if n >= CESTO}
sumnjive = []
for w, n in rijeci.items():
    if n > RIJETKO or w in ceste:
        continue
    for c in ceste:
        if jedna_izmjena(w, c):
            pid, gdje = gdje_rijec[w][0]
            sumnjive.append((pid, gdje, w, c, rijeci[c]))
            break

print(f"\nrijeci koje se javljaju jednom, a jednim potezom postaju cesta rijec: {len(sumnjive)}")
for pid, gdje, w, c, n in sorted(sumnjive):
    print(f"   id={pid:>3} {gdje:<6} {w!r} -> {c!r} (ta se javlja {n}x)")
if sumnjive:
    nalaz("P1", f"Vjerovatni tipfeleri u tekstu ({len(sumnjive)})",
          [f"id={p} {g}: {w!r} -> vjerovatno {c!r} ({n} pojava)" for p, g, w, c, n in sorted(sumnjive)])
else:
    ok("Nema vjerovatnih tipfelera")

# ── mijesano pismo: cirilicni znak unutar latinicne rijeci (i obrnuto).
# Homoglifi (a/а, e/е, o/о, c/с, p/р) izgledaju isto, ali su drugi znakovi:
# pretraga ih ne nalazi, a prevodilac ih moze prenijeti kao smece.
# Opseg se poredi po kodnoj tacki, ne regexom, da se izbjegne bjezanje znakova.
def je_cir(c):
    return 0x0400 <= ord(c) <= 0x04FF


def je_lat(c):
    return c.isalpha() and not je_cir(c)

mijesano = []
for q in qs:
    polja = [("text", q["text"])] + [(f"opt {k}", v) for k, v in (q.get("options") or {}).items()]
    for gdje, v in polja:
        for w in re.findall(r"[^\W\d_]+", v, flags=re.UNICODE):
            if any(je_cir(c) for c in w) and any(je_lat(c) for c in w):
                loši = sorted({c for c in w if je_cir(c)})
                mijesano.append((q["id"], gdje, w, "".join(loši),
                                 " ".join(f"U+{ord(c):04X}" for c in loši)))

print(f"\nrijeci sa mijesanim pismom (latinica + cirilica): {len(mijesano)}")
for pid, gdje, w, znak, kod in mijesano:
    print(f"   id={pid:>3} {gdje:<6} {w!r}  cirilicno: {znak!r} ({kod})")
if mijesano:
    nalaz("P1", f"Cirilicni znak unutar latinicne rijeci ({len(mijesano)})",
          [f"id={p} {g}: {w!r} sadrzi {z!r} ({k})" for p, g, w, z, k in mijesano])
else:
    ok("Nema mijesanog pisma u crnogorskom zapisu")

# ─────────────────────────────────────────────────────────────────────────────
naslov("1.5  JEZIK I DIJAKRITIKA (crnogorski zapis)")

DIJAKRITIKA = "čćšžđČĆŠŽĐ"
sa_dij = sum(1 for q in qs if any(ch in q["text"] for ch in DIJAKRITIKA))
print(f"pitanja čiji tekst sadrži č/ć/š/ž/đ: {sa_dij}/{len(qs)} ({sa_dij/len(qs)*100:.1f}%)")

# riječi kod kojih se dijakritika najčešće izgubi
GOLI = [
    (r"\bsaobracaj", "saobraćaj"), (r"\bznacenj", "značenje"), (r"\bkrivicn", "krivična"),
    (r"\bvozac\b|\bvozaca\b|\bvozacu\b", "vozač"), (r"\bpjesac", "pješač"),
    (r"\bpocetak\b|\bpoceti\b", "početak"), (r"\bnajmanj[ei] sirin", "širina"),
    (r"\bopstin", "opština"), (r"\bkoriscenj", "korišćenje"), (r"\bduzin", "dužina"),
    (r"\bzelje?znick", "željeznički"), (r"\bpresjecanj", "presijecanje"),
    (r"\bcetiri\b|\bcetvrt", "četiri"), (r"\bsljedec", "sljedeći"),
]
gubitak = []
for q in qs:
    polja = [("text", q["text"])] + [(f"opt {k}", v) for k, v in (q.get("options") or {}).items()]
    for gdje, v in polja:
        for pat, tacno in GOLI:
            if re.search(pat, v, flags=re.IGNORECASE):
                gubitak.append((q["id"], gdje, tacno, v.strip()[:80]))
print(f"riječi bez dijakritike: {len(gubitak)}")
for x in gubitak[:15]:
    print(f"   id={x[0]:>3} {x[1]:<6} (treba {x[2]!r})  {x[3]}")
if gubitak:
    nalaz("P1", f"Izgubljena dijakritika ({len(gubitak)} pogodaka)",
          [f"id={p} {g} -> treba {t!r}: {v}" for p, g, t, v in gubitak[:40]])
else:
    ok("Nema riječi sa izgubljenom dijakritikom (provjereno 14 obrazaca)")

# mojibake
MOJIBAKE = ["Ä‡", "Å¾", "â€ž", "Ä", "Å¡", "â€", "Ã¢", "Ä‘", "Ã…", "Ã„"]
moji = []
for q in qs:
    hay = json.dumps(q, ensure_ascii=False)
    for m in MOJIBAKE:
        if m in hay:
            moji.append((q["id"], m))
print(f"\nmojibake: {len(moji)}")
if moji:
    for x in moji[:20]:
        print(f"   id={x[0]} {x[1]!r}")
    nalaz("P0", f"Mojibake (pokvaren enkoding) — {len(moji)}", [str(x) for x in moji[:40]])
else:
    ok("Nema mojibake artefakata", "provjereno 10 obrazaca")

# ekavica u ijekavskom tekstu
# Samo oblici koji se u ijekavici STVARNO razlikuju. Kosi padeži se NE hvataju:
# ijekavski je vrijeme -> vremena/vremenu, dijete -> djeteta, pa bi "vremenu" ili
# "djeteta" bili lazni pogoci. "sredstvo" je isto u oba narjecja.
EKAV = [
    (r"\bdete\b", "dijete"),
    (r"\bmesto\b", "mjesto"),
    (r"\bvreme\b", "vrijeme"),
    (r"\bsvetlo\b|\bsvetla\b|\bsvetlost", "svjetlo"),
    (r"\bmera\b|\bmere\b", "mjera"),
    (r"\bpesak\b|\bpesaka\b|\bpesaci\b", "pjesak"),
    (r"\bbezbedn", "bezbjedn"),
    (r"\bnesrec", "nesrec"),
    (r"\bdeo\b", "dio"),
    (r"\bceo\b|\bcela\b", "cio"),
    (r"\bnedelj", "nedjelj"),
    (r"\bposled", "posljed"),
]
ekav = []
for q in qs:
    polja = [("text", q["text"])] + [(f"opt {k}", v) for k, v in (q.get("options") or {}).items()]
    for gdje, v in polja:
        for pat, tacno in EKAV:
            if re.search(pat, v, flags=re.IGNORECASE):
                ekav.append((q["id"], gdje, tacno, v.strip()[:80]))
print(f"ekavski oblici u ijekavskom tekstu: {len(ekav)}")
for x in ekav[:15]:
    print(f"   id={x[0]:>3} {x[1]:<6} (ijekavski {x[2]!r})  {x[3]}")
if ekav:
    nalaz("P1", f"Ekavski oblici u ijekavskom tekstu ({len(ekav)})",
          [f"id={p} {g} -> ijekavski {t!r}: {v}" for p, g, t, v in ekav[:40]])
else:
    ok("Nema ekavskih oblika (provjereno 12 obrazaca)")

# ─────────────────────────────────────────────────────────────────────────────
naslov("1.6  PREVODI (umjesto poređenja banaka — vidi napomenu na vrhu)")

print(f"{'jezik':<6}{'ima tekst':>11}{'ima opcije':>12}{'prazan tekst':>14}"
      f"{'prazna opcija':>15}{'isto kao ME':>13}{'drugi ključevi':>16}")
for lang in LANGS:
    ima_t = [q for q in qs if q.get(f"text_{lang}")]
    prazan = [q["id"] for q in qs if f"text_{lang}" in q and not str(q[f"text_{lang}"]).strip()]
    ima_o = [q for q in qs if q.get(f"options_{lang}")]
    prazna_o = [(q["id"], k) for q in qs for k, v in (q.get(f"options_{lang}") or {}).items()
                if not str(v).strip()]
    isto = [q["id"] for q in qs if q.get(f"text_{lang}") and norm(q[f"text_{lang}"]) == norm(q["text"])]
    kljucevi = [q["id"] for q in qs if q.get(f"options_{lang}")
                and set(q[f"options_{lang}"]) != set(q.get("options") or {})]
    print(f"{lang:<6}{len(ima_t):>11}{len(ima_o):>12}{len(prazan):>14}"
          f"{len(prazna_o):>15}{len(isto):>13}{len(kljucevi):>16}")

    if len(ima_t) < len(qs):
        nalaz("P0", f"Nepotpun prevod: {lang} ima {len(ima_t)}/{len(qs)} tekstova", [])
    if prazan:
        nalaz("P0", f"Prazan prevod teksta ({lang}): {len(prazan)}", [str(prazan[:40])])
    if prazna_o:
        nalaz("P0", f"Prazna prevedena opcija ({lang}): {len(prazna_o)}", [str(prazna_o[:40])])
    if kljucevi:
        nalaz("P0", f"Prevedene opcije imaju druge ključeve ({lang}): {len(kljucevi)}",
              [str(kljucevi[:40])])
    if isto:
        nalaz("P1", f"Prevod identičan crnogorskom originalu ({lang}): {len(isto)}",
              [f"id={i}: {next(q['text'] for q in qs if q['id']==i)[:90]}" for i in isto[:30]])

# choice pitanja moraju imati prevedene opcije; ordering nema opcije
treba_opcije = [q for q in qs if not is_ordering(q)]
for lang in LANGS:
    bez = [q["id"] for q in treba_opcije if not q.get(f"options_{lang}")]
    if bez:
        nalaz("P0", f"Pitanje sa izborom nema prevedene opcije ({lang}): {len(bez)}", [str(bez[:40])])
print(f"\npitanja sa izborom: {len(treba_opcije)} — svako mora imati options_en/ru/sq")

# ćirilica u ruskom, latinica u en/sq
ru_bez_cir = [q["id"] for q in qs if q.get("text_ru")
              and not re.search(r"[А-Яа-яЁё]", q["text_ru"])]
print(f"ruski tekst bez ijednog ćiriličnog znaka: {len(ru_bez_cir)}")
if ru_bez_cir:
    for i in ru_bez_cir[:10]:
        print(f"   id={i}: {next(q['text_ru'] for q in qs if q['id']==i)[:80]}")
    nalaz("P1", f"Ruski prevod bez ćirilice ({len(ru_bez_cir)})", [str(ru_bez_cir[:40])])
else:
    ok("Svaki ruski prevod sadrži ćirilicu")

# ─────────────────────────────────────────────────────────────────────────────
naslov("SAŽETAK FAZE 1")

po_sev = Counter(s for s, _, _ in nalazi)
print(f"P0: {po_sev.get('P0', 0)}   P1: {po_sev.get('P1', 0)}   P2: {po_sev.get('P2', 0)}")
print()
for sev in ("P0", "P1", "P2"):
    for s, n, _ in nalazi:
        if s == sev:
            print(f"  {sev}  {n}")
print(f"\nprovjereno i čisto: {len(cisto)} stavki")
for n, d in cisto:
    print(f"  ✓ {n}" + (f" — {d}" if d else ""))

sys.exit(1 if po_sev.get("P0") else 0)
