# MIRAV kviz — QA v1, zbirni izvještaj

Revizija po planu „QA v1", šest faza. Datum: 25. 8. 2026. Verzija: `d33e6a6`.
Detaljni nalazi sa dokazima: [`nalazi.md`](nalazi.md). Izlazi komandi: `qa/*.log`.

---

## 1. Sažetak

| | Broj |
| --- | --- |
| **P0 — blokada puštanja** | **1** |
| P1 — popraviti prije objave | 15 |
| P2 — može poslije | 2 |
| Provjera koje su prošle čiste | 78 |

> ### **NE PUŠTA SE.**
>
> Jedan P0: **šest pitanja u bazi ne postoji u zvaničnom katalogu MUP-a**, a kandidatu se
> prikazuju kao gradivo za ispit. Uz to, tačni odgovori nijesu potvrđeni ni za jedno pitanje —
> katalog ih ne označava, pa je potreban potpis instruktora.
>
> Sve ostalo su popravke koje ne diraju ispravnost rezultata. Sama **logika ispita, bodovanje
> i tajmer su provjereni i čisti** — to nije ono što blokira.

---

## 2. P0 — blokada

### QA-5-1 · Šest pitanja ne postoji u zvaničnom katalogu

**Dokaz.** Zvanični katalog (Ministarstvo prosvjete, maj 2023, 214 strana) skinut je sa
gov.me i upoređen program-za-programom. Ključne riječi ovih pitanja imaju **nula pojava u
cijelom dokumentu**:

| id | Pitanje | Pretraga u katalogu |
| -- | ------- | ------------------- |
| 90 | U bezbjednosnom sjedištu mora da se prevozi dijete do: | `mora da se prevozi dijete do` — 0 |
| 91 | Na istoj osovini vozila pneumatici moraju da budu jednaki: | `pneumatici` — 0 · `osovini` — 0 |
| 92 | Svijetla za maglu na motornom vozilu treba da budu postavljena… | `Svijetla za maglu na motornom` — 0 |
| 93 | Naslon za glavu mora biti ugrađen na sjedištu kod kojeg… | `naslon` — 0 |
| 94 | Kad kod povrijeđenog hoćemo da zaustavimo krvarenje… | `zaustavimo krvarenje` — 0 |
| 95 | Broj hitne pomoći je: | `hitne pomo` — 0 |

Blok je **uzastopan** (naša strana 9, `local_no` 90–95) i staje tačno tamo gdje se naš broj
pitanja razilazi sa katalogom: **421 naprema 414**. Pitanja 87, 88 i 89 sa iste strane **jesu**
u katalogu. Pitanje 93 uz to nosi tipfeler (`sigurtosni`) kojeg u katalogu nema — dodatan znak
da nije prepisano iz njega.

**Predložena popravka — NIJE primijenjena.** Ne brisati napamet: pitanja mogu poticati iz
starijeg ili novijeg izdanja kataloga. MIRAV treba da utvrdi porijeklo. Ako se ne može
potvrditi, izbaciti ih iz `public/questions.json`. Uklanjanje šest teorijskih pitanja ne
ugrožava sastav ispita — segment `teorija` bi ostao na 134 dostupna, a treba mu 20.

---

## 3. P1 — popraviti prije objave

