"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { parseGeometry, type EdgeGeometry } from "@/lib/game/road/edgeGeometry";
import { parseKicma, type Kicma } from "@/lib/game/road/kicma";
import { NODES, edgeById, nodeById } from "@/lib/game/road/roadGraph";
import { nadjiRutu, napraviRutu, kilometraza, type Ruta } from "@/lib/game/world/ruta";
import { rutaScenario } from "@/lib/game/world/svijet";
import type { RoadTemplate, ViolationType } from "@/lib/game/sim/types";
import { VIOLATION_LABEL } from "@/lib/game/ui/labels";
import { createRunner } from "@/lib/game/ui/runner";
import { createSound } from "@/lib/game/ui/sound";
import type { Dict } from "@/lib/i18n";
import GameCanvas, { type HudState } from "./GameCanvas";
import PedalControls from "./PedalControls";
import { usePedals } from "./usePedals";

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

/** Geometrija se dovlači jednom po ivici i pamti dok stranica živi. */
const KES = new Map<string, EdgeGeometry>();
/** Isto i za gradske kičme, po čvoru. */
const KES_KICME = new Map<string, Kicma>();

async function dovuciGeometriju(ivice: readonly string[]): Promise<Map<string, EdgeGeometry>> {
  const out = new Map<string, EdgeGeometry>();
  await Promise.all(
    ivice.map(async (id) => {
      const upamceno = KES.get(id);
      if (upamceno) {
        out.set(id, upamceno);
        return;
      }
      const odgovor = await fetch(`/data/osm/edgeGeometry/${id}.json`);
      if (!odgovor.ok) throw new Error(`Nema geometrije za ${id}`);
      const g = parseGeometry(await odgovor.json());
      if (!g) throw new Error(`Neispravna geometrija za ${id}`);
      KES.set(id, g);
      out.set(id, g);
    }),
  );
  return out;
}

/**
 * Gradske kičme za mjesta kroz koja ruta prolazi.
 *
 * Kičma koja nedostaje NIJE greška: taj grad se onda samo dodirne, kao prije
 * nego što su kičme postojale. Zato se ovdje ne baca — traži se, i ako je nema,
 * ide se dalje.
 */
async function dovuciKicme(cvorovi: readonly string[]): Promise<Map<string, Kicma>> {
  const out = new Map<string, Kicma>();
  const kroz = cvorovi.slice(1, -1).filter((c) => nodeById(c)?.kind === "opstina");
  await Promise.all(
    kroz.map(async (id) => {
      const upamceno = KES_KICME.get(id);
      if (upamceno) {
        out.set(id, upamceno);
        return;
      }
      try {
        const odgovor = await fetch(`/data/osm/kicme/${id}.json`);
        if (!odgovor.ok) return;
        const k = parseKicma(await odgovor.json());
        if (!k) return;
        KES_KICME.set(id, k);
        out.set(id, k);
      } catch {
        // Grad bez kičme se samo dodirne — vožnja se zbog toga ne prekida.
      }
    }),
  );
  return out;
}

/**
 * Ivice koje ruta koristi, po čvorovima.
 *
 * `id` ivice nosi čvorove onako kako su unijeti u graf, a ne onako kako se
 * vozi — pa se prava orijentacija PITA graf, ne pogađa. Prva verzija je tražila
 * obje i padala na 404 za onu koja ne postoji.
 */
function iviceRute(cvorovi: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i + 1 < cvorovi.length; i++) {
    const a = cvorovi[i]!;
    const b = cvorovi[i + 1]!;
    const e = edgeById(`${a}--${b}`) ?? edgeById(`${b}--${a}`);
    if (!e) throw new Error(`Graf nema vezu ${a} — ${b}`);
    out.push(e.id);
  }
  return out;
}

