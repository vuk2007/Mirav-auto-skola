"use client";

import { phasesFor } from "@/lib/game/sim/indicatorRules";
import type { IndicatorEvent, Intent, Path } from "@/lib/game/sim/types";
import type { Dict } from "@/lib/i18n";

interface IndicatorTimelineProps {
  path: Path;
  intent: Intent;
  log: readonly IndicatorEvent[];
  /** Dokle je igrač stvarno stigao — dalje od toga se ništa ne ocjenjuje. */
  maxS: number;
  rules?: Parameters<typeof phasesFor>[2];
  t: Dict;
}

const UZORAKA = 180;

const BOJA: Record<string, string> = {
  left: "var(--color-accent-2)",
  right: "var(--color-ok)",
  off: "var(--color-glass-line-strong)",
};

/** Stanje pokazivača na mjestu `s` — posljednja promjena prije tog mjesta. */
function stanjeNa(log: readonly IndicatorEvent[], s: number): "left" | "right" | null {
  let cur: "left" | "right" | null = null;
  for (const e of log) if (e.s <= s) cur = e.indicator;
  return cur;
}

/**
 * Traka pokazivača duž putanje: gore ono što se tražilo, dolje ono što je
 * igrač radio, a između crveni biljezi tamo gdje se razlikuju.
 *
 * Osa je pređeni put, ne vrijeme. Pravila su vezana za mjesto na putanji, pa bi
 * vremenska osa razvukla čekanje na semaforu preko pola trake i sakrila ono što
 * se stvarno desilo na dvadeset metara pred raskrsnicom.
 */
export default function IndicatorTimeline({
  path,
  intent,
  log,
  maxS,
  rules,
  t,
}: IndicatorTimelineProps) {
  const faze = phasesFor(path, intent, rules);
  if (faze.length === 0) return null;

  // Prikazuje se samo dio putanje na kojem pravila uopšte nešto traže, plus
  // malo prostora oko — cijela putanja je preko sto metara, a sve zanimljivo se
  // dešava na tridesetak.
  const od = Math.max(0, Math.min(...faze.map((f) => f.from)) - 5);
  const doK = Math.min(path.length, Math.max(...faze.map((f) => f.to)) + 5);
  const raspon = doK - od;
  if (raspon <= 0) return null;

  const x = (s: number) => ((s - od) / raspon) * 100;

  const uzorci = Array.from({ length: UZORAKA }, (_, i) => {
    const s = od + (raspon * (i + 0.5)) / UZORAKA;
    const trazeno = faze.find((f) => s >= f.from && s < f.to)?.expected ?? null;
    const stvarno = stanjeNa(log, s);
    return { s, trazeno, stvarno, vozeno: s <= maxS };
  });

  const traka = (koje: "trazeno" | "stvarno", label: string) => (
    <div>
      <div className="mb-0.5 text-[10px] font-semibold tracking-[var(--tracking-caps)] text-text-muted uppercase">
        {label}
      </div>
      <div className="flex h-4 w-full overflow-hidden rounded-md border border-glass-line">
        {uzorci.map((u, i) => {
          const v = u[koje];
          return (
            <span
              key={i}
              className="h-full flex-1"
              style={{
                backgroundColor: BOJA[v ?? "off"],
                opacity: u.vozeno ? 1 : 0.25,
              }}
            />
          );
        })}
      </div>
    </div>
  );

  const razlike = uzorci.filter((u) => u.vozeno && u.trazeno !== u.stvarno);

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold tracking-[var(--tracking-caps)] text-text-muted uppercase">
        {t.gameTimelineTitle}
      </p>

      <div className="relative mt-1 space-y-1.5">
        {traka("trazeno", t.gameTimelineExpected)}
        {traka("stvarno", t.gameTimelineActual)}

        {/* Crveni biljezi tamo gdje se traka razlikuje. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-full">
          {razlike.map((u, i) => (
            <span
              key={i}
              className="absolute top-0 h-full w-[2px] bg-err opacity-70"
              style={{ left: `${x(u.s)}%` }}
            />
          ))}
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-muted">
        <Legenda boja={BOJA.left!} tekst={t.gameIndicatorLeft} />
        <Legenda boja={BOJA.right!} tekst={t.gameIndicatorRight} />
        <Legenda boja={BOJA.off!} tekst={t.gameTimelineOff} />
      </div>
    </div>
  );
}

function Legenda({ boja, tekst }: { boja: string; tekst: string }) {
  return (
    <span className="flex items-center gap-1">
      <span
        aria-hidden="true"
        className="inline-block h-2.5 w-2.5 rounded-sm border border-glass-line"
        style={{ backgroundColor: boja }}
      />
      {tekst}
    </span>
  );
}
