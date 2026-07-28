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

/** Kategorije redom kojim se prikazuju u filteru. */
export const CATEGORIES: readonly { value: Category; label: string; short: string }[] = [
  { value: "sve", label: "Sve", short: "Sve" },
  { value: "tekst", label: "Tekstualna", short: "Tekst" },
  { value: "slika", label: "Sa slikom", short: "Slika" },
  { value: "znak", label: "Znaci", short: "Znaci" },
  { value: "situacija", label: "Raskrsnice", short: "Raskrsnice" },
  { value: "redoslijed", label: "Redoslijed", short: "Redoslijed" },
] as const;

export function categoryLabel(category: Category): string {
  return CATEGORIES.find((c) => c.value === category)?.label ?? "Sve";
}

/** Kratka oznaka kategorije za prikaz na kartici pitanja. */
export function badgeLabel(q: Question): string {
  switch (baseCategory(q)) {
    case "znak":
      return "Saobraćajni znak";
    case "situacija":
      return "Raskrsnica";
    case "redoslijed":
      return "Redoslijed prolaska";
    case "tekst":
      return "Tekstualno pitanje";
  }
}
