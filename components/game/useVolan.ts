"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STEER_DEAD_ZONE, STEER_KEY_FALL, STEER_KEY_RISE } from "@/lib/game/sim/config";
import type { Input } from "@/lib/game/sim/types";

/**
 * Volan i gas kao klizači — komande otvorenog puta.
 *
 * Razlika u odnosu na `usePedals` nije samo u obliku dugmeta. Pedala je bila
 * prekidač: pritisnuta ili nije. Klizač ima vrijednost, i ta vrijednost je
 * jedino čime se vozi kad putanja više nije šina.
 *
 * Vrijednosti se drže u `ref`-u, ne u React state-u: mijenjaju se svakog kadra,
 * a simulacija ih čita direktno. Da idu kroz state, stranica bi se ponovo
 * crtala šezdeset puta u sekundi zbog dva broja koja niko ne čita iz DOM-a.
 *
 * Klizač se pušta i vraća u nulu sam. Volan se vraća brže nego što se okreće,
 * kao i u autu.
 */

export interface VolanStanje {
  /** −1 puno lijevo, +1 puno desno. */
  steer: number;
  /** +1 pun gas, −1 puna kočnica. */
  gas: number;
}

export interface Volan {
  /** Ulaz za simulaciju; mijenja se u mjestu. */
  inputRef: React.RefObject<Input>;
  /** Trenutno stanje pokazivača pravca. */
  indicator: "left" | "right" | null;
  /** Prekidač pokazivača: ista strana ga gasi, druga ga prebacuje. */
  toggleIndicator: (side: "left" | "right") => void;
  /** Ugasi pokazivač, a klizače ostavi kako jesu — za prelaz na sljedeću raskrsnicu. */
  resetIndicator: () => void;
  /** Trenutni položaj oba klizača — za crtanje, bez ponovnog rendera. */
  stanjeRef: React.RefObject<VolanStanje>;
  /** Prst je spušten na klizač: vrijednost u [−1, 1]. */
  pocniDodir: (koji: "steer" | "gas", pointerId: number, vrijednost: number) => void;
  /** Prst se pomjerio po klizaču. */
  pomjeri: (pointerId: number, vrijednost: number) => void;
  /** Pusti sve — poziva se na početku i na kraju vožnje. */
  release: () => void;
}

/**
 * `pokazivacRukom` isključuje Q i E kad pokazivač pali simulacija: taster koji
 * ništa ne mijenja samo bi zbunjivao.
 */
