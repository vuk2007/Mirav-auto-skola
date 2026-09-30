import {
  CAR_LENGTH,
  CAR_WIDTH,
  DT,
  GRAD_BRZINA_PODRAZUMIJEVANA,
  GRAD_BRZINA_TRAJE,
  GRAD_IZLAZ_POTVRDA,
  GRAD_LIJEVO_TRAJE,
  GRAD_SIRINA_TRAKE,
  GRAD_STAJALISTE_DUZINA,
  GRAD_STAJANJE_TRAJE,
  GRAD_SUDIJA_DO_ULICE,
  GRAD_SUPROTNO_BRZINA,
  GRAD_SUPROTNO_TRAJE,
  GRAD_TOLERANCIJA_BRZINE,
  GRAD_ZEBRA_DUBINA,
  GRAD_ZEBRA_VRSTE,
  STOP_HOLD,
  STOP_ZONE,
  STOPPED_SPEED,
  YELLOW_COMMIT_TTC,
  type Level,
} from "../sim/config";
import type { Point } from "../sim/types";
import type { Mreza } from "./mreza";
import { BEZ, type Paket } from "./paket";
import { najblizaOsa, type Povrsina } from "./povrsina";
import { prekrsenaZabrana, svjetlo, type Raskrsnice, type Svjetlo, type Zabrana } from "./raskrsnica";
import type { SlobodnoVozilo } from "./slobodno";

/**
 * Sudija u gradu (faza 6, stavka 5d): prati igrača korak po korak i prijavljuje
 * prekršaje po istom modelu raskrsnice po kojem se znakovi i semafori crtaju.
 * Svaki prekršaj ima jedno pravilo i ono se igraču kaže.
 *
 * Ovdje su pravila koja važe i kad je igrač sam na ulici: crveno i žuto, STOP,
 * pogrešan smjer, zabrana skretanja, polukružno okretanje, brzina, lijeva
 * strana, zaustavljanje gdje se ne smije. Prednost prema drugima (stavka 7) i
 * pješaci (stavka 8) dolaze sa njima.
 *
 * Odluke korisnika (2026-09-30): zaustavljanje 2 s na zebri / u raskrsnici /
 * na stajalištu; U-okret zabranjen u jednosmjernoj, na mostu, u tunelu i u
 * raskrsnici sa semaforom; lijevom stranom dvosmjerne ulice najviše 3 s.
 */

export type VrstaGradskogPrekrsaja =
  | "redLight"
  | "stopSign"
  | "wrongWay"
  | "zabranaSkretanja"
  | "polukruzno"
  | "speeding"
  | "wrongSide"
  | "parkingViolation";

export interface GradskiPrekrsaj {
  vrsta: VrstaGradskogPrekrsaja;
  ozbiljnost: "fail" | "minor";
  /** Vrijeme simulacije [s]. */
  t: number;
  /** Gdje je auto bio. */
  x: number;
  y: number;
  /** Pojedinosti za karticu: ograničenje i brzina, vrsta zabrane, gdje je stao… */
  detalji: Record<string, string | number>;
}

/** Sve što sudija zna o gradu — gradi se jednom po vožnji. */
export interface GradZaSudiju {
  mreza: Mreza;
  povrsina: Povrsina;
  raskrsnice: Raskrsnice;
  zabrane: Map<string, Zabrana[]>;
  odsjeci: Float32Array;
  /** Obilježene zebre po ivici: `s` sredine zebre. */
  zebre: Map<number, number[]>;
  /** Stajališta po ivici: `s` sredine i strana (+1 desno od `a → b`). */
  stajalista: Map<number, { s: number; strana: 1 | -1 }[]>;
}

