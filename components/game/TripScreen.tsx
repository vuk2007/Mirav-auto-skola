"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import type { Landmark } from "@/lib/game/road/landmarks";
import {
  NODES,
  type RoadEdge,
  type RoadKind,
  type Smjer,
} from "@/lib/game/road/roadGraph";
import { CITY_LEVEL, SHIFT_VIEW_HALF } from "@/lib/game/sim/config";
import { generateSegment } from "@/lib/game/shift/generate";
import type { RoadTemplate, ViolationType } from "@/lib/game/sim/types";
import { VIOLATION_LABEL, zonesForLevel } from "@/lib/game/ui/labels";
import { createRunner } from "@/lib/game/ui/runner";
import { createSound } from "@/lib/game/ui/sound";
import {
  dionicaZa,
  gdjeSam,
  gradskaVoznja,
  opstina,
  parseTrip,
  smjerovi,
  startTrip,
  stigao,
  znamenitosti,
  type TripState,
} from "@/lib/game/trip/trip";
import type { Dict } from "@/lib/i18n";
import { clearTrip, loadTrip, saveTrip } from "@/lib/storage";
import GameCanvas, { type HudState } from "./GameCanvas";
import DriveControls from "./DriveControls";
import PedalControls from "./PedalControls";
import TripMap from "./TripMap";
import { usePedals } from "./usePedals";
import { useVolan } from "./useVolan";

type Phase = "polazak" | "putokaz" | "voznja" | "grad" | "stigao" | "sudar";

/** Gdje se stalo — po tome se zna šta se ponavlja poslije sudara. */
type Grad = { seed: number; count: number; index: number };

const ROAD_LABEL: Record<RoadKind, keyof Dict> = {
  autoput: "tripRoadAutoput",
  magistrala: "tripRoadMagistrala",
  regionalni: "tripRoadRegionalni",
  planinski: "tripRoadPlaninski",
  gradski: "tripRoadRegionalni",
};

/** Opštine iz kojih se može krenuti — čvorišta i granice nisu polazišta. */
const POLAZISTA = NODES.filter((n) => n.kind === "opstina");

/**
 * Putovanje kroz Crnu Goru.
 *
 * Ekran ima jedno pravilo koje se ne smije prekršiti: ponuđeni pravci dolaze
 * ISKLJUČIVO iz `smjerovi(state)`, dakle iz susjedstva u grafu. Nijedan grad
 * se ovdje ne dopisuje, ne sortira po „logici" niti dodaje zato što bi bilo
 * zgodno — inače bi igra učila polaznika mreži puteva koja ne postoji.
 */
