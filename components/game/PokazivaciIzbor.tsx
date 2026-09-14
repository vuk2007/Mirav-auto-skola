"use client";

import type { PokazivaciRezim } from "@/lib/game/sim/types";
import type { Dict } from "@/lib/i18n";

interface PokazivaciIzborProps {
  vrijednost: PokazivaciRezim;
  promijeni: (rezim: PokazivaciRezim) => void;
  t: Dict;
}

/**
 * Ko pali pokazivač: simulacija ili vozač.
 *
 * Dva ravnopravna izbora, a ne prekidač: svaki nosi svoju posljedicu — sudi se
 * ili se ne sudi — pa se ta posljedica ispisuje odmah ispod, za onaj koji je
 * izabran.
 */
export default function PokazivaciIzbor({ vrijednost, promijeni, t }: PokazivaciIzborProps) {
  const opcije: { rezim: PokazivaciRezim; naziv: string }[] = [
    { rezim: "auto", naziv: t.gameIndicatorAuto },
    { rezim: "rucni", naziv: t.gameIndicatorManual },
  ];

  return (
    <fieldset className="mt-4">
      <legend className="font-display text-sm font-bold tracking-wide uppercase">
        {t.gameIndicatorMode}
      </legend>
      <div className="mt-2 grid grid-cols-2 overflow-hidden rounded border border-line">
        {opcije.map((o) => (
          <label
            key={o.rezim}
            className={`font-display cursor-pointer px-3 py-2 text-center text-sm font-bold tracking-wide uppercase transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-4 has-[:focus-visible]:outline-blue ${
              vrijednost === o.rezim ? "bg-blue text-white" : "bg-bg text-muted hover:text-blue"
            }`}
          >
            <input
              type="radio"
              name="pokazivaci"
              value={o.rezim}
              checked={vrijednost === o.rezim}
              onChange={() => promijeni(o.rezim)}
              className="sr-only"
            />
            {o.naziv}
          </label>
        ))}
      </div>
      <p className="mt-1.5 text-sm text-muted">
        {vrijednost === "auto" ? t.gameIndicatorAutoHint : t.gameIndicatorManualHint}
      </p>
    </fieldset>
  );
}
