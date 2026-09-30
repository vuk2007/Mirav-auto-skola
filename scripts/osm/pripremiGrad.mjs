/**
 * Obrada grada (faza 6): sirovi OSM iz `.cache/` → paket grada u
 * `public/data/grad/`.
 *
 * Pokretanje: `npm run osm:grad:pripremi -- podgorica`, poslije
 * `osm:grad:povuci`. Ručno, nikad u build-u.
 *
 * Šta radi:
 *  - ulice: svaki OSM put se reže na čvorovima u kojima se dodiruje sa drugim
 *    putem — to su raskrsnice — pa nastaje mreža ivica po kojoj se vozi;
 *  - zgrade, površine, linije i objekti: oblik u lokalnim metrima, i tile od
 *    500 m u koji spadaju (po težištu);
 *  - izvještaj: pokrivenost oznaka i povezanost mreže, da se vidi šta OSM zna,
 *    a šta će morati da se doda u editoru.
 *
 * Ništa se ne pogađa: kad OSM nema broj traka ili ograničenje, u paket ide
 * nula, a igra zna šta znači „nepoznato". Pravila iz toga izvodi tek generički
 * sud (stavka 5), sa zastavicom da je izvedeno.
 *
 * Podaci: © OpenStreetMap contributors, ODbL.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { KES } from "./lib/overpass.mjs";
import { uMetre } from "./lib/proj.mjs";
import { uprosti as uprostiNiz } from "./lib/geom.mjs";
import { iseciLiniju, iseciPoligon } from "./lib/iseci.mjs";
import { GRADOVI } from "./gradovi.mjs";
import { ULICE_BEZ } from "./upitiGrad.mjs";
import {
  IVICA_KRUZNI,
  IVICA_MOST,
  IVICA_TUNEL,
  IVICA_VOZNA,
  NIZOVI,
  zapisi,
} from "../../lib/game/grad/paket.ts";

const OVDJE = dirname(fileURLToPath(import.meta.url));
const KORIJEN = join(OVDJE, "..", "..");
const IZLAZ = join(KORIJEN, "public", "data", "grad");

/** Stranica tile-a [m] — iz zadatka: gradovi 500 × 500 m. */
const TILE = 500;
/** Uprošćavanje ulica [m] — manje od pola širine trake, pa se ne vidi. */
const UPROSTI_ULICE = 0.3;
/** Uprošćavanje površina [m]; zgrade se ne uprošćavaju — imaju malo tačaka. */
const UPROSTI_POVRSINE = 0.5;

/**
 * Klase ulica, od najveće ka najmanjoj — redni broj je kod u paketu. Klasa
 * koje ovdje nema ide na kraj, abecedno, pa je paket isti pri svakoj obradi.
 */
const KLASE = [
  "motorway", "trunk", "primary", "secondary", "tertiary",
  "motorway_link", "trunk_link", "primary_link", "secondary_link", "tertiary_link",
  "unclassified", "residential", "living_street", "service", "road", "track",
  "busway", "bus_guideway", "pedestrian", "cycleway",
];

/**
 * Autom se ne vozi: pješačka zona, biciklistička staza, traka samo za autobuse.
 * `access=no` i `motor_vehicle=no` zatvaraju i svaku drugu.
 */
const NE_ZA_AUTA = new Set(["pedestrian", "cycleway", "busway", "bus_guideway"]);

/** Javne zgrade čije ime ide u paket — zadatak: škole, bolnice, tržni centri, stadion, pozorište. */
const JAVNE_ZGRADE = new Set([
  "school", "university", "college", "kindergarten", "hospital", "stadium", "theatre",
  "church", "cathedral", "mosque", "synagogue", "government", "civic", "public",
  "train_station", "transportation", "museum",
]);
const JAVNE_USTANOVE = new Set([
  "school", "college", "university", "kindergarten", "hospital", "clinic", "theatre", "cinema",
  "townhall", "courthouse", "library", "place_of_worship", "police", "fire_station",
  "post_office", "bus_station", "arts_centre",
]);

