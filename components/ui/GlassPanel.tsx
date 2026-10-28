import type { ElementType, HTMLAttributes, ReactNode } from "react";

/**
 * Staklena površina: providna pozadina, tanka svijetla ivica, zaobljenje 20 px.
 * Koristi se štedljivo — za jednu glavnu površinu po sekciji, ne za svaki red.
 * Kartica u kartici se ne pravi; unutar panela se ide listom sa razdjelnicima
 * (ListRow).
 *
 * `blur` dodaje backdrop-blur, samo za ono što leži preko slike ili scene
 * (zaglavlje preko heroja, HUD igre).
 */
export interface GlassPanelProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  blur?: boolean;
  /** Puna površina umjesto staklene, za menije i modale preko sadržaja. */
  solid?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  children: ReactNode;
}

const RAZMACI = {
  none: "",
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
};

export default function GlassPanel({
  as: Oznaka = "div",
  blur,
  solid,
  padding = "md",
  className = "",
  children,
  ...ostalo
}: GlassPanelProps) {
  return (
    <Oznaka
      className={`rounded-xl border border-glass-line ${solid ? "bg-surface" : "bg-glass"} ${
        blur ? "backdrop-blur-md" : ""
      } ${RAZMACI[padding]} ${className}`}
      {...ostalo}
    >
      {children}
    </Oznaka>
  );
}
