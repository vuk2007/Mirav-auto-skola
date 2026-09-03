import { describe, expect, it } from "vitest";
import { polygonsOverlap, rectCorners } from "./geometry";

describe("preklapanje pravougaonika (SAT)", () => {
  const car = (x: number, y: number, hx: number, hy: number) =>
    rectCorners({ x, y }, { x: hx, y: hy }, 4.4, 1.8);

  it("dva daleka vozila se ne preklapaju", () => {
    expect(polygonsOverlap(car(-1.75, -67, 0, 1), car(-67, 1.75, 1, 0))).toBe(false);
  });

  it("vozilo se preklapa samo sa sobom", () => {
    expect(polygonsOverlap(car(0, 0, 0, 1), car(0, 0, 0, 1))).toBe(true);
  });

  it("vozila jedno pored drugog u susjednim trakama se ne preklapaju", () => {
    expect(polygonsOverlap(car(-1.75, 0, 0, 1), car(1.75, 0, 0, -1))).toBe(false);
  });

  it("vozila koja se dodiruju bokom se preklapaju", () => {
    expect(polygonsOverlap(car(0, 0, 0, 1), car(1.5, 0, 0, 1))).toBe(true);
  });

  it("ukrštena vozila u sredini raskrsnice se preklapaju", () => {
    expect(polygonsOverlap(car(0, 0, 0, 1), car(0, 0, 1, 0))).toBe(true);
  });
});
