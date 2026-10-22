import { describe, expect, it } from "vitest";
import { GRAD_LINIJA_USTUPI_CRTICA, GRAD_SIRINA_TRAKE, GRAD_TROTOAR } from "../sim/config";
import type { Point } from "../sim/types";
import { krajeviLinija } from "./oznake";
import { naPovrsini, napraviPovrsinu, type Povrsina } from "./povrsina";
import { napraviRaskrsnice, zabraneSkretanja } from "./raskrsnica";
import { kruzniTok, testPaket, type TestIvica, type TestObjekat } from "./testMreza";
import { crtezPravila, trakeUlaza } from "./znakovi";

/**
 * Crtanje pravila — stavka 5c: stop-linije preko traka ulaza, znak desno od
 * onoga ko ulazi, zabrana ulaska u jednosmjernu, znakovi zabrane skretanja.
 * Krst: centar 0; krak 0 istok, 1 jug, 2 zapad, 3 sjever; ivice idu ka centru.
 */
let P: Povrsina;
const CVOROVI: Point[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 0, y: 100 },
  { x: -100, y: 0 },
  { x: 0, y: -100 },
];
function crtez(ivice: TestIvica[], objekti: TestObjekat[] = [], zabrane: [string, number, number, number][] = []) {
  const { paket, mreza } = testPaket(CVOROVI, ivice, objekti, zabrane);
  const odsjeci = krajeviLinija(mreza);
  const r = napraviRaskrsnice(paket, mreza, odsjeci);
  P = napraviPovrsinu(mreza);
  return { c: crtezPravila(P, r, zabraneSkretanja(paket), odsjeci), mreza };
}
const krst = (izmjene: Partial<TestIvica>[] = []): TestIvica[] =>
  [1, 2, 3, 4].map((a, i) => ({ a, b: 0, ...izmjene[i] }));

