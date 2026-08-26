"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import pocetnaBiblioteka from "@/data/kazne.json";
import pocetnaVeza from "@/data/pitanje-kazna.json";
import { imageSize } from "@/lib/imageSizes";
import {
  PRAZNO_STANJE,
  formatIznos,
  upozorenja as izracunajUpozorenja,
  type BibliotekaKazni,
  type Kazna,
  type PitanjeKazna,
  type VezaPitanjeKazna,
} from "@/lib/kazne";
import { loadQuestions } from "@/lib/questions";
import { OPTION_KEYS, type Question } from "@/lib/types";
import FormaKazne from "./FormaKazne";

const KLJUC = "mirav.kazne.editor.v1";

/**
 * Riječi po kojima se pogađa da pitanje vjerovatno nosi prekršaj. Koriste se
 * samo za opcioni redoslijed „prvo vjerovatne" — ne mijenjaju ništa u podacima.
 */
const VJEROVATNE = /brzin|alkohol|pojas|telefon|pretica|parkir|dozvol|kacig|dijete|sjedišt|prsluk|crveno|pješak|biciklist|prvenstv/i;

type Tab = "pregled" | "pitanja" | "kazne";

interface Sacuvano {
  biblioteka: BibliotekaKazni;
  veza: VezaPitanjeKazna;
  indeks: number;
  vrijeme: string;
}

/**
 * Editor kazni — instruktorka prolazi kroz sva pitanja i za svako kaže koja
 * kazna mu pripada.
 *
 * Sve se dešava u browseru; ništa se ne šalje na server. Rad se čuva u
 * `localStorage` poslije svake radnje, a gotovo stanje se preuzima kao dva
 * JSON fajla koja se commit-uju u repo. Razlog je što je ovo statički sajt bez
 * baze — a i tako je rad vidljiv u istoriji izmjena, umjesto da tiho živi
 * negdje na serveru.
 */