export function gradZaSudiju(
  paket: Paket,
  povrsina: Povrsina,
  raskrsnice: Raskrsnice,
  zabrane: Map<string, Zabrana[]>,
  odsjeci: Float32Array,
): GradZaSudiju {
  const n = paket.n;
  const z = paket.zaglavlje;
  const zebre = new Map<number, number[]>();
  const stajalista = new Map<number, { s: number; strana: 1 | -1 }[]>();
  const kodovi = new Set(GRAD_ZEBRA_VRSTE.map((v) => z.stringovi.indexOf(v)).filter((k) => k >= 0));
  for (let o = 0; o < n.obVrsta.length; o++) {
    const vrsta = z.vrsteObjekata[n.obVrsta[o]!];
    if (vrsta === "crossing" && kodovi.has(n.obPodatak[o]!) && n.obIvica[o] !== BEZ) {
      zebre.set(n.obIvica[o]!, [...(zebre.get(n.obIvica[o]!) ?? []), n.obS[o]!]);
    } else if (vrsta === "bus_stop") {
      // Stajalište je u OSM-u tačka pored ulice (ili na njoj): veže se za
      // najbližu ulicu, na strani na kojoj je tačka.
      const osa = najblizaOsa(povrsina, n.obXY[2 * o]!, n.obXY[2 * o + 1]!, GRAD_SUDIJA_DO_ULICE + 6);
      if (!osa) continue;
      const l = stajalista.get(osa.ivica) ?? [];
      l.push({ s: osa.s, strana: osa.bok >= 0 ? 1 : -1 });
      stajalista.set(osa.ivica, l);
    }
  }
  return { mreza: povrsina.mreza, povrsina, raskrsnice, zabrane, odsjeci, zebre, stajalista };
}

/** Prilaz raskrsnici sa kontrolisanog kraka — dok se ne pređe stop-linija. */
interface Prilaz {
  kljuc: string;
  r: number;
  k: number;
  /** Nos auta do stop-linije u prošlom koraku [m]; negativno je preko. */
  doLinije: number;
  stajao: number;
  svjetlo: Svjetlo | null;
  /** Kad je upaljeno žuto: da li je auto tada bio preblizu da stane. */
  zutoPrekasno: boolean;
}

/** Prolaz kroz raskrsnicu: odakle je auto ušao. */
interface Prolaz {
  r: number;
  ivica: number;
  cvor: number;
  pravac: Point;
}

export interface Sudija {
  prekrsaji: GradskiPrekrsaj[];
  nivo: Level;
  prilaz: Prilaz | null;
  prolaz: Prolaz | null;
  /** Ivica i smjer u prošlom koraku (van raskrsnice). */
  ivica: number | null;
  smjer: 1 | -1;
  suprotnoT: number;
  suprotnoIvica: number | null;
  brzinaT: number;
  brzinaPrijavljena: boolean;
  lijevoT: number;
  lijevoPrijavljeno: boolean;
  stojiT: number;
  stojiPrijavljeno: boolean;
}

export function noviSudija(nivo: Level): Sudija {
  return {
    prekrsaji: [],
    nivo,
    prilaz: null,
    prolaz: null,
    ivica: null,
    smjer: 1,
    suprotnoT: 0,
    suprotnoIvica: null,
    brzinaT: 0,
    brzinaPrijavljena: false,
    lijevoT: 0,
    lijevoPrijavljeno: false,
    stojiT: 0,
    stojiPrijavljeno: false,
  };
}

/**
 * Raskrsnica u kojoj je auto čija je sredina na `s` na ivici, ili `null`. Auto
 * je u raskrsnici dok je ijedan njegov dio u njoj — sredina bliže od odsjeka
 * linija plus pola auta. Bez toga bi polukružno, kojem sredina na trenutak
 * izviri na susjedni krak, izgledalo kao izlazak pravo.
 */
function raskrsnicaNa(g: GradZaSudiju, ivica: number, s: number, dodatno = 0): number | null {
  const iv = g.mreza.ivice[ivica]!;
  const ra = g.raskrsnice.uCvoru[iv.a]!;
  const rb = g.raskrsnice.uCvoru[iv.b]!;
  if (ra >= 0 && ra === rb && g.raskrsnice.lista[ra]!.unutrasnje.includes(ivica)) return ra;
  const pola = CAR_LENGTH / 2 + dodatno;
  if (ra >= 0 && s < g.odsjeci[2 * ivica]! + pola) return ra;
  if (rb >= 0 && iv.duzina - s < g.odsjeci[2 * ivica + 1]! + pola) return rb;
  return null;
}

