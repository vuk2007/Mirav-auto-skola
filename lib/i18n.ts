/**
 * UI stringovi (chrome) na crnogorskom, engleskom, albanskom, ruskom i turskom.
 *
 * VAŽNO: ovdje se prevodi samo interfejs. Sadržaj pitanja se prevodi odvojeno —
 * poljima `text_en` / `options_en` / `text_ru` / `options_ru` (i `_sq`, `_tr`) u questions.json,
 * koja popunjava `scripts/translate.mjs`. Vidi `localizedText` u lib/questions.ts.
 * Dok tih polja nema, pitanje se prikazuje na crnogorskom uz napomenu
 * `translationMissing`.
 */

export type Lang = "me" | "en" | "sq" | "ru" | "tr";

export const LANGS: readonly Lang[] = ["me", "en", "sq", "ru", "tr"] as const;

export const DEFAULT_LANG: Lang = "me";

/**
 * Oznaka na prebacivaču. Albanski je po ISO 639-1 `sq`, ali se u Crnoj Gori
 * prepoznatljivije označava sa „AL" — otud kod jedno, a prikaz drugo.
 */
export const LANG_LABELS: Record<Lang, string> = { me: "ME", en: "EN", sq: "AL", ru: "RU", tr: "TR" };

export interface Dict {
  // Zaglavlje / opšte
  back: string;
  close: string;
  literature: string;
  langLabel: string;
  /** Izgled sajta: naslov u meniju i natpisi prekidača teme (lib/tema.ts). */
  temaLabel: string;
  temaSvijetla: string;
  temaTamna: string;
  /** Prijava greške (components/PrijavaGreske.tsx, lib/prijava.ts). */
  prijavaDugme: string;
  prijavaVrsta: string;
  prijavaVrstaOdgovor: string;
  prijavaVrstaTekst: string;
  prijavaVrstaSlika: string;
  prijavaVrstaSajt: string;
  prijavaVrstaDrugo: string;
  prijavaOpis: string;
  prijavaOpisPomoc: string;
  prijavaKontakt: string;
  prijavaKontaktPomoc: string;
  prijavaPosalji: string;
  prijavaSalje: string;
  prijavaHvala: string;
  prijavaGreska: string;
  prijavaPrevise: string;
  prijavaKratko: string;
  prijavaIspitVrijeme: string;
  igraPodesavanja: string;
  igraZatvoriPodesavanja: string;
  footerNote: string;

  // Landing
  landingTitle: string;
  landingLead: string;
  /** Hero početne: oznaka u dva reda, dvobojni naslov, uvod, četiri riječi (razdvojene „ · "). */
  heroLabel1: string;
  heroLabel2: string;
  heroTitle1: string;
  heroTitle2: string;
  heroLead: string;
  practiceMeta: string;
  menuLabel: string;
  practiceTitle: string;
  practiceDesc: string;
  practiceStart: string;
  practiceResume: string;
  categoryLabel: string;
  examTitle: string;
  examDesc: string;
  examStart: string;
  metaPoints: string;
  metaQuestions: string;
  metaMinutes: string;
  metaPass: string;
  examLimitationNote: string;
  bestResult: string;

  // Simulator raskrsnica
  simTitle: string;
  simDesc: string;
  simStart: string;
  simMeta: string;
  simTask: string;
  simNotAllPass: string;
  simYourOrder: string;
  simCorrectOrder: string;
  simClear: string;
  simNextScene: string;
  simScene: string;
  simVehicle: string;
  simStreak: string;
  simFinished: string;
  simRestart: string;
  simEmpty: string;
  simFamilyRule: string;
  simFamilyCatalog: string;
  simFamilySigns: string;
  simFamilyLights: string;
  simFamilyLeft: string;
  simFamilyRoundabout: string;
  simFamilyPedestrian: string;
  simUncontrolled: string;
  simSceneSigns: string;
  simSceneLights: string;
  simSceneRoundabout: string;
  simScenePedestrian: string;
  simTapInScene: string;
  simDecisionTask: string;
  simGo: string;
  simYield: string;
  simYourVehicle: string;
  ruleTitle: string;
  ruleRightHand: string;
  ruleFreeRight: string;
  rulePriorityRoad: string;
  ruleYieldSign: string;
  ruleStopSign: string;
  ruleLeftTurn: string;
  ruleGreenNotFree: string;
  ruleRedStops: string;
  ruleRoundabout: string;
  ruleRoundaboutLeft: string;
  ruleRoundaboutExit: string;
  rulePedestrian: string;

  // Igra „Prođi raskrsnicu" (vidi lib/game/)
  gameTitle: string;
  gameLead: string;
  gameDesc: string;
  gameMeta: string;
  gameOpen: string;
  gameStart: string;
  gameRetry: string;
  gameSpeed: string;
  gameSpeedLimit: string;
  gameTime: string;
  gameQuality: string;
  gamePickLead: string;
  gameDifficulty: string;
  gameStatusPassed: string;
  gameStatusFailed: string;
  gameStatusNew: string;
  gameBestTime: string;
  gameAttempts: string;
  gameProgress: string;
  gameReplay: string;
  gameReplaying: string;
  gameBack: string;
  gameNextScenario: string;
  gameRuleTitle: string;
  gameLightRed: string;
  gameLightYellow: string;
  gameLightGreen: string;
  vioPedestrian: string;
  vioOfficer: string;
  gameSignOfficer: string;
  gameOfficerGo: string;
  gameOfficerStop: string;
  ruleOfficer: string;
  ruleEmergency: string;
  vioIndicatorMissing: string;
  vioIndicatorWrong: string;
  vioIndicatorLate: string;
  vioIndicatorLeftOn: string;
  vioUnsafeMerge: string;
  vioStoppedOnRamp: string;
  vioTooSlow: string;
  vioTailgating: string;
  vioBrakingOnHighway: string;
  vioHardShoulder: string;
  vioOffRoad: string;
  vioCrossingSolidLine: string;
  vioUnsafeOvertake: string;
  vioOvertakeNoVisibility: string;
  vioOvertakeTooLong: string;
  vioCutIn: string;
  gameSteer: string;
  ruleHardShoulder: string;
  ruleMerge: string;
  ruleHighwaySpeed: string;
  ruleFollowing: string;
  gameLaneLeft: string;
  gameLaneRight: string;
  gameKeyHintLane: string;
  gameTaskMerge: string;
  gameTaskOvertake: string;
  gameTaskExitHighway: string;
  gameTaskFollow: string;
  ruleIndicator: string;
  ruleIndicatorOff: string;
  gameIndicator: string;
  gameIndicatorLeft: string;
  gameIndicatorRight: string;
  gameIndicatorShortLeft: string;
  gameIndicatorShortRight: string;
  gameIndicatorMode: string;
  gameIndicatorAuto: string;
  gameIndicatorManual: string;
  gameIndicatorAutoShort: string;
  gameIndicatorAutoHint: string;
  gameIndicatorManualHint: string;
  gameTrafficLevel: string;
  gameTrafficHint: string;
  gameMinor: string;
  gameHazardTitle: string;
  gameHazardYielded: string;
  gameHazardCollision: string;
  gameReaction: string;
  tripTitle: string;
  tripDesc: string;
  tripStart: string;
  tripResume: string;
  tripNew: string;
  tripBack: string;
  tripPickStart: string;
  tripWhereTo: string;
  tripGo: string;
  tripTurnAround: string;
  tripBorderTitle: string;
  tripBorderDesc: string;
  tripDeadEndTitle: string;
  tripDeadEndDesc: string;
  tripArrived: string;
  tripSeenHere: string;
  tripNothingSeen: string;
  tripContinue: string;
  tripKm: string;
  tripLegs: string;
  tripTowns: string;
  tripCollected: string;
  tripSummer: string;
  tripSummerHint: string;
  tripTagSeasonal: string;
  tripTagFerry: string;
  tripTagUnverified: string;
  tripCrash: string;
  tripNoted: string;
  tripCity: string;
  tripMap: string;
  tripMapHide: string;
  rutaTitle: string;
  rutaDesc: string;
  rutaStart: string;
  gradTitle: string;
  gradDesc: string;
  gradStart: string;
  gradLoading: string;
  gradFailed: string;
  gradNoWebgl: string;
  gradStreet: string;
  gradUnnamed: string;
  gradHint: string;
  gradZoomIn: string;
  gradZoomOut: string;
  gradReverse: string;
  gradTimeOfDay: string;
  /** Prečica sata „jutro" (stavka 8d). */
  gradMorning: string;
  /** Sat igre u HUD-u (za čitač ekrana). */
  gradClock: string;
  gradDay: string;
  gradDusk: string;
  gradNight: string;
  gradWeather: string;
  gradSun: string;
  gradRain: string;
  gradRainNote: string;
  gradLevel: string;
  gradViolations: string;
  gradNavDestination: string;
  gradNavChoose: string;
  gradNavSearch: string;
  gradNavRandom: string;
  gradNavClear: string;
  gradNavClose: string;
  gradNavIn: string;
  gradNavTurnLeft: string;
  gradNavTurnRight: string;
  gradNavUTurn: string;
  gradNavRoundabout: string;
  gradNavStraight: string;
  gradNavOnto: string;
  gradNavArrived: string;
  gradNavRemaining: string;
  gradNavRerouting: string;
  gradNavNoRoute: string;
  gradKatSkola: string;
  gradKatZdravlje: string;
  gradKatUstanova: string;
  gradKatKultura: string;
  gradKatBogomolja: string;
  gradKatStanica: string;
  gradKatSport: string;
  gradKatTrgovina: string;
  gradKatZnamenitost: string;
  gradStatClean: string;
  gradStatToday: string;
  gradMiniMap: string;
  gradOsmAttribution: string;
  gradOdDo: string;
  gradOdDoIntro: string;
  gradOdDoEasy: string;
  gradOdDoMedium: string;
  gradOdDoHard: string;
  gradOdDoRange: string;
  gradOdDoRandom: string;
  gradOdDoPick: string;
  gradOdDoCancel: string;
  gradOdDoTimer: string;
  gradOdDoDone: string;
  gradOdDoScore: string;
  gradOdDoRules: string;
  gradOdDoTime: string;
  gradOdDoViolations: string;
  gradOdDoStars: string;
  gradOdDoBest: string;
  gradOdDoNewBest: string;
  gradOdDoAgain: string;
  gradOdDoNoTarget: string;
  gradExam: string;
  gradExamIntro: string;
  gradExamRouteInfo: string;
  gradExamHud: string;
  gradExamCancel: string;
  gradExamPoint: string;
  gradExamPassed: string;
  gradExamFailed: string;
  gradExamSummary: string;
  gradExamRule: string;
  gradExamRecord: string;
  gradExamMinor: string;
  gradExamSerious: string;
  gradExamAgain: string;
  gradExamCatJunctions: string;
  gradExamCatSpeed: string;
  gradExamCatSigns: string;
  gradExamCatPedestrians: string;
  gradExamCatLane: string;
  gradExamCatManoeuvres: string;
  vioWrongWay: string;
  vioTurnBan: string;
  vioUTurn: string;
  vioWrongSide: string;
  vioStopping: string;
  gradRuleRed: string;
  gradRuleAmber: string;
  gradRuleStop: string;
  gradRuleCollision: string;
  gradRuleRightOfWay: string;
  gradRulePedestrianCrossing: string;
  gradRulePedestrianIntent: string;
  gradRuleRedLightPedestrian: string;
  gradRulePedestrianCollision: string;
  gradRuleBusDeparture: string;
  gradRuleEmergencyVehicle: string;
  gradHitTitle: string;
  gradHitText: string;
  gradHitAgain: string;
  gradRuleWrongWay: string;
  gradRuleTurnBan: string;
  gradRuleUTurnSignal: string;
  gradRuleUTurnBridge: string;
  gradRuleUTurnTunnel: string;
  gradRuleSpeeding: string;
  gradRuleWrongSide: string;
  gradRuleStopZebra: string;
  gradRuleStopJunction: string;
  gradRuleStopBus: string;
  vioWrongLane: string;
  vioRoundaboutLane: string;
  gradRuleIndicatorMissing: string;
  gradRuleIndicatorWrong: string;
  gradRuleIndicatorLate: string;
  gradRuleIndicatorStraight: string;
  gradRuleIndicatorLeftOn: string;
  gradRuleIndicatorRoundabout: string;
  gradRuleWrongLane: string;
  gradRuleRoundaboutOuter: string;
  gradRuleRoundaboutInner: string;
  vioBusLane: string;
  gradRuleSolidLine: string;
  gradRuleBusLane: string;
  gradRuleNoEntry: string;
  gradRuleMandatory: string;
  gradRuleRedManeuver: string;
  gradManeuverLeft: string;
  gradManeuverStraight: string;
  gradManeuverRight: string;
  gradManeuverUTurn: string;
  rutaFrom: string;
  rutaTo: string;
  rutaPrepare: string;
  rutaGo: string;
  rutaLegs: string;
  rutaLeft: string;
  rutaSurroundings: string;
  rutaMap: string;
  osmKratko: string;
  osmPuno: string;
  oIgriTitle: string;
  oIgriDesc: string;
  rutaDone: string;
  rutaCrash: string;
  rutaNoRoute: string;
  rutaFailed: string;
  tripCrashJunction: string;
  tripRetry: string;
  tripRoadAutoput: string;
  tripRoadMagistrala: string;
  tripRoadRegionalni: string;
  tripRoadPlaninski: string;
  shiftTitle: string;
  shiftDesc: string;
  shiftStart: string;
  shiftLives: string;
  shiftLevel: string;
  shiftSegments: string;
  shiftStreak: string;
  shiftOver: string;
  shiftBest: string;
  shiftAgain: string;
  shiftSkip: string;
  shiftLostLife: string;
  shiftNoReaction: string;
  shiftBack: string;
  gameSoundOn: string;
  gameSoundOff: string;
  gameTimelineTitle: string;
  gameTimelineExpected: string;
  gameTimelineActual: string;
  gameTimelineOff: string;
  gameKeyHintIndicator: string;
  ruleObstruction: string;
  ruleSpeeding: string;
  gameThrottle: string;
  gameBrake: string;
  gameKeyHint: string;
  gamePassed: string;
  gameFailed: string;
  gameViolationsTitle: string;
  gameHowTo: string;
  gameTaskStraight: string;
  gameTaskLeft: string;
  gameTaskRight: string;
  gameTaskExit: string;
  gameTaskFullCircle: string;
  gameSignPriority: string;
  gameSignYield: string;
  gameSignStop: string;
  gameSignNone: string;
  vioRightOfWay: string;
  vioStopSign: string;
  vioRedLight: string;
  vioCollision: string;
  vioPedestrianRightOfWay: string;
  vioRedLightPedestrian: string;
  vioPedestrianCollision: string;
  vioBusDeparture: string;
  vioEmergencyVehicle: string;
  vioObstruction: string;
  vioSpeeding: string;

  // Kviz
  loading: string;
  loadErrorTitle: string;
  noQuestions: string;
  question: string;
  progress: string;
  next: string;
  newRound: string;
  finishExam: string;
  /** Simulacija ispita ide po stranicama, kao pravi test. */
  pageLabel: string;
  prevPage: string;
  nextPage: string;
  check: string;
  correctAnswerLabel: string;
  yourAnswerLabel: string;
  correctFeedback: string;
  wrongFeedback: string;
  remaining: string;
  answeredLabel: string;
  correctLabel: string;
  inPool: string;
  explanationTitle: string;
  questionsOnlyInMe: string;
  /** Prikazuje se kad pitanje nema prevod na izabrani jezik. */
  translationMissing: string;

  // Uputstvo prije ispita (vidi lib/examBriefing.ts)
  briefingTitle: string;
  briefingLead: string;
  briefingConfirm: string;
  briefingStart: string;
  briefingDisclaimer: string;

  // Kazne (vidi lib/penalties.ts)
  penaltyTitle: string;
  penaltyTotal: string;
  penaltyNote: string;
  penaltyLanguageNote: string;
  penaltyListTitle: string;
  penaltyListLead: string;
  penaltyListSearch: string;
  penaltyListEmpty: string;
  penaltyListChecked: string;

  // Navigacija po pitanjima
  navTitle: string;
  navAnswered: string;
  navUnanswered: string;
  navJump: string;
  confirmLeaveExam: string;

  // Ordering
  orderingLabel: string;
  orderingHint: string;
  orderingEntered: string;
  orderingCorrectIs: string;

  // Oznake kategorija
  badgeSign: string;
  badgePolice: string;
  badgeMarking: string;
  badgeTrafficLight: string;
  badgeIntersection: string;
  badgeOrdering: string;
  badgeFirstAid: string;
  badgeText: string;

  // Rezultat
  resultTitle: string;
  passed: string;
  failed: string;
  /** Šablon: {n} = bodovi potrebni za prolaz, {max} = ukupno bodova. */
  passThreshold: string;
  timedOutNote: string;
  statCorrect: string;
  statWrong: string;
  statUnanswered: string;
  resultSummaryTitle: string;
  statAnswered: string;
  newExam: string;
  backToStart: string;
  reviewTitle: string;
  reviewLead: string;
  reviewPerfect: string;
  reviewNoAnswer: string;
  reviewWrong: string;

  // Literatura
  litTitle: string;
  litLead: string;

  // Kategorije
  catAll: string;
  catText: string;
  catImage: string;
  catSign: string;
  catIntersection: string;
  catOrdering: string;
  catFirstAid: string;
}

