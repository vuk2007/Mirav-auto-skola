"use client";

import type { Pedals } from "./usePedals";

interface PedalControlsProps {
  pedals: Pedals;
  disabled: boolean;
  throttleLabel: string;
  brakeLabel: string;
  indicatorLabel: string;
  leftLabel: string;
  rightLabel: string;
  /** Dugmad za promjenu trake — samo na autoputu. */
  lanes?: { leftLabel: string; rightLabel: string } | null;
}

/**
 * Gas i kočnica kao dva velika dugmeta.
 *
 * Koristi se `pointerdown`, a ne `click`: pedala mora da radi dok je prst dolje,
 * a `click` se javi tek na otpuštanju. Otpuštanje hvata `usePedals` na prozoru —
 * tamo piše i zašto to nije na samom dugmetu.
 */
export default function PedalControls({
  pedals,
  disabled,
  throttleLabel,
  brakeLabel,
  indicatorLabel,
  leftLabel,
  rightLabel,
  lanes = null,
}: PedalControlsProps) {
  const button = (pedal: "throttle" | "brake", label: string, tone: string) => (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={pedals.active[pedal]}
      onPointerDown={(e) => {
        e.preventDefault();
        pedals.pressPointer(pedal, e.pointerId);
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={`font-display flex-1 touch-none rounded border-2 py-5 text-2xl font-bold tracking-wide uppercase transition-colors select-none disabled:opacity-40 ${
        pedals.active[pedal] ? tone : "border-line bg-panel text-ink"
      }`}
    >
      {label}
    </button>
  );

  // Pokazivač je PREKIDAČ, ne pedala: pritisak ga pali i ostavlja upaljenim.
  // Zato ide na `onClick`, a ne na `pointerdown` kao gas i kočnica.
  const zmigavac = (side: "left" | "right", label: string, znak: string) => (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={pedals.indicator === side}
      aria-label={`${indicatorLabel}: ${label}`}
      onClick={() => pedals.toggleIndicator(side)}
      className={`font-display flex-1 rounded border-2 py-2.5 text-lg font-bold tracking-wide uppercase transition-colors select-none disabled:opacity-40 ${
        pedals.indicator === side
          ? "border-yellow bg-yellow text-ink"
          : "border-line bg-panel text-muted"
      }`}
    >
      <span aria-hidden="true">{znak}</span> {label}
    </button>
  );

  // Promjena trake je jedan zahtjev, ne stanje — zato `onClick` i bez
  // `aria-pressed`: dugme se ne „drži" upaljeno.
  const traka = (side: "left" | "right", label: string, znak: string) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => pedals.requestLane(side)}
      className="font-display flex-1 rounded border-2 border-blue bg-panel py-2.5 text-lg font-bold tracking-wide text-blue uppercase transition-colors select-none hover:bg-blue hover:text-white disabled:opacity-40"
    >
      <span aria-hidden="true">{znak}</span> {label}
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        {zmigavac("left", leftLabel, "◀")}
        {zmigavac("right", rightLabel, "▶")}
      </div>
      {lanes && (
        <div className="flex gap-3">
          {traka("left", lanes.leftLabel, "⇤")}
          {traka("right", lanes.rightLabel, "⇥")}
        </div>
      )}
      <div className="flex gap-3">
        {button("brake", brakeLabel, "border-red bg-red text-white")}
        {button("throttle", throttleLabel, "border-green bg-green text-white")}
      </div>
    </div>
  );
}
