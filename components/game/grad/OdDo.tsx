"use client";

import { useState } from "react";
import { GRAD_ODDO_PRAVILA, GRAD_ODDO_VRIJEME } from "@/lib/game/sim/config";
import { TEZINE, tezina, type OcjenaOdDo, type Tezina } from "@/lib/game/grad/odDo";
import type { Dict } from "@/lib/i18n";

/**
 * Vožnja od–do (faza 6, stavka 9): izbor težine i cilja, pa kartica rezultata
 * na cilju — bodovi, zvjezdice, prekršaji i najbolji rezultat.
 */

export const NAZIV_TEZINE: Readonly<Record<Tezina, keyof Dict>> = {
  lako: "gradOdDoEasy",
  srednje: "gradOdDoMedium",
  tesko: "gradOdDoHard",
};

/** Vrijeme kao m:ss. */
export const minSek = (s: number) => {
  const c = Math.max(0, Math.round(s));
  return `${Math.floor(c / 60)}:${String(c % 60).padStart(2, "0")}`;
};

export function OdDoIzbor({
  pocetna,
  nasumicno,
  izaberi,
  zatvori,
  t,
}: {
  pocetna: Tezina;
  nasumicno: (t: Tezina) => void;
  izaberi: (t: Tezina) => void;
  zatvori: () => void;
  t: Dict;
}) {
  const [izabrana, setIzabrana] = useState<Tezina>(pocetna);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="od-do-naslov" className="absolute inset-0 z-10 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-sm rounded border border-line bg-paper p-4 shadow-lg">
        <h2 id="od-do-naslov" className="font-display text-lg font-bold">
          {t.gradOdDo}
        </h2>
        <p className="mt-1 text-sm text-muted">{t.gradOdDoIntro}</p>
        <fieldset className="mt-3 space-y-1">
          <legend className="sr-only">{t.gradOdDo}</legend>
          {TEZINE.map((x) => {
            const p = tezina(x);
            return (
              <button
                key={x}
                type="button"
                aria-pressed={izabrana === x}
                onClick={() => setIzabrana(x)}
                className={`flex w-full items-baseline justify-between rounded border px-3 py-2 text-left text-sm ${
                  izabrana === x ? "border-blue bg-blue text-white" : "border-line bg-panel"
                }`}
              >
                <span className="font-semibold">{t[NAZIV_TEZINE[x]] as string}</span>
                <span className={izabrana === x ? "text-white/85" : "text-muted"}>
                  {t.gradOdDoRange
                    .replace("{od}", String(p.odM / 1000))
                    .replace("{do}", String(p.doM / 1000))
                    .replace("{nivo}", String(p.nivo))}
                </span>
              </button>
            );
          })}
        </fieldset>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => nasumicno(izabrana)} className="rounded border border-blue bg-blue px-3 py-1 text-sm font-semibold text-white">
            {t.gradOdDoRandom}
          </button>
          <button type="button" onClick={() => izaberi(izabrana)} className="rounded border border-blue bg-panel px-3 py-1 text-sm font-semibold text-blue">
            {t.gradOdDoPick}
          </button>
          <button type="button" onClick={zatvori} className="ml-auto rounded border border-line bg-panel px-3 py-1 text-sm font-semibold">
            {t.gradNavClose}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface RezultatOdDo {
  cilj: string;
  tezina: Tezina;
  sekundi: number;
  upozorenja: number;
  padova: number;
  ocjena: OcjenaOdDo;
  /** Najbolji prije ove vožnje (`null` — prva). */
  prije: number | null;
  rekord: boolean;
}

export function OdDoRezultat({ r, ponovo, zatvori, t }: { r: RezultatOdDo; ponovo: () => void; zatvori: () => void; t: Dict }) {
  const o = r.ocjena;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink/40 p-4">
      <div role="alertdialog" aria-labelledby="od-do-rezultat" className="w-full max-w-sm rounded border border-blue bg-paper p-4 text-center shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t.gradOdDo} · {t[NAZIV_TEZINE[r.tezina]] as string}
        </p>
        <p id="od-do-rezultat" className="mt-1 font-display text-lg font-bold">
          {t.gradOdDoDone.replace("{cilj}", r.cilj)}
        </p>
        <p className="mt-2 text-2xl tracking-widest" role="img" aria-label={t.gradOdDoStars.replace("{n}", String(o.zvjezdice))}>
          {[1, 2, 3].map((k) => (
            <span key={k} aria-hidden className={k <= o.zvjezdice ? "text-yellow" : "text-line"}>
              ★
            </span>
          ))}
        </p>
        <p className="mt-1 font-display text-xl font-bold">{t.gradOdDoScore.replace("{bodovi}", String(o.bodovi))}</p>
        <ul className="mt-2 space-y-0.5 text-sm">
          <li>{t.gradOdDoRules.replace("{n}", String(o.pravila)).replace("{max}", String(GRAD_ODDO_PRAVILA))}</li>
          <li className="text-muted">{t.gradOdDoViolations.replace("{minor}", String(r.upozorenja)).replace("{fail}", String(r.padova))}</li>
          <li>
            {t.gradOdDoTime
              .replace("{vrijeme}", minSek(r.sekundi))
              .replace("{ref}", minSek(o.referentno))
              .replace("{n}", String(o.vrijeme))
              .replace("{max}", String(GRAD_ODDO_VRIJEME))}
          </li>
        </ul>
        <p className={`mt-2 text-sm font-semibold ${r.rekord ? "text-blue" : "text-muted"}`}>
          {r.rekord ? t.gradOdDoNewBest : r.prije !== null ? t.gradOdDoBest.replace("{n}", String(r.prije)) : null}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button type="button" onClick={ponovo} className="rounded border border-blue bg-blue px-4 py-2 font-semibold text-white">
            {t.gradOdDoAgain}
          </button>
          <button type="button" onClick={zatvori} className="rounded border border-line bg-panel px-4 py-2 font-semibold">
            {t.gradNavClose}
          </button>
        </div>
      </div>
    </div>
  );
}
