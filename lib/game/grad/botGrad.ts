import {
  CAR_LENGTH,
  CAR_WIDTH,
  DT,
  GRAD_BOT_BOCNO,
  GRAD_BOT_IZVLACENJE,
  GRAD_BOT_IZVLACENJE_BRZINA,
  GRAD_BOT_IZ_BUSA,
  GRAD_BOT_U_BUS,
  GRAD_BOT_NAJKRACA_PROMJENA,
  GRAD_BOT_ODSJEK_NAJVISE,
  GRAD_BOT_OSTAR_LOM,
  GRAD_BOT_PETLJA_PROZOR,
  GRAD_BOT_PETLJA,
  GRAD_BOT_POLUPRECNICI,
  GRAD_BOT_RAZDJELNICA_BLIZU,
  GRAD_BOT_RAZDJELNICA_NAGIB,
  GRAD_BOT_RAZDJELNICA_NAJKRACA,
  GRAD_BOT_RAZDJELNICA_RAZMAK,
  GRAD_BOT_RAZDJELNICA_ODMAK,
  GRAD_BOT_REZERVA_LUKA,
  GRAD_BOT_SUDIJA_GUSTO,
  GRAD_BOT_SUDIJA_RIJETKO,
  GRAD_BOT_TRAKA_UNAPRIJED,
  GRAD_BOT_UGAO_CVORA,
  GRAD_BOT_REZERVA_BRZINE,
  GRAD_BOT_ZMIGAVAC_PRIJE,
  GRAD_BOT_ZMIGAVAC_REZERVA,
  GRAD_FUZZ_NAJKRACA,
  GRAD_IZLAZ_POTVRDA,
  GRAD_MEDJUOSOVINSKO,
  GRAD_POLUKRUZNO_UGAO,
  GRAD_PRILAZ_DO,
  GRAD_PRSTEN_RUB,
  GRAD_SKRETANJE_UGAO,
  GRAD_VOLAN_UGAO,
  GRAD_VOZAC_USPORENJE,
  GRAD_ZAOBLJENJE_UDIO,
  STOP_HOLD,
  STOP_MARGIN,
  YELLOW_COMMIT_TTC,
  type Level,
} from "../sim/config";
import { cumulative, headingAt, pointAt, segmentIntersection } from "../sim/geometry";
import type { Input, Point } from "../sim/types";
import { ogranicenjeNa } from "./brzine";
import { naLinijiTraka, pojasBusa, punaIzmedju, punaTrakeOd } from "./linije";
import { bokNaIvici, dvotracniPrsten, manevarKrakova, pravacKraja, ugaoSkretanja as ugao, type Ivica, type Manevar, type Mreza } from "./mreza";
import { prekrsenaZabrana, svjetlo, zabranaKraka, zelenaStrelica, type Krak, type Raskrsnice, type Zabrana } from "./raskrsnica";
import { naPovrsini, type Povrsina } from "./povrsina";
import { korakSlobodno, type SlobodnoVozilo } from "./slobodno";
import { noviSudija, stopLinija, sudi, type GradskiPrekrsaj, type GradZaSudiju, type Sudija } from "./sudija";
import { naOsovini } from "./osovina";
import { naPutanji, putanja, vozi, type Putanja } from "./vozacGrad";

/**
 * Savršeni bot u gradu (faza 6, stavka 5f): vozi od–do po propisima, po istom
 * modelu raskrsnice po kojem sudija sudi — ruta poštuje jednosmjerne i zabrane
 * skretanja, auto ide svojom trakom (za skretanje onom koju strelice
 * dozvoljavaju), staje na STOP i crveno, na žuto po istom pragu kao sudija,
 * pali žmigavac prije raskrsnice i gasi ga poslije.
 *
 * Zadatak (odjeljak 8): 50 nasumičnih od–do ruta po Podgorici na nivou 5 bez
 * ijednog prekršaja. Bot koji ne prođe znači grešku ili u njemu, ili u
 * sudiji — i jedno i drugo se mora popraviti.
 */

/** Binarni heap (najmanji prvi) — otvoreni čvorovi A*. */
class Heap<T> {
  private niz: T[] = [];
  private manji: (a: T, b: T) => number;
  constructor(manji: (a: T, b: T) => number) {
    this.manji = manji;
  }
  get velicina(): number {
    return this.niz.length;
  }
  dodaj(x: T): void {
    const n = this.niz;
    n.push(x);
    let i = n.length - 1;
    while (i > 0) {
      const r = (i - 1) >> 1;
      if (this.manji(n[i]!, n[r]!) >= 0) break;
      [n[i], n[r]] = [n[r]!, n[i]!];
      i = r;
    }
  }
  uzmi(): T | undefined {
    const n = this.niz;
    if (n.length === 0) return undefined;
    const vrh = n[0]!;
    const zadnji = n.pop()!;
    if (n.length > 0) {
      n[0] = zadnji;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const d = l + 1;
        let m = i;
        if (l < n.length && this.manji(n[l]!, n[m]!) < 0) m = l;
        if (d < n.length && this.manji(n[d]!, n[m]!) < 0) m = d;
        if (m === i) break;
        [n[i], n[m]] = [n[m]!, n[i]!];
        i = m;
      }
    }
    return vrh;
  }
}

/** Smjer vožnje po ivici: 1 je `a → b`. */
export interface Korak {
  ivica: number;
  smjer: 1 | -1;
}

const kraj = (iv: Ivica, smjer: 1 | -1) => (smjer === 1 ? iv.b : iv.a);
const smije = (iv: Ivica, smjer: 1 | -1) => iv.smjer === 0 || iv.smjer === smjer;
/** Bot ne vozi prilazima i poljskim putevima — tu nema pravila koja bi se provjerila. */
export const ZA_BOTA = (iv: Ivica) => iv.vozna && iv.klasa !== "service" && iv.klasa !== "track";

/**
 * Pravac ulice dalje od čvora: između 10 i 18 m od njega (kraća ivica — koliko
 * ima), na kraju ivice (`naKraju`) ili na početku, u smjeru vožnje.
 */
