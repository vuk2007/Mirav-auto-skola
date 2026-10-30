"use client";

import { Building2, Map as MapIcon, Repeat, Route, type LucideIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import LangSwitch from "@/components/LangSwitch";
import TemaSwitch from "@/components/TemaSwitch";
import Button from "@/components/ui/Button";
import GlassPanel from "@/components/ui/GlassPanel";
import IconCircle from "@/components/ui/IconCircle";
import { SCENARIOS, scenarioById } from "@/lib/game/scenarios";
import { loadGameProgress, saveGameAttempt, type GameProgressMap } from "@/lib/storage";
import GameScreen from "./GameScreen";
import ScenarioPicker from "./ScenarioPicker";
import ShiftScreen from "./ShiftScreen";
import RouteScreen from "./RouteScreen";
import TripScreen from "./TripScreen";

/**
 * Grad (faza 6) se učitava tek kad se otvori: model raskrsnica, sudija,
 * zgrade i dekor su desetine kilobajta koje ostali modovi igre ne trebaju.
 */
const GradScreen = dynamic(() => import("./GradScreen"), { ssr: false });

/**
 * Editor grada (faza 6, stavka 6) postoji samo uz `npm run dev` (`/igra?editor=1`):
 * u produkcijskom buildu je uslov konstantno lažan, pa uvoz i cijeli editor
 * ispadaju iz paketa.
 */
const GradEditor =
  process.env.NODE_ENV !== "production" ? dynamic(() => import("./editor/GradEditor"), { ssr: false }) : null;

/**
 * Putovanje i ruta su za sada skriveni od korisnika (odluka 2026-10-18): kod
 * ostaje, ali ulaz postoji samo uz `npm run dev` — u produkcijskom buildu nema
 * dugmeta, pa ni načina da se uđe.
 */
const PRIKAZI_PUTOVANJE_I_RUTU = process.env.NODE_ENV !== "production";

/**
 * Igra „Prođi raskrsnicu" — spisak situacija i jedna situacija u toku.
 *
 * Napredak se čita tek na klijentu (`localStorage` na serveru ne postoji), pa
 * spisak prvi put nacrta sva stanja kao „nije pokušano" i odmah ih zamijeni.
 * Alternativa bi bila da se spisak ne crta dok se ne učita — to bi značilo
 * prazan ekran na svakom otvaranju, zbog podatka koji je čista dekoracija.
 */
export default function GamePage({ showLanguage = true }: { showLanguage?: boolean }) {
  const { lang, t } = useApp();
  const [progress, setProgress] = useState<GameProgressMap>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [shift, setShift] = useState(false);
  const [trip, setTrip] = useState(false);
  const [ruta, setRuta] = useState(false);
  const [grad, setGrad] = useState(false);
  const [editor, setEditor] = useState(false);

  useEffect(() => {
    setProgress(loadGameProgress());
    if (GradEditor && new URLSearchParams(window.location.search).get("editor") === "1") setEditor(true);
  }, []);

  const record = useCallback((id: string, passed: boolean, time: number) => {
    setProgress(saveGameAttempt(id, passed, time));
  }, []);

  const active = activeId ? scenarioById(activeId) : undefined;
  const index = active ? SCENARIOS.findIndex((s) => s.id === active.id) : -1;
  const next = index >= 0 ? SCENARIOS[index + 1] : undefined;

  const onResult = useCallback(
    (passed: boolean, time: number) => {
      if (activeId) record(activeId, passed, time);
    },
    [activeId, record],
  );

  return (
    <div className="space-y-6">
      {/* Unutar kviza prebacivač jezika već stoji u gornjoj traci, pa se ovdje
          izostavlja — dva ista prebacivača jedan iznad drugog samo zbunjuju. */}
      {showLanguage && (
        <div className="flex justify-end gap-2">
          <LangSwitch />
          <TemaSwitch />
        </div>
      )}

      {editor && GradEditor ? (
        <GradEditor />
      ) : grad ? (
        <GradScreen onExit={() => setGrad(false)} />
      ) : ruta ? (
        <RouteScreen onExit={() => setRuta(false)} />
      ) : trip ? (
        <TripScreen onExit={() => setTrip(false)} />
      ) : shift ? (
        <ShiftScreen onExit={() => setShift(false)} />
      ) : active ? (
        <GameScreen
          // Bez ključa bi prelazak na sljedeću situaciju zadržao stanje
          // prethodne (fazu, sjeme, snimak) — scenario je nova partija.
          key={active.id}
          scenario={active}
          onBack={() => setActiveId(null)}
          onNext={next ? () => setActiveId(next.id) : null}
          onResult={onResult}
        />
      ) : (
        <>
          <ScenarioPicker
            scenarios={SCENARIOS}
            progress={progress}
            t={t}
            lang={lang}
            onPick={setActiveId}
          />

          {/* Ostali načini vožnje: jedna lista sa razdjelnicima, ne kartica po
              načinu. Putovanje i ruta postoje samo uz `npm run dev`. */}
          <GlassPanel as="section" padding="none" aria-label={t.gameTitle}>
            <ul className="divide-y divide-glass-line">
              {PRIKAZI_PUTOVANJE_I_RUTU && (
                <>
                  {/* Putovanje stoji ispod spiska, uz smjenu: obje su vožnje bez
                      ocjene po situaciji, samo se jedna vozi u mjestu, a druga kroz
                      zemlju. */}
                  <NacinVoznje ikona={MapIcon} naslov={t.tripTitle} opis={t.tripDesc} dugme={t.tripStart} onClick={() => setTrip(true)} />
                  {/* Ruta stoji uz putovanje: isti putevi, ali bez ijednog zastajanja
                      između dionica — cijela vožnja je jedan svijet. */}
                  <NacinVoznje ikona={Route} naslov={t.rutaTitle} opis={t.rutaDesc} dugme={t.rutaStart} onClick={() => setRuta(true)} />
                </>
              )}
              {/* Grad u razmjeri 1:1 (faza 6) — za sada probna vožnja bez pravila,
                  da se Podgorica pogleda dok se gradi. */}
              <NacinVoznje ikona={Building2} naslov={t.gradTitle} opis={t.gradDesc} dugme={t.gradStart} onClick={() => setGrad(true)} />
              {/* Smjena stoji ispod spiska: prvo se uče situacije, pa se onda vozi
                  bez kraja. */}
              <NacinVoznje ikona={Repeat} naslov={t.shiftTitle} opis={t.shiftDesc} dugme={t.shiftStart} onClick={() => setShift(true)} />
            </ul>
          </GlassPanel>

          {/* „O igri" nosi ono što se nigdje drugo ne vidi, a mora se reći:
              odakle su podaci o putevima i pod kojom licencom. OpenStreetMap
              traži da autorstvo bude vidljivo tamo gdje se podaci koriste. */}
          <section className="border-t border-glass-line pt-5 text-sm leading-relaxed text-text-muted">
            <h2 className="mb-2 font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-label)] uppercase">
              {t.oIgriTitle}
            </h2>
            <p>{t.oIgriDesc}</p>
            <p className="mt-2">
              {t.osmPuno}{" "}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
                className="text-accent-2 underline underline-offset-4 hover:text-text"
              >
                openstreetmap.org/copyright
              </a>
            </p>
          </section>
        </>
      )}
    </div>
  );
}

/** Jedan način vožnje u listi ispod spiska situacija. */
function NacinVoznje({
  ikona,
  naslov,
  opis,
  dugme,
  onClick,
}: {
  ikona: LucideIcon;
  naslov: string;
  opis: string;
  dugme: string;
  onClick: () => void;
}) {
  return (
    <li className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <IconCircle icon={ikona} />
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold">{naslov}</h2>
          <p className="mt-1 text-sm leading-relaxed text-text-muted">{opis}</p>
        </div>
      </div>
      <Button variant="secondary" size="md" onClick={onClick} className="w-full flex-none sm:w-auto">
        {dugme}
      </Button>
    </li>
  );
}
