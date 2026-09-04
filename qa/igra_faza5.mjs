// Igra „Prođi raskrsnicu", faza 5 — pješaci, policajac, vozila pod pratnjom.
//
// Pokretanje: `npx next start -p 3100` u jednom terminalu, pa u drugom se ova
// skripta kopira u folder u kojem je `npm i playwright` već urađen i pokrene
// odatle. NODE_PATH ovdje ne pomaže — ESM ga ne gleda.
//
// Provjerava: da spisak ima četrnaest situacija, da se nova četiri scenarija
// otvaraju i da bezobzirna vožnja u njima daje očekivani prekršaj sa tačnim
// pravilom, i da HUD kod policajca prikazuje naredbu umjesto svjetla.

import { chromium, webkit } from "playwright";

const URL = "http://localhost:3100/igra";

const OCEKIVANO = [
  {
    naslov: "Pješak na prelazu pri skretanju",
    prekrsaj: /Nepropuštanje pješaka na prelazu/,
    pravilo: /Pješaka na pješačkom prelazu preko kojeg prolazite morate propustiti/,
  },
  {
    naslov: "Vozilo pod pratnjom",
    prekrsaj: /Oduzeto prvenstvo prolaza/,
    pravilo: /rotacionim svjetlom i sirenom ustupa se prvenstvo/,
  },
  {
    naslov: "Policajac vas zaustavlja na zeleno",
    prekrsaj: /Nepostupanje po naredbi policajca/,
    pravilo: /Naredba policijskog službenika jača je i od znakova i od semafora/,
  },
];

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

for (const { ime, pokreni, viewport } of [
  { ime: "chromium-desktop", pokreni: chromium, viewport: { width: 1440, height: 1000 } },
  { ime: "webkit-mobile", pokreni: webkit, viewport: { width: 390, height: 844 } },
]) {
  const browser = await pokreni.launch();
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const greske = [];
  page.on("pageerror", (e) => greske.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("_vercel")) greske.push(`${r.status()} ${r.url()}`);
  });

  const izvj = { motor: ime };
  await page.goto(URL, { waitUntil: "networkidle" });
  const stavke = page.locator("main ul > li > button");
  izvj.brojSituacija = await stavke.count();

  const otvori = async (naslov) => {
    const svi = await stavke.allInnerTexts();
    const i = svi.findIndex((x) => x.includes(naslov));
    if (i < 0) throw new Error(`nema situacije „${naslov}"`);
    await stavke.nth(i).click();
  };

  izvj.punGas = {};
  for (const o of OCEKIVANO) {
    await otvori(o.naslov);
    await page.getByRole("button", { name: "Kreni" }).click();
    await page.keyboard.down("ArrowUp");
    const ishod = await cekajKraj(page);
    await page.keyboard.up("ArrowUp");
    const txt = await page.locator("main").innerText();
    izvj.punGas[o.naslov] = {
      ishod,
      imaPrekrsaj: o.prekrsaj.test(txt),
      imaPravilo: o.pravilo.test(txt),
    };
    await page.getByRole("button", { name: "Druga situacija" }).click();
  }

  // Policajac koji propušta: HUD pokazuje naredbu, a ne svjetlo, i vožnja prolazi.
  await otvori("Policajac vas propušta na crveno");
  izvj.hudPolicajac = (await page.locator("main").innerText()).match(/POLICAJAC\s+\w+/)?.[0];
  await page.getByRole("button", { name: "Kreni" }).click();
  await page.keyboard.down("ArrowUp");
  izvj.propustaIshod = await cekajKraj(page);
  await page.keyboard.up("ArrowUp");

  izvj.greske = greske;
  console.log(JSON.stringify(izvj, null, 2));
  await browser.close();
}
