"use client";

import {
  exitOf,
  OPPOSITE,
  type Approach,
  type DrawnScenario,
  type DrawnVehicle,
  type Intent,
  type LightKind,
  type SignKind,
} from "@/lib/simRules";
import VehicleSprite from "./VehicleSprite";

/**
 * Raskrsnica iz ptičje perspektive — sve je crtano kodom, nula asseta.
 *
 * Koordinatni sistem: 400×400, centar na (200, 200). Kolovoz je širok 120
 * (dvije trake po 60), pa vertikalni put zauzima x 140–260, a horizontalni
 * y 140–260.
 *
 * Desna vožnja je ugrađena u pozicije: sa sjevera se ide na jug zapadnom trakom
 * (x=170), sa juga na sjever istočnom (x=230), sa zapada na istok južnom (y=230),
 * sa istoka na zapad sjevernom (y=170).
 *
 * Kružni tok: vozila u toku kruže **suprotno od kazaljke** (desna vožnja) —
 * na vrhu se kreću ka zapadu, na desnoj strani ka sjeveru i tako dalje.
 */

const SIZE = 400;
const C = SIZE / 2;
const ROAD = 120;
const EDGE = C - ROAD / 2; // 140
const RING = 80; // poluprečnik osi kružnog toka
const ISLAND = 46;

interface Placement {
  x: number;
  y: number;
  rot: number;
}

const CROSS_START: Record<Approach, Placement> = {
  N: { x: 170, y: 92, rot: 180 },
  S: { x: 230, y: 308, rot: 0 },
  W: { x: 92, y: 230, rot: 90 },
  E: { x: 308, y: 170, rot: 270 },
};

const RB_ENTRY: Record<Approach, Placement> = {
  N: { x: 170, y: 62, rot: 180 },
  S: { x: 230, y: 338, rot: 0 },
  W: { x: 62, y: 230, rot: 90 },
  E: { x: 338, y: 170, rot: 270 },
};

/** Pozicija na prstenu kružnog toka + tangentni ugao (suprotno od kazaljke). */
const RB_RING: Record<Approach, Placement> = {
  N: { x: C, y: C - RING, rot: 270 },
  E: { x: C + RING, y: C, rot: 0 },
  S: { x: C, y: C + RING, rot: 90 },
  W: { x: C - RING, y: C, rot: 180 },
};

/** Pomjeraj kad vozilo prođe raskrsnicu (koristi se samo za animaciju). */
const EXIT: Record<Approach, { dx: number; dy: number }> = {
  N: { dx: 0, dy: 300 },
  S: { dx: 0, dy: -300 },
  W: { dx: 300, dy: 0 },
  E: { dx: -300, dy: 0 },
};

/**
 * Znak/semafor stoji sa desne strane vozača tog prilaza, u ćošku — dovoljno
 * odmaknuto da se ne dodiruje sa oznakom vozila (koja je na `start.y - 32`).
 */
const SIGN_AT: Record<Approach, { x: number; y: number }> = {
  N: { x: 110, y: 108 },
  E: { x: 336, y: 104 },
  S: { x: 292, y: 292 },
  W: { x: 108, y: 292 },
};

const PALETTE = ["#2f6fd0", "#c8232c", "#2f7d33", "#726b5c", "#4080f0"];

/** Jedinični vektor kretanja sa datog prilaza. */
const FORWARD: Record<Approach, { dx: number; dy: number }> = {
  N: { dx: 0, dy: 1 },
  S: { dx: 0, dy: -1 },
  W: { dx: 1, dy: 0 },
  E: { dx: -1, dy: 0 },
};

/**
 * Osa trake kojom se vozilo kreće kad ide KA datom kraku (desna vožnja).
 * Npr. ka jugu se ide zapadnom trakom (x=170), ka istoku južnom (y=230).
 */
const TOWARD_LANE: Record<Approach, { axis: "x" | "y"; at: number }> = {
  S: { axis: "x", at: 170 },
  N: { axis: "x", at: 230 },
  E: { axis: "y", at: 230 },
  W: { axis: "y", at: 170 },
};

