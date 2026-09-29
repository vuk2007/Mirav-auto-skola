/**
 * Overpass upiti.
 *
 * Povlaci se TACNO ono sto je nabrojano u zadatku i nista vise: bez zgrada,
 * bez POI-ja, bez adresa. Svaki upit je zaseban da bi se mogao kesirati,
 * ponoviti i izmjeriti odvojeno — jedan veliki upit koji padne u 90. minuti
 * ne ostavlja nista.
 *
 * Svaki upit prima okvir, jer se veliki dijele na mrezu manjih (`mreza.mjs`).
 */

/** Okvir Crne Gore sa malom rezervom: jug, zapad, sjever, istok. */
export const OKVIR = "41.75,18.30,43.62,20.45";

const RANGOVI = ["motorway", "trunk", "primary", "secondary", "tertiary"];
const VEZE = ["motorway_link", "trunk_link", "primary_link", "secondary_link"];
const NAMJENA = ["forest", "farmland", "vineyard", "residential", "industrial"];

/**
 * Mreza puteva.
 *
 * `out body; >; out skel qt;` daje ivice sa spiskom cvorova I koordinate tih
 * cvorova. Zajednicki cvor je ono sto od gomile linija pravi mrezu po kojoj se
 * moze traziti put — sa `out geom;` bi se dobile iste linije, ali bez ijedne
 * informacije o tome gdje se dodiruju.
 */
export const putevi = (okvir = OKVIR) => `[out:json][timeout:900];
(
${RANGOVI.map((r) => `  way[highway=${r}](${okvir});`).join("\n")}
${VEZE.map((r) => `  way[highway=${r}](${okvir});`).join("\n")}
  way[junction=roundabout](${okvir});
);
out body;
>;
out skel qt;`;

/**
 * Ulice unutar gradova.
 *
 * Ne po cijeloj zemlji nego u krugu oko centara opstina — inace se povuce
 * svaka seoska ulica u drzavi. Krug se zadaje u metrima.
 */
export const ulice = (centri, poluprecnik) => `[out:json][timeout:900];
(
${centri
  .map(
    (c) =>
      `  way[highway~"^(residential|unclassified|living_street)$"](around:${poluprecnik},${c.lat},${c.lon});`,
  )
  .join("\n")}
);
out body;
>;
out skel qt;`;

/**
 * Sporedni putevi po cijeloj zemlji: seoski (`unclassified`) i stambeni
 * (`residential`).
 *
 * Ne ulaze u mrezu za trazenje rute — magistrala se trazi po krupnim putevima —
 * nego sluze samo da se vidi GDJE na magistralu izlazi sporedni put. Bez njih
 * se od raskrsnica vide samo one sa regionalnim putem, jedna na pet i po
 * kilometara, a upravo seoski putevi su ono sto na magistrali stvarno cini
 * raskrsnicu. Prilazni putevi (`service`, `track`) se ne povlace: po zakonu to
 * nije raskrsnica nego prikljucak prilaznog puta.
 */
export const sporedni = (okvir = OKVIR) => `[out:json][timeout:900];
(
  way[highway~"^(unclassified|residential)$"](${okvir});
);
out body;
>;
out skel qt;`;

/** Voda: more, jezera, rijeke. */
export const voda = (okvir = OKVIR) => `[out:json][timeout:900];
(
  way[natural=water](${okvir});
  relation[natural=water](${okvir});
  way[natural=coastline](${okvir});
  way[waterway=river](${okvir});
);
out geom;`;

/** Zelenilo i namjena zemljista. */
export const zelenilo = (okvir = OKVIR) => `[out:json][timeout:900];
(
  way[natural=wood](${okvir});
  relation[natural=wood](${okvir});
${NAMJENA.map((v) => `  way[landuse=${v}](${okvir});\n  relation[landuse=${v}](${okvir});`).join("\n")}
);
out geom;`;

/** Vrhovi sa imenom — za oznake na horizontu i mini mapi. */
export const vrhovi = (okvir = OKVIR) => `[out:json][timeout:300];
node[natural=peak][name](${okvir});
out body;`;

/** Drzavna granica — obris zemlje na mini mapi. */
export const granica = () => `[out:json][timeout:600];
relation["ISO3166-1"="ME"][admin_level=2];
out geom;`;

/*
 * Zasebnog upita za kruzne tokove NEMA namjerno: `putevi` vec povlaci
 * `way[junction=roundabout]` po cijelom okviru, i to sa spiskom cvorova. Time
 * se zna i KOJE se ulice na tom kruznom toku sastaju, sto je za biranje gradske
 * kicme jedino i vazno. `out geom;` bi dao isti prsten bez ijedne veze.
 */
