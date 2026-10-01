import {
  CAR_LENGTH,
  GRAD_KLASE_GLAVNE,
  GRAD_KLASE_SPOREDNE,
  GRAD_KLASTER_BLIZU,
  GRAD_KLASTER_IVICA,
  GRAD_KLASTER_PRECNIK,
  GRAD_KLASTER_PRECNIK_PREKLOP,
  GRAD_PJESACKI_SEMAFOR_OD,
  GRAD_PJESACKI_SEMAFOR_PRELAZ,
  GRAD_SEMAFOR_ISTA_OSA,
  GRAD_SEMAFOR_SVE_CRVENO,
  GRAD_SEMAFOR_ZELENO,
  GRAD_SEMAFOR_ZELENO_GLAVNO,
  GRAD_SEMAFOR_ZUTO,
  GRAD_STOP_ISPRED_ZEBRE,
  GRAD_ZEBRA_DUBINA,
  GRAD_ZEBRA_VRSTE,
  GRAD_ZNAK_DO,
} from "../sim/config";
import type { Point } from "../sim/types";
import type { Ivica, Manevar, Mreza } from "./mreza";
import type { PlanOverlayaVezan, PravilaOverlaya } from "./overlay";
import { BEZ, type Paket } from "./paket";

/**
 * Raskrsnice grada i ko u njima ima prednost (faza 6, stavka 5b).
 *
 * Raskrsnica više nije šablon sa četiri kraka nego ono što OSM kaže: čvor sa
 * tri ili više voznih ulica, pod stvarnim uglovima — ili nekoliko takvih
 * čvorova blizu jedan drugog, kad je svaka kolovozna traka bulevara svoj put.
 *
 * Kontrola ulaza sa svakog kraka ide redom (zadatak, odjeljak 5): izmjena iz
 * editora (overlay, stavka 6) → znak ili semafor iz OSM-a → izvedeno pravilo
 * → pravilo desne strane. Izvedeno (sporedna ulica na glavnu, ulaz u kružni tok, semafor
 * bez faza) nosi zastavicu `inferred*`, crta se kao pravi znak i sudi se po
 * onome što je nacrtano.
 */

/** Kako se ulazi u raskrsnicu sa kraka. */
export type Kontrola = "semafor" | "stop" | "ustupi" | "glavni" | "desna";

/**
 * Odakle je kontrola: ručno iz editora (overlay), znak iz OSM-a, izvedena
 * (`inferred*`), ili pravilo desne strane.
 */
export type IzvorKontrole = "overlay" | "osm" | "izvedeno" | "pravilo";

export interface Krak {
  /** Ivica kraka i njen kraj koji dodiruje raskrsnicu: 0 je `a`, 1 je `b`. */
  ivica: number;
  kraj: 0 | 1;
  /** Čvor mreže u kojem krak dodiruje raskrsnicu. */
  cvor: number;
  /** Pravac kraka od raskrsnice napolje [rad], `atan2(y, x)` sa `y` na jug. */
  ugao: number;
  klasa: string;
  /** Smije li se sa kraka ući u raskrsnicu, i izaći na njega (jednosmjerne). */
  ulaz: boolean;
  izlaz: boolean;
  kontrola: Kontrola;
  izvor: IzvorKontrole;
  /** Stop-linija, metara od kraja ivice u raskrsnici; `null` za „glavni" i „desna". */
  stopD: number | null;
  /** Faza semafora kraka (indeks u `plan.faze`); `null` bez semafora. */
  faza: number | null;
}

export interface FazaSemafora {
  zeleno: number;
  /** Krakovi (indeksi u `kraci`) koji u ovoj fazi imaju zeleno za sve manevre. */
  kraci: number[];
  /** Krakovi sa zelenim samo za neke manevre (svjetlo sa strelicom za traku) — iz editora. */
  djelimicno: { krak: number; manevri: Manevar[] }[];
  /** Zelena dopunska strelica: smije se u njenom pravcu, uz ustupanje, i kad je glavno crveno. */
  strelice: { krak: number; manevri: Manevar[] }[];
  /** Zeleno za pješake preko ovih krakova (stavka 8). */
  pjesaci: number[];
}

