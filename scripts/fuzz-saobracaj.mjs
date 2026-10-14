/**
 * Gradski saobraćaj bez igrača (zadatak, faza 6, odjeljak 8: 200 sjemena ×
 * 5 min gradskog saobraćaja na nivou 5 — zastoja 0, sudara vozilo–vozilo 0).
 *
 * Svako sjeme: prozor oko „igrača" koji putuje gradom (tačka ide nasumičnom
 * rutom, kao auto u gradskoj vožnji), vozila se pojavljuju i nestaju oko
 * njega i voze svoje rute. Mjeri se:
 *   - sudar: tijela dva vozila se preklapaju;
 *   - zastoj: vidi `saobracaj.ts` — svaki je greška;
 *   - prekršaj: drugi vozači voze po istim pravilima, pa im sudi isti sudija;
 *   - udar pješaka (stavka 8): oko „igrača" su i pješaci (60), vozila im
 *     ustupaju — svaki dodir vozila i pješaka je greška.
 *
 * Pokretanje:
 *
 *     npm run test:fuzz:saobracaj               # 200 sjemena × 300 s
 *     npm run test:fuzz:saobracaj -- 10 60 7    # 10 sjemena × 60 s, od sjemena 7
 *     npm run test:fuzz:saobracaj -- 1 300 42 --trag   # jedno sjeme, sa tragom
 *
 * Izlaz je 0 kad je sve čisto, 1 kad nije — sa sjemenom, vremenom i
 * vozilima, da se ponovi jednim pokretanjem.
 */

