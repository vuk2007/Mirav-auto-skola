"use client";

import { Check, RotateCcw, X } from "lucide-react";
import type { ReactNode } from "react";
import type { Dict } from "@/lib/i18n";
import Button from "../ui/Button";
import GlassPanel from "../ui/GlassPanel";
import SectionLabel from "../ui/SectionLabel";

/**
 * Zajednički dijelovi oba runnera simulatora (crtane scene i fotografije iz
 * kataloga): skor, kraj kruga, izabrani redoslijed i povratna informacija.
 * Scena sama (SVG ili fotografija) ostaje u runneru.
 */

export const OZNAKA = "font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-label)] uppercase";

export interface SimStats {
  correct: number;
  answered: number;
  streak: number;
  bestStreak: number;
}

/** Traka sa skorom iznad scene. */
export function SimSkor({ stats, t }: { stats: SimStats; t: Dict }) {
  return (
    <GlassPanel as="section" padding="sm" className="flex flex-wrap items-center gap-x-8 gap-y-3 sm:px-5">
      <p className="flex items-baseline gap-3">
        <span className={`${OZNAKA} text-text-muted`}>{t.correctLabel}</span>
        <span className="tabular font-display text-xl font-bold">
          <span className="text-ok">{stats.correct}</span>
          <span className="mx-1 text-text-muted">/</span>
          {stats.answered}
        </span>
      </p>
      <p className="flex items-baseline gap-3">
        <span className={`${OZNAKA} text-text-muted`}>{t.simStreak}</span>
        <span className="tabular font-display text-xl font-bold text-accent-2">{stats.streak}</span>
      </p>
    </GlassPanel>
  );
}

/** Prazno stanje ili učitavanje. */
export function SimPoruka({ children, busy }: { children: ReactNode; busy?: boolean }) {
  return (
    <GlassPanel aria-busy={busy || undefined}>
      <p className="text-sm text-text-muted">{children}</p>
    </GlassPanel>
  );
}

/** Kraj kruga: zbir i novi krug. */
export function SimKraj({
  label,
  stats,
  onRestart,
  t,
}: {
  label: string;
  stats: SimStats;
  onRestart: () => void;
  t: Dict;
}) {
  return (
    <GlassPanel padding="lg" aria-live="polite">
      <SectionLabel className="mb-4">{label}</SectionLabel>
      <p className="font-display text-2xl font-bold">{t.simFinished}</p>
      <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4 border-t border-glass-line pt-5">
        <div>
          <dt className={`${OZNAKA} text-text-muted`}>{t.correctLabel}</dt>
          <dd className="tabular mt-1.5 font-display text-2xl font-bold">
            <span className="text-ok">{stats.correct}</span>
            <span className="mx-1 text-text-muted">/</span>
            {stats.answered}
          </dd>
        </div>
        <div>
          <dt className={`${OZNAKA} text-text-muted`}>{t.simStreak}</dt>
          <dd className="tabular mt-1.5 font-display text-2xl font-bold text-accent-2">{stats.bestStreak}</dd>
        </div>
      </dl>
      <Button onClick={onRestart} className="mt-6 w-full sm:w-auto">
        {t.simRestart}
      </Button>
    </GlassPanel>
  );
}

/** Izabrani redoslijed sa dugmetom za brisanje. */
export function SimRedoslijed({
  picked,
  canClear,
  onClear,
  t,
}: {
  picked: readonly number[];
  canClear: boolean;
  onClear: () => void;
  t: Dict;
}) {
  return (
    <div className="mt-4 flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2 border-t border-glass-line pt-4">
      <p className="flex items-baseline gap-3">
        <span className={`${OZNAKA} text-text-muted`}>{t.simYourOrder}</span>
        <span className="tabular font-display text-xl font-bold tracking-[0.2em]">
          {picked.length > 0 ? picked.join("-") : "—"}
        </span>
      </p>
      {canClear && (
        <Button variant="ghost" icon={<RotateCcw aria-hidden="true" strokeWidth={1.5} />} onClick={onClear}>
          {t.simClear}
        </Button>
      )}
    </div>
  );
}

/**
 * Povratna informacija poslije provjere: tačno/netačno sa ikonicom, pa
 * dodatni sadržaj (tačan redoslijed, pravilo, objašnjenje) ispod razdjelnika.
 */
export function SimPovratna({ correct, t, children }: { correct: boolean; t: Dict; children?: ReactNode }) {
  const Ikona = correct ? Check : X;
  return (
    <div
      className={`mt-5 rounded-lg border p-4 ${correct ? "border-ok-line bg-ok-soft" : "border-err-line bg-err-soft"}`}
      role="status"
    >
      <p className={`flex items-center gap-2.5 font-display text-lg font-bold ${correct ? "text-ok" : "text-err"}`}>
        <Ikona aria-hidden="true" strokeWidth={2} className="h-5 w-5 flex-none" />
        {correct ? t.correctFeedback : t.wrongFeedback}
      </p>
      {children}
    </div>
  );
}

/** Red „oznaka: vrijednost" unutar povratne informacije. */
export function SimDetalj({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
      <span className={`${OZNAKA} text-text-muted`}>{label}</span>
      {children}
    </p>
  );
}

/** Redoslijed kao krupne cifre. */
export function SimNiz({ children }: { children: ReactNode }) {
  return <span className="tabular font-display text-lg font-bold tracking-[0.2em] text-text">{children}</span>;
}
