# Podgorica — provjera mape

## Inženjerski pregled (oktobar 2026)

Pregledana je cijela mreža grada, ne uzorak: 12433 voznih dionica (1034 km), 5022 raskrsnica, 175 raskrsnica na 26 kružnih tokova, 52 semaforisanih raskrsnica, 1147 pješačkih prelaza, 3079 znakova i 195 glava semafora. Mjereno skriptom nad istim modelom po kojem igra crta, sudi i vozi, pa provjereno snimcima iz igre (uzorak od 60 raskrsnica svih vrsta i sva sumnjiva mjesta).

### Šta je bilo pogrešno i ispravljeno je u pravilima (važi za cijeli grad)

| šta | prije | poslije |
|---|---|---|
| Krak ulice bez svog svjetla na semaforisanoj raskrsnici dobijao je trougao „ustupi" (npr. Josipa Broza Tita, V Proleterske, 8. marta) | 14 krakova | semafor (izveden); ustupaju samo prilaz iz dvorišta i priključna traka (slobodno desno) |
| Tercijarna ulica (Bulevar Mitra Bakića, Vlada Ćetkovića…) bez prednosti nad stambenom kad OSM nema znak — pravilo desne strane | 258 raskrsnica | sporedna ustupa, izvedeno (odluka 2026-10-22) |
| Kad OSM ima znak samo na nekim krakovima, svaki krak bez znaka bio je „glavni put" — i sporedna ulica naspram one sa STOP-om | 30 krakova | krak niže klase ustupa, izvedeno |
| Razdjelna linija na dvosmjernim ulicama sa 2+2 i više traka bila je isprekidana kao i linije između traka | 214 dionica, 7 km | dvostruka puna (pravilnik, odluka 2026-10-22) |
| Strelice na kolovozu crtale su se preko zebre i ispred stop-linije | na većini semaforisanih krakova | strelica je uvijek iza linije čekanja i nikad na zebri |
| OSM čvor zebre metar-dva preblizu ušću: kraj zebre na zaobljenom uglu, pa prelaz nije nastao (zebra samo nacrtana, bez pješaka i bez pravila) | 156 zebri (24 na glavnim ulicama) | 44 (5 na glavnim) — zebra se pomjeri duž ulice do 8 m, okomita, nikad u raskrsnicu |
| Dvije OSM zebre na istom ušću pod uglom crtale su se jedna preko druge | 2 | 1 |
| Autobusko stajalište u samoj raskrsnici (u njoj se ne staje) | 22 | 0 — pomjereno duž ulice van raskrsnice |
| Na glavnoj ulici nigdje znak „put sa pravom prvenstva" — vozač ne vidi da ima prednost | 0 znakova | 768 (izvedeni, na prilazu raskrsnici gdje sporedna ulica ima trougao ili STOP) |
| Znak kraka pao na asfalt susjednog ušća, pa prebačen na lijevu stranu ulice | — | stub ide do 15 m unazad duž desne strane prije nego što pređe na lijevu |
| Trougao jednog prilaza i znak glavnog puta drugog na istom stubu | 5 stubova | 0 |

Stanje poslije ispravki: ulazi u raskrsnice desna 13000, semafor 195, glavni 1381, ustupi 959, stop 90; znakova zabranaUlaska 781, ustupi 959, glavni 768, kruzniTok 102, stop 90, no_u_turn 17, only_straight_on 6, no_left_turn 14, no_right_turn 4, only_right_turn 4, stajaliste 334.

### Šta je pregledano, a ispravno je

