/**
 * Korak 4: gradske kicme.
 *
 * Pokretanje: `npm run osm:kicme` (poslije `osm:povuci`).
 *
 * ZASTO OVO UOPSTE POSTOJI
 *
 * Geometrija ivice grafa zavrsava u tacki na koju je cvor prilijepljen, negdje
 * u centru grada, i sljedeca ivica odatle krece. Grad u ruti zato nije dionica
 * nego TACKA: kroz Cetinje se ne prolazi, njega se samo dodirne. Kicma je ono
 * sto tu nedostaje — stvarne ulice od ulaza u grad do svakog izlaza.
 *
 * SKRIPTA PRAVI DVIJE STVARI
 *
 * 1. `public/data/osm/kicme/<cvor>.json` — kicma kao mali graf: ulazi (po jedan
 *    za svaku ivicu iz grafa), cvorovi (raskrsnice i kruzni tokovi) i ulice
 *    izmedju njih, sa geometrijom. Kroz taj graf se u voznji trazi put od ulaza
 *    do izlaza, pa se grad stvarno prolazi.
 *
 * 2. `izvjestaj/kicme-kandidati.md` — spisak kruznih tokova i vecih raskrsnica
 *    po gradovima, sa imenima ulica. To je za covjeka: za osam gradova iz
 *    zadatka kicmu treba potvrditi rucno, a dok se to ne desi vazi ova,
 *    automatski nadjena.
 *
 * Podaci: (c) OpenStreetMap contributors, ODbL.
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { EDGES, NODES, nodeById, otherEnd } from "./lib/graf.mjs";
import { KES } from "./lib/overpass.mjs";
import { uMetre } from "./lib/proj.mjs";
import { dm, duzina as duzinaLinije, uprosti } from "./lib/geom.mjs";
import { KAZNA_GRADSKA, kandidati, napraviMrezu, trazi } from "./lib/rutiranje.mjs";

const IZVJESTAJ = join(process.cwd(), "scripts", "osm", "izvjestaj");
const IZLAZ = join(process.cwd(), "public", "data", "osm", "kicme");

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

/** Dokle od centra se trazi za spisak kandidata [m]. */
const DOMET = 2500;

/**
 * Poluprecnik grada [m].
 *
 * Ovo je granica na kojoj ivica grafa prestaje a kicma pocinje. Nije mjera
 * naselja nego mjera voznje: toliko se prilazi gradu prije nego sto se udje u
 * ulicu. Manje bi znacilo da se grad prodje za pola minuta, vise da magistrala
 * ulazi u centar.
 */
const POLUPRECNIK = 1200;

/** Uproscavanje geometrije kicme [m]. */
const TOL = 3;

/**
 * Koliko se jos odmakne poslije mjesta na kojem se ivice razdvoje [m].
 *
 * Tacno na razdvajanju bi dva ulaza bila jedan do drugog i kicma bi izmedju
 * njih bila duzine nula. Stotinu metara je dovoljno da svaki ulaz bude na svom
 * putu.
 */
const ODVAJANJE = 100;

/**
 * Najvise koliko se metara PUTA odsijeca sa kraja ivice [m].
 *
 * Mjera je duzina odsjecenog puta, a ne udaljenost od centra: geometrija neke
 * ivice se i sama zavrsava kilometrima od unijete koordinate cvora (vidi
 * `ivice-za-provjeru.md`), pa bi mjerenje od centra tamo dalo besmislicu — kod
 * `podgorica--smokovac` cetiri kilometra.
 *
 * Bez granice povlacenje „dok se ivice ne razdvoje" izadje iz grada: kod Rozaja
 * su dvije ivice dijelile trinaest kilometara prilaza, pa je kicma ispadala
 * petnaest kilometara duga — a to vise nije grad nego regionalni put.
 */
const NAJDALJI_ULAZ = 2500;

