"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LANG_LABELS, LANGS } from "@/lib/i18n";
import { loadQuestions } from "@/lib/questions";
import { buildScenarios, type SimScenario } from "@/lib/simulator";
import { useApp } from "./AppProvider";
import LiteratureModal from "./LiteratureModal";
import SimulatorShell from "./sim/SimulatorShell";

/**
 * Simulator kao samostalna stranica (`/simulator`, `/embed/simulator`).
 *
 * Crtane familije rade bez baze pitanja; questions.json se učitava samo zbog
 * familije „iz kataloga", i to u pozadini — simulator je upotrebljiv odmah.
 */
export default function SimulatorPage() {
  const { lang, setLang, t } = useApp();
  const [photoScenarios, setPhotoScenarios] = useState<SimScenario[]>([]);
  const [literatureOpen, setLiteratureOpen] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const controller = new AbortController();
    loadQuestions(controller.signal)
      .then((qs) => setPhotoScenarios(buildScenarios(qs)))
      .catch(() => {
        // Fotografije nisu dostupne — crtane familije i dalje rade.
      });
    return () => controller.abort();
  }, []);

  const changeLang = useCallback((next: (typeof LANGS)[number]) => setLang(next), [setLang]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-xl font-bold sm:text-2xl">{t.simTitle}</h1>

        <button
          type="button"
          onClick={() => setLiteratureOpen(true)}
          className="ml-auto text-sm font-semibold text-blue underline-offset-4 hover:underline"
        >
          {t.literature}
        </button>

        <div
          className="flex overflow-hidden rounded border border-line"
          role="group"
          aria-label={t.langLabel}
        >
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => changeLang(l)}
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

      <SimulatorShell photoScenarios={photoScenarios} t={t} lang={lang} />

      <LiteratureModal open={literatureOpen} onClose={() => setLiteratureOpen(false)} t={t} />
    </div>
  );
}
