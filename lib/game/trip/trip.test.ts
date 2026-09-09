import { describe, expect, it } from "vitest";
import { EDGES, edgeById, nodeById, otherEnd, type RoadEdge } from "../road/roadGraph";
import { LANDMARKS } from "../road/landmarks";
import { CITY_LEVEL } from "../sim/config";
import { TEMPLATES } from "../sim/intersection";
import { generateSegment } from "../shift/generate";
import {
  dionicaZa,
  gradskaVoznja,
  ispravno,
  legSeed,
  obrnuto,
  opstina,
  parseTrip,
  smjerovi,
  startTrip,
  stigao,
  znamenitosti,
  type TripState,
} from "./trip";

const ivica = (id: string): RoadEdge => {
  const e = edgeById(id);
  if (!e) throw new Error(`nema ivice ${id}`);
  return e;
};

/** Odvezi jednu dionicu prema imenovanom susjedu, pa i nazad odakle se došlo. */
function vozi(state: TripState, kaCvoru: string): TripState {
  const p = smjerovi(state);
  const s = p.smjerovi.find((x) => x.to.id === kaCvoru) ?? (p.nazad?.to.id === kaCvoru ? p.nazad : null);
  if (!s) throw new Error(`iz ${state.at} se ne može ka ${kaCvoru}`);
  return stigao(state, s.edge);
}

describe("polazak", () => {
  it("počinje se u zadatom mjestu, bez pređenog puta", () => {
    const t = startTrip("podgorica", 1);
    expect(t.at).toBe("podgorica");
    expect(t.from).toBeNull();
    expect(t.legs).toBe(0);
    expect(t.km).toBe(0);
    expect(t.visited).toEqual(["podgorica"]);
    expect(t.seen).toEqual([]);
    expect(t.ljeto).toBe(true);
  });

  it("na polasku su ponuđeni svi susjedi, jer se niotkud nije došlo", () => {
    const t = startTrip("podgorica", 1);
    const ponuda = smjerovi(t).smjerovi.map((s) => s.to.id).sort();
    expect(ponuda).toEqual(
      ["danilovgrad", "zeta", "tuzi", "cetinje", "smokovac", "bioce", "virpazar", "kucka-korita"].sort(),
    );
    expect(smjerovi(t).nazad).toBeNull();
  });
});

describe("vožnja", () => {
  it("dolazak pomjera putnika, broji kilometre i pamti odakle se došlo", () => {
    const t = vozi(startTrip("podgorica", 1), "danilovgrad");
    expect(t.at).toBe("danilovgrad");
    expect(t.from).toBe("podgorica");
    expect(t.legs).toBe(1);
    expect(t.km).toBe(20);
    expect(t.visited).toEqual(["podgorica", "danilovgrad"]);
  });

  it("odakle se došlo se ne nudi kao pravac, ali se može okrenuti", () => {
    const t = vozi(startTrip("podgorica", 1), "danilovgrad");
    const p = smjerovi(t);
    expect(p.smjerovi.map((s) => s.to.id)).toEqual(["niksic"]);
    expect(p.nazad?.to.id).toBe("podgorica");
  });

  it("okretanje je obična vožnja istom ivicom, samo u drugom smjeru", () => {
    const t1 = vozi(startTrip("podgorica", 1), "danilovgrad");
    const nazad = smjerovi(t1).nazad;
    expect(nazad).toBeTruthy();
    if (!nazad) return;
    const t2 = stigao(t1, nazad.edge);
    expect(t2.at).toBe("podgorica");
    expect(t2.from).toBe("danilovgrad");
    expect(t2.km).toBe(40);
    // Podgorica je već viđena, pa se u spisku ne ponavlja.
    expect(t2.visited).toEqual(["podgorica", "danilovgrad"]);
  });

  it("mjesto viđeno dvaput se broji jednom", () => {
    let t = startTrip("podgorica", 1);
    t = vozi(t, "danilovgrad");
    t = vozi(t, "niksic");
    t = vozi(t, "vilusi");
    expect(opstina(t)).toBe(3); // Podgorica, Danilovgrad, Nikšić; Vilusi su čvorište
    expect(t.visited).toHaveLength(4);
  });

  it("smjer vožnje se čita iz toga gdje smo, ne iz ivice", () => {
    const e = ivica("podgorica--danilovgrad");
    expect(obrnuto(startTrip("podgorica", 1), e)).toBe(false);
    expect(obrnuto(startTrip("danilovgrad", 1), e)).toBe(true);
  });
});

