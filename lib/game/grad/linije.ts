import { CAR_WIDTH, GRAD_OSTAR_LOM, GRAD_PUNA_POSLIJE_PROMJENE, GRAD_SIRINA_TRAKE, LINE_CROSS_TOL } from "../sim/config";
import type { Ivica, Mreza } from "./mreza";

/**
 * Pune linije i autobuske trake (faza 6, stavka 6): gdje su na ulici. Iz
 * istih funkcija se crtaju oznake, sudi `crossingSolidLine` i `busLane`, i
 * bot planira promjenu trake — nacrtano, suđeno i voženo je jedno.
 *
 * Puna linija „pred raskrsnicom" mjeri se od ivice raskrsnice (gdje linije
 * počinju, `krajeviLinija`) duž ulice — i kroz čvorove koji nisu raskrsnice,
 * jer OSM ulicu često dijeli na komade od par metara. Ali ne preko mjesta gdje
 * se mijenja raspored traka (proširenje za traku skretanja ili autobusku):
 * tamo se trake tek uspostavljaju, pa puna linija počinje najranije
 * `GRAD_PUNA_POSLIJE_PROMJENE` metara iza njega.
 */

/** Linija između traka: pomak od osovine [m, + desno u smjeru `a → b`] i čija je. */
export interface LinijaTraka {
  o: number;
  /** Razdjelna linija smjerova, ili linija između traka smjera `a → b` (`naprijed`) / `b → a`. */
  vrsta: "srednja" | "naprijed" | "nazad";
}

/** Linije traka ivice, kao u `linijeTraka` (oznake), sa vrstom. Uska ulica nema linija. */
export function linijeSaVrstom(iv: Ivica): LinijaTraka[] {
  const n = iv.trakeNaprijed + iv.trakeNazad;
  if (n < 2 || iv.sirina < n * GRAD_SIRINA_TRAKE - 1e-6) return [];
  const traka = iv.sirina / n;
  const izlaz: LinijaTraka[] = [];
  for (let k = 1; k < n; k++) {
    // Trake `b → a` su lijevo (manji pomak): prvih `trakeNazad`.
    const vrsta = k === iv.trakeNazad && iv.trakeNaprijed > 0 ? "srednja" : k < iv.trakeNazad ? "nazad" : "naprijed";
    izlaz.push({ o: -iv.sirina / 2 + k * traka, vrsta });
  }
  return izlaz;
}

/**
 * Za svaki kraj ivice (`2·ivica + kraj`, 0 = `a`), napolje kroz čvorove koji
 * nisu raskrsnice:
 *  - `doRaskrsnice`: metara do ivice sljedeće raskrsnice; kad je sam kraj u
 *    raskrsnici, minus odsječak (ivica raskrsnice je toliko UNUTAR ivice);
 *    bez raskrsnice (slijepa ulica): ∞;
 *  - `doPromjene`: metara do čvora iza kojeg ulica ima drugi raspored traka
 *    (0 kad je to već čvor na tom kraju); bez promjene do raskrsnice: ∞.
 */
export interface Produzeci {
  doRaskrsnice: Float32Array;
  doPromjene: Float32Array;
}

/** Isti raspored traka: broj u svakom smjeru i širina (smjer `f` prema smjeru `iv`). */
function istiRaspored(iv: Ivica, f: Ivica, istiSmjer: boolean): boolean {
  const [n, z] = istiSmjer ? [f.trakeNaprijed, f.trakeNazad] : [f.trakeNazad, f.trakeNaprijed];
  return n === iv.trakeNaprijed && z === iv.trakeNazad && Math.abs(f.sirina - iv.sirina) < 0.01;
}

