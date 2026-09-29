/**
 * Vozač rute: drži ograničenje i pretiče.
 *
 * Postoji zbog mjerenja, ne zbog igre. `perfectBot` vozi po pravilima, ali
 * preticanje nije pravilo nego ODLUKA — niko vozača ne obavezuje da pretekne
 * kamion. Zato ta odluka ne smije u njega: bot po kojem se mjeri poštovanje
 * pravila i bot koji bira manevar ne smiju biti isti, inače se ne zna da li
 * test mjeri pravila ili stil vožnje. Isti razlog zbog kojeg preticanje na
 * autoputu vozi `highwayBot`, a ne `perfectBot`.
 *
 * Šta ovaj vozač mora da izdrži, sve redom pravila iz `world.ts`:
 *  - ne prelazi punu liniju (`crossingSolidLine`);
 *  - u suprotnu traku ulazi samo kad susretno vozilo ostaje dalje od
 *    `ONCOMING_TTC`, i tamo se zadržava kraće od `MAX_OVERTAKE_TIME`;
 *  - pokazivač pali `INDICATOR_LEAD_TIME` prije nego što sredina vozila pređe
 *    liniju — i pri izlasku i pri povratku;
 *  - vraća se tek kad ispred sebe ostavi razmak, da preteknuti ne mora da koči;
 *  - nigdje ne prekoračuje ograničenje, a ono se duž rute mijenja.
 *
 * Manevar se PLANIRA prije nego što počne: računa se koliko će trajati i traži
 * se da sve stane u budžet. Vozač koji bi krenuo pa gledao šta će biti zaglavi
 * se u suprotnoj traci — a odatle nema poteza koji ne krši neko pravilo.
 */

import {
  A_MAX,
  CUT_IN_TIME,
  FOLLOW_GAP,
  HIGHWAY_DRAG,
  INDICATOR_LEAD_TIME,
  PRETICANJE_BUDZET,
  PRETICANJE_KOCENJE,
  PRETICANJE_POVRATAK,
  PRETICANJE_PRILAZ,
  PRETICANJE_RAZLIKA,
  PRETICANJE_SUSRETNI,
  PRETICANJE_ZALET,
  PRETICANJE_ZALIHA,
  ROLL_RESISTANCE,
  SPEEDING_FACTOR,
  VOZAC_POGLED,
} from "./config";
import { zabranjeno } from "../road/zabrane";
import { perfectBot, type Bot } from "./bots";
import { compile, templateById } from "./intersection";
import { bocnaBrzina, osaSusretne, PLAYER_ID, trakeNaPutu } from "./world";
import type { Input, Path, RoadTemplate, Vehicle, World } from "./types";

/** Faza manevra. Van preticanja je vozač obična kolona iza sporijeg. */
type Faza = "vozi" | "prilaz" | "najava" | "kontra" | "povratak";

/** Koliko pokazivač gori prije nego što volan krene [s]. */
const NAJAVA = INDICATOR_LEAD_TIME + 0.25;

/** Korak kojim se pretražuje puna linija i ograničenje ispred [m]. */
const KORAK = 10;

/** Najdalje iza sporijeg vozila odakle se uopšte planira preticanje [m]. */
const DOMET = 70;

/**
 * Ispod kojeg razmaka se priprema preticanja prekida [m].
 *
 * Dok se prilazi i dok gori pokazivač, kočnica osnove se ne sluša — pa mora
 * postojati tačka na kojoj se ona vraća. Računato unaprijed, dotle se ne stigne:
 * u suprotnu traku se izlazi sa `PRETICANJE_PRILAZ`, a dok volan prevuče auto
 * razmak padne za još nekoliko metara.
 */
const PREKID_RAZMAK = PRETICANJE_PRILAZ * 0.6;

export interface VozacOpcije {
  /** Da li pretiče. Bez toga vozi iza sporijeg do kraja rute. */
  pretice?: boolean;
}

/** Najmanje ograničenje na potezu od `s` do `s + koliko` [m/s]. */
function ogranicenjeNaprijed(tpl: RoadTemplate, s: number, koliko: number): number {
  const naS = tpl.vMaxNa;
  if (!naS) return tpl.vMax;
  let naj = naS(Math.min(s, tpl.length));
  for (let x = s; x <= s + koliko; x += KORAK) naj = Math.min(naj, naS(Math.min(x, tpl.length)));
  return Math.min(naj, naS(Math.min(s + koliko, tpl.length)));
}

