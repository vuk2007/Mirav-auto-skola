import { Texture } from "pixi.js";
import type { Manevar } from "../grad/mreza";
import type { Svjetlo } from "../grad/raskrsnica";
import type { VrstaZnaka } from "../grad/znakovi";

/**
 * Teksture znakova i semafora za grad (faza 6, stavke 5c i 6), nacrtane na
 * canvasu — sav vizuelni sadržaj je naš (zadatak, odjeljak 10), bez tuđih
 * sprite-ova. Oblik i boje prate pravilnik o saobraćajnim znakovima: STOP
 * osmougao, „ustupi" obrnut trougao, zabrana crveni krug, obaveza plavi
 * krug, glavni put žuti romb, opasnost trougao sa crvenom ivicom.
 *
 * Teksture se prave kad zatrebaju i pamte se: znak ograničenja ima broj, a
 * obavezan smjer kombinaciju pravaca — svih ne bi trebalo praviti unaprijed.
 */

const V = 96;
const CRVENA = "#c8102e";
const PLAVA = "#1f5fbf";
const ZUTA = "#f5c400";

function platno(sirina = V, visina = V): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement("canvas");
  c.width = sirina;
  c.height = visina;
  return { c, g: c.getContext("2d")! };
}

type Smjer = "pravo" | "lijevo" | "desno" | "u";
const SMJER: Record<Manevar, Smjer> = { lijevo: "lijevo", pravo: "pravo", desno: "desno", polukruzno: "u" };

/**
 * Strelica u krugu poluprečnika 30 oko (48, 48): „pravo", „lijevo", „desno",
 * „U". `s` je razmjera oko centra (manja strelica u sočivu semafora).
 */
function strelica(g: CanvasRenderingContext2D, smjer: Smjer, boja: string, cx = 48, cy = 48, s = 1): void {
  g.save();
  g.translate(cx, cy);
  g.scale(s, s);
  g.translate(-48, -48);
  g.strokeStyle = boja;
  g.fillStyle = boja;
  g.lineWidth = 7;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  if (smjer === "pravo") {
    g.moveTo(48, 72);
    g.lineTo(48, 34);
  } else if (smjer === "u") {
    g.moveTo(58, 72);
    g.lineTo(58, 42);
    g.arc(46, 42, 12, 0, Math.PI, true);
    g.lineTo(34, 60);
  } else {
    const x = smjer === "lijevo" ? -1 : 1;
    g.moveTo(48 - 6 * x, 72);
    g.lineTo(48 - 6 * x, 50);
    g.quadraticCurveTo(48 - 6 * x, 40, 48 + 6 * x, 40);
    g.lineTo(48 + 14 * x, 40);
  }
  g.stroke();
  // Glava strelice.
  g.beginPath();
  if (smjer === "pravo") {
    g.moveTo(36, 38);
    g.lineTo(48, 22);
    g.lineTo(60, 38);
  } else if (smjer === "u") {
    g.moveTo(24, 58);
    g.lineTo(34, 72);
    g.lineTo(44, 58);
  } else {
    const x = smjer === "lijevo" ? -1 : 1;
    g.moveTo(48 + 12 * x, 28);
    g.lineTo(48 + 28 * x, 40);
    g.lineTo(48 + 12 * x, 52);
  }
  g.closePath();
  g.fill();
  g.restore();
}

function krug(g: CanvasRenderingContext2D, fill: string, ivica: string | null, sirinaIvice = 10): void {
  g.beginPath();
  g.arc(48, 48, 44, 0, 2 * Math.PI);
  g.fillStyle = ivica ?? fill;
  g.fill();
  if (ivica) {
    g.beginPath();
    g.arc(48, 48, 44 - sirinaIvice, 0, 2 * Math.PI);
    g.fillStyle = fill;
    g.fill();
  }
}

