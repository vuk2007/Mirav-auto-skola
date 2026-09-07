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
  CAR_WIDTH,
  EDGE_MARKER_INSET,
  MIN_CAR_PX,
  MIN_SIGN_PX,
  VIEW_HALF,
} from "../sim/config";
import { headingAt, pointAt } from "../sim/geometry";
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
  TEMPLATES,
} from "../sim/intersection";
import type {
  Arm,
  ArmId,
  Intent,
  IntersectionTemplate,
  Path,
  Pedestrian,
  Point,
  RoundaboutTemplate,
  ScenarioOfficer,
  Template,
  Vehicle,
  World,
} from "../sim/types";
import { ringPorts } from "../sim/roundabout";
import { phasesFor } from "../sim/indicatorRules";
import { officerAllow } from "../sim/world";
import { renderS, type Driver } from "./runner";

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
} as const;

export interface View {
  cx: number;
  cy: number;
  /** Piksela po metru. */
  scale: number;
  /** Pola vidnog polja [m] — koristi ga i oznaka na ivici kadra. */
  half: number;
}

export function viewFor(widthPx: number, heightPx: number, half = VIEW_HALF): View {
  return {
    cx: widthPx / 2,
    cy: heightPx / 2,
    scale: Math.min(widthPx, heightPx) / (2 * half),
    half,
  };
}

const px = (v: View, p: Point): Point => ({ x: v.cx + p.x * v.scale, y: v.cy + p.y * v.scale });

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
    for (const ph of phasesFor(path, intent)) {
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

function drawVehicle(
  ctx: CanvasRenderingContext2D,
  v: View,
  pos: Point,
  heading: Point,
  color: string,
  opts: {
    braking: boolean;
    blink: "left" | "right" | null;
    highlight: string | null;
    beacon: boolean;
  },
): void {
  // Na uskom ekranu 4,4 m ispadne oko petnaest piksela; ispod toga se vozilo
  // crta uvećano, jer je čitljivost preča od razmjere.
  const lenPx = Math.max(MIN_CAR_PX, CAR_LENGTH * v.scale);
  const k = lenPx / (CAR_LENGTH * v.scale);
  const widPx = CAR_WIDTH * v.scale * k;
  const c = px(v, pos);
  const ang = Math.atan2(heading.y, heading.x);

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

  // Vjetrobran — po njemu se vidi gdje je prednji kraj.
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillRect(lenPx * 0.1, -widPx * 0.34, lenPx * 0.2, widPx * 0.68);

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
  const lim = v.half - EDGE_MARKER_INSET;
  const clamped = {
    x: Math.max(-lim, Math.min(lim, pos.x)),
    y: Math.max(-lim, Math.min(lim, pos.y)),
  };
  const c = px(v, clamped);
  const r = Math.max(7, 1.3 * v.scale);

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(Math.atan2(heading.y, heading.x));
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
  ctx.rotate(Math.atan2(osa.y, osa.x));

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

// ── Scena ───────────────────────────────────────────────────────────────────

export interface DrawOptions {
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
   * Jačina podrhtavanja kamere, 0–1.
   *
   * Koristi se pri naglom kočenju. Namjerno je slabo i kratko: cilj je da se
   * osjeti da je kočenje bilo naglo, a ne da se sakrije šta se dešava.
   */
  shake?: number;
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
  const tpl = TEMPLATES[world.templateId];
  if (!tpl) return;
  const { paths } = compile(tpl);
  const v = viewFor(widthPx, heightPx, tpl.viewHalf);
  const trese = opts.shake ?? 0;
  if (trese > 0) {
    // Pomjeraj je vezan za vrijeme simulacije, pa je isti i pri ponavljanju.
    v.cx += Math.sin(world.t * 47) * trese * 4;
    v.cy += Math.cos(world.t * 61) * trese * 4;
  }

  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, widthPx, heightPx);

  if (tpl.kind === "roundabout") {
    drawRoundabout(ctx, v, tpl);
  } else {
    drawRoads(ctx, v, tpl);
    drawMarkings(ctx, v, tpl);
  }

  const player = world.vehicles.find((x) => x.kind === "player");
  if (player) {
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

  drawControls(ctx, v, tpl, world.phaseIndex);

  for (const ped of world.pedestrians) {
    if (ped.done || world.t < ped.spawnT) continue;
    drawPedestrian(ctx, v, tpl, ped);
  }

  const naredba = officerAllow(opts.officer ?? undefined, world.t);
  if (naredba) drawOfficer(ctx, v, naredba);

  const blinkOn = Math.floor(world.t * BLINK_HZ * 2) % 2 === 0;
  // Boja NPC-a se veže za redosljed u scenariju, a ne za redosljed crtanja —
  // inače bi vozilo promijenilo boju čim neko ispred njega izađe.
  const npcOrder = new Map(
    world.vehicles.filter((x) => x.kind === "npc").map((x, i) => [x.id, i]),
  );

  for (const veh of world.vehicles) {
    const path = paths.get(veh.pathId);
    if (!path || veh.done || world.t < veh.spawnT) continue;

    const s = renderS(runner, veh.id, veh.s);
    const pos = pointAt(path.points, path.cum, s);
    const heading = headingAt(path.points, path.cum, s);
    const isPlayer = veh.kind === "player";
    const color = isPlayer
      ? PALETTE.blue
      : veh.emergency
        ? PALETTE.emergency
        : PALETTE.npc[(npcOrder.get(veh.id) ?? 0) % PALETTE.npc.length]!;

    if (Math.abs(pos.x) > v.half || Math.abs(pos.y) > v.half) {
      // I igrač dobija oznaku: na dužem prilazu je na startu van kadra, pa bi
      // inače prvih par sekundi vozio nevidljiv.
      drawEdgeMarker(ctx, v, pos, heading, isPlayer ? PALETTE.blue : color);
      continue;
    }

    drawVehicle(ctx, v, pos, heading, color, {
      braking: isPlayer ? Boolean(opts.playerBraking) : brakingNow(runner, veh),
      blink: veh.indicator && blinkOn ? veh.indicator : null,
      beacon: Boolean(veh.emergency) && Math.floor(world.t * BLINK_HZ * 4) % 2 === 0,
      highlight: opts.flagVehicleId === veh.id ? PALETTE.red : isPlayer ? PALETTE.paint : null,
    });
  }
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
  const tpl = TEMPLATES[world.templateId];
  const player = world.vehicles.find((x) => x.kind === "player");
  const a = tpl?.arms.find((x) => x.id === (player?.arm as ArmId));
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
