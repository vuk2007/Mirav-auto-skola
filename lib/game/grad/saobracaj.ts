import {
  A_MAX,
  B_MAX,
  CAR_LENGTH,
  CAR_WIDTH,
  DT,
  GRAD_NPC_BOCNO,
  GRAD_NPC_CEKA_BRZINA,
  GRAD_NPC_CEKA_DO,
  GRAD_NPC_CILJ_DO,
  GRAD_NPC_CILJ_OD,
  GRAD_NPC_HORIZONT,
  GRAD_NPC_ISTA_TRAKA,
  GRAD_NPC_KOCENJE_UDIO,
  GRAD_NPC_NAJVISE,
  GRAD_NPC_NESTAJE,
  GRAD_NPC_POCETAK_OD,
  GRAD_NPC_POGLED,
  GRAD_NPC_POJAVA_DO,
  GRAD_NPC_POJAVA_OD,
  GRAD_NPC_POJAVA_RITAM,
  GRAD_NPC_POJAVA_SLOBODNO,
  GRAD_NPC_PRILAZ_SUKOBA,
  GRAD_NPC_PRESTROJ_POGLED,
  GRAD_NPC_PRESTROJ_RAZMAK,
  GRAD_NPC_RAZMAK,
  GRAD_NPC_REZERVA_LUKA,
  GRAD_NPC_REAKCIJA,
  GRAD_IGRAC_CEKA_PROLAZ,
  GRAD_IGRAC_KOLONA,
  GRAD_NPC_LANAC_CEKANJA,
  GRAD_NPC_REZERVA_PROLAZA,
  GRAD_BOT_REZERVA_PROLAZA,
  GRAD_NPC_SUKOB_RAZMAK,
  GRAD_NPC_UBRZANJE,
  GRAD_NPC_USKA,
  GRAD_NPC_A_ZVIJEZDA,
  GRAD_NPC_ZASTOJ,
  GRAD_NPC_ZASTOJ_KRECE,
  GRAD_NPC_ZAKLON,
  GRAD_NPC_ZAKLON_SUSRET,
  GRAD_NPC_GUSTINA_ZONE_PODRAZUMIJEVANO,
  GRAD_NPC_PO_GUSTINI_ZONE,
  GRAD_PARK_NAJVISE,
  GRAD_PARK_UDIO,
  GRAD_PARK_ZAKLON,
  GRAD_PRILAZ_DO,
  GRAD_PRESJECANJE,
  GRAD_PRVENSTVO_KOCENJE,
  GRAD_PRVENSTVO_TRAJE,
  GRAD_VOZAC_USPORENJE,
  GRAD_PJ_POLUPRECNIK,
  GRAD_PJ_NAMJERA_DO,
  GRAD_PJ_TIK_PRED_ZEBROM,
  GRAD_PJ_POJAVA_VOZILA,
  GRAD_PJ_PREKO_KRAJA,
  GRAD_PJ_PREDVIDJANJE,
  GRAD_STOP_ISPRED_ZEBRE,
  STOP_HOLD,
  STOP_MARGIN,
  YELLOW_COMMIT_TTC,
} from "../sim/config";
import { headingAt, pointAt, polygonsOverlap, rectCorners, rng } from "../sim/geometry";
import type { Point } from "../sim/types";
import { AUTO, planBota, ruta, ZA_BOTA, type Korak, type PlanBota, type ProlazPlana, type Vozilo } from "./botGrad";
import type { Putanja } from "./vozacGrad";
import type { Ivica, Manevar } from "./mreza";
import { koUstupa, kontrolaUcesnika, manevarKroz, sukobPutanja, type Sukob, type UcesnikPrednosti } from "./prednost";
import { doMjesta, mjestoNa, obidji, slobodno, uliceZaParkiranje, type MjestoParkiranja, type UlicaZaParkiranje } from "./parkiranje";
import { svjetlo, zelenaStrelica } from "./raskrsnica";
import type { SvijetGrada } from "./svijet";
import { pjesaciSaPrednoscu, udaraPjesaka, type Pjesaci } from "./pjesaci";
import { svjetloZaVozila } from "./pjesackiSemafor";
import { mozeMirnoStati, polovinaUlice, prelaziNaPutanji, tijeloNaZebri } from "./trotoari";

/**
 * Drugi učesnici u gradu (faza 6, stavka 7): vozila sa ciljem, ne tokovi po
 * ivici. Svako ima rutu (A* po ulicama) i plan vožnje kao savršeni bot — iste
 * trake, iste stop-linije, isti žmigavci — i vozi ga po istim pravilima:
 * staje na crveno i STOP, ustupa onome ko ima prednost (`prednost.ts`), drži
 * razmak do vozila ispred i ne ulazi u raskrsnicu iz koje ne može izaći.
 *
 * Vozilo ide tačno svojom putanjom (`s` duž nje), bez modela volana: drugi
 * vozači ne griješe, pa su deterministički i jeftini — 40 vozila u jednom
 * koraku je ispod milisekunde.
 *
 * Pojavljuju se u prstenu oko igrača, van onoga što se vidi, sa ciljem van
 * prozora (zadatak, odjeljak 5), i nestaju kad stignu ili se udalje. Dio njih
 * vozi do mjesta uz desni ivičnjak i tu parkira (`parkiranje.ts`); parkirani
 * auto stoji dok se igrač ne udalji. Koliko ih je: gustina zone u kojoj je
 * igrač × nivo × doba dana (`ciljniBroj`).
 *
 * Zastoj (zadatak, odjeljak 5): vozilo koje stoji duže od `GRAD_NPC_ZASTOJ`, a
 * ne čeka ni crveno ni nekoga ko vozi, zapisuje se; najstarije u zastoju
 * kreće. Svaki zastoj u fuzz testu je greška. Krug prvenstva (svako ima
 * nekoga sa desne) nije zastoj — po odluci korisnika kreće ko najduže čeka.
 */

/** Tijelo vozila u trenutku — ono što drugi vide. */
export interface Tijelo {
  id: number;
  x: number;
  y: number;
  /** Pravac [rad], `atan2(y, x)`. */
  ugao: number;
  v: number;
  duzina: number;
  sirina: number;
  /** Nivo ulice (most, tunel): vozila na različitim nivoima se ne vide. */
  nivo: number;
  /** Parkiran uz ivičnjak (stavka 7e): ne pomjera se. */
  parkiran?: boolean;
}

/** Zašto vozilo usporava ili stoji — za dijagnozu i za detektor zastoja. */
export type Razlog =
  | { vrsta: "slobodno" }
  | { vrsta: "crveno" }
  | { vrsta: "stop" }
  | { vrsta: "ustupa"; kome: number[] }
  | { vrsta: "izlaz"; kome: number }
  | { vrsta: "vozilo"; kome: number }
  /** Pješak: ima prednost na prelazu, ili je na putu (stavka 8). */
  | { vrsta: "pjesak"; kome: number }
  | { vrsta: "cilj" };

export interface Npc {
  id: number;
  plan: PlanBota;
  koraci: Korak[];
  s: number;
  v: number;
  /** Ubrzanje u zadnjem koraku [m/s²] — kočnica se vidi na autu. */
  a: number;
  x: number;
  y: number;
  ugao: number;
  /** Nivo ulice na kojoj je (most, tunel). */
  nivo: number;
  /** Kada se pojavilo [s] — „najstarije" u zastoju. */
  rodjen: number;
  /** Boja karoserije (indeks u paleti crteža). */
  boja: number;
  zmigavac: "left" | "right" | null;
  /** Stop-linije plana: koliko je stajao, prošao, odluka na žuto. */
  stajao: number[];
  prosao: boolean[];
  zutoStaje: (boolean | null)[];
  /** Vidio zeleno na prilazu liniji (kao sudija, do `GRAD_PRILAZ_DO`) — o žutom odlučuje samo tada. */
  vidioZeleno: boolean[];
  /** Zelena dopunska strelica gorjela u prošlom koraku; ugasila se dok je bio preblizu da stane (vidi `Bot`). */
  strelica: boolean[];
  poslijeStrelice: boolean[];
  /** Indeks tačke putanje od kojeg se gleda naprijed. */
  kursor: number;
  /** Prvi prolaz plana kroz koji još nije prošao. */
  prolaz: number;
  /** Prolaz pred čijim mjestom čekanja je vozilo (prvi u koji još nije ušlo). */
  cekaProlaz: number;
  /** Od kad čeka na tom mjestu [s]; `null` kad ne čeka. */
  cekaOd: number | null;
  razlog: Razlog;
  /** Koliko dugo stoji [s]. */
  stoji: number;
  /** Koliko dugo stoji bez opravdanja — ni crveno, ni STOP, ni neko ko vozi [s]. */
  bezRazloga: number;
  /** Do kad ne ustupa nikome — razrješava zastoj [s]. */
  forsiranDo: number;
  /** Putanja prolaza kroz raskrsnicu (od nešto prije ulaza do izlaza), po prolazu. */
  geometrija: ({ tacke: Point[]; s0: number } | undefined)[];
  /** Sukobi sa prolazima drugih: „mojProlaz:id:njegovProlaz". */
  sukobi: Map<string, Sukob | null>;
  /**
   * Vozilo kojim upravlja neko drugi — savršeni bot među vozilima (stavka
   * 7d). Ima plan kao i ostali, i drugi ga vide po njemu; saobraćaj za njega
   * donosi odluku (`odlukaV`, `razlog`), ali ga ne pomjera — položaj i brzinu
   * postavlja pravi auto (`postaviVanjsko`). Ne nestaje i ne broji se.
   */
  vanjski?: boolean;
  /** Kod vanjskog: brzina koju mu saobraćaj dozvoljava sada [m/s]. */
  odlukaV?: number;
  /** Od kad mu je igrač vozilo ispred [s]; `null` kad nije (vidi `GRAD_PRESJECANJE`). */
  igracIspredOd?: number | null;
  /** Kad je ušao u raskrsnicu prolaza (indeks u `plan.prolazi`) [s]. */
  usaoOd: Map<number, number>;
  /**
   * Kad je stvarno prošao mjesto čekanja te raskrsnice [s]. `usaoOd` je i
   * „ušao" kroz lanac (o raskrsnici tik iza prve odlučuje se pred prvom); po
   * ovom sudija zna ko je u raskrsnici bio prije igrača.
   */
  presaoLinijuOd: Map<number, number>;
  /** Mjesto uz ivičnjak na kojem parkira na kraju plana (stavka 7e). */
  mjesto?: MjestoParkiranja;
  /**
   * Pješački semafori na sredini ulice (stavka 8), po indeksu u
   * `plan.pjesacki`: vidio zeleno na prilazu, i odluka na žuto (`true` staje)
   * — kao kod stop-linija.
   */
  pjesackiZuto: Map<number, boolean | null>;
  pjesackiZeleno: Set<number>;
  /** Pješaci koje je vidio da čekaju na ivičnjaku: da li je tada mogao mirno stati (stavka 8). */
  namjere: Map<number, boolean>;
  /** Koliko dugo naglo koči zbog igrača, bez prekida [s] (`GRAD_PRVENSTVO_TRAJE`). */
  kociZbogIgraca?: number;
}

/** Zapis zastoja: ko, gdje, i kako je razriješen. */
export interface Zastoj {
  t: number;
  ucesnici: number[];
  x: number;
  y: number;
  razrijesen: "krenuo" | "uklonjen" | null;
}

export interface Metrika {
  pojavljeno: number;
  stiglo: number;
  /** Od onih koji su stigli: koliko je parkiralo uz ivičnjak. */
  parkiralo: number;
  udaljilo: number;
  /** Krugovi prvenstva razriješeni po tome ko najduže čeka (ispravno ponašanje, ne greška). */
  krugova: number;
  zastoja: number;
}

export interface Saobracaj {
  svijet: SvijetGrada;
  npc: Npc[];
  /** Vozila po id-ju, za tekući korak (vidi `cekaMene`). */
  poId?: Map<number, Npc>;
  t: number;
  sljedeciId: number;
  slucajno: () => number;
  zadnjaPojava: number;
  /** Ivice po kojima se vozi (pojava i cilj), sa sredinom. */
  ivice: { i: number; x: number; y: number }[];
  /** Pobjednik kruga prvenstva → članovi kruga kojima više ne ustupa. */
  krugovi: Map<number, Set<number>>;
  zastoji: Zastoj[];
  metrika: Metrika;
  /** Udio broja vozila zone [0–1]: nivo × doba dana (zonu dodaje `ciljniBroj`). */
  gustina: number;
  /**
   * Gustina saobraćaja van zona (0–3): `GRAD_NPC_GUSTINA_ZONE_PODRAZUMIJEVANO`;
   * fuzz i mjerilo postavljaju 3 — najviše vozila (`?debug=1&gustina=3`).
   */
  gustinaVanZona: number;
  /** Zone sa gustinom saobraćaja (editor), sa okvirom za brzu provjeru. */
  zoneGustine: { poligon: Point[]; minX: number; minY: number; maxX: number; maxY: number; gustina: number }[];
  /** Ulice na kojima se smije parkirati (stavka 7e). */
  uliceParkiranja: UlicaZaParkiranje[];
  /** Zauzeta mjesta uz ivičnjak: vozilo je na putu do njih, ili je parkirano. */
  mjesta: MjestoParkiranja[];
  /**
   * Oslobođena mjesta koja vozila još obilaze (pomak putanje ostaje): za izbor
   * novog mjesta su i dalje zauzeta — inače bi se naspram moglo parkirati, i
   * susretna vozila bi se oba izmakla ka sredini. Važe dok ima vozila sa id-jem
   * manjim od `doId` (ona su ga mogla obilaziti).
   */
  bivsaMjesta: (MjestoParkiranja & { doId: number })[];
  /** Prvo popunjavanje: vozila i blizu igrača. */
  popunjeno: boolean;
  /** Mogući prolazi igrača kroz raskrsnicu ispred (plan po izlazu), keš. */
  planoviIgraca: Map<string, PlanBota | null>;
  /** Od kad igrač čeka na liniji raskrsnice ispred [s]. */
  igracCekaOd: number | null;
  /** Nagla kočenja drugih zbog igrača — po njima sudija sudi oduzeto prvenstvo (stavka 7c). */
  kocenja: KocenjeZbogIgraca[];
  /** Pješaci (stavka 8): drugi vozači im ustupaju na prelazu i staju pred njima. */
  pjesaci: Pjesaci | null;
}

