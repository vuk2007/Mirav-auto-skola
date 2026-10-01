import { describe, expect, it } from "vitest";
import { GRAD_SEMAFOR_SVE_CRVENO, GRAD_SEMAFOR_ZUTO } from "../sim/config";
import type { Point } from "../sim/types";
import { napraviMrezu } from "./mreza";
import {
  LICENCA_OVERLAYA,
  VERZIJA_OVERLAYA,
  podatakZnaka,
  primijeniNaPaket,
  procitajOverlay,
  sidroUlice,
  procitajZnak,
  zapisiOverlay,
  zoneGrada,
  type Izmjena,
  type Overlay,
  type SidroKraka,
  type SidroUlice,
  type Zona,
} from "./overlay";
import type { Paket } from "./paket";
import { svjetlo, zelenaStrelica } from "./raskrsnica";
import { svijetGrada } from "./svijet";
import { testPaket, type TestIvica, type TestObjekat } from "./testMreza";

/**
 * Overlay iz editora (faza 6, stavka 6; zadatak, odjeljak 8): round-trip
 * (učitaj → izmijeni → sačuvaj → učitaj = isto) i prednost overlay-a nad
 * OSM-om u svakom polju koje dira. `y` raste na jug.
 */

const ISHODISTE = { lat: 42.44, lon: 19.26 };

let brojac = 0;
const osnova = () => ({ id: `t${++brojac}`, autor: "test", datum: "2026-10-01T12:00:00Z" });
const overlay = (izmjene: Izmjena[]): Overlay => ({
  verzija: VERZIJA_OVERLAYA,
  grad: "test",
  licenca: LICENCA_OVERLAYA,
  ishodiste: ISHODISTE,
  izmjene,
});

/**
 * Krst sa OSM id-ovima: centar 0, krakovi 1 (sjever), 2 (istok), 3 (jug), 4
 * (zapad), 100 m. Ivica `i` ide od kraja kraka ka centru i ima OSM id
 * `1000 + i`. Krak 0 (sjever) je `primary`, ostali `residential`.
 */
const KRST_CVOROVI: Point[] = [
  { x: 0, y: 0 },
  { x: 0, y: -100 },
  { x: 100, y: 0 },
  { x: 0, y: 100 },
  { x: -100, y: 0 },
];
function krst(izmjeneIvica: Partial<TestIvica>[] = [], objekti: TestObjekat[] = [], redoslijed = [0, 1, 2, 3]): Paket {
  const ivice: TestIvica[] = redoslijed.map((i) => ({ a: i + 1, b: 0, klasa: i === 0 ? "primary" : "residential", ...izmjeneIvica[i] }));
  const { paket } = testPaket(KRST_CVOROVI, ivice, objekti);
  paket.n.ivOsm = Uint32Array.from(redoslijed, (i) => 1000 + i);
  return paket;
}

/** Sidro na kraku `i` krsta (0 sjever … 3 zapad), 20 m od centra, pravac ka centru. */
function naKraku(i: number): SidroUlice {
  const k = KRST_CVOROVI[i + 1]!;
  const l = Math.hypot(k.x, k.y);
  return sidroUlice(1000 + i, { x: (k.x / l) * 20, y: (k.y / l) * 20 }, { x: -k.x / l, y: -k.y / l });
}
const krak = (i: number): SidroKraka => ({ raskrsnica: { x: 0, y: 0 }, ulica: naKraku(i) });

/** Krak raskrsnice po indeksu ivice — kraci su sortirani po uglu, ne po ivici. */
function krakIvice(s: ReturnType<typeof svijetGrada>, ivica: number) {
  const r = s.raskrsnice.lista[0]!;
  return r.kraci.find((k) => k.ivica === ivica)!;
}

