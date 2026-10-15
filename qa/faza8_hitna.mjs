// QA 8e: hitna vozila — rotacija danju i noću, vozila koja se sklanjaju
// udesno pred hitnim, i igrač koji stoji na sred trake (prekršaj).
// Pokretanje: `npm run build && npx next start -p 3100`, pa iz foldera sa
// `npm i playwright`: node faza8_hitna.mjs [port]. Snimci: hitna-*.png.
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
const snimi = (page, ime) => page.locator("main canvas").first().locator("..").screenshot({ path: ime });
const hitna = (page) => page.evaluate(() => window.__grad.hitna());

// 1. Danju (12 h): hitno vozilo i vozilo koje se pred njim sklonilo. Noću
// (23 h, saobraćaj je rijedak): hitno u vožnji — rotacija i odsjaj na ulici.
for (const [sat, ime, sklanjanje] of [[12, "hitna-sklanjanje-dan.png", true], [23, "hitna-noc.png", false]]) {
  const page = await otvori(`gdje=-17,271&sat=${sat}&hitno=15&hitnoPrsten=1`);
  // Kamera prati hitno; snima kad je vozilo koje se pred njim sklonilo do
  // 20 m od njega (kamera između njih), najviše 6 min.
  let uhvaceno = null;
  for (let i = 0; i < 1440 && !uhvaceno; i++) {
    await page.waitForTimeout(250);
    const h = (await hitna(page))[0];
    if (!h) continue;
    const s = h.sklonjeni.find((o) => Math.hypot(o.x - h.x, o.y - h.y) < 20);
    await page.evaluate((p) => window.__grad.kamera(p), s ? { x: (h.x + s.x) / 2, y: (h.y + s.y) / 2 } : { x: h.x, y: h.y });
    if (sklanjanje ? s : h.v > 5) uhvaceno = h;
  }
  await snimi(page, ime);
  izvjestaj[ime] = { uhvaceno };
  await page.context().close();
}

// 2. Igrač stoji, a hitno vozilo koje mu dolazi s leđa čeka baš njega:
// prekršaj (pad) i kartica sa pravilom.
{
  const page = await otvori("gdje=-17,271&sat=12&hitno=10&gustina=0.3");
  let tekst = "";
  for (let i = 0; i < 240 && !/prvenstvom prolaza/.test(tekst); i++) {
    await page.waitForTimeout(500);
    tekst = await page.evaluate(() => document.querySelector("main")?.innerText ?? "");
  }
  await page.evaluate(() => window.__grad.kamera(null));
  await page.waitForTimeout(300);
  await snimi(page, "hitna-prekrsaj.png");
  izvjestaj["hitna-prekrsaj.png"] = {
    naEkranu: /prvenstvom prolaza/.test(tekst),
    sudija: await page.evaluate(() => window.__grad.sudijaHitno().hitni),
    hitna: await hitna(page),
  };
  await page.screenshot({ path: "hitna-prekrsaj-ekran.png" });
  await page.context().close();
}
await browser.close();
console.log(JSON.stringify({ izvjestaj, greske }, null, 1));