/**
 * Putanja vozila kroz raskrsnicu, kao izlomljena linija sa strelicom.
 *
 * Bez ovoga scena nije rješiva: kandidat ne može znati da vozilo skreće, a od
 * namjere zavisi ko kome ustupa (ljevak propušta susretno vozilo).
 */
function pathOf(
  approach: Approach,
  intent: Intent,
): { points: string; tip: { x: number; y: number; rot: number } } {
  const start = CROSS_START[approach];
  const f = FORWARD[approach];
  const from = { x: start.x + f.dx * 26, y: start.y + f.dy * 26 };

  const exit = exitOf(approach, intent);
  const outLane = TOWARD_LANE[exit];
  const outF = FORWARD[OPPOSITE[exit]]; // smjer kretanja KA kraku `exit`

  if (intent === "straight") {
    const to = { x: from.x + f.dx * 205, y: from.y + f.dy * 205 };
    return {
      points: `${from.x},${from.y} ${to.x},${to.y}`,
      tip: { x: to.x, y: to.y, rot: start.rot },
    };
  }

  // Skretanje: ide se svojom trakom do ose izlazne trake, pa se okreće.
  const corner =
    outLane.axis === "y"
      ? { x: start.x, y: outLane.at }
      : { x: outLane.at, y: start.y };
  const to = { x: corner.x + outF.dx * 120, y: corner.y + outF.dy * 120 };
  const tipRot =
    outF.dy > 0 ? 180 : outF.dy < 0 ? 0 : outF.dx > 0 ? 90 : 270;

  return {
    points: `${from.x},${from.y} ${corner.x},${corner.y} ${to.x},${to.y}`,
    tip: { x: to.x, y: to.y, rot: tipRot },
  };
}

/** Žuta putanja sa strelicom — isti jezik kao strelice na fotografijama u katalogu. */
function VehiclePath({ approach, intent }: { approach: Approach; intent: Intent }) {
  const { points, tip } = pathOf(approach, intent);
  return (
    <g opacity={0.85}>
      <polyline
        points={points}
        fill="none"
        stroke="#f4c300"
        strokeWidth={7}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points={points}
        fill="none"
        stroke="#191b20"
        strokeWidth={1}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.35}
      />
      <g transform={`translate(${tip.x} ${tip.y}) rotate(${tip.rot})`}>
        <polygon points="0,-11 -9,7 9,7" fill="#f4c300" stroke="#191b20" strokeWidth={1} />
      </g>
    </g>
  );
}

function Sign({ kind, x, y }: { kind: SignKind; x: number; y: number }) {
  if (kind === "priority") {
    return (
      <g transform={`translate(${x} ${y})`}>
        <rect
          x={-11}
          y={-11}
          width={22}
          height={22}
          transform="rotate(45)"
          fill="#f4c300"
          stroke="#191b20"
          strokeWidth={2.5}
        />
      </g>
    );
  }
  if (kind === "yield") {
    return (
      <g transform={`translate(${x} ${y})`}>
        <polygon
          points="0,15 -16,-12 16,-12"
          fill="#fff"
          stroke="#c8232c"
          strokeWidth={4}
        />
      </g>
    );
  }
  // STOP — osmougao
  const r = 15;
  const pts = Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI / 4) * i + Math.PI / 8;
    return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  return (
    <g transform={`translate(${x} ${y})`}>
      <polygon points={pts} fill="#c8232c" stroke="#fff" strokeWidth={2} />
      <text y={4} textAnchor="middle" fontSize={8} fontWeight={700} fill="#fff">
        STOP
      </text>
    </g>
  );
}

function TrafficLight({ kind, x, y }: { kind: LightKind; x: number; y: number }) {
  const lamp = (want: LightKind, cy: number, on: string) => (
    <circle cx={0} cy={cy} r={5} fill={kind === want ? on : "#2a2a2a"} />
  );
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-9} y={-19} width={18} height={38} rx={4} fill="#191b20" />
      {lamp("red", -11, "#e33")}
      {lamp("yellow", 0, "#f4c300")}
      {lamp("green", 11, "#3c3")}
    </g>
  );
}

