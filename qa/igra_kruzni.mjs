// Igra „Prođi raskrsnicu" — kružni tok u pregledaču.
//
// Pokretanje: `npx next start -p 3100` u jednom terminalu, pa u drugom se ova
// skripta kopira u folder u kojem je `npm i playwright` već urađen i pokrene
// odatle. NODE_PATH ovdje ne pomaže — ESM ga ne gleda.
//
// Provjerava: da su četiri scenarija kružnog toka na spisku, da se zadatak
// ispisuje kao redni broj izlaza, da se scena iscrtava i da bezobzirna vožnja
// u prsten daje oduzeto prvenstvo.

import { chromium } from "playwright";
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1440, height: 1200 } })).newPage();
const greske = [];
page.on("pageerror", (e) => greske.push(`pageerror: ${e.message}`));
page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("_vercel")) greske.push(`${r.status()} ${r.url()}`); });
const stavke = () => page.locator("main ul > li > button");
const otvori = async (n) => {
  const svi = await stavke().allInnerTexts();
  const i = svi.findIndex((x) => x.includes(n));
  if (i < 0) throw new Error("nema " + n);
  await stavke().nth(i).click();
};
await page.goto("http://localhost:3100/igra", { waitUntil: "networkidle" });
const izvj = { broj: await stavke().count() };
const naslovi = await stavke().allInnerTexts();
izvj.kruzniNaSpisku = naslovi.filter((x) => /Kružni tok/.test(x)).length;

await otvori("Kružni tok — drugi izlaz");
await page.waitForTimeout(300);
izvj.zadatak = (await page.locator("main").innerText()).match(/Izlazite na .*/)?.[0];
await page.getByRole("button", { name: "Kreni" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: "krug-scena.png", clip: { x: 300, y: 90, width: 840, height: 900 } });
// pun gas bez zmigavca
await page.keyboard.down("ArrowUp");
for (let i = 0; i < 250; i++) {
  const t = await page.locator("main").innerText();
  if (/bez prekršaja|nije ispravna/i.test(t)) break;
  await page.waitForTimeout(150);
}
await page.keyboard.up("ArrowUp");
const txt = await page.locator("main").innerText();
izvj.ishodPunGas = /nije ispravna/i.test(txt) ? "pao" : /bez prekršaja/i.test(txt) ? "prosao" : "?";
izvj.prekrsaji = txt.match(/(Oduzeto prvenstvo prolaza|Sudar|Bez pokazivača pravca|Pokazivač ostavljen uključen)/g) ?? [];
await page.screenshot({ path: "krug-kraj.png", clip: { x: 300, y: 300, width: 840, height: 900 } });
izvj.greske = greske;
console.log(JSON.stringify(izvj, null, 2));
await b.close();
