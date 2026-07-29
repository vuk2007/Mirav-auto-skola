"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LANG, dict, type Dict, type Lang } from "@/lib/i18n";
import { loadLang, saveLang } from "@/lib/storage";

interface AppContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Dict;
  /** Traži povratak na početni ekran (klik na logo). */
  goHome: () => void;
  /** Brojač koji Quiz posmatra; raste sa svakim `goHome`. */
  homeNonce: number;
}

const AppContext = createContext<AppContextValue | null>(null);

/**
 * Jezik i „nazad na početak" žive iznad kviza da bi ih dijelili i djelovi
 * stranice van njega (zaglavlje sa logom, footer). Bez ovoga bi zaglavlje
 * ostalo na crnogorskom i ne bi moglo da vrati kviz na landing, jer je
 * stranica server komponenta.
 */
export default function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);
  const [homeNonce, setHomeNonce] = useState(0);

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

  const goHome = useCallback(() => setHomeNonce((n) => n + 1), []);

  const value = useMemo<AppContextValue>(
    () => ({ lang, setLang, t: dict(lang), goHome, homeNonce }),
    [lang, setLang, goHome, homeNonce],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp mora biti unutar <AppProvider>.");
  return ctx;
}
