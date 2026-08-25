# QA v1 — nalazi

Ocjene: **P0** blokada puštanja · **P1** popraviti prije objave · **P2** može poslije.
Nalaz bez dokaza ne vrijedi — uz svaki ide izlaz komande, id pitanja ili putanja screenshota.

| Faza | P0 | P1 | P2 |
| ---- | -- | -- | -- |
| 0 — priprema | 0 | 0 | 1 |
| 1 — baza | **0** | **6** | 0 |
| 2 — slike | — | — | — |
| 3 — logika ispita | — | — | — |
| 4 — browser | — | — | — |
| 5 — sadržaj i pravo | — | — | — |

---

## Faza 0 — Priprema

### QA-0-1 · P2 · `npm audit` prijavljuje 6 ranjivosti visoke ozbiljnosti

**Dokaz** (`npm audit`, poslije `npm ci` na čistom lockfile-u):

```
npm audit: {"info":0,"low":0,"moderate":0,"high":6,"critical":0,"total":6}

brace-expansion  <=1.1.17 || 4.0.0 - 5.0.8   DoS (OOM)          fix: npm audit fix
js-yaml          4.0.0 - 4.3.0                                   fix: npm audit fix
nanoid           <3.3.18                      beskonačna petlja   fix: npm audit fix
postcss          <=8.5.22                                         fix: npm audit fix --force
sharp            <0.35.0                      libvips CVE-ovi     fix: npm audit fix --force
```

**Zašto P2, a ne više:** sve su u alatima za build i lint, ne u kodu koji se šalje
korisniku. `sharp` se ne izvršava uopšte — `images.unoptimized: true` isključuje Vercel
optimizaciju slika. `postcss` i `nanoid` su unutar `next`-a i troše se pri buildu.
Nijedna nije u browserskom bundle-u; napadač bi morao da kontroliše ulaz u naš build.

**Zamka koju treba izbjeći:** `npm audit fix --force` bi podigao `next` na sljedeći
glavni broj i time promijenio ponašanje aplikacije. Ne pokretati bez zasebnog testiranja.
`npm audit fix` (bez `--force`) rješava 3 od 6 i bezbjedan je.

**Predlog:** pokrenuti `npm audit fix` i ostaviti `postcss`/`sharp` za planiranu nadogradnju
Next-a. Ne blokira puštanje.

---

## Faza 1 — Integritet baze pitanja

Skripta: `qa/check_baza.py` · puni izlaz: `qa/faza1.log` · **P0: 0 · P1: 6 · P2: 0**

### QA-1-1 · P1 · Ćirilično `а` (U+0430) unutar latiničnih riječi — 2 pitanja, 6 riječi

**Dokaz** (`python qa/check_baza.py`):

```
id= 36 text   'vozаč'       cirilicno: 'а' (U+0430)
id= 36 text   'znаk'        cirilicno: 'а' (U+0430)
id= 36 text   'upozorenjа'  cirilicno: 'а' (U+0430)
id= 52 text   'rаskrsnicu'  cirilicno: 'а' (U+0430)
id= 52 text   'dolаze'      cirilicno: 'а' (U+0430)
id= 52 text   'smjerovа'    cirilicno: 'а' (U+0430)
```

Vizuelno se ne razlikuje od latiničnog `a`, ali je drugi znak. Posljedica: pretraga po
tekstu ne nalazi ta pitanja, poređenje tekstova ih vidi kao različita, a font može da ih
iscrta drugačije. Kandidat ne vidi grešku — otud P1, a ne P0.

**Popravka:** zamijeniti U+0430 sa `a` u ta dva teksta. Bezbjedno, ne dira odgovore.

### QA-1-2 · P1 · Tipfeleri u tekstu — 14 pitanja

Detektor (rijetka riječ koja se jednom izmjenom **u korijenu** svodi na čestu riječ iz iste
baze) dao je 26 kandidata; ručnom provjerom **15 su stvarne greške u 14 pitanja**, ostalo su
legitimne riječi (`plavo`, `dubini šare`, `prelaska preko linije`, `polukružno okretanje`).

