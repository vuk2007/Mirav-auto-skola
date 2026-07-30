"use client";

import type { Approach, DrawnScenario, DrawnVehicle } from "@/lib/simRules";
import VehicleSprite from "./VehicleSprite";

/**
 * Kružni tok iz ptičje perspektive — crtan kodom.
 *
 * Ovo NIJE krstasta raskrsnica sa krugom preko nje: kroz centar ne prolazi
 * nijedan put. Četiri prilaza se zaustavljaju na prstenu, između ulazne i
 * izlazne trake stoji razdjelno ostrvo, a u sredini je centralno ostrvo.
 *
 * Smjer: Crna Gora vozi desnom stranom, pa se kruži **suprotno od kazaljke na
 * satu** — centralno ostrvo je vozaču s lijeve strane. Redoslijed krakova u tom
 * smjeru je N → W → S → E → N.
 *
 * Ugao kraka mjeren od centra (SVG koordinate, y raste nadolje):
 * N = −90°, E = 0°, S = 90°, W = 180°. Kretanje suprotno kazaljci znači
 * **opadajući** ugao.
 */

const SIZE = 400;
const C = SIZE / 2;
const R_ISLAND = 44;
const R_OUTER = 106;
const R_RING = 75; // osa kružnog kolovoza
const APPROACH_W = 84; // širina prilaza (ulazna + izlazna traka)
const LANE = 21; // pomjeraj ose trake od ose prilaza

/** Ugao kraka u stepenima. */
const LEG_ANGLE: Record<Approach, number> = { N: -90, E: 0, S: 90, W: 180 };

const rad = (deg: number) => (deg * Math.PI) / 180;
const onRing = (deg: number, r = R_RING) => ({
  x: C + r * Math.cos(rad(deg)),
  y: C + r * Math.sin(rad(deg)),
});

/** Jedinični vektor od centra ka kraku. */
const OUTWARD: Record<Approach, { dx: number; dy: number }> = {
  N: { dx: 0, dy: -1 },
  S: { dx: 0, dy: 1 },
  E: { dx: 1, dy: 0 },
  W: { dx: -1, dy: 0 },
};

/**
 * Osa trake, kao pomjeraj u odnosu na osu prilaza.
 *
 * Desna vožnja: gledano iz vozila koje ulazi sa kraka, ulazna traka je desna.
 * Za sjeverni prilaz (vozilo ide na jug) desno je zapad → pomjeraj −LANE po x.
 */
const ENTRY_OFFSET: Record<Approach, { dx: number; dy: number }> = {
  N: { dx: -LANE, dy: 0 },
  S: { dx: LANE, dy: 0 },
  W: { dx: 0, dy: LANE },
  E: { dx: 0, dy: -LANE },
};

/** Izlazna traka je na suprotnoj strani ose prilaza od ulazne. */
function exitOffset(leg: Approach) {
  const e = ENTRY_OFFSET[leg];
  return { dx: -e.dx, dy: -e.dy };
}

/**
 * Tačka u kojoj se osa trake spaja sa osom prstena.
 * Traka je paralelna osi prilaza i pomjerena za LANE, pa se presjek sa
 * kružnicom poluprečnika R_RING nalazi Pitagorom.
 */
function joinPoint(leg: Approach, kind: "entry" | "exit") {
  const off = kind === "entry" ? ENTRY_OFFSET[leg] : exitOffset(leg);
  const out = OUTWARD[leg];
  const along = Math.sqrt(Math.max(R_RING * R_RING - LANE * LANE, 1));
  return {
    x: C + off.dx + out.dx * along,
    y: C + off.dy + out.dy * along,
  };
}

/** Pozicija vozila koje čeka na ulazu (izvan prstena). */
function entryStart(leg: Approach) {
  const off = ENTRY_OFFSET[leg];
  const out = OUTWARD[leg];
  return { x: C + off.dx + out.dx * 150, y: C + off.dy + out.dy * 150 };
}

/** Ugao (za rotaciju sprajta) iz vektora kretanja. */
function rotOf(dx: number, dy: number): number {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 90 : 270;
  return dy > 0 ? 180 : 0;
}

/** Tangenta na prsten u datom uglu, u smjeru suprotnom kazaljci (opadajući ugao). */
function ringRot(deg: number): number {
  const dx = Math.sin(rad(deg));
  const dy = -Math.cos(rad(deg));
  return rotOf(dx, dy);
}

/**
 * Putanja vozila: ulazni segment → **luk po osi prstena** → izlazni segment.
 * Luk je pravi SVG `A` oko centra, ne izlomljena linija kroz centar.
 */