/** Kako igrač vozi — da mu drugi ustupe kad ima prednost (stavka 7c). */
export interface VoznjaIgraca {
  tijelo: Tijelo;
  /** Ivica i smjer na kojima sudija vidi igrača (van raskrsnice); `null` kad ne zna. */
  ivica: number | null;
  smjer: 1 | -1;
  zmigavac: "left" | "right" | null;
  /**
   * Traka u prstenu dvotračnog kružnog toka koju je sudija zadnju zabilježio
   * (`Sudija.prsten`), ili `null`. Pred izlazom auto već prelazi ka spoljnoj,
   * pa se ne gleda trenutni položaj.
   */
  trakaUPrstenu?: "unutra" | "spolja" | null;
}

/** Drugi vozač je naglo kočio zbog igrača: kad, u kojoj raskrsnici, i kako je prolazio. */
export interface KocenjeZbogIgraca {
  id: number;
  t: number;
  r: number;
  ucesnik: UcesnikPrednosti;
  usao: boolean;
  /** Kad je to vozilo ušlo u raskrsnicu [s]; `null` kad nije. */
  usaoOd: number | null;
}

/** Id igrača među učesnicima. */
export const IGRAC = 0;

/**
 * Ulice kojima drugi vozači idu: kao bot, osim uskih dvosmjernih (OSM
 * `lanes=1`, 4,5 m) — tu se dva auta ne mimoilaze, nego jedan čeka drugog;
 * tim ulicama vozi samo igrač.
 */
export const ZA_NPC = (iv: Ivica) => ZA_BOTA(iv) && !(iv.smjer === 0 && iv.sirina < GRAD_NPC_USKA);

export function noviSaobracaj(svijet: SvijetGrada, sjeme: number, gustina = 1): Saobracaj {
  const ivice = svijet.mreza.ivice
    .filter((iv) => ZA_NPC(iv) && iv.duzina > 30)
    .map((iv) => {
      const p = pointAt(iv.tacke, iv.cum, iv.duzina / 2);
      return { i: iv.i, x: p.x, y: p.y };
    });
  // Zone sa gustinom: posljednja koja sadrži tačku važi (overlay dolazi
  // poslije šablona).
  const zoneGustine = svijet.zone
    .filter((z) => z.trafficDensity !== null && z.poligon.length >= 3)
    .map((z) => {
      const poligon = z.poligon.map(([x, y]) => ({ x, y }));
      return {
        poligon,
        minX: Math.min(...poligon.map((t) => t.x)),
        minY: Math.min(...poligon.map((t) => t.y)),
        maxX: Math.max(...poligon.map((t) => t.x)),
        maxY: Math.max(...poligon.map((t) => t.y)),
        gustina: z.trafficDensity!,
      };
    });
  return {
    svijet,
    npc: [],
    t: 0,
    sljedeciId: 1,
    slucajno: rng(sjeme),
    zadnjaPojava: -Infinity,
    ivice,
    krugovi: new Map(),
    zastoji: [],
    metrika: { pojavljeno: 0, stiglo: 0, parkiralo: 0, udaljilo: 0, krugova: 0, zastoja: 0 },
    gustina,
    gustinaVanZona: GRAD_NPC_GUSTINA_ZONE_PODRAZUMIJEVANO,
    zoneGustine,
    uliceParkiranja: uliceZaParkiranje(svijet, ZA_NPC),
    mjesta: [],
    bivsaMjesta: [],
    popunjeno: false,
    planoviIgraca: new Map(),
    igracCekaOd: null,
    kocenja: [],
    pjesaci: null,
  };
}

// ── pomoćno ────────────────────────────────────────────────────────────────

/** Vrijeme do pređenih `d` metara iz brzine `v`, ubrzavajući `a` do `vMax` [s]. */
export function vrijemeDo(d: number, v: number, a: number, vMax: number): number {
  if (d <= 0) return 0;
  if (v >= vMax) return d / Math.max(v, 0.1);
  const tUbrz = (vMax - v) / a;
  const dUbrz = v * tUbrz + 0.5 * a * tUbrz * tUbrz;
  if (dUbrz >= d) return (-v + Math.sqrt(v * v + 2 * a * d)) / a;
  return tUbrz + (d - dUbrz) / vMax;
}

/** Brzina sa koje se stane na `d` metara, udobnim usporenjem [m/s]. */
const zaStati = (d: number) => (d <= 0.3 ? 0 : Math.sqrt(2 * GRAD_VOZAC_USPORENJE * (d - 0.3)));

/**
 * Sigurna brzina iza vozila koje ide `vl`, na razmaku `gap` (Krauss): ako
 * ono zakoči udobnim usporenjem, staje se iza njega na `GRAD_NPC_RAZMAK`.
 */
export function sigurnaBrzina(v: number, vl: number, gap: number): number {
  const g = gap - GRAD_NPC_RAZMAK;
  if (g <= 0) return 0;
  const b = GRAD_VOZAC_USPORENJE;
  const tau = GRAD_NPC_REAKCIJA;
  return Math.max(0, vl + (g - vl * tau) / ((v + vl) / (2 * b) + tau));
}

export function tijeloNpc(n: Npc): Tijelo {
  return { id: n.id, x: n.x, y: n.y, ugao: n.ugao, v: n.v, duzina: n.plan.vozilo.duzina, sirina: n.plan.vozilo.sirina, nivo: n.nivo };
}

/** Parkirani auti (stavka 7e): tijela za sudar i za crtanje. */
export function parkirani(sb: Saobracaj): (Tijelo & { boja: number })[] {
  return sb.mjesta
    .filter((z) => z.parkirano)
    .map((z) => ({ id: z.id, x: z.x, y: z.y, ugao: Math.atan2(z.hy, z.hx), v: 0, duzina: CAR_LENGTH, sirina: CAR_WIDTH, nivo: 0, parkiran: true, boja: z.boja }));
}

function postaviPozu(n: Npc): void {
  const put = n.plan.put;
  const p = pointAt(put.tacke, put.cum, n.s);
  const h = headingAt(put.tacke, put.cum, Math.min(n.s, put.duzina));
  n.x = p.x;
  n.y = p.y;
  n.ugao = Math.atan2(h.y, h.x);
  let i = n.kursor;
  while (i + 1 < put.cum.length && put.cum[i + 1]! <= n.s) i++;
  n.nivo = n.plan.nivoi[i] ?? 0;
}

/** Najveća brzina koju plan dozvoljava sada: ograničenje i krivina ispred, uz udobno usporenje. */
function dozvoljena(n: Npc): number {
  const { cum } = n.plan.put;
  while (n.kursor + 1 < cum.length && cum[n.kursor + 1]! < n.s - 2) n.kursor++;
  let v = Infinity;
  for (let i = n.kursor; i < cum.length; i++) {
    const d = cum[i]! - n.s;
    if (d > 80) break;
    v = Math.min(v, Math.sqrt(n.plan.brzine[i]! ** 2 + 2 * GRAD_VOZAC_USPORENJE * Math.max(0, d)));
  }
  return Number.isFinite(v) ? v : 5;
}

/** Mjesto čekanja pred prolazom: stop-linija, ili ivica raskrsnice ispred zebre (`cekaD`). */
function mjestoCekanja(n: Npc, q: ProlazPlana): number {
  return q.linija >= 0 ? n.plan.linije[q.linija]!.s : q.cekanje;
}

/**
 * Vozilo je u raskrsnici prolaza `qi`: prošlo je mjesto čekanja — ili je u
 * prethodnoj raskrsnici, a mjesto čekanja ove je prije izlaza iz nje (tik
 * jedna uz drugu): za obje se odlučilo prije ulaska u prvu.
 */
function uRaskrsnici(n: Npc, qi: number): boolean {
  const q = n.plan.prolazi[qi]!;
  if (n.s > mjestoCekanja(n, q) + 0.5) return true;
  const prije = n.plan.prolazi[qi - 1];
  return !!prije && mjestoCekanja(n, q) <= prije.do_ && uRaskrsnici(n, qi - 1) && n.s <= prije.do_;
}

/**
 * Putanja prolaza: od `GRAD_NPC_PRILAZ_SUKOBA` prije mjesta čekanja do
 * potvrđenog izlaza — lijevi skretač na uzak krak zna preći preko prilazne
 * trake tog kraka i prije njegove linije.
 */
function geometrijaProlaza(n: Npc, qi: number): { tacke: Point[]; s0: number } {
  const g = n.geometrija[qi];
  if (g) return g;
  const q = n.plan.prolazi[qi]!;
  const { tacke, cum } = n.plan.put;
  const od = Math.max(0, Math.min(q.od - 3, mjestoCekanja(n, q) - GRAD_NPC_PRILAZ_SUKOBA));
  const izlaz: Point[] = [];
  let s0 = od;
  for (let i = 0; i < tacke.length; i++) {
    if (cum[i]! < od) continue;
    if (izlaz.length === 0) s0 = cum[i]!;
    izlaz.push(tacke[i]!);
    if (cum[i]! > q.do_) break;
  }
  const rez = { tacke: izlaz, s0 };
  n.geometrija[qi] = rez;
  return rez;
}

// ── ko je ispred ───────────────────────────────────────────────────────────

interface Prepreka {
  /** Od nosa do najbližeg dijela vozila, duž putanje [m]. */
  gap: number;
  /** Njegova brzina u mom pravcu [m/s]. */
  vl: number;
  id: number;
}

/**
 * Najbliže vozilo na putanji ispred: tijelo mu zalazi u traku kojom ću proći
 * (širina auta uz `GRAD_NPC_BOCNO`). Susretno vozilo u svojoj traci nije
 * prepreka; ono koje mi siječe put jeste — osim kad sam ja njemu bliže na
 * putu nego ono meni: tada prolazim prvi, a ono koči (inače bi oba stala).
 */
function naPutu(n: Npc, tijela: readonly Tijelo[], pogled: number): Prepreka | null {
  const { tacke, cum } = n.plan.put;
  const L = n.plan.vozilo.duzina;
  const W = n.plan.vozilo.sirina;
  const nos = n.s + L / 2;
  let naj: Prepreka | null = null;
  for (const o of tijela) {
    if (o.id === n.id) continue;
    const dx0 = o.x - n.x;
    const dy0 = o.y - n.y;
    if (dx0 * dx0 + dy0 * dy0 > (pogled + L + o.duzina) ** 2) continue;
    const ux = Math.cos(o.ugao);
    const uy = Math.sin(o.ugao);
    for (let i = n.kursor; i < tacke.length; i++) {
      const si = cum[i]!;
      if (si < nos - 1) continue;
      if (si > nos + pogled) break;
      // Most iznad ulice (ili ulica ispod mosta): to vozilo nije na mom putu.
      if ((n.plan.nivoi[i] ?? 0) !== o.nivo) continue;
      const P = tacke[i]!;
      const Q = tacke[Math.min(i + 1, tacke.length - 1)]!;
      const R = tacke[Math.max(i - 1, 0)]!;
      let hx = Q.x - R.x;
      let hy = Q.y - R.y;
      const hl = Math.hypot(hx, hy) || 1;
      hx /= hl;
      hy /= hl;
      const dx = o.x - P.x;
      const dy = o.y - P.y;
      const dl = dx * hx + dy * hy;
      const dw = -dx * hy + dy * hx;
      const cos = ux * hx + uy * hy;
      const sin = Math.abs(ux * hy - uy * hx);
      const duz = (o.duzina / 2) * Math.abs(cos) + (o.sirina / 2) * sin;
      const pop = (o.duzina / 2) * sin + (o.sirina / 2) * Math.abs(cos);
      if (Math.abs(dl) > duz + 1.2) continue;
      // Susretno vozilo: prepreka samo kad mu tijelo stvarno zalazi u moju
      // traku (bez rezerve — susretne trake su jedna uz drugu).
      // Parkirani se ne pomjera: rezerva kao u zaštiti (`GRAD_PARK_ZAKLON`).
      const bocno = cos < -0.7 ? W / 2 + pop + 0.1 : W / 2 + pop + (o.parkiran ? GRAD_PARK_ZAKLON : GRAD_NPC_BOCNO);
      if (Math.abs(dw) >= bocno) continue;
      const gap = si + dl - duz - nos;
      // Vozilo koje mi siječe put, a i ja sam njemu na putu: prolazi ono koje
      // je bliže drugom. Oba računaju iste dvije veličine istom formulom (duž
      // pravca vožnje svakog), pa koči tačno jedno. Igrač nije vođen — njemu
      // se uvijek ustupa.
      if (o.id !== IGRAC && Math.abs(cos) < 0.7) {
        const mx = Math.cos(n.ugao);
        const my = Math.sin(n.ugao);
        const rx = o.x - n.x;
        const ry = o.y - n.y;
        const mojDo = rx * mx + ry * my;
        const njegovDo = -(rx * ux + ry * uy);
        const preko = Math.abs(rx * uy - ry * ux);
        const mojaPop = (L / 2) * sin + (W / 2) * Math.abs(cos);
        if (njegovDo > 0 && preko < o.sirina / 2 + mojaPop + GRAD_NPC_BOCNO) {
          if (mojDo > njegovDo + 0.25 || (Math.abs(mojDo - njegovDo) <= 0.25 && n.id < o.id)) break;
        }
      }
      if (!naj || gap < naj.gap) naj = { gap, vl: Math.max(0, o.v * cos), id: o.id };
      break;
    }
  }
  return naj;
}

