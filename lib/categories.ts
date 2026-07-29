import type { Dict } from "./i18n";
import type { Question } from "./types";

/** Kategorije se izvode iz sadržaja pitanja — ne postoje kao polje u questions.json. */
export type Category = "sve" | "tekst" | "slika" | "znak" | "situacija" | "redoslijed";

/** Prepoznaje pitanja o saobraćajnim znakovima. Dijakritika je opciona radi sigurnosti. */
const ZNAK_RE = /saobra[cć]ajni\s+znak/i;

/**
 * Osnovna (međusobno isključiva) kategorija pitanja.
 * Redoslijed provjera je bitan: `redoslijed` → `znak` → `situacija` → `tekst`.
 */
export function baseCategory(q: Question): Exclude<Category, "sve" | "slika"> {
  if (q.type === "ordering") return "redoslijed";
  if (!q.image) return "tekst";
  return ZNAK_RE.test(q.text) ? "znak" : "situacija";
}

/** Da li pitanje pripada izabranom filteru. `slika` obuhvata sve sa slikom. */
export function matchesCategory(q: Question, category: Category): boolean {
  if (category === "sve") return true;
  if (category === "slika") return Boolean(q.image);
  return baseCategory(q) === category;
}

export function filterByCategory(questions: Question[], category: Category): Question[] {
  return questions.filter((q) => matchesCategory(q, category));
}

/** Kategorije redom kojim se prikazuju u filteru; naziv se uzima iz rječnika. */
export const CATEGORIES: readonly { value: Category; key: keyof Dict }[] = [
  { value: "sve", key: "catAll" },
  { value: "tekst", key: "catText" },
  { value: "slika", key: "catImage" },
  { value: "znak", key: "catSign" },
  { value: "situacija", key: "catIntersection" },
  { value: "redoslijed", key: "catOrdering" },
] as const;

export function isCategory(value: unknown): value is Category {
  return (
    typeof value === "string" &&
    CATEGORIES.some((c) => c.value === value)
  );
}

/** Ključ oznake kategorije za prikaz na kartici pitanja. */
export function badgeKey(q: Question): keyof Dict {
  switch (baseCategory(q)) {
    case "znak":
      return "badgeSign";
    case "situacija":
      return "badgeIntersection";
    case "redoslijed":
      return "badgeOrdering";
    case "tekst":
      return "badgeText";
  }
}
