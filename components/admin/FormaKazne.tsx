"use client";

import { useMemo, useState } from "react";
import {
  KATEGORIJE,
  formatIznos,
  moziPotvrditi,
  naslovUSlug,
  type Kazna,
} from "@/lib/kazne";

interface Props {
  /** Postojeće kazne — koriste se za upozorenje o duplikatu i za jedinstven id. */
  postojece: readonly Kazna[];
  /** Ime osobe koja radi pregled; upisuje se u `potvrdio` pri potvrdi. */
  pregledao: string;
  onSacuvaj: (k: Kazna) => void;
  onOdustani: () => void;
  /** Kad se uređuje postojeća kazna umjesto da se pravi nova. */
  pocetna?: Kazna;
}

const prazna = (): Omit<Kazna, "id"> => ({
  kategorija: "Ostalo",
  naslov: "",
  objasnjenje: "",
  iznos_min: null,
  iznos_max: null,
  kazneni_poeni: null,
  zabrana_upravljanja: null,
  clan: "",
  izvor: "Sl. list CG 111/2026",
  status: "nepotvrdjeno",
  potvrdio: "",
  potvrdjeno_dana: "",
  napomena: null,
});

/** Prazno polje daje `null`, ne `0` — nula je iznos, prazno je „ne znam". */
const broj = (v: string): number | null => (v.trim() === "" ? null : Number(v));

