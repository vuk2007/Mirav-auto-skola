"use client";

import { useEffect, useRef } from "react";
import { LITERATURE } from "@/lib/config";
import type { Dict } from "@/lib/i18n";

interface LiteratureModalProps {
  open: boolean;
  onClose: () => void;
  t: Dict;
}

/** Modal sa zvaničnim izvorima (gov.me). Otvara se sa landinga i sa rezultata. */
export default function LiteratureModal({ open, onClose, t }: LiteratureModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    closeRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Zadrži fokus unutar modala dok je otvoren.
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>("a[href], button");
      if (focusable.length === 0) return;
      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/60 p-4 sm:items-center"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lit-title"
        className="panel my-auto w-full max-w-lg p-5 sm:p-6"
      >
        <div className="mb-3 flex items-start gap-3">
          <span className="diamond mt-1.5 h-3 w-3" aria-hidden="true" />
          <h2 id="lit-title" className="text-2xl font-bold">
            {t.litTitle}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="font-display ml-auto rounded border-2 border-line px-3 py-1 text-base font-semibold text-muted uppercase transition-colors hover:border-blue hover:text-blue"
          >
            {t.close}
          </button>
        </div>

        <p className="mb-4 text-sm text-muted">{t.litLead}</p>

        <ul className="space-y-2">
          {LITERATURE.map((item) => (
            <li key={item.url}>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 rounded border border-line bg-paper p-3 text-[0.9375rem] leading-snug text-blue transition-colors hover:border-blue hover:bg-blue-soft"
              >
                <span aria-hidden="true" className="mt-0.5 flex-none">
                  ↗
                </span>
                <span className="underline-offset-2 hover:underline">{item.title}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
