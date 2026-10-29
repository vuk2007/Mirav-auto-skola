"use client";

import type { Level } from "@/lib/game/sim/config";
import type { Dict } from "@/lib/i18n";

interface SaobracajIzborProps {
  vrijednost: Level;
  promijeni: (nivo: Level) => void;
  t: Dict;
}

const NIVOI: readonly Level[] = [1, 2, 3, 4, 5];

/**
 * Koliko je saobraćaja na putu: pet nivoa, od rijetkog do gustog.
 *
 * Isti oblik kao izbor pokazivača — ravnopravna dugmad, a ispod njih šta izbor
 * znači. Broj je dovoljan natpis, jer odmah ispod piše da je jedan rijedak, a pet
 * gust saobraćaj.
 */
export default function SaobracajIzbor({ vrijednost, promijeni, t }: SaobracajIzborProps) {
  return (
    <fieldset className="mt-4">
      <legend className="font-display text-sm font-bold tracking-[var(--tracking-caps)] uppercase">
        {t.gameTrafficLevel}
      </legend>
      <div className="mt-2 grid grid-cols-5 overflow-hidden rounded-md border border-glass-line">
        {NIVOI.map((nivo) => (
          <label
            key={nivo}
            className={`font-display cursor-pointer px-3 py-2 text-center text-sm font-bold tracking-[var(--tracking-caps)] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-4 has-[:focus-visible]:outline-accent-2 ${
              vrijednost === nivo ? "bg-accent text-white" : "bg-bg text-text-muted hover:text-accent-2"
            }`}
          >
            <input
              type="radio"
              name="saobracaj"
              value={nivo}
              checked={vrijednost === nivo}
              onChange={() => promijeni(nivo)}
              className="sr-only"
            />
            {nivo}
          </label>
        ))}
      </div>
      <p className="mt-1.5 text-sm text-text-muted">{t.gameTrafficHint}</p>
    </fieldset>
  );
}
