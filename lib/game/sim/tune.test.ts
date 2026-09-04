import { describe, expect, it } from "vitest";
import { SCENARIOS } from "@/lib/game/scenarios";
import { flooringBot, perfectBot, run } from "./bots";
import { compile, TEMPLATES } from "./intersection";
import { createWorld, PLAYER_ID, step } from "./world";
import type { Scenario } from "./types";

/**
 * Scenario je pogrešno tempiran ako se igrač i NPC nikad ne sretnu.
 *
 * Ovo nije kozmetika: ako NPC stigne prerano, bezobzirni igrač prođe IZA njega
 * i to nije prekršaj — scenario tada ne uči ništa, a test „bot koji samo gasi
 * pravi prekršaj" bi pao iz naizgled nejasnog razloga. Zato se prozor mjeri, i
 * mjerenje je ovdje da bi buduća izmjena scenarija pala odmah.
 *
 * Izuzeti su scenariji u kojima igrač ispravno čeka na crveno: tamo se sa NPC-om
 * i ne sreće, pa mjerenje „kad se sretnu" nema smisla — vrijeme polaska diktira
 * semafor, a ne trenutak nastanka drugog vozila.
 */
const CEKA_NA_CRVENO = ["semafor", "semafor-zuto"];
const TEMPIRANI = SCENARIOS.filter(
  (s) =>
    !CEKA_NA_CRVENO.includes(s.id) &&
    // Bez NPC-a nema ni susreta koji bi se tempirao (scenario sa pješakom).
    s.npcs.length > 0 &&
    // Kad reguliše policajac, trenutak polaska diktira njegova naredba, a ne
    // to kad drugo vozilo naiđe.
    !s.officer,
);

/** Koliko izmjereni idealni trenutak smije da odstupa od zadatog prozora [s]. */
const TOLERANCIJA = 1.5;

function idealniSpawn(s: Scenario): number | null {
  const w0 = createWorld(s, 1);
  const tpl = TEMPLATES[w0.templateId]!;
  const { conflicts } = compile(tpl);
  const pl = w0.vehicles.find((v) => v.id === PLAYER_ID)!;
  const npcPaths = w0.vehicles.filter((v) => v.kind === "npc").map((v) => v.pathId);
  const cs = (conflicts.get(pl.pathId) ?? []).filter((c) => npcPaths.includes(c.pathB));
  if (cs.length === 0) return null;
  const c = cs.reduce((a, b) => (a.sA < b.sA ? a : b));

  // Kad bezobzirni igrač stigne do konflikta ako mu niko ne smeta.
  const solo: Scenario = { ...s, npcs: [] };
  const w1 = createWorld(solo, 1);
  let tPlayer = Infinity;
  for (let i = 0; i < 3600; i++) {
    step(w1, solo, flooringBot(w1, solo));
    if (w1.vehicles.find((v) => v.id === PLAYER_ID)!.s >= c.sA) {
      tPlayer = w1.t;
      break;
    }
  }

  // Koliko NPC-u treba do konfliktne tačke kad mu igrač nije na putu.
  const sam: Scenario = {
    ...s,
    player: { ...s.player, spawnDistance: 400 }, // daleko iza, da ne smeta
    npcs: [{ ...s.npcs[0]!, spawnAt: [0, 0] }],
  };
  const w2 = createWorld(sam, 1);
  let tNpc = Infinity;
  for (let i = 0; i < 3600; i++) {
    step(w2, sam, { throttle: 0, brake: 1 });
    const n = w2.vehicles.find((v) => v.kind === "npc");
    if (n && n.s >= c.sB) {
      tNpc = w2.t;
      break;
    }
  }
  if (!Number.isFinite(tPlayer) || !Number.isFinite(tNpc)) return null;

  // NPC treba da stigne malo POSLIJE bezobzirnog igrača — tada mu je ovaj
  // stvarno ušao ispred, a ne prošao iza njega.
  return tPlayer + 1.0 - tNpc;
}

describe("tempiranje scenarija", () => {
  for (const s of TEMPIRANI) {
    it(`${s.id}: NPC nastaje u prozoru u kojem se stvarno sreću`, () => {
      const ideal = idealniSpawn(s);
      expect(ideal, `${s.id}: igrač i NPC nemaju zajedničku konfliktnu tačku`).not.toBeNull();
      const [lo, hi] = s.npcs[0]!.spawnAt;
      const sredina = (lo + hi) / 2;
      expect(
        Math.abs(sredina - ideal!),
        `${s.id}: prozor [${lo}, ${hi}] je van mjere — izmjereno ${ideal!.toFixed(2)}`,
      ).toBeLessThan(TOLERANCIJA);
    });
  }
});

describe("prekoračenje brzine", () => {
  it("prijavljuje se kad igrač pređe dozvoljenu brzinu", () => {
    // Sa podrazumijevanih 50 km/h pravilo se NE može okinuti: prilaz je 60 m, a
    // uz `A_MAX` i otpor igrač dotle ne stigne ni do 14,7 m/s. Zato se ovdje
    // uzima scenario sa sniženim ograničenjem (zona 30), gdje je prekoračenje
    // stvarno moguće — pravilo se testira, a ne geometrija prilaza.
    const osnovni = SCENARIOS.find((x) => x.id === "glavni-put")!;
    const zona30: Scenario = { ...osnovni, vMax: 8 };
    const { world } = run(zona30, flooringBot);
    expect(
      world.violations.some((v) => v.type === "speeding"),
      `prijavljeno: ${JSON.stringify(world.violations.map((v) => v.type))}`,
    ).toBe(true);
  });

  it("savršen vozač ne prekoračuje ni u zoni 30", () => {
    const osnovni = SCENARIOS.find((x) => x.id === "glavni-put")!;
    const { world } = run({ ...osnovni, vMax: 8 }, perfectBot);
    expect(world.violations.some((v) => v.type === "speeding")).toBe(false);
  });
});
