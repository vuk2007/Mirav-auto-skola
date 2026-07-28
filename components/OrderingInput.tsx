"use client";

import { useId } from "react";
import { formatSequence, normalizeSequence } from "@/lib/questions";
import type { OrderingQuestion } from "@/lib/types";

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
}

export default function OrderingInput({
  question,
  value,
  onChange,
  onSubmit,
  showSubmit,
  revealed,
  correct,
  disabled,
}: OrderingInputProps) {
  const inputId = useId();
  const hintId = useId();
  const expected = question.answer_sequence.length;
  const entered = normalizeSequence(value).length;

  let tone = "border-line focus-within:border-blue";
  if (revealed) tone = correct ? "border-green bg-green-soft" : "border-red bg-red-soft";

  return (
    <div className="space-y-3">
      <label htmlFor={inputId} className="tag block text-muted">
        Redoslijed prolaska vozila
      </label>

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          disabled={disabled}
          aria-describedby={hintId}
          placeholder={expected === 2 ? "npr. 1-4" : "npr. 3-4-2-1"}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !disabled) {
              e.preventDefault();
              onSubmit();
            }
          }}
          className={`font-display w-full rounded border-2 bg-panel px-3.5 py-3 text-2xl font-bold tracking-[0.25em] transition-colors outline-none sm:flex-1 ${tone}`}
        />
        {showSubmit && !revealed && (
          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled || entered === 0}
            className="font-display rounded bg-blue px-6 py-3 text-lg font-bold tracking-wide text-white uppercase transition-colors hover:bg-blue-dark disabled:opacity-40 disabled:hover:bg-blue sm:flex-none"
          >
            Provjeri
          </button>
        )}
      </div>

      <p id={hintId} className="text-sm text-muted">
        Unesite {expected} {expected === 2 ? "broja" : "brojeva"} redom kojim vozila prolaze —
        crtica, razmak ili bez razmaka (broji se samo redoslijed cifara).
        {entered > 0 && entered !== expected && (
          <span className="text-red"> Uneseno: {entered}.</span>
        )}
      </p>

      {revealed && (
        <p className={`font-display text-lg font-bold ${correct ? "text-green" : "text-red"}`}>
          {correct ? "Tačno" : "Netačno"} — tačan redoslijed je{" "}
          <span className="tracking-[0.2em]">{formatSequence(question.answer_sequence)}</span>
        </p>
      )}
    </div>
  );
}
