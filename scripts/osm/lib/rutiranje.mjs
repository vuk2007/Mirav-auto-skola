/**
 * Trazenje puta po OSM mrezi.
 *
 * Izvuceno iz `ivice.mjs` da bi ga koristile i gradske kicme: i jedno i drugo
 * je isti posao — od tacke do tacke po stvarnim ulicama, uz sklonost prema
 * krupnijem putu. Razlika je samo u tome koje se vrste puta uopste racunaju i
 * koliko se kaznjavaju.
 *
 * Podaci: (c) OpenStreetMap contributors, ODbL.
 */

import { uMetre } from "./proj.mjs";
import { Gomila } from "./gomila.mjs";

/**
 * Kazna po rangu puta, za voznju IZMEDJU gradova.
 *
 * Nije brzina nego sklonost: sa ovim tezinama Dijkstra bira magistralu i onda
 * kad je za koji kilometar duza od lokalnog puta.
 */
export const KAZNA_MEDJUGRADSKA = {
  motorway: 1.0,
  trunk: 1.0,
  primary: 1.1,
  secondary: 1.35,
  tertiary: 1.8,
};

/**
 * Kazna po rangu puta, za voznju KROZ GRAD.
 *
 * Ovdje ulaze i stambene ulice, jer kroz mnogi grad glavni put i ne prolazi —
 * ali se i dalje bira sto krupnija ulica: kicma treba da ide kroz grad onuda
 * kuda kroz njega ide i saobracaj, a ne kroz prvu precicu.
 */
export const KAZNA_GRADSKA = {
  ...KAZNA_MEDJUGRADSKA,
  unclassified: 2.6,
  residential: 3.2,
  living_street: 4.5,
};

/** Osnovni rang puta iz oznaka; `null` ako ta vrsta ne ulazi u mrezu. */
export function rangPuta(tags = {}, kazne = KAZNA_MEDJUGRADSKA) {
  const h = tags.highway ?? "";
  const osnovni = h.endsWith("_link") ? h.slice(0, -5) : h;
  return kazne[osnovni] === undefined ? null : osnovni;
}

/**
 * Mreza za trazenje puta.
 *
 * `susjedi` je za svaki OSM cvor spisak `[drugiCvor, tezina, duzina, wayId, rang]`.
 * Graf je neusmjeren: jednosmjerne ulice se ne postuju jer se trazi KORIDOR, ne
 * vozni nalog — a jednosmjerni rezim bi rutu samo nasumicno produzio.
 */
export function napraviMrezu(elements, kazne = KAZNA_MEDJUGRADSKA) {
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
    const r = rangPuta(el.tags, kazne);
    if (!r) continue;
    const kazna = kazne[r];
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
  return { tacke, susjedi, rangCvora, samoAutoput, ivica, kazne };
}

/**
 * Kandidati za lijepljenje tacke na mrezu.
 *
 * Ne uzima se jedna najbliza tacka, i to iz dva razloga. Prvi: centar grada je
 * blizu neke sporedne ulice, a htjeli bismo magistralu — zato se rastojanje
 * mnozi kaznom ranga. Drugi, tezi: najbliza tacka umije da bude na putu koji u
 * podacima nije spojen sa onim kojim se stvarno vozi. Zato se drzi vise
 * kandidata, prostorno razmaknutih, a koji ce pobijediti odlucuje se tek u
 * trazenju rute — po tome sa kojim ispadne kraci put.
 */
export function kandidati(
  cilj,
  mreza,
  { bezAutoputa = false, domet = 6000, koliko = 8, razmak = 300 } = {},
) {
  const svi = [];
  for (const [id, kazna] of mreza.rangCvora) {
    if (bezAutoputa && mreza.samoAutoput.has(id)) continue;
    const p = mreza.tacke.get(id);
    const d = Math.hypot(p.x - cilj.x, p.y - cilj.y);
    if (d > domet) continue;
    svi.push({ id, d, ocjena: d * kazna });
  }
  svi.sort((a, b) => a.ocjena - b.ocjena);

  const izabrani = [];
  for (const k of svi) {
    if (izabrani.length >= koliko) break;
    const p = mreza.tacke.get(k.id);
    const preblizu = izabrani.some((i) => {
      const q = mreza.tacke.get(i.id);
      return Math.hypot(p.x - q.x, p.y - q.y) < razmak;
    });
    if (!preblizu) izabrani.push(k);
  }
  return izabrani;
}

/**
 * Najkraci put izmedju dva SKUPA kandidata; `null` ako veze nema.
 *
 * Dijkstra krece iz svih kandidata polazista odjednom, svaki sa pocetnom
 * cijenom svog lijepljenja. Cilj se bira isto tako — pobjeduje onaj kod kojeg
 * je zbir najmanji. Time se u jednom prolazu ispita svih `koliko x koliko`
 * kombinacija, umjesto da se pokrece Dijkstra za svaku.
 */
export function trazi(
  mreza,
  odKand,
  doKand,
  { bezAutoputa = false, mnozilacLijepljenja = 3 } = {},
) {
  const daljina = new Map();
  const odakle = new Map();
  const gotovo = new Set();
  const red = new Gomila();
  for (const k of odKand) {
    const cijena = k.d * mnozilacLijepljenja;
    if (cijena < (daljina.get(k.id) ?? Infinity)) {
      daljina.set(k.id, cijena);
      red.dodaj(cijena, k.id);
    }
  }
  const ciljevi = new Map(doKand.map((k) => [k.id, k.d * mnozilacLijepljenja]));

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
    if (!korak) break;
    putevi.push(korak[2]);
    duzine.push(korak[1]);
    m = korak[0];
    cvorovi.push(m);
  }
  cvorovi.reverse();
  putevi.reverse();
  duzine.reverse();
  return {
    cvorovi,
    putevi,
    duzine,
    pocetni: odKand.find((k) => k.id === m),
    krajnji: doKand.find((k) => k.id === najbolji),
  };
}
