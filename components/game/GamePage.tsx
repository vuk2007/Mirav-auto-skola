"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { SCENARIOS, scenarioById } from "@/lib/game/scenarios";
import { LANG_LABELS, LANGS } from "@/lib/i18n";
import { loadGameProgress, saveGameAttempt, type GameProgressMap } from "@/lib/storage";
import GameScreen from "./GameScreen";
import ScenarioPicker from "./ScenarioPicker";

/**
 * Igra „Prođi raskrsnicu" — spisak situacija i jedna situacija u toku.
 *
 * Napredak se čita tek na klijentu (`localStorage` na serveru ne postoji), pa
 * spisak prvi put nacrta sva stanja kao „nije pokušano" i odmah ih zamijeni.
 * Alternativa bi bila da se spisak ne crta dok se ne učita — to bi značilo
 * prazan ekran na svakom otvaranju, zbog podatka koji je čista dekoracija.
 */
export default function GamePage({ showLanguage = true }: { showLanguage?: boolean }) {
  const { lang, setLang, t } = useApp();
  const [progress, setProgress] = useState<GameProgressMap>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setProgress(loadGameProgress());
  }, []);

  const record = useCallback((id: string, passed: boolean, time: number) => {
    setProgress(saveGameAttempt(id, passed, time));
  }, []);

  const active = activeId ? scenarioById(activeId) : undefined;
  const index = active ? SCENARIOS.findIndex((s) => s.id === active.id) : -1;
  const next = index >= 0 ? SCENARIOS[index + 1] : undefined;

  const onResult = useCallback(
    (passed: boolean, time: number) => {
      if (activeId) record(activeId, passed, time);
    },
    [activeId, record],
  );

  return (
    <div className="space-y-4">
      {/* Unutar kviza prebacivač jezika već stoji u gornjoj traci, pa se ovdje
          izostavlja — dva ista prebacivača jedan iznad drugog samo zbunjuju. */}
      {showLanguage && (
        <div className="flex justify-end">
          <div
            className="flex overflow-hidden rounded border border-line"
            role="group"
            aria-label={t.langLabel}
          >
            {LANGS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={`font-display px-2.5 py-1 text-sm font-bold uppercase transition-colors ${
                  lang === l ? "bg-blue text-white" : "bg-panel text-muted hover:text-blue"
                }`}
              >
                {LANG_LABELS[l]}
              </button>
            ))}
          </div>
        </div>
      )}

      {active ? (
        <GameScreen
          // Bez ključa bi prelazak na sljedeću situaciju zadržao stanje
          // prethodne (fazu, sjeme, snimak) — scenario je nova partija.
          key={active.id}
          scenario={active}
          onBack={() => setActiveId(null)}
          onNext={next ? () => setActiveId(next.id) : null}
          onResult={onResult}
        />
      ) : (
        <ScenarioPicker
          scenarios={SCENARIOS}
          progress={progress}
          t={t}
          lang={lang}
          onPick={setActiveId}
        />
      )}
    </div>
  );
}
