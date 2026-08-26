"use client";

import { useState } from "react";

/**
 * Prijava u editor. Lozinka nikad ne napušta polje osim u POST zahtjevu —
 * provjerava je server, klijent dobija samo „da" ili „ne".
 */
export default function Prijava({ imaLozinku }: { imaLozinku: boolean }) {
  const [lozinka, setLozinka] = useState("");
  const [greska, setGreska] = useState<string | null>(null);
  const [salje, setSalje] = useState(false);

  async function posalji(e: React.FormEvent) {
    e.preventDefault();
    setSalje(true);
    setGreska(null);
    try {
      const res = await fetch("/api/admin/prijava", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lozinka }),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      const telo = (await res.json()) as { greska?: string };
      setGreska(telo.greska ?? "Prijava nije uspjela.");
    } catch {
      setGreska("Server nije dostupan.");
    } finally {
      setSalje(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
      <form onSubmit={posalji} className="panel w-full p-6">
        <h1 className="mb-1 text-xl font-bold">Kazne — unos</h1>
        <p className="mb-5 text-sm text-muted">
          Interni alat auto-škole MIRAV. Nije dio kviza.
        </p>

        {!imaLozinku && (
          <p className="mb-4 rounded border-l-4 border-red bg-red-soft p-3 text-sm">
            Na serveru nije postavljen <code>ADMIN_PASSWORD</code>, pa se ne može ući. Postavi ga
            u podešavanjima projekta na Vercelu i ponovo deployuj.
          </p>
        )}

        <label className="tag mb-1.5 block text-muted" htmlFor="lozinka">
          Lozinka
        </label>
        <input
          id="lozinka"
          type="password"
          autoComplete="current-password"
          value={lozinka}
          onChange={(e) => setLozinka(e.target.value)}
          disabled={!imaLozinku || salje}
          className="w-full rounded border-2 border-line bg-paper px-3 py-2.5 focus:border-blue focus:outline-none"
        />

        {greska && <p className="mt-3 text-sm font-semibold text-red">{greska}</p>}

        <button
          type="submit"
          disabled={!imaLozinku || salje || lozinka.length === 0}
          className="font-display mt-5 w-full rounded bg-ink px-6 py-3 text-lg font-bold tracking-wide text-white uppercase transition-colors hover:bg-blue disabled:opacity-40 disabled:hover:bg-ink"
        >
          {salje ? "Provjera…" : "Uđi"}
        </button>
      </form>
    </main>
  );
}