function pravacDalje(iv: Ivica, smjer: 1 | -1, naKraju: boolean): Point {
  const d1 = Math.min(10, iv.duzina / 2);
  const d2 = Math.min(18, iv.duzina);
  // `s` duž ivice na udaljenosti `d` od čvora na kraju odnosno početku vožnje.
  const sNa = (d: number) => {
    const odA = naKraju ? (smjer === 1 ? iv.duzina - d : d) : smjer === 1 ? d : iv.duzina - d;
    return odA;
  };
  const a = pointAt(iv.tacke, iv.cum, sNa(naKraju ? d2 : d1));
  const b = pointAt(iv.tacke, iv.cum, sNa(naKraju ? d1 : d2));
  const l = Math.hypot(b.x - a.x, b.y - a.y);
  return l < 1e-6 ? pravacKraja(iv, smjer, naKraju) : { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
}

/**
 * Ruta A*-om po smjerovima ivica: jednosmjerne, zabrane skretanja, bez
 * polukružnog i bez skretanja oštrijih od 135° (auto ih u uskoj ulici ne može).
 * Kroz raskrsnicu od više čvorova ugao se mjeri od ulaznog kraka — dva
 * skretanja od 90° preko razdjelnog pojasa bulevara su polukružno.
 */
export function ruta(
  m: Mreza,
  r: Raskrsnice,
  zabrane: Map<string, Zabrana[]>,
  od: Korak,
  do_: Korak,
  najviseKoraka = Infinity,
  vozi: (iv: Ivica) => boolean = ZA_BOTA,
): Korak[] | null {
  const kljuc = (k: Korak) => 2 * k.ivica + (k.smjer === 1 ? 0 : 1);
  const cilj = m.cvorovi[kraj(m.ivice[do_.ivica]!, do_.smjer)]!;
  const h = (k: Korak) => {
    const p = m.cvorovi[kraj(m.ivice[k.ivica]!, k.smjer)]!;
    return Math.hypot(p.x - cilj.x, p.y - cilj.y);
  };
  const g = new Map<number, number>([[kljuc(od), 0]]);
  const prethodni = new Map<number, Korak>();
  // Otvoreni čvorovi u binarnom heap-u, po `f`, pa po redu dodavanja (kao
  // linearna pretraga: od jednakih prvi dodat).
  const otvoreni = new Heap<{ k: Korak; f: number; red: number }>((a, b) => a.f - b.f || a.red - b.red);
  let red = 0;
  otvoreni.dodaj({ k: od, f: h(od), red: red++ });
  const zatvoreni = new Set<number>();
  while (otvoreni.velicina > 0) {
    const { k } = otvoreni.uzmi()!;
    const kk = kljuc(k);
    if (zatvoreni.has(kk)) continue;
    zatvoreni.add(kk);
    // Cilj nedostižan (jednosmjerne, zabrane): bez ograničenja bi pretraga
    // obišla cijeli grad. Drugi vozači traže rutu u hodu — ograniče je.
    if (zatvoreni.size > najviseKoraka) return null;
    if (k.ivica === do_.ivica && k.smjer === do_.smjer) {
      const put = [k];
      let x = kljuc(k);
      while (prethodni.has(x)) {
        const p = prethodni.get(x)!;
        put.unshift(p);
        x = kljuc(p);
      }
      return put;
    }
    const iv = m.ivice[k.ivica]!;
    const c = kraj(iv, k.smjer);
    const ulaz = pravacKraja(iv, k.smjer, true);
    // Ulazni krak raskrsnice kad je `k` njena unutrašnja ivica.
    const rc = r.uCvoru[c]!;
    let ulazUR: Point | null = null;
    let ulazniKorak: Korak = k;
    if (rc >= 0 && r.lista[rc]!.unutrasnje.includes(k.ivica)) {
      let x = kk;
      let p = prethodni.get(x);
      while (p && r.lista[rc]!.unutrasnje.includes(p.ivica)) {
        x = kljuc(p);
        p = prethodni.get(x);
      }
      if (p) {
        ulazUR = pravacKraja(m.ivice[p.ivica]!, p.smjer, true);
        ulazniKorak = p;
      }
    }
    // Povratak u istu raskrsnicu posle kratke petlje (oko bloka, preko dvije
    // skoro iste ulice) je polukružno okretanje — sudija ga tako i vidi.
    let petlja = false;
    if (rc >= 0) {
      let izasao = false;
      let duz = 0;
      for (let p: Korak | undefined = k, x = kk; p && duz < GRAD_BOT_PETLJA; p = prethodni.get(x), x = p ? kljuc(p) : x) {
        const rp = r.uCvoru[kraj(m.ivice[p.ivica]!, p.smjer)]!;
        if (p !== k && rp === rc && izasao) {
          petlja = true;
          break;
        }
        if (rp !== rc) izasao = true;
        duz += m.ivice[p.ivica]!.duzina;
      }
    }
    for (const j of m.izCvora[c] ?? []) {
      const f = m.ivice[j]!;
      if (!vozi(f)) continue;
      for (const smjer of [1, -1] as const) {
        if ((smjer === 1 ? f.a : f.b) !== c || (j === k.ivica && smjer !== k.smjer)) continue;
        if (!smije(f, smjer) || prekrsenaZabrana(zabrane, k.ivica, c, j)) continue;
        const u = ugao(ulaz, pravacKraja(f, smjer, false));
        if (Math.abs(u) > 135) continue;
        if (petlja) continue;
        // Ukosnica: ulica se tik iza čvora savija dalje, i pravac na
        // 10–18 m od čvora je skoro suprotan — auto to ne može okrenuti.
        // Kroz raskrsnicu od više čvorova: od njenog ulaznog kraka.
        const ulIv = m.ivice[ulazniKorak.ivica]!;
        if (Math.abs(ugao(pravacDalje(ulIv, ulazniKorak.smjer, true), pravacDalje(f, smjer, false))) > GRAD_POLUKRUZNO_UGAO) continue;
        // Strelice na traci su i zabrana: manevar koji nijedna traka ne
        // dozvoljava sudija kažnjava (`wrongLaneForTurn`). Gleda se pri izlasku
        // iz raskrsnice, manevar od ulaznog kraka (kroz unutrašnje ivice
        // strelice opisuju cijeli manevar, kao kod sudije).
        // Kružni tok: strelice prilaza važe za izlaz iz prstena, ne za ulazak.
        if (rc >= 0 && !r.lista[rc]!.unutrasnje.includes(j) && !(f.kruzni && !iv.kruzni)) {
          let prilaz = ulazniKorak;
          if (m.ivice[ulazniKorak.ivica]!.kruzni && !f.kruzni) {
            // Izlaz iz prstena. Prilaz: unazad kroz prsten (kružne ivice i
            // unutrašnje ivice raskrsnica na njemu), pa kroz unutrašnje ivice
            // raskrsnice ulaska — do kraka kojim se u nju ušlo (kao sudija).
            let p: Korak | undefined = ulazniKorak;
            const uPrstenu = (x: Korak): boolean => {
              if (m.ivice[x.ivica]!.kruzni) return true;
              const rx = r.uCvoru[kraj(m.ivice[x.ivica]!, x.smjer)]!;
              const pr = prethodni.get(kljuc(x));
              return rx >= 0 && r.lista[rx]!.unutrasnje.includes(x.ivica) && !!pr && uPrstenu(pr);
            };
            while (p && uPrstenu(p)) p = prethodni.get(kljuc(p));
            while (p) {
              const rp = r.uCvoru[kraj(m.ivice[p.ivica]!, p.smjer)]!;
              const pp = prethodni.get(kljuc(p));
              if (!pp || rp < 0 || !r.lista[rp]!.unutrasnje.includes(p.ivica)) break;
              p = pp;
            }
            if (p) prilaz = p;
          }
          const uR = prilaz !== ulazniKorak || !ulazUR ? ugao(pravacKraja(m.ivice[prilaz.ivica]!, prilaz.smjer, true), pravacKraja(f, smjer, false)) : ugao(ulazUR, pravacKraja(f, smjer, false));
          const manevar =
            Math.abs(uR) > GRAD_POLUKRUZNO_UGAO ? "lijevo" : uR > GRAD_SKRETANJE_UGAO ? "desno" : uR < -GRAD_SKRETANJE_UGAO ? "lijevo" : "pravo";
          // Strelice trake u kojoj sudija vidi auto prije ulaska u raskrsnicu:
          // kad je prilazni krak kraći od mjesta čekanja i pola auta (cijeli
          // je u raskrsnici), to su strelice ivice prije njega.
          let saStrelicama = prilaz;
          const kr0 = r.krakIvice.get(`${prilaz.ivica}:${prilaz.smjer === 1 ? 1 : 0}`);
          if (kr0) {
            const zona = r.lista[kr0[0]]!.kraci[kr0[1]]!.cekaD + CAR_LENGTH / 2;
            let duz = m.ivice[prilaz.ivica]!.duzina;
            while (duz < zona) {
              const prije = prethodni.get(kljuc(saStrelicama));
              if (!prije || r.uCvoru[kraj(m.ivice[prije.ivica]!, prije.smjer)]! >= 0) break;
              saStrelicama = prije;
              duz += m.ivice[prije.ivica]!.duzina;
            }
          }
          const dozvole = streliceZa(m.ivice[saStrelicama.ivica]!, saStrelicama.smjer, manevar);
          if (dozvole && !dozvole.includes(true)) continue;
        }
        if (ulazUR && !r.lista[rc]!.unutrasnje.includes(j) && Math.abs(ugao(ulazUR, pravacKraja(f, smjer, false))) > 135) continue;
        // Znak iz editora na ulaznom kraku (zabrana, obavezan smjer) i zabrana
        // ulaska u izlazni krak: za prolaz od kraka do kraka, kao kod sudije.
        if (rc >= 0 && !r.lista[rc]!.unutrasnje.includes(j) && (r.skretanja.size > 0 || r.bezUlaska.size > 0)) {
          const ulIvica = m.ivice[ulazniKorak.ivica]!;
          const cvorUlaza = kraj(ulIvica, ulazniKorak.smjer);
          const mv = manevarKrakova(ulIvica, cvorUlaza, f, c);
          if (zabranaKraka(r, `${ulazniKorak.ivica}:${ulazniKorak.smjer === 1 ? 1 : 0}`, `${j}:${smjer === 1 ? 0 : 1}`, mv)) continue;
        }
        const sl = { ivica: j, smjer };
        const ng = g.get(kk)! + f.duzina + (Math.abs(u) > GRAD_SKRETANJE_UGAO ? (u < 0 ? 12 : 6) : 0);
        const sk = kljuc(sl);
        if (ng < (g.get(sk) ?? Infinity)) {
          g.set(sk, ng);
          prethodni.set(sk, k);
          otvoreni.dodaj({ k: sl, f: ng + h(sl), red: red++ });
        }
      }
    }
  }
  return null;
}

/** Događaj na putanji bota: stop-linija (sa krakom raskrsnice) ili prolaz kroz raskrsnicu. */
interface StopLinija {
  /** `s` na putanji gdje sredina auta staje (nos na `STOP_MARGIN` pred linijom). */
  s: number;
  /** Stop-linija kao kod sudije: tačka na osovini kraka i pravac ka raskrsnici. */
  tacka: Point;
  pravac: Point;
  r: number;
  k: number;
  krak: Krak;
  /** Manevar kroz tu raskrsnicu — svjetlo sa strelicom i dopunska strelica važe po pravcu. */
  manevar: Manevar;
  /** Korak rute na čijem je kraju linija (ulazni korak prolaza). */
  korak: number;
}

/**
 * Prolaz kroz raskrsnicu na putanji: krak ulaska i izlaska (indeksi u
 * `kraci`), i gdje ga sudija vidi — po tome drugi učesnici (stavka 7) znaju
 * kome ustupaju i gdje se putanje sijeku.
 */
export interface ProlazPlana {
  r: number;
  ulaz: number;
  izlaz: number;
  /** Ulazni i izlazni korak rute. */
  ulazKorak: number;
  izlazKorak: number;
  /** `s` sredine auta kad ulazi u raskrsnicu (nos na njenoj ivici) i kad je izlazak potvrđen. */
  od: number;
  do_: number;
  /** `s` sredine auta kad čeka na ulaz (stop-linija, ili ispred zebre na ivici raskrsnice). */
  cekanje: number;
  /** Ulazi sa ivice prstena kružnog toka. */
  uPrstenu: boolean;
  /**
   * Izlazi iz prstena iz unutrašnje trake (na sredini ivice prstena prije
   * izlaza putanja je lijevo od osovine) — vidi `UcesnikPrednosti.izUnutrasnje`.
   */
  izUnutrasnje: boolean;
  /** Stop-linija ovog prolaza (indeks u `linije`), ili −1. */
  linija: number;
}

interface Najava {
  /** Od kad do kad žmigavac gori, `s` na putanji. */
  od: number;
  do_: number;
  strana: "left" | "right";
}

export interface PlanBota {
  put: Putanja;
  /** Najveća brzina u svakoj tački putanje [m/s] (ograničenje, krivina). */
  brzine: number[];
  linije: StopLinija[];
  najave: Najava[];
  prolazi: ProlazPlana[];
  /**
   * Gdje sudija putanju vidi drugačije od plana (opisi). Drugi vozači takvu
   * rutu ne voze; za bota je to greška koju fuzz traži.
   */
  neslaganja: string[];
  /** Nivo ulice u svakoj tački putanje (most, tunel). */
  nivoi: number[];
  /** Koliko raskrsnica je bot prošao osovinom (luk bi sjekao trotoar) — za izvještaj. */
  osovinom: number;
}

/** Pomak sredine trake od osovine, u smjeru vožnje (+ desno): trake dvosmjerne i jednosmjerne ulice. */
function pomakTrake(iv: Ivica, smjer: 1 | -1, lijeva: boolean): number {
  const n = iv.trakeNaprijed + iv.trakeNazad;
  const svoje = smjer === 1 ? iv.trakeNaprijed : iv.trakeNazad;
  if (n === 0 || svoje === 0 || iv.sirina < n * iv.sirinaTrake - 1e-6) {
    // Uska ulica: jednosmjerna po sredini, dvosmjerna desno koliko se može uz
    // rezervu do ivičnjaka (u krivini vozač odstupi od putanje).
    return iv.smjer !== 0 ? 0 : Math.max(0, Math.min(iv.sirina / 4, iv.sirina / 2 - CAR_WIDTH / 2 - GRAD_BOT_REZERVA_LUKA));
  }
  const traka = iv.sirina / n;
  // Autobuskom trakom bot ne vozi: krajnja desna mu je traka do nje.
  const bus = pojasBusa(iv, smjer) ? 1 : 0;
  const desna = iv.sirina / 2 - traka / 2 - bus * traka;
  const lijevaSvoja = iv.sirina / 2 - svoje * traka + traka / 2;
  return lijeva ? lijevaSvoja : desna;
}

/**
 * Da li auto, vođen duž tačaka (pravac od svake do sljedeće), cijeli stoji na
 * asfaltu — u svakoj od njih i na svaki metar između: duga prava između dvije
 * tačke može presjeći trotoar koji nijedna od njih ne dodiruje.
 */
function naAsfaltuCijelom(povrsina: Povrsina, t: readonly Point[], rezerva = GRAD_BOT_REZERVA_LUKA): boolean {
  // Auto uvećan za `GRAD_BOT_REZERVA_LUKA` sa svake strane: vozač u krivini
  // odstupi od putanje, i luk koji auto tek pokriva bi ga odveo na ivičnjak.
  const L = CAR_LENGTH / 2 + rezerva;
  const W = CAR_WIDTH / 2 + rezerva;
  for (let i = 1; i < t.length; i++) {
    const a = t[i - 1]!;
    const b = t[i]!;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d < 1e-6) continue;
    const c = (b.x - a.x) / d;
    const sn = (b.y - a.y) / d;
    const n = Math.max(1, Math.ceil(d));
    for (let j = 1; j <= n; j++) {
      const x = a.x + ((b.x - a.x) * j) / n;
      const y = a.y + ((b.y - a.y) * j) / n;
      for (const [u, w] of [
        [L, W],
        [L, -W],
        [-L, W],
        [-L, -W],
        [0, W],
        [0, -W],
        [L, 0],
      ] as const) {
        if (!naPovrsini(povrsina, x + u * c - w * sn, y + u * sn + w * c)) return false;
      }
    }
  }
  return true;
}

/**
 * Lomne tačke ivice strogo između `od` i `do_` metara od njenog početka u
 * smjeru vožnje, pomaknute `w` udesno.
 */
function tackeOdsjecka(iv: Ivica, smjer: 1 | -1, od: number, do_: number, w: number): Point[] {
  const out: Point[] = [];
  const n = iv.tacke.length;
  for (let k = 1; k < n - 1; k++) {
    const idx = smjer === 1 ? k : n - 1 - k;
    const d = smjer === 1 ? iv.cum[idx]! : iv.duzina - iv.cum[idx]!;
    if (d <= od + 0.5 || d >= do_ - 0.5) continue;
    const c = iv.tacke[idx]!;
    let h = headingAt(iv.tacke, iv.cum, iv.cum[idx]!);
    if (smjer === -1) h = { x: -h.x, y: -h.y };
    out.push({ x: c.x - h.y * w, y: c.y + h.x * w });
  }
  return out;
}

/**
 * Prolazi kroz raskrsnice kako ih vidi sudija, za auto koji ide tačno po
 * putanji: raskrsnica, `s` ulaska i `s` potvrđenog izlaska. Isti sudija kao u
 * vožnji (zone raskrsnica, prepoznavanje ulice) — bez žmigavca; prekršaji se
 * ovdje ne gledaju.
 */
function prolaziSudije(
  g: GradZaSudiju,
  tacke: Point[],
  gusto: readonly [number, number][],
): { r: number; od: number; do_: number; manevar: string }[] {
  const cum = cumulative(tacke);
  const duzina = cum[cum.length - 1] ?? 0;
  const sudija = noviSudija(5);
  const out: { r: number; od: number; do_: number; manevar: string }[] = [];
  let sad = 0;
  let otvoren: { r: number; od: number } | null = null;
  sudija.dnevnik = (q) => {
    if (otvoren && otvoren.r === q.r) out.push({ r: q.r, od: otvoren.od, do_: sad, manevar: q.manevar });
    otvoren = null;
  };
  sudija.naUlazu = (r) => {
    otvoren = { r, od: sad };
  };
  let t = 0;
  // Gusto (0,5 m) samo oko raskrsnica: ulazak i izlazak sudija vidi tamo, a
  // između njih je ulica — tu je dovoljno svaka 3 m (pola cijene plana).
  const blizu = (x: number) => gusto.some(([a, b]) => x >= a && x <= b);
  for (sad = 0; sad <= duzina; sad += blizu(sad) ? 0.5 : GRAD_BOT_SUDIJA_RIJETKO) {
    const q = pointAt(tacke, cum, sad);
    const h = headingAt(tacke, cum, sad);
    const st: SlobodnoVozilo = {
      x: q.x,
      y: q.y,
      ugao: Math.atan2(h.y, h.x),
      v: 5,
      tocak: 0,
      rikverc: false,
      kocnicaStoji: 0,
      udar: false,
      predjeno: sad,
    };
    t += DT;
    sudi(g, sudija, st, t, null);
  }
  return out;
}

/**
 * Glatka kriva (kubni Bezier) od `p0` u pravcu `h1` do `p3` u pravcu `h2`,
 * bez krajnjih tačaka — za spoj sa malim uglom i za ulazak u traku do izlaza
 * iz raskrsnice. `d` je razmak `p0`–`p3`.
 */