/** Da li je na potezu od `od` do `doK` razdjelna linija igdje puna. */
function punaLinija(tpl: RoadTemplate, od: number, doK: number): boolean {
  for (let x = od; x <= doK; x += KORAK) if (zabranjeno(tpl.zabrane, x)) return true;
  return zabranjeno(tpl.zabrane, doK);
}

/** Položaj vozila duž puta, u metrima naše trake. */
const naPutu = (v: Vehicle, p: Path): number => (v.lane === 1 ? p.length - v.s : v.s);

/**
 * Vozilo u našoj traci ispred vozila `me`, sa razmakom od branika do branika.
 *
 * Igrač se ne broji kad se traži vozilo ispred NEKOG DRUGOG: po `lane` je on
 * uvijek u našoj traci, pa bi u preticanju sam sebi bio „vozilo ispred
 * preteknutog".
 */
function sporiIspred(
  world: World,
  paths: ReadonlyMap<string, Path>,
  me: Vehicle,
): { v: Vehicle; d: number } | null {
  let naj: { v: Vehicle; d: number } | null = null;
  for (const o of world.vehicles) {
    if (o.id === me.id || o.done || world.t < o.spawnT || o.lane === 1) continue;
    if (o.id === PLAYER_ID && me.id !== PLAYER_ID) continue;
    const p = paths.get(o.pathId);
    if (!p) continue;
    const d = naPutu(o, p) - me.s - (me.length + o.length) / 2;
    if (d <= 0) continue;
    if (!naj || d < naj.d) naj = { v: o, d };
  }
  return naj;
}

/**
 * Najbliže susretno vozilo ispred nas, mjereno duž puta — sa brzinom kojom
 * nam prilazi.
 *
 * Broji se i vozilo koje upravo skreće sa sporednog puta u susretnu traku: ono
 * se vidi, i za pola luka je u traci. Brzina mu se računa kao ograničenje, jer
 * će je tek razviti — u planu je to strože nego stvarno.
 */
function susretnoIspred(
  world: World,
  tpl: RoadTemplate,
  paths: ReadonlyMap<string, Path>,
  me: Vehicle,
): { v: number; d: number } | null {
  let naj: { v: number; d: number } | null = null;
  for (const o of world.vehicles) {
    if (o.id === me.id || o.done || world.t < o.spawnT || o.lane !== 1) continue;
    const p = paths.get(o.pathId);
    if (!p) continue;
    const d = naPutu(o, p) - me.s;
    if (d <= 0) continue;
    if (!naj || d < naj.d) naj = { v: o.v, d };
  }
  for (const x of world.naSporednom ?? []) {
    if (x.traka !== 1 || x.faza !== "ulazi") continue;
    const p = tpl.prikljucci?.[x.j];
    if (!p) continue;
    const d = p.s - me.s;
    if (d <= 0) continue;
    if (!naj || d < naj.d) naj = { v: tpl.vMaxNa ? tpl.vMaxNa(p.s) : tpl.vMax, d };
  }
  return naj;
}

/**
 * Koliko treba da se nadoknadi `put` metara razlike, uz ubrzanje do `uMax` [s].
 *
 * Računa se sa RAZLIKOM brzina, jer je preticanje trka sa preteknutim, a ne sa
 * putem. Ubrzanje je umanjeno za otpor — pod gasom ga model oduzima, pa bi
 * račun sa punim `A_MAX` obećao manevar kraći nego što jeste. Otvoren put nosi
 * `HIGHWAY_DRAG`, ne gradski otpor — vidi `ctxFor`; sa gradskim koeficijentom
 * ubrzanje na osamdeset ispadne nula i nijedno preticanje ne prođe plan.
 */
function vrijemeZa(put: number, u0: number, uMax: number, v: number): number {
  const a = Math.max(0.2, A_MAX - HIGHWAY_DRAG * v - ROLL_RESISTANCE);
  const t1 = Math.max(0, (uMax - u0) / a);
  const s1 = u0 * t1 + (a * t1 * t1) / 2;
  if (s1 >= put) return (-u0 + Math.sqrt(u0 * u0 + 2 * a * put)) / a;
  return t1 + (put - s1) / uMax;
}

