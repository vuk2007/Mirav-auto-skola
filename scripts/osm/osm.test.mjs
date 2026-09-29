import { describe, expect, it } from "vitest";
import { haversine, uMetre, uStepene } from "./lib/proj.mjs";
import { duzina, naDuzini, uprosti } from "./lib/geom.mjs";
import { iseciLiniju, iseciPoligon, povrsina } from "./lib/iseci.mjs";
import { podijeli } from "./lib/mreza.mjs";
import { NODES } from "./lib/graf.mjs";
import { prikljucci } from "./lib/prikljucci.mjs";
import { napraviMrezu } from "./lib/rutiranje.mjs";

/**
 * Testovi za pripremu OSM podataka.
 *
 * Ovdje se ne provjerava nista sto zavisi od mreze — Overpass je tudji servis i
 * test koji ga gadja nije test nego prognoza vremena. Provjerava se racun:
 * projekcija, uproscavanje i sjecenje na tile-ove.
 */

describe("projekcija UTM 34N", () => {
  it("vraca istu tacku kad se ide tamo pa nazad", () => {
    for (const n of NODES) {
      const { x, y } = uMetre(n.lat, n.lon);
      const nazad = uStepene(x, y);
      // 1e-8 stepeni je oko milimetra. Toliko je greska skracene Snyderove
      // serije; strozi prag bi mjerio zaokruzivanje, ne projekciju.
      expect(Math.abs(nazad.lat - n.lat)).toBeLessThan(1e-8);
      expect(Math.abs(nazad.lon - n.lon)).toBeLessThan(1e-8);
    }
  });

  it("daje ista rastojanja kao racun po velikom krugu", () => {
    // Ako se projekcija i haversinus raziđu, greska je u formuli — podaci u
    // ovom poredjenju uopste ne ucestvuju.
    let najgore = 0;
    for (const a of NODES) {
      for (const b of NODES) {
        if (a.id >= b.id) continue;
        const pa = uMetre(a.lat, a.lon);
        const pb = uMetre(b.lat, b.lon);
        const ravno = Math.hypot(pb.x - pa.x, pb.y - pa.y);
        const luk = haversine(a.lat, a.lon, b.lat, b.lon);
        if (luk < 1000) continue;
        najgore = Math.max(najgore, Math.abs(ravno - luk) / luk);
      }
    }
    // Zona 34 pocinje na 18°, a Crna Gora se pruza do njenog zapadnog ruba, pa
    // je izoblicenje najvece bas ovdje. Ispod pola procenta je za nas i vise
    // nego dovoljno: to je metar i po na svakih 300 m.
    expect(najgore).toBeLessThan(0.005);
  });

  it("smjesta Crnu Goru u zonu 34N, a ne u okean", () => {
    const pg = uMetre(42.44, 19.26);
    // Zona 34N: istocno rastojanje je oko 500 km (centralni meridijan), sjeverno
    // oko 4700 km od ekvatora. Provjera da se predznaci i pomaci ne izgube.
    expect(pg.x).toBeGreaterThan(300000);
    expect(pg.x).toBeLessThan(700000);
    expect(pg.y).toBeGreaterThan(4600000);
    expect(pg.y).toBeLessThan(4900000);
  });
});

describe("uproscavanje", () => {
  const kriva = Array.from({ length: 200 }, (_, i) => [i, Math.sin(i / 8) * 30]);

  it("zadrzava krajeve", () => {
    const u = uprosti(kriva, 5);
    expect(u[0]).toEqual(kriva[0]);
    expect(u.at(-1)).toEqual(kriva.at(-1));
  });

  it("skida tacke, a ne oblik", () => {
    const u = uprosti(kriva, 2);
    expect(u.length).toBeLessThan(kriva.length);
    // Nijedna izbacena tacka ne smije biti dalje od dozvoljenog od nove linije.
    for (const p of kriva) {
      let najblize = Infinity;
      for (let i = 1; i < u.length; i++) {
        const a = u[i - 1];
        const b = u[i];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const kv = dx * dx + dy * dy;
        const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / kv));
        najblize = Math.min(najblize, Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)));
      }
      expect(najblize).toBeLessThanOrEqual(2.0001);
    }
  });

  it("ne puca na dugackoj liniji", () => {
    // Obalna linija zna imati desetine hiljada tacaka u jednom komadu; rekurzivna
    // izvedba je na tome probijala stek.
    const duga = Array.from({ length: 60000 }, (_, i) => [i, (i % 7) * 0.3]);
    expect(() => uprosti(duga, 1)).not.toThrow();
  });
});

