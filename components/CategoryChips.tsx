"use client";

import { CATEGORIES, type Category } from "@/lib/categories";
import type { Dict } from "@/lib/i18n";

/**
 * Izbor kategorije pitanja kao red chipova. Isti izgled na početnoj i u
 * vježbi; izabrani chip ima plavu ivicu i plavičastu podlogu.
 */
export default function CategoryChips({
  category,
  onChange,
  t,
}: {
  category: Category;
  onChange: (c: Category) => void;
  t: Dict;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t.categoryLabel}>
      {CATEGORIES.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange(c.value)}
          aria-pressed={category === c.value}
          className={`min-h-9 rounded-full border px-4 font-display text-[0.6875rem] font-semibold tracking-[0.08em] uppercase transition-colors duration-200 ${
            category === c.value
              ? "border-accent-2 bg-accent-soft text-text"
              : "border-glass-line text-text-muted hover:border-glass-line-strong hover:text-text"
          }`}
        >
          {t[c.key]}
        </button>
      ))}
    </div>
  );
}
