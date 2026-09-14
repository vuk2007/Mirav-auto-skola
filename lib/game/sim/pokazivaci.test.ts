import { describe, expect, it } from "vitest";
import { SCENARIOS, scenarioById } from "@/lib/game/scenarios";
import { noIndicatorBot, perfectBot, run, wrongIndicatorBot, type Bot } from "./bots";
import { generateSegment } from "../shift/generate";
import {
  AUTO_INDICATOR_HOLD,
  CITY_LEVEL,
  DT,
  INDICATOR_LEAD,
  INDICATOR_LEAD_TIME,
  ROAD_LANE_WIDTH,
  ROAD_VIEW_HALF,
  STEER_KEY_FALL,
  STEER_KEY_RISE,
} from "./config";
import { expectedIndicatorAt } from "./indicatorRules";
import { compile, TEMPLATES } from "./intersection";
import { createWorld, PLAYER_ID, step, trakeNaPutu } from "./world";
import type {
  Input,
  Intent,
  PokazivaciRezim,
  RoadTemplate,
  Scenario,
  Vehicle,
  World,
} from "./types";

/**
 * Automatski pokazivači i prekidač između njih i ručnih.
 *
 * Tri stvari se ovdje dokazuju. Prva: automatski pokazivač se pali TAČNO onako
 * kako tabela traži — korak po korak, ne otprilike. Druga: dok ga pali
 * simulacija, greške pokazivača se ne sude, a ručni režim je zatečeno ponašanje
 * do posljednjeg prekršaja. Treća: na otvorenom putu pokazivač prati prelazak
 * razdjelne linije, a u ručnom režimu se po tom prelasku i sudi.
 */

const igrac = (w: World): Vehicle => w.vehicles.find((v) => v.id === PLAYER_ID)!;
const pokazivacki = (w: World) => w.violations.filter((v) => v.type.startsWith("indicator"));

// ── Prekidač ────────────────────────────────────────────────────────────────

describe("prekidač", () => {
  const bezAutoputa = SCENARIOS.filter((s) => TEMPLATES[s.intersection]?.kind !== "highway");

  it("ručni je zatečeno ponašanje: isti prekršaji u svakoj situaciji", () => {
    for (const s of SCENARIOS) {
      for (const bot of [noIndicatorBot, wrongIndicatorBot]) {
        const zateceno = run(s, bot).world.violations;
        const rucno = run({ ...s, pokazivaci: "rucni" }, bot).world.violations;
        expect(rucno, s.id).toEqual(zateceno);
      }
    }
  });

  it("automatski: ni bez pokazivača ni sa pogrešnim nema prekršaja pokazivača", () => {
    for (const s of bezAutoputa) {
      for (const bot of [noIndicatorBot, wrongIndicatorBot]) {
        const { world } = run({ ...s, pokazivaci: "auto" }, bot);
        expect(pokazivacki(world), s.id).toEqual([]);
      }
    }
  });

  it("isti vozač bez pokazivača u ručnom režimu pada — detekcija radi", () => {
    // Bez ovoga bi prethodni test prolazio i kad detekcija ne radi nigdje.
    const s = scenarioById("ljevak")!;
    expect(pokazivacki(run(s, noIndicatorBot).world).length).toBeGreaterThan(0);
  });

  it("automatski pokazivač pokazuje stranu iz tabele, ma šta ulaz tražio", () => {
    const s: Scenario = { ...scenarioById("ljevak")!, pokazivaci: "auto" };
    const { world } = run(s, wrongIndicatorBot);
    const upaljeni = world.indicatorLog.flatMap((e) => (e.indicator ? [e.indicator] : []));
    expect(upaljeni.length).toBeGreaterThan(0);
    expect(new Set(upaljeni)).toEqual(new Set(["left"]));
  });

  it("autoput automatski pokazivač nema i ne prihvata ga", () => {
    // Tamo se pokazivač traži uz zahtjev za promjenu trake, a taj zahtjev se ne
    // može predvidjeti. Tiho suđenje bi bilo gore od jasnog odbijanja.
    const s = SCENARIOS.find((x) => TEMPLATES[x.intersection]?.kind === "highway")!;
    expect(() => createWorld({ ...s, pokazivaci: "auto" }, 1)).toThrow();
  });
});

// ── Raskrsnica i kružni tok ─────────────────────────────────────────────────

/** Raskrsnica koja se vozi volanom, sa automatskim pokazivačem i bez ikoga drugog. */
function raskrsnica(id: string, intent: Intent): Scenario {
  return {
    id: `test:pokazivaci:${id}`,
    intersection: id,
    player: { arm: "N", intent, spawnDistance: 42 },
    npcs: [],
    upravljanje: "traka",
    pokazivaci: "auto",
    difficulty: 1,
    title: { me: "proba" },
    explanation: { me: "proba" },
  };
}

