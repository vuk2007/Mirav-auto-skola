import { CarFront } from "lucide-react";
import Image from "next/image";

/**
 * Fotografija u heroju početne, sa četiri uspravne riječi desno (kao
 * DISCIPLINA / ZNANJE / SIGURNOST / SLOBODA u referenci).
 *
 * Dok nema prave fotografije auta, stoji tamni placeholder sa obrisom auta.
 * Kad stigne fotografija: staviti je u `public/` i upisati putanju u
 * `FOTOGRAFIJA` — ništa drugo se ne mijenja.
 */
const FOTOGRAFIJA: string | null = null;

export default function HeroFoto({ words }: { words: string }) {
  const rijeci = words.split(" · ");
  return (
    <figure className="relative isolate aspect-[16/11] overflow-hidden rounded-xl border border-glass-line bg-surface @4xl:aspect-square">
      {FOTOGRAFIJA ? (
        <Image src={FOTOGRAFIJA} alt="" fill priority sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
      ) : (
        <div aria-hidden="true" className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_70%_100%,var(--color-accent-soft),transparent_70%),linear-gradient(160deg,var(--color-surface-2),var(--color-bg))]" />
          <CarFront strokeWidth={0.6} className="absolute bottom-[10%] left-1/2 h-2/5 w-2/5 -translate-x-1/2 text-accent-2/20" />
        </div>
      )}
      {/* Tamni prelaz dolje da riječi i ivica ostanu čitljive preko fotografije. */}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-bg/70 via-transparent to-transparent" />

      <figcaption className="absolute top-6 right-6 flex flex-col items-end gap-3 sm:top-8 sm:right-8">
        {rijeci.map((r) => (
          <span
            key={r}
            className="font-display text-[0.625rem] font-semibold tracking-[var(--tracking-label)] text-text-muted uppercase sm:text-[0.6875rem]"
          >
            {r}
          </span>
        ))}
        <span aria-hidden="true" className="mt-1 h-px w-10 bg-accent-2" />
      </figcaption>
    </figure>
  );
}
