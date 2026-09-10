import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OKOLINA_POJAS } from "@/lib/game/sim/config";
import { EDGES, NODES } from "@/lib/game/road/roadGraph";
import { parseGeometry, type EdgeGeometry } from "@/lib/game/road/edgeGeometry";
import { parseKicma, type Kicma } from "@/lib/game/road/kicma";
import { nadjiRutu, napraviRutu, type Ruta } from "@/lib/game/world/ruta";
import {
  napraviPreslikavanje,
  preslikajTile,
  trakeOkoline,
  vrhoviZaRutu,
  type Povrsina,
  type TilePojava,
  type Vrh,
} from "@/lib/game/world/okolina";
import { tileoviRute } from "@/lib/game/world/tiles";

/**
 * Okolina pored puta.
 *
 * Dva sloja provjere. Prvi je račun na izmišljenim podacima — tu se tačno zna
 * šta mora ispasti. Drugi je stvarna Crna Gora iz `public/data/osm/tiles/`, jer
 * su se greške javljale baš na njoj: površina koja pojas samo dodirne, more
 * koje u OSM-u uopšte nije poligon.
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

const ruta = (od: string, doK: string): Ruta => {
  const cvorovi = nadjiRutu(od, doK);
  if (!cvorovi) throw new Error(`Nema rute ${od} — ${doK}`);
  return napraviRutu(cvorovi, GEOM, KICME);
};

/** Sve što tile-ovi jedne rute nose, već razvrstano. */
function izTileova(r: Ruta) {
  const pres = napraviPreslikavanje(r);
  const povrsine: Povrsina[] = [];
  const obale: [number, number][][] = [];
  let linija = 0;
  for (const kljuc of tileoviRute(r)) {
    const put = `public/data/osm/tiles/${kljuc}.json`;
    if (!existsSync(put)) continue;
    const sadrzaj = JSON.parse(readFileSync(put, "utf8")) as { v: TilePojava[] };
    const razvrstano = preslikajTile(r, pres, sadrzaj.v);
    povrsine.push(...razvrstano.povrsine);
    obale.push(...razvrstano.obale);
    linija += razvrstano.linije.length;
  }
  return { pres, povrsine, obale, linija };
}

describe("preslikavanje stvarnih koordinata u rutu", () => {
  const r = ruta("budva", "cetinje");
  const pres = napraviPreslikavanje(r);

  it("tačka NA osovini pada na osovinu, bez bočnog odmaka", () => {
    const d = r.dionice[0]!;
    for (const i of [0, Math.floor(d.stvarne.length / 2), d.stvarne.length - 1]) {
      const m = pres.uRutu(d.stvarne[i]!)!;
      expect(m).not.toBeNull();
      expect(Math.abs(m.bok)).toBeLessThan(0.5);
      expect(m.daljina).toBeLessThan(0.5);
      expect(m.s).toBeGreaterThanOrEqual(0);
      expect(m.s).toBeLessThanOrEqual(r.duzina);
    }
  });

  it("tačka pomjerena ulijevo ima pozitivan odmak, udesno negativan", () => {
    // Predznak je isti kao u `sim/road.ts`: lijevo od smjera vožnje je plus.
    const d = r.dionice[0]!;
    const i = Math.floor(d.stvarne.length / 2);
    const a = d.stvarne[i]!;
    const b = d.stvarne[i + 1]!;
    const duz = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const lijevo = { x: -(b.y - a.y) / duz, y: (b.x - a.x) / duz };
    const uLijevo = pres.uRutu({ x: a.x + lijevo.x * 30, y: a.y + lijevo.y * 30 })!;
    const uDesno = pres.uRutu({ x: a.x - lijevo.x * 30, y: a.y - lijevo.y * 30 })!;
    expect(uLijevo.bok).toBeGreaterThan(25);
    expect(uDesno.bok).toBeLessThan(-25);
    expect(uLijevo.daljina).toBeCloseTo(30, 0);
  });

  it("napredovanje po stvarnoj osovini napreduje i po ruti", () => {
    const d = r.dionice[0]!;
    let prethodno = -1;
    for (let i = 0; i < d.stvarne.length; i += 50) {
      const m = pres.uRutu(d.stvarne[i]!)!;
      expect(m.s).toBeGreaterThanOrEqual(prethodno - 1);
      prethodno = m.s;
    }
  });

  it("obrnuto preslikavanje vraća mjesto na istoj ruti", () => {
    for (let s = 0; s <= r.duzina; s += r.duzina / 50) {
      const u = pres.izRute(s)!;
      expect(u).not.toBeNull();
      const nazad = pres.uRutu(u.p)!;
      expect(nazad.s).toBeCloseTo(u.s, 0);
    }
  });
});

