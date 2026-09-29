/**
 * Crtanje scene na `<canvas>`, iz stanja simulacije.
 *
 * Ovaj modul ne zna za React i ništa ne mijenja — prima `world` i crta ga.
 * Zbog toga se isti kod koristi i za igru i (kasnije) za ponavljanje snimka.
 *
 * Koordinate: svijet ima ishodište u centru raskrsnice, `y` raste nadolje —
 * isto kao na platnu, pa je transformacija samo pomjeraj i razmjera.
 *
 * Odnos tijela raskrsnice i stop-linije nije greška: stop-linija je 7 m od
 * centra, a kolovozi se ukrštaju na 3,5 m. Razlika je pješački prelaz, i tako
 * se i crta.
 */

import {
  BLINK_HZ,
  CAR_LENGTH,
  EDGE_MARKER_INSET,
  MIN_CAR_PX,
  MIN_SIGN_PX,
  OKO_LIJEVO,
  PRIKLJUCAK_KRAK,
  VOZILA,
  PRIKLJUCAK_SIRINA,
  LANDMARK_OFFSET,
  HORIZONT_NAJVISE,
  HORIZONT_RAZMAK,
  HORIZONT_RUB,
  HORIZONT_UGAO,
  KAMERA_TETIVA,
  LANDMARK_SIZE,
  OZNAKA_DOMET_PUT,
  ROAD_STEP,
  STEER_TILT,
  ROUTE_STEP,
  OKOLINA_POJAS,
  SIGN_LEAD,
  VIEW_HALF,
} from "../sim/config";
import { headingAt, pointAt, rectCorners, valueAt } from "../sim/geometry";
import {
  compile,
  crosswalkWidth,
  junctionHalf,
  lightCountdown,
  lightFor,
  OUTBOUND,
  pedestrianPos,
  roadHalf,
  stopLineAt,
  templateById,
} from "../sim/intersection";
import type {
  Arm,
  ArmId,
  Intent,
  IntersectionTemplate,
  Path,
  Pedestrian,
  HighwayTemplate,
  Point,
  RoadTemplate,
  RoundaboutTemplate,
  ScenarioOfficer,
  Template,
  Prikljucak,
  Vehicle,
  VrstaVozila,
  World,
} from "../sim/types";
import { bezKrakova } from "../sim/types";
import { HIGHWAY_LANES, lanePathId, laneX } from "../sim/highway";
import { bocnaLinija, centerLine } from "../sim/road";
import { ringPorts } from "../sim/roundabout";
import { phasesFor } from "../sim/indicatorRules";
import {
  officerAllow,
  parkiranaIzmedju,
  parkiranoTijelo,
  poseOn,
  tijeloVozila,
  zaklanjaci,
  type DioTijela,
} from "../sim/world";
import { pozaNaSporednom, sporedniPut } from "../sim/prikljucci";
import { renderS, type Driver } from "./runner";
import type { Okolina } from "../world/okolina";

/** Boje su iste kao tokeni u `app/globals.css` — scena mora da liči na sajt. */
export const PALETTE = {
  grass: "#dfe3d8",
  kerb: "#cfd3c8",
  asphalt: "#7d7d78",
  paint: "#ffffff",
  ink: "#191b20",
  yellow: "#f4c300",
  red: "#c8232c",
  green: "#2f7d33",
  blue: "#2f6fd0",
  npc: ["#c8232c", "#2f7d33", "#726b5c", "#8a5a2b"],
  lampOff: "#2a2a2a",
  emergency: "#f2f2f0",
  /** Zona pokazivača — mora se razlikovati od boje same putanje. */
  zone: "#f4c300",
  beacon: "#1f5fd0",
  officer: "#123a6d",
  /** Tabla i njena ivica — iste boje kao paneli na stranici. */
  panel: "#ffffff",
  line: "#e6e1d5",
  /** Tovarni sanduk kamiona — svijetao, da se kabina u boji vozila razlikuje od tereta. */
  sanduk: "#ebe8df",
  /** Gradski autobus — boja koju nema nijedno drugo vozilo ni oznaka na putu. */
  autobus: "#1d7a80",
  /** Parkirani auti — prigušeni, da se ne miješaju sa vozilima u saobraćaju. */
  parkirano: ["#8e949b", "#a39b8b", "#7d8a96", "#b3aa9b", "#6f7a70"],
  /** Autobuska stanica: tabla i oznaka na ivičnjaku. */
  stanica: "#1f5fa8",
  /** Ono što vozač ne vidi iza kamiona — blago zatamnjeno, ne crno. */
  sjena: "rgba(20, 24, 32, 0.26)",
} as const;

/**
 * Boje okoline pored puta.
 *
 * Shematski, po dvije-tri boje: cilj nije slika prirode nego da se sa vozačkog
 * mjesta odmah vidi šta je s koje strane — voda, šuma, naselje. Sve je nešto
 * tamnije od trave, da put ostane najsvjetlije što se vidi.
 */
export const OKOLINA_BOJE: Record<string, string> = {
  voda: "#8ab8dd",
  suma: "#8aa478",
  njiva: "#ddd5a6",
  vinograd: "#c6bf88",
  naselje: "#c8c3ba",
  industrija: "#b3aea6",
};

/**
 * Šta se rasipa po traci okoline, da ne bude prazna boja.
 *
 * Sve je shematsko i sve je jeftino: krug za drvo, pravougaonik za kuću, kratka
 * crta za talas. Mjesta se biraju iz položaja, ne iz slučaja — isti komad puta
 * uvijek izgleda isto, i pri ponovnoj vožnji i pri ponavljanju snimka.
 */
export const OKOLINA_SITNO: Record<
  string,
  { boja: string; oblik: "drvo" | "kuca" | "talas" | "brazda"; razmak: number; velicina: number }
> = {
  suma: { boja: "#5f7a4c", oblik: "drvo", razmak: 11, velicina: 3 },
  naselje: { boja: "#9a938a", oblik: "kuca", razmak: 24, velicina: 8 },
  industrija: { boja: "#867f77", oblik: "kuca", razmak: 32, velicina: 12 },
  voda: { boja: "#bcdcf2", oblik: "talas", razmak: 14, velicina: 5 },
  njiva: { boja: "#bdb47e", oblik: "brazda", razmak: 9, velicina: 7 },
  vinograd: { boja: "#a49b62", oblik: "brazda", razmak: 6, velicina: 6 },
};

/** Boje linijskih pojava: obala, rijeka i sporedne ulice. */
export const OKOLINA_LINIJE: Record<string, { boja: string; sirina: number }> = {
  obala: { boja: "#7fb0d8", sirina: 1.2 },
  rijeka: { boja: "#9ec6e8", sirina: 4 },
  put: { boja: "#cdcfc6", sirina: 2.6 },
};

/**
 * Da li pokazivač u trenutku `t` svijetli.
 *
 * Mjeri se vremenom simulacije, ne satom: auto na platnu, lampica pored volana i
 * klik moraju treptati zajedno, a ponavljanje snimka mora treptati isto.
 */
export function pokazivacSvijetli(t: number): boolean {
  return Math.floor(t * BLINK_HZ * 2) % 2 === 0;
}

export interface View {
  cx: number;
  cy: number;
  /**
   * Tačka svijeta oko koje se kadar okreće i ugao za koji se okreće [rad].
   *
   * Bez okretanja se kadar samo pomjerao, i to je bilo dovoljno dok je dionica
   * bila kratka: put je počinjao nagore i tako se i završavao. Na ruti od
   * trideset kilometara se smjer mijenja za pun krug i više puta, pa bi vozilo
   * vozilo bočno preko ekrana, a lijevo i desno bi zamijenili mjesta. Nula znači
   * „bez okretanja" — tako rade svi zatečeni kadrovi.
   */
  wx: number;
  wy: number;
  rot: number;
  /** Piksela po metru. */
  scale: number;
  /** Pola vidnog polja [m] — koristi ga i oznaka na ivici kadra. */
  half: number;
  /** Veličina platna [px]. Vidljivost se računa u ekranu, ne u svijetu. */
  wPx: number;
  hPx: number;
}

export function viewFor(widthPx: number, heightPx: number, half = VIEW_HALF): View {
  return {
    cx: widthPx / 2,
    cy: heightPx / 2,
    wx: 0,
    wy: 0,
    rot: 0,
    scale: Math.min(widthPx, heightPx) / (2 * half),
    half,
    wPx: widthPx,
    hPx: heightPx,
  };
}

/**
 * Da li tačka pada u kadar.
 *
 * Računa se u pikselima, a ne poređenjem sa `half`: kadar više nije uvijek
 * centriran na ishodište — prati igrača u smjeni, a na autoputu je ishodište
 * na početku dionice, sto metara iza njega.
 */
const inFrame = (v: View, p: Point): boolean => {
  const q = px(v, p);
  return q.x >= 0 && q.x <= v.wPx && q.y >= 0 && q.y <= v.hPx;
};

/**
 * Svijet → ekran, uz okretanje kadra za 180°.
 *
 * Sjever se crta DOLJE. Razlog je vozač, ne karta: igrač uvijek ulazi sa
 * sjevernog kraka i vozi na jug, pa bi na uobičajenoj karti (sjever gore) vozio
 * nadolje — a tada je njegova lijeva strana desno na ekranu. Pokazivač koji se
 * upali lijevo osvijetli desnu stranu slike, a skretanje ulijevo se izvije
 * udesno. Sve je bilo geometrijski tačno i svejedno nečitljivo.
 *
 * Sa okrenutim kadrom igrač vozi NAGORE: lijevo je lijevo, desno je desno, i
 * slika liči na crtež iz testova. Okretanje je rotacija, ne ogledalo, pa se
 * strane svijeta ne miješaju — desna strana ostaje desna i u pravilu prvenstva.
 *
 * Uz `px` ide i `screenAngle`: sve što se crta rotacijom oko svoje ose mora
 * dobiti isti obrt.
 */
