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
import { compile, lightCountdown, lightFor, OUTBOUND, TEMPLATES } from "../sim/intersection";
import type { Arm, ArmId, IntersectionTemplate, Path, Point, Vehicle, World } from "../sim/types";
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
} as const;

export interface View {
  cx: number;
  cy: number;
  /** Piksela po metru. */
  scale: number;
}

export function viewFor(widthPx: number, heightPx: number): View {
  return {
    cx: widthPx / 2,
    cy: heightPx / 2,
    scale: Math.min(widthPx, heightPx) / (2 * VIEW_HALF),
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

/** Pola širine kolovoza [m]: po jedna traka u svakom smjeru. */
const roadHalf = (tpl: IntersectionTemplate, arm: Arm): number =>
  tpl.geometry.laneWidth * arm.lanes;

/** Dokle seže tijelo raskrsnice — tu se kolovozi ukrštaju. */
function junctionHalf(tpl: IntersectionTemplate): number {
  return Math.max(...tpl.arms.map((a) => roadHalf(tpl, a)));
}

/** Rastojanje stop-linije od centra [m] — mora da prati `Path.stopLineS`. */
const stopLineAt = (tpl: IntersectionTemplate): number => tpl.geometry.size / 2;

function drawRoads(ctx: CanvasRenderingContext2D, v: View, tpl: IntersectionTemplate): void {
  const reach = VIEW_HALF * 1.5; // preko ivice ekrana, da nema šava

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
    const to = px(v, mul(out, VIEW_HALF * 1.5));
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
      const bars = 5;
      for (let i = 0; i < bars; i++) {
        const t = j + ((line - j) * (i + 0.25)) / bars;
        const c = mul(out, t);
        fillPoly(
          ctx,
          v,
          worldRect(c, out, (line - j) / (bars * 1.9), half * 2),
          PALETTE.paint,
        );
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
function signSpot(tpl: IntersectionTemplate, a: Arm): Point {
  const out = OUTBOUND[a.id];
  const inb = mul(out, -1);
  return plus(mul(out, stopLineAt(tpl) + 2.5), mul(rt(inb), roadHalf(tpl, a) + 2.6));
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
  tpl: IntersectionTemplate,
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

function drawPlayerPath(ctx: CanvasRenderingContext2D, v: View, path: Path, fromS: number): void {
  const pts = path.points.filter((_, i) => path.cum[i]! >= fromS);
  if (pts.length < 2) return;

  ctx.strokeStyle = PALETTE.yellow;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = Math.max(2, 0.9 * v.scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  pts.forEach((p, i) => {
    const q = px(v, p);
    if (i === 0) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  });
  ctx.stroke();

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
  ctx.fillStyle = PALETTE.yellow;
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
  opts: { braking: boolean; blink: "left" | "right" | null; highlight: string | null },
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
  const lim = VIEW_HALF - EDGE_MARKER_INSET;
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

// ── Scena ───────────────────────────────────────────────────────────────────

export interface DrawOptions {
  /** Vozilo koje treba istaći crveno (kome je oduzeta prednost, ili sudar). */
  flagVehicleId?: string | null;
  /** Da li igrač trenutno koči — stop svjetla se ne mogu izvesti iz stanja. */
  playerBraking?: boolean;
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
  const v = viewFor(widthPx, heightPx);

  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, widthPx, heightPx);

  drawRoads(ctx, v, tpl);
  drawMarkings(ctx, v, tpl);

  const player = world.vehicles.find((x) => x.kind === "player");
  if (player) {
    const path = paths.get(player.pathId);
    if (path) drawPlayerPath(ctx, v, path, renderS(runner, player.id, player.s));
  }

  drawControls(ctx, v, tpl, world.phaseIndex);

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
      : PALETTE.npc[(npcOrder.get(veh.id) ?? 0) % PALETTE.npc.length]!;

    if (Math.abs(pos.x) > VIEW_HALF || Math.abs(pos.y) > VIEW_HALF) {
      if (!isPlayer) drawEdgeMarker(ctx, v, pos, heading, color);
      continue;
    }

    drawVehicle(ctx, v, pos, heading, color, {
      braking: isPlayer ? Boolean(opts.playerBraking) : brakingNow(runner, veh),
      blink: veh.indicator && blinkOn ? veh.indicator : null,
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
export function playerControl(world: World): {
  kind: string;
  light: string | null;
  /** Sekundi do promjene svjetla; `null` kad nema semafora. */
  countdown: number | null;
} {
  const tpl = TEMPLATES[world.templateId];
  const player = world.vehicles.find((x) => x.kind === "player");
  const a = tpl?.arms.find((x) => x.id === (player?.arm as ArmId));
  if (!tpl || !a) return { kind: "none", light: null, countdown: null };
  if (a.control.kind === "light") {
    return {
      kind: "light",
      light: lightFor(tpl, world.phaseIndex, a.control.phaseGroup),
      countdown: lightCountdown(tpl, world.phaseIndex, world.phaseT, a.control.phaseGroup),
    };
  }
  return { kind: a.control.kind, light: null, countdown: null };
}