/** Gas i kočnica savršenog vozača, a volan po zadatom pravilu. */
const volanPo =
  (steer: (w: World) => number): Bot =>
  (w, s) => ({ ...perfectBot(w, s), steer: steer(w) });

/**
 * Odvozi scenario i u svakom koraku uporedi pokazivač sa tabelom.
 *
 * Tabela se pita za putanju i mjesto na kojima je pokazivač i izračunat: izbor
 * pravca mijenja putanju usred koraka, a vozilo se pomjeri tek poslije — pa se
 * mjesto vraća za put pređen u tom koraku.
 */
function uporediSaTabelom(s: Scenario, bot: Bot) {
  const world = createWorld(s, 1);
  const { paths } = compile(TEMPLATES[s.intersection]!);
  const odstupanja: string[] = [];
  for (let i = 0; i < Math.round(60 / DT) && world.outcome === "running"; i++) {
    step(world, s, bot(world, s));
    const p = igrac(world);
    const tu = p.s - p.v * DT;
    const trazi = expectedIndicatorAt(paths.get(p.pathId)!, p.intent, tu);
    if (p.indicator !== trazi) {
      odstupanja.push(`${p.pathId} s=${tu.toFixed(2)}: ${p.indicator} umjesto ${trazi}`);
    }
    if (p.done) break;
  }
  return { world, odstupanja };
}

describe("automatski na raskrsnici i u kružnom toku", () => {
  it("pali se tamo gdje se pravac zaključa, gasi po izlasku iz raskrsnice", () => {
    const { world, odstupanja } = uporediSaTabelom(
      raskrsnica("cross-none", "straight"),
      volanPo(() => -1),
    );
    expect(odstupanja).toEqual([]);
    const put = compile(TEMPLATES["cross-none"]!).paths.get("cross-none:N:left")!;
    expect(igrac(world).pathId).toBe(put.id);
    const [upaljen, ugasen, ...ostalo] = world.indicatorLog;
    expect(ostalo).toEqual([]);
    expect(upaljen?.indicator).toBe("left");
    // Tačka odluke je i početak faze najave; jedan korak je četvrt metra.
    expect(Math.abs(upaljen!.s - (put.stopLineS - INDICATOR_LEAD))).toBeLessThan(0.5);
    expect(ugasen?.indicator).toBeNull();
    expect(Math.abs(ugasen!.s - put.boxExitS)).toBeLessThan(0.5);
  });

  it("korak po korak isto što traži tabela, za svaki pravac i svaki izlaz", () => {
    const slucajevi: { id: string; intent: Intent; volan: number }[] = [
      { id: "cross-none", intent: "straight", volan: -1 },
      { id: "cross-none", intent: "straight", volan: 0 },
      { id: "cross-none", intent: "straight", volan: 1 },
      { id: "kruzni", intent: { kind: "exit", n: 2 }, volan: -1 },
      { id: "kruzni", intent: { kind: "exit", n: 2 }, volan: 0 },
      { id: "kruzni", intent: { kind: "exit", n: 2 }, volan: 1 },
    ];
    for (const { id, intent, volan } of slucajevi) {
      const { world, odstupanja } = uporediSaTabelom(raskrsnica(id, intent), volanPo(() => volan));
      expect(odstupanja, `${id}, volan ${volan}`).toEqual([]);
      expect(world.outcome, `${id}, volan ${volan}`).toBe("passed");
    }
  });

  it("promjena izlaza u prstenu odmah mijenja i pokazivač", () => {
    // Na prilazu lijevo (treći izlaz), u prstenu desno — raniji izlaz. Pokazivač
    // prelazi na desni tamo gdje tabela za NOVI izlaz to traži.
    const prilaz = compile(TEMPLATES["kruzni"]!).paths.get("kruzni:N:exit3")!;
    const { world, odstupanja } = uporediSaTabelom(
      raskrsnica("kruzni", { kind: "exit", n: 2 }),
      volanPo((w) => (igrac(w).s < prilaz.boxEnterS + 2 ? -1 : 1)),
    );
    expect(odstupanja).toEqual([]);
    const izlaz = igrac(world).intent;
    expect(typeof izlaz === "object" && izlaz.kind === "exit" ? izlaz.n : 0).toBeLessThan(3);
    expect(world.indicatorLog.map((e) => e.indicator)).toEqual(
      expect.arrayContaining(["left", "right"]),
    );
  });

  it("ulaz igrača se ne čita", () => {
    const bot: Bot = (w, s) => ({ ...volanPo(() => -1)(w, s), indicator: "right" });
    const { world, odstupanja } = uporediSaTabelom(raskrsnica("cross-none", "straight"), bot);
    expect(odstupanja).toEqual([]);
    expect(world.indicatorLog.some((e) => e.indicator === "right")).toBe(false);
  });
});

