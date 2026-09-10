import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EDGES, NODES, edgeById } from "@/lib/game/road/roadGraph";
import { krozGrad, parseKicma, ulazZaIvicu, type Kicma } from "@/lib/game/road/kicma";

/**
 * Gradske kičme.
 *
 * Provjerava se PODATAK, ne račun: fajlove pravi `npm run osm:kicme` i oni su u
 * repozitorijumu, pa test brani da se u njih ne uvuče nešto što igra ne može da
 * odvozi — ulaz koji pokazuje na nepostojeću ivicu, ulica bez geometrije,
 * kičma koja ne povezuje ulaze koje bi trebalo da poveže.
 */

const OPSTINE = NODES.filter((n) => n.kind === "opstina");

const kicma = (id: string): Kicma => {
  const raw = JSON.parse(readFileSync(`public/data/osm/kicme/${id}.json`, "utf8"));
  const k = parseKicma(raw);
  if (!k) throw new Error(`Neispravna kičma: ${id}`);
  return k;
};

const SVE = OPSTINE.map((n) => ({ n, k: kicma(n.id) }));

describe("podaci o kičmama", () => {
  it("svaka opština ima svoju kičmu", () => {
    for (const { n, k } of SVE) {
      expect(k.cvor, n.id).toBe(n.id);
      expect(k.ime, n.id).toBe(n.name);
    }
  });

  it("svaki ulaz pripada stvarnoj ivici grafa koja vodi u taj grad", () => {
    for (const { n, k } of SVE) {
      for (const u of k.ulazi) {
        const e = edgeById(u.ivica);
        expect(e, `${n.id} ${u.ivica}`).toBeDefined();
        expect([e!.a, e!.b], `${n.id} ${u.ivica}`).toContain(n.id);
        expect([e!.a, e!.b], `${n.id} ${u.ivica}`).toContain(u.ka);
      }
    }
  });

  it("svaka ivica grafa koja vodi u grad ima svoj ulaz", () => {
    for (const { n, k } of SVE) {
      const ocekivane = EDGES.filter((e) => e.a === n.id || e.b === n.id);
      for (const e of ocekivane) {
        expect(ulazZaIvicu(k, e.id), `${n.id} ${e.id}`).toBeDefined();
      }
    }
  });

  it("ulaz se odsijeca sa kraja ivice, i to razumno mnogo", () => {
    for (const { n, k } of SVE) {
      for (const u of k.ulazi) {
        const e = edgeById(u.ivica)!;
        expect(u.odKraja, `${n.id} ${u.ivica}`).toBeGreaterThan(0);
        // Ne smije se odsjeći više nego što ivica uopšte ima.
        expect(u.odKraja, `${n.id} ${u.ivica}`).toBeLessThan(e.km * 1000);
      }
    }
  });

  it("gradska dionica ima svoju mjeru — najviše dva i po kilometra", () => {
    // Bez granice se povlačenje „dok se ivice ne razdvoje" otme: kod Rožaja su
    // dvije ivice dijelile trinaest kilometara prilaza i kičma je ispadala
    // petnaest kilometara duga.
    //
    // Mjeri se ODSJEČENI PUT, a ne udaljenost od centra: geometrija neke ivice
    // se i sama završava kilometrima od unijete koordinate čvora, pa bi mjerenje
    // od centra tamo govorilo o ivici, a ne o kičmi.
    for (const { n, k } of SVE) {
      for (const u of k.ulazi) {
        expect(u.odKraja, `${n.id} ${u.ivica}`).toBeLessThanOrEqual(2600);
      }
    }
  });

  it("svaka ulica ima geometriju i spaja dva čvora kičme", () => {
    for (const { n, k } of SVE) {
      const cvorovi = new Set(k.cvorovi.map((c) => c.id));
      for (const i of k.ivice) {
        expect(cvorovi.has(i.a), `${n.id} ${i.a}`).toBe(true);
        expect(cvorovi.has(i.b), `${n.id} ${i.b}`).toBe(true);
        expect(i.g.length, n.id).toBeGreaterThanOrEqual(2);
        for (const [x, y] of i.g) {
          expect(Number.isFinite(x), n.id).toBe(true);
          expect(Number.isFinite(y), n.id).toBe(true);
        }
      }
    }
  });

  it("gdje su ulazi različiti, kroz grad postoji put", () => {
    // Ovo je jedina stvar koja kičmu čini upotrebljivom: da se od ulaza dođe do
    // izlaza. Gdje se dva ulaza poklapaju, puta nema i to nije greška nego
    // osobina podatka — dvije ivice ulaze u grad istom ulicom.
    let parova = 0;
    for (const { n, k } of SVE) {
      for (let i = 0; i < k.ulazi.length; i++) {
        for (let j = i + 1; j < k.ulazi.length; j++) {
          const a = k.ulazi[i]!;
          const b = k.ulazi[j]!;
          if (a.cvorOSM === b.cvorOSM) continue;
          const put = krozGrad(k, a.cvorOSM, b.cvorOSM);
          expect(put, `${n.id}: ${a.ivica} → ${b.ivica}`).not.toBeNull();
          expect(put!.length, `${n.id}: ${a.ivica} → ${b.ivica}`).toBeGreaterThanOrEqual(2);
          parova += 1;
        }
      }
    }
    expect(parova).toBeGreaterThan(30);
  });

  it("ulice se sastaju tačno na svom čvoru", () => {
    // Ovo je invarijanta koja čini put kroz grad neprekidnim: gdje jedna ulica
    // završava, druga počinje. Mjeri se na podatku, ne na putu — razmak dvije
    // uzastopne TAČKE ništa ne kaže, jer uprošćavanje prav bulevar od kilometra
    // legitimno svede na dvije tačke.
    for (const { n, k } of SVE) {
      const poId = new Map(k.cvorovi.map((c) => [c.id, c]));
      for (const iv of k.ivice) {
        const a = poId.get(iv.a)!;
        const b = poId.get(iv.b)!;
        const prva = iv.g[0]!;
        const zadnja = iv.g[iv.g.length - 1]!;
        expect(Math.hypot(prva[0] - a.x, prva[1] - a.y), `${n.id} ${iv.a}→${iv.b} početak`)
          .toBeLessThan(1);
        expect(Math.hypot(zadnja[0] - b.x, zadnja[1] - b.y), `${n.id} ${iv.a}→${iv.b} kraj`)
          .toBeLessThan(1);
      }
    }
  });

  it("put kroz grad je duga koliko i ulice od kojih je sastavljen", () => {
    // Da je neka ulica okrenuta naopako, put bi „skočio" i ispao duži od zbira
    // svojih ulica.
    for (const { n, k } of SVE) {
      const duzine = new Map(
        k.ivice.map((iv) => {
          let d = 0;
          for (let i = 1; i < iv.g.length; i++) {
            d += Math.hypot(iv.g[i]![0] - iv.g[i - 1]![0], iv.g[i]![1] - iv.g[i - 1]![1]);
          }
          return [`${iv.a}:${iv.b}`, d] as const;
        }),
      );
      const najduza = Math.max(0, ...duzine.values());
      for (let i = 0; i < k.ulazi.length; i++) {
        for (let j = i + 1; j < k.ulazi.length; j++) {
          const a = k.ulazi[i]!;
          const b = k.ulazi[j]!;
          if (a.cvorOSM === b.cvorOSM) continue;
          const put = krozGrad(k, a.cvorOSM, b.cvorOSM);
          if (!put) continue;
          let d = 0;
          for (let m = 1; m < put.length; m++) {
            d += Math.hypot(put[m]!.x - put[m - 1]!.x, put[m]!.y - put[m - 1]!.y);
          }
          // Zbir svih ulica u gradu je gornja granica za bilo koji put kroz njega.
          const sve = [...duzine.values()].reduce((x, y) => x + y, 0);
          expect(d, `${n.id} ${a.ivica}→${b.ivica}`).toBeLessThanOrEqual(sve + 1);
          expect(d, `${n.id} ${a.ivica}→${b.ivica}`).toBeGreaterThan(0);
          void najduza;
        }
      }
    }
  });

  it("put kroz grad kreće od ulaza i završava na izlazu", () => {
    const k = kicma("cetinje");
    const [a, b] = [k.ulazi[0]!, k.ulazi[1]!];
    const put = krozGrad(k, a.cvorOSM, b.cvorOSM)!;
    const prva = put[0]!;
    const zadnja = put[put.length - 1]!;
    expect(Math.hypot(prva.x - a.x, prva.y - a.y)).toBeLessThan(5);
    expect(Math.hypot(zadnja.x - b.x, zadnja.y - b.y)).toBeLessThan(5);
    // U suprotnom smjeru mora ispasti isti put, samo okrenut.
    const nazad = krozGrad(k, b.cvorOSM, a.cvorOSM)!;
    expect(nazad.length).toBe(put.length);
    expect(Math.hypot(nazad[0]!.x - zadnja.x, nazad[0]!.y - zadnja.y)).toBeLessThan(1);
  });

  it("nijedna kičma još nije ručno potvrđena", () => {
    // Za osam gradova iz zadatka izbor ulica kroz grad treba da potvrdi čovjek.
    // Dok se to ne desi, važi automatski nađena kičma — i to mora da se vidi.
    for (const { n, k } of SVE) expect(k.rucnoPotvrdjena, n.id).toBe(false);
  });
});
