# OSM podaci za mod „Putovanje"

Skripte koje iz OpenStreetMap-a izvlače stvarni oblik puteva Crne Gore i
okolinu pored njih. **Pokreću se ručno**, nikad u `build`-u: podaci se mijenjaju
sporo, a Overpass je tuđi, besplatan i ograničen servis.

## Licenca — obavezno

Podaci u `public/data/osm/` su izvedeni iz OpenStreetMap-a i objavljuju se pod
istom licencom:

> Podaci o putevima i okolini: © OpenStreetMap contributors (ODbL)

Ovaj tekst mora stajati na mini mapi i u ekranu „O igri" čim se ti podaci
prikažu. Dok se ne prikazuju, atribucija stoji ovdje, u `ATRIBUCIJA.md` i u
`public/data/osm/izvor.json`.

## Redoslijed

```bash
npm run osm:povuci     # 1. preuzimanje u scripts/osm/.cache/ (traje, ~30 min)
npm run osm:pripremi   # 2. projekcija, uprošćavanje, tile-ovi 2×2 km
npm run osm:ivice      # 3. geometrija za svaku ivicu grafa + spisak za provjeru
npm run osm:kicme      # 4. kandidati za gradske kičme
```

Prvi korak je odvojen namjerno: preuzimanje traje desetak minuta i više, a
obrada se mijenja i ponavlja svaki čas. Sirovi odgovori se keširaju po otisku
upita, pa se isti upit drugi put ne šalje. Keš je u `.gitignore`.

## Šta se povlači

Tačno ono što je zadato i ništa više — bez zgrada, bez POI-ja, bez adresa:

| upit | sadržaj |
| --- | --- |
| `putevi` | `motorway`…`tertiary` sa vezama, plus `junction=roundabout` |
| `ulice` | `residential`, `unclassified`, `living_street` u krugu oko centara opština |
| `sporedni` | `unclassified`, `residential` po cijeloj zemlji — samo za raskrsnice na ivicama, ne ulaze u traženje rute |
| `voda` | `natural=water`, `natural=coastline`, `waterway=river` |
| `zelenilo` | `natural=wood`, `landuse` = forest, farmland, vineyard, residential, industrial |
| `vrhovi` | `natural=peak` sa imenom i visinom |
| `granica` | državna granica (`admin_level=2`) za obris na mini mapi |

Veliki upiti se dijele na mrežu manjih (`lib/mreza.mjs`) i spajaju po `id`-u
elementa. Jedan upit koji traži cijelo zelenilo Crne Gore odjednom ili istekne
ili stigne kao stotinjak megabajta koje Overpass odbije da sastavi.

## Zamke koje su već koštale vremena

- **`overpass.osm.ch` je švajcarski izvod baze.** Odgovara za pola sekunde,
  vraća status 200 i **nula elemenata** za Crnu Goru. Skripta bi „uspješno"
  povukla prazan svijet. Zato ga nema u spisku ogledala.
- **Overpass odbija zahtjeve bez razumnog `User-Agent`-a sa 406**, ne sa 401 i
  ne sa porukom koja to kaže.
- **Greška stiže kao HTML sa statusom 200.** Zato se provjerava oblik odgovora,
  a ne samo status.

## Izlaz

```
public/data/osm/
  izvor.json                  datum, licenca, parametri obrade
  vrhovi.json                 vrhovi sa imenom i visinom
  tiles/<x>_<y>.json          okolina, isječena na 2×2 km
  edgeGeometry/<ivica>.json   geometrija svake ivice grafa, i raskrsnice duž nje (`prikljucci`)
scripts/osm/izvjestaj/
  ivice-za-provjeru.md        ivice na kojima se OSM i graf ne slažu
  kicme-kandidati.md          kružni tokovi i raskrsnice po gradovima
```

**Koordinate u izlazu su metri UTM 34N, ne stepeni.** Zona 34 pokriva cijelu
Crnu Goru jednom formulom (`lib/proj.mjs`), pa `proj4` nije potreban. Fajlovi
zato nisu WGS84 GeoJSON i ne treba ih tako učitavati.

## Šta skripta ne radi

Ne mijenja `lib/game/road/roadGraph.ts`. Ako OSM kaže da ivica ide drugim
koridorom nego graf, ili da je dvostruko duža, to ide na spisak za provjeru —
graf je podatak koji unosi škola, a ne nešto što skripta smije da popravi.