export function useVolan(
  aktivno = true,
  { pokazivacRukom = true }: { pokazivacRukom?: boolean } = {},
): Volan {
  const inputRef = useRef<Input>({
    throttle: 0,
    brake: 0,
    indicator: null,
    changeLane: null,
    steer: 0,
  });
  const stanjeRef = useRef<VolanStanje>({ steer: 0, gas: 0 });
  /** Vrijednost koju drži prst; `null` znači da klizač slušá tastaturu. */
  const dodir = useRef<{ steer: number | null; gas: number | null }>({ steer: null, gas: null });
  const prsti = useRef(new Map<number, "steer" | "gas">());
  const tasteri = useRef({ lijevo: false, desno: false, gas: false, kocnica: false });
  const [indicator, setIndicator] = useState<"left" | "right" | null>(null);

  /**
   * Pokazivač je prekidač, ne klizač: pritisak ga pali i ostaje upaljen dok se
   * ne ugasi. Strelice su zauzete volanom, pa mu na tastaturi pripadaju Q i E.
   */
  const toggleIndicator = useCallback((side: "left" | "right") => {
    setIndicator((prev) => {
      const next = prev === side ? null : side;
      inputRef.current.indicator = next;
      return next;
    });
  }, []);

  const resetIndicator = useCallback(() => {
    setIndicator(null);
    inputRef.current.indicator = null;
  }, []);

  const primijeni = useCallback((s: VolanStanje) => {
    stanjeRef.current = s;
    const gas = Math.abs(s.gas) < STEER_DEAD_ZONE ? 0 : s.gas;
    inputRef.current.steer = Math.abs(s.steer) < STEER_DEAD_ZONE ? 0 : s.steer;
    inputRef.current.throttle = Math.max(0, gas);
    inputRef.current.brake = Math.max(0, -gas);
  }, []);

  const release = useCallback(() => {
    prsti.current.clear();
    dodir.current = { steer: null, gas: null };
    tasteri.current = { lijevo: false, desno: false, gas: false, kocnica: false };
    setIndicator(null);
    inputRef.current.indicator = null;
    primijeni({ steer: 0, gas: 0 });
  }, [primijeni]);

  const pocniDodir = useCallback(
    (koji: "steer" | "gas", pointerId: number, vrijednost: number) => {
      prsti.current.set(pointerId, koji);
      dodir.current[koji] = Math.max(-1, Math.min(1, vrijednost));
    },
    [],
  );

  const pomjeri = useCallback((pointerId: number, vrijednost: number) => {
    const koji = prsti.current.get(pointerId);
    if (!koji) return;
    dodir.current[koji] = Math.max(-1, Math.min(1, vrijednost));
  }, []);

  // Tastatura: taster je uključen ili isključen, pa se volan ka krajnjem
  // položaju gura postepeno. Bez toga bi se u jednom kadru našao na kraju, a
  // auto bi na sto na sat preskočio pola trake.
  useEffect(() => {
    if (!aktivno) return;
    const strana = (e: KeyboardEvent): keyof typeof tasteri.current | null => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") return "lijevo";
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") return "desno";
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") return "gas";
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") return "kocnica";
      return null;
    };
    // Kucanje u polju (pretraga cilja, stavka 9) nije vožnja.
    const uPolju = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (uPolju(e)) return;
      if (e.key === "q" || e.key === "Q" || e.key === "e" || e.key === "E") {
        // Kad pokazivač pali simulacija, Q i E nemaju šta da mijenjaju.
        if (!pokazivacRukom) return;
        e.preventDefault();
        if (!e.repeat) toggleIndicator(e.key === "q" || e.key === "Q" ? "left" : "right");
        return;
      }
      const k = strana(e);
      if (!k) return;
      e.preventDefault(); // strelice inače skroluju stranicu ispod platna
      tasteri.current[k] = true;
    };
    const up = (e: KeyboardEvent) => {
      const k = strana(e);
      if (!k) return;
      tasteri.current[k] = false;
    };
    const pointerUp = (e: PointerEvent) => {
      const koji = prsti.current.get(e.pointerId);
      if (!koji) return;
      prsti.current.delete(e.pointerId);
      dodir.current[koji] = null;
    };
    // Bez ovoga klizač ostane „držan" kad prozor izgubi fokus, pa vozilo
    // nastavi punim gasom dok igrač gleda drugi tab.
    const blur = () => release();

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", pointerUp);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerUp);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", blur);
    };
  }, [aktivno, pokazivacRukom, release, toggleIndicator]);

  // Jedna petlja koja svakog kadra spaja prst i tastaturu u konačnu vrijednost.
  useEffect(() => {
    if (!aktivno) return;
    let raf = 0;
    let prije = performance.now();
    const kadar = (sada: number) => {
      const dt = Math.min(0.1, (sada - prije) / 1000);
      prije = sada;
      const t = tasteri.current;
      const cilj = (t.desno ? 1 : 0) - (t.lijevo ? 1 : 0);
      const sad = stanjeRef.current;

      let steer = dodir.current.steer;
      if (steer === null) {
        // Ka cilju se ide sporije nego nazad u nulu: pušten volan se u autu
        // vraća sam, a okretanje traži vrijeme.
        const brzina = cilj === 0 ? STEER_KEY_FALL : STEER_KEY_RISE;
        const korak = brzina * dt;
        steer = sad.steer + Math.max(-korak, Math.min(korak, cilj - sad.steer));
      }
      const gas = dodir.current.gas ?? ((t.gas ? 1 : 0) - (t.kocnica ? 1 : 0));
      primijeni({ steer: Math.max(-1, Math.min(1, steer)), gas });
      raf = requestAnimationFrame(kadar);
    };
    raf = requestAnimationFrame(kadar);
    return () => cancelAnimationFrame(raf);
  }, [aktivno, primijeni]);

  return useMemo(
    () => ({
      inputRef,
      stanjeRef,
      indicator,
      toggleIndicator,
      resetIndicator,
      pocniDodir,
      pomjeri,
      release,
    }),
    [indicator, toggleIndicator, resetIndicator, pocniDodir, pomjeri, release],
  );
}
