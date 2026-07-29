# MIRAV — Teorijski test (B kategorija)

Online priprema za teorijski ispit auto-škole MIRAV. Next.js (App Router) + TypeScript +
Tailwind CSS. Radi **potpuno statički** — nema baze ni servera, pitanja i slike su lokalni fajlovi.

Na otvaranju se vidi **početni ekran** sa izborom režima — pitanja se učitavaju tek kad
korisnik klikne „Počni".

- **Vježba** — filter po kategorijama, trenutni prikaz tačnog odgovora, neograničeno.
- **Simulacija ispita** — 41 nasumično pitanje, tajmer 45 min sa automatskim krajem,
  bodovanje po `points`, prolaz na 85%, navigacija po pitanjima (mreža brojeva).
- **Pregled grešaka** — poslije ispita, svako promašeno pitanje uz sliku, vaš odgovor,
  tačan odgovor i objašnjenje (ako postoji).
- **Literatura** — modal sa zvaničnim izvorima (gov.me), dostupan sa početnog ekrana i
  sa rezultata.
- **Jezik `me`/`en`** — prebacivač mijenja interfejs; sadržaj pitanja ostaje na crnogorskom.
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
| `EXAM_QUESTION_COUNT`     | `41`     | Broj pitanja u simulaciji ispita                     |
| `EXAM_MINUTES`            | `45`     | Trajanje ispita u minutima                           |
| `PASS_PERCENT`            | `85`     | Prag za prolaz, u procentima osvojenih bodova        |
| `DEFAULT_ORDERING_POINTS` | `4`      | Bodovi za pitanja sa redoslijedom (katalog ima `null`) |
| `EXAM_WARNING_SECONDS`    | `300`    | Kad tajmer pređe u crveno (zadnjih 5 min)            |
| `EXAM_TIMER_ENABLED`      | `true`   | Uključuje/isključuje tajmer                          |

Bodovi po pitanju inače dolaze iz `questions.json` (`points: 1..4`); `null` (samo kod
`ordering` pitanja) se tretira kao `DEFAULT_ORDERING_POINTS`.

> **Važno:** 41 / 45 / 85 je preuzeto iz javno dostupnih izvora crnogorskih auto-škola
> koje upućuju na e-Upravu, i označeno je sa `TODO(MIRAV)` u `lib/config.ts`.
> **Prije objave MIRAV treba da potvrdi tačne brojeve po važećem Pravilniku o
> osposobljavanju kandidata za vozače (MUP CG)**, uključujući eventualnu raspodjelu po
> oblastima (teorija / znakovi / raskrsnice) — koja za sad nije implementirana; izbor
> pitanja je čist random.

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
  EmbedHeightReporter.tsx   postMessage sa visinom
lib/
  types.ts            tipovi pitanja i odgovora
  config.ts           parametri ispita  ← ovdje se mijenja EXAM_*/PASS_*
  i18n.ts             UI stringovi me/en
  storage.ts          localStorage (jezik, najbolji rezultat, nastavak vježbe)
  categories.ts       izvođenje kategorija
  questions.ts        učitavanje, miješanje, provjera odgovora, bodovanje
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

### Objašnjenja i prevodi pitanja

`Question` ima opciona polja `explanation`, `text_en` i `options_en`. Ona **još ne postoje**
u `questions.json` — prikaz je pripremljen, pa se popunjavaju ručno kad se odluči za koja
pitanja. Dok ih nema, engleski UI prikazuje pitanja na crnogorskom uz napomenu.

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
