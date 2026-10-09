import {
  GRAD_LINIJA_STOP,
  GRAD_LINIJA_USTUPI_CRTICA,
  GRAD_TROTOAR,
  GRAD_ZNAK_ISTI_STUB,
} from "../sim/config";
import type { Point } from "../sim/types";
import type { Ivica, Manevar } from "./mreza";
import { procitajZnak } from "./overlay";
import type { Poligon } from "./oznake";
import { BEZ } from "./paket";
import { naPovrsini, odmakniOdUlice, type Povrsina } from "./povrsina";
import { naKraku, type Raskrsnice, type Zabrana } from "./raskrsnica";
import type { GradZaSudiju } from "./sudija";

/**
 * Gdje se crtaju pravila raskrsnica (faza 6, stavka 5c): stop-linije, znakovi
 * i semafori. Sve iz modela raskrsnice (`raskrsnica.ts`) — isti model po kojem
 * se sudi, pa je svaki prekršaj objašnjiv onim što igrač vidi. Izvedeni znak
 * (`inferred*`) se crta isto kao pravi.
 *
 * Stavka 6 (editor) dodaje: znakove skretanja i zabrane ulaska na kraku,
 * glavni put, znakove uz ulicu (ograničenje, kraj glavnog puta, zabrana
 * preticanja, djeca, školska zona), znakove zone i svjetla po manevru.
 */

export type VrstaZnaka =
  | "stop"
  | "ustupi"
  | "zabranaUlaska"
  | "kruzniTok"
  | "glavni"
  | "krajGlavnog"
  | "zabranaPreticanja"
  | "krajZabranePreticanja"
  | "skolskaZona"
  | "djeca"
  /** Zabrana saobraćaja u oba smjera: zatvorena ulica (gradilište) iz editora. */
  | "zabranaSaobracaja"
  | `brzina:${number}`
  | `zona:${number}`
  | `krajZone:${number}`
  /** Obavezan smjer iz editora: dozvoljeni pravci, redom lijevo, pravo, desno, polukružno. */
  | `obavezno:${string}`
  | "no_left_turn"
  | "no_right_turn"
  | "no_straight_on"
  | "no_u_turn"
  | "only_left_turn"
  | "only_right_turn"
  | "only_straight_on";

export interface Znak {
  vrsta: VrstaZnaka;
  /** Podnožje stuba, na trotoaru. */
  x: number;
  y: number;
  /** Izveden (nema ga u OSM-u) — za editor i izvještaj; crta se isto. */
  izveden: boolean;
  /** Mjesto na stubu: 0 najniži; više znakova na istom mjestu ide jedan iznad drugog. */
  nivo: number;
}

export interface Semafor {
  raskrsnica: number;
  krak: number;
  x: number;
  y: number;
  /**
   * Glava semafora: glavno svjetlo (`null`), svjetlo sa strelicama samo za
   * te pravce, ili (`dopunska`) zelena dopunska strelica uz glavno.
   */
  manevri: Manevar[] | null;
  dopunska: boolean;
  /** Redni broj glave na stubu (jedna pored druge). */
  pomak: number;
}

const REDOSLIJED: readonly Manevar[] = ["lijevo", "pravo", "desno", "polukruzno"];
const poRedu = (m: readonly Manevar[]) => REDOSLIJED.filter((x) => m.includes(x));
const ZNAK_ZABRANE: Record<Manevar, VrstaZnaka> = {
  lijevo: "no_left_turn",
  pravo: "no_straight_on",
  desno: "no_right_turn",
  polukruzno: "no_u_turn",
};
const ZNAK_OBAVEZE: Partial<Record<Manevar, VrstaZnaka>> = {
  lijevo: "only_left_turn",
  pravo: "only_straight_on",
  desno: "only_right_turn",
};

export interface CrtezPravila {
  /** Pune stop-linije (STOP, semafor). */
  pune: Poligon[];
  /** Isprekidane linije „ustupi prvenstvo" (po crtica). */
  isprekidane: Poligon[];
  znakovi: Znak[];
  semafori: Semafor[];
}

