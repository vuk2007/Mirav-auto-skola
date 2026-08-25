# QA v1 — nalazi

Ocjene: **P0** blokada puštanja · **P1** popraviti prije objave · **P2** može poslije.
Nalaz bez dokaza ne vrijedi — uz svaki ide izlaz komande, id pitanja ili putanja screenshota.

| Faza | P0 | P1 | P2 |
| ---- | -- | -- | -- |
| 0 — priprema | 0 | 0 | 1 |
| 1 — baza | **0** | **6** | 0 |
| 2 — slike | **0** | **3** | 0 |
| 3 — logika ispita | **0** | **1** | 0 |
| 4 — browser | **0** | **2** | 1 |
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

## Faza 2 — Slike

Skripte: `qa/ocr_slike.py` (OCR, keš u `qa/ocr.json`) i `qa/check_slike.py` · izlaz:
`qa/faza2.log` · **P0: 0 · P1: 3 · P2: 0**

**OCR nije trebalo instalirati sistemski.** Umjesto Tesseracta (koji traži admin prava)
korišćen je `rapidocr-onnxruntime` — čist `pip install --user`, modeli se skidaju sami.
Provjeren je na kontrolnom uzorku: iz `_backup_web_images/p039_q81.png` (original, ima
odštampan tekst) pročita *„81. Na slici je prikazan saobracajni znak: a) traka za kretanje
teretnih vozila"*, a iz popravljene verzije ne pročita ništa. ~1,5 s po slici, 281 slika.

### QA-2-1 · P1 · `p038_q74.jpg` (pitanje 329) — plava traka upada odozdo

Znak „zabrana skretanja ulijevo" + dopunska tabla „od 17 – 05 h", a **ispod table je komad
plavog znaka** iz susjedne grafike. Isti tip greške kao pet već popravljenih.

**Dokaz:** `qa/faza2.log`, 2.3 „sadržaj dodiruje donju ivicu" · uvećanje donjih 40 px
potvrđuje plavu traku preko cijele širine.

**Popravka:** rez po donjoj ivici dopunske table. Bezbjedno — pikseli postoje.

### QA-2-2 · P1 · `p043_q29.jpg` i `p043_q30.jpg` (pitanja 365, 366) — odsječeni brojevi 1–4

Slika prikazuje četiri semafora, a **oznake `1 2 3 4` ispod njih su presječene po vrhu
cifara**. Pitanje 365 glasi „redoslijed uključenja svjetala je:" sa odgovorima `1-2-3-4`,
`1-4-3-2`, `1-3-2-4` — dakle **odgovor se poziva na brojeve koje kandidat jedva vidi**.

Tačan odgovor kod 365 je `1-3-2-4`, a oznake teku slijeva nadesno, pa se odgovor može
izvesti i bez njih. Zato P1, a ne P0 — ali je pitanje bespotrebno teško.

**Popravka:** rez sa ~15 px više visine. Pikseli postoje u fajlu.

### QA-2-3 · P1 · `p033_q29.jpg` (pitanje 284) — dopunska tabla izvan granica fajla

Već zapisano u README-u pod „Prije objave"; ovdje se ponavlja jer je nalaz revizije. Detektor
ga nezavisno potvrđuje kroz dvije provjere: „sadržaj dodiruje donju ivicu" i „pitanje traži
više znakova, a slika ima jednu komponentu".

**Ovo je jedina slika koja se NE može popraviti isijecanjem** — treba ponovno izvlačenje iz
izvornog PDF kataloga, kojeg nema u repo-u.

### Prijavljeno automatski, provjereno ručno — **nije** greška

Da se ne provjerava dvaput: sljedeće je detektor označio, a pregled je pokazao da je uredno.

| Slika | Zašto je označena | Nalaz pregleda |
| ----- | ----------------- | -------------- |
| `p040_q05.jpg` (341) | 3,6:1 široka | jedan crtež graničnika — legitimno |
| `p041_q09.jpg` (345) | 3,2:1 široka | tri svjetlosna panela u nizu — legitimno |
| `p041_q10.jpg` (346) | 3,3:1 široka | tri panela, **naš rez iz prošlog kruga** — ispravno |
| `p041_q17.jpg` (353) | 3,8:1 široka | crtež kosnika — legitimno |
| `p044_q37.jpg` (373) | 5,2:1 široka | oznaka BUS stajališta na kolovozu — legitimno |
| `p037_q65.jpg` (320) | dodiruje donju ivicu | **naš rez**, 2 px margine ispod table — ispravno |
| `p030_q02.jpg` (257) | „znaci" a jedna komponenta | jedan kombinovani znak („zabrana zaustavljanja **i** parkiranja") — množina je formulacija kataloga |
| `p035_q42.jpg` (297) | „znaci" a jedna komponenta | znak **i** tabla „10 m" postoje; dodiruju se, pa ih brojač spaja |

