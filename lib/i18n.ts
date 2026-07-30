/**
 * UI stringovi (chrome) na crnogorskom, engleskom i albanskom.
 *
 * VAŽNO: prevodi se samo interfejs. Sadržaj pitanja ostaje na crnogorskom dok se
 * u questions.json ne dodaju polja `text_en` / `options_en` — vidi `localizedText`
 * u lib/questions.ts. Pitanja se ne prevode automatski.
 */

export type Lang = "me" | "en" | "sq";

export const LANGS: readonly Lang[] = ["me", "en", "sq"] as const;

export const DEFAULT_LANG: Lang = "me";

/**
 * Oznaka na prebacivaču. Albanski je po ISO 639-1 `sq`, ali se u Crnoj Gori
 * prepoznatljivije označava sa „AL" — otud kod jedno, a prikaz drugo.
 */
export const LANG_LABELS: Record<Lang, string> = { me: "ME", en: "EN", sq: "AL" };

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
  rulePedestrian: string;

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
  badgeIntersection: string;
  badgeOrdering: string;
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
  rulePedestrian:
    "Pješaka na pješačkom prelazu preko kojeg prolazite morate propustiti.",

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
  badgeIntersection: "Raskrsnica",
  badgeOrdering: "Redoslijed prolaska",
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
  rulePedestrian: "You must give way to a pedestrian on a crossing you are driving over.",

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
  badgeIntersection: "Intersection",
  badgeOrdering: "Order of passage",
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
  rulePedestrian:
    "Duhet t'i lëshoni rrugë këmbësorit në vendkalimin nëpër të cilin kaloni.",

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
  badgeIntersection: "Kryqëzim",
  badgeOrdering: "Radha e kalimit",
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
};

export const STRINGS: Record<Lang, Dict> = { me, en, sq };

export function dict(lang: Lang): Dict {
  return STRINGS[lang];
}

/**
 * Množina uz broj bodova. Crnogorski: 1 bod, 2–4 boda, 5+ bodova
 * (uz izuzetak 11–14, koji idu na „bodova"). Albanski koristi isti oblik
 * („pikë") i za jedninu i za množinu.
 */
export function pointsLabel(n: number, lang: Lang): string {
  if (lang === "en") return n === 1 ? "point" : "points";
  if (lang === "sq") return "pikë";
  const last2 = n % 100;
  const last = n % 10;
  if (last2 >= 11 && last2 <= 14) return "bodova";
  if (last === 1) return "bod";
  if (last >= 2 && last <= 4) return "boda";
  return "bodova";
}

export function isLang(value: unknown): value is Lang {
  return value === "me" || value === "en" || value === "sq";
}
