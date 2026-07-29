# MIRAV — Teorijski test (B kategorija)

Online priprema za teorijski ispit auto-škole MIRAV. Next.js (App Router) + TypeScript +
Tailwind CSS. Radi **potpuno statički** — nema baze ni servera, pitanja i slike su lokalni fajlovi.

Na otvaranju se vidi **početni ekran** sa izborom režima — pitanja se učitavaju tek kad
korisnik klikne „Počni".

- **Vježba** — filter po kategorijama, trenutni prikaz tačnog odgovora, neograničeno.
- **Simulacija ispita** — nasumična pitanja koja zajedno nose **tačno 80 bodova**, tajmer
  45 min sa automatskim krajem, prolaz na **68 od 80 bodova**, navigacija po pitanjima
  (mreža brojeva).
- **Pregled grešaka** — poslije ispita, svako promašeno pitanje uz sliku, vaš odgovor,
  tačan odgovor i objašnjenje (ako postoji).
- **Literatura** — modal sa zvaničnim izvorima (gov.me), dostupan sa početnog ekrana i
  sa rezultata.
- **Simulator raskrsnica (V1)** — treći režim: scena je fotografija iz kataloga, a kandidat
  **tapne vozila redom kojim prolaze** umjesto da kuca brojeve. Vidi „Simulator" niže.
- **Jezik `me`/`en`/`sq`** — crnogorski, engleski i albanski; prebacivač mijenja cio
  interfejs (uključujući footer), a sadržaj pitanja ostaje na crnogorskom uz napomenu.
- **`/embed`** — verzija bez zaglavlja, za ugradnju u `<iframe>` na mirav.me.

---

## Lokalno pokretanje

```bash
npm install
npm run dev      # http://localhost:3000  (ugrađena verzija: /embed)
```

Ostale komande:

```bash
npm run build     # produkcijski build
npm run start     # pokreće build lokalno
npm run lint      # ESLint
npm run typecheck # TypeScript, bez emitovanja
```

---

## Podešavanje ispita

Svi parametri su na jednom mjestu — [`lib/config.ts`](lib/config.ts):

| Konstanta                 | Trenutno | Značenje                                            |
| ------------------------- | -------- | --------------------------------------------------- |
| `EXAM_TOTAL_POINTS`       | `80`     | Ukupno bodova na ispitu                              |
| `EXAM_PASS_POINTS`        | `68`     | Bodova potrebno za prolaz                            |
| `EXAM_MINUTES`            | `45`     | Trajanje ispita u minutima                           |
| `DEFAULT_ORDERING_POINTS` | `4`      | Bodovi za pitanja sa redoslijedom (katalog ima `null`) |
| `EXAM_WARNING_SECONDS`    | `300`    | Kad tajmer pređe u crveno (zadnjih 5 min)            |
| `EXAM_TIMER_ENABLED`      | `true`   | Uključuje/isključuje tajmer                          |

Bodovi po pitanju dolaze iz `questions.json` (`points: 1..4`); `null` (samo kod `ordering`
pitanja) se tretira kao `DEFAULT_ORDERING_POINTS`.

### Zašto broj pitanja nije fiksan

Ispit se sastavlja tako da zbir bodova bude **tačno `EXAM_TOTAL_POINTS`** — vidi `buildExam`
u [`lib/questions.ts`](lib/questions.ts). Pošto pitanja nose 1–4 boda, broj pitanja ispadne
**24–37 (prosjek ~30)**. Bez toga bi maksimum varirao od ispita do ispita, pa prag „68 od 80"
ne bi imao smisla.

`buildExam` radi u dva koraka: pokupi nasumična pitanja koja staju u preostali budžet, pa ako
fali 1–4 boda, dopuni jednim pitanjem tačno te vrijednosti. Drugi korak nije kozmetika — bez
njega bi ispit povremeno završio na 78 ili 79 bodova.

> **Važno:** 80 / 68 / 45 je označeno sa `TODO(MIRAV)` u `lib/config.ts`.
> **Prije objave MIRAV treba da potvrdi tačne brojeve po važećem Pravilniku o
> osposobljavanju kandidata za vozače (MUP CG)**, uključujući eventualnu raspodjelu po
> oblastima (teorija / znakovi / raskrsnice) — koja za sad nije implementirana; izbor
> pitanja je čist random.
>
> Ako je zvanično fiksan **i** broj pitanja **i** ukupan broj bodova, treba nam zvanična
> raspodjela po bodovima (koliko pitanja od 1, 2, 3 i 4 boda) da bi oba uslova mogla važiti
> istovremeno.

