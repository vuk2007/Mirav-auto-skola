/**
 * Korak 2: od sirovih Overpass odgovora do tile-ova koje igra ucitava.
 *
 * Pokretanje: `npm run osm:pripremi` (poslije `osm:povuci`).
 *
 * Cetiri stvari se dese ovdje, tim redom:
 *  1. projekcija u metre (UTM 34N) — dalje se sve racuna pravo, bez stepeni;
 *  2. uprosceno Douglas-Peucker-om: 5 m za linije, 20 m za poligone;
 *  3. sitni poligoni se izbacuju — ispod `NAJMANJA_POVRSINA` se pri voznji ne
 *     vidi nista, a broj poligona bi bio dvostruko veci;
 *  4. sve se isijeca na tile-ove 2x2 km, pa se u voznji ucitava samo okolina.
 *
 * Izlaz NIJE obican GeoJSON: koordinate su metri UTM 34N, ne stepeni. Tako je
 * i zapisano u `izvor.json`, da niko ne ucita fajl u alat koji ocekuje WGS84 i
 * dobije Crnu Goru negdje kod Gvinejskog zaliva.
 *
 * Podaci: (c) OpenStreetMap contributors, ODbL.
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { KES } from "./lib/overpass.mjs";
import { uMetre, ZONA } from "./lib/proj.mjs";
import { dm, okvir as okvirOd, uprosti } from "./lib/geom.mjs";
import { iseciLiniju, iseciPoligon, povrsina } from "./lib/iseci.mjs";

/** Stranica tile-a [m]. */
const TILE = 2000;
/** Uproscavanje: linije [m]. */
const TOL_LINIJA = 5;
/** Uproscavanje: poligoni [m]. */
const TOL_POLIGON = 20;
/** Poligoni manji od ovoga se izbacuju [m2] — 45x45 m se u voznji ne vidi. */
const NAJMANJA_POVRSINA = 2000;

const IZLAZ = join(process.cwd(), "public", "data", "osm");

/** Vrsta povrsine po OSM oznakama. Sto nije ovdje, ne ulazi u tile. */
function vrstaPovrsine(tags = {}) {
  if (tags.natural === "water") return "voda";
  if (tags.natural === "wood" || tags.landuse === "forest") return "suma";
  if (tags.landuse === "farmland") return "njiva";
  if (tags.landuse === "vineyard") return "vinograd";
  if (tags.landuse === "residential") return "naselje";
  if (tags.landuse === "industrial") return "industrija";
  return null;
}

/** Rang puta — po njemu se bira sirina i boja pri crtanju. */
function vrstaPuta(tags = {}) {
  const h = tags.highway;
  if (!h) return null;
  if (h.endsWith("_link")) return h.slice(0, -5);
  if (["motorway", "trunk", "primary", "secondary", "tertiary"].includes(h)) return h;
  if (["residential", "unclassified", "living_street"].includes(h)) return "ulica";
  return null;
}

const projektuj = (tacke) =>
  tacke.map(({ lat, lon }) => {
    const { x, y } = uMetre(lat, lon);
    return [x, y];
  });

/** Cvorovi iz odgovora sa `out body; >; out skel qt;`. */
function cvorovi(elements) {
  const m = new Map();
  for (const el of elements) if (el.type === "node") m.set(el.id, { lat: el.lat, lon: el.lon });
  return m;
}

const ucitaj = async (ime) => {
  const put = join(KES, `${ime}.json`);
  if (!existsSync(put)) throw new Error(`Nema ${ime}.json — pokreni prvo: npm run osm:povuci`);
  return JSON.parse(await readFile(put, "utf8"));
};

// -- skupljanje pojava -------------------------------------------------------

/** Jedna pojava spremna za sjecenje: vrsta, geometrija i njen okvir. */
const pojave = [];
let odbaceniSitni = 0;

const dodajLiniju = (k, tacke, extra = {}) => {
  const u = uprosti(tacke, TOL_LINIJA);
  if (u.length < 2) return;
  pojave.push({ k, tip: "linija", tacke: u, okvir: okvirOd(u), ...extra });
};

