"use client";

import { useState } from "react";
import type { Dict, Lang } from "@/lib/i18n";
import { DRAWN_SCENARIOS } from "@/lib/simScenarios";
import type { SimScenario } from "@/lib/simulator";
import DrawnRunner from "./DrawnRunner";
import PhotoRunner from "./PhotoRunner";

/** Familije scenarija u simulatoru. */
type Family = "pravilo" | "katalog";

interface SimulatorShellProps {
  /** Scene iz kataloga (fotografije sa označenim vozilima). */
  photoScenarios: SimScenario[];
  t: Dict;
  lang: Lang;
}

/**
 * Simulator raskrsnica — bira se familija scenarija.
 *
 * „Pravilo desne strane" su crtane scene (SVG, bez asseta) sa animacijom prolaza;
 * „iz kataloga" su postojeće fotografije. Runner se mijenja preko `key` da bi se
 * stanje resetovalo pri prebacivanju familije.
 */
export default function SimulatorShell({ photoScenarios, t, lang }: SimulatorShellProps) {
  const [family, setFamily] = useState<Family>("pravilo");

  const tabs: { value: Family; label: string; count: number }[] = [
    { value: "pravilo", label: t.simFamilyRule, count: DRAWN_SCENARIOS.length },
    { value: "katalog", label: t.simFamilyCatalog, count: photoScenarios.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t.simTitle}>
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFamily(tab.value)}
            aria-pressed={family === tab.value}
            className={`font-display rounded border-2 px-4 py-2 text-base font-semibold tracking-wide uppercase transition-colors ${
              family === tab.value
                ? "border-blue bg-blue text-white"
                : "border-line bg-panel text-ink hover:border-blue"
            }`}
          >
            {tab.label}
            <span className="ml-2 font-body text-xs font-normal normal-case opacity-80">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {family === "pravilo" ? (
        <DrawnRunner key="pravilo" scenarios={DRAWN_SCENARIOS} t={t} />
      ) : (
        <PhotoRunner key="katalog" scenarios={photoScenarios} t={t} lang={lang} />
      )}
    </div>
  );
}