export default function TripScreen({ onExit }: { onExit: () => void }) {
  const { t } = useApp();
  // Dionica se vozi volanom, gradska raskrsnica i dalje pedalama: tamo je
  // putanja zadatak, ne izbor. Zato dva skupa komandi žive jedan pored drugog,
  // a tastaturu sluša samo onaj koji je na ekranu.
  const [uVolanu, setUVolanu] = useState(false);
  const volan = useVolan(uVolanu);
  const pedals = usePedals(!uVolanu);
  const pusti = useCallback(() => {
    volan.release();
    pedals.release();
  }, [volan, pedals]);
  const sound = useMemo(() => createSound(), []);
  const [muted, setMuted] = useState(false);
  useEffect(() => sound.setMuted(muted), [sound, muted]);
  useEffect(() => () => sound.close(), [sound]);

  const [trip, setTrip] = useState<TripState | null>(null);
  const [sacuvano, setSacuvano] = useState<TripState | null>(null);
  const [phase, setPhase] = useState<Phase>("polazak");
  const [ljeto, setLjeto] = useState(true);
  const [edge, setEdge] = useState<RoadEdge | null>(null);
  const [vidjeno, setVidjeno] = useState<Landmark[]>([]);
  const [zabiljezeno, setZabiljezeno] = useState<ViolationType[]>([]);
  const [grad, setGrad] = useState<Grad | null>(null);
  /**
   * Koji je ovo pokušaj iste vožnje.
   *
   * Poslije sudara se vozi ISTA situacija, ali od početka. Bez ovog brojača bi
   * se vratio isti, već potrošeni svijet: platno bi odmah ponovo javilo ishod
   * i ekran bi se zavrtio u petlji.
   */
  const [pokusaj, setPokusaj] = useState(0);
  const [karta, setKarta] = useState(false);
  const [hud, setHud] = useState<HudState>({ speedKmh: 0, t: 0, s: 0 });

  // Sačuvano putovanje se čita tek na klijentu; ako je iz starije verzije
  // grafa, `parseTrip` ga odbija i nudi se novo.
  useEffect(() => setSacuvano(parseTrip(loadTrip())), []);
  useEffect(() => {
    if (trip) saveTrip(trip);
  }, [trip]);

  // Jedna dionica su dvije vrste vožnje: otvoren put do mjesta, pa ulica kroz
  // njega. Obje su običan scenario, pa se platno i komande ne mijenjaju.
  const scenario = useMemo(() => {
    // Van vožnje se scenario ne pravi: poslije dolaska je `trip` već pomjeren,
    // pa bi ista ivica dala dionicu u suprotnom smjeru — nepotreban posao i
    // šablon koji se uzalud upisuje u registar.
    if (!trip || !edge || (phase !== "voznja" && phase !== "grad")) return null;
    if (grad) {
      return generateSegment(grad.seed, CITY_LEVEL, grad.index, { autoput: false });
    }
    return dionicaZa(trip, edge);
  }, [trip, edge, grad, phase]);
  const runner = useMemo(() => {
    // `pokusaj` ulazi ovdje samo da bi poslije sudara nastao NOV svijet.
    // Sjeme ostaje 1, pa se ponavlja ista situacija — mijenja se stanje, ne
    // scenario.
    void pokusaj;
    return scenario ? createRunner(scenario, 1) : null;
  }, [scenario, pokusaj]);
  const tpl = scenario?.template as RoadTemplate | undefined;
  const uGradu = grad !== null;

  const kreni = useCallback(
    (smjer: Smjer) => {
      pusti();
      setUVolanu(true);
      setZabiljezeno([]);
      setGrad(null);
      setPokusaj(0);
      setEdge(smjer.edge);
      setPhase("voznja");
    },
    [pusti],
  );

  const stigaoUMjesto = useCallback(
    (state: TripState, e: RoadEdge) => {
      setVidjeno(znamenitosti(state, e));
      setTrip(stigao(state, e));
      setGrad(null);
      setPhase("stigao");
    },
    [],
  );

  /**
   * Kraj jedne vožnje — dionice ili gradske raskrsnice.
   *
   * Prekršaj NE prekida putovanje — dok pravila otvorenog puta nisu
   * napravljena, jedino što stvarno zaustavlja jeste sudar, jer se kroz drugo
   * vozilo ne može proći. Ostalo se prijavi na dolasku i ide dalje: da
   * prekoračenje brzine ovdje obara vožnju, igra bi kažnjavala po pravilu koje
   * još nije ni objašnjeno.
   *
   * Poslije sudara se ponavlja samo ono što je i palo: raskrsnica ako se pala
   * u gradu, dionica ako se pala na putu. Ponavljati četiri minuta puta zbog
   * sudara na posljednjoj raskrsnici bila bi kazna, a ne ispravka.
   */
  const zavrsi = useCallback(() => {
    if (!trip || !edge || !runner) return;
    const prekrsaji = runner.world.violations;
    if (prekrsaji.some((v) => v.type === "collision")) {
      pusti();
      setPhase("sudar");
      return;
    }
    setZabiljezeno((prije) => [...new Set([...prije, ...prekrsaji.map((v) => v.type)])]);

    // Namjerno NIJE `release()` dok se vožnja nastavlja — isto kao u smjeni:
    // ko drži gas kroz grad mora da ga zadrži i u sljedećoj raskrsnici.
    // Otpuštanje bi mu ga uzelo, a novi pritisak ne stiže jer taster nikad
    // nije ni pušten. Provjera u pregledaču je upravo na ovo i naletjela.
    if (grad) {
      const sljedeca = grad.index + 1;
      if (sljedeca < grad.count) {
        pedals.resetIndicator();
        setGrad({ ...grad, index: sljedeca });
      } else {
        pusti();
        stigaoUMjesto(trip, edge);
      }
      return;
    }
    const ulica = gradskaVoznja(trip, edge);
    if (ulica.count > 0) {
      pedals.resetIndicator();
      // Kroz grad se vozi po zadatoj putanji, pa volan tu ćuti.
      setUVolanu(false);
      setGrad({ ...ulica, index: 0 });
      setPhase("grad");
      return;
    }
    pusti();
    stigaoUMjesto(trip, edge);
  }, [trip, edge, runner, grad, pedals, pusti, stigaoUMjesto]);

  const putokaz = trip ? smjerovi(trip) : null;
  const mjesto = trip ? gdjeSam(trip) : undefined;

  if (!trip || phase === "polazak") {
    return (
      <Okvir t={t} onExit={onExit} muted={muted} setMuted={setMuted}>
        <div className="rounded border border-line bg-panel p-4">
          <h1 className="text-xl font-bold">{t.tripTitle}</h1>
          <p className="mt-1 text-sm text-muted">{t.tripDesc}</p>

          {sacuvano && (
            <button
              type="button"
              onClick={() => {
                setTrip(sacuvano);
                setPhase("putokaz");
              }}
              className="font-display mt-3 w-full rounded border-2 border-blue bg-blue px-4 py-2.5 text-lg font-bold tracking-wide text-white uppercase hover:bg-blue-dark"
            >
              {t.tripResume} — {gdjeSam(sacuvano)?.name}
            </button>
          )}

          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={ljeto}
              onChange={(e) => setLjeto(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <strong>{t.tripSummer}</strong>
              <span className="block text-muted">{t.tripSummerHint}</span>
            </span>
          </label>

          <h2 className="font-display mt-4 text-sm font-bold tracking-wide uppercase">
            {t.tripPickStart}
          </h2>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {POLAZISTA.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  clearTrip();
                  setTrip(startTrip(n.id, Math.floor(Math.random() * 1e9), ljeto));
                  setPhase("putokaz");
                }}
                className="rounded border border-line bg-bg px-2 py-1.5 text-sm hover:border-blue hover:text-blue"
              >
                {n.name}
              </button>
            ))}
          </div>
        </div>
      </Okvir>
    );
  }

  return (
    <Okvir t={t} onExit={onExit} muted={muted} setMuted={setMuted}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-display rounded border border-line bg-panel px-2 py-0.5 text-sm font-semibold tracking-wide uppercase">
          {t.tripKm} {trip.km} km
        </span>
        <span className="font-display rounded border border-line bg-panel px-2 py-0.5 text-sm font-semibold tracking-wide uppercase">
          {t.tripLegs} {trip.legs}
        </span>
        <span className="font-display rounded border border-line bg-panel px-2 py-0.5 text-sm font-semibold tracking-wide uppercase">
          {t.tripTowns} {opstina(trip)}/25
        </span>
        <span className="font-display rounded border border-line bg-panel px-2 py-0.5 text-sm font-semibold tracking-wide uppercase">
          {t.tripCollected} {trip.seen.length}
        </span>
      </div>

      {(phase === "voznja" || phase === "grad") && runner && scenario ? (
        <>
          <div className="relative mx-auto w-full max-w-[min(100%,58vh)]">
            <GameCanvas
              runner={runner}
              inputRef={uVolanu ? volan.inputRef : pedals.inputRef}
              running
              onHud={setHud}
              onFinish={zavrsi}
              flagVehicleId={null}
              officer={scenario.officer ?? null}
              indicatorZones={uGradu ? zonesForLevel(CITY_LEVEL, t) : null}
              level={scenario.difficulty}
              sound={sound}
              camera={{ follow: true, half: uGradu ? SHIFT_VIEW_HALF : tpl?.viewHalf }}
              label={uGradu ? t.tripCity : (scenario.title.me ?? t.tripTitle)}
            />
            <div className="pointer-events-none absolute top-2 left-2 flex flex-col items-start gap-2">
              <div className="flex gap-2">
                <Hud label={t.gameSpeed} value={`${Math.round(hud.speedKmh)} km/h`} />
                <Hud label={t.gameTime} value={`${hud.t.toFixed(0)} s`} />
              </div>
              <p className="max-w-[15rem] rounded border border-line bg-panel/90 px-2 py-1 text-xs font-semibold">
                {grad
                  ? `${t.tripCity} ${grad.index + 1}/${grad.count} — ${mjesto?.name ?? ""}`
                  : scenario.title.me}
              </p>
            </div>
          </div>
          {uVolanu ? (
            <DriveControls
              volan={volan}
              steerLabel={t.gameSteer}
              throttleLabel={t.gameThrottle}
              brakeLabel={t.gameBrake}
            />
          ) : (
            <PedalControls
              pedals={pedals}
              disabled={false}
              throttleLabel={t.gameThrottle}
              brakeLabel={t.gameBrake}
              indicatorLabel={t.gameIndicator}
              leftLabel={t.gameIndicatorLeft}
              rightLabel={t.gameIndicatorRight}
              lanes={null}
            />
          )}
        </>
      ) : phase === "sudar" ? (
        <div className="rounded border border-line bg-panel p-4">
          <p className="font-display text-lg font-bold text-red uppercase">
            {grad ? t.tripCrashJunction : t.tripCrash}
          </p>
          <button
            type="button"
            onClick={() => {
              pusti();
              setPokusaj((n) => n + 1);
              setPhase(grad ? "grad" : "voznja");
            }}
            className="font-display mt-3 w-full rounded border-2 border-blue bg-blue px-4 py-2.5 text-lg font-bold tracking-wide text-white uppercase hover:bg-blue-dark"
          >
            {t.tripRetry}
          </button>
        </div>
      ) : phase === "stigao" ? (
        <div className="rounded border border-line bg-panel p-4">
          <p className="text-sm text-muted">{t.tripArrived}</p>
          <h2 className="font-display text-2xl font-bold">{mjesto?.name}</h2>

          {zabiljezeno.length > 0 && (
            <div className="mt-3 rounded border-l-4 border-l-yellow bg-bg p-3">
              <p className="font-display text-sm font-bold tracking-wide uppercase">
                {t.tripNoted}
              </p>
              <ul className="mt-1 space-y-0.5 text-sm text-muted">
                {zabiljezeno.map((v) => (
                  <li key={v}>{t[VIOLATION_LABEL[v]]}</li>
                ))}
              </ul>
            </div>
          )}

          <h3 className="font-display mt-3 text-sm font-bold tracking-wide uppercase">
            {t.tripSeenHere}
          </h3>
          {vidjeno.length === 0 ? (
            <p className="mt-1 text-sm text-muted">{t.tripNothingSeen}</p>
          ) : (
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {vidjeno.map((l) => (
                <li key={l.id} className="flex items-center gap-2 rounded border border-line bg-bg px-2 py-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.icon} alt="" width={28} height={28} aria-hidden="true" />
                  <span className="text-sm">{l.name}</span>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => setPhase("putokaz")}
            className="font-display mt-3 w-full rounded border-2 border-blue bg-blue px-4 py-2.5 text-lg font-bold tracking-wide text-white uppercase hover:bg-blue-dark"
          >
            {t.tripContinue}
          </button>
        </div>
      ) : (
        putokaz && (
          <div className="rounded border border-line bg-panel p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-2xl font-bold">{mjesto?.name}</h2>
              <button
                type="button"
                onClick={() => setKarta((k) => !k)}
                aria-pressed={karta}
                className="font-display rounded border border-line px-3 py-1 text-sm font-bold tracking-wide uppercase text-muted hover:border-blue hover:text-blue"
              >
                {karta ? t.tripMapHide : t.tripMap}
              </button>
            </div>

            {karta && (
              <div className="mt-3 rounded border border-line bg-bg p-2">
                <TripMap trip={trip} susjedi={putokaz.smjerovi.map((s) => s.to.id)} />
              </div>
            )}

            {putokaz.granica && (
              <div className="mt-2 rounded border-l-4 border-l-red bg-bg p-3">
                <p className="font-display font-bold uppercase">{t.tripBorderTitle}</p>
                <p className="mt-1 text-sm text-muted">{t.tripBorderDesc}</p>
              </div>
            )}
            {putokaz.slijepiKraj && (
              <div className="mt-2 rounded border-l-4 border-l-yellow bg-bg p-3">
                <p className="font-display font-bold uppercase">{t.tripDeadEndTitle}</p>
                <p className="mt-1 text-sm text-muted">{t.tripDeadEndDesc}</p>
              </div>
            )}

            {putokaz.smjerovi.length > 0 && (
              <>
                <h3 className="font-display mt-3 text-sm font-bold tracking-wide uppercase">
                  {t.tripWhereTo}
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {putokaz.smjerovi.map((s) => (
                    <li key={s.edge.id}>
                      <SmjerDugme smjer={s} t={t} onPick={kreni} />
                    </li>
                  ))}
                </ul>
              </>
            )}

            {putokaz.nazad && (
              <button
                type="button"
                onClick={() => putokaz.nazad && kreni(putokaz.nazad)}
                className={`font-display mt-3 w-full rounded border-2 px-4 py-2 font-bold tracking-wide uppercase ${
                  putokaz.krajPuta
                    ? "border-blue bg-blue text-white hover:bg-blue-dark"
                    : "border-line text-muted hover:border-blue hover:text-blue"
                }`}
              >
                {t.tripTurnAround} — {putokaz.nazad.to.name}
              </button>
            )}
          </div>
        )
      )}
    </Okvir>
  );
}

/** Jedan pravac sa putokaza: grad, vrsta puta, kilometraža i oznake. */
function SmjerDugme({
  smjer,
  t,
  onPick,
}: {
  smjer: Smjer;
  t: Dict;
  onPick: (s: Smjer) => void;
}) {
  const e = smjer.edge;
  const oznake = [
    e.seasonal ? t.tripTagSeasonal : null,
    e.ferry ? t.tripTagFerry : null,
    e.verified ? null : t.tripTagUnverified,
  ].filter((x): x is string => x !== null);

  return (
    <button
      type="button"
      onClick={() => onPick(smjer)}
      className="flex w-full items-center gap-3 rounded border border-line bg-bg px-3 py-2 text-left hover:border-blue"
    >
      <span className="flex-1">
        <span className="font-display block text-lg font-bold">{smjer.to.name}</span>
        <span className="block text-xs text-muted">
          {t[ROAD_LABEL[e.kind]]} · {e.km} km · {e.speedLimit} km/h
          {oznake.length > 0 && ` · ${oznake.join(" · ")}`}
        </span>
      </span>
      <span className="font-display text-sm font-bold text-blue uppercase">{t.tripGo} →</span>
    </button>
  );
}

function Okvir({
  t,
  onExit,
  muted,
  setMuted,
  children,
}: {
  t: Dict;
  onExit: () => void;
  muted: boolean;
  setMuted: (f: (m: boolean) => boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onExit}
          className="text-sm font-semibold text-blue underline-offset-4 hover:underline"
        >
          ← {t.tripBack}
        </button>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-pressed={muted}
          aria-label={muted ? t.gameSoundOff : t.gameSoundOn}
          className="rounded border border-line bg-panel px-2 py-0.5 text-sm text-muted hover:text-blue"
        >
          <span aria-hidden="true">{muted ? "🔇" : "🔊"}</span>
        </button>
      </div>
      {children}
    </div>
  );
}

function Hud({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-panel/90 px-2 py-1 text-center">
      <div className="text-[10px] font-semibold tracking-wide text-muted uppercase">{label}</div>
      <div className="font-display text-lg leading-none font-bold">{value}</div>
    </div>
  );
}
