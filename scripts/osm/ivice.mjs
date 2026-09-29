/**
 * Korak 3: svakoj ivici grafa pridruzi stvarnu geometriju iz OSM-a.
 *
 * Pokretanje: `npm run osm:ivice` (poslije `osm:povuci`).
 *
 * Postupak: od OSM puteva se napravi mreza (zajednicki cvor = veza), oba kraja
 * ivice iz `roadGraph.ts` se prilijepe za najblizu tacku na putu odgovarajuceg
 * ranga, i izmedju njih se trazi najkraci put Dijkstrom. Tezina nije cista
 * duzina nego duzina puta kazna po rangu, pa ruta ide magistralom a ne
 * precicom kroz selo — isto kao sto bi covjek vozio.
 *
 * NISTA SE NE PRIHVATA AUTOMATSKI. Ako ruta ne postoji, ili je duza od
 * `GORNJA_GRANICA` odnosno kraca od `DONJA_GRANICA` u odnosu na kilometrazu iz
 * grafa, geometrija se i dalje upise ali sa `status: "zaProvjeru"`, i ivica ode
 * na spisak u `izvjestaj/ivice-za-provjeru.md`. Graf se ne dira: ako OSM kaze
 * jedno a graf drugo, to je pitanje za skolu, ne za skriptu.
 *
 * Podaci: (c) OpenStreetMap contributors, ODbL.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { EDGES, NODES, nodeById } from "./lib/graf.mjs";
import { KES } from "./lib/overpass.mjs";
import { uMetre, uStepene } from "./lib/proj.mjs";
import { dm, duzina, uprosti } from "./lib/geom.mjs";
import {
  kandidati as kandidatiZa,
  napraviMrezu,
  rangPuta,
  trazi,
} from "./lib/rutiranje.mjs";
import { prikljucci } from "./lib/prikljucci.mjs";

const IZLAZ = join(process.cwd(), "public", "data", "osm", "edgeGeometry");
const IZVJESTAJ = join(process.cwd(), "scripts", "osm", "izvjestaj");

/** Ruta duza od ovoga puta kilometraze iz grafa ide na provjeru. */
const GORNJA_GRANICA = 1.25;
/** Ruta kraca od ovoga puta kilometraze iz grafa ide na provjeru. */
const DONJA_GRANICA = 0.75;
/** Ocigledno pogresna ruta — drugi koridor, ne mjerna nepreciznost. */
const OCIGLEDNO = 1.5;
/**
 * Koliko autoputa smije da udje u rutu ivice koja u grafu nije autoput.
 *
 * Graf razlikuje `autoput` od ostalih vrsta, pa ivica koja je unijeta kao
 * planinski put ne smije da se vozi autoputem — makar joj se kilometraza
 * poklopila.
 */
const UDIO_AUTOPUTA = 0.2;

/** Dokle se cvor grafa smije prilijepiti za put [m]. */
const DOMET_LIJEPLJENJA = 6000;
/** Koliko se kandidata za lijepljenje drzi po kraju ivice. */
const KANDIDATA = 8;
/** Najmanji razmak medju kandidatima [m] — inace su svih osam ista raskrsnica. */
const RAZMAK_KANDIDATA = 300;
/**
 * Koliko puta skuplje od voznje se racuna rastojanje do puta.
 *
 * Lijepljenje nije voznja nego priznanje da koordinata cvora nije tacna, pa
 * mora da boli — ali ne smije biti zabranjeno. Kod Kamenara je najbliza tacka
 * bila na M-11, koja se u podacima ne spaja sa M-1, pa je ruta do Herceg Novog
 * isla oko cijelog zaliva: 57 km umjesto 15. Sa vise kandidata i ovom cijenom,
 * M-1 na 600 m pobjedjuje jer stedi cetrdeset kilometara.
 */
const MNOZILAC_LIJEPLJENJA = 3;
/** Uproscavanje geometrije ivice [m]. */
const TOL = 5;
/**
 * Koliko od krajeva ivice se prikljucci ne biljeze [m].
 *
 * Kraj ivice je u gradu, a gradski dio se u igri vozi kicmom, ne ivicom. Tamo
 * je svaki cvor raskrsnica, i to nije ono sto se trazi — trazi se sporedni put
 * koji izlazi na magistralu izmedju dva mjesta.
 */
