import { describe, expect, it } from "vitest";
import {
  dionicaIvice,
  listaZnakova,
  noviId,
  planOverlaya,
  pogodi,
  postavi,
  potvrdaRaskrsnice,
  procitajKoordinate,
  sidroKraka,
  sidroNaIvici,
  traziUlice,
  ukloni,
  upozorenja,
} from "./editorAlati";
import { LICENCA_OVERLAYA, VERZIJA_OVERLAYA, procitajOverlay, zapisiOverlay, type Overlay } from "./overlay";
import { svijetGrada } from "./svijet";
import { testPaket } from "./testMreza";

/**
 * Logika editora grada (stavka 6c). Krst: centar 0, krakovi 150 m; ivica i
 * od kraja kraka ka centru (0 istok, 1 jug, 2 zapad, 3 sjever); sjeverni
 * krak je `primary`, ostali `residential` → izvedeni prioritet.
 */
const ISHODISTE = { lat: 42.44, lon: 19.26 };
const potpis = { autor: "test", datum: "2026-10-02T10:00:00Z" };
const prazan = (): Overlay => ({ verzija: VERZIJA_OVERLAYA, grad: "test", licenca: LICENCA_OVERLAYA, ishodiste: ISHODISTE, izmjene: [] });

function grad(o: Overlay = prazan()) {
  const { paket } = testPaket(
    [
      { x: 0, y: 0 },
      { x: 150, y: 0 },
      { x: 0, y: 150 },
      { x: -150, y: 0 },
      { x: 0, y: -150 },
    ],
    [0, 1, 2, 3].map((i) => ({ a: i + 1, b: 0, klasa: i === 3 ? "primary" : "residential" })),
  );
  paket.n.ivOsm = Uint32Array.from([3000, 3001, 3002, 3003]);
  paket.zaglavlje.stringovi.push("Njegoševa");
  paket.n.ivIme = Uint16Array.from([paket.zaglavlje.stringovi.length - 1, 0, 0, 0]);
  return svijetGrada(paket, o);
}

describe("editor: šta je kliknuto", () => {
  const s = grad();
  it("centar je raskrsnica, ulica tik uz nju je krak, dalje je ulica", () => {
    expect(pogodi(s, { x: 1, y: 1 })).toEqual({ vrsta: "raskrsnica", r: 0 });
    const krak = pogodi(s, { x: 20, y: 1 });
    expect(krak?.vrsta).toBe("krak");
    expect(krak?.vrsta === "krak" && s.raskrsnice.lista[0]!.kraci[krak.k]!.ivica).toBe(0);
    const ulica = pogodi(s, { x: 90, y: 2 });
    expect(ulica?.vrsta === "ulica" && ulica.ivica).toBe(0);
    expect(pogodi(s, { x: 70, y: 70 })).toBeNull();
    expect(pogodi(s, { x: 149, y: 1 }, true)).toEqual({ vrsta: "cvor", cvor: 1 });
  });
});

