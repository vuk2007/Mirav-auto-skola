"use client";

import { Scale, Search } from "lucide-react";
import { useMemo, useState } from "react";
import biblioteka from "@/data/javno/kazne.json";
import { formatIznos, type BibliotekaKazni, type Kazna } from "@/lib/kazne";
import { useApp } from "./AppProvider";
import GlassPanel from "./ui/GlassPanel";
import SectionLabel from "./ui/SectionLabel";

const BIBLIOTEKA = biblioteka as BibliotekaKazni;

const OZNAKA = "font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-label)] uppercase";

/**
 * Spisak kazni — pravi se sam iz biblioteke.
 *
 * Prikazuju se **samo potvrđene** kazne. Nema ručno pisanog spiska koji bi
 * odlutao od onoga što se prikazuje uz pitanja: oba čitaju isti fajl, pa
 * izmjena jedne kazne mijenja i spisak i sva pitanja koja je koriste.
 */
export default function SpisakKazni() {
  const { t } = useApp();
  const [pretraga, setPretraga] = useState("");

  // `data/javno/` već sadrži samo potvrđene — dodatno filtriranje ovdje bi
  // bilo lažna sigurnost, jer bi sugerisalo da fajl može sadržati i druge.
  const potvrdjene = BIBLIOTEKA.kazne;

  const poKategoriji = useMemo(() => {
    const q = pretraga.trim().toLowerCase();
    const nadjene = q
      ? potvrdjene.filter(
          (k) =>
            k.naslov.toLowerCase().includes(q) ||
            k.kategorija.toLowerCase().includes(q) ||
            k.objasnjenje.toLowerCase().includes(q),
        )
      : potvrdjene;

    const mapa = new Map<string, Kazna[]>();
    for (const k of nadjene) mapa.set(k.kategorija, [...(mapa.get(k.kategorija) ?? []), k]);
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], "sr-ME"));
  }, [potvrdjene, pretraga]);

  const posljednja = useMemo(() => {
    const datumi = potvrdjene.map((k) => k.potvrdjeno_dana).filter(Boolean).sort();
    return datumi.at(-1) ?? null;
  }, [potvrdjene]);

  const nadjeno = poKategoriji.reduce((n, [, k]) => n + k.length, 0);

  return (
    <div className="space-y-5">
      <div className="mb-8">
        <SectionLabel className="mb-4">{t.penaltyTitle}</SectionLabel>
        <h1 className="font-display text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">
          {t.penaltyListTitle}
        </h1>
        <p className="mt-3 max-w-xl text-text-muted">{t.penaltyListLead}</p>
      </div>

      <GlassPanel padding="sm" className="sm:p-5">
        <label className={`mb-2 block ${OZNAKA} text-text-muted`} htmlFor="trazi-kaznu">
          {t.penaltyListSearch}
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            strokeWidth={1.5}
            className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-text-muted"
          />
          <input
            id="trazi-kaznu"
            type="search"
            value={pretraga}
            onChange={(e) => setPretraga(e.target.value)}
            className="min-h-12 w-full rounded-md border border-glass-line-strong bg-glass py-2.5 pr-4 pl-12 text-text transition-[border-color,box-shadow] duration-200 ease-[var(--ease-izlaz)] focus:border-accent-2 focus:shadow-glow-sm focus:outline-none"
          />
        </div>
        <p className="tabular mt-3 text-sm text-text-muted">
          {nadjeno} / {potvrdjene.length}
        </p>
      </GlassPanel>

      {poKategoriji.map(([kategorija, kazne]) => (
        <GlassPanel as="section" key={kategorija}>
          <SectionLabel as="h2">{kategorija}</SectionLabel>
          <ul className="mt-2 divide-y divide-glass-line">
            {kazne.map((k) => {
              const sankcije = [
                formatIznos(k.iznos_min, k.iznos_max),
                k.kazneni_poeni != null ? `${k.kazneni_poeni} kaznenih poena` : null,
                k.zabrana_upravljanja,
              ].filter((x): x is string => Boolean(x) && x !== "—");
              return (
                <li key={k.id} className="flex gap-4 py-4 last:pb-0">
                  <Scale aria-hidden="true" strokeWidth={1.5} className="mt-0.5 h-5 w-5 flex-none text-accent-2" />
                  <div className="min-w-0">
                    <p className="font-semibold">{k.naslov}</p>
                    {/* Iznos krupno; poeni i zabrana manje, ispod — inače red postaje predug. */}
                    <p className="tabular mt-1 font-display text-xl font-bold">{sankcije[0]}</p>
                    {sankcije.length > 1 && (
                      <p className="mt-0.5 text-sm font-semibold text-text-muted">{sankcije.slice(1).join(" · ")}</p>
                    )}
                    {k.objasnjenje && <p className="mt-2 text-sm leading-relaxed">{k.objasnjenje}</p>}
                    <p className="mt-2 text-xs text-text-muted">
                      {k.clan}
                      {k.izvor && ` · ${k.izvor}`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </GlassPanel>
      ))}

      {nadjeno === 0 && (
        <GlassPanel>
          <p className="text-text-muted">{t.penaltyListEmpty}</p>
        </GlassPanel>
      )}

      <footer className="border-t border-glass-line pt-5 text-sm leading-relaxed text-text-muted">
        <p>{t.penaltyNote}</p>
        {posljednja && (
          <p className="mt-1.5">
            {t.penaltyListChecked} {posljednja}
            {BIBLIOTEKA.pregledao && ` · ${BIBLIOTEKA.pregledao}`}
          </p>
        )}
      </footer>
    </div>
  );
}