/** Površine: vrsta po oznakama, prva koja se poklopi. */
const VRSTE_POVRSINA = [
  ["voda", (t) => t.natural === "water" || t.waterway === "riverbank" || t.water === "river"],
  ["most", (t) => t.man_made === "bridge"],
  ["stadion", (t) => t.leisure === "stadium"],
  ["park", (t) => t.leisure === "park" || t.leisure === "garden"],
  ["igraliste", (t) => ["playground", "pitch", "sports_centre"].includes(t.leisure)],
  ["trg", (t) => t.place === "square" || (t.highway === "pedestrian" && t.area === "yes")],
  ["parking", (t) => t.amenity === "parking"],
  ["skola", (t) => ["school", "college", "university", "kindergarten"].includes(t.amenity)],
  ["bolnica", (t) => t.amenity === "hospital"],
  ["suma", (t) => t.natural === "wood" || t.landuse === "forest"],
  ["trava", (t) => ["grass", "meadow"].includes(t.landuse) || ["grassland", "scrub"].includes(t.natural)],
  ["groblje", (t) => t.landuse === "cemetery"],
  ["poslovno", (t) => ["commercial", "retail"].includes(t.landuse)],
  ["industrija", (t) => ["industrial", "railway"].includes(t.landuse)],
  ["stambeno", (t) => t.landuse === "residential"],
  ["njiva", (t) => ["farmland", "orchard", "vineyard"].includes(t.landuse)],
];

/** Linije: vrsta i širina [m] kad OSM ne kaže `width`. */
const VRSTE_LINIJA = [
  ["rijeka", (t) => t.waterway === "river", 20],
  ["kanal", (t) => t.waterway === "canal", 5],
  ["potok", (t) => t.waterway === "stream", 2],
  ["pruga", (t) => t.railway === "rail" || t.railway === "light_rail", 1.5],
  ["drvored", (t) => t.natural === "tree_row", 4],
];

const VRSTE_OBJEKATA = [
  "stop", "give_way", "traffic_signals", "crossing", "bus_stop", "traffic_calming", "fuel", "place_of_worship",
];

// ── pomagala ────────────────────────────────────────────────────────────────

/**
 * Douglas–Peucker nad tačkama `{x, y}`. `geom.mjs` radi nad `[x, y]`; dat mu
 * objekat, računa rastojanja kao NaN i od svake linije ostavi samo dva kraja —
 * prva obrada je tako ispravila svaku krivinu u gradu i izgubila sve površine.
 */
const uprosti = (tacke, tol) => uprostiNiz(tacke.map((p) => [p.x, p.y]), tol).map(([x, y]) => ({ x, y }));

const broj = (s) => {
  if (s === undefined) return null;
  const m = /^\s*(\d+(?:[.,]\d+)?)/.exec(String(s));
  return m ? Number(m[1].replace(",", ".")) : null;
};

async function ucitaj(kljuc, ime) {
  const put = join(KES, `grad-${kljuc}-${ime}.json`);
  if (!existsSync(put)) throw new Error(`nema ${put} — prvo npm run osm:grad:povuci -- ${kljuc}`);
  return JSON.parse(await readFile(put, "utf8")).elements;
}

/** Tabela stringova: isti tekst dobija isti broj, 0 je prazan. */
function tabela() {
  const niz = [""];
  const mapa = new Map([["", 0]]);
  return {
    niz,
    kod(s) {
      if (!s) return 0;
      let k = mapa.get(s);
      if (k === undefined) {
        k = niz.length;
        niz.push(s);
        mapa.set(s, k);
      }
      return k;
    },
  };
}

/**
 * Spoji dijelove prstena (članove relacije) u zatvorene prstenove, po
 * zajedničkim krajevima. Dio koji se ne može zatvoriti se odbacuje — to je
 * relacija koja izlazi iz okvira upita.
 */
