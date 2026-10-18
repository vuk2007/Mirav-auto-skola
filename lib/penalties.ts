/**
 * Katalog novčanih kazni iz Zakona o bezbjednosti saobraćaja na putevima (CG).
 *
 * ⚠️ TODO(MIRAV): iznose MORA provjeriti MIRAV prije objave.
 *
 * Osnova je prečišćen tekst ZoBS-a (kaznene odredbe, čl. 319–326 — kazne za
 * vozače i ostale učesnike; čl. 315–318 se odnose na pravna lica i nijesu ovdje).
 * Izmjene i dopune zakona stupile su na snagu **7. avgusta 2026**, a prečišćen
 * tekst poslije njih nije bio dostupan pri izradi — zato svaki unos nosi
 * `verified: false` i polje `source`. Unosi koje su izmjene promijenile označeni
 * su sa `amended: true` i nose iznos iz izmjena.
 *
 * Zašto se uopšte prikazuje: kandidatu je apstraktno „netačno", a konkretno
 * „ovo bi vas koštalo 100–450 €". Iznos je **informativan** — mjerodavan je
 * zakon i odluka prekršajnog organa, a kazna zavisi od okolnosti i može uz nju
 * ići i kazneni bod ili zabrana upravljanja.
 */

import type { Lang } from "./i18n";

/**
 * Jedan raspon kazne. Prekršaji sa stepenovanom kaznom (brzina) imaju više
 * nivoa — tako kandidat vidi i koliko skače cijena, ne samo jedan broj.
 */
export interface PenaltyTier {
  /** Kratak opis nivoa; prazno kod prekršaja sa jednim rasponom. */
  label?: Record<Lang, string>;
  minEur: number;
  maxEur: number;
  /** Član kaznene odredbe, npr. „čl. 323 st. 1 t. 1". */
  article: string;
}

export interface Penalty {
  id: string;
  /** Naziv prekršaja onako kako ga kandidat prepoznaje. */
  label: Record<Lang, string>;
  tiers: readonly PenaltyTier[];
  /** Iznos promijenjen izmjenama zakona od 7. 8. 2026. */
  amended?: boolean;
  /** Odakle iznos — da se može provjeriti. */
  source: string;
  /** Da li je MIRAV potvrdio iznos. Nijedan još nije. */
  verified: boolean;
  /**
   * Neslaganje između izvora, zabilježeno da se ne izgubi. Ne prikazuje se
   * kandidatu — služi onome ko bude provjeravao primarni tekst.
   * Provjerava se sa `node scripts/check-penalties.mjs`.
   */
  conflict?: string;
}

const ZOBS = "ZoBS, prečišćen tekst (čl. 319–326)";
const IZMJENE = "Izmjene i dopune ZoBS-a na snazi od 7. 8. 2026 (medijski izvještaji — nije prečišćen tekst)";
const REF = "references/kazne-zobs-2026-08.json — medijski izvori poslije 7. 8. 2026 (nije Službeni list)";

/** Skraćenica: prekršaj sa jednim rasponom. */
function one(minEur: number, maxEur: number, article: string): readonly PenaltyTier[] {
  return [{ minEur, maxEur, article }];
}

function t(me: string, en: string, ru: string, sq: string, tr: string): Record<Lang, string> {
  return { me, en, ru, sq, tr };
}

