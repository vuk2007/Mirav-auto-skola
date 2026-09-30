import { Application, Container, Graphics } from "pixi.js";
import { CAR_LENGTH, CAR_WIDTH, GRAD_KOMADA_NAJVISE, GRAD_MEDJUOSOVINSKO } from "../sim/config";
import type { Point } from "../sim/types";
import type { Paket } from "../grad/paket";
import type { Povrsina } from "../grad/povrsina";

/**
 * Crtanje grada u razmjeri 1:1 na WebGL-u (faza 6, stavka 3): bez pravila i bez
 * „GTA izgleda" — to je stavka 4. Ovdje je grad kao karta: površine, voda,
 * ulice sa trotoarom, zgrade kao osnove.
 *
 * Asfalt je tačno `Povrsina` po kojoj se vozi: kolovoz oko osovine i zasječeni
 * uglovi raskrsnice. Gdje se na slici vidi ivičnjak, tu auto i udara. Zato se ulice
 * crtaju preko zgrada: kolovoz je u igri širi nego u stvarnosti
 * (`GRAD_SIRINA_TRAKE`), a zgrada koja bi ga prekrila sakrila bi asfalt po
 * kojem se vozi.
 *
 * Paket grada je podijeljen na tile-ove od 500 m. Svaki tile se gradi tek kad
 * uđe u kadar, jednom, u koordinatama svijeta; kamera onda samo pomjera
 * kontejner, isto kao na otvorenom putu (`pixiRenderer.ts`).
 */

/** Boje grada — privremene, dok stavka 4 ne donese palete po zoni. */
const BOJE = {
  tlo: "#e8e4dc",
  trotoar: "#d3cec4",
  asfalt: "#8a8984",
  pjesacka: "#cfc6b6",
  zgrada: "#c2b8a8",
  zgradaIvica: "#a2978a",
  voda: "#9cc7e6",
  igrac: "#2f6fd0",
} as const;

/** Površine po vrsti iz paketa. Vrsta koje nema ne crta se. */
const POVRSINE: Record<string, string> = {
  voda: BOJE.voda,
  most: "#bdb7ac",
  stadion: "#b9d3a5",
  park: "#bfd9a8",
  igraliste: "#c8dcae",
  trg: "#ddd6c8",
  parking: "#d6d2ca",
  skola: "#ece2c0",
  bolnica: "#ecd6d0",
  suma: "#a9c893",
  trava: "#cfe0b8",
  groblje: "#c6d3bb",
  poslovno: "#e6ded6",
  industrija: "#dcd6d2",
  stambeno: "#e6e1d8",
  njiva: "#e7e0bf",
};

/** Linije: boja i da li se crtaju ispod ulica (voda) ili iznad (pruga). */
const LINIJE: Record<string, { boja: string; iznad: boolean }> = {
  rijeka: { boja: BOJE.voda, iznad: false },
  kanal: { boja: BOJE.voda, iznad: false },
  potok: { boja: BOJE.voda, iznad: false },
  pruga: { boja: "#6f6a64", iznad: true },
  drvored: { boja: "#8fb779", iznad: true },
};

/** Trotoar sa svake strane kolovoza [m]. */
const TROTOAR = 1.6;