describe("overlay: čitanje i pisanje", () => {
  const sve: Izmjena[] = [
    { ...osnova(), vrsta: "kontrola", krak: krak(1), kontrola: "stop" },
    { ...osnova(), vrsta: "skretanje", krak: krak(2), znak: { vrsta: "zabrana", manevri: ["lijevo"] } },
    { ...osnova(), vrsta: "zabranaUlaska", krak: krak(3), ukloni: false },
    {
      ...osnova(),
      vrsta: "semafor",
      raskrsnica: { x: 0, y: 0 },
      plan: {
        faze: [
          { zeleno: 20, kraci: [{ krak: krak(0), manevri: null }], strelice: [{ krak: krak(1), manevri: ["desno"] }], pjesaci: [krak(2)] },
          { zeleno: 15, kraci: [{ krak: krak(1), manevri: ["pravo", "lijevo"] }], strelice: [], pjesaci: [] },
        ],
        zuto: 3,
        sveCrveno: 2,
        pomak: 7,
      },
    },
    { ...osnova(), vrsta: "znak", znak: "brzina", mjesto: naKraku(0), brzina: 40 },
    { ...osnova(), vrsta: "dionica", ulica: naKraku(2), smjer: "naprijed", trakeNaprijed: 2, linija: "puna", punaPrije: 30, busNaprijed: true },
    { ...osnova(), vrsta: "prelaz", mjesto: naKraku(3), ukloni: false },
    { ...osnova(), vrsta: "cvor", cvor: { x: 100, y: 0 }, na: { x: 101, y: 2 } },
    { ...osnova(), vrsta: "novaUlica", tacke: [{ x: -100, y: 0 }, { x: -100, y: 50 }], klasa: "service", ime: "Nova", smjer: 0, trake: 1 },
    { ...osnova(), vrsta: "ukloniUlicu", ulica: naKraku(3) },
    {
      ...osnova(),
      vrsta: "zona",
      zona: { id: "z", ime: "Zona", poligon: [[0, 0], [10, 0], [10, 10]], paleta: null, speedLimit: 30, pedestrianDensity: 2, trafficDensity: null, handAuthored: true },
    },
    {
      ...osnova(),
      vrsta: "zadatak",
      zadatak: { id: "r1", ime: "Ruta", vrsta: "ispitna", start: naKraku(0), cilj: naKraku(2), tacke: [naKraku(1)], manevri: [{ vrsta: "polukruzno", mjesto: naKraku(3) }] },
    },
  ];

  it("učitaj → izmijeni → sačuvaj → učitaj = isto (round-trip, svaka vrsta izmjene)", () => {
    const o = overlay(sve);
    const tekst = zapisiOverlay(o);
    const ponovo = procitajOverlay(JSON.parse(tekst));
    expect(ponovo).toEqual(o);
    // Izmjena (kao u editoru: dodaj, pa promijeni postojeću) i ponovni krug.
    const izmijenjen: Overlay = {
      ...ponovo,
      izmjene: [
        ...ponovo.izmjene.map((iz) => (iz.vrsta === "kontrola" ? { ...iz, kontrola: "ustupi" as const } : iz)),
        { ...osnova(), vrsta: "kontrola", krak: krak(3), kontrola: "glavni" },
      ],
    };
    const tekst2 = zapisiOverlay(izmijenjen);
    expect(procitajOverlay(JSON.parse(tekst2))).toEqual(izmijenjen);
    // Isti overlay se uvijek zapiše istim tekstom (git diff samo stvarne izmjene).
    expect(zapisiOverlay(procitajOverlay(JSON.parse(tekst2)))).toBe(tekst2);
  });

  it("odbija neispravan fajl i kaže gdje je greška", () => {
    expect(() => procitajOverlay({ ...overlay([]), verzija: 99 })).toThrow(/verzij/);
    expect(() => procitajOverlay(overlay([{ ...sve[0]!, vrsta: "nesto" } as unknown as Izmjena]))).toThrow(/izmjene\[0\].*nepoznata vrsta/);
    const dupli = { ...sve[0]!, id: "isti" };
    expect(() => procitajOverlay(overlay([dupli, { ...dupli }]))).toThrow(/ponavlja/);
    expect(() =>
      procitajOverlay(overlay([{ ...osnova(), vrsta: "znak", znak: "brzina", mjesto: naKraku(0), brzina: null }])),
    ).toThrow(/brzina/);
    expect(() =>
      procitajOverlay(overlay([{ ...osnova(), vrsta: "skretanje", krak: krak(0), znak: { vrsta: "zabrana", manevri: ["nazad" as "lijevo"] } }])),
    ).toThrow(/manevri/);
  });

  it("overlay za drugo ishodište se ne primjenjuje", () => {
    const p = krst();
    p.zaglavlje.ishodiste = { utmX: 0, utmY: 0, lat: 43, lon: 19 };
    expect(() => svijetGrada(p, overlay([]))).toThrow(/ishodište/);
  });
});