| Oznaka | Nalaz | Obim | Predložena popravka |
| ------ | ----- | ---- | ------------------- |
| **QA-5-2** | Opcija b) pitanja 272 pokvarena; katalog daje tačan tekst | 1 pitanje | Upisati „prelaz puta preko željezničke pruge bez branika ili polubranika" i ponoviti EN/RU/AL prevod te opcije |
| **QA-5-3** | `/embed` nema disclaimer na početnoj, u ispitu ni na rezultatu | ugrađena verzija | Vratiti napomenu bar na ekran rezultata — ili potvrditi da je mirav.me nosi oko iframe-a |
| **QA-5-4** | `/audit` nije iza env flag-a | 1 ruta | `NEXT_PUBLIC_ENABLE_AUDIT === "1"` |
| **QA-3-1** | Prikazani procenat može pisati „85%" uz „PAO" | 19 kombinacija | `Math.floor` umjesto `Math.round` u `ResultCard.tsx` |
| **QA-2-1** | `p038_q74.jpg` (329) — plava traka upada odozdo | 1 slika | Rez po donjoj ivici dopunske table |
| **QA-2-2** | `p043_q29/q30.jpg` (365, 366) — odsječeni brojevi 1–4 | 2 slike | Rez sa ~15 px više visine |
| **QA-2-3** | `p033_q29.jpg` (284) — dopunska tabla izvan granica fajla | 1 slika | **Ne može rezom** — ponovo isjeći iz izvornog PDF-a |
| **QA-1-1** | Ćirilično `а` (U+0430) u latiničnim riječima | 2 pitanja, 6 riječi | Zamijeniti sa latiničnim `a` |
| **QA-1-2** | Tipfeleri — **ali samo 2 su naša** (vidi § 4) | 2 pitanja | `propuštatjući`→`propuštajući` (250), `povrijeđnog`→`povrijeđenog` (410) |
| **QA-1-3** | Razmak prije interpunkcije | 18 mjesta, 16 pitanja | Jedna zamjena nad bazom, bez rizika |
| **QA-1-4** | Crtica sa razmacima usred rečenice | 24 mjesta, 23 pitanja | **Nije mehaničko** — proći listu ručno |
| **QA-1-5** | Duge opcije | 2 (72 uredna, 272 = QA-5-2) | Objedinjeno sa QA-5-2 |
| **QA-1-6** | Tačan odgovor je `b` u 44,2% pitanja o znakovima | granično (prag 42%) | **Ne dirati** — katalog je zvaničan akt; samo zabilježiti |
| **QA-4-1** | Slow 3G: dugmad vidljiva na 1,5 s, rade na 16 s | početna | Onemogućiti dugmad do hidracije ili prikazati „učitavanje…" |
| **QA-4-2** | Mreža brojeva pitanja: dodirne mete 32×32 px | svi ekrani | `h-11 w-11` na mobilnom |

## 4. P2 — može poslije

| Oznaka | Nalaz | Napomena |
| ------ | ----- | -------- |
| QA-0-1 | `npm audit`: 6 ranjivosti visoke ozbiljnosti | Sve u alatima za build; `sharp` se ne izvršava (`images.unoptimized`). **`npm audit fix --force` bi podigao `next` na sljedeći glavni broj — ne pokretati.** |
| QA-4-3 | Sporedne kontrole ispod 44 px | „Literatura" 20×65, jezik 28×33, „Nazad" 40×87 |

---

## 5. Nalaz koji je ispravio raniji nalaz

Vrijedi izdvojiti, jer mijenja plan popravki.

**Dvanaest od četrnaest „tipfelera" iz Faze 1 nalaze se u ZVANIČNOM katalogu:**

```
raskrnice    prevenstvom   proustanja   sitaciji    izvrsti      vozulo
rasksnice    cujem         verikalno    zaustvljanje  rasksnici  hrizontalno
```

**Njih ne treba popravljati.** Aplikacija treba da prikazuje ono što kandidat vidi i na
zvaničnom ispitu; „ispravka" bi napravila razliku između vježbe i ispita. Naša su samo dva:
`propuštatjući` (250) i `povrijeđnog` (410).

Isto tako, moj prvobitni predlog rekonstrukcije pitanja 272 **bio je pogrešan** — izveo sam ga
iz engleskog prevoda, koji je i sam napravljen od pokvarenog izvornika. Katalog je presudio.

---

## 6. Provjereno i čisto

Ovo je jednako važno kao nalazi — ne treba ponovo provjeravati.

### Baza pitanja
- sva obavezna polja postoje i nijesu prazna (421 pitanje); svi `id` jedinstveni
- **nema pravih duplikata** — 17 grupa dijeli isti tekst, ali sve imaju različite opcije
- **nijedna grupa nema iste opcije a različit tačan odgovor** (to bi bio P0)
- tačan odgovor uvijek postoji među opcijama; nema praznih ni identičnih opcija; sva pitanja
  sa izborom imaju tačno 3 opcije
- nema mojibake, izgubljene dijakritike ni ekavskih oblika
- **394 od 411 pitanja poklapa se sa zvaničnim katalogom** u tekstu i sve tri opcije
- **prevodi EN/RU/AL su kompletni** — 421/421/421 teksta, nijedan prazan, nijedan identičan
  crnogorskom, ključevi opcija se poklapaju

### Slike
- **svih 281 slika prošlo OCR — nijedna ne sadrži odštampan tekst iz kataloga**
- svaka slika iz baze postoji na disku; nema siročića; nijedan fajl nije prazan
- osam slika koje je detektor označio provjereno je ručno i uredne su

### Logika ispita
- **500 fuzz izvlačenja, 0 grešaka**: tačno 41 pitanje, segmenti u zadatom redoslijedu, svako
  podpitanje odmah iza svog glavnog i dijeli s njim sliku, bez ponavljanja