// ── raskrsnica: kome ustupam ───────────────────────────────────────────────

/** Učesnik u prolazu kroz raskrsnicu, kako ga vide drugi. */
export interface Dolazak {
  id: number;
  r: number;
  ucesnik: UcesnikPrednosti;
  /** Putanja prolaza i `s` njene prve tačke na putanji vozila. */
  tacke: Point[];
  s0: number;
  /** Sredina vozila na istoj putanji, i brzina. */
  s: number;
  v: number;
  /** Prošao mjesto čekanja — u raskrsnici je, ne staje više. */
  usao: boolean;
  /**
   * Kad je ušao [s]; `null` kad nije. Igraču se ne zna — kad je u njoj, kao
   * da je ušao prije svih (`-Infinity`): njega se uvijek propušta.
   */
  usaoOd: number | null;
  /** Stoji na mjestu čekanja, i od kada. */
  ceka: boolean;
  /** Stoji u koloni iza drugog vozila (nije na mjestu čekanja). */
  uKoloni: boolean;
  cekaOd: number | null;
  /** Najveće ubrzanje (igrač jače od drugih vozača) [m/s²]. */
  ubrzanje: number;
  /** Gdje je vozilo, i cijela njegova putanja (igrač je nema). */
  x: number;
  y: number;
  put: Putanja | null;
  /** Ključ prolaza za keš sukoba: id vozila i redni broj prolaza. */
  kljuc: string;
  /** Dimenzije vozila. */
  vozilo: Vozilo;
}

function dolazakNpc(sb: Saobracaj, n: Npc, qi: number, t: number): Dolazak {
  const q = n.plan.prolazi[qi]!;
  const r = sb.svijet.raskrsnice.lista[q.r]!;
  const m = sb.svijet.mreza;
  const manevar: Manevar = q.ulaz >= 0 && q.izlaz >= 0 ? manevarKroz(m, r, q.ulaz, q.izlaz) : "pravo";
  const g = geometrijaProlaza(n, qi);
  const cekanje = mjestoCekanja(n, q);
  const ceka = n.v < GRAD_NPC_CEKA_BRZINA && Math.abs(cekanje - n.s) < GRAD_NPC_CEKA_DO;
  let kontrola = q.ulaz >= 0 ? kontrolaUcesnika(r, q.ulaz, t, manevar) : "desna";
  // Odlučio je da prođe na žuto (ne može stati pred linijom): prolazi kao na
  // zeleno — inače bi onaj ko ustupa zelenom mislio da će on stati, i krenuo.
  if (kontrola === "zuto" && q.linija >= 0 && n.zutoStaje[q.linija] === false) kontrola = "zeleno";
  return {
    id: n.id,
    r: q.r,
    ucesnik: {
      ulaz: q.ulaz,
      izlaz: q.izlaz,
      manevar,
      kontrola,
      uPrstenu: q.uPrstenu,
      izUnutrasnje: q.izUnutrasnje,
      ukljucivanje: q.ulaz >= 0 && r.kraci[q.ulaz]!.klasa === "service",
    },
    tacke: g.tacke,
    s0: g.s0,
    s: n.s,
    v: n.v,
    usao: uRaskrsnici(n, qi),
    usaoOd: n.usaoOd.get(qi) ?? null,
    ceka,
    uKoloni: !ceka && n.v < GRAD_NPC_CEKA_BRZINA && n.razlog.vrsta === "vozilo",
    cekaOd: qi === n.cekaProlaz ? n.cekaOd : null,
    ubrzanje: GRAD_NPC_UBRZANJE,
    x: n.x,
    y: n.y,
    put: n.plan.put,
    kljuc: `${n.id}:${qi}`,
    vozilo: n.plan.vozilo,
  };
}

/** Da li je tačka (x, y) na putanji između `od` i `do_` [m], bočno do `GRAD_NPC_ISTA_TRAKA`. */
function naPutanjiIzmedju(put: Putanja, od: number, do_: number, x: number, y: number): boolean {
  const { tacke, cum } = put;
  const b2 = GRAD_NPC_ISTA_TRAKA * GRAD_NPC_ISTA_TRAKA;
  for (let i = 1; i < tacke.length; i++) {
    if (cum[i]! < od) continue;
    if (cum[i - 1]! > do_) break;
    const a = tacke[i - 1]!;
    const b = tacke[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l2)) : 0;
    if ((a.x + dx * t - x) ** 2 + (a.y + dy * t - y) ** 2 < b2) return true;
  }
  return false;
}

/**
 * Isti trak, jedan iza drugog: on je na mojoj putanji iza mene, ili sam ja na
 * njegovoj ispred njega. To nije pitanje prvenstva nego razmaka.
 */
function istaTraka(n: Npc, on: Dolazak): boolean {
  if (naPutanjiIzmedju(n.plan.put, n.s - 60, n.s, on.x, on.y)) return true;
  return !!on.put && naPutanjiIzmedju(on.put, on.s, on.s + 60, n.x, n.y);
}

function sukob(n: Npc, ja: Dolazak, on: Dolazak): Sukob | null {
  const k = `${ja.kljuc}|${on.kljuc}`;
  let x = n.sukobi.get(k);
  if (x === undefined) {
    const tijelo = (v: Vozilo) => ({ duzina: v.duzina + 2 * GRAD_NPC_BOCNO, sirina: v.sirina + 2 * GRAD_NPC_BOCNO });
    x = sukobPutanja(ja.tacke, on.tacke, GRAD_NPC_SUKOB_RAZMAK, tijelo(ja.vozilo), tijelo(on.vozilo));
    n.sukobi.set(k, x);
  }
  return x;
}

/**
 * Da li vozilo `od` čeka na `cilj` preko lanca u kojem je bar jedna karika
 * „vozilo ispred" ili „zatvoren izlaz" vozila koje stoji — `cilj` mu je
 * fizički na putu, pa ne može proći prije njega. Čist krug ustupanja (svako ustupa onome zdesna) nije
 * to: njega razrješava `odrediKrugove` (kreće ko najduže čeka). Razlozi su iz
 * prošlog koraka, pa redoslijed vozila ne utiče. Najviše
 * `GRAD_NPC_LANAC_CEKANJA` karika.
 */
function cekaMene(sb: Saobracaj, od: number, cilj: number): boolean {
  const poId = sb.poId;
  if (!poId) return false;
  // Stanje: vozilo i da li je put do njega imao kariku iza (vozilo/izlaz).
  let sloj: [number, boolean][] = [[od, false]];
  const vidjeni = new Set<string>([`${od}:0`]);
  for (let dubina = 0; dubina < GRAD_NPC_LANAC_CEKANJA && sloj.length > 0; dubina++) {
    const sljedeci: [number, boolean][] = [];
    for (const [id, iza] of sloj) {
      const o = poId.get(id);
      const r = o?.razlog;
      if (!o || !r) continue;
      // Fizička karika samo kad stoji: ko vozi iza nekoga još nije vezan za
      // njega (druga traka, skreće prije njega) — i prođe prije mene.
      const fizicki = (r.vrsta === "vozilo" || r.vrsta === "izlaz") && o.v < GRAD_NPC_CEKA_BRZINA;
      const kome = r.vrsta === "ustupa" ? r.kome : fizicki ? [r.kome] : [];
      for (const x of kome) {
        const dalje = iza || fizicki;
        if (x === cilj) {
          if (dalje) return true;
          continue;
        }
        const k = `${x}:${dalje ? 1 : 0}`;
        if (!vidjeni.has(k)) {
          vidjeni.add(k);
          sljedeci.push([x, dalje]);
        }
      }
    }
    sloj = sljedeci;
  }
  return false;
}

/**
 * Smije li vozilo `n` ući u raskrsnicu prolaza `ja`: kome od drugih u istoj
 * raskrsnici mora ustupiti. Ustupa se:
 *  - svakome ko je već u raskrsnici i još nije prošao mjesto sukoba (osim
 *    kad se samo spajamo, a on je ispred — iza njega se vozi);
 *  - onome ko ima prednost (`koUstupa`) i stiže do mjesta sukoba prije nego
 *    što bih ga ja prošao, uz `GRAD_NPC_REZERVA_PROLAZA` — ili već čeka na
 *    svojoj liniji (kreće čim on koga čeka prođe);
 *  - kad pravilo ne odlučuje: onome ko je prije stigao.
 */
function komeUstupa(
  sb: Saobracaj,
  n: Npc,
  ja: Dolazak,
  drugi: readonly Dolazak[],
  samoUnutra = false,
  /** Ja sam u raskrsnici od tada: ustupam samo onima koji su ušli prije mene. */
  ranijiOd: number | null = null,
): { kome: number[]; staniDo: number; unutra: boolean } {
  const m = sb.svijet.mreza;
  const r = sb.svijet.raskrsnice.lista[ja.r]!;
  // Moja dužina i širina; njegove su `on.vozilo`.
  const L = ja.vozilo.duzina;
  const W = ja.vozilo.sirina;
  const kome: number[] = [];
  // Mjesto sukoba prije linije: staje se prije njega (vidi `geometrijaProlaza`).
  let staniDo = Infinity;
  let unutra = false;
  const ustupi = (id: number, mojeMjesto: number) => {
    kome.push(id);
    staniDo = Math.min(staniDo, mojeMjesto - L / 2 - 1);
  };
  const krug = sb.krugovi.get(n.id);
  for (const on of drugi) {
    if (on.id === n.id || on.r !== ja.r) continue;
    // Pobjednik kruga ne gleda ostale iz kruga — osim onoga ko je ipak ušao
    // u raskrsnicu i vozi (nije stigao stati): njega i pobjednik propušta. Ko
    // je „u njoj" samo kroz lanac susjednih raskrsnica, a stoji, čeka pobjednika.
    if ((krug?.has(on.id) && !(on.usao && on.v >= GRAD_NPC_CEKA_BRZINA)) || sb.t < n.forsiranDo) continue;
    // On (preko lanca „čeka na") čeka mene: ne može proći prije mene, a
    // ustupanje bi zatvorilo krug.
    if (cekaMene(sb, on.id, n.id)) continue;
    const sk = sukob(n, ja, on);
    if (!sk || istaTraka(n, on)) continue;
    const mojeMjesto = ja.s0 + sk.sa;
    // On je pobjednik kruga u kojem sam i ja (vidi `odrediKrugove`): on ne
    // gleda mene, pa ga propuštam — i kad mi pravilo daje prednost.
    if (!ja.usao && sb.krugovi.get(on.id)?.has(n.id)) {
      ustupi(on.id, mojeMjesto);
      continue;
    }
    const njegovo = on.s0 + sk.sb;
    // Prošao je mjesto sukoba (zadnjim krajem, uz širinu auta) — kraj zone
    // sukoba, ne njen početak: putanje mogu ići jedna preko druge. Kod
    // spajanja se poslije mjesta spajanja vozi zajedno (vidi `spajanja`).
    const njegovKraj = on.s0 + (sk.spajanje ? sk.sb : sk.kb);
    if (on.s - on.vozilo.duzina / 2 > njegovKraj + W) continue;
    // Ja sam nosom već u zoni sukoba, a on do svog mjesta još nije stigao: on
    // čeka mene (meni ustupa, jer sam unutra), i moje stajanje ovdje samo
    // zatvara put — npr. uključio sam se u prsten, a iza mene je kolona.
    // Početak zone na njegovoj putanji (`pb`), ne njegova tačka mog prvog
    // dodira: oba gledaju početak zone duž svoje putanje — ne mogu oba biti
    // „unutra, a on ne".
    if (ja.usao && ja.s + L / 2 > mojeMjesto && on.s + on.vozilo.duzina / 2 < on.s0 + sk.pb) continue;
    if (on.usao) {
      if (ranijiOd !== null && !(on.usaoOd !== null && on.usaoOd < ranijiOd)) continue;
      // Spajanje, a on je bliže mjestu spajanja za više od dužine auta i
      // razmaka: iza njega se vozi (vidi `spajanja`), ne čeka se. Bliže od
      // toga — bok uz bok — čeka se na liniji dok ne prođe.
      if (sk.spajanje && mojeMjesto - ja.s - (njegovo - on.s) > (L + on.vozilo.duzina) / 2 + GRAD_NPC_RAZMAK) continue;
      // Spajanje, a i ja sam već u raskrsnici (linija iza mene, ne mogu na
      // njoj čekati) i bliži sam mjestu spajanja: ja sam ispred, on vozi iza
      // mene (`spajanja` mu me daje kao vozilo ispred). Da ustupim, stali bismo
      // obojica — on zbog mene, ja zbog njega.
      if (sk.spajanje && ja.usao && mojeMjesto - ja.s < njegovo - on.s) continue;
      ustupi(on.id, mojeMjesto);
      unutra = true;
      continue;
    }
    if (samoUnutra) continue;
    // U koloni iza drugog: ne stiže prije onoga ispred sebe — o njemu se
    // odlučuje (i on je ovdje).
    if (on.uKoloni) continue;
    const pr = koUstupa(m, r, ja.ucesnik, on.ucesnik);
    if (pr === "b") continue;
    // Duga zona sukoba (putanje idu jedna preko druge, npr. dva lijeva
    // skretanja između istih krakova): proći znači preći cijelu zonu prije
    // nego što on stigne na njen početak — ne samo prvi dodir.
    const dugaZona = !sk.spajanje && sk.ka - sk.sa > L + on.vozilo.sirina + 2;
    const stizeDo = dugaZona ? on.s0 + sk.pb : njegovo;
    const prodjemDo = dugaZona ? ja.s0 + sk.ka + on.vozilo.sirina : mojeMjesto + L / 2 + on.vozilo.sirina / 2;
    const stize = vrijemeDo(stizeDo - (on.vozilo.duzina / 2 + W / 2) - on.s, on.v, on.ubrzanje, Math.max(on.v, 14));
    const prodjem = vrijemeDo(prodjemDo - ja.s, ja.v, GRAD_NPC_UBRZANJE, Math.max(ja.v, 6));
    if (pr === null) {
      // Sa istog kraka: među njima nema prvenstva — idu jedan za drugim (vozilo
      // ispred). Tako i kad se o ovoj raskrsnici odlučuje unaprijed, iz
      // prethodne (tik jedna uz drugu), u koju ulaze sa različitih krakova.
      if (on.ucesnik.ulaz === ja.ucesnik.ulaz) continue;
      // Pravilo ne odlučuje: ko je prije stigao (čeka duže, ili prije stiže).
      const onPrije = on.cekaOd !== null && (ja.cekaOd === null || on.cekaOd < ja.cekaOd || (on.cekaOd === ja.cekaOd && on.id < n.id));
      const jaCekam = ja.cekaOd !== null;
      if (onPrije || (!jaCekam && on.cekaOd === null && stize < prodjem)) ustupi(on.id, mojeMjesto);
      continue;
    }
    const rezerva = n.vanjski ? GRAD_BOT_REZERVA_PROLAZA : GRAD_NPC_REZERVA_PROLAZA;
    if (on.ceka || stize < prodjem + rezerva) ustupi(on.id, mojeMjesto);
  }
  return { kome, staniDo, unutra };
}

