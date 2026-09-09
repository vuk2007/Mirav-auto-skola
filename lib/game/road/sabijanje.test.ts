import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MIN_CURVE_RADIUS,
  RADIUS_STRAIGHT,
  SCALE_STRAIGHT,
} from "@/lib/game/sim/config";
import { EDGES, edgeById } from "@/lib/game/road/roadGraph";
import { osovina, parseGeometry, type EdgeGeometry } from "@/lib/game/road/edgeGeometry";
import {
  faktorZaPoluprecnik,
  preporucenaBrzina,
  obrni,
  preuzorkuj,
  sabij,
  zaobli,
  zakrivljenost,
} from "@/lib/game/road/sabijanje";
import type { Point } from "@/lib/game/sim/types";

/**
 * Sabijanje stvarne geometrije.
 *
 * Testovi rade nad STVARNIM podacima iz `public/data/osm/edgeGeometry/`, a ne
 * nad izmišljenim: sabijanje se lomilo baš na onome što izmišljena kriva nema —
 * na nepravilnom razmaku tačaka i na serpentinama oštrijim od dozvoljene
 * granice. Fajlove pravi `npm run osm:ivice` i oni su u repozitorijumu.
 */

const geometrija = (id: string): EdgeGeometry => {
  const raw = JSON.parse(readFileSync(`public/data/osm/edgeGeometry/${id}.json`, "utf8"));
  const g = parseGeometry(raw);
  if (!g) throw new Error(`Neispravna geometrija: ${id}`);
  return g;
};

/** Sabijena dionica traje toliko sekundi na ograničenju svoje ivice. */
function minuta(id: string): number {
  const e = edgeById(id);
  if (!e) throw new Error(`Nema ivice ${id}`);
  return sabij(osovina(geometrija(id))).duzina / (e.speedLimit / 3.6) / 60;
}

/** Prav put dug `n` metara. */
const pravac = (n: number): Point[] => [
  { x: 0, y: 0 },
  { x: 0, y: n },
];

/** Luk poluprečnika `r`, ukupnog ugla `ugao` [rad]. */
function luk(r: number, ugao: number, korak = 2): Point[] {
  const out: Point[] = [];
  const koraka = Math.max(2, Math.round((r * ugao) / korak));
  for (let i = 0; i <= koraka; i++) {
    const a = (ugao * i) / koraka;
    out.push({ x: r * (1 - Math.cos(a)), y: r * Math.sin(a) });
  }
  return out;
}

describe("preuzorkovanje", () => {
  it("daje jednake razmake i čuva krajeve", () => {
    const t = [
      { x: 0, y: 0 },
      { x: 0, y: 3 },
      { x: 0, y: 100 },
    ];
    const u = preuzorkuj(t, 4);
    expect(u[0]).toEqual({ x: 0, y: 0 });
    expect(u.at(-1)!.y).toBeCloseTo(100, 6);
    for (let i = 1; i < u.length; i++) {
      const d = Math.hypot(u[i]!.x - u[i - 1]!.x, u[i]!.y - u[i - 1]!.y);
      expect(d).toBeCloseTo(100 / (u.length - 1), 6);
    }
  });
});

describe("zakrivljenost", () => {
  it("na luku poluprečnika R daje 1/R", () => {
    const u = preuzorkuj(luk(200, Math.PI / 2), 4);
    const k = zakrivljenost(u, 4);
    // Krajevi trpe od izglađivanja, pa se gleda sredina luka.
    const sredina = k.slice(Math.floor(k.length * 0.3), Math.floor(k.length * 0.7));
    const prosjek = sredina.reduce((a, b) => a + b, 0) / sredina.length;
    expect(Math.abs(1 / prosjek)).toBeGreaterThan(180);
    expect(Math.abs(1 / prosjek)).toBeLessThan(220);
  });

  it("na pravcu je nula", () => {
    const k = zakrivljenost(preuzorkuj(pravac(400), 4), 4);
    for (const x of k) expect(Math.abs(x)).toBeLessThan(1e-9);
  });
});

