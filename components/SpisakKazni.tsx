"use client";

import { useMemo, useState } from "react";
import biblioteka from "@/data/javno/kazne.json";
import { formatIznos, type BibliotekaKazni, type Kazna } from "@/lib/kazne";
import { useApp } from "./AppProvider";

const BIBLIOTEKA = biblioteka as BibliotekaKazni;

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
      <div>
        <h1 className="mb-1 text-2xl font-bold sm:text-3xl">{t.penaltyListTitle}</h1>
        <p className="text-muted">{t.penaltyListLead}</p>
      </div>

      <div className="panel p-4">
        <label className="tag mb-1.5 block text-muted" htmlFor="trazi-kaznu">
          {t.penaltyListSearch}
        </label>
        <input
          id="trazi-kaznu"
          type="search"
          value={pretraga}
          onChange={(e) => setPretraga(e.target.value)}
          className="w-full rounded border-2 border-line bg-paper px-3 py-2.5 focus:border-blue focus:outline-none"
        />
        <p className="mt-2 text-sm text-muted">
          {nadjeno} / {potvrdjene.length}
        </p>
      </div>

      {poKategoriji.map(([kategorija, kazne]) => (
        <section key={kategorija} className="panel p-4 sm:p-5">
          <h2 className="font-display mb-3 text-lg font-bold tracking-wide uppercase">
            {kategorija}
          </h2>
          <ul className="space-y-4">
            {kazne.map((k) => {
              const sankcije = [
                formatIznos(k.iznos_min, k.iznos_max),
                k.kazneni_poeni != null ? `${k.kazneni_poeni} kaznenih poena` : null,
                k.zabrana_upravljanja,
              ].filter((x): x is string => Boolean(x) && x !== "—");
              return (
                <li key={k.id} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
                  <p className="font-semibold">{k.naslov}</p>
                  <p className="font-display mt-0.5 text-xl font-bold text-blue">
                    {sankcije.join(" · ")}
                  </p>
                  {k.objasnjenje && <p className="mt-1.5 text-sm">{k.objasnjenje}</p>}
                  <p className="mt-1.5 text-xs text-muted">
                    {k.clan}
                    {k.izvor && ` · ${k.izvor}`}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {nadjeno === 0 && (
        <p className="panel p-4 text-muted">{t.penaltyListEmpty}</p>
      )}

      <footer className="panel p-4 text-sm text-muted">
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