export interface PlanSemafora {
  faze: FazaSemafora[];
  /** Trajanje cijelog ciklusa [s] i pomak ciklusa ove raskrsnice [s]. */
  ciklus: number;
  pomak: number;
  /** Žuto i „sve crveno" poslije svake faze [s]. */
  zuto: number;
  sveCrveno: number;
}

export interface Raskrsnica {
  id: number;
  cvorovi: number[];
  centar: Point;
  kraci: Krak[];
  /** Ivice unutar raskrsnice (između njenih čvorova) — kroz njih se prolazi, nisu krakovi. */
  unutrasnje: number[];
  kruzni: boolean;
  plan: PlanSemafora | null;
  /** Prednost je izvedena, ne iz znakova (zadatak, odjeljak 5). */
  inferredPriority: boolean;
  /** Semafor postoji, faze su izvedene. */
  inferredPhases: boolean;
}

export interface Raskrsnice {
  lista: Raskrsnica[];
  /** Za svaki čvor mreže: indeks raskrsnice kojoj pripada, ili −1. */
  uCvoru: Int32Array;
  /** „ivica:kraj" → [raskrsnica, krak] — krak sa te strane ivice. */
  krakIvice: Map<string, [number, number]>;
}

export type Svjetlo = "zeleno" | "zuto" | "crveno";

// ── pomoćno ────────────────────────────────────────────────────────────────

/** Pravac ivice od njenog kraja `kraj` napolje — do tačke nekoliko metara dalje. */
function pravacKraka(iv: Ivica, kraj: 0 | 1): number {
  const t = iv.tacke;
  const p0 = kraj === 0 ? t[0]! : t[t.length - 1]!;
  let p1 = p0;
  for (let k = 1; k < t.length; k++) {
    p1 = kraj === 0 ? t[k]! : t[t.length - 1 - k]!;
    if (Math.hypot(p1.x - p0.x, p1.y - p0.y) >= 8) break;
  }
  return Math.atan2(p1.y - p0.y, p1.x - p0.x);
}

/** Da li saobraćaj po ivici smije u smjeru `a → b` (`naprijed`) ili `b → a`. */
const smije = (iv: Ivica, naprijed: boolean) => iv.smjer === 0 || (iv.smjer === 1) === naprijed;

const rang = (klasa: string) => (GRAD_KLASE_GLAVNE.includes(klasa) ? 2 : GRAD_KLASE_SPOREDNE.includes(klasa) ? 0 : 1);

