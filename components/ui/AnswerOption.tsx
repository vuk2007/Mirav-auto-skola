"use client";

import { Check, X } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Jedan ponuđeni odgovor: slovo u krugu, tekst, i poslije provjere oznaka.
 *
 * Stanja:
 * - mirno: tanka staklena ivica;
 * - izabrano: plava ivica i blag glow, slovo u punom plavom krugu;
 * - otkriveno tačno: prigušeno zeleno, kvačica;
 * - otkriveno pogrešno izabrano: prigušeno crveno, iksić;
 * - otkriveno ostalo: prigušen tekst (siva boja, ne providnost, zbog kontrasta).
 *
 * Boja nikad nije jedini nosilac značenja: uz zeleno/crveno stoje ikonica i natpis.
 */
export default function AnswerOption({
  letter,
  children,
  selected,
  revealed,
  isCorrect,
  disabled,
  onSelect,
  correctLabel,
  yourLabel,
}: {
  letter: string;
  children: ReactNode;
  selected: boolean;
  revealed: boolean;
  isCorrect: boolean;
  disabled: boolean;
  onSelect: () => void;
  correctLabel: string;
  yourLabel: string;
}) {
  const tacno = revealed && isCorrect;
  const pogresno = revealed && selected && !isCorrect;
  const ugaseno = revealed && !isCorrect && !selected;

  let okvir = "border-glass-line bg-glass hover:border-glass-line-strong hover:bg-glass-strong";
  if (tacno) okvir = "border-ok-line bg-ok-soft";
  else if (pogresno) okvir = "border-err-line bg-err-soft";
  else if (ugaseno) okvir = "border-glass-line bg-transparent";
  else if (selected) okvir = "border-accent-2 bg-accent-soft shadow-glow-sm";

  let krug = "border-glass-line-strong text-text-muted";
  if (tacno) krug = "border-ok bg-ok text-bg";
  else if (pogresno) krug = "border-err bg-err text-bg";
  else if (selected) krug = "border-accent bg-accent text-white";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={`group flex w-full items-start gap-3.5 rounded-lg border px-4 py-3.5 text-left transition-[background,border-color,box-shadow] duration-200 ease-[var(--ease-izlaz)] disabled:cursor-default ${okvir}`}
    >
      <span
        aria-hidden="true"
        className={`mt-px flex h-8 w-8 flex-none items-center justify-center rounded-full border font-display text-[0.8125rem] font-bold uppercase transition-colors duration-200 ${krug}`}
      >
        {tacno ? <Check strokeWidth={2} className="h-4 w-4" /> : pogresno ? <X strokeWidth={2} className="h-4 w-4" /> : letter}
      </span>
      <span className={`min-w-0 flex-1 pt-1 text-[0.9375rem] leading-snug sm:text-base ${ugaseno ? "text-text-muted" : "text-text"}`}>
        {children}
      </span>
      {tacno && (
        <span className="mt-1.5 flex-none font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-caps)] text-ok uppercase">
          {correctLabel}
        </span>
      )}
      {pogresno && (
        <span className="mt-1.5 flex-none font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-caps)] text-err uppercase">
          {yourLabel}
        </span>
      )}
    </button>
  );
}
