import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  KEEP_BEHIND,
  LOAD_AHEAD,
  ROAD_STEP,
  SAOBRACAJ_NIVO,
  SAOBRACAJ_U_PROZORU,
} from "@/lib/game/sim/config";
import { perfectBot } from "@/lib/game/sim/bots";
import { compile } from "@/lib/game/sim/intersection";
import { createWorld, PLAYER_ID, poseOn, step } from "@/lib/game/sim/world";
import type { Input, Point, RoadTemplate, Scenario, World } from "@/lib/game/sim/types";
import { EDGES, NODES } from "@/lib/game/road/roadGraph";
import { parseGeometry, type EdgeGeometry } from "@/lib/game/road/edgeGeometry";
import { parseKicma, type Kicma } from "@/lib/game/road/kicma";
import {
  kilometraza,
  nadjiRutu,
  napraviRutu,
  vMaxNaprijed,
  type Ruta,
} from "@/lib/game/world/ruta";
import { rutaScenario, uProzoru, uProzoruGustine, vrijemeDo } from "@/lib/game/world/svijet";

/**
 * Svijet kao jedan koordinatni sistem.
 *
 * Ovo je test koji brani glavno obećanje faze: da se od Budve do Kolašina vozi
 * bez ijednog prekida. Sve što se ovdje mjeri mjeri se na STVARNIM podacima iz
 * `public/data/osm/`, jer su se sve greške u nizanju dionica javljale baš na
 * njima — na zajedničkim krakovima u čvorovima i na uglovima digitalizacije.
 */

const GEOM: ReadonlyMap<string, EdgeGeometry> = new Map(
  EDGES.map((e) => {
    const g = parseGeometry(
      JSON.parse(readFileSync(`public/data/osm/edgeGeometry/${e.id}.json`, "utf8")),
    );
    if (!g) throw new Error(`Neispravna geometrija: ${e.id}`);
    return [e.id, g] as const;
  }),
);

const KICME: ReadonlyMap<string, Kicma> = new Map(
  NODES.filter((n) => n.kind === "opstina").map((n) => {
    const k = parseKicma(JSON.parse(readFileSync(`public/data/osm/kicme/${n.id}.json`, "utf8")));
    if (!k) throw new Error(`Neispravna kičma: ${n.id}`);
    return [n.id, k] as const;
  }),
);

/** Ruta bez gradskih dionica — grad se samo dodirne, kao prije kičmi. */
const ruta = (od: string, doK: string): Ruta => {
  const cvorovi = nadjiRutu(od, doK);
  if (!cvorovi) throw new Error(`Nema rute ${od} — ${doK}`);
  return napraviRutu(cvorovi, GEOM);
};

/** Ruta koja kroz gradove stvarno prolazi. */
const rutaSaGradovima = (od: string, doK: string): Ruta => {
  const cvorovi = nadjiRutu(od, doK);
  if (!cvorovi) throw new Error(`Nema rute ${od} — ${doK}`);
  return napraviRutu(cvorovi, GEOM, KICME);
};

/** Rute iz zadatka, na kojima se traži neprekidna vožnja. */
const RUTE: ReadonlyArray<readonly [string, string]> = [
  ["budva", "kolasin"],
  ["herceg-novi", "rozaje"],
  ["ulcinj", "pljevlja"],
];

/**
 * Vozač koji drži ograničenje — i usporava PRIJE nego što ono padne.
 *
 * Gleda dvjesta metara ispred sebe, otprilike onoliko koliko se na osamdeset na
 * sat pređe za devet sekundi. Bez toga u naselje ulazi punom brzinom i dobija
 * prekršaj koji nije mogao izbjeći, jer ograničenje pada u jednoj tački.
 */
const POGLED = 200;

const poPropisu =
  (r: Ruta, scenario: Scenario) =>
  (world: World): Input => {
    const igrac = world.vehicles.find((v) => v.id === PLAYER_ID);
    const v = igrac?.v ?? 0;
    const limit = vMaxNaprijed(r, igrac?.s ?? 0, POGLED);
    // Osnovu daje savršen vozač, dakle ISTA logika po kojoj voze NPC-ovi: on
    // drži odstojanje od onoga ko je ispred. Otkad u našoj traci ima sporijih
    // vozila, vozač koji samo gleda tablu ih zakuca s leđa.
    const osnova = perfectBot(world, scenario);
    if (v > limit * 1.02) return { ...osnova, throttle: 0, brake: 0.35 };
    if (v < limit) return osnova;
    return { ...osnova, throttle: 0 };
  };

