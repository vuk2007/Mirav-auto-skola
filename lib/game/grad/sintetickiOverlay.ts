import { GRAD_KLASE_GLAVNE } from "../sim/config";
import { rng } from "../sim/geometry";
import type { Point } from "../sim/types";
import { pointAt } from "../sim/geometry";
import type { Manevar, Mreza } from "./mreza";
import {
  LICENCA_OVERLAYA,
  VERZIJA_OVERLAYA,
  sidroUlice,
  tackaOverlaya,
  type Izmjena,
  type Overlay,
  type SidroKraka,
  type SidroUlice,
  type Zona,
} from "./overlay";
import { ostarLom } from "./linije";
import type { Raskrsnice } from "./raskrsnica";

/**
 * Sintetički overlay za fuzz (faza 6, stavka 6b): nasumične, ali propisne
 * izmjene svake vrste koju editor zna — preko stvarnog grada. Bot mora i po
 * njima voziti bez ijednog prekršaja: tako se provjerava da sudija, crtež i
 * bot isto razumiju sve što čovjek može postaviti, prije nego što ga postavi.
 *
 * Nije podatak igre: pravi se u memoriji, po sjemenu, i nikad se ne piše u
 * fajl overlay-a (njega piše samo editor).
 *
 * Izmjene su realne, kao što bi ih postavio instruktor: pune razdjelne linije
 * i autobuske trake na glavnim ulicama sa poznatim trakama (ne u uskim
 * stambenim ulicama, koje razdjelnu liniju nemaju), autobuska traka samo na
 * dionici bez strelica — inače bi bila jedina traka za neki pravac, što na
 * ulici ne postoji (editor na to upozorava).
 */

export interface UdjeliSintetike {
  /** Udio raskrsnica bez semafora kojima se mijenja kontrola. */
  kontrola: number;
  /** Udio raskrsnica sa semaforom koje dobijaju plan sa strelicama. */
  semafor: number;
  /** Udio krakova sa znakom skretanja, i sa zabranom ulaska. */
  skretanje: number;
  zabranaUlaska: number;
  /** Udio dionica sa punom razdjelnom, punom pred raskrsnicom, autobuskom trakom, zatvorenih. */
  puna: number;
  punaPrije: number;
  bus: number;
  zatvorena: number;
  /** Udio ivica sa znakom ograničenja, i broj zona. */
  brzina: number;
  zona: number;
}

const PODRAZUMIJEVANO: UdjeliSintetike = {
  kontrola: 0.25,
  semafor: 0.5,
  skretanje: 0.06,
  zabranaUlaska: 0.02,
  puna: 0.05,
  punaPrije: 0.25,
  bus: 0.15,
  zatvorena: 0.01,
  brzina: 0.04,
  zona: 4,
};

