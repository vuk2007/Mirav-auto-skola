import { describe, expect, it } from "vitest";
import type { Point } from "../sim/types";
import { exitOf, whoYields, type Approach, type EffectiveControl, type Intent } from "../../simRules";
import { krajeviLinija } from "./oznake";
import {
  koUstupa,
  kontrolaUcesnika,
  manevarKroz,
  stranaKraka,
  sukobPutanja,
  type KontrolaUcesnika,
  type UcesnikPrednosti,
} from "./prednost";
import { napraviRaskrsnice } from "./raskrsnica";
import { testPaket, type TestIvica, type TestObjekat } from "./testMreza";

/**
 * Prvenstvo na raskrsnici grada (stavka 7). `y` raste na jug: istok je 0°,
 * jug 90°, zapad 180°, sjever 270°.
 */
function zvijezda(uglovi: number[], izmjene: Partial<TestIvica>[] = [], objekti: TestObjekat[] = []) {
  const cvorovi: Point[] = [{ x: 0, y: 0 }];
  const ivice: TestIvica[] = [];
  uglovi.forEach((u, i) => {
    const a = (u * Math.PI) / 180;
    cvorovi.push({ x: 100 * Math.cos(a), y: 100 * Math.sin(a) });
    ivice.push({ a: i + 1, b: 0, ...izmjene[i] });
  });
  const { paket, mreza } = testPaket(cvorovi, ivice, objekti);
  const r = napraviRaskrsnice(paket, mreza, krajeviLinija(mreza)).lista[0]!;
  /** Krak čija je ivica `i` (redom kako su uglovi zadati). */
  const krak = (i: number) => r.kraci.findIndex((k) => k.ivica === i);
  return { mreza, r, krak };
}

describe("prvenstvo: isto kao whoYields na krstu (sve kombinacije)", () => {
  // Sjever, istok, jug, zapad.
  const { mreza, r, krak } = zvijezda([270, 0, 90, 180]);
  const KRAK: Record<Approach, number> = { N: krak(0), E: krak(1), S: krak(2), W: krak(3) };
  const KONTROLA: Record<EffectiveControl, KontrolaUcesnika> = {
    priority: "glavni",
    yield: "ustupi",
    stop: "stop",
    none: "desna",
    green: "zeleno",
    yellow: "zuto",
    red: "crveno",
  };
  const strane: Approach[] = ["N", "E", "S", "W"];
  const namjere: Intent[] = ["straight", "left", "right"];
  const kontrole = Object.keys(KONTROLA) as EffectiveControl[];

  it("manevri krsta odgovaraju namjerama", () => {
    for (const s of strane) {
      expect(manevarKroz(mreza, r, KRAK[s], KRAK[exitOf(s, "straight")])).toBe("pravo");
      expect(manevarKroz(mreza, r, KRAK[s], KRAK[exitOf(s, "left")])).toBe("lijevo");
      expect(manevarKroz(mreza, r, KRAK[s], KRAK[exitOf(s, "right")])).toBe("desno");
    }
  });

  it("koUstupa === whoYields", () => {
    let provjereno = 0;
    const uc = (s: Approach, i: Intent, c: EffectiveControl, uPrstenu: boolean, hitno: boolean): UcesnikPrednosti => ({
      ulaz: KRAK[s],
      izlaz: KRAK[exitOf(s, i)],
      manevar: manevarKroz(mreza, r, KRAK[s], KRAK[exitOf(s, i)]),
      kontrola: KONTROLA[c],
      uPrstenu,
      ukljucivanje: false,
      hitno,
    });
    for (const sa of strane)
      for (const sb of strane)
        for (const ia of namjere)
          for (const ib of namjere)
            for (const ca of kontrole)
              for (const cb of kontrole)
                for (const [ra, rb, ha, hb] of [
                  [false, false, false, false],
                  [true, false, false, false],
                  [false, true, false, false],
                  [false, false, true, false],
                  [false, false, false, true],
                ] as const) {
                  const ocekivano = whoYields(
                    { approach: sa, intent: ia, control: ca, inRing: ra, emergency: ha },
                    { approach: sb, intent: ib, control: cb, inRing: rb, emergency: hb },
                  );
                  expect(koUstupa(mreza, r, uc(sa, ia, ca, ra, ha), uc(sb, ib, cb, rb, hb))).toBe(ocekivano);
                  provjereno += 1;
                }
    expect(provjereno).toBe(4 * 4 * 3 * 3 * 7 * 7 * 5);
  });
});

