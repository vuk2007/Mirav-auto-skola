import {
  GRAD_CRTICA,
  GRAD_CRTICA_RAZMAK,
  GRAD_LINIJA_SIRINA,
  GRAD_LINIJE_OD_RASKRSNICE,
  GRAD_STRELICA_DUZINA,
  GRAD_STRELICA_OD_KRAJA,
  GRAD_ZEBRA_DO_ULICE,
  GRAD_ZEBRA_DUBINA,
  GRAD_ZEBRA_PRUGA,
} from "../sim/config";
import type { Point } from "../sim/types";
import { linijeSaVrstom, pojasBusa, puniDijelovi, uzBus, type Produzeci } from "./linije";
import type { Ivica, Mreza } from "./mreza";
import { najblizaOsa, type Povrsina } from "./povrsina";

/**
 * Oznake na kolovozu (faza 6, stavka 4b): linije traka, strelice iz OSM
 * `turn:lanes`, zebre na obilježenim prelazima. Sve je poligon u metrima
 * svijeta; crtač ih samo oboji bijelo, jednom po tile-u.
 *
 * Linije su isprekidane: puna linija je pravilo (zabrana prelaska), a OSM je
 * ne zna — nju dodaje editor (stavka 6), i crta se po istim funkcijama po
 * kojima se sudi (`linije.ts`). Stop-linije nisu ovdje nego u stavci 5, iz
 * istog modela raskrsnice po kojem se i sudi: nacrtano i suđeno moraju biti
 * jedno.
 */

export type Poligon = Point[];

// ── gdje linije staju: raskrsnice ──────────────────────────────────────────

/**
 * Za svaku ivicu: koliko metara od početka (`a`) i od kraja (`b`) linije ne
 * idu, jer je tu raskrsnica. Čvor sa dvije ulice (nastavak iste) nije
 * raskrsnica.
 *
 * Raskrsnica na kraku počinje tamo gdje su osovina i obje ivice kolovoza kraka
 * izašle sa asfalta svih ostalih krakova tog čvora (uz `GRAD_LINIJE_OD_RASKRSNICE`).
 * Pod pravim uglom to je pola najšire druge ulice; odvojak pod oštrim uglom
 * mnogo duže ostaje na asfaltu glavne ulice — i tu linija ne smije stajati.
 */
export function krajeviLinija(m: Mreza): Float32Array {
  const od = new Float32Array(2 * m.ivice.length);
  for (let c = 0; c < m.cvorovi.length; c++) {
    const kraci: { ivica: number; kraj: 0 | 1; pola: number }[] = [];
    for (const i of m.izCvora[c] ?? []) {
      const iv = m.ivice[i]!;
      if (!iv.vozna) continue;
      if (iv.a === c) kraci.push({ ivica: i, kraj: 0, pola: iv.sirina / 2 });
      if (iv.b === c) kraci.push({ ivica: i, kraj: 1, pola: iv.sirina / 2 });
    }
    if (kraci.length < 3) continue;
    for (const k of kraci) {
      const iv = m.ivice[k.ivica]!;
      let pola = 0;
      for (const d of kraci) if (d !== k) pola = Math.max(pola, d.pola);
      const najmanje = pola + GRAD_LINIJE_OD_RASKRSNICE;
      const najvise = Math.max(najmanje, Math.min(iv.duzina / 2, 60));
      let d = najmanje;
      for (; d < najvise; d += 0.5) {
        const s = k.kraj === 0 ? d : iv.duzina - d;
        const { k: seg, t } = naSegmentu(iv, s);
        const { d: n } = pravacSegmenta(iv, seg);
        const a = iv.tacke[seg]!;
        const b = iv.tacke[seg + 1]!;
        const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        const tacke = [p, { x: p.x + n.x * k.pola, y: p.y + n.y * k.pola }, { x: p.x - n.x * k.pola, y: p.y - n.y * k.pola }];
        const slobodno = kraci.every(
          (drugi) =>
            drugi === k ||
            drugi.ivica === k.ivica ||
            tacke.every((q) => udaljenostOdIvice(m.ivice[drugi.ivica]!, q) >= drugi.pola + GRAD_LINIJE_OD_RASKRSNICE - 1e-6),
        );
        if (slobodno) break;
      }
      od[2 * k.ivica + k.kraj] = d;
    }
  }
  return od;
}

