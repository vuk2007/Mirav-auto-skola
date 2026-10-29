"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ChevronDown, Settings2 } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import LangSwitch from "@/components/LangSwitch";

/**
 * Okvir vožnje (redizajn za telefon): igra preko cijelog ekrana — gore uska
 * traka sa izlazom, nazivom i dugmetom za podešavanja (padajući meni), u
 * sredini platno koliko god može, dolje samo kontrole. Sva podešavanja
 * (doba dana, nivo, cilj, jezik…) su u meniju, ne oko platna.
 *
 * `podesavanja` dobija funkciju `zatvori` — dugme u meniju koje otvara nešto
 * preko platna (izbor cilja) prvo zatvori meni.
 */
export default function IgraOkvir({
  izlaz,
  naslov,
  podesavanja,
  kontrole,
  naOtvaranje,
  children,
}: {
  izlaz: { label: string; onClick: () => void };
  naslov?: ReactNode;
  podesavanja?: ReactNode | ((zatvori: () => void) => ReactNode);
  kontrole?: ReactNode;
  /** Meni se otvara — npr. pusti volan, da auto ne vozi sam dok se bira. */
  naOtvaranje?: () => void;
  children: ReactNode;
}) {
  const { t } = useApp();
  const [otvoren, setOtvoren] = useState(false);
  const meni = useRef<HTMLDivElement | null>(null);
  const dugme = useRef<HTMLButtonElement | null>(null);
  const zatvori = () => setOtvoren(false);

  // Stranica ispod se ne skroluje dok se vozi (prst na volanu bi je pomjerao).
  useEffect(() => {
    const prije = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prije;
    };
  }, []);

  useEffect(() => {
    if (!otvoren) return;
    const tipka = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOtvoren(false);
        dugme.current?.focus();
      }
    };
    window.addEventListener("keydown", tipka);
    return () => window.removeEventListener("keydown", tipka);
  }, [otvoren]);

  return (
    <div className="fixed inset-0 z-40 flex h-[100dvh] flex-col overscroll-none bg-bg" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="relative z-20 flex h-12 shrink-0 items-center gap-2 border-b border-glass-line bg-surface px-2 sm:px-3">
        <button
          type="button"
          onClick={izlaz.onClick}
          className="group flex h-10 shrink-0 items-center gap-2 rounded-md px-2 font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-caps)] text-text-muted uppercase transition-colors hover:text-text"
        >
          <ArrowLeft aria-hidden="true" strokeWidth={1.5} className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
          <span className="max-w-[9rem] truncate">{izlaz.label}</span>
        </button>
        <div className="min-w-0 flex-1 truncate text-center font-display text-sm font-semibold">{naslov}</div>
        {podesavanja !== undefined && (
          <button
            ref={dugme}
            type="button"
            aria-expanded={otvoren}
            aria-controls="igra-podesavanja"
            onClick={() => {
              if (!otvoren) naOtvaranje?.();
              setOtvoren((x) => !x);
            }}
            className={`flex h-10 shrink-0 items-center gap-2 rounded-md border px-3 font-display text-[0.6875rem] font-semibold tracking-[0.08em] uppercase transition-colors duration-200 ${
              otvoren
                ? "border-accent-2 bg-accent-soft text-text"
                : "border-glass-line text-text-muted hover:border-glass-line-strong hover:text-text"
            }`}
          >
            <Settings2 aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />
            <span>{t.igraPodesavanja}</span>
            <ChevronDown
              aria-hidden="true"
              strokeWidth={1.5}
              className={`h-3.5 w-3.5 transition-transform duration-200 ${otvoren ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        {children}
        {otvoren && (
          <>
            {/* Dodir van menija ga zatvara (i ne stiže do platna). */}
            <button type="button" aria-label={t.igraZatvoriPodesavanja} onClick={zatvori} className="absolute inset-0 z-20 cursor-default bg-bg/40" />
            <div
              id="igra-podesavanja"
              ref={meni}
              role="region"
              aria-label={t.igraPodesavanja}
              className="absolute inset-x-0 top-0 z-30 max-h-full overflow-y-auto border-b border-glass-line bg-surface p-4 shadow-soft motion-safe:animate-[pojava_200ms_var(--ease-izlaz)] sm:left-auto sm:w-[26rem] sm:rounded-bl-xl sm:border-l"
            >
              <div className="space-y-3 text-sm">
                {typeof podesavanja === "function" ? podesavanja(zatvori) : podesavanja}
                <div className="flex items-center justify-between gap-3 border-t border-glass-line pt-3">
                  <span className="font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-label)] text-text-muted uppercase">
                    {t.langLabel}
                  </span>
                  <LangSwitch />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {kontrole && (
        <div className="shrink-0 border-t border-glass-line bg-surface px-2 pt-1" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
          {/* Na širokom ekranu kontrole ostaju veličine kao na telefonu (volan
              preko cijele širine monitora se ne drži palcem). */}
          <div className="mx-auto w-full max-w-2xl">{kontrole}</div>
        </div>
      )}
    </div>
  );
}
