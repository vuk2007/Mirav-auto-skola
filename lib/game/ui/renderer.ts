import { drawScene, type DrawOptions } from "./draw";
import type { Driver } from "./runner";

/**
 * Ono što crta scenu, bez obzira čime.
 *
 * Simulacija o crtanju ne zna ništa; petlja kadrova zna samo za ovo. Danas
 * postoje dvije izvedbe: Canvas 2D (`drawScene`), kojom se crta sve, i WebGL
 * (PixiJS) za otvoreni put, gdje je statičnog svijeta najviše. Obje dobijaju isto
 * stanje i iste opcije, i moraju dati istu sliku.
 */
export interface Renderer {
  /** Postavi veličinu platna u CSS pikselima; gustina piksela je `dpr`. */
  resize(cssW: number, cssH: number, dpr: number): void;
  draw(runner: Driver, opts: DrawOptions): void;
  destroy(): void;
}

/**
 * Najveća gustina piksela kojom se crta.
 *
 * Telefon zna imati i tri; slika je na dva već oštra, a svaki korak više je
 * dvostruko više piksela za popuniti.
 */
export const NAJVECI_DPR = 2;

export function dprUredjaja(): number {
  return Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, NAJVECI_DPR);
}

/** Canvas 2D: postojeće crtanje, samo iza zajedničkog interfejsa. */
export function createCanvasRenderer(canvas: HTMLCanvasElement): Renderer | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  let w = 0;
  let h = 0;
  return {
    resize(cssW, cssH, dpr) {
      w = cssW;
      h = cssH;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },
    draw(runner, opts) {
      drawScene(ctx, runner, w, h, opts);
    },
    destroy() {
      // Canvas 2D nema ništa svoje da oslobodi.
    },
  };
}