/**
 * Vozila koja se sa mnom spajaju na isti izlaz, već su u raskrsnici i bliže
 * su mjestu spajanja: prije nego što uđu u moju traku, prate se kao vozilo ispred — razmak je
 * razlika puteva do mjesta spajanja (projekcija na zajedničku traku).
 */
function spajanja(sb: Saobracaj, n: Npc, poRaskrsnici: Map<number, Dolazak[]>): Prepreka | null {
  let naj: Prepreka | null = null;
  for (let qi = n.prolaz; qi < n.plan.prolazi.length; qi++) {
    const q = n.plan.prolazi[qi]!;
    if (q.od - n.s > GRAD_NPC_HORIZONT) break;
    const ja = dolazakNpc(sb, n, qi, sb.t);
    for (const on of poRaskrsnici.get(q.r) ?? []) {
      // Samo onaj ko je već u raskrsnici: ko još čeka na liniji možda čeka
      // baš mene — o njemu odlučuje prvenstvo (`komeUstupa`).
      if (on.id === n.id || !on.usao) continue;
      const sk = sukob(n, ja, on);
      if (!sk?.spajanje) continue;
      const doMene = ja.s0 + sk.sa - n.s;
      const doNjega = on.s0 + sk.sb - on.s;
      // On je bliže spajanju (ispred mene poslije njega), i još nije u mojoj
      // traci — kad jeste, vidi ga `naPutu`.
      const duz = (n.plan.vozilo.duzina + on.vozilo.duzina) / 2;
      if (doNjega >= doMene || doNjega < -duz) continue;
      const gap = doMene - doNjega - duz;
      if (!naj || gap < naj.gap) naj = { gap, vl: on.v, id: on.id };
    }
  }
  return naj;
}

/** Najbliža tačka putanje između `od` i `do_` [m] tački (x, y): `s` i udaljenost. */
function projekcija(put: Putanja, od: number, do_: number, x: number, y: number): { s: number; d: number } {
  const { tacke, cum } = put;
  let naj = { s: od, d: Infinity };
  for (let i = 1; i < tacke.length; i++) {
    if (cum[i]! < od) continue;
    if (cum[i - 1]! > do_) break;
    const a = tacke[i - 1]!;
    const b = tacke[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l2)) : 0;
    const d = Math.hypot(a.x + dx * t - x, a.y + dy * t - y);
    if (d < naj.d) naj = { s: cum[i - 1]! + Math.sqrt(l2) * t, d };
  }
  return naj;
}

/**
 * Prestrojavanje (promjena trake van raskrsnice): moja putanja ispred ulazi u
 * putanju vozila iz susjedne trake istog smjera. Kad ono do tog mjesta stiže
 * prije mene, ili manje od `GRAD_NPC_PRESTROJ_RAZMAK` poslije, propuštam ga —
 * prati se kao vozilo ispred na mjestu ulaska (projekcija), pa se
 * prestrojavam iza njega. Ono me ne vidi dok ne uđem u njegovu traku.
 */
function prestrojavanja(n: Npc, ostali: readonly Npc[]): Prepreka | null {
  const { tacke, cum } = n.plan.put;
  let naj: Prepreka | null = null;
  const cx = Math.cos(n.ugao);
  const cy = Math.sin(n.ugao);
  for (const o of ostali) {
    if (o.id === n.id || o.nivo !== n.nivo) continue;
    const dx = o.x - n.x;
    const dy = o.y - n.y;
    if (dx * dx + dy * dy > 45 * 45) continue;
    // Isti smjer, i bočno u susjednoj traci (ne u mojoj).
    if (Math.cos(o.ugao) * cx + Math.sin(o.ugao) * cy < 0.7) continue;
    const bocno = Math.abs(-dx * cy + dy * cx);
    if (bocno < GRAD_NPC_ISTA_TRAKA || bocno > 1.25 * (n.plan.vozilo.sirina + o.plan.vozilo.sirina) + GRAD_NPC_SUKOB_RAZMAK) continue;
    // Gdje moja putanja (narednih 30 m) ulazi u njegovu.
    let ulaz: { ja: number; on: number } | null = null;
    for (let i = n.kursor; i < tacke.length; i++) {
      if (cum[i]! < n.s) continue;
      if (cum[i]! > n.s + GRAD_NPC_PRESTROJ_POGLED) break;
      const pr = projekcija(o.plan.put, o.s - 10, o.s + GRAD_NPC_PRESTROJ_POGLED + 30, tacke[i]!.x, tacke[i]!.y);
      if (pr.d < GRAD_NPC_ISTA_TRAKA) {
        ulaz = { ja: cum[i]!, on: pr.s };
        break;
      }
    }
    if (!ulaz) continue;
    const doMene = ulaz.ja - n.s;
    const doNjega = ulaz.on - o.s;
    // Već je prošao mjesto ulaska — ispred mene je; vidi ga `naPutu`.
    const duz = (n.plan.vozilo.duzina + o.plan.vozilo.duzina) / 2;
    if (doNjega < -duz) continue;
    const ja = vrijemeDo(doMene, n.v, GRAD_NPC_UBRZANJE, Math.max(n.v, 6));
    const on = doNjega / Math.max(o.v, 0.1);
    if (on > ja + GRAD_NPC_PRESTROJ_RAZMAK) continue; // daleko iza: ulazim ispred njega
    const gap = doMene - doNjega - duz;
    if (!naj || gap < naj.gap) naj = { gap, vl: o.v, id: o.id };
  }
  return naj;
}

/**
 * Mogući prolazi igrača kroz raskrsnicu ispred (do `GRAD_NPC_HORIZONT` + 20 m):
 * igrač nema plan, pa se za svaki izlaz koji odgovara žmigavcu (bez njega:
 * pravo; kad pravo nema — svi) napravi plan kao za drugog vozača. Drugi mu
 * ustupaju ako ima prednost na bilo kojem.
 */
function dolasciIgraca(sb: Saobracaj, vi: VoznjaIgraca): Dolazak[] {
  if (vi.ivica === null) return [];
  const { mreza: m, raskrsnice: r, zabrane, zaSudiju } = sb.svijet;
  const prilaz: Korak[] = [{ ivica: vi.ivica, smjer: vi.smjer }];
  let duz = 0;
  let kr: [number, number] | undefined;
  for (let k = 0; k < 10; k++) {
    const z = prilaz[prilaz.length - 1]!;
    const iv = m.ivice[z.ivica]!;
    kr = r.krakIvice.get(`${z.ivica}:${z.smjer === 1 ? 1 : 0}`);
    if (kr) break;
    duz += iv.duzina;
    const c = z.smjer === 1 ? iv.b : iv.a;
    if (r.uCvoru[c]! >= 0 || duz > GRAD_NPC_HORIZONT + 20) return [];
    const dalje = (m.izCvora[c] ?? []).filter((j) => j !== z.ivica && m.ivice[j]!.vozna);
    if (dalje.length !== 1) return [];
    const f = m.ivice[dalje[0]!]!;
    prilaz.push({ ivica: f.i, smjer: f.a === c ? 1 : -1 });
  }
  if (!kr) return [];
  const rs = r.lista[kr[0]]!;
  const ki = kr[1];
  const izlazi = rs.kraci
    .map((k, j) => ({ k, j, mv: manevarKroz(m, rs, ki, j) }))
    .filter(({ k, j }) => k.izlaz && j !== ki);
  const trazeni = vi.zmigavac === "left" ? ["lijevo", "polukruzno"] : vi.zmigavac === "right" ? ["desno"] : ["pravo"];
  const izbor = izlazi.filter((x) => trazeni.includes(x.mv));
  const t = vi.tijelo;
  const out: Dolazak[] = [];
  for (const { k } of izbor.length > 0 ? izbor : izlazi) {
    const zadnji = prilaz[prilaz.length - 1]!;
    const kljuc = `${prilaz[0]!.ivica}:${prilaz[0]!.smjer}>${k.ivica}:${k.kraj}`;
    let plan = sb.planoviIgraca.get(kljuc);
    if (plan === undefined) {
      const kroz = ruta(m, r, zabrane, zadnji, { ivica: k.ivica, smjer: k.kraj === 0 ? 1 : -1 }, 400, (iv) => iv.vozna);
      plan = kroz ? planBota(zaSudiju, [...prilaz.slice(0, -1), ...kroz], undefined, GRAD_NPC_REZERVA_LUKA) : null;
      if (plan && (plan.prolazi.length === 0 || plan.prolazi[0]!.r !== rs.id)) plan = null;
      sb.planoviIgraca.set(kljuc, plan);
    }
    if (!plan) continue;
    const q = plan.prolazi[0]!;
    const cekanje = q.linija >= 0 ? plan.linije[q.linija]!.s : q.cekanje;
    const s = projekcija(plan.put, 0, plan.put.duzina, t.x, t.y).s;
    const { tacke, cum } = plan.put;
    const od = Math.max(0, Math.min(q.od - 3, cekanje - GRAD_NPC_PRILAZ_SUKOBA));
    const geom: Point[] = [];
    let s0 = od;
    for (let i = 0; i < tacke.length; i++) {
      if (cum[i]! < od) continue;
      if (geom.length === 0) s0 = cum[i]!;
      geom.push(tacke[i]!);
      if (cum[i]! > q.do_) break;
    }
    if (s > q.do_) continue;
    const manevar = q.ulaz >= 0 && q.izlaz >= 0 ? manevarKroz(m, rs, q.ulaz, q.izlaz) : "pravo";
    const ceka = Math.abs(t.v) < GRAD_NPC_CEKA_BRZINA && Math.abs(cekanje - s) < GRAD_NPC_CEKA_DO;
    out.push({
      id: IGRAC,
      r: rs.id,
      ucesnik: {
        ulaz: q.ulaz,
        izlaz: q.izlaz,
        manevar,
        kontrola: q.ulaz >= 0 ? kontrolaUcesnika(rs, q.ulaz, sb.t, manevar) : "desna",
        uPrstenu: q.uPrstenu,
        izUnutrasnje: q.uPrstenu && q.izlaz >= 0 && !m.ivice[rs.kraci[q.izlaz]!.ivica]!.kruzni && vi.trakaUPrstenu === "unutra",
        ukljucivanje: q.ulaz >= 0 && rs.kraci[q.ulaz]!.klasa === "service",
      },
      tacke: geom,
      s0,
      s,
      v: Math.max(0, t.v),
      usao: s > cekanje + 0.5,
      usaoOd: s > cekanje + 0.5 ? -Infinity : null,
      ceka,
      uKoloni: false,
      cekaOd: ceka ? sb.igracCekaOd : null,
      ubrzanje: A_MAX,
      x: t.x,
      y: t.y,
      put: plan.put,
      kljuc: `${IGRAC}:${kljuc}`,
      vozilo: AUTO,
    });
  }
  return out;
}

// ── pješaci (stavka 8) ─────────────────────────────────────────────────────

/**
 * Prelazi na putanji plana (`prelaziNaPutanji`) — po planu jednom; uz svaki i
 * `dodir`: sredina vozila kad tijelom prvi put dotakne pojas zebre (putanja
 * zna sjeći prelaz ukoso, pa to nije uvijek pola dubine pred linijom).
 */
