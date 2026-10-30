"use client";

import { BookOpen, Car, ClipboardCheck, GraduationCap, ShieldCheck, Timer as TimerIkona } from "lucide-react";
import { useState } from "react";
import AnswerOption from "./AnswerOption";
import Badge from "./Badge";
import Button from "./Button";
import GlassPanel from "./GlassPanel";
import HexBadge from "./HexBadge";
import IconCircle from "./IconCircle";
import ListRow, { DividedList } from "./ListRow";
import Modal from "./Modal";
import ProgressBar from "./ProgressBar";
import SectionLabel from "./SectionLabel";
import Timer from "./Timer";

/**
 * Pregled dizajn sistema: sve bazne komponente u svim stanjima, na jednoj
 * strani. Služi za snimke i poređenje sa referencom; nije dio sajta.
 */
export default function UiPregled() {
  const [modal, setModal] = useState(false);
  const [izbor, setIzbor] = useState<string | null>("b");

  return (
    <main className="mx-auto w-full max-w-5xl space-y-12 px-4 py-10 sm:px-8">
      <section className="space-y-5">
        <SectionLabel second="Bolja budućnost">Sigurna vožnja</SectionLabel>
        <h1 className="font-display text-[2.5rem] leading-[1.05] font-extrabold sm:text-6xl">
          Auto škola Mirav
          <span className="block text-accent-2">Više od vožnje.</span>
        </h1>
        <p className="max-w-md text-lg text-text-muted">Znanje koje traje. Povjerenje koje vozi s vama.</p>
        <div className="flex flex-wrap gap-3">
          <Button>Započni obuku</Button>
          <Button variant="secondary">Simulacija ispita</Button>
          <Button variant="ghost" arrow={false}>
            Nazad
          </Button>
          <Button disabled>Onemogućeno</Button>
        </div>
      </section>

      <section className="grid gap-8 md:grid-cols-2">
        <GlassPanel>
          <SectionLabel className="mb-4">Lista prednosti</SectionLabel>
          <DividedList>
            <ListRow leading={<IconCircle icon={Car} />} title="Moderna vozila" subtitle="Sigurna i pouzdana" />
            <ListRow leading={<IconCircle icon={GraduationCap} />} title="Iskusni instruktori" subtitle="Uz vas na svakom koraku" />
            <ListRow leading={<IconCircle icon={ShieldCheck} />} title="Uspjeh je siguran" subtitle="Lista sa razdjelnicima" />
            <ListRow
              leading={<IconCircle icon={ClipboardCheck} size="sm" />}
              title="Duži naslov bez verzala, za nazive scenarija"
              subtitle="Opis ispod naslova u običnom slogu."
              caps={false}
              aside={<Badge tone="accent">Novo</Badge>}
            />
          </DividedList>
        </GlassPanel>

        <div className="space-y-8">
          <div className="flex flex-wrap items-center gap-6">
            <HexBadge caption="od 80 bodova">72</HexBadge>
            <HexBadge tone="ok" caption="Položeno">72</HexBadge>
            <HexBadge tone="err" caption="Nije položeno">54</HexBadge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>Tekstualno pitanje</Badge>
            <Badge tone="accent">3 boda</Badge>
            <Badge tone="ok">Tačno</Badge>
            <Badge tone="err">Netačno</Badge>
            <Badge icon={<TimerIkona strokeWidth={1.5} />}>60 min</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-8">
            <Timer seconds={2700} label="Preostalo" />
            <Timer seconds={245} label="Preostalo" warning />
          </div>
          <ProgressBar current={14} total={40} label="Pitanje 14 / 40" ariaLabel="Napredak" />
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel>Odgovori</SectionLabel>
        <p className="font-display text-xl font-semibold">Prilikom uključivanja u saobraćaj vozač je dužan:</p>
        {(
          [
            ["a", "da upotrijebi zvučni znak upozorenja i da uključi odgovarajući pokazivač pravca"],
            ["b", "da uključi sve pokazivače pravca"],
            ["c", "da se uvjeri da to može učiniti na bezbjedan način"],
          ] as const
        ).map(([k, tekst]) => (
          <AnswerOption
            key={k}
            letter={k}
            selected={izbor === k}
            revealed={false}
            isCorrect={k === "c"}
            disabled={false}
            onSelect={() => setIzbor(k)}
            correctLabel="Tačan odgovor"
            yourLabel="Vaš odgovor"
          >
            {tekst}
          </AnswerOption>
        ))}
        <SectionLabel className="pt-4">Poslije provjere</SectionLabel>
        {[
          ["a", "pogrešan izabrani odgovor", true, false],
          ["b", "neizabrani netačan odgovor", false, false],
          ["c", "tačan odgovor", false, true],
        ].map(([k, tekst, sel, ok]) => (
          <AnswerOption
            key={`r${k}`}
            letter={k as string}
            selected={sel as boolean}
            revealed
            isCorrect={ok as boolean}
            disabled
            onSelect={() => {}}
            correctLabel="Tačan odgovor"
            yourLabel="Vaš odgovor"
          >
            {tekst as string}
          </AnswerOption>
        ))}
      </section>

      <section>
        <Button variant="secondary" icon={<BookOpen strokeWidth={1.5} />} arrow={false} onClick={() => setModal(true)}>
          Otvori modal
        </Button>
        <Modal open={modal} onClose={() => setModal(false)} labelledBy="pregled-modal">
          <SectionLabel className="mb-3">Literatura</SectionLabel>
          <h2 id="pregled-modal" className="mb-3 font-display text-2xl font-bold">
            Zvanični izvori
          </h2>
          <p className="mb-6 text-text-muted">Modal sa fokusom zadržanim unutra; Escape i klik van ga zatvaraju.</p>
          <Button onClick={() => setModal(false)}>Razumijem</Button>
        </Modal>
      </section>
    </main>
  );
}
