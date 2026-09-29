/**
 * Fuzz vožnje: sto sjemena × tri rute × najgušći saobraćaj.
 *
 * Šta se traži, kako zadatak kaže: bez zaglavljivanja, savršen vozač bez
 * prekršaja, i prosječan broj vozila u prozoru unutar ciljanog opsega.
 *  - Vozač koji poštuje pravila — i koji pretiče kad pravila to dopuštaju —
 *    mora svaku rutu da preveze do kraja BEZ IJEDNOG PREKRŠAJA. Svaki pad je
 *    greška u svijetu ili u pravilima, ne u vozaču (vidi `lib/game/sim/vozac.ts`).
 *  - Vožnja koja ne stigne do kraja u roku je zaglavljivanje.
 *  - Prosjek vozila u prozoru gustine, po ruti preko svih sjemena, mora biti u
 *    `SAOBRACAJ_U_PROZORU` za taj nivo.
 *
 * Ne stoji među testovima jer traje minutima: tri stotine cijelih vožnji, svaka
 * po pola sata simuliranog vremena. Pokreće se ručno:
 *
 *     npm run test:fuzz                 # 100 sjemena, nivo 5
 *     npm run test:fuzz -- 20 3         # 20 sjemena, nivo 3
 *
 * Izlaz je 0 kad je sve prošlo, 1 kad nije — i tada se ispisuje tačno koja
 * ruta, koje sjeme i koji prekršaj, pa se pad može ponoviti jednom vožnjom.
 */

import { readFileSync } from "node:fs";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";

const KOD = new URL("../lib/game/", import.meta.url).href;
const KORIJEN = fileURLToPath(new URL("..", import.meta.url));

/** Rute iz zadatka. */
const RUTE = [
  ["budva", "kolasin"],
  ["herceg-novi", "rozaje"],
  ["ulcinj", "pljevlja"],
];

const sjemena = Number(process.argv[2] ?? 100);
const nivo = Number(process.argv[3] ?? 5);
const radnika = Number(process.argv[4] ?? Math.max(1, Math.min(8, os.cpus().length - 1)));

/** Jedan radnik: vozi zadate parove (ruta, sjeme) i javlja rezultat. */
async function radi(dio, ukupno) {
  const { EDGES, NODES } = await import(`${KOD}road/roadGraph.ts`);
  const { parseGeometry } = await import(`${KOD}road/edgeGeometry.ts`);
  const { parseKicma } = await import(`${KOD}road/kicma.ts`);
  const { napraviRutu, nadjiRutu } = await import(`${KOD}world/ruta.ts`);
  const { rutaScenario, uProzoruGustine } = await import(`${KOD}world/svijet.ts`);
  const { createWorld, step, PLAYER_ID } = await import(`${KOD}sim/world.ts`);
  const { vozacRute } = await import(`${KOD}sim/vozac.ts`);

  const geom = new Map(
    EDGES.map((e) => [
      e.id,
      parseGeometry(JSON.parse(readFileSync(`${KORIJEN}/public/data/osm/edgeGeometry/${e.id}.json`, "utf8"))),
    ]),
  );
  const kicme = new Map(
    NODES.filter((n) => n.kind === "opstina").map((n) => [
      n.id,
      parseKicma(JSON.parse(readFileSync(`${KORIJEN}/public/data/osm/kicme/${n.id}.json`, "utf8"))),
    ]),
  );
  const rute = new Map(RUTE.map(([a, b]) => [`${a}-${b}`, napraviRutu(nadjiRutu(a, b), geom, kicme)]));

  for (let i = 0; i < RUTE.length * sjemena; i++) {
    if (i % ukupno !== dio) continue;
    const [a, b] = RUTE[Math.floor(i / sjemena)];
    const seed = (i % sjemena) + 1;
    const r = rute.get(`${a}-${b}`);
    const s = rutaScenario(r, seed, nivo);
    const w = createWorld(s, seed);
    const bot = vozacRute({ pretice: true });
    let koraka = 0;
    let preticanja = 0;
    let uKontri = 0;
    let bio = false;
    let nan = false;
    let zbirGustine = 0;
    let uzoraka = 0;
    while (w.outcome === "running" && koraka < 500000) {
      step(w, s, bot(w, s));
      koraka += 1;
      // Gustina se mjeri svakih deset sekundi, i samo dok prozor cijeli leži
      // na putu — na krajevima dio prozora pada van njega.
      if (koraka % 600 === 0) {
        const g = uProzoruGustine(w, s.template);
        if (g.cijeli) {
          zbirGustine += g.vozila;
          uzoraka += 1;
        }
      }
      const me = w.vehicles.find((v) => v.id === PLAYER_ID);
      if (!Number.isFinite(me.s) || !Number.isFinite(me.v) || !Number.isFinite(me.lateral ?? 0)) {
        nan = true;
        break;
      }
      const kontra = w.volan.kontraT > 0;
      uKontri = Math.max(uKontri, w.volan.kontraT);
      if (kontra && !bio) preticanja += 1;
      bio = kontra;
    }
    process.send({
      ruta: `${a}-${b}`,
      seed,
      outcome: w.outcome,
      nan,
      t: w.t,
      preticanja,
      uKontri,
      gustina: uzoraka > 0 ? zbirGustine / uzoraka : null,
      prekrsaji: w.violations.map((v) => ({ type: v.type, severity: v.severity ?? "fail", details: v.details })),
    });
  }
}

