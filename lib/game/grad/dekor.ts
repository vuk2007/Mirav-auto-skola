import {
  CAR_LENGTH,
  CAR_WIDTH,
  GRAD_AUTO_VISINA,
  GRAD_DRVORED_RAZMAK,
  GRAD_KLUPA_PO_POVRSINI,
  GRAD_KONTEJNER_RAZMAK,
  GRAD_KROSNJA_H,
  GRAD_KROSNJA_R,
  GRAD_PARKING_DUBINA,
  GRAD_PARKING_PROLAZ,
  GRAD_PARKING_SIRINA,
  GRAD_PARKING_ZAUZETO,
  GRAD_RASVJETA_KLASE,
  GRAD_RASVJETA_RAZMAK,
  GRAD_RASVJETA_VISINA,
  GRAD_SJENKA_DUZINA,
  GRAD_SJENKA_PRAVAC,
  GRAD_STABALA_NAJVISE,
  GRAD_STABLO_PO_POVRSINI,
  GRAD_TROTOAR,
} from "../sim/config";
import { rng } from "../sim/geometry";
import type { Point } from "../sim/types";
import type { Ivica } from "./mreza";
import type { Paket } from "./paket";
import { naPovrsini, odmakniOdUlice, type Povrsina } from "./povrsina";
import {
  Graditelj,
  izaberi,
  ploca,
  pravougaonik,
  prizma,
  puta,
  rgb,
  sjenkaPrizme,
  uPoligonu,
  type Temena,
  type Triangulacija,
} from "./temena";
import { povrsinaSaZnakom, sjemeZgrade, type Zgrada } from "./zgrade";

/**
 * Dekor grada (faza 6, stavka 4c): drveće (OSM drvoredi i stabla po sjemenu u
 * parkovima i šumama), ulična rasvjeta, kontejneri, klupe, parkirani auti na
 * parkinzima. Sve u istom lažnom 2.5D kao zgrade, sa sjenkom.
 *
 * Dekor ne utiče na vožnju: ništa od ovoga nije na kolovozu. Parkirani auti
 * uz ivičnjak jesu na kolovozu — prepreka i pravilo (`parkingViolation`) — pa
 * dolaze sa vozilima u stavci 7.
 *
 * Mjesta i boje biraju sjemena koja zavise samo od položaja (ćelija mreže,
 * prva tačka površine ili ulice), ne od tile-a ni redoslijeda: isto stablo je
 * uvijek na istom mjestu.
 */

export interface BojeDekora {
  krosnja: string[];
  auto: string[];
  stub: string;
  svjetiljka: string;
  klupa: string;
  kontejner: string[];
}

/** Ono što jedan tile daje dekoru. */
export interface UlazDekora {
  paket: Paket;
  povrsina: Povrsina;
  /** Površine tile-a: [od, do) u nizovima paketa. */
  povrsine: [number, number];
  linije: [number, number];
  /** Vozne ivice tile-a, sa odsjecima linija na krajevima (bez dekora u raskrsnici). */
  ivice: { iv: Ivica; odA: number; odB: number }[];
  /** Zgrade tile-a — stablo ne raste u kući. */
  zgrade: readonly Zgrada[];
  boje: BojeDekora;
}

export interface GeometrijaDekora {
  dekor: Temena;
  sjene: Temena;
}

const OSMOUGAO = Array.from({ length: 8 }, (_, k) => ((k + 0.5) * Math.PI) / 4);
const krug = (x: number, y: number, r: number): Point[] =>
  OSMOUGAO.map((a) => ({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r }));

/** Brzo „da li je tačka u nekoj zgradi": zgrade po ćelijama od 20 m. */
function indeksZgrada(zgrade: readonly Zgrada[]): (x: number, y: number) => boolean {
  const C = 20;
  const celije = new Map<number, number[]>();
  const k = (cx: number, cy: number) => cx * 100003 + cy;
  zgrade.forEach((z, i) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of z.osnova) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    for (let cx = Math.floor(minX / C); cx <= Math.floor(maxX / C); cx++) {
      for (let cy = Math.floor(minY / C); cy <= Math.floor(maxY / C); cy++) {
        const niz = celije.get(k(cx, cy));
        if (niz) niz.push(i);
        else celije.set(k(cx, cy), [i]);
      }
    }
  });
  return (x, y) => (celije.get(k(Math.floor(x / C), Math.floor(y / C))) ?? []).some((i) => uPoligonu(zgrade[i]!.osnova, x, y));
}