export function sintetickiOverlay(
  m: Mreza,
  r: Raskrsnice,
  sjeme: number,
  ishodiste: { lat: number; lon: number },
  poluprecnik = 2500,
  udjeli: Partial<UdjeliSintetike> = {},
): Overlay {
  const u = { ...PODRAZUMIJEVANO, ...udjeli };
  const slucajno = rng(sjeme);
  const izmjene: Izmjena[] = [];
  let id = 0;
  const osnova = () => ({ id: `s${sjeme}-${++id}`, autor: "fuzz", datum: "2026-10-01T00:00:00Z" });
  const blizu = (p: Point) => Math.hypot(p.x, p.y) < poluprecnik;

  /** Sidro na ivici `d` metara od kraja `kraj`, pravac ka tom kraju (ulaz u raskrsnicu). */
  const naIvici = (i: number, kraj: 0 | 1, d: number): SidroUlice => {
    const iv = m.ivice[i]!;
    const dd = Math.min(d, iv.duzina / 2);
    const s = kraj === 1 ? iv.duzina - dd : dd;
    const p = pointAt(iv.tacke, iv.cum, s);
    const q = pointAt(iv.tacke, iv.cum, kraj === 1 ? Math.min(iv.duzina, s + 0.5) : Math.max(0, s - 0.5));
    return sidroUlice(iv.osm, p, { x: q.x - p.x, y: q.y - p.y });
  };
  const krak = (ri: number, j: number): SidroKraka => {
    const k = r.lista[ri]!.kraci[j]!;
    return { raskrsnica: tackaOverlaya(m.cvorovi[k.cvor]!), ulica: naIvici(k.ivica, k.kraj, 10) };
  };
  // Sidra se vežu za OSM puteve: ivice bez OSM id-a (ili dijeljene sa drugim
  // putem na istom mjestu) se preskaču — editor ih veže isto.
  const sidriva = (i: number) => m.ivice[i]!.osm !== 0 && m.ivice[i]!.duzina > 4;

  for (const rs of r.lista) {
    if (!blizu(rs.centar) || rs.kruzni) continue;
    const ulazi = rs.kraci.map((k, j) => ({ k, j })).filter(({ k }) => k.ulaz && sidriva(k.ivica));
    if (ulazi.length !== rs.kraci.filter((k) => k.ulaz).length || ulazi.length < 2) continue;
    if (rs.plan) {
      if (slucajno() >= u.semafor) continue;
      // Plan sa strelicama: krakovi po osama kao izvedeni; prva osa ima posebno
      // pravo+desno i zaštićeno lijevo, druga zeleno za sve i dopunsku strelicu
      // desno za prvu osu.
      const ose = new Map<number, number[]>();
      for (const f of rs.plan.faze) ose.set(ose.size, f.kraci.filter((j) => rs.kraci[j]!.ulaz));
      const prva = ose.get(0) ?? [];
      const ostale = [...ose.values()].slice(1).flat();
      if (prva.length === 0 || ostale.length === 0 || ![...prva, ...ostale].every((j) => sidriva(rs.kraci[j]!.ivica))) continue;
      izmjene.push({
        ...osnova(),
        vrsta: "semafor",
        raskrsnica: tackaOverlaya(m.cvorovi[rs.cvorovi[0]!]!),
        plan: {
          faze: [
            { zeleno: 20 + Math.round(slucajno() * 15), kraci: prva.map((j) => ({ krak: krak(rs.id, j), manevri: ["pravo", "desno"] as Manevar[] })), strelice: [], pjesaci: [] },
            { zeleno: 10, kraci: prva.map((j) => ({ krak: krak(rs.id, j), manevri: ["lijevo"] as Manevar[] })), strelice: [], pjesaci: [] },
            {
              zeleno: 20 + Math.round(slucajno() * 10),
              kraci: ostale.map((j) => ({ krak: krak(rs.id, j), manevri: null })),
              strelice: prva.map((j) => ({ krak: krak(rs.id, j), manevri: ["desno"] as Manevar[] })),
              pjesaci: [],
            },
          ],
          zuto: 3,
          sveCrveno: 2,
          pomak: Math.round(slucajno() * 60),
        },
      });
      continue;
    }
    if (slucajno() < u.kontrola) {
      // Jedan krak STOP ili trougao, ostali glavni put.
      const sporedan = Math.floor(slucajno() * ulazi.length);
      const vrsta = slucajno() < 0.5 ? "stop" : "ustupi";
      ulazi.forEach(({ j }, x) =>
        izmjene.push({ ...osnova(), vrsta: "kontrola", krak: krak(rs.id, j), kontrola: x === sporedan ? vrsta : "glavni" }),
      );
    }
    for (const { j } of ulazi) {
      const x = slucajno();
      if (x < u.skretanje / 2) {
        izmjene.push({ ...osnova(), vrsta: "skretanje", krak: krak(rs.id, j), znak: { vrsta: "zabrana", manevri: ["lijevo"] } });
      } else if (x < u.skretanje) {
        izmjene.push({ ...osnova(), vrsta: "skretanje", krak: krak(rs.id, j), znak: { vrsta: "obavezno", manevri: ["pravo", "desno"] } });
      }
    }
    for (const k of rs.kraci) {
      if (k.izlaz && k.ulaz && sidriva(k.ivica) && slucajno() < u.zabranaUlaska) {
        izmjene.push({ ...osnova(), vrsta: "zabranaUlaska", krak: { raskrsnica: tackaOverlaya(m.cvorovi[k.cvor]!), ulica: naIvici(k.ivica, k.kraj, 10) } });
      }
    }
  }

  // Dionica (kroz čvorove koji nisu raskrsnice), kao u overlay-u: za provjeru strelica.
  const krajeva = (c: number) => (m.izCvora[c] ?? []).filter((x) => m.ivice[x]!.vozna).length;
  const dionica = (i: number): number[] => {
    const sve = [i];
    for (const pocetak of [m.ivice[i]!.a, m.ivice[i]!.b]) {
      let c = pocetak;
      let od = i;
      for (;;) {
        if (krajeva(c) !== 2) break;
        const j = (m.izCvora[c] ?? []).find((x) => x !== od && m.ivice[x]!.vozna);
        if (j === undefined || sve.includes(j)) break;
        sve.push(j);
        od = j;
        c = m.ivice[j]!.a === c ? m.ivice[j]!.b : m.ivice[j]!.a;
      }
    }
    return sve;
  };
  const glavna = (klasa: string) => GRAD_KLASE_GLAVNE.includes(klasa) || klasa === "tertiary";

  // Dionice: po jedna izmjena na ivicu (ista dionica može dobiti više — važi zadnja po polju).
  for (const iv of m.ivice) {
    if (!iv.vozna || iv.kruzni || !sidriva(iv.i) || !blizu(iv.tacke[0]!)) continue;
    const sid = naIvici(iv.i, 1, iv.duzina / 2);
    // Ni na dionici sa oštrim lomom osovine (greška u OSM-u, vidi `ostarLom`).
    const saTrakama = iv.trakePoznate && glavna(iv.klasa) && !dionica(iv.i).some((j) => ostarLom(m.ivice[j]!));
    const dvosmjerna = iv.smjer === 0 && iv.trakeNaprijed > 0 && iv.trakeNazad > 0;
    const x = slucajno();
    if (saTrakama && dvosmjerna && x < u.puna) izmjene.push({ ...osnova(), vrsta: "dionica", ulica: sid, linija: "puna" });
    else if (saTrakama && x < u.puna + u.punaPrije) {
      const viseTraka = Math.max(iv.trakeNaprijed, iv.trakeNazad) >= 2;
      izmjene.push({ ...osnova(), vrsta: "dionica", ulica: sid, punaPrije: dvosmjerna ? 30 + Math.round(slucajno() * 30) : 0, trakePrije: viseTraka ? 30 : 0 });
    }
    const svoje = iv.trakeNaprijed;
    const bezStrelica = dionica(iv.i).every((j) => !m.ivice[j]!.skretanjaNaprijed && !m.ivice[j]!.skretanjaNazad);
    if (saTrakama && svoje >= 2 && bezStrelica && slucajno() < u.bus) {
      izmjene.push({ ...osnova(), vrsta: "dionica", ulica: sid, busNaprijed: true });
    }
    if (iv.klasa === "residential" && slucajno() < u.zatvorena) izmjene.push({ ...osnova(), vrsta: "dionica", ulica: sid, zatvorena: true });
    if (slucajno() < u.brzina) {
      izmjene.push({ ...osnova(), vrsta: "znak", znak: "brzina", mjesto: naIvici(iv.i, 1, iv.duzina * 0.7), brzina: slucajno() < 0.5 ? 30 : 40 });
    }
    if (slucajno() < u.brzina / 2) {
      const znak = (["krajGlavnog", "zabranaPreticanja", "djeca", "skolskaZona"] as const)[Math.floor(slucajno() * 4)]!;
      izmjene.push({ ...osnova(), vrsta: "znak", znak, mjesto: naIvici(iv.i, 1, iv.duzina * 0.5), brzina: null });
    }
  }

  for (let z = 0; z < u.zona; z++) {
    const cx = (slucajno() - 0.5) * poluprecnik;
    const cy = (slucajno() - 0.5) * poluprecnik;
    const a = 150 + slucajno() * 250;
    const zona: Zona = {
      id: `fuzz-${z}`,
      ime: `Fuzz zona ${z}`,
      poligon: [
        [cx - a, cy - a],
        [cx + a, cy - a],
        [cx + a, cy + a],
        [cx - a, cy + a],
      ],
      paleta: null,
      speedLimit: slucajno() < 0.5 ? 30 : 40,
      pedestrianDensity: null,
      trafficDensity: null,
      handAuthored: false,
    };
    izmjene.push({ ...osnova(), vrsta: "zona", zona });
  }
  return { verzija: VERZIJA_OVERLAYA, grad: "podgorica", licenca: LICENCA_OVERLAYA, ishodiste, izmjene };
}
