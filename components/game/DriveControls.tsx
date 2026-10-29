"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { HAPTIKA_DODIR, HAPTIKA_PRELAZ, STEER_DEAD_ZONE } from "@/lib/game/sim/config";
import type { PokazivaciRezim } from "@/lib/game/sim/types";
import { haptika } from "@/lib/game/ui/haptika";
import type { Volan } from "./useVolan";

/**
 * Pokazivač pored volana.
 *
 * Kad ga pali igrač, to su dvije sklopke. Kad ga pali simulacija, to su lampice
 * kao na instrument tabli: pokazuju šta je upaljeno, a pritisak na njih ne bi
 * imao šta da promijeni.
 */
export interface DriveIndicator {
  label: string;
  leftLabel: string;
  rightLabel: string;
  rezim: PokazivaciRezim;
  /** Pun naziv automatskog režima — za čitač ekrana. */
  autoLabel: string;
  /** Kratak natpis ispod lampica. */
  autoShort: string;
  /**
   * Stanje pokazivača u simulaciji.
   *
   * Funkcija, a ne vrijednost: čita se svakog kadra zajedno sa klizačima, pa
   * lampica trepće tačno u ritmu auta na platnu, bez ijednog ponovnog crtanja
   * stabla.
   */
  stanje: () => { strana: "left" | "right" | null; svijetli: boolean };
}

interface DriveControlsProps {
  volan: Volan;
  steerLabel: string;
  throttleLabel: string;
  brakeLabel: string;
  /** Pokazivač pravca; bez ovoga se ne crta. */
  indicator?: DriveIndicator | null;
  disabled?: boolean;
  /** Razmak iznad kontrola; u okviru vožnje (`IgraOkvir`) bez njega. */
  className?: string;
}

/** Strana klizača: +1 ili −1 van mrtve zone, 0 u njoj. */
const strana = (v: number): number => (Math.abs(v) < STEER_DEAD_ZONE ? 0 : Math.sign(v));

/** Upali ili ugasi lampicu mimo Reacta; atribut se dira samo kad se promijeni. */
function lampa(el: HTMLElement | null, svijetli: boolean): void {
  if (!el) return;
  const vrijednost = svijetli ? "da" : "ne";
  if (el.dataset.svijetli !== vrijednost) el.dataset.svijetli = vrijednost;
}

/**
 * Volan i gas kao klizači.
 *
 * Oba se drže prstom i oba se puštanjem vraćaju u sredinu. Trag i kvaka se ne
 * crtaju kroz React nego se pomjeraju direktno: vrijednost se mijenja svakog
 * kadra, a ponovni render zbog dva broja bi trošio više nego cijela simulacija.
 *
 * `touch-action: none` je obavezan — bez njega povlačenje po klizaču skroluje
 * stranicu ispod njega, i to je na telefonu jedino što se desi.
 */