export const PENALTIES: readonly Penalty[] = [
  {
    id: "brzina",
    label: t(
      "Prekoračenje dozvoljene brzine",
      "Exceeding the speed limit",
      "Превышение разрешённой скорости",
      "Tejkalim i shpejtësisë së lejuar",
      "Hız sınırını aşma",
    ),
    // Jedini prekršaj gdje kazna raste stepenasto — zato svi nivoi, da se vidi skok.
    tiers: [
      {
        label: t("do 10 km/h", "up to 10 km/h", "до 10 км/ч", "deri në 10 km/h", "10 km/sa'e kadar"),
        minEur: 60,
        maxEur: 120,
        article: "čl. 324 st. 1 t. 9 / čl. 325 st. 1 t. 3 (izmijenjen)",
      },
      {
        label: t("10–20 km/h", "10–20 km/h", "10–20 км/ч", "10–20 km/h", "10–20 km/sa"),
        minEur: 60,
        maxEur: 150,
        article: "čl. 323 st. 1 t. 5",
      },
      {
        label: t("20–30 km/h", "20–30 km/h", "20–30 км/ч", "20–30 km/h", "20–30 km/sa"),
        minEur: 70,
        maxEur: 200,
        article: "čl. 322 st. 1 t. 9",
      },
      {
        label: t("30–50 km/h", "30–50 km/h", "30–50 км/ч", "30–50 km/h", "30–50 km/sa"),
        minEur: 100,
        maxEur: 450,
        article: "čl. 320 st. 1 t. 6",
      },
      {
        label: t("50–70 km/h", "50–70 km/h", "50–70 км/ч", "50–70 km/h", "50–70 km/sa"),
        minEur: 150,
        maxEur: 1000,
        article: "čl. 319 st. 1 t. 4",
      },
      {
        // Najviši nivo: uz kaznu ide i moguće oduzimanje dozvole i zatvor do
        // 60 dana. Bez njega bi kandidat mislio da je 1.000 € plafon.
        label: t(
          "preko 70 u naselju / 90 van naselja",
          "over 70 in town / 90 outside",
          "свыше 70 в нас. пункте / 90 вне",
          "mbi 70 në vendbanim / 90 jashtë",
          "yerleşim yerinde 70, dışında 90 üzeri",
        ),
        minEur: 1000,
        maxEur: 2000,
        article: "izmjene 111/2026 (član nije poznat)",
      },
    ],
    source: `${ZOBS} + ${REF}`,
    conflict:
      "Referentni spisak nema iznose za 11–70 km/h; naši za te nivoe su iz teksta prije izmjena 111/2026.",
    verified: false,
  },
  {
    id: "telefon",
    label: t(
      "Korišćenje telefona u vožnji",
      "Using a phone while driving",
      "Использование телефона за рулём",
      "Përdorimi i telefonit gjatë vozitjes",
      "Sürüş sırasında telefon kullanma",
    ),
    tiers: one(150, 400, "čl. 323 st. 1 t. 1 (izmijenjen)"),
    amended: true,
    source: IZMJENE,
    verified: false,
  },
  {
    id: "dijete-naprijed",
    label: t(
      "Dijete mlađe od 12 godina na prednjem sjedištu",
      "Child under 12 in the front seat",
      "Ребёнок младше 12 лет на переднем сиденье",
      "Fëmija nën 12 vjeç në ndenjësen e përparme",
      "12 yaşından küçük çocuğun ön koltukta olması",
    ),
    tiers: one(150, 400, "čl. 323 st. 1 t. 2 (izmijenjen)"),
    amended: true,
    source: IZMJENE,
    verified: false,
  },
  {
    id: "crveno",
    label: t(
      "Prolazak kroz crveno svjetlo",
      "Running a red light",
      "Проезд на красный сигнал",
      "Kalimi në dritën e kuqe",
      "Kırmızı ışıkta geçme",
    ),
    tiers: one(300, 2000, "čl. 320 st. 1 t. 26 i 27 (izmijenjen)"),
    amended: true,
    source: REF,
    conflict:
      "Raniji naš gornji iznos bio je 1.000 €; referentni spisak navodi 2.000 €. Oba su iz medija.",
    verified: false,
  },
  {
    id: "pojas",
    label: t(
      "Nevezan sigurnosni pojas",
      "Seat belt not worn",
      "Непристёгнутый ремень безопасности",
      "Rripi i sigurisë i palidhur",
      "Emniyet kemeri takmama",
    ),
    tiers: one(150, 400, "čl. 324 st. 1 t. 4 (izmijenjen)"),
    amended: true,
    source: REF,
    conflict:
      "Prije izmjena 111/2026 bilo je 40–100 € (čl. 324 st. 1 t. 4). Novi iznos je iz medijskih izvora, nije iz Službenog lista.",
    verified: false,
  },
  {
    id: "dijete-sjediste",
    label: t(
      "Dijete do 5 godina bez bezbjednosnog sjedišta",
      "Child under 5 without a safety seat",
      "Ребёнок до 5 лет без детского кресла",
      "Fëmija deri në 5 vjeç pa ndenjëse sigurie",
      "5 yaşından küçük çocuğun koltuksuz taşınması",
    ),
    tiers: one(150, 600, "čl. 324 st. 1 t. 5 (izmijenjen)"),
    amended: true,
    source: REF,
    conflict:
      "Prije izmjena 111/2026 bilo je 40–100 € (čl. 324 st. 1 t. 5). Novi iznos je iz medijskih izvora, nije iz Službenog lista.",
    verified: false,
  },
  {
    id: "alkohol",
    label: t(
      "Vožnja pod dejstvom alkohola (0,3–0,5 g/kg)",
      "Driving under the influence of alcohol (0.3–0.5 g/kg)",
      "Управление в состоянии опьянения (0,3–0,5 г/кг)",
      "Vozitja nën ndikimin e alkoolit (0,3–0,5 g/kg)",
      "Alkollü araç kullanma (0,3–0,5 g/kg)",
    ),
    tiers: one(70, 200, "čl. 322 st. 1 t. 37"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "prvenstvo",
    label: t(
      "Nepropuštanje vozila koje ima prvenstvo prolaza",
      "Failing to give way to a vehicle with right of way",
      "Непредоставление преимущества проезда",
      "Moslëshimi i rrugës automjetit me përparësi kalimi",
      "Geçiş üstünlüğü olan araca yol vermeme",
    ),
    tiers: one(100, 450, "čl. 320 st. 1 t. 7 (čl. 40)"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "pjesacki-prelaz",
    label: t(
      "Nepropuštanje pješaka na pješačkom prelazu",
      "Failing to give way to a pedestrian on a crossing",
      "Непропуск пешехода на пешеходном переходе",
      "Moslëshimi i rrugës këmbësorit në vendkalim",
      "Yaya geçidindeki yayaya yol vermeme",
    ),
    tiers: one(70, 200, "čl. 322 st. 1 t. 28"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "preticanje-opasno",
    label: t(
      "Preticanje kojim se ugrožava bezbjednost (krivina, prevoj, tunel)",
      "Overtaking that endangers safety (bend, crest, tunnel)",
      "Обгон, создающий опасность (поворот, перевал, туннель)",
      "Tejkalim që rrezikon sigurinë (kthesë, qafë, tunel)",
      "Güvenliği tehlikeye atan sollama (viraj, tepe, tünel)",
    ),
    tiers: one(150, 1000, "čl. 319 st. 1 t. 5, 6 i 7"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "preticanje",
    label: t(
      "Nepropisno preticanje ili obilaženje",
      "Overtaking or going around incorrectly",
      "Обгон или объезд с нарушением правил",
      "Tejkalim ose anashkalim jo i rregullt",
      "Kurallara aykırı sollama veya engeli geçme",
    ),
    tiers: one(100, 450, "čl. 320 st. 1 t. 8–18"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "unazad",
    label: t(
      "Nepropisno kretanje unazad",
      "Reversing incorrectly",
      "Движение задним ходом с нарушением правил",
      "Lëvizje prapa jo e rregullt",
      "Kurallara aykırı geri gitme",
    ),
    tiers: one(40, 100, "čl. 324 st. 1 t. 8 (čl. 31)"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "parkiranje",
    label: t(
      "Nepropisno zaustavljanje ili parkiranje",
      "Stopping or parking incorrectly",
      "Остановка или стоянка с нарушением правил",
      "Ndalje ose parkim jo i rregullt",
      "Kurallara aykırı durma veya park etme",
    ),
    tiers: one(60, 150, "čl. 323 st. 1 t. 9 i 11 (čl. 60)"),
    source: ZOBS,
    conflict:
      "Referentni spisak navodi 100 € fiksno, ali iz prekršajnog naloga komunalne policije u Podgorici — to je drugi instrument, ne zakonski raspon. Zato je zadržan raspon iz zakona.",
    verified: false,
  },
  {
    id: "signalizacija",
    label: t(
      "Nepoštovanje saobraćajne signalizacije",
      "Failing to obey traffic signage",
      "Несоблюдение дорожной сигнализации",
      "Mosrespektimi i sinjalizimit rrugor",
      "Trafik işaretlerine uymama",
    ),
    tiers: one(60, 150, "čl. 323 st. 1 t. 27"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "policija",
    label: t(
      "Nepostupanje po naredbi policijskog službenika",
      "Failing to obey a police officer's order",
      "Невыполнение распоряжения сотрудника полиции",
      "Mosveprimi sipas urdhrit të zyrtarit policor",
      "Polis memurunun talimatına uymama",
    ),
    tiers: one(500, 2000, "čl. 321 st. 1 t. 30 (izmijenjen)"),
    amended: true,
    source: REF,
    conflict:
      "Prije izmjena 111/2026 bilo je 80–300 € (čl. 321 st. 1 t. 30). Novi iznos je iz medijskih izvora, nije iz Službenog lista.",
    verified: false,
  },
  {
    id: "vuca",
    label: t(
      "Nepropisna vuča vozila",
      "Towing a vehicle incorrectly",
      "Буксировка с нарушением правил",
      "Tërheqje e automjetit jo e rregullt",
      "Kurallara aykırı araç çekme",
    ),
    tiers: one(100, 450, "čl. 320 st. 1 t. 19–21 (čl. 63–70)"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "teret",
    label: t(
      "Nepropisno smješten ili preveliki teret",
      "Load incorrectly secured or oversized",
      "Груз размещён с нарушением или превышает габариты",
      "Ngarkesë e vendosur jo rregullt ose e tepërt",
      "Yükün kurallara aykırı bağlanması veya taşması",
    ),
    tiers: one(150, 1000, "čl. 319 st. 1 t. 12 i 13 (čl. 110–112)"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "svjetla",
    label: t(
      "Nepropisna upotreba svjetala",
      "Incorrect use of lights",
      "Неправильное использование световых приборов",
      "Përdorim jo i rregullt i dritave",
      "Işıkların kurallara aykırı kullanımı",
    ),
    tiers: one(60, 150, "čl. 323 st. 1 t. 12 / čl. 325 st. 1 t. 9"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "prsluk",
    label: t(
      "Bez reflektujućeg prsluka",
      "No high-visibility vest",
      "Отсутствие светоотражающего жилета",
      "Pa jelek reflektues",
      "Reflektif yelek bulunmaması",
    ),
    tiers: one(20, 80, "čl. 325 st. 1 t. 2 / čl. 326 st. 1 t. 3"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "zimska-oprema",
    label: t(
      "Bez zimske opreme",
      "No winter equipment",
      "Отсутствие зимнего оборудования",
      "Pa pajisje dimërore",
      "Kış donanımı bulunmaması",
    ),
    tiers: one(80, 300, "čl. 321 st. 1 t. 25 (čl. 132)"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "vozilo-neispravno",
    label: t(
      "Vozilo ne ispunjava propisane uslove",
      "Vehicle does not meet the prescribed requirements",
      "Транспортное средство не отвечает требованиям",
      "Automjeti nuk i plotëson kushtet e parapara",
      "Aracın öngörülen şartları karşılamaması",
    ),
    tiers: one(300, 1000, "čl. 322 st. 1 t. 39 (izmijenjen)"),
    amended: true,
    source: REF,
    conflict:
      "Prije izmjena 111/2026 bilo je 70–200 € (čl. 322 st. 1 t. 39). Novi iznos je iz medijskih izvora, nije iz Službenog lista.",
    verified: false,
  },
  {
    id: "prva-pomoc",
    label: t(
      "Nepružanje pomoći poslije saobraćajne nezgode",
      "Failing to give assistance after a road accident",
      "Неоказание помощи после ДТП",
      "Mosdhënia e ndihmës pas aksidentit",
      "Trafik kazasından sonra yardım etmeme",
    ),
    tiers: one(100, 450, "čl. 320 st. 1 t. 30"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "kaciga",
    label: t(
      "Bez zaštitne kacige",
      "No protective helmet",
      "Отсутствие защитного шлема",
      "Pa helmetë mbrojtëse",
      "Koruyucu kask takmama",
    ),
    tiers: one(60, 150, "čl. 323 st. 1 t. 17"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "biciklista",
    label: t(
      "Nepropisna vožnja bicikla",
      "Riding a bicycle incorrectly",
      "Езда на велосипеде с нарушением правил",
      "Vozitje jo e rregullt e biçikletës",
      "Kurallara aykırı bisiklet sürme",
    ),
    tiers: one(60, 150, "čl. 324 st. 1 t. 19 i 20 (izmijenjen)"),
    amended: true,
    source: REF,
    conflict:
      "Prije izmjena 111/2026 bilo je 40–100 € (čl. 324 st. 1 t. 19 i 20). Novi iznos je iz medijskih izvora, nije iz Službenog lista.",
    verified: false,
  },
  {
    id: "pjesak",
    label: t(
      "Nepropisno kretanje pješaka",
      "Pedestrian walking incorrectly",
      "Движение пешехода с нарушением правил",
      "Lëvizje jo e rregullt e këmbësorit",
      "Yayanın kurallara aykırı hareketi",
    ),
    tiers: one(40, 150, "čl. 323 st. 1 t. 18–20 / čl. 324 st. 1 t. 23–25"),
    source: ZOBS,
    conflict:
      "Referentni spisak daje 60–150 € samo za prelazak van obilježenog prelaza; naš unos pokriva više odredaba (čl. 323 t. 18–20 i čl. 324 t. 23–25), pa raspon nije uporediv jedan na jedan.",
    verified: false,
  },
  {
    id: "pruga",
    label: t(
      "Nepropisno prelaženje preko željezničke pruge",
      "Crossing a railway line incorrectly",
      "Пересечение железнодорожных путей с нарушением правил",
      "Kalim jo i rregullt mbi hekurudhë",
      "Demiryolunu kurallara aykırı geçme",
    ),
    tiers: one(150, 1000, "čl. 319 st. 1 t. 9, 10 i 11 (čl. 98–100)"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "autoput",
    label: t(
      "Nepropisno kretanje na autoputu",
      "Driving incorrectly on a motorway",
      "Движение по автомагистрали с нарушением правил",
      "Lëvizje jo e rregullt në autostradë",
      "Otoyolda kurallara aykırı sürüş",
    ),
    tiers: one(80, 300, "čl. 321 st. 1 t. 13–15 (čl. 101–103)"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "mimoilazenje",
    label: t(
      "Nepropisno mimoilaženje",
      "Meeting oncoming traffic incorrectly",
      "Разъезд со встречным транспортом с нарушением правил",
      "Kalim përballë jo i rregullt",
      "Karşıdan gelen araçla kurallara aykırı karşılaşma",
    ),
    tiers: one(70, 200, "čl. 322 st. 1 t. 12 (čl. 45)"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "skretanje",
    label: t(
      "Nepropisno skretanje ili polukružno okretanje",
      "Turning or making a U-turn incorrectly",
      "Поворот или разворот с нарушением правил",
      "Kthim ose kthim gjysmërrethor jo i rregullt",
      "Kurallara aykırı dönüş veya U dönüşü",
    ),
    tiers: one(70, 200, "čl. 322 st. 1 t. 10 i 11 (čl. 39 i 44)"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "zvucni-znak",
    label: t(
      "Nepropisna upotreba zvučnog znaka",
      "Incorrect use of the horn",
      "Неправильное использование звукового сигнала",
      "Përdorim jo i rregullt i sinjalit zanor",
      "Kornanın kurallara aykırı kullanımı",
    ),
    tiers: one(30, 80, "čl. 325 st. 1 t. 4 (čl. 53)"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "radar-ometac",
    label: t(
      "Uređaj za ometanje mjerenja brzine u vozilu",
      "Speed-measurement jamming device in the vehicle",
      "Устройство для создания помех измерению скорости",
      "Pajisje për pengimin e matjes së shpejtësisë në automjet",
      "Araçta hız ölçümünü engelleyen cihaz",
    ),
    tiers: one(150, 1000, "čl. 319 st. 1 t. 1 (čl. 23)"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "prevoz-lica",
    label: t(
      "Nepropisan prevoz lica",
      "Carrying passengers incorrectly",
      "Перевозка людей с нарушением правил",
      "Transport i personave jo i rregullt",
      "Kurallara aykırı yolcu taşıma",
    ),
    tiers: one(80, 300, "čl. 321 st. 1 t. 20 i 21 (čl. 115 i 116)"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "kolona-pjesaka",
    label: t(
      "Presijecanje kolone pješaka",
      "Driving through a column of pedestrians",
      "Пересечение колонны пешеходов",
      "Prerja e kolonës së këmbësorëve",
      "Yaya kolunun arasından geçme",
    ),
    tiers: one(60, 150, "čl. 323 st. 1 t. 21 (čl. 97 st. 6)"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "vozacka-dozvola",
    label: t(
      "Upravljanje bez važeće vozačke dozvole",
      "Driving without a valid driving licence",
      "Управление без действующего водительского удостоверения",
      "Drejtimi pa patentë të vlefshme",
      "Geçerli sürücü belgesi olmadan araç kullanma",
    ),
    tiers: one(500, 2000, "čl. 319 st. 1 t. 22 (izmijenjen)"),
    amended: true,
    source: REF,
    conflict:
      "Prije izmjena 111/2026 bilo je 150–1000 € (čl. 319 st. 1 t. 22). Novi iznos je iz medijskih izvora, nije iz Službenog lista.",
    verified: false,
  },
  {
    id: "nezgoda",
    label: t(
      "Nepostupanje po obavezama poslije nezgode",
      "Failing to meet obligations after an accident",
      "Невыполнение обязанностей после ДТП",
      "Mospërmbushja e detyrimeve pas aksidentit",
      "Kazadan sonraki yükümlülükleri yerine getirmeme",
    ),
    tiers: one(70, 200, "čl. 322 st. 1 t. 33 i 34 (čl. 168–170)"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "desna-strana",
    label: t(
      "Nekretanje desnom stranom kolovoza",
      "Not keeping to the right-hand side of the carriageway",
      "Движение не по правой стороне проезжей части",
      "Moslëvizja nga ana e djathtë e karrexhatës",
      "Taşıt yolunun sağ tarafından gitmeme",
    ),
    tiers: one(100, 450, "čl. 320 st. 1 t. 2, 3 i 4 (čl. 29 i 30)"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "ukljucivanje",
    label: t(
      "Nepropisno uključivanje u saobraćaj",
      "Joining traffic incorrectly",
      "Включение в движение с нарушением правил",
      "Kyçje jo e rregullt në komunikacion",
      "Trafiğe kurallara aykırı katılma",
    ),
    tiers: one(80, 300, "čl. 321 st. 1 t. 5 (čl. 27)"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "ometanje-vozaca",
    label: t(
      "Ometanje vozača u upravljanju",
      "Obstructing the driver",
      "Создание помех водителю в управлении",
      "Pengimi i shoferit në drejtim",
      "Sürücüyü engelleme",
    ),
    tiers: one(70, 200, "čl. 322 st. 1 t. 5 (čl. 24)"),
    source: ZOBS,
    verified: false,
  },
  {
    id: "rastojanje",
    label: t(
      "Nedovoljno odstojanje od vozila ispred",
      "Insufficient distance from the vehicle in front",
      "Недостаточная дистанция до впереди идущего",
      "Distancë e pamjaftueshme nga automjeti përpara",
      "Öndeki araçla yetersiz mesafe",
    ),
    tiers: one(80, 300, "čl. 321 st. 1 t. 2 (čl. 28)"),
    source: ZOBS,
    verified: false,
  },
];

const BY_ID = new Map(PENALTIES.map((p) => [p.id, p]));

export function penaltyById(id: string): Penalty | undefined {
  return BY_ID.get(id);
}

/** Najniži i najviši iznos preko svih nivoa — za zbir i za kratak prikaz. */
export function penaltyRange(p: Penalty): { minEur: number; maxEur: number } {
  return {
    minEur: Math.min(...p.tiers.map((x) => x.minEur)),
    maxEur: Math.max(...p.tiers.map((x) => x.maxEur)),
  };
}

/** Zbir raspona za listu prekršaja — koristi se na ekranu rezultata. */
export function sumPenalties(ids: readonly string[]): { minEur: number; maxEur: number } {
  let minEur = 0;
  let maxEur = 0;
  for (const id of ids) {
    const p = BY_ID.get(id);
    if (!p) continue;
    const r = penaltyRange(p);
    minEur += r.minEur;
    maxEur += r.maxEur;
  }
  return { minEur, maxEur };
}

/** „150 €" ili „100–450 €" — bez decimala, iznosi u zakonu su cijeli. */
export function formatEur(minEur: number, maxEur: number): string {
  const fmt = (n: number) => n.toLocaleString("de-DE");
  return minEur === maxEur ? `${fmt(minEur)} €` : `${fmt(minEur)}–${fmt(maxEur)} €`;
}
