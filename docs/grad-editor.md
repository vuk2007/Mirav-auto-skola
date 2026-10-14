# Editor grada — uputstvo

Editor ispravlja i dopunjuje ono što OpenStreetMap ne zna ili zna pogrešno:
znakove, semafore, trake, linije, zone, zatvorene ulice i rute za zadatke.
Svaka izmjena odmah važi u igri: po njoj se crta, po njoj sudi sudija i po
njoj vozi savršeni bot.

Izmjene se čuvaju u **overlay**, fajl `public/data/grad/overrides/podgorica.json`.
OSM podaci se nikad ne mijenjaju. Overlay ide u git i sa sljedećim
deploy-em postaje dio igre.

---

## 1. Pokretanje

Editor radi samo na tvom računaru, uz `npm run dev`. Na Vercel-u ga nema.

1. U `.env.local` dodaj lozinku:
   ```
   GRAD_EDITOR_LOZINKA=neka-tvoja-lozinka
   ```
2. Pokreni `npm run dev`.
3. Otvori **http://localhost:3000/igra?editor=1**.
4. Gore upiši svoje ime u polje **Autor**. Ono ide uz svaku izmjenu, a bez
   njega editor ne prima izmjene.

**Kretanje po karti:**
- povlačenje mišem pomjera kartu, a točkić zumira;
- **Ulica** traži ulicu po imenu (bez obzira na č, ć, š, ž, đ);
- **Koordinate** skaču na tačku: `42.4411, 19.2627` (stepeni) ili `x, y` u metrima, pa Enter.

---

## 2. Šta se može izmijeniti

Režim **Odaberi** (podrazumijevan) bira ono na šta klikneš:

| Klik na | Panel desno |
| --- | --- |
| sredinu raskrsnice | spisak krakova (brojevi kao na karti), potvrda izvedenog, semafor |
| ulicu tik uz raskrsnicu (do 30 m) | **krak**: STOP / trougao / glavni put / bez znaka, znak skretanja, zabrana ulaska |
| ulicu dalje od raskrsnice | **dionica**: smjer, trake, strelice, linije, autobuska traka, zatvorena; znak i pješački prelaz na kliknutom mjestu |

**Krak.** Kontrola važi za ulazak sa tog kraka u raskrsnicu. Znak skretanja
je *zabrana* (precrtana strelica, po jedan znak za svaki pravac) ili
*obavezan smjer* (plavi krug sa dozvoljenim pravcima). „Ukloni zabrane iz
OSM-a" briše pogrešnu OSM zabranu sa tog kraka. Krak pod semaforom se
uređuje u planu semafora.

**Semafor.** Plan ima faze, a svaka faza ima trajanje zelenog. Za svaki krak
u fazi biraš:
- **crveno**;
- **zeleno za sve** pravce;
- **zeleno samo za pravce**: svjetlo sa strelicom za traku, na primjer
  zaštićeno lijevo skretanje.

Pored toga za svaki krak postoje:
- **dopunska zelena strelica**: smije se u njenom pravcu i kad je glavno
  crveno, uz ustupanje (ispitno pitanje 374);
- **zeleno za pješake**: u toj fazi pješaci prelaze preko tog kraka (ako
  vozila sa njega tada stoje). Kad plan nema nijedno, pješaci prelaze krak
  u svakoj fazi u kojoj vozila sa njega stoje.

Za cijelu raskrsnicu se podešavaju **žuto**, **sve crveno** i **pomak**. Pomak
služi za zeleni talas: susjedni semafori bulevara se pomaknu za vrijeme
vožnje između njih.

Klizač **Semafori u** i dugme **Pusti ciklus** pokazuju svjetla u vremenu,
na karti i u spisku krakova. „Semafora nema" uklanja semafor koji je u OSM-u
greškom.

**Dionica** je ulica od raskrsnice do raskrsnice (žuto na karti). „Naprijed"
je smjer crvene strelice na mjestu klika. Mijenjaju se samo polja koja
promijeniš. Polja:
- **Strelice**: kao OSM `turn:lanes`, trake s lijeva nadesno, odvojene sa `|`
  (npr. `left|through;right`).
- **Razdjelna linija**: isprekidana, puna, dvostruka ili bez nje.
- **Puna pred raskrsnicom [m]**: razdjelna linija je puna toliko metara
  pred svakom raskrsnicom dionice.
- **Pune između traka pred raskrsnicom [m]**: isto, za linije između traka
  istog smjera (traka se mijenja prije njih).
