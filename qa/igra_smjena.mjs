// Igra „Prođi raskrsnicu" — beskonačni mod „Smjena".
//
// Pokretanje: `npx next start -p 3100` u jednom terminalu, pa u drugom se ova
// skripta kopira u folder u kojem je `npm i playwright` već urađen i pokrene
// odatle. NODE_PATH ovdje ne pomaže — ESM ga ne gleda.
//
// Provjerava: da se smjena otvara sa spiska, da se segmenti nižu bez povratka
// na spisak, da se broj raskrsnica penje, da bezobzirna vožnja troši živote i
// da se poslije trećeg gubitka vidi rezime sa brojem raskrsnica i prekršajima.

import { chromium, webkit } from "playwright";

const URL = "http://localhost:3100/igra";

const broj = (txt, oznaka) => {
  const m = new RegExp(`${oznaka}\\s+(\\d+)`, "i").exec(txt);
  return m ? Number(m[1]) : null;
};

const zivoti = (txt) => {
  const m = /ŽIVOTI\s+(●+)/i.exec(txt.replace(/\s+/g, " "));
  return m ? m[1].length : null;
};

for (const [ime, pokreni, viewport] of [
  ["chromium-desktop", chromium, { width: 1440, height: 1100 }],
  ["webkit-mobile", webkit, { width: 390, height: 900 }],
]) {
  const browser = await pokreni.launch();
  const page = await (await browser.newContext({ viewport })).newPage();
  const greske = [];
  page.on("pageerror", (e) => greske.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("_vercel")) greske.push(`${r.status()} ${r.url()}`);
  });

  const izvj = { motor: ime };
  await page.goto(URL, { waitUntil: "networkidle" });

  izvj.imaKarticuSmjene = /Smjena/i.test(await page.locator("main").innerText());
  await page.getByRole("button", { name: "Počni smjenu" }).click();
  await page.waitForTimeout(300);

  const uvod = await page.locator("main").innerText();
  izvj.zivotiNaPocetku = zivoti(uvod);
  izvj.nivoNaPocetku = broj(uvod, "NIVO");

  // Vozi punim gasom: to troši živote i završava smjenu.
  await page.getByRole("button", { name: "Počni smjenu" }).click().catch(() => {});
  await page.keyboard.down("ArrowUp");
  let najviseRaskrsnica = 0;
  let najmanjeZivota = 3;
  let gotovo = false;
  for (let i = 0; i < 900; i++) {
    const txt = await page.locator("main").innerText();
    najviseRaskrsnica = Math.max(najviseRaskrsnica, broj(txt, "RASKRSNICA") ?? 0);
    const z = zivoti(txt);
    if (z !== null) najmanjeZivota = Math.min(najmanjeZivota, z);
    if (/Smjena je gotova/i.test(txt)) {
      gotovo = true;
      izvj.rezime = {
        raskrsnica: broj(txt, "Raskrsnica"),
        imaNiz: /Najduži niz/i.test(txt),
        imaReakciju: /Vrijeme reakcije/i.test(txt),
        imaPrekrsaje: /Sudar|Oduzeto prvenstvo|Bez pokazivača|Prolazak/i.test(txt),
        imaNovuSmjenu: /Nova smjena/i.test(txt),
      };
      break;
    }
    await page.waitForTimeout(200);
  }
  await page.keyboard.up("ArrowUp");
  izvj.smjenaZavrsena = gotovo;
  izvj.presaoRaskrsnica = najviseRaskrsnica;
  izvj.najmanjeZivota = najmanjeZivota;

  izvj.greske = greske;
  console.log(JSON.stringify(izvj, null, 2));
  await browser.close();
}