function bezier(p0: Point, h1: Point, p3: Point, h2: Point, d: number): Point[] {
  const kk = Math.max(d * GRAD_ZAOBLJENJE_UDIO, 1.5);
  const a = { x: p0.x + h1.x * kk, y: p0.y + h1.y * kk };
  const b = { x: p3.x - h2.x * kk, y: p3.y - h2.y * kk };
  const n = Math.max(4, Math.ceil(d / 1.5));
  const izlaz: Point[] = [];
  for (let j = 1; j < n; j++) {
    const t = j / n;
    const u = 1 - t;
    izlaz.push({
      x: u * u * u * p0.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * a.y + 3 * u * t * t * b.y + t * t * t * p3.y,
    });
  }
  return izlaz;
}

/**
 * Putanja bez petlji i bez oštrih lomova (stavka 7). Traka pomaknuta od
 * oštrog ugla ulice (u čvoru između dvije ivice, ili kad se lukovi
 * susjednih raskrsnica preklope) presijeca samu sebe — auto bi išlo naprijed,
 * nazad, pa preko osovine. Bot to izravna volanom, a drugi vozači idu tačno
 * putanjom. Petlja (segment siječe segment do `GRAD_BOT_PETLJA_PROZOR` tačaka
 * dalje) se zamjenjuje presjekom; lom veći od `GRAD_BOT_OSTAR_LOM` se
 * zaobljava sijecanjem ugla. Ograničenje brzine ide uz tačke (najmanje).
 */
export function ocistiPutanju(t: Point[], o: number[], nv: number[]): void {
  for (let i = t.length - 1; i > 0; i--) {
    if (Math.hypot(t[i]!.x - t[i - 1]!.x, t[i]!.y - t[i - 1]!.y) >= 0.05) continue;
    o[i - 1] = Math.min(o[i - 1]!, o[i]!);
    t.splice(i, 1);
    o.splice(i, 1);
    nv.splice(i, 1);
  }
  for (let i = 0; i + 3 < t.length; i++) {
    // Najveća petlja od tačke `i` (ugniježđene nestaju sa njom).
    for (let j = Math.min(t.length - 2, i + GRAD_BOT_PETLJA_PROZOR); j >= i + 2; j--) {
      const x = segmentIntersection(t[i]!, t[i + 1]!, t[j]!, t[j + 1]!);
      if (!x) continue;
      const ogr = Math.min(...o.slice(i + 1, j + 1));
      t.splice(i + 1, j - i, x.point);
      o.splice(i + 1, j - i, ogr);
      nv.splice(i + 1, j - i, nv[i]!);
      break;
    }
  }
  const prag = Math.cos((GRAD_BOT_OSTAR_LOM * Math.PI) / 180);
  for (let prolaz = 0; prolaz < 3; prolaz++) {
    for (let i = t.length - 2; i >= 1; i--) {
      const a = t[i - 1]!;
      const b = t[i]!;
      const c = t[i + 1]!;
      const l1 = Math.hypot(b.x - a.x, b.y - a.y);
      const l2 = Math.hypot(c.x - b.x, c.y - b.y);
      if (l1 < 1e-6 || l2 < 1e-6) continue;
      const cos = ((b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)) / (l1 * l2);
      if (cos > prag) continue;
      const k1 = Math.min(1, l1 / 2) / l1;
      const k2 = Math.min(1, l2 / 2) / l2;
      const P = { x: b.x + (a.x - b.x) * k1, y: b.y + (a.y - b.y) * k1 };
      const Q = { x: b.x + (c.x - b.x) * k2, y: b.y + (c.y - b.y) * k2 };
      t.splice(i, 1, P, Q);
      o.splice(i, 1, o[i]!, o[i]!);
      nv.splice(i, 1, nv[i]!, nv[i]!);
    }
  }
}

