"use client";

import { Info } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dict, Lang } from "@/lib/i18n";
import { imageSize } from "@/lib/imageSizes";
import { localizedText, shuffle } from "@/lib/questions";
import { isOrderCorrect, type SimScenario } from "@/lib/simulator";
import ProgressBar from "../ProgressBar";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import GlassPanel from "../ui/GlassPanel";
import { OZNAKA, SimDetalj, SimKraj, SimNiz, SimPoruka, SimPovratna, SimRedoslijed, SimSkor } from "./SimUi";

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

  if (scenarios.length === 0) return <SimPoruka>{t.simEmpty}</SimPoruka>;

  // Miješanje se dešava u efektu; do tada nema šta da se prikaže.
  if (order.length === 0) return <SimPoruka busy>{t.loading}</SimPoruka>;

  // Prošli su sve scene — prikaži zbir i ponudi novi krug.
  if (!scenario) return <SimKraj label={t.simTitle} stats={stats} onRestart={restart} t={t} />;

  const { question, vehicleCount, allPass } = scenario;
  const [w, h] = imageSize(question.image);
  const vehicles = Array.from({ length: vehicleCount }, (_, i) => i + 1);

  return (
    <div className="space-y-5">
      <SimSkor stats={stats} t={t} />

      <ProgressBar
        current={index + 1}
        total={order.length}
        label={`${t.simScene} ${index + 1} / ${order.length}`}
        ariaLabel={t.progress}
      />

      <GlassPanel as="article">
        <header className="mb-4">
          <Badge tone="accent">{t.simTitle}</Badge>
        </header>

        <h2 className="mb-5 font-display text-lg leading-snug font-semibold sm:text-xl">
          {localizedText(question, lang)}
        </h2>

        <div className="mb-5 flex justify-center overflow-hidden rounded-lg border border-glass-line bg-white p-2 sm:p-3">
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

        <p className="text-sm text-text-muted">{t.simTask}</p>
        {/* Kod scena sa policajcem dio vozila ne prolazi — reci to unaprijed. */}
        {!allPass && !checked && (
          <p className="mt-3 flex items-start gap-2.5 text-sm text-text-muted">
            <Info aria-hidden="true" strokeWidth={1.5} className="mt-0.5 h-4 w-4 flex-none text-accent-2" />
            {t.simNotAllPass}
          </p>
        )}

        {/* Vozila — tapkaju se redom kojim prolaze */}
        <div className="mt-4 flex flex-wrap gap-3" role="group" aria-label={t.simTask}>
          {vehicles.map((v) => {
            const pos = picked.indexOf(v);
            const isPicked = pos !== -1;
            const inAnswer = question.answer_sequence.includes(String(v));

            let tone = "border-glass-line-strong bg-glass text-text hover:border-accent-2 hover:bg-accent-soft";
            if (checked) {
              // Poslije provjere: zeleno = trebalo je da prođe, crveno = nije.
              tone = inAnswer
                ? "border-ok-line bg-ok-soft text-text"
                : isPicked
                  ? "border-err-line bg-err-soft text-text"
                  : "border-glass-line text-text-muted";
            } else if (isPicked) {
              tone = "border-accent bg-accent text-white";
            }

            return (
              <button
                key={v}
                type="button"
                onClick={() => toggle(v)}
                disabled={checked}
                aria-pressed={isPicked}
                aria-label={`${t.simVehicle} ${v}${isPicked ? ` — ${pos + 1}.` : ""}`}
                className={`tabular relative h-14 w-14 rounded-full border font-display text-2xl font-bold transition-colors duration-200 ${tone} ${
                  checked ? "cursor-default" : ""
                }`}
              >
                {v}
                {isPicked && (
                  <span
                    aria-hidden="true"
                    className="tabular absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-text font-display text-xs font-bold text-bg"
                  >
                    {pos + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <SimRedoslijed picked={picked} canClear={!checked && picked.length > 0} onClear={() => setPicked([])} t={t} />

        {/* Provjera i povratna informacija */}
        {!checked ? (
          <Button onClick={check} disabled={picked.length === 0} arrow={false} className="mt-4 w-full sm:w-auto">
            {t.check}
          </Button>
        ) : (
          <SimPovratna correct={correct} t={t}>
            {!correct && (
              <SimDetalj label={t.simCorrectOrder}>
                <SimNiz>{question.answer_sequence.join("-")}</SimNiz>
              </SimDetalj>
            )}
            {/* Objašnjenje se prikazuje samo ako postoji u bazi — ne izmišlja se. */}
            {question.explanation && (
              <div className="mt-4 border-t border-glass-line pt-3">
                <p className={`mb-1.5 ${OZNAKA} text-accent-2`}>{t.explanationTitle}</p>
                <p className="text-sm leading-relaxed text-text">{question.explanation}</p>
              </div>
            )}
          </SimPovratna>
        )}
      </GlassPanel>

      {checked && (
        <Button onClick={next} className="w-full sm:w-auto">
          {index + 1 < order.length ? t.simNextScene : t.simFinished}
        </Button>
      )}
    </div>
  );
}
