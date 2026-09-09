// Igra „Prođi raskrsnicu" — karta putovanja.
//
// Pokretanje: `npx next start -p 3100` u jednom terminalu, pa se ova skripta
// kopira u folder u kojem je `npm i playwright` već urađen i pokrene odatle.
//
// Ova provjera ne vozi ništa: putovanje se ubacuje u skladište gotovo, sa
// četiri pređene dionice, pa se gleda šta karta o njemu kaže. Time traje
// sekunde umjesto minuta.
//
// Provjerava se ono što se iz jediničnih testova ne vidi:
//  - karta se stvarno nacrta i ima onoliko puteva koliko graf ima ivica,
//  - pređeni putevi su istaknuti, i tačno oni,
//  - mjesto u kojem se stoji je imenovano, kao i pravci koje putokaz nudi,
//  - natpisi se ne preklapaju,
//  - sa karte se ne može nigdje otići — do mjesta se stiže samo vožnjom.

import { chromium } from "playwright";

const URL = "http://localhost:3100/igra";

const PUTOVANJE = {
  seed: 5,
  at: "kotor",
  from: "tivat",
  legs: 4,
  km: 92,
  visited: ["podgorica", "cetinje", "budva", "tivat", "kotor"],
  seen: ["cetinjski-manastir", "budva-stari-grad", "porto-montenegro"],
  driven: ["podgorica--cetinje", "cetinje--budva", "budva--tivat", "tivat--kotor"],
  ljeto: true,
};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 900, height: 1200 } })).newPage();
const greske = [];
page.on("pageerror", (e) => greske.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !/_vercel|Failed to load resource/.test(m.text())) {
    greske.push(`console: ${m.text()}`);
  }
});

await page.goto(URL, { waitUntil: "networkidle" });
await page.evaluate((p) => window.localStorage.setItem("mirav.putovanje", JSON.stringify(p)), PUTOVANJE);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(400);
for (let i = 0; i < 5; i++) {
  await page
    .getByRole("button", { name: /^Kreni na put$/i })
    .first()
    .click()
    .catch(() => {});
  if (await page.getByRole("button", { name: /Nastavi putovanje/i }).count()) break;
  await page.waitForTimeout(400);
}
await page.getByRole("button", { name: /Nastavi putovanje/i }).first().click();
await page.waitForTimeout(500);

const izvj = {};
izvj.kartaSakrivenaNaPocetku = (await page.locator("svg[role='img']").count()) === 0;
await page.getByRole("button", { name: /^Karta$/i }).first().click();
await page.waitForTimeout(500);

const karta = page.locator("svg[role='img']");
izvj.kartaOtvorena = (await karta.count()) === 1;

const linije = await karta.locator("line").evaluateAll((els) =>
  els.map((e) => ({ boja: e.getAttribute("stroke"), sirina: Number(e.getAttribute("stroke-width")) })),
);
izvj.putevi = {
  ukupno: linije.length,
  // Graf ima 54 ivice; svaka mora biti nacrtana tačno jednom.
  svakaIvicaNacrtana: linije.length === 54,
  istaknutih: linije.filter((l) => l.sirina > 3).length,
  // Četiri pređene dionice — ni manje ni više.
  istaknutoTacno: linije.filter((l) => l.sirina > 3).length === PUTOVANJE.driven.length,
};

const natpisi = await karta.locator("text").evaluateAll((els) =>
  els.map((e) => {
    const r = e.getBoundingClientRect();
    return { t: e.textContent, x: r.x, y: r.y, w: r.width, h: r.height };
  }),
);
const imena = natpisi.map((n) => n.t);
izvj.natpisi = {
  komada: imena.length,
  imaGdjeSam: imena.includes("Kotor"),
  imaPonudjene: ["Njeguši", "Kamenari"].every((g) => imena.includes(g)),
  imaPosjecene: ["Podgorica", "Cetinje", "Budva", "Tivat"].every((g) => imena.includes(g)),
  // Nijedno mjesto koje nije ni posjećeno ni ponuđeno ne smije biti imenovano.
  nemaSuvisnih: !imena.some((g) => ["Nikšić", "Pljevlja", "Ulcinj", "Bar"].includes(g)),
};

// Preklapanje se mjeri, ne procjenjuje: dvije kutije natpisa se ne smiju sjeći.
let preklapanja = 0;
for (let i = 0; i < natpisi.length; i++) {
  for (let j = i + 1; j < natpisi.length; j++) {
    const a = natpisi[i];
    const b = natpisi[j];
    if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) preklapanja += 1;
  }
}
izvj.natpisi.preklapanja = preklapanja;

// Sa karte se ne putuje: u njoj nema nijednog dugmeta ni veze.
izvj.kartaNijePrecica =
  (await karta.locator("a, button").count()) === 0 &&
  (await page.getByRole("button", { name: /Kreni →/ }).count()) === 2;

await page.getByRole("button", { name: /Sakrij kartu/i }).first().click();
await page.waitForTimeout(300);
izvj.kartaSeSakriva = (await page.locator("svg[role='img']").count()) === 0;

izvj.greske = greske;
console.log(JSON.stringify(izvj, null, 2));
await browser.close();