/**
 * Znakovi uz ulicu: iz editora (ograničenje, kraj glavnog puta, zabrana
 * preticanja, djeca, školska zona) i znakovi zone (izvedeni iz zone sa
 * ograničenjem). `naprijed`: važi za vožnju `a → b`.
 */
function znakoviUzUlicu(g: GradZaSudiju | undefined): { ivica: number; s: number; naprijed: boolean; vrsta: VrstaZnaka; izveden: boolean }[] {
  if (!g) return [];
  const izlaz: { ivica: number; s: number; naprijed: boolean; vrsta: VrstaZnaka; izveden: boolean }[] = [];
  const n = g.paket.n;
  const z = g.paket.zaglavlje;
  const vrstaZnaka = z.vrsteObjekata.indexOf("znak");
  for (let o = 0; o < n.obVrsta.length; o++) {
    if (n.obVrsta[o] !== vrstaZnaka || n.obIvica[o] === BEZ) continue;
    const zn = procitajZnak(z.stringovi[n.obPodatak[o]!] ?? "");
    if (!zn) continue;
    const vrsta: VrstaZnaka = zn.znak === "brzina" ? `brzina:${zn.brzina ?? 0}` : zn.znak;
    izlaz.push({ ivica: n.obIvica[o]!, s: n.obS[o]!, naprijed: zn.naprijed, vrsta, izveden: false });
  }
  for (const zz of g.ogranicenja.znakoviZone) {
    izlaz.push({ ivica: zz.ivica, s: zz.s, naprijed: zz.smjer === 1, vrsta: `${zz.vrsta}:${zz.brzina}`, izveden: true });
  }
  return izlaz;
}

/** Tačka i pravac (u smjeru `a → b`) ivice `s` metara od `a`. */
function naIvici(iv: Ivica, s: number): { p: Point; h: Point } {
  let k = 0;
  while (k + 2 < iv.tacke.length && iv.cum[k + 1]! < s) k += 1;
  const a = iv.tacke[k]!;
  const b = iv.tacke[k + 1]!;
  const l = iv.cum[k + 1]! - iv.cum[k]! || 1;
  const t = Math.max(0, Math.min(1, (s - iv.cum[k]!) / l));
  return { p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, h: { x: (b.x - a.x) / l, y: (b.y - a.y) / l } };
}

/**
 * Poprečni opseg traka kojima se sa kraka ulazi u raskrsnicu [od, do], kao
 * pomak od osovine u smjeru `a → b` (+ je desno). Jednosmjerna: cijeli
 * kolovoz; dvosmjerna: trake u smjeru ulaska — desno od razdjelnice kad se
 * ulazi preko `b`, lijevo kad se ulazi preko `a`.
 */
export function trakeUlaza(iv: Ivica, kraj: 0 | 1): [number, number] {
  const W = iv.sirina / 2;
  if (iv.smjer !== 0) return [-W, W];
  const n = iv.trakeNaprijed + iv.trakeNazad;
  const razdjelnica = n > 0 && iv.sirina >= n * iv.sirinaTrake - 1e-6 ? -W + iv.trakeNazad * (iv.sirina / n) : 0;
  return kraj === 1 ? [razdjelnica, W] : [-W, razdjelnica];
}

/** Pravougaonik poprijeko ivice: na `s`, od pomaka `w0` do `w1`, debljine `d` duž ivice. */
function poprijeko(iv: Ivica, s: number, w0: number, w1: number, d: number): Poligon {
  const { p, h } = naIvici(iv, s);
  const n = { x: -h.y, y: h.x };
  return [
    { x: p.x + n.x * w0 - (h.x * d) / 2, y: p.y + n.y * w0 - (h.y * d) / 2 },
    { x: p.x + n.x * w1 - (h.x * d) / 2, y: p.y + n.y * w1 - (h.y * d) / 2 },
    { x: p.x + n.x * w1 + (h.x * d) / 2, y: p.y + n.y * w1 + (h.y * d) / 2 },
    { x: p.x + n.x * w0 + (h.x * d) / 2, y: p.y + n.y * w0 + (h.y * d) / 2 },
  ];
}