/** Chaikin: svaki lom se zamijeni sa dvije tačke na četvrtinama; krajevi ostaju. */
function zaobli(t: Point[], prolaza = 3): Point[] {
  let x = t;
  for (let k = 0; k < prolaza; k++) {
    const n: Point[] = [x[0]!];
    for (let i = 0; i + 1 < x.length; i++) {
      const a = x[i]!;
      const b = x[i + 1]!;
      n.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y }, { x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    n.push(x[x.length - 1]!);
    x = n;
  }
  return x;
}

/** Pomak od osovine sveden na ono što stane u ulicu: auto cijeli na asfaltu, uz pedalj rezerve. */
function uUlici(iv: Ivica, w: number): number {
  const najvise = Math.max(0, iv.sirina / 2 - CAR_WIDTH / 2 - 0.3);
  return Math.max(-najvise, Math.min(najvise, w));
}

/** Traka iz koje se ide na manevar: po strelicama ako ih ima; inače lijeva za lijevo, desna za ostalo. */
/**
 * Za svaku svoju traku ivice u smjeru vožnje: da li njene strelice dozvoljavaju
 * manevar (kao kod sudije). `null` kad strelica nema ili ne odgovaraju trakama.
 */
function streliceZa(iv: Ivica, smjer: 1 | -1, manevar: "lijevo" | "pravo" | "desno"): boolean[] | null {
  const opis = smjer === 1 ? iv.skretanjaNaprijed : iv.skretanjaNazad;
  const svoje = smjer === 1 ? iv.trakeNaprijed : iv.trakeNazad;
  const n = iv.trakeNaprijed + iv.trakeNazad;
  const po = opis ? opis.split("|") : [];
  if (po.length !== svoje || svoje === 0 || iv.sirina < n * iv.sirinaTrake - 1e-6) return null;
  return po.map((x) =>
    x.split(";").some((y) => {
      const t = y.trim();
      if (manevar === "pravo") return t === "" || t === "none" || t === "through" || t.startsWith("merge_to");
      return manevar === "lijevo" ? t.endsWith("left") : t.endsWith("right");
    }),
  );
}

/**
 * Sredina trake svog smjera najbliže pomaku `w` — kad je to i traka za
 * manevar, nje; inače najbliže (bot će do trake za manevar na sljedećoj
 * ivici, ili luk kroz raskrsnicu pređe razliku).
 */
function najblizaTraka(iv: Ivica, smjer: 1 | -1, w: number, zeljena: number): number {
  const n = iv.trakeNaprijed + iv.trakeNazad;
  const svoje = smjer === 1 ? iv.trakeNaprijed : iv.trakeNazad;
  if (n === 0 || svoje === 0 || iv.sirina < n * iv.sirinaTrake - 1e-6) return zeljena;
  const traka = iv.sirina / n;
  let naj = zeljena;
  for (let j = 0; j < svoje; j++) {
    const c = iv.sirina / 2 - (j + 0.5) * traka;
    if (uBusTraci(iv, smjer, c)) continue;
    if (Math.abs(c - w) < Math.abs(naj - w) - 1e-6) naj = c;
  }
  return naj;
}

/** Da li je bočni pomak `w` (u smjeru vožnje, + desno) u autobuskoj traci ivice. */
function uBusTraci(iv: Ivica, smjer: 1 | -1, w: number): boolean {
  const bus = pojasBusa(iv, smjer);
  // Pojas je u okviru ivice (`a → b`), pomak u okviru vožnje.
  return bus !== null && Math.abs(w - ((bus[0] + bus[1]) / 2) * smjer) * 2 < bus[1] - bus[0];
}

/**
 * Traka kojom se vozi ka manevru: kao `trakaZaManevar`, ali autobuskom
 * nikad — kad je ona jedina za manevar, vozi se trakom do nje, a u nju se
 * prelazi tek pred raskrsnicom (vidi `planBota`).
 */
function trakaPuta(iv: Ivica, smjer: 1 | -1, manevar: "lijevo" | "pravo" | "desno"): number {
  const w = trakaZaManevar(iv, smjer, manevar);
  return uBusTraci(iv, smjer, w) ? w - iv.sirina / (iv.trakeNaprijed + iv.trakeNazad) : w;
}

function trakaZaManevar(iv: Ivica, smjer: 1 | -1, manevar: "lijevo" | "pravo" | "desno"): number {
  const svoje = smjer === 1 ? iv.trakeNaprijed : iv.trakeNazad;
  const n = iv.trakeNaprijed + iv.trakeNazad;
  const dozvoljeno = streliceZa(iv, smjer, manevar);
  if (dozvoljeno) {
    const traka = iv.sirina / n;
    // Autobuska traka (krajnja desna) samo kad je jedina za taj manevar.
    if (pojasBusa(iv, smjer) && dozvoljeno.slice(0, -1).includes(true)) dozvoljeno[dozvoljeno.length - 1] = false;
    // Za lijevo krajnja lijeva dozvoljena traka, inače krajnja desna.
    const j = manevar === "lijevo" ? dozvoljeno.indexOf(true) : dozvoljeno.lastIndexOf(true);
    if (j >= 0) return iv.sirina / 2 - svoje * traka + (j + 0.5) * traka;
  }
  return pomakTrake(iv, smjer, manevar === "lijevo");
}

/**
 * Plan vožnje po ruti: putanja po sredini trake, lukovi kroz raskrsnice,
 * brzine, stop-linije i najave žmigavca. `odsjeci` su iz `krajeviLinija`.
 */
/**
 * `rezervaLuka`: koliko auto u luku kroz raskrsnicu mora biti dalje od
 * ivičnjaka [m]. Bot (model volana) odstupa od putanje, pa mu treba
 * `GRAD_BOT_REZERVA_LUKA`; drugi vozači idu tačno putanjom (`GRAD_NPC_REZERVA_LUKA`)
 * — luk im češće uspije, i rjeđe idu osovinom kroz čvor.
 */
export function planBota(
  g: GradZaSudiju,
  koraci: Korak[],
  dnevnik?: (poruka: string) => void,
  rezervaLuka = GRAD_BOT_REZERVA_LUKA,
): PlanBota {
  const { povrsina, raskrsnice: r, odsjeci } = g;
  const m = povrsina.mreza;
  let osloncaOsovinom = 0;
  // ── 1. prolazi kroz raskrsnice: ulazni korak, izlazni korak, manevar, žmigavac ──
  // Raskrsnica bulevara je više čvorova: sudija je gleda kao jednu — od
  // ulaznog do izlaznog kraka — pa i bot tako računa manevar i žmigavac.
  const raskrsnicaNaKraju = (i: number) => r.uCvoru[kraj(m.ivice[koraci[i]!.ivica]!, koraci[i]!.smjer)]!;
  // Za prolaz je unutra i ivica između dva čvora iste raskrsnice koju odsječci
  // (sa sudijinom potvrdom izlaska na oba kraja) pokrivaju cijelu — slip-traka
  // za desno: sudija auto na njoj nikad ne vidi van raskrsnice, pa je to jedan
  // prolaz, i manevar se računa od ulaza do izlaza. Putanja ipak ide njome
  // (`unutraPuta` su samo prave unutrašnje ivice, kroz koje vodi luk).
  const unutraPuta = (rs: number, i: number) => r.lista[rs]!.unutrasnje.includes(koraci[i]!.ivica);
  const unutra = (rs: number, i: number) => {
    const iv = m.ivice[koraci[i]!.ivica]!;
    if (unutraPuta(rs, i)) return true;
    return (
      r.uCvoru[iv.a] === rs &&
      r.uCvoru[iv.b] === rs &&
      iv.duzina < odsjeci[2 * iv.i]! + odsjeci[2 * iv.i + 1]! + 2 * (CAR_LENGTH / 2 + GRAD_IZLAZ_POTVRDA)
    );
  };
  interface ProlazBota {
    ulaz: number;
    izlaz: number;
    manevar: "lijevo" | "pravo" | "desno";
    strana: "left" | "right" | null;
    /** Manevar u prvom čvoru, gdje važe strelice ulazne trake (kao kod sudije). */
    manevarStrelica: "lijevo" | "pravo" | "desno";
  }
  const manevarIz = (u: number) => (u > GRAD_SKRETANJE_UGAO ? "desno" : u < -GRAD_SKRETANJE_UGAO ? "lijevo" : "pravo");
  const prolazi: ProlazBota[] = [];
  const manevarNaKraju = new Map<number, "lijevo" | "pravo" | "desno">();
  // Kružni tok: manevar od kraka kojim se ulazi u raskrsnicu ulaska u prsten
  // do izlaza iz prstena (puni krug se vozi kao lijevo) — kao kod sudije. Po
  // njemu se bira traka na prilazu (strelice prilaza kružnom toku opisuju
  // izlaz) i u prstenu: unutrašnja za lijevo, spoljna za ostalo.
  const krozKruzni = new Map<number, { od: number; izlaz: number; manevar: "lijevo" | "pravo" | "desno" }>();
  const kruzna = (x: number) => m.ivice[koraci[x]!.ivica]!.kruzni;
  /** Za ulazni korak raskrsnice: izlazni korak; koraci između su unutar nje. */
  const izlazIz = new Map<number, number>();
  const unutrasnjiKorak = new Set<number>();
  for (let i = 0; i + 1 < koraci.length; i++) {
    const rs = raskrsnicaNaKraju(i);
    if (rs < 0 || unutra(rs, i)) continue;
    let j = i + 1;
    while (j < koraci.length - 1 && unutra(rs, j)) j++;
    const u = ugao(
      pravacKraja(m.ivice[koraci[i]!.ivica]!, koraci[i]!.smjer, true),
      pravacKraja(m.ivice[koraci[j]!.ivica]!, koraci[j]!.smjer, false),
    );
    const manevar = manevarIz(u);
    const kruzni = r.lista[rs]!.kruzni;

    // Kružni tok: žmigavac se ovdje traži samo za izlazak iz prstena (desni).
    const izPrstena = kruzni && m.ivice[koraci[i]!.ivica]!.kruzni && !m.ivice[koraci[j]!.ivica]!.kruzni;
    // Ulazak u prsten: bez žmigavca (sudija ga ne gleda). Mimo prstena (ni
    // ulaz ni izlaz nisu na njemu): kao kroz običnu raskrsnicu.
    const uPrsten = kruzni && !m.ivice[koraci[i]!.ivica]!.kruzni && m.ivice[koraci[j]!.ivica]!.kruzni;
    const strana = izPrstena ? "right" : uPrsten ? null : manevar === "lijevo" ? "left" : manevar === "desno" ? "right" : null;
    // Strelice važe za prvi čvor kad se iz njega ide slip-trakom (ivica do
    // drugog čvora iste raskrsnice, a nije njena unutrašnja) — kao kod sudije.
    const slip = j > i + 1 && !unutraPuta(rs, i + 1);
    const manevarStrelica = slip
      ? manevarIz(
          ugao(
            pravacKraja(m.ivice[koraci[i]!.ivica]!, koraci[i]!.smjer, true),
            pravacKraja(m.ivice[koraci[i + 1]!.ivica]!, koraci[i + 1]!.smjer, false),
          ),
        )
      : manevar;
    prolazi.push({ ulaz: i, izlaz: j, manevar, strana, manevarStrelica });
    const cc = r.lista[rs]!.centar;
    dnevnik?.(
      `prolaz ${i}->${j} r ${rs} ulaz ${koraci[i]!.ivica} izlaz ${koraci[j]!.ivica} @${cc.x.toFixed(0)},${cc.y.toFixed(0)} ugao ${u.toFixed(0)} ${manevar} ${strana ?? "-"}`,
    );
    manevarNaKraju.set(i, prolazi[prolazi.length - 1]!.manevarStrelica);
  }
  // Ulazak u prsten (prolaz sa nekružne na kružnu ivicu) i izlazak iz njega
  // (prvi sljedeći prolaz sa kružne na nekružnu) — tako ih vidi sudija, i kad
  // OSM samo dio prstena označi kao kružni tok.
  for (let a = 0; a < prolazi.length; a++) {
    const p = prolazi[a]!;
    if (kruzna(p.ulaz) || !kruzna(p.izlaz)) continue;
    const q = prolazi.slice(a + 1).find((x) => kruzna(x.ulaz) && !kruzna(x.izlaz));
    if (!q) continue;
    const uk = ugao(
      pravacKraja(m.ivice[koraci[p.ulaz]!.ivica]!, koraci[p.ulaz]!.smjer, true),
      pravacKraja(m.ivice[koraci[q.izlaz]!.ivica]!, koraci[q.izlaz]!.smjer, false),
    );
    const mk = Math.abs(uk) > GRAD_POLUKRUZNO_UGAO || uk < -GRAD_SKRETANJE_UGAO ? "lijevo" : uk > GRAD_SKRETANJE_UGAO ? "desno" : "pravo";
    krozKruzni.set(p.ulaz, { od: p.izlaz, izlaz: q.izlaz, manevar: mk });
    p.manevarStrelica = mk;
    manevarNaKraju.set(p.ulaz, mk);
  }
  // Luk kroz raskrsnicu: od ulaznog kraka preko pravih unutrašnjih ivica.
  for (let i = 0; i + 1 < koraci.length; i++) {
    const rs = raskrsnicaNaKraju(i);
    if (rs < 0 || unutraPuta(rs, i)) continue;
    let j = i + 1;
    while (j < koraci.length - 1 && unutraPuta(rs, j)) j++;
    izlazIz.set(i, j);
    for (let x = i + 1; x < j; x++) unutrasnjiKorak.add(x);
  }

  // Traka za manevar se bira i na ivicama ispred kraka (niz ulicu kroz
  // čvorove koji nisu raskrsnice, do `GRAD_BOT_TRAKA_UNAPRIJED`): strelice su
  // u OSM-u često na ivici prije kratkog kraka, i tamo se i crtaju.
  // I sam bočni položaj: traka koju traži ZADNJI komad pred raskrsnicom (po
  // njegovim strelicama sudi sudija) važi i na komadima prije njega — strelice
  // susjednih komada u OSM-u se ne slažu uvijek, a pred raskrsnicom linija
  // može biti puna (editor). Na prethodnim komadima je to najbliža traka.
  const trakaUnaprijed = new Map<number, number>();
  for (const p of prolazi) {
    const ulazna = koraci[p.ulaz]!;
    const zadnja = trakaPuta(m.ivice[ulazna.ivica]!, ulazna.smjer, p.manevarStrelica);
    let dalje = 0;
    for (let k = p.ulaz - 1; k >= 0; k--) {
      if (raskrsnicaNaKraju(k) >= 0) break;
      dalje += m.ivice[koraci[k + 1]!.ivica]!.duzina;
      if (dalje > GRAD_BOT_TRAKA_UNAPRIJED) break;
      if (!manevarNaKraju.has(k)) manevarNaKraju.set(k, p.manevarStrelica);
      // U prstenu kružnog toka traku određuje izlaz iz njega (dolje), ne ovo.
      if (!trakaUnaprijed.has(k) && !kruzna(k) && !kruzna(p.ulaz)) trakaUnaprijed.set(k, zadnja);
    }
  }

  // Traka u prstenu: unutrašnja za lijevo i puni krug, spoljna za desno i
  // pravo (kao sudija, `laneDisciplineRoundabout`).
  for (const k of krozKruzni.values()) {
    for (let x = k.od; x < k.izlaz; x++) manevarNaKraju.set(x, k.manevar === "lijevo" ? "lijevo" : "desno");
  }

  // ── 2. putanja: sredina trake po ivicama, luk kroz raskrsnice ──
  const tacke: Point[] = [];
  const ogranicenja: number[] = [];
  /** Nivo ulice u svakoj tački (most, tunel) — vidi `Ivica.nivo`. */
  const nivoi: number[] = [];
  let nivo = 0;
  const linije: StopLinija[] = [];
  const najave: Najava[] = [];
  /** `s` na putanji na kraju i na početku dijela svakog koraka van raskrsnica. */
  const krajKoraka: number[] = [];
  const pocetakKoraka: number[] = [];
  // Dužina putanje do svake tačke, usput: `cumulative` cijele putanje poslije
  // svake ivice bilo bi kvadratno.
  const duzine: number[] = [];
  const dodaj = (q: Point, o: number) => {
    const z = tacke[tacke.length - 1];
    duzine.push(z ? duzine[duzine.length - 1]! + Math.hypot(q.x - z.x, q.y - z.y) : 0);
    tacke.push(q);
    ogranicenja.push(o);
    nivoi.push(nivo);
  };
  const skini = () => {
    tacke.pop();
    ogranicenja.pop();
    nivoi.pop();
    duzine.pop();
  };
  const duzinaDo = () => duzine[duzine.length - 1] ?? 0;
  // Putanja prati traku do `GRAD_BOT_ODSJEK_NAJVISE` od čvora: odsječak
  // raskrsnice zna biti desetine metara (kolovozne trake bulevara se
  // preklapaju), a ulica se u njemu savija — prava tetiva bi prešla na
  // suprotnu kolovoznu traku.
  const odsjekPuta = (j: number) => Math.min(odsjeci[j]!, GRAD_BOT_ODSJEK_NAJVISE);
  // Oštri uglovi ulice u čvorovima koji nisu raskrsnice (lanac iste ulice):
  // tangenta i poluprečnik zaobljenja osovine, kao `zaobliOsovinu` unutar
  // ivice — inače bi se trake dva smjera u uglu preklopile.
  const ugaoCvora = new Map<number, { T: number; r: number }>();
  for (let i = 0; i + 1 < koraci.length; i++) {
    if (raskrsnicaNaKraju(i) >= 0) continue;
    const a = koraci[i]!;
    const b = koraci[i + 1]!;
    const ia = m.ivice[a.ivica]!;
    const ib = m.ivice[b.ivica]!;
    const d1 = pravacKraja(ia, a.smjer, true);
    const d2 = pravacKraja(ib, b.smjer, false);
    const teta = Math.abs(Math.atan2(d1.x * d2.y - d1.y * d2.x, d1.x * d2.x + d1.y * d2.y));
    if (teta < (GRAD_BOT_UGAO_CVORA * Math.PI) / 180) continue;
    const tg = Math.tan(teta / 2);
    const T = Math.min((Math.max(ia.sirina, ib.sirina) / 2 + 1) * tg, ia.duzina / 2, ib.duzina / 2);
    ugaoCvora.set(i, { T, r: T / tg });
  }
  let prosliPomak: number | null = null;
  /**
   * Razdjelnica se pomjerila u čvoru između koraka `a` i `b` (vidi
   * `razdjelnica`), a na `b` ima mjesta za odgođen prelazak: od
   * `GRAD_BOT_RAZDJELNICA_ODMAK` do pune linije ili kraja ivice bar
   * `GRAD_BOT_RAZDJELNICA_NAJKRACA`. Tada se kroz čvor ostaje u traci.
   */
  const odgadjaRazdjelnica = (a: Korak, b: Korak): boolean => {
    const ra = razdjelnica(m.ivice[a.ivica]!, a.smjer);
    const f = m.ivice[b.ivica]!;
    const rb = razdjelnica(f, b.smjer);
    if (ra === null || rb === null || Math.abs(ra - rb) <= 0.5) return false;
    const s0 = odsjekPuta(2 * b.ivica + (b.smjer === 1 ? 0 : 1));
    const s1 = f.duzina - odsjekPuta(2 * b.ivica + (b.smjer === 1 ? 1 : 0));
    const doPune = punaTrakeOd(f, b.smjer, g.produzeci) - 2;
    return Math.min(s1, doPune) - Math.max(s0, GRAD_BOT_RAZDJELNICA_ODMAK) >= GRAD_BOT_RAZDJELNICA_NAJKRACA;
  };
  /**
   * Najmanji bočni pomak [m, + desno] na koraku `i`, `d` metara od njegovog
   * početka: uz čvor (nije raskrsnica) u kojem se razdjelnica pomjerila, auto
   * je desno od obje razdjelnice (vidi `GRAD_BOT_RAZDJELNICA_RAZMAK`).
   */
  const granicaRazdjelnice = (i: number, d: number): number => {
    const k = koraci[i]!;
    const iv = m.ivice[k.ivica]!;
    const n = iv.trakeNaprijed + iv.trakeNazad;
    const svoje = k.smjer === 1 ? iv.trakeNaprijed : iv.trakeNazad;
    if (n === 0 || svoje === 0) return -Infinity;
    // Sredina lijeve svoje trake: do nje granica popušta.
    const lijeva = iv.sirina / 2 - (svoje - 0.5) * (iv.sirina / n);
    // Puna linija između traka (editor): granica je otpuštena prije nje — auto
    // je do tada u traci koju je planer izabrao.
    const puna = punaTrakeOd(iv, k.smjer, g.produzeci);
    let w = -Infinity;
    const uzCvor = (a: Korak, b: Korak, udaljenost: number, odPocetka: boolean) => {
      const ra = razdjelnica(m.ivice[a.ivica]!, a.smjer);
      const rb = razdjelnica(m.ivice[b.ivica]!, b.smjer);
      if (ra === null || rb === null || Math.abs(ra - rb) <= 0.5) return;
      const puno = Math.max(ra, rb) + CAR_WIDTH / 2 + GRAD_BOT_RAZDJELNICA_RAZMAK;
      if (puno <= lijeva) return;
      // Do kraja popuštanja: nagibom, ali najkasnije 2 m prije pune linije
      // (iza čvora); pred čvorom, puna linija do njega isključuje granicu.
      let kraj = GRAD_BOT_RAZDJELNICA_BLIZU + (puno - lijeva) * GRAD_BOT_RAZDJELNICA_NAGIB;
      if (odPocetka) kraj = Math.min(kraj, puna - 2);
      else if (Number.isFinite(puna) && puna < iv.duzina - GRAD_BOT_RAZDJELNICA_BLIZU) return;
      if (udaljenost >= kraj) return;
      const u = Math.max(0, (udaljenost - GRAD_BOT_RAZDJELNICA_BLIZU) / Math.max(1e-6, kraj - GRAD_BOT_RAZDJELNICA_BLIZU));
      w = Math.max(w, puno + (lijeva - puno) * Math.min(1, u));
    };
    if (i > 0 && raskrsnicaNaKraju(i - 1) < 0 && !unutrasnjiKorak.has(i - 1)) uzCvor(koraci[i - 1]!, k, d, true);
    if (i + 1 < koraci.length && raskrsnicaNaKraju(i) < 0 && !unutrasnjiKorak.has(i + 1)) uzCvor(k, koraci[i + 1]!, iv.duzina - d, false);
    return w;
  };
  let preskoci: { B: Point; h: Point } | null = null;
  koraci.forEach((k, i) => {
    // Unutrašnja ivica raskrsnice od više čvorova: kroz nju vodi jedan luk sa
    // ulaznog na izlazni krak — kao što je i sudija vidi kao jednu.
    if (unutrasnjiKorak.has(i)) {
      pocetakKoraka[i] = krajKoraka[i] = duzinaDo();
      return;
    }
    const iv = m.ivice[k.ivica]!;
    nivo = iv.nivo;
    // Ograničenje kao kod sudije (znak do prve raskrsnice, zona, OSM,
    // naselje) — po tački: znak može stajati usred ivice.
    const ogrNa = (sEdge: number) => ogranicenjeNa(g.ogranicenja, m, r, k.ivica, k.smjer, sEdge).brzina / 3.6;
    const ogr = ogrNa(k.smjer === 1 ? iv.duzina : 0);
    const odPoc = odsjekPuta(2 * k.ivica + (k.smjer === 1 ? 0 : 1));
    const odKraja = odsjekPuta(2 * k.ivica + (k.smjer === 1 ? 1 : 0));
    // Oštar ugao ulice u čvoru koji nije raskrsnica: ivica se skraćuje za
    // tangentu zaobljenja (vidi `ugaoCvora`).
    const s0 = i === 0 ? Math.min(iv.duzina / 2, odPoc + 2) : odPoc + (ugaoCvora.get(i - 1)?.T ?? 0);
    // Cilj na zadnjoj ivici: prije raskrsnice na njenom kraju, i prije
    // stop-linije, ako je ima — bot tu staje i vožnja je gotova.
    const krakCilja = i === koraci.length - 1 ? r.krakIvice.get(`${k.ivica}:${k.smjer === 1 ? 1 : 0}`) : undefined;
    const stopCilja = krakCilja ? (r.lista[krakCilja[0]]!.kraci[krakCilja[1]]!.stopD ?? 0) + CAR_LENGTH / 2 + 2 : 0;
    const s1 = i === koraci.length - 1 ? Math.max(s0, iv.duzina - Math.max(odKraja + 2, stopCilja)) : iv.duzina - odKraja - (ugaoCvora.get(i)?.T ?? 0);
    const manevarKoraka = manevarNaKraju.get(i) ?? "pravo";
    let zeljena = trakaPuta(iv, k.smjer, manevarKoraka);
    const unaprijed = trakaUnaprijed.get(i);
    // Nastavak iste ulice kroz čvor koji nije raskrsnica, pravo i bez strelica
    // ovdje: ostaje se u svojoj traci (strelice na prethodnom komadu su je
    // možda odredile) — prelazak u desnu bi ovdje mogao preći punu liniju.
    if (unaprijed !== undefined) zeljena = najblizaTraka(iv, k.smjer, unaprijed, zeljena);
    else if (
      i > 0 &&
      prosliPomak !== null &&
      manevarKoraka === "pravo" &&
      raskrsnicaNaKraju(i - 1) < 0 &&
      !streliceZa(iv, k.smjer, "pravo")
    ) {
      zeljena = najblizaTraka(iv, k.smjer, prosliPomak, zeljena);
    }
    // Autobuska traka je jedina za manevar (strelice): u nju tek u zadnjih
    // `GRAD_BOT_U_BUS` metara pred raskrsnicom — duže bi bilo vožnja njom.
    const busCilj = trakaZaManevar(iv, k.smjer, manevarKoraka);
    const pocetak = prosliPomak ?? zeljena;
    // Na kratkom komadu ulice traka se ne mijenja — to bi bio trzaj volanom;
    // luk kroz sljedeću raskrsnicu prelazi i bočni razmak.
    // Traka se mijenja na prvih 60 % dijela ivice — i prije pune linije
    // između traka pred raskrsnicom (editor), ako je ima.
    const punaOd = punaTrakeOd(iv, k.smjer, g.produzeci) - 2;
    // Iz autobuske trake (prethodna ivica je nije imala) odmah u traku pored —
    // i kad je komad kratak.
    const izBusa = uBusTraci(iv, k.smjer, pocetak);
    // Ulica se proširila (ili suzila) u čvoru koji nije raskrsnica: trake su
    // pomaknute, i auto bi stajao na liniji — odmah u najbližu traku.
    const naLiniji = naLinijiTraka(iv, k.smjer, pocetak);
    const odmah = izBusa || naLiniji;
    // Razdjelnica se pomjerila u čvoru iza kojeg počinje ova ivica: promjena
    // trake tek `GRAD_BOT_RAZDJELNICA_ODMAK` iza čvora.
    const prethodna = i > 0 && raskrsnicaNaKraju(i - 1) < 0 ? koraci[i - 1]! : null;
    // Tada se i na kratkom komadu prelazi (traka iza je obavezna — kroz čvor
    // se nije smjelo), za najviše `GRAD_BOT_IZ_BUSA` metara.
    const odgodi = prethodna !== null && !odmah && odgadjaRazdjelnica(prethodna, k);
    const promjenaOd = odgodi ? Math.max(s0, GRAD_BOT_RAZDJELNICA_ODMAK) : s0;
    let promjenaDo = Math.min(s0 + (s1 - s0) * 0.6, punaOd, odmah ? s0 + GRAD_BOT_IZ_BUSA : Infinity);
    if (odgodi) promjenaDo = Math.max(promjenaDo, Math.min(s1, punaOd, promjenaOd + GRAD_BOT_IZ_BUSA));
    const kratko = promjenaDo - promjenaOd < GRAD_BOT_NAJKRACA_PROMJENA && !odmah && !odgodi;
    const cilj = kratko ? uUlici(iv, pocetak) : naLiniji && !izBusa ? najblizaTraka(iv, k.smjer, pocetak, zeljena) : zeljena;
    const uBus = uBusTraci(iv, k.smjer, busCilj) && raskrsnicaNaKraju(i) >= 0 ? Math.max(s0, s1 - GRAD_BOT_U_BUS) : null;
    pocetakKoraka[i] = duzinaDo();
    if (s1 - s0 >= 1) {
      for (let d = s0; ; d = Math.min(s1, d + 2)) {
        const sEdge = k.smjer === 1 ? d : iv.duzina - d;
        // Traka od zaobljene osovine: lom ulice (OSM krivina) bi na
        // unutrašnjoj strani dao petlju preko osovine.
        const { tacka: c, pravac } = naOsovini(iv, sEdge);
        const h = k.smjer === -1 ? { x: -pravac.x, y: -pravac.y } : pravac;
        const u = Math.max(0, Math.min(1, (d - promjenaOd) / Math.max(1, promjenaDo - promjenaOd)));
        let w0 = pocetak + (cilj - pocetak) * u;
        if (uBus !== null && d > uBus) w0 += (busCilj - w0) * Math.min(1, (d - uBus) / Math.max(1, s1 - uBus));
        w0 = Math.max(w0, granicaRazdjelnice(i, d));
        // Pomak iz šire ulice ne smije izvesti auto sa asfalta uže.
        const w = uUlici(iv, w0);
        const q = { x: c.x - h.y * w, y: c.y + h.x * w };
        // Tačke prije kraja luka iz prošle raskrsnice se preskaču.
        if (!preskoci || (q.x - preskoci.B.x) * preskoci.h.x + (q.y - preskoci.B.y) * preskoci.h.y > 0.3) {
          preskoci = null;
          dodaj(q, ogrNa(sEdge));
        }
        if (d >= s1) break;
      }
      prosliPomak = uBus !== null ? busCilj : cilj;
    }
    krajKoraka[i] = duzinaDo();
    // Preskakanje važi samo za prvu ivicu iza luka — nikad dalje.
    preskoci = null;

    // Stop-linija na kraju ivice, kad je krak kontrolisan: STOP ili semafor.
    // Linija je `stopD` od kraja ivice, a putanja ovdje staje `odKraja` od
    // njega — linija je toliko prije kraja ovog dijela putanje.
    const kr = r.krakIvice.get(`${k.ivica}:${k.smjer === 1 ? 1 : 0}`);
    const krak = kr ? r.lista[kr[0]]!.kraci[kr[1]]! : null;
    if (kr && krak && krak.stopD !== null && i < koraci.length - 1 && (krak.kontrola === "stop" || krak.kontrola === "semafor")) {
      const sl0 = stopLinija(povrsina, krak);
      linije.push({
        s: krajKoraka[i]! - (krak.stopD - odKraja) - CAR_LENGTH / 2 - STOP_MARGIN,
        tacka: sl0.linija,
        pravac: sl0.pravac,
        r: kr[0],
        k: kr[1],
        krak,
        manevar: prolazi.find((p) => p.ulaz === i)?.manevar ?? "pravo",
        korak: i,
      });
    }

    // Luk kroz raskrsnicu (ili spoj u čvoru bez raskrsnice) do sljedeće ivice.
    const slIndeks = izlazIz.get(i) ?? i + 1;
    const sl = koraci[slIndeks];
    if (sl && tacke.length >= 2) {
      const f = m.ivice[sl.ivica]!;
      const odPocF = odsjekPuta(2 * sl.ivica + (sl.smjer === 1 ? 0 : 1));
      const ugao = slIndeks === i + 1 ? ugaoCvora.get(i) : undefined;
      const odPocUgla = odPocF + (ugao?.T ?? 0);
      const sF = Math.max(0, Math.min(f.duzina, sl.smjer === 1 ? odPocUgla : f.duzina - odPocUgla));
      const manevarF = manevarNaKraju.get(slIndeks) ?? "pravo";
      let trakaF = trakaPuta(f, sl.smjer, manevarF);
      const unaprijedF = trakaUnaprijed.get(slIndeks);
      // Traka koju traži raskrsnica ispred (njen zadnji komad): luk kroz ovu
      // raskrsnicu, ili spoj u čvoru koji nije raskrsnica, odmah u nju — pred
      // raskrsnicom linije mogu biti pune cijelim komadom. Inače, spoj u
      // nastavku iste ulice, pravo i bez strelica dalje: ista traka.
      // Razdjelnica se u ovom čvoru (nije raskrsnica) pomjerila: kroz čvor se
      // ostaje u najbližoj traci, a prelazak ide na ivici iza
      // `GRAD_BOT_RAZDJELNICA_ODMAK` (vidi gore).
      if (raskrsnicaNaKraju(i) < 0 && slIndeks === i + 1 && prosliPomak !== null && odgadjaRazdjelnica(k, sl)) {
        trakaF = najblizaTraka(f, sl.smjer, prosliPomak, trakaF);
      } else if (unaprijedF !== undefined) trakaF = najblizaTraka(f, sl.smjer, unaprijedF, trakaF);
      else if (raskrsnicaNaKraju(i) < 0 && prosliPomak !== null && manevarF === "pravo" && !streliceZa(f, sl.smjer, "pravo")) {
        trakaF = najblizaTraka(f, sl.smjer, prosliPomak, trakaF);
      }
      const w2 = uUlici(f, slIndeks === i + 1 ? Math.max(trakaF, granicaRazdjelnice(slIndeks, odPocUgla)) : trakaF);
      const { tacka: c2, pravac: h2o } = naOsovini(f, sF);
      const h2 = sl.smjer === -1 ? { x: -h2o.x, y: -h2o.y } : h2o;
      const p3 = { x: c2.x - h2.y * w2, y: c2.y + h2.x * w2 };
      const p0 = tacke[tacke.length - 1]!;
      // Pravac ulaska iz geometrije ulice, ne iz zadnje dvije tačke putanje:
      // na kratkoj ivici one su promjena trake i daju gotovo poprečan pravac.
      const h1 = pravacKraja(iv, k.smjer, true);
      const d = Math.hypot(p3.x - p0.x, p3.y - p0.y);
      const ogrLuk = Math.min(ogr, ogranicenjeNa(g.ogranicenja, m, r, sl.ivica, sl.smjer, sF).brzina / 3.6);
      const krst = h1.x * h2.y - h1.y * h2.x;
      const teta = Math.abs(Math.atan2(krst, h1.x * h2.x + h1.y * h2.y));
      // Presjek pravca ulazne i izlazne trake: p0 + h1·a = p3 − h2·b.
      const det = -krst;
      const a0 = Math.abs(det) > 1e-3 ? ((p3.x - p0.x) * -h2.y - (p3.y - p0.y) * -h2.x) / det : NaN;
      // Luk se gradi na strani, provjeri (auto cijeli na asfaltu duž njega), i
      // tek onda upiše. Luk koji siječe trotoar (klin između ulica koje se
      // spajaju, zasječen ugao) zamjenjuje se vožnjom osovinom kroz čvor.
      let skinuti = 0;
      let luk: Point[] = [];
      let krajLuka: { B: Point; h: Point } | null = null;
      let uOsovinu = false;
      // Luk prethodne raskrsnice je već prešao početak sljedeće ivice (kratka
      // ivica između bliskih čvorova): spoja nema — putanja se nastavlja od
      // prve tačke sljedeće ivice ispred auta.
      const iza =
        (p3.x - p0.x) * h1.x + (p3.y - p0.y) * h1.y <= 0.5 && (p3.x - p0.x) * h2.x + (p3.y - p0.y) * h2.y <= 0.5;
      if (ugao) {
        // Oštar ugao ulice: luk zaobljene osovine, a traka koncentrično uz
        // njega (pomak se prelije sa ove ivice na sljedeću) — obje trake
        // ostaju razmaknute, i susretna vozila se mimoilaze.
        const cv = m.cvorovi[kraj(iv, k.smjer)]!;
        const d1 = h1;
        const krstU = d1.x * h2.y - d1.y * h2.x;
        const znak = krstU > 0 ? 1 : -1;
        const tetaU = Math.abs(Math.atan2(krstU, d1.x * h2.x + d1.y * h2.y));
        const P1 = { x: cv.x - d1.x * ugao.T, y: cv.y - d1.y * ugao.T };
        const O = { x: P1.x - d1.y * ugao.r * znak, y: P1.y + d1.x * ugao.r * znak };
        const pocUgao = Math.atan2(P1.y - O.y, P1.x - O.x);
        const wA = prosliPomak ?? w2;
        const n = Math.max(4, Math.ceil(tetaU * ugao.r));
        for (let j = 1; j < n; j++) {
          const fi = j / n;
          const ug = pocUgao + znak * tetaU * fi;
          const tx = -Math.sin(ug) * znak;
          const ty = Math.cos(ug) * znak;
          const w = wA + (w2 - wA) * fi;
          luk.push({ x: O.x + ugao.r * Math.cos(ug) - ty * w, y: O.y + ugao.r * Math.sin(ug) + tx * w });
        }
      } else if (iza) krajLuka = { B: p0, h: h2 };
      else if (teta > 0.2 && Number.isFinite(a0) && a0 > -5) {
        // Skretanje: kružni luk tangentan na obje trake. Probaju se poluprečnici
        // redom (`GRAD_BOT_POLUPRECNICI`) i uzima prvi koji je, sa rezervom, na
        // asfaltu: širi luk ranije napušta ulaznu traku i koristi širinu
        // raskrsnice. Bezier između ivica raskrsnice bi u uskoj ulici bio
        // oštriji nego što auto može (najmanje 3,9 m).
        const C = { x: p0.x + h1.x * a0, y: p0.y + h1.y * a0 };
        const znak = Math.sign(krst);
        for (const R of GRAD_BOT_POLUPRECNICI) {
          const Lt = R * Math.tan(teta / 2);
          const A = { x: C.x - h1.x * Lt, y: C.y - h1.y * Lt };
          const B = { x: C.x + h2.x * Lt, y: C.y + h2.y * Lt };
          // Ulazna traka se napušta tamo gdje luk počinje.
          let sk = 0;
          while (sk < tacke.length - 2) {
            const q = tacke[tacke.length - 1 - sk]!;
            if ((q.x - A.x) * h1.x + (q.y - A.y) * h1.y < -0.01) break;
            sk += 1;
          }
          const O = { x: A.x - h1.y * znak * R, y: A.y + h1.x * znak * R };
          const pocUgao = Math.atan2(A.y - O.y, A.x - O.x);
          const n = Math.max(4, Math.ceil((teta * R) / 1));
          const kandidat: Point[] = [A];
          for (let j = 1; j <= n; j++) {
            const u = pocUgao + (znak * teta * j) / n;
            kandidat.push({ x: O.x + R * Math.cos(u), y: O.y + R * Math.sin(u) });
          }
          const prije = tacke[tacke.length - 1 - sk]!;
          // Provjera do početka izlazne trake: kad se pravci traka sijeku
          // rano (ulazni krak se u raskrsnici savija), od kraja luka do `p3`
          // ostaje duga prava.
          const doP3 = (p3.x - B.x) * h2.x + (p3.y - B.y) * h2.y;
          const dalje = doP3 > 0 ? p3 : B;
          if (naAsfaltuCijelom(povrsina, [prije, ...kandidat, dalje, { x: dalje.x + h2.x * 3, y: dalje.y + h2.y * 3 }], rezervaLuka)) {
            skinuti = sk;
            luk = kandidat;
            krajLuka = { B, h: h2 };
            break;
          }
        }
        // Nijedan poluprečnik ne ostaje na asfaltu: vožnja osovinom, ispod.
        if (luk.length === 0) uOsovinu = true;
        // Luk završava daleko iza početka izlazne trake (pravci traka se
        // sijeku tek iza raskrsnice), a tu je puna linija (editor): auto bi u
        // svoju traku ušao preko nje. Glatka kriva do početka trake, ako je
        // cijela na asfaltu — u traku se ulazi u raskrsnici, kao vozač.
        if (krajLuka && !uOsovinu) {
          const izaP3 = (krajLuka.B.x - p3.x) * h2.x + (krajLuka.B.y - p3.y) * h2.y;
          const sB = sl.smjer === 1 ? sF + izaP3 : sF - izaP3;
          if (izaP3 > 1 && punaIzmedju(f, g.produzeci, sF, sB)) {
            const kriva = bezier(p0, h1, p3, h2, d);
            if (naAsfaltuCijelom(povrsina, [tacke[tacke.length - 1]!, ...kriva, p3, { x: p3.x + h2.x * 3, y: p3.y + h2.y * 3 }], rezervaLuka)) {
              luk = kriva;
              skinuti = 0;
              krajLuka = null;
            }
          }
        }
      } else if (d > 0.5) {
        luk = bezier(p0, h1, p3, h2, d);
      }
      const osnova = tacke.slice(0, tacke.length - skinuti);
      dnevnik?.(
        `spoj ${i}->${slIndeks} iv ${k.ivica}->${sl.ivica} p0 ${p0.x.toFixed(1)},${p0.y.toFixed(1)} p3 ${p3.x.toFixed(1)},${p3.y.toFixed(1)} teta ${((teta * 180) / Math.PI).toFixed(0)} a0 ${a0.toFixed(1)} luk ${luk.length} skinuti ${skinuti} uOsovinu ${uOsovinu}`,
      );
      if (!ugao && (uOsovinu || (luk.length > 0 && !naAsfaltuCijelom(povrsina, [osnova[osnova.length - 1]!, ...luk, krajLuka?.B ?? p3], rezervaLuka)))) {
        // Osovinom: od kraja ulazne trake preko čvorova raskrsnice (i njenih
        // unutrašnjih ivica) do početka izlazne trake.
        skinuti = 0;
        krajLuka = null;
        // Odsječeni kraj ulaznog kraka i početak izlaznog idu po svojoj
        // liniji (sa pomakom trake): u velikoj raskrsnici krak je u odsječku
        // često savijen, i prava do čvora bi sjekla trotoar.
        const kroz: Point[] = [...tackeOdsjecka(iv, k.smjer, iv.duzina - odKraja, iv.duzina, uUlici(iv, prosliPomak ?? 0))];
        for (let x = i; x < slIndeks; x++) {
          const ivx = m.ivice[koraci[x + 1]!.ivica]!;
          const c = m.cvorovi[kraj(m.ivice[koraci[x]!.ivica]!, koraci[x]!.smjer)]!;
          kroz.push(c);
          if (x + 1 < slIndeks) {
            const t = koraci[x + 1]!.smjer === 1 ? ivx.tacke : [...ivx.tacke].reverse();
            kroz.push(...t.slice(1, -1));
          }
        }
        kroz.push(...tackeOdsjecka(f, sl.smjer, 0, sl.smjer === 1 ? sF : f.duzina - sF, w2));
        kroz.push(p3);
        // Osovina se u čvoru lomi pod uglom koji auto ne može pratiti: lom se
        // zaobljava na gruboj liniji (Chaikin, četiri prolaza) — tako je luk
        // širok koliko i krakovi — pa se tek onda progušćuje.
        // Samo tačke ispred `p0` po ulaznom pravcu i prije `p3` po izlaznom:
        // kad su raskrsnice tik jedna uz drugu, luk prethodne se završi iza
        // čvora ove, i put kroz čvor bi se vraćao unazad. (Napredak ka `p3`
        // nije mjera: kod skretanja oštrijeg od 90° čvor ugla je „iza" i put
        // bi presjekao ugao preko trotoara.)
        const unaprijed: Point[] = [p0];
        for (const q of kroz) {
          const ispredUlaza = (q.x - p0.x) * h1.x + (q.y - p0.y) * h1.y > 0.5;
          const prijeIzlaza = (p3.x - q.x) * h2.x + (p3.y - q.y) * h2.y > 0.5;
          if ((ispredUlaza && prijeIzlaza) || q === p3) unaprijed.push(q);
        }
        const glatko = zaobli(unaprijed, 4);
        luk = [];
        let prosla = p0;
        for (const q of glatko.slice(1)) {
          const dq = Math.hypot(q.x - prosla.x, q.y - prosla.y);
          const n = Math.max(1, Math.ceil(dq / 1.5));
          for (let j = 1; j <= n; j++) luk.push({ x: prosla.x + ((q.x - prosla.x) * j) / n, y: prosla.y + ((q.y - prosla.y) * j) / n });
          prosla = q;
        }
        luk.pop(); // p3 dolazi sa izlazne ivice
        osloncaOsovinom += 1;
      }
      for (let x = 0; x < skinuti; x++) {
        skini();
      }
      for (const q of luk) {
        dodaj(q, ogrLuk);
      }
      if (krajLuka) preskoci = krajLuka;
      prosliPomak = w2;
    }
  });

  ocistiPutanju(tacke, ogranicenja, nivoi);

  // ── 3. najave žmigavca: od `GRAD_BOT_ZMIGAVAC_PRIJE` pred ulazom do
  // potvrđenog izlaska na izlazni krak (kao što ga sudija potvrđuje) ──
  // Najava ne počinje prije nego što je auto ušao u prethodnu raskrsnicu:
  // žmigavac upaljen na ulasku u nju bi tamo značio skretanje koga nema.
  // Čvorovi prstena kroz koje auto samo prolazi ne blokiraju: sudija tamo
  // žmigavac ne gleda, a izlazak iz prstena ga traži već na njima.
  // Gdje sudija vidi ulazak u raskrsnicu i potvrđuje izlazak: bot provuče
  // sudiju duž svoje putanje. Kod raskrsnica tik jedna uz drugu to nije kraj
  // ivice — zone im se preklapaju, i drugu sudija vidi tek kad auto izađe iz
  // prve. Žmigavac se pali i gasi po tim mjestima, sa `GRAD_BOT_ZMIGAVAC_REZERVA`.
  const gusto: [number, number][] = [];
  for (let i = 0; i < koraci.length; i++) {
    if (raskrsnicaNaKraju(i) < 0) continue;
    gusto.push([krajKoraka[i]! - GRAD_BOT_SUDIJA_GUSTO, (pocetakKoraka[i + 1] ?? krajKoraka[i]!) + GRAD_BOT_SUDIJA_GUSTO]);
  }
  const viSudija = prolaziSudije(g, tacke, gusto);
  let jSudije = 0;
  const sudijin = new Map<ProlazBota, { od: number; do_: number }>();
  const upareni = new Set<number>();
  // Neslaganje plana i sudije: sudija vidi raskrsnicu koje u planu nema (luk
  // oštrog skretanja zađe u susjednu), ili za prolaz traži drugi žmigavac.
  const neslaganja: string[] = [];
  const stranaZa = (mv: string) => (mv === "desno" ? "right" : mv === "pravo" ? null : "left");
  for (const p of prolazi) {
    const rs = raskrsnicaNaKraju(p.ulaz);
    for (let j = jSudije; j < viSudija.length; j++) {
      const v = viSudija[j]!;
      if (v.od > krajKoraka[p.ulaz]! + 40) break;
      if (v.r === rs && Math.abs(v.od - krajKoraka[p.ulaz]!) < 40) {
        sudijin.set(p, v);
        upareni.add(j);
        jSudije = j + 1;
        if (!r.lista[rs]!.kruzni && stranaZa(v.manevar) !== p.strana) {
          neslaganja.push(`r${rs}: plan ${p.manevar}, sudija ${v.manevar}`);
        }
        break;
      }
    }
  }
  viSudija.forEach((v, j) => {
    if (!upareni.has(j)) neslaganja.push(`r${v.r}: sudija vidi prolaz (${v.manevar}) koga u planu nema`);
  });
  const rez = GRAD_BOT_ZMIGAVAC_REZERVA;
  /** Ulazak u raskrsnicu prolaza, kako ga sudija vidi. */
  const ulazU = (p: ProlazBota) => sudijin.get(p)?.od ?? krajKoraka[p.ulaz]! - CAR_LENGTH / 2;
  /** Potvrđen izlazak iz nje. */
  const izlazIzR = (p: ProlazBota) => sudijin.get(p)?.do_ ?? pocetakKoraka[p.izlaz]! + CAR_LENGTH / 2 + GRAD_IZLAZ_POTVRDA;
  let izasaoIzProsle = -Infinity;
  const krozPrsten = (p: ProlazBota) => r.lista[raskrsnicaNaKraju(p.ulaz)]!.kruzni && m.ivice[koraci[p.izlaz]!.ivica]!.kruzni;
  /** Najava prethodnog prolaza (ne kroz prsten), ako ga je imao. */
  let prethodna: Najava | null = null;
  let izlazPrethodne = 0;
  for (const p of prolazi) {
    const kroz = krozPrsten(p);
    const ulaz = ulazU(p);
    const od = Math.max(ulaz - GRAD_BOT_ZMIGAVAC_PRIJE, izasaoIzProsle);
    // Kroz raskrsnicu sudija gleda samo žmigavac pri ulasku: za sljedeću se
    // smije upaliti (ili prebaciti) čim se u nju uđe.
    if (!kroz) izasaoIzProsle = ulaz + rez;
    if (!p.strana) {
      // Ide se pravo, ili u kružni tok: prethodna najava se gasi prije ulaska
      // (inače `indicatorWrong`). Kroz čvorove prstena se ne gasi ništa —
      // tamo gori samo najava izlaska.
      const uPrsten = kroz && !m.ivice[koraci[p.ulaz]!.ivica]!.kruzni;
      if ((!kroz || uPrsten) && prethodna) prethodna.do_ = Math.min(prethodna.do_, ulaz - rez);
      if (!kroz || uPrsten) prethodna = null;
      continue;
    }
    const do_ = izlazIzR(p) + 4;
    dnevnik?.(`najava ${p.ulaz} ${p.strana} od ${od.toFixed(0)} ulaz ${ulaz.toFixed(0)}`);
    // Ista strana kao prethodno skretanje: žmigavac se gasi tek kad sudija
    // potvrdi izlazak (`izlazPrethodne`) — poslije toga broji metre sa
    // upaljenim (`indicatorLeftOn`) — i pali opet prije ulaska. Kad za tu
    // pauzu nema mjesta, gori bez prekida: put do ulaza je kraći od dozvoljenog.
    let pocni = od;
    if (prethodna && prethodna.strana === p.strana) {
      if (izlazPrethodne + 2 > ulaz - rez) {
        prethodna.do_ = do_;
        izlazPrethodne = izlazIzR(p) + rez;
        continue;
      }
      prethodna.do_ = Math.min(prethodna.do_, izlazPrethodne);
      pocni = Math.max(od, izlazPrethodne + 2);
    } else if (prethodna && prethodna.do_ + 1 > od) {
      // Na drugu stranu: prethodni se gasi tik prije nego što se ovaj upali
      // (sudija je prethodni već vidio na ulasku).
      prethodna.do_ = od - 1;
    }
    const n: Najava = { od: pocni, do_, strana: p.strana };
    najave.push(n);
    prethodna = n;
    izlazPrethodne = izlazIzR(p) + rez;
  }

  // Progušćenje: tačka bar na svaka 2 m. Prava od kraja luka do trake može
  // biti duga desetine metara, a brzina se ograničava po tačkama — bez njih bi
  // bot na pravoj ubrzavao ka dalekoj tački. Dužine duž putanje se ne mijenjaju.
  for (let i = tacke.length - 1; i > 0; i--) {
    const a = tacke[i - 1]!;
    const b = tacke[i]!;
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2);
    if (n <= 1) continue;
    const umetni: Point[] = [];
    for (let j = 1; j < n; j++) umetni.push({ x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n });
    tacke.splice(i, 0, ...umetni);
    ogranicenja.splice(i, 0, ...umetni.map(() => Math.min(ogranicenja[i - 1]!, ogranicenja[i]!)));
    nivoi.splice(i, 0, ...umetni.map(() => nivoi[i - 1]!));
  }
  const put = putanja(tacke);
  // Stop-linija na gotovoj putanji: projekcija njene tačke — oduzimanje od
  // kraja ivice promaši kad luk prethodne raskrsnice skrati putanju.
  // Gdje sredina auta staje: tamo gdje bi nos (pola auta naprijed, u pravcu
  // putanje) bio `STOP_MARGIN` pred ravni linije — isto kao što sudija mjeri.
  const naLiniji = (tacka: Point, pravac: Point, odS: number): number | null => {
    const nosPred = (i: number) => {
      const q = tacke[i]!;
      const h = headingAt(tacke, put.cum, put.cum[i]!);
      const nx = q.x + h.x * (CAR_LENGTH / 2);
      const ny = q.y + h.y * (CAR_LENGTH / 2);
      return -((nx - tacka.x) * pravac.x + (ny - tacka.y) * pravac.y) - STOP_MARGIN;
    };
    for (let i = 1; i < tacke.length; i++) {
      if (put.cum[i]! < odS) continue;
      const a = nosPred(i - 1);
      const b = nosPred(i);
      if (a > 0 && b <= 0) return put.cum[i - 1]! + ((put.cum[i]! - put.cum[i - 1]!) * a) / (a - b);
    }
    return null;
  };
  for (const l of linije) l.s = naLiniji(l.tacka, l.pravac, l.s - 40) ?? l.s;
  // Brzina: ograničenje sa rezervom, i krivina (v² / R ≤ bočno ubrzanje).
  // Krivina se mjeri na susjedima udaljenim bar metar — dvije skoro iste
  // tačke dale bi poluprečnik od par centimetara i auto bi stao — i nije
  // oštrija od najmanjeg kruga koji auto može (puni volan).
  const najmanjiR = GRAD_MEDJUOSOVINSKO / Math.tan((GRAD_VOLAN_UGAO * Math.PI) / 180);
  const brzine = ogranicenja.map((o) => o * (1 - GRAD_BOT_REZERVA_BRZINE));
  for (let i = 1; i + 1 < tacke.length; i++) {
    const b = tacke[i]!;
    let ia = i - 1;
    while (ia > 0 && Math.hypot(tacke[ia]!.x - b.x, tacke[ia]!.y - b.y) < 1) ia--;
    let ic = i + 1;
    while (ic < tacke.length - 1 && Math.hypot(tacke[ic]!.x - b.x, tacke[ic]!.y - b.y) < 1) ic++;
    const a = tacke[ia]!;
    const c = tacke[ic]!;
    const ab = Math.hypot(b.x - a.x, b.y - a.y);
    const bc = Math.hypot(c.x - b.x, c.y - b.y);
    const ca = Math.hypot(a.x - c.x, a.y - c.y);
    const povrsina2 = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
    if (povrsina2 < 1e-6) continue;
    const R = Math.max(najmanjiR, (ab * bc * ca) / (2 * povrsina2));
    brzine[i] = Math.min(brzine[i]!, Math.sqrt(GRAD_BOT_BOCNO * R));
  }
  // U raskrsnici sudija sudi po ograničenju ulice kojom se došlo — do
  // potvrđenog izlaza, i kad se na izlaznoj ulici smije brže.
  for (const p of prolazi) {
    const ul = koraci[p.ulaz]!;
    const iv = m.ivice[ul.ivica]!;
    const ogrUlaza = (ogranicenjeNa(g.ogranicenja, m, r, ul.ivica, ul.smjer, ul.smjer === 1 ? iv.duzina : 0).brzina / 3.6) * (1 - GRAD_BOT_REZERVA_BRZINE);
    const od = ulazU(p);
    const do_ = izlazIzR(p);
    for (let i = 0; i < put.cum.length; i++) {
      if (put.cum[i]! < od) continue;
      if (put.cum[i]! > do_) break;
      brzine[i] = Math.min(brzine[i]!, ogrUlaza);
    }
  }
  // Izlaz iz prstena iz unutrašnje trake: mjeri se na sredini dijela ivice
  // prstena van raskrsnica, kao kod sudije — bliže izlazu putanja već prelazi.
  const izUnutrasnjeTrake = (ulaz: number, izlaz: number): boolean => {
    const ul = koraci[ulaz]!;
    const iv = m.ivice[ul.ivica]!;
    if (m.ivice[koraci[izlaz]!.ivica]!.kruzni || !dvotracniPrsten(iv, ul.smjer)) return false;
    const sredina = ((pocetakKoraka[ulaz] ?? 0) + (krajKoraka[ulaz] ?? 0)) / 2;
    return bokNaIvici(iv, ul.smjer, pointAt(put.tacke, put.cum, sredina)) < -GRAD_PRSTEN_RUB;
  };
  const prolaziPlana: ProlazPlana[] = prolazi.map((p) => {
    const ul = koraci[p.ulaz]!;
    const iz = koraci[p.izlaz]!;
    const rs = raskrsnicaNaKraju(p.ulaz);
    const k = r.krakIvice.get(`${ul.ivica}:${ul.smjer === 1 ? 1 : 0}`)?.[1] ?? -1;
    const linija = linije.findIndex((l) => l.korak === p.ulaz);
    // Mjesto čekanja: na stop-liniji, inače pred `cekaD` kraka (ispred zebre).
    let cekanje = linija >= 0 ? linije[linija]!.s : ulazU(p) - 0.3;
    if (linija < 0 && k >= 0) {
      const krak = r.lista[rs]!.kraci[k]!;
      const l0 = stopLinija(povrsina, { ...krak, stopD: krak.cekaD });
      cekanje = Math.min(cekanje, naLiniji(l0.linija, l0.pravac, ulazU(p) - 60) ?? cekanje);
    }
    return {
      r: rs,
      ulaz: k,
      cekanje,
      izlaz: r.krakIvice.get(`${iz.ivica}:${iz.smjer === 1 ? 0 : 1}`)?.[1] ?? -1,
      ulazKorak: p.ulaz,
      izlazKorak: p.izlaz,
      od: ulazU(p),
      do_: izlazIzR(p),
      uPrstenu: m.ivice[ul.ivica]!.kruzni,
      izUnutrasnje: izUnutrasnjeTrake(p.ulaz, p.izlaz),
      linija,
    };
  });
  return { put, brzine, linije, najave, prolazi: prolaziPlana, osovinom: osloncaOsovinom, neslaganja, nivoi };
}

