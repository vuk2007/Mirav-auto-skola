"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { NODES, nodeById } from "@/lib/game/road/roadGraph";
import { nadjiRutu, napraviRutu, kilometraza, type Ruta } from "@/lib/game/world/ruta";
import { rutaScenario } from "@/lib/game/world/svijet";
import type { Okolina } from "@/lib/game/world/okolina";
import { dovuciGranicu, dovuciVrhove, izvorSaMreze, ucitajOkolinu } from "@/lib/game/world/tiles";
import type { PokazivaciRezim, RoadTemplate, ViolationType } from "@/lib/game/sim/types";
import { pokazivacSvijetli } from "@/lib/game/ui/draw";
import { VIOLATION_LABEL } from "@/lib/game/ui/labels";
import { createRunner } from "@/lib/game/ui/runner";
import { createSound } from "@/lib/game/ui/sound";
import type { Dict } from "@/lib/i18n";
import { SAOBRACAJ_NIVO, type Level } from "@/lib/game/sim/config";
import { loadPokazivaci, loadSaobracaj, savePokazivaci, saveSaobracaj } from "@/lib/storage";
import GameCanvas, { type HudState } from "./GameCanvas";
import IgraOkvir from "./IgraOkvir";
import MiniMapa from "./MiniMapa";
import Brzinomjer from "./Brzinomjer";
import DebugPreklop from "./DebugPreklop";
import DriveControls from "./DriveControls";
import { dovuciGeometriju, dovuciKicme, iviceRute } from "./rutaPodaci";
import PokazivaciIzbor from "./PokazivaciIzbor";
import SaobracajIzbor from "./SaobracajIzbor";
import { useVolan } from "./useVolan";
import { NazadDugme, ZvukDugme } from "./IgraDugmad";

/**
 * Vožnja cijele rute u jednom potezu.
 *
 * Razlika u odnosu na „Putovanje" nije u sadržaju nego u tome što ovdje NEMA
 * granice između dionica: cijela ruta je jedna polilinija i jedan svijet, pa se
 * od Budve do Kolašina vozi bez ijednog ekrana i bez ijednog resetovanja
 * koordinata. Zbog toga se i kadar okreće — na trideset kilometara stvarnog
 * puta smjer se promijeni više puta za pun krug.
 *
 * Geometrija se dovlači sa `public/data/osm/`, pa se ruta sastavlja i sabija.
 * To traje sekundu do dvije, i to se pošteno pokaže: bolje kratko „pripremam"
 * nego zamrznuta stranica. Kad predračun uđe u skriptu, ovo će nestati.
 */

type Faza = "izbor" | "priprema" | "voznja" | "kraj" | "sudar" | "greska";

/** Polazišta i odredišta — samo opštine, kao i na putokazu. */
const MJESTA = NODES.filter((n) => n.kind === "opstina");