const GLAVNI = new Set(["motorway", "trunk", "primary", "secondary"]);
const osnovni = (h = "") => (h.endsWith("_link") ? h.slice(0, -5) : h);

/** Ime ulice kako se moze prikazati: ime, pa oznaka, pa vrsta. */
const imeUlice = (tags = {}) => tags.name ?? tags.ref ?? `(${tags.highway ?? "put"})`;

const ucitaj = async (ime) => {
  const put = join(KES, `${ime}.json`);
  if (!existsSync(put)) throw new Error(`Nema ${ime}.json — pokreni prvo: npm run osm:povuci`);
  return JSON.parse(await readFile(put, "utf8"));
};

/**
 * Tacka na poliliniji, TACNO `koliko` metara od njenog KRAJA.
 *
 * Interpolira se, ne uzima najblize tjeme: poslije uproscavanja jedan segment
 * zna biti dug pola kilometra, pa bi „prvo tjeme preko granice" granicu
 * probijalo za toliko.
 */
function odKraja(tacke, koliko) {
  let preslo = 0;
  for (let i = tacke.length - 1; i > 0; i--) {
    const a = tacke[i - 1];
    const b = tacke[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (preslo + d >= koliko) {
      const t = d === 0 ? 0 : (koliko - preslo) / d;
      return {
        tacka: { x: b.x + (a.x - b.x) * t, y: b.y + (a.y - b.y) * t },
        odKraja: koliko,
      };
    }
    preslo += d;
  }
  return { tacka: tacke[0], odKraja: preslo };
}

/**
 * Koliko se metara dvije ivice poklapaju na ulasku u isti grad.
 *
 * Obje su rutirane do iste prilijepljene tacke u centru, pa im je posljednji
 * kilometar cesto ista ulica. Mjeri se od kraja unazad, korakom, jer tacke ne
 * stoje na istim mjestima — polilinije su uprosene na pet metara.
 */
function zajednickiRep(a, b, korak = 10, tol = 15) {
  const naOdmaku = (t, d) => odKraja(t, d).tacka;
  let poklapa = 0;
  const najvise = Math.min(duzinaLinije(a.map((p) => [p.x, p.y])), duzinaLinije(b.map((p) => [p.x, p.y])));
  for (let d = 0; d < najvise; d += korak) {
    const pa = naOdmaku(a, d);
    const pb = naOdmaku(b, d);
    if (Math.hypot(pa.x - pb.x, pa.y - pb.y) > tol) break;
    poklapa = d;
  }
  return poklapa;
}

/**
 * Gdje geometrija ivice ulazi u grad.
 *
 * Dva uslova, i uzima se dalji od njih:
 *
 *  - izlazak iz kruga poluprecnika `POLUPRECNIK` oko centra;
 *  - mjesto na kojem se ova ivica ODVOJI od svih ostalih koje ulaze u isti grad.
 *
 * Drugi uslov nije uljepsavanje. Sve ivice su rutirane do iste prilijepljene
 * tacke u centru, pa im je prilaz cesto ista ulica: izmjereno, Podgorica je sa
 * osam ivica imala samo pet razlicitih ulaza, a Plav sa dvije — jedan. Kicma
 * izmedju dva ulaza koji su ista tacka je prazna, a grad se onda i dalje ne
 * prolazi. Zajednicki prilaz je pri tom stvarna gradska ulica i pripada kicmi,
 * ne ivici.
 */
function ulazUGrad(tacke, centar, poluprecnik, zajednicko) {
  // Dokle ivica izlazi iz kruga oko centra, mjereno od njenog kraja.
  let doKruga = 0;
  for (let i = tacke.length - 1; i > 0; i--) {
    if (Math.hypot(tacke[i].x - centar.x, tacke[i].y - centar.y) > poluprecnik) break;
    doKruga += Math.hypot(tacke[i].x - tacke[i - 1].x, tacke[i].y - tacke[i - 1].y);
  }
  const zeljeno = Math.max(doKruga, zajednicko + ODVAJANJE);
  const koliko = Math.min(zeljeno, NAJDALJI_ULAZ);
  const nadjeno = odKraja(tacke, koliko);
  return nadjeno.odKraja > 0
    ? { ...nadjeno, ogranicen: zeljeno > NAJDALJI_ULAZ }
    : null;
}

/**
 * Kicma kao mali graf.
 *
 * Od svih parova ulaza se nadju putevi kroz gradsku mrezu, pa se njihova unija
 * skupi: cvorovi na kojima se nista ne grana se izbacuju, a niz ulica izmedju
 * dva raskrsca postaje jedna ivica kicme. Bez tog skupljanja bi se ista ulica
 * upisala u svaki par koji kroz nju prolazi.
 */
function skupiKicmu(mreza, putevi, ulazniCvorovi, kruzni) {
  // Koje veze ucestvuju, i koliko puta je koji cvor dodirnut.
  const veze = new Map();
  const stepen = new Map();
  for (const p of putevi) {
    for (let i = 1; i < p.cvorovi.length; i++) {
      const a = p.cvorovi[i - 1];
      const b = p.cvorovi[i];
      const kljuc = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (veze.has(kljuc)) continue;
      veze.set(kljuc, [a, b]);
      stepen.set(a, (stepen.get(a) ?? 0) + 1);
      stepen.set(b, (stepen.get(b) ?? 0) + 1);
    }
  }

  const susjedi = new Map();
  for (const [a, b] of veze.values()) {
    if (!susjedi.has(a)) susjedi.set(a, []);
    if (!susjedi.has(b)) susjedi.set(b, []);
    susjedi.get(a).push(b);
    susjedi.get(b).push(a);
  }

  // Cvor kicme: ulaz, raskrsnica, kruzni tok ili kraj.
  const vazni = new Set(ulazniCvorovi);
  for (const [c, n] of susjedi) {
    if (n.length !== 2 || kruzni.has(c)) vazni.add(c);
  }

  const ivice = [];
  const vidjeno = new Set();
  for (const pocetak of vazni) {
    for (const prvi of susjedi.get(pocetak) ?? []) {
      const kljuc = `${pocetak}>${prvi}`;
      if (vidjeno.has(kljuc)) continue;
      const lanac = [pocetak];
      let prethodni = pocetak;
      let tekuci = prvi;
      for (;;) {
        lanac.push(tekuci);
        if (vazni.has(tekuci)) break;
        const dalje = (susjedi.get(tekuci) ?? []).find((x) => x !== prethodni);
        if (dalje === undefined) break;
        prethodni = tekuci;
        tekuci = dalje;
      }
      vidjeno.add(kljuc);
      vidjeno.add(`${lanac[lanac.length - 1]}>${lanac[lanac.length - 2]}`);
      const tacke = lanac.map((id) => mreza.tacke.get(id)).filter(Boolean);
      if (tacke.length < 2) continue;
      ivice.push({
        a: lanac[0],
        b: lanac[lanac.length - 1],
        g: uprosti(
          tacke.map((p) => [p.x, p.y]),
          TOL,
        ),
      });
    }
  }
  return { vazni, ivice };
}

async function glavno() {
  const sirovo = await ucitaj("putevi");
  // Gradske ulice ulaze i u mrezu i u imenovanje: kroz mnogi grad glavni put ne
  // prolazi, pa bi kicma bez njih bila prekinuta.
  const uliceSirovo = existsSync(join(KES, "ulice.json"))
    ? JSON.parse(await readFile(join(KES, "ulice.json"), "utf8"))
    : { elements: [] };

  const sviElementi = [...sirovo.elements, ...uliceSirovo.elements];
  const tacke = new Map();
  for (const el of sviElementi) {
    if (el.type === "node") tacke.set(el.id, uMetre(el.lat, el.lon));
  }
  const ivice = sirovo.elements.filter((el) => el.type === "way" && el.nodes);
  const sveIvice = sviElementi.filter((el) => el.type === "way" && el.nodes);

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
  const kruzni = new Set();
  for (const el of sveIvice) {
    if (el.tags?.junction === "roundabout") for (const id of el.nodes) kruzni.add(id);
  }

  console.log("Gradim gradsku mrezu za trazenje kicmi...");
  const mreza = napraviMrezu(sviElementi, KAZNA_GRADSKA);
  console.log(`  cvorova: ${mreza.susjedi.size}, segmenata: ${mreza.ivica}`);

  const geometrijaIvice = async (id) => {
    const put = join(process.cwd(), "public", "data", "osm", "edgeGeometry", `${id}.json`);
    if (!existsSync(put)) return null;
    return JSON.parse(await readFile(put, "utf8"));
  };

  await rm(IZLAZ, { recursive: true, force: true });
  await mkdir(IZLAZ, { recursive: true });
  await mkdir(IZVJESTAJ, { recursive: true });

  const redovi = [];
  redovi.push("# Kandidati za gradske kicme");
  redovi.push("");
  redovi.push(`Napravljeno: ${new Date().toISOString()}`);
  redovi.push("");
  redovi.push(
    "Kicme su vec napravljene automatski i stoje u `public/data/osm/kicme/`.",
    "Ispod su kruzni tokovi i vece raskrsnice u krugu od " + DOMET + " m oko centra,",
    "sa ulicama koje se na njima sastaju — za osam gradova iz zadatka izbor jos",
    "treba potvrditi rucno. Skripta nista ne bira umjesto covjeka; ovo je samo",
    "ono sto na terenu postoji.",
  );
  redovi.push("");

  const sazetak = [];
  /** Ulazi koji su i poslije odsijecanja daleko od centra — nalaz o ivici. */
  const daleki = [];

  for (const cvor of NODES.filter((n) => n.kind === "opstina")) {
    const centar = uMetre(cvor.lat, cvor.lon);
    const blizu = (p) => Math.hypot(p.x - centar.x, p.y - centar.y) <= DOMET;

    // -- ulazi u grad ---------------------------------------------------------
    const prilazi = [];
    for (const e of EDGES.filter((x) => x.a === cvor.id || x.b === cvor.id)) {
      const geom = await geometrijaIvice(e.id);
      if (!geom) continue;
      // Geometrija ide od `a` prema `b`; okrece se tako da GRAD bude na kraju.
      const t = geom.g.map(([x, y]) => ({ x, y }));
      prilazi.push({ e, kaGradu: e.b === cvor.id ? t : [...t].reverse() });
    }

    const ulazi = [];
    for (const [i, prilaz] of prilazi.entries()) {
      const zajednicko = prilazi.reduce(
        (naj, drugi, j) => (i === j ? naj : Math.max(naj, zajednickiRep(prilaz.kaGradu, drugi.kaGradu))),
        0,
      );
      const ulaz = ulazUGrad(prilaz.kaGradu, centar, POLUPRECNIK, zajednicko);
      if (!ulaz) continue;
      const k = kandidati(ulaz.tacka, mreza, { domet: 400, koliko: 1, razmak: 1 });
      if (k.length === 0) continue;
      const odCentra = Math.round(
        Math.hypot(mreza.tacke.get(k[0].id).x - centar.x, mreza.tacke.get(k[0].id).y - centar.y),
      );
      if (odCentra > 3000) {
        daleki.push({
          grad: cvor.name,
          ivica: prilaz.e.id,
          odCentra,
          odKraja: Math.round(ulaz.odKraja),
        });
      }
      ulazi.push({
        ivica: prilaz.e.id,
        ka: otherEnd(prilaz.e, cvor.id),
        cvorOSM: k[0].id,
        odKraja: Math.round(ulaz.odKraja),
        zajednicko: Math.round(zajednicko),
        ...(ulaz.ogranicen ? { ogranicen: true } : {}),
        x: dm(mreza.tacke.get(k[0].id).x),
        y: dm(mreza.tacke.get(k[0].id).y),
      });
    }

    // -- putevi izmedju svih parova ulaza ------------------------------------
    const putevi = [];
    let neuspjelih = 0;
    for (let i = 0; i < ulazi.length; i++) {
      for (let j = i + 1; j < ulazi.length; j++) {
        const p = trazi(
          mreza,
          [{ id: ulazi[i].cvorOSM, d: 0 }],
          [{ id: ulazi[j].cvorOSM, d: 0 }],
          { mnozilacLijepljenja: 1 },
        );
        if (p) putevi.push(p);
        else neuspjelih += 1;
      }
    }

    const kicma =
      putevi.length > 0
        ? skupiKicmu(
            mreza,
            putevi,
            ulazi.map((u) => u.cvorOSM),
            kruzni,
          )
        : { vazni: new Set(), ivice: [] };

    const metara = kicma.ivice.reduce(
      (a, x) => a + duzinaLinije(x.g),
      0,
    );

    await writeFile(
      join(IZLAZ, `${cvor.id}.json`),
      JSON.stringify({
        cvor: cvor.id,
        ime: cvor.name,
        centar: [dm(centar.x), dm(centar.y)],
        poluprecnik: POLUPRECNIK,
        rucnoPotvrdjena: false,
        ulazi,
        cvorovi: [...kicma.vazni].map((id) => {
          const p = mreza.tacke.get(id);
          return {
            id,
            x: dm(p.x),
            y: dm(p.y),
            ...(kruzni.has(id) ? { kt: 1 } : {}),
          };
        }),
        ivice: kicma.ivice.map((x) => ({
          a: x.a,
          b: x.b,
          g: x.g.map(([x1, y1]) => [dm(x1), dm(y1)]),
        })),
      }),
    );

    // -- spisak kandidata za covjeka -----------------------------------------
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
      if (!skupine.has(k)) skupine.set(k, []);
      skupine.get(k).push(el);
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
        odCentra: Math.round(Math.hypot(sx - centar.x, sy - centar.y)),
        veze: [...veze].sort(),
      });
    }
    tokovi.sort((a, b) => a.odCentra - b.odCentra);

    const raskrsnice = [];
    for (const [id, kroz] of krozCvor) {
      const p = tacke.get(id);
      if (!p || !blizu(p)) continue;
      const glavne = kroz.filter((el) => GLAVNI.has(osnovni(el.tags?.highway ?? "")));
      const imena = new Set(glavne.map((el) => imeUlice(el.tags)));
      if (glavne.length < 3 || imena.size < 2) continue;
      if (kroz.some((el) => el.tags?.junction === "roundabout")) continue;
      raskrsnice.push({
        nodeId: id,
        odCentra: Math.round(Math.hypot(p.x - centar.x, p.y - centar.y)),
        veze: [...imena].sort(),
      });
    }
    raskrsnice.sort((a, b) => a.odCentra - b.odCentra);

    sazetak.push({
      grad: cvor.name,
      rucno: RUCNO.includes(cvor.id),
      tokova: tokovi.length,
      raskrsnica: raskrsnice.length,
      ulaza: ulazi.length,
      razlicitih: new Set(ulazi.map((u) => u.cvorOSM)).size,
      kicmaIvica: kicma.ivice.length,
      kicmaKm: metara / 1000,
      neuspjelih,
    });

    if (!RUCNO.includes(cvor.id)) continue;

    redovi.push(`## ${cvor.name}`);
    redovi.push("");
    redovi.push(
      `Kicma: ${ulazi.length} ulaza, ${kicma.ivice.length} ulica, ${(metara / 1000).toFixed(1)} km.` +
        (neuspjelih > 0 ? ` **${neuspjelih} para ulaza nije povezano.**` : ""),
    );
    redovi.push("");
    redovi.push(
      "Ulazi u grad: " +
        ulazi.map((u) => `${nodeById(u.ka)?.name ?? u.ka} (\`${u.ivica}\`)`).join(", "),
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
    redovi.push(
      `### Vece raskrsnice (${raskrsnice.length}${raskrsnice.length > 25 ? ", prvih 25 po blizini" : ""})`,
    );
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

  redovi.push("## Ulazi daleko od centra");
  redovi.push("");
  redovi.push(
    "Ulaz je tacka na ivici, `" + NAJDALJI_ULAZ + "` m puta ili manje od njenog kraja. Ako je i pored",
    "toga kilometrima od unijete koordinate cvora, onda se sama ivica zavrsava",
    "daleko od grada — to je nalaz o geometriji ivice, ne o kicmi. Vidi",
    "`ivice-za-provjeru.md` i spisak sumnjivih koordinata u njemu.",
  );
  redovi.push("");
  if (daleki.length === 0) {
    redovi.push("Nema — svaki ulaz je u blizini svog grada.");
  } else {
    redovi.push("| opstina | ivica | od centra [m] | odsjeceno [m] |");
    redovi.push("| --- | --- | --- | --- |");
    for (const d of daleki) {
      redovi.push(`| ${d.grad} | \`${d.ivica}\` | ${d.odCentra} | ${d.odKraja} |`);
    }
  }
  redovi.push("");

  redovi.push("## Gradovi u koje dvije ivice ulaze istom ulicom");
  redovi.push("");
  redovi.push(
    "Ulaz u grad se povlaci unazad dok se ivica ne odvoji od svih ostalih, ali",
    "najvise " + NAJDALJI_ULAZ + " m od centra — dalje od toga to vise nije grad. Gdje se ni na toj",
    "udaljenosti ne razdvoje, dvije ivice stvarno ulaze u grad istom ulicom, pa",
    "kicma izmedju njih nema sta da poveze. Veliki zajednicki prilaz je uz to znak",
    "da je jedna od te dvije ivice lose rutirana — vidi `ivice-za-provjeru.md`.",
  );
  redovi.push("");
  const poklopljeni = sazetak.filter((s) => s.ulaza > 1 && s.razlicitih < s.ulaza);
  if (poklopljeni.length === 0) {
    redovi.push("Nema — u svakom gradu svaka ivica ima svoj ulaz.");
  } else {
    redovi.push("| opstina | ulaza | razlicitih |");
    redovi.push("| --- | --- | --- |");
    for (const s of poklopljeni) redovi.push(`| ${s.grad} | ${s.ulaza} | ${s.razlicitih} |`);
  }
  redovi.push("");

  redovi.push("## Sve opstine");
  redovi.push("");
  redovi.push(
    "| opstina | rucno | ulaza | razlicitih | ulica u kicmi | km | nepovezanih parova |",
  );
  redovi.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const s of sazetak) {
    redovi.push(
      `| ${s.grad} | ${s.rucno ? "da" : "—"} | ${s.ulaza} | ${s.razlicitih} | ${s.kicmaIvica} | ${s.kicmaKm.toFixed(1)} | ${s.neuspjelih} |`,
    );
  }
  redovi.push("");

  await writeFile(join(IZVJESTAJ, "kicme-kandidati.md"), redovi.join("\n"));
  console.log(`\nKicme: public/data/osm/kicme/ (${sazetak.length} opstina)`);
  console.log("Spisak: scripts/osm/izvjestaj/kicme-kandidati.md");
  const lose = sazetak.filter((s) => s.neuspjelih > 0);
  if (lose.length > 0) {
    console.log("Nepovezani parovi ulaza:", lose.map((s) => `${s.grad}(${s.neuspjelih})`).join(", "));
  }
}

await glavno();
