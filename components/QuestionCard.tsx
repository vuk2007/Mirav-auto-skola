"use client";

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
    <article className="panel p-4 sm:p-6">
      <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="diamond h-2.5 w-2.5" aria-hidden="true" />
        <span className="tag text-blue">{t[badgeKey(question)]}</span>
        <span className="tag ml-auto text-muted">
          {points} {pointsLabel(points, lang)}
        </span>
      </header>

      <h2 className="mb-1 text-lg leading-snug font-bold sm:text-xl">
        <BilingualText text={text} />
      </h2>

      {/* Fallback na crnogorski ne smije biti tih. */}
      {text.fallback && <p className="mb-3 text-xs text-muted">{t.translationMissing}</p>}

      {question.image && (
        <div className="mt-4 mb-5 flex justify-center rounded border border-line bg-white p-2 sm:p-3">
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
        <div className="space-y-2.5">
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

      {/* Objašnjenje se prikazuje samo ako postoji u bazi — ne izmišlja se. */}
      {revealed && question.explanation && (
        <div className="mt-4 rounded border-l-4 border-blue bg-blue-soft p-3">
          <p className="tag mb-1 text-blue">{t.explanationTitle}</p>
          <p className="text-sm leading-relaxed">{question.explanation}</p>
        </div>
      )}

      {/* Cijena greške — samo kad je odgovor netačan i kad pitanju odgovara
          stvaran prekršaj. Uz tačan odgovor nema šta da se naplati. */}
      {/* Kazna se traži sa mreže tek ovdje, i samo ako je prikaz uključen. */}
      {revealed && !correct && PENALTIES_ENABLED && (
        <PenaltyForQuestion questionId={question.id} t={t} lang={lang} />
      )}
    </article>
  );
}
