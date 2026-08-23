"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { imageSize } from "@/lib/imageSizes";
import { loadQuestions, questionPoints } from "@/lib/questions";
import { OPTION_KEYS, type Question } from "@/lib/types";

/** Ocjena jednog pitanja. Nema unosa = još nepregledano. */
type Flag = "ok" | "crop" | "text";

interface Entry {
  flag: Flag;
  note?: string;
}

type Filter = "sve" | "nepregledano" | "oznaceno";

const STORAGE_KEY = "mirav.audit.v1";

const FLAG_LABEL: Record<Flag, string> = {
  ok: "OK",
  crop: "Loš crop",
  text: "Loš tekst/odgovor",
};

const FLAG_TONE: Record<Flag, string> = {
  ok: "border-green bg-green text-white",
  crop: "border-red bg-red text-white",
  text: "border-yellow bg-yellow text-ink",
};

const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: "sve", label: "sve" },
  { value: "nepregledano", label: "nepregledano" },
  { value: "oznaceno", label: "označeno" },
];

/**
 * Revizija svih pitanja sa slikom.
 *
 * Zašto stranica a ne skripta: greške u isijecanju se ne mogu pouzdano
 * prepoznati programski — jedini način je da ih čovjek pogleda. Stanje ide u
 * `localStorage` da revizija (281 slika) može da se radi u više sjedanja, a
 * izvoz daje `audit-report.json`, koji je ulaz za popravku parsera.
 */
export default function AuditBoard() {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<Record<number, Entry>>({});
  const [filter, setFilter] = useState<Filter>("sve");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadQuestions()
      .then(setQuestions)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Greška."));
  }, []);

  // localStorage može pući (privatni prozor, blokirani kolačići) — revizija
  // tada i dalje radi, samo se ne pamti između sjedanja.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setEntries(JSON.parse(raw) as Record<number, Entry>);
    } catch {
      /* bez pamćenja */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return; // ne prepisuj sačuvano prije nego što se pročita
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      /* bez pamćenja */
    }
  }, [entries, loaded]);

  const withImage = useMemo(() => (questions ?? []).filter((q) => q.image), [questions]);

  const visible = useMemo(() => {
    if (filter === "nepregledano") return withImage.filter((q) => !entries[q.id]);
    if (filter === "oznaceno") return withImage.filter((q) => entries[q.id]?.flag !== undefined && entries[q.id]?.flag !== "ok");
    return withImage;
  }, [withImage, entries, filter]);

  const reviewed = withImage.filter((q) => entries[q.id]).length;
  const flagged = withImage.filter((q) => entries[q.id] && entries[q.id]?.flag !== "ok").length;

  const setFlag = useCallback((id: number, flag: Flag) => {
    setEntries((prev) => {
      const next = { ...prev };
      // Ponovni klik na istu ocjenu je poništava — pitanje se vraća u nepregledano.
      if (next[id]?.flag === flag) delete next[id];
      else next[id] = { ...next[id], flag };
      return next;
    });
  }, []);

  const setNote = useCallback((id: number, note: string) => {
    setEntries((prev) => {
      const current = prev[id];
      // Napomena bez ocjene znači da nešto ne valja — podrazumijeva se „loš crop".
      if (!current) return { ...prev, [id]: { flag: "crop", note } };
      return { ...prev, [id]: { ...current, note } };
    });
  }, []);

  /** Izvozi samo označena pitanja — `ok` ne treba nikome dalje. */
  const exportJson = useCallback(() => {
    const report = withImage
      .filter((q) => entries[q.id] && entries[q.id]?.flag !== "ok")
      .map((q) => ({
        id: `q_${String(q.id).padStart(4, "0")}`,
        questionId: q.id,
        image: q.image,
        page: q.page,
        local_no: q.local_no,
        flag: entries[q.id]?.flag,
        note: entries[q.id]?.note ?? "",
      }));
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit-report.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [withImage, entries]);

  if (error) return <p className="p-6 text-red">Greška: {error}</p>;
  if (!questions) return <p className="p-6 text-muted">Učitavanje…</p>;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <header className="panel sticky top-0 z-10 mb-5 p-4">
        <h1 className="mb-1 text-xl font-bold">Revizija pitanja sa slikom</h1>
        <p className="mb-3 text-sm text-muted">
          Interni alat, nije dio kviza. Ocjene se pamte u ovom browseru; {'„Izvezi JSON"'} skida{" "}
          <code>audit-report.json</code> sa označenim pitanjima.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-sm font-bold">
            pregledano {reviewed}/{withImage.length}
          </span>
          <span className="text-sm text-muted">· označeno {flagged}</span>

          <div className="ml-auto flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={`rounded border-2 px-3 py-1 text-sm font-semibold transition-colors ${
                  filter === f.value ? "border-ink bg-ink text-white" : "border-line hover:border-ink"
                }`}
              >
                {f.label}
              </button>
            ))}
            <button
              type="button"
              onClick={exportJson}
              className="rounded border-2 border-blue bg-blue px-3 py-1 text-sm font-semibold text-white"
            >
              Izvezi JSON
            </button>
          </div>
        </div>
      </header>

      <p className="mb-3 text-sm text-muted">prikazano: {visible.length}</p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((q) => {
          const entry = entries[q.id];
          const [w, h] = imageSize(q.image as string);
          return (
            <article key={q.id} className="panel flex flex-col gap-3 p-4">
              <div className="rounded border border-line bg-white p-2">
                <Image
                  src={`/web_images/${q.image}`}
                  alt=""
                  width={w}
                  height={h}
                  className="mx-auto h-auto w-full"
                />
              </div>

              <p className="font-mono text-xs text-muted">
                id={q.id} · {q.image} · str.{q.page}/{q.local_no} · area={q.area} · kind={q.kind}
                {q.subOf !== undefined && ` · podpitanje uz ${q.subOf}`} · {questionPoints(q)} bod.
              </p>

              <p className="text-sm font-semibold">{q.text}</p>

              {q.type === "ordering" ? (
                <p className="text-sm">
                  <span className="tag text-muted">redoslijed</span>{" "}
                  <strong className="text-green">{q.answer_sequence.join("-")}</strong>
                </p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {OPTION_KEYS.map((k) => (
                    <li key={k} className={q.correct === k ? "font-bold text-green" : "text-muted"}>
                      {q.correct === k ? "✓" : "·"} {k}) {q.options[k]}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-auto flex flex-wrap gap-1.5">
                {(Object.keys(FLAG_LABEL) as Flag[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFlag(q.id, f)}
                    className={`rounded border-2 px-2 py-1 text-xs font-bold transition-colors ${
                      entry?.flag === f ? FLAG_TONE[f] : "border-line hover:border-ink"
                    }`}
                  >
                    {FLAG_LABEL[f]}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={entry?.note ?? ""}
                onChange={(e) => setNote(q.id, e.target.value)}
                placeholder="napomena…"
                className="rounded border border-line bg-paper px-2 py-1 text-sm"
              />
            </article>
          );
        })}
      </div>
    </main>
  );
}
