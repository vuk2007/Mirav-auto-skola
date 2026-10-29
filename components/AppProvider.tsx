"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LANG, dict, type Dict, type Lang } from "@/lib/i18n";
import { loadLang, saveLang } from "@/lib/storage";
import LiteratureModal from "./LiteratureModal";

interface AppContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Dict;
  /** Traži povratak na početni ekran (klik na logo). */
  goHome: () => void;
  /** Brojač koji Quiz posmatra; raste sa svakim `goHome`. */
  homeNonce: number;
  /** Modal sa literaturom: otvara ga zaglavlje, kviz i rezultat. */
  literatureOpen: boolean;
  setLiteratureOpen: (open: boolean) => void;
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
  const [literatureOpen, setLiteratureOpen] = useState(false);

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
    () => ({ lang, setLang, t: dict(lang), goHome, homeNonce, literatureOpen, setLiteratureOpen }),
    [lang, setLang, goHome, homeNonce, literatureOpen],
  );

  // Modal sa literaturom živi ovdje, a ne u kvizu: otvara se i iz zaglavlja na
  // stranama bez kviza (/kazne, /igra, /simulator).
  return (
    <AppContext.Provider value={value}>
      {children}
      <LiteratureModal open={literatureOpen} onClose={() => setLiteratureOpen(false)} t={value.t} />
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp mora biti unutar <AppProvider>.");
  return ctx;
}
