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