const px = (v: View, p: Point): Point => {
  const dx = p.x - v.wx;
  const dy = p.y - v.wy;
  if (v.rot === 0) return { x: v.cx - dx * v.scale, y: v.cy - dy * v.scale };
  const cos = Math.cos(v.rot);
  const sin = Math.sin(v.rot);
  return {
    x: v.cx - (dx * cos - dy * sin) * v.scale,
    y: v.cy - (dx * sin + dy * cos) * v.scale,
  };
};

/** Ugao smjera na ekranu — isti obrt kao `px`, uključujući okretanje kadra. */
const screenAngle = (v: View, h: Point): number => Math.atan2(-h.y, -h.x) + v.rot;

/** Vektor okrenut za 90° udesno (u sistemu gdje `y` raste nadolje). */
const rt = (h: Point): Point => ({ x: -h.y, y: h.x });

const mul = (p: Point, k: number): Point => ({ x: p.x * k, y: p.y * k });
const plus = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });

/** `roundRect` nema u starijim mobilnim pregledačima — tamo ćošak ostaje oštar. */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/** Pravougaonik zadat centrom, smjerom i dimenzijama u metrima. */
function worldRect(c: Point, h: Point, len: number, wid: number): Point[] {
  const f = mul(h, len / 2);
  const s = mul(rt(h), wid / 2);
  return [
    { x: c.x + f.x + s.x, y: c.y + f.y + s.y },
    { x: c.x + f.x - s.x, y: c.y + f.y - s.y },
    { x: c.x - f.x - s.x, y: c.y - f.y - s.y },
    { x: c.x - f.x + s.x, y: c.y - f.y + s.y },
  ];
}

function fillPoly(ctx: CanvasRenderingContext2D, v: View, pts: readonly Point[], color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  pts.forEach((p, i) => {
    const q = px(v, p);
    if (i === 0) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  });
  ctx.closePath();
  ctx.fill();
}

// ── Raskrsnica ──────────────────────────────────────────────────────────────

// Geometrija kolovoza, prelaza i stop-linije dolazi iz `intersection.ts`, gdje
// je koristi i simulacija. Da je ovdje svoja kopija, pješak bi mogao da bude
// nacrtan na jednom mjestu, a da simulacija računa da je na drugom.