interface Okvir {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
const prazanOkvir = (): Okvir => ({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
const prosiri = (o: Okvir, x: number, y: number, r = 0) => {
  o.minX = Math.min(o.minX, x - r);
  o.minY = Math.min(o.minY, y - r);
  o.maxX = Math.max(o.maxX, x + r);
  o.maxY = Math.max(o.maxY, y + r);
};
const sijece = (a: Okvir, b: Okvir) => a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;

/** Kadar grada: gdje je kamera, koliko je okrenuta, koliko piksela ima metar. */
export interface GradKadar {
  /** Tačka svijeta na mjestu (`cx`, `cy`) ekrana. */
  wx: number;
  wy: number;
  cx: number;
  cy: number;
  /** Ugao okretanja [rad] — kao `View.rot` u `draw.ts`. */
  rot: number;
  scale: number;
}

export interface GradScena {
  kadar: GradKadar;
  igrac: {
    pos: Point;
    heading: Point;
    koci: boolean;
    /** Upaljena bijela svjetla za vožnju unazad. */
    rikverc: boolean;
    /** Ugao prednjih točkova [rad], pozitivno udesno — da se vidi šta volan radi. */
    tocak: number;
  };
}

export interface GradRenderer {
  resize(cssW: number, cssH: number, dpr: number): void;
  draw(scena: GradScena): void;
  /** Koliko je tile-ova sagrađeno i koliko ih se vidi — za dev preklop. */
  stanje(): { sagradjeno: number; vidljivo: number };
  destroy(): void;
}

interface Tile {
  okvir: Okvir;
  zgrade: [number, number];
  povrsine: [number, number];
  linije: [number, number];
  ivice: number[];
  uglovi: number[];
}

interface Sagradjen {
  slojevi: Graphics[];
  vidjen: number;
}

export async function createGradRenderer(
  canvas: HTMLCanvasElement,
  paket: Paket,
  povrsina: Povrsina,
): Promise<GradRenderer | null> {
  const mreza = povrsina.mreza;
  const app = new Application();
  try {
    await app.init({
      canvas,
      preference: "webgl",
      antialias: true,
      background: BOJE.tlo,
      autoStart: false,
      sharedTicker: false,
      autoDensity: false,
    });
  } catch {
    return null;
  }

  const z = paket.zaglavlje;
  const n = paket.n;

  // ── tile-ovi: šta je u kojem i koliki im je okvir ─────────────────────────
  const brojTileova = z.tileovaX * z.tileovaY;
  const tileovi: Tile[] = [];
  const opseg = (od: Uint32Array, t: number): [number, number] => [od[t]!, od[t + 1]!];
  for (let t = 0; t < brojTileova; t++) {
    tileovi.push({
      okvir: prazanOkvir(),
      zgrade: opseg(n.zgTileOd, t),
      povrsine: opseg(n.pvTileOd, t),
      linije: opseg(n.lnTileOd, t),
      ivice: [],
      uglovi: [],
    });
  }
  const tileZa = (x: number, y: number) => {
    const tx = Math.min(z.tileovaX - 1, Math.max(0, Math.floor((x - z.okvir.minX) / z.tile)));
    const ty = Math.min(z.tileovaY - 1, Math.max(0, Math.floor((y - z.okvir.minY) / z.tile)));
    return ty * z.tileovaX + tx;
  };
  const prstenOkvir = (od: Uint32Array, xy: Float32Array, i: number, o: Okvir, r = 0) => {
    for (let k = od[i]!; k < od[i + 1]!; k++) prosiri(o, xy[2 * k]!, xy[2 * k + 1]!, r);
  };
  for (const [t, tile] of tileovi.entries()) {
    for (let i = tile.zgrade[0]; i < tile.zgrade[1]; i++) prstenOkvir(n.zgOd, n.zgXY, i, tile.okvir);
    for (let i = tile.povrsine[0]; i < tile.povrsine[1]; i++) prstenOkvir(n.pvOd, n.pvXY, i, tile.okvir);
    for (let i = tile.linije[0]; i < tile.linije[1]; i++) prstenOkvir(n.lnOd, n.lnXY, i, tile.okvir, n.lnSirina[i]! / 20);
    void t;
  }
  // Ulice nisu u tile-ovima paketa (mreža je jedna, cijela) — svrstavaju se ovdje,
  // po sredini ivice.
  for (const iv of mreza.ivice) {
    const sredina = iv.tacke[Math.floor(iv.tacke.length / 2)]!;
    const tile = tileovi[tileZa(sredina.x, sredina.y)]!;
    tile.ivice.push(iv.i);
    for (const p of iv.tacke) prosiri(tile.okvir, p.x, p.y, iv.sirina / 2 + TROTOAR);
  }
  for (const [i, u] of povrsina.uglovi.entries()) {
    const tile = tileovi[tileZa(u.c.x, u.c.y)]!;
    tile.uglovi.push(i);
    for (const p of [u.a, u.b, u.c]) prosiri(tile.okvir, p.x, p.y, TROTOAR);
  }

  // ── slojevi ───────────────────────────────────────────────────────────────
  const svijet = new Container();
  const sPovrsine = new Container();
  const sVoda = new Container();
  const sTrotoari = new Container();
  const sUlice = new Container();
  const sIznad = new Container();
  const sZgrade = new Container();
  const dinamika = new Graphics();
  svijet.addChild(sPovrsine, sVoda, sZgrade, sTrotoari, sUlice, sIznad, dinamika);
  app.stage.addChild(svijet);

  const sagradjeni = new Map<number, Sagradjen>();
  let kadar = 0;
  let vidljivih = 0;

  const poligon = (g: Graphics, od: Uint32Array, xy: Float32Array, i: number) => {
    const tacke: number[] = [];
    for (let k = od[i]!; k < od[i + 1]!; k++) tacke.push(xy[2 * k]!, xy[2 * k + 1]!);
    if (tacke.length >= 6) g.poly(tacke);
    return tacke.length >= 6;
  };
  const linija = (g: Graphics, tacke: readonly Point[]) => {
    g.moveTo(tacke[0]!.x, tacke[0]!.y);
    for (let k = 1; k < tacke.length; k++) g.lineTo(tacke[k]!.x, tacke[k]!.y);
  };

  const sagradi = (t: number): Sagradjen => {
    const tile = tileovi[t]!;
    const povrsine = new Graphics();
    for (let i = tile.povrsine[0]; i < tile.povrsine[1]; i++) {
      const boja = POVRSINE[z.vrstePovrsina[n.pvVrsta[i]!] ?? ""];
      if (boja && poligon(povrsine, n.pvOd, n.pvXY, i)) povrsine.fill(boja);
    }
    const voda = new Graphics();
    const iznad = new Graphics();
    for (let i = tile.linije[0]; i < tile.linije[1]; i++) {
      const stil = LINIJE[z.vrsteLinija[n.lnVrsta[i]!] ?? ""];
      if (!stil) continue;
      const tacke: Point[] = [];
      for (let k = n.lnOd[i]!; k < n.lnOd[i + 1]!; k++) tacke.push({ x: n.lnXY[2 * k]!, y: n.lnXY[2 * k + 1]! });
      if (tacke.length < 2) continue;
      const g = stil.iznad ? iznad : voda;
      linija(g, tacke);
      g.stroke({ width: Math.max(0.5, n.lnSirina[i]! / 10), color: stil.boja, cap: "round", join: "round" });
    }
    // Trotoar je šira linija ispod kolovoza — spojevi ulica se tako sami
    // zaobljavaju u raskrsnicu, bez posebnog računa za svaki čvor.
    const trotoari = new Graphics();
    const ulice = new Graphics();
    for (const i of tile.ivice) {
      const iv = mreza.ivice[i]!;
      linija(trotoari, iv.tacke);
      trotoari.stroke({ width: iv.sirina + 2 * TROTOAR, color: BOJE.trotoar, cap: "round", join: "round" });
      linija(ulice, iv.tacke);
      ulice.stroke({ width: iv.sirina, color: iv.vozna ? BOJE.asfalt : BOJE.pjesacka, cap: "round", join: "round" });
    }
    // Zasječen ugao: trotoar prati kosi ivičnjak (linija širine dva trotoara,
    // čiju unutrašnju polovinu prekrije asfalt), a asfalt popuni trougao.
    for (const i of tile.uglovi) {
      const u = povrsina.uglovi[i]!;
      trotoari.moveTo(u.a.x, u.a.y).lineTo(u.b.x, u.b.y);
      trotoari.stroke({ width: 2 * TROTOAR, color: BOJE.trotoar, cap: "round" });
      ulice.poly([u.a.x, u.a.y, u.b.x, u.b.y, u.c.x, u.c.y]).fill(BOJE.asfalt);
    }
    const zgrade = new Graphics();
    for (let i = tile.zgrade[0]; i < tile.zgrade[1]; i++) {
      if (poligon(zgrade, n.zgOd, n.zgXY, i)) {
        zgrade.fill(BOJE.zgrada).stroke({ width: 0.3, color: BOJE.zgradaIvica, join: "miter" });
      }
    }
    sPovrsine.addChild(povrsine);
    sVoda.addChild(voda);
    sTrotoari.addChild(trotoari);
    sUlice.addChild(ulice);
    sIznad.addChild(iznad);
    sZgrade.addChild(zgrade);
    return { slojevi: [povrsine, voda, trotoari, ulice, iznad, zgrade], vidjen: kadar };
  };

  const srusi = (t: number) => {
    const x = sagradjeni.get(t);
    if (!x) return;
    for (const g of x.slojevi) g.destroy();
    sagradjeni.delete(t);
  };

  /** Okvir svijeta koji kadar pokriva — četiri ugla ekrana, unazad kroz kameru. */
  let w = 0;
  let h = 0;
  const vidljivo = (k: GradKadar): Okvir => {
    const cos = Math.cos(k.rot);
    const sin = Math.sin(k.rot);
    const o = prazanOkvir();
    for (const [sx, sy] of [
      [0, 0],
      [w, 0],
      [0, h],
      [w, h],
    ] as const) {
      const a = -(sx - k.cx) / k.scale;
      const b = -(sy - k.cy) / k.scale;
      prosiri(o, k.wx + a * cos + b * sin, k.wy - a * sin + b * cos, 10);
    }
    return o;
  };

  return {
    resize(cssW, cssH, dpr) {
      w = cssW;
      h = cssH;
      app.renderer.resize(cssW, cssH, dpr);
    },

    draw({ kadar: k, igrac }) {
      kadar += 1;
      const pogled = vidljivo(k);
      vidljivih = 0;
      for (let t = 0; t < tileovi.length; t++) {
        const u = sijece(tileovi[t]!.okvir, pogled);
        let x = sagradjeni.get(t);
        if (u && !x) {
          x = sagradi(t);
          sagradjeni.set(t, x);
        }
        if (x) {
          for (const g of x.slojevi) g.visible = u;
          if (u) {
            x.vidjen = kadar;
            vidljivih += 1;
          }
        }
      }
      if (sagradjeni.size > GRAD_KOMADA_NAJVISE) {
        const redom = [...sagradjeni.entries()].sort((a, b) => a[1].vidjen - b[1].vidjen);
        for (const [t, x] of redom.slice(0, sagradjeni.size - GRAD_KOMADA_NAJVISE)) {
          if (x.vidjen !== kadar) srusi(t);
        }
      }

      dinamika.clear();
      const ugao = Math.atan2(igrac.heading.y, igrac.heading.x);
      const cos = Math.cos(ugao);
      const sin = Math.sin(ugao);
      dinamika.setTransform(cos, sin, -sin, cos, igrac.pos.x, igrac.pos.y);
      // Prednji točkovi, ispod karoserije: vire sa strane kad su okrenuti.
      const osovina = GRAD_MEDJUOSOVINSKO / 2;
      const tc = Math.cos(igrac.tocak);
      const ts = Math.sin(igrac.tocak);
      const tDuz = 0.34;
      const tPop = 0.11;
      for (const strana of [-1, 1]) {
        const cx = osovina;
        const cy = strana * (CAR_WIDTH / 2 - 0.12);
        dinamika
          .poly([
            cx + tDuz * tc - tPop * ts, cy + tDuz * ts + tPop * tc,
            cx - tDuz * tc - tPop * ts, cy - tDuz * ts + tPop * tc,
            cx - tDuz * tc + tPop * ts, cy - tDuz * ts - tPop * tc,
            cx + tDuz * tc + tPop * ts, cy + tDuz * ts - tPop * tc,
          ])
          .fill("#1d1d1f");
      }
      dinamika
        .roundRect(-CAR_LENGTH / 2, -CAR_WIDTH / 2, CAR_LENGTH, CAR_WIDTH, CAR_WIDTH * 0.25)
        .fill(BOJE.igrac)
        .stroke({ width: 0.08, color: "rgba(0,0,0,0.4)" });
      dinamika.rect(CAR_LENGTH * 0.1, -CAR_WIDTH * 0.34, CAR_LENGTH * 0.2, CAR_WIDTH * 0.68).fill("rgba(255,255,255,0.7)");
      // Zadnja svjetla: crvena kad se koči, bijela u rikvercu. U rikvercu kočnica
      // vozi unazad, pa crveno tada ne bi značilo ništa.
      const stop = igrac.rikverc ? "#ffffff" : igrac.koci ? "#ff3b30" : "rgba(0,0,0,0.35)";
      dinamika.rect(-CAR_LENGTH / 2, -CAR_WIDTH * 0.42, CAR_LENGTH * 0.1, CAR_WIDTH * 0.22).fill(stop);
      dinamika.rect(-CAR_LENGTH / 2, CAR_WIDTH * 0.2, CAR_LENGTH * 0.1, CAR_WIDTH * 0.22).fill(stop);
      dinamika.resetTransform();

      // Kamera: isto kao `px` u `draw.ts` — okretanje za `rot` i još pola kruga.
      svijet.position.set(k.cx, k.cy);
      svijet.pivot.set(k.wx, k.wy);
      svijet.rotation = k.rot + Math.PI;
      svijet.scale.set(k.scale);
      app.renderer.render(app.stage);
    },

    stanje: () => ({ sagradjeno: sagradjeni.size, vidljivo: vidljivih }),

    destroy() {
      for (const t of [...sagradjeni.keys()]) srusi(t);
      app.destroy({ removeView: false }, { children: true });
    },
  };
}
