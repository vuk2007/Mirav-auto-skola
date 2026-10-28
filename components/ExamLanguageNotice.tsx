"use client";

import { Languages } from "lucide-react";
import { useRef } from "react";
import { EXAM_LANGUAGE_NOTICE } from "@/lib/examLanguage";
import type { Lang } from "@/lib/i18n";
import Button from "./ui/Button";
import IconCircle from "./ui/IconCircle";
import Modal from "./ui/Modal";

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

  if (!notice) return null;

  return (
    <Modal
      open
      dismissible={false}
      role="alertdialog"
      labelledBy="jezik-ispita-naslov"
      describedBy="jezik-ispita-tekst"
      lang={lang}
      initialFocus={buttonRef}
    >
      <IconCircle icon={Languages} className="mb-5" />
      <h2 id="jezik-ispita-naslov" className="mb-3 font-display text-2xl leading-tight font-bold">
        {notice.title}
      </h2>
      <p id="jezik-ispita-tekst" className="mb-7 leading-relaxed text-text-muted">
        {notice.body}
      </p>
      <Button ref={buttonRef} onClick={onConfirm} fullWidth className="sm:w-auto">
        {notice.confirm}
      </Button>
    </Modal>
  );
}

/** Tanka traka iznad pitanja tokom vježbe i ispita na EN/RU. */
export function ExamLanguageStrip({ lang }: { lang: Lang }) {
  const notice = EXAM_LANGUAGE_NOTICE[lang];
  if (!notice) return null;
  return (
    <p
      lang={lang}
      className="flex items-start gap-3 rounded-lg border border-accent-line bg-accent-soft px-4 py-3 text-sm leading-snug text-text"
    >
      <Languages aria-hidden="true" strokeWidth={1.5} className="mt-0.5 h-4 w-4 flex-none text-accent-2" />
      {notice.strip}
    </p>
  );
}