/** Stablo: krošnja, svjetliji vrh okrenut suncu, i sjenka krošnje na tlu. */
function stablo(g: Graditelj, s: Graditelj, x: number, y: number, sjeme: number, boje: BojeDekora): void {
  const r = rng(sjeme);
  const rad = GRAD_KROSNJA_R[0] + r() * (GRAD_KROSNJA_R[1] - GRAD_KROSNJA_R[0]);
  const h = GRAD_KROSNJA_H[0] + r() * (GRAD_KROSNJA_H[1] - GRAD_KROSNJA_H[0]);
  const boja = rgb(izaberi(boje.krosnja, r));
  ploca(g, krug(x, y, rad), h, puta(boja, 0.9));
  // Vrh krošnje: manji krug, pomaknut ka suncu (suprotno od sjenke).
  const px = x - GRAD_SJENKA_PRAVAC.x * rad * 0.25;
  const py = y - GRAD_SJENKA_PRAVAC.y * rad * 0.25;
  ploca(g, krug(px, py, rad * 0.6), h + 0.3, puta(boja, 1.12));
  const d = h * GRAD_SJENKA_DUZINA;
  ploca(s, krug(x + GRAD_SJENKA_PRAVAC.x * d, y + GRAD_SJENKA_PRAVAC.y * d, rad), 0, [0, 0, 0]);
}

/** Tačke duž linije na svakih `razmak` metara, od prve tačke. */
function duzLinije(t: readonly Point[], razmak: number): Point[] {
  const izlaz: Point[] = [];
  let do_ = 0;
  for (let k = 0; k + 1 < t.length; k++) {
    const a = t[k]!;
    const b = t[k + 1]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    while (do_ <= l) {
      izlaz.push({ x: a.x + ((b.x - a.x) * do_) / l, y: a.y + ((b.y - a.y) * do_) / l });
      do_ += razmak;
    }
    do_ -= l;
  }
  return izlaz;
}

/** Tačka i pravac na ivici `s` metara od početka. */
function naIvici(iv: Ivica, s: number): { p: Point; h: Point } {
  let k = 0;
  while (k + 2 < iv.tacke.length && iv.cum[k + 1]! < s) k += 1;
  const a = iv.tacke[k]!;
  const b = iv.tacke[k + 1]!;
  const l = iv.cum[k + 1]! - iv.cum[k]! || 1;
  const t = (s - iv.cum[k]!) / l;
  return { p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, h: { x: (b.x - a.x) / l, y: (b.y - a.y) / l } };
}

