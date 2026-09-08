/**
 * Graf puteva Crne Gore.
 *
 * Ovo je **podatak**, ne model: čvorovi i ivice su unijeti onako kako su
 * zadati, bez dopunjavanja. Ako neka veza fali za povezanost, to je greška u
 * unosu i prijavljuje se — ne izmišlja se ivica da bi test prošao.
 *
 * Zašto neusmjeren graf: put se vozi u oba smjera, pa bi dvije ivice po vezi
 * značile dva mjesta na kojima se ista dužina može razići. Smjer vožnje je
 * stvar putovanja, ne mreže; sve što zavisi od smjera (strana na kojoj je
 * znamenitost, `atKm`) mjeri se od kraja `a` prema `b`.
 *
 * Jedinice su ovdje kilometri i km/h — jedinice karte i saobraćajnog znaka.
 * Simulacija radi u metrima i m/s i pretvara ih kad dionica uđe u vožnju.
 */

import {
  MOUNTAIN_ADVISORY_MAX,
  MOUNTAIN_ADVISORY_MIN,
  MOUNTAIN_ADVISORY_STEP,
  MOUNTAIN_CURVES_MAX,
  MOUNTAIN_CURVES_MIN,
  SPEED_LIMIT_KMH_BY_ROAD,
} from "../sim/config";
import { rng } from "../sim/geometry";

/** Vrsta puta. `gradski` se ne unosi — generiše se unutar čvora. */
export type RoadKind = "autoput" | "magistrala" | "regionalni" | "planinski" | "gradski";

/**
 * Šta je čvor.
 *
 * `cvoriste` nije grad nego tačka odluke (raskrsnica, ulaz na autoput,
 * trajekt). Igraču se prikazuje isto kao grad, ali nema svoju gradsku vožnju.
 */
export type NodeKind = "opstina" | "cvoriste" | "granica";

export type Country = "ALB" | "HRV" | "BIH" | "SRB" | "KOS";

export interface RoadNode {
  id: string;
  name: string;
  kind: NodeKind;
  /** Samo za `granica`: država sa druge strane. */
  country?: Country;
}

export interface RoadEdge {
  /** `a--b`, po čvorovima kako su unijeti. */
  id: string;
  a: string;
  b: string;
  kind: RoadKind;
  km: number;
  /** [km/h] — podrazumijevano po vrsti puta, osim ako ivica kaže drugačije. */
  speedLimit: number;
  /** `false` = veza je vjerovatno tačna, ali je škola još provjerava. */
  verified: boolean;
  /** Prohodno samo ljeti; nudi se samo ako je „ljeto" uključeno. */
  seasonal: boolean;
  /** Trajekt: kratak segment bez saobraćaja. */
  ferry: boolean;
  /**
   * Put se na drugom kraju završava — dalje se nema kuda.
   *
   * Stoji na ivici, ne na čvoru, da bi postojao samo jedan izvor istine: čvor
   * je slijep tačno onda kad su sve ivice koje do njega vode ovako označene.
   * Ponašanje je isto kao na granici — poruka i ponuda okretanja.
   */
  deadEnd: boolean;
  /** Fiksan broj krivina; bez ovoga se broj izvlači iz sjemena. */
  curves?: number;
}

// ── Čvorovi ─────────────────────────────────────────────────────────────────

const OPSTINE: ReadonlyArray<readonly [string, string]> = [
  ["podgorica", "Podgorica"],
  ["zeta", "Zeta (Golubovci)"],
  ["tuzi", "Tuzi"],
  ["danilovgrad", "Danilovgrad"],
  ["niksic", "Nikšić"],
  ["cetinje", "Cetinje"],
  ["budva", "Budva"],
  ["tivat", "Tivat"],
  ["kotor", "Kotor"],
  ["herceg-novi", "Herceg Novi"],
  ["bar", "Bar"],
  ["ulcinj", "Ulcinj"],
  ["kolasin", "Kolašin"],
  ["mojkovac", "Mojkovac"],
  ["bijelo-polje", "Bijelo Polje"],
  ["berane", "Berane"],
  ["petnjica", "Petnjica"],
  ["andrijevica", "Andrijevica"],
  ["plav", "Plav"],
  ["gusinje", "Gusinje"],
  ["rozaje", "Rožaje"],
  ["zabljak", "Žabljak"],
  ["pljevlja", "Pljevlja"],
  ["savnik", "Šavnik"],
  ["pluzine", "Plužine"],
];

