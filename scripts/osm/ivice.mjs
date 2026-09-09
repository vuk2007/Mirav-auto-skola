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
import { Gomila } from "./lib/gomila.mjs";

const IZLAZ = join(process.cwd(), "public", "data", "osm", "edgeGeometry");
const IZVJESTAJ = join(process.cwd(), "scripts", "osm", "izvjestaj");

/**
 * Kazna po rangu puta.
 *
 * Nije brzina nego sklonost: sa ovim tezinama Dijkstra bira magistralu i onda
 * kad je za koji kilometar duza od lokalnog puta. Bez kazni ruta Podgorica —
 * Cetinje umije da sidje na stari put kroz sela, koji jeste kraci u metrima ali
 * nije put kojim se ide.
 */
const KAZNA = {
  motorway: 1.0,
  trunk: 1.0,
  primary: 1.1,
  secondary: 1.35,
  tertiary: 1.8,
};

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
 * mora da bolí — ali ne smije biti zabranjeno. Kod Kamenara je najbliza tacka
 * bila na M-11, koja se u podacima ne spaja sa M-1, pa je ruta do Herceg Novog
 * isla oko cijelog zaliva: 57 km umjesto 15. Sa vise kandidata i ovom cijenom,
 * M-1 na 600 m pobjeđuje jer stedi cetrdeset kilometara.
 */
const MNOZILAC_LIJEPLJENJA = 3;
/** Uproscavanje geometrije ivice [m]. */
const TOL = 5;
/** Preko ovoga se koordinata cvora prijavljuje kao sumnjiva [m]. */
const PRAG_KOORDINATE = 1000;
/**
 * Koliko smiju da se razidju mjesta na koja se isti cvor prilijepi [m].
 *
 * Kad dvije ivice istog cvora zavrse na razlicitim mjestima, koordinata je
 * dvosmislena — najcesce je tacka pala izmedju dvije obale ili dva puta koji se
 * ne spajaju. Kod Kamenara je bas to: koordinata (42.46, 18.68) pada izmedju
 * dvije obale tjesnaca, pa je jedna ivica hvatala Kamenare a druga Lepetane,
 * udaljene 900 m preko vode. Ni jedno ni drugo lijepljenje nije bilo dalje od
 * kilometra, pa ih `PRAG_KOORDINATE` nije uhvatio — ovo jeste.
 */
const PRAG_RASIPANJA = 400;

const rang = (tags = {}) => {
  const h = tags.highway ?? "";
  const osnovni = h.endsWith("_link") ? h.slice(0, -5) : h;
  return KAZNA[osnovni] === undefined ? null : osnovni;
};

// -- mreza -------------------------------------------------------------------

/**
 * Mreza za trazenje puta.
 *
 * `susjedi` je za svaki OSM cvor spisak `[drugiCvor, tezina, duzina, wayId]`.
 * Graf je neusmjeren: jednosmjerne ulice se ne postuju jer se trazi KORIDOR, ne
 * vozni nalog — a jednosmjerni rezim u gradu bi rutu izmedju dva grada samo
 * nasumicno produzio.
 */
function napraviMrezu(elements) {
  const tacke = new Map();
  for (const el of elements) {
    if (el.type === "node") tacke.set(el.id, uMetre(el.lat, el.lon));
  }

  const susjedi = new Map();
  const rangCvora = new Map();
  const veza = (a, b, tezina, d, wayId, r) => {
    let s = susjedi.get(a);
    if (!s) {
      s = [];
      susjedi.set(a, s);
    }
    s.push([b, tezina, d, wayId, r]);
  };

  let ivica = 0;
  for (const el of elements) {
    if (el.type !== "way" || !el.nodes) continue;
    const r = rang(el.tags);
    if (!r) continue;
    const kazna = KAZNA[r];
    for (let i = 1; i < el.nodes.length; i++) {
      const a = el.nodes[i - 1];
      const b = el.nodes[i];
      const pa = tacke.get(a);
      const pb = tacke.get(b);
      if (!pa || !pb) continue;
      const d = Math.hypot(pb.x - pa.x, pb.y - pa.y);
      if (d === 0) continue;
      veza(a, b, d * kazna, d, el.id, r);
      veza(b, a, d * kazna, d, el.id, r);
      ivica += 1;
      for (const c of [a, b]) {
        const stari = rangCvora.get(c);
        if (stari === undefined || kazna < stari) rangCvora.set(c, kazna);
      }
    }
  }
  // Cvorovi do kojih se dolazi ISKLJUCIVO autoputem. Za ivicu koja nije autoput
  // takav cvor nije upotrebljiv kao pocetak ni kao kraj.
  const samoAutoput = new Set();
  for (const [id, veze] of susjedi) {
    if (veze.every((v) => v[4] === "motorway")) samoAutoput.add(id);
  }
  return { tacke, susjedi, rangCvora, samoAutoput, ivica };
}

/**
 * Kandidati za lijepljenje cvora grafa na mrezu.
 *
 * Ne uzima se jedna najbliza tacka, i to iz dva razloga. Prvi: centar Podgorice
 * je blizu neke sporedne ulice, a htjeli bismo magistralu — zato se rastojanje
 * mnozi kaznom ranga. Drugi, tezi: najbliza tacka umije da bude na putu koji u
 * podacima nije spojen sa onim kojim se stvarno vozi. Zato se drzi vise
 * kandidata, prostorno razmaknutih, a koji ce pobijediti odlucuje se tek u
 * trazenju rute — po tome sa kojim ispadne kraci put.
 */