/** Plan preticanja: koliko se ostaje u suprotnoj traci i koliko se nadoknađuje. */
interface Plan {
  /** Vrijeme u suprotnoj traci [s]. */
  kontra: number;
  /** Razlika puta koja se mora nadoknaditi, od sadašnjeg položaja [m]. */
  put: number;
}

/**
 * Može li se preteći, i koliko bi to trajalo. `null` znači „ne kreći".
 *
 * Svaki uslov je po jedno pravilo, a poredak ide od najjeftinijeg računa ka
 * najskupljem.
 */
function planPreticanja(
  world: World,
  tpl: RoadTemplate,
  paths: ReadonlyMap<string, Path>,
  me: Vehicle,
  spori: { v: Vehicle; d: number },
  limit: number,
  cilj: number,
): Plan | null {
  // Brzina preteknutog: ona kojom vozi, ili ona kojom HOĆE da vozi, šta je
  // veće. Vozilo koje trenutno koči iza nekoga ubrzaće čim mu se put otvori —
  // izmjereno, plan je krenuo na vozilo od 35 km/h koje je kočilo iza auta što
  // je skretalo u sporedni put, a ono je za tri sekunde vozilo 55, pa se
  // preticanje razvuklo i završilo u koloni ispred.
  const vL = zeljenaBrzina(spori.v, limit);
  const uMax = limit - vL;
  if (uMax < PRETICANJE_RAZLIKA) return null;

  // Razlika puta: od sadašnjeg razmaka iza njega do razmaka ispred njega.
  const put = spori.d + me.length + spori.v.length + PRETICANJE_POVRATAK * vL + PRETICANJE_ZALIHA;
  // Sa kojom razlikom brzine se ulazi u suprotnu traku: sa onom koja se već
  // ima, ili sa zaletom ako se do tada stigne ubrzati.
  const u0 = Math.max(0, Math.min(uMax, Math.max(me.v - vL, PRETICANJE_ZALET)));
  // Volan: od razdjelne linije do ose suprotne trake i nazad. Osa je na širini
  // trake od naše, a linija na pola te širine — zajedno jedna širina trake.
  const volan = Math.abs(cilj) / bocnaBrzina(limit);
  const kontra = vrijemeZa(put, u0, uMax, me.v) + volan;
  if (kontra > PRETICANJE_BUDZET) return null;

  // Dokle se stigne dok manevar traje, računajući i najavu prije njega.
  const doKle = me.s + me.v * NAJAVA + put + vL * kontra + PRETICANJE_ZALIHA;
  if (doKle > tpl.length) return null;
  if (punaLinija(tpl, me.s, doKle)) return null;
  if (ogranicenjeNaprijed(tpl, me.s, doKle - me.s) < limit - 0.01) return null;

  // Susretni saobraćaj. Prilazi se ZBIROM brzina, i to cijelo vrijeme manevra:
  // prag mora ostati ispunjen i u posljednjem koraku, ne samo u prvom.
  const susretno = susretnoIspred(world, tpl, paths, me);
  if (susretno) {
    const zbir = limit + Math.max(susretno.v, 0);
    if (susretno.d < zbir * (NAJAVA + kontra + PRETICANJE_SUSRETNI)) return null;
  }

  // Ispred preteknutog mora biti prazno: u kolonu se ne ulazi. Poslije manevra
  // stojimo `PRETICANJE_POVRATAK` sekundi ispred njega, pa i tada mora ostati
  // razmak do onoga ko je ispred — inače se jedan pretekne, a naleti na drugog.
  const sljedeci = sporiIspred(world, paths, spori.v);
  if (sljedeci) {
    const t = NAJAVA + kontra;
    // Sve se mjeri od sredine preteknutog u ovom trenutku.
    const mi = vL * t + PRETICANJE_POVRATAK * vL + (me.length + spori.v.length) / 2;
    const on = sljedeci.d + (spori.v.length + sljedeci.v.length) / 2 + sljedeci.v.v * t;
    if (on - mi - (me.length + sljedeci.v.length) / 2 < potrebnoIspred(limit, sljedeci.v.v)) return null;
  }
  return { kontra, put };
}

/** Brzina kojom vozilo vozi, ili kojom hoće da vozi — šta je veće, do ograničenja. */
const zeljenaBrzina = (o: Vehicle, limit: number): number =>
  Math.min(limit, Math.max(o.v, o.cruise ?? o.v));