export default function RouteScreen({ onExit }: { onExit: () => void }) {
  const { t } = useApp();
  const pedals = usePedals();
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
  // Sastavljanje rute traje, a korisnik u međuvremenu može da se predomisli.
  const zadnji = useRef(0);

  const scenario = useMemo(() => (ruta ? rutaScenario(ruta, 1) : null), [ruta]);
  const runner = useMemo(() => {
    // `pokusaj` je ovdje da bi poslije sudara nastao NOV svijet — ista ruta,
    // isto sjeme, ista situacija od početka.
    void pokusaj;
    return scenario ? createRunner(scenario, 1) : null;
  }, [scenario, pokusaj]);
  const tpl = scenario?.template as RoadTemplate | undefined;

  const kreni = useCallback(async () => {
    const moj = ++zadnji.current;
    setFaza("priprema");
    setGreska(null);
    try {
      const cvorovi = nadjiRutu(od, doK);
      if (!cvorovi || cvorovi.length < 2) throw new Error(t.rutaNoRoute);
      const [geom, kicme] = await Promise.all([
        dovuciGeometriju(iviceRute(cvorovi)),
        dovuciKicme(cvorovi),
      ]);
      if (moj !== zadnji.current) return;
      const napravljena = napraviRutu(cvorovi, geom, kicme);
      if (moj !== zadnji.current) return;
      pedals.release();
      setPokusaj(0);
      setZabiljezeno([]);
      setRuta(napravljena);
      setFaza("voznja");
    } catch (e) {
      if (moj !== zadnji.current) return;
      setGreska(e instanceof Error ? e.message : t.rutaFailed);
      setFaza("greska");
    }
  }, [od, doK, pedals, t]);

  const zavrsi = useCallback(() => {
    if (!runner) return;
    pedals.release();
    const prekrsaji = runner.world.violations;
    // Kao i u putovanju: dok pravila otvorenog puta nisu napravljena, jedino
    // što stvarno zaustavlja jeste sudar. Ostalo se prijavi na dolasku.
    setZabiljezeno([...new Set(prekrsaji.map((v) => v.type))]);
    setFaza(prekrsaji.some((v) => v.type === "collision") ? "sudar" : "kraj");
  }, [runner, pedals]);

  const dionica = ruta ? ruta.dionicaNa(hud.s) : null;
  const redni = ruta && dionica ? ruta.dionice.indexOf(dionica) + 1 : 0;
  const ostalo = ruta ? Math.max(0, ruta.duzina - hud.s) : 0;

  if (faza === "voznja" && runner && scenario && ruta && tpl) {
    return (
      <Okvir t={t} onExit={onExit} muted={muted} setMuted={setMuted}>
        <div className="relative mx-auto w-full max-w-[min(100%,58vh)]">
          <GameCanvas
            runner={runner}
            inputRef={pedals.inputRef}
            running
            onHud={setHud}
            onFinish={zavrsi}
            flagVehicleId={null}
            officer={null}
            indicatorZones={null}
            level={scenario.difficulty}
            sound={sound}
            // Kadar se okreće: bez toga bi se na ruti vozilo bočno preko ekrana.
            camera={{ follow: true, rotate: true, half: tpl.viewHalf }}
            label={ruta.cvorovi.map((c) => nodeById(c)?.name ?? c).join(" — ")}
          />
          <div className="pointer-events-none absolute top-2 left-2 flex flex-col items-start gap-2">
            <div className="flex gap-2">
              <Hud label={t.gameSpeed} value={`${Math.round(hud.speedKmh)} km/h`} />
              <Hud
                label={t.rutaLegs}
                value={`${redni}/${ruta.dionice.length}`}
              />
              <Hud label={t.rutaLeft} value={`${(ostalo / 1000).toFixed(1)} km`} />
            </div>
            <p className="max-w-[16rem] rounded border border-line bg-panel/90 px-2 py-1 text-xs font-semibold">
              {!dionica
                ? ""
                : dionica.vrsta === "grad"
                  ? `${t.tripCity} ${nodeById(dionica.grad ?? "")?.name ?? ""} · ${Math.round(dionica.vMax * 3.6)} km/h`
                  : `${nodeById(dionica.od)?.name ?? dionica.od} → ${nodeById(dionica.do)?.name ?? dionica.do} · ${Math.round(dionica.vMax * 3.6)} km/h`}
            </p>
          </div>
        </div>
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
      </Okvir>
    );
  }

  return (
    <Okvir t={t} onExit={onExit} muted={muted} setMuted={setMuted}>
      <div className="rounded border border-line bg-panel p-4">
        <h1 className="text-xl font-bold">{t.rutaTitle}</h1>
        <p className="mt-1 text-sm text-muted">{t.rutaDesc}</p>

        {faza === "kraj" && (
          <p className="font-display mt-3 text-lg font-bold text-blue uppercase">{t.rutaDone}</p>
        )}
        {faza === "sudar" && (
          <p className="font-display mt-3 text-lg font-bold text-red uppercase">{t.rutaCrash}</p>
        )}
        {faza === "greska" && (
          <p className="font-display mt-3 text-lg font-bold text-red">{greska ?? t.rutaFailed}</p>
        )}

        {(faza === "kraj" || faza === "sudar") && zabiljezeno.length > 0 && (
          <div className="mt-3 rounded border-l-4 border-l-yellow bg-bg p-3">
            <p className="font-display text-sm font-bold tracking-wide uppercase">{t.tripNoted}</p>
            <ul className="mt-1 space-y-0.5 text-sm text-muted">
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

        {ruta && faza !== "priprema" && (
          <p className="mt-3 text-sm text-muted">
            {ruta.cvorovi.map((c) => nodeById(c)?.name ?? c).join(" — ")} ·{" "}
            {kilometraza(ruta)} km · {ruta.dionice.length} {t.rutaLegs.toLowerCase()}
          </p>
        )}

        <button
          type="button"
          onClick={kreni}
          disabled={faza === "priprema" || od === doK}
          className="font-display mt-4 w-full rounded border-2 border-blue bg-blue px-4 py-2.5 text-lg font-bold tracking-wide text-white uppercase hover:bg-blue-dark disabled:opacity-50"
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
      <span className="font-display block font-bold tracking-wide uppercase">{labela}</span>
      <select
        value={vrijednost}
        onChange={(e) => promijeni(e.target.value)}
        className="mt-1 w-full rounded border border-line bg-bg px-2 py-2 text-base"
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
