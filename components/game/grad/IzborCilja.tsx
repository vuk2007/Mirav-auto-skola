"use client";

import { useMemo, useState } from "react";
import { KATEGORIJE_ODREDISTA, type KategorijaOdredista, type Odrediste } from "@/lib/game/grad/odredista";
import type { Dict } from "@/lib/i18n";

/**
 * Izbor cilja vožnje (faza 6, stavka 9): odredišta grada po kategorijama, sa
 * pretragom po imenu i nasumičnim izborom.
 */

export const NAZIV_KATEGORIJE: Readonly<Record<KategorijaOdredista, keyof Dict>> = {
  skola: "gradKatSkola",
  zdravlje: "gradKatZdravlje",
  ustanova: "gradKatUstanova",
  kultura: "gradKatKultura",
  bogomolja: "gradKatBogomolja",
  stanica: "gradKatStanica",
  sport: "gradKatSport",
  trgovina: "gradKatTrgovina",
  znamenitost: "gradKatZnamenitost",
};

/** Bez dijakritika i velikih slova — „skola" nalazi „Škola". */
const normalizuj = (s: string) =>
  s
    .toLocaleLowerCase("sr")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "dj");

export default function IzborCilja({
  odredista,
  izaberi,
  nasumicno,
  zatvori,
  t,
}: {
  odredista: readonly Odrediste[];
  izaberi: (o: Odrediste) => void;
  nasumicno: () => void;
  zatvori: () => void;
  t: Dict;
}) {
  const [upit, setUpit] = useState("");
  const grupe = useMemo(() => {
    const q = normalizuj(upit.trim());
    const nadjena = q ? odredista.filter((o) => normalizuj(o.ime).includes(q)) : odredista;
    return KATEGORIJE_ODREDISTA.map((k) => [k, nadjena.filter((o) => o.kategorija === k)] as const).filter(([, l]) => l.length > 0);
  }, [odredista, upit]);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="izbor-cilja-naslov" className="absolute inset-0 z-10 flex flex-col bg-paper/95 p-3">
      <div className="flex items-center gap-2">
        <h2 id="izbor-cilja-naslov" className="font-display text-lg font-bold">
          {t.gradNavChoose}
        </h2>
        <button type="button" onClick={nasumicno} className="ml-auto rounded border border-blue bg-blue px-2 py-1 text-sm font-semibold text-white">
          {t.gradNavRandom}
        </button>
        <button type="button" onClick={zatvori} className="rounded border border-line bg-panel px-2 py-1 text-sm font-semibold">
          {t.gradNavClose}
        </button>
      </div>
      <input
        type="search"
        value={upit}
        onChange={(e) => setUpit(e.target.value)}
        placeholder={t.gradNavSearch}
        aria-label={t.gradNavSearch}
        className="mt-2 rounded border border-line bg-panel px-2 py-1 text-sm"
      />
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
        {grupe.map(([k, lista]) => (
          <section key={k} className="mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{t[NAZIV_KATEGORIJE[k]] as string}</h3>
            <ul className="mt-1 space-y-1">
              {lista.map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => izaberi(o)} className="w-full rounded border border-line bg-panel px-2 py-1 text-left text-sm hover:border-blue">
                    {o.ime}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
