"use client";

import { ArrowLeftToLine, ArrowRightToLine, ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
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
      className={`font-display flex-1 touch-none rounded-md border py-5 text-2xl font-bold tracking-[var(--tracking-caps)] uppercase transition-colors select-none disabled:opacity-40 ${
        pedals.active[pedal] ? tone : "border-glass-line bg-surface text-text"
      }`}
    >
      {label}
    </button>
  );

  // Pokazivač je PREKIDAČ, ne pedala: pritisak ga pali i ostavlja upaljenim.
  // Zato ide na `onClick`, a ne na `pointerdown` kao gas i kočnica.
  const zmigavac = (side: "left" | "right", label: string, znak: ReactNode) => (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={pedals.indicator === side}
      aria-label={`${indicatorLabel}: ${label}`}
      onClick={() => pedals.toggleIndicator(side)}
      className={`font-display flex flex-1 items-center justify-center gap-2 rounded-md border py-2.5 text-base font-bold tracking-[var(--tracking-caps)] uppercase transition-colors select-none disabled:opacity-40 ${
        pedals.indicator === side
          ? "border-signal-yellow bg-signal-yellow text-bg"
          : "border-glass-line bg-surface text-text-muted"
      }`}
    >
      {znak}
      {label}
    </button>
  );

  // Promjena trake je jedan zahtjev, ne stanje — zato `onClick` i bez
  // `aria-pressed`: dugme se ne „drži" upaljeno.
  const traka = (side: "left" | "right", label: string, znak: ReactNode) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => pedals.requestLane(side)}
      className="font-display flex flex-1 items-center justify-center gap-2 rounded-md border border-accent-2 bg-surface py-2.5 text-base font-bold tracking-[var(--tracking-caps)] text-accent-2 uppercase transition-colors select-none hover:bg-accent hover:text-white disabled:opacity-40"
    >
      {znak}
      {label}
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        {zmigavac("left", leftLabel, <ChevronLeft aria-hidden="true" strokeWidth={2} className="h-5 w-5" />)}
        {zmigavac("right", rightLabel, <ChevronRight aria-hidden="true" strokeWidth={2} className="h-5 w-5" />)}
      </div>
      {lanes && (
        <div className="flex gap-3">
          {traka("left", lanes.leftLabel, <ArrowLeftToLine aria-hidden="true" strokeWidth={1.75} className="h-5 w-5" />)}
          {traka("right", lanes.rightLabel, <ArrowRightToLine aria-hidden="true" strokeWidth={1.75} className="h-5 w-5" />)}
        </div>
      )}
      <div className="flex gap-3">
        {button("brake", brakeLabel, "border-err-line bg-err text-bg")}
        {button("throttle", throttleLabel, "border-ok-line bg-ok text-bg")}
      </div>
    </div>
  );
}
