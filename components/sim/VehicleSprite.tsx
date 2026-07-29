import type { VehicleKind } from "@/lib/simScenarios";

interface VehicleSpriteProps {
  kind: VehicleKind;
  /** Boja karoserije. */
  color: string;
}

/**
 * Vozilo iz ptičje perspektive, crtano kodom — bez slika i bez licenci.
 * Nacrtano je okrenuto ka „sjeveru" (nagore); rotaciju radi pozivalac.
 */
export default function VehicleSprite({ kind, color }: VehicleSpriteProps) {
  const len = kind === "van" ? 46 : 38;
  const wid = kind === "van" ? 22 : 20;
  const half = len / 2;

  return (
    <g>
      {/* karoserija */}
      <rect
        x={-wid / 2}
        y={-half}
        width={wid}
        height={len}
        rx={5}
        fill={color}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth={1}
      />
      {/* vjetrobran (naprijed) */}
      <rect
        x={-wid / 2 + 3}
        y={-half + 6}
        width={wid - 6}
        height={kind === "van" ? 7 : 8}
        rx={2}
        fill="rgba(255,255,255,0.75)"
      />
      {/* zadnje staklo */}
      <rect
        x={-wid / 2 + 3}
        y={half - (kind === "van" ? 12 : 13)}
        width={wid - 6}
        height={6}
        rx={2}
        fill="rgba(255,255,255,0.45)"
      />
      {/* krov / sredina */}
      <rect
        x={-wid / 2 + 2}
        y={-half + 15}
        width={wid - 4}
        height={kind === "van" ? 18 : 10}
        rx={2}
        fill="rgba(0,0,0,0.08)"
      />
      {/* farovi */}
      <rect x={-wid / 2 + 2} y={-half + 1} width={4} height={3} rx={1} fill="#fff8d0" />
      <rect x={wid / 2 - 6} y={-half + 1} width={4} height={3} rx={1} fill="#fff8d0" />
      {/* stop svjetla */}
      <rect x={-wid / 2 + 2} y={half - 4} width={4} height={3} rx={1} fill="#c8232c" />
      <rect x={wid / 2 - 6} y={half - 4} width={4} height={3} rx={1} fill="#c8232c" />
    </g>
  );
}
