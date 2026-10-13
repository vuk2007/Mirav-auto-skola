/**
 * Autobuske linije grada (faza 6, stavka 8) iz keša `povuciGrad.mjs` u
 * `public/data/grad/linije/<grad>.json`.
 *
 * Pokretanje: `npm run osm:grad:linije -- podgorica` (poslije
 * `osm:grad:povuci`). Ručno, nikad u build-u.
 *
 * Linija je relacija `route=bus` sa oznakom `ref` (gradske linije; međugradske
 * bez broja se preskaču). Ulice-članovi se slažu redom u jednu putanju: svaka
 * se okreće tako da nastavlja tamo gdje je prethodna stala; zatvorena ulica
 * (kružni tok) se prolazi od ulaza do mjesta najbližeg sljedećoj. Rupa veća od
 * `RUPA` prekida putanju na dijelove. Stajališta su čvorovi sa ulogom
 * `platform…` ili `stop`, redom kao u relaciji.
 *
 * Koordinate su lokalni metri grada (x na istok, y na JUG), kao u paketu
 * (`pripremiGrad.mjs`). Na mrežu igre se linija veže po obliku, u igri
 * (`lib/game/grad/autobusi.ts`): ulice se od datuma osnovnog povlačenja mogu
 * podijeliti, pa id-evi ulica nijesu pouzdani.
 *
 * Podaci: © OpenStreetMap contributors, ODbL.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { KES } from "./lib/overpass.mjs";
import { uMetre } from "./lib/proj.mjs";
import { GRADOVI } from "./gradovi.mjs";

const OVDJE = dirname(fileURLToPath(import.meta.url));
const IZLAZ = join(OVDJE, "..", "..", "public", "data", "grad", "linije");
/** Rupa između uzastopnih ulica linije [m] preko koje se putanja prekida. */
const RUPA = 30;

const kljuc = process.argv[2];
const grad = GRADOVI[kljuc];
if (!grad) {
  console.error(`Nepoznat grad „${kljuc}". Poznati: ${Object.keys(GRADOVI).join(", ")}`);
  process.exit(1);
}
const o = uMetre(grad.centar.lat, grad.centar.lon);
/** Lokalni metri: `x` na istok, `y` na JUG — kao u ostatku igre. */
const lok = (q) => {
  const m = uMetre(q.lat, q.lon);
  return { x: Math.round((m.x - o.x) * 10) / 10, y: Math.round((o.y - m.y) * 10) / 10 };
};
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const najblizi = (t, p) => t.reduce((n, q, i) => (d(q, p) < d(t[n], p) ? i : n), 0);

const sirovo = JSON.parse(await readFile(join(KES, `grad-${kljuc}-linije.json`), "utf8"));
const izvor = JSON.parse(await readFile(join(KES, `grad-${kljuc}-izvor.json`), "utf8"));

/** Ulice-članovi u jednu ili više putanja (rupa prekida). */
function slozi(ulice) {
  const dijelovi = [];
  let tekuci = [];
  for (let i = 0; i < ulice.length; i++) {
    let u = ulice[i];
    const zatvorena = u.length > 2 && d(u[0], u.at(-1)) < 0.5;
    const kraj = tekuci.at(-1);
    if (!kraj) {
      // Prva ulica: okrenuta tako da joj kraj dodiruje sljedeću.
      const sl = ulice[i + 1];
      if (sl && !zatvorena) {
        const doSl = (p) => Math.min(d(p, sl[0]), d(p, sl.at(-1)));
        if (doSl(u[0]) < doSl(u.at(-1))) u = [...u].reverse();
      }
      tekuci = [...u];
      continue;
    }
    if (zatvorena) {
      // Kružni tok: od ulaza, u smjeru crtanja, do tačke najbliže sljedećoj ulici.
      const ring = u.slice(0, -1);
      const od = najblizi(ring, kraj);
      const sl = ulice[i + 1];
      const doI = sl ? najblizi(ring, d(ring[najblizi(ring, sl[0])], sl[0]) <= d(ring[najblizi(ring, sl.at(-1))], sl.at(-1)) ? sl[0] : sl.at(-1)) : od;
      const put = [];
      for (let k = od; ; k = (k + 1) % ring.length) {
        put.push(ring[k]);
        if (k === doI && put.length > 1) break;
        if (put.length > ring.length + 1) break;
      }
      if (d(put[0], kraj) > RUPA) {
        dijelovi.push(tekuci);
        tekuci = [];
      }
      tekuci.push(...(tekuci.length && d(put[0], tekuci.at(-1)) < 0.5 ? put.slice(1) : put));
      continue;
    }
    if (d(u.at(-1), kraj) < d(u[0], kraj)) u = [...u].reverse();
    if (d(u[0], kraj) > RUPA) {
      dijelovi.push(tekuci);
      tekuci = [];
    }
    tekuci.push(...(tekuci.length && d(u[0], tekuci.at(-1)) < 0.5 ? u.slice(1) : u));
  }
  if (tekuci.length) dijelovi.push(tekuci);
  return dijelovi.filter((t) => t.length > 1);
}

const linije = [];
for (const r of sirovo.elements) {
  const t = r.tags ?? {};
  if (r.type !== "relation" || !t.ref) continue;
  const ulice = r.members.filter((m) => m.type === "way" && m.geometry?.length > 1 && !/platform/.test(m.role)).map((m) => m.geometry.map(lok));
  const stajalista = r.members
    .filter((m) => m.type === "node" && /^(platform|stop)/.test(m.role) && m.lat !== undefined)
    .map((m) => ({ ...lok(m), uloga: m.role }));
  // Stajalište i njegov `stop` čvor su dva člana za jedno mjesto: ostaje platforma.
  const jedinstvena = [];
  for (const s of stajalista) {
    const isto = jedinstvena.find((q) => d(q, s) < 25);
    if (!isto) jedinstvena.push(s);
    else if (/^platform/.test(s.uloga) && !/^platform/.test(isto.uloga)) Object.assign(isto, s);
  }
  const dijelovi = slozi(ulice);
  linije.push({
    id: r.id,
    ref: t.ref,
    ime: t.name ?? `Bus ${t.ref}`,
    od: t.from ?? null,
    do: t.to ?? null,
    dijelovi: dijelovi.map((p) => p.map((q) => [q.x, q.y])),
    stajalista: jedinstvena.map((q) => [q.x, q.y]),
  });
  const duz = dijelovi.map((p) => p.reduce((s, q, i) => (i ? s + d(q, p[i - 1]) : 0), 0));
  console.log(
    `${t.ref.padStart(3)} ${(t.name ?? "").padEnd(42)} ${dijelovi.length} dio(va), ` +
      `${duz.map((x) => (x / 1000).toFixed(1)).join("+")} km, ${jedinstvena.length} stajališta`,
  );
}
linije.sort((a, b) => a.ref.localeCompare(b.ref, "en", { numeric: true }) || a.id - b.id);

await mkdir(IZLAZ, { recursive: true });
const put = join(IZLAZ, `${kljuc}.json`);
await writeFile(
  put,
  JSON.stringify({
    grad: kljuc,
    datum: izvor.datumi.linije ?? null,
    licenca: "© OpenStreetMap contributors (ODbL)",
    linije,
  }) + "\n",
);
console.log(`→ ${put} (${linije.length} linija)`);
