"use client";

import type { Scenario } from "@/lib/game/sim/types";
import type { Dict, Lang } from "@/lib/i18n";
import type { GameProgressMap } from "@/lib/storage";

interface ScenarioPickerProps {
  scenarios: readonly Scenario[];
  progress: GameProgressMap;
  t: Dict;
  lang: Lang;
  onPick: (id: string) => void;
}

/** Tri tačke po težini — brojka „2/3" bi ovdje samo tražila objašnjenje. */
function Difficulty({ level, label }: { level: number; label: string }) {
  return (
    <span className="flex items-center gap-1" title={`${label}: ${level}/3`}>
      <span className="sr-only">{`${label}: ${level}/3`}</span>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`inline-block h-2 w-2 rounded-full ${i <= level ? "bg-blue" : "bg-line"}`}
        />
      ))}
    </span>
  );
}

/**
 * Spisak situacija sa težinom i stanjem.
 *
 * Redoslijed je redoslijed učenja i ne mijenja se po uspjehu — polaznik treba
 * da zna gdje je stao. Ništa nije zaključano: vježba nije nivo u igri, pa
 * zabraniti teži scenario dok se lakši ne pređe znači samo natjerati nekoga da
 * ponavlja ono što već zna.
 */
export default function ScenarioPicker({
  scenarios,
  progress,
  t,
  lang,
  onPick,
}: ScenarioPickerProps) {
  const done = scenarios.filter((s) => progress[s.id]?.passed).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">{t.gameTitle}</h1>
        <p className="mt-1 text-sm text-muted">{t.gamePickLead}</p>
      </div>

      <p className="font-display text-sm font-semibold tracking-wide uppercase">
        {t.gameProgress.replace("{n}", String(done)).replace("{max}", String(scenarios.length))}
      </p>

      <ul className="space-y-2">
        {scenarios.map((s) => {
          const p = progress[s.id];
          const status = p?.passed
            ? t.gameStatusPassed
            : p
              ? t.gameStatusFailed
              : t.gameStatusNew;

          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onPick(s.id)}
                className="flex w-full items-center gap-3 rounded border-2 border-line bg-panel px-3 py-3 text-left transition-colors hover:border-blue"
              >
                <span
                  aria-hidden="true"
                  className={`font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    p?.passed
                      ? "bg-green text-white"
                      : p
                        ? "bg-red-soft text-red"
                        : "bg-line text-muted"
                  }`}
                >
                  {p?.passed ? "✓" : p ? "!" : "·"}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{s.title[lang] ?? s.title.me}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {status}
                    {p?.bestTime != null && ` · ${t.gameBestTime} ${p.bestTime.toFixed(1)} s`}
                    {p && ` · ${p.attempts} ${t.gameAttempts}`}
                  </span>
                </span>

                <Difficulty level={s.difficulty} label={t.gameDifficulty} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
