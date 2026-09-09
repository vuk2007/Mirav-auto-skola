import { describe, expect, it } from "vitest";
import { SPEED_LIMIT_KMH_BY_ROAD } from "../sim/config";
import {
  EDGES,
  NODES,
  type RoadEdge,
  type RoadNode,
  curvesFor,
  edgeById,
  edgesAt,
  nodeById,
  otherEnd,
  putokazi,
} from "./roadGraph";

/** Obilazak grafa u širinu; `ljeto=false` izbacuje sezonske ivice. */
function dostizni(od: string, ljeto: boolean): Set<string> {
  const vidjeno = new Set([od]);
  const red = [od];
  while (red.length) {
    const n = red.shift();
    if (n === undefined) break;
    for (const e of edgesAt(n)) {
      if (!ljeto && e.seasonal) continue;
      const d = otherEnd(e, n);
      if (!vidjeno.has(d)) {
        vidjeno.add(d);
        red.push(d);
      }
    }
  }
  return vidjeno;
}

describe("čvorovi", () => {
  it("ima svih 25 opština, 11 čvorišta i 9 graničnih prelaza", () => {
    const po = (k: string) => NODES.filter((n) => n.kind === k).length;
    expect(po("opstina")).toBe(25);
    expect(po("cvoriste")).toBe(11);
    expect(po("granica")).toBe(9);
    expect(NODES).toHaveLength(45);
  });

  it("nema dva čvora sa istim identifikatorom", () => {
    expect(new Set(NODES.map((n) => n.id)).size).toBe(NODES.length);
  });

  it("svaki granični prelaz zna sa kojom je državom", () => {
    for (const n of NODES.filter((x) => x.kind === "granica")) {
      expect(n.country, n.id).toBeTruthy();
    }
    // I obrnuto: država stoji samo na granici.
    for (const n of NODES.filter((x) => x.kind !== "granica")) {
      expect(n.country, n.id).toBeUndefined();
    }
  });
});

describe("ivice", () => {
  it("oba kraja svake ivice postoje kao čvor", () => {
    for (const e of EDGES) {
      expect(nodeById(e.a), e.id).toBeDefined();
      expect(nodeById(e.b), e.id).toBeDefined();
    }
  });

  it("nema petlje na samom sebi ni dvije ivice između istog para", () => {
    const parovi = new Set<string>();
    for (const e of EDGES) {
      expect(e.a, e.id).not.toBe(e.b);
      const kljuc = [e.a, e.b].sort().join("|");
      expect(parovi.has(kljuc), `dupla veza: ${kljuc}`).toBe(false);
      parovi.add(kljuc);
    }
  });

  it("dužina je pozitivna, a identifikator jedinstven", () => {
    expect(new Set(EDGES.map((e) => e.id)).size).toBe(EDGES.length);
    for (const e of EDGES) expect(e.km, e.id).toBeGreaterThan(0);
  });

  it("ograničenje brzine je podrazumijevano za vrstu puta", () => {
    for (const e of EDGES) {
      expect(e.speedLimit, e.id).toBe(SPEED_LIMIT_KMH_BY_ROAD[e.kind]);
    }
  });

  it("neprovjerene su tačno one tri koje škola još provjerava", () => {
    expect(EDGES.filter((e) => !e.verified).map((e) => e.id).sort()).toEqual([
      "pljevlja--bijelo-polje",
      "virpazar--petrovac",
      "vilusi--herceg-novi",
    ].sort());
  });

  it("sezonska je samo Žabljak — Plužine, a trajekt samo Tivat — Kamenari", () => {
    expect(EDGES.filter((e) => e.seasonal).map((e) => e.id)).toEqual(["zabljak--pluzine"]);
    expect(EDGES.filter((e) => e.ferry).map((e) => e.id)).toEqual(["tivat--kamenari"]);
  });

  it("slijepa je samo Podgorica — Kučka Korita", () => {
    expect(EDGES.filter((e) => e.deadEnd).map((e) => e.id)).toEqual(["podgorica--kucka-korita"]);
  });
});

describe("povezanost", () => {
  it("iz Podgorice se stiže do svakog čvora", () => {
    const stigao = dostizni("podgorica", true);
    const fali = NODES.filter((n) => !stigao.has(n.id)).map((n) => n.id);
    expect(fali, `nedostižni čvorovi: ${fali.join(", ")}`).toEqual([]);
  });

  it("graf ostaje povezan i kad ljeto nije uključeno", () => {
    // Jedina sezonska ivica je prečica, ne jedini put — ako ovo padne, sjever
    // se zimi raspada na dva dijela.
    const stigao = dostizni("podgorica", false);
    expect(NODES.filter((n) => !stigao.has(n.id)).map((n) => n.id)).toEqual([]);
  });

  it("povezanost ne zavisi od toga odakle se kreće", () => {
    for (const n of NODES) {
      expect(dostizni(n.id, true).size, n.id).toBe(NODES.length);
    }
  });
});

