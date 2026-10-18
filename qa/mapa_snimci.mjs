// Provjera mape (faza 6): snimci kadra igre nad zadatim tačkama (kamera kroz
// `?debug=1` kuku `kamera`), na zadatom zumu. node mapa_snimci.mjs <tacke.json> <folder> [zum]
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
const [fajl, folder, zum = "1"] = process.argv.slice(2);
const tacke = JSON.parse(readFileSync(fajl, "utf8"));
mkdirSync(folder, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await (await browser.newContext({ viewport: { width: 900, height: 1500 }, deviceScaleFactor: 2 })).newPage();
const greske = [];
page.on("pageerror", (e) => greske.push(e.message));
await page.goto(`http://localhost:3100/igra?debug=1&sat=12&gustina=0&pjesaci=0`, { waitUntil: "load", timeout: 240000 });
await page.getByRole("button", { name: /^Vozi po Podgorici$/i }).click();
await page.waitForFunction(() => /Ulica:/.test(document.querySelector("main")?.innerText ?? ""), null, { timeout: 240000 });
for (let i = 0; i < Number(zum); i++) await page.getByRole("button", { name: /Udalji|Zoom out|−/ }).first().click();
const platno = page.locator("main canvas").first();
for (const t of tacke) {
  await page.evaluate((p) => window.__grad.kamera(p), { x: t.x, y: t.y });
  await page.waitForTimeout(900);
  await platno.screenshot({ path: `${folder}/${t.ime}.png` });
}
await browser.close();
console.log(JSON.stringify({ snimaka: tacke.length, greske }));