- **Bus traka**: krajnja desna traka u tom smjeru. Vožnja njom duže od 3 s
  je prekršaj; prelazak i ulazak radi skretanja nisu (tvoja odluka).
  Linija uz nju je uvijek isprekidana, da se u nju može ući.
- **Zatvorena**: gradilište ili pješačka zona; crta se ograda i znak zabrane
  saobraćaja, a auto ne može ući.

**Na kliknutom mjestu** se postavlja znak uz ulicu:
- **ograničenje brzine** važi od znaka do prve raskrsnice (ispitno pitanje 233);
- **kraj glavnog puta, zabrana i kraj zabrane preticanja, zona škole i djeca
  na putu** se crtaju; preticanje i djeca sude se kad dođu druga vozila i
  pješaci.

Na istom mjestu se dodaje ili uklanja **pješački prelaz**. Komad ulice koji
u stvarnosti ne postoji uklanja se dugmetom „Ukloni ovaj komad ulice".

**Ostali režimi:**
- **Pomjeri čvor**: klikni čvor (tačke se vide pri većem zumu), pa novo mjesto.
- **Nova ulica**: klikni tačke redom. Kraj na postojećoj ulici je dijeli i pravi novu
  raskrsnicu, a kraj na čvoru se veže za njega.
- **Zone**: izaberi zonu iz šablona ili napravi novu, klikni tjemena poligona,
  upiši ograničenje i gustine, pa „Sačuvaj zonu". Kad zona ima ograničenje,
  na svakoj ulici koja u nju ulazi crta se znak *zona ograničene brzine*, a
  na izlazu *kraj zone*.
  **Gustina saobraćaja** određuje koliko drugih vozila ima oko igrača dok je
  u zoni: 0 = nema ih, 1 = 25, 2 = 33, 3 = 40. Van nacrtanih zona važi 1.
  Broj se još množi nivoom i dobom dana (noću ih je manje). Od tih vozila
  su autobusi: 0, 1, 2 ili 3 po gustini — voze stvarnim linijama iz OSM-a
  (3, 4, 10, 15, 18, 19, 20) i staju na stajalištima linije.
  **Gustina pješaka** isto, za pješake: 0 = nema ih, 1 = 30, 2 = 45, 3 = 60.
  Van zona važi 1; noću ih je manje.
- **Zadaci**: klikni start, obavezne tačke i cilj. Zelena linija je ruta kojom bi
  bot vozio, po svim pravilima. Tačku u sredini možeš označiti kao
  manevar (parkiranje, polukružno, uspon). Zadatke vozi stavka 9.

---

## 3. Spiskovi i provjere

- **Izmjene**: sve izmjene, sa autorom i datumom. Klik skače na mjesto, a ✕
  briše izmjenu. **Poništi / Ponovi** rade za sve.
- **Izvedeno**: raskrsnice čiji su prioritet ili faze izvedeni (pretpostavljeni),
  najbliže kameri prve; na karti su narandžaste. Provjeri ih na terenu,
  pa „Potvrdi kako je" ili postavi prave znakove. Broj izvedenih treba da
  opada.
- **Upozorenja**:
  - izmjena koju editor više ne nalazi (OSM se promijenio);
  - puna linija na ulici sa oštrim lomom osovine: greška u OSM-u, pomjeri čvor da ulica bude glatka;
  - autobuska traka koja je jedina traka za neki pravac;
  - raskrsnica sa znakom na nekim krakovima, a pravilom desne strane na ostalim.

**Izvezi listu znakova (CSV)** daje listu svih ručno postavljenih znakova i
semafora, sa ulicom, koordinatama, autorom i datumom, za instruktorsku
provjeru. Otvara se u Excel-u.

---

## 4. Čuvanje

Dok ne sačuvaš, rad se pamti u ovom browseru. Ako zatvoriš prozor, editor
pri sljedećem otvaranju nudi „Vrati nacrt".

**Sačuvaj** (traži lozinku iz `.env.local`) upisuje overlay u repozitorijum.
Pošalji ga commit-om:

```
git add public/data/grad/overrides/podgorica.json
git commit -m "Overlay Podgorice: ..."
```

Prije slanja je dobro pokrenuti `npm run test:fuzz:grad`. Savršeni bot tada
vozi 50 ruta kroz grad sa tvojim izmjenama. Ako negdje padne, poruka kaže
gdje i zašto, a to je ili mjesto za ispravku u editoru ili greška koju ja
treba da popravim.

Overlay je, kao i OSM iz kojeg je izveden, pod licencom ODbL.