/**
 * Koliko mjesta mora ostati ispred nas kad se vratimo u svoju traku [m].
 *
 * Toliko da se iza vozila ispred stigne blago usporiti na njegovu brzinu — iz
 * suprotne trake se izlazi brže od kolone — i ne manje od razmaka u kojem se
 * vraćanje ispred nekoga sudi kao prekršaj (`CUT_IN_TIME`).
 */
function potrebnoIspred(nasaBrzina: number, njegova: number): number {
  const razlika = Math.max(0, nasaBrzina - njegova);
  return Math.max(CUT_IN_TIME * njegova, FOLLOW_GAP + (razlika * razlika) / (2 * PRETICANJE_KOCENJE));
}

/**
 * Hoće li, kad stignemo `razmak` ispred preteknutog, biti mjesta ispred nas.
 *
 * Provjerava se u svakom koraku u suprotnoj traci, a ne samo u planu: i vozilo
 * ispred preteknutog mijenja brzinu, a kolona se zbija. Predviđa se trenutak
 * povratka i gdje će tada biti vozilo ispred preteknutog.
 */
function imaMjestaZaPovratak(
  world: World,
  paths: ReadonlyMap<string, Path>,
  me: Vehicle,
  meta: Vehicle,
  iza: number,
  razmak: number,
  limit: number,
): boolean {
  const sljedeci = sporiIspred(world, paths, meta);
  if (!sljedeci) return true;
  // Isti model kao u planu (`planPreticanja`): preteknuti vozi brzinom kojom
  // želi, a mi do povratka ubrzavamo. Da se računa drugačije, plan bi rekao
  // „kreni" a ova provjera odmah „odustani".
  const vMeta = zeljenaBrzina(meta, limit);
  const uMax = Math.max(0.5, limit - vMeta);
  const t = vrijemeZa(Math.max(0, razmak - iza), Math.max(0, me.v - vMeta), uMax, me.v);
  const odMete = sljedeci.d + (meta.length + sljedeci.v.length) / 2 + (sljedeci.v.v - vMeta) * t;
  const prostor = odMete - razmak - (me.length + sljedeci.v.length) / 2;
  return prostor >= potrebnoIspred(limit, sljedeci.v.v);
}

/**
 * Vozač rute.
 *
 * Bez preticanja je ovo „savršen vozač koji gleda tablu": osnovu daje
 * `perfectBot`, dakle ista logika po kojoj voze i NPC-ovi, a ograničenje se
 * gleda `VOZAC_POGLED` metara unaprijed, jer ono pada u jednoj tački a brzina
 * se gubi na putu.
 */
