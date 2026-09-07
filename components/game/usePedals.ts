"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Input } from "@/lib/game/sim/types";

type Pedal = "throttle" | "brake";
type Side = "left" | "right";

export interface Pedals {
  /** Ulaz za simulaciju. Mijenja se u mjestu — namjerno nije React state. */
  inputRef: React.RefObject<Input>;
  /** Za prikaz: koja pedala je trenutno pritisnuta. */
  active: Record<Pedal, boolean>;
  /** Prst ili miš su spušteni na dugme. Otpuštanje hvata sam hook. */
  pressPointer: (pedal: Pedal, pointerId: number) => void;
  /** Trenutno stanje pokazivača pravca. */
  indicator: Side | null;
  /** Prekidač pokazivača: ista strana ga gasi, druga ga prebacuje. */
  toggleIndicator: (side: Side) => void;
  /**
   * Zahtjev za promjenu trake (samo autoput).
   *
   * Za razliku od pokazivača nije stanje nego jedan zahtjev: postavi se, pa ga
   * `GameCanvas` potroši u prvom sljedećem kadru.
   */
  requestLane: (side: Side) => void;
  /** Otpusti sve — poziva se kad scenario počne ili se završi. */
  release: () => void;
  /**
   * Ugasi samo pokazivač, a pedale ostavi kako jesu.
   *
   * Za prelaz između segmenata u smjeni: nova raskrsnica počinje bez žmigavca,
   * ali igrač koji DRŽI gas ne smije da ga izgubi — otpuštanje bi mu ga uzelo,
   * a novi pritisak ne stiže jer taster nikad nije ni pušten.
   */
  resetIndicator: () => void;
}

/**
 * Gas i kočnica sa dva izvora odjednom: tastature i ekrana.
 *
 * Izvori se pamte odvojeno pa sabiraju, jer bi inače otpuštanje jednog gasilo
 * i drugi — a zadatak izričito traži da dodir i tastatura rade istovremeno.
 *
 * Otpuštanje se sluša na `window`, ne na dugmetu. Prvo rješenje je hvatalo
 * pokazivač (`setPointerCapture`) i otpuštalo pedalu na `pointerleave`; na
 * dodiru je radilo, a mišem nije — postavljanje hvatanja samo okine par
 * leave/enter, pa se pedala otpuštala u istom trenutku u kojem je pritisnuta.
 * Sa slušanjem na prozoru gas radi i kad prst sklizne sa dugmeta, a otpuštanje
 * nijedan pregledač ne može da progura.
 */
export function usePedals(): Pedals {
  const inputRef = useRef<Input>({ throttle: 0, brake: 0, indicator: null, changeLane: null });
  const keys = useRef<Record<Pedal, boolean>>({ throttle: false, brake: false });
  /** Koji pokazivač drži koju pedalu — dva prsta smiju držati obje. */
  const pointers = useRef(new Map<number, Pedal>());
  const [active, setActive] = useState<Record<Pedal, boolean>>({
    throttle: false,
    brake: false,
  });
  const [indicator, setIndicator] = useState<Side | null>(null);

  /**
   * Pokazivač je prekidač, ne pedala: pritisak ga pali i ostaje upaljen dok se
   * ne ugasi. Zato ide kroz state, a ne kroz mapu pritisnutih pokazivača — i
   * zato se ne otpušta kad prozor izgubi fokus, kao gas.
   */
  const toggleIndicator = useCallback((side: Side) => {
    setIndicator((prev) => {
      const next = prev === side ? null : side;
      inputRef.current.indicator = next;
      return next;
    });
  }, []);

  const requestLane = useCallback((side: Side) => {
    inputRef.current.changeLane = side;
  }, []);

  const sync = useCallback(() => {
    const held = [...pointers.current.values()];
    const t = keys.current.throttle || held.includes("throttle");
    const b = keys.current.brake || held.includes("brake");
    inputRef.current.throttle = t ? 1 : 0;
    inputRef.current.brake = b ? 1 : 0;
    setActive((prev) =>
      prev.throttle === t && prev.brake === b ? prev : { throttle: t, brake: b },
    );
  }, []);

  const pressPointer = useCallback(
    (pedal: Pedal, pointerId: number) => {
      pointers.current.set(pointerId, pedal);
      sync();
    },
    [sync],
  );

  const resetIndicator = useCallback(() => {
    setIndicator(null);
    inputRef.current.indicator = null;
    inputRef.current.changeLane = null;
  }, []);

  const release = useCallback(() => {
    pointers.current.clear();
    keys.current = { throttle: false, brake: false };
    setIndicator(null);
    inputRef.current.indicator = null;
    inputRef.current.changeLane = null;
    sync();
  }, [sync]);

  useEffect(() => {
    const pedalOf = (e: KeyboardEvent): Pedal | null => {
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") return "throttle";
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") return "brake";
      return null;
    };
    const down = (e: KeyboardEvent) => {
      // Strelice lijevo/desno su pokazivač; sa Shiftom su promjena trake.
      // Razdvojene su namjerno: promjena trake bez pokazivača je prekršaj, pa
      // jedno dugme za oboje ne bi moglo ni da ga napravi.
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        if (e.repeat) return;
        const side = e.key === "ArrowLeft" ? "left" : "right";
        if (e.shiftKey) requestLane(side);
        else toggleIndicator(side);
        return;
      }
      const p = pedalOf(e);
      if (!p || keys.current[p]) return;
      e.preventDefault(); // strelice inače skroluju stranicu ispod platna
      keys.current[p] = true;
      sync();
    };
    const up = (e: KeyboardEvent) => {
      const p = pedalOf(e);
      if (!p) return;
      keys.current[p] = false;
      sync();
    };
    const pointerUp = (e: PointerEvent) => {
      if (!pointers.current.delete(e.pointerId)) return;
      sync();
    };
    // Bez ovoga taster ostane „pritisnut" kad prozor izgubi fokus, pa vozilo
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
  }, [sync, release, toggleIndicator, requestLane]);

  return useMemo(
    () => ({
      inputRef,
      active,
      pressPointer,
      indicator,
      toggleIndicator,
      requestLane,
      release,
      resetIndicator,
    }),
    [active, pressPointer, indicator, toggleIndicator, requestLane, release, resetIndicator],
  );
}
