"use client";

import { Check, ChevronRight, RotateCcw } from "lucide-react";
import type { Scenario } from "@/lib/game/sim/types";
import type { Dict, Lang } from "@/lib/i18n";
import type { GameProgressMap } from "@/lib/storage";
import ProgressBar from "../ui/ProgressBar";
import GlassPanel from "../ui/GlassPanel";
import SectionLabel from "../ui/SectionLabel";

interface ScenarioPickerProps {
  scenarios: readonly Scenario[];
  progress: GameProgressMap;
  t: Dict;
  lang: Lang;
  onPick: (id: string) => void;
}

/** Tačke po težini — brojka „2/5" bi ovdje samo tražila objašnjenje. */
const NIVOA = 5;

function Difficulty({ level, label }: { level: number; label: string }) {
  return (
    <span className="flex items-center gap-1" title={`${label}: ${level}/${NIVOA}`}>
      <span className="sr-only">{`${label}: ${level}/${NIVOA}`}</span>
      {Array.from({ length: NIVOA }, (_, k) => k + 1).map((i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`inline-block h-1.5 w-1.5 rounded-full ${i <= level ? "bg-accent-2" : "bg-glass-line-strong"}`}
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
    <div className="space-y-6">
      <div>
        <SectionLabel className="mb-4">{t.gameMeta}</SectionLabel>
        <h1 className="font-display text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">{t.gameTitle}</h1>
        <p className="mt-3 max-w-xl text-text-muted">{t.gamePickLead}</p>
      </div>

      <ProgressBar
        current={done}
        total={scenarios.length}
        label={t.gameProgress.replace("{n}", String(done)).replace("{max}", String(scenarios.length))}
        ariaLabel={t.progress}
      />

      {/* Jedna lista sa razdjelnicima, ne 25 kartica. */}
      <GlassPanel padding="none">
        <ul className="divide-y divide-glass-line">
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
                  className="group flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors duration-150 first:rounded-t-xl hover:bg-glass-strong sm:px-5"
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                      p?.passed
                        ? "border-ok-line bg-ok-soft text-ok"
                        : p
                          ? "border-err-line bg-err-soft text-err"
                          : "border-glass-line-strong text-text-muted"
                    }`}
                  >
                    {p?.passed ? (
                      <Check strokeWidth={2} className="h-4 w-4" />
                    ) : p ? (
                      <RotateCcw strokeWidth={1.75} className="h-3.5 w-3.5" />
                    ) : (
                      <span className="h-1 w-1 rounded-full bg-text-muted" />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[0.9375rem] leading-snug font-semibold">
                      {s.title[lang] ?? s.title.me}
                    </span>
                    <span className="mt-0.5 block text-xs text-text-muted">
                      {status}
                      {p?.bestTime != null && ` · ${t.gameBestTime} ${p.bestTime.toFixed(1)} s`}
                      {p && ` · ${p.attempts} ${t.gameAttempts}`}
                    </span>
                  </span>

                  <Difficulty level={s.difficulty} label={t.gameDifficulty} />
                  <ChevronRight
                    aria-hidden="true"
                    strokeWidth={1.5}
                    className="hidden h-4 w-4 flex-none text-text-muted transition-transform duration-200 group-hover:translate-x-0.5 sm:block"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </GlassPanel>
    </div>
  );
}