import { existsSync, readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

const KOD = new URL("../lib/game/", import.meta.url).href;
const JAVNO = fileURLToPath(new URL("../public/data/grad/", import.meta.url));

async function svijet() {
  const { procitaj } = await import(`${KOD}grad/paket.ts`);
  const { procitajOverlay } = await import(`${KOD}grad/overlay.ts`);
  const { svijetGrada } = await import(`${KOD}grad/svijet.ts`);
  const spisak = JSON.parse(readFileSync(join(JAVNO, "gradovi.json"), "utf8"));
  const b = readFileSync(join(JAVNO, spisak.podgorica.fajl));
  const osm = procitaj(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const fajl = join(JAVNO, "overrides", "podgorica.json");
  const overlay = existsSync(fajl) ? procitajOverlay(JSON.parse(readFileSync(fajl, "utf8"))) : null;
  const zone = JSON.parse(readFileSync(join(JAVNO, "cityZones", "podgorica.json"), "utf8")).zone;
  return svijetGrada(osm, overlay, zone);
}

/** Jedno sjeme: `trajanje` sekundi saobraćaja; vraća izvještaj. */
async function sjeme(s, trajanje, trag) {
  const sv = await svijet();
  const { noviSaobracaj, korakSaobracaja, parkirani, tijeloNpc, autobusiUPolasku } = await import(`${KOD}grad/saobracaj.ts`);
  const { linijeAutobusa } = await import(`${KOD}grad/autobusi.ts`);
  const { nasumicnaRuta, planBota } = await import(`${KOD}grad/botGrad.ts`);
  const { noviSudija, sudi } = await import(`${KOD}grad/sudija.ts`);
  const { noviPjesaci, korakPjesaka, udaraPjesaka } = await import(`${KOD}grad/pjesaci.ts`);
  const { rng, pointAt, rectCorners, polygonsOverlap } = await import(`${KOD}sim/geometry.ts`);
  const { DT, CAR_LENGTH, CAR_WIDTH, GRAD_PRILAZ_DO } = await import(`${KOD}sim/config.ts`);

  // Put „igrača": nasumične rute nadovezane, 10 m/s.
  const sl = rng(s * 7919 + 1);
  const putanje = [];
  for (let i = 0; i < 4; i++) putanje.push(planBota(sv.zaSudiju, nasumicnaRuta(sv.mreza, sv.raskrsnice, sv.zabrane, sl)).put);
  let putI = 0;
  let putS = 0;
  const fokus = () => pointAt(putanje[putI].tacke, putanje[putI].cum, putS);

  const sb = noviSaobracaj(sv, s, 1);
  // Najveća gustina (40 vozila): zadatak traži nula zastoja i pri punom gradu.
  sb.gustinaVanZona = 3;
  // Autobusi po linijama iz OSM-a (stavka 8c).
  const fajlLinija = join(JAVNO, "linije", "podgorica.json");
  sb.linije = linijeAutobusa(sv, existsSync(fajlLinija) ? JSON.parse(readFileSync(fajlLinija, "utf8")) : null);
  // Pješaci: najviše (gustina 3 = 60), na istom satu kao saobraćaj.
  const pj = noviPjesaci(sv, s, 1);
  pj.gustinaVanZona = 3;
  sb.pjesaci = pj;
  const udari = [];
  let najviseP = 0;
  const sudije = new Map();
  const sudar = [];
  const prekrsaji = [];
  let najduziKorak = 0;
  let ukupno = 0;
  let koraka = 0;
  let najvise = 0;
  const pocetak = performance.now();
  for (let t = 0; t < trajanje; t += DT) {
    putS += 10 * DT;
    if (putS > putanje[putI].duzina) {
      putI = (putI + 1) % putanje.length;
      putS = 0;
    }
    const t0 = performance.now();
    korakSaobracaja(sb, fokus(), null);
    korakPjesaka(pj, fokus(), sb.npc.map(tijeloNpc));
    const dt = performance.now() - t0;
    najviseP = Math.max(najviseP, pj.lista.length);
    // Udar pješaka: tijelo vozila dodiruje pješaka.
    for (const n of sb.npc) {
      const { duzina, sirina } = n.plan.vozilo;
      for (const x of pj.lista) {
        if (Math.abs(x.x - n.x) > duzina || Math.abs(x.y - n.y) > duzina) continue;
        if (!udaraPjesaka({ x: n.x, y: n.y, ugao: n.ugao, duzina, sirina }, x)) continue;
        const kljuc = `${n.id}-${x.id}`;
        if (!udari.some((u) => u.kljuc === kljuc)) udari.push({ kljuc, t: sb.t.toFixed(1), vozilo: n.id, pjesak: x.id, x: x.x.toFixed(1), y: x.y.toFixed(1), stanje: x.stanje, v: n.v.toFixed(1), razlog: JSON.stringify(n.razlog) });
      }
    }
    if (koraka > 120) najduziKorak = Math.max(najduziKorak, dt);
    ukupno += dt;
    koraka++;
    najvise = Math.max(najvise, sb.npc.length);

    // Sudari: tijela se preklapaju — i sa parkiranima (stavka 7e).
    const tijela = [...sb.npc, ...parkirani(sb)].map((n) => {
      const d = n.plan?.vozilo ?? { duzina: CAR_LENGTH, sirina: CAR_WIDTH };
      return { n, d, k: rectCorners({ x: n.x, y: n.y }, { x: Math.cos(n.ugao), y: Math.sin(n.ugao) }, d.duzina, d.sirina) };
    });
    for (let i = 0; i < tijela.length; i++) {
      for (let j = i + 1; j < tijela.length; j++) {
        const a = tijela[i].n;
        const b = tijela[j].n;
        // Dva parkirana se ne sudaraju (mjesta su razmaknuta).
        if (a.razlog === undefined && b.razlog === undefined) continue;
        if (a.nivo !== b.nivo || Math.hypot(a.x - b.x, a.y - b.y) > (tijela[i].d.duzina + tijela[j].d.duzina) / 2 + 0.5) continue;
        if (!polygonsOverlap(tijela[i].k, tijela[j].k)) continue;
        const kljuc = `${a.id}-${b.id}`;
        if (!sudar.some((x) => x.kljuc === kljuc)) {
          sudar.push({ kljuc, t: sb.t.toFixed(1), a: a.id, b: b.id, x: a.x.toFixed(1), y: a.y.toFixed(1), razlogA: JSON.stringify(a.razlog), razlogB: JSON.stringify(b.razlog), va: a.v.toFixed(1), vb: b.v.toFixed(1) });
        }
      }
    }

    // Sudija svakom vozilu: drugi voze po istim pravilima. Sudi se od prve
    // raskrsnice, i to van raskrsnica (15 m prije sljedeće): na mjestu pojave
    // sudija ne zna odakle je auto došlo.
    for (const n of sb.npc) {
      let sud = sudije.get(n.id);
      // … i ne na prilazu stop-liniji (sudija mora vidjeti zeleno pa žuto).
      const linijaBlizu = n.plan.linije.some((l, i) => !n.prosao[i] && l.s - n.s < GRAD_PRILAZ_DO + 5);
      if (!sud && (n.prolaz < 1 || linijaBlizu || (n.plan.prolazi[n.prolaz]?.od ?? Infinity) - n.s < 15)) continue;
      if (!sud) {
        sud = { s: noviSudija(5, n.plan.vozilo), predjeno: 0 };
        sudije.set(n.id, sud);
      }
      sud.predjeno += n.v * DT;
      const st = { x: n.x, y: n.y, ugao: n.ugao, v: n.v, tocak: 0, rikverc: false, kocnicaStoji: 0, udar: false, predjeno: sud.predjeno + 10 };
      const prije = sud.s.prekrsaji.length;
      // Zaustavio ga je saobraćaj (odluka korisnika 2026-09-30): vozilo
      // ispred, ustupanje, ili zatvoren izlaz iz raskrsnice. I kad sudija još
      // ne vodi prolaz: na rubu raskrsnice auto je za parkiranje već u njoj.
      // Autobus na stajalištu i vozilo koje propušta autobus (stavka 8c) ne parkiraju.
      const zbogSaobracaja = ["vozilo", "ustupa", "izlaz", "pjesak", "stajaliste", "autobus"].includes(n.razlog.vrsta);
      sudi(sv.zaSudiju, sud.s, st, sb.t, n.zmigavac, zbogSaobracaja, pj, autobusiUPolasku(sb));
      for (const p of sud.s.prekrsaji.slice(prije)) prekrsaji.push({ id: n.id, t: sb.t.toFixed(1), vrsta: p.vrsta, x: p.x.toFixed(1), y: p.y.toFixed(1), detalji: JSON.stringify(p.detalji), razlog: JSON.stringify(n.razlog) });
    }
    for (const id of [...sudije.keys()]) if (!sb.npc.some((n) => n.id === id)) sudije.delete(id);
  }
  return {
    sjeme: s,
    trajanje: ((performance.now() - pocetak) / 1000).toFixed(1),
    korakMs: (ukupno / koraka).toFixed(3),
    najduziKorakMs: najduziKorak.toFixed(1),
    najvise,
    metrika: sb.metrika,
    pjesaci: { najvise: najviseP, ...pj.metrika },
    udari,
    sudari: sudar,
    zastoji: sb.zastoji,
    prekrsaji,
    trag: trag ? sb.npc.map((n) => `${n.id} s=${n.s.toFixed(1)} v=${n.v.toFixed(1)} ${JSON.stringify(n.razlog)}`) : undefined,
  };
}

if (!isMainThread) {
  const { sjemena, trajanje, trag } = workerData;
  for (const s of sjemena) parentPort.postMessage(await sjeme(s, trajanje, trag));
} else {
  const broj = Number(process.argv[2] ?? 200);
  const trajanje = Number(process.argv[3] ?? 300);
  const prvo = Number(process.argv[4] ?? 1);
  const trag = process.argv.includes("--trag");
  const sjemena = Array.from({ length: broj }, (_, i) => prvo + i);
  const radnika = Math.min(sjemena.length, Math.max(1, availableParallelism() - 1));
  console.log(`Saobraćaj: ${broj} sjemena × ${trajanje} s, ${radnika} radnika.`);
  const izvjestaji = [];
  await Promise.all(
    Array.from({ length: radnika }, (_, w) =>
      new Promise((ok, ne) => {
        const moja = sjemena.filter((_, i) => i % radnika === w);
        const radnik = new Worker(new URL(import.meta.url), { workerData: { sjemena: moja, trajanje, trag }, execArgv: process.execArgv });
        radnik.on("message", (iz) => {
          izvjestaji.push(iz);
          const los = iz.sudari.length + iz.zastoji.length + iz.prekrsaji.length + iz.udari.length;
          console.log(
            `sjeme ${iz.sjeme}: ${los === 0 ? "ok" : "PAD"} · vozila do ${iz.najvise}, pojavilo ${iz.metrika.pojavljeno}, stiglo ${iz.metrika.stiglo}, parkiralo ${iz.metrika.parkiralo}, krugova ${iz.metrika.krugova} · autobusa ${iz.metrika.autobusa}, stajanja ${iz.metrika.stajalista} · pješaka do ${iz.pjesaci.najvise}, prešlo ${iz.pjesaci.preslo} · sudara ${iz.sudari.length}, zastoja ${iz.zastoji.length}, prekršaja ${iz.prekrsaji.length}, udarenih pješaka ${iz.udari.length} · korak ${iz.korakMs} ms (najduži ${iz.najduziKorakMs}) · ${iz.trajanje} s`,
          );
          for (const x of iz.sudari.slice(0, 3)) console.log(`   sudar ${JSON.stringify(x)}`);
          for (const x of iz.udari.slice(0, 3)) console.log(`   udar pješaka ${JSON.stringify(x)}`);
          for (const x of iz.zastoji.slice(0, 3)) console.log(`   zastoj ${JSON.stringify(x)}`);
          for (const x of iz.prekrsaji.slice(0, 5)) console.log(`   prekršaj ${JSON.stringify(x)}`);
          if (iz.trag) for (const x of iz.trag) console.log(`   ${x}`);
        });
        radnik.on("error", ne);
        radnik.on("exit", ok);
      }),
    ),
  );
  const pali = izvjestaji.filter((x) => x.sudari.length + x.zastoji.length + x.prekrsaji.length + x.udari.length > 0);
  const zbir = (f) => izvjestaji.reduce((s, x) => s + f(x), 0);
  console.log(
    `\nUkupno: ${izvjestaji.length - pali.length}/${izvjestaji.length} čisto · sudara ${zbir((x) => x.sudari.length)}, zastoja ${zbir((x) => x.zastoji.length)}, prekršaja ${zbir((x) => x.prekrsaji.length)}, udarenih pješaka ${zbir((x) => x.udari.length)}, krugova prvenstva ${zbir((x) => x.metrika.krugova)}, vozila stiglo ${zbir((x) => x.metrika.stiglo)}, parkiralo ${zbir((x) => x.metrika.parkiralo)}, autobusa ${zbir((x) => x.metrika.autobusa)}, stajanja na stajalištu ${zbir((x) => x.metrika.stajalista)}, pješaka prešlo ${zbir((x) => x.pjesaci.preslo)}.`,
  );
  if (pali.length > 0) console.log(`Pala sjemena: ${pali.map((x) => x.sjeme).join(", ")}`);
  process.exit(pali.length > 0 ? 1 : 0);
}
