// QA 9a: odredišta, navigacija i mini mapa u gradu — izbor cilja pretragom,
// putokaz sa sljedećim manevrom, ruta na mini mapi; pretraga ne pomjera auto.
// Pokretanje: `npm run build && npx next start -p 3100`, pa iz foldera sa
// `npm i playwright`: node faza9_zadaci.mjs [port]. Snimci: zadaci-*.png.
import { chromium } from "playwright";
const port = process.argv[2] ?? "3100";
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const izvjestaj = {};
const greske = [];

const page = await (await browser.newContext({ viewport: { width: 900, height: 1500 }, deviceScaleFactor: 2 })).newPage();
page.on("pageerror", (e) => greske.push(e.message));
await page.goto(`http://localhost:${port}/igra?debug=1&sat=12`, { waitUntil: "load", timeout: 240000 });
await page.getByRole("button", { name: /^Vozi po Podgorici$/i }).click();
await page.waitForFunction(() => /Ulica:/.test(document.querySelector("main")?.innerText ?? ""), null, { timeout: 240000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: "zadaci-pocetak.png" });

// Izbor cilja: pretraga „elektro" (bez dijakritika i slova volana) — Elektrotehnička škola.
await page.getByRole("button", { name: /^Izaberi cilj$/ }).click();
await page.getByRole("dialog").waitFor();
izvjestaj.kategorija = await page.getByRole("dialog").locator("h3").allInnerTexts();
const polje = page.getByRole("searchbox");
await polje.fill("");
await polje.pressSequentially("elektro wasd");
await polje.fill("elektro");
await page.screenshot({ path: "zadaci-izbor.png" });
const brzinaPrije = await page.evaluate(() => document.querySelector("main")?.innerText.match(/(\d+) km\/h/)?.[1]);
await page.getByRole("dialog").getByRole("button", { name: /elektrotehni/i }).click();
await page.waitForTimeout(1500);
izvjestaj.putokaz = await page.getByRole("status").allInnerTexts();
izvjestaj.brzinaPoslijeKucanja = brzinaPrije;
await page.screenshot({ path: "zadaci-navigacija.png" });
await page.locator("main canvas").first().locator("..").screenshot({ path: "zadaci-kadar.png" });

await browser.close();
console.log(JSON.stringify({ izvjestaj, greske }, null, 1));
