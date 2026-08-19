"use client";

import type { Dict } from "@/lib/i18n";
import type { OptionKey } from "@/lib/types";

interface OptionButtonProps {
  optionKey: OptionKey;
  text: string;
  /** Da li je kandidat izabrao baš ovu opciju. */
  selected: boolean;
  /** Prikaži tačno/netačno bojenje (poslije provjere ili u vježbi). */
  revealed: boolean;
  /** Da li je ova opcija tačan odgovor. */
  isCorrect: boolean;
  disabled: boolean;
  onSelect: (key: OptionKey) => void;
  t: Dict;
}

export default function OptionButton({
  optionKey,
  text,
  selected,
  revealed,
  isCorrect,
  disabled,
  onSelect,
  t,
}: OptionButtonProps) {
  // Boje se pale tek kad je odgovor otkriven; do tada je vidljiv samo izbor.
  let tone = "border-line bg-panel hover:border-blue hover:bg-blue-soft";
  if (revealed && isCorrect) {
    tone = "border-green bg-green-soft";
  } else if (revealed && selected && !isCorrect) {
    tone = "border-red bg-red-soft";
  } else if (revealed) {
    tone = "border-line bg-panel opacity-60";
  } else if (selected) {
    tone = "border-blue bg-blue-soft";
  }

  // Kvadratić ostaje bijel, a ✕ se „upisuje" u njega — kao na papirnom testu.
  // Popunjen kvadratić bi izgledao kao da je odgovor već ovjeren.
  let markerTone = "border-ink bg-white text-ink";
  if (revealed && isCorrect) {
    markerTone = "border-green bg-white text-green";
  } else if (revealed && selected && !isCorrect) {
    markerTone = "border-red bg-white text-red";
  } else if (selected) {
    markerTone = "border-blue bg-white text-blue";
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(optionKey)}
      disabled={disabled}
      aria-pressed={selected}
      className={`flex w-full items-start gap-3 rounded border-2 p-3 text-left transition-colors sm:gap-3.5 sm:p-3.5 ${tone} ${
        disabled ? "cursor-default" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className={`font-display mt-px flex h-7 w-7 flex-none items-center justify-center rounded-sm border-2 text-lg leading-none font-bold ${markerTone}`}
      >
        {/* ✕ samo tamo gdje je kandidat označio. Tačan odgovor koji nije
            označen ostaje prazan — zeleni okvir kaže da je tačan, ✕ bi lagao
            da ga je kandidat izabrao. */}
        {selected ? "✕" : ""}
      </span>
      <span className="pt-0.5 text-[0.9375rem] leading-snug sm:text-base">{text}</span>
      {revealed && isCorrect && (
        <span className="tag ml-auto flex-none self-center text-green">{t.correctAnswerLabel}</span>
      )}
      {revealed && selected && !isCorrect && (
        <span className="tag ml-auto flex-none self-center text-red">{t.yourAnswerLabel}</span>
      )}
    </button>
  );
}
