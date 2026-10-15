import { describe, expect, it } from "vitest";
import { CAR_LENGTH, DT, GRAD_HITNO_PREKO_LINIJE, GRAD_HITNO_TRPI, GRAD_SIRINA_TRAKE } from "../sim/config";
import type { Point } from "../sim/types";
import { VOZILO_HITNOG, type HitnoZaSudiju } from "./hitna";
import { krajeviLinija } from "./oznake";
import { napraviPovrsinu } from "./povrsina";
import { napraviRaskrsnice, svjetlo, zabraneSkretanja } from "./raskrsnica";
import type { SlobodnoVozilo } from "./slobodno";
import { gradZaSudiju, noviSudija, sudi } from "./sudija";
import { svijetGrada } from "./svijet";
import { testPaket } from "./testMreza";
import { putanja } from "./vozacGrad";

/**
 * Hitno vozilo iza igrača (stavka 8e, odluke korisnika 2026-10-15): van
 * raskrsnice mora se skloniti udesno i usporiti ili stati; ko ostane na sred
 * trake (ili ubrza) duže od `GRAD_HITNO_TRPI` s — pad. Na crvenom smije
 * oprezno preći stop-liniju da ga propusti, ali ne i proći raskrsnicu.
 */
const T = GRAD_SIRINA_TRAKE / 2;
const DUZINA = VOZILO_HITNOG.hitna.duzina;

/** Hitno vozilo sredinom `c` na putanji `tacke` (sredina trake), pravca `ugao`. */
function hitno(tacke: Point[], c: Point, ugao: number): HitnoZaSudiju {
  const put = putanja(tacke);
  return { id: 3, x: c.x, y: c.y, ugao, duzina: DUZINA, sirina: VOZILO_HITNOG.hitna.sirina, put, s: Math.hypot(c.x - tacke[0]!.x, c.y - tacke[0]!.y) };
}

/**
 * Ulica od istoka ka zapadu (x opada), desna traka na `y = −T`; desno od
 * vožnje na zapad je −y. Igrač kreće sa `x = 0`; hitno vozilo ga prati
 * `iza` m (sredina do sredine) — u istoj traci ili u suprotnoj.
 */
function naUlici(o: {
  v: (t: number) => number;
  bok: (t: number) => number;
  iza?: number;
  suprotno?: boolean;
  uKoloni?: boolean;
  /** Hitno stoji i čeka baš igrača (npr. treba mu njegova traka). */
  cekaMe?: boolean;
  trajanje?: number;
}) {
  const { paket } = testPaket(
    [
      { x: 400, y: 0 },
      { x: -400, y: 0 },
    ],
    [{ a: 0, b: 1, klasa: "primary", trake: 2 }],
  );
  const sv = svijetGrada(paket, null, []);
  const sud = noviSudija(3);
  const st: SlobodnoVozilo = { x: 0, y: -T, ugao: Math.PI, v: o.v(0), tocak: 0, rikverc: false, kocnicaStoji: 0, udar: false, predjeno: 20 };
  const traka = o.suprotno ? T : -T;
  const tacke = o.suprotno
    ? [
        { x: -400, y: T },
        { x: 400, y: T },
      ]
    : [
        { x: 400, y: -T },
        { x: -400, y: -T },
      ];
  for (let t = 0; t < (o.trajanje ?? 12); t += DT) {
    st.v = o.v(t);
    st.x -= st.v * DT;
    st.y = -T - o.bok(t);
    const hx = o.suprotno ? st.x - (o.iza ?? 12) : st.x + (o.iza ?? 12);
    const h = { ...hitno(tacke, { x: hx, y: traka }, o.suprotno ? 0 : Math.PI), cekaMe: o.cekaMe };
    sudi(sv.zaSudiju, sud, st, t, null, o.uKoloni ?? false, null, [], [h]);
  }
  return sud.prekrsaji;
}

const vrste = (p: { vrsta: string }[]) => p.map((x) => x.vrsta);
/** Do 0,8 m udesno za sekundu, od trenutka `od`. */
const udesno = (od: number) => (t: number) => Math.max(0, Math.min(0.8, (t - od) * 0.8));