/** Deterministički broj iz cijelog broja — pomak semafora, da nisu svi u taktu. */
function hes(x: number): number {
  let h = Math.imul(x ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

// ── grupisanje čvorova u raskrsnice ─────────────────────────────────────────

function cvoroviRaskrsnica(m: Mreza): boolean[] {
  return m.cvorovi.map((_, c) => {
    let krajeva = 0;
    for (const i of m.izCvora[c] ?? []) {
      const iv = m.ivice[i]!;
      if (!iv.vozna) continue;
      krajeva += iv.a === iv.b ? 2 : 1;
    }
    return krajeva >= 3;
  });
}

/**
 * Da li čvor dodiruje jednosmjernu kolovoznu traku (van prstena) — osim ivice
 * `osim`. Tako izgleda čvor bulevara sa dvije kolovozne trake u OSM-u.
 */
function naKolovoznojTraci(m: Mreza, c: number, osim: number): boolean {
  return (m.izCvora[c] ?? []).some((i) => {
    const iv = m.ivice[i]!;
    return i !== osim && iv.vozna && !iv.kruzni && iv.smjer !== 0;
  });
}

/**
 * Čvorovi raskrsnica spojeni kratkom voznom ivicom idu u jednu raskrsnicu:
 * kad su oba na jednosmjernoj kolovoznoj traci (raskrsnica bulevara, koju OSM
 * crta kao nekoliko čvorova), ili kad su bliži od `GRAD_KLASTER_BLIZU` (smaknut
 * priključak — raskrsnice bi se preklapale). Dvije T-raskrsnice u stambenoj
 * ulici na 20 m ostaju dvije. Raskrsnica ne smije preći
 * `GRAD_KLASTER_PRECNIK`; ivice se uzimaju od najkraće.
 */
function grupisi(m: Mreza, jeste: boolean[], odsjeci: Float32Array): { grupa: Int32Array; unutrasnje: Set<number> } {
  const roditelj = new Int32Array(m.cvorovi.length).map((_, i) => i);
  const clanovi = new Map<number, number[]>();
  const nadji = (x: number): number => {
    while (roditelj[x] !== x) x = roditelj[x] = roditelj[roditelj[x]!]!;
    return x;
  };
  const kandidati = m.ivice
    .filter(
      (iv) =>
        iv.vozna &&
        !iv.kruzni &&
        iv.a !== iv.b &&
        jeste[iv.a] &&
        jeste[iv.b] &&
        // Bulevar sa dvije kolovozne trake; ili čvorovi tako blizu da im se
        // raskrsnice preklapaju (smaknuti priključci sporednih ulica).
        // Ili tako blizu da auto između njih ne može biti cijeli van raskrsnice.
        (iv.duzina <= GRAD_KLASTER_BLIZU ||
          iv.duzina < odsjeci[2 * iv.i]! + odsjeci[2 * iv.i + 1]! + CAR_LENGTH ||
          (iv.duzina <= GRAD_KLASTER_IVICA && naKolovoznojTraci(m, iv.a, iv.i) && naKolovoznojTraci(m, iv.b, iv.i))),
    )
    .sort((x, y) => x.duzina - y.duzina || x.i - y.i);
  const unutrasnje = new Set<number>();
  for (const iv of kandidati) {
    const ra = nadji(iv.a);
    const rb = nadji(iv.b);
    if (ra === rb) {
      unutrasnje.add(iv.i);
      continue;
    }
    const A = clanovi.get(ra) ?? [ra];
    const B = clanovi.get(rb) ?? [rb];
    let precnik = 0;
    for (const x of A) {
      for (const y of B) {
        const p = m.cvorovi[x]!;
        const q = m.cvorovi[y]!;
        precnik = Math.max(precnik, Math.hypot(p.x - q.x, p.y - q.y));
      }
    }
    // Čvorovi čije se raskrsnice preklapaju moraju biti jedna raskrsnica — auto
    // između njih nikad nije van raskrsnice — pa smiju u veću; bulevar ne.
    const preklop = iv.duzina <= GRAD_KLASTER_BLIZU || iv.duzina < odsjeci[2 * iv.i]! + odsjeci[2 * iv.i + 1]! + CAR_LENGTH;
    if (precnik > (preklop ? GRAD_KLASTER_PRECNIK_PREKLOP : GRAD_KLASTER_PRECNIK)) continue;
    roditelj[ra] = rb;
    clanovi.set(rb, [...A, ...B]);
    clanovi.delete(ra);
    unutrasnje.add(iv.i);
  }
  const grupa = new Int32Array(m.cvorovi.length).fill(-1);
  for (let c = 0; c < m.cvorovi.length; c++) if (jeste[c]) grupa[c] = nadji(c);
  return { grupa, unutrasnje };
}

// ── kontrola sa krakova ─────────────────────────────────────────────────────

interface ObjekatNaKraku {
  vrsta: "stop" | "give_way" | "traffic_signals" | "crossing";
  /** Razdaljina od kraja ivice u raskrsnici [m]. */
  d: number;
  podatak: string;
}

/** Objekti pravila na ivici, po razdaljini od kraja `kraj`, koji važe za ulazak sa tog kraka. */
function objektiKraka(p: Paket, poIvici: Map<number, number[]>, iv: Ivica, kraj: 0 | 1): ObjekatNaKraku[] {
  const z = p.zaglavlje;
  const n = p.n;
  const izlaz: ObjekatNaKraku[] = [];
  // Ko ulazi preko kraja `b` vozi `a → b`, a to je OSM `forward`.
  const smjerUlaza = kraj === 1 ? "forward" : "backward";
  for (const o of poIvici.get(iv.i) ?? []) {
    const vrsta = z.vrsteObjekata[n.obVrsta[o]!] as ObjekatNaKraku["vrsta"];
    const podatak = z.stringovi[n.obPodatak[o]!] ?? "";
    const d = kraj === 1 ? iv.duzina - n.obS[o]! : n.obS[o]!;
    if (d > GRAD_ZNAK_DO) continue;
    if (vrsta !== "crossing" && (podatak === "forward" || podatak === "backward") && podatak !== smjerUlaza) continue;
    izlaz.push({ vrsta, d, podatak });
  }
  return izlaz.sort((a, b) => a.d - b.d);
}

/**
 * Sve raskrsnice grada. `odsjeci` su iz `krajeviLinija` (oznake): gdje
 * počinje raskrsnica na svakom kraju ivice — tu je stop-linija kad je znak
 * nema na svom mjestu.
 */
export function napraviRaskrsnice(p: Paket, m: Mreza, odsjeci: Float32Array, overlay?: PravilaOverlaya): Raskrsnice {
  const n = p.n;
  const z = p.zaglavlje;
  const jeste = cvoroviRaskrsnica(m);
  const { grupa, unutrasnje } = grupisi(m, jeste, odsjeci);

  const poIvici = new Map<number, number[]>();
  const uCvoruObj = new Map<number, number[]>();
  const vrstePravila = new Set(["stop", "give_way", "traffic_signals", "crossing"]);
  for (let o = 0; o < n.obVrsta.length; o++) {
    if (!vrstePravila.has(z.vrsteObjekata[n.obVrsta[o]!] ?? "")) continue;
    if (n.obIvica[o] !== BEZ) {
      const l = poIvici.get(n.obIvica[o]!) ?? [];
      l.push(o);
      poIvici.set(n.obIvica[o]!, l);
    } else if (n.obCvor[o] !== BEZ) {
      const l = uCvoruObj.get(n.obCvor[o]!) ?? [];
      l.push(o);
      uCvoruObj.set(n.obCvor[o]!, l);
    }
  }

  // Grupe → raskrsnice, redom po najmanjem čvoru (determinizam).
  const poGrupi = new Map<number, number[]>();
  for (let c = 0; c < m.cvorovi.length; c++) {
    if (grupa[c]! < 0) continue;
    const l = poGrupi.get(grupa[c]!) ?? [];
    l.push(c);
    poGrupi.set(grupa[c]!, l);
  }
  const grupe = [...poGrupi.values()].sort((a, b) => a[0]! - b[0]!);

  const lista: Raskrsnica[] = [];
  const uCvoru = new Int32Array(m.cvorovi.length).fill(-1);
  const krakIvice = new Map<string, [number, number]>();

  for (const cvorovi of grupe) {
    const id = lista.length;
    const skup = new Set(cvorovi);
    for (const c of cvorovi) uCvoru[c] = id;
    const unutra: number[] = [];
    const kraci: Krak[] = [];
    let kruzni = false;
    for (const c of cvorovi) {
      for (const i of m.izCvora[c] ?? []) {
        const iv = m.ivice[i]!;
        if (!iv.vozna) continue;
        if (iv.kruzni) kruzni = true;
        if (unutrasnje.has(i) && skup.has(iv.a) && skup.has(iv.b)) {
          if (!unutra.includes(i)) unutra.push(i);
          continue;
        }
        for (const kraj of [0, 1] as const) {
          if ((kraj === 0 ? iv.a : iv.b) !== c) continue;
          kraci.push({
            ivica: i,
            kraj,
            cvor: c,
            ugao: pravacKraka(iv, kraj),
            klasa: iv.klasa,
            // Ulazi se vozeći ka ovom kraju: ka `b` je `a → b`.
            ulaz: smije(iv, kraj === 1),
            izlaz: smije(iv, kraj === 0),
            kontrola: "desna",
            izvor: "pravilo",
            stopD: null,
            faza: null,
          });
        }
      }
    }
    kraci.sort((x, y) => x.ugao - y.ugao || x.ivica - y.ivica || x.kraj - y.kraj);
    let cx = 0;
    let cy = 0;
    for (const c of cvorovi) {
      cx += m.cvorovi[c]!.x;
      cy += m.cvorovi[c]!.y;
    }
    const r: Raskrsnica = {
      id,
      cvorovi,
      centar: { x: cx / cvorovi.length, y: cy / cvorovi.length },
      kraci,
      unutrasnje: unutra.sort((a, b) => a - b),
      kruzni,
      plan: null,
      inferredPriority: false,
      inferredPhases: false,
    };
    odrediKontrolu(p, m, r, poIvici, cvorovi.flatMap((c) => uCvoruObj.get(c) ?? []), odsjeci, overlay);
    r.kraci.forEach((k, j) => krakIvice.set(`${k.ivica}:${k.kraj}`, [id, j]));
    lista.push(r);
  }
  return { lista, uCvoru, krakIvice };
}

function odrediKontrolu(
  p: Paket,
  m: Mreza,
  r: Raskrsnica,
  poIvici: Map<number, number[]>,
  uCvorovima: number[],
  odsjeci: Float32Array,
  overlay: PravilaOverlaya | undefined,
): void {
  const z = p.zaglavlje;
  const n = p.n;
  const naKraku = r.kraci.map((k) => (k.ulaz ? objektiKraka(p, poIvici, m.ivice[k.ivica]!, k.kraj) : []));
  const uCvoru = uCvorovima.map((o) => z.vrsteObjekata[n.obVrsta[o]!]);
  // Semafor iz editora: plan, ili `null` — semafora tu nema (greška u OSM-u).
  const ovSemafor = overlay ? (r.cvorovi.map((c) => overlay.semafori.get(c)).find(Boolean) ?? null) : null;
  const bezSemafora = ovSemafor !== null && ovSemafor.plan === null;

  const semaforUCvoru = !bezSemafora && uCvoru.includes("traffic_signals");
  // Pješački semafor na sredini ulice nije semafor raskrsnice (vidi
  // `GRAD_PJESACKI_SEMAFOR_OD`).
  const semaforNaKraku = naKraku.map(
    (l, j) =>
      (!bezSemafora &&
        l.find((o) => {
          if (o.vrsta !== "traffic_signals") return false;
          const k = r.kraci[j]!;
          const daleko = o.d > odsjeci[2 * k.ivica + k.kraj]! + GRAD_PJESACKI_SEMAFOR_OD;
          const uzPrelaz = l.some((c) => c.vrsta === "crossing" && Math.abs(c.d - o.d) <= GRAD_PJESACKI_SEMAFOR_PRELAZ);
          return !(daleko && uzPrelaz);
        })) ||
      null,
  );
  const znakNaKraku = naKraku.map((l) => l.find((o) => o.vrsta === "stop" || o.vrsta === "give_way") ?? null);
  const ulazi = r.kraci.map((k, j) => (k.ulaz ? j : -1)).filter((j) => j >= 0);

  if (ovSemafor?.plan) {
    // Plan iz editora: krakovi u njemu su pod semaforom; ostali (desni
    // odvojak) ustupaju, izvedeno — kao kad je semafor samo na krakovima.
    const plan = planIzOverlaya(r, ovSemafor.plan);
    const uPlanu = new Set(plan.faze.flatMap((f) => [...f.kraci, ...f.djelimicno.map((d) => d.krak), ...f.strelice.map((d) => d.krak)]));
    for (const j of ulazi) {
      const k = r.kraci[j]!;
      [k.kontrola, k.izvor] = uPlanu.has(j) ? ["semafor", "overlay"] : ["ustupi", "izvedeno"];
    }
    plan.faze.forEach((f, i) => f.kraci.forEach((j) => (r.kraci[j]!.faza ??= i)));
    r.plan = plan;
  } else if (semaforUCvoru || semaforNaKraku.some(Boolean)) {
    // Semaforisana raskrsnica. Krak bez svog semafora (desni odvojak, prilaz
    // iz dvorišta) kad je semafor samo na krakovima: ustupa, izvedeno.
    for (const j of ulazi) {
      const k = r.kraci[j]!;
      if (semaforUCvoru || semaforNaKraku[j]) {
        k.kontrola = "semafor";
        k.izvor = "osm";
      } else {
        k.kontrola = "ustupi";
        k.izvor = "izvedeno";
        r.inferredPriority = true;
      }
    }
    r.plan = planSemafora(r);
    r.inferredPhases = true;
  } else if (znakNaKraku.some(Boolean)) {
    for (const j of ulazi) {
      const k = r.kraci[j]!;
      const znak = znakNaKraku[j];
      k.kontrola = znak ? (znak.vrsta === "stop" ? "stop" : "ustupi") : "glavni";
      k.izvor = "osm";
    }
  } else if (uCvoru.includes("stop") || uCvoru.includes("give_way")) {
    // Znak u samom čvoru (bez kraka): važi za krakove najniže klase — izvedeno.
    const najniza = Math.min(...ulazi.map((j) => rang(r.kraci[j]!.klasa)));
    const vrsta = uCvoru.includes("stop") ? "stop" : "ustupi";
    for (const j of ulazi) {
      const k = r.kraci[j]!;
      const sporedan = rang(k.klasa) === najniza && ulazi.some((x) => rang(r.kraci[x]!.klasa) > najniza);
      k.kontrola = sporedan ? vrsta : "glavni";
      k.izvor = "izvedeno";
    }
    r.inferredPriority = true;
  } else if (r.kruzni) {
    // Kružni tok bez znaka: prednost ima prsten, ulaz ustupa (odluka korisnika).
    for (const j of ulazi) {
      const k = r.kraci[j]!;
      const prsten = m.ivice[k.ivica]!.kruzni;
      k.kontrola = prsten ? "glavni" : "ustupi";
      k.izvor = "izvedeno";
    }
    r.inferredPriority = true;
  } else {
    const glavnih = ulazi.filter((j) => rang(r.kraci[j]!.klasa) === 2).length;
    const sporednih = ulazi.filter((j) => rang(r.kraci[j]!.klasa) === 0).length;
    if (glavnih > 0 && sporednih > 0) {
      // Sporedna na glavnu bez znaka: sporedna ustupa (zadatak, odjeljak 5).
      // Ostale (npr. `tertiary`) ne ustupaju — među njima i glavnom važi
      // pravilo desne strane, kao među dvije glavne.
      for (const j of ulazi) {
        const k = r.kraci[j]!;
        k.kontrola = rang(k.klasa) === 0 ? "ustupi" : "glavni";
        k.izvor = "izvedeno";
      }
      r.inferredPriority = true;
    }
    // Inače: pravilo desne strane, bez znakova.
  }

  // Kontrola iz editora ima prednost nad svim gore — osim na kraku pod
  // semaforom: tu se mijenja plan semafora, ne znak.
  if (overlay) {
    for (const j of ulazi) {
      const k = r.kraci[j]!;
      const ov = overlay.kontrole.get(`${k.ivica}:${k.kraj}`);
      if (!ov || k.kontrola === "semafor") continue;
      k.kontrola = ov.kontrola;
      k.izvor = "overlay";
    }
  }
  // Izvedeno je ono što nije ni iz editora, ni iz OSM-a, ni pravilo desne strane.
  r.inferredPriority = r.kraci.some((k) => k.ulaz && k.izvor === "izvedeno");

  // Stop-linije: gdje je znak ili semafor (OSM ga stavlja na liniju), ali ne
  // u raskrsnici; bez njega na ivici raskrsnice. Pa ispred zebre na kraku.
  r.kraci.forEach((k, j) => {
    if (!k.ulaz || (k.kontrola !== "stop" && k.kontrola !== "ustupi" && k.kontrola !== "semafor")) return;
    const iv = m.ivice[k.ivica]!;
    const ivicaRaskrsnice = odsjeci[2 * k.ivica + k.kraj]! + 0.5;
    const nosilac = k.kontrola === "semafor" ? semaforNaKraku[j] : znakNaKraku[j];
    let d = Math.max(ivicaRaskrsnice, k.izvor === "osm" && nosilac ? nosilac.d : 0);
    for (const o of naKraku[j]!) {
      if (o.vrsta !== "crossing" || !GRAD_ZEBRA_VRSTE.includes(o.podatak)) continue;
      // Zebra koja dodiruje prostor između raskrsnice i linije: linija ide ispred nje.
      if (o.d - GRAD_ZEBRA_DUBINA / 2 <= d + GRAD_STOP_ISPRED_ZEBRE) {
        d = Math.max(d, o.d + GRAD_ZEBRA_DUBINA / 2 + GRAD_STOP_ISPRED_ZEBRE);
      }
    }
    k.stopD = Math.min(d, Math.max(0, iv.duzina - 1));
  });
}

/**
 * Izvedeni plan semafora: krakovi sa semaforom se grupišu po osi (krak i
 * njemu suprotan dobijaju zeleno zajedno), glavna osa prva i duže. Faze idu
 * redom: zeleno, žuto, sve crveno.
 */
function planSemafora(r: Raskrsnica): PlanSemafora {
  const sa = r.kraci.map((k, j) => ({ k, j })).filter(({ k }) => k.kontrola === "semafor");
  sa.sort((x, y) => rang(y.k.klasa) - rang(x.k.klasa) || x.j - y.j);
  const prag = (GRAD_SEMAFOR_ISTA_OSA * Math.PI) / 180;
  const ose: { osa: number; kraci: number[]; glavna: boolean }[] = [];
  for (const { k, j } of sa) {
    const osa = ((k.ugao % Math.PI) + Math.PI) % Math.PI;
    const g = ose.find((o) => {
      const d = Math.abs(o.osa - osa);
      return Math.min(d, Math.PI - d) < prag;
    });
    if (g) g.kraci.push(j);
    else ose.push({ osa, kraci: [j], glavna: rang(k.klasa) === 2 });
  }
  const faze: FazaSemafora[] = ose.map((o, i) => ({
    zeleno: i === 0 || o.glavna ? GRAD_SEMAFOR_ZELENO_GLAVNO : GRAD_SEMAFOR_ZELENO,
    kraci: o.kraci.sort((a, b) => a - b),
    djelimicno: [],
    strelice: [],
    pjesaci: [],
  }));
  faze.forEach((f, i) => f.kraci.forEach((j) => (r.kraci[j]!.faza = i)));
  const ciklus = faze.reduce((s, f) => s + f.zeleno + GRAD_SEMAFOR_ZUTO + GRAD_SEMAFOR_SVE_CRVENO, 0);
  return {
    faze,
    ciklus,
    pomak: hes(r.cvorovi[0]!) % Math.max(1, Math.round(ciklus)),
    zuto: GRAD_SEMAFOR_ZUTO,
    sveCrveno: GRAD_SEMAFOR_SVE_CRVENO,
  };
}

/** Plan iz editora: ključevi krakova („ivica:kraj") u indekse krakova ove raskrsnice. */
function planIzOverlaya(r: Raskrsnica, p: PlanOverlayaVezan): PlanSemafora {
  const indeks = new Map(r.kraci.map((k, j) => [`${k.ivica}:${k.kraj}`, j]));
  const j = (kljuc: string) => indeks.get(kljuc) ?? -1;
  const faze: FazaSemafora[] = p.faze.map((f) => ({
    zeleno: f.zeleno,
    kraci: f.kraci.filter((x) => x.manevri === null).map((x) => j(x.kljuc)).filter((x) => x >= 0),
    djelimicno: f.kraci.flatMap((x) => (x.manevri !== null && j(x.kljuc) >= 0 ? [{ krak: j(x.kljuc), manevri: x.manevri }] : [])),
    strelice: f.strelice.flatMap((x) => (j(x.kljuc) >= 0 ? [{ krak: j(x.kljuc), manevri: x.manevri }] : [])),
    pjesaci: f.pjesaci.map(j).filter((x) => x >= 0),
  }));
  const ciklus = faze.reduce((s, f) => s + f.zeleno + p.zuto + p.sveCrveno, 0);
  return { faze, ciklus, pomak: ((p.pomak % ciklus) + ciklus) % ciklus, zuto: p.zuto, sveCrveno: p.sveCrveno };
}

/** Faza ciklusa u trenutku `t`, i dio faze: zeleno, žuto, ili „sve crveno" poslije nje. */
function uCiklusu(plan: PlanSemafora, t: number): { i: number; dio: "zeleno" | "zuto" | "sveCrveno" } {
  let u = (((t + plan.pomak) % plan.ciklus) + plan.ciklus) % plan.ciklus;
  for (let i = 0; i < plan.faze.length; i++) {
    const f = plan.faze[i]!;
    if (u < f.zeleno) return { i, dio: "zeleno" };
    u -= f.zeleno;
    if (u < plan.zuto) return { i, dio: "zuto" };
    u -= plan.zuto;
    if (u < plan.sveCrveno) return { i, dio: "sveCrveno" };
    u -= plan.sveCrveno;
  }
  return { i: plan.faze.length - 1, dio: "sveCrveno" };
}

/** Da li faza daje zeleno kraku — za sve manevre, ili za `manevar` (svjetlo sa strelicom). */
function zelenoUFazi(f: FazaSemafora, krak: number, manevar: Manevar | null): boolean {
  return f.kraci.includes(krak) || (manevar !== null && f.djelimicno.some((d) => d.krak === krak && d.manevri.includes(manevar)));
}

/**
 * Svjetlo za krak `krak` u trenutku `t` [s simulacije]. Krak bez semafora:
 * `null`. Sa `manevar` važi i svjetlo sa strelicom za taj manevar (zasebno
 * svjetlo trake); bez njega samo glavno. Krak koji ima zeleno i u sljedećoj
 * fazi ne dobija žuto između njih.
 */
export function svjetlo(r: Raskrsnica, krak: number, t: number, manevar: Manevar | null = null): Svjetlo | null {
  const plan = r.plan;
  if (!plan || r.kraci[krak]?.kontrola !== "semafor") return null;
  const { i, dio } = uCiklusu(plan, t);
  const f = plan.faze[i]!;
  if (!zelenoUFazi(f, krak, manevar)) return "crveno";
  if (dio === "zeleno") return "zeleno";
  if (plan.faze.length > 1 && zelenoUFazi(plan.faze[(i + 1) % plan.faze.length]!, krak, manevar)) return "zeleno";
  return dio === "zuto" ? "zuto" : "crveno";
}

/** Gori li zelena dopunska strelica za `manevar` sa kraka `krak` — samo dok traje zeleno njene faze. */
export function zelenaStrelica(r: Raskrsnica, krak: number, t: number, manevar: Manevar): boolean {
  const plan = r.plan;
  if (!plan || r.kraci[krak]?.kontrola !== "semafor") return false;
  const { i, dio } = uCiklusu(plan, t);
  return dio === "zeleno" && plan.faze[i]!.strelice.some((d) => d.krak === krak && d.manevri.includes(manevar));
}

// ── zabrane skretanja ──────────────────────────────────────────────────────

export interface Zabrana {
  vrsta: string;
  od: number;
  cvor: number;
  do_: number;
}

/** Zabrane iz paketa, po „ivica:čvor" odakle se skreće. */
export function zabraneSkretanja(p: Paket): Map<string, Zabrana[]> {
  const n = p.n;
  const izlaz = new Map<string, Zabrana[]>();
  for (let r = 0; r < n.rsOd.length; r++) {
    const z: Zabrana = { vrsta: p.zaglavlje.stringovi[n.rsVrsta[r]!] ?? "", od: n.rsOd[r]!, cvor: n.rsCvor[r]!, do_: n.rsDo[r]! };
    const k = `${z.od}:${z.cvor}`;
    izlaz.set(k, [...(izlaz.get(k) ?? []), z]);
  }
  return izlaz;
}

/**
 * Zabrana koju prekršuje prolaz sa ivice `od` preko čvora `cvor` na ivicu
 * `do_`, ili `null`. `no_*` zabranjuje tačno taj izlaz; `only_*` sve ostale.
 */
export function prekrsenaZabrana(zabrane: Map<string, Zabrana[]>, od: number, cvor: number, do_: number): Zabrana | null {
  for (const z of zabrane.get(`${od}:${cvor}`) ?? []) {
    if (z.vrsta.startsWith("no_") && z.do_ === do_) return z;
    if (z.vrsta.startsWith("only_") && z.do_ !== do_) return z;
  }
  return null;
}