### Dvije moje provjere su bile pogrešno podešene — ispravljene prije prijave

1. **Brojač komponenti** je tražio bijeli pojas širi od 15% visine. Znak i dopunska tabla su
   razdvojeni sa ~4 px na 264 px (1,5%), pa je test prijavio 10 pitanja kao „nema dopunsku
   tablu" iako je devet uredno ima. Zamijenjeno pravim 2D povezivanjem
   (`scipy.ndimage.label`) uz zatvaranje pukotina — palo sa 10 na 3, i ta tri su ručno
   provjerena.
2. Grubi prag (>15%) je zadržan, ali **samo** za otkrivanje preliva — to je drugo pitanje od
   „ima li znak dopunsku tablu" i traži drugu mjeru.

### Provjereno i čisto

- **svih 281 slika prošlo OCR — nijedna ne sadrži odštampan tekst iz kataloga.** Ovo je
  najvrjedniji rezultat faze: dva slučaja iz prošlog kruga („27." i „81.") bila su jedina.
- svaka slika iz baze postoji na disku; nema siročića; nijedan fajl nije prazan niti se ne
  otvara (281/281)
- nijedna slika nema tri ili više odvojenih komponenti (kandidat za preliv)
- nijedna slika nema bijelu marginu preko 25%
- svako pitanje `kind=znak` ima sliku; nijedno `type=text` pitanje nema sliku
- 185 slika sadrži nekakav tekst, ali sve su to natpisi na samim znakovima (STOP, E-70,
  ograničenja brzine) — legitimno

### Težina i učitavanje (2.5)

```
ukupno 16,36 MB u 281 fajlu (prosjek 60 kB)
  .jpg  208 fajlova  13,64 MB
  .png   73 fajla     2,72 MB
najveći: p026_q138.png 337 kB · p026_q136.png 212 kB · ostali ≤ 108 kB
20 najvećih = 2,33 MB (14% ukupno)
```

**Slike se učitavaju po pitanju, ne unaprijed** — `loading="lazy"` u `QuestionCard.tsx`,
nigdje nema `preload`/`prefetch`. Izmjereno u browseru na 390 px:

```
poslije učitavanja prvog pitanja ispita:   1 slika,  27 kB
poslije prolaska kroz svih 41 pitanje:    21 slika, 930 kB
```

Cio ispit povuče **manje od 1 MB**, ne 16 MB. Nije nalaz. `next/image` dobija `width` i
`height` iz `lib/imageSizes.ts`, pa nema skakanja sadržaja.

---

## Faza 3 — Logika ispita

Skripte: `qa/fuzz_ispit.mjs` (3.1, 3.2), `qa/bodovanje.mjs` (3.3), `qa/faza3_browser.mjs` i
`qa/faza3_pregled.mjs` (3.4, 3.5) · izlazi: `qa/faza3-*.log` · **P0: 0 · P1: 1 · P2: 0**

Fuzz i bodovanje pozivaju **stvarni** `buildExam` i `examPassPoints` iz `lib/`, ne kopiju
logike. Browser testovi koriste Playwright `page.clock`, pa se 45 minuta prevrti bez čekanja.

### QA-3-1 · P1 · Prikazani procenat može pisati „85%" uz „PAO"

Prolaz se računa ispravno, prikaz ne. `components/ResultCard.tsx`, redovi 42 i 47:

```ts
const percent    = Math.round((scored / maxPoints) * 100);   // <- zaokruzuje NAGORE
const passPoints = examPassPoints(maxPoints);                // <- Math.ceil, konzervativno
const passed     = scored >= passPoints;
```

Kandidat sa 84,62% vidi veliko **„85%"** i ispod njega **„PAO"**. Ne izgleda kao granica,
izgleda kao greška aplikacije. Nađeno **19 kombinacija** u opsegu zbirova koji se stvarno
javljaju:

```
71/84  = 84.52% -> prikazuje „85%" uz „PAO"  (prag je 72)
77/91  = 84.62% -> prikazuje „85%" uz „PAO"  (prag je 78)
84/99  = 84.85% -> prikazuje „85%" uz „PAO"  (prag je 85)
88/104 = 84.62% -> prikazuje „85%" uz „PAO"  (prag je 89)
90/106 = 84.91% -> prikazuje „85%" uz „PAO"  (prag je 91)
... ukupno 19
```