export default function RouteScreen({ onExit }: { onExit: () => void }) {
  const { t } = useApp();
  /**
   * Ko pali pokazivač. Pamti se jer je to navika, a ne izbor po vožnji; čita se
   * tek na klijentu, pa prvi prikaz ide sa podrazumijevanim automatskim.
   */
  const [pokazivaci, setPokazivaci] = useState<PokazivaciRezim>("auto");
  useEffect(() => setPokazivaci(loadPokazivaci()), []);
  const promijeniPokazivace = useCallback((rezim: PokazivaciRezim) => {
    setPokazivaci(rezim);
    savePokazivaci(rezim);
  }, []);
  /** Gustina saobraćaja na putu — pamti se isto kao i pokazivači. */
  const [saobracaj, setSaobracaj] = useState<Level>(SAOBRACAJ_NIVO);
  useEffect(() => setSaobracaj(loadSaobracaj()), []);
  const promijeniSaobracaj = useCallback((nivo: Level) => {
    setSaobracaj(nivo);
    saveSaobracaj(nivo);
  }, []);
  // Ruta se vozi volanom: putanja je traka, ne šina.
  const volan = useVolan(true, { pokazivacRukom: pokazivaci === "rucni" });
  const sound = useMemo(() => createSound(), []);
  const [muted, setMuted] = useState(false);
  useEffect(() => sound.setMuted(muted), [sound, muted]);
  useEffect(() => () => sound.close(), [sound]);

  const [od, setOd] = useState("budva");
  const [doK, setDoK] = useState("kolasin");
  const [faza, setFaza] = useState<Faza>("izbor");
  const [greska, setGreska] = useState<string | null>(null);
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [pokusaj, setPokusaj] = useState(0);
  const [hud, setHud] = useState<HudState>({ speedKmh: 0, t: 0, s: 0 });
  const [zabiljezeno, setZabiljezeno] = useState<ViolationType[]>([]);
  const [granica, setGranica] = useState<[number, number][][]>([]);
  /**
   * Okolina stiže u toku vožnje, tile po tile.
   *
   * Drži se u `ref`-u, ne u `state`-u: svaka grupa tile-ova bi inače ponovo
   * nacrtala cijelo stablo, a platno je ionako čita svaki kadar.
   */
  const okolinaRef = useRef<Okolina | null>(null);
  const [okolinaGotova, setOkolinaGotova] = useState(0);
  // Sastavljanje rute traje, a korisnik u međuvremenu može da se predomisli.
  const zadnji = useRef(0);

  const scenario = useMemo(
    () => (ruta ? { ...rutaScenario(ruta, 1, saobracaj), pokazivaci } : null),
    [ruta, pokazivaci, saobracaj],
  );
  const runner = useMemo(() => {
    // `pokusaj` je ovdje da bi poslije sudara nastao NOV svijet — ista ruta,
    // isto sjeme, ista situacija od početka.
    void pokusaj;
    return scenario ? createRunner(scenario, 1) : null;
  }, [scenario, pokusaj]);
  const tpl = scenario?.template as RoadTemplate | undefined;
  // Dev preklop čita svijet kroz funkciju: runner se mijenja sa vožnjom.
  const citajSvijet = useCallback(() => runner?.world ?? null, [runner]);

  /** Stanje pokazivača u simulaciji — za lampice pored volana. */
  const stanjePokazivaca = useCallback(() => {
    const world = runner?.world;
    const strana = world?.vehicles.find((v) => v.kind === "player")?.indicator ?? null;
    return {
      strana,
      svijetli: world !== undefined && strana !== null && pokazivacSvijetli(world.t),
    };
  }, [runner]);

  const kreni = useCallback(async () => {
    const moj = ++zadnji.current;
    setFaza("priprema");
    setGreska(null);
    try {
      const cvorovi = nadjiRutu(od, doK);
      if (!cvorovi || cvorovi.length < 2) throw new Error(t.rutaNoRoute);
      // Vrhovi se dovlače uporedo sa geometrijom: jedan fajl za cijelu državu,
      // pa se ne čeka duže nego što ionako traje najsporiji zahtjev.
      const [geom, kicme, vrhovi, obris] = await Promise.all([
        dovuciGeometriju(iviceRute(cvorovi)),
        dovuciKicme(cvorovi),
        dovuciVrhove(),
        dovuciGranicu(),
      ]);
      if (moj !== zadnji.current) return;
      const napravljena = napraviRutu(cvorovi, geom, kicme);
      if (moj !== zadnji.current) return;
      volan.release();
      setPokusaj(0);
      setZabiljezeno([]);
      okolinaRef.current = null;
      setOkolinaGotova(0);
      setGranica(obris);
      setRuta(napravljena);
      setFaza("voznja");

      // Okolina se dovlači POSLIJE nego što vožnja krene: prvi tile-ovi su oni
      // na početku puta, pa se ono što se vidi pojavi odmah, a ostatak stiže
      // dok se vozi. Čekati sve značilo bi ekran učitavanja, a njih nema.
      void ucitajOkolinu(napravljena, izvorSaMreze, {
        vrhovi,
        prekini: () => moj !== zadnji.current,
        naNapredak: (n) => {
          okolinaRef.current = n.okolina;
          setOkolinaGotova(Math.round((100 * n.gotovo) / Math.max(1, n.ukupno)));
        },
      });
    } catch (e) {
      if (moj !== zadnji.current) return;
      setGreska(e instanceof Error ? e.message : t.rutaFailed);
      setFaza("greska");
    }
  }, [od, doK, volan, t]);

  const zavrsi = useCallback(() => {
    if (!runner) return;
    volan.release();
    const prekrsaji = runner.world.violations;
    // Kao i u putovanju: dok pravila otvorenog puta nisu napravljena, jedino
    // što stvarno zaustavlja jeste sudar. Ostalo se prijavi na dolasku.
    setZabiljezeno([...new Set(prekrsaji.map((v) => v.type))]);
    setFaza(prekrsaji.some((v) => v.type === "collision") ? "sudar" : "kraj");
  }, [runner, volan]);

  const dionica = ruta ? ruta.dionicaNa(hud.s) : null;
  const redni = ruta && dionica ? ruta.dionice.indexOf(dionica) + 1 : 0;
  const ostalo = ruta ? Math.max(0, ruta.duzina - hud.s) : 0;

  if (faza === "voznja" && runner && scenario && ruta && tpl) {
    return (
      <IgraOkvir
        izlaz={{ label: t.tripBack, onClick: onExit }}
        naslov={t.rutaTitle}
        naOtvaranje={() => volan.release()}
        podesavanja={
          <>
            <p className="text-text-muted">
              {ruta.cvorovi.map((c) => nodeById(c)?.name ?? c).join(" — ")} · {kilometraza(ruta)} km · {ruta.dionice.length} {t.rutaLegs.toLowerCase()}
            </p>
            <ZvukDugme muted={muted} onToggle={() => setMuted((m) => !m)} t={t} />
          </>
        }
        kontrole={
        <DriveControls
          className=""
          volan={volan}
          steerLabel={t.gameSteer}
          throttleLabel={t.gameThrottle}
          brakeLabel={t.gameBrake}
          indicator={{
            label: t.gameIndicator,
            leftLabel: t.gameIndicatorLeft,
            rightLabel: t.gameIndicatorRight,
            rezim: pokazivaci,
            autoLabel: t.gameIndicatorAuto,
            autoShort: t.gameIndicatorAutoShort,
            stanje: stanjePokazivaca,
          }}
        />
        }
      >
        <div className="absolute inset-0">
          <GameCanvas
            runner={runner}
            inputRef={volan.inputRef}
            running
            onHud={setHud}
            onFinish={zavrsi}
            flagVehicleId={null}
            officer={null}
            indicatorZones={null}
            level={scenario.difficulty}
            sound={sound}
            // Kadar se okreće: bez toga bi se na ruti vozilo bočno preko ekrana.
            // i gleda se dalje što se brže vozi.
            camera={{ follow: true, rotate: true, naprijed: true, half: tpl.viewHalf }}
            okolinaRef={okolinaRef}
            zvukPokazivaca
            label={ruta.cvorovi.map((c) => nodeById(c)?.name ?? c).join(" — ")}
            ispuni
          />
          <div className="pointer-events-none absolute top-2 left-2 flex flex-col items-start gap-2">
            <div className="flex gap-2">
              <Brzinomjer
                brzina={hud.speedKmh}
                ogranicenje={ruta ? ruta.vMaxNa(hud.s) * 3.6 : null}
                t={t}
              />
              <Hud
                label={t.rutaLegs}
                value={`${redni}/${ruta.dionice.length}`}
              />
              <Hud label={t.rutaLeft} value={`${(ostalo / 1000).toFixed(1)} km`} />
              {okolinaGotova < 100 && (
                <Hud label={t.rutaSurroundings} value={`${okolinaGotova}%`} />
              )}
            </div>
            <p className="max-w-[16rem] rounded-md border border-glass-line bg-surface/85 backdrop-blur-md px-2 py-1 text-xs font-semibold">
              {!dionica
                ? ""
                : dionica.vrsta === "grad"
                  ? `${t.tripCity} ${nodeById(dionica.grad ?? "")?.name ?? ""} · ${Math.round(dionica.vMax * 3.6)} km/h`
                  : `${nodeById(dionica.od)?.name ?? dionica.od} → ${nodeById(dionica.do)?.name ?? dionica.do} · ${Math.round(dionica.vMax * 3.6)} km/h`}
            </p>
          </div>
          <DebugPreklop
            svijet={citajSvijet}
            template={tpl}
            inputRef={volan.inputRef}
            dionica={dionica ? (dionica.edge?.id ?? `grad:${dionica.grad}`) : undefined}
          />
          {/* Mini mapa stoji dolje desno, van puta i van HUD-a: pogleda se kad
              zatreba, a ne zaklanja ono čime se vozi. */}
          {granica.length > 0 && (
            <div className="pointer-events-none absolute right-2 bottom-2">
              <MiniMapa ruta={ruta} s={hud.s} granica={granica} t={t} />
            </div>
          )}
        </div>
      </IgraOkvir>
    );
  }

  return (
    <Okvir t={t} onExit={onExit} muted={muted} setMuted={setMuted}>
      <div className="rounded-md border border-glass-line bg-surface p-4">
        <h1 className="text-xl font-bold">{t.rutaTitle}</h1>
        <p className="mt-1 text-sm text-text-muted">{t.rutaDesc}</p>

        {faza === "kraj" && (
          <p className="font-display mt-3 text-lg font-bold text-accent-2 uppercase">{t.rutaDone}</p>
        )}
        {faza === "sudar" && (
          <p className="font-display mt-3 text-lg font-bold text-err uppercase">{t.rutaCrash}</p>
        )}
        {faza === "greska" && (
          <p className="font-display mt-3 text-lg font-bold text-err">{greska ?? t.rutaFailed}</p>
        )}

        {(faza === "kraj" || faza === "sudar") && zabiljezeno.length > 0 && (
          <div className="mt-3 rounded-md border-l-4 border-l-signal-yellow bg-bg p-3">
            <p className="font-display text-sm font-bold tracking-[var(--tracking-caps)] uppercase">{t.tripNoted}</p>
            <ul className="mt-1 space-y-0.5 text-sm text-text-muted">
              {zabiljezeno.map((v) => (
                <li key={v}>{t[VIOLATION_LABEL[v]]}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Izbor labela={t.rutaFrom} vrijednost={od} promijeni={setOd} />
          <Izbor labela={t.rutaTo} vrijednost={doK} promijeni={setDoK} />
        </div>

        <PokazivaciIzbor vrijednost={pokazivaci} promijeni={promijeniPokazivace} t={t} />
        <SaobracajIzbor vrijednost={saobracaj} promijeni={promijeniSaobracaj} t={t} />

        {ruta && faza !== "priprema" && (
          <p className="mt-3 text-sm text-text-muted">
            {ruta.cvorovi.map((c) => nodeById(c)?.name ?? c).join(" — ")} ·{" "}
            {kilometraza(ruta)} km · {ruta.dionice.length} {t.rutaLegs.toLowerCase()}
          </p>
        )}

        <button
          type="button"
          onClick={kreni}
          disabled={faza === "priprema" || od === doK}
          className="font-display mt-4 w-full rounded-md border border-accent-2 bg-accent px-4 py-2.5 text-lg font-bold tracking-[var(--tracking-caps)] text-white uppercase hover:bg-accent-deep disabled:opacity-50"
        >
          {faza === "priprema" ? t.rutaPrepare : t.rutaGo}
        </button>
      </div>
    </Okvir>
  );
}

function Izbor({
  labela,
  vrijednost,
  promijeni,
}: {
  labela: string;
  vrijednost: string;
  promijeni: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-display block font-bold tracking-[var(--tracking-caps)] uppercase">{labela}</span>
      <select
        value={vrijednost}
        onChange={(e) => promijeni(e.target.value)}
        className="mt-1 w-full rounded-md border border-glass-line bg-bg px-2 py-2 text-base"
      >
        {MJESTA.map((n) => (
          <option key={n.id} value={n.id}>
            {n.name}
          </option>
        ))}
      </select>
    </label>
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
        <NazadDugme onClick={onExit}>{t.tripBack}</NazadDugme>
        <ZvukDugme muted={muted} onToggle={() => setMuted((m) => !m)} t={t} samoIkona />
      </div>
      {children}
    </div>
  );
}

function Hud({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-glass-line bg-surface/85 backdrop-blur-md px-2 py-1 text-center">
      <div className="text-[10px] font-semibold tracking-[var(--tracking-caps)] text-text-muted uppercase">{label}</div>
      <div className="font-display text-lg leading-none font-bold">{value}</div>
    </div>
  );
}