export default function KazneEditor() {
  const [pitanja, setPitanja] = useState<Question[] | null>(null);
  const [biblioteka, setBiblioteka] = useState<BibliotekaKazni>(
    () => pocetnaBiblioteka as BibliotekaKazni,
  );
  const [veza, setVeza] = useState<VezaPitanjeKazna>(() => pocetnaVeza as VezaPitanjeKazna);
  const [indeks, setIndeks] = useState(0);
  const [tab, setTab] = useState<Tab>("pregled");
  const [vjerovatnePrvo, setVjerovatnePrvo] = useState(false);
  const [pretraga, setPretraga] = useState("");
  const [formaOtvorena, setFormaOtvorena] = useState(false);
  const [uredjujeKaznu, setUredjujeKaznu] = useState<Kazna | null>(null);
  const [filterPitanja, setFilterPitanja] = useState<"sve" | "nepregledano" | "bez" | "sa">("sve");
  const [sacuvanoU, setSacuvanoU] = useState<string | null>(null);
  const [nepreuzeto, setNepreuzeto] = useState(false);
  const [ucitano, setUcitano] = useState(false);
  const fajlUnos = useRef<HTMLInputElement>(null);

  // ── učitavanje ────────────────────────────────────────────────────────────
  useEffect(() => {
    loadQuestions()
      .then((qs) => setPitanja([...qs].sort((a, b) => a.id - b.id)))
      .catch(() => setPitanja([]));
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KLJUC);
      if (raw) {
        const s = JSON.parse(raw) as Sacuvano;
        setBiblioteka(s.biblioteka);
        setVeza(s.veza);
        setIndeks(s.indeks ?? 0);
        setSacuvanoU(s.vrijeme ?? null);
        setNepreuzeto(true);
      }
    } catch {
      /* bez zapamćenog stanja — kreće se od fajlova iz repo-a */
    }
    setUcitano(true);
  }, []);

  const snimi = useCallback(
    (b: BibliotekaKazni, v: VezaPitanjeKazna, i: number) => {
      const vrijeme = new Date().toLocaleTimeString("sr-ME", { hour: "2-digit", minute: "2-digit" });
      try {
        window.localStorage.setItem(KLJUC, JSON.stringify({ biblioteka: b, veza: v, indeks: i, vrijeme }));
        setSacuvanoU(vrijeme);
        setNepreuzeto(true);
      } catch {
        setSacuvanoU(null); // prepun localStorage ili privatni prozor
      }
    },
    [],
  );

  // Upozorenje pri zatvaranju taba ako ima nepreuzetih izmjena.
  useEffect(() => {
    if (!nepreuzeto) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [nepreuzeto]);

  // ── redoslijed obilaska ───────────────────────────────────────────────────
  const redoslijed = useMemo(() => {
    if (!pitanja) return [];
    if (!vjerovatnePrvo) return pitanja;
    const bod = (q: Question) => {
      const uOpcijama =
        q.type !== "ordering" && OPTION_KEYS.some((k) => VJEROVATNE.test(q.options[k]));
      return (VJEROVATNE.test(q.text) ? 2 : 0) + (uOpcijama ? 1 : 0);
    };
    return [...pitanja].sort((a, b) => bod(b) - bod(a) || a.id - b.id);
  }, [pitanja, vjerovatnePrvo]);

  const tekuce = redoslijed[Math.min(indeks, Math.max(0, redoslijed.length - 1))];
  const stanje: PitanjeKazna = (tekuce && veza[String(tekuce.id)]) || PRAZNO_STANJE;

  const napredak = useMemo(() => {
    const v = Object.values(veza);
    return {
      pregledano: v.filter((x) => x.pregledano).length,
      sa: v.filter((x) => x.pregledano && x.kazna_id).length,
      bez: v.filter((x) => x.pregledano && x.bez_kazne).length,
      ukupno: Object.keys(veza).length,
    };
  }, [veza]);

  const koristi = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of Object.values(veza)) {
      if (v.kazna_id) m.set(v.kazna_id, (m.get(v.kazna_id) ?? 0) + 1);
    }
    return m;
  }, [veza]);

  // ── radnje ────────────────────────────────────────────────────────────────
  const naprijed = useCallback(() => setIndeks((i) => Math.min(i + 1, redoslijed.length - 1)), [redoslijed.length]);

  const postavi = useCallback(
    (patch: Partial<PitanjeKazna>, idi = true) => {
      if (!tekuce) return;
      const novo: VezaPitanjeKazna = {
        ...veza,
        [String(tekuce.id)]: { ...PRAZNO_STANJE, ...stanje, ...patch },
      };
      setVeza(novo);
      const sljedeci = idi ? Math.min(indeks + 1, redoslijed.length - 1) : indeks;
      snimi(biblioteka, novo, sljedeci);
      if (idi) naprijed();
    },
    [tekuce, veza, stanje, biblioteka, indeks, redoslijed.length, snimi, naprijed],
  );

  const nemaKazne = useCallback(
    () => postavi({ bez_kazne: true, kazna_id: null, pregledano: true }),
    [postavi],
  );

  const dodajKaznu = useCallback(
    (k: Kazna) => {
      const bez = biblioteka.kazne.filter((x) => x.id !== k.id);
      const novaBib: BibliotekaKazni = {
        ...biblioteka,
        kazne: [...bez, k].sort((a, b) => a.kategorija.localeCompare(b.kategorija) || a.naslov.localeCompare(b.naslov)),
        azurirano: new Date().toISOString().slice(0, 10),
      };
      setBiblioteka(novaBib);
      setFormaOtvorena(false);
      if (uredjujeKaznu) {
        // Izmjena postojeće — ne dira vezu, ali mijenja sva pitanja koja je koriste.
        setUredjujeKaznu(null);
        snimi(novaBib, veza, indeks);
        return;
      }
      if (!tekuce) return;
      const novaVeza: VezaPitanjeKazna = {
        ...veza,
        [String(tekuce.id)]: { kazna_id: k.id, bez_kazne: false, pregledano: true },
      };
      setVeza(novaVeza);
      snimi(novaBib, novaVeza, Math.min(indeks + 1, redoslijed.length - 1));
      naprijed();
    },
    [biblioteka, veza, tekuce, indeks, redoslijed.length, uredjujeKaznu, snimi, naprijed],
  );

  // ── tastatura: razmaknica „nema kazne", strelice naprijed/nazad ───────────
  useEffect(() => {
    if (tab !== "pregled" || formaOtvorena) return;
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return; // ne otimaj kucanje
      if (e.key === " ") {
        e.preventDefault();
        nemaKazne();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        naprijed();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndeks((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [tab, formaOtvorena, nemaKazne, naprijed]);

  // ── preuzimanje i učitavanje ──────────────────────────────────────────────
  const upozorenja = useMemo(() => izracunajUpozorenja(biblioteka, veza), [biblioteka, veza]);

  function skini(ime: string, sadrzaj: unknown) {
    const blob = new Blob([JSON.stringify(sadrzaj, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ime;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Preuzima oba fajla. Drugi ide sa malim zastojem — dva programska
   * preuzimanja pokrenuta u istom trenutku browser spoji u jedno i drugi fajl
   * se tiho izgubi. (Uhvaćeno testom: stigao je samo `kazne.json`.)
   */
  function preuzmi() {
    skini("kazne.json", biblioteka);
    window.setTimeout(() => skini("pitanje-kazna.json", veza), 400);
    setNepreuzeto(false);
  }

  async function ucitaj(fajlovi: FileList | null) {
    if (!fajlovi) return;
    let b = biblioteka;
    let v = veza;
    for (const f of Array.from(fajlovi)) {
      try {
        const sadrzaj: unknown = JSON.parse(await f.text());
        if (sadrzaj && typeof sadrzaj === "object" && "kazne" in sadrzaj) b = sadrzaj as BibliotekaKazni;
        else if (sadrzaj && typeof sadrzaj === "object") v = sadrzaj as VezaPitanjeKazna;
      } catch {
        alert(`Fajl ${f.name} nije ispravan JSON.`);
      }
    }
    setBiblioteka(b);
    setVeza(v);
    snimi(b, v, indeks);
    setNepreuzeto(false);
  }

  if (!ucitano || !pitanja) {
    return <p className="p-6 text-muted">Učitavanje…</p>;
  }

  const dugme = "font-display rounded border-2 px-3 py-1.5 text-sm font-bold uppercase tracking-wide";

  return (
    <main className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-5">
      {/* ── traka: napredak, čuvanje, fajlovi ───────────────────────────── */}
      <header className="panel sticky top-0 z-20 mb-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-lg font-bold">Kazne — unos</h1>
          <span className="font-display text-sm font-bold">
            pregledano {napredak.pregledano} / {napredak.ukupno}
          </span>
          <span className="text-sm text-muted">
            sa kaznom {napredak.sa} · bez kazne {napredak.bez}
          </span>
          <span className="ml-auto text-xs text-muted">
            {sacuvanoU ? `sačuvano u ${sacuvanoU}` : "nije sačuvano"}
            {nepreuzeto && " · ima nepreuzetih izmjena"}
          </span>
        </div>

        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-blue transition-[width]"
            style={{ width: `${(napredak.pregledano / Math.max(1, napredak.ukupno)) * 100}%` }}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(["pregled", "pitanja", "kazne"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`${dugme} ${tab === t ? "border-ink bg-ink text-white" : "border-line"}`}>
              {t === "pregled" ? "Pregled" : t === "pitanja" ? "Pitanja" : "Kazne"}
            </button>
          ))}
          <button type="button" onClick={preuzmi} className={`${dugme} ml-auto border-blue bg-blue text-white`}>
            Preuzmi fajlove
          </button>
          <button type="button" onClick={() => fajlUnos.current?.click()} className={`${dugme} border-line`}>
            Učitaj fajlove
          </button>
          <input ref={fajlUnos} type="file" accept=".json" multiple hidden
            onChange={(e) => void ucitaj(e.target.files)} />
        </div>

        {upozorenja.length > 0 && (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-muted">
              {upozorenja.length} upozorenja pri preuzimanju
            </summary>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-muted">
              {upozorenja.slice(0, 12).map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </details>
        )}
      </header>

      {/* ── PREGLED: jedno pitanje po ekranu ─────────────────────────────── */}
      {tab === "pregled" && tekuce && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="tag text-muted">
              Pitanje {indeks + 1} od {redoslijed.length} · id {tekuce.id}
            </span>
            <label className="ml-auto flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={vjerovatnePrvo}
                onChange={(e) => { setVjerovatnePrvo(e.target.checked); setIndeks(0); }}
                className="h-4 w-4 accent-blue" />
              prvo pitanja koja vjerovatno imaju kaznu
            </label>
          </div>

          <article className="panel p-4 sm:p-5">
            {tekuce.image && (
              <div className="mb-3 flex justify-center rounded border border-line bg-white p-2">
                <Image src={`/web_images/${tekuce.image}`} alt=""
                  width={imageSize(tekuce.image)[0]} height={imageSize(tekuce.image)[1]}
                  className="h-auto w-full object-contain"
                  style={{ maxWidth: imageSize(tekuce.image)[0] }} />
              </div>
            )}
            <h2 className="mb-2 text-lg font-bold">{tekuce.text}</h2>
            {tekuce.type === "ordering" ? (
              <p className="text-sm">
                <span className="tag text-muted">redoslijed</span>{" "}
                <strong className="text-green">{tekuce.answer_sequence.join("-")}</strong>
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {OPTION_KEYS.map((k) => (
                  <li key={k} className={tekuce.correct === k ? "font-bold text-green" : "text-muted"}>
                    {tekuce.correct === k ? "✓" : "·"} {k}) {tekuce.options[k]}
                  </li>
                ))}
              </ul>
            )}
          </article>

          <section className="panel p-4 sm:p-5">
            <h3 className="mb-1 font-bold">Kazna za ovaj prekršaj</h3>
            <p className="mb-3 text-sm text-muted">
              Trenutno:{" "}
              {stanje.kazna_id
                ? biblioteka.kazne.find((k) => k.id === stanje.kazna_id)?.naslov ?? stanje.kazna_id
                : stanje.bez_kazne
                  ? "nema kazne"
                  : "nije određeno"}
              {!stanje.pregledano && " · nepregledano"}
            </p>

            <button type="button" onClick={nemaKazne}
              className="font-display w-full rounded bg-ink px-6 py-4 text-lg font-bold tracking-wide text-white uppercase transition-colors hover:bg-blue">
              Nema kazne za ovo pitanje
              <span className="ml-2 text-sm font-normal opacity-70">(razmaknica)</span>
            </button>

            {!formaOtvorena && (
              <>
                <label className="tag mt-5 mb-1 block text-muted" htmlFor="trazi">
                  Ili izaberi postojeću kaznu
                </label>
                <input id="trazi" className="w-full rounded border-2 border-line bg-paper px-3 py-2"
                  value={pretraga} onChange={(e) => setPretraga(e.target.value)}
                  placeholder="traži po nazivu ili kategoriji…" />

                <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
                  {biblioteka.kazne
                    .filter((k) => {
                      const q = pretraga.trim().toLowerCase();
                      return !q || k.naslov.toLowerCase().includes(q) || k.kategorija.toLowerCase().includes(q);
                    })
                    .slice(0, 40)
                    .map((k) => (
                      <li key={k.id}>
                        <button type="button"
                          onClick={() => postavi({ kazna_id: k.id, bez_kazne: false, pregledano: true })}
                          className={`w-full rounded border-2 p-2.5 text-left transition-colors hover:border-blue ${
                            stanje.kazna_id === k.id ? "border-blue bg-blue-soft" : "border-line"
                          }`}>
                          <span className="font-semibold">{k.naslov}</span>
                          <span className="block text-xs text-muted">
                            {k.kategorija} · {formatIznos(k.iznos_min, k.iznos_max)} · {k.clan || "bez člana"}
                            {k.status === "nepotvrdjeno" && " · nepotvrđeno"}
                            {koristi.get(k.id) ? ` · koristi ${koristi.get(k.id)} pitanja` : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>

                <button type="button" onClick={() => setFormaOtvorena(true)}
                  className={`${dugme} mt-3 border-line`}>
                  Napravi novu kaznu
                </button>
              </>
            )}

            {formaOtvorena && (
              <div className="mt-4">
                <FormaKazne postojece={biblioteka.kazne} pregledao={biblioteka.pregledao}
                  onSacuvaj={dodajKaznu} onOdustani={() => setFormaOtvorena(false)} />
              </div>
            )}
          </section>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setIndeks((i) => Math.max(0, i - 1))}
              className={`${dugme} border-line`}>← Nazad</button>
            <button type="button" onClick={naprijed} className={`${dugme} border-line`}>
              Preskoči →
            </button>
            <span className="self-center text-xs text-muted">
              strelice za kretanje · razmaknica za {"„nema kazne“"}
            </span>
          </div>
        </div>
      )}

      {/* ── PITANJA: tabela svih ─────────────────────────────────────────── */}
      {tab === "pitanja" && (
        <div className="panel p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {([["sve", "sve"], ["nepregledano", "nepregledano"], ["bez", "bez kazne"], ["sa", "sa kaznom"]] as const).map(
              ([v, ime]) => (
                <button key={v} type="button" onClick={() => setFilterPitanja(v)}
                  className={`${dugme} ${filterPitanja === v ? "border-ink bg-ink text-white" : "border-line"}`}>
                  {ime}
                </button>
              ),
            )}
          </div>
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-panel">
                <tr className="border-b-2 border-line text-left">
                  <th className="p-2">id</th><th className="p-2">pitanje</th><th className="p-2">stanje</th>
                </tr>
              </thead>
              <tbody>
                {pitanja
                  .filter((q) => {
                    const s = veza[String(q.id)] ?? PRAZNO_STANJE;
                    if (filterPitanja === "nepregledano") return !s.pregledano;
                    if (filterPitanja === "bez") return s.pregledano && s.bez_kazne;
                    if (filterPitanja === "sa") return s.pregledano && Boolean(s.kazna_id);
                    return true;
                  })
                  .map((q) => {
                    const s = veza[String(q.id)] ?? PRAZNO_STANJE;
                    const kazna = s.kazna_id ? biblioteka.kazne.find((k) => k.id === s.kazna_id) : null;
                    return (
                      <tr key={q.id} className="cursor-pointer border-b border-line hover:bg-paper"
                        onClick={() => { setIndeks(redoslijed.findIndex((x) => x.id === q.id)); setTab("pregled"); }}>
                        <td className="p-2 font-mono text-xs">{q.id}</td>
                        <td className="p-2">{q.text.slice(0, 74)}</td>
                        <td className="p-2">
                          {!s.pregledano ? (
                            <span className="text-muted">nepregledano</span>
                          ) : s.bez_kazne ? (
                            <span className="text-green">bez kazne</span>
                          ) : (
                            <span className="text-blue">{kazna?.naslov ?? s.kazna_id}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── KAZNE: biblioteka ────────────────────────────────────────────── */}
      {tab === "kazne" && (
        <div className="space-y-3">
          <div className="panel p-3 sm:p-4">
            <label className="tag mb-1 block text-muted" htmlFor="ime">
              Ime osobe koja potvrđuje (upisuje se u svaku potvrđenu kaznu)
            </label>
            <input id="ime" className="w-full rounded border-2 border-line bg-paper px-3 py-2"
              value={biblioteka.pregledao}
              onChange={(e) => {
                const b = { ...biblioteka, pregledao: e.target.value };
                setBiblioteka(b);
                snimi(b, veza, indeks);
              }} />
          </div>

          {uredjujeKaznu && (
            <FormaKazne postojece={biblioteka.kazne} pregledao={biblioteka.pregledao}
              pocetna={uredjujeKaznu} onSacuvaj={dodajKaznu} onOdustani={() => setUredjujeKaznu(null)} />
          )}

          <div className="panel p-3 sm:p-4">
            <p className="mb-3 text-sm text-muted">
              {biblioteka.kazne.length} kazni · potvrđenih{" "}
              {biblioteka.kazne.filter((k) => k.status === "potvrdjeno").length}. Izmjena jedne kazne
              mijenja <strong>sva pitanja</strong> koja je koriste.
            </p>
            <ul className="space-y-1.5">
              {biblioteka.kazne.map((k) => {
                const n = koristi.get(k.id) ?? 0;
                return (
                  <li key={k.id}>
                    <button type="button" onClick={() => setUredjujeKaznu(k)}
                      className="w-full rounded border-2 border-line p-2.5 text-left hover:border-blue">
                      <span className="font-semibold">{k.naslov}</span>
                      <span className="block text-xs text-muted">
                        {k.kategorija} · {formatIznos(k.iznos_min, k.iznos_max)} ·{" "}
                        {k.clan || "bez člana"} ·{" "}
                        <span className={k.status === "potvrdjeno" ? "text-green" : "text-red"}>
                          {k.status === "potvrdjeno" ? "potvrđeno" : "nepotvrđeno"}
                        </span>{" "}
                        · {n === 0 ? "ne koristi je nijedno pitanje" : `koristi ${n} pitanja`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