- Ukrštanja ulica bez čvora na istom nivou: 0. Oštri prelomi osovine van raskrsnica: 6, svi na servisnim i poljskim putevima.
- Kružni tokovi: svih 26 kruži suprotno kazaljci, poluprečnik 8–30 m; prsten svuda ima prednost, svaki ulaz ustupa; zebre nikad preko prstena.
- Semafori: stub nikad na kolovozu; svaki semaforisani prilaz ima svjetlo, stop-liniju i pješačka svjetla; dva jednofazna semafora regulišu dva suprotna prilaza bez poprečnog toka.
- Prelazi: nijedan duži od kolovoza (preko tuđe ulice), nijedan preko prstena; okomiti na ulicu.
- Trotoari: 3 šiljka i 18 tačaka na asfaltu u cijelom gradu (od 28 000 staza).
- Ograničenja brzine iz OSM-a: nijedna besmislena vrijednost po klasi ulice.
- Parovi bliskih raskrsnica na bulevarima (centri < 20 m): uglavnom dvije polovine bulevara sa po jednim prilazom — razdvojene su ispravno (razdjelni pojas).
- Dvosmjerne ulice: razdjelna linija na 6364 dionice (583 km; od toga 171 dionica, 6,7 km, dvostruka puna na 2+2), svuda tačno između traka dva smjera, i kad je broj traka nejednak (pogrešnih 0). Bez linije su samo ulice od 4,5 m u koje dvije trake ne staju: servisni i poljski putevi (323 km), 115 stambenih koje OSM vodi kao jednotračne dvosmjerne (9,7 km) i 5 kratkih priključaka.
- Jednosmjerne ulice: nijedna nema razdjelnu liniju; svaka sa dvije i više traka ima linije između traka (1480 dionica, 98 km). Svaki od 781 prilaza jednosmjerne ulice ka raskrsnici ima znak zabrane ulaska (kod velikih ušća 25–62 m od centra, na samom ulazu u ulicu). Smjer se nigdje ne mijenja usred bloka: nema čvora u koji se samo ulazi ili iz kojeg se samo izlazi.

## Ostaje za editor ili za provjeru na terenu

Ovo su **podaci**, ne pravila — ispravljaju se u editoru grada (`/igra?editor=1`) kad se zna kako je na terenu. Koordinate vode na OpenStreetMap.

### Bulevari kojima je u OSM-u upisano previše traka

Dvije kolovozne trake su bliže nego što traže njihove trake, pa se asfalt preklapa i sa najužom stvarnom trakom (3,25 m). Broj traka treba provjeriti na terenu, pa ga upisati u editoru (dionica → trake).