const CVORISTA: ReadonlyArray<readonly [string, string]> = [
  ["smokovac", "Smokovac"],
  ["matesevo", "Mateševo"],
  ["virpazar", "Virpazar"],
  ["petrovac", "Petrovac"],
  ["sutomore", "Sutomore"],
  ["bioce", "Bioče"],
  ["djurdjevica-tara", "Đurđevića Tara"],
  ["vilusi", "Vilusi"],
  ["kamenari", "Kamenari"],
  ["njegusi", "Njeguši"],
  ["kucka-korita", "Kučka Korita"],
];

const GRANICE: ReadonlyArray<readonly [string, string, Country]> = [
  ["bozaj", "Božaj", "ALB"],
  ["sukobin", "Sukobin", "ALB"],
  ["debeli-brijeg", "Debeli Brijeg", "HRV"],
  ["scepan-polje", "Šćepan Polje", "BIH"],
  ["ilino-brdo", "Ilino Brdo", "BIH"],
  ["dobrakovo", "Dobrakovo", "SRB"],
  ["dracenovac", "Dračenovac", "SRB"],
  ["kula", "Kula", "KOS"],
  ["rance-jabuka", "Ranče/Jabuka", "SRB"],
];

export const NODES: readonly RoadNode[] = [
  ...OPSTINE.map(([id, name]): RoadNode => ({ id, name, kind: "opstina" })),
  ...CVORISTA.map(([id, name]): RoadNode => ({ id, name, kind: "cvoriste" })),
  ...GRANICE.map(([id, name, country]): RoadNode => ({ id, name, kind: "granica", country })),
];

// ── Ivice ───────────────────────────────────────────────────────────────────

interface EdgeInput {
  a: string;
  b: string;
  kind: RoadKind;
  km: number;
  /** Izostavljeno = provjereno. */
  verified?: false;
  seasonal?: true;
  ferry?: true;
  deadEnd?: true;
  curves?: number;
  speedLimit?: number;
}

const EDGE_INPUT: readonly EdgeInput[] = [
  // Centar
  { a: "podgorica", b: "danilovgrad", kind: "magistrala", km: 20 },
  { a: "danilovgrad", b: "niksic", kind: "magistrala", km: 35 },
  { a: "podgorica", b: "zeta", kind: "magistrala", km: 12 },
  { a: "podgorica", b: "tuzi", kind: "magistrala", km: 12 },
  { a: "tuzi", b: "bozaj", kind: "magistrala", km: 10 },
  { a: "podgorica", b: "cetinje", kind: "magistrala", km: 30 },
  { a: "podgorica", b: "smokovac", kind: "magistrala", km: 8 },
  { a: "smokovac", b: "matesevo", kind: "autoput", km: 41 },
  { a: "podgorica", b: "bioce", kind: "magistrala", km: 12 },
  // Slijep put: gore se stane i vraća se istim putem.
  { a: "podgorica", b: "kucka-korita", kind: "planinski", km: 35, deadEnd: true },
  // Kanjon Morače, Platije.
  { a: "bioce", b: "kolasin", kind: "planinski", km: 60 },
  { a: "matesevo", b: "kolasin", kind: "regionalni", km: 15 },
  { a: "matesevo", b: "andrijevica", kind: "regionalni", km: 30 },

  // Sjever
  { a: "kolasin", b: "mojkovac", kind: "magistrala", km: 25 },
  { a: "mojkovac", b: "bijelo-polje", kind: "magistrala", km: 25 },
  // Kanjon Tare.
  { a: "mojkovac", b: "djurdjevica-tara", kind: "planinski", km: 40 },
  { a: "djurdjevica-tara", b: "zabljak", kind: "regionalni", km: 20 },
  { a: "djurdjevica-tara", b: "pljevlja", kind: "magistrala", km: 35 },
  { a: "pljevlja", b: "rance-jabuka", kind: "magistrala", km: 20 },
  { a: "pljevlja", b: "bijelo-polje", kind: "regionalni", km: 60, verified: false },
  { a: "bijelo-polje", b: "dobrakovo", kind: "magistrala", km: 20 },
  { a: "bijelo-polje", b: "berane", kind: "magistrala", km: 35 },
  { a: "berane", b: "petnjica", kind: "regionalni", km: 20 },
  { a: "berane", b: "rozaje", kind: "magistrala", km: 35 },
  { a: "rozaje", b: "dracenovac", kind: "magistrala", km: 20 },
  { a: "rozaje", b: "kula", kind: "magistrala", km: 25 },
  { a: "berane", b: "andrijevica", kind: "magistrala", km: 20 },
  { a: "andrijevica", b: "plav", kind: "magistrala", km: 25 },
  { a: "plav", b: "gusinje", kind: "regionalni", km: 10 },
  { a: "zabljak", b: "savnik", kind: "planinski", km: 40 },
  { a: "savnik", b: "niksic", kind: "magistrala", km: 40 },
  // Preko Trse.
  { a: "zabljak", b: "pluzine", kind: "planinski", km: 45, seasonal: true },
  { a: "niksic", b: "pluzine", kind: "magistrala", km: 60 },
  { a: "pluzine", b: "scepan-polje", kind: "planinski", km: 25 },
  { a: "niksic", b: "vilusi", kind: "magistrala", km: 30 },
  { a: "vilusi", b: "ilino-brdo", kind: "magistrala", km: 10 },
  // Preko Grahova.
  { a: "vilusi", b: "herceg-novi", kind: "planinski", km: 50, verified: false },

  // Jug i primorje
  // Serpentine Brajići.
  { a: "cetinje", b: "budva", kind: "magistrala", km: 30 },
  { a: "cetinje", b: "njegusi", kind: "planinski", km: 15 },
  // Dvadeset pet serpentina na terenu; u igri fiksno dvanaest krivina.
  { a: "njegusi", b: "kotor", kind: "planinski", km: 20, curves: 12 },
  { a: "podgorica", b: "virpazar", kind: "magistrala", km: 30 },
  // Tunel Sozina.
  { a: "virpazar", b: "bar", kind: "magistrala", km: 25 },
  { a: "virpazar", b: "petrovac", kind: "regionalni", km: 20, verified: false },
  { a: "bar", b: "ulcinj", kind: "magistrala", km: 25 },
  { a: "ulcinj", b: "sukobin", kind: "magistrala", km: 20 },
  { a: "bar", b: "sutomore", kind: "magistrala", km: 10 },
  { a: "sutomore", b: "petrovac", kind: "magistrala", km: 12 },
  { a: "petrovac", b: "budva", kind: "magistrala", km: 18 },
  { a: "budva", b: "tivat", kind: "magistrala", km: 20 },
  { a: "tivat", b: "kotor", kind: "magistrala", km: 12 },
  // Preko Perasta i Risna.
  { a: "kotor", b: "kamenari", kind: "magistrala", km: 30 },
  // Lepetane — Kamenari.
  { a: "tivat", b: "kamenari", kind: "regionalni", km: 8, ferry: true },
  { a: "kamenari", b: "herceg-novi", kind: "magistrala", km: 15 },
  { a: "herceg-novi", b: "debeli-brijeg", kind: "magistrala", km: 8 },
];

