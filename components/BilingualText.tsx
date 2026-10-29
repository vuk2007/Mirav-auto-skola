import type { Lang } from "@/lib/i18n";
import type { Bilingual } from "@/lib/questions";

/** `lang` atribut za jezik aplikacije — isto kao u AppProvider-u. */
function htmlLang(lang: Lang): string {
  return lang === "me" ? "sr-ME" : lang;
}

/**
 * Tekst pitanja ili odgovora: glavni tekst u stilu roditelja, a ispod njega
 * prevod — manji, izbijeđen, kurziv, bez bolda. Vidi `Bilingual` u lib/questions.ts.
 *
 * „Izbijeđen" je boja `text-muted` (#9aa6b8), a NE providnost: ta boja drži
 * kontrast iznad 4,5:1 i na pozadini i na obojenim podlogama odgovora (vidi
 * qa/kontrast.mjs). Providnost bi ga spustila ispod granice.
 *
 * Prevod je uvijek u fontu teksta, i kad stoji u naslovu pitanja: naslovni
 * font u kurzivu i manjoj veličini se teško čita.
 */
export default function BilingualText({ text }: { text: Bilingual }) {
  return (
    <>
      <span lang={htmlLang(text.primaryLang)}>{text.primary}</span>
      {text.secondary && text.secondaryLang && (
        <span
          lang={htmlLang(text.secondaryLang)}
          className="mt-1.5 block font-body text-[0.88em] leading-snug font-normal tracking-normal text-text-muted normal-case italic"
        >
          {text.secondary}
        </span>
      )}
    </>
  );
}
