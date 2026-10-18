import { Application, CanvasTextMetrics, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import {
  EDGE_MARKER_INSET,
  LANDMARK_SIZE,
  MIN_SIGN_PX,
  OKOLINA_POJAS,
  PIXI_CELIJA,
  PIXI_KOMAD,
  PIXI_KOMADA_NAJVISE,
  PRIKLJUCAK_KRAK,
} from "../sim/config";
import { compile, templateById } from "../sim/intersection";
import type { Point, RoadTemplate, VrstaVozila } from "../sim/types";
import type { DioTijela } from "../sim/world";
import type { Okolina } from "../world/okolina";
import {
  BOJE_DUGOG,
  HORIZONT_FONT,
  PALETTE,
  ikona,
  kamera,
  omjerKadra,
  px,
  rasporedHorizonta,
  scenaVozila,
  screenAngle,
  stvariUzPut,
  uvecanje,
  nasaTraka,
  type DrawOptions,
  type StanjeVozila,
  type View,
} from "./draw";
import type { Renderer } from "./renderer";
import { renderS, type Driver } from "./runner";
import {
  bankina,
  brojTacaka,
  crtice,
  dugoVozilo,
  komadPuta,
  kolovoz,
  linijePuta,
  okolinaLinija,
  okolinaTrake,
  sporedniTlo,
  stanicaLinija,
  type Slikar,
} from "./slikar";

/**
 * Crtanje otvorenog puta na WebGL-u (PixiJS).
 *
 * Isto ŠTA kao Canvas 2D — kamera, spisak vozila, stvari uz put i horizont
 * dolaze iz istih funkcija (`draw.ts`, `slikar.ts`) — a drugo KAKO:
 *
 *  - Statičan svijet (okolina, bankina, kolovoz, linije, tlo sporednih puteva)
 *    se gradi JEDNOM po komadu od `PIXI_KOMAD` metara, u koordinatama svijeta.
 *    Kamera onda samo pomjera, okreće i skalira kontejner — kadar ne računa
 *    ništa od toga ponovo. Na Canvasu se isto računa u svakom kadru.
 *  - Ono što stoji uspravno na ekranu (table, natpisi, trouglovi) i ono što se
 *    kreće (vozila, sjene, oznake) crta se svaki kadar, u pikselima ekrana, istim
 *    redom kao na Canvasu.
 *
 * Crta se samo šablon otvorenog puta; raskrsnice, autoput i kružni tok ostaju
 * na Canvas 2D (vidi `renderer.ts`).
 */

/** Boja iz CSS zapisa, sa providnošću — Pixi je prima i kao `rgba(...)`. */
type Boja = string;

/** Komad statičnog svijeta, sagrađen jednom. */
interface Komad {
  okolina: Graphics | null;
  /** Za koju okolinu je `okolina` sagrađena — okolina stiže tile po tile. */
  okolinaOd: Okolina | null;
  bankina: Graphics;
  kolovoz: Graphics;
  linije: Graphics;
  detalji: Graphics;
  /** Kadar u kojem je posljednji put bio vidljiv — za rušenje najdavnijih. */
  vidjen: number;
}

interface Okvir {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const sijece = (a: Okvir, b: Okvir): boolean =>
  a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;

/** Stil linije kao na Canvasu: bez zaobljenja, šiljast spoj. */
const LINIJA = { cap: "butt", join: "miter", miterLimit: 10 } as const;

/**
 * Slikar u koordinatama svijeta, relativno na `o` — Graphics komada stoji na
 * `o`, pa brojevi u geometriji ostaju mali i precizni i na sedamdesetom
 * kilometru rute.
 */
function slikarSvijeta(g: Graphics, scale: number, o: Point): Slikar {
  const tok = (t: readonly Point[]) => t.flatMap((p) => [p.x - o.x, p.y - o.y]);
  const potez = (t: readonly Point[]) => {
    g.moveTo(t[0]!.x - o.x, t[0]!.y - o.y);
    for (let i = 1; i < t.length; i++) g.lineTo(t[i]!.x - o.x, t[i]!.y - o.y);
  };
  return {
    scale,
    poligon: (t, boja) => {
      if (t.length >= 3) g.poly(tok(t)).fill(boja);
    },
    linija: (t, boja, sirina, sablon, odDuzine) => {
      if (t.length < 2) return;
      const dijelovi = sablon ? crtice(t, sablon, odDuzine) : [t];
      if (dijelovi.length === 0) return;
      for (const d of dijelovi) potez(d);
      g.stroke({ ...LINIJA, width: Math.max(1 / scale, sirina), color: boja });
    },
    krug: (c, r, boja) => {
      g.circle(c.x - o.x, c.y - o.y, r).fill(boja);
    },
    uKadru: () => true,
    blizuKadra: () => true,
  };
}

/** Slikar u pikselima ekrana: tačke svijeta idu kroz kameru, kadar po kadar. */
function slikarEkrana(g: Graphics, v: View): Slikar {
  const tok = (t: readonly Point[]) => t.flatMap((p) => {
    const q = px(v, p);
    return [q.x, q.y];
  });
  return {
    scale: v.scale,
    poligon: (t, boja) => {
      if (t.length >= 3) g.poly(tok(t)).fill(boja);
    },
    linija: (t, boja, sirina, sablon, odDuzine) => {
      if (t.length < 2) return;
      const dijelovi = sablon ? crtice(t, sablon, odDuzine) : [t];
      if (dijelovi.length === 0) return;
      for (const d of dijelovi) {
        const q = d.map((p) => px(v, p));
        g.moveTo(q[0]!.x, q[0]!.y);
        for (let i = 1; i < q.length; i++) g.lineTo(q[i]!.x, q[i]!.y);
      }
      g.stroke({ ...LINIJA, width: Math.max(1, sirina * v.scale), color: boja });
    },
    krug: (c, r, boja) => {
      const q = px(v, c);
      g.circle(q.x, q.y, r * v.scale).fill(boja);
    },
    uKadru: () => true,
    blizuKadra: () => true,
  };
}

/**
 * Natpisi i ikone, iz bazena: napraviti `Text` je skupo (crta se na
 * platno pa šalje u teksturu), pa se isti natpis ponovo koristi dok god se
 * vidi, a ono što se u kadru nije tražilo se sakrije.
 */
class Bazen {
  private readonly tekstovi = new Map<string, Text>();
  private readonly slike = new Map<string, Sprite[]>();
  private readonly teksture = new Map<string, Texture>();
  private korisceno = new Set<object>();
  private slikaUKadru = new Map<string, number>();

  constructor(
    private readonly sloj: Container,
    private readonly rezolucija: () => number,
  ) {}

  pocni(): void {
    this.korisceno = new Set();
    this.slikaUKadru = new Map();
  }

  tekst(natpis: string, velicina: number, boja: Boja): Text {
    const kljuc = `${velicina}|${boja}|${natpis}`;
    let t = this.tekstovi.get(kljuc);
    if (!t) {
      t = new Text({
        text: natpis,
        style: { fontFamily: "system-ui, sans-serif", fontWeight: "600", fontSize: velicina, fill: boja },
        resolution: this.rezolucija(),
      });
      this.sloj.addChild(t);
      this.tekstovi.set(kljuc, t);
    }
    t.visible = true;
    t.alpha = 1;
    this.korisceno.add(t);
    return t;
  }

  slika(src: string): Sprite | null {
    let tex = this.teksture.get(src);
    if (!tex) {
      const img = ikona(src);
      if (!img) return null;
      tex = Texture.from(img);
      this.teksture.set(src, tex);
    }
    const n = this.slikaUKadru.get(src) ?? 0;
    this.slikaUKadru.set(src, n + 1);
    let niz = this.slike.get(src);
    if (!niz) {
      niz = [];
      this.slike.set(src, niz);
    }
    let sp = niz[n];
    if (!sp) {
      sp = new Sprite(tex);
      this.sloj.addChild(sp);
      niz.push(sp);
    }
    sp.visible = true;
    this.korisceno.add(sp);
    return sp;
  }

  zavrsi(): void {
    for (const t of this.tekstovi.values()) if (!this.korisceno.has(t)) t.visible = false;
    for (const niz of this.slike.values()) for (const sp of niz) if (!this.korisceno.has(sp)) sp.visible = false;
  }

  /** Nova gustina piksela: tekstovi se prave iznova, oštri. */
  isprazni(): void {
    for (const t of this.tekstovi.values()) t.destroy();
    this.tekstovi.clear();
  }

  unisti(): void {
    this.isprazni();
    for (const niz of this.slike.values()) for (const sp of niz) sp.destroy();
    for (const tex of this.teksture.values()) tex.destroy(true);
  }
}

/**
 * Mjerenje teksta tačno kao na Canvasu — isto platno, ista slova.
 *
 * `sirina` je širina natpisa. `doOsnove` je koliko je osnovna linija slova
 * ispod linije na koju Canvas poravnava natpis (`textBaseline` „middle" ili
 * „top"): obje se mjere od vrha okvira fonta, pa znak razlike ne zavisi od
 * toga kako pregledač broji smjer.
 */
function mjerac(): {
  sirina: (tekst: string, font: string) => number;
  doOsnove: (font: string, poravnanje: "middle" | "top") => number;
} {
  const ctx = document.createElement("canvas").getContext("2d");
  const kes = new Map<string, number>();
  return {
    sirina(tekst, font) {
      if (!ctx) return tekst.length * 7;
      ctx.font = font;
      return ctx.measureText(tekst).width;
    },
    doOsnove(font, poravnanje) {
      const kljuc = `${poravnanje}|${font}`;
      const bilo = kes.get(kljuc);
      if (bilo !== undefined) return bilo;
      if (!ctx) return 0;
      ctx.font = font;
      ctx.textBaseline = "alphabetic";
      const odOsnove = ctx.measureText("Hg").fontBoundingBoxAscent;
      ctx.textBaseline = poravnanje;
      const odLinije = ctx.measureText("Hg").fontBoundingBoxAscent;
      ctx.textBaseline = "alphabetic";
      const d = odOsnove - odLinije;
      kes.set(kljuc, d);
      return d;
    },
  };
}

/**
 * Postavi natpis tako da mu osnovna linija bude tačno tamo gdje bi je stavio
 * Canvas sa `textAlign = "center"` i datim `textBaseline`. Pixi slova crta na
 * visini `ascent` od vrha svoje teksture, pa se natpis sidri za vrh.
 */
function postavi(
  t: Text,
  x: number,
  y: number,
  font: string,
  poravnanje: "middle" | "top",
  m: ReturnType<typeof mjerac>,
): void {
  const ascent = CanvasTextMetrics.measureText(t.text, t.style).fontProperties.ascent;
  t.anchor.set(0.5, 0);
  t.position.set(x, y + m.doOsnove(font, poravnanje) - ascent - (t.style.padding ?? 0));
}

export interface PixiOpcije {
  /**
   * Čuvaj posljednji kadar da se može pročitati (`snimak`). Samo za mjerilo:
   * WebGL inače smije da baci sliku čim je pokaže, i to je brže.
   */
  zaSnimak?: boolean;
}

export async function createPixiRenderer(canvas: HTMLCanvasElement, opcije: PixiOpcije = {}): Promise<Renderer | null> {
  const app = new Application();
  try {
    await app.init({
      canvas,
      preference: "webgl",
      antialias: true,
      background: PALETTE.grass,
      autoStart: false,
      sharedTicker: false,
      autoDensity: false,
      preserveDrawingBuffer: Boolean(opcije.zaSnimak),
    });
  } catch {
    // Nema WebGL-a: onaj ko je tražio Pixi pada nazad na Canvas 2D.
    return null;
  }

  // ── slojevi, odozdo nagore, istim redom kojim crta Canvas ────────────────
  const svijet = new Container();
  // Komadi okoline se crtaju redom duž puta, bez obzira na to kojim su redom
  // sagrađeni — isto kao trake na Canvasu, pa se preklop na spoju ne mijenja.
  const sOkolina = new Container({ sortableChildren: true });
  const sLinijeOkoline = new Container();
  const sBankina = new Container();
  const sKolovoz = new Container();
  const sLinije = new Container();
  const sDetalji = new Container();
  svijet.addChild(sOkolina, sLinijeOkoline, sBankina, sKolovoz, sLinije, sDetalji);
  const uzPut = new Graphics();
  const natpisiUzPut = new Container();
  const horizont = new Graphics();
  const natpisiHorizonta = new Container();
  const dinamika = new Graphics();
  app.stage.addChild(svijet, uzPut, natpisiUzPut, horizont, natpisiHorizonta, dinamika);

  let dpr = 1;
  let w = 0;
  let h = 0;
  const bazenUzPut = new Bazen(natpisiUzPut, () => dpr);
  const bazenHorizonta = new Bazen(natpisiHorizonta, () => dpr);
  const mjera = mjerac();
  const sirina = mjera.sirina;

  // ── statičan svijet ───────────────────────────────────────────────────────
  let zaPut: RoadTemplate | null = null;
  let zaScale = 0;
  let okviri: Okvir[] = [];
  let tacakaPoKomadu = 1;
  const komadi = new Map<number, Komad>();
  let kadar = 0;

  let zaOkolinu: Okolina | null = null;
  let celije = new Map<string, { okvir: Okvir; linije: Okolina["linije"]; g: Graphics | null }>();

  const srusiKomad = (k: number) => {
    const x = komadi.get(k);
    if (!x) return;
    x.okolina?.destroy();
    x.bankina.destroy();
    x.kolovoz.destroy();
    x.linije.destroy();
    x.detalji.destroy();
    komadi.delete(k);
  };
  const srusiSve = () => {
    for (const k of [...komadi.keys()]) srusiKomad(k);
    for (const c of celije.values()) c.g?.destroy();
    celije = new Map();
    zaOkolinu = null;
  };

  /** Okviri komada, jednom po putu: osovina ± pojas okoline i sporedni krak. */
  const pripremiPut = (tpl: RoadTemplate) => {
    srusiSve();
    zaPut = tpl;
    const svih = brojTacaka(tpl);
    const poTacki = tpl.length / Math.max(1, svih - 1);
    tacakaPoKomadu = Math.max(2, Math.round(PIXI_KOMAD / poTacki));
    const { points } = komadPuta(tpl, 0, svih - 1);
    const rub = Math.max(OKOLINA_POJAS, PRIKLJUCAK_KRAK) + tpl.geometry.laneWidth + 4;
    okviri = [];
    for (let i0 = 0; i0 < svih - 1; i0 += tacakaPoKomadu) {
      const i1 = Math.min(svih - 1, i0 + tacakaPoKomadu);
      const o: Okvir = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
      for (let i = i0; i <= i1; i++) {
        const p = points[i]!;
        o.minX = Math.min(o.minX, p.x - rub);
        o.minY = Math.min(o.minY, p.y - rub);
        o.maxX = Math.max(o.maxX, p.x + rub);
        o.maxY = Math.max(o.maxY, p.y + rub);
      }
      okviri.push(o);
    }
  };

  const sagradiKomad = (tpl: RoadTemplate, k: number, scale: number): Komad => {
    const svih = brojTacaka(tpl);
    const i0 = k * tacakaPoKomadu;
    const i1 = Math.min(svih - 1, i0 + tacakaPoKomadu);
    // Linije i poligoni prelaze jednu tačku u sljedeći komad: spoj dva komada
    // pod uglom bi inače imao zarez na spoljnoj strani.
    const komad = komadPuta(tpl, i0, Math.min(svih - 1, i1 + 1));
    const o = komad.points[0]!;
    const g = () => {
      const x = new Graphics();
      x.position.set(o.x, o.y);
      return x;
    };
    const x: Komad = {
      okolina: null,
      okolinaOd: null,
      bankina: g(),
      kolovoz: g(),
      linije: g(),
      detalji: g(),
      vidjen: kadar,
    };
    bankina(slikarSvijeta(x.bankina, scale, o), tpl, komad, PALETTE.kerb);
    kolovoz(slikarSvijeta(x.kolovoz, scale, o), tpl, komad, PALETTE.asphalt);
    linijePuta(slikarSvijeta(x.linije, scale, o), tpl, komad, PALETTE.paint);
    // Tlo sporednih puteva i linija stanice leže na putu — statični su kao i
    // on. Ono što na njima stoji uspravno (trougao, tabla) crta se u kadru.
    const nasa = nasaTraka(tpl);
    if (nasa) {
      const odS = komad.odS;
      const doS = odS + (i1 - i0) * komad.poTacki;
      const d = slikarSvijeta(x.detalji, scale, o);
      for (const p of tpl.prikljucci ?? []) {
        if (p.s >= odS && p.s < doS) sporedniTlo(d, nasa, p, tpl.geometry.laneWidth, PALETTE.asphalt, PALETTE.paint);
      }
      for (const st of tpl.stanice ?? []) {
        if (st.s >= odS && st.s < doS) stanicaLinija(d, nasa, st.s, st.traka, PALETTE.yellow);
      }
    }
    sBankina.addChild(x.bankina);
    sKolovoz.addChild(x.kolovoz);
    sLinije.addChild(x.linije);
    sDetalji.addChild(x.detalji);
    return x;
  };

  const sagradiOkolinu = (tpl: RoadTemplate, k: number, x: Komad, okolina: Okolina, scale: number) => {
    x.okolina?.destroy();
    const svih = brojTacaka(tpl);
    const i0 = k * tacakaPoKomadu;
    const i1 = Math.min(svih - 1, i0 + tacakaPoKomadu);
    const o = komadPuta(tpl, i0, i0).points[0]!;
    const g = new Graphics();
    g.position.set(o.x, o.y);
    g.zIndex = k;
    // Komad trake ide od `i0` do `i1`, pa se dva susjedna dodiruju u tački
    // spoja; sitno se rasipa po rednom broju tačke u cijeloj ruti, pa je isto
    // kao da je traka nacrtana odjednom.
    okolinaTrake(slikarSvijeta(g, scale, o), tpl, okolina, i0, i1);
    // Redosljed komada u sloju prati put, da se preklop na spoju ponaša isto
    // kao na Canvasu, gdje se trake crtaju redom.
    sOkolina.addChild(g);
    x.okolina = g;
    x.okolinaOd = okolina;
  };

  /** Linije okoline po ćelijama mreže — svaka u ćeliji svog početnog ugla. */
  const pripremiCelije = (okolina: Okolina) => {
    for (const c of celije.values()) c.g?.destroy();
    celije = new Map();
    for (const linija of okolina.linije) {
      const o: Okvir = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
      for (const p of linija.tacke) {
        o.minX = Math.min(o.minX, p.x);
        o.minY = Math.min(o.minY, p.y);
        o.maxX = Math.max(o.maxX, p.x);
        o.maxY = Math.max(o.maxY, p.y);
      }
      if (!Number.isFinite(o.minX)) continue;
      const kljuc = `${Math.floor(o.minX / PIXI_CELIJA)}:${Math.floor(o.minY / PIXI_CELIJA)}`;
      let c = celije.get(kljuc);
      if (!c) {
        c = { okvir: { ...o }, linije: [], g: null };
        celije.set(kljuc, c);
      }
      c.linije.push(linija);
      c.okvir.minX = Math.min(c.okvir.minX, o.minX);
      c.okvir.minY = Math.min(c.okvir.minY, o.minY);
      c.okvir.maxX = Math.max(c.okvir.maxX, o.maxX);
      c.okvir.maxY = Math.max(c.okvir.maxY, o.maxY);
    }
    zaOkolinu = okolina;
  };

  /** Dio svijeta koji kadar pokriva, sa rubom — okvir četiri ugla ekrana. */
  const vidljivo = (v: View): Okvir => {
    const cos = Math.cos(v.rot);
    const sin = Math.sin(v.rot);
    const o: Okvir = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const [sx, sy] of [
      [0, 0],
      [v.wPx, 0],
      [0, v.hPx],
      [v.wPx, v.hPx],
    ] as const) {
      // Obrnuto od `px`: ekran → svijet.
      const a = -(sx - v.cx) / v.scale;
      const b = -(sy - v.cy) / v.scale;
      const x = v.wx + a * cos + b * sin;
      const y = v.wy - a * sin + b * cos;
      o.minX = Math.min(o.minX, x);
      o.minY = Math.min(o.minY, y);
      o.maxX = Math.max(o.maxX, x);
      o.maxY = Math.max(o.maxY, y);
    }
    const rub = 10;
    return { minX: o.minX - rub, minY: o.minY - rub, maxX: o.maxX + rub, maxY: o.maxY + rub };
  };

  const azurirajSvijet = (tpl: RoadTemplate, v: View, okolina: Okolina | null) => {
    if (tpl !== zaPut) pripremiPut(tpl);
    if (v.scale !== zaScale) {
      // Debljine linija i veličina sitnog su u pikselima — nova razmjera,
      // novi svijet.
      srusiSve();
      zaScale = v.scale;
    }
    if (okolina && okolina !== zaOkolinu) pripremiCelije(okolina);
    kadar += 1;
    const pogled = vidljivo(v);

    for (let k = 0; k < okviri.length; k++) {
      const u = sijece(okviri[k]!, pogled);
      let x = komadi.get(k);
      if (!u) {
        if (x) setVidljiv(x, false);
        continue;
      }
      if (!x) {
        x = sagradiKomad(tpl, k, v.scale);
        komadi.set(k, x);
      }
      if (okolina && x.okolinaOd !== okolina) sagradiOkolinu(tpl, k, x, okolina, v.scale);
      x.vidjen = kadar;
      setVidljiv(x, true);
    }

    for (const c of celije.values()) {
      const u = sijece(c.okvir, pogled);
      if (u && !c.g) {
        const o = { x: c.okvir.minX, y: c.okvir.minY };
        c.g = new Graphics();
        c.g.position.set(o.x, o.y);
        const s = slikarSvijeta(c.g, v.scale, o);
        for (const linija of c.linije) okolinaLinija(s, linija);
        sLinijeOkoline.addChild(c.g);
      }
      if (c.g) c.g.visible = u;
    }

    // Najdavnije viđeni komadi se ruše kad ih je previše.
    if (komadi.size > PIXI_KOMADA_NAJVISE) {
      const redom = [...komadi.entries()].sort((a, b) => a[1].vidjen - b[1].vidjen);
      for (const [k, x] of redom.slice(0, komadi.size - PIXI_KOMADA_NAJVISE)) {
        if (x.vidjen !== kadar) srusiKomad(k);
      }
    }

    // Kamera: isto kao `px` — okretanje za `rot` pa još za pola kruga (sjever
    // dolje), razmjera, i tačka `(wx, wy)` na mjestu `(cx, cy)`.
    svijet.position.set(v.cx, v.cy);
    svijet.pivot.set(v.wx, v.wy);
    svijet.rotation = v.rot + Math.PI;
    svijet.scale.set(v.scale);
  };

  const setVidljiv = (x: Komad, da: boolean) => {
    if (x.okolina) x.okolina.visible = da;
    x.bankina.visible = da;
    x.kolovoz.visible = da;
    x.linije.visible = da;
    x.detalji.visible = da;
  };

  // ── ono što se crta svaki kadar ──────────────────────────────────────────

  const trougao = (g: Graphics, v: View, mjesto: Point) => {
    const c = px(v, mjesto);
    const a = Math.max(MIN_SIGN_PX / 2, 0.9 * v.scale);
    g.poly([c.x - a, c.y - a * 0.75, c.x + a, c.y - a * 0.75, c.x, c.y + a])
      .fill(PALETTE.paint)
      .stroke({ ...LINIJA, width: Math.max(1.5, a * 0.22), color: PALETTE.red });
  };

  const tablaStanice = (g: Graphics, v: View, znak: Point) => {
    const c = px(v, znak);
    const a = Math.max(MIN_SIGN_PX / 2, 0.9 * v.scale);
    g.roundRect(c.x - a, c.y - a, 2 * a, 2 * a, a * 0.2).fill(PALETTE.stanica);
    g.rect(c.x - a * 0.62, c.y - a * 0.42, a * 1.24, a * 0.7).fill(PALETTE.paint);
    g.rect(c.x - a * 0.48, c.y - a * 0.3, a * 0.96, a * 0.22).fill(PALETTE.stanica);
    g.circle(c.x - a * 0.35, c.y + a * 0.4, a * 0.14).circle(c.x + a * 0.35, c.y + a * 0.4, a * 0.14).fill(PALETTE.paint);
  };

  const tablaKrivine = (g: Graphics, v: View, c: Point, brzina: number) => {
    const q = px(v, c);
    const r = Math.max(MIN_SIGN_PX / 2, 1.15 * v.scale);
    g.circle(q.x, q.y, r).fill(PALETTE.paint).stroke({ width: Math.max(2, r * 0.18), color: PALETTE.red });
    const velicina = Math.round(r);
    const t = bazenUzPut.tekst(String(brzina), velicina, PALETTE.ink);
    postavi(t, q.x, q.y, `600 ${velicina}px system-ui, sans-serif`, "middle", mjera);
  };

  const znamenitost = (g: Graphics, v: View, c: Point, ime: string, src: string) => {
    const q = px(v, c);
    const w = LANDMARK_SIZE * v.scale;
    if (q.x < -w || q.x > v.wPx + w || q.y < -w || q.y > v.hPx + w) return;
    g.roundRect(q.x - w / 2, q.y - w / 2, w, w, w * 0.18)
      .fill(PALETTE.paint)
      .stroke({ width: Math.max(1, w * 0.06), color: PALETTE.ink });
    const sp = bazenUzPut.slika(src);
    if (sp) {
      sp.position.set(q.x - w * 0.4, q.y - w * 0.4);
      sp.width = w * 0.8;
      sp.height = w * 0.8;
    }
    const visina = Math.max(9, w * 0.26);
    const velicina = Math.round(visina);
    const s = sirina(ime, `600 ${velicina}px system-ui, sans-serif`) + visina * 0.8;
    g.roundRect(q.x - s / 2, q.y + w * 0.58, s, visina * 1.5, visina * 0.35).fill("rgba(255,255,255,0.9)");
    const t = bazenUzPut.tekst(ime, velicina, PALETTE.ink);
    postavi(t, q.x, q.y + w * 0.58 + visina * 0.25, `600 ${velicina}px system-ui, sans-serif`, "top", mjera);
  };

  /** Auto iz ptičje perspektive — isto kao `drawVehicle` na Canvasu. */
  const auto = (
    g: Graphics,
    v: View,
    dio: DioTijela,
    smjer: Point,
    color: string,
    vrsta: VrstaVozila | undefined,
    st: StanjeVozila,
  ) => {
    const k = uvecanje(v);
    const lenPx = dio.length * v.scale * k;
    const widPx = dio.width * v.scale * k;
    const c = px(v, dio.pos);
    const ang = screenAngle(v, smjer);
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    // Isto kao `translate` pa `rotate` na Canvasu: karoserija je nacrtana
    // „naprijed = +x".
    g.setTransform(cos, sin, -sin, cos, c.x, c.y);

    if (st.highlight) {
      g.circle(0, 0, lenPx * 0.78).stroke({ width: Math.max(2, lenPx * 0.1), color: st.highlight });
    }
    g.roundRect(-lenPx / 2, -widPx / 2, lenPx, widPx, widPx * 0.25)
      .fill(color)
      .stroke({ width: 1, color: "rgba(0,0,0,0.4)" });

    if (vrsta === "kombi") {
      g.rect(lenPx * 0.24, -widPx * 0.36, lenPx * 0.13, widPx * 0.72).fill("rgba(255,255,255,0.7)");
      g.rect(-lenPx * 0.44, -widPx * 0.38, lenPx * 0.64, widPx * 0.76).fill("rgba(255,255,255,0.2)");
    } else {
      g.rect(lenPx * 0.1, -widPx * 0.34, lenPx * 0.2, widPx * 0.68).fill("rgba(255,255,255,0.7)");
    }

    const stop = st.braking ? "#ff3b30" : "rgba(0,0,0,0.35)";
    g.rect(-lenPx / 2, -widPx * 0.42, lenPx * 0.1, widPx * 0.22).fill(stop);
    g.rect(-lenPx / 2, widPx * 0.2, lenPx * 0.1, widPx * 0.22).fill(stop);

    if (st.beacon) {
      g.circle(0, 0, Math.max(2.5, widPx * 0.3)).fill(PALETTE.beacon).stroke({ width: 1, color: PALETTE.paint });
    }
    if (st.blink) {
      const sy = st.blink === "right" ? widPx * 0.5 : -widPx * 0.5;
      const r = Math.max(1.5, widPx * 0.16);
      g.circle(lenPx * 0.36, sy, r).circle(-lenPx * 0.36, sy, r).fill(PALETTE.yellow);
    }
    g.resetTransform();
  };

  const dugo = (g: Graphics, v: View, tijelo: readonly DioTijela[], color: string, vrsta: VrstaVozila | undefined, st: StanjeVozila) => {
    if (st.highlight) {
      const duzina = tijelo.reduce((a, d) => a + d.length, 0);
      const q = px(v, tijelo[Math.floor(tijelo.length / 2)]!.pos);
      g.circle(q.x, q.y, duzina * v.scale * 0.62).stroke({ width: Math.max(2, duzina * v.scale * 0.04), color: st.highlight });
    }
    dugoVozilo(slikarEkrana(g, v), tijelo, uvecanje(v), color, vrsta, st, BOJE_DUGOG);
  };

  const oznaka = (g: Graphics, v: View, pos: Point, heading: Point, color: string) => {
    const inset = EDGE_MARKER_INSET * v.scale;
    const raw = px(v, pos);
    const c = {
      x: Math.max(inset, Math.min(v.wPx - inset, raw.x)),
      y: Math.max(inset, Math.min(v.hPx - inset, raw.y)),
    };
    const r = Math.max(7, 1.3 * v.scale);
    const ang = screenAngle(v, heading);
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    g.setTransform(cos, sin, -sin, cos, c.x, c.y);
    g.poly([r, 0, -r * 0.7, r * 0.8, -r * 0.7, -r * 0.8])
      .fill({ color, alpha: 0.85 })
      .stroke({ width: 1, color: PALETTE.ink, alpha: 0.85 });
    g.resetTransform();
  };

  const nacrtajHorizont = (v: View, okolina: Okolina, s: number) => {
    horizont.clear();
    bazenHorizonta.pocni();
    for (const n of rasporedHorizonta(v, okolina, s, (t) => sirina(t, HORIZONT_FONT))) {
      horizont
        .poly([n.q.x - 8, n.q.y + 6, n.q.x, n.q.y - 7, n.q.x + 8, n.q.y + 6])
        .fill({ color: PALETTE.ink, alpha: n.alpha });
      horizont
        .rect(n.tx - n.sirina / 2, n.ty - 9, n.sirina, 18)
        .fill({ color: PALETTE.panel, alpha: n.alpha })
        .stroke({ width: 1, color: PALETTE.line, alpha: n.alpha });
      const t = bazenHorizonta.tekst(n.natpis, 12, PALETTE.ink);
      postavi(t, n.tx, n.ty, HORIZONT_FONT, "middle", mjera);
      t.alpha = n.alpha;
    }
    bazenHorizonta.zavrsi();
  };

  return {
    resize(cssW, cssH, noviDpr) {
      if (noviDpr !== dpr) {
        bazenUzPut.isprazni();
        bazenHorizonta.isprazni();
      }
      w = cssW;
      h = cssH;
      dpr = noviDpr;
      app.renderer.resize(cssW, cssH, noviDpr);
    },

    draw(runner: Driver, opts: DrawOptions) {
      const world = runner.world;
      const tpl = templateById(world.templateId);
      if (!tpl || tpl.kind !== "road") return;
      const { paths } = compile(tpl);
      const v = kamera(runner, tpl, paths, w, h, opts.camera);
      const player = world.vehicles.find((x) => x.kind === "player");
      const okolina = opts.okolina ?? null;

      sOkolina.visible = okolina !== null;
      sLinijeOkoline.visible = okolina !== null;
      azurirajSvijet(tpl, v, okolina);

      // Stvari uz put: isti komad oko igrača kao na Canvasu.
      uzPut.clear();
      bazenUzPut.pocni();
      if (player) {
        const sIgraca = renderS(runner, player.id, player.s);
        const svih = brojTacaka(tpl);
        const poTacki = tpl.length / Math.max(1, svih - 1);
        const domet = v.half * 3 * omjerKadra(v);
        const i0 = Math.max(0, Math.floor((sIgraca - domet) / poTacki));
        const i1 = Math.min(svih - 1, Math.ceil((sIgraca + domet) / poTacki));
        for (const x of stvariUzPut(tpl, komadPuta(tpl, i0, i1))) {
          if (x.vrsta === "sporedni") trougao(uzPut, v, x.trougao);
          else if (x.vrsta === "stanica") tablaStanice(uzPut, v, x.znak);
          else if (x.vrsta === "parkirano") {
            auto(uzPut, v, x.tijelo, x.tijelo.heading, x.boja, x.tip, {
              braking: false,
              blink: null,
              beacon: false,
              highlight: null,
            });
          } else if (x.vrsta === "tabla") tablaKrivine(uzPut, v, x.c, x.brzina);
          else znamenitost(uzPut, v, x.c, x.ime, x.ikona);
        }
      }
      bazenUzPut.zavrsi();

      if (okolina && player) nacrtajHorizont(v, okolina, renderS(runner, player.id, player.s));
      else horizont.clear();

      dinamika.clear();
      const scena = scenaVozila(runner, tpl, paths, v, opts);
      const ekran = slikarEkrana(dinamika, v);
      for (const poligon of scena.sjene) ekran.poligon(poligon, PALETTE.sjena);
      for (const x of scena.redom) {
        if (x.vrsta === "oznaka") oznaka(dinamika, v, x.pos, x.heading, x.color);
        else if (x.tijelo.length > 1) dugo(dinamika, v, x.tijelo, x.color, x.tip, x.stanje);
        else if (x.tijelo[0]) auto(dinamika, v, x.tijelo[0], x.smjer, x.color, x.tip, x.stanje);
      }

      app.renderer.render(app.stage);
    },

    snimak() {
      return Promise.resolve(canvas.toDataURL("image/png"));
    },

    destroy() {
      srusiSve();
      bazenUzPut.unisti();
      bazenHorizonta.unisti();
      app.destroy({ removeView: false }, { children: true });
    },
  };
}
