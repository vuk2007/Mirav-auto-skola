"use client";

import Image from "next/image";
import { useApp } from "./AppProvider";

/**
 * Zaglavlje pune stranice.
 *
 * Logo je tamnoplavi na **prozirnoj** podlozi (2400×686, 77% piksela prozirno),
 * pa ide direktno na svijetlo zaglavlje — bez pločice i bez zaobljenja. Ranija
 * verzija je plavu nosila upečenu u fajlu i zato je morala stajati kao pločica.
 *
 * Visina: sadržaj ide od ivice do ivice platna (gornja i donja margina su 0), pa
 * je h-9/h-10 dovoljno da natpis bude iste veličine kao ranije. Rezolucija je
 * ~10× veća od prvog logotipa, pa je oštar i na retina ekranima.
 *
 * Napomena o boji: plava u logu je #183d73 (tamna mornarska), a brend token
 * `--blue` je #2f6fd0 (svjetlija). To su dvije različite plave i vide se jedna
 * pored druge — vidi „Brend" u README-u.
 *
 * Ako MIRAV pošalje SVG, dovoljno je zamijeniti public/mirav-logo.png i skinuti
 * `width`/`height`.
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
            width={2400}
            height={686}
            priority
            className="h-9 w-auto sm:h-10"
          />
          <span className="diamond h-3 w-3" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