const PRIKLJUCCI_OD_KRAJA = 150;
/** Preko ovoga se koordinata cvora prijavljuje kao sumnjiva [m]. */
const PRAG_KOORDINATE = 1000;
/**
 * Koliko smiju da se razidju mjesta na koja se isti cvor prilijepi [m].
 *
 * Kad dvije ivice istog cvora zavrse na razlicitim mjestima, koordinata je
 * dvosmislena — najcesce je tacka pala izmedju dvije obale ili dva puta koji se
 * ne spajaju. Kod Kamenara je bas to: koordinata (42.46, 18.68) pada izmedju
 * dvije obale tjesnaca, pa je jedna ivica hvatala Kamenare a druga Lepetane,
 * udaljene 900 m preko vode.
 */
const PRAG_RASIPANJA = 400;

/** Kandidati za lijepljenje cvora grafa, sa parametrima ove skripte. */
const kandidati = (cvor, mreza, opcije = {}) =>
  kandidatiZa(uMetre(cvor.lat, cvor.lon), mreza, {
    ...opcije,
    domet: DOMET_LIJEPLJENJA,
    koliko: KANDIDATA,
    razmak: RAZMAK_KANDIDATA,
  });

// -- glavno ------------------------------------------------------------------

/** Oznake i jednosmjernost sporednih puteva — vidi `lib/prikljucci.mjs`. */
const oznakeSporednih = new Map();
const jednosmjerniSporedni = new Set();