| id  | gdje  | u bazi          | treba          |
| --- | ----- | --------------- | -------------- |
| 4   | text  | `raskrnice`     | raskrsnice     |
| 70  | opt b | `prevenstvom`   | prvenstvom     |
| 128 | opt c | `prouštanja`    | propuštanja    |
| 138 | text  | `sitaciji`      | situaciji      |
| 154 | opt b | `izvršti`       | izvršiti       |
| 158 | text  | `sitaciji`      | situaciji      |
| 202 | opt b | `vozulo`        | vozilo         |
| 207 | opt a | `rasksnice`     | raskrsnice     |
| 250 | opt a | `propuštatjući` | propuštajući   |
| 344 | opt a | `čujem`         | čijem          |
| 347 | text  | `Verikalno`     | Vertikalno     |
| 347 | opt c | `zaustvljanje`  | zaustavljanje  |
| 351 | opt b | `rasksnici`     | raskrsnici     |
| 355 | text  | `Hrizontalno`   | Horizontalno   |
| 410 | opt a | `povrijeđnog`   | povrijeđenog   |

`Verikalno`, `Hrizontalno` i `izvršti` detektor nije uhvatio — nađeni su ciljanom pretragom,
pa treba računati da ih ima još. Nijedan ne mijenja značenje, ali svi su vidljivi kandidatu.

### QA-1-3 · P1 · Razmak prije interpunkcije — 18 mjesta, 16 pitanja

**Dokaz:** id 109, 113, 114, 125, 144, 152, 154, 180, 203, 228, 230, 232, 251, 253, 339, 363

```
id=109 opt c   'vertikalnim saobraćajnim znakom .'
id=125 opt b   'nepropisno, jer ne nose prsluk sa reflektujućim osobinama .'
```

Ostatak parsiranja PDF-a. Vidljivo kandidatu, ne mijenja odgovor.
**Popravka:** ukloniti razmak ispred `.,;:!?` u cijeloj bazi — jedna zamjena, bez rizika.

### QA-1-4 · P1 · Crtica sa razmacima usred rečenice — 24 mjesta, 23 pitanja

**Dokaz:** id 100, 102, 107, 114, 118, 120, 130, 134, 136, 138, 142, 172, 174, 176, 188, 192,
196, 206, 212, 230, 232, 236, 244

```
id=100 text   'Kako ćete postupiti u situaciji prikazanoj na slici, ako sa - vozilom 2 zadržavate…'
id=142 text   '…prikazanoj na slici, kada - policijski službenik…'
id=107 opt a  'se zaustaviti i propustiti vozilo - 1'
```

To su prelomi reda iz PDF-a koje je parser zadržao kao crticu. **Popravka nije mehanička:**
u nekim slučajevima crticu treba samo obrisati (`sa - vozilom` → `sa vozilom`), a u drugim
je i razmak suvišan (`vozilo - 1` → `vozilo 1`). Treba proći listu ručno.

### QA-1-5 · P1 · Dvije opcije duže od 120 znakova

```
id= 72 opt c   142 znaka — legitimna pravna rečenica o parkiranju na trotoaru (NIJE greška)
id=272 opt b   143 znaka — POKVARENA: parser je isprepleo dvije kolone
```

**id 272 je već prijavljen** u README-u pod „Prije objave": ispravan tekst je
„približavanje prelasku puta preko željezničke pruge bez branika ili polubranika", što
potvrđuju EN/RU/AL prevodi iste opcije. **To je tačan odgovor tog pitanja** — čeka vašu
potvrdu.

### QA-1-6 · P1 · Tačan odgovor je `b` u 44,2% pitanja o znakovima

**Dokaz** (prag: svaka pozicija 25–42%; uzorci ispod 30 pitanja se ne ocjenjuju):

```
SVE          n=411   a=120 (29.2%)  b=142 (34.5%)  c=149 (36.3%)   u opsegu
teorija      n=140   a= 43 (30.7%)  b= 43 (30.7%)  c= 54 (38.6%)   u opsegu
situacija    n=170   a= 48 (28.2%)  b= 57 (33.5%)  c= 65 (38.2%)   u opsegu
policajac    n= 22   uzorak premali za ocjenu
kosnik       n=  2   uzorak premali za ocjenu
znak         n= 77   a= 22 (28.6%)  b= 34 (44.2%)  c= 21 (27.3%)   ODSTUPA: b
```

