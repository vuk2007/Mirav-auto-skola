"use client";

import { LANGS, LANG_LABELS } from "@/lib/i18n";
import { useApp } from "./AppProvider";

/**
 * Prebacivač jezika: pet dugmadi u jednom obrisu. `role="group"` i
 * `aria-pressed` ostaju — QA skriptovi i čitači ekrana ga po tome nalaze.
 */
export default function LangSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useApp();
  return (
    <div
      role="group"
      aria-label={t.langLabel}
      className={`inline-flex flex-none overflow-hidden rounded-md border border-glass-line bg-glass ${className}`}
    >
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`min-h-9 min-w-10 px-2.5 font-display text-[0.6875rem] font-bold tracking-[0.12em] transition-colors duration-200 ${
            lang === l ? "bg-accent text-white" : "text-text-muted hover:text-text"
          }`}
        >
          {LANG_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
