"use client";

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
}

export default function OptionButton({
  optionKey,
  text,
  selected,
  revealed,
  isCorrect,
  disabled,
  onSelect,
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

  let markerTone = "border-ink bg-panel text-ink";
  if (revealed && isCorrect) {
    markerTone = "border-green bg-green text-white";
  } else if (revealed && selected && !isCorrect) {
    markerTone = "border-red bg-red text-white";
  } else if (selected) {
    markerTone = "border-blue bg-blue text-white";
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
        className={`font-display mt-px flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 text-base font-bold uppercase ${markerTone}`}
      >
        {optionKey}
      </span>
      <span className="pt-0.5 text-[0.9375rem] leading-snug sm:text-base">{text}</span>
      {revealed && isCorrect && (
        <span className="tag ml-auto flex-none self-center text-green">Tačno</span>
      )}
      {revealed && selected && !isCorrect && (
        <span className="tag ml-auto flex-none self-center text-red">Vaš odgovor</span>
      )}
    </button>
  );
}
