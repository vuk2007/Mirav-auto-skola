"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { SCENARIOS, scenarioById } from "@/lib/game/scenarios";
import { LANG_LABELS, LANGS } from "@/lib/i18n";
import { loadGameProgress, saveGameAttempt, type GameProgressMap } from "@/lib/storage";
import GameScreen from "./GameScreen";
import ScenarioPicker from "./ScenarioPicker";
import ShiftScreen from "./ShiftScreen";

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
  const [shift, setShift] = useState(false);

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

      {shift ? (
        <ShiftScreen onExit={() => setShift(false)} />
      ) : active ? (
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
        <>
          <ScenarioPicker
            scenarios={SCENARIOS}
            progress={progress}
            t={t}
            lang={lang}
            onPick={setActiveId}
          />

          {/* Smjena stoji ispod spiska: prvo se uče situacije, pa se onda vozi
              bez kraja. */}
          <section className="panel flex flex-col gap-3 border-t-4 border-t-red p-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <h2 className="text-lg font-bold">{t.shiftTitle}</h2>
              <p className="mt-1 text-sm text-muted">{t.shiftDesc}</p>
            </div>
            <button
              type="button"
              onClick={() => setShift(true)}
              className="font-display rounded border-2 border-red px-5 py-2.5 text-base font-bold tracking-wide text-red uppercase transition-colors hover:bg-red hover:text-white"
            >
              {t.shiftStart}
            </button>
          </section>
        </>
      )}
    </div>
  );
}
