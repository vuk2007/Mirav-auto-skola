import {
  CAR_LENGTH,
  CAR_WIDTH,
  DT,
  GRAD_BRZINA_PODRAZUMIJEVANA,
  GRAD_BRZINA_TRAJE,
  GRAD_IZLAZ_POTVRDA,
  GRAD_LIJEVO_TRAJE,
  GRAD_SIRINA_TRAKE,
  GRAD_SKRETANJE_UGAO,
  GRAD_STAJALISTE_DUZINA,
  INDICATOR_OFF_AFTER,
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
import type { Ivica, Mreza } from "./mreza";
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
  | "parkingViolation"
  | "indicatorMissing"
  | "indicatorWrong"
  | "indicatorLate"
  | "indicatorLeftOn"
  | "wrongLaneForTurn";

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

type Strana = "left" | "right";

/** Prolaz kroz raskrsnicu: odakle je auto ušao. */
interface Prolaz {
  r: number;
  ivica: number;
  cvor: number;
  pravac: Point;
  /** Žmigavac kad je auto ulazio u raskrsnicu, i prvi upaljen tek unutra. */
  zmigavacNaUlazu: Strana | null;
  upaljenUnutra: Strana | null;
  /** Strelice trake iz koje je ušao; `null` bez strelica. */
  strelice: string[] | null;
}

export interface Sudija {
  prekrsaji: GradskiPrekrsaj[];
  /** Žmigavac u prošlom koraku. */
  zmigavac: Strana | null;
  /** Poslije skretanja: strana žmigavca koji treba ugasiti, i pređeno od izlaska [m]. */
  poslijeSkretanja: { strana: Strana; predjeno: number } | null;
  nivo: Level;
  prilaz: Prilaz | null;
  prolaz: Prolaz | null;
  /** Strelice trake u kojoj je auto bio u prošlom koraku van raskrsnice. */
  traka: string[] | null;
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
    zmigavac: null,
    poslijeSkretanja: null,
    nivo,
    prilaz: null,
    prolaz: null,
    traka: null,
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

/**
 * Strelice trake u kojoj je auto, u smjeru vožnje — iz OSM `turn:lanes`, ali
 * samo kad broj traka odgovara ulici (isto kao crtanje strelica). `null` kad
 * strelica nema.
 */
function streliceTrake(iv: Ivica, gleda: 1 | -1, bok: number): string[] | null {
  const opis = gleda === 1 ? iv.skretanjaNaprijed : iv.skretanjaNazad;
  const svoje = gleda === 1 ? iv.trakeNaprijed : iv.trakeNazad;
  const n = iv.trakeNaprijed + iv.trakeNazad;
  if (!opis || n === 0 || iv.sirina < n * GRAD_SIRINA_TRAKE - 1e-6) return null;
  const po = opis.split("|");
  if (po.length !== svoje) return null;
  const traka = iv.sirina / n;
  // Svoje trake su desno u smjeru vožnje: od (pola − svoje × traka) do pola.
  const bokT = bok * gleda;
  const j = Math.max(0, Math.min(svoje - 1, Math.floor((bokT - (iv.sirina / 2 - svoje * traka)) / traka)));
  return po[j]!.split(";").map((x) => x.trim());
}

type Manevar = "lijevo" | "pravo" | "desno" | "polukruzno";

/** Da li strelice trake dozvoljavaju manevar. Traka bez strelice (`none`) je za pravo. */
function dozvoljava(strelice: string[], manevar: Manevar): boolean {
  return strelice.some((x) => {
    if (x === "" || x === "none" || x === "through" || x.startsWith("merge_to")) return manevar === "pravo";
    if (x.endsWith("left")) return manevar === "lijevo" || manevar === "polukruzno";
    if (x.endsWith("right")) return manevar === "desno";
    if (x === "reverse") return manevar === "polukruzno";
    return false;
  });
}

/**
 * Jedan korak suđenja, poslije koraka vožnje. `t` je vrijeme simulacije,
 * `zmigavac` je ono što je igrač upalio.
 */
export function sudi(g: GradZaSudiju, s: Sudija, st: SlobodnoVozilo, t: number, zmigavac: Strana | null = null): void {
  s.zmigavac = zmigavac;
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
    s.prolaz = {
      r,
      ivica: s.ivica,
      cvor,
      pravac: glava,
      zmigavacNaUlazu: zmigavac,
      upaljenUnutra: null,
      strelice: s.traka,
    };
  }
  if (s.prolaz && zmigavac && !s.prolaz.zmigavacNaUlazu && !s.prolaz.upaljenUnutra) s.prolaz.upaljenUnutra = zmigavac;
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
      // Manevar po promjeni pravca; pozitivan ugao je udesno (`y` na jug).
      const ugao =
        (Math.atan2(p.pravac.x * glava.y - p.pravac.y * glava.x, p.pravac.x * glava.x + p.pravac.y * glava.y) * 180) /
        Math.PI;
      const okrenuo = glava.x * p.pravac.x + glava.y * p.pravac.y < -0.5;
      const manevar: Manevar =
        okrenuo && osa.ivica === p.ivica
          ? "polukruzno"
          : ugao > GRAD_SKRETANJE_UGAO
            ? "desno"
            : ugao < -GRAD_SKRETANJE_UGAO
              ? "lijevo"
              : "pravo";
      sudiZmigavac(g, s, st, t, p, manevar, iv.kruzni);
      // Traka za skretanje: strelice trake iz koje je ušao moraju dozvoljavati manevar.
      if (p.strelice && !dozvoljava(p.strelice, manevar)) {
        prijavi(s, st, t, "wrongLaneForTurn", { manevar, strelice: p.strelice.join(";") });
      }
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
    s.traka = streliceTrake(iv, gleda, osa.bok);
  }

  // ── žmigavac ostavljen poslije skretanja ────────────────────────────────
  if (s.poslijeSkretanja && !s.prolaz) {
    s.poslijeSkretanja.predjeno += Math.abs(st.v) * DT;
    // Ugašen, ili se već najavljuje sljedeća raskrsnica: u redu.
    if (zmigavac !== s.poslijeSkretanja.strana || s.prilaz) s.poslijeSkretanja = null;
    else if (s.poslijeSkretanja.predjeno >= INDICATOR_OFF_AFTER) {
      prijavi(s, st, t, "indicatorLeftOn", { zmigavac }, "minor");
      s.poslijeSkretanja = null;
    }
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

/**
 * Žmigavac kroz raskrsnicu, kao u fazi 5: za skretanje mora biti upaljen na
 * pravu stranu najkasnije kad auto uđe u raskrsnicu (`indicatorMissing`,
 * `indicatorWrong`, a upaljen tek unutra `indicatorLate`); za vožnju pravo ne
 * smije biti upaljen (blag). U kružnom toku se ovdje sudi samo izlazak iz
 * prstena (desni); ulazak zavisi od izlaza na koji se ide.
 */
function sudiZmigavac(
  g: GradZaSudiju,
  s: Sudija,
  st: SlobodnoVozilo,
  t: number,
  p: Prolaz,
  manevar: Manevar,
  izasaoNaPrsten: boolean,
): void {
  const r = g.raskrsnice.lista[p.r]!;
  if (r.kruzni && izasaoNaPrsten) return;
  const trazeno: Strana | null = r.kruzni ? "right" : manevar === "desno" ? "right" : manevar === "pravo" ? null : "left";
  const kruzni = r.kruzni ? 1 : 0;
  if (trazeno === null) {
    if (p.zmigavacNaUlazu) prijavi(s, st, t, "indicatorWrong", { manevar, zmigavac: p.zmigavacNaUlazu }, "minor");
    return;
  }
  if (p.zmigavacNaUlazu === trazeno) {
    // Ispravno.
  } else if (p.zmigavacNaUlazu) prijavi(s, st, t, "indicatorWrong", { manevar, zmigavac: p.zmigavacNaUlazu, kruzni });
  else if (p.upaljenUnutra === trazeno) prijavi(s, st, t, "indicatorLate", { manevar, kruzni });
  else prijavi(s, st, t, "indicatorMissing", { manevar, kruzni });
  s.poslijeSkretanja = { strana: trazeno, predjeno: 0 };
}