function spojiPrstenove(dijelovi) {
  const kljuc = (p) => `${p.lat.toFixed(7)},${p.lon.toFixed(7)}`;
  const ostalo = dijelovi.filter((d) => d.length >= 2).map((d) => [...d]);
  const out = [];
  while (ostalo.length > 0) {
    let prsten = ostalo.shift();
    let promjena = true;
    while (kljuc(prsten[0]) !== kljuc(prsten[prsten.length - 1]) && promjena) {
      promjena = false;
      for (let i = 0; i < ostalo.length; i++) {
        const d = ostalo[i];
        const kraj = kljuc(prsten[prsten.length - 1]);
        if (kljuc(d[0]) === kraj) prsten = [...prsten, ...d.slice(1)];
        else if (kljuc(d[d.length - 1]) === kraj) prsten = [...prsten, ...[...d].reverse().slice(1)];
        else continue;
        ostalo.splice(i, 1);
        promjena = true;
        break;
      }
    }
    if (prsten.length >= 4 && kljuc(prsten[0]) === kljuc(prsten[prsten.length - 1])) out.push(prsten);
  }
  return out;
}

/** Spoljni prstenovi elementa sa `out geom` (put ili relacija). */
function prstenovi(el) {
  if (el.type === "way") {
    const g = el.geometry ?? [];
    if (g.length >= 4 && g[0].lat === g[g.length - 1].lat && g[0].lon === g[g.length - 1].lon) return [g];
    return [];
  }
  if (el.type === "relation") {
    const spolja = (el.members ?? []).filter((m) => m.type === "way" && m.role !== "inner" && m.geometry);
    return spojiPrstenove(spolja.map((m) => m.geometry));
  }
  return [];
}

// ── glavno ──────────────────────────────────────────────────────────────────

const kljucGrada = process.argv[2];
const grad = GRADOVI[kljucGrada];
if (!grad) {
  console.error(`Nepoznat grad „${kljucGrada}". Poznati: ${Object.keys(GRADOVI).join(", ")}`);
  process.exit(1);
}

const izvor = JSON.parse(await readFile(join(KES, `grad-${kljucGrada}-izvor.json`), "utf8"));
const o = uMetre(grad.centar.lat, grad.centar.lon);
/** Lokalni metri: `x` na istok, `y` na JUG — kao u ostatku igre. */
const lok = (lat, lon) => {
  const m = uMetre(lat, lon);
  return { x: m.x - o.x, y: o.y - m.y };
};

const [ju, za, se, is] = grad.okvir.split(",").map(Number);
const uglovi = [lok(ju, za), lok(ju, is), lok(se, za), lok(se, is)];
const okvir = {
  minX: Math.floor(Math.min(...uglovi.map((p) => p.x))),
  minY: Math.floor(Math.min(...uglovi.map((p) => p.y))),
  maxX: Math.ceil(Math.max(...uglovi.map((p) => p.x))),
  maxY: Math.ceil(Math.max(...uglovi.map((p) => p.y))),
};
/**
 * Sve se siječe na okvir grada sa ovim rubom [m]. Overpass vraća CIJELU liniju
 * koja zalazi u okvir — Morača je stigla sa četrdeset pet kilometara toka — a
 * igra od toga vidi samo grad.
 */
const RUB_OKVIRA = 500;
const rez = [okvir.minX - RUB_OKVIRA, okvir.minY - RUB_OKVIRA, okvir.maxX + RUB_OKVIRA, okvir.maxY + RUB_OKVIRA];
const uRezu = (p) => p.x >= rez[0] && p.x <= rez[2] && p.y >= rez[1] && p.y <= rez[3];
const naNiz = (t) => t.map((p) => [p.x, p.y]);
const odNiza = (t) => t.map(([x, y]) => ({ x, y }));

const tileovaX = Math.ceil((okvir.maxX - okvir.minX) / TILE);
const tileovaY = Math.ceil((okvir.maxY - okvir.minY) / TILE);
const brojTileova = tileovaX * tileovaY;
/** Tile u kome je tačka; tačke van okvira idu u najbliži rubni. */
const tileZa = (p) => {
  const tx = Math.min(tileovaX - 1, Math.max(0, Math.floor((p.x - okvir.minX) / TILE)));
  const ty = Math.min(tileovaY - 1, Math.max(0, Math.floor((p.y - okvir.minY) / TILE)));
  return ty * tileovaX + tx;
};
const teziste = (tacke) => ({
  x: tacke.reduce((a, p) => a + p.x, 0) / tacke.length,
  y: tacke.reduce((a, p) => a + p.y, 0) / tacke.length,
});

