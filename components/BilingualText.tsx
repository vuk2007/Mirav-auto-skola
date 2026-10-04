import type { Lang } from "@/lib/i18n";
import type { Bilingual } from "@/lib/questions";

/** `lang` atribut za jezik aplikacije — isto kao u AppProvider-u. */
function htmlLang(lang: Lang): string {
  return lang === "me" ? "sr-ME" : lang;
}

/**
 * Tekst pitanja ili odgovora: glavni tekst u stilu roditelja, a ispod njega
 * prevod — manji, sivi, kurziv, bez bolda. Vidi `Bilingual` u lib/questions.ts.
 *
 * Prevod je `text-muted` (#726b5c), a NE providan: ta boja drži kontrast od
 * najmanje 4.5:1 i na bijeloj (5.3) i na obojenim pozadinama odgovora (4.55–5.0).
 * Providnost bi ga spustila ispod granice.
 *
 * Prevod je uvijek u fontu teksta, i kad stoji u naslovu pitanja: uski naslovni
 * font u kurzivu i manjoj veličini se teško čita.
 */
export default function BilingualText({ text }: { text: Bilingual }) {
  return (
    <>
      <span lang={htmlLang(text.primaryLang)}>{text.primary}</span>
      {text.secondary && text.secondaryLang && (
        <span
          lang={htmlLang(text.secondaryLang)}
          className="font-body mt-1 block text-[0.88em] leading-snug font-normal tracking-normal text-muted normal-case italic"
        >
          {text.secondary}
        </span>
      )}
    </>
  );
}