describe("putokaz", () => {
  it("nikad ne prikazuje grad koji nije direktan susjed", () => {
    for (const cvor of NODES) {
      const susjedi = new Set(edgesAt(cvor.id).map((e) => otherEnd(e, cvor.id)));
      // Provjera i za dolazak niotkuda i za dolazak sa svake strane.
      const dolasci: (string | null)[] = [null, ...susjedi];
      for (const odakle of dolasci) {
        for (const s of putokazi(cvor.id, { odakle }).smjerovi) {
          expect(susjedi.has(s.to.id), `${cvor.id} ← ${odakle}: ${s.to.id}`).toBe(true);
          expect(s.to.id, `${cvor.id}: nudi nazad`).not.toBe(odakle);
        }
      }
    }
  });

  it("ne nudi dvaput isti pravac i uvijek zna ivicu kojom se ide", () => {
    for (const cvor of NODES) {
      const p = putokazi(cvor.id);
      expect(new Set(p.smjerovi.map((s) => s.to.id)).size).toBe(p.smjerovi.length);
      for (const s of p.smjerovi) {
        expect(edgeById(s.edge.id)).toBeDefined();
        expect(otherEnd(s.edge, cvor.id)).toBe(s.to.id);
      }
    }
  });

  it("na graničnom prelazu je kraj puta i nudi se okretanje", () => {
    for (const g of NODES.filter((n) => n.kind === "granica")) {
      const susjed = edgesAt(g.id).map((e) => otherEnd(e, g.id));
      expect(susjed, g.id).toHaveLength(1);
      const odakle = susjed[0] ?? "";
      const p = putokazi(g.id, { odakle });
      expect(p.granica?.id).toBe(g.id);
      expect(p.slijepiKraj, g.id).toBeNull();
      expect(p.krajPuta).toBe(true);
      expect(p.smjerovi).toEqual([]);
      expect(p.nazad?.to.id).toBe(odakle);
    }
  });

  it("Kučka Korita su kraj puta sa okretanjem, isto kao granica", () => {
    const p = putokazi("kucka-korita", { odakle: "podgorica" });
    expect(p.krajPuta).toBe(true);
    expect(p.smjerovi).toEqual([]);
    expect(p.slijepiKraj?.id).toBe("kucka-korita");
    expect(p.granica).toBeNull();
    expect(p.nazad?.to.id).toBe("podgorica");
    // Iz Podgorice se tamo ide kao i svuda drugo — slijep je gornji kraj.
    expect(putokazi("podgorica").smjerovi.map((s) => s.to.id)).toContain("kucka-korita");
    expect(putokazi("podgorica").slijepiKraj).toBeNull();
  });

  it("list grafa koji nije proglašen slijepim nema poruku o kraju puta", () => {
    // Zeta, Petnjica i Gusinje su listovi samo zato što mreža tu prestaje.
    for (const id of ["zeta", "petnjica", "gusinje"]) {
      const odakle = edgesAt(id).map((e) => otherEnd(e, id))[0] ?? "";
      const p = putokazi(id, { odakle });
      expect(p.krajPuta, id).toBe(true);
      expect(p.granica, id).toBeNull();
      expect(p.slijepiKraj, id).toBeNull();
      expect(p.nazad?.to.id, id).toBe(odakle);
    }
  });

  it("sezonski pravac se nudi samo ljeti, ali se njime i dalje može vratiti", () => {
    const ljeti = putokazi("zabljak", { ljeto: true }).smjerovi.map((s) => s.to.id);
    const zimi = putokazi("zabljak", { ljeto: false }).smjerovi.map((s) => s.to.id);
    expect(ljeti).toContain("pluzine");
    expect(zimi).not.toContain("pluzine");
    // Dolazak sa Plužina: pravac nazad ostaje, jer se igrač njime i došao.
    expect(putokazi("zabljak", { odakle: "pluzine", ljeto: false }).nazad?.to.id).toBe("pluzine");
  });

  it("nepoznat čvor ne ruši putokaz", () => {
    const p = putokazi("atlantida");
    expect(p.smjerovi).toEqual([]);
    expect(p.krajPuta).toBe(true);
    expect(p.granica).toBeNull();
    expect(p.slijepiKraj).toBeNull();
  });
});