const prelaziPlanova = new WeakMap<PlanBota, { prelaz: number; s: number; w: number; dodir: number }[]>();
function prelaziPlana(pj: Pjesaci, plan: PlanBota): { prelaz: number; s: number; w: number; dodir: number }[] {
  let x = prelaziPlanova.get(plan);
  if (!x) {
    // Ruta može završiti tik pred zebrom, a tijelo vozila je ipak dotakne:
    // putanja se produžava pravo preko kraja.
    const put = plan.put;
    const kraj = headingAt(put.tacke, put.cum, put.duzina);
    const zadnja = put.tacke[put.tacke.length - 1]!;
    const tacke = [...put.tacke, { x: zadnja.x + kraj.x * GRAD_PJ_PREKO_KRAJA, y: zadnja.y + kraj.y * GRAD_PJ_PREKO_KRAJA }];
    const cum = [...put.cum, put.duzina + GRAD_PJ_PREKO_KRAJA];
    const duzina = put.duzina + GRAD_PJ_PREKO_KRAJA;
    x = prelaziNaPutanji(pj.mreza, tacke, cum).map((q) => {
      const p = pj.mreza.prelazi[q.prelaz]!;
      let dodir = q.s;
      for (; dodir > q.s - 12; dodir -= 0.25) {
        const t = pointAt(tacke, cum, dodir);
        const h = headingAt(tacke, cum, Math.min(Math.max(0, dodir), duzina));
        if (!tijeloNaZebri(t.x, t.y, Math.atan2(h.y, h.x), plan.vozilo.duzina, plan.vozilo.sirina, p)) break;
      }
      return { ...q, dodir };
    });
    prelaziPlanova.set(plan, x);
  }
  return x;
}

/**
 * Pješak na kolovozu ispred vozila (na prelazu ili van njega), u pojasu kojim
 * će vozilo proći: `s` sredine vozila na kojem treba stati, i ko je. Pješak na
 * trotoaru nije na putu.
 */
function pjesakNaPutu(n: Npc, pj: Pjesaci, pogled: number): { s: number; id: number } | null {
  const { tacke, cum } = n.plan.put;
  const L = n.plan.vozilo.duzina;
  const nos = n.s + L / 2;
  const bocno = n.plan.vozilo.sirina / 2 + GRAD_PJ_POLUPRECNIK + 0.3;
  let naj: { s: number; id: number } | null = null;
  for (const x0 of pj.lista) {
    if (x0.stanje !== "prelazi") continue;
    if (Math.abs(x0.x - n.x) > pogled + L || Math.abs(x0.y - n.y) > pogled + L) continue;
    // Sada, i gdje će biti za `GRAD_PJ_PREDVIDJANJE` (ide preko kolovoza).
    const naprijed = x0.brzina * GRAD_PJ_PREDVIDJANJE;
    for (const x of [x0, { id: x0.id, x: x0.x + Math.cos(x0.ugao) * naprijed, y: x0.y + Math.sin(x0.ugao) * naprijed }])
    for (let i = Math.max(1, n.kursor); i < tacke.length; i++) {
      if (cum[i]! < nos - 1) continue;
      if (cum[i - 1]! > nos + pogled) break;
      const a = tacke[i - 1]!;
      const b = tacke[i]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l2 = dx * dx + dy * dy;
      const f = l2 > 0 ? Math.max(0, Math.min(1, ((x.x - a.x) * dx + (x.y - a.y) * dy) / l2)) : 0;
      if (Math.hypot(a.x + dx * f - x.x, a.y + dy * f - x.y) > bocno) continue;
      const s = cum[i - 1]! + Math.sqrt(l2) * f - GRAD_PJ_POLUPRECNIK - L / 2 - 1.5;
      if (s + L / 2 + 1.5 < nos - 0.5) continue;
      if (!naj || s < naj.s) naj = { s, id: x.id };
      break;
    }
  }
  return naj;
}

/**
 * Najveća brzina na početku plana uz koju vozilo mirno stane pred svakim
 * prelazom ispred na kojem je ili čeka pješak (vozilo koje se tek pojavilo
 * pješak nije mogao vidjeti); 0 kad je zebra tik pred vozilom.
 */
function brzinaPredPjesacima(pj: Pjesaci, plan: PlanBota): number {
  let v = Infinity;
  for (const x of prelaziPlana(pj, plan)) {
    if (x.s > 120) break;
    if (!pj.lista.some((q) => q.prelaz === x.prelaz && q.stanje !== "hoda")) continue;
    v = Math.min(v, zaStati(x.dodir - GRAD_STOP_ISPRED_ZEBRE));
  }
  return v;
}

/** Da li bi vozilo na `sNovo` tijelom (uz malu rezervu) dotaklo pješaka. */
function zaklonPjesaka(n: Npc, sNovo: number, pj: Pjesaci): number | null {
  const put = n.plan.put;
  const p = pointAt(put.tacke, put.cum, sNovo);
  const h = headingAt(put.tacke, put.cum, Math.min(sNovo, put.duzina));
  const { duzina, sirina } = n.plan.vozilo;
  const tijelo = { x: p.x, y: p.y, ugao: Math.atan2(h.y, h.x), duzina: duzina + 0.3, sirina: sirina + 0.2 };
  for (const x of pj.lista) {
    if (Math.abs(x.x - p.x) > duzina || Math.abs(x.y - p.y) > duzina) continue;
    if (udaraPjesaka(tijelo, x)) return x.id;
  }
  return null;
}

// ── jedan vozač ────────────────────────────────────────────────────────────

interface Odluka {
  v: number;
  razlog: Razlog;
  kome: number[];
}

function odluci(sb: Saobracaj, n: Npc, tijela: readonly Tijelo[], poRaskrsnici: Map<number, Dolazak[]>): Odluka {
  const p = n.plan;
  const r = sb.svijet.raskrsnice;
  const t = sb.t;
  let v = dozvoljena(n);
  let razlog: Razlog = { vrsta: "slobodno" };
  let kome: number[] = [];
  const stani = (s: number, zasto: Razlog) => {
    const vs = zaStati(s - n.s);
    if (vs < v) {
      v = vs;
      razlog = zasto;
    }
  };
  // Kraj rute.
  stani(p.put.duzina - 1, { vrsta: "cilj" });

  // Stop-linije: STOP i semafor (kao savršeni bot). Zeleno viđeno na
  // prilazu svakoj liniji ispred (kao sudija, do `GRAD_PRILAZ_DO`).
  for (let i = 0; i < p.linije.length; i++) {
    const l = p.linije[i]!;
    if (l.s - n.s > GRAD_PRILAZ_DO) break;
    if (!n.prosao[i] && l.krak.kontrola === "semafor") {
      const rs = r.lista[l.r]!;
      if ((zelenaStrelica(rs, l.k, t, l.manevar) ? "zeleno" : svjetlo(rs, l.k, t, l.manevar)) === "zeleno") n.vidioZeleno[i] = true;
    }
  }
  for (let i = 0; i < p.linije.length; i++) {
    if (n.prosao[i]) continue;
    const l = p.linije[i]!;
    if (n.s > l.s + 1) {
      n.prosao[i] = true;
      continue;
    }
    if (l.s - n.s > 80) break;
    if (l.krak.kontrola === "stop") {
      if (l.s - n.s < 0.5 && n.v < 0.1) n.stajao[i]! += DT;
      if (n.stajao[i]! < STOP_HOLD + 0.5) stani(l.s, { vrsta: "stop" });
      break;
    }
    const rs = r.lista[l.r]!;
    const strelica = zelenaStrelica(rs, l.k, t, l.manevar);
    const sv = strelica ? "zeleno" : svjetlo(rs, l.k, t, l.manevar);
    // Strelica se ugasila (bez žutog) dok je bio preblizu da stane: prolazi.
    if (n.strelica[i] && !strelica && sv !== "zeleno") {
      n.poslijeStrelice[i] = (l.s - n.s + STOP_MARGIN) / Math.max(n.v, 0.1) < YELLOW_COMMIT_TTC * 0.8;
    }
    n.strelica[i] = strelica;
    if (sv === "zeleno") n.poslijeStrelice[i] = false;
    if (sv === "zeleno") n.zutoStaje[i] = null;
    // Žuto zatečeno na prilazu (prelaz sa zelenog nije viđen): bio je dovoljno
    // daleko — staje, kao što i sudija traži. Inače po vremenu do linije.
    if (sv === "zuto" && n.zutoStaje[i] === null) {
      // Vrijeme do linije kao kod sudije: od nosa do same linije.
      n.zutoStaje[i] = !n.vidioZeleno[i] || (l.s - n.s + STOP_MARGIN) / Math.max(n.v, 0.1) >= YELLOW_COMMIT_TTC * 0.8;
    }
    // Odlučio da prođe na žuto, a ipak je stao pred linijom (ustupao): sada
    // može stati — na to žuto više ne ide (inače prelazi liniju na crveno).
    if (sv === "zuto" && n.zutoStaje[i] === false && n.v < 0.1 && n.s <= l.s) n.zutoStaje[i] = true;
    if ((sv === "crveno" && !n.poslijeStrelice[i]) || (sv === "zuto" && n.zutoStaje[i])) stani(l.s, { vrsta: "crveno" });
    break;
  }

  // Raskrsnice ispred: kome ustupam, i ima li mjesta iza izlaza. Kad je
  // mjesto čekanja sljedeće raskrsnice prije izlaza iz ove (tik jedna uz
  // drugu), odlučuje se za obje prije ulaska u prvu — da se ne čeka u njoj.
  let prva: ProlazPlana | null = null;
  for (let qi = n.prolaz; qi < p.prolazi.length; qi++) {
    const q = p.prolazi[qi]!;
    if (q.od - n.s > GRAD_NPC_HORIZONT) break;
    const cekanje = mjestoCekanja(n, q);
    if (uRaskrsnici(n, qi)) {
      // U nju je ušao samo kroz lanac (linija mu je još ispred): ko je u
      // međuvremenu fizički ušao u nju, njemu ustupa — staje pred sukobom.
      // Prešao je liniju: ustupa onome ko je ušao prije njega, dok još može
      // stati pred mjestom sukoba (stao je, ili staje, dublje u raskrsnici —
      // npr. propušta lijevog skretača koji je već unutra). Redoslijed ulaska
      // je isti za oba, pa ne čekaju jedan drugog.
      if (prva === null) {
        const naLiniji = n.s <= cekanje + 0.5;
        const k = komeUstupa(sb, n, dolazakNpc(sb, n, qi, t), poRaskrsnici.get(q.r) ?? [], true, naLiniji ? null : (n.usaoOd.get(qi) ?? null));
        if (k.kome.length > 0 && (naLiniji || k.staniDo > n.s)) {
          kome = k.kome;
          stani(k.staniDo, { vrsta: "ustupa", kome: k.kome });
          break;
        }
      }
      continue; // već je u njoj
    }
    if (prva && cekanje > prva.do_) break;
    prva ??= q;
    const gdje = mjestoCekanja(n, prva);
    const ja = dolazakNpc(sb, n, qi, t);
    const k = komeUstupa(sb, n, ja, poRaskrsnici.get(q.r) ?? []);
    // Ustupanje koje počinje prekasno: ni jakim kočenjem ne bi stao pred
    // mjestom čekanja — prebacio bi liniju i stajao u raskrsnici. Tada prolazi
    // (oni koji nisu u raskrsnici vide da ne može stati); ustupa samo onima
    // koji su već u njoj.
    // Pola metra preko mjesta čekanja je u redu (linija ima rezervu): vozilo
    // koje već stoji na njemu, a puzi (pravi auto bota ne stane savršeno),
    // nije „prekasno".
    const kasno = n.v * n.v > 2 * B_MAX * GRAD_NPC_KOCENJE_UDIO * (Math.max(0, gdje - n.s) + 0.5);
    if (k.kome.length > 0 && (!kasno || k.unutra)) {
      kome = k.kome;
      stani(Math.min(gdje, k.staniDo), { vrsta: "ustupa", kome: k.kome });
      break;
    }
    // Ne ulazi se u raskrsnicu ako se iz nje ne može izaći: vozilo ispred
    // stoji tik iza izlaza.
    const L = p.vozilo.duzina;
    const izlaz = q.do_ - 6 - L / 2;
    const iza = naPutu(n, tijela, izlaz + L + GRAD_NPC_RAZMAK - (n.s + L / 2) + 2);
    if (iza && iza.vl < 2 && n.s + L / 2 + iza.gap < izlaz + L + GRAD_NPC_RAZMAK) {
      stani(gdje, { vrsta: "izlaz", kome: iza.id });
      break;
    }
  }

  // Pješački semafor na sredini ulice (stavka 8): kao semafor raskrsnice.
  for (let i = 0; i < p.pjesacki.length; i++) {
    const l = p.pjesacki[i]!;
    if (l.s - n.s > GRAD_PRILAZ_DO || n.s > l.s + 1) continue;
    const sv = svjetloZaVozila(sb.svijet.zaSudiju.pjesackiSemafori[l.semafor]!, t);
    if (sv === "zeleno") {
      n.pjesackiZeleno.add(i);
      n.pjesackiZuto.set(i, null);
    } else if (sv === "zuto" && (n.pjesackiZuto.get(i) ?? null) === null) {
      // Žuto: staje ko stiže (kao sudija), ko je preblizu — prolazi.
      n.pjesackiZuto.set(i, !n.pjesackiZeleno.has(i) || (l.s - n.s + STOP_MARGIN) / Math.max(n.v, 0.1) >= YELLOW_COMMIT_TTC * 0.8);
    }
    if (sv === "zuto" && n.pjesackiZuto.get(i) === false && n.v < 0.1) n.pjesackiZuto.set(i, true);
    if (sv === "crveno" || (sv === "zuto" && n.pjesackiZuto.get(i))) stani(l.s, { vrsta: "crveno" });
  }

  // Pješaci (stavka 8): pješak sa prednošću na prelazu (isto pravilo kao
  // kod sudije), i pješak na putu.
  const pj = sb.pjesaci;
  if (pj) {
    const zaustavni = (n.v * n.v) / (2 * GRAD_VOZAC_USPORENJE);
    const pogledP = Math.max(GRAD_NPC_POGLED, zaustavni + 15);
    // Namjera se gleda dokle i kod sudije (`GRAD_PJ_NAMJERA_DO`).
    const vidi = new Set<number>();
    for (const x of prelaziPlana(pj, p)) {
      if (x.s - n.s > Math.max(pogledP + p.vozilo.duzina, GRAD_PJ_NAMJERA_DO)) break;
      const pr = pj.mreza.prelazi[x.prelaz]!;
      // Stoji se `GRAD_STOP_ISPRED_ZEBRE` pred zebrom (tijelom). Ko je to
      // mjesto prošao, staje tik pred zebrom ako još stigne udobno zakočiti
      // (tada pješak i kreće, vidi `ugrozava`); inače prolazi — na zebri se
      // ne staje.
      let staniNa = x.dodir - GRAD_STOP_ISPRED_ZEBRE;
      if (n.s > staniNa + 0.5) {
        staniNa = x.dodir - GRAD_PJ_TIK_PRED_ZEBROM;
        if (staniNa - n.s < (n.v * n.v) / (2 * GRAD_VOZAC_USPORENJE)) continue;
      }
      const { naPrelazu, cekaju } = pjesaciSaPrednoscu(pj, pr, polovinaUlice(pr, x.w));
      // Pješak na ivičnjaku: namjera se pamti kad ga vozač prvi put vidi, i
      // da li je tada mogao mirno stati — kao sudija (`Sudija.namjere`), a i
      // duž svoje putanje (u krivini zebra nije pravo ispred haube). Ustupa
      // ako bilo koji od ta dva računa kaže da je mogao.
      for (const q of cekaju) {
        vidi.add(q.id);
        if (n.namjere.has(q.id)) continue;
        const poPutanji = staniNa - n.s >= (n.v * n.v) / (2 * GRAD_VOZAC_USPORENJE) - 0.5;
        n.namjere.set(q.id, poPutanji || mozeMirnoStati(n.x, n.y, n.ugao, n.v, p.vozilo.duzina, p.vozilo.sirina, pr));
      }
      const pjesak = naPrelazu[0] ?? cekaju.find((q) => n.namjere.get(q.id));
      if (pjesak) stani(staniNa, { vrsta: "pjesak", kome: pjesak.id });
    }
    for (const id of [...n.namjere.keys()]) if (!vidi.has(id)) n.namjere.delete(id);
    const naPutu = pjesakNaPutu(n, pj, pogledP);
    if (naPutu) stani(naPutu.s, { vrsta: "pjesak", kome: naPutu.id });
  }

  // Vozilo ispred, i ono koje se spaja ispred mene.
  const pogled = Math.max(GRAD_NPC_POGLED, (n.v * n.v) / (2 * GRAD_VOZAC_USPORENJE) + 15);
  for (const ispred of [naPutu(n, tijela, pogled), spajanja(sb, n, poRaskrsnici), prestrojavanja(n, sb.npc)]) {
    if (!ispred) continue;
    const vs = sigurnaBrzina(n.v, ispred.vl, ispred.gap);
    if (vs < v) {
      v = vs;
      razlog = { vrsta: "vozilo", kome: ispred.id };
    }
  }
  return { v, razlog, kome };
}

