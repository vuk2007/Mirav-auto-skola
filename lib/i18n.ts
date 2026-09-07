/**
 * UI stringovi (chrome) na crnogorskom, engleskom, albanskom i ruskom.
 *
 * VAŽNO: ovdje se prevodi samo interfejs. Sadržaj pitanja se prevodi odvojeno —
 * poljima `text_en` / `options_en` / `text_ru` / `options_ru` u questions.json,
 * koja popunjava `scripts/translate.mjs`. Vidi `localizedText` u lib/questions.ts.
 * Dok tih polja nema, pitanje se prikazuje na crnogorskom uz napomenu
 * `translationMissing`.
 */

export type Lang = "me" | "en" | "sq" | "ru";

export const LANGS: readonly Lang[] = ["me", "en", "sq", "ru"] as const;

export const DEFAULT_LANG: Lang = "me";

/**
 * Oznaka na prebacivaču. Albanski je po ISO 639-1 `sq`, ali se u Crnoj Gori
 * prepoznatljivije označava sa „AL" — otud kod jedno, a prikaz drugo.
 */
export const LANG_LABELS: Record<Lang, string> = { me: "ME", en: "EN", sq: "AL", ru: "RU" };

export interface Dict {
  // Zaglavlje / opšte
  back: string;
  close: string;
  literature: string;
  langLabel: string;
  footerNote: string;

  // Landing
  landingTitle: string;
  landingLead: string;
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
  gameMinor: string;
  gameHazardTitle: string;
  gameHazardYielded: string;
  gameHazardCollision: string;
  gameReaction: string;
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
  vioObstruction: string;
  vioSpeeding: string;

  // Kviz
  loading: string;
  loadErrorTitle: string;
  noQuestions: string;
  question: string;
  examQuestion: string;
  progress: string;
  next: string;
  prev: string;
  newRound: string;
  finishExam: string;
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
  footerNote:
    "Baza pitanja služi isključivo za pripremu i vježbu. Zvanični ispit sprovodi nadležni organ.",

  landingTitle: "Pripremite se za teorijski ispit",
  landingLead:
    "Izaberite način rada. Vježbajte bez pritiska uz odmah prikazan tačan odgovor, ili provjerite znanje pod uslovima pravog ispita.",
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
    "Napomena: naša baza sadrži samo pitanja sa jednim tačnim odgovorom. Zvanični ispit ima i pitanja sa više tačnih odgovora, gdje se priznaje samo potpuno tačan odgovor.",
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
  gameMinor: "blaga greška",
  gameHazardTitle: "Neko nije poštovao pravila",
  gameHazardYielded:
    "Imali ste prednost, ali je niste imali na raspolaganju — ispravno ste ustupili. To se ne računa protiv vas.",
  gameHazardCollision:
    "Prednost se ne uzima silom. Kad vidite da drugi ne staje, jedini ispravan potez je kočnica.",
  gameReaction: "Vrijeme reakcije",
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
  vioObstruction: "Zadržavanje saobraćaja",
  vioSpeeding: "Prekoračenje dozvoljene brzine",

  loading: "Učitavanje pitanja…",
  loadErrorTitle: "Greška pri učitavanju pitanja",
  noQuestions: "Nema pitanja u izabranoj kategoriji. Izaberite drugu kategoriju.",
  question: "Pitanje",
  examQuestion: "Ispitno pitanje",
  progress: "Napredak kroz pitanja",
  next: "Sljedeće pitanje",
  prev: "Prethodno",
  newRound: "Novi krug",
  finishExam: "Završi ispit",
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
  footerNote:
    "This question bank is for practice only. The official exam is administered by the competent authority.",

  landingTitle: "Prepare for the theory exam",
  landingLead:
    "Choose a mode. Practise without pressure with the correct answer shown immediately, or test yourself under real exam conditions.",
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
    "Note: our question bank contains only single-answer questions. The official exam also includes multiple-answer questions, where only a fully correct answer counts.",
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
  gameMinor: "minor fault",
  gameHazardTitle: "Someone broke the rules",
  gameHazardYielded:
    "The right of way was yours, but it was not available to you — you correctly gave way. That is not held against you.",
  gameHazardCollision:
    "Right of way is not taken by force. When you see that the other driver is not stopping, the only correct move is the brake.",
  gameReaction: "Reaction time",
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
  vioObstruction: "Obstructing traffic",
  vioSpeeding: "Exceeding the speed limit",