describe("trake pored puta", () => {
  // Ravnica Podgorica — Zeta, ne serpentina: izmišljena površina koja prati
  // krivudav put se na oštroj krivini omota oko njega i pojavi se s obje
  // strane. To je osobina te izmišljene površine, ne računa — pa se mjeri tamo
  // gdje ne smeta.
  const r = ruta("podgorica", "zeta");
  const pres = napraviPreslikavanje(r);

  /**
   * Površina koja pokriva jednu stranu rute, na `znak` strani.
   *
   * Gradi se po STVARNOJ osovini, korak po korak od četiri metra. Uzorkovanje
   * po sabijenoj dužini ne valja: pedeset sabijenih metara je četiri stotine
   * stvarnih, pa poligon presiječe svaku krivinu i završi s obje strane puta.
   */
  function stranaOko(znak: 1 | -1): Povrsina {
    const prsten: [number, number][] = [];
    const nazad: [number, number][] = [];
    const t = r.dionice[0]!.stvarne;
    for (let i = 1; i < t.length - 1; i += 5) {
      const a = t[i - 1]!;
      const b = t[i + 1]!;
      const duz = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const n = { x: (-(b.y - a.y) / duz) * znak, y: ((b.x - a.x) / duz) * znak };
      prsten.push([t[i]!.x + n.x * 10, t[i]!.y + n.y * 10]);
      nazad.push([t[i]!.x + n.x * 50, t[i]!.y + n.y * 50]);
    }
    const g = [...prsten, ...nazad.reverse()];
    const xs = g.map((p) => p[0]);
    const ys = g.map((p) => p[1]);
    return {
      k: "suma",
      prsten: g,
      okvir: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    };
  }

  it("površina lijevo od puta se očita kao lijeva strana", () => {
    const trake = trakeOkoline(r, pres, [stranaOko(1)]);
    const lijevih = trake.filter((t) => t.lijevo === "suma").length;
    const desnih = trake.filter((t) => t.desno === "suma").length;
    expect(lijevih).toBeGreaterThan(0);
    expect(desnih).toBe(0);
  });

  it("površina desno od puta se očita kao desna strana", () => {
    const trake = trakeOkoline(r, pres, [stranaOko(-1)]);
    expect(trake.filter((t) => t.desno === "suma").length).toBeGreaterThan(0);
    expect(trake.filter((t) => t.lijevo === "suma").length).toBe(0);
  });

  it("trake pokrivaju cijelu rutu, bez rupe i bez preklapanja", () => {
    const trake = trakeOkoline(r, pres, [stranaOko(1)]);
    expect(trake[0]!.odS).toBe(0);
    for (let i = 1; i < trake.length; i++) {
      expect(trake[i]!.odS).toBeCloseTo(trake[i - 1]!.doS, 6);
    }
    expect(trake[trake.length - 1]!.doS).toBeCloseTo(r.duzina, 0);
  });

  it("bez ijedne površine nema ničega ni sa jedne strane", () => {
    const trake = trakeOkoline(r, pres, []);
    for (const t of trake) {
      expect(t.lijevo).toBeNull();
      expect(t.desno).toBeNull();
    }
  });

  it("more se prepoznaje po smjeru obalne linije, iako nije poligon", () => {
    // U OpenStreetMap-u more NIJE poligon: `natural=coastline` je usmjeren tako
    // da je kopno lijevo a more desno. Zbog toga uz obalni put nema nijedne
    // `voda` površine — izmjereno, Bar — Ulcinj ih ima nula.
    const obala: [number, number][] = [];
    const t = r.dionice[0]!.stvarne;
    for (let i = 1; i < t.length - 1; i += 5) {
      const a = t[i - 1]!;
      const b = t[i + 1]!;
      const duz = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      // Linija ide uz put, pomjerena udesno; kopno joj je lijevo (put), more desno.
      obala.push([t[i]!.x + ((b.y - a.y) / duz) * 30, t[i]!.y - ((b.x - a.x) / duz) * 30]);
    }
    const trake = trakeOkoline(r, pres, [], [obala]);
    expect(trake.filter((t) => t.desno === "voda").length).toBeGreaterThan(0);
    expect(trake.filter((t) => t.lijevo === "voda").length).toBe(0);
  });
});