/**
 * Razdjelna linija dvosmjerne ulice u smjeru vožnje [m od osovine, + desno]:
 * granica između svojih traka (desno) i suprotnih. `null` na jednosmjernoj, i
 * kad trake ne staju punom širinom (uska ulica bez linije).
 */
function razdjelnica(iv: Ivica, smjer: 1 | -1): number | null {
  const n = iv.trakeNaprijed + iv.trakeNazad;
  const svoje = smjer === 1 ? iv.trakeNaprijed : iv.trakeNazad;
  if (iv.smjer !== 0 || n === 0 || svoje === 0 || svoje === n || iv.sirina < n * iv.sirinaTrake - 1e-6) return null;
  return iv.sirina / 2 - svoje * (iv.sirina / n);
}

/** Brzina koju bot smije sada: najmanja od onih ispred, uz usporenje do njih. */
function dozvoljenaBrzina(plan: PlanBota, s: number): number {
  let v = Infinity;
  const { cum } = plan.put;
  for (let i = 0; i < cum.length; i++) {
    const d = cum[i]! - s;
    if (d < -2) continue;
    if (d > 80) break;
    v = Math.min(v, Math.sqrt(plan.brzine[i]! ** 2 + 2 * GRAD_VOZAC_USPORENJE * Math.max(0, d)));
  }
  return Number.isFinite(v) ? v : 5;
}