async function glavno() {
  const put = join(KES, "putevi.json");
  if (!existsSync(put)) throw new Error("Nema putevi.json — pokreni prvo: npm run osm:povuci");
  console.log("Ucitavam mrezu puteva...");
  const sirovo = JSON.parse(await readFile(put, "utf8"));

  const mreza = napraviMrezu(sirovo.elements);
  console.log(`  cvorova: ${mreza.susjedi.size}, segmenata: ${mreza.ivica}`);

  // Seoski i stambeni putevi: ne ulaze u trazenje rute, nego samo pokazuju gdje
  // na magistralu izlazi sporedni put. Bez njih se vide samo raskrsnice sa
  // regionalnim putem. Ako keša nema, prikljucci se racunaju bez njih.
  const putSporedni = join(KES, "sporedni.json");
  let sporedna = null;
  if (existsSync(putSporedni)) {
    const sp = JSON.parse(await readFile(putSporedni, "utf8"));
    sporedna = napraviMrezu(sp.elements, { unclassified: 1, residential: 1 });
    for (const el of sp.elements) {
      if (el.type !== "way") continue;
      if (el.tags?.ref) oznakeSporednih.set(el.id, el.tags.ref);
      if (el.tags?.oneway === "yes") jednosmjerniSporedni.add(el.id);
    }
    console.log(`  sporednih cvorova: ${sporedna.susjedi.size}`);
  } else {
    console.log("  (nema sporedni.json — prikljucci samo sa regionalnim i vecim putevima)");
  }

  // Oznake puteva (M-2, E65...) — po njima se koridor prepoznaje na oko.
  const oznake = new Map();
  // Jednosmjerni putevi — po njima se druga kolovozna traka razlikuje od
  // sporednog puta (vidi `lib/prikljucci.mjs`).
  const jednosmjerni = new Set();
  // Rang svake ivice — po njemu se vidi od cega je ruta sastavljena.
  const rangovi = new Map();
  for (const el of sirovo.elements) {
    if (el.type !== "way") continue;
    if (el.tags?.ref) oznake.set(el.id, el.tags.ref);
    if (el.tags?.oneway === "yes" || el.tags?.junction === "roundabout") jednosmjerni.add(el.id);
    const r = rangPuta(el.tags);
    if (r) rangovi.set(el.id, r);
  }

  console.log("Trazim kandidate za lijepljenje...");
  const lijepljeni = new Map();
  const lijepljeniBezAutoputa = new Map();
  /**
   * Cvorovi cija koordinata odudara od mreze puteva.
   *
   * Sve koordinate u grafu su procjena (`coordsVerified: false`). Kad je
   * najblizi put kilometrima daleko, to nije podatak o putu nego o koordinati —
   * pa se prijavljuje, sa prijedlogom sta bi trebalo da bude.
   */
  const sumnjiveKoordinate = [];
  for (const n of NODES) {
    // Dva skupa: jedan za ivice koje smiju autoputem, drugi za one koje ne
    // smiju. Racunaju se jednom po cvoru, a ne po ivici.
    const k = kandidati(n, mreza);
    lijepljeniBezAutoputa.set(n.id, kandidati(n, mreza, { bezAutoputa: true }));
    if (k.length === 0) {
      console.log(`  ${n.name}: NIJEDAN kandidat (nema puta u ${DOMET_LIJEPLJENJA} m)`);
      sumnjiveKoordinate.push({ n, d: null, predlog: null });
      continue;
    }
    lijepljeni.set(n.id, k);
    if (k[0].d > PRAG_KOORDINATE) {
      const p = mreza.tacke.get(k[0].id);
      sumnjiveKoordinate.push({ n, d: Math.round(k[0].d), predlog: uStepene(p.x, p.y) });
      console.log(
        `  ${n.name}: najblizi put je na ${Math.round(k[0].d)} m — koordinata je vjerovatno netacna`,
      );
    }
  }

  console.log("Trazim rute...");
  await mkdir(IZLAZ, { recursive: true });
  await mkdir(IZVJESTAJ, { recursive: true });

  const nalazi = [];
  /** Gdje je koji cvor zavrsio, po ivicama — vidi `PRAG_RASIPANJA`. */
  const gdjeSePrilijepio = new Map();
  for (const e of EDGES) {
    const bezAutoputa = e.kind !== "autoput";
    const izvor = bezAutoputa ? lijepljeniBezAutoputa : lijepljeni;
    const a = izvor.get(e.a);
    const b = izvor.get(e.b);
    if (!a || !b || a.length === 0 || b.length === 0) {
      nalazi.push({ e, status: "nemaKraja", razlog: "kraj ivice nije prilijepljen za mrezu" });
      continue;
    }
    const ruta = trazi(mreza, a, b, { bezAutoputa, mnozilacLijepljenja: MNOZILAC_LIJEPLJENJA });
    if (!ruta) {
      nalazi.push({ e, status: "nemaRute", razlog: "mreza ne povezuje ova dva kraja" });
      continue;
    }

    const tacke = ruta.cvorovi.map((id) => {
      const p = mreza.tacke.get(id);
      return [p.x, p.y];
    });
    const pocetak = mreza.tacke.get(ruta.cvorovi[0]);
    const kraj = mreza.tacke.get(ruta.cvorovi.at(-1));
    const uprosceno = uprosti(tacke, TOL);
    const metara = duzina(tacke);
    const odnos = metara / (e.km * 1000);
    const refs = [...new Set(ruta.putevi.map((id) => oznake.get(id)).filter(Boolean))];

    // Od cega je ruta sastavljena, po duzini. Duzina moze da se poklopi a da
    // ruta ipak nije ta: `bioce--kolasin` je u grafu planinski put kroz kanjon
    // Morace, a Dijkstra ga je vodio novim autoputem — kilometraza slicna,
    // koridor sasvim drugi.
    const poRangu = {};
    for (const [i, wayId] of ruta.putevi.entries()) {
      const r = rangovi.get(wayId) ?? "ostalo";
      poRangu[r] = (poRangu[r] ?? 0) + (ruta.duzine[i] ?? 0);
    }
    const udioAutoputa = (poRangu.motorway ?? 0) / Math.max(1, metara);

    const status =
      odnos > OCIGLEDNO
        ? "drugiKoridor"
        : e.kind !== "autoput" && udioAutoputa > UDIO_AUTOPUTA
          ? "autoputUmjestoPuta"
          : odnos > GORNJA_GRANICA || odnos < DONJA_GRANICA
            ? "duzinaNeSlaze"
            : "ok";

    await writeFile(
      join(IZLAZ, `${e.id}.json`),
      JSON.stringify({
        id: e.id,
        a: e.a,
        b: e.b,
        status,
        /** Duzina po OSM-u [m] i po grafu [km] — namjerno obje. */
        duzinaM: Math.round(metara),
        kmIzGrafa: e.km,
        odnos: Number(odnos.toFixed(3)),
        oznake: refs,
        poRangu: Object.fromEntries(
          Object.entries(poRangu).map(([k, v]) => [k, Math.round(v)]),
        ),
        // Koliko je svaki kraj morao da se pomjeri do puta, i gdje je zavrsio.
      // Veliko rastojanje ovdje znaci da koordinata cvora u grafu nije tacna —
      // sve su procijenjene (`coordsVerified: false`).
      prilijepljeno: {
        a: { m: Math.round(ruta.pocetni?.d ?? 0), ...uStepene(pocetak.x, pocetak.y) },
        b: { m: Math.round(ruta.krajnji?.d ?? 0), ...uStepene(kraj.x, kraj.y) },
      },
        tacaka: uprosceno.length,
        g: uprosceno.map(([x, y]) => [dm(x), dm(y)]),
        // Sporedni putevi duz ivice, u smjeru od `a` prema `b` — vidi
        // `lib/prikljucci.mjs`. Mjesto je u metrima po istoj mjeri kao `duzinaM`.
        prikljucci: prikljucci(mreza, ruta.cvorovi, {
          odKraja: PRIKLJUCCI_OD_KRAJA,
          putevi: ruta.putevi,
          opis: (w) => ({
            ref: oznake.get(w) ?? oznakeSporednih.get(w) ?? "",
            jednosmjeran: jednosmjerni.has(w) || jednosmjerniSporedni.has(w),
          }),
          sporedna,
        }),
      }),
    );

    nalazi.push({
      e,
      status,
      metara,
      odnos,
      refs,
      lijepljenjeA: Math.round(ruta.pocetni?.d ?? 0),
      lijepljenjeB: Math.round(ruta.krajnji?.d ?? 0),
      udioAutoputa,
    });

    for (const [cvor, tacka] of [
      [e.a, pocetak],
      [e.b, kraj],
    ]) {
      let spisak = gdjeSePrilijepio.get(cvor);
      if (!spisak) {
        spisak = [];
        gdjeSePrilijepio.set(cvor, spisak);
      }
      spisak.push({ tacka, ivica: e.id });
    }
  }

  // -- izvjestaj -------------------------------------------------------------
  const zaProvjeru = nalazi.filter((n) => n.status !== "ok");
  const redovi = [];
  redovi.push("# Ivice grafa: sta OSM kaze");
  redovi.push("");
  redovi.push(`Napravljeno: ${new Date().toISOString()}`);
  redovi.push("");
  redovi.push(
    `Ukupno ivica: ${EDGES.length}. Slaze se sa grafom: ${nalazi.length - zaProvjeru.length}. Za provjeru: ${zaProvjeru.length}.`,
  );
  redovi.push("");
  redovi.push(
    "Skripta NE mijenja graf. Ovo je spisak mjesta na kojima se stvarna mreza puteva",
    "i unijeta kilometraza ne poklapaju, da ih neko pogleda.",
  );
  redovi.push("");
  redovi.push("## Za provjeru");
  redovi.push("");
  if (zaProvjeru.length === 0) {
    redovi.push("Nema — svaka ivica ima rutu u okviru dozvoljenog odstupanja.");
  } else {
    redovi.push(
      "| ivica | graf [km] | OSM [km] | odnos | oznake puta | lijepljenje a/b [m] | sta je |",
    );
    redovi.push("| --- | --- | --- | --- | --- | --- | --- |");
    for (const n of zaProvjeru) {
      const opis = {
        nemaKraja: "kraj nije prilijepljen za mrezu",
        nemaRute: "mreza ne povezuje krajeve",
        drugiKoridor: "ruta ide sasvim druguda",
        duzinaNeSlaze: "duzina odstupa vise od 25%",
        autoputUmjestoPuta: `ruta ide autoputem (${Math.round((n.udioAutoputa ?? 0) * 100)}%), a ivica nije autoput`,
      }[n.status];
      redovi.push(
        `| \`${n.e.id}\` | ${n.e.km} | ${n.metara ? (n.metara / 1000).toFixed(1) : "—"} | ${n.odnos ? n.odnos.toFixed(2) : "—"} | ${n.refs?.join(", ") || "—"} | ${n.lijepljenjeA ?? "—"} / ${n.lijepljenjeB ?? "—"} | ${opis} |`,
      );
    }
  }
  redovi.push("");
  redovi.push("## Koordinate cvorova koje treba provjeriti");
  redovi.push("");
  redovi.push(
    "Sve koordinate u `roadGraph.ts` su procjena (`coordsVerified: false`). Ovdje su",
    "cvorovi kod kojih je najblizi put dalje od " + PRAG_KOORDINATE + " m — to obicno znaci da",
    "koordinata nije tacna, a ne da puta nema. Prijedlog je tacka na koju se cvor",
    "prilijepio; nista nije upisano u graf.",
  );
  redovi.push("");
  if (sumnjiveKoordinate.length === 0) {
    redovi.push("Nema — svaki cvor ima put u blizini.");
  } else {
    redovi.push("| cvor | vrsta | u grafu | najblizi put [m] | prijedlog |");
    redovi.push("| --- | --- | --- | --- | --- |");
    for (const s of sumnjiveKoordinate) {
      redovi.push(
        `| ${s.n.name} | ${s.n.kind} | ${s.n.lat}, ${s.n.lon} | ${s.d ?? "nema u " + DOMET_LIJEPLJENJA + " m"} | ${s.predlog ? `${s.predlog.lat.toFixed(4)}, ${s.predlog.lon.toFixed(4)}` : "—"} |`,
      );
    }
  }
  redovi.push("");
  // Cvorovi koji se na razlicitim ivicama prilijepe na razlicita mjesta.
  const rasuti = [];
  for (const [cvor, spisak] of gdjeSePrilijepio) {
    let najdalje = 0;
    let par = null;
    for (let i = 0; i < spisak.length; i++) {
      for (let j = i + 1; j < spisak.length; j++) {
        const d = Math.hypot(
          spisak[i].tacka.x - spisak[j].tacka.x,
          spisak[i].tacka.y - spisak[j].tacka.y,
        );
        if (d > najdalje) {
          najdalje = d;
          par = [spisak[i], spisak[j]];
        }
      }
    }
    if (najdalje > PRAG_RASIPANJA) rasuti.push({ cvor, najdalje, par });
  }
  rasuti.sort((a, b) => b.najdalje - a.najdalje);

  redovi.push("## Cvorovi koji se rasipaju");
  redovi.push("");
  redovi.push(
    "Isti cvor je na razlicitim ivicama zavrsio na razlicitim mjestima, udaljenim",
    "vise od " + PRAG_RASIPANJA + " m. To znaci da je koordinata dvosmislena — tacka pada izmedju",
    "dva puta koji se ne spajaju, ili izmedju dvije obale.",
  );
  redovi.push("");
  if (rasuti.length === 0) {
    redovi.push("Nema — svaki cvor se svuda prilijepio na isto mjesto.");
  } else {
    redovi.push("| cvor | rasipanje [m] | jedna ivica ga vidi ovdje | druga ovdje |");
    redovi.push("| --- | --- | --- | --- |");
    for (const r of rasuti) {
      const a = uStepene(r.par[0].tacka.x, r.par[0].tacka.y);
      const b = uStepene(r.par[1].tacka.x, r.par[1].tacka.y);
      redovi.push(
        `| ${nodeById(r.cvor)?.name ?? r.cvor} | ${Math.round(r.najdalje)} | ${a.lat.toFixed(4)}, ${a.lon.toFixed(4)} (\`${r.par[0].ivica}\`) | ${b.lat.toFixed(4)}, ${b.lon.toFixed(4)} (\`${r.par[1].ivica}\`) |`,
      );
    }
  }
  redovi.push("");
  redovi.push("## Sve ivice");
  redovi.push("");
  redovi.push("| ivica | vrsta | graf [km] | OSM [km] | odnos | oznake puta | status |");
  redovi.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const n of nalazi) {
    redovi.push(
      `| \`${n.e.id}\` | ${n.e.kind} | ${n.e.km} | ${n.metara ? (n.metara / 1000).toFixed(1) : "—"} | ${n.odnos ? n.odnos.toFixed(2) : "—"} | ${n.refs?.join(", ") || "—"} | ${n.status} |`,
    );
  }
  redovi.push("");

  await writeFile(join(IZVJESTAJ, "ivice-za-provjeru.md"), redovi.join("\n"));

  console.log(
    `\nGotovo: ${nalazi.length - zaProvjeru.length} ivica se slaze, ${zaProvjeru.length} za provjeru.`,
  );
  console.log("Spisak: scripts/osm/izvjestaj/ivice-za-provjeru.md");
}

await glavno();