Tekstovi u interfejsu ne ponavljaju ove brojeve — izvode ih iz `config.ts`, pa promjena
jedne konstante mijenja i prikaz.

Tajmer se isključuje sa `EXAM_TIMER_ENABLED = false` — tada se sat ne prikazuje i ispit
nema vremensko ograničenje.

---

## Podaci

| Putanja                  | Sadržaj                                  |
| ------------------------ | ---------------------------------------- |
| `public/questions.json`  | 421 pitanje                              |
| `public/web_images/`     | 281 slika — 208 JPG (fotografije situacija) + 73 PNG (znakovi) |
| `lib/imageSizes.ts`      | **generisano** — dimenzije svake slike    |

Baza se učita na klijentu preko `fetch('/questions.json')`, pa ne opterećuje JS bundle i
kešira se kao običan statički fajl.

### Ako se doda ili zamijeni slika

```bash
npm run gen:image-sizes    # regeneriše lib/imageSizes.ts
```

Podržani su PNG i JPEG; skripta prekida rad ako nekoj slici ne može pročitati dimenzije.
Slike se serviraju **bez Vercel optimizacije** (`images.unoptimized` u `next.config.mjs`) da
se ne troši mjesečna kvota transformacija na Hobby planu — vidi „Deploy na Vercel".
Dimenzije su potrebne `next/image` komponenti da ne bi dolazilo do pomjeranja sadržaja dok
se slika učitava, i da se slika **nikad ne prikaže veća od svoje prirodne veličine** (inače
bi manje slike znakova bile razvučene i mutne).

Imena fajlova moraju odgovarati polju `image` u `questions.json` (uključujući ekstenziju).

### Kategorije

Kategorije **ne postoje** u JSON-u — izvode se iz sadržaja pitanja u
[`lib/categories.ts`](lib/categories.ts):

| Kategorija   | Pravilo                                              | Broj |
| ------------ | ---------------------------------------------------- | ---- |
| `redoslijed` | `type === "ordering"`                                | 10   |
| `znak`       | ima sliku i tekst sadrži „saobraćajni znak"          | 73   |
| `situacija`  | ima sliku, nije znak, nije ordering                  | 198  |
| `tekst`      | nema sliku                                           | 140  |

Filter `slika` obuhvata sve sa slikom (znaci + raskrsnice + redoslijed = 281).

---

## Ugradnja na mirav.me

Kviz se ugrađuje kao `<iframe>` na rutu `/test`. Kviz sam javlja svoju visinu, pa nema
duplog scroll-a:

```html
<iframe
  id="mirav-quiz"
  src="https://mirav-test.vercel.app/embed"
  title="Teorijski test — Auto škola Mirav"
  style="width:100%; border:0; min-height:640px"
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"></iframe>

<script>
  window.addEventListener('message', function (e) {
    if (e.origin !== 'https://mirav-test.vercel.app') return;
    if (e.data && e.data.type === 'mirav-quiz-height') {
      document.getElementById('mirav-quiz').style.height = e.data.height + 'px';
    }
  });
</script>
```

### Dozvoljeni domeni

`/embed` šalje `Content-Security-Policy: frame-ancestors 'self' https://mirav.me
https://*.mirav.me` (umjesto `X-Frame-Options`, koji ne podržava listu domena).

Ako se domen mijenja, izmijeni `FRAME_ANCESTORS` na **oba** mjesta:

- [`next.config.mjs`](next.config.mjs) — zaglavlje koje se stvarno šalje
- [`lib/config.ts`](lib/config.ts) — ista lista, radi preglednosti

Ostale rute imaju `X-Frame-Options: SAMEORIGIN` i ne mogu se ugrađivati sa drugih domena.

---

## Deploy na Vercel

Repo je povezan sa GitHub-om, pa **svaki `git push` na `main` automatski redeployuje**.

Prvo postavljanje:

```bash
git remote add origin https://github.com/<nalog>/mirav-test.git
git push -u origin main
```

Zatim na vercel.com → **Add New… → Project** → importuj repo → **Deploy**.
Next.js se prepoznaje sam; nema env varijabli ni posebnih podešavanja.

Svaka naredna izmjena:

```bash
git add -A && git commit -m "opis izmjene"
git push
```

### Optimizacija slika

`images.unoptimized = true` u [`next.config.mjs`](next.config.mjs) — slike idu direktno sa
CDN-a, bez `/_next/image` transformacija. Razlog: baza ima 281 sliku, a Hobby plan ima
mjesečnu kvotu transformacija. Slike su ionako male (~60 kB) i dimenzionisane za prikaz.
Na plaćenom planu se ta opcija može obrisati da se dobije WebP (oko 3× manji fajlovi).

