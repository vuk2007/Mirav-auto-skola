// QA 8d: dnevni ciklus — sat u HUD-u, svjetlo po satu (dan, sumrak, prelaz,
// noć), gustina po satu (noć vs jutarnja gužva) i kraj nastave kod škole.
// Pokretanje: `npm run build && npx next start -p 3100`, pa iz foldera sa
// `npm i playwright`: node faza8_dan.mjs [port]. Snimci: dan-*.png.
import { chromium } from "playwright";
const port = process.argv[2] ?? "3100";
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const izvjestaj = {};
const greske = [];

async function otvori(upit) {
  const page = await (await browser.newContext({ viewport: { width: 900, height: 1300 }, deviceScaleFactor: 2 })).newPage();
  page.on("pageerror", (e) => greske.push(e.message));
  await page.goto(`http://localhost:${port}/igra?debug=1&${upit}`, { waitUntil: "load", timeout: 240000 });
  await page.getByRole("button", { name: /^Vozi po Podgorici$/i }).click();
  await page.waitForFunction(() => /Ulica:/.test(document.querySelector("main")?.innerText ?? ""), null, { timeout: 240000 });
  return page;
}
const hud = (page) =>
  page.evaluate(() => {
    const t = document.querySelector("main")?.innerText ?? "";
    return { sat: t.match(/\b\d\d:\d\d\b/)?.[0], vozila: Number(t.match(/(\d+) vozila/)?.[1]), pjesaka: Number(t.match(/(\d+) pješaka/)?.[1]) };
  });
const snimi = (page, ime) => page.locator("main canvas").first().locator("..").screenshot({ path: ime });

// 1. Svjetlo: isti kadar u centru, sat pomjeren dugmadima.
{
  const page = await otvori("gdje=-17,271&sat=12");
  await page.waitForTimeout(3000);
  for (const [dugme, ime, cekaj] of [
    [/^Dan/, "dan-12.png", 1500],
    [/^Sumrak/, "dan-1930.png", 1500],
    [null, "dan-2015.png", 45000],
    [/^Noć/, "dan-23.png", 1500],
  ]) {
    if (dugme) await page.getByRole("button", { name: dugme }).click();
    await page.waitForTimeout(cekaj);
    await snimi(page, ime);
    izvjestaj[ime] = await hud(page);
  }
  await page.context().close();
}

// 2. Gustina po satu: noć (3:30) i jutarnja gužva (8:00), poslije 25 s.
for (const sat of [3.5, 8]) {
  const page = await otvori(`gdje=-17,271&sat=${sat}`);
  await page.waitForTimeout(25000);
  izvjestaj[`gustina-${sat}`] = await hud(page);
  await page.context().close();
}

// 3. Kraj nastave: kod škole (-151,-165) u 10:30 i u 12:55.
for (const sat of [10.5, 12.9]) {
  const page = await otvori(`gdje=-151,-165&sat=${sat}`);
  await page.waitForTimeout(25000);
  izvjestaj[`skola-${sat}`] = await hud(page);
  if (sat > 12) await snimi(page, "dan-skola-13.png");
  await page.context().close();
}
await browser.close();
console.log(JSON.stringify({ izvjestaj, greske }, null, 1));