/**
 * Da li bi vozilo na `sNovo` tijelom (uvećanim za `GRAD_NPC_ZAKLON` sa svake
 * strane) zašlo u tijelo drugog vozila istog nivoa, a da mu se time i
 * približava. Vraća id tog vozila, ili `null`.
 */
function zaklon(n: Npc, sNovo: number, tijela: readonly Tijelo[]): number | null {
  const put = n.plan.put;
  const p = pointAt(put.tacke, put.cum, sNovo);
  const h = headingAt(put.tacke, put.cum, Math.min(sNovo, put.duzina));
  const z0 = GRAD_NPC_ZAKLON;
  const { duzina: L, sirina: W } = n.plan.vozilo;
  const ja0 = rectCorners(p, h, L + 2 * z0, W + 2 * z0);
  for (const o of tijela) {
    if (o.id === n.id || o.nivo !== n.nivo) continue;
    // Parkirani se ne pomjera: manja rezerva (vidi `GRAD_PARK_ZAKLON`).
    // Susretno vozilo: bočno manja (`GRAD_NPC_ZAKLON_SUSRET`).
    const susret = Math.cos(o.ugao) * h.x + Math.sin(o.ugao) * h.y < -0.7;
    const z = o.parkiran ? GRAD_PARK_ZAKLON : z0;
    const zb = o.parkiran ? GRAD_PARK_ZAKLON : susret ? GRAD_NPC_ZAKLON_SUSRET : z0;
    const ja = o.parkiran || susret ? rectCorners(p, h, L + 2 * z, W + 2 * zb) : ja0;
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d > L + o.duzina) continue;
    // Udaljava se — smije (inače bi dva vozila koja se dotiču stajala vječno).
    if (d >= Math.hypot(o.x - n.x, o.y - n.y)) continue;
    const on = rectCorners({ x: o.x, y: o.y }, { x: Math.cos(o.ugao), y: Math.sin(o.ugao) }, o.duzina + 2 * z, o.sirina + 2 * zb);
    if (polygonsOverlap(ja, on)) return o.id;
  }
  return null;
}

/** Prolaz, mjesto čekanja i vrijeme stajanja poslije pomaka vozila. */
function azurirajProlaz(sb: Saobracaj, n: Npc, o: Odluka): void {
  // Prolaz kroz raskrsnicu je gotov kad je potvrđen izlaz.
  while (n.prolaz < n.plan.prolazi.length && n.s > n.plan.prolazi[n.prolaz]!.do_) n.prolaz++;
  // Čekanje se broji pred prvim prolazom u koji još nije ušao — i kad je
  // to raskrsnica tik iza ove u kojoj je.
  let qi = n.prolaz;
  while (qi < n.plan.prolazi.length && uRaskrsnici(n, qi)) {
    if (!n.usaoOd.has(qi)) n.usaoOd.set(qi, sb.t);
    if (!n.presaoLinijuOd.has(qi) && n.s > mjestoCekanja(n, n.plan.prolazi[qi]!) + 0.5) n.presaoLinijuOd.set(qi, sb.t);
    qi++;
  }
  if (qi !== n.cekaProlaz) {
    n.cekaProlaz = qi;
    n.cekaOd = null;
  }
  const q = n.plan.prolazi[qi];
  // Čeka: stoji na mjestu čekanja, ili stoji jer ustupa (prije mjesta sukoba).
  const stoji = n.v < GRAD_NPC_CEKA_BRZINA;
  if (q && stoji && (Math.abs(mjestoCekanja(n, q) - n.s) < GRAD_NPC_CEKA_DO || o.razlog.vrsta === "ustupa")) n.cekaOd ??= sb.t;
  n.stoji = n.v < 0.1 ? n.stoji + DT : 0;
}

/**
 * Vanjsko vozilo (savršeni bot među vozilima, vidi `Npc.vanjski`) sa planom
 * `plan`: id je `IGRAC`, pa drugi njegovo kočenje zbog njih bilježe kao
 * kočenje zbog igrača — sudija sudi oduzeto prvenstvo (`oduzetoPrvenstvo`).
 */
export function dodajVanjsko(sb: Saobracaj, plan: PlanBota, koraci: Korak[]): Npc {
  obidji(plan, sb.mjesta, 0);
  const n = napraviNpc(sb, plan, koraci);
  n.id = IGRAC;
  n.vanjski = true;
  sb.npc.push(n);
  return n;
}

/** Položaj vanjskog vozila iz pravog auta: `s` na planu, tačka, pravac i brzina. */
export function postaviVanjsko(n: Npc, s: number, x: number, y: number, ugao: number, v: number): void {
  n.s = s;
  n.x = x;
  n.y = y;
  n.ugao = ugao;
  n.v = Math.max(0, v);
  let i = n.kursor;
  const cum = n.plan.put.cum;
  while (i + 1 < cum.length && cum[i + 1]! <= s) i++;
  n.nivo = n.plan.nivoi[i] ?? 0;
  const najava = n.plan.najave.find((z) => s >= z.od && s <= z.do_);
  n.zmigavac = najava ? najava.strana : null;
}

// ── korak ──────────────────────────────────────────────────────────────────

/**
 * Jedan korak (`DT`) cijelog saobraćaja oko tačke `fokus` (igrač). `igrac` je
 * tijelo igrača — drugi ga vide i koče zbog njega — ili `null` (fuzz bez
 * igrača). Prvo svi odluče iz istog stanja, pa se svi pomjere: redoslijed
 * vozila ne mijenja ishod.
 */
export function korakSaobracaja(sb: Saobracaj, fokus: Point, igrac: Tijelo | null, voznja: VoznjaIgraca | null = null): void {
  const tijela: Tijelo[] = [...sb.npc.map(tijeloNpc), ...parkirani(sb)];
  sb.poId = new Map(sb.npc.map((n) => [n.id, n]));
  if (igrac) tijela.push(igrac);

  // Dolasci u raskrsnice — svi prolazi ispred, do horizonta (i malo dalje,
  // da ih vide i oni koji su bliže).
  const poRaskrsnici = new Map<number, Dolazak[]>();
  for (const n of sb.npc) {
    for (let qi = n.prolaz; qi < n.plan.prolazi.length; qi++) {
      const q = n.plan.prolazi[qi]!;
      if (q.od - n.s > GRAD_NPC_HORIZONT + 40) break;
      if (n.s > q.do_) continue;
      const d = dolazakNpc(sb, n, qi, sb.t);
      const l = poRaskrsnici.get(q.r) ?? [];
      l.push(d);
      poRaskrsnici.set(q.r, l);
    }
  }

  // Igrač: mogući prolazi kroz raskrsnicu ispred.
  const igracevi = voznja ? dolasciIgraca(sb, voznja) : [];
  if (igracevi.some((d) => d.ceka)) sb.igracCekaOd ??= sb.t;
  else sb.igracCekaOd = null;
  for (const d of igracevi) poRaskrsnici.set(d.r, [...(poRaskrsnici.get(d.r) ?? []), d]);

  const odluke = sb.npc.map((n) => odluci(sb, n, tijela, poRaskrsnici));

  // Krug prvenstva: vozila koja stoje na liniji i čekaju jedno drugo u
  // krug — kreće ono koje najduže čeka (odluka korisnika).
  odrediKrugove(sb, odluke);

  sb.npc.forEach((n, i) => {
    const o = odluke[i]!;
    if (n.vanjski) {
      // Pomjera ga pravi auto: ovdje samo odluka i stanje čekanja.
      n.razlog = o.razlog;
      n.odlukaV = o.v;
      azurirajProlaz(sb, n, o);
      return;
    }
    // Brzina ka odluci: ubrzanje mirno, kočenje do `B_MAX`.
    let vNovo = Math.max(0, n.v - B_MAX * DT, Math.min(n.v + GRAD_NPC_UBRZANJE * DT, o.v));
    n.razlog = o.razlog;
    // Zaštita: novi položaj ne smije zaći u tijelo drugog vozila (uz rezervu
    // koja pokriva i njegov korak) — tada stoji. Sudar je nemoguć; ono što
    // promakne pravilima postaje čekanje, a čekanje vidi detektor zastoja.
    const sNovo = n.s + ((n.v + vNovo) / 2) * DT;
    const blokira = sNovo > n.s ? zaklon(n, sNovo, tijela) : null;
    // Pješaka se nikad ne dotiče (stavka 8) — ono što promakne pravilima
    // postaje stajanje, kao kod vozila.
    const pjesak = blokira === null && sNovo > n.s && sb.pjesaci ? zaklonPjesaka(n, sNovo, sb.pjesaci) : null;
    if (blokira !== null) {
      vNovo = 0;
      n.razlog = { vrsta: "vozilo", kome: blokira };
    } else if (pjesak !== null) {
      vNovo = 0;
      n.razlog = { vrsta: "pjesak", kome: pjesak };
    } else n.s = sNovo;
    n.a = (vNovo - n.v) / DT;
    n.v = vNovo;
    // Naglo kočenje zbog igrača: zapisuje se za sudiju (oduzeto prvenstvo).
    // Iza igrača samo dok je tek upao ispred — poslije je to kolona.
    const igracIspred = n.razlog.vrsta === "vozilo" && n.razlog.kome === IGRAC;
    n.igracIspredOd = igracIspred ? (n.igracIspredOd ?? sb.t) : null;
    const zbogIgraca =
      (igracIspred && sb.t - n.igracIspredOd! < GRAD_PRESJECANJE) || (n.razlog.vrsta === "ustupa" && n.razlog.kome.includes(IGRAC));
    n.kociZbogIgraca = zbogIgraca && n.a < -GRAD_PRVENSTVO_KOCENJE ? (n.kociZbogIgraca ?? 0) + DT : 0;
    if (n.kociZbogIgraca >= GRAD_PRVENSTVO_TRAJE - 1e-9) {
      const qi = Math.min(n.cekaProlaz, n.plan.prolazi.length - 1);
      const qk = Math.max(n.prolaz, 0);
      const k = n.plan.prolazi[qk <= qi ? qk : qi];
      if (k) {
        const ki = n.plan.prolazi.indexOf(k);
        const d = dolazakNpc(sb, n, ki, sb.t);
        // Za sudiju: da li je stvarno bio u raskrsnici (prošao njeno mjesto čekanja).
        const presao = n.presaoLinijuOd.get(ki) ?? null;
        sb.kocenja.push({ id: n.id, t: sb.t, r: k.r, ucesnik: d.ucesnik, usao: presao !== null, usaoOd: presao });
      }
    }
    postaviPozu(n);
    const najava = n.plan.najave.find((x) => n.s >= x.od && n.s <= x.do_);
    n.zmigavac = najava ? najava.strana : null;
    azurirajProlaz(sb, n, o);
  });
  sb.t += DT;

  otkrijZastoje(sb);
  ukloni(sb, fokus);
  pojavi(sb, fokus, tijela);
}