describe("automatski u gradu putovanja", () => {
  it("volan držan do tačke odluke bira skretanje i pali pokazivač, na generisanim gradskim raskrsnicama", () => {
    // Izbor prati volan sve do tačke odluke — pušten volan znači pravo (vidi
    // `izborPravca`). Zato se strelica drži dok se pokazivač ne upali, jer je to
    // baš trenutak u kojem se izbor zaključava. Volan ide ka krajnjem položaju i
    // nazad istim tempom kao sa tastature.
    for (let sjeme = 1; sjeme <= 12; sjeme++) {
      for (let redni = 0; redni < 3; redni++) {
        const s: Scenario = {
          ...generateSegment(sjeme, CITY_LEVEL, redni, { autoput: false }),
          upravljanje: "traka",
          pokazivaci: "auto",
        };
        const world = createWorld(s, 1);
        const { paths } = compile(TEMPLATES[s.intersection]!);
        let steer = 0;
        for (let i = 0; i < Math.round(20 / DT) && world.outcome === "running"; i++) {
          const t = i * DT;
          const drzi = t >= 0.5 && world.indicatorLog.length === 0;
          const tempo = (drzi ? STEER_KEY_RISE : STEER_KEY_FALL) * DT;
          steer += Math.max(-tempo, Math.min(tempo, (drzi ? -1 : 0) - steer));
          step(world, s, {
            throttle: t >= 0.5 ? 1 : 0,
            brake: 0,
            indicator: null,
            changeLane: null,
            steer,
          });
          if (igrac(world).done) break;
        }
        const oznaka = `sjeme ${sjeme}, raskrsnica ${redni}, ${s.intersection}`;
        const prvi = world.indicatorLog[0];
        expect(prvi?.indicator, oznaka).toBe("left");
        // Upalio se tamo gdje se izbor zaključava, ni prije ni poslije.
        const put = paths.get(igrac(world).pathId)!;
        expect(Math.abs(prvi!.s - (put.stopLineS - INDICATOR_LEAD)), oznaka).toBeLessThan(0.5);
      }
    }
  });
});

// ── Otvoren put ─────────────────────────────────────────────────────────────

let brojPuta = 0;

/** Prav i prazan put: pravilo se gleda na situaciji koja se tačno zna. */
function put(pokazivaci: PokazivaciRezim): Scenario {
  brojPuta += 1;
  const tpl: RoadTemplate = {
    kind: "road",
    id: `test:pokazivaci:put:${brojPuta}`,
    length: 4000,
    edgeId: "test--test",
    edgeKm: 4,
    vMax: 25,
    curves: [],
    landmarks: [],
    geometry: { laneWidth: ROAD_LANE_WIDTH },
    viewHalf: ROAD_VIEW_HALF,
  };
  return {
    id: tpl.id,
    intersection: tpl.id,
    template: tpl,
    player: { arm: "N", intent: { kind: "lane", index: 0 }, spawnDistance: 0, startS: 0, startV: 22 },
    npcs: [],
    upravljanje: "traka",
    pokazivaci,
    difficulty: 2,
    title: { me: "proba" },
    explanation: { me: "proba" },
  };
}

/**
 * Ulaz bez gasa: brzina ostaje ista, pa je ista i bočna brzina — i rokovi se
 * mogu računati tačno, a ne otprilike.
 */
const ulaz = (steer: number, indicator: "left" | "right" | null = null): Input => ({
  throttle: 0,
  brake: 0,
  indicator,
  changeLane: null,
  steer,
});

interface Korak {
  i: number;
  t: number;
  lat: number;
  pokazivac: "left" | "right" | null;
  trake: number[];
}

/** Odvozi put i zapamti stanje poslije svakog koraka. */
function vozi(s: Scenario, sekundi: number, kako: (w: World, i: number) => Input) {
  const world = createWorld(s, 1);
  const { paths } = compile(s.template!);
  const koraci: Korak[] = [];
  for (let i = 0; i < Math.round(sekundi / DT); i++) {
    step(world, s, kako(world, i));
    const p = igrac(world);
    koraci.push({
      i,
      t: (i + 1) * DT,
      lat: p.lateral ?? 0,
      pokazivac: p.indicator,
      trake: trakeNaPutu(paths.get(p.pathId)!, p),
    });
  }
  return { world, koraci };
}

