"use client";

import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import type { ReactNode } from "react";
import type { Dict } from "@/lib/i18n";

/**
 * Mala dugmad koja se ponavljaju na svim ekranima igre (situacija, smjena,
 * putovanje, ruta, grad): povratak i zvuk. Jedno mjesto, isti izgled.
 */

/** „← Nazad" iznad igre, isti kao povratak u kvizu. */
export function NazadDugme({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex min-h-11 items-center gap-2 font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-caps)] text-text-muted uppercase transition-colors hover:text-text"
    >
      <ArrowLeft
        aria-hidden="true"
        strokeWidth={1.5}
        className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5"
      />
      {children}
    </button>
  );
}

/**
 * Zvuk uključen/isključen. `samoIkona` je za traku iznad platna; u meniju
 * podešavanja stoji i natpis.
 */
export function ZvukDugme({
  muted,
  onToggle,
  t,
  samoIkona = false,
  className = "",
}: {
  muted: boolean;
  onToggle: () => void;
  t: Dict;
  samoIkona?: boolean;
  className?: string;
}) {
  const Ikona = muted ? VolumeX : Volume2;
  const natpis = muted ? t.gameSoundOff : t.gameSoundOn;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={muted}
      aria-label={samoIkona ? natpis : undefined}
      className={`inline-flex min-h-10 items-center gap-2 rounded-md border border-glass-line px-3 text-sm text-text-muted transition-colors hover:border-glass-line-strong hover:text-text ${
        samoIkona ? "min-w-10 justify-center px-0" : ""
      } ${className}`}
    >
      <Ikona aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />
      {!samoIkona && natpis}
    </button>
  );
}
