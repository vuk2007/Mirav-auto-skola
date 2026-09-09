/**
 * Korak 4: kandidati za gradske kicme.
 *
 * Pokretanje: `npm run osm:kicme` (poslije `osm:povuci`).
 *
 * Kicma je niz ulica od ulaza u grad do svakog izlaza, koji prolazi kroz
 * stvarne tacke odluke. Ova skripta ih NE bira — samo izlista sta u gradu
 * postoji: kruzne tokove i vece raskrsnice, sa imenima ulica koje se na njima
 * sastaju, i uz to sve izlaze iz grada po grafu. Izbor je covjekov.
 *
 * Za osam gradova iz zadatka spisak je detaljan; za ostale opstine se ispisuje
 * samo koliko je cega naslo, jer se tamo kicma racuna automatski (najkraci put
 * kroz centar).
 *
 * Podaci: (c) OpenStreetMap contributors, ODbL.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { EDGES, NODES, nodeById, otherEnd } from "./lib/graf.mjs";
import { KES } from "./lib/overpass.mjs";
import { uMetre } from "./lib/proj.mjs";

const IZVJESTAJ = join(process.cwd(), "scripts", "osm", "izvjestaj");

/** Gradovi za koje kicmu bira covjek. */
const RUCNO = [
  "podgorica",
  "niksic",
  "bar",
  "budva",
  "kotor",
  "herceg-novi",
  "bijelo-polje",
  "berane",
];

/** Dokle od centra se trazi [m]. */
const DOMET = 2500;

const GLAVNI = new Set(["motorway", "trunk", "primary", "secondary"]);
const osnovni = (h = "") => (h.endsWith("_link") ? h.slice(0, -5) : h);

/** Ime ulice kako se moze prikazati: ime, pa oznaka, pa vrsta. */
const imeUlice = (tags = {}) => tags.name ?? tags.ref ?? `(${tags.highway ?? "put"})`;