export const EDGES: readonly RoadEdge[] = EDGE_INPUT.map((e) => ({
  id: `${e.a}--${e.b}`,
  a: e.a,
  b: e.b,
  kind: e.kind,
  km: e.km,
  speedLimit: e.speedLimit ?? SPEED_LIMIT_KMH_BY_ROAD[e.kind],
  verified: e.verified ?? true,
  seasonal: e.seasonal ?? false,
  ferry: e.ferry ?? false,
  deadEnd: e.deadEnd ?? false,
  ...(e.curves === undefined ? {} : { curves: e.curves }),
}));

// ── Pretraga ────────────────────────────────────────────────────────────────

const NODE_BY_ID = new Map(NODES.map((n) => [n.id, n] as const));
const EDGE_BY_ID = new Map(EDGES.map((e) => [e.id, e] as const));

const ADJ: ReadonlyMap<string, readonly RoadEdge[]> = (() => {
  const m = new Map<string, RoadEdge[]>();
  for (const n of NODES) m.set(n.id, []);
  for (const e of EDGES) {
    m.get(e.a)?.push(e);
    m.get(e.b)?.push(e);
  }
  return m;
})();

export function nodeById(id: string): RoadNode | undefined {
  return NODE_BY_ID.get(id);
}

export function edgeById(id: string): RoadEdge | undefined {
  return EDGE_BY_ID.get(id);
}

/** Drugi kraj ivice, gledano iz čvora `from`. */
export function otherEnd(edge: RoadEdge, from: string): string {
  return edge.a === from ? edge.b : edge.a;
}

/** Sve ivice koje izlaze iz čvora, bez ikakvog filtriranja. */
export function edgesAt(nodeId: string): readonly RoadEdge[] {
  return ADJ.get(nodeId) ?? [];
}

// ── Putokaz ─────────────────────────────────────────────────────────────────

/** Jedan ponuđeni pravac sa putokaza. */
export interface Smjer {
  edge: RoadEdge;
  to: RoadNode;
}

