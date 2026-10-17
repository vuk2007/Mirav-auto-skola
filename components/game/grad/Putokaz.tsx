"use client";

import type { ManevarRute } from "@/lib/game/grad/navigacija";
import type { Dict } from "@/lib/i18n";

/**
 * Putokaz navigacije (faza 6, stavka 9): sljedeći manevar na ruti — strelica,
 * koliko je do njega i na koju ulicu — i koliko je još do cilja. Plava tabla
 * kao putokaz na putu.
 */

/** Rastojanje za prikaz: do 1 km na 10 m, dalje u km sa jednom decimalom. */
export function rastojanje(m: number): string {
  return m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`;
}

function Strelica({ m }: { m: ManevarRute | null }) {
  const vrsta = !m ? "pravo" : m.izlaz ? "kruzni" : m.manevar;
  const putanja: Record<string, string> = {
    pravo: "M24 40 V10 M14 20 L24 10 L34 20",
    lijevo: "M30 42 V24 Q30 16 22 16 H10 M18 8 L10 16 L18 24",
    desno: "M18 42 V24 Q18 16 26 16 H38 M30 8 L38 16 L30 24",
    polukruzno: "M30 42 V20 Q30 10 21 10 Q12 10 12 20 V30 M6 24 L12 31 L18 24",
    kruzni: "M24 42 V32 M24 10 V4 M18 10 L24 4 L30 10",
  };
  return (
    <svg viewBox="0 0 48 48" width={40} height={40} aria-hidden className="shrink-0">
      {vrsta === "kruzni" && <circle cx={24} cy={21} r={10} fill="none" stroke="#fff" strokeWidth={4} />}
      <path d={putanja[vrsta]} fill="none" stroke="#fff" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Putokaz({
  manevar,
  za,
  doCilja,
  cilj,
  t,
}: {
  manevar: ManevarRute | null;
  za: number;
  doCilja: number;
  cilj: string;
  t: Dict;
}) {
  const naziv = !manevar
    ? t.gradNavStraight
    : manevar.izlaz
      ? t.gradNavRoundabout.replace("{n}", String(manevar.izlaz))
      : manevar.manevar === "lijevo"
        ? t.gradNavTurnLeft
        : manevar.manevar === "desno"
          ? t.gradNavTurnRight
          : manevar.manevar === "polukruzno"
            ? t.gradNavUTurn
            : t.gradNavStraight;
  return (
    <div role="status" aria-live="polite" className="flex max-w-[17rem] items-center gap-2 rounded border-2 border-white bg-[#1d4f9c] px-2 py-1 text-white shadow">
      <Strelica m={manevar} />
      <div className="min-w-0 text-xs leading-tight">
        <p className="font-display text-sm font-bold">
          {manevar ? `${t.gradNavIn.replace("{d}", rastojanje(za))} · ` : ""}
          {naziv}
        </p>
        {manevar?.ulica && <p className="truncate">{t.gradNavOnto.replace("{ulica}", manevar.ulica)}</p>}
        <p className="truncate opacity-80">
          {cilj} · {t.gradNavRemaining.replace("{d}", rastojanje(doCilja))}
        </p>
      </div>
    </div>
  );
}
