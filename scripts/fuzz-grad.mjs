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
 *
 * Izlaz je 0 kad je sve prošlo, 1 kad nije — sa rutom, sjemenom i
 * prekršajem, da se pad ponovi jednom vožnjom.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const KOD = new URL("../lib/game/", import.meta.url).href;
const JAVNO = fileURLToPath(new URL("../public/data/grad/", import.meta.url));

const ruta = Number(process.argv[2] ?? 50);
const nivo = Number(process.argv[3] ?? 5);
const sjeme = Number(process.argv[4] ?? 1);

const { procitaj } = await import(`${KOD}grad/paket.ts`);
const { napraviMrezu } = await import(`${KOD}grad/mreza.ts`);
const { napraviPovrsinu } = await import(`${KOD}grad/povrsina.ts`);
const { krajeviLinija } = await import(`${KOD}grad/oznake.ts`);
const { napraviRaskrsnice, zabraneSkretanja } = await import(`${KOD}grad/raskrsnica.ts`);
const { gradZaSudiju } = await import(`${KOD}grad/sudija.ts`);
const { nasumicnaRuta, odveziRutu, planBota } = await import(`${KOD}grad/botGrad.ts`);
const { rng } = await import(`${KOD}sim/geometry.ts`);

const spisak = JSON.parse(readFileSync(join(JAVNO, "gradovi.json"), "utf8"));
const b = readFileSync(join(JAVNO, spisak.podgorica.fajl));
const paket = procitaj(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const mreza = napraviMrezu(paket);
const povrsina = napraviPovrsinu(mreza);
const odsjeci = krajeviLinija(mreza);
const raskrsnice = napraviRaskrsnice(paket, mreza, odsjeci);
const zabrane = zabraneSkretanja(paket);
const grad = gradZaSudiju(paket, povrsina, raskrsnice, zabrane, odsjeci);

const slucajno = rng(sjeme);
const padovi = [];
let km = 0;
let sati = 0;
let osovinom = 0;
let izvlacenja = 0;
const pocetak = Date.now();
for (let n = 0; n < ruta; n++) {
  const koraci = nasumicnaRuta(mreza, zabrane, slucajno);
  const plan = planBota(povrsina, raskrsnice, odsjeci, koraci);
  // Semafori u različitim fazama: početak vožnje u nasumičnom trenutku ciklusa.
  const t0 = slucajno() * 300;
  const x = odveziRutu(grad, povrsina, plan, t0, nivo, 1800);
  km += x.predjeno / 1000;
  sati += x.trajanje / 3600;
  osovinom += plan.osovinom;
  izvlacenja += x.izvlacenja;
  const ok = x.stigao && x.prekrsaji.length === 0;
  console.log(
    `${ok ? "OK  " : "PAD "} ruta ${String(n).padStart(2)}: ${(plan.put.duzina / 1000).toFixed(1)} km, ` +
      `${x.trajanje.toFixed(0)} s, raskrsnica osovinom ${plan.osovinom}, izvlačenja ${x.izvlacenja}` +
      (x.stigao ? "" : " — NIJE STIGAO") +
      (x.prekrsaji.length ? ` — ${x.prekrsaji.map((p) => `${p.vrsta} ${JSON.stringify(p.detalji)} @${Math.round(p.x)},${Math.round(p.y)}`).join("; ")}` : ""),
  );
  if (!ok) padovi.push(n);
}
console.log(
  `\n${ruta - padovi.length}/${ruta} ruta bez prekršaja i do kraja (nivo ${nivo}, sjeme ${sjeme}); ` +
    `${km.toFixed(1)} km, ${sati.toFixed(2)} h vožnje; osovinom ${osovinom}, izvlačenja ${izvlacenja}; ` +
    `${((Date.now() - pocetak) / 1000).toFixed(0)} s računanja.`,
);
if (padovi.length) console.log(`Pale rute: ${padovi.join(", ")}`);
process.exit(padovi.length ? 1 : 0);