describe("kraj puta", () => {
  it("na granici nema kuda dalje, a okretanje se nudi", () => {
    let t = startTrip("podgorica", 1);
    t = vozi(t, "tuzi");
    t = vozi(t, "bozaj");
    const p = smjerovi(t);
    expect(p.krajPuta).toBe(true);
    expect(p.smjerovi).toEqual([]);
    expect(p.granica?.id).toBe("bozaj");
    expect(p.granica?.country).toBe("ALB");
    expect(p.nazad?.to.id).toBe("tuzi");
  });

  it("Kučka Korita su kraj puta, ali nisu granica", () => {
    const t = vozi(startTrip("podgorica", 1), "kucka-korita");
    const p = smjerovi(t);
    expect(p.krajPuta).toBe(true);
    expect(p.slijepiKraj?.id).toBe("kucka-korita");
    expect(p.granica).toBeNull();
    expect(p.nazad?.to.id).toBe("podgorica");
  });

  it("sa kraja puta se stvarno može vratiti", () => {
    let t = vozi(startTrip("podgorica", 1), "kucka-korita");
    const nazad = smjerovi(t).nazad;
    if (!nazad) throw new Error("nema povratka");
    t = stigao(t, nazad.edge);
    expect(t.at).toBe("podgorica");
    expect(smjerovi(t).krajPuta).toBe(false);
  });
});

describe("ljeto", () => {
  it("sezonski prevoj nestaje iz ponude kad ljeto nije uključeno", () => {
    const ljeti = startTrip("zabljak", 1, true);
    const zimi = startTrip("zabljak", 1, false);
    expect(smjerovi(ljeti).smjerovi.map((s) => s.to.id)).toContain("pluzine");
    expect(smjerovi(zimi).smjerovi.map((s) => s.to.id)).not.toContain("pluzine");
    // Ostatak sjevera ostaje dostupan i zimi.
    expect(smjerovi(zimi).smjerovi.length).toBeGreaterThan(0);
  });
});

describe("znamenitosti", () => {
  it("uz dionicu se broje one pored puta i one u mjestu dolaska", () => {
    const t = startTrip("podgorica", 1);
    const e = ivica("podgorica--cetinje");
    const ids = znamenitosti(t, e).map((l) => l.id);
    expect(ids).toContain("lipska-pecina");
    expect(ids).toContain("cetinjski-manastir");
    expect(ids).toContain("dvorac-kralja-nikole-cetinje");
  });

  it("ono što je samo kartica se ne broji kao viđeno usput", () => {
    let t = startTrip("andrijevica", 1);
    t = vozi(t, "plav");
    expect(t.seen).toContain("plavsko-jezero");
    expect(t.seen).not.toContain("hridsko-jezero");
  });

  it("ista znamenitost se ne broji dvaput", () => {
    let t = startTrip("podgorica", 1);
    t = vozi(t, "cetinje");
    t = vozi(t, "podgorica");
    // Povratak je dodao ono što je u Podgorici; treći prolazak istim putem
    // ne smije dodati više ništa.
    const dosad = t.seen.length;
    t = vozi(t, "cetinje");
    expect(t.seen.length).toBe(dosad);
    expect(new Set(t.seen).size).toBe(t.seen.length);
  });

  it("svaka viđena znamenitost stvarno postoji", () => {
    let t = startTrip("bar", 1);
    t = vozi(t, "ulcinj");
    t = vozi(t, "sukobin");
    const poznate = new Set(LANDMARKS.map((l) => l.id));
    for (const id of t.seen) expect(poznate.has(id), id).toBe(true);
    expect(t.seen).toContain("stara-maslina");
    expect(t.seen).toContain("ada-bojana");
  });
});

describe("dionica putovanja", () => {
  it("sjeme zavisi od putovanja, rednog broja i ivice", () => {
    const t = startTrip("podgorica", 1);
    const e = ivica("podgorica--cetinje");
    const f = ivica("podgorica--virpazar");
    expect(legSeed(t, e)).toBe(legSeed(t, e));
    expect(legSeed(t, e)).not.toBe(legSeed(t, f));
    expect(legSeed(t, e)).not.toBe(legSeed({ ...t, seed: 2 }, e));
    expect(legSeed(t, e)).not.toBe(legSeed({ ...t, legs: 1 }, e));
  });

  it("ponovljena vožnja poslije sudara je ista situacija", () => {
    const t = startTrip("podgorica", 1);
    const e = ivica("podgorica--cetinje");
    expect(dionicaZa(t, e)).toEqual(dionicaZa(t, e));
  });

  it("scenario nosi naziv u smjeru vožnje", () => {
    const e = ivica("njegusi--kotor");
    expect(dionicaZa(startTrip("njegusi", 1), e).title.me).toBe("Njeguši — Kotor");
    expect(dionicaZa(startTrip("kotor", 1), e).title.me).toBe("Kotor — Njeguši");
  });

  it("svaka ivica u grafu se može odvesti iz oba smjera", () => {
    for (const e of EDGES) {
      for (const od of [e.a, e.b]) {
        const t = startTrip(od, 3);
        const s = dionicaZa(t, e);
        expect(s.template, e.id).toBeTruthy();
        expect(s.npcs.length, e.id).toBeGreaterThan(0);
        expect(otherEnd(e, od), e.id).toBe(od === e.a ? e.b : e.a);
      }
    }
  });
});

