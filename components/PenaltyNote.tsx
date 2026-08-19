/**
 * „Koliko bi ovo koštalo u saobraćaju" — uz netačan odgovor.
 *
 * Prikazuje se samo kad pitanju odgovara stvaran prekršaj (vidi lib/penaltyMap.ts);
 * kod definicija, prve pomoći i sličnih pitanja se ne prikazuje ništa, jer tu
 * kazna ne postoji i izmišljen iznos bi bio gori od nikakvog.
 */

import { PENALTIES_ENABLED } from "@/lib/config";
import type { Dict, Lang } from "@/lib/i18n";
import { formatEur, penaltyById, penaltyRange, type Penalty } from "@/lib/penalties";
import { penaltyIdForQuestion } from "@/lib/penaltyMap";

/** Kazna za pitanje, ili `null` — jedna tačka odlučivanja za oba prikaza. */
export function penaltyForQuestion(questionId: number): Penalty | null {
  if (!PENALTIES_ENABLED) return null;
  const id = penaltyIdForQuestion(questionId);
  return id ? (penaltyById(id) ?? null) : null;
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