const dodajPoligon = (k, prsten) => {
  const u = uprosti(prsten, TOL_POLIGON);
  if (u.length < 4) return;
  if (povrsina(u) < NAJMANJA_POVRSINA) {
    odbaceniSitni += 1;
    return;
  }
  pojave.push({ k, tip: "poligon", tacke: u, okvir: okvirOd(u) });
};

/** Povrsine i vodene linije iz odgovora sa `out geom;`. */
function povrsineIz(elements) {
  for (const el of elements) {
    if (el.type === "way" && el.geometry) {
      const t = el.tags ?? {};
      const k =
        t.natural === "coastline"
          ? "obala"
          : t.waterway === "river"
            ? "rijeka"
            : vrstaPovrsine(t);
      if (!k) continue;
      const tacke = projektuj(el.geometry);
      // Obala i rijeka su linije, sve ostalo su zatvorene povrsine.
      if (k === "obala" || k === "rijeka") dodajLiniju(k, tacke);
      else dodajPoligon(k, tacke);
    } else if (el.type === "relation") {
      const k = vrstaPovrsine(el.tags);
      if (!k) continue;
      // Samo spoljni prstenovi. Rupe (`inner`) se ne crtaju: sematski prikaz u
      // dvije boje ionako ne pokazuje proplanak usred sume.
      for (const clan of el.members ?? []) {
        if (clan.role !== "outer" || !clan.geometry) continue;
        dodajPoligon(k, projektuj(clan.geometry));
      }
    }
  }
}