describe("prvenstvo: proizvoljna raskrsnica", () => {
  const uc = (ulaz: number, izlaz: number, m: Parameters<typeof manevarKroz>[0], r: Parameters<typeof manevarKroz>[1], kontrola: KontrolaUcesnika = "desna"): UcesnikPrednosti => ({
    ulaz,
    izlaz,
    manevar: manevarKroz(m, r, ulaz, izlaz),
    kontrola,
    uPrstenu: false,
    ukljucivanje: false,
  });

  it("pet krakova: oba kraka desno od mene su „sa desne strane“, a lijevi meni ustupaju", () => {
    // Ja dolazim sa juga (90°). Krakovi: 10° i 330° su desno od mene (istok,
    // sjeveroistok), 210° lijevo, 270° je sjever — suprotan.
    const { mreza, r, krak } = zvijezda([90, 10, 330, 270, 210]);
    expect(stranaKraka(mreza, r, krak(0), krak(1))).toBe("desno");
    expect(stranaKraka(mreza, r, krak(0), krak(2))).toBe("desno");
    expect(stranaKraka(mreza, r, krak(0), krak(3))).toBe("pravo");
    expect(stranaKraka(mreza, r, krak(0), krak(4))).toBe("lijevo");
    const ja = uc(krak(0), krak(3), mreza, r);
    expect(koUstupa(mreza, r, ja, uc(krak(1), krak(4), mreza, r))).toBe("a");
    expect(koUstupa(mreza, r, ja, uc(krak(2), krak(0), mreza, r))).toBe("a");
    expect(koUstupa(mreza, r, ja, uc(krak(4), krak(1), mreza, r))).toBe("b");
  });

  it("ukošena raskrsnica: krak pod 165° je suprotan (skretanje manje od 30°) — ljevak mu ustupa", () => {
    const { mreza, r, krak } = zvijezda([90, 285, 0]);
    expect(stranaKraka(mreza, r, krak(0), krak(1))).toBe("pravo");
    // Sa juga je krak na 285° „pravo“ (15°), a istok desno. Ko sa 285° skreće
    // na istok skreće lijevo — i ustupa meni koji idem pravo.
    const ja = uc(krak(0), krak(1), mreza, r);
    const on = uc(krak(1), krak(2), mreza, r);
    expect(on.manevar).toBe("lijevo");
    expect(koUstupa(mreza, r, ja, on)).toBe("b");
  });

  it("polukružno propušta sve, i na glavnom putu (odluka korisnika)", () => {
    const { mreza, r, krak } = zvijezda([270, 0, 90, 180]);
    const okret = uc(krak(2), krak(2), mreza, r, "glavni");
    expect(okret.manevar).toBe("polukruzno");
    // Vozilo sa sporedne (trougao) — okret mu ipak ustupa.
    expect(koUstupa(mreza, r, okret, uc(krak(1), krak(3), mreza, r, "ustupi"))).toBe("a");
    // Ali ne onome ko ne prolazi (crveno).
    expect(koUstupa(mreza, r, okret, uc(krak(1), krak(3), mreza, r, "crveno"))).toBe("b");
  });

  it("uključivanje sa servisnog puta propušta sve — i vozilo sa svoje lijeve strane", () => {
    const { mreza, r, krak } = zvijezda([270, 0, 90, 180]);
    // Sa istoka (servis) pravo na zapad; sa juga pravo na sjever — jug je
    // istočnom vozilu lijevo, po pravilu desne strane bi mu ustupao jug.
    const servis = { ...uc(krak(1), krak(3), mreza, r), ukljucivanje: true };
    const jug = uc(krak(2), krak(0), mreza, r);
    expect(stranaKraka(mreza, r, krak(2), krak(1))).toBe("desno");
    expect(koUstupa(mreza, r, servis, jug)).toBe("a");
    expect(koUstupa(mreza, r, jug, servis)).toBe("b");
  });

  it("dvotračni kružni tok: izlaz iz unutrašnje trake propušta onoga u spoljnoj", () => {
    // Čvor prstena: prsten ulazi sa zapada (krak 0) i nastavlja na istok
    // (krak 2), izlaz je na jug (krak 1). Oba vozila dolaze prstenom.
    const { mreza, r, krak } = zvijezda([180, 90, 0]);
    const unutra = { ...uc(krak(0), krak(1), mreza, r, "glavni"), uPrstenu: true, izUnutrasnje: true };
    const spoljaKrug = { ...uc(krak(0), krak(2), mreza, r, "glavni"), uPrstenu: true };
    const spoljaIzlaz = { ...uc(krak(0), krak(1), mreza, r, "glavni"), uPrstenu: true };
    expect(koUstupa(mreza, r, unutra, spoljaKrug)).toBe("a");
    expect(koUstupa(mreza, r, spoljaKrug, unutra)).toBe("b");
    // I kad oba izlaze na isti krak: spoljni prvi, unutrašnji se uključuje iza.
    expect(koUstupa(mreza, r, unutra, spoljaIzlaz)).toBe("a");
    // Ulaz u prsten i dalje ustupa svima u prstenu, i unutrašnjem.
    const ulaz = uc(krak(1), krak(2), mreza, r, "ustupi");
    expect(koUstupa(mreza, r, ulaz, unutra)).toBe("a");
    // Bez trake (jednotračni prsten): ravnopravni, odlučuje dolazak.
    expect(koUstupa(mreza, r, spoljaIzlaz, spoljaKrug)).toBe(null);
  });

  it("dopunska zelena strelica pušta uz ustupanje: ustupa zelenom", () => {
    const { mreza, r, krak } = zvijezda([270, 0, 90, 180]);
    const strelica = uc(krak(2), krak(1), mreza, r, "strelica");
    const zeleno = uc(krak(1), krak(3), mreza, r, "zeleno");
    expect(koUstupa(mreza, r, strelica, zeleno)).toBe("a");
  });
});