/** Put od čvora do čvora kroz unutrašnje ivice raskrsnice: niz [ivica, čvor iza nje]. */
function putKrozRaskrsnicu(g: GradZaSudiju, r: number, od: number, do_: number): [number, number][] {
  if (od === do_) return [];
  const unutra = g.raskrsnice.lista[r]!.unutrasnje;
  const prethodni = new Map<number, [number, number]>([[od, [-1, -1]]]);
  const red = [od];
  while (red.length > 0) {
    const c = red.shift()!;
    if (c === do_) break;
    for (const i of unutra) {
      const iv = g.mreza.ivice[i]!;
      const drugi = iv.a === c ? iv.b : iv.b === c ? iv.a : -1;
      if (drugi < 0 || prethodni.has(drugi)) continue;
      prethodni.set(drugi, [i, c]);
      red.push(drugi);
    }
  }
  const put: [number, number][] = [];
  for (let c = do_; c !== od; ) {
    const p = prethodni.get(c);
    if (!p || p[0] < 0) return [];
    put.unshift([p[0], c]);
    c = p[1];
  }
  return put;
}

function prijavi(
  s: Sudija,
  st: SlobodnoVozilo,
  t: number,
  vrsta: VrstaGradskogPrekrsaja,
  detalji: Record<string, string | number> = {},
  ozbiljnost: "fail" | "minor" = "fail",
): void {
  s.prekrsaji.push({ vrsta, ozbiljnost, t, x: st.x, y: st.y, detalji });
}

