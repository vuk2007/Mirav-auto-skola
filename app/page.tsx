import Quiz from "@/components/Quiz";

export default function HomePage() {
  return (
    <>
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

      {/* Naslov, opis režima i prebacivač jezika žive u Quiz-u (klijentska
          komponenta), da bi izbor jezika mijenjao cio interfejs. */}
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <Quiz />
      </main>

      <footer className="mt-8 border-t border-line bg-panel">
        <div className="mx-auto w-full max-w-3xl px-4 py-5 text-sm text-muted sm:px-6">
          <p>
            Baza pitanja služi isključivo za pripremu i vježbu. Zvanični ispit sprovodi nadležni
            organ.
          </p>
          <p className="mt-1">© {new Date().getFullYear()} Auto škola MIRAV</p>
        </div>
      </footer>
    </>
  );
}
