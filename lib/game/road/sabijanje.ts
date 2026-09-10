/**
 * Sabijanje stvarne geometrije puta.
 *
 * Ulaz je polilinija iz OpenStreetMap-a, u metrima. Izlaz je kraća polilinija
 * koja se vozi, uz preslikavanje između jedne i druge u oba smjera.
 *
 * ŠTA SE ČUVA, A ŠTA NE
 *
 * Čuva se **smjer u svakoj tački**. Ugao za koji put skrene ostaje isti do na
 * računsku grešku, pa sabijena dionica ima isti redoslijed i istu jačinu
 * skretanja kao stvarna — Njeguši ostaju serpentina, Zeta ostaje ravnica.
 *
 * Ne čuva se **dužina**, i to je cijela svrha. Prav put se skraćuje deset puta,
 * krivudav dva i po; između se ide glatko, pa nema mjesta na kojem se sabijanje
 * naglo promijeni.
 *
 * Posljedica koju treba imati na umu: ako se ugao zadrži a dužina skrati, onda
 * se **poluprečnik smanji tačno za faktor sabijanja**. Zato postoji donja
 * granica (`MIN_CURVE_RADIUS`) koja faktor lokalno obara — bolje da dionica
 * bude nešto duža nego da u njoj bude krivina koju niko ne može proći.
 *
 * Zašto uopšte reparametrizacija a ne obično umanjenje: umanjena slika bi
 * smanjila i širinu puta i vozilo i odstojanja, pa bi se svi metri u simulaciji
 * morali prevoditi. Ovako metar ostaje metar, mijenja se samo koliko ih ima
 * između dvije krivine.
 */

import {
  ADVISORY_BY_RADIUS,
  ADVISORY_MAX_RADIUS,
  CURVATURE_WINDOW,
  CURVE_MERGE_GAP,
  MIN_CURVE_ARC,
  MIN_CURVE_RADIUS,
  MIN_GEOMETRY_RADIUS,
  RADIUS_CURVY,
  RADIUS_STRAIGHT,
  ROAD_STEP,
  SCALE_CURVY,
  SCALE_STRAIGHT,
} from "../sim/config";
import type { Point, RoadCurve } from "../sim/types";

/**
 * Sabijene ivice se pamte.
 *
 * Račun traje oko petinu sekunde po ivici — dovoljno da se u testu koji prođe
 * kroz svih pedeset četiri ivice osjeti, a u vožnji bi se ista dionica računala
 * pri svakom ulasku. Ključ nosi i smjer, jer se znamenitosti u povratku
 * razlikuju.
 */
const KES = new Map<string, Sabijeno>();

/**
 * Sabijena ivica, iz keša ako je već računata.
 *
 * Povratak se NE računa iznova nego se izvodi okretanjem istog rezultata.
 * Zaobljavanje uglova nije simetrično — ide s kraja na kraj — pa je isti put u
 * suprotnom smjeru ispadao kraći za dva i po procenta. Odlazak i povratak moraju
 * biti ista dionica, inače se ista ivica u dva smjera razlikuje bez razloga.
 *
 * `tacke` se uvijek predaju u smjeru od `a` prema `b`.
 */
export function sabijenaIvica(id: string, tacke: readonly Point[], obrnuto: boolean): Sabijeno {
  let pravo = KES.get(id);
  if (!pravo) {
    pravo = sabij(tacke);
    KES.set(id, pravo);
  }
  return obrnuto ? obrni(pravo) : pravo;
}

/**
 * Ista dionica, vožena u suprotnom smjeru.
 *
 * Sve se okreće oko sredine: redoslijed tačaka, oba preslikavanja i položaj
 * krivina. Strana krivine se mijenja — ono što je u odlasku lijevo, u povratku
 * je desno.
 */