- **granica prolaza tačna za svih 41 mogućih zbirova**; koristi se `>=` a ne `>`; **nijedan
  rezultat ispod 85% ne prolazi** (provjereno iscrpno)
- neodgovoreno se broji kao 0 bodova i ostaje u imeniocu
- **tajmer se računa iz apsolutnog roka** — sa onesposobljenim `setInterval` i pomjerenim satom
  pokaže tačno 35:00 poslije 10 minuta prigušenog taba
- sam predaje na 0; dvoklik na „Završi" ne predaje dvaput
- simulacija ne otkriva tačnost; pregled grešaka tačan u oba ekstrema

### Browser
- **nula JS grešaka, nula poruka u konzoli, nula neuspjelih zahtjeva** u WebKit (Safari/iOS),
  Chromium (Android i desktop) i Firefox
- vodoravni preliv **0 px** na 360, 390, 820 i 1440 px, na sva tri ekrana
- `/embed` javlja visinu pri učitavanju, promjeni ekrana, promjeni pitanja **i poslije
  učitavanja slike**; nema duplog skrola (višak 0 px)
- offline usred ispita radi; slika koja se ne učita ne razbija raspored

### Pravna strana
- svih 5 gov.me linkova vraća 200 i vodi na tačan dokument (provjereni naslovi)
- podaci: **samo `localStorage` na uređaju** — bez kolačića, bez slanja na server; Vercel
  Analytics je bez kolačića i bez identifikatora korisnika

---

## 7. Šta se ne može provjeriti automatski

| Šta | Zašto | Ko rješava |
| --- | ----- | ---------- |
| **Tačnost odgovora** | Zvanični katalog **ne označava tačne odgovore** — nula pogodaka za `(X)`, `[x]`, podvučeno i „tačan" na 214 strana | Instruktor: [`uzorak-za-instruktora.md`](uzorak-za-instruktora.md), 60 pitanja |
| **Porijeklo pitanja 90–95** | Nema ih u katalogu iz 2023 — možda drugo izdanje | MIRAV |
| **Iznosi kazni** | 0 od 39 potvrđeno; Sl. list 111/2026 objavljen kao slike stranica, traži OCR | MIRAV / pravnik |
| **Veza pitanje → prekršaj** | Stručna procjena, ne pravni stav (384/421 mapirano) | MIRAV |
| **Tvrdnje u uputstvu** | Dokumenti, odjeća, rok od godinu dana — iz prakse, ne iz Pravilnika | MIRAV |
| **Sastav ispita 41/45/85%** | Nije potvrđen uz važeći Pravilnik | MIRAV |
| **Dozvola za objavu baze** | Katalog je zvanični akt MUP-a | MIRAV, pismeno |
| **Terminologija u prevodima** | Mašinski prevod EN/RU/AL | Izvorni govornik — **osim albanskog**, vidi § 9 |

---

## 8. Metrike

**Baza**
```
pitanja                421   (411 sa izborom + 10 ordering)
kind                   situacija 180 · teorija 140 · znak 77 · policajac 22 · kosnik 2
area                   I 140 · II 73 · III 208
podpitanja (subOf)      91 para
prva pomoć (firstAid)   17
prevodi EN / RU / AL   421 / 421 / 421 — kompletno
```

**Raspodjela tačnog odgovora** (prag: svaka pozicija 25–42%)
```
ukupno     a 120 (29,2%)   b 142 (34,5%)   c 149 (36,3%)     u opsegu
znak       a  22 (28,6%)   b  34 (44,2%)   c  21 (27,3%)     b odstupa (QA-1-6)
```

**Ispit** — 500 izvlačenja
```
pitanja po ispitu      41 u 500/500
bodovi po ispitu       90–116, medijana 102, prosjek 102,3
prag 85%               77–99 bodova, zavisi od izvlačenja
vrijeme sastavljanja   0,120 ms
pokrivenost baze       397 od 421 pitanja ikad izvučeno
nikad izvučeno         24 — sve `situacija` bez podpitanja, po konstrukciji
ponavljanje            znak i teorija ~ svaki 7. ispit · policajac ~ 11. · situacija ~ 20.
                       kosnik ~ svaki 2. ispit (samo 2 pitanja u bazi)
```

**Slike**
```
281 fajl               16,36 MB   (208 JPG 13,64 MB + 73 PNG 2,72 MB)
prosjek                60 kB      najveći 337 kB
cio ispit povuče       21 slike, 930 kB   (učitavanje po pitanju, `loading="lazy"`)
```

