"use client";

import { PENALTIES_ENABLED } from "@/lib/config";
import type { Violation, World } from "@/lib/game/sim/types";
import { ruleKeyFor, VIOLATION_LABEL } from "@/lib/game/ui/labels";
import type { Dict, Lang } from "@/lib/i18n";
import type { Approach } from "@/lib/simRules";
import { PenaltyForRef } from "@/components/PenaltyLoader";

interface ViolationCardProps {
  violation: Violation;
  world: World;
  /** Znak/svjetlo na kraku igrača u trenutku prekršaja. */
  control: string;
  /** Da li je saobraćaj regulisao policajac — mijenja koje pravilo objašnjava. */
  officerActive: boolean;
  t: Dict;
  lang: Lang;
}

/**
 * Jedan prekršaj: naziv, šta se tačno desilo, pravilo, i kazna iz kataloga.
 *
 * Kazna se prikazuje samo ako je instruktorka potvrdi — dok nije, kartica
 * pokazuje pravilo bez iznosa. Podaci o kaznama dolaze dinamički (vidi
 * `PenaltyLoader.tsx`), pa dok je prikaz isključen ne putuju uopšte.
 */
export default function ViolationCard({
  violation,
  world,
  control,
  officerActive,
  t,
  lang,
}: ViolationCardProps) {
  const player = world.vehicles.find((v) => v.kind === "player");
  const other = violation.otherVehicleId
    ? world.vehicles.find((v) => v.id === violation.otherVehicleId)
    : undefined;

  const ruleKey = ruleKeyFor({
    type: violation.type,
    // Kad reguliše policajac, znak i svjetlo ne odlučuju ni o pravilu koje se
    // ispisuje — inače bi kartica objašnjavala semafor koji tu ne važi.
    control: officerActive ? "officer" : control,
    playerArm: (player?.arm ?? "N") as Approach,
    playerIntent: player?.intent ?? "straight",
    otherArm: (other?.arm as Approach | undefined) ?? null,
    otherEmergency: Boolean(other?.emergency),
  });

  return (
    <li className="rounded border border-line bg-red-soft p-3">
      <p className="font-display font-bold text-red">{t[VIOLATION_LABEL[violation.type]]}</p>
      <p className="mt-1 text-sm">{violation.details}</p>

      <p className="mt-2 text-xs font-semibold tracking-wide text-muted uppercase">
        {t.gameRuleTitle}
      </p>
      <p className="text-sm">{t[ruleKey]}</p>

      {PENALTIES_ENABLED && (
        <PenaltyForRef penaltyRef={violation.penaltyRef} t={t} lang={lang} />
      )}
    </li>
  );
}