interface Voznja {
  outcome: string;
  vrijeme: number;
  najveciSkok: number;
  imaNaN: boolean;
  najviseNPC: number;
  vanProzora: number;
  /** Prosječan broj vozila u prozoru gustine na posljednjoj trećini rute. */
  gustinaNaKraju: number;
  prekrsaji: string[];
}

/** Provozaj cijelu rutu i izmjeri sve što nas zanima. */
function provozaj(r: Ruta, seed = 1, zadati?: Scenario): Voznja {
  const scenario = zadati ?? rutaScenario(r, seed);
  const tpl = scenario.template as RoadTemplate;
  const { paths } = compile(tpl);
  const world = createWorld(scenario, seed);
  const bot = poPropisu(r, scenario);

  let prethodna: Point | null = null;
  let najveciSkok = 0;
  let imaNaN = false;
  let najviseNPC = 0;
  let vanProzora = 0;
  const naKraju: number[] = [];
  let koraka = 0;

  while (world.outcome === "running" && koraka < 800000) {
    step(world, scenario, bot(world));
    koraka += 1;
    const igrac = world.vehicles.find((v) => v.id === PLAYER_ID)!;
    if (!Number.isFinite(igrac.s) || !Number.isFinite(igrac.v)) {
      imaNaN = true;
      break;
    }
    const poz = poseOn(tpl, paths.get(igrac.pathId)!, igrac).pos;
    if (!Number.isFinite(poz.x) || !Number.isFinite(poz.y)) {
      imaNaN = true;
      break;
    }
    if (prethodna) {
      najveciSkok = Math.max(najveciSkok, Math.hypot(poz.x - prethodna.x, poz.y - prethodna.y));
    }
    prethodna = { x: poz.x, y: poz.y };
    if (koraka % 600 === 0) {
      const u = uProzoru(world, r);
      najviseNPC = Math.max(najviseNPC, u.aktivnih);
      vanProzora = Math.max(vanProzora, u.aktivnih - u.uProzoru);
      const g = uProzoruGustine(world, tpl);
      if (g.cijeli && igrac.s > (r.duzina * 2) / 3) naKraju.push(g.vozila);
    }
  }

  return {
    outcome: world.outcome,
    vrijeme: world.t,
    najveciSkok,
    imaNaN,
    najviseNPC,
    vanProzora,
    gustinaNaKraju: naKraju.length > 0 ? naKraju.reduce((a, b) => a + b, 0) / naKraju.length : 0,
    prekrsaji: world.violations.map((v) => v.type),
  };
}