export function geometrijaDekora(u: UlazDekora, triangulisi: Triangulacija): GeometrijaDekora {
  const g = new Graditelj();
  const s = new Graditelj();
  const { paket, povrsina, boje } = u;
  const n = paket.n;
  const z = paket.zaglavlje;
  const uZgradi = indeksZgrada(u.zgrade);
  /** Slobodno tlo: ni na ulici ni na trotoaru (odmak je ne bi pomjerio), ni u kući. */
  const slobodno = (p: Point) => odmakniOdUlice(povrsina, p) === p && !uZgradi(p.x, p.y);

  // ── drvoredi ──
  let stabala = 0;
  for (let i = u.linije[0]; i < u.linije[1]; i++) {
    if (z.vrsteLinija[n.lnVrsta[i]!] !== "drvored") continue;
    const t: Point[] = [];
    for (let k = n.lnOd[i]!; k < n.lnOd[i + 1]!; k++) t.push({ x: n.lnXY[2 * k]!, y: n.lnXY[2 * k + 1]! });
    for (const p of duzLinije(t, GRAD_DRVORED_RAZMAK)) {
      // Drvored je u OSM-u često ucrtan uz sam ivičnjak: ulice su u igri šire,
      // pa se stablo odmiče na trotoar — isto kao ugao zgrade.
      const q = odmakniOdUlice(povrsina, p);
      if (naPovrsini(povrsina, q.x, q.y) || uZgradi(q.x, q.y)) continue;
      stablo(g, s, q.x, q.y, sjemeZgrade(p.x, p.y), boje);
      stabala += 1;
    }
  }

  // ── površine: stabla, klupe, parking ──
  for (let i = u.povrsine[0]; i < u.povrsine[1]; i++) {
    const vrsta = z.vrstePovrsina[n.pvVrsta[i]!] ?? "";
    const oblik: Point[] = [];
    for (let k = n.pvOd[i]!; k < n.pvOd[i + 1]!; k++) oblik.push({ x: n.pvXY[2 * k]!, y: n.pvXY[2 * k + 1]! });
    if (oblik.length < 3) continue;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of oblik) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const pov = Math.abs(povrsinaSaZnakom(oblik));

    const poStablu = GRAD_STABLO_PO_POVRSINI[vrsta];
    if (poStablu !== undefined) {
      // Mreža vezana za svijet, sa pomakom po ćeliji: isto stablo na istom
      // mjestu ma koja površina ga pokrila.
      const a = Math.sqrt(poStablu);
      for (let cx = Math.floor(minX / a); cx <= Math.floor(maxX / a) && stabala < GRAD_STABALA_NAJVISE; cx++) {
        for (let cy = Math.floor(minY / a); cy <= Math.floor(maxY / a) && stabala < GRAD_STABALA_NAJVISE; cy++) {
          const sj = sjemeZgrade(cx * a, cy * a);
          const r = rng(sj);
          const p = { x: (cx + 0.15 + 0.7 * r()) * a, y: (cy + 0.15 + 0.7 * r()) * a };
          if (!uPoligonu(oblik, p.x, p.y) || !slobodno(p)) continue;
          stablo(g, s, p.x, p.y, sj, boje);
          stabala += 1;
        }
      }
    }

    if (vrsta === "park") {
      const r = rng(sjemeZgrade(oblik[0]!.x, oblik[0]!.y) ^ 0x2545f491);
      const klupa = rgb(boje.klupa);
      for (let k = 0; k < Math.floor(pov / GRAD_KLUPA_PO_POVRSINI); k++) {
        const p = { x: minX + r() * (maxX - minX), y: minY + r() * (maxY - minY) };
        const ugao = r() * Math.PI;
        if (!uPoligonu(oblik, p.x, p.y) || !slobodno(p)) continue;
        prizma(g, pravougaonik(p.x, p.y, 0.55, 1.8, ugao), 0, 0.5, puta(klupa, 0.75), klupa, triangulisi);
      }
    }

    if (vrsta === "parking") parking(g, s, oblik, povrsina, boje, triangulisi);
  }

  // ── uz ulice: rasvjeta i kontejneri, na trotoaru ──
  const stub = rgb(boje.stub);
  const svjetiljka = rgb(boje.svjetiljka);
  for (const { iv, odA, odB } of u.ivice) {
    const r = rng(sjemeZgrade(iv.tacke[0]!.x, iv.tacke[0]!.y) ^ 0x68e31da4);
    const pola = iv.sirina / 2;
    if (GRAD_RASVJETA_KLASE.includes(iv.klasa)) {
      // Na desnoj strani (u smjeru crtanja); široka ulica i na lijevoj, na pola razmaka.
      const strane = iv.sirina >= 12 ? [1, -1] : [1];
      for (const strana of strane) {
        const pocetak = odA + (strana === 1 ? GRAD_RASVJETA_RAZMAK / 2 : GRAD_RASVJETA_RAZMAK);
        for (let d = pocetak; d < iv.duzina - odB - 2; d += GRAD_RASVJETA_RAZMAK) {
          const { p, h } = naIvici(iv, d);
          const nx = -h.y * strana;
          const ny = h.x * strana;
          const o = pola + GRAD_TROTOAR * 0.3;
          const x = p.x + nx * o;
          const y = p.y + ny * o;
          if (uZgradi(x, y)) continue;
          prizma(g, pravougaonik(x, y, 0.22, 0.22, 0), 0, GRAD_RASVJETA_VISINA, stub, stub, triangulisi);
          // Svjetiljka: krak nad kolovoz, na vrhu stuba.
          const k = 0.9;
          const glava = pravougaonik(x - nx * k, y - ny * k, 0.35, 1.6, Math.atan2(ny, nx));
          prizma(g, glava, GRAD_RASVJETA_VISINA, GRAD_RASVJETA_VISINA + 0.2, puta(svjetiljka, 0.8), svjetiljka, triangulisi);
        }
      }
    }
    if (iv.klasa === "residential") {
      const boja = rgb(izaberi(boje.kontejner, r));
      for (let d = odA + GRAD_KONTEJNER_RAZMAK * r(); d < iv.duzina - odB - 5; d += GRAD_KONTEJNER_RAZMAK) {
        const { p, h } = naIvici(iv, d);
        const o = pola + GRAD_TROTOAR * 0.5;
        const x = p.x - h.y * o;
        const y = p.y + h.x * o;
        if (uZgradi(x, y)) continue;
        const oblik = pravougaonik(x, y, 1.1, 1.7, Math.atan2(h.y, h.x));
        prizma(g, oblik, 0, 1.3, puta(boja, 0.75), boja, triangulisi);
        sjenkaPrizme(s, oblik, 1.3, triangulisi);
      }
    }
  }

  return { dekor: g.gotovo(), sjene: s.gotovo() };
}