async function glavno() {
  const put = join(KES, "putevi.json");
  if (!existsSync(put)) throw new Error("Nema putevi.json — pokreni prvo: npm run osm:povuci");
  const sirovo = JSON.parse(await readFile(put, "utf8"));
  // Gradske ulice ulaze samo radi IMENOVANJA. Tacka odluke ostaje ono sto je i
  // bila — kruzni tok ili raskrsnica glavnih puteva — ali kruzni tok na koji se
  // vezuju same stambene ulice bi bez ovoga ostao bez ijednog imena, a bas ime
  // ulice je ono po cemu se na spisku prepoznaje o kojem se mjestu radi.
  const uliceSirovo = existsSync(join(KES, "ulice.json"))
    ? JSON.parse(await readFile(join(KES, "ulice.json"), "utf8"))
    : { elements: [] };

  const tacke = new Map();
  for (const skup of [sirovo, uliceSirovo]) {
    for (const el of skup.elements) {
      if (el.type === "node") tacke.set(el.id, uMetre(el.lat, el.lon));
    }
  }

  const ivice = sirovo.elements.filter((el) => el.type === "way" && el.nodes);
  const sveIvice = [
    ...ivice,
    ...uliceSirovo.elements.filter((el) => el.type === "way" && el.nodes),
  ];

  // Koje ivice prolaze kroz koji cvor — po tome se prepoznaje raskrsnica.
  const krozCvor = new Map();
  for (const el of sveIvice) {
    for (const id of el.nodes) {
      let s = krozCvor.get(id);
      if (!s) {
        s = [];
        krozCvor.set(id, s);
      }
      s.push(el);
    }
  }

  await mkdir(IZVJESTAJ, { recursive: true });
  const redovi = [];
  redovi.push("# Kandidati za gradske kicme");
  redovi.push("");
  redovi.push(`Napravljeno: ${new Date().toISOString()}`);
  redovi.push("");
  redovi.push(
    "Za osam gradova iz zadatka ispod su izlistani kruzni tokovi i vece raskrsnice",
    "u krugu od " + DOMET + " m oko centra, sa ulicama koje se na njima sastaju.",
    "Skripta nista ne bira. Uz svaki grad stoje i izlazi po grafu, da se vidi",
    "koliko pravaca kicma mora da poveze.",
  );
  redovi.push("");

  const sazetak = [];

  for (const cvor of NODES.filter((n) => n.kind === "opstina")) {
    const centar = uMetre(cvor.lat, cvor.lon);
    const blizu = (p) => Math.hypot(p.x - centar.x, p.y - centar.y) <= DOMET;

    // Kruzni tokovi u dometu. Jedan STVARNI kruzni tok je u OSM-u cesto vise
    // ivica koje dijele cvorove — u Podgorici je tako ispadalo 61 umjesto
    // dvadesetak. Zato se ivice koje se dodiruju spajaju u jedan tok.
    const komadi = ivice.filter((el) => {
      if (el.tags?.junction !== "roundabout") return false;
      const njegove = el.nodes.map((id) => tacke.get(id)).filter(Boolean);
      return njegove.length > 0 && njegove.some(blizu);
    });

    const grupa = new Map(komadi.map((el) => [el.id, el.id]));
    const korijen = (id) => {
      let k = id;
      while (grupa.get(k) !== k) k = grupa.get(k);
      return k;
    };
    const spoji = (a, b) => {
      const ka = korijen(a);
      const kb = korijen(b);
      if (ka !== kb) grupa.set(ka, kb);
    };
    const poCvoru = new Map();
    for (const el of komadi) {
      for (const id of el.nodes) {
        const prvi = poCvoru.get(id);
        if (prvi === undefined) poCvoru.set(id, el.id);
        else spoji(prvi, el.id);
      }
    }

    const skupine = new Map();
    for (const el of komadi) {
      const k = korijen(el.id);
      let g = skupine.get(k);
      if (!g) {
        g = [];
        skupine.set(k, g);
      }
      g.push(el);
    }

    const tokovi = [];
    for (const skupina of skupine.values()) {
      const svi = skupina.flatMap((el) => el.nodes);
      const njegove = svi.map((id) => tacke.get(id)).filter(Boolean);
      if (njegove.length === 0) continue;
      const veze = new Set();
      for (const id of svi) {
        for (const druga of krozCvor.get(id) ?? []) {
          if (druga.tags?.junction === "roundabout") continue;
          veze.add(imeUlice(druga.tags));
        }
      }
      const sx = njegove.reduce((a, p) => a + p.x, 0) / njegove.length;
      const sy = njegove.reduce((a, p) => a + p.y, 0) / njegove.length;
      tokovi.push({
        wayId: skupina.map((el) => el.id).join(" + "),
        ime: skupina.map((el) => el.tags?.name ?? el.tags?.ref).find(Boolean) ?? null,
        x: Math.round(sx),
        y: Math.round(sy),
        odCentra: Math.round(Math.hypot(sx - centar.x, sy - centar.y)),
        veze: [...veze].sort(),
      });
    }
    tokovi.sort((a, b) => a.odCentra - b.odCentra);

    // Vece raskrsnice: cvor u kojem se sastaju bar tri glavna puta.
    const raskrsnice = [];
    for (const [id, kroz] of krozCvor) {
      const p = tacke.get(id);
      if (!p || !blizu(p)) continue;
      const glavne = kroz.filter((el) => GLAVNI.has(osnovni(el.tags?.highway ?? "")));
      const imena = new Set(glavne.map((el) => imeUlice(el.tags)));
      if (glavne.length < 3 || imena.size < 2) continue;
      // Kruzni tok je vec izlistan gore.
      if (kroz.some((el) => el.tags?.junction === "roundabout")) continue;
      raskrsnice.push({
        nodeId: id,
        x: Math.round(p.x),
        y: Math.round(p.y),
        odCentra: Math.round(Math.hypot(p.x - centar.x, p.y - centar.y)),
        veze: [...imena].sort(),
      });
    }
    raskrsnice.sort((a, b) => a.odCentra - b.odCentra);

    const izlazi = EDGES.filter((e) => e.a === cvor.id || e.b === cvor.id).map((e) => ({
      ka: nodeById(otherEnd(e, cvor.id))?.name ?? otherEnd(e, cvor.id),
      kind: e.kind,
      km: e.km,
    }));

    sazetak.push({
      grad: cvor.name,
      rucno: RUCNO.includes(cvor.id),
      tokova: tokovi.length,
      raskrsnica: raskrsnice.length,
      izlaza: izlazi.length,
    });

    if (!RUCNO.includes(cvor.id)) continue;

    redovi.push(`## ${cvor.name}`);
    redovi.push("");
    redovi.push(
      `Centar po grafu: ${cvor.lat}, ${cvor.lon} (UTM ${Math.round(centar.x)}, ${Math.round(centar.y)}).`,
    );
    redovi.push("");
    redovi.push(
      `Izlazi po grafu (${izlazi.length}): ` +
        izlazi.map((i) => `${i.ka} (${i.kind}, ${i.km} km)`).join(", "),
    );
    redovi.push("");

    redovi.push(`### Kruzni tokovi (${tokovi.length})`);
    redovi.push("");
    if (tokovi.length === 0) {
      redovi.push("Nema nijednog u dometu.");
    } else {
      redovi.push("| OSM way | ime | od centra [m] | ulice koje se sastaju |");
      redovi.push("| --- | --- | --- | --- |");
      for (const t of tokovi) {
        redovi.push(
          `| \`${t.wayId}\` | ${t.ime ?? "—"} | ${t.odCentra} | ${t.veze.join(", ") || "—"} |`,
        );
      }
    }
    redovi.push("");

    const prikaz = raskrsnice.slice(0, 25);
    redovi.push(`### Vece raskrsnice (${raskrsnice.length}${raskrsnice.length > 25 ? ", prvih 25 po blizini" : ""})`);
    redovi.push("");
    if (prikaz.length === 0) {
      redovi.push("Nema nijedne u dometu.");
    } else {
      redovi.push("| OSM cvor | od centra [m] | ulice koje se sastaju |");
      redovi.push("| --- | --- | --- |");
      for (const r of prikaz) {
        redovi.push(`| \`${r.nodeId}\` | ${r.odCentra} | ${r.veze.join(", ")} |`);
      }
    }
    redovi.push("");
  }

  redovi.push("## Ostale opstine");
  redovi.push("");
  redovi.push("Tamo se kicma racuna automatski; ovo je samo pregled sta postoji.");
  redovi.push("");
  redovi.push("| opstina | kruznih tokova | vecih raskrsnica | izlaza po grafu |");
  redovi.push("| --- | --- | --- | --- |");
  for (const s of sazetak.filter((x) => !x.rucno)) {
    redovi.push(`| ${s.grad} | ${s.tokova} | ${s.raskrsnica} | ${s.izlaza} |`);
  }
  redovi.push("");

  await writeFile(join(IZVJESTAJ, "kicme-kandidati.md"), redovi.join("\n"));
  console.log("Spisak: scripts/osm/izvjestaj/kicme-kandidati.md");
  for (const s of sazetak.filter((x) => x.rucno)) {
    console.log(
      `  ${s.grad}: ${s.tokova} kruznih tokova, ${s.raskrsnica} raskrsnica, ${s.izlaza} izlaza`,
    );
  }
}

await glavno();
