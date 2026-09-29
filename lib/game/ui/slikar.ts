import { OKOLINA_POJAS, OKOLINA_UZORAK, OKO_LIJEVO, PRIKLJUCAK_KRAK, PRIKLJUCAK_SIRINA, ROAD_STEP, ROUTE_STEP } from "../sim/config";
import { headingAt, pointAt, rectCorners, valueAt } from "../sim/geometry";
import { bocnaLinija, centerLine } from "../sim/road";
import { sporedniPut } from "../sim/prikljucci";
import { poseOn, tijeloVozila, zaklanjaci, type DioTijela } from "../sim/world";
import type { Path, Point, Prikljucak, RoadTemplate, Vehicle, VrstaVozila, World } from "../sim/types";
import type { Okolina, OkolinaTraka } from "../world/okolina";

/**
 * Crtanje u koordinatama SVIJETA, nezavisno od toga čime se crta.
 *
 * Canvas 2D i WebGL moraju dati istu sliku. Da svaki ima svoju kopiju računa
 * za bankinu, crtice ili sjenu kamiona, razišli bi se na prvoj izmjeni. Zato
 * se sve što leži na putu i oko njega računa ovdje, jednom, a crtač daje samo
 * tri poteza: poligon, liniju i krug, sve u metrima.
 *
 * Ono što stoji uspravno na EKRANU (table, natpisi, vozila sa najmanjom
 * veličinom u pikselima) ovdje ne spada — to svaki crtač radi sam.
 */
export interface Slikar {
  /** Piksela po metru. Neke stvari imaju najmanju veličinu na ekranu. */
  readonly scale: number;
  poligon(tacke: readonly Point[], boja: string): void;
  /**
   * Polilinija debljine `sirina` [m], ali ne tanja od jednog piksela.
   * `crtice` su [crta, razmak] u metrima; `odDuzine` je koliko je puta prije
   * prve tačke — šablon crtica se mjeri od tamo.
   */
  linija(tacke: readonly Point[], boja: string, sirina: number, crtice?: [number, number], odDuzine?: number): void;
  krug(c: Point, r: number, boja: string): void;
  /**
   * Da li polilinija, proširena za `rub` [m] na sve strane, može biti u kadru.
   * Crtač koji crta kadar po kadar preskače ono što se ne vidi; onaj koji
   * gradi statičan svijet crta sve.
   */
  uKadru(tacke: readonly Point[], rub?: number): boolean;
  /** Da li je tačka u kadru ili do `rubPx` piksela van njega. */
  blizuKadra(p: Point, rubPx: number): boolean;
}

// ── mala vektorska pomagala ─────────────────────────────────────────────────

/** Vektor okrenut za 90° udesno (u sistemu gdje `y` raste nadolje). */
export const rt = (h: Point): Point => ({ x: -h.y, y: h.x });
export const mul = (p: Point, k: number): Point => ({ x: p.x * k, y: p.y * k });
export const plus = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });

/** Pravougaonik zadat centrom, smjerom i dimenzijama u metrima. */
export function worldRect(c: Point, h: Point, len: number, wid: number): Point[] {
  const f = mul(h, len / 2);
  const s = mul(rt(h), wid / 2);
  return [
    { x: c.x + f.x + s.x, y: c.y + f.y + s.y },
    { x: c.x + f.x - s.x, y: c.y + f.y - s.y },
    { x: c.x - f.x - s.x, y: c.y - f.y - s.y },
    { x: c.x - f.x + s.x, y: c.y - f.y + s.y },
  ];
}

/**
 * Crtice polilinije: komadi na kojima je crta.
 *
 * Isto pravilo kao `setLineDash` + `lineDashOffset` na Canvasu: tačka na
 * dužini `d` je na crti kad je `(d + odDuzine) mod (crta + razmak) < crta`, i
 * šablon teče preko tjemena polilinije bez prekida. Za crtače koji crtica
 * nemaju (WebGL).
 *
 * Faza se vodi u opsegu jednog perioda, a svaki korak završava TAČNO na
 * granici crtice ili TAČNO na kraju segmenta — ne na zbiru koji mu je blizu.
 * Prva verzija je kraj segmenta dostizala sabiranjem, `t + (duz - t)` zna biti
 * za jedan ulp manje od `duz`, i petlja se zauvijek vrtjela nad ostatkom od
 * 10⁻¹⁶ m — stranica je stala.
 */