**Popravka:** `Math.floor` umjesto `Math.round` za prikaz. Prikaz tada nikad ne tvrdi više
nego što je osvojeno, a 100% ostaje 100%. Jedna riječ, ne dira bodovanje.

**Sama logika prolaza je ispravna** i to je zasebno provjereno — vidi niže.

### Provjereno i čisto

**3.1 — fuzz, 500 izvlačenja, 0 grešaka** (`qa/faza3-fuzz.log`):

```
grešaka: 0
očekivani segmenti: znak:10 teorija:20 policajac:2 kosnik:1 situacija:8
vrijeme po ispitu: 0,120 ms
```

U svakom od 500 izvlačenja potvrđeno: tačno 41 pitanje · segmenti u zadatom redoslijedu i
tačnoj veličini · **svako podpitanje odmah iza svog glavnog i dijeli s njim sliku** (poređeno
po sadržaju fajla, jer su isječci zasebni fajlovi) · nijedno pitanje se ne ponavlja u istom
testu · svako glavno pitanje u segmentu `withSub` stvarno ima podpitanje.

**Bodovi nijesu fiksni** i to je namjerno — dolaze iz baze: min 90, medijana 102, max 116,
prosjek 102,3. Prag se računa od maksimuma **tog** testa (77–99 bodova).

**3.2 — pokrivenost:**

```
kind         u bazi  dostupno  izvlaci se  sansa/ispit   vidjeno
znak             77        73          10        13.7%    77/77
teorija         140       140          20        14.3%  140/140
policajac        22        11           1         9.1%    22/22
kosnik            2         2           1        50.0%      2/2
situacija       180        80           4         5.0%  156/180
```

397 od 421 pitanja ikad izvučeno. 24 nikad — **sva su `situacija` bez podpitanja**, pa po
konstrukciji ne mogu ući (segment `situacija` izvlači samo pitanja koja imaju podpitanje).
Već zapisano u README-u; fuzz to sada nezavisno potvrđuje brojkom.

Ponavljanje: isto pitanje otprilike svaki 7. ispit kod znakova i teorije, svaki 11. kod
policajca, svaki 20. kod situacija — i **svaki 2. kod `kosnik`a**, jer ih ima samo dva. To je
jedina kategorija ispod praga od 6 iz plana; već je zapisano kao stavka za MIRAV.

**3.3 — bodovanje, 10 provjera prošlo** (`qa/faza3-bodovanje.log`):

- svi tačni -> 100%, položeno · svi netačni -> 0%, pad
- **neodgovoreno se broji kao 0 bodova, ne izbacuje se iz imenioca**: 84/100 = 84%, a ne 100%
- **granica je tačna za svih 41 mogućih zbirova**: prag prolazi, prag-1 pada
- **koristi se `>=`, ne `>`**: 85/100 = tačno 85,0% -> POLOŽENO, 84/100 -> PAD
- **nijedan rezultat ispod 85% ne prolazi** — provjereno iscrpno, svaki mogući skor za svaki
  mogući zbir. `Math.ceil` u `examPassPoints` je konzervativan u pravom smjeru
- procenat ide od **bodova**, ne od broja pitanja (20% naspram 49% na istom primjeru)

**Ordering pitanja se boduju „sve ili ništa"** — 10 pitanja, svako 4 boda
(`points: null` -> `DEFAULT_ORDERING_POINTS`). Djelimično tačan niz nosi **0 bodova**:

```
"3-4-2-1"  -> TACNO (pun broj bodova)      "3-4-1-2"  -> NETACNO (0 bodova)
"3421"     -> TACNO                        "3-4"      -> NETACNO (0 bodova)
"3 4 2 1"  -> TACNO                        ""         -> NETACNO (0 bodova)
```

Format unosa je slobodan (crtice, razmaci, bez ičega), sadržaj strog. To odgovara zvaničnom
ispitu, gdje se priznaje samo potpuno tačan redoslijed.

**3.4 — tajmer, 13 provjera prošlo:**

- kreće od 45:00, poslije 2 minuta pokazuje 43:00
- **navigacija kroz pitanja ne resetuje tajmer**
- **računa se iz apsolutnog roka, ne brojanjem otkucaja.** Provjereno tako što je
  `window.setInterval` onesposobljen (simulacija prigušenog taba na mobile Safariju), sat
  pomjeren 10 minuta i poslan `visibilitychange` — aplikacija pokaže **35:00**, dakle ni
  sekunde poklonjenog vremena. Ovo je izričit kriterijum za puštanje iz plana.
