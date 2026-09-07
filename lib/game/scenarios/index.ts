/**
 * Scenariji igre.
 *
 * Redoslijed je i redoslijed učenja: prvo pravilo desne strane (jednom kad
 * ustupaš, jednom kad imaš prednost — drugo je važno da polaznik ne nauči da
 * je „uvijek čekaj" ispravno), pa znaci, pa glavni put, pa teže situacije.
 *
 * Svaki scenario mora proći test sa savršenim botom — vidi `lib/game/sim/bots.ts`.
 */

import desnaImasPrednost from "./desna-imas-prednost.json";
import desnaUstupi from "./desna-ustupi.json";
import glavniPut from "./glavni-put.json";
import izlomljeniGlavni from "./izlomljeni-glavni.json";
import ljevak from "./ljevak.json";
import semafor from "./semafor.json";
import semaforLjevak from "./semafor-ljevak.json";
import semaforZuto from "./semafor-zuto.json";
import pjesaci from "./pjesaci.json";
import policajacPropusta from "./policajac-propusta.json";
import policajacZaustavlja from "./policajac-zaustavlja.json";
import hitna from "./hitna.json";
import kruzniIzlaz2 from "./kruzni-izlaz2.json";
import kruzniGust from "./kruzni-gust.json";
import kruzniPolukruzno from "./kruzni-polukruzno.json";
import kruzniStop from "./kruzni-stop.json";
import stop from "./stop.json";
import trougao from "./trougao.json";
import type { Scenario } from "../sim/types";

export const SCENARIOS: readonly Scenario[] = [
  desnaUstupi,
  desnaImasPrednost,
  trougao,
  stop,
  glavniPut,
  izlomljeniGlavni,
  semafor,
  ljevak,
  semaforLjevak,
  semaforZuto,
  pjesaci,
  hitna,
  policajacPropusta,
  policajacZaustavlja,
  kruzniIzlaz2,
  kruzniStop,
  kruzniGust,
  kruzniPolukruzno,
  // JSON ne nosi literalne tipove (npr. `spawnAt` je `number[]`, a treba
  // `[number, number]`), pa se oblik provjerava testom umjesto kompajlerom.
] as unknown as Scenario[];

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

/**
 * Scenariji u kojima igrač NEMA prednost — u njima bot koji samo gasi mora
 * napraviti prekršaj. Popisani su ručno jer je to tvrdnja o pravilima, a ne
 * nešto što se izvodi iz podataka; test bi inače provjeravao sam sebe.
 */
export const PLAYER_MUST_YIELD: readonly string[] = [
  "desna-ustupi",
  "trougao",
  "stop",
  "izlomljeni-glavni",
  "semafor",
  "ljevak",
  "semafor-ljevak",
  // Ovdje je prekršaj `redLight`, ne oduzeto prvenstvo — spisak pokriva oba,
  // vidi test „bot koji samo gasi".
  "semafor-zuto",
  // Pješak na prelazu i naredba policajca su takođe „nemaš pravo proći".
  "pjesaci",
  "hitna",
  "policajac-zaustavlja",
  // U kružnom toku igrač ustupa vozilima koja su već u prstenu.
  "kruzni-izlaz2",
  "kruzni-gust",
  "kruzni-stop",
];