export function crtice(tacke: readonly Point[], [crta, razmak]: [number, number], odDuzine = 0): Point[][] {
  const period = crta + razmak;
  const out: Point[][] = [];
  if (!(crta > 0) || !(period > 0) || !Number.isFinite(odDuzine)) return out;
  let faza = ((odDuzine % period) + period) % period;
  let tekuca: Point[] | null = null;
  for (let i = 0; i + 1 < tacke.length; i++) {
    const a = tacke[i]!;
    const b = tacke[i + 1]!;
    const duz = Math.hypot(b.x - a.x, b.y - a.y);
    if (!(duz > 0) || !Number.isFinite(duz)) continue;
    const na = (t: number): Point =>
      t >= duz ? b : { x: a.x + ((b.x - a.x) * t) / duz, y: a.y + ((b.y - a.y) * t) / duz };
    let t = 0;
    while (t < duz) {
      const naCrti = faza < crta;
      const granica = naCrti ? crta : period;
      const doGranice = granica - faza;
      const doKraja = doGranice >= duz - t;
      const kraj = doKraja ? duz : t + doGranice;
      if (naCrti) {
        if (!tekuca) {
          tekuca = [na(t)];
          out.push(tekuca);
        }
        tekuca.push(na(kraj));
      } else {
        tekuca = null;
      }
      if (doKraja) {
        faza += duz - t;
        if (faza >= period) faza -= period;
        t = duz;
      } else {
        // Tačno na granici. Ako je korak bio manji od preciznosti broja, `t` se
        // ne pomjeri — ali se faza prebaci, pa sljedeći korak ide cijelom crtom
        // ili razmakom.
        t = kraj;
        faza = granica >= period ? 0 : granica;
      }
    }
  }
  return out;
}

// ── boje ────────────────────────────────────────────────────────────────────

/**
 * Boje okoline pored puta.
 *
 * Shematski, po dvije-tri boje: cilj nije slika prirode nego da se sa vozačkog
 * mjesta odmah vidi šta je s koje strane — voda, šuma, naselje. Sve je nešto
 * tamnije od trave, da put ostane najsvjetlije što se vidi.
 */
export const OKOLINA_BOJE: Record<string, string> = {
  voda: "#8ab8dd",
  suma: "#8aa478",
  njiva: "#ddd5a6",
  vinograd: "#c6bf88",
  naselje: "#c8c3ba",
  industrija: "#b3aea6",
};

/**
 * Šta se rasipa po traci okoline, da ne bude prazna boja.
 *
 * Sve je shematsko i sve je jeftino: krug za drvo, pravougaonik za kuću, kratka
 * crta za talas. Mjesta se biraju iz položaja, ne iz slučaja — isti komad puta
 * uvijek izgleda isto, i pri ponovnoj vožnji i pri ponavljanju snimka.
 */
export const OKOLINA_SITNO: Record<
  string,
  { boja: string; oblik: "drvo" | "kuca" | "talas" | "brazda"; razmak: number; velicina: number }
> = {
  suma: { boja: "#5f7a4c", oblik: "drvo", razmak: 11, velicina: 3 },
  naselje: { boja: "#9a938a", oblik: "kuca", razmak: 24, velicina: 8 },
  industrija: { boja: "#867f77", oblik: "kuca", razmak: 32, velicina: 12 },
  voda: { boja: "#bcdcf2", oblik: "talas", razmak: 14, velicina: 5 },
  njiva: { boja: "#bdb47e", oblik: "brazda", razmak: 9, velicina: 7 },
  vinograd: { boja: "#a49b62", oblik: "brazda", razmak: 6, velicina: 6 },
};

/** Boje linijskih pojava: obala, rijeka i sporedne ulice. */
export const OKOLINA_LINIJE: Record<string, { boja: string; sirina: number }> = {
  obala: { boja: "#7fb0d8", sirina: 1.2 },
  rijeka: { boja: "#9ec6e8", sirina: 4 },
  put: { boja: "#cdcfc6", sirina: 2.6 },
};

// ── okolina ─────────────────────────────────────────────────────────────────

/**
 * Broj iz cijelog broja, uvijek isti za isti ulaz.
 *
 * Služi da drvo ili kuća stoje na istom mjestu pri svakoj vožnji: mjesto se
 * računa iz položaja, a ne iz `Math.random`. Bez toga bi se okolina mrdala
 * između dva kadra i ponavljanje snimka ne bi izgledalo isto.
 */
