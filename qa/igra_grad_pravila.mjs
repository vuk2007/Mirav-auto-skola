// Pravila raskrsnica u gradu — stavka 5c: da li se stop-linije, znakovi i
// semafori vide tamo gdje ih model raskrsnice stavlja.
//
// Pokretanje: `npx next start -p 3100`, pa se skripta kopira u folder sa
// `npm i playwright` i pokrene odatle. Vožnja počinje na zadatoj tački
// (`?debug=1&gdje=x,y`), auto stoji; snimak sada i poslije 15 s (semafor
// mijenja fazu), pa i noću.

import { chromium } from "playwright";

const MJESTA = [
  ["semafor-bulevar", "140,-216"],
  ["semafor-4-cvora", "-323,147"],
  ["stop", "99,-116"],
  ["ustupi-izvedeno", "-17,271"],
];
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await (await browser.newContext({ viewport: { width: 900, height: 1300 } })).newPage();
const greske = [];
page.on("pageerror", (e) => greske.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !/_vercel|Failed to load resource/.test(m.text())) greske.push(`console: ${m.text()}`);
});
const snimi = (ime) => page.locator("main canvas").locator("..").screenshot({ path: `pravila-${ime}.png` });
for (const [ime, gdje] of MJESTA) {
  await page.goto(`http://localhost:3100/igra?debug=1&gdje=${gdje}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^Vozi po Podgorici$/i }).click();
  await page.waitForFunction(() => /Ulica:/.test(document.querySelector("main")?.innerText ?? ""), null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await snimi(`${ime}-1`);
  if (ime.startsWith("semafor")) {
    await page.waitForTimeout(15000);
    await snimi(`${ime}-2`);
    await page.getByRole("button", { name: "Noć", exact: true }).click();
    await page.waitForTimeout(800);
    await snimi(`${ime}-noc`);
  }
}
await browser.close();
console.log(JSON.stringify({ greske }, null, 2));