function vehiclePath(v: DrawnVehicle): string {
  const from = v.approach;
  const to = v.exit ?? OPPOSITE_LEG[from];

  // Vozilo koje je već u prstenu kreće tačno sa svoje pozicije na osi prstena;
  // vozilo koje ulazi se prvo priključi na osu iz ulazne trake.
  const arcFrom = v.inRoundabout ? onRing(LEG_ANGLE[from]) : joinPoint(from, "entry");
  const arcTo = joinPoint(to, "exit");

  const aFrom = Math.atan2(arcFrom.y - C, arcFrom.x - C) * (180 / Math.PI);
  const aTo = Math.atan2(arcTo.y - C, arcTo.x - C) * (180 / Math.PI);
  // Suprotno kazaljci = opadajući ugao.
  const sweepDeg = (aFrom - aTo + 360) % 360;
  const largeArc = sweepDeg > 180 ? 1 : 0;

  const outEnd = (leg: Approach) => {
    const off = exitOffset(leg);
    const out = OUTWARD[leg];
    return { x: C + off.dx + out.dx * 190, y: C + off.dy + out.dy * 190 };
  };

  const start = v.inRoundabout ? arcFrom : entryStart(from);
  const end = outEnd(to);

  return [
    `M ${start.x.toFixed(1)} ${start.y.toFixed(1)}`,
    `L ${arcFrom.x.toFixed(1)} ${arcFrom.y.toFixed(1)}`,
    // sweep-flag 0 = suprotno kazaljci u SVG koordinatama
    `A ${R_RING} ${R_RING} 0 ${largeArc} 0 ${arcTo.x.toFixed(1)} ${arcTo.y.toFixed(1)}`,
    `L ${end.x.toFixed(1)} ${end.y.toFixed(1)}`,
  ].join(" ");
}

const OPPOSITE_LEG: Record<Approach, Approach> = { N: "S", S: "N", E: "W", W: "E" };