function sjeme(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x165667b1, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491);
  h ^= h >>> 13;
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Trake okoline: površine lijevo i desno od puta, i sitno po njima.
 *
 * Crta se samo komad svake trake između tačaka `[odI, doI]` osovine — cijela
 * ruta kad je `odI = 0`; statičan svijet je gradi komad po komad. Sitno se
 * rasipa po GLOBALNOM rednom broju tačke, pa je isto bez obzira na to na koliko
 * se komada traka presiječe.
 */
export function okolinaTrake(
  s: Slikar,
  tpl: RoadTemplate,
  okolina: Okolina,
  odI = 0,
  doI = Number.POSITIVE_INFINITY,
): void {
  const svih = brojTacaka(tpl);
  const korak = tpl.length / Math.max(1, svih - 1);
  const odIvice = tpl.geometry.laneWidth + 1.6;
  // Osovina se traži samo za komad: cijela ruta ima desetine hiljada tačaka, a
  // ugao se računa za svaku koja se vrati.
  const { points: dio, heading: uglovi } = centerLine(tpl, odI, doI);
  const tacka = (i: number) => dio[i - odI]!;
  const ugao = (i: number) => uglovi[i - odI] ?? 0;

  for (const traka of okolina.trake) {
    const t0 = Math.max(0, Math.floor(traka.odS / korak));
    const t1 = Math.min(svih - 1, Math.ceil(traka.doS / korak));
    const i0 = Math.max(t0, odI);
    const i1 = Math.min(t1, doI, odI + dio.length - 1);
    if (i1 - i0 < 1) continue;
    // Kadar je uzak: traka koja ga ne dodiruje se preskače prije nego što se
    // za nju išta izračuna. Gleda se okvir tačaka duž cijele trake, proširen za
    // širinu pojasa — ne samo njena dva kraja: traka od par stotina metara u
    // krivini ima oba kraja van kadra a sredinu u njemu, i šuma ili more su se
    // pojavljivali tek kad kraj trake uđe u kadar.
    const uzorci: Point[] = [];
    for (let i = i0; i < i1; i += OKOLINA_UZORAK) uzorci.push(tacka(i));
    uzorci.push(tacka(i1));
    if (!s.uKadru(uzorci, OKOLINA_POJAS)) continue;
    crtajTraku(s, tacka, ugao, traka, t0, i0, i1, odIvice);
  }
}

function crtajTraku(
  s: Slikar,
  tacka: (i: number) => Point,
  ugao: (i: number) => number,
  traka: OkolinaTraka,
  t0: number,
  i0: number,
  i1: number,
  odIvice: number,
): void {
  for (const [strana, vrsta] of [
    [1, traka.lijevo],
    [-1, traka.desno],
  ] as const) {
    if (!vrsta) continue;
    const boja = OKOLINA_BOJE[vrsta];
    if (!boja) continue;
    const blize: Point[] = [];
    const dalje: Point[] = [];
    for (let i = i0; i <= i1; i++) {
      const p = tacka(i);
      const u = ugao(i);
      const cos = Math.cos(u);
      const sin = Math.sin(u);
      blize.push({ x: p.x + cos * odIvice * strana, y: p.y - sin * odIvice * strana });
      dalje.push({
        x: p.x + cos * OKOLINA_POJAS * strana,
        y: p.y - sin * OKOLINA_POJAS * strana,
      });
    }
    s.poligon([...blize, ...dalje.reverse()], boja);
    sitno(s, tacka, ugao, t0, i0, i1, strana, vrsta, odIvice);
  }
}