export interface Bot {
  plan: PlanBota;
  /** Položaj na putanji (sredina auta). */
  s: number;
  /** Za svaku stop-liniju: koliko je bot na njoj stajao, i odluka na žuto. */
  stajao: number[];
  prosao: boolean[];
  zutoStaje: (boolean | null)[];
  /** Vidio zeleno na prilazu liniji (do `GRAD_PRILAZ_DO`, kao sudija) — o žutom odlučuje samo tada. */
  vidioZeleno: boolean[];
  gotov: boolean;
  /** Izvlačenje sa ivičnjaka: do kad unazad (pređeni put auta), i volan pri udaru. */
  izvlacenje: { doPredjeno: number; volan: number; od: number; traje: number } | null;
  /** Koliko puta se izvlačio — za izvještaj. */
  izvlacenja: number;
  /** Gdje je zadnji put zakačio, i koliko puta zaredom tu. */
  zadnjiUdar: { x: number; y: number; puta: number } | null;
  /** Zadnji cilj zaustavljanja (za dijagnozu): `s` i razlog. */
  staje: { s: number; zasto: string } | null;
}

export function noviBot(plan: PlanBota): Bot {
  return {
    plan,
    s: 0,
    stajao: plan.linije.map(() => 0),
    prosao: plan.linije.map(() => false),
    zutoStaje: plan.linije.map(() => null),
    vidioZeleno: plan.linije.map(() => false),
    gotov: false,
    izvlacenje: null,
    izvlacenja: 0,
    zadnjiUdar: null,
    staje: null,
  };
}

