import {
  GRAD_ODMAK_NAJVISE,
  GRAD_POVRSINA_CELIJA,
  GRAD_TROTOAR,
  GRAD_UGAO_ZASJEK,
  GRAD_UGAO_ZASJEK_DO,
  GRAD_UGAO_ZASJEK_OD,
  GRAD_ULICA_DO,
} from "../sim/config";
import type { Point } from "../sim/types";
import type { Mreza } from "./mreza";

/**
 * Površina po kojoj se vozi: kolovozi voznih ulica i raskrsnice (faza 6,
 * stavka 3c).
 *
 * Kolovoz je traka širine `sirina` oko osovine ivice (sa zaobljenim krajevima),
 * a u raskrsnici je svaki ugao između dvije susjedne ulice koso zasječen
 * (`Ugao`), kao zaobljen ivičnjak. Tačno to i crtač boji asfaltom: gdje se vidi
 * ivičnjak, tu auto udara. Tako je svaki udar objašnjiv onim što je na slici.
 *
 * Nivoi (most iznad ulice) se ovdje ne razlikuju: površina je ravna.
 */

/**
 * Zasječen ugao raskrsnice: trougao asfalta između tjemena ugla trotoara (`c`)
 * i tačaka `a` i `b`, `GRAD_UGAO_ZASJEK` metara od tjemena duž obje ulice.
 */
export interface Ugao {
  a: Point;
  b: Point;
  c: Point;
}

export interface Povrsina {
  mreza: Mreza;
  uglovi: Ugao[];
  /** Segmenti osovina: ax, ay, bx, by, pola širine — po pet brojeva. */
  seg: Float64Array;
  /** Ivica kojoj segment pripada. */
  segIvica: Uint32Array;
  /** Redni broj segmenta unutar njegove ivice — za položaj duž ivice. */
  segK: Uint32Array;
  /** Po ćeliji: indeksi segmenata i (negativni, −1 − i) uglova koji je dodiruju. */
  celije: Map<number, number[]>;
}

const kljuc = (cx: number, cy: number) => cx * 100003 + cy;
const celija = (v: number) => Math.floor(v / GRAD_POVRSINA_CELIJA);

function upisi(celije: Map<number, number[]>, minX: number, minY: number, maxX: number, maxY: number, stavka: number) {
  for (let cx = celija(minX); cx <= celija(maxX); cx++) {
    for (let cy = celija(minY); cy <= celija(maxY); cy++) {
      const k = kljuc(cx, cy);
      const niz = celije.get(k);
      if (niz) niz.push(stavka);
      else celije.set(k, [stavka]);
    }
  }
}

export function napraviPovrsinu(m: Mreza): Povrsina {
  const vozne = m.ivice.filter((iv) => iv.vozna);
  let brojSeg = 0;
  for (const iv of vozne) brojSeg += Math.max(0, iv.tacke.length - 1);
  const seg = new Float64Array(brojSeg * 5);
  const segIvica = new Uint32Array(brojSeg);
  const segK = new Uint32Array(brojSeg);
  const celije = new Map<number, number[]>();

  let j = 0;
  for (const iv of vozne) {
    const pola = iv.sirina / 2;
    for (let k = 0; k + 1 < iv.tacke.length; k++) {
      const a = iv.tacke[k]!;
      const b = iv.tacke[k + 1]!;
      seg.set([a.x, a.y, b.x, b.y, pola], 5 * j);
      segIvica[j] = iv.i;
      segK[j] = k;
      upisi(celije, Math.min(a.x, b.x) - pola, Math.min(a.y, b.y) - pola, Math.max(a.x, b.x) + pola, Math.max(a.y, b.y) + pola, j);
      j += 1;
    }
  }

  const uglovi: Ugao[] = [];
  for (let c = 0; c < m.cvorovi.length; c++) {
    for (const u of uglovRaskrsnice(m, c)) {
      upisi(
        celije,
        Math.min(u.a.x, u.b.x, u.c.x),
        Math.min(u.a.y, u.b.y, u.c.y),
        Math.max(u.a.x, u.b.x, u.c.x),
        Math.max(u.a.y, u.b.y, u.c.y),
        -1 - uglovi.length,
      );
      uglovi.push(u);
    }
  }
  return { mreza: m, uglovi, seg, segIvica, segK, celije };
}

/** Krak raskrsnice: pravac ulice iz čvora (jedinični) i pola njene širine. */
interface Krak {
  ux: number;
  uy: number;
  pola: number;
  ugao: number;
}

