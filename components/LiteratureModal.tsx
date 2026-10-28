"use client";

import { ArrowUpRight, X } from "lucide-react";
import { LITERATURE } from "@/lib/config";
import type { Dict } from "@/lib/i18n";
import Modal from "./ui/Modal";
import SectionLabel from "./ui/SectionLabel";

interface LiteratureModalProps {
  open: boolean;
  onClose: () => void;
  t: Dict;
}

/**
 * Modal sa zvaničnim izvorima (gov.me). Otvara se iz zaglavlja, sa početne i
 * sa rezultata. Escape, klik van i dugme Zatvori ga zatvaraju; fokus ostaje
 * unutra dok je otvoren (vidi ui/Modal).
 */
export default function LiteratureModal({ open, onClose, t }: LiteratureModalProps) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="lit-title">
      <div className="mb-5 flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <SectionLabel className="mb-3">{t.literature}</SectionLabel>
          <h2 id="lit-title" className="font-display text-2xl font-bold">
            {t.litTitle}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="-mt-1 -mr-2 inline-flex h-11 w-11 flex-none items-center justify-center rounded-md text-text-muted transition-colors hover:bg-glass-strong hover:text-text"
        >
          <X strokeWidth={1.5} className="h-5 w-5" />
        </button>
      </div>

      <p className="mb-5 text-sm leading-relaxed text-text-muted">{t.litLead}</p>

      <ul className="divide-y divide-glass-line border-y border-glass-line">
        {LITERATURE.map((item) => (
          <li key={item.url}>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 py-3.5 text-[0.9375rem] leading-snug text-text transition-colors hover:text-accent-2"
            >
              <span className="min-w-0 flex-1">{item.title}</span>
              <ArrowUpRight
                aria-hidden="true"
                strokeWidth={1.5}
                className="mt-0.5 h-4 w-4 flex-none text-accent-2 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </a>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