describe("okolina stvarne Crne Gore", { timeout: 120000 }, () => {
  it("uz obalni put se nađe more, iako ga u podacima nema kao površinu", () => {
    const r = ruta("kotor", "herceg-novi");
    const { pres, povrsine, obale } = izTileova(r);
    expect(obale.length).toBeGreaterThan(0);
    const trake = trakeOkoline(r, pres, povrsine, obale);
    const vode = trake
      .filter((t) => t.lijevo === "voda" || t.desno === "voda")
      .reduce((a, t) => a + (t.doS - t.odS), 0);
    expect(vode).toBeGreaterThan(0);
  });

  it("kroz kanjon Morače se vozi pored šume", () => {
    const r = ruta("bioce", "kolasin");
    const { pres, povrsine, obale } = izTileova(r);
    const trake = trakeOkoline(r, pres, povrsine, obale);
    const sume = trake
      .filter((t) => t.lijevo === "suma" || t.desno === "suma")
      .reduce((a, t) => a + (t.doS - t.odS), 0);
    expect(sume / r.duzina).toBeGreaterThan(0.3);
  });

  it("linije pored puta ostaju u pojasu", () => {
    // Rijeka koja put samo presiječe mora ostati kratak potez preko njega, a ne
    // linija koja bježi u beskraj.
    const r = ruta("budva", "cetinje");
    const pres = napraviPreslikavanje(r);
    for (const kljuc of tileoviRute(r).slice(0, 40)) {
      const put = `public/data/osm/tiles/${kljuc}.json`;
      if (!existsSync(put)) continue;
      const sadrzaj = JSON.parse(readFileSync(put, "utf8")) as { v: TilePojava[] };
      for (const linija of preslikajTile(r, pres, sadrzaj.v).linije) {
        for (const p of linija.tacke) {
          expect(Number.isFinite(p.x)).toBe(true);
          expect(Number.isFinite(p.y)).toBe(true);
        }
      }
    }
  });

  it("račun traka je brz koliko treba za pripremu", () => {
    const r = ruta("budva", "kolasin");
    const { pres, povrsine, obale } = izTileova(r);
    const pocetak = Date.now();
    const trake = trakeOkoline(r, pres, povrsine, obale);
    const ms = Date.now() - pocetak;
    expect(trake.length).toBeGreaterThan(20);
    // Ovo se ponavlja poslije svake grupe tile-ova, pa ne smije biti skupo.
    expect(ms).toBeLessThan(400);
  });

  it("pojas je uži od onoga što se vidi, pa okolina ne ulazi na put", () => {
    expect(OKOLINA_POJAS).toBeGreaterThan(26);
  });
});