- na 0 se **sama predaje**, tajmer staje, u test se ne može vratiti, rezultat kaže da je
  vrijeme isteklo
- **dvoklik na „Završi ispit" ne predaje dvaput** i ne baca JS grešku

**3.5 — prikaz, 12 provjera prošlo:**

- **simulacija ne otkriva tačnost** — provjereno na 8 uzastopnih pitanja, nijedno ne procuri
- vježba prikazuje „Tačan odgovor"/„Netačan odgovor" i označava koji je tačan
- **pregled grešaka, oba ekstrema:**
  - svih 41 tačno -> **100%, POLOŽENO**, pregled prazan uz poruku „Sva pitanja su tačna. Nema
    šta da se ponavlja."
  - svih 41 netačno -> **0%, PAD**, pregled lista **svih 41**, sa 21 slikom, izabranim
    odgovorom (41x) i tačnim odgovorom (84x)

### Ponašanje o kojem je odlučeno — ostaje kako jeste

**Osvježavanje stranice usred ispita gubi ispit** — vraća na početnu, bez upozorenja.
Izmjereno, nije nagađano. Tajmer i odgovori se ne čuvaju; `localStorage` se koristi samo za
vježbu i za **najbolji rezultat završenog ispita**.

**ODLUKA (MIRAV): ostaje postojeće ponašanje.** Pamti se samo najbolji rezultat završenog
testa; ispit u toku se namjerno ne čuva. To je i bliže pravom ispitu — nema „vrati me nazad
gdje sam stao". Stavka je zatvorena, ne ide u popravke.

Dugme „nazad" u browseru izvodi iz testa, ali bez JS greške.

---

## Faza 4 — Ponašanje u browseru

Skripte: `qa/faza4_rezolucije.mjs`, `qa/faza4_browseri.mjs`, `qa/faza4_embed_mreza.mjs` ·
izlazi: `qa/faza4-*.log` · **P0: 0 · P1: 2 · P2: 1**

Sve je testirano stvarno, ništa nije pretpostavljeno. Mjeri se ono što se da izmjeriti
(preliv u pikselima, `scrollHeight` naspram `clientHeight`, `naturalWidth`, `aria-valuenow`,
broj `postMessage` poruka), a ne „izgleda dobro".

### QA-4-1 · P1 · Na Slow 3G dugmad su vidljiva 1,5 s, a rade tek na 16 s

Izmjereno na 390x844 uz Chrome DevTools Slow 3G (400 kbit/s, 400 ms latencije):

```
DOMContentLoaded            1,5 s   <- stranica se vidi, dugmad izgledaju spremno
load                       10,0 s
dugme „Počni vježbu" radi  16,0 s   <- tek sada React reaguje na klik
-----------------------------------
mrtvi razmak               ~14,6 s
```

Skoro petnaest sekundi kandidat gleda dugme „POČNI VJEŽBU", pritiska ga i **ništa se ne
dešava**. Nema ni spinera, ni onemogućenog stanja, ni poruke. Na sporoj vezi to izgleda kao
da je aplikacija pokvarena, a ne kao da se učitava.

Nađeno tako što je prva verzija testa kliknula baš u taj razmak i test je „pao" — dok se
nije izmjerilo šta se stvarno dešava.

**Predlog:** dugmad na početnoj označiti kao neaktivna dok se ne hidrira, ili prikazati
kratku poruku „učitavanje…". Poslije hidracije prvo pitanje stiže odmah, pa je problem samo
u tom prozoru.

### QA-4-2 · P1 · Mreža brojeva pitanja ima dodirne mete 32x32 px

Preporuka za dodir je najmanje 44x44 px. Mreža „Pregled pitanja" je **32x32 px** na svim
rezolucijama, a kandidat je koristi cijelo vrijeme da skače kroz test — to nije sporedna
kontrola. Na 360 px širine dugmad su i gusto poređana.

```
odgovori i glavna dugmad (Sljedeće, Prethodno, Završi):  svi >= 44px   u redu
mreža brojeva pitanja („1", „2", ... „36a"):             32x32px       ispod praga
```

**Predlog:** `h-9 w-9` (36 px) uz veći razmak, ili `h-11 w-11` (44 px) na mobilnom.

### QA-4-3 · P2 · Sporedne kontrole ispod praga za dodir

```
„← Nazad"     40x87 px
„Literatura"  20x65 px   <- najmanje
„ME/EN/AL/RU" 28x33 px
```