/** Razdjelna linija, mjereno od ose naše trake — na pravom putu je na pola trake. */
const LINIJA = ROAD_LANE_WIDTH / 2;

/** Ka sredini suprotne trake zadatim volanom, pa pravo. */
const uKontru = (volan: number) => (w: World) =>
  ulaz((igrac(w).lateral ?? 0) > -ROAD_LANE_WIDTH ? -volan : 0);

describe("automatski na otvorenom putu", () => {
  it("lijevi se pali INDICATOR_LEAD_TIME prije nego što sredina pređe liniju", () => {
    const { koraci, world } = vozi(put("auto"), 4, uKontru(0.5));
    const upaljen = koraci.find((k) => k.pokazivac === "left");
    const preko = koraci.find((k) => k.lat < -LINIJA);
    expect(upaljen).toBeDefined();
    expect(preko).toBeDefined();
    const unaprijed = preko!.t - upaljen!.t;
    expect(unaprijed).toBeGreaterThan(INDICATOR_LEAD_TIME - 2 * DT);
    expect(unaprijed).toBeLessThanOrEqual(INDICATOR_LEAD_TIME + DT);
    expect(pokazivacki(world)).toEqual([]);
  });

  it("gasi se tek kad je vozilo cijelo u suprotnoj traci", () => {
    const { koraci } = vozi(put("auto"), 4, uKontru(0.5));
    const upaljen = koraci.find((k) => k.pokazivac === "left")!;
    const ugasen = koraci.find((k) => k.i > upaljen.i && k.pokazivac === null)!;
    expect(ugasen.trake).toEqual([1]);
    expect(koraci[ugasen.i - 1]!.trake).toContain(0);
    // Dok vozi suprotnom trakom, pokazivač ostaje ugašen.
    expect(koraci.slice(ugasen.i).every((k) => k.pokazivac === null)).toBe(true);
  });

  it("povratak pali desni isto unaprijed i gasi ga kad je vozilo cijelo u svojoj traci", () => {
    const pola = Math.round(4 / DT);
    const { koraci } = vozi(put("auto"), 9, (w, i) => {
      if (i < pola) return uKontru(0.5)(w);
      return ulaz((igrac(w).lateral ?? 0) < 0 ? 0.5 : 0);
    });
    const nazad = koraci.slice(pola);
    const upaljen = nazad.find((k) => k.pokazivac === "right")!;
    const uSvojoj = nazad.find((k) => k.lat > -LINIJA)!;
    const ugasen = nazad.find((k) => k.i > upaljen.i && k.pokazivac === null)!;
    expect(uSvojoj.t - upaljen.t).toBeGreaterThan(INDICATOR_LEAD_TIME - 2 * DT);
    expect(uSvojoj.t - upaljen.t).toBeLessThanOrEqual(INDICATOR_LEAD_TIME + DT);
    expect(ugasen.trake).toEqual([0]);
    expect(koraci[pola - 1]!.pokazivac).toBeNull();
  });

  it("vožnja uz liniju: pokazivač se gasi poslije AUTO_INDICATOR_HOLD", () => {
    // Naglo ka liniji, pa stane metar od nje. Na početku to izgleda kao prelazak
    // i pokazivač se upali; kad prelaska nema, gasi se.
    const { koraci } = vozi(put("auto"), 5, (w) => ulaz((igrac(w).lateral ?? 0) > -1 ? -1 : 0));
    const upaljen = koraci.find((k) => k.pokazivac === "left");
    expect(upaljen).toBeDefined();
    const stao = koraci.find((k) => k.lat <= -1)!;
    const ugasen = koraci.find((k) => k.i > upaljen!.i && k.pokazivac === null)!;
    expect(ugasen.t - stao.t).toBeGreaterThan(AUTO_INDICATOR_HOLD - 2 * DT);
    expect(ugasen.t - stao.t).toBeLessThan(AUTO_INDICATOR_HOLD + 3 * DT);
    expect(koraci.every((k) => k.lat > -LINIJA)).toBe(true);
    expect(koraci.slice(ugasen.i).every((k) => k.pokazivac === null)).toBe(true);
  });

  it("vijuganje u traci i skretanje ka bankini ne pale ništa", () => {
    const vijuga = vozi(put("auto"), 6, (_w, i) => ulaz(Math.floor(i / 18) % 2 === 0 ? -0.3 : 0.3));
    expect(vijuga.koraci.every((k) => k.pokazivac === null)).toBe(true);
    const bankina = vozi(put("auto"), 3, () => ulaz(1));
    expect(bankina.koraci.every((k) => k.pokazivac === null)).toBe(true);
  });

  it("predomišljanje prije linije gasi pokazivač u istom koraku", () => {
    const { koraci } = vozi(put("auto"), 2, (_w, i) => ulaz(i < 12 ? -1 : 1));
    expect(koraci[11]!.pokazivac).toBe("left");
    expect(koraci[12]!.pokazivac).toBeNull();
    expect(koraci.slice(12).every((k) => k.pokazivac === null)).toBe(true);
  });

  it("isti volan daje isti dnevnik pokazivača", () => {
    const kako = (_w: World, i: number) => ulaz(Math.sin(i / 23) * 0.9 - 0.45);
    const a = vozi(put("auto"), 20, kako).world.indicatorLog;
    const b = vozi(put("auto"), 20, kako).world.indicatorLog;
    expect(a.length).toBeGreaterThan(0);
    expect(b).toEqual(a);
  });
});

