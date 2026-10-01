import { Texture } from "pixi.js";
import type { VrstaZnaka } from "../grad/znakovi";
import type { Svjetlo } from "../grad/raskrsnica";

/**
 * Teksture znakova i semafora za grad (faza 6, stavka 5c), nacrtane na
 * canvasu jednom po crtaču — sav vizuelni sadržaj je naš (zadatak, odjeljak
 * 10), bez tuđih sprite-ova. Oblik i boje prate pravilnik o saobraćajnim
 * znakovima: STOP osmougao, „ustupi" obrnut trougao, zabrana crveni krug,
 * obaveza plavi krug.
 */

const V = 96;

function platno(sirina = V, visina = V): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement("canvas");
  c.width = sirina;
  c.height = visina;
  return { c, g: c.getContext("2d")! };
}

/** Strelica bijela ili crna, u krugu poluprečnika 30 oko (48, 48): „pravo", „lijevo", „desno", „U". */
function strelica(g: CanvasRenderingContext2D, smjer: "pravo" | "lijevo" | "desno" | "u", boja: string): void {
  g.save();
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

function znak(vrsta: VrstaZnaka): HTMLCanvasElement {
  const { c, g } = platno();
  switch (vrsta) {
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
      g.fillStyle = "#c8102e";
      g.fill();
      g.fillStyle = "#ffffff";
      g.font = "bold 27px Arial, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("STOP", 48, 50);
      break;
    }
    case "ustupi": {
      g.beginPath();
      g.moveTo(4, 10);
      g.lineTo(92, 10);
      g.lineTo(48, 88);
      g.closePath();
      g.fillStyle = "#c8102e";
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
      krug(g, "#c8102e", null);
      g.fillStyle = "#ffffff";
      g.fillRect(18, 40, 60, 16);
      break;
    }
    case "kruzniTok": {
      // Plavi krug, tri bijele strelice u krug — suprotno od kazaljke, kako
      // se vozi kroz kružni tok (na slici je `y` nadolje: ugao opada).
      krug(g, "#1f5fbf", "#ffffff", 3);
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
    default: {
      const obaveza = vrsta.startsWith("only_");
      const smjer = vrsta.endsWith("left_turn")
        ? "lijevo"
        : vrsta.endsWith("right_turn")
          ? "desno"
          : vrsta === "no_u_turn"
            ? "u"
            : "pravo";
      if (obaveza) {
        krug(g, "#1f5fbf", "#ffffff", 3);
        strelica(g, smjer, "#ffffff");
      } else {
        krug(g, "#ffffff", "#c8102e");
        strelica(g, smjer, "#111111");
        // Kosa crvena crta preko strelice.
        g.strokeStyle = "#c8102e";
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

/** Glava semafora: tri svjetla, upaljeno ono koje kaže plan. */
function glavaSemafora(upaljeno: Svjetlo): HTMLCanvasElement {
  const { c, g } = platno(40, V);
  g.fillStyle = "#1c1d20";
  g.beginPath();
  g.roundRect(2, 2, 36, 92, 8);
  g.fill();
  const lampe: [Svjetlo, string, string][] = [
    ["crveno", "#ff3b30", "#4a1714"],
    ["zuto", "#ffcc00", "#4a3d10"],
    ["zeleno", "#34c759", "#143d20"],
  ];
  lampe.forEach(([ime, upaljena, ugasena], i) => {
    g.beginPath();
    g.arc(20, 18 + i * 30, 11, 0, 2 * Math.PI);
    g.fillStyle = ime === upaljeno ? upaljena : ugasena;
    g.fill();
  });
  return c;
}

export interface TekstureZnakova {
  znak: Record<VrstaZnaka, Texture>;
  semafor: Record<Svjetlo, Texture>;
  unisti(): void;
}

export function tekstureZnakova(): TekstureZnakova {
  const vrste: VrstaZnaka[] = [
    "stop",
    "ustupi",
    "zabranaUlaska",
    "kruzniTok",
    "no_left_turn",
    "no_right_turn",
    "no_straight_on",
    "no_u_turn",
    "only_left_turn",
    "only_right_turn",
    "only_straight_on",
  ];
  const znakT = Object.fromEntries(vrste.map((v) => [v, Texture.from(znak(v))])) as Record<VrstaZnaka, Texture>;
  const semaforT = {
    crveno: Texture.from(glavaSemafora("crveno")),
    zuto: Texture.from(glavaSemafora("zuto")),
    zeleno: Texture.from(glavaSemafora("zeleno")),
  };
  return {
    znak: znakT,
    semafor: semaforT,
    unisti() {
      for (const t of [...Object.values(znakT), ...Object.values(semaforT)]) t.destroy(true);
    },
  };
}