/** Ulaz za jedan korak bota. `t` je vrijeme simulacije. */
/**
 * Jedan korak bota: ulaz (gas, kočnica, volan, žmigavac). `granica` je
 * najveća brzina koju dozvoljava saobraćaj oko njega [m/s] — vozilo ispred,
 * ustupanje, zatvoren izlaz (vidi `botUSaobracaju.ts`); bez nje vozi sam.
 */
export function korakBota(b: Bot, r: Raskrsnice, st: SlobodnoVozilo, t: number, granica = Infinity): Input {
  const p = b.plan;
  // Izvlačenje: zakačio ivičnjak i stao — polako unazad metar-dva sa volanom
  // na drugu stranu, pa ponovo naprijed. Sporije od praga pogrešnog smjera,
  // i kraće od dozvoljenog stajanja. Kad zakači opet na istom mjestu, ide
  // dalje unazad (do četiri puta dalje): ponovni ulazak istom putanjom bi
  // samo ponovio udar.
  if (!b.izvlacenje && st.udar && Math.abs(st.v) < 0.1) {
    const z = b.zadnjiUdar;
    const puta = z && Math.hypot(z.x - st.x, z.y - st.y) < 4 ? z.puta + 1 : 1;
    b.zadnjiUdar = { x: st.x, y: st.y, puta };
    const unazad = GRAD_BOT_IZVLACENJE * Math.min(puta, 4);
    b.izvlacenje = { doPredjeno: st.predjeno + unazad, volan: st.tocak > 0 ? -1 : 1, od: t, traje: 2 + (2 * unazad) / GRAD_BOT_IZVLACENJE_BRZINA };
    b.izvlacenja += 1;
  }
  if (b.izvlacenje) {
    const iz = b.izvlacenje;
    // Gotovo: odvezao koliko je trebalo, isteklo vrijeme, ili je zakačio i
    // unazad (dalje se ne može — naprijed).
    if (st.predjeno >= iz.doPredjeno || t - iz.od > iz.traje || (st.rikverc && st.udar)) {
      b.izvlacenje = null;
    } else if (!st.rikverc) {
      // Kočnica u mjestu ubacuje rikverc.
      return { throttle: 0, brake: 1, indicator: null, steer: iz.volan };
    } else {
      // Odlučno unazad do brzine izvlačenja (sporo bi se vodilo kao stajanje
      // u raskrsnici), pa je samo drži.
      const v = -st.v;
      const pedala = v > GRAD_BOT_IZVLACENJE_BRZINA ? 0 : v < GRAD_BOT_IZVLACENJE_BRZINA * 0.7 ? 0.8 : 0.35;
      return { throttle: 0, brake: pedala, indicator: null, steer: iz.volan };
    }
  }
  b.s = naPutanji(p.put, st.x, st.y, b.s);
  if (b.s >= p.put.duzina - 3) {
    b.gotov = true;
    return { throttle: 0, brake: 0.1, indicator: null, steer: 0 };
  }
  let staniNa: number | null = null;
  // Zeleno viđeno na prilazu svakoj liniji ispred (i onoj iza bliže).
  for (let i = 0; i < p.linije.length; i++) {
    const l = p.linije[i]!;
    if (l.s - b.s > GRAD_PRILAZ_DO) break;
    if (!b.prosao[i] && l.krak.kontrola === "semafor") {
      const sv = zelenaStrelica(r.lista[l.r]!, l.k, t, l.manevar) ? "zeleno" : svjetlo(r.lista[l.r]!, l.k, t, l.manevar);
      if (sv === "zeleno") b.vidioZeleno[i] = true;
    }
  }
  for (let i = 0; i < p.linije.length; i++) {
    if (b.prosao[i]) continue;
    const l = p.linije[i]!;
    if (b.s > l.s + 1) {
      b.prosao[i] = true;
      continue;
    }
    if (l.s - b.s > 80) break;
    if (l.krak.kontrola === "stop") {
      if (l.s - b.s < 0.5 && Math.abs(st.v) < 0.1) b.stajao[i]! += DT;
      if (b.stajao[i]! < STOP_HOLD + 0.5) staniNa = l.s;
      b.staje = staniNa === null ? null : { s: l.s, zasto: "STOP" };
      break;
    }
    // Semafor: crveno stoji; žuto po pragu sudije — ko bi stigao do linije za
    // manje od `YELLOW_COMMIT_TTC`, prolazi; ostali staju.
    // Svjetlo za pravac kojim bot ide (svjetlo sa strelicom); zelena dopunska
    // strelica za taj pravac je zeleno.
    const sv = zelenaStrelica(r.lista[l.r]!, l.k, t, l.manevar) ? "zeleno" : svjetlo(r.lista[l.r]!, l.k, t, l.manevar);
    const doLinije = l.s - b.s;
    if (sv === "zeleno") b.zutoStaje[i] = null;
    // Žuto zatečeno na prilazu: staje (bio je daleko kad se upalilo).
    if (sv === "zuto" && b.zutoStaje[i] === null) {
      // Vrijeme do linije kao kod sudije: od nosa do same linije.
      b.zutoStaje[i] = !b.vidioZeleno[i] || (doLinije + STOP_MARGIN) / Math.max(st.v, 0.1) >= YELLOW_COMMIT_TTC * 0.8;
    }
    // Odlučio da prođe na žuto, a ipak je stao pred linijom (ustupao): sada
    // može stati — na to žuto više ne ide.
    if (sv === "zuto" && b.zutoStaje[i] === false && Math.abs(st.v) < 0.1 && doLinije >= 0) b.zutoStaje[i] = true;
    if (sv === "crveno" || (sv === "zuto" && b.zutoStaje[i])) staniNa = l.s;
    b.staje = staniNa === null ? null : { s: l.s, zasto: `semafor ${sv} r${l.r}` };
    break;
  }
  const ulaz = vozi(st, p.put, b.s, { brzina: Math.min(dozvoljenaBrzina(p, b.s), granica), staniNa });
  const najava = p.najave.find((n) => b.s >= n.od && b.s <= n.do_);
  return { ...ulaz, indicator: najava ? najava.strana : null };
}