const me: Dict = {
  back: "Nazad",
  close: "Zatvori",
  literature: "Literatura",
  langLabel: "Jezik",
  temaLabel: "Izgled",
  temaSvijetla: "Svijetli režim",
  temaTamna: "Tamni režim",
  prijavaDugme: "Prijavi grešku",
  prijavaVrsta: "Vrsta greške",
  prijavaVrstaOdgovor: "Netačan odgovor",
  prijavaVrstaTekst: "Greška u tekstu ili prevodu",
  prijavaVrstaSlika: "Problem sa slikom",
  prijavaVrstaSajt: "Sajt ne radi kako treba",
  prijavaVrstaDrugo: "Nešto drugo",
  prijavaOpis: "Opis",
  prijavaOpisPomoc: "Šta nije u redu?",
  prijavaKontakt: "Email ili telefon (nije obavezno)",
  prijavaKontaktPomoc: "Samo ako želite da vam se javimo.",
  prijavaPosalji: "Pošalji prijavu",
  prijavaSalje: "Šaljem…",
  prijavaHvala: "Hvala! Prijava je poslata.",
  prijavaGreska: "Slanje nije uspjelo. Pokušajte ponovo.",
  prijavaPrevise: "Poslato je previše prijava. Pokušajte ponovo kasnije.",
  prijavaKratko: "Ukratko opišite grešku.",
  prijavaIspitVrijeme: "Vrijeme ispita teče dok pišete prijavu.",
  igraPodesavanja: "Podešavanja",
  igraZatvoriPodesavanja: "Zatvori podešavanja",
  footerNote:
    "Baza pitanja služi isključivo za pripremu i vježbu. Zvanični ispit sprovodi nadležni organ.",

  landingTitle: "Pripremite se za teorijski ispit",
  landingLead:
    "Izaberite način rada. Vježbajte bez pritiska uz odmah prikazan tačan odgovor, ili provjerite znanje pod uslovima pravog ispita.",
  heroLabel1: "Teorijski test",
  heroLabel2: "B kategorija",
  heroTitle1: "Auto škola Mirav",
  heroTitle2: "Spremni za ispit.",
  heroLead: "Pitanja za B kategoriju na pet jezika. Vježbajte bez pritiska, pa provjerite znanje pod uslovima pravog ispita.",
  practiceMeta: "Bez tajmera · tačan odgovor odmah",
  menuLabel: "Meni",
  practiceTitle: "Vježba",
  practiceDesc:
    "Birate kategoriju pitanja, odgovor se odmah provjerava i prikazuje tačno rješenje. Bez tajmera i bez ograničenja.",
  practiceStart: "Počni vježbu",
  practiceResume: "Nastavi gdje si stao",
  categoryLabel: "Kategorija",
  examTitle: "Simulacija ispita",
  examDesc:
    "Nasumična pitanja iz cijele baze, bez prikaza tačnog odgovora dok ispit traje. Na kraju dobijate bodove i ocjenu prolaza.",
  examStart: "Počni ispit",
  metaPoints: "bodova",
  metaQuestions: "pitanja",
  metaMinutes: "minuta",
  metaPass: "prag",
  examLimitationNote:
    "Napomena: naša baza sadrži samo pitanja sa jednim tačnim odgovorom.",
  bestResult: "Najbolji rezultat",

  simTitle: "Simulator raskrsnica",
  simDesc:
    "Situacije iz kataloga: tapnite vozila redom kojim prolaze. Vježba prvenstva prolaza bez kucanja brojeva.",
  simStart: "Počni simulator",
  simMeta: "prvenstvo prolaza",
  simTask: "Tapnite vozila redom kojim prolaze.",
  simNotAllPass: "Ne prolaze nužno sva vozila — tapnite samo ona koja imaju pravo prolaza.",
  simYourOrder: "Vaš redoslijed",
  simCorrectOrder: "Tačan redoslijed",
  simClear: "Poništi",
  simNextScene: "Sljedeća situacija",
  simScene: "Situacija",
  simVehicle: "Vozilo",
  simStreak: "Niz",
  simFinished: "Prošli ste sve situacije.",
  simRestart: "Počni ispočetka",
  simEmpty: "Nema dostupnih situacija.",
  simFamilyRule: "Pravilo desne strane",
  simFamilyCatalog: "Iz kataloga",
  simFamilySigns: "Glavni i sporedni put",
  simFamilyLights: "Semafor",
  simFamilyLeft: "Skretanje ulijevo",
  simFamilyRoundabout: "Kružni tok",
  simFamilyPedestrian: "Pješaci",
  simUncontrolled: "Raskrsnica bez znakova i semafora. Sva vozila zadržavaju pravac.",
  simSceneSigns: "Obratite pažnju na znakove na prilazima.",
  simSceneLights: "Obratite pažnju na svjetlosne znakove.",
  simSceneRoundabout: "Kružni tok. Vaše vozilo je označeno.",
  simScenePedestrian: "Pješak je na prelazu. Vaše vozilo je označeno.",
  simTapInScene: "Tapnite vozila na slici redom kojim prolaze.",
  simDecisionTask: "Da li prolazite ili propuštate?",
  simGo: "Prolazim",
  simYield: "Propuštam",
  simYourVehicle: "vaše vozilo",
  ruleTitle: "Pravilo",
  ruleRightHand:
    "Na raskrsnici bez znakova i semafora prvenstvo ima vozilo koje vam dolazi s desne strane.",
  ruleFreeRight: "Prvo prolazi vozilo koje nikoga nema sa svoje desne strane.",
  rulePriorityRoad:
    "Vozila na putu s prvenstvom prolaze prije vozila sa sporednog puta, bez obzira na to sa koje strane dolaze.",
  ruleYieldSign:
    "Znak „ustupi prvenstvo prolaza“ znači da propuštate vozila na glavnom putu.",
  ruleStopSign:
    "Znak STOP obavezuje na potpuno zaustavljanje; po prvenstvu je isti kao „ustupi prvenstvo“.",
  ruleLeftTurn:
    "Vozilo koje skreće ulijevo propušta susretno vozilo koje ide pravo ili skreće desno.",
  ruleGreenNotFree:
    "Zeleno svjetlo nije bezuslovno: među vozilima na zelenom i dalje važi propuštanje pri skretanju.",
  ruleRedStops: "Vozilo na crvenom ili žutom svjetlu se zaustavlja i ne prolazi.",
  ruleRoundabout:
    "Pri ulasku u kružni tok propuštate vozila koja se već kreću kroz tok.",
  ruleRoundaboutLeft:
    "U kružnom toku se kreće suprotno od kazaljke na satu, pa vozila u prstenu dolaze s vaše lijeve strane.",
  ruleRoundaboutExit:
    "Vozilo koje izlazi iz kružnog toka prije vašeg ulaza ne prelazi vam put — njega ne morate propustiti.",
  rulePedestrian:
    "Pješaka na pješačkom prelazu preko kojeg prolazite morate propustiti.",

  gameTitle: "Prođi raskrsnicu",
  gameLead:
    "Vozilo ide zadatom putanjom — vi držite samo gas i kočnicu. Cilj je proći bez ijednog prekršaja: nikome ne oduzeti prednost, stati gdje se mora i ne zadržavati saobraćaj kad prednost imate vi.",
  gameStart: "Kreni",
  gameDesc:
    "Vozite u realnom vremenu — držite gas i kočnicu i prođite bez ijednog prekršaja. Situacije: prvenstvo, znaci, semafor, pješaci, policajac, kružni tok i autoput.",
  gameMeta: "tajming i prvenstvo",
  gameOpen: "Otvori igru",
  gameRetry: "Pokušaj ponovo",
  gameSpeed: "Brzina",
  gameSpeedLimit: "ograničenje",
  gameTime: "Vrijeme",
  gameQuality: "Iznad idealnog vremena",
  gamePickLead:
    "Svaka situacija vježba jedno pravilo. Prolazak se pamti na ovom uređaju, pa možete nastaviti kasnije.",
  gameDifficulty: "Težina",
  gameStatusPassed: "Prošli",
  gameStatusFailed: "Niste prošli",
  gameStatusNew: "Nije pokušano",
  gameBestTime: "Najbolje",
  gameAttempts: "pokušaja",
  gameProgress: "Prošli ste {n} od {max}",
  gameReplay: "Ponovi zadnjih 5 s",
  gameReplaying: "Ponavljanje",
  gameBack: "Druga situacija",
  gameNextScenario: "Sljedeća situacija",
  gameRuleTitle: "Pravilo",
  gameLightRed: "Crveno",
  gameLightYellow: "Žuto",
  gameLightGreen: "Zeleno",
  vioPedestrian: "Nepropuštanje pješaka na prelazu",
  vioOfficer: "Nepostupanje po naredbi policajca",
  gameSignOfficer: "Policajac",
  gameOfficerGo: "prolaz",
  gameOfficerStop: "stop",
  ruleOfficer:
    "Naredba policijskog službenika jača je i od znakova i od semafora. Kad policajac reguliše saobraćaj, svjetlo na semaforu se ne poštuje.",
  ruleEmergency:
    "Vozilu pod pratnjom i vozilu sa uključenim rotacionim svjetlom i sirenom ustupa se prvenstvo bez obzira na znakove i semafor.",
  vioIndicatorMissing: "Bez pokazivača pravca",
  vioIndicatorWrong: "Pokazivač na pogrešnu stranu",
  vioIndicatorLate: "Pokazivač uključen prekasno",
  vioIndicatorLeftOn: "Pokazivač ostavljen uključen",
  vioUnsafeMerge: "Nebezbjedno uključivanje u traku",
  vioStoppedOnRamp: "Zaustavljanje na traci za ubrzavanje",
  vioTooSlow: "Prespora vožnja na autoputu",
  vioTailgating: "Nedovoljno odstojanje",
  vioBrakingOnHighway: "Naglo kočenje bez razloga",
  vioHardShoulder: "Vožnja zaustavnom trakom",
  vioOffRoad: "Izlazak sa kolovoza",
  vioCrossingSolidLine: "Prelazak preko pune linije",
  vioUnsafeOvertake: "Nebezbjedno preticanje",
  vioOvertakeNoVisibility: "U suprotnu traku bez preglednosti",
  vioOvertakeTooLong: "Predugo u suprotnoj traci",
  vioCutIn: "Naglo vraćanje ispred preteknutog",
  gameSteer: "Volan",
  ruleHardShoulder:
    "Spoljna traka je zaustavna: u njoj se vozi samo dok traje traka za ubrzavanje pri ulasku, odnosno traka za usporavanje pred izlazom. Van toga je ona rezervisana za vozila u kvaru i za hitne službe.",
  ruleMerge:
    "U traku se uključujete tek kad ste izjednačili brzinu i kad iza vas ima dovoljno praznine. Vozilo koje već vozi tom trakom ne smije zbog vas da koči.",
  ruleHighwaySpeed:
    "Na autoputu postoji i najmanja dozvoljena brzina. Prespora vožnja ometa saobraćaj isto koliko i prebrza, a zaustavljanje na traci za ubrzavanje je opasno.",
  ruleFollowing:
    "Odstojanje se mjeri u sekundama, ne u metrima: pri većoj brzini treba više puta. Naglo kočenje bez razloga ugrožava one iza vas.",
  gameLaneLeft: "U lijevu",
  gameLaneRight: "U desnu",
  gameKeyHintLane: "Shift i strelica lijevo/desno mijenjaju traku.",
  gameTaskMerge: "Uključujete se na autoput.",
  gameTaskOvertake: "Pretičete sporije vozilo i vraćate se u desnu traku.",
  gameTaskExitHighway: "Isključujete se sa autoputa.",
  gameTaskFollow: "Vozite dionicom autoputa i držite odstojanje.",
  ruleIndicator:
    "Namjeru da skrenete najavljujete pokazivačem pravca prije nego što uđete u raskrsnicu, i držite ga do kraja skretanja. Pokazivač je jedini način da ostali saznaju šta ćete uraditi.",
  ruleIndicatorOff:
    "Poslije završenog skretanja pokazivač se gasi. Ostavljen pokazivač obmanjuje one koji čekaju da vide kuda idete.",
  gameIndicator: "Pokazivač",
  gameIndicatorLeft: "Lijevo",
  gameIndicatorRight: "Desno",
  gameIndicatorShortLeft: "L",
  gameIndicatorShortRight: "D",
  gameIndicatorMode: "Pokazivači pravca",
  gameIndicatorAuto: "Automatski",
  gameIndicatorManual: "Ručni",
  gameIndicatorAutoShort: "Automatski",
  gameIndicatorAutoHint:
    "Pokazivač se pali sam, tačno kad treba — pratite kad. Greške pokazivača se ne računaju.",
  gameIndicatorManualHint:
    "Pokazivač palite sami: tasteri Q i E ili dugmad pored volana. Greške se računaju, i pri preticanju.",
  gameTrafficLevel: "Saobraćaj na putu",
  gameTrafficHint:
    "1 — rijedak, 5 — gust. Važi za otvoren put i ulice na ruti; raskrsnice kroz grad u putovanju ostaju iste.",
  gameMinor: "blaga greška",
  gameHazardTitle: "Neko nije poštovao pravila",
  gameHazardYielded:
    "Imali ste prednost, ali je niste imali na raspolaganju — ispravno ste ustupili. To se ne računa protiv vas.",
  gameHazardCollision:
    "Prednost se ne uzima silom. Kad vidite da drugi ne staje, jedini ispravan potez je kočnica.",
  gameReaction: "Vrijeme reakcije",
  tripTitle: "Putovanje",
  tripDesc:
    "Vožnja kroz Crnu Goru, dionicu po dionicu. Na svakoj raskrsnici birate kuda dalje, a nudi se samo ono što je stvarno susjedno. Jedna dionica traje oko četiri minuta.",
  tripStart: "Kreni na put",
  tripResume: "Nastavi putovanje",
  tripNew: "Novo putovanje",
  tripBack: "Izlaz iz putovanja",
  tripPickStart: "Odakle krećete?",
  tripWhereTo: "Kuda dalje?",
  tripGo: "Kreni",
  tripTurnAround: "Okreni se",
  tripBorderTitle: "Granični prelaz",
  tripBorderDesc: "Ovdje se put završava. Dalje je granica — okrenite se i vratite istim putem.",
  tripDeadEndTitle: "Kraj puta",
  tripDeadEndDesc: "Put se ovdje završava. Okrenite se i vratite istim putem.",
  tripArrived: "Stigli ste u",
  tripSeenHere: "Viđeno na ovoj dionici",
  tripNothingSeen: "Na ovoj dionici nema zabilježenih znamenitosti.",
  tripContinue: "Dalje",
  tripKm: "Pređeno",
  tripLegs: "Dionica",
  tripTowns: "Opština",
  tripCollected: "Znamenitosti",
  tripSummer: "Ljeto",
  tripSummerHint: "Ljeti su prohodni i sezonski prevoji, poput Žabljak — Plužine preko Trse.",
  tripTagSeasonal: "sezonski",
  tripTagFerry: "trajekt",
  tripTagUnverified: "nije provjereno",
  tripCrash: "Sudar. Ova dionica se vozi ponovo.",
  tripNoted: "Zabilježeno usput",
  tripCity: "Kroz grad",
  tripMap: "Karta",
  tripMapHide: "Sakrij kartu",
  rutaTitle: "Ruta",
  rutaDesc:
    "Cijela ruta u jednom potezu, po stvarnim putevima Crne Gore. Bez zastajanja između dionica.",
  rutaStart: "Vozi rutu",
  gradTitle: "Podgorica — slobodna vožnja (probno)",
  gradDesc: "Cijela Podgorica iz OpenStreetMap-a, u stvarnoj veličini. Za sada bez pravila i bez drugih vozila — samo ulice, da se grad pogleda.",
  gradStart: "Vozi po Podgorici",
  gradLoading: "Učitavam grad…",
  gradFailed: "Grad nije učitan.",
  gradNoWebgl: "Ovaj uređaj ne daje WebGL, a grad se crta samo njime.",
  gradStreet: "Ulica",
  gradUnnamed: "bez imena",
  gradHint: "Volan okreće auto kao u pravom autu — skreni gdje hoćeš, ali uspori prije skretanja. Kočnica držana dok auto stoji ubacuje rikverc; gas ga vraća naprijed.",
  gradZoomIn: "Približi",
  gradZoomOut: "Udalji",
  gradReverse: "Rikverc",
  gradTimeOfDay: "Doba dana",
  gradMorning: "Jutro",
  gradClock: "Sat u igri",
  gradDay: "Dan",
  gradDusk: "Sumrak",
  gradNight: "Noć",
  gradWeather: "Vrijeme",
  gradSun: "Sunce",
  gradRain: "Kiša",
  gradRainNote: "Kiša: kočnica drži slabije — zaustavni put je duži.",
  gradLevel: "Nivo",
  gradViolations: "Prekršaji",
  gradNavDestination: "Cilj",
  gradNavChoose: "Izaberi cilj",
  gradNavSearch: "Traži po imenu",
  gradNavRandom: "Nasumično",
  gradNavClear: "Bez cilja",
  gradNavClose: "Zatvori",
  gradNavIn: "za {d}",
  gradNavTurnLeft: "Skreni lijevo",
  gradNavTurnRight: "Skreni desno",
  gradNavUTurn: "Polukružno okretanje",
  gradNavRoundabout: "Kružni tok: {n}. izlaz",
  gradNavStraight: "Pravo",
  gradNavOnto: "na {ulica}",
  gradNavArrived: "Stigao si: {cilj}",
  gradNavRemaining: "do cilja {d}",
  gradNavRerouting: "Nova ruta…",
  gradNavNoRoute: "Do ovog cilja odavde nema puta.",
  gradKatSkola: "Škole i fakulteti",
  gradKatZdravlje: "Zdravstvo",
  gradKatUstanova: "Institucije",
  gradKatKultura: "Kultura",
  gradKatBogomolja: "Bogomolje",
  gradKatStanica: "Stanice",
  gradKatSport: "Sport",
  gradKatTrgovina: "Tržni centri i pijace",
  gradKatZnamenitost: "Znamenitosti",
  gradStatClean: "Bez prekršaja: {n} min",
  gradStatToday: "Danas: {km} km · {cisto} min bez prekršaja · prekršaja {prekrsaji}",
  gradMiniMap: "Mini mapa",
  gradOsmAttribution: "© OpenStreetMap",
  gradOdDo: "Vožnja od–do",
  gradOdDoIntro: "Vozi do cilja po pravilima. Bodovi: vožnja bez prekršaja i vrijeme. Težina određuje dužinu rute, gustinu saobraćaja i strogost sudije.",
  gradOdDoEasy: "Lako",
  gradOdDoMedium: "Srednje",
  gradOdDoHard: "Teško",
  gradOdDoRange: "{od}–{do} km · nivo {nivo}",
  gradOdDoRandom: "Nasumičan cilj",
  gradOdDoPick: "Izaberi cilj",
  gradOdDoCancel: "Prekini od–do",
  gradOdDoTimer: "Od–do · {vrijeme}",
  gradOdDoDone: "Na cilju: {cilj}",
  gradOdDoScore: "{bodovi} / 1000 bodova",
  gradOdDoRules: "Vožnja po pravilima: {n} / {max}",
  gradOdDoTime: "Vrijeme {vrijeme} (očekivano {ref}): {n} / {max}",
  gradOdDoViolations: "Prekršaji: {minor} lakših, {fail} teških",
  gradOdDoStars: "{n} od 3 zvjezdice",
  gradOdDoBest: "Najbolje do sada: {n}",
  gradOdDoNewBest: "Novi najbolji rezultat!",
  gradOdDoAgain: "Nova vožnja",
  gradOdDoNoTarget: "Nema odredišta za ovu težinu.",
  gradExam: "Ispitna ruta",
  gradExamIntro: "Ruta kao na ispitu: kreće se sa istog mjesta, prolazi kroz obavezne tačke redom i završava na cilju. Pada se na bilo koji teži prekršaj ili na više od {n} lakših.",
  gradExamRouteInfo: "{km} km · {n} tačaka",
  gradExamHud: "Ispit · tačka {k}/{n} · {vrijeme}",
  gradExamCancel: "Prekini ispit",
  gradExamPoint: "Obavezna tačka {k} od {n}",
  gradExamPassed: "Položeno",
  gradExamFailed: "Nije položeno",
  gradExamSummary: "Lakših: {minor} · teških: {fail} · vrijeme {vrijeme} · {km} km",
  gradExamRule: "Pada se na bilo koji teži prekršaj ili na više od {n} lakših.",
  gradExamRecord: "Zapisnik",
  gradExamMinor: "Lakše",
  gradExamSerious: "Teške",
  gradExamAgain: "Ponovi ispit",
  gradExamCatJunctions: "Raskrsnice i prvenstvo",
  gradExamCatSpeed: "Brzina",
  gradExamCatSigns: "Znakovi, svjetla i oznake",
  gradExamCatPedestrians: "Pješaci",
  gradExamCatLane: "Položaj na putu i trake",
  gradExamCatManoeuvres: "Manevri i pokazivači",
  vioWrongWay: "Vožnja u suprotnom smjeru jednosmjerne ulice",
  vioTurnBan: "Skretanje tamo gdje znak zabranjuje",
  vioUTurn: "Polukružno okretanje gdje je zabranjeno",
  vioWrongSide: "Vožnja lijevom stranom kolovoza",
  vioStopping: "Zaustavljanje na zabranjenom mjestu",
  gradRuleRed: "Na crveno se ne prelazi stop-linija.",
  gradRuleAmber: "Na žuto se prolazi samo kad se ne može bezbjedno stati — a ovdje se moglo.",
  gradRuleStop: "Na znak STOP auto mora potpuno stati ispred stop-linije.",
  gradRuleCollision: "Udario si drugo vozilo. Drži razmak i propusti onoga ko ima prednost.",
  gradRuleRightOfWay: "Vozilo koje je imalo prednost moralo je naglo da koči zbog tebe.",
  gradRulePedestrianCrossing: "Pješak je bio na pješačkom prelazu i još nije prešao tvoju polovinu ulice. Stani pred zebrom i propusti ga.",
  gradRulePedestrianIntent: "Pješak je stajao na ivičnjaku uz zebru i čekao da pređe, a ti si još mogao mirno da staneš. Pješaku koji pokazuje namjeru da pređe ustupa se prvenstvo.",
  gradRuleRedLightPedestrian: "Prošao si kroz crveno na semaforu pješačkog prelaza. Dok pješaci imaju zeleno, vozila stoje.",
  gradRulePedestrianCollision: "Udario si pješaka. Vožnja je gotova — pazi na pješake na prelazima i na one koji izađu na kolovoz.",
  gradRuleBusDeparture:
    "U naselju autobusu koji daje znak da polazi sa stajališta moraš omogućiti uključivanje u saobraćaj: uspori i propusti ga — ne prestiži ga dok polazi.",
  gradRuleEmergencyVehicle:
    "Vozilu sa rotacijom i sirenom koje ti dolazi s leđa moraš omogućiti nesmetan prolaz: skloni se udesno i uspori ili stani. Na crvenom smiješ oprezno preći stop-liniju da mu napraviš mjesto, ali ne i ući u raskrsnicu.",
  gradHitTitle: "Vožnja je prekinuta",
  gradHitText: "Na pravom ispitu ovo je kraj ispita — i najteža posljedica greške za volanom.",
  gradHitAgain: "Vozi ponovo",
  gradRuleWrongWay: "Jednosmjernom ulicom se vozi samo u dozvoljenom smjeru — na njenom ulazu stoji znak zabrane ulaska.",
  gradRuleTurnBan: "Znak na tom kraku raskrsnice zabranjuje ovaj pravac.",
  gradRuleUTurnSignal: "Polukružno okretanje je zabranjeno u raskrsnici sa semaforom.",
  gradRuleUTurnBridge: "Polukružno okretanje je zabranjeno na mostu.",
  gradRuleUTurnTunnel: "Polukružno okretanje je zabranjeno u tunelu.",
  gradRuleSpeeding: "Ograničenje je {ogranicenje} km/h, a auto je vozio {brzina} km/h.",
  gradRuleWrongSide: "U dvosmjernoj ulici vozi se desnom stranom; lijevom samo kratko, pri preticanju ili zaobilaženju.",
  gradRuleStopZebra: "Na pješačkom prelazu se ne zaustavlja.",
  gradRuleStopJunction: "U raskrsnici se ne zaustavlja, osim kad to traži saobraćaj.",
  gradRuleStopBus: "Na autobuskom stajalištu se ne zaustavlja.",
  vioWrongLane: "Skretanje iz pogrešne trake",
  vioRoundaboutLane: "Pogrešna traka u kružnom toku",
  gradRuleIndicatorMissing: "Prije skretanja žmigavac se pali na stranu skretanja — najkasnije kad auto uđe u raskrsnicu.",
  gradRuleIndicatorWrong: "Žmigavac je bio upaljen na pogrešnu stranu.",
  gradRuleIndicatorLate: "Žmigavac je upaljen tek u raskrsnici — kasno za druge da vide namjeru.",
  gradRuleIndicatorStraight: "Za vožnju pravo žmigavac se ne pali.",
  gradRuleIndicatorLeftOn: "Poslije skretanja žmigavac se gasi.",
  gradRuleIndicatorRoundabout: "Pri izlasku iz kružnog toka pali se desni žmigavac.",
  gradRuleWrongLane: "Strelice na kolovozu određuju kuda se iz trake smije — iz ove trake nije ovim pravcem.",
  gradRuleRoundaboutOuter: "U kružnom toku sa dvije trake: za desno i pravo vozi se spoljnom trakom — unutrašnja je za lijevo i puni krug.",
  gradRuleRoundaboutInner: "U kružnom toku sa dvije trake: za lijevo i puni krug vozi se unutrašnjom trakom — spoljna je za desno i pravo.",
  vioBusLane: "Vožnja autobuskom trakom",
  gradRuleSolidLine: "Puna linija se ne prelazi i po njoj se ne vozi.",
  gradRuleBusLane: "Autobuskom trakom voze samo vozila javnog prevoza i vozila pod pratnjom — ostali je smiju samo preći, ili u nju ući radi skretanja.",
  gradRuleNoEntry: "Znak zabrane ulaska: u tu ulicu se iz raskrsnice ne smije.",
  gradRuleMandatory: "Znak obaveznog smjera na ovom kraku dozvoljava samo: {smjer}.",
  gradRuleRedManeuver: "Za pravac {manevar} svjetlo je bilo crveno — svjetlo sa strelicom važi za svoj pravac.",
  gradManeuverLeft: "lijevo",
  gradManeuverStraight: "pravo",
  gradManeuverRight: "desno",
  gradManeuverUTurn: "polukružno",
  rutaFrom: "Odakle",
  rutaTo: "Dokle",
  rutaPrepare: "Pripremam put…",
  rutaGo: "Kreni",
  rutaLegs: "Dionica",
  rutaLeft: "Ostalo",
  rutaSurroundings: "Okolina",
  rutaMap: "Mapa Crne Gore",
  osmKratko: "© OpenStreetMap contributors (ODbL)",
  osmPuno: "Podaci o putevima i okolini: © OpenStreetMap contributors (ODbL)",
  oIgriTitle: "O igri",
  oIgriDesc:
    "Vježba za vozački ispit: sve situacije, putovanje i rute voze se po pravilima iz Zakona o bezbjednosti saobraćaja. Putevi, gradovi i okolina su stvarni — rastojanja su sažeta da bi vožnja stala u jedan sat.",
  rutaDone: "Stigli ste.",
  rutaCrash: "Sudar. Ruta se vozi ponovo.",
  rutaNoRoute: "Između ta dva mjesta graf nema put.",
  rutaFailed: "Put se nije mogao pripremiti.",
  tripCrashJunction: "Sudar. Ova raskrsnica se vozi ponovo.",
  tripRetry: "Vozi ponovo",
  tripRoadAutoput: "autoput",
  tripRoadMagistrala: "magistrala",
  tripRoadRegionalni: "regionalni put",
  tripRoadPlaninski: "planinski put",
  shiftTitle: "Smjena",
  shiftDesc:
    "Raskrsnica za raskrsnicom, bez kraja, a od drugog nivoa i pokoja dionica autoputa. Tri života; težina raste dok vozite čisto i spušta se kad pogriješite.",
  shiftStart: "Počni smjenu",
  shiftLives: "Životi",
  shiftLevel: "Nivo",
  shiftSegments: "Raskrsnica",
  shiftStreak: "Najduži niz",
  shiftOver: "Smjena je gotova",
  shiftBest: "Najbolje",
  shiftAgain: "Nova smjena",
  shiftSkip: "Dalje",
  shiftLostLife: "Izgubili ste jedan život",
  shiftNoReaction: "nije bilo mjerenja",
  shiftBack: "Izlaz iz smjene",
  gameSoundOn: "Isključi zvuk",
  gameSoundOff: "Uključi zvuk",
  gameTimelineTitle: "Pokazivač duž putanje",
  gameTimelineExpected: "traži se",
  gameTimelineActual: "vi",
  gameTimelineOff: "ugašen",
  gameKeyHintIndicator: "Strelice lijevo i desno pale i gase pokazivač.",
  ruleObstruction:
    "Kad imate prednost i put je slobodan, dužni ste da nastavite. Nepotrebno stajanje na raskrsnici zadržava saobraćaj i samo po sebi je prekršaj.",
  ruleSpeeding:
    "Brzina se prilagođava ograničenju i uslovima. Prekoračenje na prilazu raskrsnici skraćuje put kočenja i oduzima vrijeme za odluku.",
  gameThrottle: "Gas",
  gameBrake: "Kočnica",
  gameKeyHint: "Na tastaturi: strelica gore je gas, strelica dolje kočnica.",
  gamePassed: "Prošli ste bez prekršaja",
  gameFailed: "Vožnja nije ispravna",
  gameViolationsTitle: "Prekršaji",
  gameHowTo: "Kako je trebalo",
  gameTaskStraight: "Idete pravo kroz raskrsnicu.",
  gameTaskLeft: "Skrećete lijevo.",
  gameTaskRight: "Skrećete desno.",
  gameTaskExit: "Izlazite na {n}. izlazu.",
  gameTaskFullCircle: "Vozite puni krug i vraćate se odakle ste došli.",
  gameSignPriority: "Glavni put",
  gameSignYield: "Ustupi prvenstvo",
  gameSignStop: "Obavezno zaustavljanje",
  gameSignNone: "Bez znaka — pravilo desne strane",
  vioRightOfWay: "Oduzeto prvenstvo prolaza",
  vioStopSign: "Prolazak stop-linije bez zaustavljanja",
  vioRedLight: "Prolazak na crveno svjetlo",
  vioCollision: "Sudar",
  vioPedestrianRightOfWay: "Nisi propustio pješaka",
  vioRedLightPedestrian: "Crveno na pješačkom semaforu",
  vioPedestrianCollision: "Udaren pješak",
  vioBusDeparture: "Ometanje polaska autobusa",
  vioEmergencyVehicle: "Nepropuštanje vozila sa prvenstvom prolaza",
  vioObstruction: "Zadržavanje saobraćaja",
  vioSpeeding: "Prekoračenje dozvoljene brzine",

  loading: "Učitavanje pitanja…",
  loadErrorTitle: "Greška pri učitavanju pitanja",
  noQuestions: "Nema pitanja u izabranoj kategoriji. Izaberite drugu kategoriju.",
  question: "Pitanje",
  progress: "Napredak kroz pitanja",
  next: "Sljedeće pitanje",
  newRound: "Novi krug",
  finishExam: "Završi ispit",
  pageLabel: "Stranica",
  prevPage: "Prethodna",
  nextPage: "Sljedeća",
  check: "Provjeri",
  correctAnswerLabel: "Tačno",
  yourAnswerLabel: "Vaš odgovor",
  correctFeedback: "Tačan odgovor",
  wrongFeedback: "Netačan odgovor",
  remaining: "Preostalo",
  answeredLabel: "Odgovoreno",
  correctLabel: "Tačno",
  inPool: "pitanja u izboru",
  explanationTitle: "Objašnjenje",
  questionsOnlyInMe: "Pitanja su dostupna na crnogorskom.",
  translationMissing: "Prevod nije dostupan, prikazano na crnogorskom.",
  briefingTitle: "Prije nego što započnete",
  briefingLead: "Pročitajte uputstvo, pa potvrdite da ste ga pročitali.",
  briefingConfirm: "Pročitao/la sam uputstvo",
  briefingStart: "Započni test",
  briefingDisclaimer:
    "Ovo je simulacija za vježbu. Zvanični ispit sprovodi nadležni organ i podaci o uslovima izlaska na ispit su informativni — provjerite ih u auto-školi.",
  penaltyTitle: "Koliko bi ovo koštalo u saobraćaju",
  penaltyTotal: "Ove greške bi u saobraćaju koštale",
  penaltyNote:
    "Informativno, po Zakonu o bezbjednosti saobraćaja na putevima. Konačan iznos određuje nadležni organ, a uz kaznu mogu ići i kazneni bodovi.",
  penaltyLanguageNote: "Tekst kazne je na crnogorskom — potvrđuje ga instruktor auto-škole.",
  penaltyListTitle: "Kazne",
  penaltyListLead: "Novčane kazne po Zakonu o bezbjednosti saobraćaja na putevima. Iznosi su informativni — mjerodavan je važeći zakon i odluka nadležnog organa.",
  penaltyListSearch: "Traži kaznu",
  penaltyListEmpty: "Nema kazne koja odgovara pretrazi.",
  penaltyListChecked: "Posljednja provjera:",

  navTitle: "Pregled pitanja",
  navAnswered: "odgovoreno",
  navUnanswered: "bez odgovora",
  navJump: "Idi na pitanje",
  confirmLeaveExam: "Ispit je u toku. Ako izađete, odgovori se gube. Želite li da izađete?",

  orderingLabel: "Redoslijed prolaska vozila",
  orderingHint: "Unesite brojeve redom kojim vozila prolaze — crtica, razmak ili bez razmaka.",
  orderingEntered: "Uneseno",
  orderingCorrectIs: "tačan redoslijed je",

  badgeSign: "Saobraćajni znak",
  badgePolice: "Znak policajca",
  badgeMarking: "Oznake na kolovozu",
  badgeTrafficLight: "Semafor",
  badgeIntersection: "Raskrsnica",
  badgeOrdering: "Redoslijed prolaska",
  badgeFirstAid: "Prva pomoć",
  badgeText: "Tekstualno pitanje",

  resultTitle: "Rezultat simulacije",
  passed: "Položeno",
  failed: "Nije položeno",
  passThreshold: "Za prolaz je potrebno {n} od {max} bodova.",
  timedOutNote: "Ispit je zaustavljen jer je isteklo vrijeme.",
  statCorrect: "Tačno",
  statWrong: "Netačno",
  statUnanswered: "Bez odgovora",
  resultSummaryTitle: "Pregled po pitanjima",
  statAnswered: "Odgovoreno",
  newExam: "Novi ispit",
  backToStart: "Nazad na početak",
  reviewTitle: "Pregled grešaka",
  reviewLead: "Prođite kroz pitanja koja niste riješili tačno — uz tačan odgovor.",
  reviewPerfect: "Sva pitanja su tačna. Nema šta da se ponavlja.",
  reviewNoAnswer: "Bez odgovora",
  reviewWrong: "Netačno",

  litTitle: "Literatura",
  litLead: "Zvanični izvori na kojima se zasniva ispitna materija:",

  catAll: "Sve",
  catText: "Tekstualna",
  catImage: "Sa slikom",
  catSign: "Znaci",
  catIntersection: "Raskrsnice",
  catOrdering: "Redoslijed",
  catFirstAid: "Prva pomoć",
};