| ulica | trake | razmak osa / treba | mjesto |
|---|---|---|---|
| V Proleterske brigade | 4 + 2 | 6.8 / 12.8 m | [42.43655, 19.27196](https://www.openstreetmap.org/?mlat=42.43655&mlon=19.27196#map=19/42.43655/19.27196) |
| V Proleterske brigade | 4 + 2 | 6.8 / 12.8 m | [42.43581, 19.27392](https://www.openstreetmap.org/?mlat=42.43581&mlon=19.27392#map=19/42.43581/19.27392) |
| Bulevar knjaza Danila Petrovića | 4 + 3 | 9.8 / 14.9 m | [42.43817, 19.23451](https://www.openstreetmap.org/?mlat=42.43817&mlon=19.23451#map=19/42.43817/19.23451) |
| 13. jula | 3 + 2 | 6.2 / 10.6 m | [42.44568, 19.25677](https://www.openstreetmap.org/?mlat=42.44568&mlon=19.25677#map=19/42.44568/19.25677) |
| Bulevar Šarla de Gola | 3 + 4 | 10.8 / 14.9 m | [42.42027, 19.26537](https://www.openstreetmap.org/?mlat=42.42027&mlon=19.26537#map=19/42.42027/19.26537) |
| Bulevar Šarla de Gola | 3 + 4 | 10.9 / 14.9 m | [42.42096, 19.26598](https://www.openstreetmap.org/?mlat=42.42096&mlon=19.26598#map=19/42.42096/19.26598) |
| Most Blaža Jovanovića | 3 + 2 | 8.3 / 10.6 m | [42.44029, 19.25784](https://www.openstreetmap.org/?mlat=42.44029&mlon=19.25784#map=19/42.44029/19.25784) |
| Bulevar Vilija Branta | 2 + 3 | 8.1 / 10.1 m | [42.46722, 19.29943](https://www.openstreetmap.org/?mlat=42.46722&mlon=19.29943#map=19/42.46722/19.29943) |
| Bulevar Mihaila Lalića | 2 + 2 | 5.4 / 6.5 m | [42.44915, 19.23155](https://www.openstreetmap.org/?mlat=42.44915&mlon=19.23155#map=19/42.44915/19.23155) |
| Nikšićki put | 2 + 2 | 6.0 / 6.9 m | [42.44006, 19.22078](https://www.openstreetmap.org/?mlat=42.44006&mlon=19.22078#map=19/42.44006/19.22078) |

### OSM zebre koje nisu prelaz za pješake

Zebra se crta, ali pješaci njom ne idu i pravila prema pješacima tu se ne sude. Uglavnom je OSM čvor u samom centru male raskrsnice, ili nijedan kraj zebre nema trotoar. Ukupno 44 (bez servisnih ulica).

| ulica | mjesto |
|---|---|
| Jovana Popovića Lipovca (residential) | [42.45166, 19.23731](https://www.openstreetmap.org/?mlat=42.45166&mlon=19.23731#map=19/42.45166/19.23731) |
| Đoka Miraševića (residential) | [42.45311, 19.23849](https://www.openstreetmap.org/?mlat=42.45311&mlon=19.23849#map=19/42.45311/19.23849) |
| Serdara Jola Piletića (secondary) | [42.45227, 19.26019](https://www.openstreetmap.org/?mlat=42.45227&mlon=19.26019#map=19/42.45227/19.26019) |
| (bez imena) (tertiary) | [42.45235, 19.26033](https://www.openstreetmap.org/?mlat=42.45235&mlon=19.26033#map=19/42.45235/19.26033) |
| Milana Kuča (residential) | [42.45011, 19.28342](https://www.openstreetmap.org/?mlat=42.45011&mlon=19.28342#map=19/42.45011/19.28342) |
| Serdara Jola Piletića (secondary) | [42.44861, 19.25885](https://www.openstreetmap.org/?mlat=42.44861&mlon=19.25885#map=19/42.44861/19.25885) |
| (bez imena) (residential) | [42.44552, 19.26331](https://www.openstreetmap.org/?mlat=42.44552&mlon=19.26331#map=19/42.44552/19.26331) |
| (bez imena) (residential) | [42.44967, 19.26231](https://www.openstreetmap.org/?mlat=42.44967&mlon=19.26231#map=19/42.44967/19.26231) |
| (bez imena) (residential) | [42.44674, 19.28486](https://www.openstreetmap.org/?mlat=42.44674&mlon=19.28486#map=19/42.44674/19.28486) |
| Miloja Pavlovića (residential) | [42.44385, 19.20794](https://www.openstreetmap.org/?mlat=42.44385&mlon=19.20794#map=19/42.44385/19.20794) |
| Miloja Pavlovića (residential) | [42.44385, 19.20809](https://www.openstreetmap.org/?mlat=42.44385&mlon=19.20809#map=19/42.44385/19.20809) |
| (bez imena) (residential) | [42.44403, 19.20707](https://www.openstreetmap.org/?mlat=42.44403&mlon=19.20707#map=19/42.44403/19.20707) |
| (bez imena) (residential) | [42.44119, 19.21469](https://www.openstreetmap.org/?mlat=42.44119&mlon=19.21469#map=19/42.44119/19.21469) |
| 19. Decembra (residential) | [42.44537, 19.26361](https://www.openstreetmap.org/?mlat=42.44537&mlon=19.26361#map=19/42.44537/19.26361) |
| 19. Decembra (residential) | [42.44540, 19.26359](https://www.openstreetmap.org/?mlat=42.44540&mlon=19.26359#map=19/42.44540/19.26359) |
| (bez imena) (residential) | [42.44533, 19.26303](https://www.openstreetmap.org/?mlat=42.44533&mlon=19.26303#map=19/42.44533/19.26303) |
| (bez imena) (residential) | [42.44525, 19.26304](https://www.openstreetmap.org/?mlat=42.44525&mlon=19.26304#map=19/42.44525/19.26304) |
| (bez imena) (residential) | [42.44552, 19.26325](https://www.openstreetmap.org/?mlat=42.44552&mlon=19.26325#map=19/42.44552/19.26325) |
| (bez imena) (residential) | [42.44508, 19.26334](https://www.openstreetmap.org/?mlat=42.44508&mlon=19.26334#map=19/42.44508/19.26334) |
| (bez imena) (residential) | [42.44510, 19.26341](https://www.openstreetmap.org/?mlat=42.44510&mlon=19.26341#map=19/42.44510/19.26341) |
| Ulcinjska (residential) | [42.44149, 19.27426](https://www.openstreetmap.org/?mlat=42.44149&mlon=19.27426#map=19/42.44149/19.27426) |
| Kragujevačka (residential) | [42.43928, 19.21798](https://www.openstreetmap.org/?mlat=42.43928&mlon=19.21798#map=19/42.43928/19.21798) |
| Petra Sinanovića Nagiba (residential) | [42.43776, 19.23295](https://www.openstreetmap.org/?mlat=42.43776&mlon=19.23295#map=19/42.43776/19.23295) |
| Vojvode Maša Đurovića (residential) | [42.43969, 19.23192](https://www.openstreetmap.org/?mlat=42.43969&mlon=19.23192#map=19/42.43969/19.23192) |
| Vojvode Maša Đurovića (residential) | [42.43972, 19.23190](https://www.openstreetmap.org/?mlat=42.43972&mlon=19.23190#map=19/42.43972/19.23190) |
| Petra Sinanovića Nagiba (residential) | [42.43948, 19.23183](https://www.openstreetmap.org/?mlat=42.43948&mlon=19.23183#map=19/42.43948/19.23183) |
| Petra Sinanovića Nagiba (residential) | [42.43947, 19.23179](https://www.openstreetmap.org/?mlat=42.43947&mlon=19.23179#map=19/42.43947/19.23179) |
| Vladike Visariona Borilovića (residential) | [42.43982, 19.23681](https://www.openstreetmap.org/?mlat=42.43982&mlon=19.23681#map=19/42.43982/19.23681) |
| Buta Lekića (residential) | [42.43712, 19.26842](https://www.openstreetmap.org/?mlat=42.43712&mlon=19.26842#map=19/42.43712/19.26842) |
| Dragomira Dragog Čejovića (residential) | [42.43709, 19.27063](https://www.openstreetmap.org/?mlat=42.43709&mlon=19.27063#map=19/42.43709/19.27063) |
| Žrtava fašizma (residential) | [42.43790, 19.28164](https://www.openstreetmap.org/?mlat=42.43790&mlon=19.28164#map=19/42.43790/19.28164) |
| (bez imena) (residential) | [42.43425, 19.26460](https://www.openstreetmap.org/?mlat=42.43425&mlon=19.26460#map=19/42.43425/19.26460) |
| (bez imena) (residential) | [42.43190, 19.25020](https://www.openstreetmap.org/?mlat=42.43190&mlon=19.25020#map=19/42.43190/19.25020) |
| (bez imena) (residential) | [42.43184, 19.25010](https://www.openstreetmap.org/?mlat=42.43184&mlon=19.25010#map=19/42.43184/19.25010) |
| (bez imena) (residential) | [42.43194, 19.25011](https://www.openstreetmap.org/?mlat=42.43194&mlon=19.25011#map=19/42.43194/19.25011) |
| Bulevar 21. maj (primary) | [42.42507, 19.21856](https://www.openstreetmap.org/?mlat=42.42507&mlon=19.21856#map=19/42.42507/19.21856) |
| Bulevar 21. maj (primary) | [42.42502, 19.21861](https://www.openstreetmap.org/?mlat=42.42502&mlon=19.21861#map=19/42.42502/19.21861) |
| (bez imena) (residential) | [42.42755, 19.25178](https://www.openstreetmap.org/?mlat=42.42755&mlon=19.25178#map=19/42.42755/19.25178) |
| (bez imena) (residential) | [42.42593, 19.24857](https://www.openstreetmap.org/?mlat=42.42593&mlon=19.24857#map=19/42.42593/19.24857) |
| Kozaračka (residential) | [42.42511, 19.26879](https://www.openstreetmap.org/?mlat=42.42511&mlon=19.26879#map=19/42.42511/19.26879) |
| Petra Dedića (residential) | [42.42347, 19.27364](https://www.openstreetmap.org/?mlat=42.42347&mlon=19.27364#map=19/42.42347/19.27364) |
| Arhonta Petra (residential) | [42.41956, 19.20967](https://www.openstreetmap.org/?mlat=42.41956&mlon=19.20967#map=19/42.41956/19.20967) |
| Vladike Ruvima II Boljevića (residential) | [42.41930, 19.20924](https://www.openstreetmap.org/?mlat=42.41930&mlon=19.20924#map=19/42.41930/19.20924) |
| (bez imena) (residential) | [42.42258, 19.21492](https://www.openstreetmap.org/?mlat=42.42258&mlon=19.21492#map=19/42.42258/19.21492) |

### Linija „ustupi" na ulazu u parking umjesto na bulevaru

Prilaz parkingu je tik uz raskrsnicu bulevara, pa ga model pripaja raskrsnici: sporedna ulica ustupa već kod prilaza, desetak metara prije bulevara. Pravilo je dosljedno (i bot i drugi vozači tako voze), ali izgleda neobično. Rješava se u editoru (kontrola kraka) ili kasnijom promjenom grupisanja raskrsnica.

| ulica | mjesto |
|---|---|
| Arhonta Petra | [42.41959, 19.20963](https://www.openstreetmap.org/?mlat=42.41959&mlon=19.20963#map=19/42.41959/19.20963) |
| Evropska | [42.42881, 19.23206](https://www.openstreetmap.org/?mlat=42.42881&mlon=19.23206#map=19/42.42881/19.23206) |
| Miladina Popovića | [42.41814, 19.25246](https://www.openstreetmap.org/?mlat=42.41814&mlon=19.25246#map=19/42.41814/19.25246) |
| Vladike Ruvima II Boljevića | [42.41930, 19.20921](https://www.openstreetmap.org/?mlat=42.41930&mlon=19.20921#map=19/42.41930/19.20921) |
| (bez imena) | [42.42257, 19.21497](https://www.openstreetmap.org/?mlat=42.42257&mlon=19.21497#map=19/42.42257/19.21497) |
| Petra Sinanovića Nagiba | [42.43784, 19.23290](https://www.openstreetmap.org/?mlat=42.43784&mlon=19.23290#map=19/42.43784/19.23290) |
| Jaglike Adžić | [42.44086, 19.24129](https://www.openstreetmap.org/?mlat=42.44086&mlon=19.24129#map=19/42.44086/19.24129) |
| Filipa Lainovića | [42.42666, 19.25804](https://www.openstreetmap.org/?mlat=42.42666&mlon=19.25804#map=19/42.42666/19.25804) |
| (bez imena) | [42.43420, 19.26457](https://www.openstreetmap.org/?mlat=42.43420&mlon=19.26457#map=19/42.43420/19.26457) |
| Milana Kuča | [42.45014, 19.28333](https://www.openstreetmap.org/?mlat=42.45014&mlon=19.28333#map=19/42.45014/19.28333) |
| (bez imena) | [42.46989, 19.25854](https://www.openstreetmap.org/?mlat=42.46989&mlon=19.25854#map=19/42.46989/19.25854) |

### Ulice do kojih se autom ne može doći (ili iz njih izaći)

Do 3,5 km od centra. Vjerovatno pogrešan smjer jednosmjerne ulice, ili veza koja u OSM-u nije vozna; navigacija i bot ih zaobilaze.

| ulica | dužina | mjesto |
|---|---|---|
| Bokeška | 7 m | [42.44150, 19.26362](https://www.openstreetmap.org/?mlat=42.44150&mlon=19.26362#map=19/42.44150/19.26362) |

### Zgrade koje i poslije odmicanja zalaze na kolovoz više od 2 m

Uglavnom prolaz kroz zgradu (servisni put) ili netačna linija ulice. Ukupno 71 zgrada zalazi više od 1 m (od 33 833).

| koliko | ulica | mjesto |
|---|---|---|
| 6.4 m | motorway_link | [42.47270, 19.29909](https://www.openstreetmap.org/?mlat=42.47270&mlon=19.29909#map=19/42.47270/19.29909) |
| 4.2 m | residential | [42.44792, 19.29762](https://www.openstreetmap.org/?mlat=42.44792&mlon=19.29762#map=19/42.44792/19.29762) |
| 4.1 m | residential | [42.45563, 19.29361](https://www.openstreetmap.org/?mlat=42.45563&mlon=19.29361#map=19/42.45563/19.29361) |
| 4.1 m | residential | [42.42252, 19.22906](https://www.openstreetmap.org/?mlat=42.42252&mlon=19.22906#map=19/42.42252/19.22906) |
| 4 m | residential | [42.39764, 19.19964](https://www.openstreetmap.org/?mlat=42.39764&mlon=19.19964#map=19/42.39764/19.19964) |
| 3.9 m | Fruškogorska | [42.44864, 19.25055](https://www.openstreetmap.org/?mlat=42.44864&mlon=19.25055#map=19/42.44864/19.25055) |
| 3.8 m | service | [42.45611, 19.28864](https://www.openstreetmap.org/?mlat=42.45611&mlon=19.28864#map=19/42.45611/19.28864) |
| 2.8 m | Milana Raičkovića | [42.45649, 19.22253](https://www.openstreetmap.org/?mlat=42.45649&mlon=19.22253#map=19/42.45649/19.22253) |
| 2.8 m | service | [42.44420, 19.25376](https://www.openstreetmap.org/?mlat=42.44420&mlon=19.25376#map=19/42.44420/19.25376) |
| 2.6 m | residential | [42.45049, 19.25804](https://www.openstreetmap.org/?mlat=42.45049&mlon=19.25804#map=19/42.45049/19.25804) |
| 2.5 m | residential | [42.41942, 19.20084](https://www.openstreetmap.org/?mlat=42.41942&mlon=19.20084#map=19/42.41942/19.20084) |
| 2.3 m | service | [42.48414, 19.30580](https://www.openstreetmap.org/?mlat=42.48414&mlon=19.30580#map=19/42.48414/19.30580) |
| 2.3 m | service | [42.46982, 19.25805](https://www.openstreetmap.org/?mlat=42.46982&mlon=19.25805#map=19/42.46982/19.25805) |
| 2.3 m | service | [42.46835, 19.29976](https://www.openstreetmap.org/?mlat=42.46835&mlon=19.29976#map=19/42.46835/19.29976) |
| 2.3 m | service | [42.46330, 19.29422](https://www.openstreetmap.org/?mlat=42.46330&mlon=19.29422#map=19/42.46330/19.29422) |

### Mjesta koja je našao saobraćaj (bot i drugi vozači)

- Kralja Nikole × Gojka Radonjića — oštro desno (116°) u usku ulicu bez luka na asfaltu: [42.43708, 19.26127](https://www.openstreetmap.org/?mlat=42.43708&mlon=19.26127#map=19/42.43708/19.26127)
- Đulje Jovanova — jedna velika raskrsnica u OSM-u su tri tik jedna uz drugu: [42.44707, 19.28463](https://www.openstreetmap.org/?mlat=42.44707&mlon=19.28463#map=19/42.44707/19.28463)
- Bulevar Mihaila Lalića kod Bloka 5 — biciklistička staza bliža od kolovoza (klik u editoru je hvata): [42.44453, 19.24327](https://www.openstreetmap.org/?mlat=42.44453&mlon=19.24327#map=19/42.44453/19.24327)
- Raskrsnica na Y kod (-2128, 1228) — sudar u fuzzu (sjeme 2, ruta 73): [42.42985, 19.23735](https://www.openstreetmap.org/?mlat=42.42985&mlon=19.23735#map=19/42.42985/19.23735)
- Spomenik poginulim borcima NOR-a radnicima Monopola duvana — do odredišta nema rute sa svih strana
