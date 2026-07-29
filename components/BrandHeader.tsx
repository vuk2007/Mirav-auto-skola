"use client";

import Image from "next/image";
import { useApp } from "./AppProvider";

/**
 * Zaglavlje pune stranice. Logo je na svijetloj podlozi (`--paper`/bijelo) —
 * transparentna verzija ima blagi bijeli rub od anti-aliasing-a, pa se ne
 * stavlja na tamnu ili plavu podlogu.
 *
 * Dostavljeni logo je raster 201×79. Ako MIRAV/Digital Artefakt pošalju SVG ili
 * veći PNG, dovoljno je zamijeniti public/mirav-logo-transparent.png.
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
            src="/mirav-logo-transparent.png"
            alt="Auto-škola MIRAV"
            width={201}
            height={79}
            priority
            className="h-9 w-auto sm:h-10"
          />
          <span className="diamond h-3 w-3" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
