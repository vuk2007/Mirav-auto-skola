/**
 * Biblioteka kazni — model podataka.
 *
 * KLJUČNO: kazne su zajednička biblioteka, a pitanje na nju samo **pokazuje**.
 * Tekst kazne se nikad ne kuca u pitanje. Dvadesetak pitanja o brzini pokazuje
 * na isti unos; izmjena tog unosa mijenja svih dvadeset odjednom. Bez toga se
 * katalog raspadne pri prvoj izmjeni zakona.
 *
 * Dva fajla, namjerno odvojena:
 *   data/kazne.json          biblioteka kazni
 *   data/pitanje-kazna.json  veza pitanje → kazna
 *
 * Veza NE ide u `public/questions.json` jer se on može ponovo generisati iz
 * PDF-a, a rad instruktorke ne smije da nestane pri tome.
 */

/** Jedna kazna iz biblioteke. */
export interface Kazna {
  /** Slug, npr. „brzina-naselje-20-30". Na njega pokazuje `PitanjeKazna.kazna_id`. */
  id: string;
  /** „Brzina" | „Alkohol" | „Dokumenta" | „Parkiranje" … — grupisanje u spisku. */
  kategorija: string;
  naslov: string;
  /** Jedna do dvije rečenice, jezikom kojim se objašnjava na času. */
  objasnjenje: string;
  /** U eurima. Fiksan iznos → `iznos_min === iznos_max`. */
  iznos_min: number | null;
  iznos_max: number | null;
  kazneni_poeni: number | null;
  zabrana_upravljanja: string | null;
  /** OBAVEZNO: „čl. 318 st. 1 tač. 3". Bez ovoga se kazna ne može potvrditi. */
  clan: string;
  /** OBAVEZNO: „Sl. list CG 111/2026". */
  izvor: string;
  /** Samo `potvrdjeno` se prikazuje kandidatu. */
  status: "nepotvrdjeno" | "potvrdjeno";
  potvrdio: string;
  /** ISO datum. */
  potvrdjeno_dana: string;
  napomena: string | null;
}

/**
 * Stanje jednog pitanja u pregledu.
 *
 * Tri stanja su različita i ne smiju se miješati:
 *   `pregledano: false`                      — još nije stigla do njega
 *   `pregledano: true, bez_kazne: true`      — pogledala, nema prekršaja
 *   `pregledano: true, kazna_id: "…"`        — pogledala, ovo je kazna
 *
 * Samo `pregledano === false` znači da posao nije završen.
 */
export interface PitanjeKazna {
  kazna_id: string | null;
  bez_kazne: boolean;
  pregledano: boolean;
}

/** Sadržaj `data/kazne.json`. */
export interface BibliotekaKazni {
  /** Ime osobe koja radi pregled — upisuje se jednom, koristi pri svakoj potvrdi. */
  pregledao: string;
  azurirano: string;
  kazne: Kazna[];
}

/** Sadržaj `data/pitanje-kazna.json` — mapa `id pitanja` → stanje. */
export type VezaPitanjeKazna = Record<string, PitanjeKazna>;

/**
 * Ime kolačića prijave u editor. Stoji ovdje, a ne u route handleru, jer Next
 * ne dozvoljava da ruta izvozi bilo šta osim HTTP metoda i svojih podešavanja.
 */
export const KOLACIC_ADMIN = "mirav_admin";

export const PRAZNO_STANJE: PitanjeKazna = {
  kazna_id: null,
  bez_kazne: false,
  pregledano: false,
};

/** Kategorije ponuđene u editoru; instruktorka može ukucati i svoju. */
export const KATEGORIJE = [
  "Brzina",
  "Alkohol i psihoaktivne materije",
  "Prvenstvo prolaza",
  "Preticanje i mimoilaženje",
  "Pješaci i biciklisti",
  "Saobraćajna signalizacija",
  "Parkiranje i zaustavljanje",
  "Oprema i putnici",
  "Dokumenta i vozilo",
  "Svjetla i vidljivost",
  "Saobraćajna nezgoda",
  "Ostalo",
] as const;

/** Da li se kazna smije prikazati kandidatu. */
export function jePotvrdjena(k: Kazna): boolean {
  return k.status === "potvrdjeno";
}

/**
 * Da li se kazna može potvrditi. Član i izvor su obavezni, i mora postojati bar
 * jedna sankcija — iznos, kazneni poeni ili zabrana. Kazna bez ijedne sankcije
 * ne kaže kandidatu ništa, a kazna bez člana se ne može provjeriti.
 */
export function moziPotvrditi(k: Partial<Kazna>): { moze: boolean; razlozi: string[] } {
  const razlozi: string[] = [];
  if (!k.clan?.trim()) razlozi.push("nedostaje član zakona");
  if (!k.izvor?.trim()) razlozi.push("nedostaje izvor");
  if (!k.naslov?.trim()) razlozi.push("nedostaje naslov");

  const imaIznos = k.iznos_min != null || k.iznos_max != null;
  const imaPoene = k.kazneni_poeni != null;
  const imaZabranu = Boolean(k.zabrana_upravljanja?.trim());
  if (!imaIznos && !imaPoene && !imaZabranu) {
    razlozi.push("nema nijedne sankcije (iznos, kazneni poeni ili zabrana)");
  }
  if (k.iznos_min != null && k.iznos_max != null && k.iznos_min > k.iznos_max) {
    razlozi.push("najmanji iznos je veći od najvećeg");
  }
  return { moze: razlozi.length === 0, razlozi };
}

/** Iznos u čitljivom obliku: „150 €", „150–400 €" ili „—". */
export function formatIznos(min: number | null, max: number | null): string {
  if (min == null && max == null) return "—";
  if (min != null && max != null) return min === max ? `${min} €` : `${min}–${max} €`;
  return `${min ?? max} €`;
}

/** Slug iz naslova: „Prekoračenje brzine u naselju" → „prekoracenje-brzine-u-naselju". */
export function naslovUSlug(naslov: string): string {
  return naslov
    .toLowerCase()
    .replace(/[čć]/g, "c")
    .replace(/š/g, "s")
    .replace(/ž/g, "z")
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Upozorenja koja se prikazuju pri preuzimanju fajlova. Ne blokiraju — samo
 * skreću pažnju na ono što se lako previdi kroz sto unosa.
 */
export function upozorenja(biblioteka: BibliotekaKazni, veza: VezaPitanjeKazna): string[] {
  const out: string[] = [];
  const korisceno = new Set(
    Object.values(veza)
      .map((v) => v.kazna_id)
      .filter((x): x is string => Boolean(x)),
  );

  for (const k of biblioteka.kazne) {
    if (!k.clan.trim()) out.push(`„${k.naslov}" nema član zakona`);
    if (k.iznos_min != null && k.iznos_max != null && k.iznos_min > k.iznos_max) {
      out.push(`„${k.naslov}": najmanji iznos je veći od najvećeg`);
    }
    if ((k.iznos_max ?? 0) > 5000) out.push(`„${k.naslov}": iznos preko 5.000 € — provjeriti`);
    if (!korisceno.has(k.id)) out.push(`„${k.naslov}" ne koristi nijedno pitanje — možda duplikat`);
  }

  const poNaslovu = new Map<string, string[]>();
  for (const k of biblioteka.kazne) {
    const kljuc = naslovUSlug(k.naslov);
    poNaslovu.set(kljuc, [...(poNaslovu.get(kljuc) ?? []), k.id]);
  }
  for (const [, ids] of poNaslovu) {
    if (ids.length > 1) out.push(`isti naslov kod više kazni: ${ids.join(", ")}`);
  }
  return out;
}
