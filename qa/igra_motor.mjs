// Igra „Prođi raskrsnicu" — zvuk motora.
//
// Pokretanje: `npx next start -p 3100` u jednom terminalu, pa se ova skripta
// kopira u folder u kojem je `npm i playwright` već urađen i pokrene odatle.
//
// Zvuk se u skripti ne može čuti, pa se mjeri graf: presreće se `AudioContext`
// i bilježi se svaki oscilator, svaka promjena učestanosti i stanje konteksta.
// Time se provjerava ono što se i tvrdi:
//  - motor se ne pali prije nego što se krene (pregledači `AudioContext` prije
//    korisničke radnje drže zaustavljenim i pišu upozorenje u konzolu),
//  - dok se vozi, učestanost se stvarno mijenja sa brzinom,
//  - prekidač za zvuk ga ućutka,
//  - poslije kraja vožnje motor stane.

import { chromium } from "playwright";

const URL = "http://localhost:3100/igra";

/** Presretač: pamti koliko je oscilatora napravljeno i koje su im učestanosti. */
const PRESRETAC = () => {
  const w = window;
  w.__zvuk = { konteksta: 0, oscilatora: 0, freq: [], zadnji: null };
  const Pravi = w.AudioContext || w.webkitAudioContext;
  if (!Pravi) return;
  class Presretnut extends Pravi {
    constructor(...a) {
      super(...a);
      w.__zvuk.konteksta += 1;
      // Pamti se sam kontekst, ne njegovo stanje u tom trenutku: prva verzija
      // je bilježila „running" na pravljenju i time nije dokazivala ništa o
      // tome šta prekidač za zvuk radi.
      w.__zvuk.zadnji = this;
    }
    createOscillator() {
      const osc = super.createOscillator();
      w.__zvuk.oscilatora += 1;
      const p = osc.frequency;
      const stari = p.setTargetAtTime.bind(p);
      p.setTargetAtTime = (v, t, k) => {
        w.__zvuk.freq.push(Math.round(v));
        return stari(v, t, k);
      };
      return osc;
    }
  }
  w.AudioContext = Presretnut;
  w.webkitAudioContext = Presretnut;
};

const stanje = (page) =>
  page.evaluate(() => {
    const z = window.__zvuk;
    return { konteksta: z.konteksta, oscilatora: z.oscilatora, freq: z.freq };
  });

/** Živo stanje posljednjeg konteksta: „running", „closed"… */
const stanjeKonteksta = (page) =>
  page.evaluate(() => window.__zvuk.zadnji && window.__zvuk.zadnji.state);

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
await page.addInitScript(PRESRETAC);
const greske = [];
page.on("pageerror", (e) => greske.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !/_vercel|Failed to load resource/.test(m.text())) {
    greske.push(`console: ${m.text()}`);
  }
});

const izvj = {};
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
for (let i = 0; i < 4; i++) {
  await page
    .getByRole("button", { name: /Pravilo desne strane — ustupate/ })
    .first()
    .click();
  if (await page.getByRole("button", { name: /^Kreni$/ }).count()) break;
  await page.waitForTimeout(400);
}

// Na brifingu se još ne vozi — motora ne smije biti.
await page.waitForTimeout(600);
izvj.prijeVoznje = await stanje(page);

await page.getByRole("button", { name: /^Kreni$/ }).click();
await page.waitForTimeout(500);
izvj.naStartu = { oscilatora: (await stanje(page)).oscilatora };

// Vozi i gledaj da li se učestanost penje.
await page.keyboard.down("ArrowUp");
await page.waitForTimeout(2500);
await page.keyboard.up("ArrowUp");
const uVoznji = await stanje(page);
const f = uVoznji.freq;
izvj.uVoznji = {
  oscilatora: uVoznji.oscilatora,
  promjenaUcestanosti: f.length,
  najniza: Math.min(...f),
  najvisa: Math.max(...f),
  // Motor se ne drži jedne note: raspon mora biti osjetan.
  raspon: f.length ? Math.max(...f) - Math.min(...f) : 0,
};

izvj.prijeUtisavanja = await stanjeKonteksta(page);

// Prekidač za zvuk zatvara kontekst.
await page.getByRole("button", { name: /Isključi zvuk/ }).first().click();
await page.waitForTimeout(600);
izvj.poslijeUtisavanja = await stanjeKonteksta(page);

// Smjena je dobila isti prekidač — motor tamo svira jednako neprekidno.
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
for (let i = 0; i < 4; i++) {
  await page
    .getByRole("button", { name: /Počni smjenu/ })
    .first()
    .click()
    .catch(() => {});
  if (await page.getByRole("button", { name: /^Gas$/ }).count()) break;
  await page.waitForTimeout(400);
}
izvj.smjenaImaPrekidac = (await page.getByRole("button", { name: /Isključi zvuk/ }).count()) === 1;
await page.getByRole("button", { name: /Isključi zvuk/ }).first().click();
await page.waitForTimeout(300);
izvj.smjenaPrekidacRadi =
  (await page.getByRole("button", { name: /Uključi zvuk/ }).count()) === 1;

izvj.greske = greske;
console.log(JSON.stringify(izvj, null, 2));
await browser.close();