/** Sakupljanje: pokreni radnike i saberi ono što jave. */
async function skupi() {
  const pocetak = Date.now();
  const ukupno = RUTE.length * sjemena;
  console.log(`fuzz: ${RUTE.length} rute × ${sjemena} sjemena, nivo ${nivo}, ${radnika} radnika`);
  const nalazi = [];
  const po = new Map(
    RUTE.map(([a, b]) => [`${a}-${b}`, { voznji: 0, preticanja: 0, najduze: 0, minuta: 0, gustine: [] }]),
  );
  let gotovo = 0;

  await Promise.all(
    Array.from({ length: radnika }, (_, dio) => {
      const dijete = fork(fileURLToPath(import.meta.url), [String(sjemena), String(nivo), String(radnika)], {
        execArgv: [...process.execArgv, "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON"],
        env: { ...process.env, FUZZ_DIO: String(dio), FUZZ_RADNIKA: String(radnika) },
      });
      return new Promise((gotov, greska) => {
        dijete.on("message", (m) => {
          gotovo += 1;
          const p = po.get(m.ruta);
          p.voznji += 1;
          p.preticanja += m.preticanja;
          p.najduze = Math.max(p.najduze, m.uKontri);
          p.minuta += m.t / 60;
          if (m.gustina !== null) p.gustine.push(m.gustina);
          const lose = m.outcome !== "passed" || m.nan || m.prekrsaji.length > 0;
          if (lose) nalazi.push(m);
          if (gotovo % 15 === 0 || gotovo === ukupno) {
            const sek = ((Date.now() - pocetak) / 1000).toFixed(0);
            process.stdout.write(`\r  ${gotovo}/${ukupno} voznji, ${nalazi.length} padova, ${sek} s   `);
          }
        });
        dijete.on("exit", (kod) => (kod === 0 ? gotov() : greska(new Error(`radnik pao: ${kod}`))));
      });
    }),
  );

  console.log("");
  const { SAOBRACAJ_U_PROZORU } = await import(`${KOD}sim/config.ts`);
  const [najmanje, najvise] = SAOBRACAJ_U_PROZORU[nivo];
  const gustinaVan = [];
  for (const [ruta, p] of po) {
    const g = p.gustine;
    const sred = g.reduce((a, x) => a + x, 0) / Math.max(1, g.length);
    const u = sred >= najmanje && sred <= najvise;
    if (!u) gustinaVan.push(`${ruta}: ${sred.toFixed(1)}`);
    console.log(
      `  ${ruta.padEnd(20)} ${String(p.voznji).padStart(4)} voznji, ` +
        `${p.preticanja} preticanja, najduze u kontri ${p.najduze.toFixed(1)} s, ` +
        `prosjek ${(p.minuta / Math.max(1, p.voznji)).toFixed(1)} min, ` +
        `gustina ${sred.toFixed(1)} (${Math.min(...g).toFixed(1)}-${Math.max(...g).toFixed(1)}; cilj ${najmanje}-${najvise})${u ? "" : " VAN"}`,
    );
  }

  if (gustinaVan.length > 0) {
    console.log(`\ngustina van ciljanog opsega ${najmanje}-${najvise}: ${gustinaVan.join(", ")}`);
  }
  if (nalazi.length === 0 && gustinaVan.length === 0) {
    console.log(`\nsve proslo: ${ukupno} voznji bez ijednog prekrsaja (${((Date.now() - pocetak) / 1000).toFixed(0)} s)`);
    return 0;
  }
  if (nalazi.length === 0) return 1;
  console.log(`\npalo ${nalazi.length} od ${ukupno}:`);
  for (const m of nalazi.slice(0, 40)) {
    const sta = m.nan ? "NaN" : m.outcome !== "passed" ? m.outcome : "";
    const p = m.prekrsaji.map((x) => `${x.type} (${x.details ?? ""})`).join("; ");
    console.log(`  ${m.ruta} sjeme ${m.seed}: ${[sta, p].filter(Boolean).join(" | ")}`);
  }
  if (nalazi.length > 40) console.log(`  ... i jos ${nalazi.length - 40}`);
  return 1;
}

if (process.env.FUZZ_DIO !== undefined) {
  await radi(Number(process.env.FUZZ_DIO), Number(process.env.FUZZ_RADNIKA));
} else {
  process.exitCode = await skupi();
}