/**
 * Tarjan: jako povezane komponente grafa „čeka na" među vozilima koja stoje —
 * ustupanje na liniji, zauzet izlaz i kolona. Krug može ići i kroz dvije
 * susjedne raskrsnice (ustupa jednom, a izlaz drugog zatvara treći).
 * Pobjednik je onaj koji ustupa (samo on može krenuti) i najduže čeka.
 */
function odrediKrugove(sb: Saobracaj, odluke: Odluka[]): void {
  const cekaju = new Map<number, number[]>();
  const ustupaju = new Set<number>();
  sb.npc.forEach((n, i) => {
    const o = odluke[i]!;
    // Ustupa: u grafu i dok još prilazi liniji (krug se zatvara i kroz one
    // koji tek stižu — inače bi se odluke smjenjivale iz koraka u korak, a
    // oni bi ušli zajedno). Pobjednik je samo neko ko već čeka na liniji.
    if (o.kome.length > 0) {
      cekaju.set(n.id, o.kome);
      if (n.cekaOd !== null) ustupaju.add(n.id);
    } else if (n.v < GRAD_NPC_CEKA_BRZINA && (o.razlog.vrsta === "izlaz" || o.razlog.vrsta === "vozilo")) {
      cekaju.set(n.id, [o.razlog.kome]);
    }
  });
  // Pobjednik ostaje pobjednik dok ne uđe u raskrsnicu.
  for (const id of [...sb.krugovi.keys()]) {
    const n = sb.npc.find((x) => x.id === id);
    if (!n || n.cekaOd === null) sb.krugovi.delete(id);
  }
  let indeks = 0;
  const ind = new Map<number, number>();
  const nisko = new Map<number, number>();
  const stek: number[] = [];
  const naSteku = new Set<number>();
  const poId = new Map(sb.npc.map((n) => [n.id, n]));
  const obidji = (v: number) => {
    ind.set(v, indeks);
    nisko.set(v, indeks);
    indeks++;
    stek.push(v);
    naSteku.add(v);
    for (const w of cekaju.get(v) ?? []) {
      if (!cekaju.has(w)) continue;
      if (!ind.has(w)) {
        obidji(w);
        nisko.set(v, Math.min(nisko.get(v)!, nisko.get(w)!));
      } else if (naSteku.has(w)) nisko.set(v, Math.min(nisko.get(v)!, ind.get(w)!));
    }
    if (nisko.get(v) === ind.get(v)) {
      const komp: number[] = [];
      let w: number;
      do {
        w = stek.pop()!;
        naSteku.delete(w);
        komp.push(w);
      } while (w !== v);
      const kandidati = komp.filter((id) => ustupaju.has(id)).map((id) => poId.get(id)!);
      if (komp.length > 1 && kandidati.length > 0) {
        const pobjednik = kandidati.sort((a, b) => a.cekaOd! - b.cekaOd! || a.id - b.id)[0]!;
        // Krug se dopunjava, ne zamjenjuje: bez onih koje već preskače,
        // pobjednik bi čekao nekog drugog iz iste gužve (dva kruga kroz njega),
        // a sljedeći korak bi opet vratio prvi — naizmjenično, zauvijek.
        const prije = sb.krugovi.get(pobjednik.id);
        if (!prije) sb.metrika.krugova += 1;
        sb.krugovi.set(pobjednik.id, new Set([...(prije ?? []), ...komp.filter((x) => x !== pobjednik.id)]));
      }
    }
  };
  for (const id of [...cekaju.keys()].sort((a, b) => a - b)) if (!ind.has(id)) obidji(id);
}

/**
 * Zastoj: vozilo stoji duže od `GRAD_NPC_ZASTOJ`, a lanac onih koje čeka ne
 * završava ni crvenim, ni STOP-om, ni nekim ko vozi (ni igračem). Zapiše se,
 * najstarije u lancu kreće (ne ustupa `GRAD_NPC_ZASTOJ_KRECE`); ako se ni
 * tada ništa ne pomjeri, najmlađe nestaje.
 */
function otkrijZastoje(sb: Saobracaj): void {
  const poId = new Map(sb.npc.map((n) => [n.id, n]));
  const parkiraniId = new Set(sb.mjesta.filter((z) => z.parkirano).map((z) => z.id));
  const opravdano = (n: Npc, vidjeni: Set<number>): boolean => {
    if (n.v >= 0.1) return true;
    const r = n.razlog;
    // Pješak se kreće (ili čeka da vozila stanu): čekati njega nije zastoj.
    if (r.vrsta === "crveno" || r.vrsta === "stop" || r.vrsta === "cilj" || r.vrsta === "pjesak") return true;
    if (vidjeni.has(n.id)) return false;
    vidjeni.add(n.id);
    // Stoji, a ništa ga ne drži: kreće (zeleno se upravo upalilo) — ili je greška.
    if (r.vrsta === "slobodno") return false;
    const kome = r.vrsta === "ustupa" ? r.kome : [r.kome];
    return kome.some((id) => {
      if (id === IGRAC) return true;
      // Parkirani se nikad ne pomjeri: čekati njega je zastoj (obilazi se).
      if (parkiraniId.has(id)) return false;
      const o = poId.get(id);
      return !o || opravdano(o, vidjeni);
    });
  };
  for (const n of sb.npc) {
    const vidjeni = new Set<number>();
    if (opravdano(n, vidjeni)) {
      n.bezRazloga = 0;
      continue;
    }
    n.bezRazloga += DT;
    if (n.bezRazloga < GRAD_NPC_ZASTOJ) continue;
    const ucesnici = [...vidjeni].sort((a, b) => a - b);
    const otvoren = sb.zastoji.find((z) => z.razrijesen === null && z.ucesnici.some((x) => ucesnici.includes(x)));
    if (!otvoren) {
      sb.zastoji.push({ t: sb.t, ucesnici, x: n.x, y: n.y, razrijesen: null });
      sb.metrika.zastoja += 1;
      // Vanjskim (bot) upravlja neko drugi: ne forsira se i ne uklanja.
      const najstariji = ucesnici.map((id) => poId.get(id)!).filter((x) => !x.vanjski).sort((a, b) => a.rodjen - b.rodjen || a.id - b.id)[0];
      if (najstariji) najstariji.forsiranDo = sb.t + GRAD_NPC_ZASTOJ_KRECE;
    } else if (sb.t - otvoren.t > GRAD_NPC_ZASTOJ_KRECE) {
      const najmladji = ucesnici.map((id) => poId.get(id)!).filter((x) => !x.vanjski).sort((a, b) => b.rodjen - a.rodjen || b.id - a.id)[0];
      if (najmladji) {
        sb.npc = sb.npc.filter((x) => x !== najmladji);
        otvoren.razrijesen = "uklonjen";
      }
    }
  }
  for (const z of sb.zastoji) {
    if (z.razrijesen === null && z.ucesnici.some((id) => (poId.get(id)?.v ?? 1) > 0.5)) z.razrijesen = "krenuo";
  }
}

function ukloni(sb: Saobracaj, fokus: Point): void {
  sb.npc = sb.npc.filter((n) => {
    if (n.vanjski) return true;
    if (n.s >= n.plan.put.duzina - 1.5) {
      sb.metrika.stiglo += 1;
      // Stigao na mjesto uz ivičnjak: tu ostaje parkiran — tačno na mjestu
      // koje drugi obilaze (plan staje na njemu, vidi `doMjesta`).
      if (n.mjesto) {
        n.mjesto.parkirano = true;
        sb.metrika.parkiralo += 1;
      }
      return false;
    }
    if (Math.hypot(n.x - fokus.x, n.y - fokus.y) > GRAD_NPC_NESTAJE) {
      sb.metrika.udaljilo += 1;
      return false;
    }
    return true;
  });
  // Parkirani nestaju kad se igrač udalji; mjesto vozila kojeg više nema
  // (udaljilo se, ili ga je uklonio zastoj) se oslobađa.
  const ima = new Set(sb.npc.map((n) => n.id));
  sb.mjesta = sb.mjesta.filter((z) => {
    const ostaje = z.parkirano ? Math.hypot(z.x - fokus.x, z.y - fokus.y) <= GRAD_NPC_NESTAJE : ima.has(z.id);
    if (!ostaje) sb.bivsaMjesta.push({ ...z, doId: sb.sljedeciId });
    return ostaje;
  });
  const najmanjiId = Math.min(...sb.npc.map((n) => n.id));
  sb.bivsaMjesta = sb.bivsaMjesta.filter((z) => najmanjiId < z.doId);
}

/** Tačka u poligonu (zraka nadesno). */
function uPoligonu(p: Point, poligon: readonly Point[]): boolean {
  let unutra = false;
  for (let i = 0, j = poligon.length - 1; i < poligon.length; j = i++) {
    const a = poligon[i]!;
    const b = poligon[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) unutra = !unutra;
  }
  return unutra;
}

/** Gustina saobraćaja zone u kojoj je tačka (editor, 0–3); van zona `gustinaVanZona`. */
export function gustinaZone(sb: Saobracaj, p: Point): number {
  let g = sb.gustinaVanZona;
  for (const z of sb.zoneGustine) {
    if (p.x < z.minX || p.x > z.maxX || p.y < z.minY || p.y > z.maxY) continue;
    if (uPoligonu(p, z.poligon)) g = z.gustina;
  }
  return Math.max(0, Math.min(GRAD_NPC_PO_GUSTINI_ZONE.length - 1, Math.round(g)));
}

/**
 * Koliko vozila treba oko igrača sada (odluka korisnika 2026-10-08): broj
 * po gustini zone u kojoj je igrač (`GRAD_NPC_PO_GUSTINI_ZONE`) × nivo × doba
 * dana (`gustina`), najviše `GRAD_NPC_NAJVISE`.
 */
export function ciljniBroj(sb: Saobracaj, fokus: Point): number {
  return Math.min(GRAD_NPC_NAJVISE, Math.round(GRAD_NPC_PO_GUSTINI_ZONE[gustinaZone(sb, fokus)]! * sb.gustina));
}

/**
 * Novo vozilo, ako ih fali: ivica u prstenu oko igrača (na početku i bliže),
 * cilj van prozora, ruta i plan kao kod bota. Mjesto pojave mora biti
 * slobodno. Najviše jedno na `GRAD_NPC_POJAVA_RITAM`.
 */
function pojavi(sb: Saobracaj, fokus: Point, tijela: readonly Tijelo[]): void {
  const cilj = ciljniBroj(sb, fokus);
  const ima = sb.npc.filter((n) => !n.vanjski).length;
  if (ima >= cilj) {
    sb.popunjeno = true;
    return;
  }
  // Prvo popunjavanje: sve odjednom (učitavanje); poslije, po jedno.
  const odjednom = sb.popunjeno ? 1 : cilj - ima;
  if (sb.popunjeno && sb.t - sb.zadnjaPojava < GRAD_NPC_POJAVA_RITAM) return;
  const zauzeto = [...tijela];
  for (let k = 0; k < odjednom; k++) {
    const n = novoVozilo(sb, fokus, zauzeto);
    if (!n) continue;
    sb.npc.push(n);
    zauzeto.push(tijeloNpc(n));
    sb.metrika.pojavljeno += 1;
    sb.zadnjaPojava = sb.t;
  }
  sb.popunjeno = true;
}

const PALETA_BOJA = 8;