export interface Putokaz {
  /** Isključivo susjedi ovog čvora, bez onoga odakle se došlo. */
  smjerovi: Smjer[];
  /** Nema kuda dalje — nudi se okretanje. */
  krajPuta: boolean;
  /** Pravac nazad, ako se uopšte odnekud došlo. */
  nazad: Smjer | null;
  /** Postavljeno ako je čvor granični prelaz: tu se put završava. */
  granica: RoadNode | null;
  /**
   * Postavljeno ako je čvor slijep kraj puta (nije granica).
   *
   * Nije isto što i `krajPuta`: opština koja je u ovom skupu list grafa — Zeta,
   * Petnjica, Gusinje — nema kuda dalje samo zato što mreža ovdje prestaje, a
   * ne zato što se put stvarno završava. Poruka „kraj puta" ide samo ovdje.
   */
  slijepiKraj: RoadNode | null;
}

/** Čvor je slijep kad su sve ivice do njega tako označene. */
function slijepCvor(nodeId: string): boolean {
  const ivice = edgesAt(nodeId);
  return ivice.length > 0 && ivice.every((e) => e.deadEnd);
}

/**
 * Šta putokaz na čvoru smije da prikaže.
 *
 * Jedini izvor je susjedstvo u grafu. Grad koji nije direktan susjed se ne
 * prikazuje čak i kad je „logično" da bi trebalo — to je pravilo, a ne mjera
 * opreza, jer bi svaki drugi izvor značio da igra uči polaznika izmišljenoj
 * mreži puteva.
 */
export function putokazi(
  nodeId: string,
  { odakle = null, ljeto = true }: { odakle?: string | null; ljeto?: boolean } = {},
): Putokaz {
  const cvor = nodeById(nodeId);
  const smjer = (e: RoadEdge): Smjer | null => {
    const to = nodeById(otherEnd(e, nodeId));
    return to ? { edge: e, to } : null;
  };

  const smjerovi: Smjer[] = [];
  let nazad: Smjer | null = null;
  for (const e of edgesAt(nodeId)) {
    const s = smjer(e);
    if (!s) continue;
    if (odakle !== null && s.to.id === odakle) {
      // Pravac odakle se došlo ostaje dostupan kao okretanje, ali nije ponuda.
      if (!nazad) nazad = s;
      continue;
    }
    if (ljeto || !e.seasonal) smjerovi.push(s);
  }

  return {
    smjerovi,
    krajPuta: smjerovi.length === 0,
    nazad,
    granica: cvor && cvor.kind === "granica" ? cvor : null,
    slijepiKraj: cvor && cvor.kind !== "granica" && slijepCvor(cvor.id) ? cvor : null,
  };
}

// ── Krivine na planinskim ivicama ───────────────────────────────────────────

export interface Curve {
  atKm: number;
  /** Preporučena brzina [km/h]. */
  advisorySpeed: number;
  side: "left" | "right";
}

/** FNV-1a — da ista ivica sa istim sjemenom putovanja uvijek da iste krivine. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Krivine na jednoj ivici.
 *
 * Samo planinske ivice ih imaju. Broj je 4–8 po sjemenu, osim gdje je ivica
 * zadala svoj (Njeguši — Kotor). Raspoređene su tako da se ne sabiju jedna na
 * drugu: dužina se dijeli na jednake razmake i unutar svakog se krivina
 * pomjeri, umjesto slobodnog izvlačenja po cijeloj dionici.
 */
export function curvesFor(edge: RoadEdge, seed: number): Curve[] {
  if (edge.kind !== "planinski") return [];
  const r = rng((seed ^ hash(edge.id)) >>> 0);
  const raspon = MOUNTAIN_CURVES_MAX - MOUNTAIN_CURVES_MIN + 1;
  const n = edge.curves ?? MOUNTAIN_CURVES_MIN + Math.floor(r() * raspon);
  const koraka =
    Math.floor((MOUNTAIN_ADVISORY_MAX - MOUNTAIN_ADVISORY_MIN) / MOUNTAIN_ADVISORY_STEP) + 1;
  // Serpentine se smjenjuju lijevo-desno; iz sjemena dolazi samo prva strana.
  const prvaLijevo = r() < 0.5;
  const razmak = edge.km / (n + 1);

  const out: Curve[] = [];
  for (let i = 0; i < n; i++) {
    const pomjeraj = (r() - 0.5) * razmak * 0.6;
    out.push({
      atKm: Math.round(((i + 1) * razmak + pomjeraj) * 100) / 100,
      advisorySpeed: MOUNTAIN_ADVISORY_MIN + Math.floor(r() * koraka) * MOUNTAIN_ADVISORY_STEP,
      side: (i % 2 === 0) === prvaLijevo ? "left" : "right",
    });
  }
  return out;
}