const stringovi = tabela();
const izvj = [];

// ── ulice ───────────────────────────────────────────────────────────────────

const uliceEl = await ucitaj(kljucGrada, "ulice");
const cvoroviOsm = new Map();
for (const el of uliceEl) if (el.type === "node") cvoroviOsm.set(el.id, el);
const putevi = uliceEl.filter(
  (el) => el.type === "way" && el.tags?.highway && !ULICE_BEZ.includes(el.tags.highway) && el.tags.service !== "parking_aisle",
);

// Čvor postaje raskrsnica (čvor mreže) kad ga dijele dva puta, ili kad je kraj
// puta. Zatvoren put (kružni tok) ima isti čvor na početku i kraju — broji se
// jednom.
const upotreba = new Map();
for (const w of putevi) {
  const jedinstveni = new Set(w.nodes);
  for (const id of jedinstveni) upotreba.set(id, (upotreba.get(id) ?? 0) + 1);
}
const jeCvor = (w, i) => i === 0 || i === w.nodes.length - 1 || (upotreba.get(w.nodes[i]) ?? 0) >= 2;

const cvorIndeks = new Map();
const cvXY = [];
const cvorZa = (osmId) => {
  let i = cvorIndeks.get(osmId);
  if (i === undefined) {
    const n = cvoroviOsm.get(osmId);
    const p = lok(n.lat, n.lon);
    i = cvXY.length / 2;
    cvXY.push(p.x, p.y);
    cvorIndeks.set(osmId, i);
  }
  return i;
};

const klaseSve = [...new Set(putevi.map((w) => w.tags.highway))];
const klase = [...KLASE.filter((k) => klaseSve.includes(k)), ...klaseSve.filter((k) => !KLASE.includes(k)).sort()];

const iv = {
  A: [], B: [], Od: [0], XY: [], Klasa: [], Smjer: [], Trake: [], TrakeNaprijed: [], TrakeNazad: [],
  Brzina: [], Zastavice: [], Sloj: [], Ime: [], TrakeSkretanja: [], TrakeSkretanjaNazad: [], Osm: [],
};
let bezCvora = 0;
for (const w of putevi) {
  if (w.nodes.some((id) => !cvoroviOsm.has(id))) {
    bezCvora += 1;
    continue;
  }
  const t = w.tags;
  const kruzni = t.junction === "roundabout" || t.junction === "circular";
  let smjer = 0;
  if (["yes", "true", "1"].includes(t.oneway)) smjer = 1;
  else if (t.oneway === "-1" || t.oneway === "reverse") smjer = -1;
  else if (t.oneway !== "no" && (kruzni || t.highway === "motorway")) smjer = 1;
  const vozna =
    !NE_ZA_AUTA.has(t.highway) && t.access !== "no" && t.access !== "private" && t.motor_vehicle !== "no" && t.motorcar !== "no";
  const zastavice =
    (kruzni ? IVICA_KRUZNI : 0) |
    (t.bridge && t.bridge !== "no" ? IVICA_MOST : 0) |
    (t.tunnel && t.tunnel !== "no" ? IVICA_TUNEL : 0) |
    (vozna ? IVICA_VOZNA : 0);
  const brzina = broj(t.maxspeed);

  // Put se reže na svakom čvoru mreže.
  let od = 0;
  for (let i = 1; i < w.nodes.length; i++) {
    if (!jeCvor(w, i)) continue;
    const tacke = w.nodes.slice(od, i + 1).map((id) => {
      const n = cvoroviOsm.get(id);
      return lok(n.lat, n.lon);
    });
    // Ivica cijela van grada se ne pravi — ulica se na rubu završava.
    if (!tacke.some(uRezu)) {
      od = i;
      continue;
    }
    const prosto = uprosti(tacke, UPROSTI_ULICE);
    iv.A.push(cvorZa(w.nodes[od]));
    iv.B.push(cvorZa(w.nodes[i]));
    for (const p of prosto) iv.XY.push(p.x, p.y);
    iv.Od.push(iv.XY.length / 2);
    iv.Klasa.push(klase.indexOf(t.highway));
    iv.Smjer.push(smjer);
    iv.Trake.push(Math.min(255, broj(t.lanes) ?? 0));
    iv.TrakeNaprijed.push(Math.min(255, broj(t["lanes:forward"]) ?? 0));
    iv.TrakeNazad.push(Math.min(255, broj(t["lanes:backward"]) ?? 0));
    iv.Brzina.push(Math.min(255, brzina ?? 0));
    iv.Zastavice.push(zastavice);
    // Sloj je i negativan (podvožnjak), pa ne ide kroz `broj`, koji znak ne zna.
    iv.Sloj.push(Math.max(-128, Math.min(127, Number.parseInt(t.layer ?? "0", 10) || 0)));
    iv.Ime.push(stringovi.kod(t.name ?? ""));
    iv.TrakeSkretanja.push(stringovi.kod(t["turn:lanes:forward"] ?? t["turn:lanes"] ?? ""));
    iv.TrakeSkretanjaNazad.push(stringovi.kod(t["turn:lanes:backward"] ?? ""));
    iv.Osm.push(w.id);
    od = i;
  }
}
const ivica = iv.A.length;