function novoVozilo(sb: Saobracaj, fokus: Point, tijela: readonly Tijelo[]): Npc | null {
  const { mreza: m, raskrsnice: r, zabrane, zaSudiju } = sb.svijet;
  const sl = sb.slucajno;
  const odR = sb.popunjeno ? GRAD_NPC_POJAVA_OD : GRAD_NPC_POCETAK_OD;
  const daljina = (e: { x: number; y: number }) => Math.hypot(e.x - fokus.x, e.y - fokus.y);
  const prsten = sb.ivice.filter((e) => {
    const d = daljina(e);
    return d >= odR && d <= GRAD_NPC_POJAVA_DO;
  });
  if (prsten.length === 0) return null;
  // Dio vozila vozi do parkiranja (stavka 7e) — dok ima mjesta za još jedno.
  const parkira = sl() < GRAD_PARK_UDIO && sb.mjesta.length < GRAD_PARK_NAJVISE;
  for (let pokusaj = 0; pokusaj < 6; pokusaj++) {
    const e = prsten[Math.floor(sl() * prsten.length)]!;
    const iv = m.ivice[e.i]!;
    const smjer: 1 | -1 = iv.smjer !== 0 ? (iv.smjer as 1 | -1) : sl() < 0.5 ? 1 : -1;
    // Zone gustine 0: tu se vozila ne pojavljuju.
    if (sb.zoneGustine.length > 0 && gustinaZone(sb, e) === 0) continue;
    let mjesto: MjestoParkiranja | null = null;
    let cilj: { ivica: number; smjer: 1 | -1 };
    if (parkira) {
      // Parkiranje: slobodno mjesto na ulici `GRAD_NPC_CILJ_OD`–`DO` od
      // pojave — i u prozoru (parkirani se vide; nestaju sa udaljavanjem).
      const ulice = sb.uliceParkiranja.filter((u) => {
        const d = Math.hypot(u.x - e.x, u.y - e.y);
        return d >= GRAD_NPC_CILJ_OD && d <= GRAD_NPC_CILJ_DO;
      });
      if (ulice.length === 0) continue;
      const u = ulice[Math.floor(sl() * ulice.length)]!;
      const sMjesta = u.od + sl() * (u.do_ - u.od);
      if (!slobodno(sb.svijet, u, sMjesta, [...sb.mjesta, ...sb.bivsaMjesta])) continue;
      mjesto = mjestoNa(sb.svijet, u, sMjesta, 0, 0);
      cilj = { ivica: u.ivica, smjer: u.smjer };
    } else {
      // Cilj: van prozora, `GRAD_NPC_CILJ_OD`–`DO` od pojave.
      const ciljevi = sb.ivice.filter((c) => {
        const d = Math.hypot(c.x - e.x, c.y - e.y);
        return d >= GRAD_NPC_CILJ_OD && d <= GRAD_NPC_CILJ_DO && daljina(c) > GRAD_NPC_POJAVA_DO;
      });
      if (ciljevi.length === 0) continue;
      const c = ciljevi[Math.floor(sl() * ciljevi.length)]!;
      const civ = m.ivice[c.i]!;
      cilj = { ivica: c.i, smjer: civ.smjer !== 0 ? (civ.smjer as 1 | -1) : sl() < 0.5 ? 1 : -1 };
    }
    const koraci = ruta(m, r, zabrane, { ivica: e.i, smjer }, cilj, GRAD_NPC_A_ZVIJEZDA, ZA_NPC);
    if (!koraci || koraci.length < 2) continue;
    // Plan kao bot, ali sa manjom rezervom luka (vozi se tačno putanjom). Ruta
    // sa prolazom osovinom kroz čvor (luk ne staje u raskrsnicu: auto bi
    // zašlo lijevo pa naglo desno) ili sa neslaganjem sa sudijom se ne vozi.
    const plan = planBota(zaSudiju, koraci, undefined, GRAD_NPC_REZERVA_LUKA);
    if (plan.put.tacke.length < 2 || plan.neslaganja.length > 0 || plan.osovinom > 0) continue;
    // Obilazak parkiranih (i zauzetih mjesta), pa prilaz svom mjestu.
    obidji(plan, sb.mjesta, 0);
    if (mjesto && !doMjesta(plan, mjesto)) continue;
    const p0 = plan.put.tacke[0]!;
    if (tijela.some((o) => Math.hypot(o.x - p0.x, o.y - p0.y) < GRAD_NPC_POJAVA_SLOBODNO)) continue;
    // Ni uz pješaka (stavka 8): ne pojavljuje se na zebri preko koje neko ide.
    if (sb.pjesaci?.lista.some((x) => Math.hypot(x.x - p0.x, x.y - p0.y) < GRAD_PJ_POJAVA_VOZILA)) continue;
    const n = napraviNpc(sb, plan, koraci);
    // Kreće brzinom kojom se tu vozi — ali da stigne stati iza onoga ispred,
    // i pred prvom raskrsnicom (možda tamo mora ustupiti).
    const ispred = naPutu(n, tijela, 60);
    const prva = plan.prolazi[0];
    n.v = Math.min(
      dozvoljena(n),
      ispred ? sigurnaBrzina(dozvoljena(n), ispred.vl, ispred.gap) : Infinity,
      prva ? zaStati(mjestoCekanja(n, prva)) : Infinity,
      sb.pjesaci ? brzinaPredPjesacima(sb.pjesaci, plan) : Infinity,
    );
    if (ispred && ispred.gap < GRAD_NPC_RAZMAK + 3) continue;
    if (mjesto) {
      // Mjesto je zauzeto od sada: vozila koja su već na putu ga obilaze
      // (od malo ispred sebe, bez skoka).
      mjesto.id = n.id;
      mjesto.boja = n.boja;
      n.mjesto = mjesto;
      for (const o of sb.npc) obidji(o.plan, [mjesto], o.s + o.plan.vozilo.duzina);
      sb.mjesta.push(mjesto);
    }
    return n;
  }
  return null;
}

/** Novo vozilo na početku plana (stoji). */
function napraviNpc(sb: Saobracaj, plan: PlanBota, koraci: Korak[]): Npc {
  const p0 = plan.put.tacke[0]!;
  {
    const n: Npc = {
      id: sb.sljedeciId++,
      plan,
      koraci,
      s: 0,
      v: 0,
      a: 0,
      x: p0.x,
      y: p0.y,
      ugao: 0,
      nivo: plan.nivoi[0] ?? 0,
      rodjen: sb.t,
      boja: Math.floor(sb.slucajno() * PALETA_BOJA),
      zmigavac: null,
      stajao: plan.linije.map(() => 0),
      prosao: plan.linije.map(() => false),
      zutoStaje: plan.linije.map(() => null),
      vidioZeleno: plan.linije.map(() => false),
      strelica: plan.linije.map(() => false),
      poslijeStrelice: plan.linije.map(() => false),
      kursor: 0,
      prolaz: 0,
      cekaProlaz: 0,
      cekaOd: null,
      razlog: { vrsta: "slobodno" },
      stoji: 0,
      bezRazloga: 0,
      forsiranDo: -Infinity,
      geometrija: [],
      sukobi: new Map(),
      usaoOd: new Map(),
      presaoLinijuOd: new Map(),
      pjesackiZuto: new Map(),
      pjesackiZeleno: new Set(),
      namjere: new Map(),
    };
    postaviPozu(n);
    return n;
  }
}

/**
 * Vozilo sa zadatom rutom (testovi, kasnije zadaci): plan kao kod drugih
 * vozača, početna brzina `v`. Vraća ga, ili `null` kad plana nema.
 */
export function dodajVozilo(sb: Saobracaj, koraci: Korak[], v = 0): Npc | null {
  const plan = planBota(sb.svijet.zaSudiju, koraci, undefined, GRAD_NPC_REZERVA_LUKA);
  if (plan.put.tacke.length < 2) return null;
  obidji(plan, sb.mjesta, 0);
  const n = napraviNpc(sb, plan, koraci);
  n.v = v;
  sb.npc.push(n);
  sb.popunjeno = true;
  return n;
}

/**
 * Oduzeto prvenstvo (stavka 7c): igrač je prošao raskrsnicu `r` (sa kraka
 * `ulaz` na `izlaz`, manevrom `manevar`, ušao u `od`, izašao u `do_`), a neko
 * je u njoj zbog njega naglo kočio — i imao je prednost (po pravilu, ili je
 * već bio u raskrsnici). Vraća to kočenje, ili `null`.
 */
export function oduzetoPrvenstvo(
  sb: Saobracaj,
  prolaz: {
    r: number;
    ulaz: number;
    izlaz: number;
    manevar: Manevar;
    od: number;
    do_: number;
    izUnutrasnje?: boolean;
    /** Kad je igrač ušao u raskrsnicu [s] — ko je bio unutra prije njega, njega je trebalo pustiti. */
    ulazak?: number;
  },
): KocenjeZbogIgraca | null {
  const m = sb.svijet.mreza;
  const rs = sb.svijet.raskrsnice.lista[prolaz.r]!;
  const ki = rs.kraci.findIndex((k) => k.ivica === prolaz.ulaz && k.ulaz);
  const kz = rs.kraci.findIndex((k) => k.ivica === prolaz.izlaz && k.izlaz);
  if (ki < 0 || kz < 0) return null;
  for (const k of sb.kocenja) {
    if (k.r !== prolaz.r || k.t < prolaz.od || k.t > prolaz.do_) continue;
    // Sa istog kraka: vozi iza igrača — to je razmak, ne prvenstvo.
    if (k.ucesnik.ulaz === ki) continue;
    const ja: UcesnikPrednosti = {
      ulaz: ki,
      izlaz: kz,
      manevar: prolaz.manevar,
      kontrola: kontrolaUcesnika(rs, ki, k.t, prolaz.manevar),
      uPrstenu: m.ivice[prolaz.ulaz]!.kruzni,
      izUnutrasnje: m.ivice[prolaz.ulaz]!.kruzni && !m.ivice[prolaz.izlaz]!.kruzni && Boolean(prolaz.izUnutrasnje),
      ukljucivanje: rs.kraci[ki]!.klasa === "service",
    };
    // Bio je u raskrsnici prije igrača: njega je trebalo pustiti. Ušao
    // poslije njega — o tome odlučuje prvenstvo.
    const bioUnutra = k.usao && k.usaoOd !== null && (prolaz.ulazak === undefined || k.usaoOd <= prolaz.ulazak);
    if (bioUnutra || koUstupa(m, rs, ja, k.ucesnik) === "a") return k;
  }
  return null;
}

/**
 * Da li igrač stoji zbog saobraćaja (za sudiju — to nije parkiranje): drugo
 * vozilo mu je tik ispred u traci (`GRAD_IGRAC_KOLONA`), pješak je ispred na
 * prelazu ili na ivičnjaku pred njim (stavka 8), ili je igrač u
 * raskrsnici `r`, a kroz nju se kreće neko drugi (`GRAD_IGRAC_CEKA_PROLAZ`).
 * Igrač nema plan, pa se ne zna kome ustupa — samo da ima kome.
 */
export function igracCekaSaobracaj(sb: Saobracaj, igrac: Tijelo, r: number | null): boolean {
  const hx = Math.cos(igrac.ugao);
  const hy = Math.sin(igrac.ugao);
  // Pješak ispred, na prelazu ili na ivičnjaku pred njim (stavka 8): igrač mu ustupa.
  for (const x of sb.pjesaci?.lista ?? []) {
    if (x.stanje === "hoda") continue;
    const dx = x.x - igrac.x;
    const dy = x.y - igrac.y;
    const naprijed = dx * hx + dy * hy;
    if (naprijed > 0 && naprijed < GRAD_IGRAC_KOLONA + CAR_LENGTH && Math.abs(-dx * hy + dy * hx) < 3 * CAR_WIDTH) return true;
  }
  for (const n of sb.npc) {
    if (n.vanjski || n.nivo !== igrac.nivo) continue;
    const dx = n.x - igrac.x;
    const dy = n.y - igrac.y;
    const naprijed = dx * hx + dy * hy;
    const { duzina, sirina } = n.plan.vozilo;
    if (naprijed > 0 && naprijed < GRAD_IGRAC_KOLONA + (CAR_LENGTH + duzina) / 2 && Math.abs(-dx * hy + dy * hx) < (CAR_WIDTH + sirina) / 2) return true;
    if (r === null || n.v < 1) continue;
    for (let qi = n.prolaz; qi < Math.min(n.plan.prolazi.length, n.prolaz + 2); qi++) {
      const q = n.plan.prolazi[qi]!;
      if (q.r === r && n.s > q.od - GRAD_IGRAC_CEKA_PROLAZ && n.s < q.do_) return true;
    }
  }
  return false;
}

/**
 * Za dijagnozu (fuzz, `?debug=1`): za vozilo `id` i njegovu sljedeću
 * raskrsnicu — svaki drugi učesnik u njoj, sukob putanja i ko kome ustupa.
 */
export function opisUstupanja(sb: Saobracaj, id: number): string[] {
  const n = sb.npc.find((x) => x.id === id);
  if (!n) return [];
  const qi = n.cekaProlaz;
  const q = n.plan.prolazi[qi];
  if (!q) return [];
  const poRaskrsnici = new Map<number, Dolazak[]>();
  for (const o of sb.npc) {
    for (let k = o.prolaz; k < o.plan.prolazi.length; k++) {
      const x = o.plan.prolazi[k]!;
      if (x.od - o.s > GRAD_NPC_HORIZONT + 40) break;
      if (o.s > x.do_ || x.r !== q.r) continue;
      poRaskrsnici.set(x.r, [...(poRaskrsnici.get(x.r) ?? []), dolazakNpc(sb, o, k, sb.t)]);
    }
  }
  const ja = dolazakNpc(sb, n, qi, sb.t);
  const m = sb.svijet.mreza;
  const r = sb.svijet.raskrsnice.lista[q.r]!;
  return (poRaskrsnici.get(q.r) ?? [])
    .filter((on) => on.id !== id)
    .map((on) => {
      const sk = sukob(n, ja, on);
      const pr = koUstupa(m, r, ja.ucesnik, on.ucesnik);
      return `${on.id}: sukob ${sk ? `${sk.sa.toFixed(1)}/${sk.sb.toFixed(1)}${sk.spajanje ? " spajanje" : ""}` : "-"} ustupa ${pr} usao ${on.usao} ceka ${on.ceka} kolona ${on.uKoloni} cekaOd ${on.cekaOd} | ja ${JSON.stringify(ja.ucesnik)} on ${JSON.stringify(on.ucesnik)} | ja tacke0 ${ja.tacke[0]?.x.toFixed(1)},${ja.tacke[0]?.y.toFixed(1)} s0 ${ja.s0.toFixed(1)} on tacke0 ${on.tacke[0]?.x.toFixed(1)},${on.tacke[0]?.y.toFixed(1)} s0 ${on.s0.toFixed(1)}`;
    });
}