/** Pješak na prelazu datog prilaza. */
function PedestrianFigure({ approach }: { approach: Approach }) {
  const spot: Record<Approach, { x: number; y: number }> = {
    N: { x: 205, y: 126 },
    S: { x: 195, y: 274 },
    W: { x: 126, y: 195 },
    E: { x: 274, y: 205 },
  };
  const p = spot[approach];
  return (
    <g transform={`translate(${p.x} ${p.y})`}>
      <circle cy={-7} r={4} fill="#191b20" />
      <rect x={-3} y={-3} width={6} height={11} rx={2} fill="#191b20" />
      <rect x={-5} y={8} width={3} height={7} rx={1} fill="#191b20" />
      <rect x={2} y={8} width={3} height={7} rx={1} fill="#191b20" />
    </g>
  );
}

function Crosswalk({ approach }: { approach: Approach }) {
  const bars = [];
  for (let i = 0; i < 7; i++) {
    const off = EDGE + 4 + i * 16;
    bars.push(
      approach === "N" || approach === "S" ? (
        <rect key={i} x={off} y={approach === "N" ? 118 : 268} width={10} height={14} fill="#fff" />
      ) : (
        <rect key={i} x={approach === "W" ? 118 : 268} y={off} width={14} height={10} fill="#fff" />
      ),
    );
  }
  return <g opacity={0.9}>{bars}</g>;
}

interface IntersectionSvgProps {
  scenario: DrawnScenario;
  /** Redoslijed koji je kandidat izabrao (id-jevi). */
  picked: readonly number[];
  /** Vozila koja su već „prošla" u animaciji. */
  passed: ReadonlySet<number>;
  disabled: boolean;
  onPick: (id: number) => void;
  /** Crveni blik na tački ukrštanja (netačan odgovor). */
  conflict: boolean;
  vehicleLabel: string;
  /** Vozilo kandidata u scenarijima odluke — dobija poseban prsten. */
  myVehicleId?: number;
}

