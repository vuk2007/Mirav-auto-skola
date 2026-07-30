"use client";

import { useState } from "react";
import type { Dict, Lang } from "@/lib/i18n";
import type { Family } from "@/lib/simRules";
import { FAMILIES, scenariosOf } from "@/lib/simScenarios";
import type { SimScenario } from "@/lib/simulator";
import DrawnRunner from "./DrawnRunner";
import PhotoRunner from "./PhotoRunner";

/** „katalog" nije crtana familija — to su fotografije iz baze pitanja. */
type Tab = Family | "katalog";

interface SimulatorShellProps {
  photoScenarios: SimScenario[];
  t: Dict;
  lang: Lang;
}

/**
 * Simulator raskrsnica — bira se familija scenarija.
 *
 * Crtane familije koriste SVG scene i rule-engine; „iz kataloga" su postojeće
 * fotografije. Runner se mijenja preko `key` da bi se stanje resetovalo pri
 * prebacivanju familije.
 */
export default function SimulatorShell({ photoScenarios, t, lang }: SimulatorShellProps) {
  const [tab, setTab] = useState<Tab>("pravilo");

  const tabs: { value: Tab; label: string; count: number }[] = [
    ...FAMILIES.map((f) => ({
      value: f.value as Tab,
      label: t[f.labelKey],
      count: scenariosOf(f.value).length,
    })),
    { value: "katalog", label: t.simFamilyCatalog, count: photoScenarios.length },
  ];

  const activeLabel = tabs.find((x) => x.value === tab)?.label ?? "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t.simTitle}>
        {tabs.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            aria-pressed={tab === item.value}
            className={`font-display rounded border-2 px-3.5 py-1.5 text-base font-semibold tracking-wide uppercase transition-colors ${
              tab === item.value
                ? "border-blue bg-blue text-white"
                : "border-line bg-panel text-ink hover:border-blue"
            }`}
          >
            {item.label}
            <span className="ml-1.5 font-body text-xs font-normal normal-case opacity-80">
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {tab === "katalog" ? (
        <PhotoRunner key="katalog" scenarios={photoScenarios} t={t} lang={lang} />
      ) : (
        <DrawnRunner
          key={tab}
          family={tab}
          familyLabel={activeLabel}
          scenarios={scenariosOf(tab)}
          t={t}
        />
      )}
    </div>
  );
}