function tekst(g: CanvasRenderingContext2D, t: string, x: number, y: number, px: number, boja = "#111111"): void {
  g.fillStyle = boja;
  g.font = `bold ${px}px Arial, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(t, x, y);
}

/** Romb glavnog puta: bijela ivica, žuta sredina. */
function romb(g: CanvasRenderingContext2D, sredina: string): void {
  const r = (d: number, boja: string) => {
    g.beginPath();
    g.moveTo(48, 48 - d);
    g.lineTo(48 + d, 48);
    g.lineTo(48, 48 + d);
    g.lineTo(48 - d, 48);
    g.closePath();
    g.fillStyle = boja;
    g.fill();
  };
  r(46, "#333333");
  r(44, "#ffffff");
  r(30, sredina);
}

/** Dva auta spreda (znak zabrane preticanja): lijevo `a`, desno `b`. */
function dvaAuta(g: CanvasRenderingContext2D, a: string, b: string): void {
  for (const [x, boja] of [
    [30, a],
    [62, b],
  ] as const) {
    g.fillStyle = boja;
    g.beginPath();
    g.roundRect(x - 11, 42, 22, 16, 3);
    g.fill();
    g.beginPath();
    g.roundRect(x - 8, 34, 16, 10, 3);
    g.fill();
    g.fillRect(x - 10, 57, 5, 5);
    g.fillRect(x + 5, 57, 5, 5);
  }
}

/** Dvoje djece (silueta), oko tačke (cx, cy). */
function djeca(g: CanvasRenderingContext2D, cx: number, cy: number, boja = "#111111"): void {
  g.fillStyle = boja;
  g.strokeStyle = boja;
  g.lineCap = "round";
  for (const [dx, v] of [
    [-8, 1],
    [8, 0.8],
  ] as const) {
    const x = cx + dx;
    g.beginPath();
    g.arc(x, cy - 14 * v, 4.5 * v, 0, 2 * Math.PI);
    g.fill();
    g.lineWidth = 5 * v;
    g.beginPath();
    g.moveTo(x, cy - 8 * v);
    g.lineTo(x, cy + 4 * v);
    g.stroke();
    g.lineWidth = 3.5 * v;
    g.beginPath();
    g.moveTo(x - 4 * v, cy + 14 * v);
    g.lineTo(x, cy + 4 * v);
    g.lineTo(x + 4 * v, cy + 14 * v);
    g.stroke();
  }
}

function znak(vrsta: VrstaZnaka): HTMLCanvasElement {
  const { c, g } = platno();
  const [ime, vrijednost] = vrsta.split(":") as [string, string | undefined];
  switch (ime) {
    case "stop": {
      g.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = ((k + 0.5) * Math.PI) / 4;
        g.lineTo(48 + 46 * Math.cos(a), 48 + 46 * Math.sin(a));
      }
      g.closePath();
      g.fillStyle = "#ffffff";
      g.fill();
      g.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = ((k + 0.5) * Math.PI) / 4;
        g.lineTo(48 + 41 * Math.cos(a), 48 + 41 * Math.sin(a));
      }
      g.closePath();
      g.fillStyle = CRVENA;
      g.fill();
      tekst(g, "STOP", 48, 50, 27, "#ffffff");
      break;
    }
    case "ustupi": {
      g.beginPath();
      g.moveTo(4, 10);
      g.lineTo(92, 10);
      g.lineTo(48, 88);
      g.closePath();
      g.fillStyle = CRVENA;
      g.fill();
      g.beginPath();
      g.moveTo(20, 19);
      g.lineTo(76, 19);
      g.lineTo(48, 70);
      g.closePath();
      g.fillStyle = "#ffffff";
      g.fill();
      break;
    }
    case "zabranaUlaska": {
      krug(g, CRVENA, null);
      g.fillStyle = "#ffffff";
      g.fillRect(18, 40, 60, 16);
      break;
    }
    case "zabranaSaobracaja":
      krug(g, "#ffffff", CRVENA, 12);
      break;
    case "kruzniTok": {
      // Plavi krug, tri bijele strelice u krug — suprotno od kazaljke, kako
      // se vozi kroz kružni tok (na slici je `y` nadolje: ugao opada).
      krug(g, PLAVA, "#ffffff", 3);
      g.strokeStyle = "#ffffff";
      g.fillStyle = "#ffffff";
      g.lineWidth = 7;
      g.lineCap = "round";
      for (let k = 0; k < 3; k++) {
        const pocetak = (k * 2 * Math.PI) / 3 + 0.25;
        const kraj = pocetak - (2 * Math.PI) / 3 + 0.75;
        g.beginPath();
        g.arc(48, 48, 22, pocetak, kraj, true);
        g.stroke();
        // Glava na kraju luka, u pravcu vožnje (tangenta, ugao opada).
        const x = 48 + 22 * Math.cos(kraj);
        const y = 48 + 22 * Math.sin(kraj);
        const tx = Math.sin(kraj);
        const ty = -Math.cos(kraj);
        const nx = Math.cos(kraj);
        const ny = Math.sin(kraj);
        g.beginPath();
        g.moveTo(x + 11 * tx, y + 11 * ty);
        g.lineTo(x + 9 * nx, y + 9 * ny);
        g.lineTo(x - 9 * nx, y - 9 * ny);
        g.closePath();
        g.fill();
      }
      break;
    }
    case "glavni":
      romb(g, ZUTA);
      break;
    case "krajGlavnog": {
      romb(g, ZUTA);
      g.strokeStyle = "#111111";
      g.lineWidth = 3;
      for (const d of [-10, 0, 10]) {
        g.beginPath();
        g.moveTo(22 + d, 74 + d);
        g.lineTo(74 + d, 22 + d);
        g.stroke();
      }
      break;
    }
    case "brzina": {
      krug(g, "#ffffff", CRVENA);
      tekst(g, vrijednost ?? "", 48, 50, (vrijednost ?? "").length > 2 ? 30 : 38);
      break;
    }
    case "zona":
    case "krajZone": {
      // Pravougaona tabla „ZONA" sa znakom ograničenja; kraj zone sivo i
      // precrtano.
      const kraj = ime === "krajZone";
      g.fillStyle = kraj ? "#9a9a9a" : "#111111";
      g.fillRect(8, 2, 80, 92);
      g.fillStyle = "#ffffff";
      g.fillRect(11, 5, 74, 86);
      tekst(g, "ZONA", 48, 19, 18, kraj ? "#8a8a8a" : "#111111");
      g.beginPath();
      g.arc(48, 59, 27, 0, 2 * Math.PI);
      g.fillStyle = kraj ? "#9a9a9a" : CRVENA;
      g.fill();
      g.beginPath();
      g.arc(48, 59, 21, 0, 2 * Math.PI);
      g.fillStyle = "#ffffff";
      g.fill();
      tekst(g, vrijednost ?? "", 48, 60, 22, kraj ? "#8a8a8a" : "#111111");
      if (kraj) {
        g.strokeStyle = "#111111";
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(16, 86);
        g.lineTo(80, 10);
        g.stroke();
      }
      break;
    }
    case "zabranaPreticanja":
      krug(g, "#ffffff", CRVENA);
      dvaAuta(g, CRVENA, "#111111");
      break;
    case "krajZabranePreticanja": {
      krug(g, "#ffffff", "#8a8a8a", 3);
      dvaAuta(g, "#8a8a8a", "#8a8a8a");
      g.strokeStyle = "#111111";
      g.lineWidth = 2.5;
      for (const d of [-8, 0, 8]) {
        g.beginPath();
        g.moveTo(20 + d, 76 + d);
        g.lineTo(76 + d, 20 + d);
        g.stroke();
      }
      break;
    }
    case "djeca": {
      // Opasnost: trougao sa crvenom ivicom, vrh gore.
      g.beginPath();
      g.moveTo(48, 4);
      g.lineTo(93, 86);
      g.lineTo(3, 86);
      g.closePath();
      g.fillStyle = CRVENA;
      g.fill();
      g.beginPath();
      g.moveTo(48, 20);
      g.lineTo(80, 78);
      g.lineTo(16, 78);
      g.closePath();
      g.fillStyle = "#ffffff";
      g.fill();
      djeca(g, 48, 58);
      break;
    }
    case "stajaliste": {
      // Autobusko stajalište: plavi kvadrat, bijelo polje, crni autobus.
      g.fillStyle = PLAVA;
      g.fillRect(6, 6, 84, 84);
      g.fillStyle = "#ffffff";
      g.fillRect(16, 16, 64, 64);
      g.fillStyle = "#111111";
      g.beginPath();
      g.roundRect(24, 30, 48, 30, 4);
      g.fill();
      g.fillStyle = "#ffffff";
      for (const x of [29, 41, 53]) g.fillRect(x, 35, 9, 9);
      g.fillRect(65, 35, 4, 16);
      g.fillStyle = "#111111";
      g.beginPath();
      g.arc(34, 62, 5, 0, Math.PI * 2);
      g.arc(62, 62, 5, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "skolskaZona": {
      g.fillStyle = PLAVA;
      g.fillRect(6, 6, 84, 84);
      g.fillStyle = "#ffffff";
      g.fillRect(14, 14, 68, 68);
      djeca(g, 48, 44);
      tekst(g, "ŠKOLA", 48, 72, 15);
      break;
    }
    case "obavezno": {
      // Obavezan smjer: plavi krug, bijela strelica za svaki dozvoljeni pravac.
      krug(g, PLAVA, "#ffffff", 3);
      for (const m of (vrijednost ?? "").split(",")) {
        const s = SMJER[m as Manevar];
        if (s) strelica(g, s, "#ffffff");
      }
      break;
    }
    default: {
      // OSM `no_*` / `only_*`.
      const obaveza = vrsta.startsWith("only_");
      const smjer: Smjer = vrsta.endsWith("left_turn")
        ? "lijevo"
        : vrsta.endsWith("right_turn")
          ? "desno"
          : vrsta === "no_u_turn"
            ? "u"
            : "pravo";
      if (obaveza) {
        krug(g, PLAVA, "#ffffff", 3);
        strelica(g, smjer, "#ffffff");
      } else {
        krug(g, "#ffffff", CRVENA);
        strelica(g, smjer, "#111111");
        // Kosa crvena crta preko strelice.
        g.strokeStyle = CRVENA;
        g.lineWidth = 9;
        g.beginPath();
        g.moveTo(20, 76);
        g.lineTo(76, 20);
        g.stroke();
      }
    }
  }
  return c;
}

const LAMPE: [Svjetlo, string, string][] = [
  ["crveno", "#ff3b30", "#4a1714"],
  ["zuto", "#ffcc00", "#4a3d10"],
  ["zeleno", "#34c759", "#143d20"],
];

/**
 * Glava semafora: tri svjetla, upaljeno ono koje kaže plan. Svjetlo za
 * pojedine pravce (editor) ima strelice u sočivima: upaljeno sočivo je
 * tamno, a strelica svijetli njegovom bojom.
 */
function glavaSemafora(upaljeno: Svjetlo, manevri: readonly Manevar[] | null): HTMLCanvasElement {
  const { c, g } = platno(40, V);
  g.fillStyle = "#1c1d20";
  g.beginPath();
  g.roundRect(2, 2, 36, 92, 8);
  g.fill();
  LAMPE.forEach(([ime, upaljena, ugasena], i) => {
    const y = 18 + i * 30;
    g.beginPath();
    g.arc(20, y, 11, 0, 2 * Math.PI);
    if (!manevri) {
      g.fillStyle = ime === upaljeno ? upaljena : ugasena;
      g.fill();
      return;
    }
    g.fillStyle = "#101113";
    g.fill();
    for (const m of manevri) strelica(g, SMJER[m], ime === upaljeno ? upaljena : ugasena, 20, y, 0.3);
  });
  return c;
}

/** Zelena dopunska strelica: jedno sočivo uz glavno svjetlo, upaljeno ili ne. */
function dopunska(upaljena: boolean, manevri: readonly Manevar[]): HTMLCanvasElement {
  const { c, g } = platno(40, 36);
  g.fillStyle = "#1c1d20";
  g.beginPath();
  g.roundRect(2, 2, 36, 32, 8);
  g.fill();
  g.beginPath();
  g.arc(20, 18, 12, 0, 2 * Math.PI);
  g.fillStyle = "#101113";
  g.fill();
  for (const m of manevri) strelica(g, SMJER[m], upaljena ? "#34c759" : "#143d20", 20, 18, 0.32);
  return c;
}

export interface TekstureZnakova {
  znak(vrsta: VrstaZnaka): Texture;
  /** Glava semafora u stanju `stanje`; sa `manevri` — svjetlo sa strelicama za te pravce. */
  semafor(stanje: Svjetlo, manevri?: readonly Manevar[] | null): Texture;
  dopunska(upaljena: boolean, manevri: readonly Manevar[]): Texture;
  unisti(): void;
}

export function tekstureZnakova(): TekstureZnakova {
  const kes = new Map<string, Texture>();
  const iz = (kljuc: string, nacrtaj: () => HTMLCanvasElement) => {
    let t = kes.get(kljuc);
    if (!t) {
      t = Texture.from(nacrtaj());
      kes.set(kljuc, t);
    }
    return t;
  };
  return {
    znak: (vrsta) => iz(`z:${vrsta}`, () => znak(vrsta)),
    semafor: (stanje, manevri = null) => iz(`s:${stanje}:${manevri?.join(",") ?? ""}`, () => glavaSemafora(stanje, manevri)),
    dopunska: (upaljena, manevri) => iz(`d:${upaljena}:${manevri.join(",")}`, () => dopunska(upaljena, manevri)),
    unisti() {
      for (const t of kes.values()) t.destroy(true);
      kes.clear();
    },
  };
}