describe("overlay ima prednost nad OSM-om u svakom polju", () => {
  it("prazan overlay ne mijenja ništa — isti paket i ista pravila kao bez njega", () => {
    const p = krst([], [{ vrsta: "stop", ivica: 1, s: 95, podatak: "forward" }]);
    const bez = svijetGrada(p, null);
    const sa = svijetGrada(p, overlay([]));
    expect(sa.paket).toBe(p);
    expect(sa.raskrsnice.lista.map((r) => r.kraci.map((k) => [k.kontrola, k.izvor, k.stopD]))).toEqual(
      bez.raskrsnice.lista.map((r) => r.kraci.map((k) => [k.kontrola, k.izvor, k.stopD])),
    );
  });

  it("kontrola sa kraka: overlay je jača od OSM znaka i od izvedene", () => {
    // OSM: STOP na istočnom kraku (ivica 1); ostali bez znaka → „glavni" iz OSM-a.
    const p = krst([], [{ vrsta: "stop", ivica: 1, s: 95, podatak: "forward" }]);
    expect(krakIvice(svijetGrada(p, null), 1).kontrola).toBe("stop");
    const s = svijetGrada(
      p,
      overlay([
        { ...osnova(), vrsta: "kontrola", krak: krak(1), kontrola: "ustupi" },
        { ...osnova(), vrsta: "kontrola", krak: krak(3), kontrola: "stop" },
      ]),
    );
    expect([krakIvice(s, 1).kontrola, krakIvice(s, 1).izvor]).toEqual(["ustupi", "overlay"]);
    expect([krakIvice(s, 3).kontrola, krakIvice(s, 3).izvor]).toEqual(["stop", "overlay"]);
    // Stop-linija i kod kontrole iz overlay-a (crta se i sudi se).
    expect(krakIvice(s, 3).stopD).not.toBeNull();
    // Izvedeni prioritet (sporedna na glavnu) nestaje kad ga čovjek potvrdi u editoru.
    const izvedeno = svijetGrada(krst(), null);
    expect(izvedeno.raskrsnice.lista[0]!.inferredPriority).toBe(true);
    const potvrdjeno = svijetGrada(
      krst(),
      overlay([0, 1, 2, 3].map((i) => ({ ...osnova(), vrsta: "kontrola" as const, krak: krak(i), kontrola: i === 0 ? ("glavni" as const) : ("ustupi" as const) }))),
    );
    expect(potvrdjeno.raskrsnice.lista[0]!.inferredPriority).toBe(false);
  });

  it("semafor: plan iz overlay-a umjesto izvedenog; `null` uklanja semafor iz OSM-a", () => {
    const p = krst([], [{ vrsta: "traffic_signals", cvor: 0 }]);
    const osm = svijetGrada(p, null).raskrsnice.lista[0]!;
    expect(osm.inferredPhases).toBe(true);
    const s = svijetGrada(
      p,
      overlay([
        {
          ...osnova(),
          vrsta: "semafor",
          raskrsnica: { x: 0, y: 0 },
          plan: {
            faze: [
              { zeleno: 25, kraci: [krak(0), krak(2)].map((k) => ({ krak: k, manevri: null })), strelice: [], pjesaci: [] },
              { zeleno: 12, kraci: [krak(1), krak(3)].map((k) => ({ krak: k, manevri: null })), strelice: [], pjesaci: [] },
            ],
            zuto: 4,
            sveCrveno: 1,
            pomak: 5,
          },
        },
      ]),
    ).raskrsnice.lista[0]!;
    expect(s.inferredPhases).toBe(false);
    expect(s.plan!.faze.map((f) => f.zeleno)).toEqual([25, 12]);
    expect([s.plan!.zuto, s.plan!.sveCrveno, s.plan!.pomak, s.plan!.ciklus]).toEqual([4, 1, 5, 25 + 12 + 2 * 5]);
    expect(s.kraci.every((k) => k.kontrola === "semafor" && k.izvor === "overlay")).toBe(true);

    const bez = svijetGrada(p, overlay([{ ...osnova(), vrsta: "semafor", raskrsnica: { x: 0, y: 0 }, plan: null }])).raskrsnice.lista[0]!;
    expect(bez.plan).toBeNull();
    expect(bez.kraci.some((k) => k.kontrola === "semafor")).toBe(false);
  });

  it("dionica: smjer, trake, strelice, bus traka, linije, zatvorena, ime, klasa", () => {
    const p = krst([{}, { trake: 2 }]);
    const s = svijetGrada(
      p,
      overlay([
        // Sidro na istočnom kraku gleda KA centru, a ivica 1 ide od kraja ka centru: isti pravac.
        {
          ...osnova(),
          vrsta: "dionica",
          ulica: naKraku(1),
          smjer: "oba",
          trakeNaprijed: 2,
          trakeNazad: 1,
          skretanjaNaprijed: "left|through;right",
          skretanjaNazad: "none",
          busNaprijed: true,
          linija: "dvostruka",
          punaPrije: 40,
          trakePrije: 25,
          ime: "Ispravljena",
          klasa: "secondary",
        },
        // Južni krak: jednosmjeran OD centra (suprotno od sidra), zatvoren.
        { ...osnova(), vrsta: "dionica", ulica: naKraku(2), smjer: "nazad", zatvorena: true },
      ]),
    );
    const iv = s.mreza.ivice[1]!;
    expect([iv.smjer, iv.trakeNaprijed, iv.trakeNazad, iv.trakePoznate]).toEqual([0, 2, 1, true]);
    expect([iv.skretanjaNaprijed, iv.skretanjaNazad]).toEqual(["left|through;right", "none"]);
    expect([iv.busNaprijed, iv.busNazad, iv.linija, iv.punaPrije, iv.trakePrije]).toEqual([true, false, "dvostruka", 40, 25]);
    expect([iv.ime, iv.klasa]).toEqual(["Ispravljena", "secondary"]);
    const juzna = s.mreza.ivice[2]!;
    // Ivica 2 ide od juga ka centru; „nazad" od sidra (koje gleda ka centru) je od centra: `b → a`.
    expect(juzna.smjer).toBe(-1);
    expect([juzna.zatvorena, juzna.vozna]).toEqual([true, false]);
    // Zatvorena ulica nije krak raskrsnice: u nju se ne ulazi ni iz nje izlazi.
    expect(s.raskrsnice.lista[0]!.kraci.some((k) => k.ivica === 2)).toBe(false);
  });

  it("dionica važi cijelom dužinom do raskrsnica — kroz čvorove koji to nisu", () => {
    // Istočni krak razbijen u dvije ivice (čvor 5 na pola puta nije raskrsnica).
    const cvorovi = [...KRST_CVOROVI, { x: 50, y: 0 }];
    const ivice: TestIvica[] = [
      { a: 1, b: 0 },
      { a: 2, b: 5 },
      { a: 5, b: 0 },
      { a: 3, b: 0 },
      { a: 4, b: 0 },
    ];
    const { paket } = testPaket(cvorovi, ivice);
    paket.n.ivOsm = Uint32Array.from([1000, 1001, 1001, 1002, 1003]);
    const s = svijetGrada(paket, overlay([{ ...osnova(), vrsta: "dionica", ulica: naKraku(1), smjer: "naprijed", linija: "puna" }]));
    // Obje ivice istočnog kraka: jednosmjerne ka centru, puna linija.
    expect([s.mreza.ivice[1]!.smjer, s.mreza.ivice[2]!.smjer]).toEqual([1, 1]);
    expect([s.mreza.ivice[1]!.linija, s.mreza.ivice[2]!.linija]).toEqual(["puna", "puna"]);
    expect(s.mreza.ivice[0]!.linija).toBe("isprekidana");
  });

  it("pješački prelaz: overlay ga dodaje, i uklanja onaj iz OSM-a", () => {
    const p = krst([], [{ vrsta: "crossing", ivica: 0, s: 80, podatak: "zebra" }]);
    const s = svijetGrada(
      p,
      overlay([
        { ...osnova(), vrsta: "prelaz", mjesto: { ...naKraku(0), y: -20 }, ukloni: true },
        { ...osnova(), vrsta: "prelaz", mjesto: { ...naKraku(2), y: 30 }, ukloni: false },
      ]),
    );
    expect(s.nevezane).toEqual([]);
    expect(s.zaSudiju.zebre.get(0)).toBeUndefined();
    // Ivica 2 ide od (0, 100) ka centru: tačka y = 30 je 70 m od njenog početka.
    expect(s.zaSudiju.zebre.get(2)?.[0]).toBeCloseTo(70, 3);
  });

  it("geometrija: pomjeren čvor, nova ulica (dijeli postojeću), uklonjena ulica", () => {
    const p = krst([], [{ vrsta: "crossing", ivica: 1, s: 80, podatak: "zebra" }]);
    const s = svijetGrada(
      p,
      overlay([
        { ...osnova(), vrsta: "cvor", cvor: { x: -100, y: 0 }, na: { x: -110, y: 5 } },
        // Nova ulica od tačke na istočnom kraku (x = 40) na sjever: krak se dijeli.
        { ...osnova(), vrsta: "novaUlica", tacke: [{ x: 40, y: 1 }, { x: 40, y: -60 }], klasa: "residential", ime: "Nova", smjer: 0, trake: 2 },
        { ...osnova(), vrsta: "ukloniUlicu", ulica: naKraku(0) },
      ]),
    );
    expect(s.nevezane).toEqual([]);
    const m = s.mreza;
    expect(m.cvorovi[4]).toEqual({ x: -110, y: 5 });
    expect(m.ivice[3]!.tacke[0]).toEqual({ x: -110, y: 5 });
    // Istočni krak (ivica 1, 2 → 0) sad ide do novog čvora na x = 40, a nova
    // ivica od tog čvora do centra; zebra sa s = 80 (x = 20) je prešla na nju.
    const novaIvica = m.ivice.find((iv) => iv.ime === "Nova")!;
    const djelic = m.ivice.find((iv) => iv.i !== 1 && iv.osm === 1001)!;
    expect(m.cvorovi[novaIvica.a]).toEqual({ x: 40, y: 0 });
    expect(m.ivice[1]!.b).toBe(novaIvica.a);
    expect(djelic.a).toBe(novaIvica.a);
    expect(s.zaSudiju.zebre.get(djelic.i)?.[0]).toBeCloseTo(20, 3);
    // Novi čvor je raskrsnica (tri vozna kraja).
    expect(s.raskrsnice.uCvoru[novaIvica.a]).toBeGreaterThanOrEqual(0);
    // Uklonjena: nije vozna, ne crta se, nije krak.
    expect([m.ivice[0]!.uklonjena, m.ivice[0]!.vozna]).toEqual([true, false]);
    const centar = s.raskrsnice.lista[s.raskrsnice.uCvoru[0]!]!;
    expect(centar.kraci.some((k) => k.ivica === 0)).toBe(false);
  });

  it("znak uz ulicu: objekat paketa u smjeru sidra", () => {
    const s = svijetGrada(krst(), overlay([{ ...osnova(), vrsta: "znak", znak: "brzina", mjesto: naKraku(1), brzina: 40 }]));
    const n = s.paket.n;
    const z = s.paket.zaglavlje;
    const o = [...n.obVrsta].findIndex((v) => z.vrsteObjekata[v] === "znak");
    expect(o).toBeGreaterThanOrEqual(0);
    expect(n.obIvica[o]).toBe(1);
    expect(n.obS[o]).toBeCloseTo(80, 3);
    expect(procitajZnak(z.stringovi[n.obPodatak[o]!]!)).toEqual({ znak: "brzina", naprijed: true, brzina: 40 });
    expect(procitajZnak(podatakZnaka("djeca", false, null))).toEqual({ znak: "djeca", naprijed: false, brzina: null });
    expect(procitajZnak("forward")).toBeNull();
  });

  it("znak skretanja i zabrana ulaska: vezani za krak (sudi ih stavka 6b)", () => {
    const s = svijetGrada(
      krst(),
      overlay([
        { ...osnova(), vrsta: "skretanje", krak: krak(1), znak: { vrsta: "obavezno", manevri: ["pravo", "desno"] } },
        { ...osnova(), vrsta: "zabranaUlaska", krak: krak(2), ukloni: false },
      ]),
    );
    // Ivica 1 dodiruje centar svojim krajem `b`.
    expect(s.pravila!.skretanja.get("1:1")?.znak).toEqual({ vrsta: "obavezno", manevri: ["pravo", "desno"] });
    expect(s.pravila!.zabraneUlaska.get("2:1")?.ukloni).toBe(false);
  });

  it("zone: overlay mijenja zonu šablona po id-u i dodaje nove", () => {
    const sablon: Zona[] = [
      { id: "centar", ime: "Centar", poligon: [], paleta: "centar-oker", speedLimit: null, pedestrianDensity: null, trafficDensity: null, handAuthored: false },
      { id: "blok-5", ime: "Blok 5", poligon: [], paleta: "soc-blok", speedLimit: null, pedestrianDensity: null, trafficDensity: null, handAuthored: false },
    ];
    const nacrtana: Zona = { ...sablon[0]!, poligon: [[0, 0], [100, 0], [100, 100]], speedLimit: 40, handAuthored: true };
    const nova: Zona = { ...sablon[1]!, id: "skola", ime: "Škola" };
    const z = zoneGrada(sablon, overlay([{ ...osnova(), vrsta: "zona", zona: nacrtana }, { ...osnova(), vrsta: "zona", zona: nova }]));
    expect(z.map((x) => x.id)).toEqual(["centar", "blok-5", "skola"]);
    expect(z[0]).toEqual(nacrtana);
  });
});