describe("prvenstvo: kontrola učesnika iz modela raskrsnice", () => {
  it("znak sa kraka; semafor po vremenu", () => {
    // Semafor u čvoru: dvije faze po osi, sjever–jug prva.
    const { r, krak } = zvijezda([270, 0, 90, 180], [], [{ vrsta: "traffic_signals", cvor: 0 }]);
    const plan = r.plan!;
    const t0 = plan.ciklus - plan.pomak + 1; // ciklus počinje: prva faza zelena
    const sjever = krak(0);
    const istok = krak(1);
    const prva = plan.faze[0]!.kraci.includes(sjever);
    expect(kontrolaUcesnika(r, sjever, t0, "pravo")).toBe(prva ? "zeleno" : "crveno");
    expect(kontrolaUcesnika(r, istok, t0, "pravo")).toBe(prva ? "crveno" : "zeleno");
  });

  it("bez semafora: kontrola kraka", () => {
    const { r, krak } = zvijezda([270, 0, 90], [{ klasa: "primary" }, { klasa: "residential" }, { klasa: "primary" }]);
    expect(kontrolaUcesnika(r, krak(1), 0, "lijevo")).toBe("ustupi");
    expect(kontrolaUcesnika(r, krak(0), 0, "pravo")).toBe("glavni");
  });
});

describe("sukob putanja", () => {
  const linija = (a: Point, b: Point, n = 20): Point[] =>
    Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }));

  it("ukrštanje: mjesto sukoba na obje putanje", () => {
    const s = sukobPutanja(linija({ x: -20, y: 0 }, { x: 20, y: 0 }, 40), linija({ x: 0, y: 20 }, { x: 0, y: -20 }, 40), 2.4)!;
    expect(s.spajanje).toBe(false);
    // Tačke na po metar: prvi dodir je 2,4 m prije sredine (18 m), ± korak.
    for (const x of [s.sa, s.sb]) {
      expect(x).toBeGreaterThanOrEqual(17);
      expect(x).toBeLessThanOrEqual(19);
    }
  });

  it("ukrštanje: zona sukoba je kratka (kraj blizu početka)", () => {
    const s = sukobPutanja(linija({ x: -20, y: 0 }, { x: 20, y: 0 }, 40), linija({ x: 0, y: 20 }, { x: 0, y: -20 }, 40), 2.4)!;
    expect(s.ka - s.sa).toBeLessThan(6);
    expect(s.kb - s.sb).toBeLessThan(6);
  });

  it("putanje jedna preko druge u suprotnim smjerovima: zona sukoba je cijeli zajednički komad", () => {
    // Dva lijeva skretanja na pomjerenoj raskrsnici: 15 m istim prostorom,
    // jedno ka istoku, drugo ka zapadu. Prošao je tek kad prođe cijeli komad.
    const ka = [...linija({ x: -10, y: 10 }, { x: 0, y: 0 }, 14), ...linija({ x: 1, y: 0 }, { x: 15, y: 0 }, 14)];
    const kz = [...linija({ x: 25, y: -10 }, { x: 15, y: 0 }, 14), ...linija({ x: 14, y: 0 }, { x: 0, y: 0 }, 14)];
    const s = sukobPutanja(ka, kz, 2.4)!;
    expect(s.spajanje).toBe(false);
    // Zajednički komad je od x = 0 do x = 15; na obje putanje počinje na
    // oko 14 m, pa je kraj zone oko 29 m — i jedno i drugo vozilo je
    // „prošlo" tek kad izađe sa cijelog komada, ne kad prođe prvi dodir.
    for (const kraj of [s.ka, s.kb]) {
      expect(kraj).toBeGreaterThan(27);
      expect(kraj).toBeLessThanOrEqual(29.2);
    }
    expect(s.sa).toBeLessThan(15);
  });

  it("spajanje na isti izlaz", () => {
    const pravo = linija({ x: -20, y: 2 }, { x: 20, y: 2 }, 40);
    const desno = [...linija({ x: 2, y: 20 }, { x: 2, y: 3 }, 17), ...linija({ x: 3, y: 2 }, { x: 20, y: 2 }, 17)];
    const s = sukobPutanja(desno, pravo, 2.4)!;
    expect(s.spajanje).toBe(true);
  });

  it("ista traka na početku nije sukob; paralelne trake nisu sukob", () => {
    expect(sukobPutanja(linija({ x: 0, y: 0 }, { x: 30, y: 0 }), linija({ x: 0, y: 0 }, { x: 0, y: 30 }), 2.4)).toBeNull();
    expect(sukobPutanja(linija({ x: 0, y: 0 }, { x: 30, y: 0 }), linija({ x: 0, y: 4.25 }, { x: 30, y: 4.25 }), 2.4)).toBeNull();
  });
});
