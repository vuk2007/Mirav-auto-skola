"use client";

import { useEffect, useRef } from "react";
import { EXAM_LANGUAGE_NOTICE } from "@/lib/examLanguage";
import type { Lang } from "@/lib/i18n";

interface ModalProps {
  lang: Lang;
  /** Zove se na „I understand" / „Понятно" — tek tada vježba ili ispit kreće. */
  onConfirm: () => void;
}

/**
 * Upozorenje o jeziku ispita (samo EN/RU). Jedini izlaz je potvrda: nema
 * zatvaranja klikom van modala ni tipkom Escape, jer bez potvrde vježba ili
 * ispit ne smiju krenuti. Ništa se ne pamti — prikazuje se pri svakom pokretanju.
 */
export function ExamLanguageModal({ lang, onConfirm }: ModalProps) {
  const notice = EXAM_LANGUAGE_NOTICE[lang];
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();
    // Jedino dugme — Tab ostaje na njemu, fokus ne bježi na stranicu iza.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!notice) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bg/60 p-4 sm:items-center"
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="jezik-ispita-naslov"
        aria-describedby="jezik-ispita-tekst"
        lang={lang}
        className="panel my-auto w-full max-w-lg border-t-4 border-t-red p-5 sm:p-6"
      >
        <div className="mb-3 flex items-center gap-3">
          <span className="diamond h-3 w-3" aria-hidden="true" />
          <h2 id="jezik-ispita-naslov" className="text-2xl font-bold">
            {notice.title}
          </h2>
        </div>
        <p id="jezik-ispita-tekst" className="mb-5 leading-relaxed">
          {notice.body}
        </p>
        <button
          ref={buttonRef}
          type="button"
          onClick={onConfirm}
          className="font-display w-full rounded bg-blue px-6 py-3 text-lg font-bold tracking-wide text-white uppercase transition-colors hover:bg-blue-dark sm:w-auto"
        >
          {notice.confirm}
        </button>
      </div>
    </div>
  );
}

/** Tanka traka iznad pitanja tokom vježbe i ispita na EN/RU. */
export function ExamLanguageStrip({ lang }: { lang: Lang }) {
  const notice = EXAM_LANGUAGE_NOTICE[lang];
  if (!notice) return null;
  return (
    <p
      lang={lang}
      className="flex items-center gap-2 rounded border border-line border-l-4 border-l-red bg-panel px-3 py-1.5 text-sm text-muted"
    >
      <span className="diamond h-2 w-2" aria-hidden="true" />
      {notice.strip}
    </p>
  );
}
