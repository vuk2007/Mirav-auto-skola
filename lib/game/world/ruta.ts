/**
 * Ruta: više dionica nanizanih u JEDAN koordinatni sistem.
 *
 * Do sada je svaka dionica bila svoj svijet — svoja osovina koja počinje u
 * ishodištu, svoje vrijeme, svoja brzina od nule. Između dvije se ekran gasio i
 * palio, jer je između njih bila promjena React faze, a ne događaj u vožnji.
 *
 * Ovdje se dionice spajaju u jednu poliliniju. Igrač vozi od nule do kraja rute
 * bez ijednog prekida: nema resetovanja koordinata, nema ponovnog kretanja iz
 * mjesta, nema ekrana između. Prelazak sa Cetinja na Podgoricu je samo metar
 * puta kao i svaki drugi.
 *
 * ŠTO SE ČUVA NA SPOJU
 *
 * Ne spajaju se kraj-na-kraj kako dođe. Na čvoru se put stvarno skreće, pa se
 * ugao između dvije dionice uzima iz STVARNE geometrije — razlika azimuta
 * posljednjeg segmenta jedne i prvog segmenta druge ivice, mjerena u UTM
 * metrima. Zato ruta Budva — Kolašin i na ekranu ide na sjeveroistok, a ne u
 * pravcu u kojem je slučajno počela.
 *
 * Sam ugao se poslije zaobli: na čvoru u prirodi stoji raskrsnica na kojoj se
 * skreće, a nju modelujemo tek u sljedećem koraku. Dok je nema, oštar prelom bi
 * značio da se vozilo okrene u mjestu.
 */

import { ROAD_STEP, ROUTE_JOIN_WINDOW } from "../sim/config";
import type { Point, RoadCurve, RoadLandmark } from "../sim/types";
import { osovina, type EdgeGeometry } from "../road/edgeGeometry";
import { edgeById, edgesAt, otherEnd, type RoadEdge } from "../road/roadGraph";
import { preuzorkuj, sabijenaIvica, type Sabijeno } from "../road/sabijanje";
import { landmarksOnEdge } from "../road/landmarks";

/** Jedna dionica rute, sa mjestom koje zauzima duž cijele rute. */
export interface RutaDionica {
  edge: RoadEdge;
  /** Vozi se od `b` prema `a`. */
  obrnuto: boolean;
  /** Čvor iz kojeg se kreće i u koji se stiže. */
  od: string;
  do: string;
  /** Gdje na ruti dionica počinje i završava [m]. */
  odS: number;
  doS: number;
  /** Dozvoljena brzina na njoj [m/s]. */
  vMax: number;
  sabijeno: Sabijeno;
  /** Koliko je metara odsječeno sa početka, kao zajednički krak sa prethodnom. */
  skinuto: number;
  /** Koliko tačaka dionica stvarno doprinosi ruti. */
  tacaka: number;
}

export interface Ruta {
  id: string;
  /** Čvorovi kroz koje ruta prolazi, po redu. */
  cvorovi: string[];
  dionice: RutaDionica[];
  /** Osovina cijele rute; počinje u ishodištu, u smjeru +y. */
  tacke: Point[];
  duzina: number;
  /** Stvarna dužina svih dionica zajedno [m]. */
  stvarnaDuzina: number;
  krivine: RoadCurve[];
  landmarks: RoadLandmark[];
  /** Najveća dozvoljena brzina na cijeloj ruti [m/s]. */
  vMax: number;
  /** Dionica na mjestu `s`. */
  dionicaNa(s: number): RutaDionica;
  /** Dozvoljena brzina na mjestu `s` [m/s] — mijenja se od dionice do dionice. */
  vMaxNa(s: number): number;
}

/** Preko koliko metara se mjeri azimut na kraju ivice. */
const AZIMUT_POJAS = 150;
/**
 * Dokle se dvije tačke smatraju istom pri traženju zajedničkog kraka [m].
 *
 * Polilinije su uprošćene na pet metara, pa dvije rute kroz isti put nemaju
 * tačke na istim mjestima; tri metra je taman da se prepozna isti krak, a da se
 * dva različita puta koja prolaze blizu ne pomiješaju.
 */
const POKLAPANJE_TOL = 3;

const svedi = (a: number): number => {
  let x = a;
  while (x > Math.PI) x -= 2 * Math.PI;
  while (x <= -Math.PI) x += 2 * Math.PI;
  return x;
};