describe("krivine", () => {
  const planinske = EDGES.filter((e) => e.kind === "planinski");
  const njegusi = EDGES.find((e) => e.id === "njegusi--kotor") as RoadEdge;

  it("ima ih samo na planinskim ivicama", () => {
    for (const e of EDGES) {
      if (e.kind === "planinski") continue;
      expect(curvesFor(e, 1), e.id).toEqual([]);
    }
    expect(planinske.length).toBeGreaterThan(0);
  });

  it("po ivici ih je 4–8, osim gdje je broj zadat", () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const e of planinske) {
        const n = curvesFor(e, seed).length;
        if (e.id === "njegusi--kotor") expect(n).toBe(12);
        else expect(n, `${e.id} seed=${seed}`).toBeGreaterThanOrEqual(4);
        if (e.id !== "njegusi--kotor") expect(n, `${e.id} seed=${seed}`).toBeLessThanOrEqual(8);
      }
    }
  });

  it("Njeguši — Kotor ima fiksno dvanaest krivina bez obzira na sjeme", () => {
    const broj = new Set([1, 2, 3, 99, 12345].map((s) => curvesFor(njegusi, s).length));
    expect([...broj]).toEqual([12]);
  });

  it("preporučena brzina je 30, 35 ili 40", () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const e of planinske) {
        for (const k of curvesFor(e, seed)) {
          expect([30, 35, 40], `${e.id} seed=${seed}`).toContain(k.advisorySpeed);
        }
      }
    }
  });

  it("raspoređene su po dionici, redom i bez preklapanja", () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const e of planinske) {
        const k = curvesFor(e, seed);
        let prije = 0;
        for (const c of k) {
          expect(c.atKm, `${e.id} seed=${seed}`).toBeGreaterThan(prije);
          expect(c.atKm, `${e.id} seed=${seed}`).toBeLessThan(e.km);
          prije = c.atKm;
        }
      }
    }
  });

  it("serpentine se smjenjuju lijevo-desno", () => {
    const k = curvesFor(njegusi, 7);
    for (let i = 1; i < k.length; i++) {
      expect(k[i]?.side).not.toBe(k[i - 1]?.side);
    }
  });

  it("isto sjeme daje iste krivine, različito ih mijenja", () => {
    const e = EDGES.find((x) => x.id === "bioce--kolasin") as RoadEdge;
    expect(curvesFor(e, 42)).toEqual(curvesFor(e, 42));
    expect(curvesFor(e, 42)).not.toEqual(curvesFor(e, 43));
    // Dvije ivice sa istim sjemenom ne smiju dobiti isti raspored.
    const d = EDGES.find((x) => x.id === "zabljak--savnik") as RoadEdge;
    expect(curvesFor(e, 42)).not.toEqual(curvesFor(d, 42));
  });
});

describe("koordinate", () => {
  /** Rastojanje po velikom krugu [km]. */
  function vazdusnaLinija(a: RoadNode, b: RoadNode): number {
    const R = 6371;
    const rad = (x: number) => (x * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLon = rad(b.lon - a.lon);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  it("svaki čvor je unutar Crne Gore i njenog pograničja", () => {
    for (const n of NODES) {
      expect(n.lat, n.id).toBeGreaterThan(41.8);
      expect(n.lat, n.id).toBeLessThan(43.6);
      expect(n.lon, n.id).toBeGreaterThan(18.4);
      expect(n.lon, n.id).toBeLessThan(20.4);
    }
  });

  it("nijedna koordinata nije potvrđena — sve su procjena", () => {
    for (const n of NODES) expect(n.coordsVerified, n.id).toBe(false);
  });

  it("nema dva čvora na istom mjestu", () => {
    const kljucevi = NODES.map((n) => `${n.lat},${n.lon}`);
    expect(new Set(kljucevi).size).toBe(NODES.length);
  });

  /**
   * Ovo je prava provjera unosa: put je uvijek duži od vazdušne linije, nikad
   * kraći. Ako je vazdušna linija duža od kilometraže ivice, onda je jedna od
   * dvije brojke pogrešna — najvjerovatnije koordinata, jer su one procjena.
   *
   * Granica je kilometraža uvećana za 15% i 4 km: kilometraže su zaokružene, a
   * koordinate uzete iz centra mjesta, pa je i tačan unos malo neuredan.
   */
  it("nijedna ivica nije kraća od vazdušne linije između svojih krajeva", () => {
    const lose: string[] = [];
    for (const e of EDGES) {
      const a = nodeById(e.a);
      const b = nodeById(e.b);
      if (!a || !b) continue;
      const zrak = vazdusnaLinija(a, b);
      if (zrak > e.km * 1.15 + 4) {
        lose.push(`${e.id}: ${e.km} km po putu, ${zrak.toFixed(1)} km vazdušno`);
      }
    }
    expect(lose, lose.join("; ")).toEqual([]);
  });

  it("sjever je sjeverno, primorje je na jugozapadu", () => {
    const n = (id: string) => nodeById(id);
    expect(n("pljevlja")!.lat).toBeGreaterThan(n("podgorica")!.lat);
    expect(n("bar")!.lat).toBeLessThan(n("podgorica")!.lat);
    expect(n("herceg-novi")!.lon).toBeLessThan(n("rozaje")!.lon);
    expect(n("ulcinj")!.lat).toBeLessThan(n("zabljak")!.lat);
  });
});
