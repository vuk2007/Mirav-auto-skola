import { CAR_LENGTH, CAR_WIDTH, DT, GRAD_SUDAR_PONOVO, type Level } from "../sim/config";
import { polygonsOverlap, rectCorners } from "../sim/geometry";
import { korakBota, noviBot, type IshodVoznje, type Korak, type PlanBota } from "./botGrad";
import type { Manevar } from "./mreza";
import { dodajVanjsko, korakSaobracaja, noviSaobracaj, oduzetoPrvenstvo, parkirani, postaviVanjsko, tijeloNpc, IGRAC } from "./saobracaj";
import { korakPjesaka, noviPjesaci, udaraPjesaka } from "./pjesaci";
import { korakSlobodno, type SlobodnoVozilo } from "./slobodno";
import { noviSudija, sudi } from "./sudija";
import type { SvijetGrada } from "./svijet";
import { naPutanji } from "./vozacGrad";

/**
 * Savršeni bot među drugim vozačima (stavka 7d): vozi rutu pod sudijom kao
 * igrač, a oko njega je gradski saobraćaj.
 *
 * Bot je u saobraćaju „vanjsko vozilo" (`dodajVanjsko`): drugi ga vide po
 * njegovom planu i ustupaju mu ili ne, kao svakome; saobraćaj za njega donosi
 * odluku po istim pravilima (vozilo ispred, ustupanje, zatvoren izlaz), a bot
 * je poštuje kao gornju granicu brzine. Sudi mu se sve što i igraču: i sudar
 * sa drugim vozilom, i oduzeto prvenstvo (neko je zbog njega naglo kočio).
 *
 * Oko njega su i pješaci (stavka 8, najviše — 60): ustupa im kao i drugi
 * vozači (odluka saobraćaja), sudi mu se prednost pješaka, a udar pješaka je
 * kraj vožnje.
 */
export interface IshodUSaobracaju extends IshodVoznje {
  /** Zastoji u kojima je bot učestvovao. */
  zastojaBota: number;
  /** Svi zastoji drugih vozila za to vrijeme (mjeri ih i fuzz saobraćaja). */
  zastoja: number;
  sudara: number;
  /** Udarenih pješaka (vožnja se tu prekida). */
  pjesaka: number;
}