/** Jedan korak suđenja, poslije koraka vožnje. `t` je vrijeme simulacije. */
export function sudi(g: GradZaSudiju, s: Sudija, st: SlobodnoVozilo, t: number): void {
  const osa = najblizaOsa(g.povrsina, st.x, st.y, GRAD_SUDIJA_DO_ULICE);
  if (!osa) return;
  const iv = g.mreza.ivice[osa.ivica]!;
  const glava = { x: Math.cos(st.ugao), y: Math.sin(st.ugao) };
  // Smjer auta duž ivice (kuda gleda), i kuda se stvarno kreće (rikverc).
  const gleda: 1 | -1 = glava.x * osa.pravac.x + glava.y * osa.pravac.y >= 0 ? 1 : -1;
  const krece: 1 | -1 = st.v >= 0 ? gleda : gleda === 1 ? -1 : 1;
  const r = raskrsnicaNa(g, osa.ivica, osa.s);
  // Izlaz iz raskrsnice važi tek kad je auto cijeli van nje i odmakao se
  // `GRAD_IZLAZ_POTVRDA` — manevar koji na trenutak zađe u susjedni krak
  // (polukružno) nije izlazak na taj krak.
  const josURaskrsnici = s.prolaz ? raskrsnicaNa(g, osa.ivica, osa.s, GRAD_IZLAZ_POTVRDA) === s.prolaz.r : false;

  // ── prilaz: stop-linija, crveno, žuto, STOP ─────────────────────────────
  const kraj: 0 | 1 = gleda === 1 ? 1 : 0;
  const krak = r === null ? g.raskrsnice.krakIvice.get(`${osa.ivica}:${kraj}`) : undefined;
  const kontrolisan = krak ? g.raskrsnice.lista[krak[0]]!.kraci[krak[1]]! : null;
  if (s.prilaz) {
    const p = s.prilaz;
    const k = g.raskrsnice.lista[p.r]!.kraci[p.k]!;
    const ki = g.mreza.ivice[k.ivica]!;
    // Prilaz traje dok je auto na kraku ili tek zašao u raskrsnicu iza linije.
    const naKraku = osa.ivica === k.ivica || r === p.r;
    if (!naKraku) s.prilaz = null;
    else {
      const doKraja = osa.ivica === k.ivica ? (k.kraj === 1 ? ki.duzina - osa.s : osa.s) : -1;
      const doLinije = doKraja - k.stopD! - CAR_LENGTH / 2;
      const sv = svjetlo(g.raskrsnice.lista[p.r]!, p.k, t);
      if (sv === "zuto" && p.svjetlo === "zeleno") {
        // Žuto je upaljeno: da li je tada bilo kasno za zaustavljanje?
        p.zutoPrekasno = p.doLinije > 0 && p.doLinije / Math.max(st.v, 0.1) < YELLOW_COMMIT_TTC;
      }
      if (doLinije >= 0 && doLinije <= STOP_ZONE && Math.abs(st.v) < STOPPED_SPEED) p.stajao += DT;
      if (p.doLinije > 0 && doLinije <= 0 && st.v > 0) {
        if (k.kontrola === "stop" && p.stajao < STOP_HOLD) {
          prijavi(s, st, t, "stopSign", { stajao: Number(p.stajao.toFixed(2)) });
        }
        if (k.kontrola === "semafor" && (sv === "crveno" || (sv === "zuto" && !p.zutoPrekasno))) {
          prijavi(s, st, t, "redLight", { svjetlo: sv });
        }
      }
      p.doLinije = doLinije;
      p.svjetlo = sv;
    }
  }
  if (!s.prilaz && kontrolisan && kontrolisan.ulaz && kontrolisan.stopD !== null && krak) {
    const doKraja = kraj === 1 ? iv.duzina - osa.s : osa.s;
    const doLinije = doKraja - kontrolisan.stopD - CAR_LENGTH / 2;
    if (doLinije > 0) {
      s.prilaz = {
        kljuc: `${osa.ivica}:${kraj}`,
        r: krak[0],
        k: krak[1],
        doLinije,
        stajao: 0,
        svjetlo: svjetlo(g.raskrsnice.lista[krak[0]]!, krak[1], t),
        zutoPrekasno: false,
      };
    }
  }

  // ── prolaz kroz raskrsnicu: zabrana skretanja, polukružno ────────────────
  if (r !== null && !s.prolaz && s.ivica !== null) {
    const staro = g.mreza.ivice[s.ivica]!;
    // Ulaz u raskrsnicu sa ivice na kojoj je auto bio, preko njenog kraja u toj raskrsnici.
    const cvor = g.raskrsnice.uCvoru[staro.b] === r && s.smjer === 1 ? staro.b : staro.a;
    s.prolaz = { r, ivica: s.ivica, cvor, pravac: glava };
  }
  if (r === null && s.prolaz && !josURaskrsnici) {
    const p = s.prolaz;
    s.prolaz = null;
    if (osa.ivica !== p.ivica || gleda !== s.smjer) {
      // Izlaz: ivica i njen kraj u raskrsnici.
      const cvorIzlaza = g.raskrsnice.uCvoru[iv.a] === p.r ? iv.a : iv.b;
      const put = putKrozRaskrsnicu(g, p.r, p.cvor, cvorIzlaza);
      const koraci: [number, number, number][] = [];
      let od = p.ivica;
      let cvor = p.cvor;
      for (const [i, c] of put) {
        koraci.push([od, cvor, i]);
        od = i;
        cvor = c;
      }
      koraci.push([od, cvor, osa.ivica]);
      for (const [a, c, b] of koraci) {
        const z = prekrsenaZabrana(g.zabrane, a, c, b);
        if (z) {
          prijavi(s, st, t, "zabranaSkretanja", { znak: z.vrsta });
          break;
        }
      }
      // Polukružno: izašao nazad na krak sa kojeg je ušao.
      const okrenuo = glava.x * p.pravac.x + glava.y * p.pravac.y < -0.5;
      if (okrenuo && osa.ivica === p.ivica && g.raskrsnice.lista[p.r]!.plan) {
        prijavi(s, st, t, "polukruzno", { gdje: "semafor" });
      }
    }
  }

  // ── van raskrsnice: smjer, strana, most/tunel ───────────────────────────
  if (r === null && !s.prolaz) {
    // Polukružno na mostu ili u tunelu: ista ivica, auto se okrenuo.
    if (s.ivica === osa.ivica && gleda !== s.smjer && st.v > 0 && (iv.most || iv.tunel)) {
      prijavi(s, st, t, "polukruzno", { gdje: iv.most ? "most" : "tunel" });
    }
    // Pogrešan smjer u jednosmjernoj: kretanje suprotno od dozvoljenog.
    const dozvoljen = iv.smjer === 0 || iv.smjer === krece;
    if (!dozvoljen && Math.abs(st.v) > GRAD_SUPROTNO_BRZINA) {
      s.suprotnoT += DT;
      if (s.suprotnoT >= GRAD_SUPROTNO_TRAJE && s.suprotnoIvica !== osa.ivica) {
        prijavi(s, st, t, "wrongWay", { ulica: iv.ime });
        s.suprotnoIvica = osa.ivica;
      }
    } else if (dozvoljen) {
      s.suprotnoT = 0;
      s.suprotnoIvica = null;
    }
    // Lijeva strana dvosmjerne ulice sa trakama u oba smjera: cijeli auto
    // lijevo od osovine duže od `GRAD_LIJEVO_TRAJE`.
    const imaStrane =
      iv.smjer === 0 &&
      iv.trakeNaprijed > 0 &&
      iv.trakeNazad > 0 &&
      iv.sirina >= (iv.trakeNaprijed + iv.trakeNazad) * GRAD_SIRINA_TRAKE - 1e-6;
    const bokUSmjeru = osa.bok * gleda;
    if (imaStrane && st.v > 0 && bokUSmjeru < -CAR_WIDTH / 2) {
      s.lijevoT += DT;
      if (s.lijevoT >= GRAD_LIJEVO_TRAJE && !s.lijevoPrijavljeno) {
        prijavi(s, st, t, "wrongSide", { sekundi: GRAD_LIJEVO_TRAJE });
        s.lijevoPrijavljeno = true;
      }
    } else {
      s.lijevoT = 0;
      s.lijevoPrijavljeno = false;
    }
    s.ivica = osa.ivica;
    s.smjer = gleda;
  }

  // ── brzina ──────────────────────────────────────────────────────────────
  const ogranicenje = iv.brzina ?? GRAD_BRZINA_PODRAZUMIJEVANA;
  const kmh = Math.abs(st.v) * 3.6;
  if (kmh > ogranicenje + GRAD_TOLERANCIJA_BRZINE[s.nivo]) {
    s.brzinaT += DT;
    if (s.brzinaT >= GRAD_BRZINA_TRAJE && !s.brzinaPrijavljena) {
      prijavi(s, st, t, "speeding", { brzina: Math.round(kmh), ogranicenje });
      s.brzinaPrijavljena = true;
    }
  } else {
    s.brzinaT = 0;
    // Prijava se obnavlja tek kad se vrati ispod ograničenja, ne tolerancije.
    if (kmh <= ogranicenje) s.brzinaPrijavljena = false;
  }

  // ── zaustavljanje: zebra, raskrsnica, stajalište ────────────────────────
  if (Math.abs(st.v) < STOPPED_SPEED) {
    s.stojiT += DT;
    if (s.stojiT >= GRAD_STAJANJE_TRAJE && !s.stojiPrijavljeno) {
      // Ispred stop-linije se čeka — to nije zaustavljanje na zabranjenom mjestu.
      const cekaNaLiniji = s.prilaz !== null && s.prilaz.doLinije >= 0;
      const naZebri = (g.zebre.get(osa.ivica) ?? []).some(
        (z) => Math.abs(z - osa.s) < GRAD_ZEBRA_DUBINA / 2 + CAR_LENGTH / 2 - 0.2,
      );
      const naStajalistu = (g.stajalista.get(osa.ivica) ?? []).some(
        (z) => Math.abs(z.s - osa.s) < GRAD_STAJALISTE_DUZINA / 2 && Math.sign(osa.bok) === z.strana,
      );
      const gdje = r !== null ? "raskrsnica" : naZebri ? "zebra" : naStajalistu ? "stajaliste" : null;
      if (gdje && !cekaNaLiniji) {
        prijavi(s, st, t, "parkingViolation", { gdje });
        s.stojiPrijavljeno = true;
      }
    }
  } else {
    s.stojiT = 0;
    s.stojiPrijavljeno = false;
  }
}
