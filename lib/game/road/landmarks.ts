/**
 * Znamenitosti uz put.
 *
 * Podatak, kao i graf. Ono što je zadato — naziv, ivica ili čvor — unijeto je
 * doslovno; ono što nije zadato, a treba igri — koliko je znamenitost daleko
 * po dionici (`atKm`) i sa koje je strane puta — **procijenjeno je** i zato
 * svaka stavka nosi `positionVerified: false`. To polje nije formalnost: dok
 * je `false`, položaj se smije pomjerati bez ikakve rasprave.
 *
 * `atKm` se mjeri od kraja `a` ivice prema `b` (vidi `roadGraph.ts`), a
 * `side` je strana gledano u tom istom smjeru. Vožnja u suprotnom smjeru
 * preslikava oboje — to je posao prikaza, ne podatka.
 */

import { edgeById, nodeById } from "./roadGraph";

export type LandmarkType =
  | "manastir"
  | "crkva"
  | "dzamija"
  | "mauzolej"
  | "tvrdjava"
  | "grad"
  | "anticki"
  | "ruina"
  | "dvorac"
  | "kuca"
  | "spomenik"
  | "most"
  | "tunel"
  | "trajekt"
  | "marina"
  | "jezero"
  | "kanjon"
  | "vodopad"
  | "izvor"
  | "planina"
  | "vidikovac"
  | "plaza"
  | "ostrvo"
  | "pecina"
  | "drvo";

export type LandmarkAt =
  | { kind: "node"; node: string }
  | { kind: "edge"; edge: string; atKm: number; side: "left" | "right" };

export interface Landmark {
  id: string;
  name: string;
  type: LandmarkType;
  at: LandmarkAt;
  /** Putanja do ikone, 64×64. */
  icon: string;
  /** `true` = ikona vrste, ne same znamenitosti; zamjenjiva. */
  iconGeneric: boolean;
  /** Uvijek `false`: `atKm` i `side` su procjena. */
  positionVerified: boolean;
  /**
   * Nije uz put nego na planinskoj stazi — prikazuje se samo kao kartica, ne
   * kao objekat pored puta.
   */
  cardOnly?: boolean;
}

export const ICON_DIR = "/assets/landmarks";

/** Ikona vrste, kad znamenitost nema svoju. */
export function genericIcon(type: LandmarkType): string {
  return `${ICON_DIR}/tip-${type}.svg`;
}

type LandmarkInput = {
  id: string;
  name: string;
  type: LandmarkType;
  /** Naziv fajla svoje ikone; bez ovoga se uzima ikona vrste. */
  icon?: string;
  cardOnly?: true;
} & ({ node: string } | { edge: string; atKm: number; side: "left" | "right" });