describe("hitno vozilo iza igrača — sudija", () => {
  it("ostane na sred trake i vozi dalje: pad, prijavljen jednom", () => {
    const p = naUlici({ v: () => 10, bok: () => 0 });
    expect(vrste(p)).toEqual(["emergencyVehicle"]);
    expect(p[0]!.ozbiljnost).toBe("fail");
    // Prijavljen tek kad je prošlo `GRAD_HITNO_TRPI` s.
    expect(p[0]!.t).toBeGreaterThan(GRAD_HITNO_TRPI);
    expect(p[0]!.t).toBeLessThan(GRAD_HITNO_TRPI + 0.5);
  });

  it("stane na sred trake: i to je pad — mora se skloniti udesno", () => {
    expect(vrste(naUlici({ v: () => 0, bok: () => 0 }))).toEqual(["emergencyVehicle"]);
  });

  it("skloni se udesno i uspori: bez prekršaja", () => {
    expect(vrste(naUlici({ v: (t) => Math.max(3, 10 - 3 * t), bok: udesno(0.5) }))).toEqual([]);
  });

  it("skloni se udesno i stane: bez prekršaja (ni parkiranje)", () => {
    expect(vrste(naUlici({ v: (t) => Math.max(0, 10 - 3 * t), bok: udesno(0.5), trajanje: 40 }))).toEqual([]);
  });

  it("skloni se udesno, ali ne uspori (ostane brz): pad", () => {
    expect(vrste(naUlici({ v: () => 12, bok: udesno(0.5) }))).toEqual(["emergencyVehicle"]);
  });

  it("skloni se kasno, ali prije `GRAD_HITNO_TRPI` s: bez prekršaja", () => {
    expect(vrste(naUlici({ v: (t) => (t < GRAD_HITNO_TRPI - 2 ? 10 : 3), bok: udesno(GRAD_HITNO_TRPI - 2) }))).toEqual([]);
  });

  it("hitno vozilo daleko iza: nije prekršaj", () => {
    expect(vrste(naUlici({ v: () => 10, bok: () => 0, iza: 50 }))).toEqual([]);
  });

  it("hitno vozilo u suprotnoj traci: nije prekršaj", () => {
    expect(vrste(naUlici({ v: () => 10, bok: () => 0, suprotno: true }))).toEqual([]);
  });

  it("stane dok mu hitno ide u susret, i stoji dugo: ni hitno ni parkiranje", () => {
    expect(vrste(naUlici({ v: () => 0, bok: () => 0, suprotno: true, trajanje: 40 }))).toEqual([]);
  });

  it("stoji u koloni (nema kud): nije prekršaj", () => {
    expect(vrste(naUlici({ v: () => 0, bok: () => 0, uKoloni: true }))).toEqual([]);
  });

  it("nije u traci hitnog, ali hitno stoji i čeka baš njega: pad", () => {
    expect(vrste(naUlici({ v: () => 0, bok: () => 0, suprotno: true, cekaMe: true }))).toEqual(["emergencyVehicle"]);
  });

  it("pomjerio se udesno i stao, a hitno i dalje stoji i čeka njega (nije mu napravio mjesta): pad", () => {
    expect(vrste(naUlici({ v: (t) => Math.max(0, 10 - 3 * t), bok: udesno(0.5), cekaMe: true }))).toEqual(["emergencyVehicle"]);
  });
});

/**
 * Na crvenom: krst sa semaforom (čvor 0 je centar, 1 istok, 2 jug, 3 zapad,
 * 4 sjever); igrač dolazi sa juga (y opada) u desnoj traci `x = T` i stoji
 * na liniji, hitno vozilo stoji iza njega.
 */
describe("hitno vozilo iza igrača na crvenom", () => {
  const { paket, mreza } = testPaket(
    [
      { x: 0, y: 0 },
      { x: 150, y: 0 },
      { x: 0, y: 150 },
      { x: -150, y: 0 },
      { x: 0, y: -150 },
    ],
    [1, 2, 3, 4].map((a) => ({ a, b: 0 })),
    [{ vrsta: "traffic_signals", cvor: 0 }],
  );
  const odsjeci = krajeviLinija(mreza);
  const rs = napraviRaskrsnice(paket, mreza, odsjeci);
  const G = gradZaSudiju(paket, napraviPovrsinu(mreza), rs, zabraneSkretanja(paket), odsjeci);
  const r = rs.lista[0]!;
  const k = r.kraci.findIndex((x) => x.ivica === 1 && x.kraj === 1);
  const stopD = r.kraci[k]!.stopD!;
  // Prvi trenutak crvenog.
  let t0 = 0;
  while (!(svjetlo(r, k, t0) === "zuto" && svjetlo(r, k, t0 + DT) === "crveno")) t0 += DT;
  t0 += DT;
  /** y linije: nos auta (sredina − pola dužine) na njoj. */
  const linijaY = stopD;

  /**
   * Stoji 0,5 m pred linijom, 2 s; onda puzi 1,5 m/s pravo naprijed `pomak`
   * m (i 0,8 m udesno), pa stoji. Sudi do zelenog i još 3 s.
   */
  function propusti(pomak: number, saHitnim = true) {
    const sud = noviSudija(3);
    const y0 = linijaY + CAR_LENGTH / 2 + 0.5;
    const st: SlobodnoVozilo = { x: T, y: y0, ugao: -Math.PI / 2, v: 0, tocak: 0, rikverc: false, kocnicaStoji: 0, udar: false, predjeno: 50 };
    const tacke = [
      { x: T, y: 150 },
      { x: T, y: -150 },
    ];
    const h = hitno(tacke, { x: T, y: y0 + 12 }, -Math.PI / 2);
    let predjeno = 0;
    let t = t0;
    let zeleno: number | null = null;
    while (zeleno === null || t < zeleno + 3) {
      if (zeleno === null && svjetlo(r, k, t) === "zeleno") zeleno = t;
      st.v = t > t0 + 2 && predjeno < pomak && zeleno === null ? 1.5 : 0;
      predjeno += st.v * DT;
      st.y -= st.v * DT;
      st.x = T + Math.min(0.8, predjeno * 0.4);
      t += DT;
      sudi(G, sud, st, t, null, false, null, [], saHitnim ? [h] : []);
    }
    return vrste(sud.prekrsaji);
  }

  it("samo stoji na liniji do zelenog (smije, ne mora preći): bez prekršaja", () => {
    expect(propusti(0)).toEqual([]);
  });

  it("pređe liniju malo da napravi mjesto, pa stane do zelenog: bez prekršaja", () => {
    expect(propusti(3)).toEqual([]);
  });

  it("isto bez hitnog vozila iza: prolazak na crveno", () => {
    expect(propusti(3, false)).toContain("redLight");
  });

  it("ode dalje od dozvoljenog dok je crveno: prolazak na crveno", () => {
    expect(propusti(GRAD_HITNO_PREKO_LINIJE + 6)).toEqual(["redLight"]);
  });
});
