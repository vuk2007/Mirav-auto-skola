"use client";

import Image from "next/image";
import { useApp } from "./AppProvider";

/**
 * Zaglavlje pune stranice.
 *
 * Logo je bijeli na plavoj, a plava je **upečena u fajl** (251×108, bez ijednog
 * providnog piksela). Zato stoji kao pločica na svijetlom zaglavlju, a ne kao
 * slika koja se stapa s podlogom — otud `rounded` i `overflow-hidden`, da uglovi
 * ne budu goli pravougaonik.
 *
 * Visina: logo zauzima samo 56% visine platna (ostalo je margina upečena u fajl),
 * pa pločica mora biti osjetno viša od starog logotipa da bi natpis ostao iste
 * veličine. Otud h-12/h-14 umjesto ranijih h-9/h-10.
 *
 * Napomena o boji: plava u logu je #183d73 (tamna mornarska), a brend token
 * `--blue` je #2f6fd0 (svjetlija). To su dvije različite plave i vide se jedna
 * pored druge — vidi „Brend" u README-u.
 *
 * Dostavljeni logo je raster. Ako MIRAV pošalje SVG, dovoljno je zamijeniti
 * public/mirav-logo.png i skinuti `width`/`height`.
 */
export default function BrandHeader() {
  const { goHome, t } = useApp();

  return (
    <header className="bg-panel">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={goHome}
          aria-label={t.backToStart}
          className="flex items-center gap-3 rounded transition-opacity hover:opacity-80"
        >
          <Image
            src="/mirav-logo.png"
            alt="Auto-škola MIRAV"
            width={251}
            height={108}
            priority
            className="h-12 w-auto rounded sm:h-14"
          />
          <span className="diamond h-3 w-3" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