export default function IntersectionSvg({
  scenario,
  picked,
  passed,
  disabled,
  onPick,
  conflict,
  vehicleLabel,
  myVehicleId,
}: IntersectionSvgProps) {
  const roundabout = scenario.layout === "roundabout";
  const tappable = scenario.answer !== undefined;

  const place = (v: DrawnVehicle): Placement => {
    if (!roundabout) return CROSS_START[v.approach];
    return v.inRoundabout ? RB_RING[v.approach] : RB_ENTRY[v.approach];
  };

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="h-auto w-full max-w-[420px]"
      role="img"
      aria-label={vehicleLabel}
    >
      <rect width={SIZE} height={SIZE} fill="#dfe3d8" />

      {/* trotoar i kolovoz */}
      <rect x={EDGE - 8} y={0} width={ROAD + 16} height={SIZE} fill="#cfd3c8" />
      <rect x={0} y={EDGE - 8} width={SIZE} height={ROAD + 16} fill="#cfd3c8" />
      <rect x={EDGE} y={0} width={ROAD} height={SIZE} fill="#7d7d78" />
      <rect x={0} y={EDGE} width={SIZE} height={ROAD} fill="#7d7d78" />

      {roundabout ? (
        <>
          {/* kružni tok: prsten + centralno ostrvo */}
          <circle cx={C} cy={C} r={RING + 30} fill="#7d7d78" />
          <circle cx={C} cy={C} r={ISLAND} fill="#cfd3c8" stroke="#fff" strokeWidth={3} />
          <circle cx={C} cy={C} r={ISLAND - 10} fill="#dfe3d8" />
          <circle
            cx={C}
            cy={C}
            r={RING + 30}
            fill="none"
            stroke="#fff"
            strokeWidth={2}
            strokeDasharray="10 10"
            opacity={0.7}
          />
        </>
      ) : (
        <g stroke="#fff" strokeWidth={3} strokeDasharray="14 12" opacity={0.9}>
          <line x1={C} y1={0} x2={C} y2={EDGE} />
          <line x1={C} y1={SIZE - EDGE} x2={C} y2={SIZE} />
          <line x1={0} y1={C} x2={EDGE} y2={C} />
          <line x1={SIZE - EDGE} y1={C} x2={SIZE} y2={C} />
        </g>
      )}

      {(["N", "E", "S", "W"] as Approach[]).map((a) => (
        <Crosswalk key={a} approach={a} />
      ))}

      {/* znakovi i semafori po prilazima */}
      {(["N", "E", "S", "W"] as Approach[]).map((a) => {
        const setup = scenario.approaches?.[a];
        if (!setup) return null;
        const at = SIGN_AT[a];
        return (
          <g key={`sig-${a}`}>
            {setup.sign && <Sign kind={setup.sign} x={at.x} y={at.y} />}
            {setup.light && <TrafficLight kind={setup.light} x={at.x} y={at.y} />}
          </g>
        );
      })}

      {/* Putanje vozila — pokazuju namjeru kretanja (pravo / lijevo / desno). */}
      {!roundabout &&
        scenario.vehicles.map((v) => (
          <VehiclePath key={`path-${v.id}`} approach={v.approach} intent={v.intent} />
        ))}

      {scenario.pedestrians?.map((p) => (
        <PedestrianFigure key={`ped-${p.crossing}`} approach={p.crossing} />
      ))}

      {conflict && (
        <circle cx={C} cy={C} r={40} fill="#c8232c" opacity={0.35}>
          <animate attributeName="opacity" values="0.5;0.1;0.5" dur="0.9s" repeatCount="3" />
        </circle>
      )}

      {scenario.vehicles.map((v, i) => {
        const start = place(v);
        const exit = EXIT[v.approach];
        const gone = passed.has(v.id);
        const x = start.x + (gone ? exit.dx : 0);
        const y = start.y + (gone ? exit.dy : 0);
        const pos = picked.indexOf(v.id);
        const color = PALETTE[i % PALETTE.length] as string;
        const isMine = myVehicleId === v.id;

        return (
          <g
            key={v.id}
            transform={`translate(${x} ${y})`}
            style={{ transition: "transform 700ms ease-in-out" }}
          >
            {/* prsten oko „mog" vozila u scenarijima odluke */}
            {isMine && (
              <circle r={26} fill="none" stroke="#f4c300" strokeWidth={4} opacity={0.95} />
            )}

            <g transform={`rotate(${start.rot})`}>
              <VehicleSprite kind={v.kind} color={color} />
            </g>

            {/* Oznaka je izvan rotacije da broj uvijek stoji uspravno. */}
            <g
              onClick={() => tappable && !disabled && onPick(v.id)}
              role={tappable ? "button" : undefined}
              tabIndex={tappable && !disabled ? 0 : -1}
              aria-label={`${vehicleLabel} ${v.id}${pos !== -1 ? ` — ${pos + 1}.` : ""}`}
              aria-pressed={tappable ? pos !== -1 : undefined}
              onKeyDown={(e) => {
                if (!tappable || disabled) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPick(v.id);
                }
              }}
              style={{ cursor: tappable && !disabled ? "pointer" : "default" }}
            >
              <circle r={26} fill="transparent" />
              <circle
                cy={-32}
                r={13}
                fill={pos !== -1 ? "#f4c300" : "#fff"}
                stroke="#191b20"
                strokeWidth={2}
              />
              <text
                y={-27}
                textAnchor="middle"
                fontSize={15}
                fontWeight={700}
                fill="#191b20"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {pos !== -1 ? pos + 1 : v.id}
              </text>
              {pos !== -1 && (
                <text
                  y={-48}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#191b20"
                  opacity={0.7}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  #{v.id}
                </text>
              )}
            </g>
          </g>
        );
      })}
    </svg>
  );
}
