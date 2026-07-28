"use client";

import { CATEGORIES, type Category } from "@/lib/categories";
import type { Mode } from "@/lib/types";

interface ControlsProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  category: Category;
  onCategoryChange: (category: Category) => void;
  /** Broj pitanja u tekućem skupu — prikazuje se uz filter. */
  poolSize: number;
  /** Broj tačnih odgovora u vježbi. */
  correctCount: number;
  /** Broj odgovorenih pitanja u vježbi. */
  answeredCount: number;
  /** Preostalo vrijeme u sekundama; null ako je tajmer isključen ili nije ispit. */
  secondsLeft: number | null;
  onRestart: () => void;
}

const MODES: readonly { value: Mode; label: string }[] = [
  { value: "vjezba", label: "Vježba" },
  { value: "simulacija", label: "Simulacija ispita" },
];

function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(seconds, 0) / 60);
  const s = Math.max(seconds, 0) % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Controls({
  mode,
  onModeChange,
  category,
  onCategoryChange,
  poolSize,
  correctCount,
  answeredCount,
  secondsLeft,
  onRestart,
}: ControlsProps) {
  return (
    <section className="panel mb-5 p-4 sm:p-5" aria-label="Podešavanja testa">
      {/* Režim */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="tag mr-1 text-muted">Režim</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Izbor režima">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => onModeChange(m.value)}
              aria-pressed={mode === m.value}
              className={`font-display rounded border-2 px-3.5 py-1.5 text-base font-semibold tracking-wide uppercase transition-colors ${
                mode === m.value
                  ? "border-blue bg-blue text-white"
                  : "border-line bg-panel text-ink hover:border-blue"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onRestart}
          className="font-display ml-auto rounded border-2 border-line px-3.5 py-1.5 text-base font-semibold tracking-wide text-muted uppercase transition-colors hover:border-blue hover:text-blue"
        >
          Počni ispočetka
        </button>
      </div>

      {/* Filter kategorija — samo u vježbi; ispit uvijek vuče iz cijele baze. */}
      {mode === "vjezba" && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tag mr-1 text-muted">Kategorija</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter kategorija">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => onCategoryChange(c.value)}
                  aria-pressed={category === c.value}
                  className={`rounded border px-3 py-1.5 text-sm transition-colors ${
                    category === c.value
                      ? "border-blue bg-blue-soft font-semibold text-blue"
                      : "border-line bg-panel text-ink hover:border-blue"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Skor / tajmer */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4">
        <p className="text-sm text-muted">
          {mode === "vjezba" ? (
            <>
              Tačno:{" "}
              <strong className="font-display text-lg text-green">{correctCount}</strong>
              <span className="mx-1">/</span>
              <strong className="font-display text-lg text-ink">{answeredCount}</strong>
              <span className="ml-2 text-muted">({poolSize} pitanja u izboru)</span>
            </>
          ) : (
            <>
              Odgovoreno:{" "}
              <strong className="font-display text-lg text-ink">{answeredCount}</strong>
              <span className="mx-1">/</span>
              <strong className="font-display text-lg text-ink">{poolSize}</strong>
            </>
          )}
        </p>

        {secondsLeft !== null && (
          <p
            className={`font-display ml-auto text-xl font-bold tabular-nums ${
              secondsLeft <= 60 ? "text-red" : "text-ink"
            }`}
            aria-live="off"
          >
            <span className="tag mr-1.5 text-muted">Preostalo</span>
            {formatTime(secondsLeft)}
          </p>
        )}
      </div>
    </section>
  );
}
