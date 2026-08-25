# MIRAV — Teorijski test (B kategorija)

Online priprema za teorijski ispit auto-škole MIRAV. Next.js (App Router) + TypeScript +
Tailwind CSS. Radi **potpuno statički** — nema baze ni servera, pitanja i slike su lokalni fajlovi.

Na otvaranju se vidi **početni ekran** sa izborom režima — pitanja se učitavaju tek kad
korisnik klikne „Počni".

- **Vježba** — filter po kategorijama, trenutni prikaz tačnog odgovora, neograničeno.
- **Simulacija ispita** — **tačno 40 pitanja** koja zajedno nose **tačno 80 bodova**, u
  odnosu oblasti 20 : 10 : 10, tajmer 45 min sa automatskim krajem, prolaz na **68 od 80
  bodova**, navigacija po pitanjima (mreža brojeva).
- **Uputstvo prije ispita** — simulacija ne kreće dok kandidat ne pročita uslove izlaska na
  ispit i ne potvrdi to. Vidi „Uputstvo prije ispita".
- **Pregled grešaka** — poslije ispita, svako promašeno pitanje uz sliku, vaš odgovor,
  tačan odgovor i objašnjenje (ako postoji).
- **Literatura** — modal sa zvaničnim izvorima (gov.me), dostupan sa početnog ekrana i
  sa rezultata.
- **Simulator raskrsnica** — treći režim i samostalna ruta `/simulator`: crtane SVG scene i
  fotografije iz kataloga, kroz 7 familija (pravilo desne strane, glavni/sporedni put,
  semafor, skretanje ulijevo, kružni tok, pješaci, katalog). Vidi „Simulator" niže.
- **Jezik `me`/`en`/`sq`/`ru`** — crnogorski, engleski, albanski i ruski. Prevedeni su i
  interfejs **i sva 421 pitanja**, pa se cio test radi na izabranom jeziku.
- **Cijena greške** — uz svaki netačan odgovor u vježbi i uz svaku grešku na ispitu piše
  koliko bi taj prekršaj koštao po ZoBS-u, a na rezultatu stoji i zbir. Vidi „Kazne".
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

| Konstanta                 | Trenutno   | Značenje                                               |
| ------------------------- | ---------- | ------------------------------------------------------ |
| `EXAM_STRUCTURE`          | 5 segmenata | Sastav ispita — koliko pitanja iz kojeg segmenta        |
| `EXAM_QUESTION_COUNT`     | `41`       | Broj pitanja na ispitu, uključujući podpitanja          |
| `EXAM_PASS_PERCENT`       | `85`       | Prag za prolaz, u procentu osvojenih bodova             |
| `EXAM_MINUTES`            | `45`       | Trajanje ispita u minutima                              |
| `DEFAULT_ORDERING_POINTS` | `4`        | Bodovi za pitanja sa redoslijedom (katalog ima `null`)  |
| `EXAM_WARNING_SECONDS`    | `300`      | Kad tajmer pređe u crveno (zadnjih 5 min)               |
| `EXAM_TIMER_ENABLED`      | `true`     | Uključuje/isključuje tajmer                             |

Bodovi po pitanju dolaze iz `questions.json` (`points: 1..4`); `null` (samo kod `ordering`
pitanja) se tretira kao `DEFAULT_ORDERING_POINTS`.

### Sastav ispita: segmenti i podpitanja

Ispit se **ne izvlači po oblastima I/II/III**. Izvlači se po segmentima, iz polja `kind`:

| Segment                       | `kind`      | Pitanja | Podpitanje |
| ----------------------------- | ----------- | ------- | ---------- |
| Saobraćajni znakovi           | `znak`      | 10      | ne         |
| Teorijska (tekstualna) pitanja| `teorija`   | 20      | ne         |
| Komanda policijskog službenika| `policajac` | 1       | **da**     |
| Kosnik ili graničnik          | `kosnik`    | 1       | ne         |
| Saobraćajne situacije         | `situacija` | 4       | **da**     |

Podpitanja se broje kao zasebna pitanja: `10 + 20 + (1+1) + 1 + (4+4) = 41`.
`assertExamStructure()` se izvršava pri učitavanju modula i **puca na buildu** ako se zbir iz
`EXAM_STRUCTURE` razmine sa `EXAM_QUESTION_COUNT`.

`buildExam` ide segment po segment: izvuče `count` nasumičnih pitanja tog `kind`-a bez
ponavljanja i, kod segmenata sa podpitanjem, odmah iza svakog glavnog ubaci njegovo
podpitanje. **Ako neki segment nema dovoljno pitanja, baca `ExamBuildError`** — ne dopunjava
iz druge kategorije, jer bi ispit tako tiho izgubio traženi sastav. Redoslijed segmenata je
redoslijed u `EXAM_STRUCTURE`; unutar segmenta je nasumičan.

U navigaciji su segmenti razdvojeni tankom linijom, a podpitanje nosi slovo uz broj svog
glavnog pitanja (`31` i `31a`) i isprekidan okvir.

Provjereno na **4000 izvlačenja**: 41 pitanje u **4000/4000** slučajeva, 0,02 ms po ispitu.