// ── objekti: znaci, semafori, prelazi, stajališta, pumpe, bogomolje ──────────

const ob = { XY: [], Vrsta: [], Podatak: [], tile: [] };
const dodajObjekat = (vrsta, p, podatak) => {
  ob.XY.push(p.x, p.y);
  ob.Vrsta.push(VRSTE_OBJEKATA.indexOf(vrsta));
  ob.Podatak.push(stringovi.kod(podatak ?? ""));
  ob.tile.push(tileZa(p));
};
for (const el of await ucitaj(kljucGrada, "pravila")) {
  const t = el.tags ?? {};
  const p = lok(el.lat, el.lon);
  if (t.highway === "stop" || t.highway === "give_way") dodajObjekat(t.highway, p, t.direction);
  else if (t.highway === "traffic_signals") dodajObjekat("traffic_signals", p, t["traffic_signals:direction"] ?? t.direction);
  else if (t.highway === "crossing" || t.crossing) dodajObjekat("crossing", p, t.crossing ?? t["crossing:markings"]);
  else if (t.highway === "bus_stop" || t.public_transport === "platform") dodajObjekat("bus_stop", p, t.name);
  else if (t.traffic_calming) dodajObjekat("traffic_calming", p, t.traffic_calming);
}
const objektiEl = await ucitaj(kljucGrada, "objekti");
for (const el of objektiEl) {
  const t = el.tags ?? {};
  if (!["fuel", "place_of_worship"].includes(t.amenity)) continue;
  const p =
    el.type === "node" ? lok(el.lat, el.lon) : teziste((el.geometry ?? []).map((g) => lok(g.lat, g.lon)));
  if (!Number.isFinite(p.x)) continue;
  dodajObjekat(t.amenity, p, t.amenity === "place_of_worship" ? t.name : "");
}

// ── zgrade ──────────────────────────────────────────────────────────────────

const vrsteZgrada = tabela();
const zg = [];
for (const el of await ucitaj(kljucGrada, "zgrade")) {
  const t = el.tags ?? {};
  if (!t.building || t.building === "no") continue;
  const javna = JAVNE_ZGRADE.has(t.building) || JAVNE_USTANOVE.has(t.amenity) || t.shop === "mall" || t.leisure === "stadium" || t.tourism === "museum";
  for (const prsten of prstenovi(el)) {
    const tacke = prsten.slice(0, -1).map((g) => lok(g.lat, g.lon));
    if (tacke.length < 3) continue;
    zg.push({
      tacke,
      spratovi: Math.min(255, Math.round(broj(t["building:levels"]) ?? 0)),
      visina: Math.min(65535, Math.round((broj(t.height) ?? 0) * 10)),
      vrsta: vrsteZgrada.kod(t.building),
      ime: javna ? stringovi.kod(t.name ?? "") : 0,
      tile: tileZa(teziste(tacke)),
    });
  }
}