/** Krug u svjetskim koordinatama. */
function fillCircle(
  ctx: CanvasRenderingContext2D,
  v: View,
  c: Point,
  r: number,
  color: string,
): void {
  const p = px(v, c);
  ctx.beginPath();
  ctx.arc(p.x, p.y, r * v.scale, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * Kružni tok: krakovi, prsten i ostrvo.
 *
 * Prsten se crta kao pun krug pa se ostrvo „izbuši" preko njega — jedan potez
 * manje nego crtanje prstena kao debele linije, i ivice ispadnu čiste.
 */
function drawRoundabout(ctx: CanvasRenderingContext2D, v: View, tpl: RoundaboutTemplate): void {
  const reach = v.half * 1.5;
  const lane = tpl.geometry.laneWidth;
  const spolja = tpl.radius + lane / 2;

  for (const pass of ["kerb", "asphalt"] as const) {
    const pad = pass === "kerb" ? 1.6 : 0;
    for (const a of tpl.arms) {
      const out = OUTBOUND[a.id];
      const mid = mul(out, reach / 2);
      fillPoly(ctx, v, worldRect(mid, out, reach, (roadHalf(tpl, a) + pad) * 2), PALETTE[pass]);
    }
    fillCircle(ctx, v, { x: 0, y: 0 }, spolja + pad, PALETTE[pass]);
  }

  // Ostrvo u sredini: trotoar pa zelenilo.
  const unutra = tpl.radius - lane / 2;
  fillCircle(ctx, v, { x: 0, y: 0 }, unutra, PALETTE.kerb);
  fillCircle(ctx, v, { x: 0, y: 0 }, Math.max(0.5, unutra - 1.2), PALETTE.grass);

  // Linija ustupanja na svakom ulazu, kao isprekidan luk preko ulazne trake.
  for (const a of tpl.arms) {
    const { enterAngle } = ringPorts(tpl, a.id);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const r = unutra + ((spolja - unutra) * (i + 0.5)) / n;
      const t = enterAngle;
      const c = { x: Math.cos(t) * r, y: Math.sin(t) * r };
      const smjer = { x: -Math.sin(t), y: Math.cos(t) };
      fillPoly(ctx, v, worldRect(c, smjer, 0.5, (spolja - unutra) / (n * 1.9)), PALETTE.paint);
    }
  }
}

/**
 * Autoput: trake, isprekidane linije između njih i spoljna traka.
 *
 * Traka za ubrzavanje i traka za usporavanje se crtaju punom bojom kolovoza, a
 * dio spoljne trake van njih blijedi — tako se vidi gdje ona zaista postoji.
 */
/** Polilinija u svijetu, debljine zadate u metrima. */
function strokeLine(
  ctx: CanvasRenderingContext2D,
  v: View,
  pts: readonly Point[],
  color: string,
  width: number,
  dash?: [number, number],
): void {
  if (pts.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, width * v.scale);
  ctx.setLineDash(dash ? [dash[0] * v.scale, dash[1] * v.scale] : []);
  ctx.beginPath();
  pts.forEach((p, i) => {
    const q = px(v, p);
    if (i === 0) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  });
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * Keš ikona znamenitosti.
 *
 * Slika se učitava jednom i crta tek kad stigne — do tada se mjesto ostavlja
 * prazno. Bez keša bi svaki kadar tražio novu sliku; sa čekanjem bi se petlja
 * crtanja zaustavljala na mreži.
 *
 * `Image` ne postoji u Node-u, gdje se scena snima kroz lažno platno, pa se
 * postojanje provjerava umjesto da se pretpostavi.
 */
const IKONE = new Map<string, HTMLImageElement>();

function ikona(src: string): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  let img = IKONE.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    IKONE.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/**
 * Autobuska stanica: žuta isprekidana linija uz ivičnjak na kojem autobus staje
 * i plava tabla sa autobusom na trotoaru.
 *
 * Bez natpisa: znak se čita sa slike, na svakom jeziku isto. Stanica naše trake
 * je uz desni ivičnjak, stanica susretne uz lijevi — tamo gdje taj autobus staje.
 */
function drawStanica(
  ctx: CanvasRenderingContext2D,
  v: View,
  nasa: Path,
  s: number,
  traka: 0 | 1,
): void {
  const znak = traka === 0 ? 1 : -1;
  const ivica = (traka === 0 ? nasa.doIvice : nasa.doPreko) ?? [];
  const uz = (x: number, odmak: number): Point => {
    const o = pointAt(nasa.points, nasa.cum, x);
    const d = rt(headingAt(nasa.points, nasa.cum, x));
    const b = znak * (valueAt(nasa.cum, ivica, x) + odmak);
    return { x: o.x + d.x * b, y: o.y + d.y * b };
  };

  const linija: Point[] = [];
  for (let x = s - 8; x <= s + 8; x += 1) linija.push(uz(x, -0.35));
  strokeLine(ctx, v, linija, PALETTE.yellow, 0.22, [1.5, 1]);

  const c = px(v, uz(s, 1.2));
  const a = Math.max(MIN_SIGN_PX / 2, 0.9 * v.scale);
  roundedRect(ctx, c.x - a, c.y - a, 2 * a, 2 * a, a * 0.2);
  ctx.fillStyle = PALETTE.stanica;
  ctx.fill();
  // Autobus sa strane: karoserija, prozori, dva točka.
  ctx.fillStyle = PALETTE.paint;
  ctx.fillRect(c.x - a * 0.62, c.y - a * 0.42, a * 1.24, a * 0.7);
  ctx.fillStyle = PALETTE.stanica;
  ctx.fillRect(c.x - a * 0.48, c.y - a * 0.3, a * 0.96, a * 0.22);
  ctx.fillStyle = PALETTE.paint;
  ctx.beginPath();
  ctx.arc(c.x - a * 0.35, c.y + a * 0.4, a * 0.14, 0, Math.PI * 2);
  ctx.arc(c.x + a * 0.35, c.y + a * 0.4, a * 0.14, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Sporedni put uz raskrsnicu: komad asfalta od ivice kolovoza, linija na
 * kojoj se čeka i trougao „ustupi prvenstvo" — sporedni put nema prednost.
 *
 * Asfalt počinje malo unutar ivice kolovoza, pa prekrije ivičnu liniju: na
 * raskrsnici je ona prekinuta, kao i na terenu. Mjesto i pravac dolaze iz
 * `sporedniPut`, istog računa po kojem se vozila na njemu kreću.
 */
function drawSporedni(ctx: CanvasRenderingContext2D, v: View, nasa: Path, p: Prikljucak, laneWidth: number): void {
  const { usce, van, uzduz } = sporedniPut(nasa, p, laneWidth);
  const w = (PRIKLJUCAK_SIRINA[p.rang] ?? 5) / 2;
  const tacka = (duz: number, pop: number): Point => ({
    x: usce.x + van.x * duz + uzduz.x * pop,
    y: usce.y + van.y * duz + uzduz.y * pop,
  });
  fillPoly(ctx, v, [tacka(-0.35, -w - 1), tacka(-0.35, w + 1), tacka(1.6, w), tacka(PRIKLJUCAK_KRAK, w), tacka(PRIKLJUCAK_KRAK, -w), tacka(1.6, -w)], PALETTE.asphalt);
  // Linija na kojoj se čeka: isprekidana, poprijeko, na kraju bankine.
  strokeLine(ctx, v, [tacka(1.8, -w + 0.3), tacka(1.8, w - 0.3)], PALETTE.paint, 0.3, [0.6, 0.4]);
  // Trougao je desno od onoga ko čeka — a on gleda ka putu, dakle u `-van`.
  const desno = rt({ x: -van.x, y: -van.y });
  const c = px(v, { x: usce.x + van.x * 2.6 + desno.x * (w + 1.2), y: usce.y + van.y * 2.6 + desno.y * (w + 1.2) });
  const a = Math.max(MIN_SIGN_PX / 2, 0.9 * v.scale);
  ctx.beginPath();
  ctx.moveTo(c.x - a, c.y - a * 0.75);
  ctx.lineTo(c.x + a, c.y - a * 0.75);
  ctx.lineTo(c.x, c.y + a);
  ctx.closePath();
  ctx.fillStyle = PALETTE.paint;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, a * 0.22);
  ctx.strokeStyle = PALETTE.red;
  ctx.stroke();
}

/**
 * Otvorena dionica.
 *
 * Kolovoz je traka oko osovine, pa se crta kao jedan poligon: lijeva ivica
 * naprijed, desna unazad. Rezanje na pravougaonike bi u serpentini ostavilo
 * bijele klinove na spojevima.
 */
function drawRoad(
  ctx: CanvasRenderingContext2D,
  v: View,
  tpl: RoadTemplate,
  sIgraca?: number,
): void {
  // Crta se SAMO komad puta oko igrača. Ruta ima i po šesnaest hiljada tačaka,
  // a u kadru ih stane stotinjak; račun bočnih linija i proširenja nad cijelom
  // osovinom je u svakom kadru koštao dvadesetak kadrova u sekundi — izmjereno
  // na Herceg Novi — Rožaje: 41 umjesto 60.
  const svih = tpl.centerline?.length ?? Math.round(tpl.length / ROAD_STEP) + 1;
  const poTacki = tpl.length / Math.max(1, svih - 1);
  const domet = v.half * 3;
  const i0 = sIgraca === undefined ? 0 : Math.max(0, Math.floor((sIgraca - domet) / poTacki));
  const i1 =
    sIgraca === undefined
      ? Number.POSITIVE_INFINITY
      : Math.min(svih - 1, Math.ceil((sIgraca + domet) / poTacki));
  const { points, heading } = centerLine(tpl, i0, i1);
  const odS = i0 * poTacki;
  const pola = tpl.geometry.laneWidth;

  // Bočni odmak ide kroz `bocnaLinija` iz `sim/road.ts`, dakle kroz isti račun
  // kojim se prave i trake po kojima se vozi: kolovoz se u krivini proširuje, a
  // ako se asfalt i traka proširuju iz dva izvora, vozilo vozi van puta.
  const traka = (o: number) => bocnaLinija(points, heading, o);
  const bankina = [...traka(pola + 1.6), ...traka(-pola - 1.6).reverse()];
  fillPoly(ctx, v, bankina, PALETTE.kerb);
  fillPoly(ctx, v, [...traka(pola), ...traka(-pola).reverse()], PALETTE.asphalt);

  // Ivične linije su uvijek pune. Razdjelna je isprekidana tamo gdje se smije
  // preticati, a puna tamo gdje ne smije — i to iz `tpl.zabrane`, iz istog
  // podatka po kojem se i sudi. Da se linija crta iz jednog računa a sudi po
  // drugom, igrač bi dobijao prekršaj tamo gdje na ekranu piše da smije.
  strokeLine(ctx, v, traka(pola - 0.2), PALETTE.paint, 0.16);
  strokeLine(ctx, v, traka(-pola + 0.2), PALETTE.paint, 0.16);
  strokeLine(ctx, v, points, PALETTE.paint, 0.16, [4, 7]);
  for (const z of tpl.zabrane ?? []) {
    // Zabrane su u koordinatama cijele dionice, a crta se samo isječak.
    const od = Math.max(0, Math.floor((z.from - odS) / poTacki));
    const doK = Math.min(points.length - 1, Math.ceil((z.to - odS) / poTacki));
    if (doK - od < 1) continue;
    strokeLine(ctx, v, points.slice(od, doK + 1), PALETTE.paint, 0.18);
  }

  // Grad: autobuske stanice i parkirani auti uz ivičnjak. Položaj se čita iz
  // putanje naše trake, kao i u simulaciji — da auto na ekranu stoji tačno tamo
  // gdje igrač u njega može da udari. Isto važi i za sporedne puteve.
  const nasa =
    tpl.stanice || tpl.parkirana || tpl.prikljucci
      ? compile(tpl).paths.get(lanePathId(tpl.id, 0))
      : undefined;
  if (nasa) {
    const doS = odS + (points.length - 1) * poTacki;
    for (const p of tpl.prikljucci ?? []) {
      if (p.s >= odS && p.s <= doS) drawSporedni(ctx, v, nasa, p, tpl.geometry.laneWidth);
    }
    for (const st of tpl.stanice ?? []) {
      if (st.s >= odS && st.s <= doS) drawStanica(ctx, v, nasa, st.s, st.traka);
    }
    for (const p of parkiranaIzmedju(tpl, odS, doS)) {
      const tijelo = parkiranoTijelo(nasa, p);
      const boja = PALETTE.parkirano[Math.floor(Math.abs(p.s) * 7) % PALETTE.parkirano.length]!;
      drawVehicle(ctx, v, [tijelo], tijelo.heading, boja, p.vrsta, {
        braking: false,
        blink: null,
        highlight: null,
        beacon: false,
      });
    }
  }

  // Tabla sa preporučenom brzinom stoji PRED krivinom i uvijek uz VOZAČEVU
  // DESNU stranu — tako stoje znaci na putu, bez obzira na to na koju stranu
  // krivina ide. Postavljena tačno na početak luka bila bi prekasna: na
  // pedeset na sat se pedeset metara pređe za tri i po sekunde.
  const korak = poTacki;
  for (const k of tpl.curves) {
    const i = Math.round((Math.max(0, k.atS - k.arc / 2 - SIGN_LEAD) - odS) / korak);
    if (i < 0 || i > points.length - 1) continue;
    const p = points[i];
    const u = heading[Math.min(i, heading.length - 1)] ?? 0;
    if (!p) continue;
    const odmak = -(pola + 1);
    const c = { x: p.x + Math.cos(u) * odmak, y: p.y - Math.sin(u) * odmak };
    const q = px(v, c);
    const r = Math.max(MIN_SIGN_PX / 2, 1.15 * v.scale);
    ctx.beginPath();
    ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.paint;
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.18);
    ctx.strokeStyle = PALETTE.red;
    ctx.stroke();
    ctx.fillStyle = PALETTE.ink;
    ctx.font = `600 ${Math.round(r)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(k.advisorySpeed), q.x, q.y);
  }

  // Znamenitosti stoje iza bankine, na svojoj strani puta, sa natpisom ispod.
  // Namjerno se crtaju POSLIJE tabli: tabla je pravilo i ne smije da je
  // pokrije ukras.
  for (const z of tpl.landmarks) {
    const i = Math.round((z.atS - odS) / korak);
    if (i < 0 || i > points.length - 1) continue;
    const p = points[i];
    const u = heading[i] ?? 0;
    if (!p) continue;
    const odmak = (z.side === "left" ? 1 : -1) * (pola + LANDMARK_OFFSET);
    const c = { x: p.x + Math.cos(u) * odmak, y: p.y - Math.sin(u) * odmak };
    const q = px(v, c);
    const w = LANDMARK_SIZE * v.scale;
    if (q.x < -w || q.x > v.wPx + w || q.y < -w || q.y > v.hPx + w) continue;

    roundedRect(ctx, q.x - w / 2, q.y - w / 2, w, w, w * 0.18);
    ctx.fillStyle = PALETTE.paint;
    ctx.fill();
    ctx.lineWidth = Math.max(1, w * 0.06);
    ctx.strokeStyle = PALETTE.ink;
    ctx.stroke();

    const slika = ikona(z.icon);
    if (slika) ctx.drawImage(slika, q.x - w * 0.4, q.y - w * 0.4, w * 0.8, w * 0.8);

    const visina = Math.max(9, w * 0.26);
    ctx.font = `600 ${Math.round(visina)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const sirina = ctx.measureText(z.name).width + visina * 0.8;
    roundedRect(ctx, q.x - sirina / 2, q.y + w * 0.58, sirina, visina * 1.5, visina * 0.35);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fill();
    ctx.fillStyle = PALETTE.ink;
    ctx.fillText(z.name, q.x, q.y + w * 0.58 + visina * 0.25);
  }
}

function drawHighway(ctx: CanvasRenderingContext2D, v: View, tpl: HighwayTemplate): void {
  const lane = tpl.geometry.laneWidth;
  const duz = tpl.length;
  const sredina = { x: 0, y: duz / 2 };
  const smjer = { x: 0, y: 1 };

  // Bankina pa kolovoz.
  const sveTrake = tpl.lanes + 1;
  fillPoly(
    ctx,
    v,
    worldRect(
      { x: laneX(tpl.lanes - 1) + lane / 2 - (sveTrake * lane) / 2, y: duz / 2 },
      smjer,
      duz + 200,
      sveTrake * lane + 3.2,
    ),
    PALETTE.kerb,
  );
  for (const i of HIGHWAY_LANES) {
    const spoljna = i === -1;
    fillPoly(
      ctx,
      v,
      worldRect({ x: laneX(i), y: sredina.y }, smjer, duz + 200, lane),
      PALETTE.asphalt,
    );
    if (spoljna) {
      // Dio spoljne trake koji nije ni ulaz ni izlaz — zatamnjen.
      ctx.globalAlpha = 0.35;
      const rupa: [number, number][] = [
        [0, tpl.rampRange[0]],
        [tpl.rampRange[1], tpl.exitRange[0]],
        [tpl.exitRange[1], duz],
      ];
      for (const [od, doK] of rupa) {
        if (doK - od <= 0) continue;
        fillPoly(
          ctx,
          v,
          worldRect({ x: laneX(i), y: (od + doK) / 2 }, smjer, doK - od, lane),
          PALETTE.kerb,
        );
      }
      ctx.globalAlpha = 1;
    }
  }

  // Razdjelne linije: puna uz razdjelni pojas, isprekidane između voznih traka.
  ctx.strokeStyle = PALETTE.paint;
  ctx.lineWidth = Math.max(1, 0.15 * v.scale);
  const linija = (x: number, dash: boolean) => {
    ctx.setLineDash(dash ? [3 * v.scale, 3 * v.scale] : []);
    const a = px(v, { x, y: -100 });
    const b = px(v, { x, y: duz + 100 });
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };
  linija(laneX(tpl.lanes - 1) + lane / 2, false);
  for (let i = 0; i < tpl.lanes - 1; i++) linija(laneX(i) + lane / 2, true);
  linija(laneX(0) - lane / 2, true);
  ctx.setLineDash([]);
}

function drawRoads(ctx: CanvasRenderingContext2D, v: View, tpl: IntersectionTemplate): void {
  const reach = v.half * 1.5; // preko ivice ekrana, da nema šava

  // Trotoar je samo malo širi kolovoz ispod njega.
  for (const pass of ["kerb", "asphalt"] as const) {
    for (const a of tpl.arms) {
      const out = OUTBOUND[a.id];
      const half = roadHalf(tpl, a) + (pass === "kerb" ? 1.6 : 0);
      const mid = mul(out, reach / 2);
      fillPoly(ctx, v, worldRect(mid, out, reach, half * 2), PALETTE[pass]);
    }
    // Tijelo raskrsnice, da se ćoškovi spoje.
    const j = junctionHalf(tpl) + (pass === "kerb" ? 1.6 : 0);
    fillPoly(
      ctx,
      v,
      worldRect({ x: 0, y: 0 }, { x: 0, y: 1 }, j * 2, j * 2),
      PALETTE[pass],
    );
  }
}

function drawMarkings(ctx: CanvasRenderingContext2D, v: View, tpl: IntersectionTemplate): void {
  const j = junctionHalf(tpl);
  const line = stopLineAt(tpl);

  // Razdjelna linija po sredini kraka — prekida se pred raskrsnicom.
  ctx.strokeStyle = PALETTE.paint;
  ctx.lineWidth = Math.max(1, 0.15 * v.scale);
  ctx.setLineDash([2.5 * v.scale, 2.5 * v.scale]);
  for (const a of tpl.arms) {
    const out = OUTBOUND[a.id];
    const from = px(v, mul(out, line + 1));
    const to = px(v, mul(out, v.half * 1.5));
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  for (const a of tpl.arms) {
    const out = OUTBOUND[a.id];
    const inb = mul(out, -1);
    const half = roadHalf(tpl, a);
    // Dolazna traka je desna gledano iz smjera vožnje ka centru.
    const side = mul(rt(inb), half / 2);

    if (a.hasCrosswalk) {
      // Zebra između tijela raskrsnice i stop-linije.
      const sirina = crosswalkWidth(tpl);
      const bars = 5;
      for (let i = 0; i < bars; i++) {
        const t = j + (sirina * (i + 0.25)) / bars;
        const c = mul(out, t);
        fillPoly(ctx, v, worldRect(c, out, sirina / (bars * 1.9), half * 2), PALETTE.paint);
      }
    }

    const kind = a.control.kind;
    if (kind === "stop" || kind === "light") {
      const c = plus(mul(out, line + 0.25), side);
      fillPoly(ctx, v, worldRect(c, out, 0.5, half), PALETTE.paint);
    } else if (kind === "yield") {
      // Isprekidana linija ustupanja — trougaoni „zubi" bi na ovoj razmjeri
      // bili nečitljivi, pa se crta kao krupna isprekidana traka.
      const n = 4;
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * (half / n);
        const c = plus(plus(mul(out, line + 0.25), side), mul(rt(inb), off));
        fillPoly(ctx, v, worldRect(c, out, 0.5, half / (n * 2)), PALETTE.paint);
      }
    }
  }
}

// ── Znaci i semafor ─────────────────────────────────────────────────────────

/** Znak stoji sa desne strane vozača tog kraka, van kolovoza. */
function signSpot(tpl: Template, a: Arm): Point {
  const out = OUTBOUND[a.id];
  const inb = mul(out, -1);
  const udaljenost =
    tpl.kind === "roundabout" ? tpl.radius + tpl.geometry.laneWidth + 2.5 : stopLineAt(tpl) + 2.5;
  return plus(mul(out, udaljenost), mul(rt(inb), roadHalf(tpl, a) + 2.6));
}

function drawSign(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, kind: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = "round";
  if (kind === "priority") {
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = PALETTE.yellow;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
    ctx.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
  } else if (kind === "yield") {
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.lineTo(-r * 0.95, -r * 0.72);
    ctx.lineTo(r * 0.95, -r * 0.72);
    ctx.closePath();
    ctx.fillStyle = PALETTE.paint;
    ctx.fill();
    ctx.strokeStyle = PALETTE.red;
    ctx.lineWidth = Math.max(1.5, r * 0.28);
    ctx.stroke();
  } else if (kind === "stop") {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = (Math.PI / 4) * i + Math.PI / 8;
      const p = { x: r * Math.cos(ang), y: r * Math.sin(ang) };
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle = PALETTE.red;
    ctx.fill();
    ctx.strokeStyle = PALETTE.paint;
    ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLight(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, on: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = PALETTE.ink;
  const w = r * 1.2;
  const h = r * 3.1;
  roundedRect(ctx, -w / 2, -h / 2, w, h, r * 0.25);
  ctx.fill();
  const lamps: [string, string][] = [
    ["red", "#e33"],
    ["yellow", PALETTE.yellow],
    ["green", "#3c3"],
  ];
  lamps.forEach(([name, color], i) => {
    ctx.beginPath();
    ctx.arc(0, (i - 1) * r * 0.92, r * 0.36, 0, Math.PI * 2);
    ctx.fillStyle = on === name ? color : PALETTE.lampOff;
    ctx.fill();
  });
  ctx.restore();
}

function drawControls(
  ctx: CanvasRenderingContext2D,
  v: View,
  tpl: Template,
  phaseIndex: number,
): void {
  // Ni autoput ni otvoren put nemaju krakove, pa ni znakove na njima.
  if (bezKrakova(tpl)) return;
  const r = Math.max(MIN_SIGN_PX / 2, 1.15 * v.scale);
  for (const a of tpl.arms) {
    const p = px(v, signSpot(tpl, a));
    if (a.control.kind === "light") {
      drawLight(ctx, p.x, p.y, r, lightFor(tpl, phaseIndex, a.control.phaseGroup));
    } else if (a.control.kind !== "none") {
      drawSign(ctx, p.x, p.y, r, a.control.kind);
    }
  }
}

// ── Putanja igrača ──────────────────────────────────────────────────────────

/** Dio putanje između dva `s`, kao niz tačaka sa tačnim krajevima. */
function pathSlice(path: Path, from: number, to: number): Point[] {
  const out: Point[] = [pointAt(path.points, path.cum, from)];
  path.points.forEach((p, i) => {
    const c = path.cum[i]!;
    if (c > from && c < to) out.push(p);
  });
  out.push(pointAt(path.points, path.cum, to));
  return out;
}

function strokePoints(
  ctx: CanvasRenderingContext2D,
  v: View,
  pts: readonly Point[],
  color: string,
  widthM: number,
  alpha: number,
): void {
  if (pts.length < 2) return;
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = Math.max(2, widthM * v.scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  pts.forEach((p, i) => {
    const q = px(v, p);
    if (i === 0) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  });
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * Putanja igrača sa zonama pokazivača.
 *
 * Cijela putanja se vidi od početka: pređeni dio blijedi, preostali je pun.
 * Zone su segmenti druge boje sa slovom strane — polaznik mora da vidi GDJE se
 * šta traži, jer je pravilo vezano za mjesto na putanji, a ne za vrijeme.
 */
function drawPlayerPath(
  ctx: CanvasRenderingContext2D,
  v: View,
  path: Path,
  intent: Intent,
  fromS: number,
  zones: { labels?: { left: string; right: string } } | null,
): void {
  strokePoints(ctx, v, pathSlice(path, 0, Math.max(0.01, fromS)), PALETTE.blue, 0.9, 0.22);
  const pts = pathSlice(path, Math.max(0, fromS), path.length);
  strokePoints(ctx, v, pts, PALETTE.blue, 0.9, 0.7);

  if (zones) {
    for (const ph of phasesFor(path, intent, undefined, { hints: true })) {
      if (ph.expected === null) continue;
      strokePoints(ctx, v, pathSlice(path, ph.from, ph.to), PALETTE.zone, 1.5, 0.55);
      if (zones.labels) {
        const mid = px(v, pointAt(path.points, path.cum, (ph.from + ph.to) / 2));
        const r = Math.max(7, 1.1 * v.scale);
        ctx.beginPath();
        ctx.arc(mid.x, mid.y, r, 0, Math.PI * 2);
        ctx.fillStyle = PALETTE.zone;
        ctx.fill();
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = PALETTE.ink;
        ctx.font = `bold ${Math.round(r * 1.4)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(ph.expected === "left" ? zones.labels.left : zones.labels.right, mid.x, mid.y);
      }
    }
  }

  if (pts.length < 2) return;
  // Strelica na kraju — bez nje se ne vidi kuda putanja vodi.
  const tip = px(v, pts[pts.length - 1]!);
  const before = px(v, pts[pts.length - 2]!);
  const ang = Math.atan2(tip.y - before.y, tip.x - before.x);
  const a = Math.max(6, 1.2 * v.scale);
  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(a, 0);
  ctx.lineTo(-a * 0.8, a * 0.7);
  ctx.lineTo(-a * 0.8, -a * 0.7);
  ctx.closePath();
  ctx.fillStyle = PALETTE.blue;
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ── Vozila ──────────────────────────────────────────────────────────────────

/**
 * Boja vozila koja se ne mijenja dok ono postoji.
 *
 * Vozila iz scenarija nose redni broj u `id`-u i dobijaju boju po njemu, kao i
 * do sada. Saobraćaj na putu nastaje i nestaje u toku vožnje, pa bi boja po
 * mjestu u nizu skakala čim neko ispred izađe — zato se bira iz samog `id`-a.
 */
function bojaVozila(veh: Vehicle): string {
  const paleta = PALETTE.npc;
  const redni = /^npc(\d+)$/.exec(veh.id);
  if (redni) return paleta[(Number(redni[1]) - 1) % paleta.length]!;
  let h = 2166136261;
  for (let i = 0; i < veh.id.length; i++) h = Math.imul(h ^ veh.id.charCodeAt(i), 16777619) >>> 0;
  return paleta[h % paleta.length]!;
}

/**
 * Koliko se vozila uvećavaju na uskom ekranu.
 *
 * Na telefonu 4,4 m ispadne petnaestak piksela; ispod `MIN_CAR_PX` se vozilo
 * crta uvećano, jer je čitljivost preča od razmjere. Faktor je isti za sve
 * vrste, da mali auto, kombi i kamion ostanu u razmjeri jedan prema drugom.
 */
const uvecanje = (v: View): number =>
  Math.max(MIN_CAR_PX, CAR_LENGTH * v.scale) / (CAR_LENGTH * v.scale);

function drawVehicle(
  ctx: CanvasRenderingContext2D,
  v: View,
  tijelo: readonly DioTijela[],
  heading: Point,
  color: string,
  vrsta: VrstaVozila | undefined,
  opts: {
    braking: boolean;
    blink: "left" | "right" | null;
    highlight: string | null;
    beacon: boolean;
  },
): void {
  if (tijelo.length > 1) {
    drawDugoVozilo(ctx, v, tijelo, color, vrsta, opts);
    return;
  }
  const dio = tijelo[0];
  if (!dio) return;
  const k = uvecanje(v);
  const lenPx = dio.length * v.scale * k;
  const widPx = dio.width * v.scale * k;
  const c = px(v, dio.pos);
  const ang = screenAngle(v, heading);

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(ang);

  if (opts.highlight) {
    ctx.beginPath();
    ctx.arc(0, 0, lenPx * 0.78, 0, Math.PI * 2);
    ctx.strokeStyle = opts.highlight;
    ctx.lineWidth = Math.max(2, lenPx * 0.1);
    ctx.stroke();
  }

  // Karoserija je nacrtana „naprijed = +x", pa je rotacija ugao smjera.
  roundedRect(ctx, -lenPx / 2, -widPx / 2, lenPx, widPx, widPx * 0.25);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();

  if (vrsta === "kombi") {
    // Kombi: kratka hauba, pa vjetrobran skoro naprijed, a iza njega ravan krov.
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(lenPx * 0.24, -widPx * 0.36, lenPx * 0.13, widPx * 0.72);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(-lenPx * 0.44, -widPx * 0.38, lenPx * 0.64, widPx * 0.76);
  } else {
    // Vjetrobran — po njemu se vidi gdje je prednji kraj.
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(lenPx * 0.1, -widPx * 0.34, lenPx * 0.2, widPx * 0.68);
  }

  // Stop svjetla.
  ctx.fillStyle = opts.braking ? "#ff3b30" : "rgba(0,0,0,0.35)";
  ctx.fillRect(-lenPx / 2, -widPx * 0.42, lenPx * 0.1, widPx * 0.22);
  ctx.fillRect(-lenPx / 2, widPx * 0.2, lenPx * 0.1, widPx * 0.22);

  if (opts.beacon) {
    // Rotacija na krovu — trepće brže od pokazivača pravca, kao i u stvarnosti.
    ctx.fillStyle = PALETTE.beacon;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(2.5, widPx * 0.3), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.paint;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (opts.blink) {
    // Pokazivač pravca: NPC namjera se drukčije ne vidi, a od nje zavisi
    // ko kome ustupa.
    const sy = opts.blink === "right" ? widPx * 0.5 : -widPx * 0.5;
    ctx.fillStyle = PALETTE.yellow;
    ctx.beginPath();
    ctx.arc(lenPx * 0.36, sy, Math.max(1.5, widPx * 0.16), 0, Math.PI * 2);
    ctx.arc(-lenPx * 0.36, sy, Math.max(1.5, widPx * 0.16), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Kamion ili autobus: tijelo od više komada koji prate putanju.
 *
 * Obris se slaže iz poprečnih presjeka na krajevima i spojevima komada, pa se
 * vozilo u krivini savije zajedno sa trakom — isto tijelo po kojem se računa i
 * sudar. Crta se u koordinatama svijeta, a ne u okrenutom okviru kao auto:
 * dugo vozilo u krivini nema jedan smjer.
 */
function drawDugoVozilo(
  ctx: CanvasRenderingContext2D,
  v: View,
  tijelo: readonly DioTijela[],
  color: string,
  vrsta: VrstaVozila | undefined,
  opts: { braking: boolean; blink: "left" | "right" | null; highlight: string | null },
): void {
  const prvi = tijelo[0];
  const zadnji = tijelo[tijelo.length - 1];
  if (!prvi || !zadnji) return;
  const pola = (prvi.width * uvecanje(v)) / 2;
  const kraj = (d: DioTijela, koliko: number): Point => plus(d.pos, mul(d.heading, koliko));

  // Presjeci od zadnjeg branika do prednjeg. Na spoju dva komada se uzima
  // sredina njihovih krajeva i srednji smjer, da obris nema zub.
  const presjeci: { c: Point; h: Point }[] = [{ c: kraj(prvi, -prvi.length / 2), h: prvi.heading }];
  for (let i = 0; i + 1 < tijelo.length; i++) {
    const a = tijelo[i]!;
    const b = tijelo[i + 1]!;
    const h = plus(a.heading, b.heading);
    const d = Math.hypot(h.x, h.y) || 1;
    presjeci.push({
      c: mul(plus(kraj(a, a.length / 2), kraj(b, -b.length / 2)), 0.5),
      h: { x: h.x / d, y: h.y / d },
    });
  }
  presjeci.push({ c: kraj(zadnji, zadnji.length / 2), h: zadnji.heading });
  const bok = (p: { c: Point; h: Point }, znak: number): Point => plus(p.c, mul(rt(p.h), pola * znak));
  const obris = [...presjeci.map((p) => bok(p, 1)), ...presjeci.map((p) => bok(p, -1)).reverse()];

  if (opts.highlight) {
    const duzina = tijelo.reduce((a, d) => a + d.length, 0);
    const q = px(v, tijelo[Math.floor(tijelo.length / 2)]!.pos);
    ctx.beginPath();
    ctx.arc(q.x, q.y, duzina * v.scale * 0.62, 0, Math.PI * 2);
    ctx.strokeStyle = opts.highlight;
    ctx.lineWidth = Math.max(2, duzina * v.scale * 0.04);
    ctx.stroke();
  }

  fillPoly(ctx, v, obris, vrsta === "autobus" ? PALETTE.autobus : PALETTE.sanduk);
  strokeLine(ctx, v, [...obris, obris[0]!], "rgba(0,0,0,0.4)", 0.06);

  const naprijed = zadnji.heading;
  const nos = kraj(zadnji, zadnji.length / 2);
  if (vrsta === "autobus") {
    // Prozori duž oba boka, pa vjetrobran preko skoro cijele širine.
    for (const d of tijelo) {
      for (const znak of [1, -1]) {
        const c = plus(d.pos, mul(rt(d.heading), (pola - 0.45) * znak));
        fillPoly(ctx, v, worldRect(c, d.heading, d.length * 0.78, 0.5), "rgba(255,255,255,0.45)");
      }
    }
    fillPoly(ctx, v, worldRect(kraj(zadnji, zadnji.length / 2 - 0.5), naprijed, 0.6, pola * 1.6), "rgba(255,255,255,0.75)");
  } else {
    // Kamion: kabina u boji vozila ispred svijetlog sanduka.
    const kabina = Math.min(2.4, zadnji.length);
    fillPoly(ctx, v, worldRect(plus(nos, mul(naprijed, -kabina / 2)), naprijed, kabina, pola * 2), color);
    fillPoly(ctx, v, worldRect(plus(nos, mul(naprijed, -0.75)), naprijed, 0.5, pola * 1.4), "rgba(255,255,255,0.7)");
  }

  // Stop svjetla na zadnjem kraju.
  const rep = kraj(prvi, -prvi.length / 2 + 0.2);
  for (const znak of [1, -1]) {
    fillPoly(
      ctx,
      v,
      worldRect(plus(rep, mul(rt(prvi.heading), pola * 0.62 * znak)), prvi.heading, 0.4, pola * 0.5),
      opts.braking ? "#ff3b30" : "rgba(0,0,0,0.35)",
    );
  }

  if (opts.blink) {
    // Pokazivač na prednjem i zadnjem uglu, na strani na koju se ide.
    const znak = opts.blink === "right" ? 1 : -1;
    const r = Math.max(1.5 / v.scale, pola * 0.3);
    fillCircle(ctx, v, plus(kraj(zadnji, zadnji.length / 2 - 0.4), mul(rt(naprijed), pola * znak)), r, PALETTE.yellow);
    fillCircle(ctx, v, plus(kraj(prvi, -prvi.length / 2 + 0.4), mul(rt(prvi.heading), pola * znak)), r, PALETTE.yellow);
  }
}

/**
 * Oznaka na ivici kadra za vozilo koje još nije u kadru.
 *
 * Bez nje NPC iskrsne na ivici ekrana taman toliko prije raskrsnice da igrač ne
 * stigne da reaguje — a to nije vježba tajminga nego pogađanje. Oznaka stoji
 * umjesto perifernog vida: stvarni vozač saobraćaj vidi i sa 150 m.
 */
function drawEdgeMarker(
  ctx: CanvasRenderingContext2D,
  v: View,
  pos: Point,
  heading: Point,
  color: string,
): void {
  const inset = EDGE_MARKER_INSET * v.scale;
  const raw = px(v, pos);
  const c = {
    x: Math.max(inset, Math.min(v.wPx - inset, raw.x)),
    y: Math.max(inset, Math.min(v.hPx - inset, raw.y)),
  };
  const r = Math.max(7, 1.3 * v.scale);

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(screenAngle(v, heading));
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(-r * 0.7, r * 0.8);
  ctx.lineTo(-r * 0.7, -r * 0.8);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Pješak iz ptičje perspektive — glava, tijelo, dvije noge. */
function drawPedestrian(
  ctx: CanvasRenderingContext2D,
  v: View,
  tpl: Template,
  ped: Pedestrian,
): void {
  const p = px(v, pedestrianPos(tpl, ped.arm, ped.u));
  // Čovjek je pola metra širok, što je na ovoj razmjeri tri piksela — crta se
  // uvećano, iz istog razloga kao i vozila (vidi `MIN_CAR_PX`).
  const r = Math.max(4.5, 0.55 * v.scale);

  ctx.save();
  ctx.translate(p.x, p.y);
  // Bijeli obrub: pješak je siva figura na sivom asfaltu i bez njega se gubi.
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.9, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fill();

  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-r * 1.5, -r * 0.35, r * 3, r * 0.7);
  ctx.restore();
}

/**
 * Policajac na sredini raskrsnice, sa rukama duž pravca koji propušta.
 *
 * Nije ukras: raširene ruke znače da vozila koja mu dolaze sprijeda i otpozadi
 * stoje, a ona sa strane prolaze. Zato ruke pokazuju baš ka krakovima kojima je
 * prolaz dozvoljen — polaznik može da pročita naredbu sa slike.
 */
function drawOfficer(
  ctx: CanvasRenderingContext2D,
  v: View,
  allow: readonly ArmId[],
): void {
  const c = px(v, { x: 0, y: 0 });
  // Namjerno krupnije od stvarnih razmjera: naredba se čita sa raširenih ruku,
  // a čovjek u prirodnoj veličini je ovdje desetak piksela.
  const r = Math.max(6, 0.75 * v.scale);
  const dozvoljen = allow[0];
  const osa = dozvoljen ? OUTBOUND[dozvoljen] : { x: 1, y: 0 };

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(screenAngle(v, osa));

  // Svijetla podloga — tamna figura na tamnom asfaltu se inače ne vidi.
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fill();

  // ruke duž propuštenog pravca
  ctx.strokeStyle = PALETTE.officer;
  ctx.lineWidth = Math.max(2.5, r * 0.5);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-r * 3, 0);
  ctx.lineTo(r * 3, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.officer;
  ctx.fill();
  ctx.strokeStyle = PALETTE.paint;
  ctx.lineWidth = Math.max(1, r * 0.28);
  ctx.stroke();
  ctx.restore();
}

/**
 * Okolina pored puta.
 *
 * Površine se ne crtaju kao poligoni nego kao TRAKE uz put: za svaki komad
 * rute se zna šta leži lijevo a šta desno, pa se to oboji od ivice kolovoza do
 * ruba pojasa. Razlog stoji u `world/okolina.ts` — ukratko, preslikan obris
 * šume se raspadne u krpice, a sa vozačkog mjesta se ionako vidi samo šta je s
 * koje strane.
 *
 * Linije — obala, rijeka, sporedna ulica — crtaju se poslije traka, jer idu
 * preko njih.
 */
function drawOkolina(
  ctx: CanvasRenderingContext2D,
  v: View,
  tpl: RoadTemplate,
  okolina: Okolina,
): void {
  const { points, heading } = centerLine(tpl);
  const korak = tpl.length / Math.max(1, points.length - 1);
  const odIvice = tpl.geometry.laneWidth + 1.6;

  for (const traka of okolina.trake) {
    const i0 = Math.max(0, Math.floor(traka.odS / korak));
    const i1 = Math.min(points.length - 1, Math.ceil(traka.doS / korak));
    if (i1 - i0 < 1) continue;
    // Kadar je uzak: komad koji ni jednim krajem ne dodiruje ekran se preskače
    // prije nego što se za njega išta izračuna.
    if (!uKadru(v, [points[i0]!, points[i1]!])) continue;

    for (const [strana, vrsta] of [
      [1, traka.lijevo],
      [-1, traka.desno],
    ] as const) {
      if (!vrsta) continue;
      const boja = OKOLINA_BOJE[vrsta];
      if (!boja) continue;
      const blize: Point[] = [];
      const dalje: Point[] = [];
      for (let i = i0; i <= i1; i++) {
        const p = points[i]!;
        const u = heading[i] ?? 0;
        const cos = Math.cos(u);
        const sin = Math.sin(u);
        blize.push({ x: p.x + cos * odIvice * strana, y: p.y - sin * odIvice * strana });
        dalje.push({
          x: p.x + cos * OKOLINA_POJAS * strana,
          y: p.y - sin * OKOLINA_POJAS * strana,
        });
      }
      fillPoly(ctx, v, [...blize, ...dalje.reverse()], boja);
      drawSitno(ctx, v, points, heading, i0, i1, strana, vrsta, odIvice);
    }
  }

  for (const linija of okolina.linije) {
    const stil = OKOLINA_LINIJE[linija.k];
    if (!stil) continue;
    if (!uKadru(v, linija.tacke)) continue;
    strokeLine(ctx, v, linija.tacke, stil.boja, stil.sirina);
  }
}

/**
 * Broj iz cijelog broja, uvijek isti za isti ulaz.
 *
 * Služi da drvo ili kuća stoje na istom mjestu pri svakoj vožnji: mjesto se
 * računa iz položaja, a ne iz `Math.random`. Bez toga bi se okolina mrdala
 * između dva kadra i ponavljanje snimka ne bi izgledalo isto.
 */
function sjeme(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x165667b1, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491);
  h ^= h >>> 13;
  return ((h >>> 0) % 10000) / 10000;
}

/** Sitni sadržaj u traci okoline: drveće, kuće, talasi, brazde. */
function drawSitno(
  ctx: CanvasRenderingContext2D,
  v: View,
  points: readonly Point[],
  heading: readonly number[],
  i0: number,
  i1: number,
  strana: 1 | -1,
  vrsta: string,
  odIvice: number,
): void {
  const stil = OKOLINA_SITNO[vrsta];
  if (!stil) return;
  // Na sitnoj razmjeri se ovo ionako ne raspoznaje, a košta.
  if (stil.velicina * v.scale < 3) return;

  const korakTacaka = Math.max(1, Math.round(stil.razmak / Math.max(0.5, ROUTE_STEP)));
  const sirina = OKOLINA_POJAS - odIvice;
  ctx.fillStyle = stil.boja;

  for (let i = i0; i <= i1; i += korakTacaka) {
    const p = points[i]!;
    const u = heading[i] ?? 0;
    const cos = Math.cos(u);
    const sin = Math.sin(u);
    // Dva reda po koraku, na različitim odmacima od puta.
    for (let red = 0; red < 2; red++) {
      const t = sjeme(i, red * 7 + (strana > 0 ? 1 : 2));
      const odmak = odIvice + (0.15 + 0.7 * t) * sirina;
      const uzduz = (sjeme(i + 31, red) - 0.5) * stil.razmak;
      const c = {
        x: p.x + cos * odmak * strana - sin * uzduz,
        y: p.y - sin * odmak * strana - cos * uzduz,
      };
      const q = px(v, c);
      if (q.x < -40 || q.x > v.wPx + 40 || q.y < -40 || q.y > v.hPx + 40) continue;
      const r = stil.velicina * v.scale * (0.75 + 0.5 * sjeme(i, red + 3));

      if (stil.oblik === "drvo") {
        ctx.beginPath();
        ctx.arc(q.x, q.y, r / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (stil.oblik === "kuca") {
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(screenAngle(v, { x: cos, y: -sin }));
        ctx.fillRect(-r / 2, -r * 0.35, r, r * 0.7);
        ctx.restore();
      } else {
        // Talas i brazda su kratke crte poprijeko na put.
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(screenAngle(v, { x: cos, y: -sin }) + (stil.oblik === "talas" ? Math.PI / 2 : 0));
        ctx.fillRect(-r / 2, -Math.max(1, 0.25 * v.scale) / 2, r, Math.max(1, 0.25 * v.scale));
        ctx.restore();
      }
    }
  }
}

/**
 * Vrhovi na horizontu.
 *
 * Planina je kilometrima daleko i u kadru od sedamdeset metara je nema. Ali sa
 * puta se vidi, i po njoj se zna gdje si — zato se crta na IVICI kadra, u
 * pravcu u kojem stvarno leži, sa imenom i visinom.
 *
 * Pravac se računa u STVARNIM koordinatama: gdje je vozilo u prirodi i kuda
 * gleda. Sabijeni svijet o stranama svijeta ne zna ništa.
 */
function drawHorizont(
  ctx: CanvasRenderingContext2D,
  v: View,
  okolina: Okolina,
  s: number,
): void {
  if (okolina.vrhovi.length === 0) return;
  const poza = okolina.poza(s);
  if (!poza) return;

  const vozac = Math.atan2(poza.smjer.y, poza.smjer.x);
  const cx = v.wPx / 2;
  const cy = v.hPx * 0.62;

  const kandidati = okolina.vrhovi
    .map((vrh) => {
      const dx = vrh.x - poza.p.x;
      const dy = vrh.y - poza.p.y;
      let ugao = Math.atan2(dy, dx) - vozac;
      while (ugao > Math.PI) ugao -= 2 * Math.PI;
      while (ugao <= -Math.PI) ugao += 2 * Math.PI;
      return { vrh, ugao, daljina: Math.hypot(dx, dy) };
    })
    // Iza leđa se ne gleda. Ostalo se rangira isto kao pri izboru vrhova za
    // rutu: visok i blizak ide prvi, jer se on sa puta i najbolje vidi.
    .filter((x) => Math.abs(x.ugao) < HORIZONT_UGAO)
    .sort((a, b) => b.vrh.visina - b.daljina / 20 - (a.vrh.visina - a.daljina / 20));

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 12px system-ui, sans-serif";

  const zauzeto: { x: number; y: number }[] = [];
  let ispisanih = 0;
  for (const { vrh, ugao, daljina } of kandidati) {
    if (ispisanih >= HORIZONT_NAJVISE) break;
    const q = naIviciKadra(v, cx, cy, ugao);
    // Dva vrha u istom pravcu daju dva natpisa jedan preko drugog. Ono što je
    // niže rangirano se preskače — bolje jedno čitko ime nego dva nečitka.
    if (zauzeto.some((z) => Math.abs(z.x - q.x) < HORIZONT_RAZMAK && Math.abs(z.y - q.y) < 22)) {
      continue;
    }
    zauzeto.push(q);
    ispisanih += 1;

    // Što je vrh dalji, to je blijeđi — bliska planina se nameće, daleka se
    // nazire.
    ctx.globalAlpha = Math.max(0.55, 1 - daljina / 40000);

    const natpis = `${vrh.ime} ${vrh.visina}`;
    const sirina = ctx.measureText(natpis).width + 12;
    // Tabla ide ispod trougla, a uz ivicu se pomjera unutra da ne izađe iz
    // kadra.
    const tx = Math.min(v.wPx - sirina / 2 - 3, Math.max(sirina / 2 + 3, q.x));
    const ty = Math.min(v.hPx - 12, Math.max(24, q.y + 14));

    ctx.beginPath();
    ctx.moveTo(q.x - 8, q.y + 6);
    ctx.lineTo(q.x, q.y - 7);
    ctx.lineTo(q.x + 8, q.y + 6);
    ctx.closePath();
    ctx.fillStyle = PALETTE.ink;
    ctx.fill();

    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = PALETTE.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(tx - sirina / 2, ty - 9, sirina, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = PALETTE.ink;
    ctx.fillText(natpis, tx, ty);
  }
  ctx.restore();
}

/**
 * Gdje zrak iz sredine kadra probija njegovu ivicu.
 *
 * Vrh se ne crta tamo gdje bi stvarno pao — na dvadeset kilometara to je daleko
 * van platna. Crta se na ivici, u pravcu u kojem leži, kao strelica koja kaže
 * „tamo je".
 */
function naIviciKadra(
  v: View,
  cx: number,
  cy: number,
  ugao: number,
): { x: number; y: number } {
  // Nagore je smjer vožnje; ugao raste udesno.
  const dx = Math.sin(ugao);
  const dy = -Math.cos(ugao);
  let t = Infinity;
  if (dx > 1e-6) t = Math.min(t, (v.wPx - HORIZONT_RUB - cx) / dx);
  if (dx < -1e-6) t = Math.min(t, (HORIZONT_RUB - cx) / dx);
  if (dy > 1e-6) t = Math.min(t, (v.hPx - HORIZONT_RUB - cy) / dy);
  if (dy < -1e-6) t = Math.min(t, (HORIZONT_RUB - cy) / dy);
  if (!Number.isFinite(t)) t = 0;
  return { x: cx + dx * t, y: cy + dy * t };
}

/** Da li polilinija uopšte dodiruje kadar — gruba provjera po okviru. */
function uKadru(v: View, tacke: readonly Point[]): boolean {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of tacke) {
    const q = px(v, p);
    if (q.x < minX) minX = q.x;
    if (q.y < minY) minY = q.y;
    if (q.x > maxX) maxX = q.x;
    if (q.y > maxY) maxY = q.y;
  }
  return maxX >= 0 && minX <= v.wPx && maxY >= 0 && minY <= v.hPx;
}

// ── Scena ───────────────────────────────────────────────────────────────────

export interface DrawOptions {
  /**
   * Okolina pored puta, već preslikana u koordinate rute.
   *
   * Crta se PRVA, ispod svega: more, šume, naselja i sporedne ulice su podloga
   * po kojoj put ide. Prosljeđuje se spolja jer zavisi od rute, a šablon puta o
   * ruti ne zna ništa.
   */
  okolina?: Okolina | null;
  /** Vozilo koje treba istaći crveno (kome je oduzeta prednost, ili sudar). */
  flagVehicleId?: string | null;
  /** Da li igrač trenutno koči — stop svjetla se ne mogu izvesti iz stanja. */
  playerBraking?: boolean;
  /** Policajac je dio scenarija, ne raskrsnice — zato stiže spolja. */
  officer?: ScenarioOfficer | null;
  /**
   * Zone pokazivača na putanji igrača. `null` ih gasi — na najtežem nivou
   * polaznik mora sam da zna gdje se šta traži.
   */
  indicatorZones?: { labels?: { left: string; right: string } } | null;
  /**
   * Kamera prati igrača umjesto da stoji na raskrsnici.
   *
   * Koristi je beskonačni mod: tamo se vozi kroz niz raskrsnica, pa fiksni
   * kadar nema šta da fiksira. `half` sužava vidno polje, jer se u praćenju
   * gleda ono ispred, a ne cijela raskrsnica odjednom.
   *
   * `rotate` uz to okreće kadar tako da je vozačev pravac uvijek NAGORE. Traži
   * ga ruta: na trideset kilometara stvarnog puta se smjer promijeni za više
   * punih krugova, pa bi bez okretanja vozilo klizilo bočno preko ekrana, a
   * lijevo i desno bi zamijenili mjesta. Raskrsnica ga ne traži — tamo se ulazi
   * uvijek sa istog kraka.
   */
  camera?: { follow: boolean; half?: number; rotate?: boolean };
}

/** Nacrtaj cijelu scenu — svejedno je da li se vozi ili se ponavlja snimak. */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  runner: Driver,
  widthPx: number,
  heightPx: number,
  opts: DrawOptions = {},
): void {
  const world = runner.world;
  const tpl = templateById(world.templateId);
  if (!tpl) return;
  const { paths } = compile(tpl);
  const v = viewFor(widthPx, heightPx, opts.camera?.half ?? tpl.viewHalf);
  if (opts.camera?.follow) {
    const igrac = world.vehicles.find((x) => x.kind === "player");
    const p = igrac ? paths.get(igrac.pathId) : undefined;
    if (igrac && p) {
      // Kamera prati OSU TRAKE, ne samo vozilo: kad se auto pomjeri u stranu,
      // mora se vidjeti da se pomjerio. Da kadar ide za njim, put bi klizio
      // ispod auta, a igrač ne bi imao po čemu da zna gdje je u traci.
      const stanje = { ...igrac, s: renderS(runner, igrac.id, igrac.s), lateral: 0 };
      const poza = poseOn(tpl, p, stanje);
      const poz = poza.pos;
      // Igrač stoji na 62% visine — dvije trećine kadra su ono ispred njega, a
      // ispred je NAGORE (vidi `px`). Predznaci prate okrenuti kadar.
      // Na autoputu se prati samo uzduž: da kadar klizi i bočno pri promjeni
      // trake značilo bi da se pomjera put, a ne vozilo.
      if (opts.camera.rotate) {
        // Kadar se okreće oko igrača tako da mu je pravac uvijek nagore.
        //
        // Smjer se NE uzima iz `poseOn`: on ga mjeri preko pola metra, pa je
        // stepenast — mijenja se skokom na svakom tjemenu polilinije, i vozilo
        // u krivini poskakuje. Ovdje se mjeri preko tetive od `KAMERA_TETIVA`
        // metara, pa se ugao mijenja glatko.
        const sSad = renderS(runner, igrac.id, igrac.s);
        const a = pointAt(p.points, p.cum, Math.max(0, sSad - KAMERA_TETIVA / 2));
        const b = pointAt(p.points, p.cum, Math.min(p.length, sSad + KAMERA_TETIVA / 2));
        v.wx = poz.x;
        v.wy = poz.y;
        v.cx = widthPx / 2;
        v.cy = heightPx * 0.62;
        v.rot = -Math.PI / 2 - Math.atan2(-(b.y - a.y), -(b.x - a.x));
      } else {
        v.cx = widthPx / 2 + (tpl.kind === "highway" ? 0 : poz.x) * v.scale;
        v.cy = heightPx * 0.62 + poz.y * v.scale;
      }
    }
  }

  const player = world.vehicles.find((x) => x.kind === "player");

  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, widthPx, heightPx);

  if (opts.okolina && tpl.kind === "road") drawOkolina(ctx, v, tpl, opts.okolina);

  if (tpl.kind === "roundabout") {
    drawRoundabout(ctx, v, tpl);
  } else if (tpl.kind === "highway") {
    drawHighway(ctx, v, tpl);
  } else if (tpl.kind === "road") {
    drawRoad(ctx, v, tpl, player ? renderS(runner, player.id, player.s) : undefined);
  } else {
    drawRoads(ctx, v, tpl);
    drawMarkings(ctx, v, tpl);
  }

  // Na otvorenom putu se putanja ne iscrtava: nema manevra ni zone, a plava
  // linija preko cijele trake bi četiri minuta stajala preko puta bez potrebe.
  if (player && tpl.kind !== "road") {
    const path = paths.get(player.pathId);
    if (path) {
      drawPlayerPath(
        ctx,
        v,
        path,
        player.intent,
        renderS(runner, player.id, player.s),
        opts.indicatorZones ?? null,
      );
    }
  }

  // Horizont ide PREKO svega osim HUD-a: vrhovi su daleko i ne zaklanjaju ih ni
  // put ni vozila.
  if (opts.okolina && tpl.kind === "road" && player) {
    drawHorizont(ctx, v, opts.okolina, renderS(runner, player.id, player.s));
  }

  drawControls(ctx, v, tpl, world.phaseIndex);

  for (const ped of world.pedestrians) {
    if (ped.done || world.t < ped.spawnT) continue;
    drawPedestrian(ctx, v, tpl, ped);
  }

  const naredba = officerAllow(opts.officer ?? undefined, world.t);
  if (naredba) drawOfficer(ctx, v, naredba);

  // Sjena iza kamiona: dio puta koji vozač ne vidi. Crta se ispod vozila, a
  // vozila čija je sredina u njoj se ne crtaju — ni njihova oznaka na ivici
  // kadra. Isti spisak zaklanjača po kojem se sudi preglednost.
  const sjene = tpl.kind === "road" && player ? sjeneZaklona(runner, tpl, paths, player) : null;
  for (const poligon of sjene?.poligoni ?? []) fillPoly(ctx, v, poligon, PALETTE.sjena);
  const uSjeni = (id: string, pos: Point): boolean =>
    sjene !== null && !sjene.zaklanjaci.has(id) && sjene.poligoni.some((pol) => uPoligonu(pos, pol));

  const blinkOn = pokazivacSvijetli(world.t);
  // Na otvorenom putu se oznake na ivici kadra ne crtaju odmah nego se skupe, pa
  // se nacrta po jedna — za najbliže vozilo van kadra u svakoj traci, ispred i
  // iza. Vidi `OZNAKA_DOMET_PUT`.
  const naPutu = tpl.kind === "road";
  const sIgraca = player ? renderS(runner, player.id, player.s) : 0;
  const oznake = new Map<string, { daljina: number; pos: Point; heading: Point; color: string }>();

  for (const veh of world.vehicles) {
    const path = paths.get(veh.pathId);
    if (!path || veh.done || world.t < veh.spawnT) continue;

    const stanje = { ...veh, s: renderS(runner, veh.id, veh.s) };
    const { pos, heading } = poseOn(tpl, path, stanje);
    // Vozilo koje se pomjera u stranu ne gleda pravo. Ugao je stvaran odnos
    // bočne i uzdužne brzine, samo ograničen da na malim brzinama ne ispadne
    // pravi ugao. Crta se, ali se ne koristi za sudar — tijelo vozila ostaje
    // uz traku, kao i do sada.
    const nagib = veh.lateralV
      ? Math.max(-STEER_TILT, Math.min(STEER_TILT, Math.atan2(veh.lateralV, Math.max(6, veh.v))))
      : 0;
    const smjer = nagib === 0
      ? heading
      : {
          x: heading.x * Math.cos(nagib) - heading.y * Math.sin(nagib),
          y: heading.x * Math.sin(nagib) + heading.y * Math.cos(nagib),
        };
    const isPlayer = veh.kind === "player";
    if (!isPlayer && uSjeni(veh.id, pos)) continue;
    // Boja se veže za samo vozilo, a ne za redosljed crtanja — inače bi vozilo
    // promijenilo boju čim neko ispred njega izađe. Vidi `bojaVozila`.
    const color = isPlayer ? PALETTE.blue : veh.emergency ? PALETTE.emergency : bojaVozila(veh);

    // Dugo vozilo je u kadru i kad mu sredina nije: dovoljno je da se vidi bilo
    // koji njegov komad.
    const tijelo = tijeloVozila(tpl, path, stanje);
    if (!tijelo.some((d) => inFrame(v, d.pos))) {
      if (naPutu && !isPlayer) {
        // Susretna traka je okrenuta, pa se njeno `s` prevodi na mjesto na putu.
        const x = veh.lane === 1 ? path.length - stanje.s : stanje.s;
        const daljina = Math.abs(x - sIgraca);
        if (daljina > OZNAKA_DOMET_PUT) continue;
        const kljuc = `${veh.lane ?? 0}${x >= sIgraca ? "+" : "-"}`;
        const bila = oznake.get(kljuc);
        if (!bila || daljina < bila.daljina) oznake.set(kljuc, { daljina, pos, heading, color });
        continue;
      }
      // I igrač dobija oznaku: na dužem prilazu je na startu van kadra, pa bi
      // inače prvih par sekundi vozio nevidljiv.
      drawEdgeMarker(ctx, v, pos, heading, isPlayer ? PALETTE.blue : color);
      continue;
    }

    drawVehicle(ctx, v, tijelo, smjer, color, veh.vrsta, {
      braking: isPlayer ? Boolean(opts.playerBraking) : brakingNow(runner, veh),
      blink: veh.indicator && blinkOn ? veh.indicator : null,
      beacon: Boolean(veh.emergency) && Math.floor(world.t * BLINK_HZ * 4) % 2 === 0,
      highlight: opts.flagVehicleId === veh.id ? PALETTE.red : isPlayer ? PALETTE.paint : null,
    });
  }

  // Vozila na sporednim putevima: čekaju na liniji, ili skreću. Nisu u traci,
  // pa ih petlja iznad ne vidi — vidi `sim/prikljucci.ts`.
  if (tpl.kind === "road" && world.naSporednom && world.naSporednom.length > 0) {
    const nasa = paths.get(lanePathId(tpl.id, 0));
    for (const x of nasa ? world.naSporednom : []) {
      const p = tpl.prikljucci?.[x.j];
      if (!p || !nasa) continue;
      const { pos, heading } = pozaNaSporednom(nasa, p, tpl.geometry.laneWidth, x);
      if (!inFrame(v, pos) || uSjeni(x.id, pos)) continue;
      const mjere = VOZILA[x.vrsta];
      drawVehicle(
        ctx,
        v,
        [{ pos, heading, length: mjere.duzina, width: mjere.sirina }],
        heading,
        bojaVozila({ id: x.id } as Vehicle),
        x.vrsta,
        {
          braking: x.faza === "ceka",
          blink: x.indicator && blinkOn ? x.indicator : null,
          beacon: false,
          highlight: null,
        },
      );
    }
  }

  for (const o of oznake.values()) drawEdgeMarker(ctx, v, o.pos, o.heading, o.color);
}

/** Dužina sjene iza vozila koje zaklanja [m] — dalje od kadra ionako. */
const SJENA_DUZINA = 400;

/**
 * Sjene iza vozila koja igraču zaklanjaju suprotnu traku.
 *
 * Sjena je ono što se sa vozačevog mjesta ne vidi: između dva zraka iz oka
 * kroz krajnje uglove tijela vozila, i dalje od njega. Crta se sa položajem
 * kakav je na ekranu (`renderS`), a zaklanjači su isti oni po kojima se sudi.
 */
function sjeneZaklona(
  runner: Driver,
  tpl: RoadTemplate,
  paths: ReadonlyMap<string, Path>,
  player: Vehicle,
): { poligoni: Point[][]; zaklanjaci: Set<string> } | null {
  const put = paths.get(player.pathId);
  if (!put) return null;
  const spisak = zaklanjaci(runner.world, paths, player);
  if (spisak.length === 0) return null;
  const ja = { ...player, s: renderS(runner, player.id, player.s) };
  const { pos, heading } = poseOn(tpl, put, ja);
  const d = rt(heading);
  const oko = { x: pos.x - d.x * OKO_LIJEVO, y: pos.y - d.y * OKO_LIJEVO };
  const poligoni: Point[][] = [];
  for (const { vozilo } of spisak) {
    const p = paths.get(vozilo.pathId);
    if (!p) continue;
    const tijelo = tijeloVozila(tpl, p, { ...vozilo, s: renderS(runner, vozilo.id, vozilo.s) });
    const uglovi = tijelo.flatMap((t) => rectCorners(t.pos, t.heading, t.length, t.width));
    // Uglovi se porede po uglu gledanja, mjereno od pravca ka sredini vozila —
    // tako nema skoka preko ±180°.
    const sredina = {
      x: uglovi.reduce((a, u) => a + u.x, 0) / uglovi.length,
      y: uglovi.reduce((a, u) => a + u.y, 0) / uglovi.length,
    };
    const rx = sredina.x - oko.x;
    const ry = sredina.y - oko.y;
    const ugao = (u: Point) => Math.atan2(rx * (u.y - oko.y) - ry * (u.x - oko.x), rx * (u.x - oko.x) + ry * (u.y - oko.y));
    let min = uglovi[0]!;
    let max = uglovi[0]!;
    for (const u of uglovi) {
      if (ugao(u) < ugao(min)) min = u;
      if (ugao(u) > ugao(max)) max = u;
    }
    const dalje = (u: Point): Point => {
      const dx = u.x - oko.x;
      const dy = u.y - oko.y;
      const n = Math.hypot(dx, dy) || 1;
      return { x: u.x + (dx / n) * SJENA_DUZINA, y: u.y + (dy / n) * SJENA_DUZINA };
    };
    poligoni.push([min, dalje(min), dalje(max), max]);
  }
  return { poligoni, zaklanjaci: new Set(spisak.map((z) => z.vozilo.id)) };
}

/** Da li je tačka u poligonu — zrak udesno, broje se presjeci. */
function uPoligonu(p: Point, poligon: readonly Point[]): boolean {
  let unutra = false;
  for (let i = 0, j = poligon.length - 1; i < poligon.length; j = i++) {
    const a = poligon[i]!;
    const b = poligon[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) unutra = !unutra;
  }
  return unutra;
}

/** NPC koči ako mu je brzina pala u odnosu na prethodni korak. */
function brakingNow(runner: Driver, veh: Vehicle): boolean {
  const p = runner.prev.get(veh.id);
  return p !== undefined && veh.v < p.v - 0.02;
}

/** Znak/semafor na kraku igrača — HUD ga prikazuje kao ikonu. */
export function playerControl(
  world: World,
  officer?: ScenarioOfficer | null,
): {
  kind: string;
  light: string | null;
  /** Sekundi do promjene svjetla; `null` kad nema semafora. */
  countdown: number | null;
  /** Da li policajac propušta krak igrača; `null` kad policajca nema. */
  officerAllows: boolean | null;
} {
  const tpl = templateById(world.templateId);
  const player = world.vehicles.find((x) => x.kind === "player");
  const a =
    tpl && !bezKrakova(tpl)
      ? tpl.arms.find((x) => x.id === (player?.arm as ArmId))
      : undefined;
  // Policajac poništava i znak i semafor, pa se gleda prije njih.
  const naredba = officerAllow(officer ?? undefined, world.t);
  if (naredba && player) {
    return {
      kind: "officer",
      light: null,
      countdown: null,
      officerAllows: naredba.includes(player.arm),
    };
  }
  // Autoput nema znak na kraku, ali ima svoja pravila — kartica prekršaja po
  // ovome bira da li „prekoračenje brzine" objašnjava gradskim ili autoputskim
  // pravilom.
  if (tpl?.kind === "highway") {
    return { kind: "highway", light: null, countdown: null, officerAllows: null };
  }
  if (!tpl || !a) return { kind: "none", light: null, countdown: null, officerAllows: null };
  if (a.control.kind === "light") {
    return {
      kind: "light",
      light: lightFor(tpl, world.phaseIndex, a.control.phaseGroup),
      countdown: lightCountdown(tpl, world.phaseIndex, world.phaseT, a.control.phaseGroup),
      officerAllows: null,
    };
  }
  return { kind: a.control.kind, light: null, countdown: null, officerAllows: null };
}