/**
 * Azimut na ulasku i izlasku iz ivice, u smjeru vožnje.
 *
 * Mjeri se preko `AZIMUT_POJAS` metara, ne po jednom segmentu. Razlog je
 * konkretan: dvije ivice koje se sastaju u istom čvoru često dijele posljednjih
 * desetak metara — obje su rutirane do iste prilijepljene tačke, pa jedna u nju
 * ulazi a druga iz nje izlazi istim krakom. Po jednom segmentu je to izgledalo
 * kao skretanje od tačno 180 stepeni, na Cetinju i na još pet čvorova.
 */
function azimuti(
  geom: EdgeGeometry,
  obrnuto: boolean,
  preskoci: { napocetku: number; nakraju: number } = { napocetku: 0, nakraju: 0 },
): { pocetni: number; krajnji: number } {
  const t = osovina(geom, obrnuto);
  /** Indeks tačke udaljene `koliko` metara od `od`, u smjeru `smjer`. */
  const naOdmaku = (od: number, smjer: 1 | -1, koliko: number): number => {
    let preslo = 0;
    let i = od;
    while (preslo < koliko) {
      const j = i + smjer;
      if (j < 0 || j >= t.length) break;
      preslo += Math.hypot(t[j]!.x - t[i]!.x, t[j]!.y - t[i]!.y);
      i = j;
    }
    return i;
  };
  // `preskoci` je zajednički krak koji se ionako odsijeca: mjeren zajedno sa
  // njim, azimut bi dao pravac po kojem se ne vozi.
  const a = naOdmaku(0, 1, preskoci.napocetku);
  const b = naOdmaku(a, 1, AZIMUT_POJAS);
  const z = naOdmaku(t.length - 1, -1, preskoci.nakraju);
  const y = naOdmaku(z, -1, AZIMUT_POJAS);
  return {
    pocetni: Math.atan2(t[b]!.y - t[a]!.y, t[b]!.x - t[a]!.x),
    krajnji: Math.atan2(t[z]!.y - t[y]!.y, t[z]!.x - t[y]!.x),
  };
}

/**
 * Koliko se metara zajedničkog kraka dijele dvije uzastopne dionice.
 *
 * Traži se na STVARNOJ geometriji, u UTM metrima. Sabijene tačke su svaka u
 * svom lokalnom sistemu — obje počinju u ishodištu — pa ih je besmisleno
 * porediti; prva verzija je to radila i nalazila poklapanje od nula metara na
 * svakom čvoru, iako se krajevi poklapaju u milimetar.
 *
 * Bez odsijecanja ruta u čvor uđe pa se istim krakom vrati: skretanje od tačno
 * 180 stepeni, izmjereno na Cetinju, Danilovgradu, Andrijevici, Podgorici i
 * Mojkovcu.
 */
function poklapanje(kraj: readonly Point[], pocetak: readonly Point[]): number {
  let duzina = 0;
  for (let i = 1; i < Math.min(kraj.length, pocetak.length) - 1; i++) {
    const a = kraj[kraj.length - 1 - i]!;
    const b = pocetak[i]!;
    if (Math.hypot(a.x - b.x, a.y - b.y) > POKLAPANJE_TOL) break;
    duzina += Math.hypot(b.x - pocetak[i - 1]!.x, b.y - pocetak[i - 1]!.y);
  }
  return duzina;
}

/**
 * Spoj dvije dionice se zamjenjuje lukom.
 *
 * Uzmu se tačke na `poluprozor` metara sa obje strane spoja i kroz njih se
 * provuče kvadratna Bézierova kriva sa kontrolnom tačkom u samom spoju. Kriva
 * ne prolazi kroz kontrolnu tačku nego je zaobiđe — što je upravo skretanje
 * kakvo se vozi na raskrsnici.
 *
 * Zašto ne razmazivanje susjeda: ono na velikom uglu konvergira presporo. Na
 * ruti Herceg Novi — Rožaje je poslije četiri stotine prolaza ostajao ugao od
 * 179 stepeni. Luk je određen, radi iz prve i ne zavisi od broja prolaza.
 */