const en: Dict = {
  back: "Back",
  close: "Close",
  literature: "Sources",
  langLabel: "Language",
  temaLabel: "Appearance",
  temaSvijetla: "Light mode",
  temaTamna: "Dark mode",
  prijavaDugme: "Report a mistake",
  prijavaVrsta: "Type of problem",
  prijavaVrstaOdgovor: "Wrong answer",
  prijavaVrstaTekst: "Error in the text or translation",
  prijavaVrstaSlika: "Problem with the image",
  prijavaVrstaSajt: "The site isn't working properly",
  prijavaVrstaDrugo: "Something else",
  prijavaOpis: "Description",
  prijavaOpisPomoc: "What's wrong?",
  prijavaKontakt: "Email or phone (optional)",
  prijavaKontaktPomoc: "Only if you'd like us to get back to you.",
  prijavaPosalji: "Send report",
  prijavaSalje: "Sending…",
  prijavaHvala: "Thank you! Your report has been sent.",
  prijavaGreska: "Sending failed. Please try again.",
  prijavaPrevise: "Too many reports were sent. Please try again later.",
  prijavaKratko: "Please briefly describe the problem.",
  prijavaIspitVrijeme: "The exam timer keeps running while you write.",
  igraPodesavanja: "Settings",
  igraZatvoriPodesavanja: "Close settings",
  footerNote:
    "This question bank is for practice only. The official exam is administered by the competent authority.",

  landingTitle: "Prepare for the theory exam",
  landingLead:
    "Choose a mode. Practise without pressure with the correct answer shown immediately, or test yourself under real exam conditions.",
  heroLabel1: "Theory test",
  heroLabel2: "Category B",
  heroTitle1: "Mirav Driving School",
  heroTitle2: "Ready for the exam.",
  heroLead: "Category B questions in five languages. Practise without pressure, then test yourself under real exam conditions.",
  practiceMeta: "No timer · answer shown instantly",
  menuLabel: "Menu",
  practiceTitle: "Practice",
  practiceDesc:
    "Pick a question category; each answer is checked right away and the correct one is shown. No timer, no limits.",
  practiceStart: "Start practice",
  practiceResume: "Resume where you left off",
  categoryLabel: "Category",
  examTitle: "Exam simulation",
  examDesc:
    "Random questions from the whole bank, with no correct answers revealed while the exam runs. You get your score and a pass mark at the end.",
  examStart: "Start exam",
  metaPoints: "points",
  metaQuestions: "questions",
  metaMinutes: "minutes",
  metaPass: "pass at",
  examLimitationNote:
    "Note: our question bank contains only single-answer questions.",
  bestResult: "Best result",

  simTitle: "Intersection simulator",
  simDesc:
    "Real situations from the catalogue: tap the vehicles in the order they proceed. Right-of-way practice without typing numbers.",
  simStart: "Start simulator",
  simMeta: "right of way",
  simTask: "Tap the vehicles in the order they proceed.",
  simNotAllPass: "Not every vehicle necessarily proceeds — tap only those that have right of way.",
  simYourOrder: "Your order",
  simCorrectOrder: "Correct order",
  simClear: "Clear",
  simNextScene: "Next situation",
  simScene: "Situation",
  simVehicle: "Vehicle",
  simStreak: "Streak",
  simFinished: "You have been through every situation.",
  simRestart: "Start over",
  simEmpty: "No situations available.",
  simFamilyRule: "Right-hand rule",
  simFamilyCatalog: "From the catalogue",
  simFamilySigns: "Priority and side road",
  simFamilyLights: "Traffic lights",
  simFamilyLeft: "Turning left",
  simFamilyRoundabout: "Roundabout",
  simFamilyPedestrian: "Pedestrians",
  simUncontrolled: "Uncontrolled intersection — no signs, no lights. Every vehicle goes straight.",
  simSceneSigns: "Mind the signs on each approach.",
  simSceneLights: "Mind the traffic lights.",
  simSceneRoundabout: "Roundabout. Your vehicle is marked.",
  simScenePedestrian: "A pedestrian is on the crossing. Your vehicle is marked.",
  simTapInScene: "Tap the vehicles in the scene in the order they proceed.",
  simDecisionTask: "Do you proceed or give way?",
  simGo: "I proceed",
  simYield: "I give way",
  simYourVehicle: "your vehicle",
  ruleTitle: "Rule",
  ruleRightHand:
    "At an intersection with no signs or lights, the vehicle approaching from your right has priority.",
  ruleFreeRight: "The vehicle with nobody on its right goes first.",
  rulePriorityRoad:
    "Vehicles on the priority road go before vehicles from the side road, no matter which side they come from.",
  ruleYieldSign: "A “give way” sign means you let vehicles on the priority road pass first.",
  ruleStopSign:
    "A STOP sign requires a complete stop; in terms of priority it ranks the same as “give way”.",
  ruleLeftTurn:
    "A vehicle turning left gives way to oncoming vehicles going straight or turning right.",
  ruleGreenNotFree:
    "Green is not unconditional: among vehicles on green, giving way when turning still applies.",
  ruleRedStops: "A vehicle on red or amber stops and does not proceed.",
  ruleRoundabout: "When entering a roundabout you give way to vehicles already circulating.",
  ruleRoundaboutLeft:
    "Traffic in a roundabout moves anticlockwise, so circulating vehicles approach from your left.",
  ruleRoundaboutExit:
    "A vehicle leaving the roundabout before your entry does not cross your path — you need not give way to it.",
  rulePedestrian: "You must give way to a pedestrian on a crossing you are driving over.",

  gameTitle: "Clear the intersection",
  gameLead:
    "The car follows a fixed path — you only control the throttle and the brake. The goal is to get through without a single violation: never take someone's right of way, stop where you must, and do not hold up traffic when the right of way is yours.",
  gameStart: "Go",
  gameDesc:
    "Drive in real time — hold the throttle and the brake and get through without a single violation. The situations: right of way, signs, lights, pedestrians, a police officer, roundabouts and the motorway.",
  gameMeta: "timing and right of way",
  gameOpen: "Open the game",
  gameRetry: "Try again",
  gameSpeed: "Speed",
  gameSpeedLimit: "limit",
  gameTime: "Time",
  gameQuality: "Above the ideal time",
  gamePickLead:
    "Each situation drills one rule. Your progress is kept on this device, so you can carry on later.",
  gameDifficulty: "Difficulty",
  gameStatusPassed: "Cleared",
  gameStatusFailed: "Not cleared",
  gameStatusNew: "Not attempted",
  gameBestTime: "Best",
  gameAttempts: "attempts",
  gameProgress: "You have cleared {n} of {max}",
  gameReplay: "Replay the last 5 s",
  gameReplaying: "Replay",
  gameBack: "Another situation",
  gameNextScenario: "Next situation",
  gameRuleTitle: "Rule",
  gameLightRed: "Red",
  gameLightYellow: "Amber",
  gameLightGreen: "Green",
  vioPedestrian: "Failure to give way to a pedestrian",
  vioOfficer: "Failure to obey a police officer",
  gameSignOfficer: "Officer",
  gameOfficerGo: "go",
  gameOfficerStop: "stop",
  ruleOfficer:
    "An order given by a police officer overrides both signs and traffic lights. When an officer is directing traffic, the signal is not to be obeyed.",
  ruleEmergency:
    "An emergency vehicle with its beacon and siren on has the right of way regardless of signs and traffic lights.",
  vioIndicatorMissing: "No direction indicator",
  vioIndicatorWrong: "Indicator on the wrong side",
  vioIndicatorLate: "Indicator switched on too late",
  vioIndicatorLeftOn: "Indicator left on",
  vioUnsafeMerge: "Unsafe merge",
  vioStoppedOnRamp: "Stopping on the acceleration lane",
  vioTooSlow: "Driving too slowly on the motorway",
  vioTailgating: "Insufficient following distance",
  vioBrakingOnHighway: "Hard braking for no reason",
  vioHardShoulder: "Driving on the hard shoulder",
  vioOffRoad: "Leaving the carriageway",
  vioCrossingSolidLine: "Crossing a solid line",
  vioUnsafeOvertake: "Unsafe overtaking",
  vioOvertakeNoVisibility: "Into the oncoming lane without a clear view",
  vioOvertakeTooLong: "Too long in the oncoming lane",
  vioCutIn: "Cutting in after overtaking",
  gameSteer: "Steering",
  ruleHardShoulder:
    "The outer lane is the hard shoulder: you drive in it only along the acceleration lane when joining and the deceleration lane before an exit. Elsewhere it is reserved for broken-down vehicles and the emergency services.",
  ruleMerge:
    "You move into the lane only once your speed matches and there is enough of a gap behind you. A vehicle already in that lane must not have to brake because of you.",
  ruleHighwaySpeed:
    "A motorway has a minimum speed as well as a maximum. Driving too slowly obstructs traffic just as much as driving too fast, and stopping on the acceleration lane is dangerous.",
  ruleFollowing:
    "Following distance is measured in seconds, not metres: the faster you go, the more you need. Hard braking for no reason endangers those behind you.",
  gameLaneLeft: "Move left",
  gameLaneRight: "Move right",
  gameKeyHintLane: "Shift with the left/right arrow changes lane.",
  gameTaskMerge: "You are joining the motorway.",
  gameTaskOvertake: "You overtake the slower vehicle and return to the right lane.",
  gameTaskExitHighway: "You are leaving the motorway.",
  gameTaskFollow: "Drive the motorway section and keep your distance.",
  ruleIndicator:
    "You announce a turn with the direction indicator before you enter the intersection, and keep it on until the turn is complete. The indicator is the only way others learn what you are about to do.",
  ruleIndicatorOff:
    "Once the turn is complete the indicator goes off. An indicator left on misleads those waiting to see where you are going.",
  gameIndicator: "Indicator",
  gameIndicatorLeft: "Left",
  gameIndicatorRight: "Right",
  gameIndicatorShortLeft: "L",
  gameIndicatorShortRight: "R",
  gameIndicatorMode: "Indicators",
  gameIndicatorAuto: "Automatic",
  gameIndicatorManual: "Manual",
  gameIndicatorAutoShort: "Auto",
  gameIndicatorAutoHint:
    "The indicator switches on by itself, exactly when it should — watch when. Indicator mistakes are not counted.",
  gameIndicatorManualHint:
    "You switch the indicator on yourself: the Q and E keys or the buttons next to the steering. Mistakes count, overtaking included.",
  gameTrafficLevel: "Traffic on the road",
  gameTrafficHint:
    "1 — light, 5 — heavy. Applies to the open road and to route streets; town junctions on a trip stay the same.",
  gameMinor: "minor fault",
  gameHazardTitle: "Someone broke the rules",
  gameHazardYielded:
    "The right of way was yours, but it was not available to you — you correctly gave way. That is not held against you.",
  gameHazardCollision:
    "Right of way is not taken by force. When you see that the other driver is not stopping, the only correct move is the brake.",
  gameReaction: "Reaction time",
  tripTitle: "Road trip",
  tripDesc:
    "Driving across Montenegro, one leg at a time. At every junction you choose where to go next, and only genuine neighbours are offered. A leg takes about four minutes.",
  tripStart: "Set off",
  tripResume: "Continue the trip",
  tripNew: "New trip",
  tripBack: "Leave the trip",
  tripPickStart: "Where do you start?",
  tripWhereTo: "Where to next?",
  tripGo: "Go",
  tripTurnAround: "Turn around",
  tripBorderTitle: "Border crossing",
  tripBorderDesc: "The road ends here. Beyond is the border — turn around and drive back.",
  tripDeadEndTitle: "End of the road",
  tripDeadEndDesc: "The road ends here. Turn around and drive back.",
  tripArrived: "You have reached",
  tripSeenHere: "Seen on this leg",
  tripNothingSeen: "No landmarks recorded on this leg.",
  tripContinue: "Continue",
  tripKm: "Distance",
  tripLegs: "Legs",
  tripTowns: "Municipalities",
  tripCollected: "Landmarks",
  tripSummer: "Summer",
  tripSummerHint: "In summer the seasonal passes are open too, such as Žabljak — Plužine over Trsa.",
  tripTagSeasonal: "seasonal",
  tripTagFerry: "ferry",
  tripTagUnverified: "unverified",
  tripCrash: "A crash. This leg starts over.",
  tripNoted: "Noted along the way",
  tripCity: "Through town",
  tripMap: "Map",
  tripMapHide: "Hide the map",
  rutaTitle: "Route",
  rutaDesc:
    "A whole route in one go, along the real roads of Montenegro. No stopping between legs.",
  rutaStart: "Drive the route",
  gradTitle: "Podgorica — free drive (preview)",
  gradDesc: "All of Podgorica from OpenStreetMap, at real scale. No rules and no other vehicles yet — just the streets, to look around the city.",
  gradStart: "Drive around Podgorica",
  gradLoading: "Loading the city…",
  gradFailed: "The city did not load.",
  gradNoWebgl: "This device has no WebGL, and the city is drawn only with it.",
  gradStreet: "Street",
  gradUnnamed: "unnamed",
  gradHint: "The wheel turns the car like a real one — turn wherever you like, but slow down before a turn. Hold the brake while stopped to reverse; the throttle takes you forward again.",
  gradZoomIn: "Zoom in",
  gradZoomOut: "Zoom out",
  gradReverse: "Reverse",
  gradTimeOfDay: "Time of day",
  gradMorning: "Morning",
  gradClock: "In-game time",
  gradDay: "Day",
  gradDusk: "Dusk",
  gradNight: "Night",
  gradWeather: "Weather",
  gradSun: "Sun",
  gradRain: "Rain",
  gradRainNote: "Rain: the brakes grip less — the stopping distance is longer.",
  gradLevel: "Level",
  gradViolations: "Violations",
  gradNavDestination: "Destination",
  gradNavChoose: "Choose a destination",
  gradNavSearch: "Search by name",
  gradNavRandom: "Random",
  gradNavClear: "No destination",
  gradNavClose: "Close",
  gradNavIn: "in {d}",
  gradNavTurnLeft: "Turn left",
  gradNavTurnRight: "Turn right",
  gradNavUTurn: "Make a U-turn",
  gradNavRoundabout: "Roundabout: exit {n}",
  gradNavStraight: "Straight on",
  gradNavOnto: "onto {ulica}",
  gradNavArrived: "You have arrived: {cilj}",
  gradNavRemaining: "{d} to go",
  gradNavRerouting: "Rerouting…",
  gradNavNoRoute: "There is no way to this destination from here.",
  gradKatSkola: "Schools and faculties",
  gradKatZdravlje: "Healthcare",
  gradKatUstanova: "Institutions",
  gradKatKultura: "Culture",
  gradKatBogomolja: "Places of worship",
  gradKatStanica: "Stations",
  gradKatSport: "Sport",
  gradKatTrgovina: "Shopping centres and markets",
  gradKatZnamenitost: "Landmarks",
  gradStatClean: "Clean driving: {n} min",
  gradStatToday: "Today: {km} km · {cisto} clean min · {prekrsaji} violations",
  gradMiniMap: "Mini map",
  gradOsmAttribution: "© OpenStreetMap",
  gradOdDo: "A-to-B drive",
  gradOdDoIntro: "Drive to the destination by the rules. Score: driving without violations, plus time. Difficulty sets the route length, traffic density and how strict the examiner is.",
  gradOdDoEasy: "Easy",
  gradOdDoMedium: "Medium",
  gradOdDoHard: "Hard",
  gradOdDoRange: "{od}–{do} km · level {nivo}",
  gradOdDoRandom: "Random destination",
  gradOdDoPick: "Choose destination",
  gradOdDoCancel: "Stop A-to-B",
  gradOdDoTimer: "A-to-B · {vrijeme}",
  gradOdDoDone: "At the destination: {cilj}",
  gradOdDoScore: "{bodovi} / 1000 points",
  gradOdDoRules: "Driving by the rules: {n} / {max}",
  gradOdDoTime: "Time {vrijeme} (expected {ref}): {n} / {max}",
  gradOdDoViolations: "Violations: {minor} minor, {fail} serious",
  gradOdDoStars: "{n} of 3 stars",
  gradOdDoBest: "Best so far: {n}",
  gradOdDoNewBest: "New best score!",
  gradOdDoAgain: "New drive",
  gradOdDoNoTarget: "No destination for this difficulty.",
  gradExam: "Exam route",
  gradExamIntro: "A route like the real exam: it starts from the same place, passes the required points in order and ends at the finish. Any serious violation or more than {n} minor ones fails the exam.",
  gradExamRouteInfo: "{km} km · {n} points",
  gradExamHud: "Exam · point {k}/{n} · {vrijeme}",
  gradExamCancel: "Stop the exam",
  gradExamPoint: "Required point {k} of {n}",
  gradExamPassed: "Passed",
  gradExamFailed: "Not passed",
  gradExamSummary: "Minor: {minor} · serious: {fail} · time {vrijeme} · {km} km",
  gradExamRule: "Any serious violation or more than {n} minor ones fails the exam.",
  gradExamRecord: "Exam record",
  gradExamMinor: "Minor",
  gradExamSerious: "Serious",
  gradExamAgain: "Retake the exam",
  gradExamCatJunctions: "Junctions and right of way",
  gradExamCatSpeed: "Speed",
  gradExamCatSigns: "Signs, lights and road markings",
  gradExamCatPedestrians: "Pedestrians",
  gradExamCatLane: "Road position and lanes",
  gradExamCatManoeuvres: "Manoeuvres and indicators",
  vioWrongWay: "Driving the wrong way on a one-way street",
  vioTurnBan: "Turning where a sign forbids it",
  vioUTurn: "U-turn where it is forbidden",
  vioWrongSide: "Driving on the left side of the road",
  vioStopping: "Stopping where it is forbidden",
  gradRuleRed: "You may not cross the stop line on red.",
  gradRuleAmber: "On amber you go on only when you cannot stop safely — here you could.",
  gradRuleStop: "At a STOP sign the car must stop completely before the stop line.",
  gradRuleCollision: "You hit another vehicle. Keep your distance and give way to whoever has priority.",
  gradRuleRightOfWay: "A vehicle that had priority had to brake hard because of you.",
  gradRulePedestrianCrossing: "A pedestrian was on the crossing and had not yet passed your half of the road. Stop before the zebra and let them cross.",
  gradRulePedestrianIntent: "A pedestrian was waiting at the kerb by the zebra, and you could still have stopped calmly. A pedestrian who shows the intention to cross has priority.",
  gradRuleRedLightPedestrian: "You passed a red light at a pedestrian crossing. While pedestrians have green, vehicles stop.",
  gradRulePedestrianCollision: "You hit a pedestrian. The drive is over — watch for pedestrians on crossings and for anyone who steps onto the road.",
  gradRuleBusDeparture:
    "In a built-up area you must let a bus that signals it is leaving a stop rejoin traffic: slow down and let it go — do not pass it while it pulls out.",
  gradRuleEmergencyVehicle:
    "You must give way to a vehicle with flashing lights and siren coming up behind you: move to the right and slow down or stop. At a red light you may carefully roll past the stop line to make room, but not into the junction.",
  gradHitTitle: "Drive stopped",
  gradHitText: "On a real driving test this ends the exam — and it is the worst outcome of a mistake behind the wheel.",
  gradHitAgain: "Drive again",
  gradRuleWrongWay: "A one-way street is driven only in the allowed direction — a no-entry sign stands at its entrance.",
  gradRuleTurnBan: "A sign on that arm of the junction forbids this direction.",
  gradRuleUTurnSignal: "U-turns are forbidden at a junction with traffic lights.",
  gradRuleUTurnBridge: "U-turns are forbidden on a bridge.",
  gradRuleUTurnTunnel: "U-turns are forbidden in a tunnel.",
  gradRuleSpeeding: "The limit is {ogranicenje} km/h and the car was doing {brzina} km/h.",
  gradRuleWrongSide: "On a two-way street you keep right; the left side only briefly, to overtake or pass an obstacle.",
  gradRuleStopZebra: "You may not stop on a pedestrian crossing.",
  gradRuleStopJunction: "You may not stop in a junction unless traffic makes you.",
  gradRuleStopBus: "You may not stop at a bus stop.",
  vioWrongLane: "Turning from the wrong lane",
  vioRoundaboutLane: "Wrong lane in the roundabout",
  gradRuleIndicatorMissing: "Before a turn the indicator goes on to the side of the turn — at the latest when the car enters the junction.",
  gradRuleIndicatorWrong: "The indicator was on to the wrong side.",
  gradRuleIndicatorLate: "The indicator went on only inside the junction — too late for others to see the intention.",
  gradRuleIndicatorStraight: "You do not indicate when going straight.",
  gradRuleIndicatorLeftOn: "After a turn the indicator is switched off.",
  gradRuleIndicatorRoundabout: "When leaving a roundabout you indicate right.",
  gradRuleWrongLane: "The arrows on the road say where each lane may go — this lane does not go this way.",
  gradRuleRoundaboutOuter: "In a two-lane roundabout, use the outer lane to turn right or go straight — the inner lane is for left turns and full circles.",
  gradRuleRoundaboutInner: "In a two-lane roundabout, use the inner lane to turn left or go full circle — the outer lane is for right turns and straight on.",
  vioBusLane: "Driving in the bus lane",
  gradRuleSolidLine: "A solid line must not be crossed or driven on.",
  gradRuleBusLane: "Only public transport and escorted vehicles may drive in the bus lane — others may only cross it, or enter it to turn.",
  gradRuleNoEntry: "No-entry sign: you may not drive into that street from the junction.",
  gradRuleMandatory: "The mandatory-direction sign on this approach allows only: {smjer}.",
  gradRuleRedManeuver: "The light for {manevar} was red — an arrow light applies to its own direction.",
  gradManeuverLeft: "left",
  gradManeuverStraight: "straight on",
  gradManeuverRight: "right",
  gradManeuverUTurn: "U-turn",
  rutaFrom: "From",
  rutaTo: "To",
  rutaPrepare: "Preparing the road…",
  rutaGo: "Go",
  rutaLegs: "Leg",
  rutaLeft: "Left",
  rutaSurroundings: "Surroundings",
  rutaMap: "Map of Montenegro",
  osmKratko: "© OpenStreetMap contributors (ODbL)",
  osmPuno: "Road and surroundings data: © OpenStreetMap contributors (ODbL)",
  oIgriTitle: "About the game",
  oIgriDesc:
    "Practice for the driving test: every situation, the journey and the routes follow the Montenegrin Road Safety Act. The roads, towns and surroundings are real — distances are compressed so a drive fits into an hour.",
  rutaDone: "You have arrived.",
  rutaCrash: "A crash. The route starts over.",
  rutaNoRoute: "The graph has no road between those two places.",
  rutaFailed: "The road could not be prepared.",
  tripCrashJunction: "A crash. This junction starts over.",
  tripRetry: "Drive again",
  tripRoadAutoput: "motorway",
  tripRoadMagistrala: "main road",
  tripRoadRegionalni: "regional road",
  tripRoadPlaninski: "mountain road",
  shiftTitle: "Shift",
  shiftDesc:
    "One intersection after another, with no end, and from level two the odd stretch of motorway. Three lives; the difficulty rises while you drive clean and drops when you slip.",
  shiftStart: "Start the shift",
  shiftLives: "Lives",
  shiftLevel: "Level",
  shiftSegments: "Intersections",
  shiftStreak: "Longest run",
  shiftOver: "The shift is over",
  shiftBest: "Best",
  shiftAgain: "New shift",
  shiftSkip: "Carry on",
  shiftLostLife: "You lost a life",
  shiftNoReaction: "nothing measured",
  shiftBack: "Leave the shift",
  gameSoundOn: "Mute",
  gameSoundOff: "Unmute",
  gameTimelineTitle: "Indicator along the path",
  gameTimelineExpected: "required",
  gameTimelineActual: "you",
  gameTimelineOff: "off",
  gameKeyHintIndicator: "Left and right arrows switch the indicator on and off.",
  ruleObstruction:
    "When the right of way is yours and the road is clear, you are required to proceed. Stopping needlessly at an intersection holds up traffic and is an offence in itself.",
  ruleSpeeding:
    "Speed must match the limit and the conditions. Exceeding it on the approach to an intersection shortens your braking distance and the time you have to decide.",
  gameThrottle: "Throttle",
  gameBrake: "Brake",
  gameKeyHint: "On a keyboard: arrow up is throttle, arrow down is brake.",
  gamePassed: "Cleared with no violations",
  gameFailed: "That drive was not correct",
  gameViolationsTitle: "Violations",
  gameHowTo: "How it should have gone",
  gameTaskStraight: "You are going straight through.",
  gameTaskLeft: "You are turning left.",
  gameTaskRight: "You are turning right.",
  gameTaskExit: "You take exit {n}.",
  gameTaskFullCircle: "You go all the way round and come back the way you came.",
  gameSignPriority: "Priority road",
  gameSignYield: "Give way",
  gameSignStop: "Mandatory stop",
  gameSignNone: "No sign — right-hand rule",
  vioRightOfWay: "Failure to give way",
  vioStopSign: "Crossed the stop line without stopping",
  vioRedLight: "Entered on a red light",
  vioCollision: "Collision",
  vioPedestrianRightOfWay: "Failed to give way to a pedestrian",
  vioRedLightPedestrian: "Red light at a pedestrian crossing",
  vioPedestrianCollision: "Pedestrian hit",
  vioBusDeparture: "Blocking a bus pulling out",
  vioEmergencyVehicle: "Not giving way to an emergency vehicle",
  vioObstruction: "Obstructing traffic",
  vioSpeeding: "Exceeding the speed limit",

  loading: "Loading questions…",
  loadErrorTitle: "Could not load the questions",
  noQuestions: "No questions in the selected category. Please choose another one.",
  question: "Question",
  progress: "Progress through questions",
  next: "Next question",
  newRound: "New round",
  finishExam: "Finish exam",
  pageLabel: "Page",
  prevPage: "Previous",
  nextPage: "Next",
  check: "Check",
  correctAnswerLabel: "Correct",
  yourAnswerLabel: "Your answer",
  correctFeedback: "Correct answer",
  wrongFeedback: "Wrong answer",
  remaining: "Remaining",
  answeredLabel: "Answered",
  correctLabel: "Correct",
  inPool: "questions available",
  explanationTitle: "Explanation",
  questionsOnlyInMe: "The questions themselves are available in Montenegrin.",
  translationMissing: "No translation available — shown in Montenegrin.",
  briefingTitle: "Before you start",
  briefingLead: "Read the instructions, then confirm that you have read them.",
  briefingConfirm: "I have read the instructions",
  briefingStart: "Start the test",
  briefingDisclaimer:
    "This is a practice simulation. The official exam is administered by the competent authority, and the details about sitting the exam are for information only — check them with the driving school.",
  penaltyTitle: "What this would cost you in traffic",
  penaltyTotal: "In traffic, these mistakes would cost",
  penaltyNote:
    "For information only, under the Road Traffic Safety Act. The final amount is set by the competent authority, and penalty points may be imposed as well.",
  penaltyLanguageNote: "The penalty text is in Montenegrin — it is confirmed by a driving instructor.",
  penaltyListTitle: "Penalties",
  penaltyListLead: "Fines under the Road Traffic Safety Act. The amounts are informative — the law in force and the decision of the competent authority prevail.",
  penaltyListSearch: "Search penalties",
  penaltyListEmpty: "No penalty matches your search.",
  penaltyListChecked: "Last checked:",

  navTitle: "Question overview",
  navAnswered: "answered",
  navUnanswered: "unanswered",
  navJump: "Go to question",
  confirmLeaveExam: "The exam is in progress. If you leave, your answers are lost. Leave anyway?",

  orderingLabel: "Order in which vehicles proceed",
  orderingHint: "Enter the numbers in order — separated by a dash, a space, or nothing at all.",
  orderingEntered: "Entered",
  orderingCorrectIs: "the correct order is",

  badgeSign: "Road sign",
  badgePolice: "Police signal",
  badgeMarking: "Road markings",
  badgeTrafficLight: "Traffic light",
  badgeIntersection: "Intersection",
  badgeOrdering: "Order of passage",
  badgeFirstAid: "First aid",
  badgeText: "Text question",

  resultTitle: "Exam result",
  passed: "Passed",
  failed: "Not passed",
  passThreshold: "You need {n} out of {max} points to pass.",
  timedOutNote: "The exam was stopped because time ran out.",
  statCorrect: "Correct",
  statWrong: "Wrong",
  statUnanswered: "Unanswered",
  resultSummaryTitle: "Question by question",
  statAnswered: "Answered",
  newExam: "New exam",
  backToStart: "Back to start",
  reviewTitle: "Review your mistakes",
  reviewLead: "Go through the questions you did not get right — with the correct answer.",
  reviewPerfect: "Every answer was correct. Nothing to review.",
  reviewNoAnswer: "No answer",
  reviewWrong: "Wrong",

  litTitle: "Sources",
  litLead: "Official documents the exam material is based on:",

  catAll: "All",
  catText: "Text only",
  catImage: "With image",
  catSign: "Signs",
  catIntersection: "Intersections",
  catOrdering: "Order of passage",
  catFirstAid: "First aid",
};

