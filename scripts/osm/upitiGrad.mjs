/**
 * Overpass upiti za GRAD (faza 6): sve ulice, zgrade, površine i objekti.
 *
 * Za razliku od `upiti.mjs` (putevi između gradova, okolina), ovdje se povlači
 * sve što treba da bi se gradom vozilo bilo kojom ulicom i da bi izgledao kao
 * grad. Spisak je iz zadatka, odjeljak 2 — ništa više: bez adresa, bez
 * radnji, bez imena stambenih zgrada.
 *
 * Svaki upit prima okvir („jug,zapad,sjever,istok"), jer se dijeli na mrežu
 * manjih (`lib/mreza.mjs`).
 */

/**
 * Ulice: sve `highway=*` osim pješačkih i biciklističkih staza, stepenica i
 * prolaza kroz parking — tako kaže zadatak. Pored toga se ne povlači ni ono što
 * nije ulica: put u izgradnji, planiran put, peron, lift, trkalište.
 */
export const ULICE_BEZ = [
  "footway",
  "path",
  "steps",
  "bridleway",
  "corridor",
  "construction",
  "proposed",
  "platform",
  "elevator",
  "raceway",
  "abandoned",
  "disused",
  "razed",
  "via_ferrata",
];

/**
 * Ulice sa svim oznakama, plus čvorovi kroz koje prolaze.
 *
 * `out body; >; out skel qt;` — ivice sa spiskom čvorova, pa koordinate tih
 * čvorova: zajednički čvor je ono što od linija pravi mrežu. `service` sa
 * `parking_aisle` se izbacuje posebnim filterom, jer se odnosi samo na
 * `service`.
 */
export const ulice = (okvir) => `[out:json][timeout:900];
(
  way[highway][highway!~"^(${ULICE_BEZ.join("|")})$"][service!=parking_aisle](${okvir});
);
out body;
>;
out skel qt;`;

/**
 * Čvorovi pravila i stajališta: znak STOP i „ustupi prvenstvo", semafor,
 * pješački prelaz, usporivač, autobusko stajalište. Sa svim oznakama — smjer
 * znaka (`direction`), vrsta prelaza (`crossing`).
 */
export const pravila = (okvir) => `[out:json][timeout:600];
(
  node[highway~"^(stop|give_way|traffic_signals|crossing|bus_stop)$"](${okvir});
  node[traffic_calming](${okvir});
  node[crossing](${okvir});
  node[public_transport=platform][bus=yes](${okvir});
);
out body;`;

/**
 * Zabrane skretanja: relacije `type=restriction` (sa puta, preko čvora, na
 * put). Samo članovi po id-u — geometriju puteva već imaju `ulice`.
 */
export const zabrane = (okvir) => `[out:json][timeout:600];
(
  relation[type=restriction](${okvir});
);
out body;`;

/**
 * Zgrade: oblik, spratnost, visina. Ime samo za javne — škole, bolnice,
 * tržne centre, stadion, pozorište — i to se bira pri obradi, ne ovdje.
 */
export const zgrade = (okvir) => `[out:json][timeout:900];
(
  way[building](${okvir});
  relation[building](${okvir});
);
out geom;`;

/**
 * Površine: parkovi, trgovi, parkinzi, škole, voda, mostovi, pruga, i ono od
 * čega se sastoji grad između ulica (namjena zemljišta).
 */
export const povrsine = (okvir) => `[out:json][timeout:900];
(
  way[leisure~"^(park|garden|playground|pitch|stadium|sports_centre)$"](${okvir});
  relation[leisure~"^(park|garden|stadium)$"](${okvir});
  way[place=square](${okvir});
  way[highway=pedestrian][area=yes](${okvir});
  way[amenity~"^(parking|school|college|university|hospital|kindergarten)$"](${okvir});
  relation[amenity~"^(parking|school|college|university|hospital)$"](${okvir});
  way[natural~"^(water|wood|scrub|grassland)$"](${okvir});
  relation[natural=water](${okvir});
  way[waterway~"^(river|riverbank|stream|canal)$"](${okvir});
  relation[waterway~"^(river|riverbank)$"](${okvir});
  way[water=river](${okvir});
  way[landuse~"^(grass|forest|meadow|residential|commercial|retail|industrial|cemetery|railway|farmland|orchard|vineyard)$"](${okvir});
  relation[landuse~"^(forest|residential|commercial|retail|industrial|cemetery)$"](${okvir});
  way[man_made=bridge](${okvir});
  way[railway~"^(rail|light_rail)$"](${okvir});
);
out geom;`;

/**
 * Objekti: benzinska pumpa, drvored, stadion, bogomolja. Stajališta dolaze
 * kroz `pravila`, a drveće u parkovima se rasipa po sjemenu, ne iz OSM-a.
 */
export const objekti = (okvir) => `[out:json][timeout:600];
(
  node[amenity~"^(fuel|place_of_worship)$"](${okvir});
  way[amenity~"^(fuel|place_of_worship)$"](${okvir});
  way[natural=tree_row](${okvir});
  way[leisure=stadium](${okvir});
);
out geom;`;
