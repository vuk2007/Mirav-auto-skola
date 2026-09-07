// Igra „Prođi raskrsnicu" — pokazivač pravca u pregledaču.
//
// Pokretanje: `npx next start -p 3100` u jednom terminalu, pa u drugom se ova
// skripta kopira u folder u kojem je `npm i playwright` već urađen i pokrene
// odatle. NODE_PATH ovdje ne pomaže — ESM ga ne gleda.
//
// Provjerava: da postoje dugmad pokazivača i da rade i mišem i tastaturom, da
// skretanje bez pokazivača obara vožnju, da ostavljen pokazivač daje samo blagu
// grešku (vožnja i dalje prolazi), i da se poslije scenarija vidi traka
// pokazivača.

import { chromium, webkit } from "playwright";

const URL = "http://localhost:3100/igra";

async function cekajKraj(page, ms = 45000) {
  const kraj = Date.now() + ms;
  while (Date.now() < kraj) {
    const txt = await page.locator("main").innerText();
    if (/bez prekršaja/i.test(txt)) return "prosao";
    if (/nije ispravna/i.test(txt)) return "pao";
    await page.waitForTimeout(150);
  }
  return "isteklo";
}

for (const [ime, pokreni, viewport] of [
  ["chromium-desktop", chromium, { width: 1440, height: 1100 }],
  ["webkit-mobile", webkit, { width: 390, height: 900 }],
]) {
  const browser = await pokreni.launch();
  const page = await (await browser.newContext({ viewport })).newPage();
  const greske = [];
  page.on("pageerror", (e) => greske.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("_vercel")) greske.push(`${r.status()} ${r.url()}`);
  });

  const izvj = { motor: ime };
  await page.goto(URL, { waitUntil: "networkidle" });
  const stavke = page.locator("main ul > li > button");
  const otvori = async (naslov) => {
    const svi = await stavke.allInnerTexts();
    const i = svi.findIndex((x) => x.includes(naslov));
    if (i < 0) throw new Error(`nema situacije „${naslov}"`);
    await stavke.nth(i).click();
  };

  // ── 1) skretanje ulijevo bez pokazivača: pad ─────────────────────────────
  await otvori("Skretanje ulijevo pred susretnim vozilom");
  await page.getByRole("button", { name: "Kreni" }).click();
  const lijevo = page.getByRole("button", { name: /Pokazivač: Lijevo/ });
  izvj.imaDugmadPokazivaca = await lijevo.isVisible();

  await page.keyboard.down("ArrowUp");
  izvj.bezPokazivaca = await cekajKraj(page);
  await page.keyboard.up("ArrowUp");
  let txt = await page.locator("main").innerText();
  izvj.prijavljenoBezPokazivaca = /Bez pokazivača pravca/i.test(txt);
  izvj.imaTraku = /Pokazivač duž putanje/i.test(txt);
  izvj.imaPravilo = /Namjeru da skrenete najavljujete/i.test(txt);

  // ── 2) isto skretanje, pokazivač uključen tastaturom i ostavljen ─────────
  await page.getByRole("button", { name: "Pokušaj ponovo" }).click();
  await page.waitForTimeout(200);
  await page.keyboard.press("ArrowLeft"); // pali lijevi
  izvj.tastaturaPaliPokazivac =
    (await lijevo.getAttribute("aria-pressed")) === "true";
  // Vozi kako treba: sačekaj susretno vozilo pa skreni.
  await page.waitForTimeout(4200);
  await page.keyboard.down("ArrowUp");
  izvj.saPokazivacem = await cekajKraj(page);
  await page.keyboard.up("ArrowUp");
  txt = await page.locator("main").innerText();
  izvj.ostavljenPokazivac = /Pokazivač ostavljen uključen/i.test(txt);
  izvj.oznakaBlage = /blaga greška/i.test(txt);

  // ── 3) dugme mišem gasi pokazivač ────────────────────────────────────────
  await page.getByRole("button", { name: "Pokušaj ponovo" }).click();
  await page.waitForTimeout(200);
  await lijevo.click();
  const upaljen = (await lijevo.getAttribute("aria-pressed")) === "true";
  await lijevo.click();
  const ugasen = (await lijevo.getAttribute("aria-pressed")) === "false";
  izvj.dugmePrekidac = upaljen && ugasen;

  izvj.greske = greske;
  console.log(JSON.stringify(izvj, null, 2));
  await browser.close();
}