// ── površine i linije ───────────────────────────────────────────────────────

const pv = [];
const ln = [];
const vidjeni = new Set();
for (const el of [...(await ucitaj(kljucGrada, "povrsine")), ...objektiEl]) {
  const kljuc = `${el.type}/${el.id}`;
  if (vidjeni.has(kljuc)) continue;
  vidjeni.add(kljuc);
  const t = el.tags ?? {};
  const linija = VRSTE_LINIJA.find(([, jeste]) => jeste(t));
  if (linija && el.type === "way") {
    const cijela = (el.geometry ?? []).map((g) => lok(g.lat, g.lon));
    for (const komad of iseciLiniju(naNiz(cijela), rez)) {
      const tacke = uprosti(odNiza(komad), UPROSTI_POVRSINE);
      if (tacke.length < 2) continue;
      const sirina = broj(t.width) ?? linija[2];
      ln.push({ tacke, vrsta: VRSTE_LINIJA.indexOf(linija), sirina: Math.round(sirina * 10), tile: tileZa(tacke[0]) });
    }
    continue;
  }
  const vrsta = VRSTE_POVRSINA.findIndex(([, jeste]) => jeste(t));
  if (vrsta < 0) continue;
  for (const prsten of prstenovi(el)) {
    // Uprošćava se otvoren prsten — bez ponovljene posljednje tačke.
    const tacke = odNiza(
      iseciPoligon(naNiz(uprosti(prsten.slice(0, -1).map((g) => lok(g.lat, g.lon)), UPROSTI_POVRSINE)), rez),
    );
    if (tacke.length < 3) continue;
    pv.push({ tacke, vrsta, tile: tileZa(teziste(tacke)) });
  }
}

// ── pakovanje po tile-ovima ─────────────────────────────────────────────────

/** Sortira stavke po tile-u i pravi indeks „od" (dužina tile-ova + 1). */
function poTileovima(stavke) {
  const sortirano = [...stavke].sort((a, b) => a.tile - b.tile);
  const tileOd = new Uint32Array(brojTileova + 1);
  let k = 0;
  for (let tIdx = 0; tIdx <= brojTileova; tIdx++) {
    while (k < sortirano.length && sortirano[k].tile < tIdx) k++;
    tileOd[tIdx] = k;
  }
  return { sortirano, tileOd };
}

function prstenoviUNiz(stavke) {
  const od = new Uint32Array(stavke.length + 1);
  const xy = [];
  stavke.forEach((s, i) => {
    for (const p of s.tacke) xy.push(p.x, p.y);
    od[i + 1] = xy.length / 2;
  });
  return { od, xy: new Float32Array(xy) };
}

const zgT = poTileovima(zg);
const zgN = prstenoviUNiz(zgT.sortirano);
const pvT = poTileovima(pv);
const pvN = prstenoviUNiz(pvT.sortirano);
const lnT = poTileovima(ln);
const lnN = prstenoviUNiz(lnT.sortirano);
const obRed = ob.tile.map((tile, i) => ({ tile, i })).sort((a, b) => a.tile - b.tile || a.i - b.i);
const obT = poTileovima(obRed);