const INPUT: readonly LandmarkInput[] = [
  // ── Podgorica i okolina ───────────────────────────────────────────────────
  { id: "duklja", name: "Duklja (Doclea)", type: "anticki", node: "podgorica", icon: "duklja.svg" },
  { id: "sahat-kula", name: "Sahat kula", type: "spomenik", node: "podgorica", icon: "sahat-kula.svg" },
  { id: "niagara-cijevna", name: "Niagara vodopad na Cijevni", type: "vodopad", edge: "podgorica--tuzi", atKm: 5, side: "right" },
  { id: "manastir-dajbabe", name: "Manastir Dajbabe", type: "manastir", edge: "podgorica--zeta", atKm: 4, side: "right" },
  { id: "kanjon-cijevne", name: "Kanjon Cijevne", type: "kanjon", edge: "tuzi--bozaj", atKm: 4, side: "left" },
  { id: "vranjina", name: "Vranjina i manastir", type: "manastir", edge: "podgorica--virpazar", atKm: 22, side: "right" },
  { id: "skadarsko-jezero-vidikovac", name: "Skadarsko jezero, vidikovac", type: "vidikovac", edge: "podgorica--virpazar", atKm: 25, side: "left" },
  { id: "rijeka-crnojevica", name: "Rijeka Crnojevića, stari most", type: "most", node: "virpazar" },
  { id: "kanjon-mrtvice", name: "Kanjon Mrtvice", type: "kanjon", edge: "bioce--kolasin", atKm: 30, side: "right" },
  { id: "platije", name: "Platije, kanjon Morače", type: "kanjon", edge: "bioce--kolasin", atKm: 18, side: "left" },
  { id: "manastir-moraca", name: "Manastir Morača", type: "manastir", edge: "bioce--kolasin", atKm: 38, side: "right" },
  { id: "manastir-ostrog", name: "Manastir Ostrog", type: "manastir", edge: "danilovgrad--niksic", atKm: 12, side: "right", icon: "manastir-ostrog.svg" },
  { id: "spuz", name: "Spuž, tvrđava", type: "tvrdjava", edge: "podgorica--danilovgrad", atKm: 12, side: "left" },
  { id: "manastir-zdrebaonik", name: "Manastir Ždrebaonik", type: "manastir", edge: "podgorica--danilovgrad", atKm: 17, side: "right" },
  { id: "bedem-niksic", name: "Bedem, tvrđava Nikšić", type: "tvrdjava", node: "niksic" },
  { id: "carev-most", name: "Carev most", type: "most", node: "niksic" },
  { id: "slansko-jezero", name: "Slansko jezero", type: "jezero", edge: "niksic--vilusi", atKm: 5, side: "right" },
  { id: "krupacko-jezero", name: "Krupačko jezero", type: "jezero", edge: "niksic--vilusi", atKm: 10, side: "left" },

  // ── Sjever ────────────────────────────────────────────────────────────────
  { id: "biogradska-gora", name: "Biogradska gora i Biogradsko jezero", type: "jezero", edge: "kolasin--mojkovac", atKm: 12, side: "right" },
  { id: "bjelasica-vidikovac", name: "Bjelasica, vidikovac", type: "vidikovac", edge: "kolasin--mojkovac", atKm: 9, side: "right" },
  { id: "manastir-dobrilovina", name: "Manastir Dobrilovina", type: "manastir", edge: "mojkovac--djurdjevica-tara", atKm: 20, side: "left" },
  { id: "most-na-tari", name: "Most na Đurđevića Tari", type: "most", node: "djurdjevica-tara", icon: "most-na-tari.svg" },
  { id: "kanjon-tare-vidikovac", name: "Kanjon Tare, vidikovac", type: "vidikovac", edge: "mojkovac--djurdjevica-tara", atKm: 33, side: "right" },
  { id: "crno-jezero", name: "Durmitor, Crno jezero", type: "jezero", node: "zabljak", icon: "crno-jezero.svg" },
  { id: "kanjon-nevidio", name: "Kanjon Nevidio", type: "kanjon", edge: "zabljak--savnik", atKm: 25, side: "left" },
  { id: "sinjajevina", name: "Sinjajevina", type: "planina", edge: "zabljak--savnik", atKm: 10, side: "left" },
  { id: "pivsko-jezero", name: "Pivsko jezero", type: "jezero", edge: "niksic--pluzine", atKm: 45, side: "left" },
  { id: "manastir-piva", name: "Manastir Piva", type: "manastir", edge: "niksic--pluzine", atKm: 56, side: "right" },
  { id: "kanjon-pive-vidikovac", name: "Kanjon Pive, vidikovac", type: "vidikovac", edge: "pluzine--scepan-polje", atKm: 10, side: "left" },
  { id: "husein-pasina-dzamija", name: "Husein-pašina džamija", type: "dzamija", node: "pljevlja", icon: "husein-pasina-dzamija.svg" },
  { id: "manastir-sveta-trojica", name: "Manastir Sveta Trojica", type: "manastir", node: "pljevlja" },
  { id: "djalovica-pecina", name: "Đalovića pećina", type: "pecina", edge: "bijelo-polje--berane", atKm: 12, side: "left" },
  { id: "crkva-petra-i-pavla", name: "Crkva Svetog Petra i Pavla", type: "crkva", node: "bijelo-polje" },
  { id: "djurdjevi-stupovi", name: "Đurđevi stupovi", type: "manastir", node: "berane" },
  { id: "manastir-sudikova", name: "Manastir Šudikova", type: "manastir", edge: "berane--andrijevica", atKm: 5, side: "right" },
  { id: "komovi-vidikovac", name: "Komovi, vidikovac", type: "vidikovac", edge: "matesevo--andrijevica", atKm: 18, side: "right" },
  { id: "plavsko-jezero", name: "Plavsko jezero", type: "jezero", node: "plav" },
  { id: "ali-pasini-izvori", name: "Ali-pašini izvori", type: "izvor", edge: "plav--gusinje", atKm: 7, side: "left" },
  { id: "prokletije-grebaje", name: "Prokletije, Grebaje", type: "planina", node: "gusinje" },
  { id: "hridsko-jezero", name: "Hridsko jezero", type: "jezero", node: "plav", cardOnly: true },
  { id: "izvor-ibra", name: "Izvor Ibra", type: "izvor", node: "rozaje" },
  { id: "kucka-korita", name: "Kučka Korita", type: "planina", node: "kucka-korita" },

  // ── Cetinje, Lovćen, Boka ─────────────────────────────────────────────────
  { id: "cetinjski-manastir", name: "Cetinjski manastir", type: "manastir", node: "cetinje" },
  { id: "dvorac-kralja-nikole-cetinje", name: "Dvorac kralja Nikole", type: "dvorac", node: "cetinje" },
  { id: "lipska-pecina", name: "Lipska pećina", type: "pecina", edge: "podgorica--cetinje", atKm: 26, side: "right" },
  { id: "njegosev-mauzolej", name: "Lovćen, Njegošev mauzolej", type: "mauzolej", edge: "cetinje--njegusi", atKm: 10, side: "left", icon: "njegosev-mauzolej.svg" },
  { id: "njegusi-rodna-kuca", name: "Njeguši, rodna kuća Njegoša", type: "kuca", node: "njegusi" },
  { id: "serpentine-kotor-lovcen", name: "Serpentine Kotor–Lovćen, vidikovac", type: "vidikovac", edge: "njegusi--kotor", atKm: 8, side: "left", icon: "serpentine.svg" },
  { id: "kotor-stari-grad", name: "Stari grad Kotor, bedemi Sveti Ivan", type: "grad", node: "kotor", icon: "kotor-bedemi.svg" },
  { id: "perast", name: "Perast", type: "grad", edge: "kotor--kamenari", atKm: 12, side: "left" },
  { id: "gospa-od-skrpjela", name: "Gospa od Škrpjela", type: "ostrvo", edge: "kotor--kamenari", atKm: 13, side: "left", icon: "gospa-od-skrpjela.svg" },
  { id: "risan-mozaici", name: "Risan, rimski mozaici", type: "anticki", edge: "kotor--kamenari", atKm: 18, side: "right" },
  { id: "trajekt-kamenari-lepetane", name: "Trajekt Kamenari–Lepetane", type: "trajekt", node: "kamenari", icon: "trajekt.svg" },
  { id: "manastir-savina", name: "Manastir Savina", type: "manastir", edge: "kamenari--herceg-novi", atKm: 12, side: "left" },
  { id: "kanli-kula", name: "Kanli kula, Forte Mare", type: "tvrdjava", node: "herceg-novi" },
  { id: "mamula", name: "Ostrvo Mamula, vidikovac", type: "ostrvo", edge: "herceg-novi--debeli-brijeg", atKm: 5, side: "left" },
  { id: "porto-montenegro", name: "Porto Montenegro", type: "marina", node: "tivat", icon: "porto-montenegro.svg" },
  { id: "ostrvo-cvijeca", name: "Ostrvo cvijeća", type: "ostrvo", edge: "tivat--kotor", atKm: 3, side: "left" },

  // ── Budvanska rivijera i jug ──────────────────────────────────────────────
  { id: "budva-stari-grad", name: "Stari grad Budva", type: "grad", node: "budva" },
  { id: "plaza-jaz", name: "Plaža Jaz", type: "plaza", edge: "budva--tivat", atKm: 4, side: "left" },
  { id: "mogren", name: "Mogren", type: "plaza", node: "budva" },
  { id: "sveti-stefan", name: "Sveti Stefan", type: "ostrvo", edge: "petrovac--budva", atKm: 12, side: "left", icon: "sveti-stefan.svg" },
  { id: "manastir-praskvica", name: "Manastir Praskvica", type: "manastir", edge: "petrovac--budva", atKm: 13, side: "right" },
  { id: "manastir-rezevici", name: "Manastir Reževići", type: "manastir", edge: "petrovac--budva", atKm: 6, side: "right" },
  { id: "petrovac-kastio", name: "Petrovac, Kastio", type: "tvrdjava", node: "petrovac" },
  { id: "buljarica", name: "Buljarica", type: "plaza", edge: "sutomore--petrovac", atKm: 9, side: "left" },
  { id: "manastir-gradiste", name: "Manastir Gradište", type: "manastir", edge: "sutomore--petrovac", atKm: 7, side: "right" },
  { id: "haj-nehaj", name: "Tvrđava Haj-Nehaj", type: "tvrdjava", edge: "bar--sutomore", atKm: 7, side: "right" },
  { id: "ratac", name: "Ratac, ruševine opatije", type: "ruina", edge: "bar--sutomore", atKm: 3, side: "left" },
  { id: "tunel-sozina", name: "Tunel Sozina", type: "tunel", edge: "virpazar--bar", atKm: 12, side: "right", icon: "tunel-sozina.svg" },
  { id: "stari-bar", name: "Stari Bar", type: "grad", node: "bar" },
  { id: "dvorac-kralja-nikole-bar", name: "Dvorac kralja Nikole, Bar", type: "dvorac", node: "bar" },
  { id: "stara-maslina", name: "Stara maslina na Mirovici", type: "drvo", edge: "bar--ulcinj", atKm: 3, side: "left", icon: "stara-maslina.svg" },
  { id: "ulcinj-stari-grad", name: "Stari grad Ulcinj", type: "grad", node: "ulcinj" },
  { id: "velika-plaza", name: "Velika plaža", type: "plaza", edge: "ulcinj--sukobin", atKm: 6, side: "right" },
  { id: "ada-bojana", name: "Ada Bojana", type: "ostrvo", edge: "ulcinj--sukobin", atKm: 12, side: "right" },
  { id: "manastir-podmaine", name: "Manastir Podmaine", type: "manastir", edge: "cetinje--budva", atKm: 29, side: "right" },
  { id: "vidikovac-brajici", name: "Vidikovac Brajići", type: "vidikovac", edge: "cetinje--budva", atKm: 20, side: "left" },
];