/**
 * Pravac kojim ivica napušta čvor — do tačke nekoliko metara dalje, a ne po
 * prvom segmentu: OSM zna da ima tačku na pola metra od raskrsnice.
 */
function krak(tacke: readonly Point[], cum: readonly number[], odPocetka: boolean, pola: number): Krak | null {
  const duzina = cum[cum.length - 1] ?? 0;
  const d = Math.min(8, duzina);
  const p0 = odPocetka ? tacke[0]! : tacke[tacke.length - 1]!;
  let p1 = p0;
  for (let k = 0; k < tacke.length; k++) {
    const i = odPocetka ? k : tacke.length - 1 - k;
    const s = odPocetka ? cum[i]! : duzina - cum[i]!;
    p1 = tacke[i]!;
    if (s >= d) break;
  }
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const l = Math.hypot(dx, dy);
  if (l < 1e-6) return null;
  return { ux: dx / l, uy: dy / l, pola, ugao: Math.atan2(dy, dx) };
}

/**
 * Uglovi raskrsnice u čvoru `c`: za svake dvije susjedne vozne ulice (redom po
 * uglu), tjeme ugla trotoara je presjek njihovih ivica kolovoza okrenutih jedna
 * drugoj, a zasjek ide `GRAD_UGAO_ZASJEK` duž obje.
 */
function uglovRaskrsnice(m: Mreza, c: number): Ugao[] {
  const p = m.cvorovi[c]!;
  const krakovi: Krak[] = [];
  for (const i of m.izCvora[c] ?? []) {
    const iv = m.ivice[i]!;
    if (!iv.vozna) continue;
    const pola = iv.sirina / 2;
    if (iv.a === c) {
      const k = krak(iv.tacke, iv.cum, true, pola);
      if (k) krakovi.push(k);
    }
    if (iv.b === c) {
      const k = krak(iv.tacke, iv.cum, false, pola);
      if (k) krakovi.push(k);
    }
  }
  if (krakovi.length < 2) return [];
  krakovi.sort((x, y) => x.ugao - y.ugao);
  const od = (GRAD_UGAO_ZASJEK_OD * Math.PI) / 180;
  const doU = (GRAD_UGAO_ZASJEK_DO * Math.PI) / 180;
  const uglovi: Ugao[] = [];
  for (let k = 0; k < krakovi.length; k++) {
    const A = krakovi[k]!;
    const B = krakovi[(k + 1) % krakovi.length]!;
    // Ugao od A do B, u smjeru rasta ugla (sa `y` nadolje: kazaljka na satu).
    // Kod dvije ulice (krivina) su to dva ugla koja zajedno čine pun krug;
    // zasijeca se samo unutrašnji — spoljašnji je veći od `GRAD_UGAO_ZASJEK_DO`.
    let raspon = B.ugao - A.ugao;
    if (raspon <= 0) raspon += 2 * Math.PI;
    if (raspon < od || raspon > doU) continue;
    // Ivica kolovoza A okrenuta ka B (normala A ka B), i ivica B okrenuta ka A.
    const nAx = -A.uy;
    const nAy = A.ux;
    const nBx = B.uy;
    const nBy = -B.ux;
    // p + nA·polaA + t·uA = p + nB·polaB + s·uB
    const rx = nBx * B.pola - nAx * A.pola;
    const ry = nBy * B.pola - nAy * A.pola;
    const det = A.ux * -B.uy - A.uy * -B.ux;
    if (Math.abs(det) < 1e-6) continue;
    const t = (rx * -B.uy - ry * -B.ux) / det;
    const cx = p.x + nAx * A.pola + t * A.ux;
    const cy = p.y + nAy * A.pola + t * A.uy;
    const ua = { x: cx + A.ux * GRAD_UGAO_ZASJEK, y: cy + A.uy * GRAD_UGAO_ZASJEK };
    const ub = { x: cx + B.ux * GRAD_UGAO_ZASJEK, y: cy + B.uy * GRAD_UGAO_ZASJEK };
    uglovi.push({ c: { x: cx, y: cy }, a: ua, b: ub });
    // I trougao od čvora do zasjeka: ivice kolovoza tik uz čvor nisu prave
    // (OSM izlomi ulicu na metar od raskrsnice), pa između njih i zasjeka
    // ostane procjep od par decimetara — rupa u asfaltu u koju auto udari.
    uglovi.push({ c: { x: p.x, y: p.y }, a: ua, b: ub });
  }
  return uglovi;
}

