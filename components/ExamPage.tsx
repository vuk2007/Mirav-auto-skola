"use client";

import Image from "next/image";

import { badgeKey } from "@/lib/categories";
import { imageSize } from "@/lib/imageSizes";
import type { Dict, Lang } from "@/lib/i18n";
import { bilingualOption, bilingualText, type ExamSlot } from "@/lib/questions";
import { OPTION_KEYS, type Answer, type Question } from "@/lib/types";
import BilingualText from "./BilingualText";
import OrderingInput from "./OrderingInput";
import PrijavaGreske from "./PrijavaGreske";
import Badge from "./ui/Badge";
import GlassPanel from "./ui/GlassPanel";

interface ExamPageProps {
  /** Kartice stranice — vidi `examCards`. */
  cards: readonly ExamSlot[][];
  answers: ReadonlyMap<number, Answer>;
  /** Tekući unos kod `ordering` pitanja. */
  drafts: ReadonlyMap<number, string>;
  onAnswer: (question: Question, answer: Answer) => void;
  onOrderingChange: (question: Question, value: string) => void;
  t: Dict;
  lang: Lang;
}

/** Id elementa pitanja — na njega skroluje „Pregled pitanja". */
export function examQuestionAnchor(number: number): string {
  return `ispitno-pitanje-${number}`;
}

/**
 * Jedna stranica simulacije ispita: kartice jedna ispod druge, kao na pravom
 * testu. Tačni odgovori i bodovi se ovdje nikad ne prikazuju — tek u rezultatu.
 */
export default function ExamPage({
  cards,
  answers,
  drafts,
  onAnswer,
  onOrderingChange,
  t,
  lang,
}: ExamPageProps) {
  return (
    <div className="space-y-4">
      {cards.map((card) => (
        <ExamCard
          key={card[0]!.card}
          slots={card}
          answers={answers}
          drafts={drafts}
          onAnswer={onAnswer}
          onOrderingChange={onOrderingChange}
          t={t}
          lang={lang}
        />
      ))}
    </div>
  );
}

type ExamCardProps = Omit<ExamPageProps, "cards"> & { slots: readonly ExamSlot[] };

/**
 * Raspored kartice zavisi od toga šta nosi:
 *  - pitanje bez slike — samo pitanje i odgovori,
 *  - jedno pitanje uz sliku (znak, semafor) — slika lijevo (~220px), pitanje desno,
 *  - dva pitanja uz istu sliku (situacija, policajac) — slika lijevo (~40%),
 *    prvo pitanje u sredini, drugo desno.
 * Na uskom ekranu sve ide jedno ispod drugog: slika, pa pitanja.
 */
function ExamCard({ slots, ...rest }: ExamCardProps) {
  const first = slots[0]!.question;
  const image = first.image;
  const pair = slots.length > 1;

  const layout = !image
    ? ""
    : pair
      ? "grid gap-5 md:grid-cols-2 lg:grid-cols-[4fr_3fr_3fr] lg:gap-6"
      : "grid gap-5 sm:grid-cols-[220px_1fr] sm:gap-6";

  return (
    <GlassPanel as="article">
      <header className="mb-4 flex items-center gap-3">
        <Badge tone="accent">{rest.t[badgeKey(first)]}</Badge>
      </header>

      <div className={layout}>
        {image && <CardImage image={image} wide={pair} />}
        {slots.map((slot) => (
          <ExamQuestion key={slot.question.id} slot={slot} {...rest} />
        ))}
      </div>
    </GlassPanel>
  );
}

function CardImage({ image, wide }: { image: string; wide: boolean }) {
  const [width, height] = imageSize(image);
  return (
    <div
      className={`flex items-start justify-center self-start rounded-lg border border-glass-line bg-white p-3 ${
        wide ? "md:col-span-2 lg:col-span-1" : ""
      }`}
    >
      <Image
        src={`/web_images/${image}`}
        alt=""
        width={width}
        height={height}
        sizes={wide ? "(max-width: 1024px) 100vw, 480px" : "(max-width: 640px) 100vw, 220px"}
        // Ne preko prirodne veličine — manji znaci bi se razvukli i bili mutni.
        style={{ maxWidth: width }}
        className="h-auto w-full object-contain"
      />
    </div>
  );
}

type ExamQuestionProps = Omit<ExamCardProps, "slots"> & { slot: ExamSlot };

function ExamQuestion({ slot, answers, drafts, onAnswer, onOrderingChange, t, lang }: ExamQuestionProps) {
  const { question, number } = slot;
  const answer = answers.get(question.id);
  const headingId = `${examQuestionAnchor(number)}-naslov`;
  const text = bilingualText(question, lang);

  return (
    <section id={examQuestionAnchor(number)} className="min-w-0 scroll-mt-4">
      <h3 id={headingId} className="mb-4 font-display text-base leading-snug font-semibold sm:text-lg">
        <span className="tabular mr-2 text-accent-2">{number}.</span>
        <BilingualText text={text} />
      </h3>

      {text.fallback && (
        <p className="-mt-2 mb-4 text-xs text-text-muted">{t.translationMissing}</p>
      )}

      {question.type === "ordering" ? (
        <OrderingInput
          question={question}
          value={drafts.get(question.id) ?? ""}
          onChange={(value) => onOrderingChange(question, value)}
          onSubmit={() => {}}
          showSubmit={false}
          revealed={false}
          correct={false}
          disabled={false}
          t={t}
        />
      ) : (
        // Isti izgled kao odgovor u vježbi, ali bez glow-a: na stranici ih je mnogo izabranih.
        <div role="radiogroup" aria-labelledby={headingId} className="space-y-2.5">
          {OPTION_KEYS.map((key) => {
            const checked = answer?.kind === "choice" && answer.value === key;
            return (
              <label
                key={key}
                className={`flex cursor-pointer items-start gap-3.5 rounded-lg border px-4 py-3 transition-[background,border-color] duration-200 ease-[var(--ease-izlaz)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-2 ${
                  checked
                    ? "border-accent-2 bg-accent-soft"
                    : "border-glass-line bg-glass hover:border-glass-line-strong hover:bg-glass-strong"
                }`}
              >
                <input
                  type="radio"
                  name={`pitanje-${question.id}`}
                  value={key}
                  checked={checked}
                  onChange={() => onAnswer(question, { kind: "choice", value: key })}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 flex-none items-center justify-center rounded-full border font-display text-xs font-bold uppercase transition-colors duration-200 ${
                    checked ? "border-accent bg-accent text-white" : "border-glass-line-strong text-text-muted"
                  }`}
                >
                  {key}
                </span>
                <span className="min-w-0 pt-0.5 text-[0.9375rem] leading-snug">
                  <BilingualText text={bilingualOption(question, key, lang)} />
                </span>
              </label>
            );
          })}
        </div>
      )}

      <PrijavaGreske t={t} lang={lang} pitanje={question} rezim="ispit" className="mt-1" />
    </section>
  );
}
