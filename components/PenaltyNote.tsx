/**
 * „Koliko bi ovo koštalo u saobraćaju" — uz netačan odgovor.
 *
 * Prikazuje se samo kad pitanju odgovara stvaran prekršaj (vidi lib/penaltyMap.ts);
 * kod definicija, prve pomoći i sličnih pitanja se ne prikazuje ništa, jer tu
 * kazna ne postoji i izmišljen iznos bi bio gori od nikakvog.
 */

import type { Dict, Lang } from "@/lib/i18n";
import { formatEur, penaltyById, penaltyRange, sumPenalties, type Penalty } from "@/lib/penalties";
import { penaltyIdForQuestion } from "@/lib/penaltyMap";

/** Kazna za pitanje, ili `null`. Interno — vidi `PenaltyForQuestion` ispod. */
function penaltyForQuestion(questionId: number): Penalty | null {
  const id = penaltyIdForQuestion(questionId);
  return id ? (penaltyById(id) ?? null) : null;
}

/**
 * Kazna za jedno pitanje — sama traži podatak i sama odlučuje da li se prikazuje.
 *
 * Zašto ovako, a ne da pozivalac dohvati kaznu pa je proslijedi: dok je prikaz
 * kazni isključen, `QuestionCard` i `ResultCard` ne smiju ni da uvezu
 * `lib/penalties.ts`, jer bi podaci završili u bundle-u i putovali korisniku i
 * kad se ne prikazuju. Sve što dodiruje podatke živi u ovom fajlu, koji se
 * učitava dinamički — vidi `components/PenaltyLoader.tsx`.
 */
export function PenaltyForQuestion({
  questionId,
  t,
  lang,
  compact = false,
}: {
  questionId: number;
  t: Dict;
  lang: Lang;
  compact?: boolean;
}) {
  const penalty = penaltyForQuestion(questionId);
  if (!penalty) return null;
  return <PenaltyNote penalty={penalty} t={t} lang={lang} compact={compact} />;
}

/** Zbir kazni za spisak promašenih pitanja; ništa ako nijedno nema prekršaj. */
export function PenaltyTotal({ questionIds, t }: { questionIds: readonly number[]; t: Dict }) {
  const kazne = questionIds
    .map((id) => penaltyForQuestion(id))
    .filter((x): x is Penalty => x !== null);
  if (kazne.length === 0) return null;
  const zbir = sumPenalties(kazne.map((x) => x.id));
  return (
    <div className="mb-5 rounded border-l-4 border-blue bg-blue-soft p-3 sm:p-4">
      <p className="font-display mb-1 text-xs font-bold tracking-wide text-blue uppercase">
        {t.penaltyTotal}
      </p>
      <p className="font-display text-2xl font-bold">{formatEur(zbir.minEur, zbir.maxEur)}</p>
      <p className="mt-1 text-xs text-muted">{t.penaltyNote}</p>
    </div>
  );
}

interface PenaltyNoteProps {
  penalty: Penalty;
  t: Dict;
  lang: Lang;
  /** Kompaktan oblik za listu grešaka na rezultatu — bez naslova i napomene. */
  compact?: boolean;
}

export default function PenaltyNote({ penalty, t, lang, compact = false }: PenaltyNoteProps) {
  const range = penaltyRange(penalty);
  const multi = penalty.tiers.length > 1;

  if (compact) {
    return (
      <p className="mt-2 text-sm">
        <span className="font-display font-bold text-blue">{formatEur(range.minEur, range.maxEur)}</span>{" "}
        <span className="text-muted">— {penalty.label[lang]}</span>
      </p>
    );
  }

  return (
    <aside className="mt-4 rounded border-l-4 border-blue bg-panel p-3 sm:p-4">
      <p className="font-display mb-1 text-xs font-bold tracking-wide text-blue uppercase">
        {t.penaltyTitle}
      </p>

      <p className="mb-1">
        <span className="font-display text-xl font-bold">
          {formatEur(range.minEur, range.maxEur)}
        </span>{" "}
        <span className="text-muted">— {penalty.label[lang]}</span>
      </p>

      {/* Kod brzine kazna raste stepenasto — jedan raspon bi sakrio da preko
          50 km/h košta deset puta više nego do 10 km/h. */}
      {multi && (
        <ul className="mt-2 space-y-0.5 text-sm">
          {penalty.tiers.map((tier) => (
            <li key={tier.article} className="flex gap-2">
              <span className="w-28 shrink-0 text-muted">{tier.label?.[lang]}</span>
              <span className="font-semibold">{formatEur(tier.minEur, tier.maxEur)}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-xs text-muted">
        {penalty.tiers.map((x) => x.article).join(" · ")}
      </p>
      <p className="mt-1 text-xs text-muted">{t.penaltyNote}</p>
    </aside>
  );
}