const vektor = (a: Point, b: Point, x: number, y: number) => (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);

/** Da li je tačka u trouglu (sa ivicom). */
function uTrouglu(u: Ugao, x: number, y: number): boolean {
  const d1 = vektor(u.a, u.b, x, y);
  const d2 = vektor(u.b, u.c, x, y);
  const d3 = vektor(u.c, u.a, x, y);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const poz = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && poz);
}

/** Kvadrat udaljenosti tačke od segmenta `j`. */
function udaljenost2(p: Povrsina, j: number, x: number, y: number): number {
  const s = p.seg;
  const ax = s[5 * j]!;
  const ay = s[5 * j + 1]!;
  const dx = s[5 * j + 2]! - ax;
  const dy = s[5 * j + 3]! - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
  const ex = ax + dx * t - x;
  const ey = ay + dy * t - y;
  return ex * ex + ey * ey;
}

/** Da li je tačka na asfaltu vozne ulice ili raskrsnice. */
export function naPovrsini(p: Povrsina, x: number, y: number): boolean {
  const stavke = p.celije.get(kljuc(celija(x), celija(y)));
  if (!stavke) return false;
  for (const j of stavke) {
    if (j < 0) {
      if (uTrouglu(p.uglovi[-1 - j]!, x, y)) return true;
    } else {
      const pola = p.seg[5 * j + 4]!;
      if (udaljenost2(p, j, x, y) <= pola * pola) return true;
    }
  }
  return false;
}

/**
 * Segment osovine najbliži tački, do `GRAD_ULICA_DO` metara; `−1` van ulica.
 * Kod jednako bliskih, onaj sa manjim indeksom — da odgovor ne zavisi od reda
 * obilaska ćelija.
 */
function najbliziSegment(p: Povrsina, x: number, y: number, do_ = GRAD_ULICA_DO): number {
  const cx = celija(x);
  const cy = celija(y);
  let naj = do_ * do_;
  let seg = -1;
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      for (const j of p.celije.get(kljuc(cx + ox, cy + oy)) ?? []) {
        if (j < 0) continue;
        const d = udaljenost2(p, j, x, y);
        if (d < naj || (d === naj && j < seg)) {
          naj = d;
          seg = j;
        }
      }
    }
  }
  return seg;
}

/** Ulica u kojoj je tačka: ivica čija je osovina najbliža; `null` van ulica. */
export function ulicaNa(p: Povrsina, x: number, y: number): number | null {
  const j = najbliziSegment(p, x, y);
  return j < 0 ? null : p.segIvica[j]!;
}

/**
 * Najbliža osovina vozne ulice do `do_` metara: ivica, tačka na osovini,
 * pravac (u smjeru crtanja) i pola širine kolovoza. `null` kad je nema.
 */
export function najblizaOsa(
  p: Povrsina,
  x: number,
  y: number,
  do_: number,
): { ivica: number; tacka: Point; pravac: Point; pola: number; s: number; bok: number } | null {
  const j = najbliziSegment(p, x, y, do_);
  if (j < 0) return null;
  const s = p.seg;
  const ax = s[5 * j]!;
  const ay = s[5 * j + 1]!;
  const dx = s[5 * j + 2]! - ax;
  const dy = s[5 * j + 3]! - ay;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return null;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
  const l = Math.sqrt(l2);
  return {
    ivica: p.segIvica[j]!,
    /** Metara od početka ivice (`a`) do tačke na osovini. */
    s: p.mreza.ivice[p.segIvica[j]!]!.cum[p.segK[j]!]! + t * l,
    /** Koliko je tačka desno od osovine (u smjeru `a → b`) [m]; lijevo je negativno. */
    bok: ((x - ax) * -dy + (y - ay) * dx) / l,
    tacka: { x: ax + dx * t, y: ay + dy * t },
    pravac: { x: dx / l, y: dy / l },
    pola: s[5 * j + 4]!,
  };
}

/** Pravac osovine ulice najbliže tački (jedinični, u smjeru crtanja); `null` van ulica. */
export function pravacUlice(p: Povrsina, x: number, y: number): { x: number; y: number } | null {
  const j = najbliziSegment(p, x, y);
  if (j < 0) return null;
  const dx = p.seg[5 * j + 2]! - p.seg[5 * j]!;
  const dy = p.seg[5 * j + 3]! - p.seg[5 * j + 1]!;
  const d = Math.hypot(dx, dy);
  return d > 0 ? { x: dx / d, y: dy / d } : null;
}

