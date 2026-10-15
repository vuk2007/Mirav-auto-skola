# Podgorica — paket grada

Okvir upita 42.395,19.195,42.485,19.315; stanje baze 2026-10-15T14:30:11Z. Paket `podgorica-d06f433704.bin`: 2.87 MB, 441 tile-ova po 500 m (21 × 21).

| | broj | napomena |
|---|---|---|
| OSM puteva (ulica) | 7494 | bez čvora u odgovoru: 0 |
| ivica mreže | 13088 | vozne autom: 12433 |
| čvorova mreže | 10961 | |
| komponenti vozne mreže | 26 | najveća 12374 ivica (99.5 %) |
| zgrada | 33833 | sa spratnošću 1 %, sa visinom 0 %, sa imenom (javne) 62 |
| površina | 1207 | voda 10, most 11, stadion 6, park 28, igraliste 175, trg 12, parking 274, skola 47, bolnica 6, suma 80, trava 205, groblje 7, poslovno 14, industrija 31, stambeno 282, njiva 19 |
| linija | 160 | rijeka 15, kanal 0, potok 8, pruga 133, drvored 4 |
| objekata | 3624 | stop 110, give_way 80, traffic_signals 190, crossing 1974, bus_stop 354, traffic_calming 96, fuel 25, place_of_worship 18, radnja 777 |

Oznake na ulicama (udio OSM puteva):

- sve ulice: `lanes` 30 %, `maxspeed` 16 %, `oneway` 25 %, `turn:lanes` 9 %, `name` 33 %
- glavne (trunk…tertiary, 1501): `lanes` 98 %, `maxspeed` 62 %, jednosmjerne 66 %
- `priority_road` na putevima: 0

Mjesto objekata pravila u mreži (znak, semafor, prelaz, usporivač): na ivici 2011, u čvoru mreže 338, van vozne mreže 101.

Raskrsnice: 5022 (od više čvorova 650, sa semaforom 52, kružnih 175). **Izvedeno:** prioritet u 478, faze semafora u 52.

Ulazi u raskrsnice po kontroli: desna (pravilo) 13838, glavni (izvedeno) 664, ustupi (izvedeno) 544, glavni (osm) 235, semafor (osm) 184, stop (osm) 88, ustupi (osm) 70, stop (izvedeno) 2

Zabrane skretanja: uzeto 45; preko puta (ne čvora, za sada bez suda) 11; ne važe za auto 0; van mreže 1; bez vrste ili članova 1.

Klase: motorway 14, primary 890, secondary 773, tertiary 607, motorway_link 19, primary_link 20, secondary_link 10, unclassified 246, residential 6207, service 3204, track 552, pedestrian 52, cycleway 494