const n = {
  cvXY: new Float32Array(cvXY),
  ivA: new Uint32Array(iv.A),
  ivB: new Uint32Array(iv.B),
  ivOd: new Uint32Array(iv.Od),
  ivXY: new Float32Array(iv.XY),
  ivKlasa: new Uint8Array(iv.Klasa),
  ivSmjer: new Int8Array(iv.Smjer),
  ivTrake: new Uint8Array(iv.Trake),
  ivTrakeNaprijed: new Uint8Array(iv.TrakeNaprijed),
  ivTrakeNazad: new Uint8Array(iv.TrakeNazad),
  ivBrzina: new Uint8Array(iv.Brzina),
  ivZastavice: new Uint8Array(iv.Zastavice),
  ivSloj: new Int8Array(iv.Sloj),
  ivIme: new Uint16Array(iv.Ime),
  ivTrakeSkretanja: new Uint16Array(iv.TrakeSkretanja),
  ivTrakeSkretanjaNazad: new Uint16Array(iv.TrakeSkretanjaNazad),
  ivOsm: new Uint32Array(iv.Osm),
  zgOd: zgN.od,
  zgXY: zgN.xy,
  zgSpratovi: new Uint8Array(zgT.sortirano.map((z) => z.spratovi)),
  zgVisina: new Uint16Array(zgT.sortirano.map((z) => z.visina)),
  zgVrsta: new Uint8Array(zgT.sortirano.map((z) => Math.min(255, z.vrsta))),
  zgIme: new Uint16Array(zgT.sortirano.map((z) => z.ime)),
  zgTileOd: zgT.tileOd,
  pvOd: pvN.od,
  pvXY: pvN.xy,
  pvVrsta: new Uint8Array(pvT.sortirano.map((p) => p.vrsta)),
  pvTileOd: pvT.tileOd,
  lnOd: lnN.od,
  lnXY: lnN.xy,
  lnVrsta: new Uint8Array(lnT.sortirano.map((l) => l.vrsta)),
  lnSirina: new Uint16Array(lnT.sortirano.map((l) => l.sirina)),
  lnTileOd: lnT.tileOd,
  obXY: new Float32Array(obRed.flatMap(({ i }) => [ob.XY[2 * i], ob.XY[2 * i + 1]])),
  obVrsta: new Uint8Array(obRed.map(({ i }) => ob.Vrsta[i])),
  obPodatak: new Uint16Array(obRed.map(({ i }) => ob.Podatak[i])),
  obTileOd: obT.tileOd,
};
if (Object.keys(n).length !== Object.keys(NIZOVI).length) throw new Error("paket nema sve nizove");
if (stringovi.niz.length > 65535) throw new Error("previše stringova za u16");

const datum = Object.values(izvor.datumi).filter(Boolean).sort().pop() ?? null;
const bajtovi = zapisi(
  {
    grad: kljucGrada,
    ime: grad.ime,
    datum,
    licenca: "© OpenStreetMap contributors (ODbL)",
    ishodiste: { utmX: o.x, utmY: o.y, lat: grad.centar.lat, lon: grad.centar.lon },
    okvir,
    tile: TILE,
    tileovaX,
    tileovaY,
    stringovi: stringovi.niz,
    klase,
    vrsteZgrada: vrsteZgrada.niz,
    vrstePovrsina: VRSTE_POVRSINA.map(([ime]) => ime),
    vrsteLinija: VRSTE_LINIJA.map(([ime]) => ime),
    vrsteObjekata: VRSTE_OBJEKATA,
  },
  n,
);

// Ime fajla nosi otisak sadržaja: novi podaci su nova adresa, pa se stari
// smije keširati zauvijek (vidi `next.config.mjs`).
const otisak = createHash("sha1").update(bajtovi).digest("hex").slice(0, 10);
const ime = `${kljucGrada}-${otisak}.bin`;
await mkdir(IZLAZ, { recursive: true });
await writeFile(join(IZLAZ, ime), bajtovi);
const spisakPut = join(IZLAZ, "gradovi.json");
const spisak = existsSync(spisakPut) ? JSON.parse(await readFile(spisakPut, "utf8")) : {};
spisak[kljucGrada] = { ime: grad.ime, fajl: ime, bajtova: bajtovi.length, datum };
await writeFile(spisakPut, JSON.stringify(spisak, null, 2) + "\n");

// ── izvještaj ───────────────────────────────────────────────────────────────

const udio = (niz, uslov) => `${((100 * niz.filter(uslov).length) / Math.max(1, niz.length)).toFixed(0)} %`;
const vozne = [];
for (let i = 0; i < ivica; i++) if (n.ivZastavice[i] & IVICA_VOZNA) vozne.push(i);

