// Igra „Prođi raskrsnicu", faza 3 — tok igre u pregledaču.
//
// Pokretanje: `npx next start -p 3100` u jednom terminalu, pa u drugom se ova
// skripta kopira u folder u kojem je `npm i playwright` već urađen i pokrene
// odatle. NODE_PATH ovdje ne pomaže — ESM ga ne gleda. Playwright namjerno NIJE
// zavisnost projekta, kao ni za ostale skripte u ovom folderu.
//
// Provjerava: spisak od osam situacija, ulazak u situaciju, karticu prekršaja
// sa pravilom, ponavljanje posljednjih pet sekundi, upis napretka i njegovo
// preživljavanje osvježavanja stranice, te prebacivanje jezika.

import { chromium, webkit } from "playwright";

const URL = "http://localhost:3100/igra";

const MOTORI = [
  { ime: "chromium-desktop", pokreni: chromium, viewport: { width: 1440, height: 900 }, touch: false },
  { ime: "webkit-mobile", pokreni: webkit, viewport: { width: 390, height: 844 }, touch: true },
];

const hudVrijeme = async (page) => {
  const txt = await page.locator("main").innerText();
  const m = /([\d.]+)\s*s/.exec(txt);
  return m ? Number(m[1]) : null;
};

async function cekajKraj(page, ms = 30000) {
  const kraj = Date.now() + ms;
  while (Date.now() < kraj) {
    const txt = await page.locator("main").innerText();
    if (/bez prekršaja/i.test(txt)) return "prosao";
    if (/nije ispravna/i.test(txt)) return "pao";
    await page.waitForTimeout(150);
  }
  return "isteklo";
}

for (const m of MOTORI) {
  const browser = await m.pokreni.launch();
  const ctx = await browser.newContext({ viewport: m.viewport, hasTouch: m.touch });
  const page = await ctx.newPage();
  const greske = [];
  page.on("pageerror", (e) => greske.push(`pageerror: ${e.message}`));
  // Poruka iz konzole ne nosi URL, pa se neuspjeli zahtjevi hvataju po odgovoru.
  // `_vercel/insights` van Vercela uvijek vrati 404 i to nije greška stranice.
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("_vercel")) greske.push(`${r.status()} ${r.url()}`);
  });

  const izvj = { motor: m.ime };
  await page.goto(URL, { waitUntil: "networkidle" });

  // ── spisak ────────────────────────────────────────────────────────────────
  const stavke = page.locator("main ul > li > button");
  izvj.brojSituacija = await stavke.count();
  izvj.napredakPrije = (await page.locator("main").innerText()).match(/pro[sš]li ste \d+ od \d+/i)?.[0];
  izvj.imaNaslovME = /Pravilo desne strane — ustupate/.test(await page.locator("main").innerText());

  // ── pun gas u prvoj situaciji: prekršaj + pravilo ────────────────────────
  await stavke.first().click();
  await page.getByRole("button", { name: "Kreni" }).click();
  await page.keyboard.down("ArrowUp");
  izvj.ishod = await cekajKraj(page);
  await page.keyboard.up("ArrowUp");

  const kartica = await page.locator("main").innerText();
  izvj.prekrsaj = /Oduzeto prvenstvo prolaza/.test(kartica);
  izvj.pravilo = /PRAVILO/.test(kartica) && /prvenstvo ima vozilo koje vam dolazi s desne/.test(kartica);

  // ── ponavljanje ──────────────────────────────────────────────────────────
  const tPrije = await hudVrijeme(page);
  await page.getByRole("button", { name: "Ponovi zadnjih 5 s" }).click();
  await page.waitForTimeout(300);
  const tUReplayu = await hudVrijeme(page);
  izvj.replayVratioVrijeme = tPrije !== null && tUReplayu !== null && tUReplayu < tPrije;
  izvj.replayOznaka = await page.getByText("Ponavljanje", { exact: true }).isVisible().catch(() => false);
  await page.waitForTimeout(6000);
  izvj.replayZavrsio = !(await page
    .getByText("Ponavljanje", { exact: true })
    .isVisible()
    .catch(() => false));

  // ── nazad na spisak: napredak upisan ─────────────────────────────────────
  await page.getByRole("button", { name: "Druga situacija" }).click();
  const spisakTxt = await page.locator("main").innerText();
  izvj.spisakBiljeziPad = /Niste prošli/.test(spisakTxt) && /1 pokušaja/.test(spisakTxt);

  // ── polaganje druge situacije („imate prednost" — samo gas prolazi) ──────
  await stavke.nth(1).click();
  await page.getByRole("button", { name: "Kreni" }).click();
  await page.keyboard.down("ArrowUp");
  izvj.ishodDruge = await cekajKraj(page);
  await page.keyboard.up("ArrowUp");
  izvj.imaSljedeca = await page
    .getByRole("button", { name: /Sljedeća situacija/ })
    .isVisible()
    .catch(() => false);

  await page.getByRole("button", { name: "Druga situacija" }).click();
  izvj.napredakPoslije = (await page.locator("main").innerText()).match(/pro[sš]li ste \d+ od \d+/i)?.[0];

  // ── preživljava li osvježavanje ──────────────────────────────────────────
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  izvj.napredakPoslijeReload = (await page.locator("main").innerText()).match(
    /pro[sš]li ste \d+ od \d+/i,
  )?.[0];

  // ── jezik ────────────────────────────────────────────────────────────────
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.waitForTimeout(200);
  const en = await page.locator("main").innerText();
  izvj.imaNaslovEN = /Right-hand rule — you give way/.test(en);
  izvj.imaVodjicuEN = /Each situation drills one rule/.test(en);

  izvj.greske = greske;
  console.log(JSON.stringify(izvj, null, 2));
  await browser.close();
}