describe("sastavljanje rute", () => {
  it("nalazi put kroz graf i drži se njegovih ivica", () => {
    const cvorovi = nadjiRutu("budva", "kolasin");
    expect(cvorovi).toEqual(["budva", "cetinje", "podgorica", "bioce", "kolasin"]);
  });

  it("odbija čvorove koji nisu susjedi", () => {
    // Ruta ne smije da izmisli vezu koje u grafu nema — to je isto pravilo po
    // kojem ni putokaz ne prikazuje grad koji nije susjed.
    expect(() => napraviRutu(["budva", "rozaje"], GEOM)).toThrow(/nema vezu/i);
  });

  it("dionice pokrivaju cijelu rutu, bez rupe i bez preklapanja", () => {
    for (const [a, b] of RUTE) {
      const r = ruta(a, b);
      expect(r.dionice[0]!.odS, `${a}-${b}`).toBe(0);
      expect(r.dionice[r.dionice.length - 1]!.doS, `${a}-${b}`).toBeCloseTo(r.duzina, 6);
      for (let i = 1; i < r.dionice.length; i++) {
        expect(r.dionice[i]!.odS, `${a}-${b}`).toBeCloseTo(r.dionice[i - 1]!.doS, 6);
      }
    }
  });

  it("osovina nema prekida — nijedan korak nije veći od pola koraka viška", () => {
    // Rupa u osovini je tačno ono što se u vožnji vidi kao skok. Mjeri se na
    // samoj poliliniji, prije nego što iko išta vozi.
    for (const [a, b] of RUTE) {
      const r = ruta(a, b);
      for (let i = 1; i < r.tacke.length; i++) {
        const d = Math.hypot(
          r.tacke[i]!.x - r.tacke[i - 1]!.x,
          r.tacke[i]!.y - r.tacke[i - 1]!.y,
        );
        expect(d, `${a}-${b} @ ${i}`).toBeLessThan(ROAD_STEP * 1.5);
      }
    }
  });

  it("ruta je kraća od stvarne, i to znatno", () => {
    const r = ruta("budva", "kolasin");
    expect(kilometraza(r)).toBe(132);
    expect(r.duzina).toBeLessThan(r.stvarnaDuzina / 3);
  });

  it("ograničenje se mijenja od dionice do dionice", () => {
    const r = ruta("herceg-novi", "rozaje");
    // Ruta prolazi i autoputem (Smokovac — Mateševo) i magistralom.
    const brzine = new Set(r.dionice.map((d) => Math.round(d.vMax * 3.6)));
    expect(brzine.size).toBeGreaterThan(1);
    for (const d of r.dionice) {
      expect(r.vMaxNa((d.odS + d.doS) / 2)).toBeCloseTo(d.vMax, 6);
      expect(r.dionicaNa((d.odS + d.doS) / 2).edge?.id ?? null).toBe(d.edge?.id ?? null);
    }
  });

  it("krivine i znamenitosti stoje unutar rute i poređane su", () => {
    for (const [a, b] of RUTE) {
      const r = ruta(a, b);
      for (const niz of [r.krivine, r.landmarks]) {
        let prethodna = -1;
        for (const x of niz) {
          expect(x.atS, `${a}-${b}`).toBeGreaterThanOrEqual(0);
          expect(x.atS, `${a}-${b}`).toBeLessThanOrEqual(r.duzina);
          expect(x.atS, `${a}-${b}`).toBeGreaterThanOrEqual(prethodna);
          prethodna = x.atS;
        }
      }
    }
  });

  it("isti čvorovi daju istu rutu", () => {
    const a = ruta("budva", "kolasin");
    const b = ruta("budva", "kolasin");
    expect(b.duzina).toBeCloseTo(a.duzina, 9);
    expect(b.tacke.length).toBe(a.tacke.length);
  });
});

describe("vožnja bez prekida", { timeout: 300000 }, () => {
  const voznje = RUTE.map(([a, b]) => ({ a, b, v: provozaj(ruta(a, b)) }));

  it("savršen vozač prevozi svaku rutu do kraja", () => {
    for (const { a, b, v } of voznje) {
      expect(v.outcome, `${a}-${b}`).toBe("passed");
      expect(v.prekrsaji, `${a}-${b}`).toEqual([]);
    }
  });

  it("saobraćaja ima i na posljednjoj trećini rute, u gustini nivoa", () => {
    // Tok se ne smije potrošiti na početku: i pred kraj rute u prozoru mora biti
    // onoliko vozila koliko nivo traži. Pojas je širi od ciljanog jer se mjeri
    // na trećini jedne vožnje, a ne na prosjeku mnogo njih.
    const [najmanje, najvise] = SAOBRACAJ_U_PROZORU[SAOBRACAJ_NIVO];
    for (const { a, b, v } of voznje) {
      expect(v.gustinaNaKraju, `${a}-${b}`).toBeGreaterThan(najmanje * 0.7);
      expect(v.gustinaNaKraju, `${a}-${b}`).toBeLessThan(najvise * 1.3);
    }
  });

  it("nema skoka pozicije većeg od metra između dva koraka", () => {
    // Ovo je mjera neprekidnosti svijeta. Skok bi značio da se koordinate negdje
    // resetuju — tačno ono zbog čega je ranije između dionica bio ekran.
    for (const { a, b, v } of voznje) {
      expect(v.najveciSkok, `${a}-${b}`).toBeLessThan(1);
      expect(v.najveciSkok, `${a}-${b}`).toBeGreaterThan(0);
    }
  });

  it("nigdje se ne pojavi NaN", () => {
    for (const { a, b, v } of voznje) expect(v.imaNaN, `${a}-${b}`).toBe(false);
  });

  it("vožnja traje onoliko koliko razmjera obećava", () => {
    // Mjeri se PRAZAN put: razmjera je obećanje o dužini, a ne o saobraćaju.
    // Otkad u našoj traci ima sporijih vozila, vožnja iza njih traje duže — i
    // to je tačno, ali to više nije mjera sabijanja.
    const r = ruta("budva", "kolasin");
    const prazna = { ...rutaScenario(r, 1), npcs: [], tok: undefined };
    const v = provozaj(r, 1, prazna);
    expect(v.vrijeme / 60).toBeGreaterThan(15);
    expect(v.vrijeme / 60).toBeLessThan(20);
  });

  it("saobraćaj usporava vožnju, ali je ne zaustavlja", () => {
    const budva = voznje.find((x) => x.a === "budva")!;
    const r = ruta("budva", "kolasin");
    const prazna = provozaj(r, 1, { ...rutaScenario(r, 1), npcs: [], tok: undefined });
    // Iza sporijih vozila se vozi duže, ali ne dvostruko: ko ne pretiče, plaća
    // vremenom. Preticanje dolazi sa botom koji ga zna.
    expect(budva.v.vrijeme).toBeGreaterThan(prazna.vrijeme);
    expect(budva.v.vrijeme).toBeLessThan(prazna.vrijeme * 1.6);
  });
});

