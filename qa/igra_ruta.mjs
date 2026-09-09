// Igra „Prođi raskrsnicu" — vožnja cijele rute.
//
// Pokretanje: `npx next start -p 3100` u jednom terminalu, pa se ova skripta
// kopira u folder u kojem je `npm i playwright` već urađen i pokrene odatle.
//
// Ovo je jedina provjera koja može da potvrdi ono što jedinični testovi ne
// vide: da se ruta STVARNO vozi u pregledaču, da se kadar okreće sa putem i da
// se prelazak sa dionice na dionicu desi bez ijednog ekrana između.
//
// Šta se mjeri, i zašto baš to:
//  - brojač dionica mora da poraste (1/4 → 2/4 …). To je jedini dokaz da je
//    granica dionice prošla, a slika se nije prekinula;
//  - preostali kilometri moraju da padaju, jednako i preko granice dionice;
//  - platno ne smije biti prazno ni u jednom trenutku — prazno platno znači da
//    je kamera ostala negdje gdje puta nema;
//  - nijedna greška u konzoli.

import { chromium } from "playwright";

const URL = "http://localhost:3100/igra";

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 900, height: 1000 } })).newPage();
const greske = [];
page.on("pageerror", (e) => greske.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !/_vercel|Failed to load resource/.test(m.text())) {
    greske.push(`console: ${m.text()}`);
  }
});

/** Koliko piksela na platnu nije boja podloge — mjera da se nešto crta. */
const nacrtano = () =>
  page.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c) return -1;
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4 * 37) {
      // Trava je jedna boja; sve što od nje odudara je put, vozilo ili tabla.
      if (Math.abs(d[i] - d[i + 1]) > 6 || Math.abs(d[i + 1] - d[i + 2]) > 6) n += 1;
    }
    return n;
  });

const izvj = { koraci: [] };

await page.goto(URL, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /^Vozi rutu$/i }).first().click();
await page.waitForTimeout(300);

// Budva → Kolašin je ruta iz zadatka i podrazumijevani izbor.
izvj.polaziste = await page.locator("select").first().inputValue();
izvj.odrediste = await page.locator("select").nth(1).inputValue();

const pocetak = Date.now();
await page.getByRole("button", { name: /^Kreni$/i }).first().click();
await page.waitForSelector("canvas", { timeout: 60000 });
izvj.pripremaMs = Date.now() - pocetak;

await page.waitForTimeout(500);
izvj.nacrtanoNaPocetku = await nacrtano();

// Vozi se gasom do kraja; mjeri se svakih desetak sekundi.
await page.keyboard.down("ArrowUp");
let najmanjeNacrtano = Infinity;
const dionice = new Set();
let prethodnoOstalo = Infinity;
let ostaloRaste = 0;

for (let i = 0; i < 120; i++) {
  await page.waitForTimeout(5000);
  const txt = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  const gotovo = /Stigli ste|Sudar/i.test(txt);
  if (gotovo) {
    izvj.zavrsilo = /Stigli ste/i.test(txt) ? "stiglo" : "sudar";
    break;
  }
  const d = /DIONICA (\d+)\/(\d+)/i.exec(txt);
  const km = /KM ([\d.]+) km/i.exec(txt);
  const brzina = /BRZINA (\d+) km\/h/i.exec(txt);
  const crta = await nacrtano();
  najmanjeNacrtano = Math.min(najmanjeNacrtano, crta);
  if (d) dionice.add(d[1]);
  const ostalo = km ? Number(km[1]) : null;
  if (ostalo !== null && ostalo > prethodnoOstalo + 0.05) ostaloRaste += 1;
  if (ostalo !== null) prethodnoOstalo = ostalo;

  izvj.koraci.push({
    t: (i + 1) * 5,
    dionica: d ? `${d[1]}/${d[2]}` : null,
    ostaloKm: ostalo,
    brzina: brzina ? Number(brzina[1]) : null,
    nacrtano: crta,
  });
  if (izvj.koraci.length <= 3 || izvj.koraci.length % 20 === 0) {
    await page.locator("canvas").screenshot({ path: `ruta-${String(i).padStart(3, "0")}.png` });
  }
}
await page.keyboard.up("ArrowUp");

izvj.dionicaProslo = [...dionice].sort();
izvj.presloViseDionica = dionice.size > 1;
izvj.najmanjeNacrtano = najmanjeNacrtano;
izvj.platnoNikadPrazno = najmanjeNacrtano > 50;
izvj.kilometrazaSamoPada = ostaloRaste === 0;
izvj.greske = greske;
console.log(JSON.stringify(izvj, null, 2));
await browser.close();