### Custom domen

Za brendiran URL: Vercel → Project → **Settings → Domains** → dodaj `test.mirav.me`, pa kod
DNS provajdera napravi CNAME zapis koji Vercel prikaže. Poslije toga dodaj i taj domen u
`FRAME_ANCESTORS` ako se kviz ugrađuje sa njega.

---

## Struktura

```
app/
  layout.tsx          fontovi (Inter, Barlow Condensed), globalni metapodaci
  page.tsx            puna stranica sa zaglavljem i footerom
  embed/page.tsx      verzija za <iframe>, bez zaglavlja
  globals.css         dizajn tokeni i pomoćne klase
components/
  Quiz.tsx            ekrani (landing/kviz/rezultat), stanje, tajmer
  Landing.tsx         početni ekran sa izborom režima
  Controls.tsx        filter kategorija, skor, tajmer
  QuestionCard.tsx    pitanje, slika, ponuđeni odgovori, objašnjenje
  OptionButton.tsx    jedan ponuđeni odgovor
  OrderingInput.tsx   unos redoslijeda prolaska
  QuestionNav.tsx     mreža brojeva pitanja (ispit)
  ResultCard.tsx      rezultat ispita + Pregled grešaka
  LiteratureModal.tsx zvanični izvori (gov.me)
  ProgressBar.tsx     napredak
  AppProvider.tsx     kontekst: jezik + „nazad na početak" (dijele ih zaglavlje i kviz)
  BrandHeader.tsx     zaglavlje sa logom; klik vodi na landing
  SiteFooter.tsx      footer pune stranice, prati jezik
  sim/
    SimulatorShell.tsx    izbor familije scenarija
    DrawnRunner.tsx       crtane scene: tap u sceni, animacija, pravilo
    IntersectionSvg.tsx   raskrsnica iz ptičje perspektive (crtana kodom)
    VehicleSprite.tsx     vozilo iz ptičje perspektive (crtano kodom)
    PhotoRunner.tsx       scene iz kataloga (fotografije)
  EmbedHeightReporter.tsx   postMessage sa visinom
lib/
  types.ts            tipovi pitanja i odgovora
  config.ts           parametri ispita  ← ovdje se mijenja EXAM_*
  i18n.ts             UI stringovi me/en/sq
  storage.ts          localStorage (jezik, najbolji rezultat, nastavak vježbe)
  categories.ts       izvođenje kategorija
  questions.ts        učitavanje, miješanje, provjera odgovora, bodovanje
  simulator.ts        scene iz kataloga + broj vozila po sceni (ručno popisan)
  simScenarios.ts     crtani scenariji + solver pravila desne strane
  imageSizes.ts       generisano
scripts/
  gen-image-sizes.mjs generator dimenzija slika
```

### Pamćenje