describe("vrhovi na horizontu", () => {
  const SVI: Vrh[] = JSON.parse(readFileSync("public/data/osm/vrhovi.json", "utf8"));

  it("bira visoke vrhove blizu rute, a ne cijelu državu", () => {
    const r = ruta("podgorica", "kolasin");
    const izabrani = vrhoviZaRutu(r, SVI);
    expect(izabrani.length).toBeGreaterThan(0);
    expect(izabrani.length).toBeLessThanOrEqual(40);
    for (const v of izabrani) expect(v.visina).toBeGreaterThanOrEqual(1100);
  });

  it("ne imenuje planinu koja je preko države", () => {
    // Na primorskoj ruti se ne smije pojaviti vrh sa sjevera: horizont mora da
    // odgovara onome što se sa tog puta stvarno vidi.
    const r = ruta("bar", "budva");
    const izabrani = vrhoviZaRutu(r, SVI);
    const tacke = r.dionice.flatMap((d) => d.stvarne);
    for (const v of izabrani) {
      let najmanja = Infinity;
      for (const p of tacke) najmanja = Math.min(najmanja, Math.hypot(p.x - v.x, p.y - v.y));
      expect(najmanja).toBeLessThanOrEqual(25000);
    }
  });

  it("dvije udaljene rute nemaju iste vrhove", () => {
    const primorje = new Set(vrhoviZaRutu(ruta("bar", "budva"), SVI).map((v) => v.ime));
    const sjever = new Set(vrhoviZaRutu(ruta("zabljak", "pluzine"), SVI).map((v) => v.ime));
    const zajednicki = [...primorje].filter((ime) => sjever.has(ime));
    expect(zajednicki.length).toBe(0);
  });

  it("isti ulaz daje isti izbor", () => {
    const a = vrhoviZaRutu(ruta("budva", "cetinje"), SVI);
    const b = vrhoviZaRutu(ruta("budva", "cetinje"), SVI);
    expect(a.map((v) => v.ime)).toEqual(b.map((v) => v.ime));
  });

  it("prazan spisak vrhova ne ruši ništa", () => {
    expect(vrhoviZaRutu(ruta("budva", "cetinje"), [])).toEqual([]);
  });
});

describe("obris države za mini mapu", () => {
  const GRANICA: [number, number][][] = JSON.parse(
    readFileSync("public/data/osm/granica.json", "utf8"),
  );

  const okvir = (() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const komad of GRANICA) {
      for (const [x, y] of komad) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    return { minX, minY, maxX, maxY };
  })();

  it("pokriva državu i staje u nju", () => {
    // Crna Gora je oko 180 km široka i 150 km visoka; sve mnogo veće od toga
    // znači da je u fajl upao komad susjedne granice.
    expect((okvir.maxX - okvir.minX) / 1000).toBeGreaterThan(120);
    expect((okvir.maxX - okvir.minX) / 1000).toBeLessThan(260);
    expect((okvir.maxY - okvir.minY) / 1000).toBeGreaterThan(100);
    expect((okvir.maxY - okvir.minY) / 1000).toBeLessThan(260);
  });

  it("ruta pada unutar obrisa", () => {
    // Mini mapa crta rutu preko obrisa. Ako se koordinate razilaze, linija bi
    // izletjela van države — a to se sa slike ne bi odmah vidjelo.
    const r = ruta("herceg-novi", "rozaje");
    const pres = napraviPreslikavanje(r);
    for (let s = 0; s <= r.duzina; s += 250) {
      const u = pres.izRute(s);
      if (!u) continue;
      expect(u.p.x).toBeGreaterThanOrEqual(okvir.minX);
      expect(u.p.x).toBeLessThanOrEqual(okvir.maxX);
      expect(u.p.y).toBeGreaterThanOrEqual(okvir.minY);
      expect(u.p.y).toBeLessThanOrEqual(okvir.maxY);
    }
  });
});
