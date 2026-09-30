/**
 * Paket grada: jedan binarni fajl sa svim što treba za vožnju kroz grad u
 * razmjeri 1:1 (faza 6) — mreža ulica, zgrade, površine, linije, objekti.
 *
 * Zašto JEDAN fajl, a ne tile po tile sa servera: mreža ulica mora biti cijela
 * u memoriji prije vožnje (simulacija ne smije zavisiti od toga koji je tile
 * stigao), a sve zajedno je nekoliko megabajta. Stotine malih zahtjeva po
 * vožnji bi na Vercel-u trošile kvotu zahtjeva, a jedan fajl sa verzijom u
 * imenu se kešira zauvijek. Tile-ovi od 500 m postoje UNUTAR paketa, kao
 * indeks: crtanje gradi i prikazuje samo tile-ove oko igrača.
 *
 * Oblik: 4 bajta „MRVG", uint32 dužina zaglavlja, zaglavlje kao JSON, pa nizovi
 * brojeva jedan za drugim, svaki poravnat na 4 bajta. Zaglavlje kaže gdje je
 * koji niz. Koordinate su metri od ishodišta grada, `x` na istok, `y` na jug
 * (kao i ostatak igre: `y` raste nadolje).
 *
 * Isti modul i piše (skripta `pripremiGrad.mjs`) i čita (igra), pa format ne
 * može da se razdvoji na dvije verzije.
 */

/** Oznaka na početku fajla — da se greška u putanji ne pročita kao grad. */
const MAGIJA = "MRVG";
export const VERZIJA_PAKETA = 1;

type VrstaNiza = "f32" | "u32" | "u16" | "u8" | "i8";
type Niz = Float32Array | Uint32Array | Uint16Array | Uint8Array | Int8Array;

const KONSTRUKTOR = {
  f32: Float32Array,
  u32: Uint32Array,
  u16: Uint16Array,
  u8: Uint8Array,
  i8: Int8Array,
} as const;

/** Nizovi paketa, po imenu. Svaki je tipiziran — vidi `NIZOVI`. */
export const NIZOVI = {
  // Mreža ulica: čvorovi i ivice između njih.
  cvXY: "f32",
  ivA: "u32",
  ivB: "u32",
  /** Početak tačaka ivice `i` u `ivXY` (u tačkama); dužina `ivica + 1`. */
  ivOd: "u32",
  ivXY: "f32",
  ivKlasa: "u8",
  /** 1: jednosmjerna od `a` ka `b`; -1: od `b` ka `a`; 0: dvosmjerna. */
  ivSmjer: "i8",
  ivTrake: "u8",
  ivTrakeNaprijed: "u8",
  ivTrakeNazad: "u8",
  /** Ograničenje brzine [km/h]; 0 kad ga OSM nema. */
  ivBrzina: "u8",
  /** Zastavice, vidi `IVICA_*`. */
  ivZastavice: "u8",
  ivSloj: "i8",
  /** Indeks u `stringovi`; 0 je prazan niz. */
  ivIme: "u16",
  ivTrakeSkretanja: "u16",
  ivTrakeSkretanjaNazad: "u16",
  ivOsm: "u32",
  // Zgrade: prsten osnove, spratnost, visina, vrsta, ime (samo javne).
  zgOd: "u32",
  zgXY: "f32",
  zgSpratovi: "u8",
  /** Visina [dm]; 0 kad je OSM nema. */
  zgVisina: "u16",
  zgVrsta: "u8",
  zgIme: "u16",
  zgTileOd: "u32",
  // Površine: park, voda, parking, škola, trg...
  pvOd: "u32",
  pvXY: "f32",
  pvVrsta: "u8",
  pvTileOd: "u32",
  // Linije: rijeka, potok, pruga, drvored.
  lnOd: "u32",
  lnXY: "f32",
  lnVrsta: "u8",
  /** Širina [dm]. */
  lnSirina: "u16",
  lnTileOd: "u32",
  // Objekti: znak, semafor, prelaz, stajalište, pumpa, bogomolja.
  obXY: "f32",
  obVrsta: "u8",
  /** Dodatni podatak kao indeks u `stringovi` (smjer znaka, vrsta prelaza). */
  obPodatak: "u16",
  obTileOd: "u32",
} as const satisfies Record<string, VrstaNiza>;

export type ImeNiza = keyof typeof NIZOVI;
type TipNiza<K extends ImeNiza> = InstanceType<(typeof KONSTRUKTOR)[(typeof NIZOVI)[K]]>;
export type Nizovi = { [K in ImeNiza]: TipNiza<K> };