export interface IshodVoznje {
  stigao: boolean;
  /** Vrijeme vožnje [s] i pređeni put [m]. */
  trajanje: number;
  predjeno: number;
  prekrsaji: GradskiPrekrsaj[];
  /** Koraci u kojima je auto zakačio ivičnjak — bot ne bi smio. */
  udara: number;
  /** Koliko puta se bot izvlačio sa ivičnjaka unazad. */
  izvlacenja: number;
  /** Gdje je prvi put zakačio ivičnjak (`s` na putanji i tačka), za dijagnozu. */
  prviUdar: { s: number; x: number; y: number; ugao: number } | null;
}

/**
 * Bot vozi rutu pod sudijom, od početka do cilja ili do isteka vremena.
 * Deterministički: ista ruta i isto `t0` daju isti ishod.
 */
export function odveziRutu(
  g: GradZaSudiju,
  povrsina: Povrsina,
  plan: PlanBota,
  t0: number,
  nivo: Level,
  najvise = 900,
  dnevnik?: (trag: string[]) => void,
  dnevnikSudije?: Sudija["dnevnik"],
): IshodVoznje {
  const a = plan.put.tacke[0]!;
  const b = plan.put.tacke[1]!;
  const st: SlobodnoVozilo = {
    x: a.x,
    y: a.y,
    ugao: Math.atan2(b.y - a.y, b.x - a.x),
    v: 0,
    tocak: 0,
    rikverc: false,
    kocnicaStoji: 0,
    udar: false,
    predjeno: 0,
  };
  const bot = noviBot(plan);
  const sudija = noviSudija(nivo);
  sudija.dnevnik = dnevnikSudije;
  let t = t0;
  let udara = 0;
  let prviUdar: IshodVoznje["prviUdar"] = null;
  const trag: string[] = [];
  while (!bot.gotov && t - t0 < najvise) {
    const ulaz = korakBota(bot, g.raskrsnice, st, t);
    korakSlobodno(povrsina, st, ulaz);
    if (dnevnik) {
      const q = pointAt(plan.put.tacke, plan.put.cum, bot.s);
      trag.push(`staje=${bot.staje ? `${bot.staje.s.toFixed(1)}(${bot.staje.zasto})` : "-"} s=${bot.s.toFixed(1)} v=${st.v.toFixed(1)} greska=${Math.hypot(q.x - st.x, q.y - st.y).toFixed(2)} tocak=${((st.tocak * 180) / Math.PI).toFixed(0)} steer=${(ulaz.steer ?? 0).toFixed(2)} gas=${ulaz.throttle.toFixed(2)} koc=${ulaz.brake.toFixed(2)}`);
      if (trag.length > 40) trag.shift();
    }
    if (st.udar) {
      udara += 1;
      if (!prviUdar && dnevnik) dnevnik(trag);
      prviUdar ??= { s: bot.s, x: st.x, y: st.y, ugao: st.ugao };
    }
    t += DT;
    const prije = sudija.prekrsaji.length;
    sudi(g, sudija, st, t, ulaz.indicator);
    if (dnevnik && sudija.prekrsaji.length > prije) {
      const pr = sudija.prilaz;
      const krak = pr ? g.raskrsnice.lista[pr.r]!.kraci[pr.k]! : null;
      dnevnik([
        `PREKRSAJ ivicaAuta ${sudija.ivicaAuta} auto ${st.x.toFixed(1)},${st.y.toFixed(1)} ugao ${((st.ugao * 180) / Math.PI).toFixed(0)} doTackeLinije ${plan.linije.filter((l) => Math.abs(l.s - bot.s) < 30).map((l) => Math.hypot(l.tacka.x - st.x, l.tacka.y - st.y).toFixed(2)).join(",")}`,
        `PREKRSAJ ${sudija.prekrsaji[prije]!.vrsta} prilaz ${pr ? `r${pr.r} k${pr.k} doLinije ${pr.doLinije.toFixed(2)} stopD ${krak!.stopD!.toFixed(2)} ivica ${krak!.ivica}` : "-"} linijeBota ${plan.linije.filter((l) => Math.abs(l.s - bot.s) < 30).map((l) => `r${l.r}k${l.k}@${l.s.toFixed(1)}`).join(",")}`,
        ...trag.slice(-3),
      ]);
    }
  }
  return {
    stigao: bot.gotov,
    trajanje: t - t0,
    predjeno: st.predjeno,
    prekrsaji: sudija.prekrsaji,
    udara,
    prviUdar,
    izvlacenja: bot.izvlacenja,
  };
}

/**
 * Nasumična od–do ruta za bota (zadatak, odjeljak 8): početak i cilj su vozne
 * ivice duže od 60 m, u krugu `poluprecnik` oko centra grada, ruta bar
 * `GRAD_FUZZ_NAJKRACA` metara. Isto sjeme — ista ruta.
 */
export function nasumicnaRuta(
  m: Mreza,
  r: Raskrsnice,
  zabrane: Map<string, Zabrana[]>,
  slucajno: () => number,
  poluprecnik = 2500,
): Korak[] {
  const kandidati = m.ivice.filter(
    (iv) => ZA_BOTA(iv) && iv.duzina > 60 && Math.hypot(iv.tacke[0]!.x, iv.tacke[0]!.y) < poluprecnik,
  );
  const izaberi = (): Korak => {
    const iv = kandidati[Math.floor(slucajno() * kandidati.length)]!;
    const smjer: 1 | -1 = iv.smjer !== 0 ? (iv.smjer as 1 | -1) : slucajno() < 0.5 ? 1 : -1;
    return { ivica: iv.i, smjer };
  };
  for (let pokusaj = 0; pokusaj < 50; pokusaj++) {
    const put = ruta(m, r, zabrane, izaberi(), izaberi());
    if (!put) continue;
    const duzina = put.reduce((d, k) => d + m.ivice[k.ivica]!.duzina, 0);
    if (duzina >= GRAD_FUZZ_NAJKRACA) return put;
  }
  throw new Error("nema rute ni poslije 50 pokušaja");
}