export default function DriveControls({
  volan,
  steerLabel,
  throttleLabel,
  brakeLabel,
  indicator = null,
  disabled = false,
  className = "mt-3",
}: DriveControlsProps) {
  const volanKvaka = useRef<HTMLDivElement>(null);
  const gasKvaka = useRef<HTMLDivElement>(null);
  const lijevaLampa = useRef<HTMLDivElement>(null);
  const desnaLampa = useRef<HTMLDivElement>(null);
  // Kroz ref: roditelj pravi novi objekat pri svakom crtanju, a petlja zbog
  // toga ne smije da kreće ispočetka.
  const indicatorRef = useRef(indicator);
  indicatorRef.current = indicator;
  /** Na kojoj strani sredine je gas bio: +1 gas, −1 kočnica, 0 mrtva zona. */
  const gasStrana = useRef(0);

  useEffect(() => {
    let raf = 0;
    const kadar = () => {
      const s = volan.stanjeRef.current;
      // Kvaka ide do ivice staze, umanjeno za svoju polovinu — zato se mjeri
      // staza, a ne kvaka.
      const pomak = (kvaka: HTMLDivElement | null, uspravno: boolean, v: number) => {
        if (!kvaka) return;
        const staza = kvaka.parentElement;
        if (!staza) return;
        const raspon = uspravno
          ? (staza.clientHeight - kvaka.offsetHeight) / 2
          : (staza.clientWidth - kvaka.offsetWidth) / 2;
        const d = v * raspon;
        kvaka.style.transform = uspravno
          ? `translate(-50%, -50%) translateY(${-d}px)`
          : `translate(-50%, -50%) translateX(${d}px)`;
      };
      pomak(volanKvaka.current, false, s.steer);
      pomak(gasKvaka.current, true, s.gas);
      // Lampice se pale kao što se kvake pomjeraju: direktno, svakog kadra.
      const z = indicatorRef.current?.stanje();
      lampa(lijevaLampa.current, z?.strana === "left" && z.svijetli);
      lampa(desnaLampa.current, z?.strana === "right" && z.svijetli);
      raf = requestAnimationFrame(kadar);
    };
    raf = requestAnimationFrame(kadar);
    return () => cancelAnimationFrame(raf);
  }, [volan]);

  /** Vrijednost klizača iz položaja prsta: −1 na jednom kraju, +1 na drugom. */
  const izPolozaja = (e: React.PointerEvent<HTMLDivElement>, uspravno: boolean): number => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = uspravno
      ? 1 - (e.clientY - r.top) / Math.max(1, r.height)
      : (e.clientX - r.left) / Math.max(1, r.width);
    return Math.max(-1, Math.min(1, t * 2 - 1));
  };

  const staza = (uspravno: boolean, koji: "steer" | "gas") => ({
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      const v = izPolozaja(e, uspravno);
      volan.pocniDodir(koji, e.pointerId, v);
      // Dodir potvrđuje da je klizač uhvaćen — pod prstom se to ne vidi.
      haptika(HAPTIKA_DODIR);
      if (koji === "gas") gasStrana.current = strana(v);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || e.buttons === 0) return;
      const v = izPolozaja(e, uspravno);
      volan.pomjeri(e.pointerId, v);
      // Gas je prešao u kočnicu, ili obratno: sredina se prstom ne osjeti.
      if (koji === "gas") {
        const sada = strana(v);
        if (sada !== 0 && gasStrana.current !== 0 && sada !== gasStrana.current) haptika(HAPTIKA_PRELAZ);
        if (sada !== 0) gasStrana.current = sada;
      }
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  // Pokazivač je PREKIDAČ, ne klizač: pritisak ga pali i ostavlja upaljenim.
  // Zato ide na `onClick`, a ne na `pointerdown` kao volan i gas.
  const zmigavac = (side: "left" | "right", label: string, znak: ReactNode) => (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={volan.indicator === side}
      aria-label={`${indicator?.label ?? ""}: ${label}`}
      onClick={() => volan.toggleIndicator(side)}
      className={`font-display flex flex-1 touch-none items-center justify-center rounded-md border text-2xl font-bold transition-colors select-none disabled:opacity-40 ${
        volan.indicator === side
          ? "border-signal-yellow bg-signal-yellow text-bg"
          : "border-glass-line bg-surface text-text-muted"
      }`}
    >
      {znak}
    </button>
  );

  return (
    // Na niskom ekranu (telefon položen) niže, da platnu ostane više mjesta.
    <div className={`${className} flex h-32 items-stretch gap-3 [@media(max-height:500px)]:h-24`}>
      {indicator?.rezim === "rucni" && (
        <div className="flex w-20 flex-col gap-2">
          {zmigavac("left", indicator.leftLabel, <ChevronLeft aria-hidden="true" strokeWidth={2.25} className="h-6 w-6" />)}
          {zmigavac("right", indicator.rightLabel, <ChevronRight aria-hidden="true" strokeWidth={2.25} className="h-6 w-6" />)}
        </div>
      )}
      {indicator?.rezim === "auto" && (
        // Lampice, ne dugmad: pokazivač pali simulacija, pa pritisak ne bi imao
        // šta da promijeni. Svjetlo prati auto na platnu, ne React.
        <div
          role="group"
          aria-label={`${indicator.label}: ${indicator.autoLabel}`}
          className="flex w-20 flex-col gap-1.5"
        >
          {(["left", "right"] as const).map((strana) => (
            <div
              key={strana}
              ref={strana === "left" ? lijevaLampa : desnaLampa}
              data-svijetli="ne"
              aria-hidden="true"
              className="font-display flex flex-1 items-center justify-center rounded-md border border-glass-line bg-surface text-2xl font-bold text-text-muted select-none data-[svijetli=da]:border-signal-yellow data-[svijetli=da]:bg-signal-yellow data-[svijetli=da]:text-bg"
            >
              {strana === "left" ? (
                <ChevronLeft strokeWidth={2.25} className="h-6 w-6" />
              ) : (
                <ChevronRight strokeWidth={2.25} className="h-6 w-6" />
              )}
            </div>
          ))}
          <span className="font-display text-center text-[10px] leading-none font-bold tracking-[var(--tracking-caps)] text-text-muted uppercase">
            {indicator.autoShort}
          </span>
        </div>
      )}

      {/* Volan: puna širina, jer se drži palcem u pokretu. */}
      <div
        className="relative flex-1 touch-none overflow-hidden rounded-md border border-glass-line bg-surface select-none"
        role="slider"
        aria-label={steerLabel}
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={0}
        tabIndex={0}
        {...staza(false, "steer")}
      >
        <div className="pointer-events-none absolute inset-y-4 left-1/2 w-0.5 -translate-x-1/2 bg-glass-line-strong" />
        <div
          ref={volanKvaka}
          data-kvaka="volan"
          className="pointer-events-none absolute top-1/2 left-1/2 flex h-20 w-16 items-center justify-center rounded bg-accent"
        >
          <span className="h-8 w-0.5 rounded bg-white/70" />
        </div>
        <span className="font-display pointer-events-none absolute top-1.5 left-2 text-xs font-bold tracking-[var(--tracking-caps)] text-text-muted uppercase">
          {steerLabel}
        </span>
      </div>

      {/* Gas: uspravno, gore je gas a dolje kočnica — kao i pedale u autu. */}
      <div
        className="relative w-24 touch-none overflow-hidden rounded-md border border-glass-line bg-surface select-none"
        role="slider"
        aria-label={`${throttleLabel} / ${brakeLabel}`}
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={0}
        tabIndex={0}
        {...staza(true, "gas")}
      >
        <div className="pointer-events-none absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 bg-glass-line-strong" />
        <div
          ref={gasKvaka}
          data-kvaka="gas"
          className="pointer-events-none absolute top-1/2 left-1/2 flex h-12 w-16 items-center justify-center rounded bg-ok"
        >
          <span className="h-0.5 w-8 rounded bg-white/70" />
        </div>
        <span className="font-display pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-[var(--tracking-caps)] text-text-muted uppercase">
          {throttleLabel}
        </span>
        <span className="font-display pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-[var(--tracking-caps)] text-text-muted uppercase">
          {brakeLabel}
        </span>
      </div>
    </div>
  );
}