export function produzeci(m: Mreza, odsjeci: Float32Array): Produzeci {
  const doRaskrsnice = new Float32Array(2 * m.ivice.length).fill(Infinity);
  const doPromjene = new Float32Array(2 * m.ivice.length).fill(Infinity);
  const krajeva = (c: number) => {
    let k = 0;
    for (const i of m.izCvora[c] ?? []) {
      const iv = m.ivice[i]!;
      if (iv.vozna) k += iv.a === iv.b ? 2 : 1;
    }
    return k;
  };
  for (const iv of m.ivice) {
    if (!iv.vozna) continue;
    for (const kraj of [0, 1] as const) {
      const k = 2 * iv.i + kraj;
      if (odsjeci[k]! > 0) {
        doRaskrsnice[k] = -odsjeci[k]!;
        continue;
      }
      // Hod kroz čvorove sa dva vozna kraja, dok se ne dođe do raskrsnice.
      let duz = 0;
      let od = iv.i;
      let c = kraj === 1 ? iv.b : iv.a;
      // Smjer iz kojeg se gleda: ivica `iv`, a dalje svaka sljedeća u
      // pravcu hoda (da li ide istim smjerom kao `iv`).
      let prethodna = iv;
      let prethodnaIsto = true;
      const vidjeno = new Set([iv.i]);
      for (;;) {
        if (krajeva(c) !== 2) break;
        const j = (m.izCvora[c] ?? []).find((x) => x !== od && m.ivice[x]!.vozna);
        if (j === undefined || vidjeno.has(j)) break;
        vidjeno.add(j);
        const f = m.ivice[j]!;
        // Hod od kraja `b` ide niz ivice koje počinju u `c` u istom smjeru.
        const fIsto = (kraj === 1) === (f.a === c);
        if (doPromjene[k] === Infinity && !istiRaspored(prethodna, f, prethodnaIsto === fIsto)) doPromjene[k] = duz;
        const daljiKraj = f.a === c ? 1 : 0;
        if (odsjeci[2 * j + daljiKraj]! > 0) {
          doRaskrsnice[k] = duz + f.duzina - odsjeci[2 * j + daljiKraj]!;
          break;
        }
        duz += f.duzina;
        od = j;
        prethodna = f;
        prethodnaIsto = fIsto;
        c = daljiKraj === 1 ? f.b : f.a;
      }
    }
  }
  return { doRaskrsnice, doPromjene };
}

/**
 * Ima li osovina ivice oštar lom: tjeme u kojem se pravac mijenja više od
 * `GRAD_OSTAR_LOM` stepeni. To je greška u OSM geometriji (ulica „stepenik"):
 * puna linija nacrtana po takvoj osovini lomi se isto, i auto je ne može
 * pratiti. Editor upozorava; lijek je pomjeriti čvor.
 */
export function ostarLom(iv: Ivica): boolean {
  const t = iv.tacke;
  for (let k = 1; k + 1 < t.length; k++) {
    const ax = t[k]!.x - t[k - 1]!.x;
    const ay = t[k]!.y - t[k - 1]!.y;
    const bx = t[k + 1]!.x - t[k]!.x;
    const by = t[k + 1]!.y - t[k]!.y;
    const ugao = Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by)) * (180 / Math.PI);
    if (ugao > GRAD_OSTAR_LOM) return true;
  }
  return false;
}

/** Je li linija `l` uz autobusku traku (granica autobuske i susjedne trake). */
export function uzBus(iv: Ivica, l: LinijaTraka): boolean {
  const a = pojasBusa(iv, 1);
  const b = pojasBusa(iv, -1);
  return (a !== null && Math.abs(l.o - a[0]) < 1e-6) || (b !== null && Math.abs(l.o - b[1]) < 1e-6);
}

/**
 * Dijelovi ivice [od, do] (`s` od `a`) na kojima je linija `l` puna — može
 * izaći van ivice, crtač i sudija gledaju samo dio van raskrsnica. Linija uz
 * autobusku traku nije puna ni pred raskrsnicom: preko nje se ulazi u
 * autobusku traku radi skretanja (odluka korisnika: ulazak radi skretanja
 * nije prekršaj).
 */
