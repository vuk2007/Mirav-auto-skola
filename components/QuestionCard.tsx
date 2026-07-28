"use client";

import Image from "next/image";
import { badgeLabel } from "@/lib/categories";
import { imageSize } from "@/lib/imageSizes";
import { questionPoints } from "@/lib/questions";
import { OPTION_KEYS, type OptionKey, type Question } from "@/lib/types";
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
}: QuestionCardProps) {
  const points = questionPoints(question);
  const [width, height] = question.image ? imageSize(question.image) : [0, 0];

  return (
    <article className="panel p-4 sm:p-6">
      <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="diamond h-2.5 w-2.5" aria-hidden="true" />
        <span className="tag text-blue">{badgeLabel(question)}</span>
        <span className="tag ml-auto text-muted">
          {points} {points === 1 ? "bod" : points < 5 ? "boda" : "bodova"}
        </span>
      </header>

      <h2 className="mb-4 text-lg leading-snug font-bold sm:text-xl">{question.text}</h2>

      {question.image && (
        <div className="mb-5 flex justify-center rounded border border-line bg-white p-2 sm:p-3">
          <Image
            src={`/web_images/${question.image}`}
            alt="Prikaz saobraćajne situacije uz pitanje"
            width={width}
            height={height}
            loading="lazy"
            sizes="(max-width: 640px) 100vw, 480px"
            className="h-auto w-full max-w-[480px] object-contain"
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
        />
      ) : (
        <div className="space-y-2.5">
          {OPTION_KEYS.map((key) => (
            <OptionButton
              key={key}
              optionKey={key}
              text={question.options[key]}
              selected={selected === key}
              revealed={revealed}
              isCorrect={question.correct === key}
              disabled={revealed}
              onSelect={onSelectOption}
            />
          ))}
        </div>
      )}
    </article>
  );
}