describe("faktor sabijanja", () => {
  it("prav put dobija pun faktor, krivudav najmanji", () => {
    expect(faktorZaPoluprecnik(Infinity)).toBe(SCALE_STRAIGHT);
    expect(faktorZaPoluprecnik(RADIUS_STRAIGHT + 1)).toBe(SCALE_STRAIGHT);
    expect(faktorZaPoluprecnik(50)).toBeLessThan(faktorZaPoluprecnik(400));
  });

  it("raste sa poluprečnikom, bez skokova", () => {
    let prethodni = 0;
    for (let r = 10; r < 1200; r += 10) {
      const f = faktorZaPoluprecnik(r);
      expect(f).toBeGreaterThanOrEqual(prethodni - 1e-9);
      prethodni = f;
    }
  });
});

describe("sabijanje", () => {
  it("prav put skraćuje tačno za pun faktor", () => {
    const s = sabij(pravac(2000));
    expect(s.duzina).toBeCloseTo(2000 / SCALE_STRAIGHT, 1);
    expect(s.skretanje).toBeCloseTo(0, 6);
  });

  it("krivinu ne pravi oštrijom od donje granice", () => {
    // Luk od 100 m poluprečnika: sabijanje ga smije skratiti najviše 4x
    // (100 / 25), pa poluprečnik ostaje na granici, ne ispod nje.
    const s = sabij(luk(100, Math.PI / 2));
    expect(s.najmanjiPoluprecnik).toBeGreaterThanOrEqual(MIN_CURVE_RADIUS - 0.5);
  });

  it("ne dira krivinu koja je i u prirodi oštrija od granice", () => {
    // Serpentina od 12 m poluprečnika je već ispod granice. Ispravljati je
    // značilo bi izmišljati put koji ne postoji, pa faktor mora ostati 1.
    const s = sabij(luk(12, Math.PI));
    expect(s.duzina).toBeCloseTo(s.stvarnaDuzina, 0);
    expect(s.najmanjiPoluprecnik).toBeGreaterThan(10);
  });

  it("čuva ukupno skretanje", () => {
    // Ovo je jedino čime sabijena dionica ostaje ISTI put: dužina se mijenja,
    // uglovi ne. Da se skretanje gubi, Njeguši bi prestali biti serpentina.
    //
    // Poredi se sa ZAOBLJENOM linijom, ne sa sirovom: zaobljavanje uglova koje
    // je unijelo uprošćavanje dešava se prije sabijanja i ono jeste jedina
    // izmjena geometrije. Sabijanje poslije njega ne mijenja nijedan ugao.
    const t = luk(150, (3 * Math.PI) / 4);
    const s = sabij(t);
    const zaobljeno = zaobli(preuzorkuj(t, 4), 4);
    const k = zakrivljenost(zaobljeno, 4);
    const stvarno = k.reduce((a, x) => a + Math.abs(x) * 4, 0);
    expect(s.skretanje).toBeCloseTo(stvarno, 6);
  });

  it("odlazak i povratak su ista dionica", () => {
    const t = osovina(geometrija("njegusi--kotor"));
    const tamo = sabij(t);
    const nazad = obrni(tamo);
    expect(nazad.duzina).toBeCloseTo(tamo.duzina, 6);
    expect(nazad.skretanje).toBeCloseTo(tamo.skretanje, 6);
    expect(nazad.krivine).toHaveLength(tamo.krivine.length);
    // Prva krivina u povratku je posljednja u odlasku, i na drugu stranu.
    const prva = nazad.krivine[0]!;
    const posljednja = tamo.krivine[tamo.krivine.length - 1]!;
    expect(prva.atS).toBeCloseTo(tamo.duzina - posljednja.atS, 6);
    expect(prva.side).not.toBe(posljednja.side);
    // Preslikavanje je u SOPSTVENOM okviru dionice: nula je tamo gdje ta vožnja
    // počinje, bez obzira na to koji je kraj ivice to. Pretvaranje u kilometražu
    // mjerenu od čvora `a` je zaseban posao i ne radi se ovdje.
    expect(nazad.uStvarni(0)).toBeCloseTo(0, 3);
    expect(nazad.uStvarni(nazad.duzina)).toBeCloseTo(nazad.stvarnaDuzina, 3);
    expect(nazad.uSabijeni(0)).toBeCloseTo(0, 3);
    expect(nazad.uSabijeni(nazad.stvarnaDuzina)).toBeCloseTo(nazad.duzina, 3);
  });

  it("preslikavanje je monotono i obrnuto se poklapa", () => {
    const s = sabij(osovina(geometrija("njegusi--kotor")));
    let prethodni = -1;
    for (let x = 0; x <= s.stvarnaDuzina; x += s.stvarnaDuzina / 200) {
      const y = s.uSabijeni(x);
      expect(y).toBeGreaterThanOrEqual(prethodni);
      prethodni = y;
      // Tamo pa nazad mora vratiti isto mjesto; ovo je preslikavanje po kojem
      // se okolina i mini mapa vezuju za sabijeni put.
      expect(s.uStvarni(y)).toBeCloseTo(x, 0);
    }
    expect(s.uSabijeni(0)).toBe(0);
    expect(s.uSabijeni(s.stvarnaDuzina)).toBeCloseTo(s.duzina, 6);
  });
});

