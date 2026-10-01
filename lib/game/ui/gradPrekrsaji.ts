import type { Dict } from "@/lib/i18n";
import type { GradskiPrekrsaj, VrstaGradskogPrekrsaja } from "../grad/sudija";

/**
 * Naslov i pravilo gradskog prekršaja (faza 6, stavka 5d) — jedno pravilo po
 * prekršaju, sa brojevima iz vožnje. Stoji odvojeno od ekrana da bi i
 * izvještaj (stavka 9) zvao iste nazive.
 */

const NASLOV: Readonly<Record<VrstaGradskogPrekrsaja, keyof Dict>> = {
  redLight: "vioRedLight",
  stopSign: "vioStopSign",
  wrongWay: "vioWrongWay",
  zabranaSkretanja: "vioTurnBan",
  polukruzno: "vioUTurn",
  speeding: "vioSpeeding",
  wrongSide: "vioWrongSide",
  parkingViolation: "vioStopping",
  indicatorMissing: "vioIndicatorMissing",
  indicatorWrong: "vioIndicatorWrong",
  indicatorLate: "vioIndicatorLate",
  indicatorLeftOn: "vioIndicatorLeftOn",
  wrongLaneForTurn: "vioWrongLane",
  laneDisciplineRoundabout: "vioRoundaboutLane",
};

export function naslovPrekrsaja(p: GradskiPrekrsaj, t: Dict): string {
  return t[NASLOV[p.vrsta]] as string;
}

export function praviloPrekrsaja(p: GradskiPrekrsaj, t: Dict): string {
  const d = p.detalji;
  switch (p.vrsta) {
    case "redLight":
      return d.svjetlo === "zuto" ? t.gradRuleAmber : t.gradRuleRed;
    case "stopSign":
      return t.gradRuleStop;
    case "wrongWay":
      return t.gradRuleWrongWay;
    case "zabranaSkretanja":
      return t.gradRuleTurnBan;
    case "polukruzno":
      return d.gdje === "most" ? t.gradRuleUTurnBridge : d.gdje === "tunel" ? t.gradRuleUTurnTunnel : t.gradRuleUTurnSignal;
    case "speeding":
      return t.gradRuleSpeeding.replace("{ogranicenje}", String(d.ogranicenje)).replace("{brzina}", String(d.brzina));
    case "wrongSide":
      return t.gradRuleWrongSide;
    case "parkingViolation":
      return d.gdje === "zebra" ? t.gradRuleStopZebra : d.gdje === "stajaliste" ? t.gradRuleStopBus : t.gradRuleStopJunction;
    case "indicatorMissing":
      return d.kruzni ? t.gradRuleIndicatorRoundabout : t.gradRuleIndicatorMissing;
    case "indicatorWrong":
      return d.manevar === "pravo" ? t.gradRuleIndicatorStraight : t.gradRuleIndicatorWrong;
    case "indicatorLate":
      return t.gradRuleIndicatorLate;
    case "indicatorLeftOn":
      return t.gradRuleIndicatorLeftOn;
    case "wrongLaneForTurn":
      return t.gradRuleWrongLane;
    case "laneDisciplineRoundabout":
      return d.traka === "unutra" ? t.gradRuleRoundaboutOuter : t.gradRuleRoundaboutInner;
  }
}