export function odveziRutuUSaobracaju(
  svijet: SvijetGrada,
  plan: PlanBota,
  koraci: Korak[],
  t0: number,
  nivo: Level,
  sjeme: number,
  gustina = 1,
  najvise = 1800,
): IshodUSaobracaju {
  const { povrsina, zaSudiju: g } = svijet;
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
  const sb = noviSaobracaj(svijet, sjeme, gustina);
  // Najveća gustina (40 vozila) — bot se provjerava u punom gradu.
  sb.gustinaVanZona = 3;
  sb.t = t0;
  const senka = dodajVanjsko(sb, plan, koraci);
  // Pješaci: najviše (gustina 3), na istom satu kao saobraćaj.
  const pjesaci = noviPjesaci(svijet, sjeme, 1);
  pjesaci.gustinaVanZona = 3;
  pjesaci.t = t0;
  sb.pjesaci = pjesaci;

  // Oduzeto prvenstvo, kao u igri: na kraju prolaza kroz raskrsnicu.
  let ulazak: { r: number; t: number } | null = null;
  let trakaPrstena: "unutra" | "spolja" | null = null;
  sudija.naUlazu = (r) => {
    ulazak = { r, t: sb.t };
  };
  sudija.dnevnik = (p) => {
    const k = oduzetoPrvenstvo(sb, {
      r: p.r,
      ulaz: p.ulaz,
      izlaz: p.izlaz,
      manevar: p.manevar as Manevar,
      od: ulazak?.r === p.r ? ulazak.t - 3 : p.t - 10,
      do_: p.t,
      izUnutrasnje: trakaPrstena === "unutra",
      ulazak: ulazak?.r === p.r ? ulazak.t : undefined,
    });
    if (k) sudija.prekrsaji.push({ vrsta: "rightOfWay", ozbiljnost: "fail", t: p.t, x: st.x, y: st.y, detalji: { vozilo: k.id } });
    sb.kocenja = sb.kocenja.filter((x) => x.t > p.t - 30);
  };

  let udara = 0;
  let sudara = 0;
  let pjesaka = 0;
  const sudari = new Map<number, number>();
  let prviUdar: IshodVoznje["prviUdar"] = null;
  while (!bot.gotov && sb.t - t0 < najvise) {
    // Bot u saobraćaju: gdje je pravi auto, pa odluka saobraćaja za njega.
    postaviVanjsko(senka, naPutanji(plan.put, st.x, st.y, senka.s), st.x, st.y, st.ugao, st.v);
    if (sudija.prsten) trakaPrstena = sudija.prsten.uzorci.at(-1)?.traka ?? null;
    // Saobraćaj odlučuje u trenutku `t` (semafori kao i za bota) i pomjeri
    // svoj sat na `t + DT`; sudija sudi poslije pomaka, kao u `odveziRutu`.
    const t = sb.t;
    korakSaobracaja(sb, { x: st.x, y: st.y }, null);
    const ulaz = korakBota(bot, g, st, t, senka.odlukaV ?? Infinity);
    korakSlobodno(povrsina, st, ulaz);
    korakPjesaka(
      pjesaci,
      { x: st.x, y: st.y },
      sb.npc.map(tijeloNpc),
    );
    // Udar pješaka: kraj vožnje (zadatak, odjeljak 6).
    const tijelo = { x: st.x, y: st.y, ugao: st.ugao, duzina: CAR_LENGTH, sirina: CAR_WIDTH };
    const udaren = pjesaci.lista.find((x) => Math.abs(x.x - st.x) < CAR_LENGTH && Math.abs(x.y - st.y) < CAR_LENGTH && udaraPjesaka(tijelo, x));
    if (udaren) {
      pjesaka += 1;
      sudija.prekrsaji.push({ vrsta: "pedestrianCollision", ozbiljnost: "fail", t, x: st.x, y: st.y, detalji: { pjesak: udaren.id } });
      break;
    }
    if (st.udar) {
      udara += 1;
      prviUdar ??= { s: bot.s, x: st.x, y: st.y, ugao: st.ugao };
    }
    // Sudar sa drugim vozilom — kao u igri.
    const ja = rectCorners({ x: st.x, y: st.y }, { x: Math.cos(st.ugao), y: Math.sin(st.ugao) }, CAR_LENGTH, CAR_WIDTH);
    for (const n of [...sb.npc.map(tijeloNpc), ...parkirani(sb)]) {
      if (n.id === IGRAC || n.nivo !== senka.nivo || Math.hypot(n.x - st.x, n.y - st.y) > (CAR_LENGTH + n.duzina) / 2 + 0.5) continue;
      if (!polygonsOverlap(ja, rectCorners({ x: n.x, y: n.y }, { x: Math.cos(n.ugao), y: Math.sin(n.ugao) }, n.duzina, n.sirina))) continue;
      if (t - (sudari.get(n.id) ?? -Infinity) > GRAD_SUDAR_PONOVO) {
        sudara += 1;
        sudija.prekrsaji.push({ vrsta: "collision", ozbiljnost: "fail", t, x: st.x, y: st.y, detalji: { vozilo: n.id } });
      }
      sudari.set(n.id, t);
    }
    // Zaustavio ga je saobraćaj (kolona, ustupanje, zatvoren izlaz) — nije
    // parkiranje (odluka korisnika 2026-09-30).
    const r = senka.razlog.vrsta;
    sudi(g, sudija, st, t + DT, ulaz.indicator, r === "vozilo" || r === "ustupa" || r === "izlaz" || r === "pjesak", pjesaci);
  }
  return {
    stigao: bot.gotov,
    trajanje: sb.t - t0,
    predjeno: st.predjeno,
    prekrsaji: sudija.prekrsaji,
    udara,
    prviUdar,
    izvlacenja: bot.izvlacenja,
    zastojaBota: sb.zastoji.filter((z) => z.ucesnici.includes(IGRAC)).length,
    zastoja: sb.zastoji.length,
    sudara,
    pjesaka,
  };
}