describe("overlay: sidra", () => {
  it("izmjena važi za istu ulicu i kad je paket napravljen drugim redom (novi OSM)", () => {
    const izmjene: Izmjena[] = [
      { ...osnova(), vrsta: "kontrola", krak: krak(1), kontrola: "stop" },
      { ...osnova(), vrsta: "dionica", ulica: naKraku(2), linija: "puna" },
    ];
    const prvi = svijetGrada(krst(), overlay(izmjene));
    // Isti grad, ivice obrnutim redom: indeksi su drugi, OSM id-ovi i tačke isti.
    const drugi = svijetGrada(krst([], [], [3, 2, 1, 0]), overlay(izmjene));
    const po = (s: ReturnType<typeof svijetGrada>, osm: number) => s.mreza.ivice.find((iv) => iv.osm === osm)!;
    expect(po(prvi, 1001).i).not.toBe(po(drugi, 1001).i);
    expect(krakIvice(drugi, po(drugi, 1001).i).kontrola).toBe("stop");
    expect(po(drugi, 1002).linija).toBe("puna");
    expect(drugi.nevezane).toEqual([]);
  });

  it("izmjena čije sidro nije nađeno je nevezana: ne primjenjuje se, i zna se zašto", () => {
    const daleko: SidroUlice = { osm: 1001, x: 50, y: 40, hx: -1, hy: 0 };
    const tudji: SidroUlice = { ...naKraku(1), osm: 99 };
    const izmjene: Izmjena[] = [
      { ...osnova(), id: "a", vrsta: "dionica", ulica: daleko, linija: "puna" },
      { ...osnova(), id: "b", vrsta: "kontrola", krak: { raskrsnica: { x: 0, y: 0 }, ulica: tudji }, kontrola: "stop" },
      { ...osnova(), id: "c", vrsta: "cvor", cvor: { x: 500, y: 500 }, na: { x: 0, y: 0 } },
    ];
    const s = svijetGrada(krst(), overlay(izmjene));
    expect(s.nevezane.map((n) => n.id).sort()).toEqual(["a", "b", "c"]);
    expect(s.mreza.ivice.every((iv) => iv.linija === "isprekidana")).toBe(true);
    // Sloj 1 bez ijedne vezane izmjene ipak pravi novi paket — ali isti po sadržaju.
    expect(primijeniNaPaket(krst(), overlay(izmjene)).paket.n.ivA).toEqual(krst().n.ivA);
  });
});