/** Sitni sadržaj u traci okoline: drveće, kuće, talasi, brazde. */
function sitno(
  s: Slikar,
  tacka: (i: number) => Point,
  ugao: (i: number) => number,
  t0: number,
  i0: number,
  i1: number,
  strana: 1 | -1,
  vrsta: string,
  odIvice: number,
): void {
  const stil = OKOLINA_SITNO[vrsta];
  if (!stil) return;
  // Na sitnoj razmjeri se ovo ionako ne raspoznaje, a košta.
  if (stil.velicina * s.scale < 3) return;

  const korakTacaka = Math.max(1, Math.round(stil.razmak / Math.max(0.5, ROUTE_STEP)));
  const sirina = OKOLINA_POJAS - odIvice;
  // Prva tačka komada koja je u rasporedu cijele trake (od `t0` u koraku).
  const prva = t0 + Math.ceil((i0 - t0) / korakTacaka) * korakTacaka;

  for (let i = prva; i <= i1; i += korakTacaka) {
    const p = tacka(i);
    const u = ugao(i);
    const cos = Math.cos(u);
    const sin = Math.sin(u);
    // Dva reda po koraku, na različitim odmacima od puta.
    for (let red = 0; red < 2; red++) {
      const t = sjeme(i, red * 7 + (strana > 0 ? 1 : 2));
      const odmak = odIvice + (0.15 + 0.7 * t) * sirina;
      const uzduz = (sjeme(i + 31, red) - 0.5) * stil.razmak;
      const c = {
        x: p.x + cos * odmak * strana - sin * uzduz,
        y: p.y - sin * odmak * strana - cos * uzduz,
      };
      if (!s.blizuKadra(c, 40)) continue;
      const r = stil.velicina * (0.75 + 0.5 * sjeme(i, red + 3));
      const smjer = { x: cos, y: -sin };

      if (stil.oblik === "drvo") {
        s.krug(c, r / 2, stil.boja);
      } else if (stil.oblik === "kuca") {
        s.poligon(worldRect(c, smjer, r, r * 0.7), stil.boja);
      } else {
        // Talas i brazda su kratke crte poprijeko na put.
        const debljina = Math.max(1 / s.scale, 0.25);
        s.poligon(worldRect(c, stil.oblik === "talas" ? rt(smjer) : smjer, r, debljina), stil.boja);
      }
    }
  }
}

/** Linijske pojave okoline: obala, rijeka, sporedne ulice. */
export function okolinaLinija(s: Slikar, linija: Okolina["linije"][number]): void {
  const stil = OKOLINA_LINIJE[linija.k];
  if (!stil) return;
  if (!s.uKadru(linija.tacke)) return;
  s.linija(linija.tacke, stil.boja, stil.sirina);
}

// ── put ─────────────────────────────────────────────────────────────────────

/** Bankina, kolovoz i linije na komadu puta između tačaka `[i0, i1]` osovine. */
export interface KomadPuta {
  points: Point[];
  heading: number[];
  /** Pređeni put na prvoj tački komada [m]. */
  odS: number;
  poTacki: number;
}

export function komadPuta(tpl: RoadTemplate, i0: number, i1: number): KomadPuta {
  const svih = brojTacaka(tpl);
  const poTacki = tpl.length / Math.max(1, svih - 1);
  const { points, heading } = centerLine(tpl, i0, i1);
  return { points, heading, odS: i0 * poTacki, poTacki };
}

/** Koliko tačaka ima osovina puta. */
export function brojTacaka(tpl: RoadTemplate): number {
  return tpl.centerline?.length ?? Math.round(tpl.length / ROAD_STEP) + 1;
}

/** Bankina ispod kolovoza — mora se nacrtati prije svakog kolovoza. */
export function bankina(s: Slikar, tpl: RoadTemplate, k: KomadPuta, boja: string): void {
  const pola = tpl.geometry.laneWidth;
  const traka = (o: number) => bocnaLinija(k.points, k.heading, o);
  s.poligon([...traka(pola + 1.6), ...traka(-pola - 1.6).reverse()], boja);
}

export function kolovoz(s: Slikar, tpl: RoadTemplate, k: KomadPuta, boja: string): void {
  const pola = tpl.geometry.laneWidth;
  const traka = (o: number) => bocnaLinija(k.points, k.heading, o);
  s.poligon([...traka(pola), ...traka(-pola).reverse()], boja);
}

/**
 * Ivične linije, razdjelna linija i pune linije zabrana.
 *
 * Razdjelna je isprekidana tamo gdje se smije preticati, a puna tamo gdje ne
 * smije — i to iz `tpl.zabrane`, iz istog podatka po kojem se i sudi. Da se
 * linija crta iz jednog računa a sudi po drugom, igrač bi dobijao prekršaj tamo
 * gdje na ekranu piše da smije.
 */
