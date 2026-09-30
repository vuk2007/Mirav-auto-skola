// Podgorica u razmjeri 1:1 — slobodna vožnja bez pravila (faza 6, stavke 3b i 3c).
//
// Pokretanje: `npx next start -p 3100` u jednom terminalu, pa se ova skripta
// kopira u folder u kojem je `npm i playwright` već urađen i pokrene odatle.
//
// Šta se provjerava:
//  - paket grada stiže jednim zahtjevom i sa zaglavljem za trajno keširanje;
//  - grad se crta (WebGL, pravi grafički čip) i vozi: brzina raste, ulica
//    se mijenja, kadrovi teku;
//  - volan okreće auto (3c): skretanje volanom mijenja ulicu;
//  - rikverc: kočnica držana u mjestu vozi unazad, a na ekranu piše „Rikverc";
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

// Vožnja: gas do ~30 km/h; svakih 12 s uspori na petnaestak, pa volan na
// jednu stranu (naizmjenično) sekundu i po — skretanje gdje god se zateklo.
// Ivičnjak koji se okrzne auto samo uspori; čeoni udar se rješava rikvercom.
const ulice = new Set([izvj.start.ulica]);
const pocetak = Date.now();
let snimak = 0;
let drzi = { gas: false, koc: false };
const pedala = async (gas, koc) => {
  if (gas !== drzi.gas) await (gas ? page.keyboard.down("ArrowUp") : page.keyboard.up("ArrowUp"));
  if (koc !== drzi.koc) await (koc ? page.keyboard.down("ArrowDown") : page.keyboard.up("ArrowDown"));
  drzi = { gas, koc };
};
let faza = "vozi";
let fazaDo = 0;
let strana = "ArrowRight";
let stojiOd = null;
izvj.skretanja = 0;
izvj.izvlacenja = 0;
while (Date.now() - pocetak < 90000) {
  const s = await stanje();
  const sek = (Date.now() - pocetak) / 1000;
  const sad = Date.now();
  if (faza === "vozi") {
    await pedala(s.kmh < 28, s.kmh > 34);
    if (sek > 6 && sek % 12 < 0.3) faza = "uspori";
    // Zaglavljen (čeono u ivičnjak): dvije sekunde unazad, pa dalje.
    if (s.kmh < 1 && drzi.gas) stojiOd ??= sad;
    else stojiOd = null;
    if (stojiOd !== null && sad - stojiOd > 1500) {
      faza = "rikverc";
      fazaDo = sad + 2500;
      stojiOd = null;
      izvj.izvlacenja += 1;
    }
  } else if (faza === "uspori") {
    await pedala(false, s.kmh > 15);
    if (s.kmh <= 15) {
      faza = "skreni";
      fazaDo = sad + 1500;
      strana = strana === "ArrowRight" ? "ArrowLeft" : "ArrowRight";
      await page.keyboard.down(strana);
      izvj.skretanja += 1;
    }
  } else if (faza === "skreni") {
    await pedala(s.kmh < 14, false);
    if (sad > fazaDo) {
      await page.keyboard.up(strana);
      faza = "vozi";
    }
  } else if (faza === "rikverc") {
    await pedala(false, true);
    if (sad > fazaDo) {
      await pedala(false, false);
      faza = "vozi";
    }
  }
  ulice.add(s.ulica);
  if (sek > 10 * (snimak + 1)) {
    snimak += 1;
    await page.locator("main canvas").locator("..").screenshot({ path: `grad-${String(snimak).padStart(2, "0")}.png` });
    izvj.snimci.push({ sek: Math.round(sek), ...s });
  }
  await page.waitForTimeout(100);
}
await page.keyboard.up(strana);

// Rikverc: zaustavi se, pa drži kočnicu — auto ide unazad i piše „Rikverc".
await pedala(false, true);
// Auto prvo stane, pa se poslije `GRAD_RIKVERC_CEKANJE` ubaci rikverc.
await page.waitForFunction(() => (document.querySelector("main")?.innerText ?? "").includes("Rikverc"), null, { timeout: 15000 });
await page.waitForTimeout(2500);
const unazad = await stanje();
const natpis = (await page.locator("main").innerText()).includes("Rikverc");
await page.locator("main canvas").locator("..").screenshot({ path: "grad-rikverc.png" });
await pedala(false, false);
await pedala(true, false);
// Gas u rikvercu prvo zaustavi auto, pa ga vrati naprijed. Koliko će daleko
// stići zavisi od toga šta je ispred (robot vozi naslijepo), pa se bilježi
// najveća brzina, ne krajnja.
let naprijed = { kmh: 0 };
for (let i = 0; i < 25; i++) {
  const s = await stanje();
  if (s.kmh > naprijed.kmh) naprijed = s;
  await page.waitForTimeout(100);
}
const natpisPoslije = (await page.locator("main").innerText()).includes("Rikverc");
await pedala(false, false);
izvj.rikverc = { kmhUnazad: unazad.kmh, natpis, kmhNaprijedPoslije: naprijed.kmh, natpisPoslije };

// Pregled mape: kadar se udaljava do kraja, snimak na svakom stepenu.
for (let z = 1; z <= 4; z++) {
  await page.getByRole("button", { name: /^Udalji$/ }).click();
  await page.waitForTimeout(1500);
  await page.locator("main canvas").locator("..").screenshot({ path: `grad-zum-${z}.png` });
}
izvj.zumFps = (await stanje()).fps;
izvj.ulice = [...ulice];
izvj.greske = greske;
await browser.close();
console.log(JSON.stringify(izvj, null, 2));