**Mreža — Slow 3G** (400 kbit/s, 400 ms latencije, 390 px)
```
DOMContentLoaded        1,5 s   ekran nije prazan
load                   10,0 s
dugmad rade            16,0 s   <- QA-4-1
```

---

## 9. Prilika otkrivena usput

Zvanični katalog je **dvojezičan**: strane 1–49 crnogorski, od 50. **albanski**
(`KATALOGU I PYETJEVE`). Naši albanski prevodi su mašinski.

Albanska pitanja se mogu preuzeti iz zvaničnog izvora — isti dokument, ista numeracija. To bi
zamijenilo mašinski prevod zvaničnim tekstom **i zatvorilo stavku „dati prevod izvornom
govorniku" za albanski**. Ostaju EN i RU, koji zvanične verzije nemaju.

---

## 10. Preporučeni redoslijed popravki

### Prvo — bez ovoga se ne pušta

1. **QA-5-1** — utvrditi porijeklo pitanja 90–95. *Blokira sve ostalo jer može promijeniti
   sadržaj baze.* → MIRAV
2. **Uzorak od 60 pitanja na potpis instruktoru.** Može teći **paralelno** sa svime — ne
   zavisi od koda. → MIRAV
3. **QA-5-2** — tekst opcije b) pitanja 272 (tačan odgovor tog pitanja) + ponoviti prevode.

### Drugo — jedan prolaz kroz kod, sve nezavisno jedno od drugog

Ovih pet se mogu raditi **paralelno**, ne dodiruju se:

4. **QA-3-1** — `Math.floor` u prikazu procenta *(jedna riječ)*
5. **QA-5-4** — env flag za `/audit` *(nekoliko redova)*
6. **QA-5-3** — disclaimer u `/embed` *(zavisi od odgovora MIRAV-a o mirav.me)*
7. **QA-4-2** — veće dodirne mete u mreži pitanja
8. **QA-4-1** — onemogućiti dugmad do hidracije

### Treće — jedan prolaz kroz bazu teksta

Rade se zajedno, jednim skriptom nad `questions.json`, pa jednim `translate:apply`:

9. **QA-1-1** ćirilično `а` · **QA-1-2** dva naša tipfelera · **QA-1-3** razmak prije
   interpunkcije *(mehaničko)*
10. **QA-1-4** crtice — **ručno**, 24 mjesta, jer nije jednoobrazno

### Četvrto — slike

11. **QA-2-1**, **QA-2-2** — rez, pikseli postoje *(paralelno sa svim gore)*
12. **QA-2-3** — traži izvorni PDF; sada ga imamo, pa je izvodljivo
13. **Proći `/audit`** i izvesti `audit-report.json` — 281 sliku treba pogledati. Tek poslije
    toga ima smisla dirati logiku isijecanja u parseru.

### Kad stigne

14. **QA-0-1** `npm audit fix` *(bez `--force`)* · **QA-4-3** sporedne kontrole
15. Albanski prevod iz zvaničnog kataloga (§ 9)
16. Iznosi kazni iz Sl. lista 111/2026 — do tada se mogu gasiti sa `PENALTIES_ENABLED = false`

---

## 11. Kriterijum za puštanje — stanje

| | Kriterijum | Stanje |
| --- | ---------- | ------ |
| ❌ | Nula P0 nalaza | **1 P0** (QA-5-1) |
| ❌ | Tačni odgovori provjereni protiv kataloga, ili uzorak od 60 potpisan | katalog **ne sadrži odgovore**; uzorak generisan, **nije potpisan** |
| ✅ | 500 fuzz izvlačenja bez greške, svako 41 pitanje i tačna struktura | 500/500 |
| ✅ | Tajmer računa iz apsolutnog vremena i preživi zaključavanje telefona | potvrđeno mjerenjem |
| ✅ | Prag 85% testiran na granici | tačan za svih 41 mogućih zbirova |
| ✅ | Sve slike prošle OCR i geometrijsku provjeru, sumnjive ručno pregledane | 281/281 |
| ✅ | Nema neprevedenih jezika izloženih u UI-ju bez upozorenja | sva 4 jezika kompletna |
| ✅ | Čist build, lint, tsc; nula grešaka u konzoli na Safari iOS i Chrome Android | potvrđeno |
| ❌ | `/audit` zatvoren za javnost | ima `noindex`, **nema env flag-a** |
| ❌ | MIRAV pismeno potvrdio da smije objaviti bazu pitanja | nije |

**6 od 10 ispunjeno.** Četiri otvorena, od kojih tri traže odluku MIRAV-a, a jedno je
petnaest minuta koda.
