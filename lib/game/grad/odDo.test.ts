import { describe, expect, it } from "vitest";
import { GRAD_ODDO_PRAVILA, GRAD_ODDO_VRIJEME, GRAD_ODDO_TEZINE } from "../sim/config";
import { nasumicanCilj, ocjenaOdDo } from "./odDo";
import type { Odrediste } from "./odredista";

/** Vožnja od–do (stavka 9): bodovi po prekršajima i vremenu, i izbor nasumičnog cilja po težini. */
describe("vožnja od–do: ocjena", () => {
  it("bez prekršaja, u referentnom vremenu: puni bodovi i tri zvjezdice", () => {
    const ref = 1500 / GRAD_ODDO_TEZINE.srednje.brzina;
    const o = ocjenaOdDo("srednje", 1500, ref, 0, 0);
    expect(o.bodovi).toBe(GRAD_ODDO_PRAVILA + GRAD_ODDO_VRIJEME);
    expect(o.zvjezdice).toBe(3);
    // Brže od referentnog ne donosi više.
    expect(ocjenaOdDo("srednje", 1500, ref / 2, 0, 0).bodovi).toBe(o.bodovi);
  });

  it("duplo sporije: pola bodova za vrijeme", () => {
    const ref = 1000 / GRAD_ODDO_TEZINE.lako.brzina;
    expect(ocjenaOdDo("lako", 1000, 2 * ref, 0, 0).vrijeme).toBe(GRAD_ODDO_VRIJEME / 2);
  });

  it("prekršaji oduzimaju; pad mnogo više od upozorenja; ne ispod nule", () => {
    const ref = 1000 / GRAD_ODDO_TEZINE.lako.brzina;
    const jedno = ocjenaOdDo("lako", 1000, ref, 1, 0);
    const pad = ocjenaOdDo("lako", 1000, ref, 0, 1);
    expect(jedno.pravila).toBeLessThan(GRAD_ODDO_PRAVILA);
    expect(pad.pravila).toBeLessThan(jedno.pravila);
    expect(ocjenaOdDo("lako", 1000, ref, 0, 5).pravila).toBe(0);
    expect(pad.zvjezdice).toBeLessThan(3);
  });
});

describe("vožnja od–do: nasumičan cilj", () => {
  const o = (id: number, x: number, kategorija: Odrediste["kategorija"] = "skola"): Odrediste => ({
    id,
    ime: `O${id}`,
    kategorija,
    tacka: { x, y: 0 },
    ulaz: { x, y: 0 },
    ivica: 0,
    s: 0,
  });
  const lista = [o(0, 800), o(1, 2000), o(2, 4000), o(3, 1000, "znamenitost")];

  it("u rasponu težine, bez znamenitosti", () => {
    for (let k = 0; k < 20; k++) {
      const r = () => k / 20;
      expect(nasumicanCilj(lista, 0, 0, "lako", r)!.id).toBe(0);
      expect(nasumicanCilj(lista, 0, 0, "srednje", r)!.id).toBe(1);
      expect(nasumicanCilj(lista, 0, 0, "tesko", r)!.id).toBe(2);
    }
  });

  it("nijedan u rasponu: bilo koji koji nije znamenitost", () => {
    const c = nasumicanCilj([o(0, 50), o(1, 60, "znamenitost")], 0, 0, "tesko", () => 0.99);
    expect(c!.id).toBe(0);
  });
});