/**
 * Parkirani auti na parkingu: redovi mjesta duž najduže ivice parkinga (dva
 * reda leđa u leđa, pa prolaz), zauzeto po sjemenu. Auto mora cio da stane u
 * parking i da ne dira ulicu.
 */
function parking(
  g: Graditelj,
  s: Graditelj,
  oblik: readonly Point[],
  povrsina: Povrsina,
  boje: BojeDekora,
  triangulisi: Triangulacija,
): void {
  let ugao = 0;
  let najduza = 0;
  for (let k = 0; k < oblik.length; k++) {
    const a = oblik[k]!;
    const b = oblik[(k + 1) % oblik.length]!;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d > najduza) {
      najduza = d;
      ugao = Math.atan2(b.y - a.y, b.x - a.x);
    }
  }
  const c = Math.cos(ugao);
  const sn = Math.sin(ugao);
  // Parking u ravni reda: `u` duž reda, `w` poprijeko.
  let minU = Infinity;
  let maxU = -Infinity;
  let minW = Infinity;
  let maxW = -Infinity;
  for (const p of oblik) {
    const u = p.x * c + p.y * sn;
    const w = -p.x * sn + p.y * c;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minW = Math.min(minW, w);
    maxW = Math.max(maxW, w);
  }
  const blok = 2 * GRAD_PARKING_DUBINA + GRAD_PARKING_PROLAZ;
  const r = rng(sjemeZgrade(oblik[0]!.x, oblik[0]!.y) ^ 0x1b873593);
  const staklo = rgb("#2a3440");
  for (let w0 = minW + GRAD_PARKING_PROLAZ / 2; w0 + GRAD_PARKING_DUBINA <= maxW; w0 += blok) {
    for (const red of [0, 1]) {
      const w = w0 + red * GRAD_PARKING_DUBINA + GRAD_PARKING_DUBINA / 2;
      if (w + GRAD_PARKING_DUBINA / 2 > maxW) continue;
      for (let u = minU + GRAD_PARKING_SIRINA / 2; u + GRAD_PARKING_SIRINA / 2 <= maxU; u += GRAD_PARKING_SIRINA) {
        const zauzeto = r() < GRAD_PARKING_ZAUZETO;
        const boja = rgb(izaberi(boje.auto, r));
        if (!zauzeto) continue;
        const x = u * c - w * sn;
        const y = u * sn + w * c;
        // Auto stoji poprijeko na red, nosom ka prolazu.
        const pravac = ugao + (red === 0 ? -Math.PI / 2 : Math.PI / 2);
        const auto = pravougaonik(x, y, CAR_WIDTH, CAR_LENGTH, pravac);
        if (!auto.every((p) => uPoligonu(oblik, p.x, p.y) && !naPovrsini(povrsina, p.x, p.y))) continue;
        prizma(g, auto, 0, GRAD_AUTO_VISINA, puta(boja, 0.7), boja, triangulisi);
        // Vjetrobran: taman pojas na krovu, bliže nosu.
        const napred = CAR_LENGTH * 0.18;
        ploca(
          g,
          pravougaonik(x + Math.cos(pravac) * napred, y + Math.sin(pravac) * napred, CAR_WIDTH * 0.8, 0.9, pravac),
          GRAD_AUTO_VISINA + 0.01,
          staklo,
        );
        sjenkaPrizme(s, auto, GRAD_AUTO_VISINA, triangulisi);
      }
    }
  }
}
