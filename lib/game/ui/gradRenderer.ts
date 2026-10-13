import {
  AlphaFilter,
  Application,
  Container,
  earcut,
  Geometry,
  Graphics,
  Mesh,
  Shader,
  Sprite,
  Texture,
  UniformGroup,
} from "pixi.js";
import {
  CAR_LENGTH,
  CAR_WIDTH,
  GRAD_2_5D,
  GRAD_2_5D_NAJVISE,
  GRAD_FAROVI_DUZINA,
  GRAD_FAROVI_UGAO,
  GRAD_KISA_BRZINA,
  GRAD_KISA_KAPI,
  GRAD_LAMPA_SVJETLO,
  GRAD_PROZORI_UPALJENI,
  GRAD_KOMADA_NAJVISE,
  GRAD_MEDJUOSOVINSKO,
  GRAD_PROZOR_PIKSELA,
  GRAD_PROZOR_RAZMAK,
  GRAD_SJENKA_ALFA,
  GRAD_SPRAT,
  GRAD_SEMAFOR_VELICINA,
  GRAD_SEMAFOR_VISINA,
  GRAD_TROTOAR,
  GRAD_PJ_CRTEZ,
  GRAD_ZEBRA_VRSTE,
  GRAD_ZNAK_NAJMANJE_PX,
  GRAD_ZNAK_VELICINA,
  GRAD_ZNAK_VISINA,
} from "../sim/config";
import type { Point } from "../sim/types";
import type { Paket } from "../grad/paket";
import { geometrijaDekora, type BojeDekora } from "../grad/dekor";
import { svjetlo, zelenaStrelica, type Raskrsnice } from "../grad/raskrsnica";
import { svjetloZaVozila, type PjesackiSemafor } from "../grad/pjesackiSemafor";
import type { Produzeci } from "../grad/linije";
import type { Temena } from "../grad/temena";
import type { CrtezPravila, Semafor, Znak } from "../grad/znakovi";
import { tekstureZnakova } from "./tekstureZnakova";
import { zmigavacSvijetli } from "./zmigavac";
import { krajeviLinija, linijeIvice, natpisiBusa, ogradaZatvorene, streliceIvice, zebra, type Poligon } from "../grad/oznake";
import type { Povrsina } from "../grad/povrsina";
import {
  geometrijaSjenki,
  geometrijaZgrada,
  zgrada,
  type Palete,
  type Zgrada,
  type ZonaPalete,
} from "../grad/zgrade";

/**
 * Crtanje grada u razmjeri 1:1 na WebGL-u (faza 6, stavke 3 i 4): površine,
 * voda, ulice sa trotoarom, i zgrade u lažnom 2.5D kao u GTA 1/2 — zidovi i
 * krov koji se naginju od sredine ekrana, detalji na krovu, sjenke.
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

/** Boje tla i ulica. Boje zgrada su podatak, po zoni (`palete.json`). */
const BOJE = {
  tlo: "#e8e4dc",
  trotoar: "#d3cec4",
  asfalt: "#8a8984",
  pjesacka: "#cfc6b6",
  oznaka: "#f2f0ea",
  /** Ograda gradilišta (zatvorena ulica iz editora). */
  ogradaCrvena: "#c8102e",
  voda: "#9cc7e6",
  igrac: "#2f6fd0",
} as const;

/** Boje drugih vozila — prigušene, da se plavi auto igrača izdvaja. */
const BOJE_VOZILA: readonly string[] = ["#e9e6df", "#3b3d42", "#9aa0a6", "#a33a32", "#c9b48a", "#4f6b4a", "#6b5a7a", "#d7d3c8"];

/** Odjeća pješaka (stavka 8) — po pješaku jedna. */
const BOJE_PJESAKA: readonly string[] = ["#b5473a", "#2f5f8a", "#4a7a4f", "#7d5a8c", "#c7913a", "#4b5058", "#a8566f", "#3f8582"];
const KOSA_PJESAKA: readonly string[] = ["#2b2118", "#5a3b22", "#1c1c1c", "#8a6a3d"];
const KOZA_PJESAKA = "#d9b08c";

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

const TROTOAR = GRAD_TROTOAR;

/**
 * Lažni 2.5D: teme na visini `h` se pomjera od sredine ekrana (`uKamera`, u
 * metrima svijeta) za `h × uFaktor` puta svoju udaljenost od nje — što je
 * zgrada viša i dalje od sredine, to se više nagne. Tlo (`h = 0`) stoji.
 */
const VERTEX_2_5D = `
in vec2 aPosition;
in float aVisina;
in vec3 aBoja;
in float aZid;
in float aSjeme;
out vec3 vBoja;
out float vZid;
out float vVisina;
out float vSjeme;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform vec2 uKamera;
uniform float uFaktor;
uniform float uNajvise;
void main() {
  float k = min(aVisina * uFaktor, uNajvise);
  vec2 p = aPosition + (aPosition - uKamera) * k;
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(p, 1.0)).xy, 0.0, 1.0);
  vBoja = aBoja;
  vZid = aZid;
  vVisina = aVisina;
  vSjeme = aSjeme;
}
`;
/**
 * Prozori: na zidu (`vZid ≥ 0`) pravougaonici u mreži sprat × razmak prozora.
 * Kad je sprat na ekranu sitan, prozori blijede (`uProzori`), da se iz daleka
 * ne pretvore u šum.
 *
 * Doba dana je nijansa sloja (`tint`), koju Pixi predaje kao `uColor`: sve se
 * množi njome. Upaljen prozor (dio `uUpaljeno`, po sjemenu zgrade, sprata i
 * kolone) svijetli sam — njega nijansa ne tamni.
 */
