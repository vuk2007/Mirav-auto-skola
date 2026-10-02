import { uMetre, uStepene } from "../../../scripts/osm/lib/proj.mjs";
import { GRAD_EDITOR_KRAK_DO, GRAD_EDITOR_POGODAK } from "../sim/config";
import { pointAt } from "../sim/geometry";
import type { Point } from "../sim/types";
import { ostarLom, pojasBusa } from "./linije";
import type { Manevar, Mreza } from "./mreza";
import {
  sidroUlice,
  tackaOverlaya,
  vezaniUlica,
  type Izmjena,
  type KontrolaOverlaya,
  type Overlay,
  type PlanOverlaya,
  type PoljaDionice,
  type SidroKraka,
  type SidroUlice,
} from "./overlay";
import type { Raskrsnica } from "./raskrsnica";
import type { SvijetGrada } from "./svijet";

/**
 * Logika editora grada (faza 6, stavka 6c) — bez React-a, da se testira:
 * šta je kliknuto, kako se iz izabranog pravi izmjena sa sidrom, šta je
 * sumnjivo (upozorenja), lista ručno postavljenih znakova za instruktora.
 * Komponenta editora samo crta i prosljeđuje klikove.
 */

// ── pogodak ──────────────────────────────────────────────────────────────

export type Pogodak =
  | { vrsta: "raskrsnica"; r: number }
  | { vrsta: "krak"; r: number; k: number }
  | { vrsta: "ulica"; ivica: number; s: number; tacka: Point; pravac: Point }
  | { vrsta: "cvor"; cvor: number };

/** Najbliža ivica tački (i ne-vozne, i zatvorene; ne uklonjene), sa `s` i pravcem `a → b`. */
export function najblizaUlica(m: Mreza, p: Point, do_: number): { ivica: number; s: number; d: number; tacka: Point; pravac: Point } | null {
  let naj: { ivica: number; s: number; d: number; tacka: Point; pravac: Point } | null = null;
  for (const iv of m.ivice) {
    if (iv.uklonjena) continue;
    for (let k = 0; k + 1 < iv.tacke.length; k++) {
      const a = iv.tacke[k]!;
      const b = iv.tacke[k + 1]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l2 = dx * dx + dy * dy;
      if (l2 === 0) continue;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
      const q = { x: a.x + dx * t, y: a.y + dy * t };
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d <= do_ && (!naj || d < naj.d)) {
        const l = Math.sqrt(l2);
        naj = { ivica: iv.i, s: iv.cum[k]! + l * t, d, tacka: q, pravac: { x: dx / l, y: dy / l } };
      }
    }
  }
  return naj;
}

/**
 * Šta je klik na tački `p` (lokalni metri): raskrsnica (blizu centra),
 * krak (na ivici kraka, do `GRAD_EDITOR_KRAK_DO` od raskrsnice) ili ulica.
 * U režimu čvorova: čvor.
 */
export function pogodi(s: SvijetGrada, p: Point, cvorovi = false): Pogodak | null {
  const m = s.mreza;
  if (cvorovi) {
    let naj = -1;
    let d = GRAD_EDITOR_POGODAK;
    m.cvorovi.forEach((c, i) => {
      const di = Math.hypot(c.x - p.x, c.y - p.y);
      if (di < d && (m.izCvora[i]?.length ?? 0) > 0) [naj, d] = [i, di];
    });
    return naj >= 0 ? { vrsta: "cvor", cvor: naj } : null;
  }
  // Raskrsnica: klik bliže centru od pola njenog prečnika (najmanje par metara).
  let rNaj: { r: number; d: number } | null = null;
  for (const r of s.raskrsnice.lista) {
    const d = Math.hypot(r.centar.x - p.x, r.centar.y - p.y);
    const poluprecnik = Math.max(GRAD_EDITOR_POGODAK, ...r.cvorovi.map((c) => Math.hypot(m.cvorovi[c]!.x - r.centar.x, m.cvorovi[c]!.y - r.centar.y) + 3));
    if (d <= poluprecnik && (!rNaj || d < rNaj.d)) rNaj = { r: r.id, d };
  }
  if (rNaj) return { vrsta: "raskrsnica", r: rNaj.r };
  const u = najblizaUlica(m, p, 2 * GRAD_EDITOR_POGODAK);
  if (!u) return null;
  const iv = m.ivice[u.ivica]!;
  // Krak: blizu kraja ivice koji je u raskrsnici.
  for (const kraj of [0, 1] as const) {
    const doKraja = kraj === 0 ? u.s : iv.duzina - u.s;
    const kr = s.raskrsnice.krakIvice.get(`${iv.i}:${kraj}`);
    if (kr && doKraja <= GRAD_EDITOR_KRAK_DO) return { vrsta: "krak", r: kr[0], k: kr[1] };
  }
  return { vrsta: "ulica", ivica: u.ivica, s: u.s, tacka: u.tacka, pravac: u.pravac };
}