describe("sačuvano putovanje", () => {
  it("ispravno stanje prolazi", () => {
    expect(ispravno(startTrip("podgorica", 1))).toBe(true);
    expect(ispravno(vozi(startTrip("podgorica", 1), "cetinje"))).toBe(true);
  });

  it("čvor kojeg nema, ili veza koje nema, obara stanje", () => {
    const t = startTrip("podgorica", 1);
    expect(ispravno({ ...t, at: "atlantida" })).toBe(false);
    expect(ispravno({ ...t, from: "atlantida" })).toBe(false);
    // Podgorica i Rožaje nisu susjedi — takvo stanje nije moglo nastati vožnjom.
    expect(ispravno({ ...t, at: "podgorica", from: "rozaje" })).toBe(false);
    expect(ispravno({ ...t, visited: ["podgorica", "atlantida"] })).toBe(false);
  });

  it("svi čvorovi grafa su ispravna polazna mjesta", () => {
    for (const n of ["podgorica", "kotor", "zabljak", "bozaj"]) {
      expect(ispravno(startTrip(n, 1)), n).toBe(true);
      expect(nodeById(n), n).toBeDefined();
    }
  });
});

describe("čitanje sačuvanog putovanja", () => {
  it("ispravno stanje se vraća netaknuto", () => {
    const t = vozi(startTrip("podgorica", 7), "cetinje");
    expect(parseTrip(JSON.parse(JSON.stringify(t)))).toEqual(t);
  });

  it("sve što nije putovanje se odbija umjesto da se krpi", () => {
    const t = startTrip("podgorica", 1);
    for (const loše of [
      null,
      undefined,
      "putovanje",
      42,
      {},
      { ...t, at: 5 },
      { ...t, seed: "1" },
      { ...t, visited: "podgorica" },
      { ...t, visited: [1, 2] },
      { ...t, seen: null },
      { ...t, ljeto: "da" },
      { ...t, at: "atlantida" },
      { ...t, at: "podgorica", from: "rozaje" },
    ]) {
      expect(parseTrip(loše), JSON.stringify(loše)).toBeNull();
    }
  });
});

describe("gradska vožnja", () => {
  it("kroz opštinu se prolazi ulicom, kroz čvorište i granicu ne", () => {
    const t = startTrip("podgorica", 1);
    expect(gradskaVoznja(t, ivica("podgorica--danilovgrad")).count).toBeGreaterThan(0);
    expect(gradskaVoznja(t, ivica("podgorica--smokovac")).count).toBe(0);
    expect(gradskaVoznja(startTrip("tuzi", 1), ivica("tuzi--bozaj")).count).toBe(0);
    expect(gradskaVoznja(t, ivica("podgorica--kucka-korita")).count).toBe(0);
  });

  it("dvije ili tri raskrsnice, nikad više", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const t = startTrip("podgorica", seed);
      const { count } = gradskaVoznja(t, ivica("podgorica--cetinje"));
      expect(count, `sjeme ${seed}`).toBeGreaterThanOrEqual(2);
      expect(count, `sjeme ${seed}`).toBeLessThanOrEqual(3);
    }
  });

  it("i broj i sjeme se ponavljaju uz ponovljenu dionicu", () => {
    const t = startTrip("podgorica", 5);
    const e = ivica("podgorica--cetinje");
    expect(gradskaVoznja(t, e)).toEqual(gradskaVoznja(t, e));
    expect(gradskaVoznja(t, e)).not.toEqual(gradskaVoznja({ ...t, legs: 1 }, e));
  });

  it("gradska raskrsnica nikad nije autoput", () => {
    for (let seed = 1; seed <= 120; seed++) {
      const s = generateSegment(seed, CITY_LEVEL, seed % 4, { autoput: false });
      const tpl = s.template ?? TEMPLATES[s.intersection];
      expect(tpl?.kind, `sjeme ${seed}`).not.toBe("highway");
    }
  });

  it("zabrana autoputa ne mijenja ostatak lanca", () => {
    // Sjeme koje ionako nije izvuklo autoput mora dati isti segment sa
    // zabranom i bez nje — inače bi zabrana pomjerila cijelu smjenu.
    let uporedjeno = 0;
    for (let seed = 1; seed <= 60 && uporedjeno < 10; seed++) {
      const sa = generateSegment(seed, CITY_LEVEL, 0);
      const tpl = sa.template ?? TEMPLATES[sa.intersection];
      if (tpl?.kind === "highway") continue;
      expect(generateSegment(seed, CITY_LEVEL, 0, { autoput: false })).toEqual(sa);
      uporedjeno += 1;
    }
    expect(uporedjeno).toBeGreaterThan(0);
  });
});
