"use client";

import type { Approach, DrawnVehicle } from "@/lib/simScenarios";
import VehicleSprite from "./VehicleSprite";

/**
 * Raskrsnica iz ptičje perspektive — sve je crtano kodom, nula asseta.
 *
 * Koordinatni sistem: 400×400, centar raskrsnice na (200, 200).
 * Kolovoz je širok 120 (dvije trake po 60), pa vertikalni put zauzima
 * x 140–260, a horizontalni y 140–260.
 *
 * Desna vožnja: vozilo sa sjevera ide na jug i drži se zapadne trake (x=170),
 * sa juga ide na sjever istočnom trakom (x=230), sa zapada na istok južnom
 * trakom (y=230), sa istoka na zapad sjevernom trakom (y=170).
 */

const SIZE = 400;
const C = SIZE / 2;
const ROAD = 120;
const EDGE = C - ROAD / 2; // 140

/** Početna pozicija i ugao (0° = vozilo gleda na sjever). */
const START: Record<Approach, { x: number; y: number; rot: number }> = {
  N: { x: 170, y: 92, rot: 180 },
  S: { x: 230, y: 308, rot: 0 },
  W: { x: 92, y: 230, rot: 90 },
  E: { x: 308, y: 170, rot: 270 },
};

/** Pomjeraj kad vozilo prođe raskrsnicu (zadržava pravac). */
const EXIT: Record<Approach, { dx: number; dy: number }> = {
  N: { dx: 0, dy: 300 },
  S: { dx: 0, dy: -300 },
  W: { dx: 300, dy: 0 },
  E: { dx: -300, dy: 0 },
};

const PALETTE = ["#2f6fd0", "#c8232c", "#2f7d33", "#726b5c", "#4080f0"];

interface IntersectionSvgProps {
  vehicles: readonly DrawnVehicle[];
  /** Redoslijed koji je kandidat izabrao (id-jevi). */
  picked: readonly number[];
  /** Vozila koja su već „prošla" u animaciji. */
  passed: ReadonlySet<number>;
  /** Blokira klik nakon provjere. */
  disabled: boolean;
  onPick: (id: number) => void;
  /** Prikaži crveni blik na tački ukrštanja (netačan odgovor). */
  conflict: boolean;
  vehicleLabel: string;
}

/** Zebra na prilazu — stripes su okomite na smjer kretanja. */
function Crosswalk({ approach }: { approach: Approach }) {
  const bars = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
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

export default function IntersectionSvg({
  vehicles,
  picked,
  passed,
  disabled,
  onPick,
  conflict,
  vehicleLabel,
}: IntersectionSvgProps) {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="h-auto w-full max-w-[420px]"
      role="img"
      aria-label={vehicleLabel}
    >
      {/* okolina */}
      <rect width={SIZE} height={SIZE} fill="#dfe3d8" />

      {/* trotoar oko kolovoza */}
      <rect x={EDGE - 8} y={0} width={ROAD + 16} height={SIZE} fill="#cfd3c8" />
      <rect x={0} y={EDGE - 8} width={SIZE} height={ROAD + 16} fill="#cfd3c8" />

      {/* kolovoz */}
      <rect x={EDGE} y={0} width={ROAD} height={SIZE} fill="#7d7d78" />
      <rect x={0} y={EDGE} width={SIZE} height={ROAD} fill="#7d7d78" />

      {/* isprekidana razdjelna linija — prekida se na raskrsnici */}
      <g stroke="#fff" strokeWidth={3} strokeDasharray="14 12" opacity={0.9}>
        <line x1={C} y1={0} x2={C} y2={EDGE} />
        <line x1={C} y1={SIZE - EDGE} x2={C} y2={SIZE} />
        <line x1={0} y1={C} x2={EDGE} y2={C} />
        <line x1={SIZE - EDGE} y1={C} x2={SIZE} y2={C} />
      </g>

      {(["N", "E", "S", "W"] as Approach[]).map((a) => (
        <Crosswalk key={a} approach={a} />
      ))}

      {/* tačka ukrštanja — blicne crveno kad je redoslijed pogrešan */}
      {conflict && (
        <circle cx={C} cy={C} r={40} fill="#c8232c" opacity={0.35}>
          <animate attributeName="opacity" values="0.5;0.1;0.5" dur="0.9s" repeatCount="3" />
        </circle>
      )}

      {vehicles.map((v, i) => {
        const start = START[v.approach];
        const exit = EXIT[v.approach];
        const gone = passed.has(v.id);
        const x = start.x + (gone ? exit.dx : 0);
        const y = start.y + (gone ? exit.dy : 0);
        const pos = picked.indexOf(v.id);
        const color = PALETTE[i % PALETTE.length] as string;

        return (
          <g
            key={v.id}
            transform={`translate(${x} ${y})`}
            style={{ transition: "transform 700ms ease-in-out" }}
          >
            <g transform={`rotate(${start.rot})`}>
              <VehicleSprite kind={v.kind} color={color} />
            </g>

            {/* Oznaka i tap-zona. Krug je izvan rotacije da broj uvijek stoji uspravno. */}
            <g
              onClick={() => !disabled && onPick(v.id)}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={`${vehicleLabel} ${v.id}${pos !== -1 ? ` — ${pos + 1}.` : ""}`}
              aria-pressed={pos !== -1}
              onKeyDown={(e) => {
                if (disabled) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPick(v.id);
                }
              }}
              style={{ cursor: disabled ? "default" : "pointer" }}
            >
              {/* nevidljiva, veća meta za prst */}
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
              {/* kad je izabrano, sitno pokaži i broj vozila */}
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