/** Najmanja udaljenost tačke od osovine ivice. */
function udaljenostOdIvice(iv: Ivica, q: Point): number {
  let naj = Infinity;
  for (let k = 0; k + 1 < iv.tacke.length; k++) {
    const a = iv.tacke[k]!;
    const b = iv.tacke[k + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2)) : 0;
    naj = Math.min(naj, Math.hypot(a.x + dx * t - q.x, a.y + dy * t - q.y));
  }
  return naj;
}

// ── pomoćno: tačke duž ivice, sa bočnim pomakom ─────────────────────────────

/** Segment ivice u kojem je `s` (od `a`), i pomak unutar njega. */
function naSegmentu(iv: Ivica, s: number): { k: number; t: number } {
  let k = 0;
  while (k + 2 < iv.tacke.length && iv.cum[k + 1]! < s) k += 1;
  const duz = iv.cum[k + 1]! - iv.cum[k]!;
  return { k, t: duz > 0 ? (s - iv.cum[k]!) / duz : 0 };
}

/** Jedinični pravac segmenta `k` i desno od njega (`y` na jug). */
function pravacSegmenta(iv: Ivica, k: number): { h: Point; d: Point } {
  const a = iv.tacke[k]!;
  const b = iv.tacke[k + 1]!;
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const h = { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
  return { h, d: { x: -h.y, y: h.x } };
}

/**
 * Traka (pravougaonici) duž ivice od `s0` do `s1`, pomaknuta `o` metara udesno
 * (u smjeru `a → b`), široka `sirina`. Po jedan pravougaonik na svakom
 * segmentu koji preseče — na krivini se linija lomi zajedno sa ulicom.
 */
function trakaDuz(iv: Ivica, s0: number, s1: number, o: number, sirina: number, izlaz: Poligon[]): void {
  if (s1 - s0 < 0.05) return;
  const { k: k0 } = naSegmentu(iv, s0);
  const { k: k1 } = naSegmentu(iv, s1);
  for (let k = k0; k <= k1; k++) {
    const d0 = Math.max(s0, iv.cum[k]!);
    const d1 = Math.min(s1, iv.cum[k + 1]!);
    if (d1 - d0 < 0.05) continue;
    const { h, d } = pravacSegmenta(iv, k);
    const a = iv.tacke[k]!;
    const p0 = { x: a.x + h.x * (d0 - iv.cum[k]!), y: a.y + h.y * (d0 - iv.cum[k]!) };
    const p1 = { x: a.x + h.x * (d1 - iv.cum[k]!), y: a.y + h.y * (d1 - iv.cum[k]!) };
    const l = o - sirina / 2;
    const r = o + sirina / 2;
    izlaz.push([
      { x: p0.x + d.x * l, y: p0.y + d.y * l },
      { x: p1.x + d.x * l, y: p1.y + d.y * l },
      { x: p1.x + d.x * r, y: p1.y + d.y * r },
      { x: p0.x + d.x * r, y: p0.y + d.y * r },
    ]);
  }
}

// ── linije traka ────────────────────────────────────────────────────────────

/**
 * Pomaci linija između traka od osovine [m, + je desno u smjeru `a → b`].
 * Trake u smjeru `b → a` su lijevo. Ulica uža od onoga što njene trake traže
 * (jednotračna dvosmjerna, `GRAD_NAJUZA_ULICA`) nema linija.
 */
export function linijeTraka(iv: Ivica): number[] {
  const n = iv.trakeNaprijed + iv.trakeNazad;
  if (n < 2 || iv.sirina < n * iv.sirinaTrake - 1e-6) return [];
  const traka = iv.sirina / n;
  const pomaci: number[] = [];
  for (let k = 1; k < n; k++) pomaci.push(-iv.sirina / 2 + k * traka);
  return pomaci;
}

/**
 * Linije traka ivice, bez dijela u raskrsnicama — osim na prstenu kružnog
 * toka: tamo linija između traka ide cijelim krugom, i preko ulaza.
 *
 * Isprekidane, osim gdje editor kaže drugačije (stavka 6): razdjelna linija
 * puna, dvostruka ili je nema; pune pred raskrsnicom (razdjelna, i između
 * traka istog smjera), po istoj funkciji po kojoj se sudi (`puniDijelovi`).
 * Bez produžetaka (`linije.ts`) nema punih „pred raskrsnicom". Linija uz
 * autobusku traku je šira.
 */
export function linijeIvice(iv: Ivica, odA: number, odB: number, p?: Produzeci): Poligon[] {
  if (iv.kruzni) odA = odB = 0;
  const izlaz: Poligon[] = [];
  const s1 = iv.duzina - odB;
  if (s1 - odA < GRAD_CRTICA) return izlaz;
  for (const l of linijeSaVrstom(iv)) {
    if (l.vrsta === "srednja" && iv.linija === "bez") continue;
    // Dijelovi gdje je linija puna: [od, do] duž ivice.
    const sve: [number, number][] = p
      ? puniDijelovi(iv, l, p)
      : l.vrsta === "srednja" && (iv.linija === "puna" || iv.linija === "dvostruka")
        ? [[odA, s1]]
        : [];
    const pune = sve.map(([a, b]): [number, number] => [Math.max(odA, a), Math.min(s1, b)]).filter(([a, b]) => b > a);
    const dvostruka = l.vrsta === "srednja" && iv.linija === "dvostruka";
    const sirina = uzBus(iv, l) ? 2 * GRAD_LINIJA_SIRINA : GRAD_LINIJA_SIRINA;
    const pomaci = dvostruka ? [l.o - 1.5 * GRAD_LINIJA_SIRINA, l.o + 1.5 * GRAD_LINIJA_SIRINA] : [l.o];
    for (const [p0, p1] of pune) for (const o of pomaci) trakaDuz(iv, p0, p1, o, sirina, izlaz);
    // Crtice počinju od raskrsnice na početku, pa je raspored isti u oba
    // smjera vožnje i ne zavisi od toga gdje je tile. Crtica u punom dijelu
    // se ne crta (puna je već tu).
    for (let s = odA; s < s1; s += GRAD_CRTICA + GRAD_CRTICA_RAZMAK) {
      let a = s;
      let b = Math.min(s + GRAD_CRTICA, s1);
      for (const [p0, p1] of pune) {
        if (p1 <= p0) continue;
        if (a >= p0 && b <= p1) a = b;
        else if (a < p0 && b > p0 && b <= p1) b = p0;
        else if (a >= p0 && a < p1 && b > p1) a = p1;
      }
      if (b - a > 0.05) trakaDuz(iv, a, b, l.o, sirina, izlaz);
    }
  }
  return izlaz;
}

/** Slova natpisa BUS na kolovozu, 3 × 5 polja; red 0 je vrh slova. */
const SLOVA: Record<string, string[]> = {
  B: ["110", "101", "110", "101", "110"],
  U: ["101", "101", "101", "101", "111"],
  S: ["111", "100", "111", "001", "111"],
};

/**
 * Natpis BUS u autobuskoj traci, na svakih ~80 m, okrenut vozaču: slova idu
 * jedno za drugim u smjeru vožnje, svako uspravno (vrh slova naprijed).
 */
export function natpisiBusa(iv: Ivica, odA: number, odB: number): Poligon[] {
  const izlaz: Poligon[] = [];
  const POLJE_W = 0.45;
  const POLJE_L = 0.6;
  const SLOVO = 5 * POLJE_L + 0.6;
  const NATPIS = 3 * SLOVO;
  for (const smjer of [1, -1] as const) {
    const pojas = pojasBusa(iv, smjer);
    if (!pojas) continue;
    const sredina = (pojas[0] + pojas[1]) / 2;
    const s0 = odA + 4;
    const s1 = iv.duzina - odB - 4;
    if (s1 - s0 < NATPIS) continue;
    // Prvi natpis pred krajem trake (pred raskrsnicom), pa unazad na 80 m.
    for (let kraj = 0; kraj + NATPIS <= s1 - s0; kraj += 80) {
      "BUS".split("").forEach((slovo, i) => {
        // `u` duž vožnje od početka natpisa; prvo slovo je najbliže vozaču.
        const uSlova = i * SLOVO;
        SLOVA[slovo]!.forEach((red, r) => {
          [...red].forEach((polje, c) => {
            if (polje !== "1") return;
            const u0 = uSlova + (4 - r) * POLJE_L;
            // Bočno: kolona 0 je lijevo vozaču; desno vozaču je + u smjeru `a → b`, − unazad.
            const w = sredina + smjer * (c - 1) * POLJE_W;
            const sa = smjer === 1 ? s1 - NATPIS - kraj + u0 : s0 + NATPIS + kraj - u0 - POLJE_L;
            trakaDuz(iv, sa, sa + POLJE_L, w, POLJE_W, izlaz);
          });
        });
      });
    }
  }
  return izlaz;
}

/**
 * Ograda zatvorene ulice (gradilište, editor): crveno-bijele pruge preko
 * kolovoza na oba kraja, malo unutra od raskrsnice.
 */
export function ogradaZatvorene(iv: Ivica, odA: number, odB: number): { crvene: Poligon[]; bijele: Poligon[] } {
  const crvene: Poligon[] = [];
  const bijele: Poligon[] = [];
  if (!iv.zatvorena || iv.duzina < 4) return { crvene, bijele };
  const pruga = iv.sirina / 6;
  for (const s of [Math.min(iv.duzina / 2, odA + 1.5), Math.max(iv.duzina / 2, iv.duzina - odB - 1.5)]) {
    for (let k = 0; k < 6; k++) {
      const o = -iv.sirina / 2 + (k + 0.5) * pruga;
      trakaDuz(iv, s - 0.35, s + 0.35, o, pruga, k % 2 ? bijele : crvene);
    }
  }
  return { crvene, bijele };
}

// ── strelice ────────────────────────────────────────────────────────────────

/** Oblici strelica u ravni trake: `u` duž vožnje od repa, `w` udesno [m]. */
const STRELICE: Record<string, readonly (readonly [number, number])[][]> = (() => {
  const L = GRAD_STRELICA_DUZINA;
  const vrat = L * 0.64;
  const pravo: [number, number][][] = [
    [
      [0, -0.15],
      [vrat, -0.15],
      [vrat, 0.15],
      [0, 0.15],
    ],
    [
      [vrat, -0.6],
      [L, 0],
      [vrat, 0.6],
    ],
  ];
  // Skretanje: kraći vrat, pa krak u stranu sa glavom. Za desno se `w` obrće.
  const lakat = L * 0.5;
  const lijevo: [number, number][][] = [
    [
      [0, -0.15],
      [lakat + 0.15, -0.15],
      [lakat + 0.15, 0.15],
      [0, 0.15],
    ],
    [
      [lakat - 0.15, -0.95],
      [lakat + 0.15, -0.95],
      [lakat + 0.15, -0.15],
      [lakat - 0.15, -0.15],
    ],
    [
      [lakat - 0.6, -0.95],
      [lakat, -1.6],
      [lakat + 0.6, -0.95],
    ],
  ];
  const desno = lijevo.map((p) => p.map(([u, w]) => [u, -w] as [number, number]).reverse());
  return {
    through: pravo,
    left: lijevo,
    slight_left: lijevo,
    sharp_left: lijevo,
    right: desno,
    slight_right: desno,
    sharp_right: desno,
  };
})();

/**
 * Strelice iz `turn:lanes` na kraju ivice, u svakoj traci koja ih ima. Kad OSM
 * navede drugačiji broj traka nego što ulica ima, strelica nema — ne pogađa se
 * koja traka je koja.
 */
export function streliceIvice(iv: Ivica, odA: number, odB: number): Poligon[] {
  const izlaz: Poligon[] = [];
  const n = iv.trakeNaprijed + iv.trakeNazad;
  if (n === 0 || iv.sirina < n * iv.sirinaTrake - 1e-6) return izlaz;
  const traka = iv.sirina / n;
  for (const naprijed of [true, false]) {
    const opis = naprijed ? iv.skretanjaNaprijed : iv.skretanjaNazad;
    const trake = naprijed ? iv.trakeNaprijed : iv.trakeNazad;
    if (!opis) continue;
    const po = opis.split("|");
    if (po.length !== trake) continue;
    // Vrh strelice je `GRAD_STRELICA_OD_KRAJA` prije kraja linija, u smjeru vožnje.
    const vrh = naprijed ? iv.duzina - odB - GRAD_STRELICA_OD_KRAJA : odA + GRAD_STRELICA_OD_KRAJA;
    const rep = naprijed ? vrh - GRAD_STRELICA_DUZINA : vrh + GRAD_STRELICA_DUZINA;
    if (Math.min(vrh, rep) < odA + 1 || Math.max(vrh, rep) > iv.duzina - odB - 1) continue;
    const { k, t } = naSegmentu(iv, rep);
    const { h, d } = pravacSegmenta(iv, k);
    const a = iv.tacke[k]!;
    const b = iv.tacke[k + 1]!;
    const baza = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    // U smjeru vožnje: naprijed je `h`, desno `d`; unazad oba obrnuta.
    const hv = naprijed ? h : { x: -h.x, y: -h.y };
    const dv = naprijed ? d : { x: -d.x, y: -d.y };
    po.forEach((traka_, j) => {
      // Pomak sredine trake od osovine, u smjeru `a → b`: trake unaprijed su
      // desno od trakâ unazad; `j` ide s lijeva nadesno onome ko vozi.
      const o = naprijed
        ? -iv.sirina / 2 + (iv.trakeNazad + j + 0.5) * traka
        : -iv.sirina / 2 + (iv.trakeNazad - j - 0.5) * traka;
      const c = { x: baza.x + d.x * o, y: baza.y + d.y * o };
      for (const vrsta of traka_.split(";")) {
        for (const oblik of STRELICE[vrsta.trim()] ?? []) {
          izlaz.push(oblik.map(([u, w]) => ({ x: c.x + hv.x * u + dv.x * w, y: c.y + hv.y * u + dv.y * w })));
        }
      }
    });
  }
  return izlaz;
}

// ── zebre ───────────────────────────────────────────────────────────────────

/**
 * Zebra na prelazu u (`x`, `y`): pruge duž ulice, preko cijelog kolovoza.
 * Prazno kad čvor prelaza nije na voznoj ulici (prelaz preko biciklističke
 * staze, ili pješačka staza koja se ne dodiruje sa ulicom).
 */
export function zebra(p: Povrsina, x: number, y: number): Poligon[] {
  const osa = najblizaOsa(p, x, y, GRAD_ZEBRA_DO_ULICE);
  if (!osa) return [];
  const { tacka: c, pravac: h, pola } = osa;
  const d = { x: -h.y, y: h.x };
  const izlaz: Poligon[] = [];
  const u0 = -GRAD_ZEBRA_DUBINA / 2;
  const u1 = GRAD_ZEBRA_DUBINA / 2;
  const korak = 2 * GRAD_ZEBRA_PRUGA;
  // Pruge simetrično oko osovine, sa po pola razmaka do ivičnjaka.
  const pruga = Math.floor((2 * pola) / korak);
  const pocetak = -(pruga * korak) / 2 + GRAD_ZEBRA_PRUGA / 2;
  for (let k = 0; k < pruga; k++) {
    const w0 = pocetak + k * korak;
    const w1 = w0 + GRAD_ZEBRA_PRUGA;
    izlaz.push(
      (
        [
          [u0, w0],
          [u1, w0],
          [u1, w1],
          [u0, w1],
        ] as const
      ).map(([u, w]) => ({ x: c.x + h.x * u + d.x * w, y: c.y + h.y * u + d.y * w })),
    );
  }
  return izlaz;
}