describe("ručni na otvorenom putu", () => {
  /** Koliko koraka pokazivač gori prije volana — malo duže od roka. */
  const ROK = Math.ceil((INDICATOR_LEAD_TIME + 0.2) / DT);

  it("prelazak u suprotnu traku bez pokazivača je prekršaj koji obara vožnju", () => {
    const { world } = vozi(put("rucni"), 4, uKontru(1));
    const p = world.violations.find((v) => v.type === "indicatorMissing");
    expect(p?.phaseId).toBe("prelazak");
    expect(p?.severity).toBe("fail");
  });

  it("pokazivač upaljen na vrijeme, u oba smjera: nema prekršaja", () => {
    const povratak = Math.round(6 / DT);
    const { world, koraci } = vozi(put("rucni"), 10, (w, i) => {
      const lat = igrac(w).lateral ?? 0;
      if (i < povratak) return ulaz(i < ROK || lat <= -ROAD_LANE_WIDTH ? 0 : -1, "left");
      return ulaz(i < povratak + ROK || lat >= 0 ? 0 : 1, "right");
    });
    // Stvarno je prešao i vratio se — inače test ne bi dokazivao ništa.
    expect(koraci.some((k) => k.lat < -LINIJA)).toBe(true);
    expect(koraci.at(-1)!.lat).toBeGreaterThan(-LINIJA);
    expect(pokazivacki(world)).toEqual([]);
  });

  it("upaljen prekasno je prekršaj, sa vremenom u opisu", () => {
    // Volan kreće odmah, do linije treba oko 0,7 s, a pokazivač se pali tek
    // poslije 0,3 s.
    const { world } = vozi(put("rucni"), 3, (w, i) =>
      ulaz((igrac(w).lateral ?? 0) > -ROAD_LANE_WIDTH ? -1 : 0, i >= 18 ? "left" : null),
    );
    const p = world.violations.find((v) => v.type === "indicatorMissing");
    expect(p?.phaseId).toBe("prelazak");
    expect(p?.details).toContain("prekasno");
  });

  it("povratak bez desnog pokazivača je poseban prekršaj", () => {
    const povratak = Math.round(4 / DT);
    const { world } = vozi(put("rucni"), 8, (w, i) => {
      const lat = igrac(w).lateral ?? 0;
      if (i < povratak) return ulaz(i < ROK || lat <= -ROAD_LANE_WIDTH ? 0 : -1, "left");
      return ulaz(lat >= 0 ? 0 : 1);
    });
    const faze = world.violations.filter((v) => v.type === "indicatorMissing").map((v) => v.phaseId);
    expect(faze).toEqual(["povratak"]);
  });

  it("isti vozač: u ručnom dva prekršaja, u automatskom nijedan, a pokazivač ide redom", () => {
    const povratak = Math.round(4 / DT);
    const kako = (w: World, i: number) => {
      const lat = igrac(w).lateral ?? 0;
      if (i < povratak) return ulaz(lat <= -ROAD_LANE_WIDTH ? 0 : -1);
      return ulaz(lat >= 0 ? 0 : 1);
    };
    const rucno = vozi(put("rucni"), 8, kako).world;
    const auto = vozi(put("auto"), 8, kako).world;
    expect(pokazivacki(rucno).map((v) => v.phaseId)).toEqual(["prelazak", "povratak"]);
    expect(pokazivacki(auto)).toEqual([]);
    expect(auto.indicatorLog.map((e) => e.indicator)).toEqual(["left", null, "right", null]);
  });
});