// ── sidra iz izabranog ───────────────────────────────────────────────────

/** Sidro ulice na ivici `i`, `s` od `a`, pravac `a → b` (`naprijed`) ili suprotan. */
export function sidroNaIvici(m: Mreza, i: number, s: number, naprijed = true): SidroUlice {
  const iv = m.ivice[i]!;
  const ss = Math.max(0.5, Math.min(iv.duzina - 0.5, s));
  const p = pointAt(iv.tacke, iv.cum, ss);
  const q = pointAt(iv.tacke, iv.cum, Math.min(iv.duzina, ss + 0.5));
  const r = pointAt(iv.tacke, iv.cum, Math.max(0, ss - 0.5));
  const h = { x: q.x - r.x, y: q.y - r.y };
  return sidroUlice(iv.osm, p, naprijed ? h : { x: -h.x, y: -h.y });
}

/** Sidro kraka `k` raskrsnice `r`: čvor u kojem ga dodiruje, i tačka na njemu, pravac ka raskrsnici. */
export function sidroKraka(s: SvijetGrada, r: number, k: number): SidroKraka {
  const krak = s.raskrsnice.lista[r]!.kraci[k]!;
  const iv = s.mreza.ivice[krak.ivica]!;
  const d = Math.min(10, iv.duzina / 2);
  const sIv = krak.kraj === 1 ? iv.duzina - d : d;
  return { raskrsnica: tackaOverlaya(s.mreza.cvorovi[krak.cvor]!), ulica: sidroNaIvici(s.mreza, krak.ivica, sIv, krak.kraj === 1) };
}

// ── izmjene u overlay-u ──────────────────────────────────────────────────

export interface Potpis {
  autor: string;
  /** ISO datum; editor daje sadašnji trenutak. */
  datum: string;
}