/**
 * Tačka odmaknuta od svih kolovoza do ivice trotoara — za uglove zgrada, jer su
 * ulice u igri šire nego u stvarnosti. Tačka dublje od `GRAD_ODMAK_NAJVISE` u
 * servisnom putu ostaje gdje jeste: to je prolaz kroz zgradu, ne greška
 * širenja. Dva prolaza, jer odmak od jedne ulice može da gurne tačku u drugu.
 */
const PROLAZI = new Set(["service", "track"]);
export function odmakniOdUlice(p: Povrsina, t: Point): Point {
  let x = t.x;
  let y = t.y;
  for (let prolaz = 0; prolaz < 2; prolaz++) {
    const cx = celija(x);
    const cy = celija(y);
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        for (const j of p.celije.get(kljuc(cx + ox, cy + oy)) ?? []) {
          if (j < 0) continue;
          const granica = p.seg[5 * j + 4]! + GRAD_TROTOAR;
          const d2 = udaljenost2(p, j, x, y);
          if (d2 >= granica * granica || d2 === 0) continue;
          const d = Math.sqrt(d2);
          // Prolaz kroz zgradu je servisni put; stambena ulica duboko u kući je
          // netačna OSM linija uske ulice, i kuća se odmiče do kraja.
          if (granica - d > GRAD_ODMAK_NAJVISE && PROLAZI.has(p.mreza.ivice[p.segIvica[j]!]!.klasa)) continue;
          // Najbliža tačka osovine, pa od nje napolje do granice.
          const s = p.seg;
          const ax = s[5 * j]!;
          const ay = s[5 * j + 1]!;
          const dx = s[5 * j + 2]! - ax;
          const dy = s[5 * j + 3]! - ay;
          const l2 = dx * dx + dy * dy;
          const u = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
          const qx = ax + dx * u;
          const qy = ay + dy * u;
          x = qx + ((x - qx) / d) * granica;
          y = qy + ((y - qy) / d) * granica;
        }
      }
    }
  }
  return x === t.x && y === t.y ? t : { x, y };
}

/** Osovina ulice blizu tačke — kandidat za „na kojoj je ulici auto". */
export interface OsaBlizu {
  ivica: number;
  tacka: Point;
  pravac: Point;
  pola: number;
  /** Metara od početka ivice (`a`). */
  s: number;
  /** Desno od osovine u smjeru `a → b` [m]. */
  bok: number;
  /** Udaljenost od osovine [m]. */
  d: number;
}

/**
 * Sve vozne ivice čija je osovina bliža od `do_` metara, sa najbližom tačkom
 * na svakoj (po ivici jedna — najbliži njen segment). Redom po udaljenosti,
 * pa po broju ivice.
 */
export function oseBlizu(p: Povrsina, x: number, y: number, do_: number): OsaBlizu[] {
  const najbolje = new Map<number, OsaBlizu>();
  // Samo ćelije koje dodiruje kvadrat ±`do_` oko tačke: najbliža tačka osovine
  // bliže od `do_` je u njemu, a segment je upisan u ćeliju svake svoje tačke.
  for (let cx = celija(x - do_); cx <= celija(x + do_); cx++) {
    for (let cy = celija(y - do_); cy <= celija(y + do_); cy++) {
      for (const j of p.celije.get(kljuc(cx, cy)) ?? []) {
        if (j < 0) continue;
        const s = p.seg;
        const ax = s[5 * j]!;
        const ay = s[5 * j + 1]!;
        const dx = s[5 * j + 2]! - ax;
        const dy = s[5 * j + 3]! - ay;
        const l2 = dx * dx + dy * dy;
        if (l2 === 0) continue;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
        const qx = ax + dx * t;
        const qy = ay + dy * t;
        const d = Math.hypot(qx - x, qy - y);
        if (d > do_) continue;
        const iv = p.segIvica[j]!;
        const bilo = najbolje.get(iv);
        if (bilo && bilo.d <= d) continue;
        const l = Math.sqrt(l2);
        najbolje.set(iv, {
          ivica: iv,
          tacka: { x: qx, y: qy },
          pravac: { x: dx / l, y: dy / l },
          pola: s[5 * j + 4]!,
          s: p.mreza.ivice[iv]!.cum[p.segK[j]!]! + t * l,
          bok: ((x - ax) * -dy + (y - ay) * dx) / l,
          d,
        });
      }
    }
  }
  return [...najbolje.values()].sort((a, b) => a.d - b.d || a.ivica - b.ivica);
}