describe("editor: izmjene", () => {
  it("ista vrsta na istom kraku zamjenjuje prethodnu; uklanjanje po id-u", () => {
    const s = grad();
    const krak = sidroKraka(s, 0, 0);
    let o = postavi(prazan(), { id: noviId(), ...potpis, vrsta: "kontrola", krak, kontrola: "stop" });
    o = postavi(o, { id: noviId(), ...potpis, vrsta: "kontrola", krak, kontrola: "ustupi" });
    expect(o.izmjene).toHaveLength(1);
    expect(o.izmjene[0]!.vrsta === "kontrola" && o.izmjene[0]!.kontrola).toBe("ustupi");
    o = postavi(o, { id: "z", ...potpis, vrsta: "zabranaUlaska", krak });
    expect(o.izmjene).toHaveLength(2);
    expect(ukloni(o, "z").izmjene).toHaveLength(1);
    // Ono što editor napravi prolazi provjeru i round-trip.
    expect(procitajOverlay(JSON.parse(zapisiOverlay(o)))).toEqual(o);
  });

  it("potvrda izvedenog: kontrole krakova iz editora, i raskrsnica više nije izvedena", () => {
    const s = grad();
    expect(s.raskrsnice.lista[0]!.inferredPriority).toBe(true);
    let o = prazan();
    for (const iz of potvrdaRaskrsnice(s, 0, potpis)) o = postavi(o, iz);
    const s2 = grad(o);
    expect(s2.raskrsnice.lista[0]!.inferredPriority).toBe(false);
    expect(s2.raskrsnice.lista[0]!.kraci.map((k) => k.kontrola)).toEqual(s.raskrsnice.lista[0]!.kraci.map((k) => k.kontrola));
  });

  it("plan semafora u obliku overlay-a vraća isti plan", () => {
    const { paket } = testPaket(
      [
        { x: 0, y: 0 },
        { x: 150, y: 0 },
        { x: 0, y: 150 },
        { x: -150, y: 0 },
        { x: 0, y: -150 },
      ],
      [0, 1, 2, 3].map((i) => ({ a: i + 1, b: 0 })),
      [{ vrsta: "traffic_signals", cvor: 0 }],
    );
    paket.n.ivOsm = Uint32Array.from([3000, 3001, 3002, 3003]);
    const s = svijetGrada(paket, prazan());
    const rs = s.raskrsnice.lista[0]!;
    const plan = planOverlaya(s, rs)!;
    const s2 = svijetGrada(paket, { ...prazan(), izmjene: [{ id: "p", ...potpis, vrsta: "semafor", raskrsnica: { x: 0, y: 0 }, plan }] });
    const r2 = s2.raskrsnice.lista[0]!;
    expect(r2.inferredPhases).toBe(false);
    expect(r2.plan!.faze.map((f) => [f.zeleno, f.kraci])).toEqual(rs.plan!.faze.map((f) => [f.zeleno, f.kraci]));
    expect(r2.plan!.ciklus).toBe(rs.plan!.ciklus);
  });

  it("dionica, sidro u pravcu strelice", () => {
    const s = grad();
    expect(dionicaIvice(s.mreza, 0)).toEqual([0]);
    const sid = sidroNaIvici(s.mreza, 0, 75, true);
    expect([sid.osm, sid.x, sid.y, sid.hx]).toEqual([3000, 75, 0, -1]);
    expect(sidroNaIvici(s.mreza, 0, 75, false).hx).toBe(1);
  });
});

describe("editor: pretraga, koordinate, upozorenja, lista znakova", () => {
  it("ulica po imenu, bez obzira na dijakritike i velika slova", () => {
    expect(traziUlice(grad().mreza, "njegos").map((x) => x.ime)).toEqual(["Njegoševa"]);
    expect(traziUlice(grad().mreza, "x")).toEqual([]);
  });

  it("koordinate: metri ili stepeni (ishodište je 0, 0)", () => {
    expect(procitajKoordinate("12.5, -30", ISHODISTE)).toEqual({ x: 12.5, y: -30 });
    const p = procitajKoordinate("42.441, 19.26", ISHODISTE)!;
    // 0,001° širine je 111 m na sjever (y je na jug); UTM sjever nije pravi
    // sjever ovako daleko od centralnog meridijana, pa ima i par metara u stranu.
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(111.1, 0);
    expect(p.y).toBeLessThan(-110);
    expect(procitajKoordinate("nešto", ISHODISTE)).toBeNull();
  });

  it("upozorenja: mješavina znaka iz editora i pravila desne strane", () => {
    const { paket } = testPaket(
      [
        { x: 0, y: 0 },
        { x: 150, y: 0 },
        { x: 0, y: 150 },
        { x: -150, y: 0 },
      ],
      [0, 1, 2].map((i) => ({ a: i + 1, b: 0 })),
    );
    paket.n.ivOsm = Uint32Array.from([4000, 4001, 4002]);
    const s0 = svijetGrada(paket, prazan());
    const o = postavi(prazan(), { id: "k", ...potpis, vrsta: "kontrola", krak: sidroKraka(s0, 0, 0), kontrola: "stop" });
    const s = svijetGrada(paket, o);
    expect(upozorenja(s, o).map((u) => u.tekst)).toEqual([expect.stringContaining("pravilo desne strane")]);
  });

  it("lista znakova za instruktora: CSV sa koordinatama i autorom", () => {
    const s = grad();
    const o = postavi(prazan(), { id: "k1", ...potpis, vrsta: "kontrola", krak: sidroKraka(s, 0, 0), kontrola: "stop" });
    const csv = listaZnakova(s, o);
    const redovi = csv.trim().split("\n");
    expect(redovi).toHaveLength(2);
    expect(redovi[1]).toContain('"STOP"');
    expect(redovi[1]).toContain('"test"');
    expect(redovi[1]).toMatch(/"42\.\d{6}";"19\.\d{6}"/);
  });
});
