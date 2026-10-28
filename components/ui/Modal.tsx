"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";

/**
 * Modal preko cijelog ekrana: zatamnjena pozadina, puna tamna površina u
 * sredini, fokus zadržan unutra dok je otvoren.
 *
 * - `dismissible` (podrazumijevano): Escape i klik van modala zovu `onClose`.
 * - bez `dismissible` jedini izlaz je dugme u sadržaju, kao kod upozorenja o
 *   jeziku ispita, koje mora biti potvrđeno (tada je `role="alertdialog"`).
 * - `initialFocus` je element koji dobija fokus pri otvaranju; inače prvi
 *   fokusabilan element.
 */
const FOKUSABILNI = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export default function Modal({
  open,
  onClose,
  dismissible = true,
  role = "dialog",
  labelledBy,
  describedBy,
  lang,
  initialFocus,
  size = "md",
  children,
}: {
  open: boolean;
  onClose?: () => void;
  dismissible?: boolean;
  role?: "dialog" | "alertdialog";
  labelledBy: string;
  describedBy?: string;
  lang?: string;
  initialFocus?: RefObject<HTMLElement | null>;
  size?: "md" | "lg";
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const zatvori = useRef(onClose);
  zatvori.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prijeFokus = document.activeElement as HTMLElement | null;
    const prvi = initialFocus?.current ?? dialog.current?.querySelector<HTMLElement>(FOKUSABILNI);
    prvi?.focus();

    const naTaster = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) {
        zatvori.current?.();
        return;
      }
      if (e.key !== "Tab" || !dialog.current) return;
      const svi = [...dialog.current.querySelectorAll<HTMLElement>(FOKUSABILNI)];
      const prviEl = svi[0];
      const zadnji = svi[svi.length - 1];
      if (!prviEl || !zadnji) return;
      if (e.shiftKey && document.activeElement === prviEl) {
        e.preventDefault();
        zadnji.focus();
      } else if (!e.shiftKey && document.activeElement === zadnji) {
        e.preventDefault();
        prviEl.focus();
      } else if (!dialog.current.contains(document.activeElement)) {
        e.preventDefault();
        prviEl.focus();
      }
    };
    document.addEventListener("keydown", naTaster);
    return () => {
      document.removeEventListener("keydown", naTaster);
      prijeFokus?.focus?.();
    };
  }, [open, dismissible, initialFocus]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bg/75 p-4 backdrop-blur-sm sm:items-center sm:p-6"
      role="presentation"
      onClick={(e) => {
        if (dismissible && e.target === e.currentTarget) zatvori.current?.();
      }}
    >
      <div
        ref={dialog}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        lang={lang}
        className={`my-auto w-full rounded-xl border border-glass-line bg-surface p-6 shadow-soft motion-safe:animate-[pojava_200ms_var(--ease-izlaz)] sm:p-8 ${
          size === "lg" ? "max-w-2xl" : "max-w-lg"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