describe("crtanje pravila", () => {
  it("trake ulaza: dvosmjerna — desna polovina u smjeru vožnje; jednosmjerna — cijela", () => {
    const { mreza } = crtez(krst([{}, { smjer: 1 }]));
    // Ivica 0 ide od istoka ka centru (a → b); ulazi se preko b, desno je +.
    expect(trakeUlaza(mreza.ivice[0]!, 1)).toEqual([0, GRAD_SIRINA_TRAKE]);
    expect(trakeUlaza(mreza.ivice[0]!, 0)).toEqual([-GRAD_SIRINA_TRAKE, 0]);
    expect(trakeUlaza(mreza.ivice[1]!, 1)).toEqual([-GRAD_SIRINA_TRAKE, GRAD_SIRINA_TRAKE]);
  });

  it("STOP: puna linija preko desne polovine kraka, znak desno na trotoaru", () => {
    // Krak sa juga (ivica 1, ide na sjever ka centru): desno od vozača je istok.
    const { c } = crtez(krst(), [{ vrsta: "stop", podatak: "forward", ivica: 1, s: 92 }]);
    expect(c.pune).toHaveLength(1);
    const xs = c.pune[0]!.map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(0, 4);
    expect(Math.max(...xs)).toBeCloseTo(GRAD_SIRINA_TRAKE, 4);
    for (const p of c.pune[0]!) expect(Math.abs(p.y - 8)).toBeLessThanOrEqual(0.26);
    expect(c.znakovi.filter((z) => z.vrsta === "stop")).toEqual([{ vrsta: "stop", x: GRAD_SIRINA_TRAKE + GRAD_TROTOAR / 2, y: 8, izveden: false, nivo: 0 }]);
    // Ostala tri kraka imaju prednost nad krakom sa STOP-om: znak glavnog
    // puta na svakom, izveden (provjera mape).
    expect(c.znakovi.filter((z) => z.vrsta === "glavni").map((z) => z.izveden)).toEqual([true, true, true]);
  });

  it("ustupi (izvedeno): isprekidana linija i izveden znak, crta se isto kao pravi", () => {
    const { c } = crtez(krst([{ klasa: "primary" }, { klasa: "residential" }, { klasa: "primary" }, { klasa: "residential" }]));
    expect(c.pune).toHaveLength(0);
    // Dva sporedna kraka × crtice preko po jedne trake.
    expect(c.isprekidane.length).toBe(2 * Math.floor((GRAD_SIRINA_TRAKE + GRAD_LINIJA_USTUPI_CRTICA) / (2 * GRAD_LINIJA_USTUPI_CRTICA)));
    expect(c.znakovi.filter((z) => z.vrsta === "ustupi").map((z) => [z.vrsta, z.izveden])).toEqual([
      ["ustupi", true],
      ["ustupi", true],
    ]);
    // Glavna ulica (dva kraka) dobija znak glavnog puta, izveden.
    expect(c.znakovi.filter((z) => z.vrsta === "glavni").map((z) => z.izveden)).toEqual([true, true]);
  });

  it("prilaz iz dvorišta sa trouglom ne traži znak glavnog puta", () => {
    const { c } = crtez(krst([{ klasa: "primary" }, { klasa: "service" }, { klasa: "primary" }, { klasa: "service" }]));
    expect(c.znakovi.filter((z) => z.vrsta === "glavni")).toHaveLength(0);
  });

  it("semafor: puna linija i glava semafora desno od ulaza", () => {
    const { c } = crtez(krst(), [{ vrsta: "traffic_signals", cvor: 0 }]);
    expect(c.pune).toHaveLength(4);
    expect(c.semafori).toHaveLength(4);
    expect(c.znakovi).toHaveLength(0);
  });

  it("jednosmjerna ka raskrsnici: znak zabrane ulaska na njenom ušću, desno od onoga ko bi ušao", () => {
    // Ivica 1 (jug) jednosmjerna ka centru: iz raskrsnice se na jug ne smije.
    const { c } = crtez(krst([{}, { smjer: 1 }]));
    const z = c.znakovi.filter((x) => x.vrsta === "zabranaUlaska");
    expect(z).toHaveLength(1);
    // Ko bi ušao, vozio bi na jug; desno od njega je zapad (x < 0), iza ivice
    // kolovoza — i van zasječenog ugla raskrsnice, nikad na asfaltu.
    expect(z[0]!.x).toBeLessThan(-GRAD_SIRINA_TRAKE);
    expect(z[0]!.y).toBeGreaterThan(0);
    expect(naPovrsini(P, z[0]!.x, z[0]!.y)).toBe(false);
  });

  it("kružni tok: na svakom ulazu izveden znak kružnog toka uz ustupanje; na prstenu nema zabrane ulaska", () => {
    const { cvorovi, ivice } = kruzniTok();
    const { paket, mreza } = testPaket(cvorovi, ivice);
    const odsjeci = krajeviLinija(mreza);
    const povrsina = napraviPovrsinu(mreza);
    const c = crtezPravila(povrsina, napraviRaskrsnice(paket, mreza, odsjeci), zabraneSkretanja(paket), odsjeci);
    expect(c.znakovi.filter((z) => z.vrsta === "zabranaUlaska")).toEqual([]);
    const kt = c.znakovi.filter((z) => z.vrsta === "kruzniTok");
    expect(kt).toHaveLength(4);
    expect(kt.every((z) => z.izveden)).toBe(true);
    // Na istom stubu sa „ustupi" (ulaz popušta prstenu), iznad njega.
    for (const z of kt) {
      const ustupi = c.znakovi.find((u) => u.vrsta === "ustupi" && u.x === z.x && u.y === z.y);
      expect(ustupi).toBeDefined();
      expect(z.nivo).not.toBe(ustupi!.nivo);
    }
  });

  it("dva znaka na istom mjestu dijele stub: jedan iznad drugog", () => {
    // STOP i zabrana skretanja sa istog kraka, na istom mjestu.
    const { c } = crtez(krst(), [{ vrsta: "stop", podatak: "forward", ivica: 1, s: 92 }], [["no_left_turn", 1, 0, 2]]);
    const [stop, zabrana] = [c.znakovi.find((z) => z.vrsta === "stop")!, c.znakovi.find((z) => z.vrsta === "no_left_turn")!];
    expect(stop.nivo).toBe(0);
    expect(zabrana.nivo).toBe(1);
    expect([zabrana.x, zabrana.y]).toEqual([stop.x, stop.y]);
  });

  it("zabrana skretanja: znak na kraku sa kojeg važi", () => {
    const { c } = crtez(krst(), [], [["no_left_turn", 1, 0, 2]]);
    const z = c.znakovi.filter((x) => x.vrsta === "no_left_turn");
    expect(z).toHaveLength(1);
    // Na južnom kraku (y > 0), desno od vozača koji ide na sjever (x > 0).
    expect(z[0]!.y).toBeGreaterThan(0);
    expect(z[0]!.x).toBeGreaterThan(GRAD_SIRINA_TRAKE);
  });
});