const sq: Dict = {
  back: "Kthehu",
  close: "Mbyll",
  literature: "Literatura",
  langLabel: "Gjuha",
  temaLabel: "Pamja",
  temaSvijetla: "Modaliteti i ndritshëm",
  temaTamna: "Modaliteti i errët",
  prijavaDugme: "Raporto një gabim",
  prijavaVrsta: "Lloji i gabimit",
  prijavaVrstaOdgovor: "Përgjigje e pasaktë",
  prijavaVrstaTekst: "Gabim në tekst ose në përkthim",
  prijavaVrstaSlika: "Problem me imazhin",
  prijavaVrstaSajt: "Faqja nuk funksionon si duhet",
  prijavaVrstaDrugo: "Diçka tjetër",
  prijavaOpis: "Përshkrimi",
  prijavaOpisPomoc: "Çfarë nuk shkon?",
  prijavaKontakt: "Email ose telefon (jo i detyrueshëm)",
  prijavaKontaktPomoc: "Vetëm nëse dëshironi t'ju kontaktojmë.",
  prijavaPosalji: "Dërgo raportin",
  prijavaSalje: "Po dërgohet…",
  prijavaHvala: "Faleminderit! Raporti u dërgua.",
  prijavaGreska: "Dërgimi dështoi. Provoni përsëri.",
  prijavaPrevise: "Janë dërguar shumë raporte. Provoni përsëri më vonë.",
  prijavaKratko: "Përshkruani shkurtimisht gabimin.",
  prijavaIspitVrijeme: "Koha e provimit vazhdon të ecë ndërsa shkruani.",
  igraPodesavanja: "Cilësimet",
  igraZatvoriPodesavanja: "Mbyll cilësimet",
  footerNote:
    "Baza e pyetjeve shërben vetëm për përgatitje dhe ushtrim. Provimin zyrtar e zhvillon organi kompetent.",

  landingTitle: "Përgatituni për provimin teorik",
  landingLead:
    "Zgjidhni mënyrën e punës. Ushtroni pa presion, me përgjigjen e saktë të shfaqur menjëherë, ose provoni njohuritë në kushtet e provimit real.",
  heroLabel1: "Testi teorik",
  heroLabel2: "Kategoria B",
  heroTitle1: "Auto shkolla Mirav",
  heroTitle2: "Gati për provimin.",
  heroLead: "Pyetje për kategorinë B në pesë gjuhë. Ushtrohuni pa presion, pastaj provoni njohuritë në kushtet e provimit të vërtetë.",
  practiceMeta: "Pa kohëmatës · përgjigjja menjëherë",
  menuLabel: "Menyja",
  practiceTitle: "Ushtrim",
  practiceDesc:
    "Zgjidhni kategorinë e pyetjeve; çdo përgjigje kontrollohet menjëherë dhe shfaqet zgjidhja e saktë. Pa kohëmatës dhe pa kufizime.",
  practiceStart: "Fillo ushtrimin",
  practiceResume: "Vazhdo aty ku e le",
  categoryLabel: "Kategoria",
  examTitle: "Simulim i provimit",
  examDesc:
    "Pyetje të rastësishme nga e gjithë baza, pa shfaqur përgjigjen e saktë derisa zgjat provimi. Në fund merrni pikët dhe vlerësimin e kalimit.",
  examStart: "Fillo provimin",
  metaPoints: "pikë",
  metaQuestions: "pyetje",
  metaMinutes: "minuta",
  metaPass: "pragu",
  examLimitationNote:
    "Shënim: baza jonë përmban vetëm pyetje me një përgjigje të saktë.",
  bestResult: "Rezultati më i mirë",

  simTitle: "Simulator i kryqëzimeve",
  simDesc:
    "Situata reale nga katalogu: prekni automjetet sipas radhës së kalimit. Ushtrim i së drejtës së përparësisë pa shkruar numra.",
  simStart: "Fillo simulatorin",
  simMeta: "e drejta e përparësisë",
  simTask: "Prekni automjetet sipas radhës së kalimit.",
  simNotAllPass:
    "Nuk kalojnë domosdoshmërisht të gjitha automjetet — prekni vetëm ato që kanë përparësi.",
  simYourOrder: "Radha juaj",
  simCorrectOrder: "Radha e saktë",
  simClear: "Pastro",
  simNextScene: "Situata tjetër",
  simScene: "Situata",
  simVehicle: "Automjeti",
  simStreak: "Seri",
  simFinished: "Keni kaluar të gjitha situatat.",
  simRestart: "Fillo nga e para",
  simEmpty: "Nuk ka situata në dispozicion.",
  simFamilyRule: "Rregulli i së djathtës",
  simFamilyCatalog: "Nga katalogu",
  simFamilySigns: "Rrugë me përparësi dhe anësore",
  simFamilyLights: "Semafori",
  simFamilyLeft: "Kthimi nga e majta",
  simFamilyRoundabout: "Rrethrrotullim",
  simFamilyPedestrian: "Këmbësorët",
  simUncontrolled:
    "Kryqëzim pa shenja dhe pa semaforë. Të gjitha automjetet vazhdojnë drejt.",
  simSceneSigns: "Kini parasysh shenjat në secilën hyrje.",
  simSceneLights: "Kini parasysh dritat e semaforit.",
  simSceneRoundabout: "Rrethrrotullim. Automjeti juaj është i shënuar.",
  simScenePedestrian: "Një këmbësor është në vendkalim. Automjeti juaj është i shënuar.",
  simTapInScene: "Prekni automjetet në skenë sipas radhës së kalimit.",
  simDecisionTask: "A kaloni apo i lëshoni rrugë?",
  simGo: "Kaloj",
  simYield: "Lëshoj rrugë",
  simYourVehicle: "automjeti juaj",
  ruleTitle: "Rregulli",
  ruleRightHand:
    "Në kryqëzim pa shenja dhe pa semaforë, përparësi ka automjeti që vjen nga e djathta juaj.",
  ruleFreeRight: "I pari kalon automjeti që nuk ka askënd në të djathtën e vet.",
  rulePriorityRoad:
    "Automjetet në rrugën me përparësi kalojnë përpara atyre nga rruga anësore, pavarësisht nga cila anë vijnë.",
  ruleYieldSign:
    "Shenja „lësho rrugë“ do të thotë se u lëshoni rrugë automjeteve në rrugën me përparësi.",
  ruleStopSign:
    "Shenja STOP kërkon ndalim të plotë; për sa i takon përparësisë është njësoj si „lësho rrugë“.",
  ruleLeftTurn:
    "Automjeti që kthehet nga e majta lëshon rrugë automjetit përballë që vazhdon drejt ose kthehet djathtas.",
  ruleGreenNotFree:
    "Gjelbra nuk është e pakushtëzuar: mes automjeteve në gjelbër, lëshimi i rrugës gjatë kthimit vlen përsëri.",
  ruleRedStops: "Automjeti në të kuqe ose të verdhë ndalon dhe nuk kalon.",
  ruleRoundabout:
    "Kur hyni në rrethrrotullim, lëshoni rrugë automjeteve që qarkullojnë brenda.",
  ruleRoundaboutLeft:
    "Në rrethrrotullim qarkullohet në kahun kundërorar, kështu që automjetet brenda vijnë nga e majta juaj.",
  ruleRoundaboutExit:
    "Automjeti që del nga rrethrrotullimi para hyrjes tuaj nuk u pret rrugën — atij nuk duhet t'i lëshoni rrugë.",
  rulePedestrian:
    "Duhet t'i lëshoni rrugë këmbësorit në vendkalimin nëpër të cilin kaloni.",

  gameTitle: "Kalo kryqëzimin",
  gameLead:
    "Automjeti ndjek një trajektore të dhënë — ju kontrolloni vetëm gazin dhe frenat. Qëllimi është të kaloni pa asnjë shkelje: të mos i merrni përparësinë askujt, të ndaloni aty ku duhet dhe të mos e pengoni trafikun kur përparësia është e juaja.",
  gameStart: "Nis",
  gameDesc:
    "Ngisni në kohë reale — mbani gazin dhe frenat dhe kaloni pa asnjë shkelje. Situatat: përparësia, shenjat, semafori, këmbësorët, polici, rrethrrotullimi dhe autostrada.",
  gameMeta: "koha dhe përparësia",
  gameOpen: "Hap lojën",
  gameRetry: "Provo përsëri",
  gameSpeed: "Shpejtësia",
  gameSpeedLimit: "kufiri",
  gameTime: "Koha",
  gameQuality: "Mbi kohën ideale",
  gamePickLead:
    "Secila situatë ushtron një rregull. Ecuria ruhet në këtë pajisje, kështu që mund të vazhdoni më vonë.",
  gameDifficulty: "Vështirësia",
  gameStatusPassed: "Kaluar",
  gameStatusFailed: "Nuk kaloi",
  gameStatusNew: "Pa provuar",
  gameBestTime: "Më e mira",
  gameAttempts: "përpjekje",
  gameProgress: "Keni kaluar {n} nga {max}",
  gameReplay: "Përsërit 5 sekondat e fundit",
  gameReplaying: "Përsëritje",
  gameBack: "Situatë tjetër",
  gameNextScenario: "Situata tjetër",
  gameRuleTitle: "Rregulli",
  gameLightRed: "E kuqe",
  gameLightYellow: "E verdhë",
  gameLightGreen: "E gjelbër",
  vioPedestrian: "Mosdhënie e përparësisë këmbësorit",
  vioOfficer: "Moszbatim i urdhrit të policit",
  gameSignOfficer: "Polici",
  gameOfficerGo: "kalim",
  gameOfficerStop: "ndal",
  ruleOfficer:
    "Urdhri i punonjësit të policisë është më i fortë edhe se shenjat edhe se semafori. Kur policia rregullon trafikun, drita e semaforit nuk zbatohet.",
  ruleEmergency:
    "Automjetit me përparësi, me dritën rrotulluese dhe sirenën të ndezura, i jepet përparësia pavarësisht shenjave dhe semaforit.",
  vioIndicatorMissing: "Pa tregues drejtimi",
  vioIndicatorWrong: "Treguesi në anën e gabuar",
  vioIndicatorLate: "Treguesi u ndez shumë vonë",
  vioIndicatorLeftOn: "Treguesi u la i ndezur",
  vioUnsafeMerge: "Bashkim i pasigurt në korsi",
  vioStoppedOnRamp: "Ndalim në korsinë e përshpejtimit",
  vioTooSlow: "Ngasje shumë e ngadaltë në autostradë",
  vioTailgating: "Distancë e pamjaftueshme",
  vioBrakingOnHighway: "Frenim i papritur pa arsye",
  vioHardShoulder: "Ngasje në korsinë e emergjencës",
  vioOffRoad: "Dalje nga rruga",
  vioCrossingSolidLine: "Kalim mbi vijën e plotë",
  vioUnsafeOvertake: "Tejkalim i pasigurt",
  vioOvertakeNoVisibility: "Në korsinë e kundërt pa dukshmëri",
  vioOvertakeTooLong: "Shumë gjatë në korsinë e kundërt",
  vioCutIn: "Kthim i papritur para automjetit të tejkaluar",
  gameSteer: "Timoni",
  ruleHardShoulder:
    "Korsia e jashtme është korsi emergjence: në të ecet vetëm përgjatë korsisë së përshpejtimit kur futeni dhe asaj të ngadalësimit para daljes. Përndryshe ajo u rezervohet automjeteve në defekt dhe shërbimeve emergjente.",
  ruleMerge:
    "Në korsi futeni vetëm kur e keni barazuar shpejtësinë dhe kur pas jush ka hapësirë të mjaftueshme. Automjeti që tashmë lëviz në atë korsi nuk duhet të frenojë për shkakun tuaj.",
  ruleHighwaySpeed:
    "Në autostradë ka edhe shpejtësi minimale. Ngasja shumë e ngadaltë e pengon trafikun po aq sa ajo e shpejtë, ndërsa ndalimi në korsinë e përshpejtimit është i rrezikshëm.",
  ruleFollowing:
    "Distanca matet në sekonda, jo në metra: sa më shpejt të ecni, aq më shumë ju duhet. Frenimi i papritur pa arsye i rrezikon ata pas jush.",
  gameLaneLeft: "Në të majtën",
  gameLaneRight: "Në të djathtën",
  gameKeyHintLane: "Shift me shigjetën majtas/djathtas ndërron korsinë.",
  gameTaskMerge: "Po futeni në autostradë.",
  gameTaskOvertake: "Tejkaloni automjetin më të ngadaltë dhe ktheheni në korsinë e djathtë.",
  gameTaskExitHighway: "Po dilni nga autostrada.",
  gameTaskFollow: "Ngisni segmentin e autostradës dhe mbani distancën.",
  ruleIndicator:
    "Qëllimin për t'u kthyer e njoftoni me treguesin e drejtimit para se të hyni në kryqëzim, dhe e mbani të ndezur deri në fund të kthesës. Treguesi është mënyra e vetme që të tjerët të marrin vesh çfarë do të bëni.",
  ruleIndicatorOff:
    "Pas përfundimit të kthesës treguesi fiket. Treguesi i lënë ndezur i mashtron ata që presin të shohin nga po shkoni.",
  gameIndicator: "Treguesi",
  gameIndicatorLeft: "Majtas",
  gameIndicatorRight: "Djathtas",
  gameIndicatorShortLeft: "M",
  gameIndicatorShortRight: "DJ",
  gameIndicatorMode: "Treguesit e drejtimit",
  gameIndicatorAuto: "Automatikisht",
  gameIndicatorManual: "Me dorë",
  gameIndicatorAutoShort: "Auto",
  gameIndicatorAutoHint:
    "Treguesi ndizet vetë, pikërisht kur duhet — vini re kur. Gabimet me treguesin nuk llogariten.",
  gameIndicatorManualHint:
    "Treguesin e ndizni vetë: tastet Q dhe E ose butonat pranë timonit. Gabimet llogariten, edhe gjatë tejkalimit.",
  gameTrafficLevel: "Trafiku në rrugë",
  gameTrafficHint:
    "1 — i rrallë, 5 — i dendur. Vlen për rrugën e hapur dhe rrugët e itinerarit; kryqëzimet në qytet gjatë udhëtimit mbeten të njëjta.",
  gameMinor: "gabim i lehtë",
  gameHazardTitle: "Dikush nuk i respektoi rregullat",
  gameHazardYielded:
    "Përparësia ishte e juaja, por nuk e kishit në dispozicion — ju dhatë përparësi si duhet. Kjo nuk llogaritet kundër jush.",
  gameHazardCollision:
    "Përparësia nuk merret me forcë. Kur shihni se tjetri nuk ndalon, lëvizja e vetme e drejtë është frena.",
  gameReaction: "Koha e reagimit",
  tripTitle: "Udhëtim",
  tripDesc:
    "Ngasje nëpër Mal të Zi, pjesë pas pjese. Në çdo kryqëzim zgjidhni ku të vazhdoni, dhe ofrohen vetëm fqinjët e vërtetë. Një pjesë zgjat rreth katër minuta.",
  tripStart: "Nisu në rrugë",
  tripResume: "Vazhdo udhëtimin",
  tripNew: "Udhëtim i ri",
  tripBack: "Dil nga udhëtimi",
  tripPickStart: "Nga ku niseni?",
  tripWhereTo: "Ku më tej?",
  tripGo: "Nisu",
  tripTurnAround: "Kthehu mbrapsht",
  tripBorderTitle: "Pikë kufitare",
  tripBorderDesc: "Rruga mbaron këtu. Më tej është kufiri — kthehuni dhe ngisni mbrapsht.",
  tripDeadEndTitle: "Fundi i rrugës",
  tripDeadEndDesc: "Rruga mbaron këtu. Kthehuni dhe ngisni mbrapsht.",
  tripArrived: "Keni arritur në",
  tripSeenHere: "Parë në këtë pjesë",
  tripNothingSeen: "Asnjë pikë interesi e regjistruar në këtë pjesë.",
  tripContinue: "Vazhdo",
  tripKm: "Përshkuar",
  tripLegs: "Pjesë",
  tripTowns: "Komuna",
  tripCollected: "Pika interesi",
  tripSummer: "Verë",
  tripSummerHint: "Në verë janë të kalueshme edhe qafat sezonale, si Žabljak — Plužine përmes Trsës.",
  tripTagSeasonal: "sezonale",
  tripTagFerry: "traget",
  tripTagUnverified: "e paverifikuar",
  tripCrash: "Përplasje. Kjo pjesë nis nga fillimi.",
  tripNoted: "Shënuar gjatë rrugës",
  tripCity: "Nëpër qytet",
  tripMap: "Harta",
  tripMapHide: "Fshih hartën",
  rutaTitle: "Itinerari",
  rutaDesc:
    "I gjithë itinerari pa ndërprerje, nëpër rrugët e vërteta të Malit të Zi. Pa ndalesa mes pjesëve.",
  rutaStart: "Ngis itinerarin",
  gradTitle: "Podgorica — ngasje e lirë (provë)",
  gradDesc: "E gjithë Podgorica nga OpenStreetMap, në madhësi reale. Ende pa rregulla dhe pa automjete të tjera — vetëm rrugët, për ta parë qytetin.",
  gradStart: "Ngis nëpër Podgoricë",
  gradLoading: "Po ngarkohet qyteti…",
  gradFailed: "Qyteti nuk u ngarkua.",
  gradNoWebgl: "Kjo pajisje nuk ka WebGL, dhe qyteti vizatohet vetëm me të.",
  gradStreet: "Rruga",
  gradUnnamed: "pa emër",
  gradHint: "Timoni e kthen makinën si një makinë të vërtetë — kthehu ku të duash, por ngadalëso para kthesës. Mbaj frenin kur makina është e ndalur për të ecur mbrapsht; gazi të çon përsëri përpara.",
  gradZoomIn: "Afro",
  gradZoomOut: "Largo",
  gradReverse: "Mbrapsht",
  gradTimeOfDay: "Koha e ditës",
  gradMorning: "Mëngjes",
  gradClock: "Ora në lojë",
  gradDay: "Ditë",
  gradDusk: "Muzg",
  gradNight: "Natë",
  gradWeather: "Moti",
  gradSun: "Diell",
  gradRain: "Shi",
  gradRainNote: "Shi: frenat kapin më pak — distanca e ndalimit është më e gjatë.",
  gradLevel: "Niveli",
  gradViolations: "Shkeljet",
  gradNavDestination: "Destinacioni",
  gradNavChoose: "Zgjidh destinacionin",
  gradNavSearch: "Kërko sipas emrit",
  gradNavRandom: "Rastësisht",
  gradNavClear: "Pa destinacion",
  gradNavClose: "Mbyll",
  gradNavIn: "pas {d}",
  gradNavTurnLeft: "Kthehu majtas",
  gradNavTurnRight: "Kthehu djathtas",
  gradNavUTurn: "Kthehu mbrapsht (U)",
  gradNavRoundabout: "Rrethrrotullim: dalja {n}",
  gradNavStraight: "Drejt",
  gradNavOnto: "në {ulica}",
  gradNavArrived: "Arrite: {cilj}",
  gradNavRemaining: "edhe {d}",
  gradNavRerouting: "Rrugë e re…",
  gradNavNoRoute: "Nga këtu nuk ka rrugë për këtë destinacion.",
  gradKatSkola: "Shkolla dhe fakultete",
  gradKatZdravlje: "Shëndetësia",
  gradKatUstanova: "Institucione",
  gradKatKultura: "Kultura",
  gradKatBogomolja: "Objekte fetare",
  gradKatStanica: "Stacione",
  gradKatSport: "Sport",
  gradKatTrgovina: "Qendra tregtare dhe tregje",
  gradKatZnamenitost: "Pika të njohura",
  gradStatClean: "Pa shkelje: {n} min",
  gradStatToday: "Sot: {km} km · {cisto} min pa shkelje · {prekrsaji} shkelje",
  gradMiniMap: "Harta e vogël",
  gradOsmAttribution: "© OpenStreetMap",
  gradOdDo: "Udhëtim nga–deri",
  gradOdDoIntro: "Ngisni deri te destinacioni sipas rregullave. Pikët: ngasja pa shkelje dhe koha. Vështirësia përcakton gjatësinë e rrugës, dendësinë e trafikut dhe rreptësinë e gjykatësit.",
  gradOdDoEasy: "Lehtë",
  gradOdDoMedium: "Mesatare",
  gradOdDoHard: "Vështirë",
  gradOdDoRange: "{od}–{do} km · niveli {nivo}",
  gradOdDoRandom: "Destinacion i rastësishëm",
  gradOdDoPick: "Zgjidh destinacionin",
  gradOdDoCancel: "Ndalo nga–deri",
  gradOdDoTimer: "Nga–deri · {vrijeme}",
  gradOdDoDone: "Në destinacion: {cilj}",
  gradOdDoScore: "{bodovi} / 1000 pikë",
  gradOdDoRules: "Ngasja sipas rregullave: {n} / {max}",
  gradOdDoTime: "Koha {vrijeme} (e pritur {ref}): {n} / {max}",
  gradOdDoViolations: "Shkelje: {minor} të lehta, {fail} të rënda",
  gradOdDoStars: "{n} nga 3 yje",
  gradOdDoBest: "Më e mira deri tani: {n}",
  gradOdDoNewBest: "Rezultat i ri më i mirë!",
  gradOdDoAgain: "Udhëtim i ri",
  gradOdDoNoTarget: "Nuk ka destinacion për këtë vështirësi.",
  gradExam: "Rruga e provimit",
  gradExamIntro: "Rrugë si në provim: nis nga i njëjti vend, kalon pikat e detyrueshme me radhë dhe mbaron në cak. Provimi bie me çdo shkelje të rëndë ose me më shumë se {n} të lehta.",
  gradExamRouteInfo: "{km} km · {n} pika",
  gradExamHud: "Provim · pika {k}/{n} · {vrijeme}",
  gradExamCancel: "Ndalo provimin",
  gradExamPoint: "Pika e detyrueshme {k} nga {n}",
  gradExamPassed: "I kaluar",
  gradExamFailed: "I pakaluar",
  gradExamSummary: "Të lehta: {minor} · të rënda: {fail} · koha {vrijeme} · {km} km",
  gradExamRule: "Provimi bie me çdo shkelje të rëndë ose me më shumë se {n} të lehta.",
  gradExamRecord: "Procesverbali",
  gradExamMinor: "Të lehta",
  gradExamSerious: "Të rënda",
  gradExamAgain: "Përsërit provimin",
  gradExamCatJunctions: "Kryqëzime dhe përparësi",
  gradExamCatSpeed: "Shpejtësia",
  gradExamCatSigns: "Shenja, semaforë dhe vija",
  gradExamCatPedestrians: "Këmbësorët",
  gradExamCatLane: "Pozicioni në rrugë dhe korsitë",
  gradExamCatManoeuvres: "Manovrat dhe sinjalet",
  vioWrongWay: "Ngasje në drejtim të kundërt në rrugë njëkahëshe",
  vioTurnBan: "Kthesë aty ku shenja e ndalon",
  vioUTurn: "Kthim prapa aty ku është i ndaluar",
  vioWrongSide: "Ngasje në anën e majtë të rrugës",
  vioStopping: "Ndalim në vend të ndaluar",
  gradRuleRed: "Me dritë të kuqe nuk kalohet vija e ndalimit.",
  gradRuleAmber: "Me dritë të verdhë kalohet vetëm kur nuk mund të ndalosh në siguri — këtu mundeshe.",
  gradRuleStop: "Te shenja STOP makina duhet të ndalojë plotësisht para vijës së ndalimit.",
  gradRuleCollision: "Godite një automjet tjetër. Mbaj distancën dhe jepi përparësi atij që e ka.",
  gradRuleRightOfWay: "Një automjet që kishte përparësi u detyrua të frenonte fort për shkakun tënd.",
  gradRulePedestrianCrossing: "Këmbësori ishte në vendkalim dhe ende nuk e kishte kaluar gjysmën tënde të rrugës. Ndalo para zebrës dhe lëre të kalojë.",
  gradRulePedestrianIntent: "Këmbësori priste në trotuar pranë zebrës, ndërsa ti ende mund të ndaloje qetë. Këmbësorit që tregon qëllimin për të kaluar i jepet përparësia.",
  gradRuleRedLightPedestrian: "Kalove në të kuqe te semafori i vendkalimit të këmbësorëve. Kur këmbësorët kanë jeshile, automjetet ndalojnë.",
  gradRulePedestrianCollision: "Godite një këmbësor. Drejtimi mbaroi — ki kujdes për këmbësorët në vendkalime dhe për ata që dalin në rrugë.",
  gradRuleBusDeparture:
    "Në vendbanim duhet t'i lejosh autobusit që sinjalizon nisjen nga stacioni të hyjë në trafik: ngadalëso dhe lëre të kalojë — mos e parakalo ndërsa niset.",
  gradRuleEmergencyVehicle:
    "Automjetit me drita rrotulluese dhe sirenë që vjen pas teje duhet t'i lësh kalim të lirë: shmangu djathtas dhe ngadalëso ose ndalo. Në të kuqe mund ta kalosh me kujdes vijën e ndalimit për t'i bërë vend, por jo të hysh në kryqëzim.",
  gradHitTitle: "Drejtimi u ndërpre",
  gradHitText: "Në një provim të vërtetë kjo e mbyll provimin — dhe është pasoja më e rëndë e një gabimi në timon.",
  gradHitAgain: "Drejto përsëri",
  gradRuleWrongWay: "Rruga njëkahëshe ngiset vetëm në drejtimin e lejuar — në hyrje të saj është shenja e ndalimit të hyrjes.",
  gradRuleTurnBan: "Shenja në atë krah të kryqëzimit e ndalon këtë drejtim.",
  gradRuleUTurnSignal: "Kthimi prapa është i ndaluar në kryqëzim me semafor.",
  gradRuleUTurnBridge: "Kthimi prapa është i ndaluar në urë.",
  gradRuleUTurnTunnel: "Kthimi prapa është i ndaluar në tunel.",
  gradRuleSpeeding: "Kufiri është {ogranicenje} km/h, ndërsa makina ecte me {brzina} km/h.",
  gradRuleWrongSide: "Në rrugë dykahëshe ngiset në anën e djathtë; në të majtën vetëm shkurt, për parakalim ose anashkalim.",
  gradRuleStopZebra: "Në vendkalimin e këmbësorëve nuk ndalohet.",
  gradRuleStopJunction: "Në kryqëzim nuk ndalohet, përveç kur e kërkon trafiku.",
  gradRuleStopBus: "Në stacionin e autobusit nuk ndalohet.",
  vioWrongLane: "Kthesë nga korsia e gabuar",
  vioRoundaboutLane: "Korsi e gabuar në rrethrrotullim",
  gradRuleIndicatorMissing: "Para kthesës sinjali ndizet në anën e kthesës — më së voni kur makina hyn në kryqëzim.",
  gradRuleIndicatorWrong: "Sinjali ishte ndezur në anën e gabuar.",
  gradRuleIndicatorLate: "Sinjali u ndez vetëm brenda kryqëzimit — vonë që të tjerët ta shohin qëllimin.",
  gradRuleIndicatorStraight: "Kur ngisni drejt, sinjali nuk ndizet.",
  gradRuleIndicatorLeftOn: "Pas kthesës sinjali fiket.",
  gradRuleIndicatorRoundabout: "Kur del nga rrethrrotullimi ndizet sinjali i djathtë.",
  gradRuleWrongLane: "Shigjetat në rrugë tregojnë ku lejohet të shkohet nga çdo korsi — nga kjo korsi jo në këtë drejtim.",
  gradRuleRoundaboutOuter: "Në rrethrrotullim me dy korsi: për djathtas dhe drejt përdoret korsia e jashtme — e brendshmja është për majtas dhe rrotullim të plotë.",
  gradRuleRoundaboutInner: "Në rrethrrotullim me dy korsi: për majtas dhe rrotullim të plotë përdoret korsia e brendshme — e jashtmja është për djathtas dhe drejt.",
  vioBusLane: "Ngasja në korsinë e autobusit",
  gradRuleSolidLine: "Vija e plotë nuk kalohet dhe nuk ngasesh mbi të.",
  gradRuleBusLane: "Në korsinë e autobusit ngasin vetëm automjetet e transportit publik dhe ato me shoqërim — të tjerët mund vetëm ta kalojnë, ose të hyjnë për të kthyer.",
  gradRuleNoEntry: "Shenja ndalim hyrjeje: në atë rrugë nuk hyhet nga kryqëzimi.",
  gradRuleMandatory: "Shenja e drejtimit të detyrueshëm në këtë krah lejon vetëm: {smjer}.",
  gradRuleRedManeuver: "Për drejtimin {manevar} drita ishte e kuqe — drita me shigjetë vlen për drejtimin e vet.",
  gradManeuverLeft: "majtas",
  gradManeuverStraight: "drejt",
  gradManeuverRight: "djathtas",
  gradManeuverUTurn: "kthim në U",
  rutaFrom: "Nga",
  rutaTo: "Deri",
  rutaPrepare: "Po përgatis rrugën…",
  rutaGo: "Nisu",
  rutaLegs: "Pjesa",
  rutaLeft: "Mbetur",
  rutaSurroundings: "Rrethina",
  rutaMap: "Harta e Malit të Zi",
  osmKratko: "© OpenStreetMap contributors (ODbL)",
  osmPuno: "Të dhënat për rrugët dhe rrethinat: © OpenStreetMap contributors (ODbL)",
  oIgriTitle: "Për lojën",
  oIgriDesc:
    "Ushtrim për provimin e drejtimit: të gjitha situatat, udhëtimi dhe itineraret ndjekin rregullat e Ligjit për siguri në komunikacion. Rrugët, qytetet dhe rrethinat janë reale — distancat janë ngjeshur që ngasja të zë një orë.",
  rutaDone: "Mbërritët.",
  rutaCrash: "Përplasje. Itinerari nis nga fillimi.",
  rutaNoRoute: "Grafi nuk ka rrugë mes atyre dy vendeve.",
  rutaFailed: "Rruga nuk u përgatit dot.",
  tripCrashJunction: "Përplasje. Ky kryqëzim nis nga fillimi.",
  tripRetry: "Ngis përsëri",
  tripRoadAutoput: "autostradë",
  tripRoadMagistrala: "rrugë magjistrale",
  tripRoadRegionalni: "rrugë rajonale",
  tripRoadPlaninski: "rrugë malore",
  shiftTitle: "Turni",
  shiftDesc:
    "Kryqëzim pas kryqëzimi, pa fund, dhe nga niveli i dytë edhe ndonjë segment autostrade. Tri jetë; vështirësia rritet ndërsa ngisni pastër dhe bie kur gabon.",
  shiftStart: "Fillo turnin",
  shiftLives: "Jetët",
  shiftLevel: "Niveli",
  shiftSegments: "Kryqëzime",
  shiftStreak: "Seria më e gjatë",
  shiftOver: "Turni mbaroi",
  shiftBest: "Më i miri",
  shiftAgain: "Turn i ri",
  shiftSkip: "Vazhdo",
  shiftLostLife: "Humbët një jetë",
  shiftNoReaction: "pa matje",
  shiftBack: "Dil nga turni",
  gameSoundOn: "Fik zërin",
  gameSoundOff: "Ndiz zërin",
  gameTimelineTitle: "Treguesi përgjatë trajektores",
  gameTimelineExpected: "kërkohet",
  gameTimelineActual: "ju",
  gameTimelineOff: "i fikur",
  gameKeyHintIndicator: "Shigjetat majtas dhe djathtas e ndezin dhe e fikin treguesin.",
  ruleObstruction:
    "Kur përparësia është e juaja dhe rruga është e lirë, jeni i detyruar të vazhdoni. Ndalimi i panevojshëm në kryqëzim e pengon trafikun dhe në vetvete është shkelje.",
  ruleSpeeding:
    "Shpejtësia përshtatet me kufirin dhe me kushtet. Tejkalimi në afrim të kryqëzimit e shkurton rrugën e frenimit dhe kohën për të vendosur.",
  gameThrottle: "Gazi",
  gameBrake: "Frenat",
  gameKeyHint: "Në tastierë: shigjeta lart është gazi, shigjeta poshtë është frena.",
  gamePassed: "Kaluat pa asnjë shkelje",
  gameFailed: "Ngasja nuk ishte e rregullt",
  gameViolationsTitle: "Shkeljet",
  gameHowTo: "Si duhej vepruar",
  gameTaskStraight: "Vazhdoni drejt përmes kryqëzimit.",
  gameTaskLeft: "Kthehuni majtas.",
  gameTaskRight: "Kthehuni djathtas.",
  gameTaskExit: "Dilni në daljen {n}.",
  gameTaskFullCircle: "Bëni rrethin e plotë dhe ktheheni nga erdhët.",
  gameSignPriority: "Rrugë me përparësi",
  gameSignYield: "Jepi përparësi",
  gameSignStop: "Ndalim i detyrueshëm",
  gameSignNone: "Pa shenjë — rregulli i së djathtës",
  vioRightOfWay: "Mosdhënie e përparësisë",
  vioStopSign: "Kalim i vijës së ndalimit pa ndaluar",
  vioRedLight: "Kalim në dritën e kuqe",
  vioCollision: "Përplasje",
  vioPedestrianRightOfWay: "Nuk i dhe përparësi këmbësorit",
  vioRedLightPedestrian: "E kuqe te semafori i këmbësorëve",
  vioPedestrianCollision: "Goditje e këmbësorit",
  vioBusDeparture: "Pengim i nisjes së autobusit",
  vioEmergencyVehicle: "Moslënia e kalimit automjetit të urgjencës",
  vioObstruction: "Pengim i trafikut",
  vioSpeeding: "Tejkalim i shpejtësisë së lejuar",

  loading: "Duke ngarkuar pyetjet…",
  loadErrorTitle: "Gabim gjatë ngarkimit të pyetjeve",
  noQuestions: "Nuk ka pyetje në kategorinë e zgjedhur. Zgjidhni një tjetër.",
  question: "Pyetja",
  progress: "Ecuria nëpër pyetje",
  next: "Pyetja tjetër",
  newRound: "Raund i ri",
  finishExam: "Përfundo provimin",
  pageLabel: "Faqja",
  prevPage: "E mëparshmja",
  nextPage: "Tjetra",
  check: "Kontrollo",
  correctAnswerLabel: "Saktë",
  yourAnswerLabel: "Përgjigjja juaj",
  correctFeedback: "Përgjigje e saktë",
  wrongFeedback: "Përgjigje e gabuar",
  remaining: "Mbetur",
  answeredLabel: "Të përgjigjura",
  correctLabel: "Saktë",
  inPool: "pyetje në dispozicion",
  explanationTitle: "Shpjegim",
  questionsOnlyInMe: "Pyetjet janë të disponueshme në gjuhën malazeze.",
  translationMissing: "Përkthimi nuk është i disponueshëm — shfaqur në malazeze.",
  briefingTitle: "Para se të filloni",
  briefingLead: "Lexoni udhëzimin, pastaj konfirmoni se e keni lexuar.",
  briefingConfirm: "E kam lexuar udhëzimin",
  briefingStart: "Fillo testin",
  briefingDisclaimer:
    "Ky është simulim për ushtrim. Provimin zyrtar e zhvillon organi kompetent dhe të dhënat për kushtet e daljes në provim janë informative — verifikoni ato në auto-shkollë.",
  penaltyTitle: "Sa do t'ju kushtonte kjo në komunikacion",
  penaltyTotal: "Në komunikacion, këto gabime do të kushtonin",
  penaltyNote:
    "Vetëm informative, sipas Ligjit për sigurinë e komunikacionit rrugor. Shumën përfundimtare e cakton organi kompetent dhe krahas gjobës mund të vijnë edhe pikë ndëshkuese.",
  penaltyLanguageNote: "Teksti i dënimit është në malazezisht — e konfirmon instruktori i autoshkollës.",
  penaltyListTitle: "Dënimet",
  penaltyListLead: "Gjobat sipas Ligjit për sigurinë e komunikacionit rrugor. Shumat janë informative — vlen ligji në fuqi dhe vendimi i organit kompetent.",
  penaltyListSearch: "Kërko dënim",
  penaltyListEmpty: "Asnjë dënim nuk përputhet me kërkimin.",
  penaltyListChecked: "Kontrolluar së fundmi:",

  navTitle: "Pasqyra e pyetjeve",
  navAnswered: "të përgjigjura",
  navUnanswered: "pa përgjigje",
  navJump: "Shko te pyetja",
  confirmLeaveExam:
    "Provimi është duke u zhvilluar. Nëse dilni, përgjigjet humbasin. Dëshironi të dilni?",

  orderingLabel: "Radha e kalimit të automjeteve",
  orderingHint:
    "Shkruani numrat sipas radhës së kalimit — me vizë, me hapësirë ose pa asgjë ndërmjet.",
  orderingEntered: "Shkruar",
  orderingCorrectIs: "radha e saktë është",

  badgeSign: "Shenjë rrugore",
  badgePolice: "Sinjali i policisë",
  badgeMarking: "Shenjat në karrexhatë",
  badgeTrafficLight: "Semafori",
  badgeIntersection: "Kryqëzim",
  badgeOrdering: "Radha e kalimit",
  badgeFirstAid: "Ndihma e parë",
  badgeText: "Pyetje me tekst",

  resultTitle: "Rezultati i simulimit",
  passed: "Kaluar",
  failed: "Nuk kaloi",
  passThreshold: "Për të kaluar nevojiten {n} nga {max} pikë.",
  timedOutNote: "Provimi u ndal sepse koha skadoi.",
  statCorrect: "Saktë",
  statWrong: "Gabim",
  statUnanswered: "Pa përgjigje",
  resultSummaryTitle: "Pasqyra sipas pyetjeve",
  statAnswered: "Të përgjigjura",
  newExam: "Provim i ri",
  backToStart: "Kthehu në fillim",
  reviewTitle: "Shqyrtimi i gabimeve",
  reviewLead: "Kaloni nëpër pyetjet që nuk i zgjidhët saktë — bashkë me përgjigjen e saktë.",
  reviewPerfect: "Të gjitha përgjigjet janë të sakta. S'ka çfarë të përsëritet.",
  reviewNoAnswer: "Pa përgjigje",
  reviewWrong: "Gabim",

  litTitle: "Literatura",
  litLead: "Burimet zyrtare mbi të cilat bazohet materiali i provimit:",

  catAll: "Të gjitha",
  catText: "Me tekst",
  catImage: "Me foto",
  catSign: "Shenjat",
  catIntersection: "Kryqëzimet",
  catOrdering: "Radha e kalimit",
  catFirstAid: "Ndihma e parë",
};

