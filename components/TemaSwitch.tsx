"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { izaberiTemu, pratiUredjaj, pretplatiNaTemu, temaZakljucana, trenutnaTema } from "@/lib/tema";
import { useApp } from "./AppProvider";

/**
 * Prekidač svijetli / tamni režim, u obrisu kao prebacivač jezika. Pokazuje
 * temu u koju vodi: sunce u tamnoj, mjesec u svijetloj. Ikona se bira CSS-om
 * (`svijetla:`), pa je tačna i prije hidratacije; natpis za čitač ekrana
 * dolazi kad se tema pročita. Kad je tema zaključana iz adrese (`?tema=`),
 * prekidača nema.
 */
export default function TemaSwitch({ className = "" }: { className?: string }) {
  const { t } = useApp();
  const tema = useSyncExternalStore(pretplatiNaTemu, trenutnaTema, () => null);
  const zakljucana = useSyncExternalStore(pretplatiNaTemu, temaZakljucana, () => false);

  useEffect(() => pratiUredjaj(), []);

  if (zakljucana) return null;
  const naSvijetlu = tema === "svijetla";
  const natpis = tema === null ? t.temaLabel : naSvijetlu ? t.temaTamna : t.temaSvijetla;
  return (
    <button
      type="button"
      data-qa="tema"
      onClick={() => izaberiTemu(naSvijetlu ? "tamna" : "svijetla")}
      aria-label={natpis}
      title={natpis}
      className={`inline-flex min-h-9 min-w-10 flex-none items-center justify-center rounded-md border border-glass-line bg-glass text-text-muted transition-colors duration-200 hover:border-glass-line-strong hover:text-text ${className}`}
    >
      <Sun aria-hidden="true" strokeWidth={1.75} className="h-4 w-4 svijetla:hidden" />
      <Moon aria-hidden="true" strokeWidth={1.75} className="hidden h-4 w-4 svijetla:block" />
    </button>
  );
}