// Povezanost vozne mreže: komponente, bez obzira na jednosmjernost (bez
// pravila se vozi u oba smjera).
const roditelj = new Int32Array(cvXY.length / 2).map((_, i) => i);
const nadji = (x) => {
  while (roditelj[x] !== x) {
    roditelj[x] = roditelj[roditelj[x]];
    x = roditelj[x];
  }
  return x;
};
for (const i of vozne) roditelj[nadji(n.ivA[i])] = nadji(n.ivB[i]);
const velicine = new Map();
for (const i of vozne) {
  const r = nadji(n.ivA[i]);
  velicine.set(r, (velicine.get(r) ?? 0) + 1);
}
const komponente = [...velicine.values()].sort((a, b) => b - a);

const glavne = putevi.filter((w) => ["primary", "secondary", "trunk", "tertiary"].includes(w.tags.highway));
const obBroj = (v) => n.obVrsta.filter((x) => x === VRSTE_OBJEKATA.indexOf(v)).length;
izvj.push(
  `# ${grad.ime} — paket grada`,
  "",
  `Okvir upita ${grad.okvir}; stanje baze ${datum}. Paket \`${ime}\`: ${(bajtovi.length / 1048576).toFixed(2)} MB, ${brojTileova} tile-ova po ${TILE} m (${tileovaX} × ${tileovaY}).`,
  "",
  "| | broj | napomena |",
  "|---|---|---|",
  `| OSM puteva (ulica) | ${putevi.length} | bez čvora u odgovoru: ${bezCvora} |`,
  `| ivica mreže | ${ivica} | vozne autom: ${vozne.length} |`,
  `| čvorova mreže | ${cvXY.length / 2} | |`,
  `| komponenti vozne mreže | ${komponente.length} | najveća ${komponente[0] ?? 0} ivica (${((100 * (komponente[0] ?? 0)) / Math.max(1, vozne.length)).toFixed(1)} %) |`,
  `| zgrada | ${zg.length} | sa spratnošću ${udio(zg, (z) => z.spratovi > 0)}, sa visinom ${udio(zg, (z) => z.visina > 0)}, sa imenom (javne) ${zg.filter((z) => z.ime > 0).length} |`,
  `| površina | ${pv.length} | ${VRSTE_POVRSINA.map(([ime], k) => `${ime} ${pv.filter((p) => p.vrsta === k).length}`).join(", ")} |`,
  `| linija | ${ln.length} | ${VRSTE_LINIJA.map(([ime], k) => `${ime} ${ln.filter((l) => l.vrsta === k).length}`).join(", ")} |`,
  `| objekata | ${n.obVrsta.length} | ${VRSTE_OBJEKATA.map((v) => `${v} ${obBroj(v)}`).join(", ")} |`,
  "",
  "Oznake na ulicama (udio OSM puteva):",
  "",
  `- sve ulice: \`lanes\` ${udio(putevi, (w) => w.tags.lanes)}, \`maxspeed\` ${udio(putevi, (w) => w.tags.maxspeed)}, \`oneway\` ${udio(putevi, (w) => w.tags.oneway)}, \`turn:lanes\` ${udio(putevi, (w) => w.tags["turn:lanes"] || w.tags["turn:lanes:forward"])}, \`name\` ${udio(putevi, (w) => w.tags.name)}`,
  `- glavne (trunk…tertiary, ${glavne.length}): \`lanes\` ${udio(glavne, (w) => w.tags.lanes)}, \`maxspeed\` ${udio(glavne, (w) => w.tags.maxspeed)}, jednosmjerne ${udio(glavne, (w) => ["yes", "-1"].includes(w.tags.oneway))}`,
  `- \`priority_road\` na putevima: ${putevi.filter((w) => w.tags.priority_road).length}`,
  "",
  "Klase: " + klase.map((k, i) => `${k} ${n.ivKlasa.filter((x) => x === i).length}`).join(", "),
  "",
);
await mkdir(join(OVDJE, "izvjestaj"), { recursive: true });
await writeFile(join(OVDJE, "izvjestaj", `grad-${kljucGrada}.md`), izvj.join("\n"));
console.log(izvj.join("\n"));