const ru: Dict = {
  back: "Назад",
  close: "Закрыть",
  literature: "Источники",
  langLabel: "Язык",
  temaLabel: "Оформление",
  temaSvijetla: "Светлая тема",
  temaTamna: "Тёмная тема",
  prijavaDugme: "Сообщить об ошибке",
  prijavaVrsta: "Тип ошибки",
  prijavaVrstaOdgovor: "Неверный ответ",
  prijavaVrstaTekst: "Ошибка в тексте или переводе",
  prijavaVrstaSlika: "Проблема с изображением",
  prijavaVrstaSajt: "Сайт работает неправильно",
  prijavaVrstaDrugo: "Другое",
  prijavaOpis: "Описание",
  prijavaOpisPomoc: "Что не так?",
  prijavaKontakt: "Эл. почта или телефон (необязательно)",
  prijavaKontaktPomoc: "Только если хотите, чтобы мы с вами связались.",
  prijavaPosalji: "Отправить",
  prijavaSalje: "Отправка…",
  prijavaHvala: "Спасибо! Сообщение отправлено.",
  prijavaGreska: "Не удалось отправить. Попробуйте ещё раз.",
  prijavaPrevise: "Отправлено слишком много сообщений. Попробуйте позже.",
  prijavaKratko: "Кратко опишите ошибку.",
  prijavaIspitVrijeme: "Время экзамена идёт, пока вы пишете.",
  igraPodesavanja: "Настройки",
  igraZatvoriPodesavanja: "Закрыть настройки",
  footerNote:
    "База вопросов предназначена только для подготовки и тренировки. Официальный экзамен проводит компетентный орган.",

  landingTitle: "Подготовьтесь к теоретическому экзамену",
  landingLead:
    "Выберите режим. Тренируйтесь без спешки, сразу видя правильный ответ, или проверьте знания в условиях настоящего экзамена.",
  heroLabel1: "Теоретический тест",
  heroLabel2: "Категория B",
  heroTitle1: "Автошкола Mirav",
  heroTitle2: "Готовы к экзамену.",
  heroLead: "Вопросы категории B на пяти языках. Тренируйтесь без спешки, затем проверьте себя в условиях настоящего экзамена.",
  practiceMeta: "Без таймера · ответ сразу",
  menuLabel: "Меню",
  practiceTitle: "Тренировка",
  practiceDesc:
    "Вы выбираете категорию вопросов; каждый ответ проверяется сразу и показывается правильное решение. Без таймера и ограничений.",
  practiceStart: "Начать тренировку",
  practiceResume: "Продолжить с того же места",
  categoryLabel: "Категория",
  examTitle: "Симуляция экзамена",
  examDesc:
    "Случайные вопросы из всей базы, правильные ответы не показываются до конца экзамена. В конце вы получаете баллы и оценку прохождения.",
  examStart: "Начать экзамен",
  metaPoints: "баллов",
  metaQuestions: "вопросов",
  metaMinutes: "минут",
  metaPass: "порог",
  examLimitationNote:
    "Примечание: наша база содержит только вопросы с одним правильным ответом.",
  bestResult: "Лучший результат",

  simTitle: "Симулятор перекрёстков",
  simDesc:
    "Ситуации из каталога: нажимайте на автомобили в том порядке, в котором они проезжают. Тренировка приоритета проезда без ввода цифр.",
  simStart: "Начать симулятор",
  simMeta: "приоритет проезда",
  simTask: "Нажимайте на автомобили в порядке их проезда.",
  simNotAllPass:
    "Проезжают не обязательно все автомобили — нажимайте только те, у которых есть право проезда.",
  simYourOrder: "Ваш порядок",
  simCorrectOrder: "Правильный порядок",
  simClear: "Сбросить",
  simNextScene: "Следующая ситуация",
  simScene: "Ситуация",
  simVehicle: "Автомобиль",
  simStreak: "Серия",
  simFinished: "Вы прошли все ситуации.",
  simRestart: "Начать заново",
  simEmpty: "Нет доступных ситуаций.",
  simFamilyRule: "Правило правой руки",
  simFamilyCatalog: "Из каталога",
  simFamilySigns: "Главная и второстепенная дорога",
  simFamilyLights: "Светофор",
  simFamilyLeft: "Поворот налево",
  simFamilyRoundabout: "Круговое движение",
  simFamilyPedestrian: "Пешеходы",
  simUncontrolled:
    "Перекрёсток без знаков и светофора. Все автомобили едут прямо.",
  simSceneSigns: "Обратите внимание на знаки на подъездах.",
  simSceneLights: "Обратите внимание на сигналы светофора.",
  simSceneRoundabout: "Круговое движение. Ваш автомобиль отмечен.",
  simScenePedestrian: "Пешеход на переходе. Ваш автомобиль отмечен.",
  simTapInScene: "Нажимайте на автомобили на рисунке в порядке их проезда.",
  simDecisionTask: "Вы проезжаете или уступаете?",
  simGo: "Проезжаю",
  simYield: "Уступаю",
  simYourVehicle: "ваш автомобиль",
  ruleTitle: "Правило",
  ruleRightHand:
    "На перекрёстке без знаков и светофора приоритет имеет автомобиль, приближающийся справа.",
  ruleFreeRight: "Первым проезжает автомобиль, у которого никого нет справа.",
  rulePriorityRoad:
    "Автомобили на главной дороге проезжают раньше автомобилей со второстепенной, независимо от того, с какой стороны они приближаются.",
  ruleYieldSign:
    "Знак «уступите дорогу» означает, что вы пропускаете автомобили на главной дороге.",
  ruleStopSign:
    "Знак STOP требует полной остановки; по приоритету он равен знаку «уступите дорогу».",
  ruleLeftTurn:
    "Автомобиль, поворачивающий налево, уступает встречному автомобилю, который едет прямо или поворачивает направо.",
  ruleGreenNotFree:
    "Зелёный сигнал не безусловен: между автомобилями на зелёном по-прежнему действует обязанность уступить при повороте.",
  ruleRedStops: "Автомобиль на красный или жёлтый сигнал останавливается и не проезжает.",
  ruleRoundabout:
    "При въезде в круговое движение вы уступаете автомобилям, уже движущимся по кругу.",
  ruleRoundaboutLeft:
    "По кругу движение идёт против часовой стрелки, поэтому автомобили в кольце приближаются слева.",
  ruleRoundaboutExit:
    "Автомобиль, покидающий круг до вашего въезда, не пересекает вам путь — его пропускать не нужно.",
  rulePedestrian:
    "Пешехода на переходе, через который вы проезжаете, необходимо пропустить.",

  gameTitle: "Проезд перекрёстка",
  gameLead:
    "Автомобиль едет по заданной траектории — вы управляете только газом и тормозом. Задача — проехать без единого нарушения: никому не создать помеху, остановиться там, где положено, и не задерживать движение, когда преимущество у вас.",
  gameStart: "Поехали",
  gameDesc:
    "Езда в реальном времени — управляйте газом и тормозом и проедьте без единого нарушения. Ситуации: преимущество, знаки, светофор, пешеходы, регулировщик, круговое движение и автомагистраль.",
  gameMeta: "тайминг и преимущество",
  gameOpen: "Открыть игру",
  gameRetry: "Ещё раз",
  gameSpeed: "Скорость",
  gameSpeedLimit: "ограничение",
  gameTime: "Время",
  gameQuality: "Сверх идеального времени",
  gamePickLead:
    "Каждая ситуация отрабатывает одно правило. Результат сохраняется на этом устройстве, так что можно продолжить позже.",
  gameDifficulty: "Сложность",
  gameStatusPassed: "Пройдено",
  gameStatusFailed: "Не пройдено",
  gameStatusNew: "Не пробовали",
  gameBestTime: "Лучшее",
  gameAttempts: "попыток",
  gameProgress: "Пройдено {n} из {max}",
  gameReplay: "Повтор последних 5 с",
  gameReplaying: "Повтор",
  gameBack: "Другая ситуация",
  gameNextScenario: "Следующая ситуация",
  gameRuleTitle: "Правило",
  gameLightRed: "Красный",
  gameLightYellow: "Жёлтый",
  gameLightGreen: "Зелёный",
  vioPedestrian: "Непредоставление преимущества пешеходу",
  vioOfficer: "Невыполнение указания сотрудника полиции",
  gameSignOfficer: "Регулировщик",
  gameOfficerGo: "проезд",
  gameOfficerStop: "стоп",
  ruleOfficer:
    "Указание сотрудника полиции имеет преимущество и над знаками, и над светофором. Когда движением управляет регулировщик, сигнал светофора не выполняется.",
  ruleEmergency:
    "Транспортному средству с включённым проблесковым маячком и сиреной уступают дорогу независимо от знаков и светофора.",
  vioIndicatorMissing: "Без указателя поворота",
  vioIndicatorWrong: "Указатель включён не в ту сторону",
  vioIndicatorLate: "Указатель включён слишком поздно",
  vioIndicatorLeftOn: "Указатель оставлен включённым",
  vioUnsafeMerge: "Небезопасное перестроение",
  vioStoppedOnRamp: "Остановка на полосе разгона",
  vioTooSlow: "Слишком медленная езда по автомагистрали",
  vioTailgating: "Недостаточная дистанция",
  vioBrakingOnHighway: "Резкое торможение без причины",
  vioHardShoulder: "Движение по полосе аварийной остановки",
  vioOffRoad: "Съезд с проезжей части",
  vioCrossingSolidLine: "Пересечение сплошной линии",
  vioUnsafeOvertake: "Опасный обгон",
  vioOvertakeNoVisibility: "Выезд на встречную без обзора",
  vioOvertakeTooLong: "Слишком долго на встречной полосе",
  vioCutIn: "Резкое возвращение перед обогнанным",
  gameSteer: "Руль",
  ruleHardShoulder:
    "Внешняя полоса — аварийная: по ней едут только вдоль полосы разгона при въезде и полосы торможения перед съездом. В остальном она предназначена для неисправных машин и экстренных служб.",
  ruleMerge:
    "В полосу перестраиваются только после того, как сравняли скорость и убедились, что сзади достаточно места. Автомобиль, уже едущий по этой полосе, не должен тормозить из-за вас.",
  ruleHighwaySpeed:
    "На автомагистрали есть и минимальная скорость. Слишком медленная езда мешает движению не меньше быстрой, а остановка на полосе разгона опасна.",
  ruleFollowing:
    "Дистанция измеряется в секундах, а не в метрах: чем выше скорость, тем больше нужно. Резкое торможение без причины подвергает опасности едущих сзади.",
  gameLaneLeft: "В левую",
  gameLaneRight: "В правую",
  gameKeyHintLane: "Shift со стрелкой влево/вправо меняет полосу.",
  gameTaskMerge: "Вы въезжаете на автомагистраль.",
  gameTaskOvertake: "Вы обгоняете более медленный автомобиль и возвращаетесь в правую полосу.",
  gameTaskExitHighway: "Вы съезжаете с автомагистрали.",
  gameTaskFollow: "Проезжайте участок автомагистрали и держите дистанцию.",
  ruleIndicator:
    "О намерении повернуть вы сообщаете указателем поворота до въезда на перекрёсток и держите его включённым до конца манёвра. Указатель — единственный способ для остальных узнать, что вы собираетесь сделать.",
  ruleIndicatorOff:
    "После завершения поворота указатель выключается. Оставленный указатель вводит в заблуждение тех, кто ждёт, чтобы понять, куда вы едете.",
  gameIndicator: "Указатель",
  gameIndicatorLeft: "Налево",
  gameIndicatorRight: "Направо",
  gameIndicatorShortLeft: "Л",
  gameIndicatorShortRight: "П",
  gameIndicatorMode: "Указатели поворота",
  gameIndicatorAuto: "Автоматически",
  gameIndicatorManual: "Вручную",
  gameIndicatorAutoShort: "Авто",
  gameIndicatorAutoHint:
    "Указатель включается сам, именно тогда, когда нужно, — следите, когда. Ошибки с указателем не засчитываются.",
  gameIndicatorManualHint:
    "Указатель включаете вы: клавиши Q и E или кнопки рядом с рулём. Ошибки засчитываются, в том числе при обгоне.",
  gameTrafficLevel: "Движение на дороге",
  gameTrafficHint:
    "1 — редкое, 5 — плотное. Действует на открытой дороге и на улицах маршрута; перекрёстки в городе во время поездки не меняются.",
  gameMinor: "лёгкая ошибка",
  gameHazardTitle: "Кто-то нарушил правила",
  gameHazardYielded:
    "Преимущество было вашим, но воспользоваться им было нельзя — вы правильно уступили. Против вас это не засчитывается.",
  gameHazardCollision:
    "Преимущество не берут силой. Когда видно, что другой не останавливается, единственно правильное действие — торможение.",
  gameReaction: "Время реакции",
  tripTitle: "Путешествие",
  tripDesc:
    "Поездка по Черногории, участок за участком. На каждом перекрёстке вы выбираете, куда дальше, и предлагаются только настоящие соседи. Участок занимает около четырёх минут.",
  tripStart: "В путь",
  tripResume: "Продолжить путешествие",
  tripNew: "Новое путешествие",
  tripBack: "Выйти из путешествия",
  tripPickStart: "Откуда начинаете?",
  tripWhereTo: "Куда дальше?",
  tripGo: "Ехать",
  tripTurnAround: "Развернуться",
  tripBorderTitle: "Пограничный переход",
  tripBorderDesc: "Здесь дорога заканчивается. Дальше граница — развернитесь и возвращайтесь.",
  tripDeadEndTitle: "Конец дороги",
  tripDeadEndDesc: "Здесь дорога заканчивается. Развернитесь и возвращайтесь тем же путём.",
  tripArrived: "Вы прибыли в",
  tripSeenHere: "Увидено на этом участке",
  tripNothingSeen: "На этом участке достопримечательности не отмечены.",
  tripContinue: "Дальше",
  tripKm: "Пройдено",
  tripLegs: "Участков",
  tripTowns: "Общин",
  tripCollected: "Достопримечательности",
  tripSummer: "Лето",
  tripSummerHint: "Летом проходимы и сезонные перевалы, например Жабляк — Плужине через Трсу.",
  tripTagSeasonal: "сезонная",
  tripTagFerry: "паром",
  tripTagUnverified: "не проверено",
  tripCrash: "Авария. Этот участок начинается заново.",
  tripNoted: "Отмечено в пути",
  tripCity: "По городу",
  tripMap: "Карта",
  tripMapHide: "Скрыть карту",
  rutaTitle: "Маршрут",
  rutaDesc:
    "Весь маршрут за один раз, по настоящим дорогам Черногории. Без остановок между участками.",
  rutaStart: "Проехать маршрут",
  gradTitle: "Подгорица — свободная езда (пробно)",
  gradDesc: "Вся Подгорица из OpenStreetMap в реальном масштабе. Пока без правил и без других машин — только улицы, чтобы осмотреть город.",
  gradStart: "Ехать по Подгорице",
  gradLoading: "Загружаю город…",
  gradFailed: "Город не загрузился.",
  gradNoWebgl: "На этом устройстве нет WebGL, а город рисуется только с ним.",
  gradStreet: "Улица",
  gradUnnamed: "без названия",
  gradHint: "Руль поворачивает машину как настоящую — поворачивайте где хотите, но сбавляйте скорость перед поворотом. Удерживайте тормоз на месте, чтобы включить задний ход; газ снова везёт вперёд.",
  gradZoomIn: "Приблизить",
  gradZoomOut: "Отдалить",
  gradReverse: "Задний ход",
  gradTimeOfDay: "Время суток",
  gradMorning: "Утро",
  gradClock: "Время в игре",
  gradDay: "День",
  gradDusk: "Сумерки",
  gradNight: "Ночь",
  gradWeather: "Погода",
  gradSun: "Солнце",
  gradRain: "Дождь",
  gradRainNote: "Дождь: тормоза держат хуже — тормозной путь длиннее.",
  gradLevel: "Уровень",
  gradViolations: "Нарушения",
  gradNavDestination: "Цель",
  gradNavChoose: "Выберите цель",
  gradNavSearch: "Поиск по названию",
  gradNavRandom: "Случайно",
  gradNavClear: "Без цели",
  gradNavClose: "Закрыть",
  gradNavIn: "через {d}",
  gradNavTurnLeft: "Поверните налево",
  gradNavTurnRight: "Поверните направо",
  gradNavUTurn: "Развернитесь",
  gradNavRoundabout: "Круговое движение: {n}-й съезд",
  gradNavStraight: "Прямо",
  gradNavOnto: "на {ulica}",
  gradNavArrived: "Вы прибыли: {cilj}",
  gradNavRemaining: "осталось {d}",
  gradNavRerouting: "Новый маршрут…",
  gradNavNoRoute: "Отсюда до этой цели нет пути.",
  gradKatSkola: "Школы и факультеты",
  gradKatZdravlje: "Здравоохранение",
  gradKatUstanova: "Учреждения",
  gradKatKultura: "Культура",
  gradKatBogomolja: "Храмы",
  gradKatStanica: "Вокзалы",
  gradKatSport: "Спорт",
  gradKatTrgovina: "Торговые центры и рынки",
  gradKatZnamenitost: "Достопримечательности",
  gradStatClean: "Без нарушений: {n} мин",
  gradStatToday: "Сегодня: {km} км · {cisto} мин без нарушений · нарушений {prekrsaji}",
  gradMiniMap: "Мини-карта",
  gradOsmAttribution: "© OpenStreetMap",
  gradOdDo: "Поездка из А в Б",
  gradOdDoIntro: "Доедьте до цели по правилам. Очки: езда без нарушений и время. Сложность задаёт длину маршрута, плотность движения и строгость экзаменатора.",
  gradOdDoEasy: "Легко",
  gradOdDoMedium: "Средне",
  gradOdDoHard: "Сложно",
  gradOdDoRange: "{od}–{do} км · уровень {nivo}",
  gradOdDoRandom: "Случайная цель",
  gradOdDoPick: "Выбрать цель",
  gradOdDoCancel: "Прервать поездку",
  gradOdDoTimer: "Из А в Б · {vrijeme}",
  gradOdDoDone: "Цель достигнута: {cilj}",
  gradOdDoScore: "{bodovi} / 1000 очков",
  gradOdDoRules: "Езда по правилам: {n} / {max}",
  gradOdDoTime: "Время {vrijeme} (ожидаемое {ref}): {n} / {max}",
  gradOdDoViolations: "Нарушения: лёгких {minor}, серьёзных {fail}",
  gradOdDoStars: "{n} из 3 звёзд",
  gradOdDoBest: "Лучший результат: {n}",
  gradOdDoNewBest: "Новый лучший результат!",
  gradOdDoAgain: "Новая поездка",
  gradOdDoNoTarget: "Нет цели для этой сложности.",
  gradExam: "Экзаменационный маршрут",
  gradExamIntro: "Маршрут как на экзамене: старт с одного и того же места, обязательные точки по порядку и финиш. Экзамен не сдан при любом серьёзном нарушении или больше чем {n} лёгких.",
  gradExamRouteInfo: "{km} км · точек: {n}",
  gradExamHud: "Экзамен · точка {k}/{n} · {vrijeme}",
  gradExamCancel: "Прервать экзамен",
  gradExamPoint: "Обязательная точка {k} из {n}",
  gradExamPassed: "Сдано",
  gradExamFailed: "Не сдано",
  gradExamSummary: "Лёгких: {minor} · серьёзных: {fail} · время {vrijeme} · {km} км",
  gradExamRule: "Экзамен не сдан при любом серьёзном нарушении или больше чем {n} лёгких.",
  gradExamRecord: "Протокол",
  gradExamMinor: "Лёгкие",
  gradExamSerious: "Серьёзные",
  gradExamAgain: "Пересдать",
  gradExamCatJunctions: "Перекрёстки и приоритет",
  gradExamCatSpeed: "Скорость",
  gradExamCatSigns: "Знаки, светофоры и разметка",
  gradExamCatPedestrians: "Пешеходы",
  gradExamCatLane: "Положение на дороге и полосы",
  gradExamCatManoeuvres: "Манёвры и указатели поворота",
  vioWrongWay: "Движение против направления одностороннего движения",
  vioTurnBan: "Поворот там, где знак запрещает",
  vioUTurn: "Разворот там, где он запрещён",
  vioWrongSide: "Движение по левой стороне дороги",
  vioStopping: "Остановка в запрещённом месте",
  gradRuleRed: "На красный нельзя пересекать стоп-линию.",
  gradRuleAmber: "На жёлтый проезжают, только если нельзя безопасно остановиться — а здесь было можно.",
  gradRuleStop: "У знака STOP машина должна полностью остановиться перед стоп-линией.",
  gradRuleCollision: "Вы столкнулись с другим автомобилем. Держите дистанцию и уступайте тому, у кого приоритет.",
  gradRuleRightOfWay: "Автомобиль, имевший преимущество, был вынужден резко затормозить из-за вас.",
  gradRulePedestrianCrossing: "Пешеход был на переходе и ещё не прошёл вашу половину дороги. Остановитесь перед зеброй и пропустите его.",
  gradRulePedestrianIntent: "Пешеход ждал у бордюра возле зебры, а вы ещё могли спокойно остановиться. Пешеходу, который показывает намерение перейти, уступают дорогу.",
  gradRuleRedLightPedestrian: "Вы проехали на красный на светофоре пешеходного перехода. Пока у пешеходов зелёный, машины стоят.",
  gradRulePedestrianCollision: "Вы сбили пешехода. Поездка окончена — следите за пешеходами на переходах и за теми, кто выходит на дорогу.",
  gradRuleBusDeparture:
    "В населённом пункте вы обязаны дать автобусу, который подаёт сигнал об отъезде от остановки, выехать: снизьте скорость и пропустите его — не обгоняйте, пока он отъезжает.",
  gradRuleEmergencyVehicle:
    "Машине с проблесковыми маячками и сиреной, которая едет сзади, вы обязаны уступить дорогу: примите вправо и снизьте скорость или остановитесь. На красный можно осторожно заехать за стоп-линию, чтобы освободить место, но не въезжать на перекрёсток.",
  gradHitTitle: "Поездка остановлена",
  gradHitText: "На настоящем экзамене это конец экзамена — и самое тяжёлое последствие ошибки за рулём.",
  gradHitAgain: "Ехать снова",
  gradRuleWrongWay: "По улице с односторонним движением едут только в разрешённом направлении — на въезде стоит знак «въезд запрещён».",
  gradRuleTurnBan: "Знак на этом въезде в перекрёсток запрещает это направление.",
  gradRuleUTurnSignal: "Разворот запрещён на перекрёстке со светофором.",
  gradRuleUTurnBridge: "Разворот запрещён на мосту.",
  gradRuleUTurnTunnel: "Разворот запрещён в тоннеле.",
  gradRuleSpeeding: "Ограничение {ogranicenje} км/ч, а машина ехала {brzina} км/ч.",
  gradRuleWrongSide: "На улице с двусторонним движением едут по правой стороне; по левой — только коротко, при обгоне или объезде.",
  gradRuleStopZebra: "На пешеходном переходе останавливаться нельзя.",
  gradRuleStopJunction: "На перекрёстке останавливаться нельзя, если этого не требует движение.",
  gradRuleStopBus: "На автобусной остановке останавливаться нельзя.",
  vioWrongLane: "Поворот не из той полосы",
  vioRoundaboutLane: "Не та полоса на круговом движении",
  gradRuleIndicatorMissing: "Перед поворотом указатель включают в сторону поворота — не позже въезда на перекрёсток.",
  gradRuleIndicatorWrong: "Указатель был включён не в ту сторону.",
  gradRuleIndicatorLate: "Указатель включён только на перекрёстке — слишком поздно, чтобы другие увидели намерение.",
  gradRuleIndicatorStraight: "При движении прямо указатель не включают.",
  gradRuleIndicatorLeftOn: "После поворота указатель выключают.",
  gradRuleIndicatorRoundabout: "При выезде с кругового движения включают правый указатель.",
  gradRuleWrongLane: "Стрелки на дороге показывают, куда можно ехать из каждой полосы — из этой полосы в эту сторону нельзя.",
  gradRuleRoundaboutOuter: "На двухполосном круговом движении направо и прямо едут по внешней полосе — внутренняя для поворота налево и полного круга.",
  gradRuleRoundaboutInner: "На двухполосном круговом движении налево и полный круг едут по внутренней полосе — внешняя для поворота направо и прямо.",
  vioBusLane: "Движение по полосе для автобусов",
  gradRuleSolidLine: "Сплошную линию нельзя пересекать и ехать по ней.",
  gradRuleBusLane: "По полосе для автобусов едут только общественный транспорт и машины сопровождения — остальным можно только пересечь её или въехать для поворота.",
  gradRuleNoEntry: "Знак «въезд запрещён»: в эту улицу с перекрёстка въезжать нельзя.",
  gradRuleMandatory: "Знак обязательного направления на этом подъезде разрешает только: {smjer}.",
  gradRuleRedManeuver: "Для направления «{manevar}» горел красный — сигнал со стрелкой действует для своего направления.",
  gradManeuverLeft: "налево",
  gradManeuverStraight: "прямо",
  gradManeuverRight: "направо",
  gradManeuverUTurn: "разворот",
  rutaFrom: "Откуда",
  rutaTo: "Куда",
  rutaPrepare: "Готовлю дорогу…",
  rutaGo: "Поехали",
  rutaLegs: "Участок",
  rutaLeft: "Осталось",
  rutaSurroundings: "Окрестности",
  rutaMap: "Карта Черногории",
  osmKratko: "© OpenStreetMap contributors (ODbL)",
  osmPuno: "Данные о дорогах и окрестностях: © OpenStreetMap contributors (ODbL)",
  oIgriTitle: "Об игре",
  oIgriDesc:
    "Подготовка к экзамену по вождению: все ситуации, путешествие и маршруты следуют правилам Закона о безопасности дорожного движения. Дороги, города и окрестности настоящие — расстояния сжаты, чтобы поездка укладывалась в час.",
  rutaDone: "Вы приехали.",
  rutaCrash: "Авария. Маршрут начинается заново.",
  rutaNoRoute: "В графе нет дороги между этими двумя местами.",
  rutaFailed: "Дорогу не удалось подготовить.",
  tripCrashJunction: "Авария. Этот перекрёсток начинается заново.",
  tripRetry: "Ехать снова",
  tripRoadAutoput: "автомагистраль",
  tripRoadMagistrala: "магистраль",
  tripRoadRegionalni: "региональная дорога",
  tripRoadPlaninski: "горная дорога",
  shiftTitle: "Смена",
  shiftDesc:
    "Перекрёсток за перекрёстком, без конца, а со второго уровня и участки автомагистрали. Три жизни; сложность растёт, пока едете чисто, и падает при ошибке.",
  shiftStart: "Начать смену",
  shiftLives: "Жизни",
  shiftLevel: "Уровень",
  shiftSegments: "Перекрёстков",
  shiftStreak: "Лучшая серия",
  shiftOver: "Смена окончена",
  shiftBest: "Лучший результат",
  shiftAgain: "Новая смена",
  shiftSkip: "Дальше",
  shiftLostLife: "Вы потеряли жизнь",
  shiftNoReaction: "измерений не было",
  shiftBack: "Выйти из смены",
  gameSoundOn: "Выключить звук",
  gameSoundOff: "Включить звук",
  gameTimelineTitle: "Указатель вдоль траектории",
  gameTimelineExpected: "требуется",
  gameTimelineActual: "вы",
  gameTimelineOff: "выключен",
  gameKeyHintIndicator: "Стрелки влево и вправо включают и выключают указатель.",
  ruleObstruction:
    "Когда преимущество у вас и дорога свободна, вы обязаны продолжить движение. Ненужная остановка на перекрёстке задерживает движение и сама по себе является нарушением.",
  ruleSpeeding:
    "Скорость выбирается по ограничению и условиям. Превышение на подъезде к перекрёстку сокращает тормозной путь и время на принятие решения.",
  gameThrottle: "Газ",
  gameBrake: "Тормоз",
  gameKeyHint: "На клавиатуре: стрелка вверх — газ, стрелка вниз — тормоз.",
  gamePassed: "Проезд без нарушений",
  gameFailed: "Проезд выполнен неправильно",
  gameViolationsTitle: "Нарушения",
  gameHowTo: "Как было нужно",
  gameTaskStraight: "Вы едете прямо через перекрёсток.",
  gameTaskLeft: "Вы поворачиваете налево.",
  gameTaskRight: "Вы поворачиваете направо.",
  gameTaskExit: "Вы съезжаете на {n}-м съезде.",
  gameTaskFullCircle: "Вы проезжаете полный круг и возвращаетесь тем же путём.",
  gameSignPriority: "Главная дорога",
  gameSignYield: "Уступите дорогу",
  gameSignStop: "Обязательная остановка",
  gameSignNone: "Без знака — правило правой руки",
  vioRightOfWay: "Непредоставление преимущества",
  vioStopSign: "Проезд стоп-линии без остановки",
  vioRedLight: "Проезд на красный свет",
  vioCollision: "Столкновение",
  vioPedestrianRightOfWay: "Не пропустили пешехода",
  vioRedLightPedestrian: "Красный на пешеходном светофоре",
  vioPedestrianCollision: "Наезд на пешехода",
  vioBusDeparture: "Помеха отъезду автобуса",
  vioEmergencyVehicle: "Непредоставление преимущества спецтранспорту",
  vioObstruction: "Создание помех движению",
  vioSpeeding: "Превышение разрешённой скорости",

  loading: "Загрузка вопросов…",
  loadErrorTitle: "Ошибка при загрузке вопросов",
  noQuestions: "В выбранной категории нет вопросов. Выберите другую категорию.",
  question: "Вопрос",
  progress: "Прогресс по вопросам",
  next: "Следующий вопрос",
  newRound: "Новый круг",
  finishExam: "Завершить экзамен",
  pageLabel: "Страница",
  prevPage: "Предыдущая",
  nextPage: "Следующая",
  check: "Проверить",
  correctAnswerLabel: "Верно",
  yourAnswerLabel: "Ваш ответ",
  correctFeedback: "Правильный ответ",
  wrongFeedback: "Неправильный ответ",
  remaining: "Осталось",
  answeredLabel: "Отвечено",
  correctLabel: "Верно",
  inPool: "вопросов в выборке",
  explanationTitle: "Пояснение",
  questionsOnlyInMe: "Вопросы доступны на черногорском языке.",
  translationMissing: "Перевод недоступен — показано на черногорском.",
  briefingTitle: "Прежде чем начать",
  briefingLead: "Прочитайте инструкцию, затем подтвердите, что вы её прочитали.",
  briefingConfirm: "Я прочитал(а) инструкцию",
  briefingStart: "Начать тест",
  briefingDisclaimer:
    "Это тренировочная симуляция. Официальный экзамен проводит компетентный орган, а сведения об условиях допуска к экзамену носят информационный характер — уточните их в автошколе.",
  penaltyTitle: "Во сколько это обошлось бы на дороге",
  penaltyTotal: "На дороге эти ошибки стоили бы",
  penaltyNote:
    "Информационно, по Закону о безопасности дорожного движения. Окончательную сумму определяет компетентный орган, а вместе со штрафом могут быть назначены и штрафные баллы.",
  penaltyLanguageNote: "Текст штрафа на черногорском — его подтверждает инструктор автошколы.",
  penaltyListTitle: "Штрафы",
  penaltyListLead: "Денежные штрафы по Закону о безопасности дорожного движения. Суммы информативны — решающими являются действующий закон и решение компетентного органа.",
  penaltyListSearch: "Поиск штрафа",
  penaltyListEmpty: "Нет штрафа, соответствующего поиску.",
  penaltyListChecked: "Последняя проверка:",

  navTitle: "Обзор вопросов",
  navAnswered: "отвечено",
  navUnanswered: "без ответа",
  navJump: "Перейти к вопросу",
  confirmLeaveExam:
    "Экзамен идёт. Если вы выйдете, ответы будут потеряны. Выйти?",

  orderingLabel: "Порядок проезда автомобилей",
  orderingHint:
    "Введите номера в порядке проезда — через дефис, через пробел или без разделителей.",
  orderingEntered: "Введено",
  orderingCorrectIs: "правильный порядок",

  badgeSign: "Дорожный знак",
  badgePolice: "Сигнал полицейского",
  badgeMarking: "Разметка на дороге",
  badgeTrafficLight: "Светофор",
  badgeIntersection: "Перекрёсток",
  badgeOrdering: "Порядок проезда",
  badgeFirstAid: "Первая помощь",
  badgeText: "Текстовый вопрос",

  resultTitle: "Результат симуляции",
  passed: "Сдано",
  failed: "Не сдано",
  passThreshold: "Для сдачи необходимо {n} из {max} баллов.",
  timedOutNote: "Экзамен остановлен, так как истекло время.",
  statCorrect: "Верно",
  statWrong: "Неверно",
  statUnanswered: "Без ответа",
  resultSummaryTitle: "Обзор по вопросам",
  statAnswered: "Отвечено",
  newExam: "Новый экзамен",
  backToStart: "Вернуться в начало",
  reviewTitle: "Разбор ошибок",
  reviewLead: "Пройдите вопросы, которые вы решили неверно — вместе с правильным ответом.",
  reviewPerfect: "Все ответы верны. Повторять нечего.",
  reviewNoAnswer: "Без ответа",
  reviewWrong: "Неверно",

  litTitle: "Источники",
  litLead: "Официальные документы, на которых основан экзаменационный материал:",

  catAll: "Все",
  catText: "Текстовые",
  catImage: "С изображением",
  catSign: "Знаки",
  catIntersection: "Перекрёстки",
  catOrdering: "Порядок проезда",
  catFirstAid: "Первая помощь",
};

