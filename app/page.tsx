import Quiz from "@/components/Quiz";
import { EXAM_MINUTES, EXAM_QUESTION_COUNT, EXAM_TIMER_ENABLED, PASS_PERCENT } from "@/lib/config";

export default function HomePage() {
  return (
    <>
      <header className="bg-panel">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-5 sm:px-6">
          <span className="diamond text-xl" aria-hidden="true" />
          <p className="font-display text-2xl leading-none font-bold tracking-wide uppercase sm:text-3xl">
            Auto škola <span className="text-blue">MIRAV</span>
          </p>
          <span className="tag ml-auto text-muted">Teorijski test · B kategorija</span>
        </div>
      </header>

      {/* Potpisni element: isprekidana traka kao oznaka na kolovozu. */}
      <div className="road-line" aria-hidden="true" />

      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="mb-2 text-3xl leading-tight font-bold sm:text-4xl">
          Pripremite se za teorijski ispit
        </h1>
        <p className="mb-6 max-w-prose text-[0.9375rem] text-muted sm:text-base">
          Vježbajte po kategorijama uz trenutni prikaz tačnog odgovora, ili provjerite znanje
          simulacijom ispita: {EXAM_QUESTION_COUNT} pitanja
          {EXAM_TIMER_ENABLED ? `, ${EXAM_MINUTES} minuta` : ""} i prag od {PASS_PERCENT}%
          osvojenih bodova.
        </p>

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