/**
 * Mjesto stuba sa desne strane onoga ko se kreće po ivici prema kraju `kraj`,
 * na `s` metara od `a`: na trotoaru, uz ivičnjak.
 */
function desnoUz(iv: Ivica, kraj: 0 | 1, s: number): Point {
  const { p, h } = naIvici(iv, s);
  // Desno od smjera vožnje: za ulaz preko `b` (vožnja a → b) je +normala.
  const znak = kraj === 1 ? 1 : -1;
  const o = iv.sirina / 2 + GRAD_TROTOAR * 0.5;
  return { x: p.x - h.y * o * znak, y: p.y + h.x * o * znak };
}

/** `s` od `a` za tačku `d` metara od kraja `kraj`. */
const odKraja = (iv: Ivica, kraj: 0 | 1, d: number) => (kraj === 1 ? iv.duzina - d : d);

export function crtezPravila(
  povrsina: Povrsina,
  r: Raskrsnice,
  zabrane: Map<string, Zabrana[]>,
  odsjeci: Float32Array,
  g?: GradZaSudiju,
): CrtezPravila {
  const m = povrsina.mreza;
  const izlaz: CrtezPravila = { pune: [], isprekidane: [], znakovi: [], semafori: [] };
  // Stub nikad na kolovozu: gdje su dvije kolovozne trake tik jedna uz drugu,
  // desno od jedne je asfalt druge — stub ide na najbliži trotoar.
  // Ako ni odmak ne izvuče stub sa asfalta (dvije proširene kolovozne trake
  // se preklapaju), stub ide na lijevu stranu kraka — i to je propisno mjesto.
  const naTlu = (p: Point) => {
    const q = naPovrsini(povrsina, p.x, p.y) ? odmakniOdUlice(povrsina, p) : p;
    return naPovrsini(povrsina, q.x, q.y) ? null : q;
  };
  const desnoOdUlaza = (iv: Ivica, kraj: 0 | 1, s: number) =>
    naTlu(desnoUz(iv, kraj, s)) ?? naTlu(desnoUz(iv, kraj === 1 ? 0 : 1, s)) ?? desnoUz(iv, kraj, s);
  for (const rs of r.lista) {
    rs.kraci.forEach((k, j) => {
      const iv = m.ivice[k.ivica]!;
      if (k.ulaz && k.stopD !== null) {
        // Linija je na putu kraka — i iza kratke ivice kraka (`Krak.lanac`).
        const l = naKraku(m, k, k.stopD);
        const ivL = m.ivice[l.ivica]!;
        const s = l.s;
        const [w0, w1] = trakeUlaza(ivL, l.kraj);
        if (k.kontrola === "ustupi") {
          // Isprekidana linija: crtice poprijeko, sa razmakom iste dužine.
          const korak = 2 * GRAD_LINIJA_USTUPI_CRTICA;
          for (let w = w0; w + GRAD_LINIJA_USTUPI_CRTICA <= w1 + 1e-6; w += korak) {
            izlaz.isprekidane.push(poprijeko(ivL, s, w, w + GRAD_LINIJA_USTUPI_CRTICA, GRAD_LINIJA_STOP * 0.8));
          }
        } else {
          izlaz.pune.push(poprijeko(ivL, s, w0, w1, GRAD_LINIJA_STOP));
        }
        const stub = desnoOdUlaza(ivL, l.kraj, s);
        if (k.kontrola === "stop" || k.kontrola === "ustupi") {
          izlaz.znakovi.push({ vrsta: k.kontrola, ...stub, izveden: k.izvor === "izvedeno", nivo: 0 });
        } else if (k.kontrola === "semafor" && rs.plan) {
          // Glave semafora kraka: glavno svjetlo (kad krak u nekoj fazi ima
          // zeleno za sve), svjetla sa strelicama za pravce iz editora, i
          // zelene dopunske strelice — jedna pored druge, na istom stubu.
          const glave: { manevri: Manevar[] | null; dopunska: boolean }[] = [];
          const ima = (m: Manevar[] | null, d: boolean) =>
            glave.some((x) => x.dopunska === d && (x.manevri?.join(",") ?? "") === (m?.join(",") ?? ""));
          if (rs.plan.faze.some((f) => f.kraci.includes(j))) glave.push({ manevri: null, dopunska: false });
          for (const f of rs.plan.faze) {
            for (const d of f.djelimicno) if (d.krak === j && !ima(poRedu(d.manevri), false)) glave.push({ manevri: poRedu(d.manevri), dopunska: false });
          }
          for (const f of rs.plan.faze) {
            for (const d of f.strelice) if (d.krak === j && !ima(poRedu(d.manevri), true)) glave.push({ manevri: poRedu(d.manevri), dopunska: true });
          }
          glave.forEach((x, pomak) => izlaz.semafori.push({ raskrsnica: rs.id, krak: j, ...stub, ...x, pomak }));
        }
      }
      // Glavni put postavljen u editoru: znak na prilazu, gdje bi bila linija.
      if (k.ulaz && k.kontrola === "glavni" && k.izvor === "overlay") {
        const s = odKraja(iv, k.kraj, Math.min(odsjeci[2 * k.ivica + k.kraj]! + 1, iv.duzina / 2));
        izlaz.znakovi.push({ vrsta: "glavni", ...desnoOdUlaza(iv, k.kraj, s), izveden: false, nivo: 0 });
      }
      // Zabrana ulaska iz editora (ulica koja nije jednosmjerna, a u nju se
      // iz ove raskrsnice ne smije) — kao izvedena kod jednosmjerne.
      if (r.bezUlaska.has(`${k.ivica}:${k.kraj}`) && !(k.ulaz && !k.izlaz)) {
        const d = Math.min(odsjeci[2 * k.ivica + k.kraj]! + 1, iv.duzina / 2);
        const drugiKraj = k.kraj === 1 ? 0 : 1;
        izlaz.znakovi.push({ vrsta: "zabranaUlaska", ...desnoOdUlaza(iv, drugiKraj, odKraja(iv, k.kraj, d)), izveden: false, nivo: 0 });
      }
      // Znak skretanja iz editora: zabrana — po znak za svaki pravac;
      // obavezan smjer — jedan znak sa svim dozvoljenim pravcima.
      const sk = k.ulaz ? r.skretanja.get(`${k.ivica}:${k.kraj}`) : undefined;
      if (sk) {
        const vrste: VrstaZnaka[] =
          sk.vrsta === "zabrana"
            ? poRedu(sk.manevri).map((m) => ZNAK_ZABRANE[m])
            : [sk.manevri.length === 1 && ZNAK_OBAVEZE[sk.manevri[0]!] ? ZNAK_OBAVEZE[sk.manevri[0]!]! : `obavezno:${poRedu(sk.manevri).join(",")}`];
        const d = Math.min(odsjeci[2 * k.ivica + k.kraj]! + 2, iv.duzina / 2);
        vrste.forEach((vrsta, i) => {
          izlaz.znakovi.push({ vrsta, ...desnoOdUlaza(iv, k.kraj, odKraja(iv, k.kraj, d + 2.5 * i)), izveden: false, nivo: 0 });
        });
      }
      // Kružni tok: na ulazu u njega znak obaveznog smjera kružnog toka —
      // izveden iz OSM `junction=roundabout` (u OSM-u kao čvor nema znaka).
      // Stoji uz „ustupi", na istom stubu.
      if (rs.kruzni && k.ulaz && !iv.kruzni) {
        if (k.stopD !== null) {
          const l = naKraku(m, k, k.stopD);
          izlaz.znakovi.push({ vrsta: "kruzniTok", ...desnoOdUlaza(m.ivice[l.ivica]!, l.kraj, l.s), izveden: true, nivo: 0 });
        } else {
          const s = odKraja(iv, k.kraj, Math.min(odsjeci[2 * k.ivica + k.kraj]! + 1, iv.duzina / 2));
          izlaz.znakovi.push({ vrsta: "kruzniTok", ...desnoOdUlaza(iv, k.kraj, s), izveden: true, nivo: 0 });
        }
      }
      // Zabrana ulaska: krak jednosmjerne ulice koja vodi KA raskrsnici — iz
      // raskrsnice se u nju ne smije. Znak stoji na njenom ušću, okrenut ka
      // raskrsnici (desno od onoga ko bi pogrešno ulazio). Ne na prstenu
      // kružnog toka: smjer kroz njega kaže znak kružnog toka na ulazu.
      if (k.ulaz && !k.izlaz && !iv.kruzni) {
        const d = Math.min(odsjeci[2 * k.ivica + k.kraj]! + 1, iv.duzina / 2);
        const s = odKraja(iv, k.kraj, d);
        const drugiKraj = k.kraj === 1 ? 0 : 1;
        izlaz.znakovi.push({ vrsta: "zabranaUlaska", ...desnoOdUlaza(iv, drugiKraj, s), izveden: false, nivo: 0 });
      }
    });
  }
  // Zabrane i obaveze skretanja: znak na kraku sa kojeg važe, kod stop-linije
  // ili na ivici raskrsnice.
  for (const lista of zabrane.values()) {
    const z = lista[0]!;
    const iv = m.ivice[z.od]!;
    const kraj: 0 | 1 = iv.b === z.cvor ? 1 : 0;
    const d = Math.min(odsjeci[2 * z.od + kraj]! + 2, iv.duzina / 2);
    const vrste: VrstaZnaka[] = [
      "no_left_turn",
      "no_right_turn",
      "no_straight_on",
      "no_u_turn",
      "only_left_turn",
      "only_right_turn",
      "only_straight_on",
    ];
    for (const [i, zz] of lista.entries()) {
      if (!vrste.includes(zz.vrsta as VrstaZnaka)) continue;
      // Više zabrana sa istog kraka: znakovi jedan iza drugog.
      const p = desnoOdUlaza(iv, kraj, odKraja(iv, kraj, d + 2.5 * i));
      izlaz.znakovi.push({ vrsta: zz.vrsta as VrstaZnaka, ...p, izveden: false, nivo: 0 });
    }
  }
  // Znakovi uz ulicu iz editora (objekti paketa „znak"): na desnoj strani,
  // u smjeru u kojem važe.
  // Zatvorena ulica: znak zabrane saobraćaja na oba kraja, za onoga ko bi ulazio.
  for (const iv of m.ivice) {
    if (!iv.zatvorena || iv.duzina < 6) continue;
    izlaz.znakovi.push({ vrsta: "zabranaSaobracaja", ...desnoOdUlaza(iv, 1, 2.5), izveden: false, nivo: 0 });
    izlaz.znakovi.push({ vrsta: "zabranaSaobracaja", ...desnoOdUlaza(iv, 0, iv.duzina - 2.5), izveden: false, nivo: 0 });
  }
  for (const z of znakoviUzUlicu(g)) {
    const iv = m.ivice[z.ivica]!;
    izlaz.znakovi.push({ vrsta: z.vrsta, ...desnoOdUlaza(iv, z.naprijed ? 1 : 0, z.s), izveden: z.izveden, nivo: 0 });
  }
  // Znakovi na (skoro) istom mjestu dijele stub, jedan iznad drugog.
  const stubovi: { x: number; y: number; znakova: number }[] = [];
  for (const z of izlaz.znakovi) {
    const stub = stubovi.find((x) => Math.hypot(x.x - z.x, x.y - z.y) < GRAD_ZNAK_ISTI_STUB);
    if (stub) {
      z.x = stub.x;
      z.y = stub.y;
      z.nivo = stub.znakova;
      stub.znakova += 1;
    } else stubovi.push({ x: z.x, y: z.y, znakova: 1 });
  }
  return izlaz;
}
