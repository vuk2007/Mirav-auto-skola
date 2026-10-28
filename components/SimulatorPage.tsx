"use client";

import { BookOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { loadQuestions } from "@/lib/questions";
import { buildScenarios, type SimScenario } from "@/lib/simulator";
import { useApp } from "./AppProvider";
import LangSwitch from "./LangSwitch";
import LiteratureModal from "./LiteratureModal";
import SimulatorShell from "./sim/SimulatorShell";

/**
 * Simulator kao samostalna stranica (`/simulator`, `/embed/simulator`).
 *
 * Crtane familije rade bez baze pitanja; questions.json se učitava samo zbog
 * familije „iz kataloga", i to u pozadini — simulator je upotrebljiv odmah.
 *
 * `showControls`: literatura i jezik iznad simulatora trebaju samo ugrađenoj
 * verziji (`/embed/simulator`), koja nema zaglavlje sajta. Na `/simulator` ih
 * zaglavlje već nosi, pa bi stajali dvaput.
 */
export default function SimulatorPage({ showControls = true }: { showControls?: boolean }) {
  const { lang, t } = useApp();
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{t.simTitle}</h1>

        {showControls && (
          <>
            <button
              type="button"
              onClick={() => setLiteratureOpen(true)}
              className="ml-auto inline-flex min-h-11 items-center gap-2 font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-caps)] text-text-muted uppercase transition-colors hover:text-text"
            >
              <BookOpen aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />
              {t.literature}
            </button>

            <LangSwitch />
          </>
        )}
      </div>

      <SimulatorShell photoScenarios={photoScenarios} t={t} lang={lang} />

      <LiteratureModal open={literatureOpen} onClose={() => setLiteratureOpen(false)} t={t} />
    </div>
  );
}