export function puniDijelovi(iv: Ivica, l: LinijaTraka, p: Produzeci): [number, number][] {
  const L = iv.duzina;
  const kA = p.doPromjene[2 * iv.i]!;
  const kB = p.doPromjene[2 * iv.i + 1]!;
  const T = GRAD_PUNA_POSLIJE_PROMJENE;
  // Puna cijelom dionicom — osim T metara oko promjene rasporeda traka, gdje
  // se trake tek prestrojavaju (osovina nove ivice je drugdje).
  if (l.vrsta === "srednja" && (iv.linija === "puna" || iv.linija === "dvostruka")) {
    const od = Number.isFinite(kA) ? T - kA : -Infinity;
    const do_ = Number.isFinite(kB) ? L + kB - T : Infinity;
    return do_ > od ? [[od, do_]] : [];
  }
  if (l.vrsta === "srednja" && iv.linija === "bez") return [];
  if (l.vrsta !== "srednja" && uzBus(iv, l)) return [];
  const n = l.vrsta === "srednja" ? iv.punaPrije : iv.trakePrije;
  if (n <= 0) return [];
  const eA = p.doRaskrsnice[2 * iv.i]!;
  const eB = p.doRaskrsnice[2 * iv.i + 1]!;
  const dijelovi: [number, number][] = [];
  // Pred raskrsnicom na kraju `b` (vožnja `a → b`): od N metara pred njom, ali
  // ne bliže od T iza promjene rasporeda traka iza leđa (prema `a`). Kad se
  // raspored mijenja prije raskrsnice (ispred), ovaj komad nije njen prilaz.
  if (l.vrsta !== "nazad" && Number.isFinite(eB) && !(kB < eB)) dijelovi.push([Math.max(L + eB - n, T - kA), L + eB]);
  // Pred raskrsnicom na kraju `a` (vožnja `b → a`), simetrično.
  if (l.vrsta !== "naprijed" && Number.isFinite(eA) && !(kA < eA)) dijelovi.push([-eA, Math.min(n - eA, L + kB - T)]);
  return dijelovi.filter(([a, b]) => b > a);
}

/** Je li linija `l` ivice puna na `s` (od `a`). */
export function punaNa(iv: Ivica, l: LinijaTraka, s: number, p: Produzeci): boolean {
  return puniDijelovi(iv, l, p).some(([a, b]) => s >= a && s <= b);
}

/** Ima li ijedna puna linija ivice na dijelu [s0, s1] (`s` od `a`). */
export function punaIzmedju(iv: Ivica, p: Produzeci, s0: number, s1: number): boolean {
  const [a, b] = s0 <= s1 ? [s0, s1] : [s1, s0];
  return linijeSaVrstom(iv).some((l) => puniDijelovi(iv, l, p).some(([x, y]) => x <= b && y >= a));
}

/**
 * Za bota: `d` (metara od početka ivice u smjeru vožnje) od kojeg su linije
 * između traka tog smjera pune — promjena trake mora biti gotova prije. ∞
 * kad punih nema.
 */
export function punaTrakeOd(iv: Ivica, smjer: 1 | -1, p: Produzeci): number {
  let od = Infinity;
  for (const l of linijeSaVrstom(iv)) {
    if (l.vrsta !== (smjer === 1 ? "naprijed" : "nazad")) continue;
    for (const [a, b] of puniDijelovi(iv, l, p)) od = Math.min(od, smjer === 1 ? a : iv.duzina - b);
  }
  return od;
}

/**
 * Da li bi auto sa sredinom na bočnom pomaku `w` (u smjeru vožnje, + desno)
 * stajao na liniji ivice — tijelo preko nje više od tolerancije sudije.
 */
export function naLinijiTraka(iv: Ivica, smjer: 1 | -1, w: number): boolean {
  return linijeSaVrstom(iv).some((l) => CAR_WIDTH / 2 - Math.abs(w - l.o * smjer) > LINE_CROSS_TOL);
}

/**
 * Autobuska traka u smjeru vožnje (`smjer` 1 je `a → b`): poprečni opseg
 * [od, do] od osovine (+ desno u smjeru `a → b`), ili `null`. Samo kad u tom
 * smjeru ima bar dvije trake — inače bi bila jedina traka.
 */
export function pojasBusa(iv: Ivica, smjer: 1 | -1): [number, number] | null {
  const n = iv.trakeNaprijed + iv.trakeNazad;
  const svoje = smjer === 1 ? iv.trakeNaprijed : iv.trakeNazad;
  const bus = smjer === 1 ? iv.busNaprijed : iv.busNazad;
  if (!bus || svoje < 2 || iv.sirina < n * GRAD_SIRINA_TRAKE - 1e-6) return null;
  const traka = iv.sirina / n;
  // Krajnja desna traka u smjeru vožnje: uz desni ivičnjak.
  return smjer === 1 ? [iv.sirina / 2 - traka, iv.sirina / 2] : [-iv.sirina / 2, -iv.sirina / 2 + traka];
}