let brojac = 0;
/** Jedinstven id izmjene (vrijeme + brojač + slučajno — samo da se ne ponovi). */
export function noviId(): string {
  brojac += 1;
  return `${Date.now().toString(36)}-${brojac.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Ključ cilja izmjene: ista vrsta na istom mjestu zamjenjuje prethodnu (ne gomila se). */
function kljucCilja(iz: Izmjena): string | null {
  const t = (p: { x: number; y: number }) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  switch (iz.vrsta) {
    case "kontrola":
    case "skretanje":
    case "zabranaUlaska":
      return `${iz.vrsta}@${t(iz.krak.raskrsnica)}/${t(iz.krak.ulica)}`;
    case "semafor":
      return `semafor@${t(iz.raskrsnica)}`;
    case "zona":
      return `zona@${iz.zona.id}`;
    case "zadatak":
      return `zadatak@${iz.zadatak.id}`;
    case "cvor":
      return `cvor@${t(iz.na)}`;
    default:
      return null;
  }
}

/**
 * Overlay sa novom izmjenom: zamjenjuje izmjenu iste vrste na istom mjestu
 * (isti krak, ista raskrsnica, ista zona), inače se dodaje na kraj. Vraća
 * NOVI overlay — stari ostaje za „poništi".
 */
export function postavi(o: Overlay, iz: Izmjena): Overlay {
  const k = kljucCilja(iz);
  const i = k ? o.izmjene.findIndex((x) => kljucCilja(x) === k) : -1;
  const izmjene = [...o.izmjene];
  if (i >= 0) izmjene[i] = iz;
  else izmjene.push(iz);
  return { ...o, izmjene };
}

export function ukloni(o: Overlay, id: string): Overlay {
  return { ...o, izmjene: o.izmjene.filter((x) => x.id !== id) };
}

/** Izmjena koja važi za krak (ključ „ivica:kraj") — da se u panelu vidi i ukloni. */
export function izmjeneKraka(s: SvijetGrada, o: Overlay, r: number, k: number): Izmjena[] {
  const krak = s.raskrsnice.lista[r]!.kraci[k]!;
  const kljuc = `${krak.ivica}:${krak.kraj}`;
  const pr = s.pravila;
  if (!pr) return [];
  const ids = new Set(
    [pr.kontrole.get(kljuc)?.id, pr.skretanja.get(kljuc)?.id, pr.zabraneUlaska.get(kljuc)?.id].filter((x): x is string => !!x),
  );
  return o.izmjene.filter((x) => ids.has(x.id));
}

/**
 * Izmjena dionice koja već važi za ivicu `i` (njeno sidro se veže za ivicu iste
 * dionice) — polja se dopisuju u nju, ne pravi se nova.
 */
export function izmjenaDionice(s: SvijetGrada, o: Overlay, dionica: readonly number[]): Extract<Izmjena, { vrsta: "dionica" }> | null {
  for (let j = o.izmjene.length - 1; j >= 0; j--) {
    const x = o.izmjene[j]!;
    if (x.vrsta !== "dionica") continue;
    const u = vezaniUlica(s.mreza, x.ulica);
    if (u && dionica.includes(u.ivica)) return x;
  }
  return null;
}

/** Dionica ivice: ona i nastavak kroz čvorove koji nisu raskrsnice (kao u overlay-u). */
export function dionicaIvice(m: Mreza, i: number): number[] {
  const krajeva = (c: number) =>
    (m.izCvora[c] ?? []).reduce((n, x) => n + (m.ivice[x]!.vozna || m.ivice[x]!.zatvorena ? (m.ivice[x]!.a === m.ivice[x]!.b ? 2 : 1) : 0), 0);
  const sve = [i];
  for (const pocetak of [m.ivice[i]!.a, m.ivice[i]!.b]) {
    let c = pocetak;
    let od = i;
    for (;;) {
      if (krajeva(c) !== 2) break;
      const j = (m.izCvora[c] ?? []).find((x) => x !== od && (m.ivice[x]!.vozna || m.ivice[x]!.zatvorena));
      if (j === undefined || sve.includes(j)) break;
      sve.push(j);
      od = j;
      c = m.ivice[j]!.a === c ? m.ivice[j]!.b : m.ivice[j]!.a;
    }
  }
  return sve;
}

/**
 * Polja dionice kakva su sad na ivici `i` (OSM sa izmjenama), u pravcu `a → b`
 * — za formular. `skretanja` su prazna kad ih nema.
 */
export function poljaIvice(m: Mreza, i: number): Required<Omit<PoljaDionice, "ime" | "klasa">> & { ime: string; klasa: string } {
  const iv = m.ivice[i]!;
  return {
    smjer: iv.smjer === 0 ? "oba" : iv.smjer === 1 ? "naprijed" : "nazad",
    trakeNaprijed: iv.smjer === -1 ? 0 : iv.trakeNaprijed,
    trakeNazad: iv.smjer === 1 ? 0 : iv.trakeNazad,
    skretanjaNaprijed: iv.skretanjaNaprijed,
    skretanjaNazad: iv.skretanjaNazad,
    busNaprijed: iv.busNaprijed,
    busNazad: iv.busNazad,
    linija: iv.linija,
    punaPrije: iv.punaPrije,
    trakePrije: iv.trakePrije,
    zatvorena: iv.zatvorena,
    ime: iv.ime,
    klasa: iv.klasa,
  };
}

/**
 * Potvrda izvedenog prioriteta (zadatak, odjeljak 5: filter „inferirani"):
 * za svaki ulazni krak izmjena sa kontrolom kakva je sada — čovjek je
 * provjerio na terenu, i raskrsnica više nije izvedena.
 */
export function potvrdaRaskrsnice(s: SvijetGrada, r: number, potpis: Potpis): Izmjena[] {
  const rs = s.raskrsnice.lista[r]!;
  const izmjene: Izmjena[] = [];
  rs.kraci.forEach((k, j) => {
    if (!k.ulaz || k.kontrola === "semafor") return;
    izmjene.push({ id: noviId(), ...potpis, vrsta: "kontrola", krak: sidroKraka(s, r, j), kontrola: k.kontrola as KontrolaOverlaya });
  });
  if (rs.plan && rs.inferredPhases) {
    const plan = planOverlaya(s, rs);
    if (plan) izmjene.push({ id: noviId(), ...potpis, vrsta: "semafor", raskrsnica: tackaOverlaya(s.mreza.cvorovi[rs.cvorovi[0]!]!), plan });
  }
  return izmjene;
}

/** Plan semafora raskrsnice (izveden ili iz editora) u obliku overlay-a — polazna tačka za uređivanje. */
export function planOverlaya(s: SvijetGrada, rs: Raskrsnica): PlanOverlaya | null {
  if (!rs.plan) return null;
  const kr = (j: number) => sidroKraka(s, rs.id, j);
  return {
    faze: rs.plan.faze.map((f) => ({
      zeleno: f.zeleno,
      kraci: [...f.kraci.map((j) => ({ krak: kr(j), manevri: null })), ...f.djelimicno.map((d) => ({ krak: kr(d.krak), manevri: [...d.manevri] }))],
      strelice: f.strelice.map((d) => ({ krak: kr(d.krak), manevri: [...d.manevri] })),
      pjesaci: f.pjesaci.map(kr),
    })),
    zuto: rs.plan.zuto,
    sveCrveno: rs.plan.sveCrveno,
    pomak: rs.plan.pomak,
  };
}

// ── upozorenja ───────────────────────────────────────────────────────────

export interface Upozorenje {
  tekst: string;
  tacka: Point;
}

const MANEVRI_STRELICA: Record<string, Manevar[]> = {
  left: ["lijevo"],
  slight_left: ["lijevo"],
  sharp_left: ["lijevo"],
  right: ["desno"],
  slight_right: ["desno"],
  sharp_right: ["desno"],
  through: ["pravo"],
  none: ["pravo"],
  "": ["pravo"],
};

/**
 * Šta u izmjenama ne štima — editor to pokazuje uz mjesto:
 *  - izmjena čije sidro nije nađeno (OSM se promijenio);
 *  - puna linija na ulici sa oštrim lomom osovine (auto je ne može pratiti —
 *    treba pomjeriti čvor);
 *  - autobuska traka koja je jedina traka za neki pravac (po strelicama);
 *  - raskrsnica sa mješavinom znaka iz editora i pravila desne strane.
 */
export function upozorenja(s: SvijetGrada, o: Overlay): Upozorenje[] {
  const m = s.mreza;
  const izlaz: Upozorenje[] = [];
  for (const n of s.nevezane) {
    const iz = o.izmjene.find((x) => x.id === n.id);
    const t = iz ? tackaIzmjene(iz) : null;
    izlaz.push({ tekst: `Nevezana izmjena (${n.vrsta}): ${n.razlog}`, tacka: t ?? { x: 0, y: 0 } });
  }
  for (const iv of m.ivice) {
    if (!iv.vozna) continue;
    const imaPunu = iv.linija === "puna" || iv.linija === "dvostruka" || iv.punaPrije > 0 || iv.trakePrije > 0;
    if (imaPunu && ostarLom(iv)) {
      izlaz.push({ tekst: `Puna linija na ulici sa oštrim lomom osovine (${iv.ime || "bez imena"}) — pomjeri čvor da ulica bude glatka.`, tacka: iv.tacke[Math.floor(iv.tacke.length / 2)]! });
    }
    for (const smjer of [1, -1] as const) {
      if (!pojasBusa(iv, smjer)) continue;
      const opis = smjer === 1 ? iv.skretanjaNaprijed : iv.skretanjaNazad;
      if (!opis) continue;
      const trake = opis.split("|").map((t) => t.split(";").flatMap((x) => MANEVRI_STRELICA[x.trim()] ?? []));
      const busTraka = trake[trake.length - 1] ?? [];
      const ostale = trake.slice(0, -1).flat();
      const samoBus = busTraka.filter((mv) => !ostale.includes(mv));
      if (samoBus.length > 0) {
        izlaz.push({ tekst: `Autobuska traka je jedina za: ${samoBus.join(", ")} (${iv.ime || "bez imena"}) — provjeri strelice.`, tacka: iv.tacke[Math.floor(iv.tacke.length / 2)]! });
      }
    }
  }
  for (const r of s.raskrsnice.lista) {
    const ulazi = r.kraci.filter((k) => k.ulaz);
    if (ulazi.some((k) => k.izvor === "overlay") && ulazi.some((k) => k.izvor === "pravilo")) {
      izlaz.push({ tekst: "Raskrsnica ima znak iz editora na nekim krakovima, a na ostalima važi pravilo desne strane — postavi i ostale krakove.", tacka: r.centar });
    }
  }
  return izlaz;
}

/** Tačka izmjene (za skok na nju). */
export function tackaIzmjene(iz: Izmjena): Point | null {
  switch (iz.vrsta) {
    case "kontrola":
    case "skretanje":
    case "zabranaUlaska":
      return iz.krak.ulica;
    case "semafor":
      return iz.raskrsnica;
    case "znak":
    case "prelaz":
      return iz.mjesto;
    case "dionica":
    case "ukloniUlicu":
      return iz.ulica;
    case "cvor":
      return iz.na;
    case "novaUlica":
      return iz.tacke[0] ?? null;
    case "zona": {
      const p = iz.zona.poligon;
      if (p.length === 0) return null;
      return { x: p.reduce((a, t) => a + t[0], 0) / p.length, y: p.reduce((a, t) => a + t[1], 0) / p.length };
    }
    case "zadatak":
      return iz.zadatak.start;
  }
}

// ── pretraga i koordinate ────────────────────────────────────────────────

/** Ulice čije ime sadrži upit (bez obzira na velika slova i dijakritike), sa tačkom za skok. */
export function traziUlice(m: Mreza, upit: string, najvise = 12): { ime: string; tacka: Point }[] {
  const bez = (x: string) =>
    x
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "dj");
  const q = bez(upit.trim());
  if (q.length < 2) return [];
  const po = new Map<string, Point>();
  for (const iv of m.ivice) {
    if (!iv.ime || iv.uklonjena || po.has(iv.ime) || !bez(iv.ime).includes(q)) continue;
    po.set(iv.ime, iv.tacke[Math.floor(iv.tacke.length / 2)]!);
    if (po.size >= najvise) break;
  }
  return [...po].map(([ime, tacka]) => ({ ime, tacka }));
}

/**
 * Tačka iz upisa: „x, y" u lokalnim metrima, ili „lat, lon" u stepenima
 * (prepoznaje se po vrijednostima: geografska širina Crne Gore je 41–44°).
 */
export function procitajKoordinate(upis: string, ishodiste: { lat: number; lon: number }): Point | null {
  const d = upis.split(/[,;\s]+/).filter(Boolean).map(Number);
  if (d.length !== 2 || !d.every(Number.isFinite)) return null;
  const [a, b] = d as [number, number];
  if (a > 40 && a < 45 && b > 17 && b < 22) {
    const o = uMetre(ishodiste.lat, ishodiste.lon);
    const p = uMetre(a, b);
    return { x: p.x - o.x, y: o.y - p.y };
  }
  return { x: a, y: b };
}

/** Lokalni metri u stepene (za izvoz i prikaz). */
export function uGeo(p: Point, ishodiste: { lat: number; lon: number }): { lat: number; lon: number } {
  const o = uMetre(ishodiste.lat, ishodiste.lon);
  return uStepene(o.x + p.x, o.y - p.y);
}

// ── izvoz za instruktora ─────────────────────────────────────────────────

const OPIS: Partial<Record<Izmjena["vrsta"], string>> = {
  kontrola: "Kontrola kraka",
  skretanje: "Znak skretanja",
  zabranaUlaska: "Zabrana ulaska",
  semafor: "Semafor",
  znak: "Znak uz ulicu",
  prelaz: "Pješački prelaz",
};

/**
 * Lista ručno postavljenih znakova i semafora (zadatak, odjeljak 4: dugme
 * „izvezi listu" za instruktorsku provjeru) — CSV sa ulicom, koordinatama,
 * autorom i datumom; otvara se u Excel-u.
 */
export function listaZnakova(s: SvijetGrada, o: Overlay): string {
  const red = (polja: (string | number)[]) => polja.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";");
  const redovi = [red(["id", "vrsta", "šta", "ulica", "lat", "lon", "autor", "datum", "napomena"])];
  for (const iz of o.izmjene) {
    const vrsta = OPIS[iz.vrsta];
    if (!vrsta) continue;
    const t = tackaIzmjene(iz);
    if (!t) continue;
    const g = uGeo(t, o.ishodiste);
    const ul = najblizaUlica(s.mreza, t, 10);
    const sta =
      iz.vrsta === "kontrola"
        ? { stop: "STOP", ustupi: "Ustupi prvenstvo", glavni: "Glavni put", desna: "Bez znaka (desna strana)" }[iz.kontrola]
        : iz.vrsta === "skretanje"
          ? iz.znak
            ? `${iz.znak.vrsta === "zabrana" ? "Zabrana" : "Obavezno"}: ${iz.znak.manevri.join(", ")}`
            : "Uklonjene OSM zabrane"
          : iz.vrsta === "semafor"
            ? iz.plan
              ? `${iz.plan.faze.length} faze, ciklus ${iz.plan.faze.reduce((a, f) => a + f.zeleno + iz.plan!.zuto + iz.plan!.sveCrveno, 0)} s`
              : "Uklonjen semafor"
            : iz.vrsta === "znak"
              ? iz.znak === "brzina"
                ? `Ograničenje ${iz.brzina} km/h`
                : iz.znak
              : iz.vrsta === "prelaz"
                ? iz.ukloni
                  ? "Uklonjen prelaz"
                  : "Obilježen prelaz"
                : "";
    redovi.push(red([iz.id, vrsta, sta, ul ? s.mreza.ivice[ul.ivica]!.ime : "", g.lat.toFixed(6), g.lon.toFixed(6), iz.autor, iz.datum, iz.napomena ?? ""]));
  }
  return `${redovi.join("\n")}\n`;
}
