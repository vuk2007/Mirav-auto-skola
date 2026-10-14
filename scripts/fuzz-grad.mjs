/**
 * Savršeni bot u gradu: nasumične od–do rute po Podgorici (zadatak, faza 6,
 * odjeljak 8: 50 ruta na nivou 5, bez prekršaja, bez zaglavljivanja).
 *
 * Svaka ruta: A* po ulicama (jednosmjerne, zabrane skretanja), plan vožnje
 * (trake, lukovi, stop-linije, žmigavac), pa vožnja pod sudijom. Pad je
 * greška u botu ili u sudiji — oba vide isti model raskrsnice, pa se mora
 * naći koji griješi i zašto.
 *
 * Pokretanje:
 *
 *     npm run test:fuzz:grad            # 50 ruta, nivo 5, sjeme 1
 *     npm run test:fuzz:grad -- 10 3 7  # 10 ruta, nivo 3, sjeme 7
 *     npm run test:fuzz:grad -- 50 5 1 --sinteticki 3
 *                                       # umjesto overlay fajla: sintetički
 *                                       # overlay sa sjemenom 3 (sve vrste
 *                                       # izmjena iz editora, u memoriji)
 *     npm run test:fuzz:grad -- 50 5 1 --saobracaj
 *                                       # među drugim vozačima (stavka 7d):
 *                                       # i bez sudara, oduzetog prvenstva i
 *                                       # zastoja u kojem učestvuje bot
 *
 * Izlaz je 0 kad je sve prošlo, 1 kad nije — sa rutom, sjemenom i
 * prekršajem, da se pad ponovi jednom vožnjom.
 *
 * Grad je OSM paket SA ručnim izmjenama iz editora (overlay), kao u igri:
 * bot mora čisto voziti i po pravilima koja je postavio čovjek.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const KOD = new URL("../lib/game/", import.meta.url).href;
const JAVNO = fileURLToPath(new URL("../public/data/grad/", import.meta.url));

const ruta = Number(process.argv[2] ?? 50);
const nivo = Number(process.argv[3] ?? 5);
const sjeme = Number(process.argv[4] ?? 1);
const iSint = process.argv.indexOf("--sinteticki");
const sjemeSintetike = iSint >= 0 ? Number(process.argv[iSint + 1] ?? 1) : null;
const uSaobracaju = process.argv.includes("--saobracaj");

const { procitaj } = await import(`${KOD}grad/paket.ts`);
const { procitajOverlay } = await import(`${KOD}grad/overlay.ts`);
const { svijetGrada } = await import(`${KOD}grad/svijet.ts`);
const { nasumicnaRuta, odveziRutu, planBota } = await import(`${KOD}grad/botGrad.ts`);
const { rng } = await import(`${KOD}sim/geometry.ts`);
const { odveziRutuUSaobracaju } = await import(`${KOD}grad/botUSaobracaju.ts`);

const spisak = JSON.parse(readFileSync(join(JAVNO, "gradovi.json"), "utf8"));
const b = readFileSync(join(JAVNO, spisak.podgorica.fajl));
const osm = procitaj(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const fajlOverlaya = join(JAVNO, "overrides", "podgorica.json");
let overlay = existsSync(fajlOverlaya) ? procitajOverlay(JSON.parse(readFileSync(fajlOverlaya, "utf8"))) : null;
if (sjemeSintetike !== null) {
  const { sintetickiOverlay } = await import(`${KOD}grad/sintetickiOverlay.ts`);
  const osnova = svijetGrada(osm, null);
  const { lat, lon } = osm.zaglavlje.ishodiste;
  overlay = sintetickiOverlay(osnova.mreza, osnova.raskrsnice, sjemeSintetike, { lat, lon });
}
const sablonZona = JSON.parse(readFileSync(join(JAVNO, "cityZones", "podgorica.json"), "utf8")).zone;
// Autobuske linije (stavka 8c) — bot u saobraćaju vozi i među autobusima.
const fajlLinija = join(JAVNO, "linije", "podgorica.json");
const linije = existsSync(fajlLinija) ? JSON.parse(readFileSync(fajlLinija, "utf8")) : null;
const svijet = svijetGrada(osm, overlay, sablonZona);
const { mreza, povrsina, raskrsnice, zabrane, zaSudiju: grad } = svijet;
console.log(
  overlay
    ? `Overlay${sjemeSintetike !== null ? ` (sintetički, sjeme ${sjemeSintetike})` : ""}: ${overlay.izmjene.length} izmjena, nevezanih ${svijet.nevezane.length}.`
    : "Overlay: nema ga — čist OSM.",
);
if (sjemeSintetike !== null) {
  const po = {};
  for (const iz of overlay.izmjene) po[iz.vrsta] = (po[iz.vrsta] ?? 0) + 1;
  console.log(`  po vrsti: ${JSON.stringify(po)}`);
  for (const n of svijet.nevezane.slice(0, 5)) console.log(`  nevezana ${n.id} ${n.vrsta}: ${n.razlog}`);
}

const slucajno = rng(sjeme);
const padovi = [];
let km = 0;
let sati = 0;
let osovinom = 0;
let izvlacenja = 0;
const pocetak = Date.now();
for (let n = 0; n < ruta; n++) {
  const koraci = nasumicnaRuta(mreza, raskrsnice, zabrane, slucajno);
  const plan = planBota(grad, koraci);
  // Semafori u različitim fazama: početak vožnje u nasumičnom trenutku ciklusa.
  const t0 = slucajno() * 300;
  const x = uSaobracaju
    ? odveziRutuUSaobracaju(svijet, plan, koraci, t0, nivo, sjeme * 1000 + n, 1, 1800, linije)
    : odveziRutu(grad, povrsina, plan, t0, nivo, 1800);
  if (x.zastojaBota) x.prekrsaji.push({ vrsta: "zastoj", detalji: { zastoja: x.zastojaBota }, x: 0, y: 0 });
  km += x.predjeno / 1000;
  sati += x.trajanje / 3600;
  osovinom += plan.osovinom;
  izvlacenja += x.izvlacenja;
  const ok = x.stigao && x.prekrsaji.length === 0;
  console.log(
    `${ok ? "OK  " : "PAD "} ruta ${String(n).padStart(2)}: ${(plan.put.duzina / 1000).toFixed(1)} km, ` +
      `${x.trajanje.toFixed(0)} s, raskrsnica osovinom ${plan.osovinom}, izvlačenja ${x.izvlacenja}` +
      (uSaobracaju ? `, zastoja oko njega ${x.zastoja}` : "") +
      (x.stigao ? "" : " — NIJE STIGAO") +
      (x.prekrsaji.length ? ` — ${x.prekrsaji.map((p) => `${p.vrsta} ${JSON.stringify(p.detalji)} @${Math.round(p.x)},${Math.round(p.y)}`).join("; ")}` : ""),
  );
  if (!ok) padovi.push(n);
}
console.log(
  `\n${ruta - padovi.length}/${ruta} ruta bez prekršaja i do kraja (nivo ${nivo}, sjeme ${sjeme}${uSaobracaju ? ", u saobraćaju" : ""}); ` +
    `${km.toFixed(1)} km, ${sati.toFixed(2)} h vožnje; osovinom ${osovinom}, izvlačenja ${izvlacenja}; ` +
    `${((Date.now() - pocetak) / 1000).toFixed(0)} s računanja.`,
);
if (padovi.length) console.log(`Pale rute: ${padovi.join(", ")}`);
process.exit(padovi.length ? 1 : 0);
