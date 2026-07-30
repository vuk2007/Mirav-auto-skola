"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dict, Lang } from "@/lib/i18n";
import { imageSize } from "@/lib/imageSizes";
import { localizedText, shuffle } from "@/lib/questions";
import { isOrderCorrect, type SimScenario } from "@/lib/simulator";
import ProgressBar from "../ProgressBar";

interface PhotoRunnerProps {
  scenarios: SimScenario[];
  t: Dict;
  lang: Lang;
}

/**
 * Familija „iz kataloga" — scena je postojeća fotografija sa označenim vozilima,
 * a kandidat tapne vozila redom kojim prolaze umjesto da kuca redoslijed.
 */
export default function PhotoRunner({ scenarios, t, lang }: PhotoRunnerProps) {
  // Miješa se u efektu, ne tokom rendera — inače server i klijent dobiju
  // različit poredak i hidratacija pukne (React error #418). Počinje se od
  // praznog niza da se scena pojavi već promiješana, bez vidljive zamjene.
  const [order, setOrder] = useState<SimScenario[]>([]);
  useEffect(() => setOrder(shuffle(scenarios)), [scenarios]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [stats, setStats] = useState({ correct: 0, answered: 0, streak: 0, bestStreak: 0 });

  const scenario = order[index];
  const correct = useMemo(
    () => (scenario ? isOrderCorrect(scenario, picked) : false),
    [scenario, picked],
  );

  const toggle = useCallback(
    (vehicle: number) => {
      if (checked) return;
      setPicked((prev) =>
        prev.includes(vehicle) ? prev.filter((v) => v !== vehicle) : [...prev, vehicle],
      );
    },
    [checked],
  );

  const check = useCallback(() => {
    if (!scenario || picked.length === 0 || checked) return;
    const ok = isOrderCorrect(scenario, picked);
    setChecked(true);
    setStats((s) => {
      const streak = ok ? s.streak + 1 : 0;
      return {
        correct: s.correct + (ok ? 1 : 0),
        answered: s.answered + 1,
        streak,
        bestStreak: Math.max(s.bestStreak, streak),
      };
    });
  }, [scenario, picked, checked]);

  const next = useCallback(() => {
    setPicked([]);
    setChecked(false);
    setIndex((i) => i + 1);
  }, []);

  const restart = useCallback(() => {
    setOrder(shuffle(scenarios));
    setIndex(0);
    setPicked([]);
    setChecked(false);
    setStats({ correct: 0, answered: 0, streak: 0, bestStreak: 0 });
  }, [scenarios]);

  if (scenarios.length === 0) {
    return (
      <div className="panel p-5">
        <p className="text-sm text-muted">{t.simEmpty}</p>
      </div>
    );
  }

  // Miješanje se dešava u efektu; do tada nema šta da se prikaže.
  if (order.length === 0) {
    return (
      <div className="panel p-5" aria-busy="true">
        <p className="tag text-muted">{t.loading}</p>
      </div>
    );
  }

  // Prošli su sve scene — prikaži zbir i ponudi novi krug.
  if (!scenario) {
    return (
      <div className="panel border-t-4 border-t-green p-5 sm:p-6" aria-live="polite">
        <p className="tag mb-2 text-muted">{t.simTitle}</p>
        <p className="mb-3 text-lg font-bold">{t.simFinished}</p>
        <p className="mb-4">
          <span className="tag text-muted">{t.correctLabel}</span>{" "}
          <strong className="font-display text-2xl text-green">{stats.correct}</strong>
          <span className="mx-1 text-muted">/</span>
          <strong className="font-display text-2xl">{stats.answered}</strong>
          <span className="ml-3 tag text-muted">{t.simStreak}</span>{" "}
          <strong className="font-display text-2xl">{stats.bestStreak}</strong>
        </p>
        <button
          type="button"
          onClick={restart}
          className="font-display rounded bg-blue px-6 py-3 text-lg font-bold tracking-wide text-white uppercase transition-colors hover:bg-blue-dark"
        >
          {t.simRestart}
        </button>
      </div>
    );
  }

  const { question, vehicleCount, allPass } = scenario;
  const [w, h] = imageSize(question.image);
  const vehicles = Array.from({ length: vehicleCount }, (_, i) => i + 1);

  return (
    <div className="space-y-4">
      {/* Skor */}
      <section className="panel flex flex-wrap items-center gap-x-5 gap-y-2 p-4">
        <p className="text-sm text-muted">
          {t.correctLabel}: <strong className="font-display text-lg text-green">{stats.correct}</strong>
          <span className="mx-1">/</span>
          <strong className="font-display text-lg text-ink">{stats.answered}</strong>
        </p>
        <p className="text-sm text-muted">
          {t.simStreak}: <strong className="font-display text-lg text-blue">{stats.streak}</strong>
        </p>
      </section>

      <ProgressBar
        current={index + 1}
        total={order.length}
        label={`${t.simScene} ${index + 1} / ${order.length}`}
        ariaLabel={t.progress}
      />

      <article className="panel p-4 sm:p-6">
        <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="diamond h-2.5 w-2.5" aria-hidden="true" />
          <span className="tag text-blue">{t.simTitle}</span>
        </header>

        <h2 className="mb-4 text-lg leading-snug font-bold sm:text-xl">
          {localizedText(question, lang)}
        </h2>

        <div className="mb-4 flex justify-center rounded border border-line bg-white p-2 sm:p-3">
          <Image
            src={`/web_images/${question.image}`}
            alt=""
            width={w}
            height={h}
            loading="lazy"
            sizes={`(max-width: 640px) 100vw, ${w}px`}
            style={{ maxWidth: w }}
            className="h-auto w-full object-contain"
          />
        </div>

        <p className="mb-1 text-sm text-muted">{t.simTask}</p>
        {/* Kod scena sa policajcem dio vozila ne prolazi — reci to unaprijed. */}
        {!allPass && !checked && (
          <p className="mb-3 border-l-2 border-yellow pl-3 text-sm text-muted">
            {t.simNotAllPass}
          </p>
        )}

        {/* Vozila — tapkaju se redom kojim prolaze */}
        <div className="mt-3 flex flex-wrap gap-2.5" role="group" aria-label={t.simTask}>
          {vehicles.map((v) => {
            const pos = picked.indexOf(v);
            const isPicked = pos !== -1;
            const inAnswer = question.answer_sequence.includes(String(v));

            let tone = "border-line bg-panel text-ink hover:border-blue hover:bg-blue-soft";
            if (checked) {
              // Poslije provjere: zeleno = trebalo je da prođe, crveno = nije.
              tone = inAnswer
                ? "border-green bg-green-soft text-ink"
                : isPicked
                  ? "border-red bg-red-soft text-ink"
                  : "border-line bg-panel text-muted opacity-60";
            } else if (isPicked) {
              tone = "border-blue bg-blue text-white";
            }

            return (
              <button
                key={v}
                type="button"
                onClick={() => toggle(v)}
                disabled={checked}
                aria-pressed={isPicked}
                aria-label={`${t.simVehicle} ${v}${isPicked ? ` — ${pos + 1}.` : ""}`}
                className={`font-display relative h-14 w-14 rounded-full border-2 text-2xl font-bold transition-colors ${tone} ${
                  checked ? "cursor-default" : ""
                }`}
              >
                {v}
                {isPicked && (
                  <span
                    aria-hidden="true"
                    className="font-display absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-yellow text-sm font-bold text-ink"
                  >
                    {pos + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Izabrani redoslijed */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <p className="text-sm">
            <span className="tag text-muted">{t.simYourOrder}</span>{" "}
            <span className="font-display text-xl tracking-[0.2em]">
              {picked.length > 0 ? picked.join("-") : "—"}
            </span>
          </p>
          {!checked && picked.length > 0 && (
            <button
              type="button"
              onClick={() => setPicked([])}
              className="font-display rounded border-2 border-line px-3.5 py-1.5 text-base font-semibold tracking-wide text-muted uppercase transition-colors hover:border-blue hover:text-blue"
            >
              {t.simClear}
            </button>
          )}
        </div>

        {/* Provjera i povratna informacija */}
        {!checked ? (
          <button
            type="button"
            onClick={check}
            disabled={picked.length === 0}
            className="font-display mt-4 w-full rounded bg-blue px-6 py-3 text-lg font-bold tracking-wide text-white uppercase transition-colors hover:bg-blue-dark disabled:opacity-40 disabled:hover:bg-blue sm:w-auto"
          >
            {t.check}
          </button>
        ) : (
          <div
            className={`mt-4 rounded border-l-4 p-3 ${
              correct ? "border-green bg-green-soft" : "border-red bg-red-soft"
            }`}
            role="status"
          >
            <p className={`font-display text-lg font-bold ${correct ? "text-green" : "text-red"}`}>
              {correct ? t.correctFeedback : t.wrongFeedback}
            </p>
            {!correct && (
              <p className="mt-1 text-sm">
                <span className="tag text-muted">{t.simCorrectOrder}</span>{" "}
                <span className="font-display text-lg tracking-[0.2em]">
                  {question.answer_sequence.join("-")}
                </span>
              </p>
            )}
            {/* Objašnjenje se prikazuje samo ako postoji u bazi — ne izmišlja se. */}
            {question.explanation && (
              <p className="mt-2 text-sm leading-relaxed">
                <span className="tag mr-1 text-blue">{t.explanationTitle}</span>
                {question.explanation}
              </p>
            )}
          </div>
        )}
      </article>

      {checked && (
        <button
          type="button"
          onClick={next}
          className="font-display w-full rounded bg-blue px-6 py-3 text-lg font-bold tracking-wide text-white uppercase transition-colors hover:bg-blue-dark sm:w-auto"
        >
          {index + 1 < order.length ? t.simNextScene : t.simFinished}
        </button>
      )}
    </div>
  );
}