describe("sabijanje cijele mreže", { timeout: 60000 }, () => {
  const sabijene = EDGES.map((e) => ({ e, s: sabij(osovina(geometrija(e.id))) }));

  it("nijedna krivina ne postane oštrija nego što jeste", () => {
    // Pravilo, u jednoj rečenici: poslije sabijanja poluprečnik ne smije pasti
    // ispod dvadeset pet metara, a tamo gdje je stvarni put i sam oštriji od
    // toga — ne smije pasti ispod stvarnog. Igra ne ispravlja teren.
    for (const { e, s } of sabijene) {
      const granica = Math.min(s.najmanjiStvarni, MIN_CURVE_RADIUS);
      expect(s.najmanjiPoluprecnik, e.id).toBeGreaterThanOrEqual(granica - 0.01);
    }
  });

  it("nijedan faktor nije manji od jedan", () => {
    // Faktor ispod jedan bi značio da je dionica u igri DUŽA nego u prirodi.
    for (const { e, s } of sabijene) {
      for (const f of s.faktori) expect(f, e.id).toBeGreaterThanOrEqual(1 - 1e-9);
    }
  });

  it("svaka ivica se stvarno skratila", () => {
    for (const { e, s } of sabijene) {
      expect(s.duzina, e.id).toBeLessThan(s.stvarnaDuzina);
      expect(s.duzina, e.id).toBeGreaterThan(0);
    }
  });

  it("nijedna tabla ne obećava više nego što krivina nosi", () => {
    for (const { e, s } of sabijene) {
      for (const c of s.krivine) {
        expect(preporucenaBrzina(c.radius), `${e.id} @ ${c.atS}`).toBe(c.advisorySpeed);
      }
    }
  });

  it("krivine su poređane i ne preklapaju se", () => {
    for (const { e, s } of sabijene) {
      for (let i = 1; i < s.krivine.length; i++) {
        const prije = s.krivine[i - 1]!;
        const sad = s.krivine[i]!;
        expect(sad.atS, e.id).toBeGreaterThan(prije.atS);
      }
    }
  });

  it("ravnicu ne pretvara u serpentinu, ni serpentinu u ravnicu", () => {
    const zeta = sabijene.find((x) => x.e.id === "podgorica--zeta")!;
    const njegusi = sabijene.find((x) => x.e.id === "njegusi--kotor")!;
    expect(zeta.s.krivine.length).toBeLessThan(5);
    expect(njegusi.s.krivine.length).toBeGreaterThan(20);
  });
});

describe("razmjera putovanja", { timeout: 60000 }, () => {
  it("Budva → Kolašin traje između 15 i 20 minuta", () => {
    // Ruta po grafu: Budva — Cetinje — Podgorica — Bioče — Kolašin. Stvarnih
    // 132 km; na ograničenju bi to bilo preko dva sata.
    const put = ["cetinje--budva", "podgorica--cetinje", "podgorica--bioce", "bioce--kolasin"];
    const ukupno = put.reduce((a, id) => a + minuta(id), 0);
    expect(ukupno).toBeGreaterThan(15);
    expect(ukupno).toBeLessThan(20);
  });

  it("prosječna dionica traje oko četiri minuta", () => {
    const svi = EDGES.map((e) => minuta(e.id));
    const prosjek = svi.reduce((a, b) => a + b, 0) / svi.length;
    expect(prosjek).toBeGreaterThan(2.5);
    expect(prosjek).toBeLessThan(5);
  });
});