export function linijePuta(s: Slikar, tpl: RoadTemplate, k: KomadPuta, boja: string): void {
  const pola = tpl.geometry.laneWidth;
  const traka = (o: number) => bocnaLinija(k.points, k.heading, o);
  s.linija(traka(pola - 0.2), boja, 0.16);
  s.linija(traka(-pola + 0.2), boja, 0.16);
  // Crtice stoje na putu, ne na komadu: šablon se mjeri od početka puta. Kad se
  // mjerio od komada, a komad je počinjao malo iza igrača i pomjerao se sa njim,
  // crtice su putovale sa autom i razdjelna linija nije promicala.
  s.linija(k.points, boja, 0.16, [4, 7], k.odS);
  for (const z of tpl.zabrane ?? []) {
    // Zabrane su u koordinatama cijele dionice, a crta se samo komad.
    const od = Math.max(0, Math.floor((z.from - k.odS) / k.poTacki));
    const doK = Math.min(k.points.length - 1, Math.ceil((z.to - k.odS) / k.poTacki));
    if (doK - od < 1) continue;
    s.linija(k.points.slice(od, doK + 1), boja, 0.18);
  }
}

/**
 * Tlo sporednog puta uz raskrsnicu: komad asfalta od ivice kolovoza i
 * isprekidana linija na kojoj se čeka. Trougao ustupanja stoji uspravno na
 * ekranu, pa ga crta crtač — vidi `mjestoTrouglaSporednog`.
 *
 * Asfalt počinje malo unutar ivice kolovoza, pa prekrije ivičnu liniju: na
 * raskrsnici je ona prekinuta, kao i na terenu. Mjesto i pravac dolaze iz
 * `sporedniPut`, istog računa po kojem se vozila na njemu kreću.
 */
export function sporedniTlo(
  s: Slikar,
  nasa: Path,
  p: Prikljucak,
  laneWidth: number,
  asfalt: string,
  boja: string,
): void {
  const { usce, van, uzduz } = sporedniPut(nasa, p, laneWidth);
  const w = (PRIKLJUCAK_SIRINA[p.rang] ?? 5) / 2;
  const tacka = (duz: number, pop: number): Point => ({
    x: usce.x + van.x * duz + uzduz.x * pop,
    y: usce.y + van.y * duz + uzduz.y * pop,
  });
  s.poligon(
    [tacka(-0.35, -w - 1), tacka(-0.35, w + 1), tacka(1.6, w), tacka(PRIKLJUCAK_KRAK, w), tacka(PRIKLJUCAK_KRAK, -w), tacka(1.6, -w)],
    asfalt,
  );
  // Linija na kojoj se čeka: isprekidana, poprijeko, na kraju bankine.
  s.linija([tacka(1.8, -w + 0.3), tacka(1.8, w - 0.3)], boja, 0.3, [0.6, 0.4]);
}

/** Gdje stoji trougao „ustupi prvenstvo" sporednog puta, u svijetu. */
export function mjestoTrouglaSporednog(nasa: Path, p: Prikljucak, laneWidth: number): Point {
  const { usce, van } = sporedniPut(nasa, p, laneWidth);
  const w = (PRIKLJUCAK_SIRINA[p.rang] ?? 5) / 2;
  // Trougao je desno od onoga ko čeka — a on gleda ka putu, dakle u `-van`.
  const desno = rt({ x: -van.x, y: -van.y });
  return { x: usce.x + van.x * 2.6 + desno.x * (w + 1.2), y: usce.y + van.y * 2.6 + desno.y * (w + 1.2) };
}

/**
 * Autobuska stanica: tačka uz ivičnjak na kojem autobus staje.
 *
 * Stanica naše trake je uz desni ivičnjak, stanica susretne uz lijevi — tamo
 * gdje taj autobus staje. `odmak` je od ivičnjaka ka trotoaru.
 */
export function uzIvicnjakStanice(nasa: Path, traka: 0 | 1, x: number, odmak: number): Point {
  const znak = traka === 0 ? 1 : -1;
  const ivica = (traka === 0 ? nasa.doIvice : nasa.doPreko) ?? [];
  const o = pointAt(nasa.points, nasa.cum, x);
  const d = rt(headingAt(nasa.points, nasa.cum, x));
  const b = znak * (valueAt(nasa.cum, ivica, x) + odmak);
  return { x: o.x + d.x * b, y: o.y + d.y * b };
}