Dodiruju se jednom ili dvaput po sesiji, pa je uticaj mali — ali „Literatura" na 20 px je
teško pogoditi palcem. Nije blokada.

### Provjereno i čisto

**4.1 — četiri rezolucije, 56 provjera** (`qa/faza4-rezolucije.log`).
Na 360x640, 390x844, 820x1180 i 1440x900, na sva tri ekrana (početna, ispit, rezultat):

- **vodoravni preliv je 0 px svuda** — ni na jednoj rezoluciji, ni na jednom ekranu
- nijedan element ne viri izvan širine prozora
- **slika nikad ne prelazi svoj okvir** (npr. 225/294 na 360 px, 225/670 na desktopu)
- **najduža opcija se prelama, ne siječe** — provjereno tako što se u svakom ispitu potraži
  pitanje sa najdužim opcijama (164-272 znakova) pa se mjeri `scrollHeight` naspram
  `clientHeight` kod elemenata sa `overflow: hidden`
- odgovori i glavna dugmad su svi >= 44 px visoki
- **brojač i traka napretka su tačni**: `aria-valuemax` je 41, `aria-valuenow` prati izabrano
  pitanje, natpis piše „n / 41", a procenat odgovara položaju
- nula JS grešaka na svim rezolucijama

**4.2 — četiri motora, 36 provjera** (`qa/faza4-browseri.log`):

| Motor | Rezolucija | Ishod |
| ----- | ---------- | ----- |
| **WebKit** (Safari / iOS) | 390x844 | sve prošlo |
| Chromium (Chrome Android) | 412x915 | sve prošlo |
| Chromium (Chrome desktop) | 1440x900 | sve prošlo |
| Firefox (Gecko) | 1440x900 | sve prošlo |

U svakom motoru prođen je **cio tok**: početna -> vježba (odgovor + povratna informacija) ->
ispit (41 pitanje, tajmer stvarno otkucava u realnom vremenu) -> rezultat. Uz to:

- **nula JS grešaka, nula error/warning poruka u konzoli, nula neuspjelih zahtjeva** u sva
  četiri motora. Ovo zatvara kriterijum „nula grešaka u konzoli na Safari iOS i Chrome
  Android".
- sve slike u pregledu grešaka se stvarno iscrtaju (`naturalWidth > 0` poslije skrolovanja —
  slike su `lazy`, pa se bez skrola mjeri pogrešno)

Jedini 404 koji se javlja je `/_vercel/insights/script.js` — Vercel Analytics ne postoji
lokalno, što je već zapisano u README-u. Filtriran je po URL-u iz `console.location()`, jer
tekst poruke ne sadrži adresu.

**4.3 — `/embed` u pravom iframe-u, 7 provjera** (`qa/faza4-embed-mreza.log`).
Roditeljska stranica se servira sa **istog porijekla**, jer `frame-ancestors` dozvoljava samo
`'self'` i `mirav.me` — `about:blank` roditelj bi bio blokiran i test bi lažno pao.

```
prva poruka: {"type":"mirav-quiz-height","height":694}
promjena ekrana (početna -> ispit):        694 -> 1095 px
promjena pitanja (bez slike -> sa slikom): 823 -> 1095 px, stigla nova poruka
niz visina poslije učitavanja slike:       [1071, 1081, 823, 1095]
```

- **visina se javlja i POSLIJE učitavanja slike** — to je najčešći bug kod iframe ugradnje
  (slika stigne poslije prve poruke i visina ostane pogrešna). Ovdje stiže još poruka.
- **nema duplog skrola**: sadržaj 1095 px, iframe 1095 px, višak **0 px**
- nema JS grešaka na roditeljskoj stranici

**4.4 — mreža, 10 provjera:**

- **Slow 3G**: poslije DOMContentLoaded (1,5 s) ekran **nije prazan** — vidi se zaglavlje,
  filteri kategorija i dugmad. Poslije hidracije prvo pitanje stiže odmah. (Problem je samo
  mrtvi razmak — QA-4-1.)
- **slika koja se ne učita ne razbija ništa**: nula JS grešaka, preliv 0 px, sve tri opcije
  ostaju upotrebljive. `alt` je namjerno prazan — slika je sadržaj pitanja, ne ukras, pa bi
  tekstualni opis bio ili prazna obećanja ili odavanje odgovora.
- **offline usred ispita radi**: baza je već u memoriji, pa se test nastavlja, odgovori se
  bilježe i **rezultat se izračuna bez mreže**. Nula JS grešaka.

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
