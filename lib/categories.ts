import type { Dict } from "./i18n";
import type { Question } from "./types";

/** Kategorije se izvode iz sadržaja pitanja — ne postoje kao polje u questions.json. */
export type Category = "sve" | "tekst" | "slika" | "znak" | "situacija" | "redoslijed";

/**
 * Rezervno prepoznavanje znakova — koristi se samo ako pitanje nema polje
 * `kind`. Do toga dolazi kad browser servira keširan stariji questions.json
 * (fajl nema heš u imenu), pa aplikacija ne smije pasti na tome.
 *
 * Množina je namjerno obuhvaćena (`znak` je prefiks od `znaci`/`znakovi`).
 */
const ZNAK_RE = /saobra[cć]ajni\s+znak/i;

/**
 * Osnovna (međusobno isključiva) kategorija pitanja.
 *
 * Izvodi se iz polja `kind` (upisuje ga `scripts/gen-exam-meta.mjs`), a ne iz
 * teksta pitanja. Ranije se gledao samo tekst, pa su pitanja koja ne izgovore
 * „saobraćajni znak" — „Na slici je prikazan:", „…znak obavještenja…",
 * graničnik, kosnik — završavala u kategoriji raskrsnica i nosila pogrešnu
 * oznaku na kartici.
 */
export function baseCategory(q: Question): Exclude<Category, "sve" | "slika"> {
  if (q.type === "ordering") return "redoslijed";
  if (!q.kind) return !q.image ? "tekst" : ZNAK_RE.test(q.text) ? "znak" : "situacija";
  if (q.kind === "znak") return "znak";
  if (q.kind === "teorija") return "tekst";
  return "situacija"; // policajac, kosnik, situacija, ostalo
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

/**
 * Ključ oznake kategorije za prikaz na kartici pitanja.
 *
 * Oznaka je finija od filtera: komanda policajca i oznake na kolovozu imaju
 * svoje oznake iako u filteru vježbe stoje pod „situacije". Filter ostaje kakav
 * je bio, oznaka samo tačnije opisuje pitanje koje kandidat gleda.
 */
export function badgeKey(q: Question): keyof Dict {
  if (q.type !== "ordering") {
    if (q.kind === "policajac") return "badgePolice";
    if (q.kind === "kosnik") return "badgeMarking";
  }
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