Odstupanje je granično (44,2% naspram praga 42%) i **samo u jednoj kategoriji**. Ukupna
raspodjela je uredna. Nije razlog za mijenjanje baze — katalog je zvanični akt i redoslijed
opcija se ne smije prekrajati. Bilježi se da se zna: kandidat koji uči napamet ima blagu
prednost ako uvijek pogađa `b` na pitanjima o znakovima.

### Provjereno i čisto (21 stavka)

Nula P0 nalaza. Konkretno je provjereno i **nije** pronađen problem:

- sva obavezna polja postoje i nijesu prazna (421 pitanje)
- `points` je cijeli broj 1–4 svuda osim kod 10 `ordering` pitanja, gdje je `null` i gdje ga
  `DEFAULT_ORDERING_POINTS = 4` pokriva
- `type` i `kind` su iz poznatog skupa; svi `id` jedinstveni
- **nema pravih duplikata** — 17 grupa dijeli isti tekst („Na slici je prikazan saobraćajni
  znak:" se javlja 70 puta), ali sve imaju različite opcije, pa su to različita pitanja
- **nijedna grupa nema iste opcije a različit tačan odgovor** (to bi bio P0)
- tačan odgovor uvijek postoji među opcijama; nema praznih opcija; nijedno pitanje nema dvije
  identične opcije; sva pitanja sa izborom imaju tačno 3 opcije
- svaka slika pripada tačno jednom pitanju (281 fajl)
- nema: numeracije iz PDF-a na početku, oznaka `a)`/`b)`/`c)` u tekstu, nizova tačaka,
  dvostrukih razmaka, mekih crtica, preloma reda u polju, zalijepljenih riječi
- nema izgubljene dijakritike (14 obrazaca) ni mojibake artefakata (10 obrazaca)
- nema ekavskih oblika (12 obrazaca)
- prevodi: **EN, RU i AL imaju svih 421 teksta i svih 411 skupova opcija**, nijedan nije
  prazan, nijedan nije identičan crnogorskom, ključevi opcija se poklapaju, svaki ruski
  prevod sadrži ćirilicu

### Opcije se ne miješaju — provjereno kodom (tačka 1.3, posljednja stavka)

Klasični bug „promiješa se tekst, a indeks tačnog ostane stari" **ovdje ne može da nastane**:
`components/QuestionCard.tsx` renderuje `OPTION_KEYS.map(...)` fiksnim redom `a,b,c` i
prosljeđuje `isCorrect={question.correct === key}` — tačnost je vezana za **ključ**, ne za
poziciju. Nigdje nema poziva `shuffle` nad opcijama.

Potvrđeno i u browseru (`qa-opcije2.mjs`, 5 ispita × 41 pitanje):

```
jednoznacno vezanih pitanja: 177
sa promijenjenim redoslijedom opcija: 0
```

Pitanje se identifikuje po **skupu tekstova opcija**, ne po tekstu pitanja — 70 pitanja ima
isti tekst, pa bi traženje po tekstu vezalo pogrešno pitanje (na tome mi je prva verzija
testa dala lažan nalaz).

---

## Napomene uz plan (nijesu nalazi)

**Struktura baze nije kako plan pretpostavlja.** Plan traži provjeru „za svaku banku
(`me`, `en`, `ru`)" i putanje `data/{banka}/questions.json`. U repo-u postoji **jedan**
fajl — `public/questions.json` — a prevodi su inline polja istog pitanja
(`text_en`/`options_en`, `text_ru`, `text_sq`). Praktična posljedica je dobra: **`id`,
`correct`, `points`, `area`, `kind` i `image` fizički ne mogu da se raziđu između jezika**,
jer postoje samo jednom. Provjere iz tačke 1.6 se zato svode na pokrivenost prevoda, i
tako će biti izvedene.

**Jezika je četiri, ne tri.** Uz `me`/`en`/`ru` postoji i **albanski (`sq`, u UI-ju „AL")**.
Sve provjere prevoda pokrivaju i njega.
