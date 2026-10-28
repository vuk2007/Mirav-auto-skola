"use client";

import { SPEEDING_FACTOR } from "@/lib/game/sim/config";
import type { Dict } from "@/lib/i18n";

interface BrzinomjerProps {
  /** Brzina [km/h]. */
  brzina: number;
  /** Ograničenje na mjestu na kojem se vozi [km/h]; bez njega nema trake. */
  ogranicenje: number | null;
  t: Dict;
}

/**
 * Brzina, i ispod nje tanka traka „limit".
 *
 * Popunjenost je brzina, a crtica na traci je ograničenje — koliko je prostora
 * do njega vidi se bez čitanja broja. Traka ide do trećine iznad ograničenja,
 * pa crtica stoji uvijek na istom mjestu, na tri četvrtine: pogled je nalazi
 * bez traženja. Boja se mijenja tek blizu prekršaja: do ograničenja je mirna,
 * iznad njega upozorava, a preko granice na kojoj se sudi (`SPEEDING_FACTOR`)
 * je crvena.
 */
export default function Brzinomjer({ brzina, ogranicenje, t }: BrzinomjerProps) {
  const kmh = Math.round(brzina);
  const opseg = ogranicenje ? ogranicenje * (4 / 3) : 1;
  const udio = ogranicenje ? Math.min(1, brzina / opseg) : 0;
  const boja =
    !ogranicenje || brzina <= ogranicenje
      ? "bg-accent"
      : brzina <= ogranicenje * SPEEDING_FACTOR
        ? "bg-signal-yellow"
        : "bg-err";
  return (
    <div
      className="rounded-md border border-glass-line bg-surface/85 backdrop-blur-md px-2 py-1 text-center"
      role="group"
      aria-label={
        ogranicenje ? `${t.gameSpeed} ${kmh} km/h, ${t.gameSpeedLimit} ${Math.round(ogranicenje)} km/h` : undefined
      }
    >
      <div className="font-display text-[0.625rem] font-semibold tracking-[var(--tracking-caps)] text-text-muted uppercase">{t.gameSpeed}</div>
      <div className="tabular font-display text-lg leading-none font-bold">{kmh} km/h</div>
      {ogranicenje !== null && (
        <div className="relative mt-1 h-1.5 w-full min-w-[4.5rem] overflow-hidden rounded-full bg-glass-line-strong" aria-hidden>
          <div className={`h-full ${boja}`} style={{ width: `${udio * 100}%` }} />
          <div className="absolute top-0 h-full w-0.5 bg-text" style={{ left: "75%" }} />
        </div>
      )}
    </div>
  );
}