export default function FormaKazne({ postojece, pregledao, onSacuvaj, onOdustani, pocetna }: Props) {
  const [k, setK] = useState<Omit<Kazna, "id">>(() => (pocetna ? { ...pocetna } : prazna()));
  const postavi = <K extends keyof Omit<Kazna, "id">>(polje: K, v: Omit<Kazna, "id">[K]) =>
    setK((p) => ({ ...p, [polje]: v }));

  // Slične postojeće kazne — sprječava da se ista kazna unese dvaput.
  const slicne = useMemo(() => {
    const q = k.naslov.trim().toLowerCase();
    if (q.length < 4) return [];
    const rijeci = q.split(/\s+/).filter((w) => w.length > 3);
    return postojece
      .filter((x) => x.id !== pocetna?.id)
      .map((x) => {
        const n = x.naslov.toLowerCase();
        const pogodaka = rijeci.filter((w) => n.includes(w)).length;
        return { x, pogodaka };
      })
      .filter((r) => r.pogodaka > 0)
      .sort((a, b) => b.pogodaka - a.pogodaka)
      .slice(0, 3)
      .map((r) => r.x);
  }, [k.naslov, postojece, pocetna]);

  const provjera = moziPotvrditi(k);

  function sacuvaj(potvrdi: boolean) {
    const id =
      pocetna?.id ??
      (() => {
        const osnova = naslovUSlug(k.naslov) || "kazna";
        let kandidat = osnova;
        let n = 2;
        while (postojece.some((x) => x.id === kandidat)) kandidat = `${osnova}-${n++}`;
        return kandidat;
      })();

    onSacuvaj({
      ...k,
      id,
      naslov: k.naslov.trim(),
      clan: k.clan.trim(),
      izvor: k.izvor.trim(),
      zabrana_upravljanja: k.zabrana_upravljanja?.trim() || null,
      napomena: k.napomena?.trim() || null,
      status: potvrdi ? "potvrdjeno" : "nepotvrdjeno",
      potvrdio: potvrdi ? pregledao : k.potvrdio,
      potvrdjeno_dana: potvrdi ? new Date().toISOString().slice(0, 10) : k.potvrdjeno_dana,
    });
  }

  const polje = "w-full rounded border-2 border-line bg-paper px-3 py-2 focus:border-blue focus:outline-none";
  const oznaka = "tag mb-1 block text-muted";

  return (
    <div className="panel p-4 sm:p-5">
      <h3 className="mb-4 text-lg font-bold">{pocetna ? "Izmjena kazne" : "Nova kazna"}</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={oznaka} htmlFor="naslov">Naslov *</label>
          <input
            id="naslov"
            className={polje}
            value={k.naslov}
            onChange={(e) => postavi("naslov", e.target.value)}
            placeholder="Prekoračenje brzine u naselju za 20–30 km/h"
          />
          {slicne.length > 0 && (
            <div className="mt-2 rounded border-l-4 border-yellow bg-paper p-2.5 text-sm">
              <p className="mb-1 font-semibold">Da li ste mislili na neku od ovih?</p>
              <ul className="space-y-0.5 text-muted">
                {slicne.map((s) => (
                  <li key={s.id}>
                    {s.naslov} <span className="text-xs">({formatIznos(s.iznos_min, s.iznos_max)})</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs text-muted">
                Ako je ista kazna, zatvorite ovu formu i izaberite je iz spiska umjesto da je unosite ponovo.
              </p>
            </div>
          )}
        </div>

        <div>
          <label className={oznaka} htmlFor="kategorija">Kategorija</label>
          <input
            id="kategorija"
            className={polje}
            list="kategorije"
            value={k.kategorija}
            onChange={(e) => postavi("kategorija", e.target.value)}
          />
          <datalist id="kategorije">
            {KATEGORIJE.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div>
          <label className={oznaka} htmlFor="clan">Član zakona * (bez ovoga nema potvrde)</label>
          <input
            id="clan"
            className={polje}
            value={k.clan}
            onChange={(e) => postavi("clan", e.target.value)}
            placeholder="čl. 318 st. 1 tač. 3"
          />
        </div>

        <div className="sm:col-span-2">
          <label className={oznaka} htmlFor="objasnjenje">Objašnjenje — kako biste rekli na času</label>
          <textarea
            id="objasnjenje"
            className={`${polje} min-h-20`}
            value={k.objasnjenje}
            onChange={(e) => postavi("objasnjenje", e.target.value)}
            placeholder="Jedna do dvije rečenice."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={oznaka} htmlFor="min">Iznos od (€)</label>
            <input id="min" type="number" inputMode="numeric" className={polje}
              value={k.iznos_min ?? ""} onChange={(e) => postavi("iznos_min", broj(e.target.value))} />
          </div>
          <div>
            <label className={oznaka} htmlFor="max">Iznos do (€)</label>
            <input id="max" type="number" inputMode="numeric" className={polje}
              value={k.iznos_max ?? ""} onChange={(e) => postavi("iznos_max", broj(e.target.value))} />
          </div>
          <p className="col-span-2 -mt-1 text-xs text-muted">
            Fiksan iznos — upišite isti broj u oba polja.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={oznaka} htmlFor="poeni">Kazneni poeni</label>
            <input id="poeni" type="number" inputMode="numeric" className={polje}
              value={k.kazneni_poeni ?? ""} onChange={(e) => postavi("kazneni_poeni", broj(e.target.value))} />
          </div>
          <div>
            <label className={oznaka} htmlFor="zabrana">Zabrana upravljanja</label>
            <input id="zabrana" className={polje}
              value={k.zabrana_upravljanja ?? ""}
              onChange={(e) => postavi("zabrana_upravljanja", e.target.value)}
              placeholder="3 mjeseca" />
          </div>
        </div>

        <div>
          <label className={oznaka} htmlFor="izvor">Izvor * </label>
          <input id="izvor" className={polje} value={k.izvor}
            onChange={(e) => postavi("izvor", e.target.value)} placeholder="Sl. list CG 111/2026" />
        </div>

        <div>
          <label className={oznaka} htmlFor="napomena">Napomena (interno)</label>
          <input id="napomena" className={polje} value={k.napomena ?? ""}
            onChange={(e) => postavi("napomena", e.target.value)} />
        </div>
      </div>

      {!provjera.moze && (
        <ul className="mt-4 list-disc space-y-0.5 pl-5 text-sm text-muted">
          {provjera.razlozi.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => sacuvaj(true)}
          disabled={!provjera.moze}
          className="font-display rounded bg-green px-5 py-2.5 font-bold tracking-wide text-white uppercase disabled:opacity-40"
        >
          Potvrdi i veži za pitanje
        </button>
        <button
          type="button"
          onClick={() => sacuvaj(false)}
          disabled={!k.naslov.trim()}
          className="font-display rounded border-2 border-line px-5 py-2.5 font-bold tracking-wide uppercase disabled:opacity-40"
        >
          Sačuvaj kao nepotvrđeno
        </button>
        <button
          type="button"
          onClick={onOdustani}
          className="font-display rounded px-5 py-2.5 font-bold tracking-wide text-muted uppercase"
        >
          Odustani
        </button>
      </div>

      <p className="mt-3 text-xs text-muted">
        Nepotvrđena kazna se čuva, ali se <strong>ne prikazuje polaznicima</strong> dok ne dobije
        status {"„potvrđeno“"}.
      </p>
    </div>
  );
}
