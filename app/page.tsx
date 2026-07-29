import LangProvider from "@/components/LangProvider";
import Quiz from "@/components/Quiz";
import SiteFooter from "@/components/SiteFooter";

export default function HomePage() {
  return (
    // Jezik obuhvata i kviz i footer, pa prebacivač mijenja cio interfejs.
    <LangProvider>
      <header className="bg-panel">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-5 sm:px-6">
          <span className="diamond text-xl" aria-hidden="true" />
          <p className="font-display text-2xl leading-none font-bold tracking-wide uppercase sm:text-3xl">
            Auto škola <span className="text-blue">MIRAV</span>
          </p>
        </div>
      </header>

      {/* Potpisni element: isprekidana traka kao oznaka na kolovozu. */}
      <div className="road-line" aria-hidden="true" />

      {/* Naslov, opis režima i prebacivač jezika žive u Quiz-u. */}
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <Quiz />
      </main>

      <SiteFooter />
    </LangProvider>
  );
}
