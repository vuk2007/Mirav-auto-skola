"use client";

import { BookOpen, Menu, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { PENALTIES_ENABLED } from "@/lib/config";
import { useApp } from "./AppProvider";
import LangSwitch from "./LangSwitch";
import { LinkKazne } from "./PenaltyLoader";

/**
 * Zaglavlje pune stranice: staklena traka sa logom lijevo.
 *
 * Na telefonu desno stoji samo dugme menija (kao u referenci); meni nosi
 * izbor jezika, literaturu i spisak kazni. Od širine `sm` sve to stoji u
 * traci, bez menija.
 *
 * Logo je tamna dvobojna varijanta (`public/mirav-logo-tamni.png`, pravi je
 * scripts/gen-logo-tamni.mjs iz originala). Ako MIRAV pošalje SVG, dovoljno
 * je zamijeniti taj fajl.
 */
export default function BrandHeader() {
  const { goHome, t, setLiteratureOpen } = useApp();
  const [otvoren, setOtvoren] = useState(false);
  const meni = useRef<HTMLDivElement>(null);
  const dugme = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!otvoren) return;
    const naKlik = (e: PointerEvent) => {
      const cilj = e.target as Node;
      if (!meni.current?.contains(cilj) && !dugme.current?.contains(cilj)) setOtvoren(false);
    };
    const naTaster = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOtvoren(false);
        dugme.current?.focus();
      }
    };
    document.addEventListener("pointerdown", naKlik);
    document.addEventListener("keydown", naTaster);
    return () => {
      document.removeEventListener("pointerdown", naKlik);
      document.removeEventListener("keydown", naTaster);
    };
  }, [otvoren]);

  const literatura = (
    <button
      type="button"
      onClick={() => {
        setOtvoren(false);
        setLiteratureOpen(true);
      }}
      className="inline-flex min-h-11 items-center gap-2 font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-caps)] text-text-muted uppercase transition-colors hover:text-text"
    >
      <BookOpen aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />
      {t.literature}
    </button>
  );

  return (
    <header className="relative z-40 mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6">
      <div className="flex items-center gap-4 rounded-xl border border-glass-line bg-glass px-4 py-3 backdrop-blur-md sm:px-6">
        <button
          type="button"
          onClick={goHome}
          aria-label={t.backToStart}
          className="flex-none rounded-sm transition-opacity duration-200 hover:opacity-85"
        >
          <Image
            src="/mirav-logo-tamni.png"
            alt="Auto-škola MIRAV"
            width={2400}
            height={686}
            priority
            className="h-10 w-auto sm:h-11"
          />
        </button>

        <nav className="ml-auto hidden items-center gap-6 sm:flex" aria-label={t.menuLabel}>
          {PENALTIES_ENABLED && <LinkKazne t={t} />}
          {literatura}
          <LangSwitch />
        </nav>

        <button
          ref={dugme}
          type="button"
          data-qa="meni"
          aria-label={t.menuLabel}
          aria-expanded={otvoren}
          aria-controls="glavni-meni"
          onClick={() => setOtvoren((o) => !o)}
          className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-md text-text transition-colors hover:bg-glass-strong sm:hidden"
        >
          {otvoren ? <X strokeWidth={1.5} className="h-6 w-6" /> : <Menu strokeWidth={1.5} className="h-6 w-6" />}
        </button>
      </div>

      {otvoren && (
        <div
          ref={meni}
          id="glavni-meni"
          className="absolute inset-x-4 top-full mt-2 rounded-xl border border-glass-line bg-surface p-5 shadow-soft motion-safe:animate-[pojava_180ms_var(--ease-izlaz)] sm:hidden"
        >
          <p className="mb-3 font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-label)] text-text-muted uppercase">
            {t.langLabel}
          </p>
          <LangSwitch />
          <div className="mt-4 flex flex-col border-t border-glass-line pt-2">
            {literatura}
            {PENALTIES_ENABLED && <LinkKazne t={t} />}
          </div>
        </div>
      )}
    </header>
  );
}
