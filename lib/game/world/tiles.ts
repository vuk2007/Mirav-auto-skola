/**
 * Učitavanje okoline po tile-ovima.
 *
 * Okolina stoji u `public/data/osm/tiles/<x>_<y>.json`, po komadima od dva
 * kilometra. Ovdje se bira KOJI komadi trebaju jednoj ruti, dovlače se redom
 * kojim se voze, i svaki se odmah preslika u koordinate rute.
 *
 * ZAŠTO SE NE STRIMUJE U TOKU VOŽNJE
 *
 * Zato što se izmjerilo da nema potrebe: ruta Budva — Kolašin traži 199
 * tile-ova, ukupno 0,9 MB, a preslikavanje svih 1746 pojava traje 88 ms. Prozor
 * od dva kilometra bi tu uštedio pola megabajta i uveo stanje koje može da
 * zakasni. Umjesto toga se učitava cijela ruta, ali REDOM — prvi tile-ovi su
 * oni na početku puta, pa se kreće čim su oni tu, a ostatak stiže u pozadini.
 *
 * Za slobodnu vožnju po cijeloj zemlji ovo ne bi valjalo i prozor bi bio nužan.
 * Ruta je poznata unaprijed, pa nije.
 */

import { TILE } from "../sim/config";
import {
  napraviPreslikavanje,
  preslikajTile,
  trakeOkoline,
  type Okolina,
  type OkolinaLinija,
  type Povrsina,
  type TilePojava,
} from "./okolina";
import type { Ruta } from "./ruta";

/** Odakle se tile dovlači. `null` znači da tog tile-a nema — to nije greška. */
export type TileIzvor = (kljuc: string) => Promise<TilePojava[] | null>;

/**
 * Tile-ovi koje ruta dodiruje, poređani po tome kad se do njih stiže.
 *
 * Uzima se i prsten susjeda oko svakog: pojava iz susjednog tile-a može da
 * zađe u pojas pored puta, a da joj tile ne dodiruje samu osovinu.
 */
export function tileoviRute(ruta: Ruta): string[] {
  const prvi = new Map<string, number>();
  for (const d of ruta.dionice) {
    const t = d.stvarne;
    for (const [i, p] of t.entries()) {
      // Mjesto na ruti se procjenjuje srazmjerno — dovoljno za redoslijed.
      const s = d.odS + ((d.doS - d.odS) * i) / Math.max(1, t.length - 1);
      const tx = Math.floor(p.x / TILE);
      const ty = Math.floor(p.y / TILE);
      for (let a = -1; a <= 1; a++) {
        for (let b = -1; b <= 1; b++) {
          const kljuc = `${tx + a}_${ty + b}`;
          const staro = prvi.get(kljuc);
          if (staro === undefined || s < staro) prvi.set(kljuc, s);
        }
      }
    }
  }
  return [...prvi.entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k);
}

export interface OkolinaNapredak {
  /** Koliko je tile-ova obrađeno do sada. */
  gotovo: number;
  ukupno: number;
  /** Koliko ih nije bilo — prazan prostor, more van obale, susjedne države. */
  praznih: number;
  /** Okolina sastavljena od onoga što je do sada stiglo. */
  okolina: Okolina;
}

/**
 * Učitaj okolinu cijele rute.
 *
 * `naNapredak` se zove poslije svake grupe, pa vožnja može da krene prije nego
 * što stigne posljednji tile. `odjednom` je koliko se dovlači paralelno —
 * previše otvorenih zahtjeva uspori i sve ostalo na stranici.
 */
export async function ucitajOkolinu(
  ruta: Ruta,
  izvor: TileIzvor,
  {
    odjednom = 8,
    naNapredak,
    prekini,
  }: {
    odjednom?: number;
    naNapredak?: (n: OkolinaNapredak) => void;
    /** Vrati `true` da se učitavanje zaustavi — vožnja je u međuvremenu napuštena. */
    prekini?: () => boolean;
  } = {},
): Promise<OkolinaNapredak> {
  const kljucevi = tileoviRute(ruta);
  const pres = napraviPreslikavanje(ruta);
  const povrsine: Povrsina[] = [];
  const obale: [number, number][][] = [];
  const linije: OkolinaLinija[] = [];
  let gotovo = 0;
  let praznih = 0;
  let okolina: Okolina = { trake: [], linije: [] };

  for (let i = 0; i < kljucevi.length; i += odjednom) {
    if (prekini?.()) break;
    const grupa = kljucevi.slice(i, i + odjednom);
    const stigli = await Promise.all(
      grupa.map(async (kljuc) => {
        try {
          return await izvor(kljuc);
        } catch {
          // Tile koji ne stigne nije razlog da vožnja stane — taj komad
          // okoline se jednostavno ne vidi.
          return null;
        }
      }),
    );
    for (const sadrzaj of stigli) {
      gotovo += 1;
      if (!sadrzaj) {
        praznih += 1;
        continue;
      }
      const razvrstano = preslikajTile(ruta, pres, sadrzaj);
      povrsine.push(...razvrstano.povrsine);
      obale.push(...razvrstano.obale);
      linije.push(...razvrstano.linije);
    }
    // Trake se računaju iz SVIH površina koje su do sada stigle, jer se dvije
    // susjedne mogu preklopiti — voda preko šume na obali. Račun je jeftin
    // (nekoliko milisekundi), pa se ponavlja poslije svake grupe.
    okolina = { trake: trakeOkoline(ruta, pres, povrsine, obale), linije };
    naNapredak?.({ gotovo, ukupno: kljucevi.length, praznih, okolina });
  }

  return { gotovo, ukupno: kljucevi.length, praznih, okolina };
}

/** Izvor koji dovlači tile-ove sa servera. */
export const izvorSaMreze: TileIzvor = async (kljuc) => {
  const odgovor = await fetch(`/data/osm/tiles/${kljuc}.json`);
  if (!odgovor.ok) return null;
  const sadrzaj = (await odgovor.json()) as { v?: TilePojava[] };
  return Array.isArray(sadrzaj.v) ? sadrzaj.v : null;
};