/** Zastavice ivice (`ivZastavice`). */
export const IVICA_KRUZNI = 1;
export const IVICA_MOST = 2;
export const IVICA_TUNEL = 4;
/** Ivicom se vozi autom — pješačka zona, biciklistička staza i slično nisu. */
export const IVICA_VOZNA = 8;

export interface ZaglavljePaketa {
  verzija: number;
  grad: string;
  ime: string;
  /** Datum stanja OSM baze iz koje je paket napravljen. */
  datum: string | null;
  licenca: string;
  /** Ishodište lokalnih metara: UTM 34N i stepeni. */
  ishodiste: { utmX: number; utmY: number; lat: number; lon: number };
  /** Okvir svega u paketu, u lokalnim metrima. */
  okvir: { minX: number; minY: number; maxX: number; maxY: number };
  /** Stranica tile-a [m] i broj tile-ova po osi, od `okvir.minX/minY`. */
  tile: number;
  tileovaX: number;
  tileovaY: number;
  /** Tabele: redni broj u nizu je kod u paketu. */
  stringovi: string[];
  klase: string[];
  vrsteZgrada: string[];
  vrstePovrsina: string[];
  vrsteLinija: string[];
  vrsteObjekata: string[];
  /** Gdje je koji niz: [bajt od početka, broj elemenata]. */
  nizovi: Record<string, [number, number]>;
}

export interface Paket {
  zaglavlje: ZaglavljePaketa;
  n: Nizovi;
}

/** Zaglavlje bez `nizovi` — to popunjava `zapisi`. */
export type ZaglavljeBezNizova = Omit<ZaglavljePaketa, "nizovi" | "verzija">;

const poravnaj = (x: number) => (x + 3) & ~3;

/** Paket u bajtove. */
export function zapisi(zaglavlje: ZaglavljeBezNizova, n: Nizovi): Uint8Array {
  const raspored: Record<string, [number, number]> = {};
  let pomak = 0;
  for (const ime of Object.keys(NIZOVI) as ImeNiza[]) {
    const niz = n[ime] as Niz;
    raspored[ime] = [pomak, niz.length];
    pomak = poravnaj(pomak + niz.byteLength);
  }
  const z: ZaglavljePaketa = { ...zaglavlje, verzija: VERZIJA_PAKETA, nizovi: raspored };
  const zBajtovi = new TextEncoder().encode(JSON.stringify(z));
  const pocetak = poravnaj(8 + zBajtovi.length);
  const out = new Uint8Array(pocetak + pomak);
  out.set(new TextEncoder().encode(MAGIJA), 0);
  new DataView(out.buffer).setUint32(4, zBajtovi.length, true);
  out.set(zBajtovi, 8);
  for (const ime of Object.keys(NIZOVI) as ImeNiza[]) {
    const niz = n[ime] as Niz;
    out.set(new Uint8Array(niz.buffer, niz.byteOffset, niz.byteLength), pocetak + raspored[ime]![0]);
  }
  return out;
}

/**
 * Bajtovi u paket. Nizovi se ne kopiraju — gledaju direktno u bafer, pa
 * čitanje paketa od nekoliko megabajta traje koliko i raščlanjivanje zaglavlja.
 */
export function procitaj(bajtovi: ArrayBuffer): Paket {
  const u8 = new Uint8Array(bajtovi);
  if (new TextDecoder().decode(u8.subarray(0, 4)) !== MAGIJA) throw new Error("nije paket grada");
  const duzina = new DataView(bajtovi).getUint32(4, true);
  const zaglavlje = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + duzina))) as ZaglavljePaketa;
  if (zaglavlje.verzija !== VERZIJA_PAKETA) {
    throw new Error(`paket grada je verzije ${zaglavlje.verzija}, igra čita ${VERZIJA_PAKETA}`);
  }
  const pocetak = poravnaj(8 + duzina);
  const n = {} as Record<ImeNiza, Niz>;
  for (const ime of Object.keys(NIZOVI) as ImeNiza[]) {
    const mjesto = zaglavlje.nizovi[ime];
    if (!mjesto) throw new Error(`paket grada nema niz ${ime}`);
    const K = KONSTRUKTOR[NIZOVI[ime]];
    n[ime] = new K(bajtovi, pocetak + mjesto[0], mjesto[1]);
  }
  return { zaglavlje, n: n as Nizovi };
}

/** Prazni nizovi — za testove i za grad bez nekog sloja. */
export function prazniNizovi(): Nizovi {
  const n = {} as Record<ImeNiza, Niz>;
  for (const ime of Object.keys(NIZOVI) as ImeNiza[]) n[ime] = new KONSTRUKTOR[NIZOVI[ime]](0);
  return n as Nizovi;
}
