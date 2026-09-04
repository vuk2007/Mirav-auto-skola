// Igra „Prođi raskrsnicu", faza 4 — semafor u pregledaču.
//
// Pokretanje: `npx next start -p 3100` u jednom terminalu, pa u drugom se ova
// skripta kopira u folder u kojem je `npm i playwright` već urađen i pokrene
// odatle. NODE_PATH ovdje ne pomaže — ESM ga ne gleda.
//
// Provjerava: da spisak ima deset situacija, da HUD prikazuje boju svjetla i da
// se crveno odbrojava, da se boja stvarno mijenja tokom vožnje, i da tri
// scenarija sa semaforom daju očekivane prekršaje kad se vozi bezobzirno.

import { chromium } from "playwright";

const URL = "http://localhost:3100/igra";

const boja = async (page) => {
  const txt = await page.locator("main").innerText();
  const m = /(CRVENO|ŽUTO|ZELENO)(?:\s+(\d+)\s*s)?/.exec(txt);
  return m ? { boja: m[1], odbrojava: m[2] ? Number(m[2]) : null } : null;
};

async function cekajKraj(page, ms = 60000) {
  const kraj = Date.now() + ms;
  while (Date.now() < kraj) {
    const txt = await page.locator("main").innerText();
    if (/bez prekršaja/i.test(txt)) return "prosao";
    if (/nije ispravna/i.test(txt)) return "pao";
    await page.waitForTimeout(150);
  }
  return "isteklo";
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const greske = [];
page.on("pageerror", (e) => greske.push(`pageerror: ${e.message}`));
page.on("response", (r) => {
  if (r.status() >= 400 && !r.url().includes("_vercel")) greske.push(`${r.status()} ${r.url()}`);
});

const izvj = {};
await page.goto(URL, { waitUntil: "networkidle" });
const stavke = page.locator("main ul > li > button");
izvj.brojSituacija = await stavke.count();

const naslovi = await stavke.allInnerTexts();
izvj.imaNoveNaslove = {
  ljevak: naslovi.some((x) => /Zeleno ne znači slobodno/.test(x)),
  zuto: naslovi.some((x) => /Žuto na prilazu/.test(x)),
};

const otvori = async (naslov) => {
  const svi = await stavke.allInnerTexts();
  const i = svi.findIndex((x) => x.includes(naslov));
  if (i < 0) throw new Error(`nema situacije „${naslov}"`);
  await stavke.nth(i).click();
};

// ── semafor: crveno se odbrojava pa pređe u zeleno ─────────────────────────
await otvori("Semafor — crveno svjetlo");
izvj.semaforPrijeStarta = await boja(page);
await page.getByRole("button", { name: "Kreni" }).click();
const vidjeno = [];
for (let i = 0; i < 90; i++) {
  const b = await boja(page);
  if (b) vidjeno.push(`${b.boja}${b.odbrojava !== null ? ` ${b.odbrojava}s` : ""}`);
  await page.waitForTimeout(400);
  const txt = await page.locator("main").innerText();
  if (/bez prekršaja|nije ispravna/i.test(txt)) break;
}
const jedinstveno = vidjeno.filter((x, i) => x !== vidjeno[i - 1]);
izvj.semaforBoje = [...new Set(jedinstveno.map((x) => x.split(" ")[0]))];
const brojevi = jedinstveno
  .filter((x) => x.startsWith("CRVENO") && x.includes("s"))
  .map((x) => Number(x.split(" ")[1].replace("s", "")));
// Crveno se javlja u vise ciklusa, pa niz nije opadajuci u cjelini — trazi se
// najduzi opadajuci komad, koji odgovara jednom crvenom intervalu.
let najduzi = 0;
let tekuci = 0;
brojevi.forEach((v, i) => {
  tekuci = i > 0 && v <= brojevi[i - 1] ? tekuci + 1 : 1;
  najduzi = Math.max(najduzi, tekuci);
});
izvj.crvenoOdbrojavaOpada = najduzi >= 5;
izvj.crvenoOdbrojavanje = brojevi;

await page.getByRole("button", { name: "Druga situacija" }).click();

// ── tri scenarija sa semaforom: pun gas ────────────────────────────────────
izvj.punGas = {};
for (const naslov of [
  "Semafor — crveno svjetlo",
  "Zeleno ne znači slobodno",
  "Žuto na prilazu",
]) {
  await otvori(naslov);
  await page.getByRole("button", { name: "Kreni" }).click();
  await page.keyboard.down("ArrowUp");
  const ishod = await cekajKraj(page);
  await page.keyboard.up("ArrowUp");
  const txt = await page.locator("main").innerText();
  izvj.punGas[naslov] = {
    ishod,
    prekrsaji:
      txt.match(
        /(Oduzeto prvenstvo prolaza|Sudar|Prolazak na crveno svjetlo|Zadržavanje saobraćaja)/g,
      ) ?? [],
  };
  await page.getByRole("button", { name: "Druga situacija" }).click();
}

izvj.greske = greske;
console.log(JSON.stringify(izvj, null, 2));
await browser.close();
