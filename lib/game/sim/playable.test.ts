import { describe, expect, it } from "vitest";
import { SCENARIOS } from "@/lib/game/scenarios";
import { bangBangBot, run } from "./bots";
import { MAX_SCENARIO_SECONDS } from "./config";
import { lightFor, TEMPLATES } from "./intersection";
import type { Scenario } from "./types";

/**
 * Scenario mora biti rješiv onim čime igrač zaista raspolaže: dva dugmeta.
 *
 * `perfectBot` dozira gas na proizvoljnu vrijednost, pa njegov prolazak ne
 * dokazuje da je zadatak igriv — samo da su pravila neprotivrječna. Ovdje se
 * traži prozor „gas – kočnica – gas" u kojem scenario prolazi bez ijednog
 * prekršaja. Ako takvog prozora nema, scenario je za čovjeka nemoguć i test
 * pada prije nego što ga neko doda u igru.
 */
const KORAK = 0.25;
const DO_KADA = 14;

/**
 * Trenuci u kojima krak igrača dobija zeleno.
 *
 * Gusta mreža do četrnaeste sekunde ne pokriva semafor: tamo se ispravno čeka
 * i po dvadeset sekundi, a produžiti mrežu dotle znači stostruko duži test.
 * Pošto je kod semafora odgovor uvijek „kreni kad se upali zeleno", ti trenuci
 * se dodaju kao kandidati umjesto da se traže grubom silom.
 */
function zelenaVremena(s: Scenario): number[] {
  const tpl = TEMPLATES[s.intersection];
  const prog = tpl?.lightProgram;
  if (!tpl || !prog || prog.length === 0) return [];
  const a = tpl.arms.find((x) => x.id === s.player.arm);
  if (!a || a.control.kind !== "light") return [];
  const group = a.control.phaseGroup;

  const out: number[] = [];
  let i = s.lightStartPhase ?? 0;
  let t = -(s.lightStartT ?? 0);
  let prije = lightFor(tpl, i, group);
  for (let k = 0; k < prog.length * 3; k++) {
    t += prog[i]!.duration;
    i = (i + 1) % prog.length;
    const sada = lightFor(tpl, i, group);
    if (sada === "green" && prije !== "green" && t > 0) out.push(t);
    prije = sada;
    if (t > MAX_SCENARIO_SECONDS) break;
  }
  return out;
}

function kandidati(s: Scenario): number[] {
  const mreza: number[] = [];
  for (let t = KORAK; t <= DO_KADA; t += KORAK) mreza.push(t);
  // Malo poslije paljenja zelenog — polazak tačno u trenutku promjene je
  // nepotrebno oštar zahtjev prema igraču.
  for (const z of zelenaVremena(s)) mreza.push(z, z + 0.25, z + 0.5, z + 1);
  return [...new Set(mreza)].sort((a, b) => a - b);
}

function nadjiRjesenje(s: Scenario, seed: number): { from: number; to: number } | null {
  const doKada = kandidati(s);
  for (let from = 0; from <= DO_KADA; from += KORAK) {
    for (const to of doKada) {
      if (to <= from) continue;
      const { world } = run(s, bangBangBot(from, to), seed);
      if (world.outcome === "passed") return { from, to };
    }
  }
  return null;
}

describe("igrivost sa dvije pedale", () => {
  for (const s of SCENARIOS) {
    // Sjemena mijenjaju trenutak nastanka NPC-a unutar prozora; scenario mora
    // biti rješiv u cijelom prozoru, a ne samo za jedno sjeme.
    for (const seed of [1, 7, 42]) {
      it(`${s.id} (sjeme ${seed}): postoji prolazak bez prekršaja`, () => {
        const rj = nadjiRjesenje(s, seed);
        expect(rj, `${s.id}: nijedan raspored gas/kočnica ne prolazi`).not.toBeNull();
      });
    }
  }
});
