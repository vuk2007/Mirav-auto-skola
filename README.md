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
- **Simulator raskrsnica** — treći režim i samostalna ruta `/simulator`: crtane SVG scene i
  fotografije iz kataloga, kroz 7 familija (pravilo desne strane, glavni/sporedni put,
  semafor, skretanje ulijevo, kružni tok, pješaci, katalog). Vidi „Simulator" niže.
- **Jezik `me`/`en`/`sq`/`ru`** — crnogorski, engleski, albanski i ruski; prebacivač mijenja
  cio interfejs (uključujući footer). Sadržaj pitanja se prevodi odvojeno, skriptom — vidi
  „Objašnjenja i prevodi pitanja".
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

| Konstanta                 | Trenutno | Značenje                                            |
| ------------------------- | -------- | --------------------------------------------------- |
| `EXAM_TOTAL_POINTS`       | `80`     | Ukupno bodova na ispitu                              |
| `EXAM_PASS_POINTS`        | `68`     | Bodova potrebno za prolaz                            |
| `EXAM_QUOTA`              | `21/10/10` | Odnos oblasti I : II : III pri izvlačenju            |
| `EXAM_MINUTES`            | `45`     | Trajanje ispita u minutima                           |
| `DEFAULT_ORDERING_POINTS` | `4`      | Bodovi za pitanja sa redoslijedom (katalog ima `null`) |
| `EXAM_WARNING_SECONDS`    | `300`    | Kad tajmer pređe u crveno (zadnjih 5 min)            |
| `EXAM_TIMER_ENABLED`      | `true`   | Uključuje/isključuje tajmer                          |

Bodovi po pitanju dolaze iz `questions.json` (`points: 1..4`); `null` (samo kod `ordering`
pitanja) se tretira kao `DEFAULT_ORDERING_POINTS`.

### Sastav ispita: oblasti i bodovi

Svako pitanje ima `area`: **I** = propisi/teorija, **II** = saobraćajni znakovi,
**III** = raskrsnice/situacije. U bazi: I=140, II=73, III=208.

Test se **ne izvlači ravnomjerno nasumično** — `EXAM_QUOTA` zadaje odnos oblasti (21:10:10),
a `buildExam` puni ispit dok zbir ne bude **tačno `EXAM_TOTAL_POINTS`**.

> **Zašto odnos, a ne fiksnih 41 pitanje:** sa bodovima iz našeg kataloga 41 pitanje po
> odnosu 21:10:10 daje **87–116 bodova, nikad 80** (provjereno na 4000 izvlačenja). Pošto je
> maksimum na ispitu 80, odnos određuje **sastav**, a punjenje staje na 80 bodova — broj
> pitanja zato ispadne **27–39 (prosjek 32)**.
>
> Ako se ispostavi da je zvanično i broj pitanja fiksan (41) i maksimum 80, znači da se
> bodovi po pitanju u zvaničnom katalogu razlikuju od naših — to treba provjeriti sa MIRAV-om.

Izmjereni sastav na 4000 ispita: **I=51,1% · II=24,1% · III=24,8%** naspram traženih
51,2 / 24,4 / 24,4. Bez kvote bi bio 34,9 / 18,4 / 46,7 — dakle kvota stvarno mijenja izbor.

`buildExam` radi u tri koraka: vuče po kvoti oblasti, dopuni iz cijele baze ako se kvota
iscrpi prije budžeta, pa ako fali 1–4 boda doda jedno pitanje tačno te vrijednosti. Treći
korak nije kozmetika — bez njega bi ispit povremeno završio na 78 ili 79 bodova. Ako neka
oblast nema dovoljno pitanja, ispiše se upozorenje u konzoli i ispit se dopuni iz ostalih.

> **Važno:** 80 / 68 / 45 i kvota 21:10:10 označeni su sa `TODO(MIRAV)` u `lib/config.ts`.
> **Prije objave MIRAV treba da potvrdi tačne brojeve po važećem Pravilniku o
> osposobljavanju kandidata za vozače (MUP CG)**, ili empirijski: pokrenuti jednu zvaničnu
> simulaciju na eUpravi i prebrojati koliko pitanja dolazi iz svake oblasti.
>
> Oblast „Posljedice nepoštovanja propisa" ne dolazi na ispit i nema je u bazi.

Tekstovi u interfejsu ne ponavljaju ove brojeve — izvode ih iz `config.ts`, pa promjena
jedne konstante mijenja i prikaz.

Tajmer se isključuje sa `EXAM_TIMER_ENABLED = false` — tada se sat ne prikazuje i ispit
nema vremensko ograničenje.

---

## Podaci

| Putanja                  | Sadržaj                                  |
| ------------------------ | ---------------------------------------- |
| `public/questions.json`  | 421 pitanje (polje `area`: I / II / III; prevodi EN / RU / AL) |
| `translations/`          | izvor prevoda po opsezima pitanja — iz njega se sastavlja `questions.json` |
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

### Kazne

Uz netačan odgovor se prikazuje koliko bi taj prekršaj koštao u stvarnom saobraćaju, a na
ekranu rezultata i zbir za sve greške. Cilj je da „netačno" dobije težinu koju u saobraćaju
i ima.

> ⚠️ **Iznosi nijesu provjereni.** Svaki unos u [`lib/penalties.ts`](lib/penalties.ts) nosi
> `verified: false` i polje `source`. **MIRAV ih mora provjeriti prije objave.** Do tada se
> cijela funkcija gasi jednim potezom: `PENALTIES_ENABLED = false` u `lib/config.ts`.

Odakle iznosi: kaznene odredbe ZoBS-a, **čl. 319–326** (kazne za vozače i ostale učesnike;
čl. 315–318 se odnose na pravna lica i nijesu uzeti). Izmjene zakona stupile su na snagu
**7. 8. 2026**, a prečišćen tekst poslije njih nije bio dostupan pri izradi — unosi koje su
izmjene promijenile (telefon, dijete na prednjem sjedištu, crveno svjetlo) označeni su sa
`amended: true` i nose iznos iz medijskih izvještaja, što je najslabija karika i prvo što
treba provjeriti.

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

## Prije objave

- [ ] Potvrditi sa MIRAV-om da smiju objaviti bazu pitanja (katalog je zvanični akt MUP-a;
      modal „Literatura" ga referiše, ali to nije isto što i dozvola za objavu).
- [ ] Potvrditi 41 / 45 / 85 i moguću raspodjelu po oblastima po važećem Pravilniku
      MUP-a, pa upisati u `lib/config.ts`.
- [ ] Uskladiti plavu sa brendom mirav.me (token `--color-blue` u `app/globals.css`).
- [ ] Pokrenuti `npm run translate` (traži `ANTHROPIC_API_KEY`) — bez toga EN i RU prikazuju
      pitanja na crnogorskom uz napomenu.
- [ ] Dati mašinski prevod EN/RU izvornom govorniku na provjeru saobraćajnih termina prije
      nego se prevodi objave kao gotovi.

### Poznato ograničenje baze

Izvučena pitanja su **jednoizborna** (a/b/c, jedan tačan odgovor). Zvanični ispit ima i
pitanja sa više tačnih odgovora, gdje se priznaje samo potpuno tačan odgovor. Simulacija je
utoliko pojednostavljena — to je i napisano korisniku na kartici „Simulacija ispita".