describe("prozor oko igrača", { timeout: 300000 }, () => {
  it("van prozora se ne vrti nijedno vozilo", () => {
    // Susretna vozila se prave tek kad uđu u prozor i brišu se kad izađu iza.
    // Bez toga ih je na Budvi — Kolašinu bilo 93 u pogonu odjednom, a samo 22 u
    // prozoru; ostalih sedamdeset se računalo bez ikakve koristi.
    //
    // Nekoliko vozila svejedno prekorači ivicu prozora, i to je očekivano:
    // trenutak nastanka se računa po OGRANIČENJU dionice, a igrač ne vozi tačno
    // na ograničenju — ubrzava, koči, i pomjeri se u odnosu na račun. Bitno je
    // da ih ostane šaka, a ne devedeset.
    for (const [a, b] of RUTE) {
      const v = provozaj(ruta(a, b));
      expect(v.najviseNPC, `${a}-${b}`).toBeGreaterThan(0);
      expect(v.najviseNPC, `${a}-${b}`).toBeLessThan(40);
      expect(v.vanProzora, `${a}-${b}`).toBeLessThan(10);
    }
  });

  it("prozor je uži od rute — inače ništa ne bi ni izlazilo iz njega", () => {
    const r = ruta("budva", "kolasin");
    expect(LOAD_AHEAD + KEEP_BEHIND).toBeLessThan(r.duzina);
  });
});

describe("saobraćaj na ruti", () => {
  it("vrijeme do kraja rute je zbir vremena po dionicama", () => {
    const r = ruta("herceg-novi", "rozaje");
    const zbir = r.dionice.reduce((a, d) => a + (d.doS - d.odS) / d.vMax, 0);
    expect(vrijemeDo(r, r.duzina)).toBeCloseTo(zbir, 6);
    expect(vrijemeDo(r, 0)).toBe(0);
  });

  it("opis toka pokriva cijelu rutu, bez rupe, sa ograničenjem svake dionice", () => {
    // Saobraćaj se više ne pravi unaprijed: nastaje oko igrača, iz ovog opisa.
    // Rupa u opisu bi značila komad rute na kojem ne zna koja je vrsta puta.
    const r = rutaSaGradovima("ulcinj", "pljevlja");
    const dionice = rutaScenario(r, 1).tok!.dionice;
    expect(dionice).toHaveLength(r.dionice.length);
    expect(dionice[0]!.od).toBe(0);
    expect(dionice[dionice.length - 1]!.do).toBeCloseTo(r.duzina, 6);
    dionice.forEach((d, i) => {
      if (i > 0) expect(d.od).toBeCloseTo(dionice[i - 1]!.do, 6);
      expect(d.vMax).toBeCloseTo(r.dionice[i]!.vMax, 9);
      expect(d.vrsta === "grad").toBe(r.dionice[i]!.vrsta === "grad");
    });
  });

  it("isto sjeme daje isti saobraćaj, drugo ga mijenja", () => {
    // Tok se ne pravi unaprijed, pa se poredi ono što se stvarno vozi: isti
    // scenario i isti ulaz daju ista vozila na istim mjestima.
    const r = ruta("budva", "kolasin");
    const poslije = (seed: number) => {
      const s = rutaScenario(r, seed);
      const w = createWorld(s, 1);
      for (let i = 0; i < 1200; i++) step(w, s, { throttle: 0.4, brake: 0, indicator: null, steer: 0 });
      return JSON.stringify(w.vehicles.map((v) => [v.id, v.vrsta, v.s, v.v]));
    };
    expect(poslije(7)).toBe(poslije(7));
    expect(poslije(7)).not.toBe(poslije(8));
  });
});