function kandidati(cvor, mreza, { bezAutoputa = false } = {}) {
  const cilj = uMetre(cvor.lat, cvor.lon);
  const svi = [];
  for (const [id, kazna] of mreza.rangCvora) {
    // Kad autoput nije dozvoljen, cvor sa kojeg se ne moze nikuda osim
    // autoputem ne smije ni da udje u izbor. Filtriranje POSLIJE izbora ne
    // valja: kod Smokovca, koji je petlja na A-1, tako je ispadalo svih osam
    // kandidata na autoputu, pa nijedan nije ostajao i ivica je gubila rutu.
    if (bezAutoputa && mreza.samoAutoput.has(id)) continue;
    const p = mreza.tacke.get(id);
    const d = Math.hypot(p.x - cilj.x, p.y - cilj.y);
    if (d > DOMET_LIJEPLJENJA) continue;
    svi.push({ id, d, ocjena: d * kazna });
  }
  svi.sort((a, b) => a.ocjena - b.ocjena);

  const izabrani = [];
  for (const k of svi) {
    if (izabrani.length >= KANDIDATA) break;
    const p = mreza.tacke.get(k.id);
    const preblizu = izabrani.some((i) => {
      const q = mreza.tacke.get(i.id);
      return Math.hypot(p.x - q.x, p.y - q.y) < RAZMAK_KANDIDATA;
    });
    if (!preblizu) izabrani.push(k);
  }
  return izabrani;
}

/**
 * Najkraci put izmedju dva SKUPA kandidata; `null` ako veze nema.
 *
 * Dijkstra krece iz svih kandidata polazista odjednom, svaki sa pocetnom
 * cijenom svog lijepljenja. Cilj se bira isto tako — pobjeđuje onaj kod kojeg
 * je zbir najmanji. Time se u jednom prolazu ispita svih `KANDIDATA x
 * KANDIDATA` kombinacija, umjesto da se pokrece Dijkstra za svaku.
 *
 * Rano se prekida cim najmanji kljuc u redu premasi najbolji nadjeni zbir —
 * dalje pretrazivanje vise ne moze naci krace.
 */
function trazi(mreza, odKand, doKand, { bezAutoputa = false } = {}) {
  const daljina = new Map();
  const odakle = new Map();
  const gotovo = new Set();
  const red = new Gomila();
  for (const k of odKand) {
    const cijena = k.d * MNOZILAC_LIJEPLJENJA;
    if (cijena < (daljina.get(k.id) ?? Infinity)) {
      daljina.set(k.id, cijena);
      red.dodaj(cijena, k.id);
    }
  }
  const ciljevi = new Map(doKand.map((k) => [k.id, k.d * MNOZILAC_LIJEPLJENJA]));

  let najbolji = null;
  let najbolja = Infinity;

  while (red.velicina > 0) {
    const { kljuc, vrijednost: cvor } = red.uzmi();
    if (kljuc >= najbolja) break;
    if (gotovo.has(cvor)) continue;
    gotovo.add(cvor);

    const kazna = ciljevi.get(cvor);
    if (kazna !== undefined && kljuc + kazna < najbolja) {
      najbolja = kljuc + kazna;
      najbolji = cvor;
    }

    for (const [drugi, tezina, d, wayId, r] of mreza.susjedi.get(cvor) ?? []) {
      if (gotovo.has(drugi)) continue;
      // Ivica koja u grafu nije autoput ne smije se ni voziti autoputem. Bez
      // ovoga je `bioce--kolasin` — planinski put kroz kanjon Morace — isao
      // novim autoputem 78% duzine, sa kilometrazom koja se cak poklapala.
      if (bezAutoputa && r === "motorway") continue;
      const nova = kljuc + tezina;
      if (nova < (daljina.get(drugi) ?? Infinity)) {
        daljina.set(drugi, nova);
        odakle.set(drugi, [cvor, d, wayId]);
        red.dodaj(nova, drugi);
      }
    }
  }

  if (najbolji === null) return null;
  const cvorovi = [najbolji];
  const putevi = [];
  const duzine = [];
  let m = najbolji;
  for (;;) {
    const korak = odakle.get(m);
    if (!korak) break; // stigli smo do kandidata iz kojeg je krenulo
    putevi.push(korak[2]);
    duzine.push(korak[1]);
    m = korak[0];
    cvorovi.push(m);
  }
  cvorovi.reverse();
  putevi.reverse();
  duzine.reverse();
  const pocetni = odKand.find((k) => k.id === m);
  const krajnji = doKand.find((k) => k.id === najbolji);
  return { cvorovi, putevi, duzine, pocetni, krajnji };
}

// -- glavno ------------------------------------------------------------------

async function glavno() {
  const put = join(KES, "putevi.json");
  if (!existsSync(put)) throw new Error("Nema putevi.json — pokreni prvo: npm run osm:povuci");
  console.log("Ucitavam mrezu puteva...");
  const sirovo = JSON.parse(await readFile(put, "utf8"));

  const mreza = napraviMrezu(sirovo.elements);
  console.log(`  cvorova: ${mreza.susjedi.size}, segmenata: ${mreza.ivica}`);

  // Oznake puteva (M-2, E65...) — po njima se koridor prepoznaje na oko.
  const oznake = new Map();
  // Rang svake ivice — po njemu se vidi od cega je ruta sastavljena.
  const rangovi = new Map();
  for (const el of sirovo.elements) {
    if (el.type !== "way") continue;
    if (el.tags?.ref) oznake.set(el.id, el.tags.ref);
    const r = rang(el.tags);
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
    const ruta = trazi(mreza, a, b, { bezAutoputa });
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