`lib/storage.ts` pamti jezik, najbolji rezultat simulacije i nastavak vježbe (kategorija,
**redoslijed pitanja** i indeks — bez sačuvanog redoslijeda „nastavi" bi vratio isti broj,
ali drugo pitanje). Sve je u `try/catch`: ako je skladište blokirano (Safari „Prevent
cross-site tracking", privatni prozor), kviz radi normalno, samo bez pamćenja.

### Tajmer

Preostalo vrijeme se računa iz **apsolutnog roka**, a ne oduzimanjem po otkucaju intervala:
browseri prigušuju `setInterval` u pozadinskim tabovima (i do jednom u minutu), pa bi
brojanje otkucaja dalo kandidatu znatno više od 45 minuta.

### Simulator raskrsnica

Dvije familije scenarija, biraju se karticama unutar simulatora.

#### „Pravilo desne strane" — crtane scene

Raskrsnica se **crta kodom** (SVG, bez ijednog asseta): kolovoz, isprekidane linije, zebre,
trotoari i vozila. Kandidat tapne vozila **direktno u sceni**; na tačan odgovor se vozila
animirano provezu tačnim redoslijedom, na netačan blicne crvena tačka ukrštanja i ispiše se
pravilo.

Scenariji su ručno autorski u [`lib/simScenarios.ts`](lib/simScenarios.ts) i **provjereni
solverom**: `solveRightHand` nezavisno računa redoslijed iz lanca ustupanja
`N → W → S → E → N`, a test poredi rezultat sa autorskim `answer`. Ako se u scenariju
pogriješi, test pada.

Svi scenariji su za sada na neregulisanoj raskrsnici sa vozilima koja zadržavaju pravac —
tada je redoslijed jednoznačan. Solver namjerno vraća `null` za skretanja (traže dodatna
pravila) i za **„bešavnu petlju"**: kad sva četiri kraka imaju vozilo, svako ima nekoga sa
desne strane i pravilo samo ne rješava situaciju. Zato takav scenarij nije ni autorisan.

Desna vožnja je ugrađena u geometriju: vozilo sa sjevera ide južnom smjerom u zapadnoj traci,
sa juga sjevernim u istočnoj, i tako redom — što test i provjerava.

#### „Iz kataloga" — fotografije

Prikaže se postojeća fotografija sa označenim vozilima, a kandidat tapne brojeve vozila
redom kojim prolaze. Bez unosa s tastature.

Broj vozila po sceni **ne može se izvesti iz podataka** — kod scena sa policajcem dio
vozila uopšte ne prolazi, pa je `answer_sequence` kraći od broja vozila na slici (npr.
`p015_q48` ima 4 vozila, a tačan redoslijed je `[1,4]`). Zato je broj vozila po sceni
popisan ručno u [`lib/simulator.ts`](lib/simulator.ts), pregledom svake slike. **Ako se
doda nova `ordering` scena, upiši je u `SCENE_VEHICLES` — inače se tiho preskače.**

Trenutno je u bazi **10** `ordering` scena (spec pominje 14 — razliku treba provjeriti sa
MIRAV-om).

#### Šta ostaje

Solver za sada pokriva samo pravilo desne strane. Sljedeće familije iz specifikacije nisu
implementirane: glavni/sporedni put (znaci), semafor i skretanje, kružni tok, znaci
policijskog službenika, pješaci/biciklisti, posebna vozila. Uz njih ide i proširenje solvera
hijerarhijom prvenstva (policajac → semafor → znaci → pravila) i podrška za skretanja.

Kad broj scenarija poraste, prirodno je izmjestiti ih iz koda u `public/scenarios.json`,
isto kao `questions.json`.

### Brend

Logo je [`public/mirav-logo-transparent.png`](public/mirav-logo-transparent.png) — koristi se
**transparentna verzija na svijetloj podlozi**, jer ima blagi bijeli rub od anti-aliasing-a
pa se ne stavlja na tamnu ili plavu pozadinu.

Dostavljeni logo je raster **201×79**. Ako MIRAV/Digital Artefakt pošalju SVG ili veći PNG,
dovoljno je zamijeniti taj fajl — putanja se referiše na jednom mjestu
([`components/BrandHeader.tsx`](components/BrandHeader.tsx)).

Boje: logotip je azur `#4080F0`. Token `--blue` je `#2f6fd0` — ista porodica, ali tamnija,
jer `#4080F0` na bijelom daje kontrast ~3:1, premalo za tekst i dugmad; `#2f6fd0` daje
~4,9:1 i prolazi WCAG AA. Azur je zadržan kao `--blue-accent` za dekoraciju i hover.

Favicon je [`app/icon.svg`](app/icon.svg) — logotip je izdužen pa bi u kvadratnoj ikoni bio
nečitak, umjesto njega je inicijal na brend plavoj sa žutim rombom.

### Objašnjenja i prevodi pitanja

Prevodi u `lib/i18n.ts` pokrivaju **samo interfejs**. Sama pitanja su i dalje na crnogorskom
na sva tri jezika — kad je izabran EN ili AL, uz pitanje stoji napomena o tome.

`Question` ima opciona polja `explanation`, `text_en` i `options_en`. Ona **još ne postoje**
u `questions.json` — prikaz je pripremljen, pa se popunjavaju ručno kad se odluči za koja
pitanja. Pitanja se ne prevode automatski.

Albanski je interno kod `sq` (ISO 639-1), a na prebacivaču piše `AL` jer je tako
prepoznatljivije — mapa je `LANG_LABELS` u `lib/i18n.ts`.

---

## Prije objave

- [ ] Potvrditi sa MIRAV-om da smiju objaviti bazu pitanja (katalog je zvanični akt MUP-a;
      modal „Literatura" ga referiše, ali to nije isto što i dozvola za objavu).
- [ ] Potvrditi 41 / 45 / 85 i moguću raspodjelu po oblastima po važećem Pravilniku
      MUP-a, pa upisati u `lib/config.ts`.
- [ ] Uskladiti plavu sa brendom mirav.me (token `--color-blue` u `app/globals.css`).

### Poznato ograničenje baze

Izvučena pitanja su **jednoizborna** (a/b/c, jedan tačan odgovor). Zvanični ispit ima i
pitanja sa više tačnih odgovora, gdje se priznaje samo potpuno tačan odgovor. Simulacija je
utoliko pojednostavljena — to je i napisano korisniku na kartici „Simulacija ispita".