const tr: Dict = {
  back: "Geri",
  close: "Kapat",
  literature: "Kaynaklar",
  langLabel: "Dil",
  temaLabel: "Görünüm",
  temaSvijetla: "Açık mod",
  temaTamna: "Koyu mod",
  prijavaDugme: "Hata bildir",
  prijavaVrsta: "Hata türü",
  prijavaVrstaOdgovor: "Yanlış cevap",
  prijavaVrstaTekst: "Metinde veya çeviride hata",
  prijavaVrstaSlika: "Görselle ilgili sorun",
  prijavaVrstaSajt: "Site düzgün çalışmıyor",
  prijavaVrstaDrugo: "Başka bir şey",
  prijavaOpis: "Açıklama",
  prijavaOpisPomoc: "Sorun nedir?",
  prijavaKontakt: "E-posta veya telefon (isteğe bağlı)",
  prijavaKontaktPomoc: "Yalnızca size dönüş yapmamızı istiyorsanız.",
  prijavaPosalji: "Bildirimi gönder",
  prijavaSalje: "Gönderiliyor…",
  prijavaHvala: "Teşekkürler! Bildiriminiz gönderildi.",
  prijavaGreska: "Gönderilemedi. Lütfen tekrar deneyin.",
  prijavaPrevise: "Çok fazla bildirim gönderildi. Lütfen daha sonra tekrar deneyin.",
  prijavaKratko: "Lütfen hatayı kısaca açıklayın.",
  prijavaIspitVrijeme: "Siz yazarken sınav süresi işlemeye devam eder.",
  igraPodesavanja: "Ayarlar",
  igraZatvoriPodesavanja: "Ayarları kapat",
  footerNote:
    "Bu soru bankası yalnızca alıştırma içindir. Resmî sınav yetkili kurum tarafından yapılır.",

  landingTitle: "Teori sınavına hazırlanın",
  landingLead:
    "Bir mod seçin. Doğru cevabı hemen görerek baskı olmadan çalışın ya da kendinizi gerçek sınav koşullarında deneyin.",
  heroLabel1: "Teori sınavı",
  heroLabel2: "B sınıfı",
  heroTitle1: "Mirav Sürücü Kursu",
  heroTitle2: "Sınava hazır olun.",
  heroLead: "Beş dilde B sınıfı soruları. Baskı olmadan çalışın, ardından gerçek sınav koşullarında kendinizi deneyin.",
  practiceMeta: "Süre yok · cevap hemen",
  menuLabel: "Menü",
  practiceTitle: "Alıştırma",
  practiceDesc:
    "Bir soru kategorisi seçin; her cevap hemen kontrol edilir ve doğrusu gösterilir. Süre ve sınır yok.",
  practiceStart: "Alıştırmaya başla",
  practiceResume: "Kaldığın yerden devam et",
  categoryLabel: "Kategori",
  examTitle: "Sınav simülasyonu",
  examDesc:
    "Tüm bankadan rastgele sorular; sınav sürerken doğru cevaplar gösterilmez. Sonunda puanınızı ve geçme sınırını görürsünüz.",
  examStart: "Sınava başla",
  metaPoints: "puan",
  metaQuestions: "soru",
  metaMinutes: "dakika",
  metaPass: "geçme sınırı",
  examLimitationNote:
    "Not: Soru bankamızda yalnızca tek doğru cevaplı sorular var.",
  bestResult: "En iyi sonuç",

  simTitle: "Kavşak simülatörü",
  simDesc:
    "Katalogdaki gerçek durumlar: araçlara geçiş sırasına göre dokunun. Numara yazmadan geçiş üstünlüğü alıştırması.",
  simStart: "Simülatörü başlat",
  simMeta: "geçiş üstünlüğü",
  simTask: "Araçlara geçiş sırasına göre dokunun.",
  simNotAllPass: "Her araç geçmek zorunda değil — yalnızca geçiş hakkı olanlara dokunun.",
  simYourOrder: "Sizin sıranız",
  simCorrectOrder: "Doğru sıra",
  simClear: "Temizle",
  simNextScene: "Sonraki durum",
  simScene: "Durum",
  simVehicle: "Araç",
  simStreak: "Seri",
  simFinished: "Tüm durumları tamamladınız.",
  simRestart: "Baştan başla",
  simEmpty: "Uygun durum yok.",
  simFamilyRule: "Sağdan gelen kuralı",
  simFamilyCatalog: "Katalogdan",
  simFamilySigns: "Ana yol ve tali yol",
  simFamilyLights: "Trafik ışıkları",
  simFamilyLeft: "Sola dönüş",
  simFamilyRoundabout: "Dönel kavşak",
  simFamilyPedestrian: "Yayalar",
  simUncontrolled: "Kontrolsüz kavşak — levha yok, ışık yok. Tüm araçlar düz gidiyor.",
  simSceneSigns: "Her koldaki levhalara dikkat edin.",
  simSceneLights: "Trafik ışıklarına dikkat edin.",
  simSceneRoundabout: "Dönel kavşak. Sizin aracınız işaretli.",
  simScenePedestrian: "Yaya geçidinde bir yaya var. Sizin aracınız işaretli.",
  simTapInScene: "Sahnedeki araçlara geçiş sırasına göre dokunun.",
  simDecisionTask: "Geçiyor musunuz, yol mu veriyorsunuz?",
  simGo: "Geçiyorum",
  simYield: "Yol veriyorum",
  simYourVehicle: "sizin aracınız",
  ruleTitle: "Kural",
  ruleRightHand:
    "Levhası ve ışığı olmayan bir kavşakta sağınızdan gelen aracın geçiş üstünlüğü vardır.",
  ruleFreeRight: "Sağında kimse olmayan araç önce geçer.",
  rulePriorityRoad:
    "Ana yoldaki araçlar, hangi taraftan gelirlerse gelsinler, tali yoldan gelen araçlardan önce geçer.",
  ruleYieldSign: "“Yol ver” levhası, ana yoldaki araçları önce geçirmeniz demektir.",
  ruleStopSign:
    "DUR levhası tam duruş gerektirir; geçiş üstünlüğü bakımından “yol ver” ile aynıdır.",
  ruleLeftTurn:
    "Sola dönen araç, karşıdan düz giden veya sağa dönen araçlara yol verir.",
  ruleGreenNotFree:
    "Yeşil koşulsuz değildir: yeşilde olan araçlar arasında dönüşte yol verme kuralı yine geçerlidir.",
  ruleRedStops: "Kırmızı veya sarı ışıktaki araç durur ve geçmez.",
  ruleRoundabout: "Dönel kavşağa girerken içinde dönmekte olan araçlara yol verirsiniz.",
  ruleRoundaboutLeft:
    "Dönel kavşakta trafik saatin tersi yönünde akar; bu yüzden içerideki araçlar solunuzdan gelir.",
  ruleRoundaboutExit:
    "Sizin girişinizden önce kavşaktan çıkan araç yolunuzu kesmez — ona yol vermeniz gerekmez.",
  rulePedestrian: "Üzerinden geçtiğiniz yaya geçidindeki yayaya yol vermek zorundasınız.",

  gameTitle: "Kavşaktan geç",
  gameLead:
    "Araç sabit bir yolu izler — siz yalnızca gaz ve frenle oynarsınız. Amaç tek bir ihlal yapmadan geçmektir: kimsenin geçiş hakkını almayın, durmanız gereken yerde durun ve geçiş hakkı sizdeyken trafiği bekletmeyin.",
  gameStart: "Başla",
  gameDesc:
    "Gerçek zamanlı sürüş — gaz ve freni tutun, tek bir ihlal yapmadan geçin. Durumlar: geçiş üstünlüğü, levhalar, ışıklar, yayalar, trafik polisi, dönel kavşaklar ve otoyol.",
  gameMeta: "zamanlama ve geçiş üstünlüğü",
  gameOpen: "Oyunu aç",
  gameRetry: "Tekrar dene",
  gameSpeed: "Hız",
  gameSpeedLimit: "sınır",
  gameTime: "Süre",
  gameQuality: "İdeal sürenin üstünde",
  gamePickLead:
    "Her durum tek bir kuralı çalıştırır. İlerlemeniz bu cihazda saklanır, sonra devam edebilirsiniz.",
  gameDifficulty: "Zorluk",
  gameStatusPassed: "Geçildi",
  gameStatusFailed: "Geçilmedi",
  gameStatusNew: "Denenmedi",
  gameBestTime: "En iyi",
  gameAttempts: "deneme",
  gameProgress: "{max} durumdan {n} tanesini geçtiniz",
  gameReplay: "Son 5 sn'yi tekrar oynat",
  gameReplaying: "Tekrar",
  gameBack: "Başka bir durum",
  gameNextScenario: "Sonraki durum",
  gameRuleTitle: "Kural",
  gameLightRed: "Kırmızı",
  gameLightYellow: "Sarı",
  gameLightGreen: "Yeşil",
  vioPedestrian: "Yayaya yol vermeme",
  vioOfficer: "Trafik polisinin işaretine uymama",
  gameSignOfficer: "Polis",
  gameOfficerGo: "geç",
  gameOfficerStop: "dur",
  ruleOfficer:
    "Trafik polisinin verdiği işaret hem levhalardan hem de trafik ışıklarından önce gelir. Polis trafiği yönetirken ışığa uyulmaz.",
  ruleEmergency:
    "Tepe lambası ve sireni açık acil durum aracının, levhalardan ve trafik ışıklarından bağımsız olarak geçiş üstünlüğü vardır.",
  vioIndicatorMissing: "Sinyal verilmedi",
  vioIndicatorWrong: "Yanlış tarafa sinyal",
  vioIndicatorLate: "Sinyal çok geç verildi",
  vioIndicatorLeftOn: "Sinyal açık bırakıldı",
  vioUnsafeMerge: "Güvensiz şeride katılma",
  vioStoppedOnRamp: "Hızlanma şeridinde durma",
  vioTooSlow: "Otoyolda çok yavaş sürme",
  vioTailgating: "Yetersiz takip mesafesi",
  vioBrakingOnHighway: "Sebepsiz sert fren",
  vioHardShoulder: "Emniyet şeridinde sürme",
  vioOffRoad: "Taşıt yolundan çıkma",
  vioCrossingSolidLine: "Düz çizgiyi geçme",
  vioUnsafeOvertake: "Güvensiz sollama",
  vioOvertakeNoVisibility: "Görüş olmadan karşı şeride geçme",
  vioOvertakeTooLong: "Karşı şeritte çok uzun kalma",
  vioCutIn: "Sollamadan sonra önü kesme",
  gameSteer: "Direksiyon",
  ruleHardShoulder:
    "En dıştaki şerit emniyet şerididir: yalnızca otoyola katılırken hızlanma şeridi boyunca ve çıkıştan önce yavaşlama şeridinde kullanılır. Diğer yerlerde arızalı araçlara ve acil durum ekiplerine ayrılmıştır.",
  ruleMerge:
    "Şeride ancak hızınız uyduğunda ve arkanızda yeterli boşluk olduğunda geçersiniz. O şeritteki araç sizin yüzünüzden fren yapmak zorunda kalmamalıdır.",
  ruleHighwaySpeed:
    "Otoyolda azami hızın yanında asgari hız da vardır. Çok yavaş sürmek de çok hızlı sürmek kadar trafiği engeller; hızlanma şeridinde durmak ise tehlikelidir.",
  ruleFollowing:
    "Takip mesafesi metreyle değil saniyeyle ölçülür: ne kadar hızlı giderseniz o kadar fazlası gerekir. Sebepsiz sert fren arkadakileri tehlikeye sokar.",
  gameLaneLeft: "Sola geç",
  gameLaneRight: "Sağa geç",
  gameKeyHintLane: "Shift ile birlikte sol/sağ ok şerit değiştirir.",
  gameTaskMerge: "Otoyola katılıyorsunuz.",
  gameTaskOvertake: "Yavaş aracı sollayıp sağ şeride dönüyorsunuz.",
  gameTaskExitHighway: "Otoyoldan çıkıyorsunuz.",
  gameTaskFollow: "Otoyol kesimini sürün ve mesafenizi koruyun.",
  ruleIndicator:
    "Dönüşü kavşağa girmeden önce sinyalle bildirirsiniz ve dönüş bitene kadar açık tutarsınız. Sinyal, diğerlerinin ne yapacağınızı öğrenmesinin tek yoludur.",
  ruleIndicatorOff:
    "Dönüş bitince sinyal kapanır. Açık bırakılan sinyal, nereye gideceğinizi bekleyenleri yanıltır.",
  gameIndicator: "Sinyal",
  gameIndicatorLeft: "Sol",
  gameIndicatorRight: "Sağ",
  gameIndicatorShortLeft: "Sol",
  gameIndicatorShortRight: "Sağ",
  gameIndicatorMode: "Sinyaller",
  gameIndicatorAuto: "Otomatik",
  gameIndicatorManual: "Elle",
  gameIndicatorAutoShort: "Oto",
  gameIndicatorAutoHint:
    "Sinyal kendiliğinden, tam gerektiği anda açılır — ne zaman açıldığına dikkat edin. Sinyal hataları sayılmaz.",
  gameIndicatorManualHint:
    "Sinyali kendiniz açarsınız: Q ve E tuşları ya da direksiyonun yanındaki düğmeler. Hatalar sayılır, sollama da dahil.",
  gameTrafficLevel: "Yoldaki trafik",
  gameTrafficHint:
    "1 — az, 5 — yoğun. Açık yolda ve rota sokaklarında geçerlidir; yolculuktaki şehir kavşakları aynı kalır.",
  gameMinor: "küçük hata",
  gameHazardTitle: "Biri kuralları çiğnedi",
  gameHazardYielded:
    "Geçiş hakkı sizdeydi ama kullanamadınız — doğru şekilde yol verdiniz. Bu size hata olarak yazılmaz.",
  gameHazardCollision:
    "Geçiş hakkı zorla alınmaz. Diğer sürücünün durmadığını gördüğünüzde tek doğru hareket frendir.",
  gameReaction: "Tepki süresi",
  tripTitle: "Yolculuk",
  tripDesc:
    "Karadağ boyunca, etap etap sürüş. Her kavşakta sonra nereye gideceğinizi seçersiniz; yalnızca gerçek komşu yerler sunulur. Bir etap yaklaşık dört dakika sürer.",
  tripStart: "Yola çık",
  tripResume: "Yolculuğa devam et",
  tripNew: "Yeni yolculuk",
  tripBack: "Yolculuktan çık",
  tripPickStart: "Nereden başlıyorsunuz?",
  tripWhereTo: "Sonra nereye?",
  tripGo: "Git",
  tripTurnAround: "Geri dön",
  tripBorderTitle: "Sınır kapısı",
  tripBorderDesc: "Yol burada bitiyor. Ötesi sınır — geri dönüp sürün.",
  tripDeadEndTitle: "Yolun sonu",
  tripDeadEndDesc: "Yol burada bitiyor. Geri dönüp sürün.",
  tripArrived: "Vardınız:",
  tripSeenHere: "Bu etapta görülenler",
  tripNothingSeen: "Bu etapta kaydedilen önemli yer yok.",
  tripContinue: "Devam et",
  tripKm: "Mesafe",
  tripLegs: "Etaplar",
  tripTowns: "Belediyeler",
  tripCollected: "Önemli yerler",
  tripSummer: "Yaz",
  tripSummerHint: "Yazın, Trsa üzerinden Žabljak — Plužine gibi mevsimlik geçitler de açıktır.",
  tripTagSeasonal: "mevsimlik",
  tripTagFerry: "feribot",
  tripTagUnverified: "doğrulanmadı",
  tripCrash: "Kaza. Bu etap baştan başlıyor.",
  tripNoted: "Yol boyunca kaydedilenler",
  tripCity: "Şehir içinden",
  tripMap: "Harita",
  tripMapHide: "Haritayı gizle",
  rutaTitle: "Rota",
  rutaDesc:
    "Karadağ'ın gerçek yollarında bütün bir rota, tek seferde. Etaplar arasında durma yok.",
  rutaStart: "Rotayı sür",
  gradTitle: "Podgorica — serbest sürüş (önizleme)",
  gradDesc: "OpenStreetMap'ten tüm Podgorica, gerçek ölçekte. Henüz kural ve başka araç yok — yalnızca şehri gezmek için sokaklar.",
  gradStart: "Podgorica'da sür",
  gradLoading: "Şehir yükleniyor…",
  gradFailed: "Şehir yüklenemedi.",
  gradNoWebgl: "Bu cihazda WebGL yok; şehir yalnızca onunla çizilir.",
  gradStreet: "Sokak",
  gradUnnamed: "isimsiz",
  gradHint: "Direksiyon aracı gerçekteki gibi çevirir — istediğiniz yere dönün ama dönüşten önce yavaşlayın. Geri gitmek için duruyorken freni basılı tutun; gaz sizi yeniden ileri götürür.",
  gradZoomIn: "Yakınlaştır",
  gradZoomOut: "Uzaklaştır",
  gradReverse: "Geri vites",
  gradTimeOfDay: "Günün saati",
  gradMorning: "Sabah",
  gradClock: "Oyun saati",
  gradDay: "Gündüz",
  gradDusk: "Alacakaranlık",
  gradNight: "Gece",
  gradWeather: "Hava",
  gradSun: "Güneş",
  gradRain: "Yağmur",
  gradRainNote: "Yağmur: frenler daha az tutar — duruş mesafesi uzar.",
  gradLevel: "Seviye",
  gradViolations: "İhlaller",
  gradNavDestination: "Hedef",
  gradNavChoose: "Hedef seçin",
  gradNavSearch: "İsimle ara",
  gradNavRandom: "Rastgele",
  gradNavClear: "Hedef yok",
  gradNavClose: "Kapat",
  gradNavIn: "{d} sonra",
  gradNavTurnLeft: "Sola dönün",
  gradNavTurnRight: "Sağa dönün",
  gradNavUTurn: "U dönüşü yapın",
  gradNavRoundabout: "Dönel kavşak: {n}. çıkış",
  gradNavStraight: "Düz devam edin",
  gradNavOnto: "{ulica} yönüne",
  gradNavArrived: "Vardınız: {cilj}",
  gradNavRemaining: "{d} kaldı",
  gradNavRerouting: "Rota yeniden hesaplanıyor…",
  gradNavNoRoute: "Buradan bu hedefe giden yol yok.",
  gradKatSkola: "Okullar ve fakülteler",
  gradKatZdravlje: "Sağlık",
  gradKatUstanova: "Kurumlar",
  gradKatKultura: "Kültür",
  gradKatBogomolja: "İbadet yerleri",
  gradKatStanica: "İstasyonlar",
  gradKatSport: "Spor",
  gradKatTrgovina: "Alışveriş merkezleri ve pazarlar",
  gradKatZnamenitost: "Önemli yerler",
  gradStatClean: "Temiz sürüş: {n} dk",
  gradStatToday: "Bugün: {km} km · {cisto} dk temiz · {prekrsaji} ihlal",
  gradMiniMap: "Mini harita",
  gradOsmAttribution: "© OpenStreetMap",
  gradOdDo: "A'dan B'ye sürüş",
  gradOdDoIntro: "Hedefe kurallara uyarak sürün. Puan: ihlalsiz sürüş artı süre. Zorluk; rota uzunluğunu, trafik yoğunluğunu ve sınav görevlisinin ne kadar sıkı olduğunu belirler.",
  gradOdDoEasy: "Kolay",
  gradOdDoMedium: "Orta",
  gradOdDoHard: "Zor",
  gradOdDoRange: "{od}–{do} km · seviye {nivo}",
  gradOdDoRandom: "Rastgele hedef",
  gradOdDoPick: "Hedef seç",
  gradOdDoCancel: "A'dan B'yi durdur",
  gradOdDoTimer: "A'dan B'ye · {vrijeme}",
  gradOdDoDone: "Hedefte: {cilj}",
  gradOdDoScore: "{bodovi} / 1000 puan",
  gradOdDoRules: "Kurallara uygun sürüş: {n} / {max}",
  gradOdDoTime: "Süre {vrijeme} (beklenen {ref}): {n} / {max}",
  gradOdDoViolations: "İhlaller: {minor} küçük, {fail} ağır",
  gradOdDoStars: "3 yıldızdan {n}",
  gradOdDoBest: "Şimdiye kadarki en iyi: {n}",
  gradOdDoNewBest: "Yeni en iyi puan!",
  gradOdDoAgain: "Yeni sürüş",
  gradOdDoNoTarget: "Bu zorluk için hedef yok.",
  gradExam: "Sınav rotası",
  gradExamIntro: "Gerçek sınav gibi bir rota: aynı yerden başlar, zorunlu noktalardan sırayla geçer ve bitişte sona erer. Herhangi bir ağır ihlal veya {n}'den fazla küçük ihlal sınavı kaybettirir.",
  gradExamRouteInfo: "{km} km · {n} nokta",
  gradExamHud: "Sınav · nokta {k}/{n} · {vrijeme}",
  gradExamCancel: "Sınavı durdur",
  gradExamPoint: "Zorunlu nokta {k} / {n}",
  gradExamPassed: "Geçti",
  gradExamFailed: "Geçmedi",
  gradExamSummary: "Küçük: {minor} · ağır: {fail} · süre {vrijeme} · {km} km",
  gradExamRule: "Herhangi bir ağır ihlal veya {n}'den fazla küçük ihlal sınavı kaybettirir.",
  gradExamRecord: "Sınav tutanağı",
  gradExamMinor: "Küçük",
  gradExamSerious: "Ağır",
  gradExamAgain: "Sınavı tekrarla",
  gradExamCatJunctions: "Kavşaklar ve geçiş üstünlüğü",
  gradExamCatSpeed: "Hız",
  gradExamCatSigns: "Levhalar, ışıklar ve yol çizgileri",
  gradExamCatPedestrians: "Yayalar",
  gradExamCatLane: "Yoldaki konum ve şeritler",
  gradExamCatManoeuvres: "Manevralar ve sinyaller",
  vioWrongWay: "Tek yönlü yolda ters yönde sürme",
  vioTurnBan: "Levhanın yasakladığı yere dönme",
  vioUTurn: "Yasak yerde U dönüşü",
  vioWrongSide: "Yolun sol tarafında sürme",
  vioStopping: "Yasak yerde durma",
  gradRuleRed: "Kırmızıda dur çizgisini geçemezsiniz.",
  gradRuleAmber: "Sarıda yalnızca güvenle duramayacaksanız devam edersiniz — burada durabilirdiniz.",
  gradRuleStop: "DUR levhasında araç dur çizgisinden önce tamamen durmalıdır.",
  gradRuleCollision: "Başka bir araca çarptınız. Mesafenizi koruyun ve geçiş üstünlüğü olana yol verin.",
  gradRuleRightOfWay: "Geçiş üstünlüğü olan bir araç sizin yüzünüzden sert fren yapmak zorunda kaldı.",
  gradRulePedestrianCrossing: "Yaya geçitteydi ve henüz yolun sizin yarınızı geçmemişti. Zebradan önce durun ve geçmesine izin verin.",
  gradRulePedestrianIntent: "Bir yaya zebranın yanında kaldırımda bekliyordu ve siz hâlâ sakince durabilirdiniz. Geçme niyetini gösteren yayanın önceliği vardır.",
  gradRuleRedLightPedestrian: "Yaya geçidinde kırmızı ışıkta geçtiniz. Yayalara yeşil yanarken araçlar durur.",
  gradRulePedestrianCollision: "Bir yayaya çarptınız. Sürüş bitti — geçitlerdeki yayalara ve yola adım atan herkese dikkat edin.",
  gradRuleBusDeparture:
    "Yerleşim yerinde duraktan kalkacağını bildiren otobüsün trafiğe katılmasına izin vermelisiniz: yavaşlayın ve gitmesine izin verin — çıkarken onu geçmeyin.",
  gradRuleEmergencyVehicle:
    "Arkanızdan gelen tepe lambası ve sireni açık araca yol vermelisiniz: sağa çekin, yavaşlayın veya durun. Kırmızı ışıkta yer açmak için dur çizgisini dikkatle biraz geçebilirsiniz, ama kavşağa giremezsiniz.",
  gradHitTitle: "Sürüş durduruldu",
  gradHitText: "Gerçek bir sürüş sınavında bu sınavı bitirir — ve direksiyondaki bir hatanın en kötü sonucudur.",
  gradHitAgain: "Yeniden sür",
  gradRuleWrongWay: "Tek yönlü yol yalnızca izin verilen yönde kullanılır — girişinde “girişi olmayan yol” levhası vardır.",
  gradRuleTurnBan: "Kavşağın o kolundaki levha bu yönü yasaklıyor.",
  gradRuleUTurnSignal: "Trafik ışıklı kavşakta U dönüşü yasaktır.",
  gradRuleUTurnBridge: "Köprü üzerinde U dönüşü yasaktır.",
  gradRuleUTurnTunnel: "Tünelde U dönüşü yasaktır.",
  gradRuleSpeeding: "Sınır {ogranicenje} km/sa, araç ise {brzina} km/sa ile gidiyordu.",
  gradRuleWrongSide: "Çift yönlü yolda sağdan gidilir; sol taraf yalnızca kısa süre, sollamak veya bir engeli geçmek için kullanılır.",
  gradRuleStopZebra: "Yaya geçidinde duramazsınız.",
  gradRuleStopJunction: "Trafik zorlamadıkça kavşakta duramazsınız.",
  gradRuleStopBus: "Otobüs durağında duramazsınız.",
  vioWrongLane: "Yanlış şeritten dönme",
  vioRoundaboutLane: "Dönel kavşakta yanlış şerit",
  gradRuleIndicatorMissing: "Dönüşten önce sinyal dönüş tarafına verilir — en geç araç kavşağa girerken.",
  gradRuleIndicatorWrong: "Sinyal yanlış tarafa açıktı.",
  gradRuleIndicatorLate: "Sinyal ancak kavşağın içinde açıldı — diğerlerinin niyeti görmesi için çok geç.",
  gradRuleIndicatorStraight: "Düz giderken sinyal verilmez.",
  gradRuleIndicatorLeftOn: "Dönüşten sonra sinyal kapatılır.",
  gradRuleIndicatorRoundabout: "Dönel kavşaktan çıkarken sağa sinyal verilir.",
  gradRuleWrongLane: "Yoldaki oklar her şeridin nereye gidebileceğini gösterir — bu şerit bu yöne gitmiyor.",
  gradRuleRoundaboutOuter: "İki şeritli dönel kavşakta sağa dönmek veya düz gitmek için dış şeridi kullanın — iç şerit sola dönüş ve tam tur içindir.",
  gradRuleRoundaboutInner: "İki şeritli dönel kavşakta sola dönmek veya tam tur atmak için iç şeridi kullanın — dış şerit sağa dönüş ve düz gitmek içindir.",
  vioBusLane: "Otobüs şeridinde sürme",
  gradRuleSolidLine: "Düz çizgi geçilemez ve üzerinde gidilemez.",
  gradRuleBusLane: "Otobüs şeridinde yalnızca toplu taşıma ve eskortlu araçlar gidebilir — diğerleri onu yalnızca geçebilir ya da dönmek için girebilir.",
  gradRuleNoEntry: "Girişi olmayan yol levhası: kavşaktan o sokağa giremezsiniz.",
  gradRuleMandatory: "Bu koldaki mecburi yön levhası yalnızca şuna izin veriyor: {smjer}.",
  gradRuleRedManeuver: "{manevar} için ışık kırmızıydı — oklu ışık kendi yönü için geçerlidir.",
  gradManeuverLeft: "sola",
  gradManeuverStraight: "düz",
  gradManeuverRight: "sağa",
  gradManeuverUTurn: "U dönüşü",
  rutaFrom: "Nereden",
  rutaTo: "Nereye",
  rutaPrepare: "Yol hazırlanıyor…",
  rutaGo: "Git",
  rutaLegs: "Etap",
  rutaLeft: "Kalan",
  rutaSurroundings: "Çevre",
  rutaMap: "Karadağ haritası",
  osmKratko: "© OpenStreetMap katkıcıları (ODbL)",
  osmPuno: "Yol ve çevre verileri: © OpenStreetMap katkıcıları (ODbL)",
  oIgriTitle: "Oyun hakkında",
  oIgriDesc:
    "Sürücü sınavı için alıştırma: her durum, yolculuk ve rotalar Karadağ Yol Trafik Güvenliği Kanunu'na uygundur. Yollar, şehirler ve çevre gerçektir — mesafeler, bir sürüş bir saate sığsın diye kısaltılmıştır.",
  rutaDone: "Vardınız.",
  rutaCrash: "Kaza. Rota baştan başlıyor.",
  rutaNoRoute: "Grafikte bu iki yer arasında yol yok.",
  rutaFailed: "Yol hazırlanamadı.",
  tripCrashJunction: "Kaza. Bu kavşak baştan başlıyor.",
  tripRetry: "Yeniden sür",
  tripRoadAutoput: "otoyol",
  tripRoadMagistrala: "ana yol",
  tripRoadRegionalni: "bölgesel yol",
  tripRoadPlaninski: "dağ yolu",
  shiftTitle: "Vardiya",
  shiftDesc:
    "Sonu olmayan, birbiri ardına kavşaklar; ikinci seviyeden itibaren arada otoyol kesimleri. Üç can; temiz sürdükçe zorluk artar, hata yaptıkça düşer.",
  shiftStart: "Vardiyaya başla",
  shiftLives: "Can",
  shiftLevel: "Seviye",
  shiftSegments: "Kavşaklar",
  shiftStreak: "En uzun seri",
  shiftOver: "Vardiya bitti",
  shiftBest: "En iyi",
  shiftAgain: "Yeni vardiya",
  shiftSkip: "Devam et",
  shiftLostLife: "Bir can kaybettiniz",
  shiftNoReaction: "ölçüm yok",
  shiftBack: "Vardiyadan çık",
  gameSoundOn: "Sesi kapat",
  gameSoundOff: "Sesi aç",
  gameTimelineTitle: "Yol boyunca sinyal",
  gameTimelineExpected: "gerekli",
  gameTimelineActual: "siz",
  gameTimelineOff: "kapalı",
  gameKeyHintIndicator: "Sol ve sağ ok sinyali açar ve kapatır.",
  ruleObstruction:
    "Geçiş hakkı sizdeyse ve yol boşsa geçmek zorundasınız. Kavşakta gereksiz yere durmak trafiği bekletir ve başlı başına bir ihlaldir.",
  ruleSpeeding:
    "Hız, sınıra ve koşullara uygun olmalıdır. Kavşağa yaklaşırken sınırı aşmak fren mesafenizi ve karar verme sürenizi kısaltır.",
  gameThrottle: "Gaz",
  gameBrake: "Fren",
  gameKeyHint: "Klavyede: yukarı ok gaz, aşağı ok frendir.",
  gamePassed: "İhlalsiz geçildi",
  gameFailed: "Bu sürüş doğru değildi",
  gameViolationsTitle: "İhlaller",
  gameHowTo: "Nasıl olmalıydı",
  gameTaskStraight: "Düz geçiyorsunuz.",
  gameTaskLeft: "Sola dönüyorsunuz.",
  gameTaskRight: "Sağa dönüyorsunuz.",
  gameTaskExit: "{n}. çıkışı alıyorsunuz.",
  gameTaskFullCircle: "Tam tur atıp geldiğiniz yoldan dönüyorsunuz.",
  gameSignPriority: "Ana yol",
  gameSignYield: "Yol ver",
  gameSignStop: "Mecburi duruş",
  gameSignNone: "Levha yok — sağdan gelen kuralı",
  vioRightOfWay: "Yol vermeme",
  vioStopSign: "Durmadan dur çizgisini geçme",
  vioRedLight: "Kırmızı ışıkta giriş",
  vioCollision: "Çarpışma",
  vioPedestrianRightOfWay: "Yayaya yol vermedi",
  vioRedLightPedestrian: "Yaya geçidinde kırmızı ışık",
  vioPedestrianCollision: "Yayaya çarpma",
  vioBusDeparture: "Kalkan otobüsün önünü kesme",
  vioEmergencyVehicle: "Acil durum aracına yol vermeme",
  vioObstruction: "Trafiği engelleme",
  vioSpeeding: "Hız sınırını aşma",

  loading: "Sorular yükleniyor…",
  loadErrorTitle: "Sorular yüklenemedi",
  noQuestions: "Seçilen kategoride soru yok. Lütfen başka bir kategori seçin.",
  question: "Soru",
  progress: "Sorulardaki ilerleme",
  next: "Sonraki soru",
  newRound: "Yeni tur",
  finishExam: "Sınavı bitir",
  pageLabel: "Sayfa",
  prevPage: "Önceki",
  nextPage: "Sonraki",
  check: "Kontrol et",
  correctAnswerLabel: "Doğru",
  yourAnswerLabel: "Sizin cevabınız",
  correctFeedback: "Doğru cevap",
  wrongFeedback: "Yanlış cevap",
  remaining: "Kalan",
  answeredLabel: "Cevaplanan",
  correctLabel: "Doğru",
  inPool: "soru mevcut",
  explanationTitle: "Açıklama",
  questionsOnlyInMe: "Soruların kendisi Karadağca olarak mevcuttur.",
  translationMissing: "Çeviri yok — Karadağca gösteriliyor.",
  briefingTitle: "Başlamadan önce",
  briefingLead: "Talimatları okuyun, sonra okuduğunuzu onaylayın.",
  briefingConfirm: "Talimatları okudum",
  briefingStart: "Teste başla",
  briefingDisclaimer:
    "Bu bir alıştırma simülasyonudur. Resmî sınav yetkili kurum tarafından yapılır; sınava girişle ilgili bilgiler yalnızca bilgi amaçlıdır — sürücü kursunda teyit edin.",
  penaltyTitle: "Trafikte bunun size maliyeti",
  penaltyTotal: "Trafikte bu hatalar size şuna mal olurdu",
  penaltyNote:
    "Yalnızca bilgi amaçlıdır, Yol Trafik Güvenliği Kanunu'na göre. Kesin tutarı yetkili kurum belirler; ayrıca ceza puanı da verilebilir.",
  penaltyLanguageNote: "Ceza metni Karadağcadır — bir sürücü eğitmeni tarafından onaylanmıştır.",
  penaltyListTitle: "Cezalar",
  penaltyListLead: "Yol Trafik Güvenliği Kanunu'na göre para cezaları. Tutarlar bilgi amaçlıdır — yürürlükteki kanun ve yetkili kurumun kararı esastır.",
  penaltyListSearch: "Cezalarda ara",
  penaltyListEmpty: "Aramanıza uyan ceza yok.",
  penaltyListChecked: "Son kontrol:",

  navTitle: "Soru genel görünümü",
  navAnswered: "cevaplandı",
  navUnanswered: "cevaplanmadı",
  navJump: "Soruya git",
  confirmLeaveExam: "Sınav devam ediyor. Çıkarsanız cevaplarınız kaybolur. Yine de çıkılsın mı?",

  orderingLabel: "Araçların geçiş sırası",
  orderingHint: "Numaraları sırayla girin — kısa çizgi, boşluk ile ya da hiç ayırmadan.",
  orderingEntered: "Girilen",
  orderingCorrectIs: "doğru sıra",

  badgeSign: "Trafik levhası",
  badgePolice: "Polis işareti",
  badgeMarking: "Yol çizgileri",
  badgeTrafficLight: "Trafik ışığı",
  badgeIntersection: "Kavşak",
  badgeOrdering: "Geçiş sırası",
  badgeFirstAid: "İlk yardım",
  badgeText: "Metin sorusu",

  resultTitle: "Sınav sonucu",
  passed: "Geçti",
  failed: "Geçmedi",
  passThreshold: "Geçmek için {max} puandan {n} puan gerekir.",
  timedOutNote: "Süre dolduğu için sınav durduruldu.",
  statCorrect: "Doğru",
  statWrong: "Yanlış",
  statUnanswered: "Cevapsız",
  resultSummaryTitle: "Soru soru",
  statAnswered: "Cevaplanan",
  newExam: "Yeni sınav",
  backToStart: "Başa dön",
  reviewTitle: "Hatalarınızı gözden geçirin",
  reviewLead: "Doğru yapamadığınız soruları doğru cevaplarıyla birlikte inceleyin.",
  reviewPerfect: "Tüm cevaplar doğruydu. İncelenecek bir şey yok.",
  reviewNoAnswer: "Cevap yok",
  reviewWrong: "Yanlış",

  litTitle: "Kaynaklar",
  litLead: "Sınav materyalinin dayandığı resmî belgeler:",

  catAll: "Tümü",
  catText: "Yalnızca metin",
  catImage: "Resimli",
  catSign: "Levhalar",
  catIntersection: "Kavşaklar",
  catOrdering: "Geçiş sırası",
  catFirstAid: "İlk yardım",
};

