import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LANDMARKS, landmarkTargetExists, landmarksAtNode, landmarksOnEdge } from "./landmarks";
import { EDGES, edgeById } from "./roadGraph";

const naDisku = (icon: string) => existsSync(path.join(process.cwd(), "public", icon));

describe("znamenitosti", () => {
  it("ima ih 78 i nijedna se ne ponavlja", () => {
    expect(LANDMARKS).toHaveLength(78);
    expect(new Set(LANDMARKS.map((l) => l.id)).size).toBe(LANDMARKS.length);
    expect(new Set(LANDMARKS.map((l) => l.name)).size).toBe(LANDMARKS.length);
  });

  it("svaka pokazuje na čvor ili ivicu koja u grafu postoji", () => {
    for (const l of LANDMARKS) {
      expect(landmarkTargetExists(l), `${l.id} → ${JSON.stringify(l.at)}`).toBe(true);
    }
  });

  it("položaj na ivici je unutar dionice i sa jedne od dvije strane", () => {
    for (const l of LANDMARKS) {
      if (l.at.kind !== "edge") continue;
      const e = edgeById(l.at.edge);
      expect(e, l.id).toBeDefined();
      expect(l.at.atKm, l.id).toBeGreaterThan(0);
      expect(l.at.atKm, l.id).toBeLessThan(e?.km ?? 0);
      expect(["left", "right"], l.id).toContain(l.at.side);
    }
  });

  it("nijedan položaj nije potvrđen — sve su procjene", () => {
    for (const l of LANDMARKS) expect(l.positionVerified, l.id).toBe(false);
  });

  it("ikona postoji na disku, i za svoju i za generičku", () => {
    for (const l of LANDMARKS) {
      expect(l.icon.startsWith("/assets/landmarks/"), l.id).toBe(true);
      expect(naDisku(l.icon), `${l.id}: ${l.icon}`).toBe(true);
    }
  });

  it("ikona vrste je označena kao generička, svoja nije", () => {
    for (const l of LANDMARKS) {
      expect(l.iconGeneric, l.id).toBe(l.icon === `/assets/landmarks/tip-${l.type}.svg`);
    }
    // Da provjera iznad ne bi prošla i kad bi sve bilo generičko.
    expect(LANDMARKS.filter((l) => !l.iconGeneric).length).toBeGreaterThan(10);
  });

  it("svaka vrsta ima svoju generičku ikonu, bez obzira na to ko je koristi", () => {
    for (const t of new Set(LANDMARKS.map((l) => l.type))) {
      expect(naDisku(`/assets/landmarks/tip-${t}.svg`), t).toBe(true);
    }
  });
});

describe("znamenitosti po dionici", () => {
  it("uz dionicu idu redom po kilometraži", () => {
    for (const e of EDGES) {
      const l = landmarksOnEdge(e.id);
      let prije = -1;
      for (const x of l) {
        const km = x.at.kind === "edge" ? x.at.atKm : -1;
        expect(km, `${e.id}: ${x.id}`).toBeGreaterThanOrEqual(prije);
        prije = km;
      }
    }
  });

  it("u suprotnom smjeru se preslikavaju i redoslijed i strana", () => {
    // Kotor — Kamenari: Perast 12, Gospa 13, Risan 18 od Kotora.
    const naprijed = landmarksOnEdge("kotor--kamenari").map((l) => l.id);
    const nazad = landmarksOnEdge("kotor--kamenari", true).map((l) => l.id);
    expect(naprijed).toEqual(["perast", "gospa-od-skrpjela", "risan-mozaici"]);
    expect(nazad).toEqual([...naprijed].reverse());

    const perastNapr = landmarksOnEdge("kotor--kamenari").find((l) => l.id === "perast");
    const perastNaz = landmarksOnEdge("kotor--kamenari", true).find((l) => l.id === "perast");
    expect(perastNapr?.at.kind === "edge" ? perastNapr.at.side : null).toBe("left");
    expect(perastNaz?.at.kind === "edge" ? perastNaz.at.side : null).toBe("right");
    expect(perastNaz?.at.kind === "edge" ? perastNaz.at.atKm : null).toBe(18);
  });

  it("ono što je samo kartica se ne pojavljuje uz put", () => {
    const kartice = LANDMARKS.filter((l) => l.cardOnly);
    expect(kartice.map((l) => l.id)).toEqual(["hridsko-jezero"]);
    for (const e of EDGES) {
      for (const l of landmarksOnEdge(e.id)) expect(l.cardOnly).toBeUndefined();
    }
    // Ali se i dalje vodi uz svoj čvor — samo se drugačije prikazuje.
    expect(landmarksAtNode("plav").map((l) => l.id)).toContain("hridsko-jezero");
  });

  it("nepoznata dionica vraća praznu listu umjesto da padne", () => {
    expect(landmarksOnEdge("nema--ovoga")).toEqual([]);
    expect(landmarksAtNode("atlantida")).toEqual([]);
  });

  it("gradovi sa više znamenitosti ih svi imaju", () => {
    expect(landmarksAtNode("podgorica").map((l) => l.id).sort()).toEqual(["duklja", "sahat-kula"]);
    expect(landmarksAtNode("bar").map((l) => l.id).sort()).toEqual([
      "dvorac-kralja-nikole-bar",
      "stari-bar",
    ]);
  });
});
