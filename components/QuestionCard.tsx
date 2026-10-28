"use client";

import { Lightbulb } from "lucide-react";
import Image from "next/image";

import { PenaltyForQuestion } from "./PenaltyLoader";
import { badgeKey } from "@/lib/categories";
import { PENALTIES_ENABLED } from "@/lib/config";
import { imageSize } from "@/lib/imageSizes";
import { pointsLabel, type Dict, type Lang } from "@/lib/i18n";
import { bilingualOption, bilingualText, questionPoints } from "@/lib/questions";
import { OPTION_KEYS, type OptionKey, type Question } from "@/lib/types";
import BilingualText from "./BilingualText";
import OptionButton from "./OptionButton";
import OrderingInput from "./OrderingInput";
import Badge from "./ui/Badge";
import GlassPanel from "./ui/GlassPanel";

interface QuestionCardProps {
  question: Question;
  /** Izabrana opcija kod pitanja sa ponuđenim odgovorima. */
  selected: OptionKey | null;
  /** Tekući unos kod `ordering` pitanja. */
  orderingValue: string;
  /** Da li je tačan odgovor otkriven (vježba: nakon odgovora; ispit: nikad do kraja). */
  revealed: boolean;
  /** Da li je dati odgovor tačan — relevantno samo kad je `revealed`. */
  correct: boolean;
  /** Vježba nudi dugme „Provjeri"; na ispitu se unos pamti u hodu. */
  showOrderingSubmit: boolean;
  onSelectOption: (key: OptionKey) => void;
  onOrderingChange: (value: string) => void;
  onOrderingSubmit: () => void;
  t: Dict;
  lang: Lang;
}

/**
 * Pitanje u vježbi: oznaka vrste i bodova, tekst pitanja u čistoj tipografiji,
 * slika (ako postoji) na svijetloj podlozi — slike iz kataloga su crtane na
 * bijelom — pa odgovori i, poslije provjere, objašnjenje i kazna.
 */
export default function QuestionCard({
  question,
  selected,
  orderingValue,
  revealed,
  correct,
  showOrderingSubmit,
  onSelectOption,
  onOrderingChange,
  onOrderingSubmit,
  t,
  lang,
}: QuestionCardProps) {
  const points = questionPoints(question);
  const [width, height] = question.image ? imageSize(question.image) : [0, 0];
  const text = bilingualText(question, lang);

  return (
    <GlassPanel as="article">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="accent">{t[badgeKey(question)]}</Badge>
        <Badge className="ml-auto">
          {points} {pointsLabel(points, lang)}
        </Badge>
      </header>

      <h2 className="font-display text-lg leading-snug font-semibold tracking-[-0.01em] sm:text-xl">
        <BilingualText text={text} />
      </h2>

      {/* Fallback na crnogorski ne smije biti tih. */}
      {text.fallback && <p className="mt-2 text-xs text-text-muted">{t.translationMissing}</p>}

      {question.image && (
        <div className="mt-5 flex justify-center overflow-hidden rounded-lg border border-glass-line bg-white p-3">
          <Image
            src={`/web_images/${question.image}`}
            alt=""
            width={width}
            height={height}
            loading="lazy"
            sizes={`(max-width: 640px) 100vw, ${width}px`}
            // Skalira se do širine kartice, ali nikad preko prirodne veličine —
            // inače bi se manje slike (znaci) razvukle i bile mutne.
            style={{ maxWidth: width }}
            className="h-auto w-full object-contain"
          />
        </div>
      )}

      <div className="mt-5">
        {question.type === "ordering" ? (
          <OrderingInput
            question={question}
            value={orderingValue}
            onChange={onOrderingChange}
            onSubmit={onOrderingSubmit}
            showSubmit={showOrderingSubmit}
            revealed={revealed}
            correct={correct}
            disabled={revealed}
            t={t}
          />
        ) : (
          <div className="space-y-3">
            {OPTION_KEYS.map((key) => (
              <OptionButton
                key={key}
                optionKey={key}
                text={bilingualOption(question, key, lang)}
                selected={selected === key}
                revealed={revealed}
                isCorrect={question.correct === key}
                disabled={revealed}
                onSelect={onSelectOption}
                t={t}
              />
            ))}
          </div>
        )}
      </div>

      {/* Objašnjenje se prikazuje samo ako postoji u bazi — ne izmišlja se. */}
      {revealed && question.explanation && (
        <div className="mt-5 flex gap-3 border-t border-glass-line pt-5">
          <Lightbulb aria-hidden="true" strokeWidth={1.5} className="mt-0.5 h-5 w-5 flex-none text-accent-2" />
          <div>
            <p className="mb-1 font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-label)] text-accent-2 uppercase">
              {t.explanationTitle}
            </p>
            <p className="text-sm leading-relaxed text-text">{question.explanation}</p>
          </div>
        </div>
      )}

      {/* Cijena greške — samo kad je odgovor netačan i kad pitanju odgovara
          stvaran prekršaj. Uz tačan odgovor nema šta da se naplati. */}
      {/* Kazna se traži sa mreže tek ovdje, i samo ako je prikaz uključen. */}
      {revealed && !correct && PENALTIES_ENABLED && (
        <PenaltyForQuestion questionId={question.id} t={t} lang={lang} />
      )}
    </GlassPanel>
  );
}
