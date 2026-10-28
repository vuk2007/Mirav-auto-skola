/**
 * „Kazna za ovaj prekršaj" — uz pitanje i uz prekršaj u igri.
 *
 * Podaci dolaze iz `data/kazne.json` i `data/pitanje-kazna.json`, koje popunjava
 * instruktorka kroz `/admin/kazne`. Prikazuje se **samo** kazna sa statusom
 * `potvrdjeno`; nepotvrđena ne postoji za kandidata.
 *
 * Ovaj fajl se učitava dinamički (vidi `PenaltyLoader.tsx`), pa dok je prikaz
 * kazni isključen podaci ne putuju korisniku uopšte. Zato i ulaz za igru stoji
 * ovdje, a ne u zasebnom fajlu: sve što dodiruje biblioteku kazni mora ostati u
 * istom, dinamički učitanom komadu.
 *
 * JEZIK: `naslov` i `objasnjenje` postoje samo na crnogorskom — instruktorka ih
 * piše jednom, a shema nema polja za prevode. U ostalim jezicima UI-ja tekst
 * kazne ostaje crnogorski, uz kratku napomenu da je tako.
 */

"use client";

import { ChevronDown, Scale } from "lucide-react";
import { useState } from "react";
import biblioteka from "@/data/javno/kazne.json";
import vezaPodaci from "@/data/javno/pitanje-kazna.json";
import type { Dict, Lang } from "@/lib/i18n";
import { formatIznos, type BibliotekaKazni, type Kazna } from "@/lib/kazne";

// `data/javno/` sadrži SAMO potvrđene kazne — pravi ga
// `scripts/gen-kazne-javne.mjs` prije svakog builda. Uvoz punog `data/kazne.json`
// bi u bundle unio i nepotvrđene, koje kandidat ne smije ni da primi.
const BIBLIOTEKA = biblioteka as BibliotekaKazni;
const VEZA = vezaPodaci as Record<string, string>;

const POTVRDJENE = new Map(BIBLIOTEKA.kazne.map((k) => [k.id, k]));

/**
 * Kazna za pitanje, ili `null`.
 *
 * `null` je odgovor u tri različita slučaja, i to je namjerno isto: pitanje nije
 * pregledano, instruktorka je rekla da nema prekršaja, ili je kazna još
 * nepotvrđena. Kandidatu u sva tri slučaja ne treba prikazati ništa.
 */
export function kaznaZaPitanje(questionId: number): Kazna | null {
  const id = VEZA[String(questionId)];
  return id ? (POTVRDJENE.get(id) ?? null) : null;
}

/** Kazna po id-u iz biblioteke — tako je traži igra, preko `Violation.penaltyRef`. */
export function kaznaPoId(id: string): Kazna | null {
  return POTVRDJENE.get(id) ?? null;
}

/** Ima li uopšte ijedne potvrđene kazne — koristi ga spisak kazni. */
export function imaPotvrdjenih(): boolean {
  return POTVRDJENE.size > 0;
}

/** Prikaz jedne kazne. Jedan izgled za kviz i za igru — namjerno. */
function KaznaKartica({
  kazna,
  t,
  lang,
  compact,
}: {
  kazna: Kazna;
  t: Dict;
  lang: Lang;
  compact: boolean;
}) {
  const [otvoreno, setOtvoreno] = useState(!compact);

  const sankcije = [
    formatIznos(kazna.iznos_min, kazna.iznos_max),
    kazna.kazneni_poeni != null ? `${kazna.kazneni_poeni} kaznenih poena` : null,
    kazna.zabrana_upravljanja,
  ].filter((x): x is string => Boolean(x) && x !== "—");

  return (
    // Razdjelnik, a ne kartica u kartici: kazna uvijek stoji unutar panela
    // pitanja ili prekršaja.
    <aside className="mt-5 border-t border-glass-line pt-2">
      <button
        type="button"
        onClick={() => setOtvoreno((x) => !x)}
        aria-expanded={otvoreno}
        className="flex min-h-11 w-full items-center gap-3 text-left"
      >
        <Scale aria-hidden="true" strokeWidth={1.5} className="h-5 w-5 flex-none text-accent-2" />
        <span className="font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-label)] text-accent-2 uppercase">
          {t.penaltyTitle}
        </span>
        <span className="tabular ml-auto font-display text-sm font-bold">{sankcije[0]}</span>
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.5}
          className={`h-4 w-4 flex-none text-text-muted transition-transform duration-200 ease-[var(--ease-izlaz)] ${otvoreno ? "rotate-180" : ""}`}
        />
      </button>

      {otvoreno && (
        <div className="pt-2 pb-1 pl-8">
          <p className="font-semibold">{kazna.naslov}</p>

          <p className="tabular mt-1 font-display text-xl font-bold">{sankcije.join(" · ")}</p>

          {kazna.objasnjenje && <p className="mt-2 text-sm leading-relaxed">{kazna.objasnjenje}</p>}

          <p className="mt-3 text-xs text-text-muted">
            {kazna.clan}
            {kazna.izvor && ` · ${kazna.izvor}`}
          </p>
          <p className="mt-1 text-xs text-text-muted">{t.penaltyNote}</p>

          {lang !== "me" && <p className="mt-1 text-xs text-text-muted">{t.penaltyLanguageNote}</p>}
        </div>
      )}
    </aside>
  );
}

export function PenaltyForQuestion({
  questionId,
  t,
  lang,
  compact = false,
}: {
  questionId: number;
  t: Dict;
  lang: Lang;
  compact?: boolean;
}) {
  const kazna = kaznaZaPitanje(questionId);
  if (!kazna) return null;
  return <KaznaKartica kazna={kazna} t={t} lang={lang} compact={compact} />;
}

/**
 * Kazna za prekršaj u igri („Prođi raskrsnicu").
 *
 * Igra ne zna ništa o biblioteci kazni — nosi samo `penaltyRef`, slug iz
 * `data/kazne.json`. Dok instruktorka tu kaznu ne potvrdi, kartica se ne
 * prikazuje, a prekršaj se i dalje objašnjava pravilom.
 */
export function PenaltyForRef({
  penaltyRef,
  t,
  lang,
  compact = true,
}: {
  penaltyRef: string | null;
  t: Dict;
  lang: Lang;
  compact?: boolean;
}) {
  const kazna = penaltyRef ? kaznaPoId(penaltyRef) : null;
  if (!kazna) return null;
  return <KaznaKartica kazna={kazna} t={t} lang={lang} compact={compact} />;
}

/**
 * Link ka spisku kazni. Stoji u ovom modulu, a ne u navigaciji, iz istog
 * razloga kao i sve ostalo ovdje: da se podaci o kaznama ne povlače dok je
 * prikaz isključen. Link izostaje i kad nema nijedne potvrđene kazne — vodio
 * bi na stranicu koja je tada 404.
 */
export function LinkKazne({ t }: { t: Dict }) {
  if (!imaPotvrdjenih()) return null;
  return (
    <a
      href="/kazne"
      className="inline-flex min-h-11 items-center font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-caps)] text-text-muted uppercase transition-colors hover:text-text"
    >
      {t.penaltyListTitle}
    </a>
  );
}