const FRAGMENT_2_5D = `
in vec3 vBoja;
in float vZid;
in float vVisina;
in float vSjeme;
out vec4 finalColor;
uniform vec4 uColor;
uniform float uSprat;
uniform float uRazmak;
uniform float uProzori;
uniform float uUpaljeno;
uniform vec3 uBojaProzora;
void main() {
  vec3 c = vBoja * uColor.rgb;
  if (vZid >= 0.0) {
    float sprat = fract(vVisina / uSprat);
    float kolona = fract(vZid / uRazmak);
    float prozor = step(0.38, sprat) * step(sprat, 0.82) * step(0.22, kolona) * step(kolona, 0.78);
    c = mix(c, vec3(0.28, 0.34, 0.42) * uColor.rgb, prozor * 0.6 * uProzori);
    vec3 celija = vec3(floor(vZid / uRazmak), floor(vVisina / uSprat), vSjeme * 997.0);
    float h = fract(sin(dot(celija, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    c = mix(c, uBojaProzora, prozor * step(h, uUpaljeno) * uProzori);
  }
  finalColor = vec4(c, uColor.a);
}
`;

/** Nijanse grada po dobu dana i vremenu, i boje svjetala (`palete.json`). */
export interface BojeOsvjetljenja {
  dan: string;
  sumrak: string;
  noc: string;
  kisa: string;
  kisaNoc: string;
  prozor: string;
  lampa: string;
  farovi: string;
  stop: string;
}

/** Izgled zgrada: palete i zone iz podataka. */
export interface IzgledGrada {
  palete: Palete & { dekor: BojeDekora; osvjetljenje: BojeOsvjetljenja };
  zone: ZonaPalete[];
}

export type DobaDana = "dan" | "sumrak" | "noc";

/** Doba dana i vrijeme koje se crta; `sekunde` pokreću kišu. */
export interface Osvjetljenje {
  doba: DobaDana;
  kisa: boolean;
  sekunde: number;
}

/** Proizvod dvije boje `#rrggbb` — kiša u sumrak je sumrak pod oblakom. */
function pomnozi(a: string, b: string): number {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  let c = 0;
  for (const pomak of [16, 8, 0]) c |= Math.round((((x >> pomak) & 255) * ((y >> pomak) & 255)) / 255) << pomak;
  return c;
}

/** `#rrggbb` u tri broja 0–1 — za uniformu shadera. */
function rgb01(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

/**
 * Svjetlost, jednom po crtaču: bijela u središtu (`cx`, u pikselima od lijeve
 * ivice teksture od 128), providna na ivici. Lampa ima središte u sredini;
 * snop farova na lijevoj ivici — najjači tik ispred haube, pa blijedi naprijed.
 */
function teksturaSjaja(cx = 64): Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(cx, 64, 0, cx, 64, 128 - cx);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.45, "rgba(255,255,255,0.45)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  if (cx !== 64) {
    // Snop blijedi i poprijeko, da nema tvrdih bočnih ivica.
    const poprijeko = g.createLinearGradient(0, 0, 0, 128);
    poprijeko.addColorStop(0, "rgba(0,0,0,0)");
    poprijeko.addColorStop(0.5, "rgba(0,0,0,1)");
    poprijeko.addColorStop(1, "rgba(0,0,0,0)");
    g.globalCompositeOperation = "destination-in";
    g.fillStyle = poprijeko;
    g.fillRect(0, 0, 128, 128);
  }
  return Texture.from(c);
}

/**
 * Koliko metara van kadra tile još mora da se crta — visoka zgrada iza ivice
 * kadra naginje se u njega.
 */
const NAGIB_REZERVA = 40;

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

/** Pravila raskrsnica koja se crtaju — isti model po kojem se sudi. */
export interface PravilaZaCrtanje {
  raskrsnice: Raskrsnice;
  crtez: CrtezPravila;
  /** Produžeci ivica do raskrsnica i promjena traka — za pune linije pred raskrsnicom (editor). */
  produzeci?: Produzeci;
  /** Pješački semafori na sredini ulice (stavka 8) — njihovo svjetlo za vozila. */
  pjesackiSemafori?: readonly PjesackiSemafor[];
}

export interface GradScena {
  kadar: GradKadar;
  /** Vrijeme simulacije [s] — po njemu rade semafori. */
  simT: number;
  osvjetljenje: Osvjetljenje;
  /** Drugi vozači (stavka 7): gdje su, kuda gledaju, boja (indeks), kočnica, žmigavac. */
  vozila?: readonly {
    pos: Point;
    heading: Point;
    boja: number;
    koci: boolean;
    zmigavac: "left" | "right" | null;
  }[];
  /**
   * Pješaci (stavka 8): gdje su, kuda gledaju, boja odjeće (indeks), pređeni
   * put (korak ruku) i da li stoje.
   */
  pjesaci?: readonly { pos: Point; ugao: number; boja: number; korak: number; stoji: boolean }[];
  /**
   * Svjetla za pješake na prelazima sa semaforom (stavka 8), na oba kraja
   * prelaza: zeleno, trepćuće zeleno (završavaju) ili crveno.
   */
  pjesackaSvjetla?: readonly { x: number; y: number; stanje: "zeleno" | "zavrsi" | "crveno" }[];
  /** Auto igrača; `null` u editoru — grad bez auta. */
  igrac: {
    pos: Point;
    heading: Point;
    koci: boolean;
    /** Upaljena bijela svjetla za vožnju unazad. */
    rikverc: boolean;
    /** Ugao prednjih točkova [rad], pozitivno udesno — da se vidi šta volan radi. */
    tocak: number;
    /** Upaljen žmigavac — trepće na uglovima auta. */
    zmigavac: "left" | "right" | null;
  } | null;
}