export function vozacRute({ pretice = true }: VozacOpcije = {}): Bot {
  let faza: Faza = "vozi";
  let odKada = 0;
  let desniOd: number | null = null;
  let metaId: string | null = null;
  /** U suprotnoj traci je odlučeno da se vraća IZA preteknutog. */
  let odustao = false;

  return (world, scenario) => {
    const osnova = perfectBot(world, scenario);
    const me = world.vehicles.find((v) => v.id === PLAYER_ID);
    const tpl = templateById(world.templateId);
    if (!me || me.done || !tpl || tpl.kind !== "road" || me.lateral === undefined) return osnova;

    const paths = compile(tpl).paths;
    const path = paths.get(me.pathId);
    if (!path) return osnova;

    const limit = ogranicenjeNaprijed(tpl, me.s, VOZAC_POGLED);
    const cilj = osaSusretne(path, me.s);
    const lat = me.lateral;
    /** Volan kojim se stiže do zadatog poprečnog položaja. */
    const volanKa = (meta: number): number => {
      const korak = bocnaBrzina(me.v) / 60;
      return korak > 0 ? Math.max(-1, Math.min(1, (meta - lat) / korak)) : 0;
    };
    /** Gas i kočnica: osnova zna kad treba kočiti, ograničenje koliko se smije. */
    const poOgranicenju = (ulaz: Input): Input => {
      if (me.v > limit * SPEEDING_FACTOR * 0.98) {
        return { ...ulaz, throttle: 0, brake: Math.max(ulaz.brake, 0.35) };
      }
      if (me.v < limit) return ulaz;
      return { ...ulaz, throttle: 0 };
    };

    const meta = metaId === null ? null : world.vehicles.find((v) => v.id === metaId);
    const spori = sporiIspred(world, paths, me);

    /** Koliko brže idemo od onoga koga bismo pretekli [m/s]. */
    const razlika = (o: Vehicle): number => Math.max(0.5, me.v - o.v);

    /**
     * Plan se pravi za razmak kakav će biti KAD VOLAN KRENE, a ne za onaj koji
     * se drži sada. Vozač se prvo primakne: odstojanje iz kolone je dvije
     * sekunde, a svaka od njih se poslije plaća metrima u suprotnoj traci.
     */
    const planZa = (o: { v: Vehicle; d: number }, doPrelaska: number): Plan | null =>
      planPreticanja(
        world,
        tpl,
        paths,
        me,
        { v: o.v, d: Math.max(2, o.d - razlika(o.v) * doPrelaska) },
        limit,
        cilj,
      );

    /** Plan sa razmaka na koji se prilazi — koliko god da smo sada daleko. */
    const planOdPrilaza = (o: { v: Vehicle; d: number }): Plan | null =>
      planPreticanja(world, tpl, paths, me, { v: o.v, d: Math.min(o.d, PRETICANJE_PRILAZ) }, limit, cilj);

    /** Razmak na kojem se pali pokazivač: do prelaska se stigne još primaći. */
    const zaNajavu = (o: { v: Vehicle; d: number }): number =>
      PRETICANJE_PRILAZ + razlika(o.v) * NAJAVA;

    // ── vožnja svojom trakom ─────────────────────────────────────────────────
    if (faza === "vozi") {
      const ulaz = poOgranicenju({ ...osnova, indicator: null, steer: volanKa(0) });
      if (!pretice || !spori || spori.d > DOMET) return ulaz;
      if (!planOdPrilaza(spori)) return ulaz;
      metaId = spori.v.id;
      desniOd = null;
      if (spori.d > zaNajavu(spori)) {
        faza = "prilaz";
        return ulaz;
      }
      faza = "najava";
      odKada = world.t;
      return { ...ulaz, indicator: "left" };
    }

    // ── primicanje sporijem, bez pokazivača ──────────────────────────────────
    if (faza === "prilaz") {
      if (!meta || !spori || spori.v.id !== metaId || spori.d < PREKID_RAZMAK || !planOdPrilaza(spori)) {
        faza = "vozi";
        metaId = null;
        return poOgranicenju({ ...osnova, indicator: null, steer: volanKa(0) });
      }
      // Kočnica kolone se ovdje NE sluša: ona drži odstojanje od dvije sekunde,
      // a upravo to odstojanje se namjerno skraćuje. Brzina ostaje ograničenje,
      // pa se prilazi najviše onoliko brzo koliko se i smije voziti; ako se
      // plan u međukoraku pokvari, kočnica osnove odmah ponovo radi.
      const prilazi: Input = { ...osnova, throttle: 1, brake: 0, indicator: null, steer: volanKa(0) };
      if (spori.d > zaNajavu(spori)) return poOgranicenju(prilazi);
      faza = "najava";
      odKada = world.t;
      return poOgranicenju({ ...prilazi, indicator: "left" });
    }

    // ── pokazivač gori, još se vozi svojom trakom ────────────────────────────
    if (faza === "najava") {
      // Plan se provjerava u svakom koraku: susretno vozilo je za to vrijeme
      // prišlo, a preteknuti je mogao ubrzati. Odustajanje prije linije ne
      // košta ništa — kočnica osnove je tu i dalje.
      const preostalo = Math.max(0, NAJAVA - (world.t - odKada));
      const blizu = spori !== null && spori.d < PREKID_RAZMAK;
      const jos = meta && spori && spori.v.id === metaId && !blizu ? planZa(spori, preostalo) : null;
      if (!jos) {
        faza = "vozi";
        metaId = null;
        return poOgranicenju({ ...osnova, indicator: null, steer: volanKa(0) });
      }
      const gas: Input = { ...osnova, throttle: 1, brake: 0, indicator: "left" };
      if (preostalo > 0) return poOgranicenju({ ...gas, steer: volanKa(0) });
      faza = "kontra";
      odKada = world.t;
      return poOgranicenju({ ...gas, steer: volanKa(cilj) });
    }

    // ── suprotna traka ───────────────────────────────────────────────────────
    if (faza === "kontra") {
      const metaPut = meta ? paths.get(meta.pathId) : undefined;
      const iza = meta && metaPut ? me.s - naPutu(meta, metaPut) : Infinity;
      // Razmak pri vraćanju. Kod vozila koje STOJI bi vrijeme dalo nulu, pa se
      // uzima zaliha puta: ispred njega se ne vraća na metar.
      const razmak = meta
        ? (me.length + meta.length) / 2 + Math.max(PRETICANJE_POVRATAK * meta.v, PRETICANJE_ZALIHA)
        : 0;
      // Desni pokazivač se pali čim se stigne do preteknutog, dakle mnogo prije
      // nego što se stvarno vraća: tako rok od `INDICATOR_LEAD_TIME` istekne sam,
      // bez ijedne sekunde čekanja u suprotnoj traci. Ali tek kad je prelazak
      // ULIJEVO već presuđen (`kontraT` je narastao u prošlom koraku) — u koraku
      // prelaska pokazivač mora biti lijevi, pa ga desni ne smije preteći.
      if (desniOd === null && world.volan.kontraT > 0 && iza > -razmak) desniOd = world.t;
      const spreman = desniOd !== null && world.t - desniOd >= NAJAVA;
      const isteklo = world.volan.kontraT > PRETICANJE_BUDZET;

      // Ima li ispred mjesta za povratak? Ako ga neće biti, odustaje se dok smo
      // još iza preteknutog, ili pored njega — izmjereno bez ovoga, vozač se
      // vratio pravo u kolonu koja je vozila 38 km/h.
      if (!odustao && meta && iza < razmak && !imaMjestaZaPovratak(world, paths, me, meta, iza, razmak, limit)) {
        // Sredina vozila još nije prešla liniju: to nije odustajanje od
        // preticanja nego od prelaska — nazad u svoju traku. Pokazivač se sudi
        // tek kad sredina pređe, pa ovdje nijedno pravilo nije ni počelo.
        if (world.volan.kontraT === 0) {
          faza = "vozi";
          metaId = null;
          desniOd = null;
          return poOgranicenju({ ...osnova, indicator: null, steer: volanKa(0) });
        }
        odustao = true;
      }

      // Rok je istekao a već smo ispred njega: vraća se i sa manjim razmakom od
      // planiranog. Kraće vraćanje je sitnica (`cutIn` je `minor` i ne obara
      // vožnju dok preteknuti ne mora da koči), a dalje stajanje u suprotnoj
      // traci nije.
      if (!odustao && spreman && (iza >= razmak || isteklo)) {
        faza = "povratak";
        return poOgranicenju({ ...osnova, indicator: "right", steer: volanKa(0) });
      }
      // Odustajanje, ili rok istekao a nije se stiglo ispred: koči i vrati se
      // IZA njega. Preticanje koje ne uspije nije prekršaj; zadržavanje u
      // suprotnoj traci i povratak u kolonu jesu.
      if (odustao || (isteklo && iza < 0)) {
        if (desniOd === null) desniOd = world.t;
        const izaNjega = meta ? -((me.length + meta.length) / 2 + FOLLOW_GAP + meta.v * 0.5) : Infinity;
        const nazad = spreman && iza < izaNjega;
        if (nazad) {
          faza = "povratak";
          odustao = false;
        }
        return {
          ...osnova,
          throttle: 0,
          brake: nazad ? osnova.brake : 1,
          indicator: "right",
          steer: volanKa(nazad ? 0 : cilj),
        };
      }
      // Kočnica osnove se ne sluša DOK tijelo još dodiruje svoju traku: tamo je
      // ona odstojanje od vozila koje upravo obilazimo — izmjereno, obarala je
      // brzinu sa osamdeset na šezdeset tačno u koraku prelaska, pa je manevar
      // gubio razliku brzine zbog koje je i počeo. Čim smo cijeli u suprotnoj
      // traci, kočnica opet znači ono što treba: nešto je ispred NAS.
      const pokazivac: "left" | "right" = desniOd === null ? "left" : "right";
      const preko = trakeNaPutu(path, me).includes(0)
        ? { ...osnova, throttle: 1, brake: 0 }
        : osnova;
      return poOgranicenju({ ...preko, indicator: pokazivac, steer: volanKa(cilj) });
    }

    // ── povratak u svoju traku ───────────────────────────────────────────────
    const ulaz = poOgranicenju({ ...osnova, indicator: "right", steer: volanKa(0) });
    if (Math.abs(lat) > 0.05) return ulaz;
    faza = "vozi";
    metaId = null;
    desniOd = null;
    odustao = false;
    return { ...ulaz, indicator: null };
  };
}
