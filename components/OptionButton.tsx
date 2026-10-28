"use client";

import type { Dict } from "@/lib/i18n";
import type { Bilingual } from "@/lib/questions";
import BilingualText from "./BilingualText";
import AnswerOption from "./ui/AnswerOption";
import type { OptionKey } from "@/lib/types";

interface OptionButtonProps {
  optionKey: OptionKey;
  text: Bilingual;
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

/**
 * Ponuđeni odgovor: slovo u krugu, tekst sa prevodom ispod, a poslije
 * provjere tačno/netačno (vidi ui/AnswerOption). Boje se pale tek kad je
 * odgovor otkriven; do tada je vidljiv samo izbor.
 */
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
  return (
    <AnswerOption
      letter={optionKey}
      selected={selected}
      revealed={revealed}
      isCorrect={isCorrect}
      disabled={disabled}
      onSelect={() => onSelect(optionKey)}
      correctLabel={t.correctAnswerLabel}
      yourLabel={t.yourAnswerLabel}
    >
      <BilingualText text={text} />
    </AnswerOption>
  );
}