/** Žuta isprekidana linija uz ivičnjak na kojem autobus staje. */
export function stanicaLinija(s: Slikar, nasa: Path, x: number, traka: 0 | 1, boja: string): void {
  const linija: Point[] = [];
  for (let t = x - 8; t <= x + 8; t += 1) linija.push(uzIvicnjakStanice(nasa, traka, t, -0.35));
  s.linija(linija, boja, 0.22, [1.5, 1]);
}

// ── dugo vozilo ─────────────────────────────────────────────────────────────

export interface BojeDugog {
  sanduk: string;
  autobus: string;
  stop: string;
  stopUgaseno: string;
  pokazivac: string;
  obrub: string;
  /** Vjetrobran autobusa. */
  staklo: string;
  /** Vjetrobran kabine kamiona — nešto providniji od autobuskog. */
  stakloKamiona: string;
  prozor: string;
}

/**
 * Kamion ili autobus: tijelo od više komada koji prate putanju.
 *
 * Obris se slaže iz poprečnih presjeka na krajevima i spojevima komada, pa se
 * vozilo u krivini savije zajedno sa trakom — isto tijelo po kojem se računa i
 * sudar. Crta se u koordinatama svijeta, a ne u okrenutom okviru kao auto:
 * dugo vozilo u krivini nema jedan smjer.
 *
 * `uvecanje` je isto kao za auto: na uskom ekranu se vozila crtaju šira od
 * razmjere, da se vide. Obrub (istaknuto vozilo) crta crtač, jer mu je debljina
 * u pikselima.
 */
export function dugoVozilo(
  s: Slikar,
  tijelo: readonly DioTijela[],
  uvecanje: number,
  color: string,
  vrsta: VrstaVozila | undefined,
  opts: { braking: boolean; blink: "left" | "right" | null },
  boje: BojeDugog,
): void {
  const prvi = tijelo[0];
  const zadnji = tijelo[tijelo.length - 1];
  if (!prvi || !zadnji) return;
  const pola = (prvi.width * uvecanje) / 2;
  const kraj = (d: DioTijela, koliko: number): Point => plus(d.pos, mul(d.heading, koliko));

  // Presjeci od zadnjeg branika do prednjeg. Na spoju dva komada se uzima
  // sredina njihovih krajeva i srednji smjer, da obris nema zub.
  const presjeci: { c: Point; h: Point }[] = [{ c: kraj(prvi, -prvi.length / 2), h: prvi.heading }];
  for (let i = 0; i + 1 < tijelo.length; i++) {
    const a = tijelo[i]!;
    const b = tijelo[i + 1]!;
    const h = plus(a.heading, b.heading);
    const d = Math.hypot(h.x, h.y) || 1;
    presjeci.push({
      c: mul(plus(kraj(a, a.length / 2), kraj(b, -b.length / 2)), 0.5),
      h: { x: h.x / d, y: h.y / d },
    });
  }
  presjeci.push({ c: kraj(zadnji, zadnji.length / 2), h: zadnji.heading });
  const bok = (p: { c: Point; h: Point }, znak: number): Point => plus(p.c, mul(rt(p.h), pola * znak));
  const obris = [...presjeci.map((p) => bok(p, 1)), ...presjeci.map((p) => bok(p, -1)).reverse()];

  s.poligon(obris, vrsta === "autobus" ? boje.autobus : boje.sanduk);
  s.linija([...obris, obris[0]!], boje.obrub, 0.06);

  const naprijed = zadnji.heading;
  const nos = kraj(zadnji, zadnji.length / 2);
  if (vrsta === "autobus") {
    // Prozori duž oba boka, pa vjetrobran preko skoro cijele širine.
    for (const d of tijelo) {
      for (const znak of [1, -1]) {
        const c = plus(d.pos, mul(rt(d.heading), (pola - 0.45) * znak));
        s.poligon(worldRect(c, d.heading, d.length * 0.78, 0.5), boje.prozor);
      }
    }
    s.poligon(worldRect(kraj(zadnji, zadnji.length / 2 - 0.5), naprijed, 0.6, pola * 1.6), boje.staklo);
  } else {
    // Kamion: kabina u boji vozila ispred svijetlog sanduka.
    const kabina = Math.min(2.4, zadnji.length);
    s.poligon(worldRect(plus(nos, mul(naprijed, -kabina / 2)), naprijed, kabina, pola * 2), color);
    s.poligon(worldRect(plus(nos, mul(naprijed, -0.75)), naprijed, 0.5, pola * 1.4), boje.stakloKamiona);
  }

  // Stop svjetla na zadnjem kraju.
  const rep = kraj(prvi, -prvi.length / 2 + 0.2);
  for (const znak of [1, -1]) {
    s.poligon(
      worldRect(plus(rep, mul(rt(prvi.heading), pola * 0.62 * znak)), prvi.heading, 0.4, pola * 0.5),
      opts.braking ? boje.stop : boje.stopUgaseno,
    );
  }

  if (opts.blink) {
    // Pokazivač na prednjem i zadnjem uglu, na strani na koju se ide.
    const znak = opts.blink === "right" ? 1 : -1;
    const r = Math.max(1.5 / s.scale, pola * 0.3);
    s.krug(plus(kraj(zadnji, zadnji.length / 2 - 0.4), mul(rt(naprijed), pola * znak)), r, boje.pokazivac);
    s.krug(plus(kraj(prvi, -prvi.length / 2 + 0.4), mul(rt(prvi.heading), pola * znak)), r, boje.pokazivac);
  }
}

