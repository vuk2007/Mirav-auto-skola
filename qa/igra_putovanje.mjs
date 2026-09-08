// Igra „Prođi raskrsnicu" — putovanje kroz Crnu Goru.
//
// Pokretanje: `npx next start -p 3100` u jednom terminalu, pa se ova skripta
// kopira u folder u kojem je `npm i playwright` već urađen i pokrene odatle.
//
// Provjerava ono što se iz jediničnih testova ne vidi:
//  - putokaz prikazuje TAČNO susjede čvora i nijedan grad više,
//  - dionica se stvarno vozi (brzina raste na gas, vrijeme teče),
//  - dolazak nudi znamenitosti, a njihove ikone se stvarno učitavaju,
//  - Kučka Korita se prijavljuju kao kraj puta sa ponudom okretanja,
//  - putovanje preživi osvježavanje stranice.
//
// Jedna dionica traje četiri minuta, pa se ovdje vozi tačno jedna. Izabrana je
// Podgorica — Kučka Korita jer jednim prolazom pokriva i planinski put, i
// dolazak sa znamenitošću, i slijepi kraj.

import { chromium } from "playwright";

const URL = "http://localhost:3100/igra";

// Susjedi Podgorice u grafu — ovo je jedino što putokaz smije da ponudi.
const SUSJEDI = [
  "Danilovgrad",
  "Zeta (Golubovci)",
  "Tuzi",
  "Cetinje",
  "Smokovac",
  "Bioče",
  "Virpazar",
  "Kučka Korita",
];

// Gradovi koji NISU susjedi Podgorice; nijedan se ne smije pojaviti.
const NISU_SUSJEDI = ["Nikšić", "Budva", "Kotor", "Bar", "Kolašin", "Mateševo", "Ulcinj"];

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
const greske = [];
page.on("pageerror", (e) => greske.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !/_vercel|Failed to load resource/.test(m.text())) {
    greske.push(`console: ${m.text()}`);
  }
});
// Ikone znamenitosti se učitavaju sa servera — 404 ovdje znači praznu karticu.
page.on("response", (r) => {
  if (r.status() >= 400 && !r.url().includes("_vercel")) greske.push(`${r.status()} ${r.url()}`);
});

/** Klik koji preživi to što prvi pokušaj zna da padne prije hidracije. */
async function klik(re, cekaj) {
  for (let i = 0; i < 5; i++) {
    await page
      .getByRole("button", { name: re })
      .first()
      .click()
      .catch(() => {});
    if (await cekaj().catch(() => false)) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

const izvj = {};
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(500);

// ── Polazak ────────────────────────────────────────────────────────────────
izvj.otvorenoPutovanje = await klik(
  /^Kreni na put$/i,
  async () => (await page.getByRole("button", { name: /^Podgorica$/ }).count()) > 0,
);
izvj.brojPolazista = await page.getByRole("button", { name: /^Podgorica$/ }).count();
izvj.imaLjeto = (await page.getByRole("checkbox").count()) === 1;

// ── Putokaz ────────────────────────────────────────────────────────────────
izvj.izabranaPodgorica = await klik(
  /^Podgorica$/,
  async () => (await page.getByRole("button", { name: /Kuda dalje|Kreni →/i }).count()) > 0,
);

const tekst = await page.locator("main").innerText();
const ponudjeni = await page.getByRole("button", { name: /Kreni →/ }).allInnerTexts();
izvj.putokaz = {
  ponudjenoKomada: ponudjeni.length,
  svakiSusjedPrikazan: SUSJEDI.every((g) => ponudjeni.some((p) => p.includes(g))),
  nemaTudjegGrada: NISU_SUSJEDI.filter((g) => new RegExp(`\\b${g}\\b`, "i").test(tekst)),
  imaVrstuPutaIKm: /magistrala|planinski put|regionalni put/i.test(tekst) && /\d+ km/.test(tekst),
  // Na polasku se niotkud nije došlo, pa okretanja nema.
  imaOkretanje: (await page.getByRole("button", { name: /Okreni se/i }).count()) > 0,
};

// ── Vožnja ─────────────────────────────────────────────────────────────────
await page.getByRole("button", { name: /Kučka Korita.*Kreni →/s }).first().click();
await page.waitForTimeout(1200);
izvj.imaPlatno = (await page.locator("canvas").count()) === 1;

const brzina = async () => {
  const m = /(\d+)\s*km\/h/.exec(await page.locator("main").innerText());
  return m ? Number(m[1]) : null;
};
const naStartu = await brzina();
await page.keyboard.down("ArrowUp");
await page.waitForTimeout(4000);
const uVoznji = await brzina();
izvj.voznja = { naStartu, uVoznji, ubrzava: (uVoznji ?? 0) > (naStartu ?? 0) };

// Dionica traje četiri minuta; gas se drži i čeka se dolazak.
// Traži se i „sudar", inače skripta samo istekne kad dionica padne — prva
// verzija je čekala samo dolazak i zato nije umjela da kaže šta je pošlo naopako.
let stigao = false;
let pao = false;
for (let i = 0; i < 140 && !stigao && !pao; i++) {
  await page.waitForTimeout(2000);
  const t = await page.locator("main").innerText();
  stigao = /Stigli ste u/i.test(t);
  pao = /Sudar/i.test(t);
}
await page.keyboard.up("ArrowUp");
izvj.stigao = stigao;
izvj.pao = pao;

// ── Dolazak ────────────────────────────────────────────────────────────────
if (stigao) {
  const t = await page.locator("main").innerText();
  izvj.dolazak = {
    mjesto: /Kučka Korita/i.test(t),
    imaZnamenitosti: /Viđeno na ovoj dionici/i.test(t),
    // Znamenitost na tom čvoru je jedna i zove se isto kao mjesto.
    brojIkona: await page.locator("main img[src^='/assets/landmarks/']").count(),
    kilometraza: /Pređeno\s*35\s*km/i.test(t.replace(/\s+/g, " ")),
    // Vožnja iznad ograničenja se prijavi, ali dionicu ne obara — pravila
    // otvorenog puta još nisu napravljena.
    prijavljenoPrekoracenje: /Zabilježeno usput/i.test(t) && /brzin/i.test(t),
  };
  const slike = await page
    .locator("main img[src^='/assets/landmarks/']")
    .evaluateAll((els) => els.map((e) => ({ src: e.getAttribute("src"), w: e.naturalWidth })));
  izvj.dolazak.ikoneUcitane = slike.length > 0 && slike.every((s) => s.w > 0);

  await page.getByRole("button", { name: /^Dalje$/i }).first().click();
  await page.waitForTimeout(600);
  const p = await page.locator("main").innerText();
  izvj.krajPuta = {
    porukaKrajPuta: /Kraj puta/i.test(p),
    nijeGranica: !/Granični prelaz/i.test(p),
    nudiOkretanje: (await page.getByRole("button", { name: /Okreni se/i }).count()) > 0,
    nemaDrugihPravaca: (await page.getByRole("button", { name: /Kreni →/ }).count()) === 0,
  };

  // ── Pamćenje ─────────────────────────────────────────────────────────────
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await klik(
    /^Kreni na put$/i,
    async () => (await page.getByRole("button", { name: /Nastavi putovanje/i }).count()) > 0,
  );
  const nastavak = await page.getByRole("button", { name: /Nastavi putovanje/i }).innerText();
  izvj.pamcenje = { ponudjenNastavak: /Kučka Korita/i.test(nastavak) };
}

izvj.greske = greske;
console.log(JSON.stringify(izvj, null, 2));
await browser.close();