/** Razdjelno ostrvo između ulazne i izlazne trake, sa vrhom ka prstenu. */
function SplitterIsland({ leg }: { leg: Approach }) {
  const out = OUTWARD[leg];
  // Lokalne ose: `out` je „naprijed" (od centra ka kraku), `side` je poprečno.
  const side = { dx: -out.dy, dy: out.dx };
  const p = (fwd: number, lat: number) => ({
    x: C + out.dx * fwd + side.dx * lat,
    y: C + out.dy * fwd + side.dy * lat,
  });
  const tip = p(R_OUTER + 6, 0);
  const a = p(R_OUTER + 26, 7);
  const b = p(198, 7);
  const c = p(198, -7);
  const d = p(R_OUTER + 26, -7);
  return (
    <polygon
      points={[tip, a, b, c, d].map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ")}
      fill="#cfd3c8"
      stroke="#fff"
      strokeWidth={2}
    />
  );
}

/** Isprekidana linija „ustupi prvenstvo" preko ulazne trake + obrnuti trougao. */
function YieldAtEntry({ leg }: { leg: Approach }) {
  const out = OUTWARD[leg];
  const side = { dx: -out.dy, dy: out.dx };
  const off = ENTRY_OFFSET[leg];
  const base = { x: C + off.dx, y: C + off.dy };
  const at = R_OUTER + 7;
  const from = {
    x: base.x + out.dx * at + side.dx * 16,
    y: base.y + out.dy * at + side.dy * 16,
  };
  const to = {
    x: base.x + out.dx * at - side.dx * 16,
    y: base.y + out.dy * at - side.dy * 16,
  };
  // Znak stoji uz ivicu, izvan kolovoza.
  const sign = {
    x: base.x + out.dx * (at + 22) + side.dx * 34,
    y: base.y + out.dy * (at + 22) + side.dy * 34,
  };
  return (
    <g>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="#fff"
        strokeWidth={4}
        strokeDasharray="7 6"
      />
      <g transform={`translate(${sign.x.toFixed(1)} ${sign.y.toFixed(1)})`}>
        <polygon points="0,11 -12,-9 12,-9" fill="#fff" stroke="#c8232c" strokeWidth={3.5} />
      </g>
    </g>
  );
}

const PALETTE = ["#2f6fd0", "#c8232c", "#2f7d33", "#726b5c", "#4080f0"];

interface RoundaboutSvgProps {
  scenario: DrawnScenario;
  picked: readonly number[];
  passed: ReadonlySet<number>;
  disabled: boolean;
  onPick: (id: number) => void;
  conflict: boolean;
  vehicleLabel: string;
  myVehicleId?: number;
}

export default function RoundaboutSvg({
  scenario,
  picked,
  passed,
  disabled,
  onPick,
  conflict,
  vehicleLabel,
  myVehicleId,
}: RoundaboutSvgProps) {
  const tappable = scenario.answer !== undefined;
  const legs: Approach[] = ["N", "E", "S", "W"];

  /** Gdje vozilo stoji i kako je okrenuto. */
  const place = (v: DrawnVehicle) => {
    if (v.inRoundabout) {
      const deg = LEG_ANGLE[v.approach];
      const p = onRing(deg);
      return { ...p, rot: ringRot(deg) };
    }
    const s = entryStart(v.approach);
    const out = OUTWARD[v.approach];
    return { ...s, rot: rotOf(-out.dx, -out.dy) }; // gleda ka prstenu
  };

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="h-auto w-full max-w-[420px]"
      role="img"
      aria-label={vehicleLabel}
    >
      {/* 1. trava */}
      <rect width={SIZE} height={SIZE} fill="#dfe3d8" />

      {/* 2. prilazi — staju na prstenu, ne idu kroz centar */}
      {legs.map((leg) => {
        const out = OUTWARD[leg];
        const horizontal = out.dx !== 0;
        const w = horizontal ? SIZE : APPROACH_W;
        const h = horizontal ? APPROACH_W : SIZE;
        const x = horizontal ? (out.dx > 0 ? C : C - SIZE) : C - APPROACH_W / 2;
        const y = horizontal ? C - APPROACH_W / 2 : out.dy > 0 ? C : C - SIZE;
        return (
          <g key={`road-${leg}`}>
            <rect
              x={x - (horizontal ? 0 : 8)}
              y={y - (horizontal ? 8 : 0)}
              width={w + (horizontal ? 0 : 16)}
              height={h + (horizontal ? 16 : 0)}
              fill="#cfd3c8"
            />
            <rect x={x} y={y} width={w} height={h} fill="#7d7d78" />
          </g>
        );
      })}

      {/* 3. prsten, pa centralno ostrvo preko njega */}
      <circle cx={C} cy={C} r={R_OUTER} fill="#7d7d78" />
      <circle cx={C} cy={C} r={R_ISLAND} fill="#cfd3c8" stroke="#fff" strokeWidth={3} />
      <circle cx={C} cy={C} r={R_ISLAND - 9} fill="#dfe3d8" />

      {/* 4. osa prstena, isprekidano */}
      <circle
        cx={C}
        cy={C}
        r={R_RING}
        fill="none"
        stroke="#fff"
        strokeWidth={2}
        strokeDasharray="12 10"
        opacity={0.6}
      />

      {/* 5. razdjelna ostrva i oznake ustupanja na ulazima */}
      {legs.map((leg) => (
        <SplitterIsland key={`isl-${leg}`} leg={leg} />
      ))}
      {legs.map((leg) => (
        <YieldAtEntry key={`yld-${leg}`} leg={leg} />
      ))}

      {conflict && (
        <circle cx={C} cy={C} r={R_OUTER} fill="#c8232c" opacity={0.22}>
          <animate attributeName="opacity" values="0.32;0.08;0.32" dur="0.9s" repeatCount="3" />
        </circle>
      )}

      {/* putanje vozila — luk kroz prsten, ne prava linija */}
      {scenario.vehicles.map((v) => (
        <g key={`path-${v.id}`} opacity={0.85}>
          <path
            d={vehiclePath(v)}
            fill="none"
            stroke="#f4c300"
            strokeWidth={6}
            strokeLinecap="round"
          />
          <path
            d={vehiclePath(v)}
            fill="none"
            stroke="#191b20"
            strokeWidth={1}
            strokeLinecap="round"
            opacity={0.3}
          />
        </g>
      ))}

      {scenario.vehicles.map((v, i) => {
        const pos0 = place(v);
        const gone = passed.has(v.id);
        // Kad „prođe", vozilo se pomjeri na izlaz.
        const to = v.exit ?? OPPOSITE_LEG[v.approach];
        const endOff = exitOffset(to);
        const endOut = OUTWARD[to];
        const end = {
          x: C + endOff.dx + endOut.dx * 170,
          y: C + endOff.dy + endOut.dy * 170,
          rot: rotOf(endOut.dx, endOut.dy),
        };
        const p = gone ? end : pos0;
        const pick = picked.indexOf(v.id);
        const color = PALETTE[i % PALETTE.length] as string;

        return (
          <g
            key={v.id}
            transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}
            style={{ transition: "transform 900ms ease-in-out" }}
          >
            {myVehicleId === v.id && (
              <circle r={26} fill="none" stroke="#f4c300" strokeWidth={4} opacity={0.95} />
            )}

            <g transform={`rotate(${p.rot})`}>
              <VehicleSprite kind={v.kind} color={color} />
            </g>

            <g
              onClick={() => tappable && !disabled && onPick(v.id)}
              role={tappable ? "button" : undefined}
              tabIndex={tappable && !disabled ? 0 : -1}
              aria-label={`${vehicleLabel} ${v.id}${pick !== -1 ? ` — ${pick + 1}.` : ""}`}
              aria-pressed={tappable ? pick !== -1 : undefined}
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
                fill={pick !== -1 ? "#f4c300" : "#fff"}
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
                {pick !== -1 ? pick + 1 : v.id}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