describe("semafor iz editora: svjetla po manevru i dopunska strelica", () => {
  // Faza 0 (20 s): sjever i jug za sve; istok samo desno (strelica trake).
  // Faza 1 (10 s): istok i zapad za sve; zelena dopunska strelica desno za jug.
  // Faza 2 (10 s): istok i zapad i dalje — bez žutog između faza 1 i 2.
  const s = svijetGrada(
    krst([], [{ vrsta: "traffic_signals", cvor: 0 }]),
    overlay([
      {
        ...osnova(),
        vrsta: "semafor",
        raskrsnica: { x: 0, y: 0 },
        plan: {
          faze: [
            {
              zeleno: 20,
              kraci: [
                { krak: krak(0), manevri: null },
                { krak: krak(2), manevri: null },
                { krak: krak(1), manevri: ["desno"] },
              ],
              strelice: [],
              pjesaci: [],
            },
            { zeleno: 10, kraci: [krak(1), krak(3)].map((k) => ({ krak: k, manevri: null })), strelice: [{ krak: krak(2), manevri: ["desno"] }], pjesaci: [] },
            { zeleno: 10, kraci: [krak(1), krak(3)].map((k) => ({ krak: k, manevri: null })), strelice: [], pjesaci: [] },
          ],
          zuto: GRAD_SEMAFOR_ZUTO,
          sveCrveno: GRAD_SEMAFOR_SVE_CRVENO,
          pomak: 0,
        },
      },
    ]),
  );
  const r = s.raskrsnice.lista[0]!;
  const j = (ivica: number) => r.kraci.findIndex((k) => k.ivica === ivica);
  const faza = GRAD_SEMAFOR_ZUTO + GRAD_SEMAFOR_SVE_CRVENO;

  it("krak sa zelenim samo za desno: glavno crveno, desno zeleno", () => {
    expect(svjetlo(r, j(1), 5)).toBe("crveno");
    expect(svjetlo(r, j(1), 5, "desno")).toBe("zeleno");
    expect(svjetlo(r, j(1), 5, "pravo")).toBe("crveno");
    // Poslije faze 0 desno ostaje zeleno: u fazi 1 krak ima zeleno za sve.
    expect(svjetlo(r, j(1), 21, "desno")).toBe("zeleno");
    expect(svjetlo(r, j(1), 21, "pravo")).toBe("crveno");
  });

  it("dopunska strelica gori samo dok traje zeleno njene faze, i samo za svoj manevar", () => {
    const t = 20 + faza + 2;
    expect(svjetlo(r, j(2), t)).toBe("crveno");
    expect(zelenaStrelica(r, j(2), t, "desno")).toBe(true);
    expect(zelenaStrelica(r, j(2), t, "pravo")).toBe(false);
    expect(zelenaStrelica(r, j(2), 20 + faza + 10 + 1, "desno")).toBe(false);
    expect(zelenaStrelica(r, j(2), 5, "desno")).toBe(false);
  });

  it("krak zelen u dvije uzastopne faze ne dobija žuto između njih", () => {
    const krajFaze1 = 20 + faza + 10;
    expect(svjetlo(r, j(1), krajFaze1 + 1)).toBe("zeleno");
    expect(svjetlo(r, j(1), krajFaze1 + GRAD_SEMAFOR_ZUTO + 1)).toBe("zeleno");
    // Na kraju faze 2 (sljedeća je faza 0, u kojoj nema zelenog za sve): žuto.
    expect(svjetlo(r, j(1), krajFaze1 + faza + 10 + 1)).toBe("zuto");
  });
});

describe("paket: novi nizovi su neobavezni", () => {
  it("paket bez nizova linija se čita sa nulama (stari .bin ostaje važeći)", () => {
    const p = krst();
    const m = napraviMrezu(p);
    expect(m.ivice.every((iv) => iv.linija === "isprekidana" && iv.punaPrije === 0 && !iv.zatvorena && !iv.uklonjena)).toBe(true);
  });
});