export const LANDMARKS: readonly Landmark[] = INPUT.map((l): Landmark => {
  const at: LandmarkAt =
    "node" in l
      ? { kind: "node", node: l.node }
      : { kind: "edge", edge: l.edge, atKm: l.atKm, side: l.side };
  return {
    id: l.id,
    name: l.name,
    type: l.type,
    at,
    icon: l.icon === undefined ? genericIcon(l.type) : `${ICON_DIR}/${l.icon}`,
    iconGeneric: l.icon === undefined,
    positionVerified: false,
    ...(l.cardOnly === undefined ? {} : { cardOnly: l.cardOnly }),
  };
});

/** Znamenitosti u samom gradu ili čvorištu. */
export function landmarksAtNode(nodeId: string): Landmark[] {
  return LANDMARKS.filter((l) => l.at.kind === "node" && l.at.node === nodeId);
}

/**
 * Znamenitosti duž dionice, poređane po smjeru vožnje.
 *
 * `obrnuto` je vožnja od `b` prema `a`: tada se i redoslijed i strana
 * preslikavaju, pa poziv vraća ono što vozač stvarno vidi.
 */
export function landmarksOnEdge(edgeId: string, obrnuto = false): Landmark[] {
  const edge = edgeById(edgeId);
  const list = LANDMARKS.filter(
    (l) => l.at.kind === "edge" && l.at.edge === edgeId && !l.cardOnly,
  );
  if (!edge) return [];
  const sa = (l: Landmark) => (l.at.kind === "edge" ? l.at.atKm : 0);
  if (!obrnuto) return list.sort((x, y) => sa(x) - sa(y));
  return list
    .map((l): Landmark =>
      l.at.kind === "edge"
        ? {
            ...l,
            at: {
              kind: "edge",
              edge: l.at.edge,
              atKm: Math.round((edge.km - l.at.atKm) * 100) / 100,
              side: l.at.side === "left" ? "right" : "left",
            },
          }
        : l,
    )
    .sort((x, y) => sa(x) - sa(y));
}

/** Da li znamenitost uopšte pokazuje na nešto što u grafu postoji. */
export function landmarkTargetExists(l: Landmark): boolean {
  return l.at.kind === "node" ? nodeById(l.at.node) !== undefined : edgeById(l.at.edge) !== undefined;
}
