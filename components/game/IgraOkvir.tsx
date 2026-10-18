"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useApp } from "@/components/AppProvider";
import { LANGS, LANG_LABELS } from "@/lib/i18n";

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
  const { lang, setLang, t } = useApp();
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
    <div className="fixed inset-0 z-40 flex h-[100dvh] flex-col overscroll-none bg-paper" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="relative z-20 flex h-11 shrink-0 items-center gap-2 border-b border-line bg-panel px-2">
        <button
          type="button"
          onClick={izlaz.onClick}
          className="flex h-9 shrink-0 items-center gap-1 rounded px-2 text-sm font-semibold text-blue hover:bg-blue-soft"
        >
          <span aria-hidden>←</span>
          <span className="max-w-[9rem] truncate">{izlaz.label}</span>
        </button>
        <div className="min-w-0 flex-1 truncate text-center text-sm font-bold">{naslov}</div>
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
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded border px-2.5 text-sm font-semibold ${
              otvoren ? "border-blue bg-blue text-white" : "border-line bg-panel text-ink"
            }`}
          >
            <span aria-hidden className="text-base leading-none">
              ⚙
            </span>
            <span>{t.igraPodesavanja}</span>
            <span aria-hidden className={`text-xs transition-transform ${otvoren ? "rotate-180" : ""}`}>
              ▾
            </span>
          </button>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        {children}
        {otvoren && (
          <>
            {/* Dodir van menija ga zatvara (i ne stiže do platna). */}
            <button type="button" aria-label={t.igraZatvoriPodesavanja} onClick={zatvori} className="absolute inset-0 z-20 cursor-default bg-ink/20" />
            <div
              id="igra-podesavanja"
              ref={meni}
              role="region"
              aria-label={t.igraPodesavanja}
              className="absolute inset-x-0 top-0 z-30 max-h-full overflow-y-auto border-b border-line bg-paper p-3 shadow-lg sm:left-auto sm:w-[26rem] sm:border-l"
            >
              <div className="space-y-3 text-sm">
                {typeof podesavanja === "function" ? podesavanja(zatvori) : podesavanja}
                <div className="flex items-center gap-2">
                  <span className="text-muted">{t.langLabel}:</span>
                  <div className="flex overflow-hidden rounded border border-line" role="group" aria-label={t.langLabel}>
                    {LANGS.map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setLang(l)}
                        aria-pressed={lang === l}
                        className={`font-display px-2.5 py-1 text-sm font-bold uppercase ${lang === l ? "bg-blue text-white" : "bg-panel text-muted"}`}
                      >
                        {LANG_LABELS[l]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {kontrole && (
        <div className="shrink-0 border-t border-line bg-paper px-2 pt-1" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
          {/* Na širokom ekranu kontrole ostaju veličine kao na telefonu (volan
              preko cijele širine monitora se ne drži palcem). */}
          <div className="mx-auto w-full max-w-2xl">{kontrole}</div>
        </div>
      )}
    </div>
  );
}
