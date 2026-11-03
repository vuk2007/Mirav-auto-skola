"use client";

import { MessageSquareWarning } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { Dict, Lang } from "@/lib/i18n";
import { MAX_KONTAKT, MAX_OPIS, MIN_OPIS, VRSTE_PITANJA, VRSTE_SAJTA, type Rezim, type Vrsta } from "@/lib/prijava";
import type { Question } from "@/lib/types";
import { useApp } from "./AppProvider";
import Button from "./ui/Button";

type Stanje = "unos" | "salje" | "poslato" | "kratko" | "greska" | "previse";

const POLJE =
  "w-full rounded-md border border-glass-line-strong bg-surface-2 px-3 py-2.5 text-base text-text placeholder:text-text-muted";
const OZNAKA = "mb-1.5 block text-sm font-medium text-text";

/**
 * Dugme „Prijavi grešku" i forma koja se otvara ispod njega.
 *
 * Forma je u samoj kartici, a ne u modalu: na mirav.me je iframe visok koliko i
 * sadržaj, pa bi se modal centrirao van vidnog polja. Ovako korisnik i dalje
 * vidi pitanje na koje se prijava odnosi. Tokom ispita vrijeme teče dalje.
 */
export default function PrijavaGreske({
  t,
  lang,
  pitanje,
  rezim,
  className = "",
}: {
  t: Dict;
  lang: Lang;
  /** Bez pitanja je prijava za sajt uopšte. */
  pitanje?: Question;
  rezim?: Rezim;
  className?: string;
}) {
  const [otvorena, setOtvorena] = useState(false);
  const [stanje, setStanje] = useState<Stanje>("unos");
  const id = useId();
  const dugme = useRef<HTMLButtonElement>(null);
  const prvoPolje = useRef<HTMLSelectElement>(null);
  const opisPolje = useRef<HTMLTextAreaElement>(null);
  const zatvoriDugme = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (otvorena) prvoPolje.current?.focus();
  }, [otvorena]);

  // Forma nestaje poslije slanja, pa fokus ne smije nestati s njom.
  useEffect(() => {
    if (stanje === "poslato") zatvoriDugme.current?.focus();
  }, [stanje]);

  const zatvori = () => {
    setOtvorena(false);
    setStanje("unos");
    dugme.current?.focus();
  };

  const posalji = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const polja = new FormData(e.currentTarget);
    const opis = String(polja.get("opis") ?? "");
    if (opis.trim().length < MIN_OPIS) {
      setStanje("kratko");
      opisPolje.current?.focus();
      return;
    }

    setStanje("salje");
    try {
      const r = await fetch("/api/prijava", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vrsta: polja.get("vrsta"),
          opis,
          kontakt: polja.get("kontakt"),
          adresaSajta: polja.get("adresa_sajta"),
          jezik: lang,
          rezim,
          pitanjeId: pitanje?.id,
          pitanjeTekst: pitanje?.text,
          stranica: location.pathname + location.search,
          ekran: `${innerWidth}x${innerHeight}, ${document.documentElement.dataset.tema ?? "-"}`,
        }),
      });
      setStanje(r.ok ? "poslato" : r.status === 429 ? "previse" : "greska");
    } catch {
      setStanje("greska");
    }
  };

  const natpisi: Record<Vrsta, string> = {
    odgovor: t.prijavaVrstaOdgovor,
    tekst: t.prijavaVrstaTekst,
    slika: t.prijavaVrstaSlika,
    sajt: t.prijavaVrstaSajt,
    drugo: t.prijavaVrstaDrugo,
  };
  const poruka = stanje === "kratko" ? t.prijavaKratko : stanje === "previse" ? t.prijavaPrevise : t.prijavaGreska;

  return (
    <div className={className}>
      <button
        ref={dugme}
        type="button"
        data-qa="prijava"
        aria-expanded={otvorena}
        aria-controls={otvorena ? id : undefined}
        onClick={() => (otvorena ? zatvori() : setOtvorena(true))}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-text-muted transition-colors hover:text-text"
      >
        <MessageSquareWarning aria-hidden="true" strokeWidth={1.5} className="h-4 w-4 flex-none" />
        {t.prijavaDugme}
      </button>

      {otvorena && (
        <div
          id={id}
          onKeyDown={(e) => {
            if (e.key === "Escape") zatvori();
          }}
          className="mt-1 rounded-lg border border-glass-line bg-glass p-4 text-left"
        >
          {stanje === "poslato" ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p role="status" className="text-sm font-medium text-ok">
                {t.prijavaHvala}
              </p>
              <Button ref={zatvoriDugme} variant="ghost" onClick={zatvori}>
                {t.close}
              </Button>
            </div>
          ) : (
            <form onSubmit={posalji} noValidate aria-label={t.prijavaDugme} className="space-y-3">
              <div>
                <label htmlFor={`${id}-vrsta`} className={OZNAKA}>
                  {t.prijavaVrsta}
                </label>
                <select ref={prvoPolje} id={`${id}-vrsta`} name="vrsta" className={POLJE}>
                  {(pitanje ? VRSTE_PITANJA : VRSTE_SAJTA).map((v) => (
                    <option key={v} value={v}>
                      {natpisi[v]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor={`${id}-opis`} className={OZNAKA}>
                  {t.prijavaOpis}
                </label>
                <textarea
                  ref={opisPolje}
                  id={`${id}-opis`}
                  name="opis"
                  rows={3}
                  maxLength={MAX_OPIS}
                  placeholder={t.prijavaOpisPomoc}
                  aria-invalid={stanje === "kratko"}
                  className={POLJE}
                />
              </div>

              <div>
                <label htmlFor={`${id}-kontakt`} className={OZNAKA}>
                  {t.prijavaKontakt}
                </label>
                <input
                  id={`${id}-kontakt`}
                  name="kontakt"
                  type="text"
                  autoComplete="off"
                  maxLength={MAX_KONTAKT}
                  aria-describedby={`${id}-kontakt-pomoc`}
                  className={POLJE}
                />
                <p id={`${id}-kontakt-pomoc`} className="mt-1.5 text-xs text-text-muted">
                  {t.prijavaKontaktPomoc}
                </p>
              </div>

              {/* Zamka za botove: čovjek ovo polje ne vidi i ne može do njega tabom. */}
              <input
                name="adresa_sajta"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="sr-only"
              />

              {rezim === "ispit" && <p className="text-xs text-text-muted">{t.prijavaIspitVrijeme}</p>}

              {(stanje === "kratko" || stanje === "greska" || stanje === "previse") && (
                <p role="alert" className="text-sm font-medium text-err">
                  {poruka}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" size="md" arrow={false} disabled={stanje === "salje"}>
                  {stanje === "salje" ? t.prijavaSalje : t.prijavaPosalji}
                </Button>
                <Button variant="ghost" onClick={zatvori}>
                  {t.close}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

/** Prijava za sajt uopšte, za djelove strane koji nemaju pitanje (footer, ugrađena verzija). */
export function PrijavaSajta({ className }: { className?: string }) {
  const { t, lang } = useApp();
  return <PrijavaGreske t={t} lang={lang} className={className} />;
}