describe("tacka na duzini", () => {
  it("pogadja sredinu i smjer", () => {
    const t = naDuzini(
      [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      15,
    );
    expect(t.p[0]).toBeCloseTo(10);
    expect(t.p[1]).toBeCloseTo(5);
    expect(t.smjer[1]).toBeCloseTo(1);
  });
});

describe("sjecenje na tile-ove", () => {
  const TILE = 2000;
  const tileOkvir = (tx, ty) => [tx * TILE, ty * TILE, (tx + 1) * TILE, (ty + 1) * TILE];

  it("cuva ukupnu duzinu linije", () => {
    // Ovo je jedini test koji stvarno nesto garantuje: ako se linija isijece na
    // tile-ove i komadi budu ukupno kraci, negdje je nestao dio puta.
    const linija = [
      [500, 500],
      [7300, 1200],
      [7500, 6400],
      [1100, 5200],
    ];
    const cijela = duzina(linija);
    let zbir = 0;
    for (let tx = 0; tx <= 4; tx++) {
      for (let ty = 0; ty <= 4; ty++) {
        for (const komad of iseciLiniju(linija, tileOkvir(tx, ty))) zbir += duzina(komad);
      }
    }
    expect(zbir).toBeCloseTo(cijela, 4);
  });

  it("cuva ukupnu povrsinu poligona", () => {
    const poligon = [
      [300, 400],
      [6800, 900],
      [7200, 5600],
      [900, 4900],
    ];
    const cijela = povrsina(poligon);
    let zbir = 0;
    for (let tx = 0; tx <= 4; tx++) {
      for (let ty = 0; ty <= 4; ty++) {
        const dio = iseciPoligon(poligon, tileOkvir(tx, ty));
        if (dio.length >= 3) zbir += povrsina(dio);
      }
    }
    expect(zbir).toBeCloseTo(cijela, 3);
  });

  it("ne ostavlja nijednu tacku van svog tile-a", () => {
    const r = tileOkvir(1, 1);
    const komadi = iseciLiniju(
      [
        [0, 2500],
        [5000, 2600],
      ],
      r,
    );
    for (const komad of komadi) {
      for (const [x, y] of komad) {
        expect(x).toBeGreaterThanOrEqual(r[0] - 1e-6);
        expect(x).toBeLessThanOrEqual(r[2] + 1e-6);
        expect(y).toBeGreaterThanOrEqual(r[1] - 1e-6);
        expect(y).toBeLessThanOrEqual(r[3] + 1e-6);
      }
    }
  });

  it("izbacuje ono sto tile ne dodiruje", () => {
    expect(iseciLiniju([[0, 0], [100, 100]], tileOkvir(3, 3))).toEqual([]);
    expect(iseciPoligon([[0, 0], [100, 0], [100, 100]], tileOkvir(3, 3))).toEqual([]);
  });
});

describe("dijeljenje okvira na mrezu", () => {
  it("pokriva cio okvir bez rupa", () => {
    const dijelovi = podijeli("41.75,18.30,43.62,20.45", 4, 4);
    expect(dijelovi).toHaveLength(16);
    const brojevi = dijelovi.map((d) => d.split(",").map(Number));
    expect(Math.min(...brojevi.map((b) => b[0]))).toBeCloseTo(41.75, 3);
    expect(Math.min(...brojevi.map((b) => b[1]))).toBeCloseTo(18.3, 3);
    expect(Math.max(...brojevi.map((b) => b[2]))).toBeCloseTo(43.62, 3);
    expect(Math.max(...brojevi.map((b) => b[3]))).toBeCloseTo(20.45, 3);
  });
});

describe("raskrsnice duz ivice", () => {
  /**
   * Mala mreza: ruta ide duz x ose od cvora 1 do 5, na po 100 m. Na nju
   * izlaze putevi koji jesu i koji nisu raskrsnice. Koordinate su u stepenima
   * jer mreza projektuje sama; 0.001 stepen je ovdje ~80-110 m.
   */
  const cvor = (id, x, y) => ({ type: "node", id, lat: 42 + y * 0.0009, lon: 19 + x * 0.00122 });
  const put = (id, nodes, tags) => ({ type: "way", id, nodes, tags: { highway: "tertiary", ...tags } });
  const elementi = [
    ...[1, 2, 3, 4, 5].map((i) => cvor(i, i, 0)),
    cvor(20, 2, 1), // lijevo od cvora 2, pod pravim uglom
    cvor(30, 3, -1), // desno od cvora 3
    cvor(40, 4.9, 0.05), // skoro paralelno uz cvor 4 — druga kolovozna traka
    cvor(41, 4, -1), // desno od cvora 4, ali put iste oznake kao ruta
    put(100, [1, 2, 3, 4, 5], { ref: "M-2" }),
    put(200, [2, 20], {}),
    put(300, [3, 30], { highway: "unclassified" }),
    put(400, [4, 40], { oneway: "yes" }),
    put(410, [4, 41], { ref: "M-2" }),
  ];
  const mreza = napraviMrezu(elementi, { tertiary: 1, unclassified: 1 });
  const oznake = new Map(elementi.filter((e) => e.type === "way").map((e) => [e.id, e.tags]));
  const opis = (w) => ({ ref: oznake.get(w)?.ref ?? "", jednosmjeran: oznake.get(w)?.oneway === "yes" });
  const nadji = () => prikljucci(mreza, [1, 2, 3, 4, 5], { putevi: [100, 100, 100, 100], opis });

  it("nalazi pravi sporedni put sa obje strane, u smjeru ivice", () => {
    const p = nadji();
    expect(p.map((x) => x.strana)).toEqual(["lijevo", "desno"]);
    expect(p[0].s).toBeLessThan(p[1].s);
    expect(p[1].rang).toBe("unclassified");
  });

  it("odbacuje drugu kolovoznu traku i put iste oznake kao ruta", () => {
    // Cvor 4 ima dvije grane, i nijedna nije raskrsnica.
    const p = nadji();
    expect(p).toHaveLength(2);
  });

  it("spaja bliske na istoj strani i ne dira krajeve", () => {
    const p = prikljucci(mreza, [1, 2, 3, 4, 5], { putevi: [100, 100, 100, 100], opis, spoji: 150 });
    // Lijevo i desno su na razlicitim stranama, pa ostaju oba i kad su blizu.
    expect(p).toHaveLength(2);
    const bezKrajeva = prikljucci(mreza, [1, 2, 3, 4, 5], { putevi: [100, 100, 100, 100], opis, odKraja: 150 });
    // Oba su na ~100 i ~200 m od pocetka rute duge ~400 m: prvi pada u kraj.
    expect(bezKrajeva.map((x) => x.strana)).toEqual(["desno"]);
  });
});
