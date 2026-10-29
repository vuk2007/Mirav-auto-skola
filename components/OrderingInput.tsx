"use client";

import { Check, X } from "lucide-react";
import { useId } from "react";
import type { Dict } from "@/lib/i18n";
import { formatSequence, normalizeSequence } from "@/lib/questions";
import type { OrderingQuestion } from "@/lib/types";
import Button from "./ui/Button";

interface OrderingInputProps {
  question: OrderingQuestion;
  value: string;
  onChange: (value: string) => void;
  /** Potvrda odgovora (dugme „Provjeri" ili Enter). */
  onSubmit: () => void;
  /** Vježba potvrđuje odgovor dugmetom; na ispitu se unos pamti u hodu. */
  showSubmit: boolean;
  revealed: boolean;
  correct: boolean;
  disabled: boolean;
  t: Dict;
}

/** Unos redoslijeda prolaska vozila (npr. 3-4-2-1), sa provjerom u vježbi. */
export default function OrderingInput({
  question,
  value,
  onChange,
  onSubmit,
  showSubmit,
  revealed,
  correct,
  disabled,
  t,
}: OrderingInputProps) {
  const inputId = useId();
  const hintId = useId();
  const expected = question.answer_sequence.length;
  const entered = normalizeSequence(value).length;

  let tone = "border-glass-line-strong focus:border-accent-2 focus:shadow-glow-sm";
  if (revealed) tone = correct ? "border-ok-line bg-ok-soft" : "border-err-line bg-err-soft";

  return (
    <div className="space-y-3">
      <label
        htmlFor={inputId}
        className="block font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-label)] text-text-muted uppercase"
      >
        {t.orderingLabel}
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          disabled={disabled}
          aria-describedby={hintId}
          placeholder={expected === 2 ? "1-4" : "3-4-2-1"}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !disabled) {
              e.preventDefault();
              onSubmit();
            }
          }}
          className={`tabular min-h-14 w-full rounded-md border bg-glass px-4 font-display text-2xl font-bold tracking-[0.25em] text-text transition-[border-color,box-shadow] duration-200 outline-none placeholder:text-text-muted/50 sm:flex-1 ${tone}`}
        />
        {showSubmit && !revealed && (
          <Button onClick={onSubmit} disabled={disabled || entered === 0} arrow={false} className="sm:flex-none">
            {t.check}
          </Button>
        )}
      </div>

      <p id={hintId} className="text-sm text-text-muted">
        {t.orderingHint}
        {entered > 0 && entered !== expected && (
          <span className="text-err">
            {" "}
            {t.orderingEntered}: {entered}/{expected}.
          </span>
        )}
      </p>

      {revealed && (
        <p className={`flex items-center gap-2 font-display text-base font-bold ${correct ? "text-ok" : "text-err"}`}>
          {correct ? (
            <Check aria-hidden="true" strokeWidth={2} className="h-5 w-5 flex-none" />
          ) : (
            <X aria-hidden="true" strokeWidth={2} className="h-5 w-5 flex-none" />
          )}
          <span>
            {correct ? t.correctAnswerLabel : t.reviewWrong} — {t.orderingCorrectIs}{" "}
            <span className="tabular tracking-[0.2em]">{formatSequence(question.answer_sequence)}</span>
          </span>
        </p>
      )}
    </div>
  );
}