## Raskrsnice duž ivice

Raskrsnica u OSM-u nije posebno označena: to je samo čvor koji dijele dva
puta. `lib/prikljucci.mjs` zato uzima svaki čvor rute ivice i gleda njegove
susjede koji nisu na ruti — svaki je jedan sporedni put. Seoski i stambeni
putevi (`sporedni.json`) služe samo za to, u traženje rute ne ulaze.

Nije svaki takav susjed raskrsnica. Izmjereno na svih 54 ivica: od 943 grane
sa krupnijim putevima, 388 je nosilo istu oznaku puta kao sama ruta, a uglovi
su imali tri vrha — oko 90° i blizu 0° i 180°. Ovi drugi su druga kolovozna
traka istog puta i ulivne trake uz nju. Odbacuje se grana sa istom oznakom
puta i jednosmjerna grana skoro paralelna sa rutom. Poslije toga, sa seoskim
putevima: 2718 raskrsnica na 1385 km, jedna na pola kilometra.

## Grad u razmjeri 1:1 (faza 6)

```bash
npm run osm:grad:povuci -- podgorica     # sirovi OSM za okvir grada u .cache/
npm run osm:grad:pripremi -- podgorica   # paket grada u public/data/grad/
npm run osm:grad:linije -- podgorica     # autobuske linije u public/data/grad/linije/
```

Za grad se povlači ono što traži zadatak faze 6 (odjeljak 2): sve ulice
(`highway=*` osim pješačkih staza, stepenica i prolaza kroz parking) sa
oznakama, čvorovi pravila (STOP, „ustupi", semafor, prelaz, usporivač,
stajalište), zgrade, površine i objekti, i radnje (`shop=*`, stavka 8d:
dnevni ciklus ograničava koje su otvorene) — vrsta i radno vrijeme, bez imena.
Okvir grada je u `gradovi.mjs`.

Radnja je u paketu objekat vrste `radnja`, sa radnim vremenom kao podatkom
(„7-22", „8-12,17-21"): iz `opening_hours` kad se da pročitati (`24/7`, ili
rasponi prvog pravila koje nije `off` — igra nema dane u sedmici), inače po
vrsti radnje (`GRAD_RADNJA_VRIJEME`). Pravila su u `lib/game/grad/radnje.ts`,
i čita ih i priprema i igra.

Izlaz je **jedan binarni paket po gradu** (`lib/game/grad/paket.ts`, isti modul
ga piše i čita), sa otiskom sadržaja u imenu: `podgorica-<otisak>.bin`. Mreža
ulica mora biti cijela u memoriji prije vožnje, a stotine malih zahtjeva po
vožnji bi trošile kvotu na Vercel-u — jedan fajl se kešira zauvijek
(`next.config.mjs`). Tile-ovi od 500 m su indeks unutar paketa. Spisak
`gradovi.json` kaže koji je fajl tekući.

Sve se siječe na okvir grada sa rubom od 500 m: Overpass vraća cijelu liniju
koja zalazi u okvir, pa je Morača stigla sa 45 km toka.

`izvjestaj/grad-<grad>.md` pokazuje pokrivenost oznaka (`lanes`, `maxspeed`,
`turn:lanes`…) i povezanost mreže. Šablon zona je u
`public/data/grad/cityZones/<grad>.json`; poligone crta škola u editoru.

**Autobuske linije** (stavka 8) su zaseban, mali JSON, van paketa: relacije
`route=bus` sa brojem linije (`ref`; međugradske bez broja se preskaču) —
ulice-članovi i platforme stajališta, u lokalnim metrima kao paket. Relacije u
OSM-u nijesu uredne (članovi i stajališta van reda, obje varijante trase u
jednoj), pa ih igra ne slaže u putanju od kraja do kraja: od članova pravi
koridor ivica mreže, a autobus vozi dionicu koridora blizu igrača
(`lib/game/grad/autobusi.ts`). Grad bez linija u OSM-u — autobusi po
bulevarima.

Zamka: `lib/geom.mjs` radi nad tačkama `[x, y]`. Dat mu `{x, y}`, računa NaN i od
svake linije ostavi dva kraja — prva obrada je tako izgubila krivine i sve
površine.