export function obrni(s: Sabijeno): Sabijeno {
  const okrenute = [...s.tacke].reverse();
  // Dionica uvijek počinje u ishodištu i ide na +y, isto kao u `sabij`.
  const prva = okrenute[0]!;
  const druga = okrenute[1] ?? prva;
  const zaokret = Math.PI / 2 - Math.atan2(druga.y - prva.y, druga.x - prva.x);
  const cos = Math.cos(zaokret);
  const sin = Math.sin(zaokret);
  const tacke = okrenute.map((p) => {
    const dx = p.x - prva.x;
    const dy = p.y - prva.y;
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
  });

  return {
    tacke,
    duzina: s.duzina,
    stvarnaDuzina: s.stvarnaDuzina,
    stvarne: [...s.stvarne].reverse(),
    krivine: s.krivine
      .map((c) => ({
        ...c,
        atS: s.duzina - c.atS,
        side: c.side === "left" ? ("right" as const) : ("left" as const),
      }))
      .reverse(),
    najmanjiPoluprecnik: s.najmanjiPoluprecnik,
    najmanjiStvarni: s.najmanjiStvarni,
    faktori: [...s.faktori].reverse(),
    skretanje: s.skretanje,
    uSabijeni: (x) => s.duzina - s.uSabijeni(s.stvarnaDuzina - x),
    uStvarni: (x) => s.stvarnaDuzina - s.uStvarni(s.duzina - x),
  };
}

/** Ugao sveden na (−π, π]. */
function svedi(a: number): number {
  let x = a;
  while (x > Math.PI) x -= 2 * Math.PI;
  while (x <= -Math.PI) x += 2 * Math.PI;
  return x;
}

/**
 * Polilinija preuzorkovana na jednak korak.
 *
 * Tačke iz OSM-a stoje nepravilno — uprošćavanje ostavlja gušće tačke u
 * krivini, rjeđe na pravcu. Zakrivljenost računata nad takvim nizom je
 * besmislena, jer ne zna koliko je metara između dvije tačke. Zato se prvo
 * pređe na jednak korak.
 */