export interface GradRenderer {
  resize(cssW: number, cssH: number, dpr: number): void;
  draw(scena: GradScena): void;
  /** Koliko je tile-ova sagrađeno i koliko ih se vidi — za dev preklop. */
  stanje(): { sagradjeno: number; vidljivo: number };
  /**
   * Novi svijet (editor: poslije svake izmjene) bez novog WebGL konteksta:
   * sagrađeni tile-ovi se ruše i grade ponovo kad zatrebaju.
   */
  zamijeni(paket: Paket, povrsina: Povrsina, izgled: IzgledGrada, pravila: PravilaZaCrtanje): void;
  destroy(): void;
}

interface Tile {
  okvir: Okvir;
  zgrade: [number, number];
  objekti: [number, number];
  povrsine: [number, number];
  linije: [number, number];
  ivice: number[];
  uglovi: number[];
  pune: number[];
  isprekidane: number[];
  znakovi: number[];
  semafori: number[];
}

interface Sagradjen {
  slojevi: Container[];
  vidjen: number;
  /** Znakovi i semafori tile-a: sprite, i gdje mu je podnožje. */
  znakovi: { sprite: Sprite; z: Znak }[];
  semafori: { sprite: Sprite; sjaj: Sprite; sem: Semafor }[];
}

export async function createGradRenderer(
  canvas: HTMLCanvasElement,
  paket0: Paket,
  povrsina0: Povrsina,
  izgled0: IzgledGrada,
  pravila0: PravilaZaCrtanje,
): Promise<GradRenderer | null> {
  // Svijet koji se crta — editor ga mijenja (`zamijeni`), igra nikad.
  let paket = paket0;
  let povrsina = povrsina0;
  let mreza = povrsina.mreza;
  let izgled = izgled0;
  let pravila = pravila0;
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

  let z = paket.zaglavlje;
  let n = paket.n;

  // ── tile-ovi: šta je u kojem i koliki im je okvir ─────────────────────────
  let tileovi: Tile[] = [];
  let crtez = pravila.crtez;
  const tileZa = (x: number, y: number) => {
    const tx = Math.min(z.tileovaX - 1, Math.max(0, Math.floor((x - z.okvir.minX) / z.tile)));
    const ty = Math.min(z.tileovaY - 1, Math.max(0, Math.floor((y - z.okvir.minY) / z.tile)));
    return ty * z.tileovaX + tx;
  };
  const indeksiraj = () => {
    z = paket.zaglavlje;
    n = paket.n;
    crtez = pravila.crtez;
    tileovi = [];
    const brojTileova = z.tileovaX * z.tileovaY;
    const opseg = (od: Uint32Array, t: number): [number, number] => [od[t]!, od[t + 1]!];
    for (let t = 0; t < brojTileova; t++) {
      tileovi.push({
        okvir: prazanOkvir(),
        zgrade: opseg(n.zgTileOd, t),
        objekti: opseg(n.obTileOd, t),
        povrsine: opseg(n.pvTileOd, t),
        linije: opseg(n.lnTileOd, t),
        ivice: [],
        uglovi: [],
        pune: [],
        isprekidane: [],
        znakovi: [],
        semafori: [],
      });
    }
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
    // Pravila raskrsnica: linije, znakovi i semafori po tile-u, po prvoj tački.
    crtez.pune.forEach((p, i) => tileovi[tileZa(p[0]!.x, p[0]!.y)]!.pune.push(i));
    crtez.isprekidane.forEach((p, i) => tileovi[tileZa(p[0]!.x, p[0]!.y)]!.isprekidane.push(i));
    crtez.znakovi.forEach((zn, i) => {
      const t = tileovi[tileZa(zn.x, zn.y)]!;
      t.znakovi.push(i);
      prosiri(t.okvir, zn.x, zn.y, 2);
    });
    crtez.semafori.forEach((sm, i) => {
      const t = tileovi[tileZa(sm.x, sm.y)]!;
      t.semafori.push(i);
      prosiri(t.okvir, sm.x, sm.y, 2);
    });
    odsjeci = krajeviLinija(mreza);
    vrstaPrelaza = z.vrsteObjekata.indexOf("crossing");
    zebraKodovi = new Set(GRAD_ZEBRA_VRSTE.map((v) => z.stringovi.indexOf(v)).filter((k) => k >= 0));
  };
  // Oznake na kolovozu: linije staju pred raskrsnicom; prelazi su objekti paketa.
  let odsjeci: Float32Array = new Float32Array(0);
  let vrstaPrelaza = -1;
  let zebraKodovi = new Set<number>();
  indeksiraj();

  // ── slojevi ───────────────────────────────────────────────────────────────
  const svijet = new Container();
  const sPovrsine = new Container();
  const sVoda = new Container();
  const sTrotoari = new Container();
  const sUlice = new Container();
  const sOznake = new Container();
  const sIznad = new Container();
  // Sjenke se crtaju punom crnom, a providnost dobija cijeli sloj odjednom —
  // tako preklop dvije sjenke nije tamniji od jedne.
  const sSjene = new Container();
  sSjene.filters = [new AlphaFilter({ alpha: GRAD_SJENKA_ALFA })];
  // Dekor (drveće, rasvjeta, parkirani auti) ide ispod zgrada: visoka zgrada
  // se naginje preko stabla, a ne obrnuto.
  const sDekor = new Container();
  const sZgrade = new Container();
  // Znakovi i semafori iznad zgrada: moraju se vidjeti, kao ikone u GTA.
  const sZnakovi = new Container();
  const stubovi = new Graphics();
  sZnakovi.addChild(stubovi);
  const teksture = tekstureZnakova();
  const dinamika = new Graphics();
  // Svjetla (lampe, farovi) se sabiraju sa onim ispod (`add`), i ne tamne:
  // idu iznad tla i oznaka, a ispod dekora i zgrada — svijetli ulica, ne krov.
  const sSvjetla = new Container();
  sSvjetla.blendMode = "add";
  const farovi = new Graphics();
  sSvjetla.addChild(farovi);
  // Kiša je preko ekrana, ne u svijetu: kapi ne rotiraju sa kamerom.
  const kisa = new Graphics();
  const sjaj = teksturaSjaja();
  const boje = izgled.palete.osvjetljenje;
  const tSnop = teksturaSjaja(0);
  const snop = new Sprite(tSnop);
  snop.anchor.set(0, 0.5);
  snop.tint = boje.farovi;
  sSvjetla.addChild(snop);
  svijet.addChild(sPovrsine, sVoda, sTrotoari, sUlice, sOznake, sSvjetla, sIznad, sSjene, sDekor, sZgrade, sZnakovi, dinamika);
  /** Slojevi koje doba dana tamni (sve osim svjetala i sjenki). */
  const osvijetljeni: Container[] = [sPovrsine, sVoda, sTrotoari, sUlice, sOznake, sIznad, sDekor, sZgrade, sZnakovi, dinamika];
  const sjenkaFilter = sSjene.filters![0] as AlphaFilter;


  const uniforme = new UniformGroup({
    uKamera: { value: new Float32Array(2), type: "vec2<f32>" },
    uFaktor: { value: 0, type: "f32" },
    uNajvise: { value: GRAD_2_5D_NAJVISE, type: "f32" },
    uSprat: { value: GRAD_SPRAT, type: "f32" },
    uRazmak: { value: GRAD_PROZOR_RAZMAK, type: "f32" },
    uProzori: { value: 1, type: "f32" },
    uUpaljeno: { value: 0, type: "f32" },
    uBojaProzora: { value: new Float32Array(rgb01(boje.prozor)), type: "vec3<f32>" },
  });
  const shader = Shader.from({
    gl: { vertex: VERTEX_2_5D, fragment: FRAGMENT_2_5D, name: "grad-2-5d" },
    resources: { gradUniforme: uniforme },
  });
  const triangulisi = (ravno: number[]) => earcut(ravno);
  const mesh = (t: Temena): Mesh<Geometry, Shader> | null => {
    if (t.indeksi.length === 0) return null;
    const geometry = new Geometry({
      attributes: {
        aPosition: { buffer: t.polozaj, format: "float32x2" },
        aVisina: { buffer: t.visina, format: "float32" },
        aBoja: { buffer: t.boja, format: "float32x3" },
        aZid: { buffer: t.zid, format: "float32" },
        aSjeme: { buffer: t.sjeme, format: "float32" },
      },
      indexBuffer: t.indeksi,
    });
    return new Mesh({ geometry, shader });
  };
  app.stage.addChild(svijet, kisa);

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
      // Ulica koju je editor uklonio (greška u OSM-u) ne postoji.
      if (iv.uklonjena) continue;
      linija(trotoari, iv.tacke);
      trotoari.stroke({ width: iv.sirina + 2 * TROTOAR, color: BOJE.trotoar, cap: "round", join: "round" });
      linija(ulice, iv.tacke);
      // Zatvorena ulica (gradilište) je asfalt, samo se u nju ne može.
      ulice.stroke({ width: iv.sirina, color: iv.vozna || iv.zatvorena ? BOJE.asfalt : BOJE.pjesacka, cap: "round", join: "round" });
    }
    // Zasječen ugao: trotoar prati kosi ivičnjak (linija širine dva trotoara,
    // čiju unutrašnju polovinu prekrije asfalt), a asfalt popuni trougao.
    for (const i of tile.uglovi) {
      const u = povrsina.uglovi[i]!;
      trotoari.moveTo(u.a.x, u.a.y).lineTo(u.b.x, u.b.y);
      trotoari.stroke({ width: 2 * TROTOAR, color: BOJE.trotoar, cap: "round" });
      ulice.poly([u.a.x, u.a.y, u.b.x, u.b.y, u.c.x, u.c.y]).fill(BOJE.asfalt);
    }
    const oznake = new Graphics();
    const oboji = (poligoni: Poligon[]) => {
      for (const p of poligoni) oznake.poly(p.flatMap((t) => [t.x, t.y]));
      if (poligoni.length > 0) oznake.fill(BOJE.oznaka);
    };
    const ograda = new Graphics();
    for (const i of tile.ivice) {
      const iv = mreza.ivice[i]!;
      if (iv.zatvorena) {
        const { crvene, bijele } = ogradaZatvorene(iv, odsjeci[2 * i]!, odsjeci[2 * i + 1]!);
        for (const p of crvene) ograda.poly(p.flatMap((t) => [t.x, t.y]));
        if (crvene.length) ograda.fill(BOJE.ogradaCrvena);
        for (const p of bijele) ograda.poly(p.flatMap((t) => [t.x, t.y]));
        if (bijele.length) ograda.fill("#ffffff");
      }
      if (!iv.vozna) continue;
      oboji(linijeIvice(iv, odsjeci[2 * i]!, odsjeci[2 * i + 1]!, pravila.produzeci));
      oboji(streliceIvice(iv, odsjeci[2 * i]!, odsjeci[2 * i + 1]!));
      oboji(natpisiBusa(iv, odsjeci[2 * i]!, odsjeci[2 * i + 1]!));
    }

    for (let o = tile.objekti[0]; o < tile.objekti[1]; o++) {
      if (n.obVrsta[o] !== vrstaPrelaza || !zebraKodovi.has(n.obPodatak[o]!)) continue;
      oboji(zebra(povrsina, n.obXY[2 * o]!, n.obXY[2 * o + 1]!));
    }
    oboji(tile.pune.map((i) => crtez.pune[i]!));
    oboji(tile.isprekidane.map((i) => crtez.isprekidane[i]!));

    // Znakovi i semafori: sprite-ovi koje `draw` svakog kadra uspravi prema
    // ekranu i nagne u 2.5D. Sjaj semafora ide u sloj svjetala.
    const znakoviC = new Container();
    const sjajeviC = new Container();
    const znakoviT = tile.znakovi.map((i) => {
      const z = crtez.znakovi[i]!;
      const sprite = new Sprite(teksture.znak(z.vrsta));
      sprite.anchor.set(0.5);
      znakoviC.addChild(sprite);
      return { sprite, z };
    });
    const semaforiT = tile.semafori.map((i) => {
      const sem = crtez.semafori[i]!;
      const sprite = new Sprite(sem.dopunska ? teksture.dopunska(false, sem.manevri ?? []) : teksture.semafor("crveno", sem.manevri));
      sprite.anchor.set(0.5);
      const sj = new Sprite(sjaj);
      sj.anchor.set(0.5);
      sj.width = sj.height = 5;
      sj.alpha = 0.8;
      znakoviC.addChild(sprite);
      sjajeviC.addChild(sj);
      return { sprite, sjaj: sj, sem };
    });

    const lista: Zgrada[] = [];
    for (let i = tile.zgrade[0]; i < tile.zgrade[1]; i++) {
      const z = zgrada(paket, i, povrsina, izgled.palete, izgled.zone);
      if (z) lista.push(z);
    }
    const zgrade = mesh(geometrijaZgrada(lista, triangulisi)) ?? new Container();
    const sjene = mesh(geometrijaSjenki(lista, triangulisi)) ?? new Container();
    const d = geometrijaDekora(
      {
        paket,
        povrsina,
        povrsine: tile.povrsine,
        linije: tile.linije,
        ivice: tile.ivice
          .filter((i) => mreza.ivice[i]!.vozna)
          .map((i) => ({ iv: mreza.ivice[i]!, odA: odsjeci[2 * i]!, odB: odsjeci[2 * i + 1]! })),
        zgrade: lista,
        boje: izgled.palete.dekor,
      },
      triangulisi,
    );
    const dekor = mesh(d.dekor) ?? new Container();
    const sjeneDekora = mesh(d.sjene) ?? new Container();
    const lampe = new Container();
    for (const l of d.lampe) {
      const sp = new Sprite(sjaj);
      sp.anchor.set(0.5);
      sp.position.set(l.x, l.y);
      sp.width = sp.height = 2 * GRAD_LAMPA_SVJETLO;
      sp.tint = boje.lampa;
      sp.alpha = 0.55;
      lampe.addChild(sp);
    }
    sPovrsine.addChild(povrsine);
    sVoda.addChild(voda);
    sTrotoari.addChild(trotoari);
    sUlice.addChild(ulice);
    sOznake.addChild(oznake, ograda);
    sIznad.addChild(iznad);
    sSjene.addChild(sjene, sjeneDekora);
    sDekor.addChild(dekor);
    sSvjetla.addChild(lampe);
    sZgrade.addChild(zgrade);
    sZnakovi.addChild(znakoviC);
    sSvjetla.addChild(sjajeviC);
    return {
      // Indeksi slojeva se koriste u `draw` (0 vidljivost, 12 sjaj) — nove na kraj.
      slojevi: [povrsine, voda, trotoari, ulice, oznake, iznad, sjene, sjeneDekora, dekor, zgrade, lampe, znakoviC, sjajeviC, ograda],
      vidjen: kadar,
      znakovi: znakoviT,
      semafori: semaforiT,
    };
  };

  const srusi = (t: number) => {
    const x = sagradjeni.get(t);
    if (!x) return;
    for (const g of x.slojevi) {
      // Mesh dijeli shader sa svima; ruši se samo njegova geometrija.
      if (g instanceof Mesh) g.geometry.destroy();
      g.destroy();
    }
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
      prosiri(o, k.wx + a * cos + b * sin, k.wy - a * sin + b * cos, NAGIB_REZERVA);
    }
    return o;
  };

  /** Tačka svijeta u sredini ekrana — od nje se zgrade naginju. */
  const sredinaEkrana = (k: GradKadar): Point => {
    const cos = Math.cos(k.rot);
    const sin = Math.sin(k.rot);
    const a = -(w / 2 - k.cx) / k.scale;
    const b = -(h / 2 - k.cy) / k.scale;
    return { x: k.wx + a * cos + b * sin, y: k.wy - a * sin + b * cos };
  };

  return {
    resize(cssW, cssH, dpr) {
      w = cssW;
      h = cssH;
      app.renderer.resize(cssW, cssH, dpr);
    },

    draw({ kadar: k, igrac, osvjetljenje: o, simT, vozila = [], pjesaci = [], pjesackaSvjetla = [] }) {
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

      // Nagib zgrada: od sredine ekrana, srazmjerno visini i obrnuto kadru —
      // udaljen kadar je kao kamera koja se podigla, pa se zgrade naginju manje.
      const sredina = sredinaEkrana(k);
      const u = uniforme.uniforms as { uKamera: Float32Array; uFaktor: number; uProzori: number; uUpaljeno: number };
      u.uKamera[0] = sredina.x;
      u.uKamera[1] = sredina.y;
      u.uFaktor = (GRAD_2_5D * 2 * k.scale) / Math.max(1, Math.min(w, h));
      // Sprat od `GRAD_PROZOR_PIKSELA` piksela i manje: prozora nema; duplo veći: puni.
      const spratPx = GRAD_SPRAT * k.scale;
      u.uProzori = Math.max(0, Math.min(1, spratPx / GRAD_PROZOR_PIKSELA - 1));

      // Doba dana i vrijeme: nijansa, sjenke samo uz sunce, svjetla kad je mrak.
      const nijansa =
        o.doba === "dan"
          ? o.kisa
            ? pomnozi(boje.kisa, "#ffffff")
            : pomnozi(boje.dan, "#ffffff")
          : o.doba === "sumrak"
            ? pomnozi(boje.sumrak, o.kisa ? boje.kisa : "#ffffff")
            : pomnozi(o.kisa ? boje.kisaNoc : boje.noc, "#ffffff");
      for (const c of osvijetljeni) c.tint = nijansa;
      // Golo tlo je pozadina crtača, van svih slojeva — i nju tamni doba dana.
      app.renderer.background.color = pomnozi(BOJE.tlo, "#" + nijansa.toString(16).padStart(6, "0"));
      const sunce = o.kisa ? 0 : o.doba === "dan" ? 1 : o.doba === "sumrak" ? 0.5 : 0;
      sSjene.visible = sunce > 0;
      sjenkaFilter.alpha = GRAD_SJENKA_ALFA * sunce;
      const mrak = o.doba !== "dan";
      sSvjetla.visible = mrak || o.kisa;
      for (const x of sagradjeni.values()) {
        x.slojevi[10]!.visible = x.slojevi[0]!.visible && mrak;
        x.slojevi[12]!.visible = x.slojevi[0]!.visible && mrak;
      }

      // Znakovi i semafori: uspravni prema ekranu, podignuti na stub i nagnuti
      // kao zgrade (isti račun kao u shaderu), i nikad sitniji od
      // `GRAD_ZNAK_NAJMANJE_PX` — znak koji se ne pročita ne može da se poštuje.
      stubovi.clear();
      const naNagibu = (x: number, y: number, h: number) => {
        const f = Math.min(h * u.uFaktor, GRAD_2_5D_NAJVISE);
        return { x: x + (x - sredina.x) * f, y: y + (y - sredina.y) * f };
      };
      const uspravno = -(k.rot + Math.PI);
      const velicina = (m: number) => Math.max(m, GRAD_ZNAK_NAJMANJE_PX / k.scale);
      for (const x of sagradjeni.values()) {
        if (!x.slojevi[0]!.visible) continue;
        for (const { sprite, z } of x.znakovi) {
          const v = naNagibu(z.x, z.y, GRAD_ZNAK_VISINA);
          stubovi.moveTo(z.x, z.y).lineTo(v.x, v.y);
          // Više znakova na istom stubu: svaki sljedeći iznad, prema vrhu ekrana.
          const vel = velicina(GRAD_ZNAK_VELICINA);
          const gore = vel * 1.05 * z.nivo;
          sprite.position.set(v.x + Math.sin(uspravno) * gore, v.y - Math.cos(uspravno) * gore);
          sprite.rotation = uspravno;
          sprite.width = sprite.height = vel;
        }
        for (const { sprite, sjaj: sj, sem } of x.semafori) {
          const v = naNagibu(sem.x, sem.y, GRAD_SEMAFOR_VISINA);
          if (sem.pomak === 0) stubovi.moveTo(sem.x, sem.y).lineTo(v.x, v.y);
          const vis = velicina(GRAD_SEMAFOR_VELICINA);
          if (sem.pjesacki !== undefined) {
            // Pješački semafor na sredini ulice: svjetlo za vozila.
            const pj = pravila.pjesackiSemafori?.[sem.pjesacki];
            const stanje = pj ? svjetloZaVozila(pj, simT) : "crveno";
            const sir = (vis * 40) / 96;
            sprite.position.set(v.x, v.y);
            sprite.rotation = uspravno;
            sj.position.set(v.x, v.y);
            sprite.texture = teksture.semafor(stanje, null);
            sprite.height = vis;
            sprite.width = sir;
            sj.visible = true;
            sj.tint = stanje === "zeleno" ? "#34c759" : stanje === "zuto" ? "#ffcc00" : "#ff3b30";
            continue;
          }
          const rs = pravila.raskrsnice.lista[sem.raskrsnica]!;
          const sir = (vis * 40) / 96;
          // Glave na istom stubu jedna pored druge, udesno na ekranu.
          const px = v.x + Math.cos(uspravno) * sir * 1.1 * sem.pomak;
          const py = v.y + Math.sin(uspravno) * sir * 1.1 * sem.pomak;
          sprite.position.set(px, py);
          sprite.rotation = uspravno;
          sj.position.set(px, py);
          if (sem.dopunska) {
            // Zelena dopunska strelica: jedno sočivo, gori ili ne.
            const gori = (sem.manevri ?? []).some((m) => zelenaStrelica(rs, sem.krak, simT, m));
            sprite.texture = teksture.dopunska(gori, sem.manevri ?? []);
            sprite.width = sir;
            sprite.height = (sir * 36) / 40;
            sj.tint = "#34c759";
            sj.visible = gori;
            continue;
          }
          const stanje = svjetlo(rs, sem.krak, simT, sem.manevri?.[0] ?? null) ?? "crveno";
          sprite.texture = teksture.semafor(stanje, sem.manevri);
          sprite.height = vis;
          sprite.width = sir;
          sj.visible = true;
          sj.tint = stanje === "zeleno" ? "#34c759" : stanje === "zuto" ? "#ffcc00" : "#ff3b30";
        }
      }
      stubovi.stroke({ width: 0.12, color: "#4a4d52" });
      u.uUpaljeno = GRAD_PROZORI_UPALJENI[o.doba];

      /** Auto na `pos`: točkovi (kad je `tocak` zadat), karoserija, svjetla, žmigavac. */
      const nacrtajAuto = (
        pos: Point,
        heading: Point,
        boja: string,
        koci: boolean,
        rikverc: boolean,
        tocak: number | null,
        zmigavac: "left" | "right" | null,
      ) => {
        const ugao = Math.atan2(heading.y, heading.x);
        const cos = Math.cos(ugao);
        const sin = Math.sin(ugao);
        dinamika.setTransform(cos, sin, -sin, cos, pos.x, pos.y);
        if (tocak !== null) {
          // Prednji točkovi, ispod karoserije: vire sa strane kad su okrenuti.
          const osovina = GRAD_MEDJUOSOVINSKO / 2;
          const tc = Math.cos(tocak);
          const ts = Math.sin(tocak);
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
        }
        dinamika
          .roundRect(-CAR_LENGTH / 2, -CAR_WIDTH / 2, CAR_LENGTH, CAR_WIDTH, CAR_WIDTH * 0.25)
          .fill(boja)
          .stroke({ width: 0.08, color: "rgba(0,0,0,0.4)" });
        dinamika.rect(CAR_LENGTH * 0.1, -CAR_WIDTH * 0.34, CAR_LENGTH * 0.2, CAR_WIDTH * 0.68).fill("rgba(255,255,255,0.7)");
        // Zadnja svjetla: crvena kad se koči, bijela u rikvercu. U rikvercu kočnica
        // vozi unazad, pa crveno tada ne bi značilo ništa.
        const stop = rikverc ? "#ffffff" : koci ? "#ff3b30" : "rgba(0,0,0,0.35)";
        dinamika.rect(-CAR_LENGTH / 2, -CAR_WIDTH * 0.42, CAR_LENGTH * 0.1, CAR_WIDTH * 0.22).fill(stop);
        dinamika.rect(-CAR_LENGTH / 2, CAR_WIDTH * 0.2, CAR_LENGTH * 0.1, CAR_WIDTH * 0.22).fill(stop);
        // Žmigavac: narandžasti ugao sprijeda i pozadi, na strani koja je upaljena.
        if (zmigavac && zmigavacSvijetli(simT)) {
          const w = zmigavac === "left" ? -CAR_WIDTH / 2 : CAR_WIDTH / 2 - 0.3;
          dinamika.rect(CAR_LENGTH / 2 - 0.35, w, 0.35, 0.3).fill("#ffa21a");
          dinamika.rect(-CAR_LENGTH / 2, w, 0.35, 0.3).fill("#ffa21a");
        }
        dinamika.resetTransform();
      };

      dinamika.clear();
      farovi.clear();
      snop.visible = false;
      // Svjetla za pješake: mala glava semafora na ivičnjaku, uz prelaz.
      const trepce = Math.floor(simT * 2) % 2 === 0;
      for (const s of pjesackaSvjetla) {
        const boja = s.stanje === "crveno" ? "#ff3b30" : s.stanje === "zeleno" || trepce ? "#34c759" : "#1d2a1f";
        dinamika.circle(s.x, s.y, 0.45).fill("#2b2d31").circle(s.x, s.y, 0.3).fill(boja);
      }
      // Pješaci (stavka 8): odozgo — ramena, ruke koje se njišu u hodu, glava.
      // Veći od stvarnih (`GRAD_PJ_CRTEZ`), kao što su i ulice šire: inače
      // su na ekranu telefona tačka. Sudar se računa po ovom crtežu.
      const v = GRAD_PJ_CRTEZ;
      for (const p of pjesaci) {
        const c = Math.cos(p.ugao) * v;
        const s = Math.sin(p.ugao) * v;
        dinamika.setTransform(c, s, -s, c, p.pos.x, p.pos.y);
        const zamah = p.stoji ? 0 : Math.sin(p.korak * 4.5 / v) * 0.2;
        dinamika.circle(zamah, -0.3, 0.085).fill(KOZA_PJESAKA);
        dinamika.circle(-zamah, 0.3, 0.085).fill(KOZA_PJESAKA);
        dinamika.ellipse(0, 0, 0.17, 0.31).fill(BOJE_PJESAKA[p.boja % BOJE_PJESAKA.length]!).stroke({ width: 0.03, color: "rgba(0,0,0,0.35)" });
        dinamika.circle(0.02, 0, 0.13).fill(KOSA_PJESAKA[p.boja % KOSA_PJESAKA.length]!);
      }
      dinamika.resetTransform();
      // Drugi vozači (stavka 7): ista karoserija, njihova boja; kočnica i
      // žmigavac kao kod igrača, u mraku i kratak snop farova.
      for (const v of vozila) {
        nacrtajAuto(v.pos, v.heading, BOJE_VOZILA[v.boja % BOJE_VOZILA.length]!, v.koci, false, null, v.zmigavac);
        if (sSvjetla.visible) {
          const c = v.heading.x;
          const sn = v.heading.y;
          farovi.circle(v.pos.x + c * (CAR_LENGTH / 2 + 3), v.pos.y + sn * (CAR_LENGTH / 2 + 3), 3).fill({ color: boje.farovi, alpha: mrak ? 0.25 : 0.1 });
        }
      }
      if (igrac) {
        const ugao = Math.atan2(igrac.heading.y, igrac.heading.x);
        const cos = Math.cos(ugao);
        const sin = Math.sin(ugao);
        nacrtajAuto(igrac.pos, igrac.heading, BOJE.igrac, igrac.koci, igrac.rikverc, igrac.tocak, igrac.zmigavac);

        // Farovi: meki izduženi snop ispred auta (sjaj razvučen u elipsu), jači
        // u mraku nego po danu kad pada kiša. Upaljeni u mraku i po kiši, kao
        // što propis traži.
        snop.visible = sSvjetla.visible;
        if (sSvjetla.visible) {
          const d = GRAD_FAROVI_DUZINA;
          const naprijed = CAR_LENGTH / 2 - 0.3;
          snop.position.set(igrac.pos.x + cos * naprijed, igrac.pos.y + sin * naprijed);
          snop.rotation = ugao;
          snop.width = d;
          snop.height = 2 * Math.tan((GRAD_FAROVI_UGAO * Math.PI) / 180) * d;
          snop.alpha = mrak ? 0.7 : 0.25;
          if (igrac.koci && !igrac.rikverc) {
            const zx = igrac.pos.x - cos * (CAR_LENGTH / 2 + 1);
            const zy = igrac.pos.y - sin * (CAR_LENGTH / 2 + 1);
            farovi.circle(zx, zy, 2.2).fill({ color: boje.stop, alpha: 0.35 });
          }
        }

      }

      // Kiša: kose kapi preko ekrana, pomjeraju se sa vremenom.
      kisa.clear();
      if (o.kisa) {
        for (let i = 0; i < GRAD_KISA_KAPI; i++) {
          const a = Math.sin(i * 12.9898) * 43758.5453;
          const b = Math.sin(i * 78.233) * 12345.6789;
          const x = (((a - Math.floor(a)) * (w + 40) + o.sekunde * GRAD_KISA_BRZINA * 0.2) % (w + 40)) - 20;
          const y = (((b - Math.floor(b)) * (h + 40) + o.sekunde * GRAD_KISA_BRZINA) % (h + 40)) - 20;
          kisa.moveTo(x, y).lineTo(x - 3, y + 13);
        }
        kisa.stroke({ width: 1, color: "#d4dde9", alpha: 0.45 });
      }

      // Kamera: isto kao `px` u `draw.ts` — okretanje za `rot` i još pola kruga.
      svijet.position.set(k.cx, k.cy);
      svijet.pivot.set(k.wx, k.wy);
      svijet.rotation = k.rot + Math.PI;
      svijet.scale.set(k.scale);
      app.renderer.render(app.stage);
    },

    stanje: () => ({ sagradjeno: sagradjeni.size, vidljivo: vidljivih }),

    zamijeni(p, pov, izg, pr) {
      for (const t of [...sagradjeni.keys()]) srusi(t);
      paket = p;
      povrsina = pov;
      mreza = pov.mreza;
      izgled = izg;
      pravila = pr;
      indeksiraj();
    },

    destroy() {
      for (const t of [...sagradjeni.keys()]) srusi(t);
      shader.destroy();
      sjaj.destroy(true);
      tSnop.destroy(true);
      teksture.unisti();
      app.destroy({ removeView: false }, { children: true });
    },
  };
}