async function glavno() {
  const izvor = JSON.parse(await readFile(join(KES, "izvor.json"), "utf8"));

  // Sirovi odgovori se ucitavaju JEDAN PO JEDAN i puštaju cim se obrade. Svi
  // zajedno su preko sto megabajta razlozenog JSON-a, a od svakog nam ostaje
  // samo uprosceni oblik — visestruko manji.
  console.log("Putevi i ulice...");
  for (const ime of ["putevi", "ulice"]) {
    const skup = await ucitaj(ime);
    const cv = cvorovi(skup.elements);
    for (const el of skup.elements) {
      if (el.type !== "way" || !el.nodes) continue;
      const k = vrstaPuta(el.tags);
      if (!k) continue;
      const tacke = projektuj(el.nodes.map((id) => cv.get(id)).filter(Boolean));
      if (tacke.length < 2) continue;
      dodajLiniju("put", tacke, {
        r: k,
        ...(el.tags?.junction === "roundabout" ? { kt: 1 } : {}),
      });
    }
  }

  console.log("Voda i zelenilo...");
  for (const ime of ["voda", "zelenilo"]) {
    const skup = await ucitaj(ime);
    povrsineIz(skup.elements);
  }

  console.log("Vrhovi...");
  const vrhovi = await ucitaj("vrhovi");
  const vrhoviIzlaz = vrhovi.elements
    .filter((el) => el.type === "node" && el.tags?.name)
    .map((el) => {
      const { x, y } = uMetre(el.lat, el.lon);
      return {
        ime: el.tags.name,
        visina: Number.parseInt(el.tags.ele ?? "", 10) || null,
        x: dm(x),
        y: dm(y),
      };
    })
    // Bez visine se ne moze odluciti sta je vrijedno oznake na horizontu.
    .filter((v) => v.visina !== null)
    .sort((a, b) => b.visina - a.visina);

  console.log("Drzavna granica...");
  const granica = await ucitaj("granica");
  // Granica nije okolina nego obris zemlje za mini mapu, pa ne ide u tile-ove
  // nego u svoj fajl. Uproscava se grublje: na mini mapi je cijela drzava
  // siroka nekoliko stotina piksela, gdje je 50 m manje od pola piksela.
  const granicaIzlaz = [];
  for (const el of granica.elements) {
    for (const clan of el.members ?? []) {
      if (clan.type !== "way" || !clan.geometry) continue;
      const u = uprosti(projektuj(clan.geometry), 50);
      if (u.length >= 2) granicaIzlaz.push(u.map(([x, y]) => [dm(x), dm(y)]));
    }
  }

  console.log(`  pojava za sjecenje: ${pojave.length}, sitnih odbaceno: ${odbaceniSitni}`);

  // -- sjecenje na tile-ove --------------------------------------------------
  console.log("Sijecem na tile-ove...");
  const tiles = new Map();
  const uTile = (tx, ty) => {
    const kljuc = `${tx}_${ty}`;
    let t = tiles.get(kljuc);
    if (!t) {
      t = [];
      tiles.set(kljuc, t);
    }
    return t;
  };

  for (const p of pojave) {
    const tx0 = Math.floor(p.okvir[0] / TILE);
    const ty0 = Math.floor(p.okvir[1] / TILE);
    const tx1 = Math.floor(p.okvir[2] / TILE);
    const ty1 = Math.floor(p.okvir[3] / TILE);
    for (let tx = tx0; tx <= tx1; tx++) {
      for (let ty = ty0; ty <= ty1; ty++) {
        const r = [tx * TILE, ty * TILE, (tx + 1) * TILE, (ty + 1) * TILE];
        if (p.tip === "linija") {
          for (const komad of iseciLiniju(p.tacke, r)) {
            uTile(tx, ty).push({
              k: p.k,
              ...(p.r ? { r: p.r } : {}),
              ...(p.kt ? { kt: 1 } : {}),
              g: komad.map(([x, y]) => [dm(x), dm(y)]),
            });
          }
        } else {
          const isjecak = iseciPoligon(p.tacke, r);
          if (isjecak.length < 3 || povrsina(isjecak) < NAJMANJA_POVRSINA / 4) continue;
          uTile(tx, ty).push({ k: p.k, p: 1, g: isjecak.map(([x, y]) => [dm(x), dm(y)]) });
        }
      }
    }
  }

  console.log("Pisem...");
  await rm(join(IZLAZ, "tiles"), { recursive: true, force: true });
  await mkdir(join(IZLAZ, "tiles"), { recursive: true });
  let bajtova = 0;
  const popis = [];
  for (const [kljuc, sadrzaj] of [...tiles].sort()) {
    if (sadrzaj.length === 0) continue;
    const tekst = JSON.stringify({ t: kljuc, v: sadrzaj });
    bajtova += tekst.length;
    popis.push(kljuc);
    await writeFile(join(IZLAZ, "tiles", `${kljuc}.json`), tekst);
  }

  await writeFile(join(IZLAZ, "vrhovi.json"), JSON.stringify(vrhoviIzlaz));
  await writeFile(join(IZLAZ, "granica.json"), JSON.stringify(granicaIzlaz));
  await writeFile(
    join(IZLAZ, "izvor.json"),
    JSON.stringify(
      {
        izvor: "OpenStreetMap",
        licenca: "ODbL 1.0",
        potpis: "Podaci o putevima i okolini: (c) OpenStreetMap contributors (ODbL)",
        preuzeto: izvor.preuzeto,
        stanjeBaze: izvor.stanjeBaze,
        obradjeno: new Date().toISOString(),
        koordinate: ZONA,
        napomena: "Koordinate su metri, ne stepeni. Ovo nije WGS84 GeoJSON.",
        tile: TILE,
        uprosceno: { linije: TOL_LINIJA, poligoni: TOL_POLIGON },
        najmanjaPovrsina: NAJMANJA_POVRSINA,
        tileova: popis.length,
        vrhova: vrhoviIzlaz.length,
        granicaKomada: granicaIzlaz.length,
      },
      null,
      2,
    ),
  );

  console.log(
    `\nGotovo: ${popis.length} tile-ova, ${(bajtova / 1048576).toFixed(1)} MB, ${vrhoviIzlaz.length} vrhova.`,
  );
}

await glavno();
