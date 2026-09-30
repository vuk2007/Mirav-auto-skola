// Podgorica u razmjeri 1:1 — slobodna vožnja bez pravila (faza 6, stavka 3).
//
// Pokretanje: `npx next start -p 3100` u jednom terminalu, pa se ova skripta
// kopira u folder u kojem je `npm i playwright` već urađen i pokrene odatle.
//
// Šta se provjerava:
//  - paket grada stiže jednim zahtjevom i sa zaglavljem za trajno keširanje;
//  - grad se crta (WebGL, pravi grafički čip) i vozi: brzina raste, ulica
//    se mijenja, kadrovi teku;
//  - volan pred raskrsnicom mijenja ulicu;
//  - nijedna greška u konzoli.
// Snimci se prave svakih nekoliko sekundi — za pregled mape (stop tačka).

import { chromium } from "playwright";

const URL = "http://localhost:3100/igra?debug=1";
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await (await browser.newContext({ viewport: { width: 900, height: 1300 } })).newPage();
const greske = [];
page.on("pageerror", (e) => greske.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !/_vercel|Failed to load resource/.test(m.text())) greske.push(`console: ${m.text()}`);
});
const paketi = [];
page.on("response", (r) => {
  if (r.url().includes("/data/grad/") && r.url().endsWith(".bin")) {
    paketi.push({ url: r.url().split("/").pop(), status: r.status(), kes: r.headers()["cache-control"] ?? null });
  }
});

await page.goto(URL, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /^Vozi po Podgorici$/i }).click();
await page.waitForFunction(() => /Ulica:/.test(document.querySelector("main")?.innerText ?? ""), null, { timeout: 60000 });
await page.waitForTimeout(1000);

const stanje = async () => {
  const t = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  return {
    kmh: Number(/BRZINA (\d+)/i.exec(t)?.[1] ?? 0),
    ulica: /Ulica: (.+?)(?: · (\d+) fps|$| Volan)/.exec(t)?.[1]?.trim() ?? "",
    fps: Number(/· (\d+) fps/.exec(t)?.[1] ?? 0),
  };
};

const izvj = { paketi, snimci: [] };
izvj.start = await stanje();
await page.locator("main canvas").locator("..").screenshot({ path: "grad-00.png" });

// Vožnja: gas do ~40 km/h, pa se drži; svakih nekoliko sekundi volan na
// jednu stranu (do raskrsnice), da se vidi skretanje i više ulica.
const ulice = new Set([izvj.start.ulica]);
let gas = false;
const pocetak = Date.now();
let snimak = 0;
let strana = null;
let stranaDo = 0;
while (Date.now() - pocetak < 90000) {
  const s = await stanje();
  if (s.kmh < 38 && !gas) {
    await page.keyboard.down("ArrowUp");
    gas = true;
  } else if (s.kmh >= 42 && gas) {
    await page.keyboard.up("ArrowUp");
    gas = false;
  }
  if (s.kmh > 48) {
    await page.keyboard.down("ArrowDown");
    await page.waitForTimeout(120);
    await page.keyboard.up("ArrowDown");
  }
  const sek = (Date.now() - pocetak) / 1000;
  // Svakih 15 s: 6 s volan na jednu stranu (naizmjenično), pa pravo.
  if (strana === null && sek > 8 && Math.floor(sek) % 15 === 0) {
    strana = (Math.floor(sek / 15) % 2 === 0) ? "ArrowRight" : "ArrowLeft";
    stranaDo = Date.now() + 6000;
    await page.keyboard.down(strana);
  } else if (strana !== null && Date.now() > stranaDo) {
    await page.keyboard.up(strana);
    strana = null;
  }
  ulice.add(s.ulica);
  if (sek > 10 * (snimak + 1)) {
    snimak += 1;
    await page.locator("main canvas").locator("..").screenshot({ path: `grad-${String(snimak).padStart(2, "0")}.png` });
    izvj.snimci.push({ sek: Math.round(sek), ...s });
  }
  await page.waitForTimeout(150);
}
if (gas) await page.keyboard.up("ArrowUp");
if (strana) await page.keyboard.up(strana);

// Pregled mape: kadar se udaljava do kraja, snimak na svakom stepenu.
for (let z = 1; z <= 3; z++) {
  await page.getByRole("button", { name: /^Udalji$/ }).click();
  await page.waitForTimeout(1500);
  await page.locator("main canvas").locator("..").screenshot({ path: `grad-zum-${z}.png` });
}
izvj.zumFps = (await stanje()).fps;
izvj.ulice = [...ulice];
izvj.greske = greske;
await browser.close();
console.log(JSON.stringify(izvj, null, 2));
