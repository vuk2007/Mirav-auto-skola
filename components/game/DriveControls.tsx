"use client";

import { useEffect, useRef } from "react";
import type { Volan } from "./useVolan";

interface DriveControlsProps {
  volan: Volan;
  steerLabel: string;
  throttleLabel: string;
  brakeLabel: string;
  /** Pokazivač pravca; bez ovoga se dugmad ne crtaju (otvoren put ih ne sudi). */
  indicator?: { label: string; leftLabel: string; rightLabel: string } | null;
  disabled?: boolean;
}

/**
 * Volan i gas kao klizači.
 *
 * Oba se drže prstom i oba se puštanjem vraćaju u sredinu. Trag i kvaka se ne
 * crtaju kroz React nego se pomjeraju direktno: vrijednost se mijenja svakog
 * kadra, a ponovni render zbog dva broja bi trošio više nego cijela simulacija.
 *
 * `touch-action: none` je obavezan — bez njega povlačenje po klizaču skroluje
 * stranicu ispod njega, i to je na telefonu jedino što se desi.
 */
export default function DriveControls({
  volan,
  steerLabel,
  throttleLabel,
  brakeLabel,
  indicator = null,
  disabled = false,
}: DriveControlsProps) {
  const volanKvaka = useRef<HTMLDivElement>(null);
  const gasKvaka = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const kadar = () => {
      const s = volan.stanjeRef.current;
      // Kvaka ide do ivice staze, umanjeno za svoju polovinu — zato se mjeri
      // staza, a ne kvaka.
      const pomak = (kvaka: HTMLDivElement | null, uspravno: boolean, v: number) => {
        if (!kvaka) return;
        const staza = kvaka.parentElement;
        if (!staza) return;
        const raspon = uspravno
          ? (staza.clientHeight - kvaka.offsetHeight) / 2
          : (staza.clientWidth - kvaka.offsetWidth) / 2;
        const d = v * raspon;
        kvaka.style.transform = uspravno
          ? `translate(-50%, -50%) translateY(${-d}px)`
          : `translate(-50%, -50%) translateX(${d}px)`;
      };
      pomak(volanKvaka.current, false, s.steer);
      pomak(gasKvaka.current, true, s.gas);
      raf = requestAnimationFrame(kadar);
    };
    raf = requestAnimationFrame(kadar);
    return () => cancelAnimationFrame(raf);
  }, [volan]);

  /** Vrijednost klizača iz položaja prsta: −1 na jednom kraju, +1 na drugom. */
  const izPolozaja = (e: React.PointerEvent<HTMLDivElement>, uspravno: boolean): number => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = uspravno
      ? 1 - (e.clientY - r.top) / Math.max(1, r.height)
      : (e.clientX - r.left) / Math.max(1, r.width);
    return Math.max(-1, Math.min(1, t * 2 - 1));
  };

  const staza = (uspravno: boolean, koji: "steer" | "gas") => ({
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      volan.pocniDodir(koji, e.pointerId, izPolozaja(e, uspravno));
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || e.buttons === 0) return;
      volan.pomjeri(e.pointerId, izPolozaja(e, uspravno));
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  // Pokazivač je PREKIDAČ, ne klizač: pritisak ga pali i ostavlja upaljenim.
  // Zato ide na `onClick`, a ne na `pointerdown` kao volan i gas.
  const zmigavac = (side: "left" | "right", label: string, znak: string) => (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={volan.indicator === side}
      aria-label={`${indicator?.label ?? ""}: ${label}`}
      onClick={() => volan.toggleIndicator(side)}
      className={`font-display flex-1 touch-none rounded border-2 text-2xl font-bold transition-colors select-none disabled:opacity-40 ${
        volan.indicator === side
          ? "border-yellow bg-yellow text-ink"
          : "border-line bg-panel text-muted"
      }`}
    >
      {znak}
    </button>
  );

  return (
    <div className="mt-3 flex h-32 items-stretch gap-3">
      {indicator && (
        <div className="flex w-20 flex-col gap-2">
          {zmigavac("left", indicator.leftLabel, "◄")}
          {zmigavac("right", indicator.rightLabel, "►")}
        </div>
      )}

      {/* Volan: puna širina, jer se drži palcem u pokretu. */}
      <div
        className="relative flex-1 touch-none overflow-hidden rounded border-2 border-line bg-panel select-none"
        role="slider"
        aria-label={steerLabel}
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={0}
        tabIndex={0}
        {...staza(false, "steer")}
      >
        <div className="pointer-events-none absolute inset-y-4 left-1/2 w-0.5 -translate-x-1/2 bg-line" />
        <div
          ref={volanKvaka}
          className="pointer-events-none absolute top-1/2 left-1/2 flex h-20 w-16 items-center justify-center rounded bg-blue"
        >
          <span className="h-8 w-0.5 rounded bg-white/70" />
        </div>
        <span className="font-display pointer-events-none absolute top-1.5 left-2 text-xs font-bold tracking-wider text-muted uppercase">
          {steerLabel}
        </span>
      </div>

      {/* Gas: uspravno, gore je gas a dolje kočnica — kao i pedale u autu. */}
      <div
        className="relative w-24 touch-none overflow-hidden rounded border-2 border-line bg-panel select-none"
        role="slider"
        aria-label={`${throttleLabel} / ${brakeLabel}`}
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={0}
        tabIndex={0}
        {...staza(true, "gas")}
      >
        <div className="pointer-events-none absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 bg-line" />
        <div
          ref={gasKvaka}
          className="pointer-events-none absolute top-1/2 left-1/2 flex h-12 w-16 items-center justify-center rounded bg-green"
        >
          <span className="h-0.5 w-8 rounded bg-white/70" />
        </div>
        <span className="font-display pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-wider text-muted uppercase">
          {throttleLabel}
        </span>
        <span className="font-display pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-wider text-muted uppercase">
          {brakeLabel}
        </span>
      </div>
    </div>
  );
}
