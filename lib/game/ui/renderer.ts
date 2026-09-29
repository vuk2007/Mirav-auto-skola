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
  /**
   * Posljednji nacrtani kadar kao PNG (`data:` adresa) — za poređenje dva
   * renderera piksel po piksel. Zove se odmah poslije `draw`.
   */
  snimak(): Promise<string>;
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
    snimak() {
      return Promise.resolve(canvas.toDataURL("image/png"));
    },
    destroy() {
      // Canvas 2D nema ništa svoje da oslobodi.
    },
  };
}

/** Čime se crta: Canvas 2D ili WebGL (PixiJS). */
export type VrstaRenderera = "canvas" | "pixi";

/**
 * Renderer za platno.
 *
 * Pixi se uvozi tek ovdje, dinamički: stranice koje ga ne traže (kviz, ispitni
 * ekrani) ne učitavaju ni bajt njega. Ako WebGL nije dostupan, vraća se Canvas
 * 2D — igra se ne smije prekinuti zbog načina crtanja.
 */
export async function napraviRenderer(
  vrsta: VrstaRenderera,
  canvas: HTMLCanvasElement,
  opcije: { zaSnimak?: boolean } = {},
): Promise<{ renderer: Renderer; vrsta: VrstaRenderera } | null> {
  if (vrsta === "pixi") {
    const { createPixiRenderer } = await import("./pixiRenderer");
    const r = await createPixiRenderer(canvas, opcije);
    if (r) return { renderer: r, vrsta: "pixi" };
  }
  const r = createCanvasRenderer(canvas);
  return r ? { renderer: r, vrsta: "canvas" } : null;
}