function spojiLukom(tacke: readonly Point[], sredina: number, poluprozor: number): Point[] {
  const od = Math.max(0, sredina - poluprozor);
  const doK = Math.min(tacke.length - 1, sredina + poluprozor);
  if (doK - od < 4) return [...tacke];
  const p0 = tacke[od]!;
  const p1 = tacke[sredina]!;
  const p2 = tacke[doK]!;

  // Broj uzoraka po dužini tetiva — luk je uvijek kraći od njih, pa razmak
  // ispadne nešto gušći od koraka, a preuzorkovanje ga poslije poravna.
  const gruba = Math.hypot(p1.x - p0.x, p1.y - p0.y) + Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const n = Math.max(4, Math.round(gruba / ROAD_STEP));
  const luk: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    luk.push({
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    });
  }
  return [...tacke.slice(0, od), ...luk, ...tacke.slice(doK + 1)];
}

/** Kumulativna dužina polilinije. */
function kumulativno(tacke: readonly Point[]): number[] {
  const out = [0];
  for (let i = 1; i < tacke.length; i++) {
    const a = tacke[i - 1]!;
    const b = tacke[i]!;
    out.push(out[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return out;
}

/**
 * Ivica između dva susjedna čvora.
 *
 * Traži se u grafu, ne pogađa: ruta koja bi tražila vezu koje nema je greška u
 * pozivu, a ne nešto što se popravlja izmišljanjem puta.
 */
function ivicaIzmedju(od: string, doK: string): RoadEdge {
  for (const e of edgesAt(od)) {
    if (otherEnd(e, od) === doK) return e;
  }
  throw new Error(`Graf nema vezu ${od} — ${doK}`);
}

/**
 * Napravi rutu kroz zadate čvorove.
 *
 * `geom` daje stvarnu geometriju po `id`-u ivice. Ako neka nedostaje, ruta se
 * ne pravi — bolje jasna greška nego dionica koja se tiho vrati na izmišljene
 * krivine.
 */
export function napraviRutu(cvorovi: readonly string[], geom: ReadonlyMap<string, EdgeGeometry>): Ruta {
  if (cvorovi.length < 2) throw new Error("Ruta traži bar dva čvora");

  const dionice: RutaDionica[] = [];
  const tacke: Point[] = [];
  const spojevi: number[] = [];
  let ugaoKraja = Math.PI / 2;
  let krajnjiAzimut = 0;
  let prethodneStvarne: readonly Point[] | null = null;
  let prethodniGeom: { g: EdgeGeometry; obrnuto: boolean } | null = null;

  for (let i = 0; i + 1 < cvorovi.length; i++) {
    const od = cvorovi[i]!;
    const doK = cvorovi[i + 1]!;
    const edge = ivicaIzmedju(od, doK);
    const g = geom.get(edge.id);
    if (!g) throw new Error(`Nema geometrije za ivicu ${edge.id}`);

    const obrnuto = edge.b === od;
    const sabijeno = sabijenaIvica(edge.id, osovina(g), obrnuto);

    // Zajednički krak sa prethodnom dionicom se odsijeca sa oba kraja. Mjera je
    // u metrima STVARNOG puta, a sabijena osovina nosi po tačku na svaki
    // `ROAD_STEP` stvarnog puta — pa se metri pretvaraju u tačke dijeljenjem.
    const stvarne = osovina(g, obrnuto);
    const zajednicko = prethodneStvarne ? poklapanje(prethodneStvarne, stvarne) : 0;
    const odsjeci = Math.min(
      Math.round(zajednicko / ROAD_STEP),
      Math.floor(sabijeno.tacke.length / 4),
    );
    const az = azimuti(g, obrnuto, { napocetku: zajednicko, nakraju: 0 });
    const svoje: readonly Point[] = odsjeci > 0 ? sabijeno.tacke.slice(odsjeci) : sabijeno.tacke;
    if (odsjeci > 0 && tacke.length > odsjeci) {
      tacke.length -= odsjeci;
      // Ugao kraja se mora PONOVO očitati: bio je mjeren na tačkama koje su
      // upravo obrisane, pa bi rotacija nove dionice krenula od pravca kojeg
      // više nema. Tu je nastajao prelom na spoju.
      const z = tacke[tacke.length - 1]!;
      const y = tacke[tacke.length - 2] ?? z;
      ugaoKraja = Math.atan2(z.y - y.y, z.x - y.x);
      // Isto važi i za stvarni azimut prethodne dionice: mjeren je do njenog
      // kraja, a kraj je sada `zajednicko` metara ranije.
      if (prethodniGeom) {
        krajnjiAzimut = azimuti(prethodniGeom.g, prethodniGeom.obrnuto, {
          napocetku: 0,
          nakraju: zajednicko,
        }).krajnji;
      }
    }
    prethodneStvarne = stvarne;
    prethodniGeom = { g, obrnuto };
    // Koliko je metara sabijene dionice skinuto sa početka — znamenitosti se za
    // toliko pomjeraju.
    const skinuto =
      odsjeci > 0 ? (kumulativno(sabijeno.tacke.slice(0, odsjeci + 1)).at(-1) ?? 0) : 0;

    // Prva dionica postavlja početak; svaka sljedeća se okreće tako da se na
    // čvoru skrene onoliko koliko se skreće i u prirodi.
    const zaokret =
      i === 0
        ? 0
        : svedi(ugaoKraja + svedi(az.pocetni - krajnjiAzimut) - Math.PI / 2);
    const cos = Math.cos(zaokret);
    const sin = Math.sin(zaokret);
    const pocetak = tacke.length === 0 ? { x: 0, y: 0 } : tacke[tacke.length - 1]!;

    const komad: Point[] = svoje.map((p: Point) => ({
      x: pocetak.x + p.x * cos - p.y * sin,
      y: pocetak.y + p.x * sin + p.y * cos,
    }));
    // Prva tačka nove dionice je posljednja tačka prethodne — ne upisuje se dvaput.
    if (tacke.length > 0) {
      spojevi.push(tacke.length - 1);
      komad.shift();
    }
    tacke.push(...komad);

    const zadnja = tacke[tacke.length - 1]!;
    const pretposljednja = tacke[tacke.length - 2] ?? zadnja;
    ugaoKraja = Math.atan2(zadnja.y - pretposljednja.y, zadnja.x - pretposljednja.x);
    krajnjiAzimut = az.krajnji;

    dionice.push({
      edge,
      obrnuto,
      od,
      do: doK,
      odS: 0,
      doS: 0,
      vMax: edge.speedLimit / 3.6,
      sabijeno,
      skinuto,
      tacaka: svoje.length,
    });
  }

  // Granice dionica se očitavaju prije preuzorkovanja, po tačkama.
  const kum = kumulativno(tacke);
  let indeks = 0;
  const granice: number[] = [];
  for (const d of dionice) {
    d.odS = kum[indeks]!;
    indeks += d.tacaka - (indeks === 0 ? 1 : 0);
    d.doS = kum[Math.min(indeks, kum.length - 1)]!;
    granice.push(d.doS);
  }
  const prijeUzorka = kum[kum.length - 1]!;

  /**
   * Osovina se preuzorkuje na jednak korak.
   *
   * Sabijena dionica nosi po tačku na svaka četiri metra STVARNOG puta, pa joj
   * poslije sabijanja tačke stoje na pola metra. Za rutu od tridesetak
   * kilometara to je preko šezdeset hiljada tačaka kroz koje bi i putanje traka
   * i crtanje prolazili u svakom kadru, bez ijedne koristi: oblik je isti i na
   * četiri metra.
   */
  let osovinaRute = preuzorkuj(tacke, ROAD_STEP);

  /**
   * Zaobljavanje spojeva.
   *
   * Radi se TEK POSLIJE preuzorkovanja i istom mašinerijom kojom se skidaju
   * uglovi digitalizacije. Prva verzija je blago razmazivala tačke prije
   * preuzorkovanja, dok su stajale na pola metra — na oštrom uglu to ne uradi
   * ništa: na ruti Ulcinj — Pljevlja je poslije toga ostajao spoj poluprečnika
   * nula, na kojem se traka prelamala i vozila su se sudarala.
   *
   * Luk se provlači kroz tačke na `ROUTE_JOIN_WINDOW` koraka sa obje strane
   * spoja — na čvoru u prirodi stoji raskrsnica, a skretanje na njoj i jeste
   * luk tog reda veličine.
   */
  // Ide se OD POSLJEDNJEG SPOJA UNAZAD. Zaobljavanje mijenja broj tačaka u
  // isječku, pa svako sljedeće pomjeri indekse svih spojeva iza sebe; obrnutim
  // redom se dira samo ono što je već obrađeno. Prva verzija je išla unaprijed
  // i promašivala spojeve — na ruti Herceg Novi — Rožaje je tako ostajao ugao
  // od 179 stepeni, dakle put koji se vraća sam u sebe.
  for (const sSpoja of [...granice.slice(0, -1)].reverse()) {
    const sredina = Math.round(sSpoja / ROAD_STEP);
    osovinaRute = spojiLukom(osovinaRute, sredina, ROUTE_JOIN_WINDOW);
  }
  osovinaRute = preuzorkuj(osovinaRute, ROAD_STEP);

  const kumPoslije = kumulativno(osovinaRute);
  const duzina = kumPoslije[kumPoslije.length - 1]!;
  // Preuzorkovanje skrati liniju za dio promila (tetiva umjesto luka), pa se
  // granice dionica srazmjerno pomjere — inače bi zbir dionica bio duži od rute.
  const odnos = prijeUzorka > 0 ? duzina / prijeUzorka : 1;
  for (const [i, d] of dionice.entries()) {
    d.odS = i === 0 ? 0 : (granice[i - 1] ?? 0) * odnos;
    d.doS = (granice[i] ?? prijeUzorka) * odnos;
  }
  dionice[dionice.length - 1]!.doS = duzina;
  tacke.length = 0;
  tacke.push(...osovinaRute);

  const krivine: RoadCurve[] = [];
  const landmarks: RoadLandmark[] = [];
  for (const d of dionice) {
    /**
     * Mjesto na dionici → mjesto na ruti.
     *
     * Nije prosto `odS + atS`. Dionica na ruti zauzima manje nego što je sama
     * duga: sa početka joj je odsječen zajednički krak, a spoj sa susjedom je
     * zamijenjen lukom koji sječe ugao. Zato se preslikava srazmjerno rasponu
     * koji je dionici stvarno pripao — inače krivina sa kraja posljednje
     * dionice ispadne iza kraja rute, što je i bilo izmjereno: trideset dva
     * metra viška na ruti Ulcinj — Pljevlja.
     */
    const svoja = Math.max(1, d.sabijeno.duzina - d.skinuto);
    const razmjera = (d.doS - d.odS) / svoja;
    const naRuti = (naDionici: number): number =>
      Math.min(d.doS, Math.max(d.odS, d.odS + naDionici * razmjera));

    for (const c of d.sabijeno.krivine) {
      const mjesto = c.atS - d.skinuto;
      if (mjesto < 0) continue;
      krivine.push({ ...c, atS: naRuti(mjesto) });
    }
    for (const l of landmarksOnEdge(d.edge.id, d.obrnuto)) {
      if (l.at.kind !== "edge") continue;
      const udio = l.at.atKm / d.edge.km;
      const naDionici = d.sabijeno.uSabijeni(udio * d.sabijeno.stvarnaDuzina) - d.skinuto;
      if (naDionici < 0) continue;
      landmarks.push({ atS: naRuti(naDionici), side: l.at.side, icon: l.icon, name: l.name });
    }
  }
  krivine.sort((a, b) => a.atS - b.atS);
  landmarks.sort((a, b) => a.atS - b.atS);

  const dionicaNa = (s: number): RutaDionica => {
    for (const d of dionice) if (s < d.doS) return d;
    return dionice[dionice.length - 1]!;
  };

  return {
    id: `ruta:${cvorovi.join(">")}`,
    cvorovi: [...cvorovi],
    dionice,
    tacke,
    duzina,
    stvarnaDuzina: dionice.reduce((a, d) => a + d.sabijeno.stvarnaDuzina, 0),
    krivine,
    landmarks,
    vMax: Math.max(...dionice.map((d) => d.vMax)),
    dionicaNa,
    vMaxNa: (s) => dionicaNa(s).vMax,
  };
}

/** Kilometraža rute po grafu [km] — zbir ivica, ne sabijene dužine. */
export const kilometraza = (ruta: Ruta): number =>
  ruta.dionice.reduce((a, d) => a + d.edge.km, 0);

/** Najkraća ruta kroz graf, po broju dionica. Vraća čvorove ili `null`. */
export function nadjiRutu(od: string, doK: string): string[] | null {
  if (od === doK) return [od];
  const odakle = new Map<string, string>();
  const red = [od];
  const vidjeni = new Set([od]);
  while (red.length > 0) {
    const cvor = red.shift()!;
    for (const e of edgesAt(cvor)) {
      const drugi = otherEnd(e, cvor);
      if (vidjeni.has(drugi)) continue;
      vidjeni.add(drugi);
      odakle.set(drugi, cvor);
      if (drugi === doK) {
        const put = [doK];
        let m = doK;
        while (m !== od) {
          m = odakle.get(m)!;
          put.push(m);
        }
        return put.reverse();
      }
      red.push(drugi);
    }
  }
  return null;
}

/** Postoji li ivica sa tim `id`-om — korisno pri sastavljanju ruta u testu. */
export const imaIvicu = (id: string): boolean => edgeById(id) !== undefined;