export const STRINGS: Record<Lang, Dict> = { me, en, sq, ru, tr };

export function dict(lang: Lang): Dict {
  return STRINGS[lang];
}

/**
 * Množina uz broj bodova. Crnogorski: 1 bod, 2–4 boda, 5+ bodova
 * (uz izuzetak 11–14, koji idu na „bodova"). Albanski koristi isti oblik
 * („pikë") i za jedninu i za množinu, a turski takođe („puan"). Ruski ima isto pravilo kao crnogorski:
 * 1 балл, 2–4 балла, 5+ баллов, a 11–14 idu na „баллов".
 */
export function pointsLabel(n: number, lang: Lang): string {
  if (lang === "en") return n === 1 ? "point" : "points";
  if (lang === "sq") return "pikë";
  if (lang === "tr") return "puan";
  const last2 = n % 100;
  const last = n % 10;
  if (lang === "ru") {
    if (last2 >= 11 && last2 <= 14) return "баллов";
    if (last === 1) return "балл";
    if (last >= 2 && last <= 4) return "балла";
    return "баллов";
  }
  if (last2 >= 11 && last2 <= 14) return "bodova";
  if (last === 1) return "bod";
  if (last >= 2 && last <= 4) return "boda";
  return "bodova";
}

export function isLang(value: unknown): value is Lang {
  return value === "me" || value === "en" || value === "sq" || value === "ru" || value === "tr";
}
