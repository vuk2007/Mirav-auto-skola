"use client";

import { GRAD_ISPIT_LAKSIH } from "@/lib/game/sim/config";
import type { StavkaIspita, ZapisnikIspita } from "@/lib/game/grad/ispit";
import type { Zadatak } from "@/lib/game/grad/overlay";
import { naslovPrekrsaja } from "@/lib/game/ui/gradPrekrsaji";
import type { Dict } from "@/lib/i18n";
import { minSek } from "./OdDo";

/**
 * Ispitna ruta (faza 6, stavka 9c): izbor rute iz editora i zapisnik ispita
 * po stavkama na cilju.
 */

export const NAZIV_STAVKE: Readonly<Record<StavkaIspita, keyof Dict>> = {
  raskrsnice: "gradExamCatJunctions",
  brzina: "gradExamCatSpeed",
  znakovi: "gradExamCatSigns",
  pjesaci: "gradExamCatPedestrians",
  polozaj: "gradExamCatLane",
  manevri: "gradExamCatManoeuvres",
};

export function IzborIspita({
  rute,
  duzine,
  izaberi,
  zatvori,
  t,
}: {
  rute: readonly Zadatak[];
  /** Dužina rute [m] po id-u zadatka; nema je — ruta se ne može voziti. */
  duzine: Readonly<Record<string, number | null>>;
  izaberi: (z: Zadatak) => void;
  zatvori: () => void;
  t: Dict;
}) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="ispit-naslov" className="absolute inset-0 z-10 flex items-center justify-center bg-bg/40 p-4">
      <div className="w-full max-w-sm rounded-md border border-glass-line bg-bg p-4 shadow-soft">
        <h2 id="ispit-naslov" className="font-display text-lg font-bold">
          {t.gradExam}
        </h2>
        <p className="mt-1 text-sm text-text-muted">{t.gradExamIntro.replace("{n}", String(GRAD_ISPIT_LAKSIH))}</p>
        <ul className="mt-3 space-y-1">
          {rute.map((z) => {
            const d = duzine[z.id] ?? null;
            return (
              <li key={z.id}>
                <button
                  type="button"
                  disabled={d === null}
                  onClick={() => izaberi(z)}
                  className="flex w-full items-baseline justify-between rounded-md border border-glass-line bg-surface px-3 py-2 text-left text-sm hover:border-accent-2 disabled:opacity-40"
                >
                  <span className="font-semibold">{z.ime}</span>
                  <span className="text-text-muted">
                    {d === null ? t.gradNavNoRoute : t.gradExamRouteInfo.replace("{km}", (d / 1000).toFixed(1)).replace("{n}", String(z.tacke.length))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={zatvori} className="rounded-md border border-glass-line bg-surface px-3 py-1 text-sm font-semibold">
            {t.gradNavClose}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface RezultatIspita {
  ime: string;
  zapisnik: ZapisnikIspita;
  sekundi: number;
  metara: number;
}

export function ZapisnikIspitaKartica({ r, ponovo, zatvori, t }: { r: RezultatIspita; ponovo: () => void; zatvori: () => void; t: Dict }) {
  const z = r.zapisnik;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/40 p-4">
      <div
        role="alertdialog"
        aria-labelledby="ispit-rezultat"
        className={`max-h-full w-full max-w-md overflow-y-auto rounded-md border bg-bg p-4 shadow-soft ${z.polozio ? "border-ok-line" : "border-err-line"}`}
      >
        <p className="text-xs font-semibold uppercase tracking-[var(--tracking-caps)] text-text-muted">
          {t.gradExam} · {r.ime}
        </p>
        <p id="ispit-rezultat" className={`mt-1 font-display text-2xl font-bold ${z.polozio ? "text-ok" : "text-err"}`}>
          {z.polozio ? t.gradExamPassed : t.gradExamFailed}
        </p>
        <p className="mt-1 text-sm text-text-muted">
          {t.gradExamSummary
            .replace("{minor}", String(z.laksih))
            .replace("{fail}", String(z.teskih))
            .replace("{vrijeme}", minSek(r.sekundi))
            .replace("{km}", (r.metara / 1000).toFixed(1))}
        </p>
        <p className="mt-1 text-xs text-text-muted">{t.gradExamRule.replace("{n}", String(GRAD_ISPIT_LAKSIH))}</p>
        <table className="mt-3 w-full text-sm">
          <caption className="sr-only">{t.gradExamRecord}</caption>
          <thead>
            <tr className="text-left text-xs text-text-muted">
              <th className="py-1 font-semibold">{t.gradExamRecord}</th>
              <th className="py-1 text-right font-semibold">{t.gradExamMinor}</th>
              <th className="py-1 text-right font-semibold">{t.gradExamSerious}</th>
            </tr>
          </thead>
          <tbody>
            {z.stavke.map((s) => (
              <tr key={s.stavka} className="border-t border-glass-line align-top">
                <td className="py-1">
                  <span className="font-semibold">{t[NAZIV_STAVKE[s.stavka]] as string}</span>
                  {s.prekrsaji.length > 0 && (
                    <ul className="mt-0.5 text-xs text-text-muted">
                      {s.prekrsaji.map((p, i) => (
                        <li key={i}>
                          {minSek(p.t)} · {naslovPrekrsaja(p, t)}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="py-1 text-right tabular-nums">{s.laksih || "–"}</td>
                <td className={`py-1 text-right tabular-nums ${s.teskih > 0 ? "font-bold text-err" : ""}`}>{s.teskih || "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex justify-center gap-2">
          <button type="button" onClick={ponovo} className="rounded-md border border-accent-2 bg-accent px-4 py-2 font-semibold text-white">
            {t.gradExamAgain}
          </button>
          <button type="button" onClick={zatvori} className="rounded-md border border-glass-line bg-surface px-4 py-2 font-semibold">
            {t.gradNavClose}
          </button>
        </div>
      </div>
    </div>
  );
}