  loading: "Loading questions…",
  loadErrorTitle: "Could not load the questions",
  noQuestions: "No questions in the selected category. Please choose another one.",
  question: "Question",
  examQuestion: "Exam question",
  progress: "Progress through questions",
  next: "Next question",
  prev: "Previous",
  newRound: "New round",
  finishExam: "Finish exam",
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
  footerNote:
    "Baza e pyetjeve shërben vetëm për përgatitje dhe ushtrim. Provimin zyrtar e zhvillon organi kompetent.",

  landingTitle: "Përgatituni për provimin teorik",
  landingLead:
    "Zgjidhni mënyrën e punës. Ushtroni pa presion, me përgjigjen e saktë të shfaqur menjëherë, ose provoni njohuritë në kushtet e provimit real.",
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
    "Shënim: baza jonë përmban vetëm pyetje me një përgjigje të saktë. Provimi zyrtar ka edhe pyetje me disa përgjigje të sakta, ku pranohet vetëm përgjigjja plotësisht e saktë.",
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
  gameMinor: "gabim i lehtë",
  gameHazardTitle: "Dikush nuk i respektoi rregullat",
  gameHazardYielded:
    "Përparësia ishte e juaja, por nuk e kishit në dispozicion — ju dhatë përparësi si duhet. Kjo nuk llogaritet kundër jush.",
  gameHazardCollision:
    "Përparësia nuk merret me forcë. Kur shihni se tjetri nuk ndalon, lëvizja e vetme e drejtë është frena.",
  gameReaction: "Koha e reagimit",
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
  vioObstruction: "Pengim i trafikut",
  vioSpeeding: "Tejkalim i shpejtësisë së lejuar",

  loading: "Duke ngarkuar pyetjet…",
  loadErrorTitle: "Gabim gjatë ngarkimit të pyetjeve",
  noQuestions: "Nuk ka pyetje në kategorinë e zgjedhur. Zgjidhni një tjetër.",
  question: "Pyetja",
  examQuestion: "Pyetja e provimit",
  progress: "Ecuria nëpër pyetje",
  next: "Pyetja tjetër",
  prev: "E mëparshme",
  newRound: "Raund i ri",
  finishExam: "Përfundo provimin",
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
  footerNote:
    "База вопросов предназначена только для подготовки и тренировки. Официальный экзамен проводит компетентный орган.",

  landingTitle: "Подготовьтесь к теоретическому экзамену",
  landingLead:
    "Выберите режим. Тренируйтесь без спешки, сразу видя правильный ответ, или проверьте знания в условиях настоящего экзамена.",
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
    "Примечание: наша база содержит только вопросы с одним правильным ответом. На официальном экзамене есть и вопросы с несколькими правильными ответами, где зачитывается только полностью верный ответ.",
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
  gameMinor: "лёгкая ошибка",
  gameHazardTitle: "Кто-то нарушил правила",
  gameHazardYielded:
    "Преимущество было вашим, но воспользоваться им было нельзя — вы правильно уступили. Против вас это не засчитывается.",
  gameHazardCollision:
    "Преимущество не берут силой. Когда видно, что другой не останавливается, единственно правильное действие — торможение.",
  gameReaction: "Время реакции",
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
  vioObstruction: "Создание помех движению",
  vioSpeeding: "Превышение разрешённой скорости",

  loading: "Загрузка вопросов…",
  loadErrorTitle: "Ошибка при загрузке вопросов",
  noQuestions: "В выбранной категории нет вопросов. Выберите другую категорию.",
  question: "Вопрос",
  examQuestion: "Экзаменационный вопрос",
  progress: "Прогресс по вопросам",
  next: "Следующий вопрос",
  prev: "Предыдущий",
  newRound: "Новый круг",
  finishExam: "Завершить экзамен",
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

export const STRINGS: Record<Lang, Dict> = { me, en, sq, ru };

export function dict(lang: Lang): Dict {
  return STRINGS[lang];
}

/**
 * Množina uz broj bodova. Crnogorski: 1 bod, 2–4 boda, 5+ bodova
 * (uz izuzetak 11–14, koji idu na „bodova"). Albanski koristi isti oblik
 * („pikë") i za jedninu i za množinu. Ruski ima isto pravilo kao crnogorski:
 * 1 балл, 2–4 балла, 5+ баллов, a 11–14 idu na „баллов".
 */
export function pointsLabel(n: number, lang: Lang): string {
  if (lang === "en") return n === 1 ? "point" : "points";
  if (lang === "sq") return "pikë";
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
  return value === "me" || value === "en" || value === "sq" || value === "ru";
}