describe("gradske dionice u ruti", { timeout: 300000 }, () => {
  const saGradovima = RUTE.map(([a, b]) => ({ a, b, r: rutaSaGradovima(a, b) }));

  it("kroz grad se stvarno prolazi", () => {
    // Bez kičme je grad u ruti bio TAČKA: geometrija ivice završava u centru i
    // sljedeća odatle kreće, pa se kroz Cetinje nije prolazilo nego ga se samo
    // dodirivalo.
    for (const { a, b, r } of saGradovima) {
      const gradske = r.dionice.filter((d) => d.vrsta === "grad");
      expect(gradske.length, `${a}-${b}`).toBeGreaterThan(0);
      for (const d of gradske) {
        expect(d.grad, `${a}-${b}`).not.toBeNull();
        expect(d.edge, `${a}-${b}`).toBeNull();
        expect(d.doS - d.odS, `${a}-${b} ${d.grad}`).toBeGreaterThan(50);
      }
    }
  });

  it("u gradu važi gradsko ograničenje", () => {
    for (const { a, b, r } of saGradovima) {
      for (const d of r.dionice) {
        const sredina = (d.odS + d.doS) / 2;
        if (d.vrsta === "grad") {
          expect(Math.round(r.vMaxNa(sredina) * 3.6), `${a}-${b} ${d.grad}`).toBe(50);
        } else {
          expect(r.vMaxNa(sredina), `${a}-${b}`).toBeCloseTo(d.edge!.speedLimit / 3.6, 6);
        }
      }
    }
  });

  it("gradska dionica stoji između dvije ivice, nikad na kraju rute", () => {
    for (const { a, b, r } of saGradovima) {
      const vrste = r.dionice.map((d) => d.vrsta);
      expect(vrste[0], `${a}-${b}`).toBe("ivica");
      expect(vrste[vrste.length - 1], `${a}-${b}`).toBe("ivica");
      for (let i = 0; i < vrste.length; i++) {
        if (vrste[i] !== "grad") continue;
        expect(vrste[i - 1], `${a}-${b}`).toBe("ivica");
        expect(vrste[i + 1], `${a}-${b}`).toBe("ivica");
        // Grad stoji tamo gdje se dvije ivice sastaju, i to na svom čvoru.
        expect(r.dionice[i - 1]!.do, `${a}-${b}`).toBe(r.dionice[i]!.grad);
        expect(r.dionice[i + 1]!.od, `${a}-${b}`).toBe(r.dionice[i]!.grad);
      }
    }
  });

  it("dionice i dalje pokrivaju rutu bez rupe", () => {
    for (const { a, b, r } of saGradovima) {
      expect(r.dionice[0]!.odS, `${a}-${b}`).toBe(0);
      expect(r.dionice[r.dionice.length - 1]!.doS, `${a}-${b}`).toBeCloseTo(r.duzina, 6);
      for (let i = 1; i < r.dionice.length; i++) {
        expect(r.dionice[i]!.odS, `${a}-${b}`).toBeCloseTo(r.dionice[i - 1]!.doS, 6);
      }
    }
  });

  it("kilometraža broji samo ivice, ne i gradske dionice", () => {
    // Kilometraža je ono što piše na putokazu, a putokaz mjeri između mjesta.
    const r = rutaSaGradovima("budva", "kolasin");
    expect(kilometraza(r)).toBe(132);
  });

  it("savršen vozač prevozi i rutu sa gradovima", () => {
    for (const { a, b, r } of saGradovima) {
      const v = provozaj(r);
      expect(v.outcome, `${a}-${b}`).toBe("passed");
      expect(v.prekrsaji, `${a}-${b}`).toEqual([]);
      expect(v.najveciSkok, `${a}-${b}`).toBeLessThan(1);
      expect(v.imaNaN, `${a}-${b}`).toBe(false);
    }
  });

  it("grad produžava vožnju, ali je ne pretvara u gradsku vožnju", () => {
    // Kroz naselje se prolazi, ne stanuje: gradske dionice zajedno ne smiju
    // preuzeti rutu.
    for (const { a, b, r } of saGradovima) {
      const uGradu = r.dionice
        .filter((d) => d.vrsta === "grad")
        .reduce((x, d) => x + (d.doS - d.odS), 0);
      expect(uGradu / r.duzina, `${a}-${b}`).toBeLessThan(0.25);
      expect(uGradu, `${a}-${b}`).toBeGreaterThan(0);
    }
  });
});