// ── sjena iza kamiona ───────────────────────────────────────────────────────

/** Dužina sjene iza vozila koje zaklanja [m] — dalje od kadra ionako. */
const SJENA_DUZINA = 400;

/**
 * Sjene iza vozila koja igraču zaklanjaju suprotnu traku.
 *
 * Sjena je ono što se sa vozačevog mjesta ne vidi: između dva zraka iz oka
 * kroz krajnje uglove tijela vozila, i dalje od njega. Crta se sa položajem
 * kakav je na ekranu (`sNa`), a zaklanjači su isti oni po kojima se sudi.
 */
export function sjeneZaklona(
  world: World,
  tpl: RoadTemplate,
  paths: ReadonlyMap<string, Path>,
  player: Vehicle,
  sNa: (v: Vehicle) => number,
): { poligoni: Point[][]; zaklanjaci: Set<string> } | null {
  const put = paths.get(player.pathId);
  if (!put) return null;
  const spisak = zaklanjaci(world, paths, player);
  if (spisak.length === 0) return null;
  const ja = { ...player, s: sNa(player) };
  const { pos, heading } = poseOn(tpl, put, ja);
  const d = rt(heading);
  const oko = { x: pos.x - d.x * OKO_LIJEVO, y: pos.y - d.y * OKO_LIJEVO };
  const poligoni: Point[][] = [];
  for (const { vozilo } of spisak) {
    const p = paths.get(vozilo.pathId);
    if (!p) continue;
    const tijelo = tijeloVozila(tpl, p, { ...vozilo, s: sNa(vozilo) });
    const uglovi = tijelo.flatMap((t) => rectCorners(t.pos, t.heading, t.length, t.width));
    // Uglovi se porede po uglu gledanja, mjereno od pravca ka sredini vozila —
    // tako nema skoka preko ±180°.
    const sredina = {
      x: uglovi.reduce((a, u) => a + u.x, 0) / uglovi.length,
      y: uglovi.reduce((a, u) => a + u.y, 0) / uglovi.length,
    };
    const rx = sredina.x - oko.x;
    const ry = sredina.y - oko.y;
    const ugao = (u: Point) => Math.atan2(rx * (u.y - oko.y) - ry * (u.x - oko.x), rx * (u.x - oko.x) + ry * (u.y - oko.y));
    let min = uglovi[0]!;
    let max = uglovi[0]!;
    for (const u of uglovi) {
      if (ugao(u) < ugao(min)) min = u;
      if (ugao(u) > ugao(max)) max = u;
    }
    const dalje = (u: Point): Point => {
      const dx = u.x - oko.x;
      const dy = u.y - oko.y;
      const n = Math.hypot(dx, dy) || 1;
      return { x: u.x + (dx / n) * SJENA_DUZINA, y: u.y + (dy / n) * SJENA_DUZINA };
    };
    poligoni.push([min, dalje(min), dalje(max), max]);
  }
  return { poligoni, zaklanjaci: new Set(spisak.map((z) => z.vozilo.id)) };
}

/** Da li je tačka u poligonu — zrak udesno, broje se presjeci. */
export function uPoligonu(p: Point, poligon: readonly Point[]): boolean {
  let unutra = false;
  for (let i = 0, j = poligon.length - 1; i < poligon.length; j = i++) {
    const a = poligon[i]!;
    const b = poligon[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) unutra = !unutra;
  }
  return unutra;
}