> **Bodovi više nijesu fiksni.** Prag je procenat (`EXAM_PASS_PERCENT = 85`), a ne broj
> bodova, jer bodovi dolaze iz baze i zbir zavisi od izvučenih pitanja. Mjereno na 4000
> izvlačenja: **89–118 bodova, medijana 103**, prag dakle 76–101 bod. Zvanični test nosi 80
> bodova. Naša baza daje ~103 za istih ~41 pitanje — to je **treći nezavisan pokazatelj da se
> `points` u našem katalogu razlikuju od zvaničnih** (prosjek u bazi je 2,66 boda po pitanju,
> a zvaničnih 80/41 daje 1,95). **Ako MIRAV dostavi zvanične bodove po pitanju, rješava se
> samo od sebe** — treba ispraviti `points` u `questions.json`, ništa drugo.

> **Dvije posljedice sastava koje treba znati:**
>
> 1. **24 situacijska pitanja ne mogu se pojaviti na ispitu.** Segmenti `policajac` i
>    `situacija` izvlače samo pitanja koja **imaju** podpitanje; 24 situacijska pitanja ga
>    nemaju, pa u opticaj ulazi 397 od 421 pitanja. U vježbi su dostupna sva.
> 2. **Segment `kosnik` ima samo 2 pitanja u bazi**, pa se svako pojavljuje na otprilike
>    polovini ispita. Nije blokada, ali nema ni raznovrsnosti — MIRAV bi trebalo da provjeri
>    da li katalog ima još takvih pitanja koja parser nije prepoznao.

> **Važno:** sastav, 45 minuta i prag od 85% označeni su sa `TODO(MIRAV)` u `lib/config.ts`.
> **Prije objave MIRAV treba da ih potvrdi po važećem Pravilniku o osposobljavanju kandidata
> za vozače (MUP CG)**, ili empirijski — pokretanjem jedne zvanične simulacije na eUpravi.
>
> Oblast „Posljedice nepoštovanja propisa" ne dolazi na ispit i nema je u bazi.

### `kind` i `subOf` — kako se upisuju

Oba polja su **generisana** i upisuju se u `public/questions.json`:

```bash
node scripts/gen-exam-meta.mjs --report   # ispiši raspodjelu i parove, ne diraj bazu
node scripts/gen-exam-meta.mjs            # upiši `kind` i `subOf`
```

`kind` se određuje pravilima nad tekstom pitanja, uz `OVERRIDES` za ručne ispravke.
Trenutna raspodjela: situacija 180 · teorija 140 · znak 77 · policajac 22 · kosnik 2.

Tri stvari koje pravila rade drugačije nego što bi se očekivalo, i zašto:

- **`policajac` traži „policijski službenik" ili „ovlašćeno lice", ne golo „policijsk".**
  Golo „policijsk" pokupi i „policijsko vozilo" (id 129, 133, 252), a to su situacijska
  pitanja o vozilu sa pravom prvenstva. Tri pitanja koja opisuju samo položaj ruke
  („Horizontalno predručena ruka…") su u `OVERRIDES` — pravilo ih ne može uhvatiti bez da
  pokupi i znake koje daje vozač rukom.
- **`kosnik` traži granicu riječi** (`graničnik`). Bez nje `granič` pokupi „ograničenje
  brzine" i pola teorije o brzinama — 18 lažnih pogodaka.
- **`znak` prihvata i množinu.** Ranije se kategorija izvodila iz teksta pitanja, pa su
  pitanja koja ne izgovore „saobraćajni znak" — „Na slici je prikazan:", „…znak
  obavještenja…", graničnik, kosnik — završavala u kategoriji raskrsnica i **nosila oznaku
  `RASKRSNICA` iako prikazuju znak**. Oznaka na kartici sada prati `kind`.

`firstAid` se upisuje istom skriptom; `--report` ispisuje spisak svih 17 pitanja da se može
pregledati red po red.

`subOf` se ne pogađa iz teksta. U zvaničnom katalogu jedna slika nosi dva pitanja („kako ćete
postupiti…" + „redoslijed prolaska…"), a parser ih je izvukao kao dva zasebna pitanja sa dva
**bajt-identična** isječka. Par se prepoznaje po: ista strana + uzastopni `local_no` +
identičan fajl slike. Nađen je **91 par** (182 pitanja), **nijedna trojka** i nijedno pitanje
u dva para. Od toga 80 parova ima glavno pitanje `situacija`, 11 `policajac`.

Tekstovi u interfejsu ne ponavljaju ove brojeve — izvode ih iz `config.ts` i iz stvarno
sastavljenog testa, pa promjena jedne konstante mijenja i prikaz. Uputstvo prije ispita zato
piše **stvaran** broj bodova tog testa: ispit se sastavlja prije nego što se uputstvo prikaže
(`prepareExam` u [`components/Quiz.tsx`](components/Quiz.tsx)).

Tajmer se isključuje sa `EXAM_TIMER_ENABLED = false` — tada se sat ne prikazuje i ispit
nema vremensko ograničenje.

---

## Podaci

| Putanja                  | Sadržaj                                  |
| ------------------------ | ---------------------------------------- |
| `public/questions.json`  | 421 pitanje (`area`: I/II/III, `kind`, `subOf`; prevodi EN / RU / AL) |
| `references/`            | spoljni izvori za provjeru (spisak kazni sa linkovima na Sl. list) |
| `translations/`          | izvor prevoda po opsezima pitanja — iz njega se sastavlja `questions.json` |
| `public/web_images/`     | 281 slika — 208 JPG (fotografije situacija) + 73 PNG (znakovi) |
| `_backup_web_images/`    | originali slika koje su ručno prekropovane, prije izmjene |
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

### Isječci slika — poznate greške i revizija

Slike su isječene iz zvaničnog PDF kataloga, a crop box je pravljen kao **unija grafičkih
regiona na strani**, a ne kao figura koja pripada tačno tom pitanju. Otud tri vrste greške:

1. **preliv nagore/nadolje** — u isječak upadne figura susjednog pitanja (policajac, komad
   drugog znaka),
2. **preliv udesno** — u isječak upadne odštampan tekst pitanja iz PDF-a („27. Na slici…"),
3. **odsijecanje** — dopunska tabla ispod glavnog znaka nije obuhvaćena, iako pitanje glasi
   „znaci" (množina).

Ručno je popravljeno **5 potvrđenih slučajeva**; originali su u `_backup_web_images/`, imena
fajlova nepromijenjena (reference u bazi ostaju iste):

| Pitanje | Fajl            | Bilo         | Sada       | Šta je uklonjeno                      |
| ------- | --------------- | ------------ | ---------- | ------------------------------------- |
| 346     | `p041_q10.jpg`  | 520×746      | 512×156    | figura policajca ispod tri panela      |
| 320     | `p037_q65.jpg`  | 184×274      | 184×264    | zeleni pravougaonik ispod dopunske table |
| 336     | `p039_q81.png`  | 1000×314     | 227×156    | odštampan tekst pitanja 81 + tri trougla |
| 282     | `p033_q27.png`  | 517×246      | 164×234    | odštampan tekst pitanja 27             |
| 321     | `p037_q66.png`  | 218×102      | 218×93     | komad plavog znaka iznad E-70 table     |

Isječci nijesu birani odoka: za svaku sliku je izmjeren pravougaonik mastila i pronađeni su
bijeli pojasevi koji razdvajaju komponente, pa je granica postavljena po njima.

> **Šesti slučaj se ne može popraviti isijecanjem.** Pitanje **284** (`p033_q29.jpg`,
> „…snijeg čisti mašinski") traži znak **i** dopunsku tablu, ali tabla nije u fajlu: fajl je
> visok 200 px, gornja ivica table počinje na 190, a sadržaj table je ispod granice fajla.
> Pikseli ne postoje, a **izvorni PDF nije u repo-u**. Rješenje traži ponovno isijecanje iz
> kataloga sa višim boxom — vidi „Prije objave".

Poslije svake izmjene slike pokreni `npm run gen:image-sizes`.

### `/audit` — revizija svih slika

Ovih pet sigurno nijesu jedine greške. [`/audit`](app/audit/page.tsx) je **interni alat** koji
u mreži prikazuje svih 281 pitanja sa slikom: sliku u punoj širini kartice, `id`, fajl, stranu,
`local_no`, `area`, `kind`, `subOf`, bodove, tekst pitanja i sve opcije sa **vidljivo
označenim tačnim odgovorom**.

Uz svaku karticu idu tri dugmeta — `OK`, `Loš crop`, `Loš tekst/odgovor` — i polje za
napomenu. Ponovni klik na istu ocjenu je poništava. Stanje se čuva u `localStorage`, ima
filter (sve / nepregledano / označeno) i brojač napretka („pregledano 84/281"), pa revizija
može da se radi u više sjedanja. `Izvezi JSON` skida `audit-report.json` sa **samo označenim**
pitanjima:

```json
[{ "id": "q_0096", "questionId": 96, "image": "p010_q01.jpg", "page": 10,
   "local_no": 1, "flag": "crop", "note": "viri komad drugog znaka odozgo" }]
```

Stranica **nije nigdje linkovana**, nosi `noindex, nofollow, noarchive` i kao `metadata.robots`
i kao `X-Robots-Tag` zaglavlje u `next.config.mjs` (zaglavlje hvata i robote koji ne izvrše JS).

Popravka samog parsera čeka taj izvještaj — bez njega se ne zna obrazac grešaka, pa bi
prepravka logike isijecanja bila nagađanje.

### Kategorije

Kategorije u vježbi **ne postoje** kao polje u JSON-u — izvode se u
[`lib/categories.ts`](lib/categories.ts), sada iz polja `kind`, a ne iz teksta pitanja:

| Kategorija   | Pravilo                                     | Broj |
| ------------ | ------------------------------------------- | ---- |
| `redoslijed` | `type === "ordering"`                       | 10   |
| `znak`       | `kind === "znak"`                           | 77   |
| `tekst`      | `kind === "teorija"`                        | 140  |
| `situacija`  | ostalo (situacija, policajac, kosnik)       | 194  |

Uz njih idu dva **poprečna** filtera koja presijecaju sve kategorije, jer pitanje o znaku
jeste i pitanje sa slikom, a pitanje o prvoj pomoći jeste i tekstualno pitanje:

| Filter        | Pravilo               | Broj |
| ------------- | --------------------- | ---- |
| `slika`       | ima sliku             | 281  |
| `prva-pomoc`  | `firstAid === true`   | 17   |

Ako pitanje nema `kind` — što se dešava samo ako browser servira keširan stariji
`questions.json`, jer fajl nema heš u imenu — pada se nazad na staro prepoznavanje po tekstu.

**Prva pomoć je samo filter u vježbi, ne segment ispita.** Polje `firstAid` je nezavisno od
`kind`: tih 17 pitanja ostaju `teorija` i i dalje ulaze u teorijski segment ispita, kao i na
pravom ispitu. Da su izdvojena u zaseban `kind`, nikad ne bi došla na simulaciju — a dolaze.

U katalogu nijesu u jednom bloku: na stranama 44–48 su izmiješana sa pitanjima o uređajima
na vozilu (id 380 prva pomoć, 382 vidljivost, 385 prva pomoć, 387 upravljač…), pa se
prepoznaju po sadržaju. Dva pitanja koja pravilo pokupi, a **namjerno su isključena** kroz
`FIRST_AID_OVERRIDES` u `scripts/gen-exam-meta.mjs`:

- **392** „Od određene opreme u autobusu…" — broj kutija prve pomoći je pitanje o opremi
  vozila, ne o pružanju pomoći.
- **390** „Kada dođe do umora tokom vožnje…" — higijena vožnje. **Granično**: ako MIRAV
  smatra da spada u medicinski dio, dovoljno je promijeniti `false` u `true`.

Oznaka na kartici pitanja je **finija od filtera**: komanda policajca (`ZNAK POLICAJCA`) i
kosnik/graničnik (`OZNAKE NA KOLOVOZU`) imaju svoje oznake iako u filteru stoje pod
„Raskrsnice". Filter je ostao isti, oznaka samo tačnije opisuje pitanje koje kandidat gleda.

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

### Web Analytics

Uključena je Vercel Web Analytics — [`@vercel/analytics`](https://www.npmjs.com/package/@vercel/analytics),
`<Analytics />` u [`app/layout.tsx`](app/layout.tsx).

Stoji u korijenskom layoutu, pa pokriva sve rute uključujući `/embed`, koji se na mirav.me
učitava u iframe-u — posjete kroz iframe se broje kao i ostale.

Dvije stvari koje nijesu očigledne:

- **Paket sam po sebi ne uključuje analitiku.** Treba je uključiti i u Vercel konzoli:
  Project → Analytics → Enable. Bez toga se skripta učitava, ali podaci se ne prikupljaju.
- **Lokalno `/_vercel/insights/script.js` vraća 404** i to je očekivano — taj fajl servira
  Vercel, ne Next.js. Ne treba ga „popravljati" ni uslovljavati prikaz komponente.

Cijena: prva strana je porasla sa ~139 kB na ~151 kB.

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
  simulator/page.tsx        simulator kao samostalna stranica
  embed/simulator/page.tsx  simulator za <iframe>, odvojeno od kviza
  icon.svg / icon.png       favicon (SVG + PNG za starije Safari verzije)
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
    RoundaboutSvg.tsx     kružni tok: prsten, ostrvo, lukovi kretanja
    VehicleSprite.tsx     vozilo iz ptičje perspektive (crtano kodom)
    PhotoRunner.tsx       scene iz kataloga (fotografije)
  EmbedHeightReporter.tsx   postMessage sa visinom
lib/
  types.ts            tipovi pitanja i odgovora
  config.ts           parametri ispita  ← ovdje se mijenja EXAM_*
  i18n.ts             UI stringovi me/en/sq/ru
  examBriefing.ts     uputstvo prije ispita  ← ovdje se provjeravaju tvrdnje o ispitu
  penalties.ts        katalog kazni po ZoBS-u  ← ovdje se provjeravaju iznosi
  penaltyMap.ts       generisano — veza pitanje → prekršaj
  storage.ts          localStorage (jezik, najbolji rezultat, nastavak vježbe)
  categories.ts       izvođenje kategorija
  questions.ts        učitavanje, miješanje, provjera odgovora, bodovanje
  simulator.ts        scene iz kataloga + broj vozila po sceni (ručno popisan)
  simRules.ts         model scene + rule-engine (hijerarhija prvenstva)
  simScenarios.ts     31 ručno autorski scenario, provjeren engine-om
  imageSizes.ts       generisano
scripts/
  gen-image-sizes.mjs generator dimenzija slika
  translate.mjs       mašinski prevod pitanja na EN/RU (Claude API)
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

Dostupan je i kao samostalna ruta: **`/simulator`** (i **`/embed/simulator`** za ugradnju
odvojeno od kviza). Familije se biraju karticama.

| Familija | Scenarija | Interakcija |
| --- | :---: | --- |
| Pravilo desne strane | 6 | redoslijed |
| Glavni i sporedni put | 6 | redoslijed |
| Semafor | 6 | redoslijed |
| Skretanje ulijevo | 4 | redoslijed |
| Kružni tok | 6 | odluka |
| Pješaci | 3 | odluka |
| Iz kataloga (fotografije) | 10 | redoslijed |

#### Crtane scene

Raskrsnica se **crta kodom** (SVG, bez ijednog asseta): kolovoz, isprekidane linije, zebre,
trotoari, vozila, znakovi (romb / ustupi prvenstvo / STOP), semafori, kružni tok i pješaci.
Uz svako vozilo se crta **žuta putanja sa strelicom** — bez nje se ne vidi da vozilo skreće,
a od namjere zavisi ko kome ustupa, pa scena ne bi bila rješiva.

Dvije vrste interakcije:

- **redoslijed** — kandidat tapne vozila direktno u sceni; na tačan odgovor se vozila
  animirano provezu tačnim redoslijedom, na netačan blicne crvena tačka ukrštanja,
- **odluka** — „Prolazim / Propuštam" za svoje vozilo (obilježeno žutim prstenom); koristi se
  gdje redoslijed nije poenta.

Desna vožnja je ugrađena u geometriju: sa sjevera se ide na jug zapadnom trakom, sa juga na
sjever istočnom, i tako redom.

Kružni tok ima svoj renderer, [`RoundaboutSvg.tsx`](components/sim/RoundaboutSvg.tsx), jer je
geometrija drugačija od raskrsnice: prsten sa centralnim ostrvom (kroz sredinu **ne** prolazi
put), razdjelna ostrva i trouglovi „ustupi prvenstvo" na ulazima, isprekidana osa prstena.
Vozila se kreću **po luku** prstena, **suprotno od kazaljke na satu** — vozilo koje je već u
prstenu polazi sa svoje pozicije na osi, a vozilo koje ulazi se prvo priključi na osu iz
ulazne trake. Otud i dva pravila koja se prikazuju: vozila u prstenu dolaze s **lijeve**
strane (`ruleRoundaboutLeft`), a vozilo koje izlazi prije vašeg ulaza vam ne prelazi put pa ga
ne morate propustiti (`ruleRoundaboutExit`) — to drugo se računa iz `entry`/`exit` krakova
(`ringArcPasses` u `lib/simRules.ts`), ne pretpostavlja se.

#### Rule-engine

[`lib/simRules.ts`](lib/simRules.ts) računa redoslijed po hijerarhiji prvenstva:
**semafor → znaci → pravilo desne strane**, uz pravilo da ljevak propušta susretno vozilo
koje ide pravo ili desno. STOP i „ustupi prvenstvo" su isti nivo prvenstva; crveno i žuto
znače da vozilo ne prolazi.

Engine je namjerno konzervativan i vraća `null` kad odgovor nije jednoznačan:

- **naredbe policijskog službenika** — semantika znakova rukama nije potvrđena iz Pravilnika,
- **više valjanih redoslijeda** — kad je u nekom koraku više vozila slobodno,
- **„bešavna petlja"** — sva četiri kraka zauzeta na neregulisanoj raskrsnici; svako ima
  nekoga sa desne strane i pravilo samo ne rješava situaciju.

Zbog toga se autorski scenariji mogu **provjeriti**: test poredi svaki `answer` / `decision`
sa onim što engine izračuna. Ako se ne poklope, test pada — pa scenariji ne mogu tiho
odlutati od pravila. Ta provjera je već uhvatila jednu grešku u autorstvu (scena kod koje je
komentar govorio da vozilo skreće, a podatak je govorio da ide pravo).

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

- **Znaci policijskog službenika** — nisu autorisani jer semantika znakova rukama (koji krak
  staje zavisi od položaja tijela i ruku) nije potvrđena iz Pravilnika. Pravilnik je uz to
  jedan od izvora u modalu „Literatura", pa je provjera na dohvat ruke. Engine bi trebalo
  proširiti da naredba policajca poništava semafor i znakove.
- **Posebna vozila** (vozilo s pravom prvenstva, izlazak iz dvorišta) i **biciklisti**.
- **Zvuk, bodovna tabla, beskonačni mod** iz specifikacije (bili označeni kao opciono).
  Beskonačni mod je sada izvodljiv: engine može provjeriti nasumično generisanu scenu i
  odbaciti one koje nisu jednoznačne.

Kad broj scenarija poraste, prirodno je izmjestiti ih iz koda u `public/scenarios.json`,
isto kao `questions.json`.

### Brend

Logo je [`public/mirav-logo.png`](public/mirav-logo.png) — tamnoplavi logotip na **prozirnoj**
podlozi, **2400×686** (77% piksela je prozirno, nijedan bijeli). Ide direktno na svijetlo
zaglavlje, bez pločice i bez zaobljenja.

> Kroz razvoj su se smjenjivale tri verzije: plavi logotip 201×79 (prozirno, ali nizak),
> zatim bijeli na plavoj sa upečenom pozadinom 251×108 (morao je stajati kao pločica), pa
> ova. Zato u istoriji postoje dva različita tretmana zaglavlja — mjerodavan je ovaj.

Visina u zaglavlju je `h-9 sm:h-10` (36 / 40 px). Sadržaj ide od ivice do ivice platna
(gornja i donja margina su 0), pa je to dovoljno da natpis bude iste veličine kao ranije;
prethodna verzija je tražila 48/56 px jer je logo zauzimao samo 56% visine svog platna.
Širina ispadne 126 / 140 px.

Rezolucija je oko **deset puta veća** od prvog logotipa, pa nema zamućenja na retina
ekranima. Ako MIRAV pošalje SVG, dovoljno je zamijeniti fajl i skinuti `width`/`height` —
putanja se referiše na jednom mjestu
([`components/BrandHeader.tsx`](components/BrandHeader.tsx)).

**Dvije plave.** Plava u logu je `#183d73` (tamna mornarska), a token `--blue` je `#2f6fd0`
(svjetlija, koristi se za dugmad, oznake i romb). Vide se jedna pored druge u zaglavlju.
Token nije mijenjan jer je biran po kontrastu: `#2f6fd0` na bijelom daje ~4,9:1 i prolazi
WCAG AA, dok bi `#183d73` bio nepotrebno taman za dugmad. Ako MIRAV želi da se usaglase,
to je odluka o brendu, ne tehnička — vidi „Prije objave".

Favicon je [`app/icon.svg`](app/icon.svg) — logotip je izdužen pa bi u kvadratnoj ikoni bio
nečitak, umjesto njega je inicijal na brend plavoj sa žutim rombom.

### Uputstvo prije ispita

Klik na „Počni ispit" ne pokreće test nego ekran uputstva
([`components/ExamBriefing.tsx`](components/ExamBriefing.tsx)) sa tri panela: **Važno**
(dokumenti i odjeća), **Kako se rješava test**, **Obračun poena**. Dugme „Započni test" je
zaključano dok kandidat ne označi da je pročitao — cilj ekrana nije još jedan klik, nego da
se uslovi izlaska na ispit stvarno pročitaju. Isti ekran ide i pred „Novi ispit" sa rezultata.

Sadržaj je u [`lib/examBriefing.ts`](lib/examBriefing.ts), na sva četiri jezika. Brojevi se
**ne prepisuju ručno** — `{minutes}`, `{points}` i `{pass}` se zamjenjuju iz `lib/config.ts`,
pa promjena `EXAM_MINUTES` mijenja i uputstvo.

> ⚠️ **TODO(MIRAV):** tvrdnje o samom ispitu — potrebna dokumenta, pravila o odjeći i rok
> važenja položenog teorijskog dijela — preuzete su iz uobičajene prakse auto-škola i
> **nijesu provjerene uz važeći Pravilnik**. MIRAV ih mora potvrditi ili ispraviti; dovoljno
> je izmijeniti taj jedan fajl.

### Označavanje odgovora

Ispred svakog ponuđenog odgovora stoji **prazan kvadratić**; klikom se u njega upisuje **✕**
([`components/OptionButton.tsx`](components/OptionButton.tsx)). Kvadratić ostaje bijel, a ✕ je
u boji — popunjen kvadratić bi izgledao kao da je odgovor već ovjeren. Tačan odgovor koji
kandidat **nije** označio ostaje prazan: zeleni okvir kaže da je tačan, a ✕ bi lagao da ga je
izabrao.

**Automatski prelazak na sljedeće pitanje radi samo na simulaciji ispita**, poslije kratke
pauze (`AUTO_ADVANCE_MS` u `lib/config.ts`) da kandidat vidi ✕ koji je upisao. U vježbi se
namjerno ostaje na pitanju — tamo je poenta vidjeti tačan odgovor, pa bi automatski prelazak
sakrio upravo ono zbog čega se vježba.

### Kazne

Uz netačan odgovor se prikazuje koliko bi taj prekršaj koštao u stvarnom saobraćaju, a na
ekranu rezultata i zbir za sve greške. Cilj je da „netačno" dobije težinu koju u saobraćaju
i ima.

> ⚠️ **Iznosi nijesu provjereni.** Svaki unos u [`lib/penalties.ts`](lib/penalties.ts) nosi
> `verified: false` i polje `source`. **MIRAV ih mora provjeriti prije objave.** Do tada se
> cijela funkcija gasi jednim potezom: `PENALTIES_ENABLED = false` u `lib/config.ts`.

Provjera uz drugi izvor:

```bash
node scripts/check-penalties.mjs
```

Poredi naš katalog sa [`references/kazne-zobs-2026-08.json`](references/kazne-zobs-2026-08.json)
— spiskom sastavljenim iz medijskih izvora poslije stupanja izmjena na snagu, koji uz sebe
nosi i linkove na primarne izvore i plan verifikacije. Trenutno: **11 poklapanja, 2 namjerna
razilaženja, 5 stavki gdje taj spisak nema iznos, 26 naših prekršaja koje on ne pokriva.**

> Poklapanje dva neprovjerena izvora **nije** potvrda tačnosti. U tom spisku je 0 od 39
> stavki potvrđeno iz Službenog lista, kao ni kod nas.

Dva namjerna razilaženja, zabilježena u polju `conflict`:

- **parkiranje** — spisak navodi 100 € fiksno, ali iz prekršajnog naloga komunalne policije u
  Podgorici. To je drugi instrument, ne zakonski raspon, pa je zadržan raspon iz zakona.
- **pješak** — spisak daje 60–150 € samo za prelazak van obilježenog prelaza, a naš unos
  pokriva više odredaba, pa rasponi nisu uporedivi jedan na jedan.

Odakle iznosi: kaznene odredbe ZoBS-a, **čl. 319–326** (kazne za vozače i ostale učesnike;
čl. 315–318 se odnose na pravna lica i nijesu uzeti). Izmjene zakona stupile su na snagu
**7. 8. 2026**, a prečišćen tekst poslije njih nije bio dostupan pri izradi — unosi koje su
izmjene promijenile nose iznos iz medijskih izvještaja i označeni su sa `amended: true` —
to je najslabija karika i prvo što treba provjeriti. Poslije poređenja sa referentnim
spiskom osam iznosa je podignuto na poslije-izmjena vrijednosti (pojas, dječje sjedište,
policijski znak, vozačka dozvola, tehnička neispravnost, bicikl, brzina do 10 km/h, crveno
svjetlo), a dodat je i najviši nivo brzine (preko 70 u naselju / 90 van naselja =
1.000–2.000 €). Raniji iznosi su sačuvani u polju `conflict`.

Dva sloja:

- [`lib/penalties.ts`](lib/penalties.ts) — katalog prekršaja: iznos (ili više nivoa, kod
  brzine), član zakona, naziv na sva četiri jezika.
- [`lib/penaltyMap.ts`](lib/penaltyMap.ts) — **generisano**, veza pitanje → prekršaj.
  Pravila i ručne ispravke su u [`scripts/gen-penalty-map.mjs`](scripts/gen-penalty-map.mjs);
  aplikacija ne radi nikakvo poklapanje po riječima, samo čita gotovu tabelu.

```bash
node scripts/gen-penalty-map.mjs --report   # raspodjela po prekršajima, bez upisa
node scripts/gen-penalty-map.mjs            # regeneriši lib/penaltyMap.ts
```

Pokriveno je **384 od 421 pitanja**. Preostalih 37 su definicije („šta je mladi vozač"),
uslovi za izdavanje dozvole i slično — tu prekršaj ne postoji, pa se **ne prikazuje ništa**.
Izmišljen iznos bio bi gori od nikakvog.

Brzina je jedini prekršaj sa stepenovanom kaznom, pa se prikazuju svi nivoi (do 10 km/h →
30–100 €, preko 50 km/h → 150–1.000 €) — inače bi se izgubilo da razlika nije linearna.

### Objašnjenja i prevodi pitanja

Dvije odvojene stvari:

- **Interfejs** — `lib/i18n.ts`, četiri kompletna rječnika (`me`, `en`, `sq`, `ru`).
- **Sadržaj pitanja** — polja `text_en` / `options_en`, `text_ru` / `options_ru`,
  `text_sq` / `options_sq` u `questions.json`. **Sva 421 pitanja su prevedena na sva tri
  jezika**, pa se test može u potpunosti uraditi na jeziku izabranom u gornjem desnom uglu.

Prevodi su **plaćeni jednom** i čuvaju se u repozitorijumu — ne generišu se pri svakom
pokretanju. Izvor istine je direktorijum [`translations/`](translations/); `questions.json`
se iz njega ponovo sastavlja komandom `npm run translate:apply`, bez ijednog poziva API-ja.

Ako pitanje ipak nema prevod (npr. doda se novo), prikazuje se crnogorski original uz
napomenu `translationMissing` — fallback nikad nije tih.

Albanski je interno kod `sq` (ISO 639-1), a na prebacivaču piše `AL` jer je tako
prepoznatljivije — mapa je `LANG_LABELS`.

`explanation` se i dalje popunjava ručno i namjerno: objašnjenja se ne izmišljaju, upisuju se
samo kad postoji osnov u Pravilniku.

#### `translations/` i primjena

```bash
npm run translate:apply           # upiši prevode iz translations/ u questions.json
npm run translate:check           # samo provjeri pokrivenost i dosljednost, bez upisa
```

Format jednog fajla (`translations/qNNN-NNN.json`) drži sva tri jezika jednog pitanja jedan
uz drugi, da se pri pregledu porede:

```json
{ "items": [
  { "id": 1,
    "en": { "text": "…", "options": { "a": "…", "b": "…", "c": "…" } },
    "ru": { "text": "…", "options": { "a": "…", "b": "…", "c": "…" } },
    "sq": { "text": "…", "options": { "a": "…", "b": "…", "c": "…" } } },
  { "id": 101, "en": { "text": "…" }, "ru": { "text": "…" }, "sq": { "text": "…" } }
] }
```

Ordering pitanja nemaju `options`. Jezik se smije izostaviti — upisuje se ono što postoji.

[`scripts/apply-translations.mjs`](scripts/apply-translations.mjs):

- **Ne dira tačne odgovore.** Otisak svih `correct` i `answer_sequence` se poredi prije i
  poslije upisa; na svaku razliku prekida bez pisanja.
- **Sve validira prije upisa** — nepoznat id, prazan tekst, opcije kod ordering pitanja ili
  isti id preveden u dva fajla zaustavljaju cijelu operaciju, da baza ne ostane napola.
- **Upozorava kad isti crnogorski izvor dobije dva različita prevoda.** To nije uvijek greška
  (isti oblik traži drugačiji padež zavisno od predloga: „regulisan je horizontalnim
  oznakama" vs „postupićete po horizontalnim oznakama"), pa je upozorenje, ne greška.

#### Skripta za mašinski prevod (za nova pitanja)

Ako se u bazu dodaju nova pitanja, [`scripts/translate.mjs`](scripts/translate.mjs) ih
prevodi preko Claude API-ja. Troši tokene pri svakom pokretanju, pa se koristi samo za ono
što još nije prevedeno — postojeće prevode preskače.

```bash
ANTHROPIC_API_KEY=... npm run translate             # en + ru + sq, sve neprevedeno
ANTHROPIC_API_KEY=... npm run translate -- --lang=ru --limit=20
npm run translate:stats                             # pokrivenost, bez poziva API-ja
npm run translate -- --lang=en --dry-run            # koji paketi bi išli, bez upisa
```

Ostale opcije: `--batch=N` (pitanja po zahtjevu, podrazumijevano 8), `--model=ID`
(podrazumijevano `claude-opus-5`), `--file=PUT`. Modelu se šalju samo `id`, `text` i
`options` — `correct` i `answer_sequence` ne izlaze iz skripte; upisuje se nakon svakog
paketa, pa prekid ne baca obavljen posao.

> **Prevod je pomoćni.** **Zvanični ispit je na crnogorskom.** Prije nego se prevodi objave
> kao gotovi, izvorni govornik EN/RU/AL treba da provjeri ključne saobraćajne termine
> („ustupi prvenstvo prolaza", „prvenstvo prolaza", „raskrsnica", „nepregledna krivina",
> „mimoilaženje" vs „obilaženje" vs „preticanje"). Prevod ne mijenja tačan odgovor —
> `correct` i `answer_sequence` su nedirnuti.

---

## Revizija (QA)

Puna revizija u šest faza je u [`qa/`](qa/). **Zbirni izvještaj:
[`qa/izvjestaj.md`](qa/izvjestaj.md)** — sažetak, svi nalazi sa dokazima, metrike i
preporučeni redoslijed popravki. Detalji po fazama: [`qa/nalazi.md`](qa/nalazi.md).

Stanje: **1 P0, 15 P1, 2 P2 — ne pušta se.** P0 je da šest pitanja (id 90–95) ne postoji u
zvaničnom katalogu MUP-a. Logika ispita, bodovanje i tajmer su provjereni i čisti.

Provjere se ponavljaju komandama:

```bash
python qa/check_baza.py                 # integritet baze
python qa/ocr_slike.py                  # OCR preko slika (sporo, kešira se)
python qa/check_slike.py                # slike: reference, geometrija, težina
node   qa/fuzz_ispit.mjs                # 500 izvlačenja ispita
node   qa/bodovanje.mjs                 # bodovanje i granica prolaza
python qa/uporedi_katalog.py katalog.txt   # poređenje sa zvaničnim katalogom
python qa/uzorak_za_instruktora.py      # uzorak od 60 pitanja na potpis
```

Browser provjere (`qa/faza3_*.mjs`, `qa/faza4_*.mjs`) traže pokrenut `npx next start` i
Playwright sa instaliranim motorima (`npx playwright install firefox webkit`).

OCR ne traži sistemsku instalaciju — koristi se `rapidocr-onnxruntime` preko
`pip install --user`, ne Tesseract.

## Prije objave

Redom po hitnosti — prve tri stavke su jedine koje mogu dati **pogrešnu informaciju
kandidatu**, ostalo je uglađivanje.

**Tačnost sadržaja**

- [ ] **Provjeriti sve iznose kazni** naspram Sl. lista 111/2026. Nijedan od 39 prekršaja
      nema `verified: true`; oba izvora (naš i referentni spisak) su medijska. Sl. list je
      objavljen kao slike stranica, pa treba OCR. Dok to ne bude gotovo, kazne se mogu
      isključiti jednim potezom: `PENALTIES_ENABLED = false` u `lib/config.ts`.
- [ ] **Pregledati vezu pitanje → prekršaj** u `lib/penaltyMap.ts` (generisan, 384/421
      mapirano). Veza je stručna procjena, ne pravni stav.
- [ ] **Provjeriti tvrdnje u uputstvu prije ispita** (`lib/examBriefing.ts`): dokumenti,
      odjeća, rok važenja od godinu dana. Preuzete su iz uobičajene prakse auto-škola i
      **nijesu provjerene uz važeći Pravilnik**.

**Baza pitanja i slike**

- [ ] **Popraviti sliku pitanja 284** (`p033_q29.jpg`) — dopunska tabla je izvan granica
      fajla, pa se ne može popraviti isijecanjem. Treba ponovo isjeći iz izvornog PDF
      kataloga sa višim boxom. Izvorni PDF nije u repo-u.
- [ ] **Potvrditi ispravku opcije c) pitanja 272.** Tekst je pokvaren na isti način kao kod
      336 (parser je isprepleo dvije kolone): *„približavanje prelaz puta prelasku preko
      željezničke puta preko pruge željezničke bez branika pruge bez ili branika polubranika
      ili polubranika"*. Ispravan tekst je **„približavanje prelasku puta preko željezničke
      pruge bez branika ili polubranika"** — potvrđuju ga EN/RU/AL prevodi iste opcije. To je
      **tačan odgovor** tog pitanja, pa nije popravljeno bez potvrde.
- [ ] **Proći `/audit`** i izvesti `audit-report.json` — 281 sliku treba pogledati. Tek
      poslije toga ima smisla dirati logiku isijecanja u parseru.
- [ ] **Dostaviti zvanične bodove po pitanju.** Naša baza daje ispit od ~103 boda umjesto
      zvaničnih 80 za isti broj pitanja; ispravka `points` u `questions.json` to rješava.
- [ ] **Provjeriti ima li u katalogu još pitanja o kosniku/graničniku** — u bazi su samo 2,
      pa se svako pojavljuje na oko polovini ispita.
- [ ] Potvrditi sastav ispita (41 / 45 min / prag 85%) po važećem Pravilniku MUP-a, pa
      upisati u `lib/config.ts`.
- [ ] Odlučiti da li dodati 22 prekršaja koje referentni spisak ima a mi nemamo (droga,
      neregistrovano vozilo, zatamnjena stakla, režim za vozače 18–21, laka elektrovozila).

**Pravno i jezički**

- [ ] Potvrditi sa MIRAV-om da smiju objaviti bazu pitanja (katalog je zvanični akt MUP-a;
      modal „Literatura" ga referiše, ali to nije isto što i dozvola za objavu).
- [ ] Dati prevode EN/RU/AL izvornom govorniku na provjeru saobraćajnih termina. Prevodi su
      kompletni (1263 unosa) ali **mašinski**.

**Kozmetika**

- [ ] Odlučiti o dvije plave: logo nosi `#183d73`, a token `--blue` je `#2f6fd0`. Ako treba
      da se usaglase, promijeniti `--color-blue` u `app/globals.css` i provjeriti kontrast
      dugmadi (cilj je najmanje 4,5:1 na bijelom).
- [ ] Uključiti Web Analytics u Vercel konzoli (Project → Analytics → Enable) — paket sam po
      sebi ne prikuplja podatke.

### Poznato ograničenje baze

Izvučena pitanja su **jednoizborna** (a/b/c, jedan tačan odgovor). Zvanični ispit ima i
pitanja sa više tačnih odgovora, gdje se priznaje samo potpuno tačan odgovor. Simulacija je
utoliko pojednostavljena — to je i napisano korisniku na kartici „Simulacija ispita".

Podpitanja jesu u bazi, ali samo tamo gdje ih je parser slučajno sačuvao kao zaseban unos sa
istim isječkom (91 par). **24 situacijska pitanja nemaju podpitanje**, pa se ne mogu pojaviti
na ispitu — u vježbi jesu dostupna. Ta pitanja se ne izmišljaju; ako u katalogu postoje, treba
ih izvući iz izvornog PDF-a.
