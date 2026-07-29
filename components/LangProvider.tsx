"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LANG, dict, type Dict, type Lang } from "@/lib/i18n";
import { loadLang, saveLang } from "@/lib/storage";

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Dict;
}

const LangContext = createContext<LangContextValue | null>(null);

/**
 * Jezik živi iznad kviza da bi ga dijelili i djelovi stranice van njega
 * (npr. footer). Bez ovoga bi prebacivanje na EN/AL ostavilo footer na
 * crnogorskom, jer je stranica server komponenta.
 */
export default function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  // Zapamćeni jezik se čita tek na klijentu — server ne zna za localStorage.
  useEffect(() => {
    const stored = loadLang();
    if (stored) setLangState(stored);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    saveLang(next);
    // Pomaže čitačima ekrana i provjeri pravopisa da znaju jezik sadržaja.
    document.documentElement.lang = next === "me" ? "sr-ME" : next;
  }, []);

  const value = useMemo<LangContextValue>(
    () => ({ lang, setLang, t: dict(lang) }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang mora biti unutar <LangProvider>.");
  return ctx;
}