export function preuzorkuj(tacke: readonly Point[], korak = ROAD_STEP): Point[] {
  if (tacke.length < 2) return tacke.map((p) => ({ ...p }));

  const kum: number[] = [0];
  for (let i = 1; i < tacke.length; i++) {
    const a = tacke[i - 1]!;
    const b = tacke[i]!;
    kum.push(kum[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const duzina = kum[kum.length - 1]!;
  if (duzina === 0) return [{ ...tacke[0]! }];

  const koraka = Math.max(1, Math.round(duzina / korak));
  const stvarni = duzina / koraka;
  const out: Point[] = [];
  let j = 1;
  for (let i = 0; i <= koraka; i++) {
    const s = Math.min(duzina, i * stvarni);
    while (j < kum.length - 1 && kum[j]! < s) j += 1;
    const a = tacke[j - 1]!;
    const b = tacke[j]!;
    const d = kum[j]! - kum[j - 1]!;
    const t = d === 0 ? 0 : (s - kum[j - 1]!) / d;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

/** Koliko prolaza zaobljavanja se najviše radi. */
const ZAOBLJAVANJA = 400;
/** Koliko se tačka pomjeri po prolazu — veće je brže, ali grublje. */
const ZAOBLJENJE = 0.5;
/** Dokle se prelomi na pravcu zaglađuju [m]; iznad ovoga nema koristi. */
const ZAOBLJENJE_CILJ = 300;

/**
 * Zaobljavanje uglova koje je unijelo uprošćavanje.
 *
 * Radi SAMO tamo gdje je prelom oštriji od `MIN_GEOMETRY_RADIUS`; pravci i
 * blage krivine se ne diraju. Tačka se pomjera prema sredini svojih susjeda,
 * pa se ugao razvlači u luk, a linija se poslije svakog prolaza vrati na
 * jednak korak.
 *
 * Ovo je jedino mjesto na kojem se stvarna geometrija mijenja, i mijenja se
 * zato što je uprošćena, a ne zato što nam tako odgovara.
 */
export function zaobli(uzorci: readonly Point[], korak: number, prag?: number): Point[] {
  let tacke = uzorci.map((p) => ({ ...p }));
  // Izglađeni oblik se računa JEDNOM, prije zaobljavanja: on je mjera onoga
  // kako put ide, a zaobljavanje ga skoro i ne mijenja — mijenja samo uglove
  // koje je uprošćavanje ostavilo. Računat u svakom prolazu, bio je četiri
  // petine cijelog vremena.
  const glatko = zakrivljenost(tacke, korak);
  for (let prolaz = 0; prolaz < ZAOBLJAVANJA; prolaz++) {
    const uglovi = smjerovi(tacke);
    let ostro = false;
    const novi = tacke.map((p) => ({ ...p }));
    for (let i = 1; i < tacke.length - 1; i++) {
      const skret = Math.abs(svedi((uglovi[i] ?? 0) - (uglovi[i - 1] ?? 0)));
      if (skret < 1e-9) continue;
      const radius = korak / skret;
      // Prag nije fiksan nego prati sam oblik puta: prelom ne smije biti oštriji
      // od onoga što izglađena krivina na tom mjestu kaže. Na pravcu to znači da
      // se uglovi digitalizacije brišu skoro sasvim, a u serpentini se ne dira
      // ništa — tamo je izglađena vrijednost i sama mala. Fiksni prag od dvanaest
      // metara je ostavljao uglove na pravcima, a baš oni su zaustavljali
      // sabijanje: faktor mora pasti na `R/25` gdje god je prelom oštar.
      const glatkiR = glatko[i] === 0 ? Infinity : 1 / Math.abs(glatko[i] ?? 0);
      // Zadati prag nadjačava: spoj dvije dionice se zaobljava do poluprečnika
      // raskrsnice, bez obzira na to šta izglađena krivina tu kaže.
      const ovaj = prag ?? Math.max(MIN_GEOMETRY_RADIUS, Math.min(glatkiR, ZAOBLJENJE_CILJ));
      if (radius >= ovaj) continue;
      ostro = true;
      const a = tacke[i - 1]!;
      const b = tacke[i]!;
      const c = tacke[i + 1]!;
      novi[i] = {
        x: b.x + (ZAOBLJENJE * (a.x + c.x - 2 * b.x)) / 2,
        y: b.y + (ZAOBLJENJE * (a.y + c.y - 2 * b.y)) / 2,
      };
    }
    if (!ostro) break;
    tacke = preuzorkuj(novi, korak);
  }
  return tacke;
}

/** Uglovi smjera svakog segmenta preuzorkovane polilinije [rad]. */
function smjerovi(uzorci: readonly Point[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < uzorci.length; i++) {
    const a = uzorci[i - 1]!;
    const b = uzorci[i]!;
    out.push(Math.atan2(b.y - a.y, b.x - a.x));
  }
  return out;
}

/**
 * Zakrivljenost u svakoj tački [1/m], izglađena preko `CURVATURE_WINDOW`.
 *
 * Izglađivanje nije uljepšavanje nego nužnost: uprošćena polilinija na pravom
 * putu ima prelome od po nekoliko stepeni, koji bi bez izglađivanja ispali kao
 * krivine od par metara poluprečnika i zaustavili sabijanje na cijeloj dionici.
 */
export function zakrivljenost(
  uzorci: readonly Point[],
  korak: number,
  prozor = CURVATURE_WINDOW,
): number[] {
  const uglovi = smjerovi(uzorci);
  if (uglovi.length < 2) return new Array(Math.max(0, uglovi.length)).fill(0);

  const sirovo: number[] = [];
  for (let i = 0; i < uglovi.length; i++) {
    if (i === 0) {
      sirovo.push(svedi(uglovi[1]! - uglovi[0]!) / korak);
      continue;
    }
    sirovo.push(svedi(uglovi[i]! - uglovi[i - 1]!) / korak);
  }

  const pola = Math.max(1, Math.round(prozor / korak / 2));
  return sirovo.map((_, i) => {
    let zbir = 0;
    let n = 0;
    for (let j = i - pola; j <= i + pola; j++) {
      const v = sirovo[Math.min(sirovo.length - 1, Math.max(0, j))];
      if (v === undefined) continue;
      zbir += v;
      n += 1;
    }
    return n === 0 ? 0 : zbir / n;
  });
}

/**
 * Sirova zakrivljenost, bez izglađivanja [1/m].
 *
 * Postoji zbog jedne konkretne greške: faktor sabijanja se računao po
 * IZGLAĐENOJ zakrivljenosti, pa je usamljen oštar ugao okružen pravcem dobijao
 * pun faktor deset. Poluprečnik od dvanaest metara tako je postajao metar i po,
 * bočni odmak trake se prelamao kroz osu puta i vozila su se sudarala stojeći
 * svako u svojoj traci. Granica zato mora da vidi i ono što izglađivanje sakrije.
 */
export function sirovaZakrivljenost(uzorci: readonly Point[], korak: number): number[] {
  const uglovi = smjerovi(uzorci);
  const out: number[] = [];
  for (let i = 0; i < uglovi.length; i++) {
    const prije = uglovi[Math.max(0, i - 1)] ?? 0;
    out.push(svedi((uglovi[i] ?? 0) - prije) / korak);
  }
  return out;
}

/**
 * Faktor sabijanja za dati poluprečnik.
 *
 * Glatko između krivudavog i pravog: bez glatkog prelaza bi se na granici dvije
 * zone dužina naglo mijenjala, a to se u vožnji osjeti kao skok.
 */
export function faktorZaPoluprecnik(radius: number): number {
  if (!Number.isFinite(radius) || radius >= RADIUS_STRAIGHT) return SCALE_STRAIGHT;
  if (radius <= RADIUS_CURVY) return SCALE_CURVY;
  const t = (radius - RADIUS_CURVY) / (RADIUS_STRAIGHT - RADIUS_CURVY);
  // Smoothstep: izvod je nula na oba kraja, pa nema preloma na granicama.
  const g = t * t * (3 - 2 * t);
  return SCALE_CURVY + (SCALE_STRAIGHT - SCALE_CURVY) * g;
}

export interface Sabijeno {
  /** Sabijena osovina, u lokalnom sistemu: kreće iz (0,0) u smjeru +y. */
  tacke: Point[];
  /** Dužina sabijene osovine [m]. */
  duzina: number;
  /** Dužina stvarne osovine [m]. */
  stvarnaDuzina: number;
  /** Krivine izvedene iz stvarne geometrije, sa tablama. */
  krivine: RoadCurve[];
  /** Najmanji poluprečnik poslije sabijanja [m]; `Infinity` ako je sve pravo. */
  najmanjiPoluprecnik: number;
  /** Najmanji poluprečnik STVARNOG puta [m] — granica koju sabijanje ne dira. */
  najmanjiStvarni: number;
  /**
   * Stvarna osovina, onakva kakva je zaista ušla u sabijanje.
   *
   * Nije ulazna polilinija nego ona poslije preuzorkovanja i zaobljavanja
   * uglova digitalizacije, tačka po tačka u parovima sa `tacke`. Okolina se
   * vezuje za put preko nje: da se koristila sirova, preslikavanje bi se na
   * serpentinama razišlo za desetine metara, jer zaobljavanje mijenja dužinu.
   */
  stvarne: Point[];
  /** Faktor sabijanja po uzorku stvarne osovine. */
  faktori: number[];
  /** Ukupno skretanje [rad] — isto prije i poslije, po konstrukciji. */
  skretanje: number;
  /**
   * Stvarna pređena dužina → sabijena. Monotono.
   *
   * Oba preslikavanja mjere od POČETKA OVE VOŽNJE, ne od čvora `a`: u povratku
   * je nula na drugom kraju ivice. Tako su međusobno inverzna bez ijednog
   * dodatnog znaka, a pretvaranje u kilometražu ivice je zaseban korak.
   */
  uSabijeni(s: number): number;
  /** Sabijena pređena dužina → stvarna. Monotono. */
  uStvarni(s: number): number;
}

/** Linearno preslikavanje između dva rastuća niza jednake dužine. */
function preslikaj(iz: readonly number[], u: readonly number[], s: number): number {
  if (iz.length === 0) return 0;
  const prvi = iz[0]!;
  const zadnji = iz[iz.length - 1]!;
  if (s <= prvi) return u[0]!;
  if (s >= zadnji) return u[u.length - 1]!;
  let lo = 0;
  let hi = iz.length - 1;
  while (hi - lo > 1) {
    const sred = (lo + hi) >> 1;
    if (iz[sred]! <= s) lo = sred;
    else hi = sred;
  }
  const a = iz[lo]!;
  const b = iz[hi]!;
  const t = b === a ? 0 : (s - a) / (b - a);
  return u[lo]! + (u[hi]! - u[lo]!) * t;
}

/**
 * Sabij stvarnu poliliniju u onu koja se vozi.
 *
 * Izlazna osovina je u LOKALNOM sistemu — kreće iz ishodišta u smjeru +y, isto
 * kao proceduralna osovina u `sim/road.ts`. Time sve što već crta i vozi
 * otvoren put radi bez ijedne izmjene, a smještanje u svijet je zaseban korak.
 */
export function sabij(tacke: readonly Point[], korak = ROAD_STEP): Sabijeno {
  const uzorci = zaobli(preuzorkuj(tacke, korak), korak);
  if (uzorci.length < 3) {
    const prazno: Sabijeno = {
      tacke: [
        { x: 0, y: 0 },
        { x: 0, y: korak },
      ],
      duzina: korak,
      stvarnaDuzina: korak,
      krivine: [],
      najmanjiPoluprecnik: Infinity,
      najmanjiStvarni: Infinity,
      stvarne: uzorci.map((p) => ({ ...p })),
      faktori: [],
      skretanje: 0,
      uSabijeni: () => 0,
      uStvarni: () => 0,
    };
    return prazno;
  }

  const stvarniKorak = (() => {
    const a = uzorci[0]!;
    const b = uzorci[1]!;
    return Math.hypot(b.x - a.x, b.y - a.y);
  })();
  const uglovi = smjerovi(uzorci);
  const k = zakrivljenost(uzorci, stvarniKorak);
  const sirovo = sirovaZakrivljenost(uzorci, stvarniKorak);

  // Faktor po segmentu, uz donju granicu poluprečnika koja ga obara.
  const faktori = k.map((kappa, i) => {
    const radius = kappa === 0 ? Infinity : 1 / Math.abs(kappa);
    const zeljeni = faktorZaPoluprecnik(radius);
    // R' = R / f  ≥  MIN_CURVE_RADIUS  ⟹  f ≤ R / MIN_CURVE_RADIUS
    const dozvoljeni = Number.isFinite(radius) ? radius / MIN_CURVE_RADIUS : Infinity;
    // Granica se nameće i po SIROVOM prelomu, ne samo po izglađenom poluprečniku.
    // Gleda se prelom na OBA kraja segmenta: ugao između dva segmenta „troše"
    // oba, pa skraćivanje bilo kojeg od njih oštri tu istu krivinu. Prva verzija
    // je gledala samo jedan kraj i ostavljala prelome od dva metra.
    //
    // Popuštanje na jednoj tački ne može napraviti novi prelom: faktor mijenja
    // samo dužinu koraka, a uglovi ostaju netaknuti — isti ugao na dužem koraku
    // znači BLAŽU krivinu, nikad oštriju.
    const ostro = Math.max(Math.abs(sirovo[i] ?? 0), Math.abs(sirovo[i + 1] ?? 0));
    const poPrelomu = ostro === 0 ? Infinity : 1 / ostro / MIN_CURVE_RADIUS;
    return Math.max(1, Math.min(zeljeni, dozvoljeni, poPrelomu));
  });

  const zaokret = Math.PI / 2 - uglovi[0]!;

  /** Osovina za date faktore: isti uglovi, kraći koraci. */
  const izgradi = (f: readonly number[]) => {
    const tacke: Point[] = [{ x: 0, y: 0 }];
    const sStvarni: number[] = [0];
    const sSabijeni: number[] = [0];
    let x = 0;
    let y = 0;
    for (let i = 0; i < uglovi.length; i++) {
      const d = stvarniKorak / (f[i] ?? 1);
      const ugao = uglovi[i]! + zaokret;
      x += Math.cos(ugao) * d;
      y += Math.sin(ugao) * d;
      tacke.push({ x, y });
      sStvarni.push(sStvarni[i]! + stvarniKorak);
      sSabijeni.push(sSabijeni[i]! + d);
    }
    return { tacke, sStvarni, sSabijeni };
  };

  const sagradjeno = izgradi(faktori);

  const { tacke: sabijeneTacke, sStvarni, sSabijeni } = sagradjeno;
  const duzina = sSabijeni[sSabijeni.length - 1]!;
  const stvarnaDuzina = sStvarni[sStvarni.length - 1]!;
  const skretanje = k.reduce((a, kappa) => a + Math.abs(kappa) * stvarniKorak, 0);

  /**
   * Poluprečnik poslije sabijanja se IZVODI, ne mjeri ponovo.
   *
   * Pošto se ugao u svakoj tački čuva, a korak se dijeli faktorom, važi tačno
   * `R' = R / f` — na svakoj razmjeri. Ponovno mjerenje sabijene osovine daje
   * drugu veličinu: izglađivanje preko četrdeset metara sabijenog puta pokriva
   * `40 · f` metara stvarnog, pa hvata sitnije prelome nego ulazni račun i
   * ispada oštrije. Prva verzija je baš to poredila i „nalazila" prekršaje
   * granice koje sabijanje nije napravilo.
   */
  const kSabijeno = k.map((kappa, i) => kappa * (faktori[i] ?? 1));
  const poluprecnici = kSabijeno.map((kappa) => (kappa === 0 ? Infinity : 1 / Math.abs(kappa)));
  const najmanjiPoluprecnik = poluprecnici.reduce((a, r) => Math.min(a, r), Infinity);
  const najmanjiStvarni = k.reduce(
    (a, kappa) => Math.min(a, kappa === 0 ? Infinity : 1 / Math.abs(kappa)),
    Infinity,
  );
  const sIzlaza = sSabijeni.slice(0, kSabijeno.length);

  return {
    tacke: sabijeneTacke,
    duzina,
    stvarnaDuzina,
    krivine: izdvojKrivine(k, sIzlaza),
    najmanjiPoluprecnik,
    najmanjiStvarni,
    stvarne: uzorci,
    faktori,
    skretanje,
    uSabijeni: (s) => preslikaj(sStvarni, sSabijeni, s),
    uStvarni: (s) => preslikaj(sSabijeni, sStvarni, s),
  };
}

/** Preporučena brzina za poluprečnik [km/h]; `null` kad tabla ne treba. */
export function preporucenaBrzina(radius: number): number | null {
  for (const [granica, brzina] of ADVISORY_BY_RADIUS) {
    if (radius < granica) return brzina;
  }
  return null;
}

/**
 * Krivine sa tablama.
 *
 * Ovdje se gleda STVARNA zakrivljenost, ne sabijena, i to je namjerno. Tabla sa
 * preporučenom brzinom je saobraćajni znak — polaznik uči šta znak znači na
 * putu koji postoji, a pragovi (60 / 100 / 180 m) su pisani za stvarne
 * poluprečnike. Mjereno po sabijenoj geometriji, gdje je poluprečnik pet puta
 * manji, cijela Crna Gora bi dobila tablu „40" na svakih četrdeset metara.
 *
 * OVDJE POSTOJI NESLAGANJE KOJE TREBA RIJEŠITI PRIJE PRAVILA O BRZINI U
 * KRIVINI: tabla govori o stvarnoj krivini, a igrač vozi sabijenu, koja je za
 * faktor oštrija. Dok se brzina u krivini ne sudi, tabla je samo obavještenje i
 * neslaganje ništa ne obara. Kad to pravilo dođe, mora se odlučiti šta je
 * mjerodavno — inače bi se kažnjavalo po znaku koji ne opisuje put pod točkovima.
 *
 * Krivina je neprekidan niz tačaka u kojima je poluprečnik ispod praga za tablu
 * I u kojima se ne mijenja strana. Podjela po strani nije sitnica: na serpentini
 * ispod Njeguša poluprečnik ne izlazi iznad praga skoro nigdje, pa je bez nje
 * cijeli put ispadao kao tri krivine.
 *
 * Za brzinu se uzima NAJOŠTRIJE mjesto u nizu, ne prosjek: tabla važi za cio
 * luk, a vozač koji uđe po prosjeku izleti na najoštrijem.
 */
function izdvojKrivine(kStvarno: readonly number[], sSabijeni: readonly number[]): RoadCurve[] {
  const strana = (kappa: number) => (kappa >= 0 ? 1 : -1);
  const nizovi: { od: number; do: number; strana: number }[] = [];
  let tekuci: { od: number; do: number; strana: number } | null = null;

  for (let i = 0; i < kStvarno.length; i++) {
    const kappa = kStvarno[i]!;
    const radius = kappa === 0 ? Infinity : 1 / Math.abs(kappa);
    const uKrivini = radius < ADVISORY_MAX_RADIUS;
    if (!uKrivini) {
      if (tekuci) nizovi.push(tekuci);
      tekuci = null;
      continue;
    }
    if (tekuci && tekuci.strana === strana(kappa)) {
      tekuci.do = i;
      continue;
    }
    if (tekuci) nizovi.push(tekuci);
    tekuci = { od: i, do: i, strana: strana(kappa) };
  }
  if (tekuci) nizovi.push(tekuci);

  // Spajanje bliskih nizova ISTE strane — jedna krivina zna da se očita kao
  // dvije kad izglađena zakrivljenost na sredini luka na trenutak popusti.
  const spojeni: typeof nizovi = [];
  for (const n of nizovi) {
    const zadnji = spojeni[spojeni.length - 1];
    const razmak = zadnji ? (sSabijeni[n.od] ?? 0) - (sSabijeni[zadnji.do] ?? 0) : Infinity;
    if (zadnji && zadnji.strana === n.strana && razmak < CURVE_MERGE_GAP) zadnji.do = n.do;
    else spojeni.push({ ...n });
  }

  const out: RoadCurve[] = [];
  for (const n of spojeni) {
    let najostrije = Infinity;
    for (let i = n.od; i <= n.do; i++) {
      const kappa = kStvarno[i]!;
      const radius = kappa === 0 ? Infinity : 1 / Math.abs(kappa);
      if (radius < najostrije) najostrije = radius;
    }
    const brzina = preporucenaBrzina(najostrije);
    if (brzina === null) continue;
    const od = sSabijeni[n.od] ?? 0;
    const doK = sSabijeni[Math.min(sSabijeni.length - 1, n.do + 1)] ?? od;
    // Prekratak luk nije krivina nego talas u poliliniji; tabla pred njim samo
    // smeta. Mjeri se po sabijenom putu, jer se toliko i vozi.
    if (doK - od < MIN_CURVE_ARC) continue;
    out.push({
      atS: (od + doK) / 2,
      arc: Math.max(1, doK - od),
      // Poluprečnik STVARNE krivine — isto mjerilo kao i tabla iznad.
      radius: najostrije,
      // Pozitivna zakrivljenost je ulijevo — isti dogovor kao u `sim/road.ts`.
      side: n.strana >= 0 ? "left" : "right",
      advisorySpeed: brzina,
    });
  }
  return out;
}
