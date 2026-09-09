// Igra „Prođi raskrsnicu" — znamenitosti pored puta.
//
// Pokretanje: `npx next start -p 3100` u jednom terminalu, pa se ova skripta
// kopira u folder u kojem je `npm i playwright` već urađen i pokrene odatle.
//
// Vozi se Podgorica → Zeta; Manastir Dajbabe je na 4. od 12 km ivice, dakle
// na trećini dionice. Provjerava se da tabla sa znamenitošću stvarno iskoči na
// platnu, pa nestane kad se prođe.
//
// Kako se tabla razlikuje od svega ostalog što je bijelo: po ŠIRINI. Ivične i
// razdjelne linije su 12 cm, dakle par piksela. Bijeli krug oko igrača je na
// svom tjemenu vodoravan i daje red od dvadesetak — izmjereno, ne pretpo-
// stavljeno: bez table je najduži red 26. Tabla je šest metara i daje preko
// stotinu. Prag je zato 60, taman između.
//
// Prva verzija je brojala UKUPNO bijelih piksela i javljala tablu već u petoj
// sekundi — bile su to linije i taj krug.

import { chromium } from "playwright";

const URL = "http://localhost:3100/igra";

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 900, height: 800 } })).newPage();
const greske = [];
page.on("pageerror", (e) => greske.push(`pageerror: ${e.message}`));
page.on("response", (r) => {
  if (r.status() >= 400 && !r.url().includes("_vercel")) greske.push(`${r.status()} ${r.url()}`);
});

/** Najduži red uzastopnih bijelih piksela na platnu. */
const najduziBijeliRed = () =>
  page.evaluate(() => {
    const c = document.querySelector("canvas");
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let najduzi = 0;
    for (let y = 0; y < c.height; y++) {
      let niz = 0;
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        const bijelo = d[i] > 248 && d[i + 1] > 248 && d[i + 2] > 248;
        niz = bijelo ? niz + 1 : 0;
        if (niz > najduzi) najduzi = niz;
      }
    }
    return najduzi;
  });

await page.goto(URL, { waitUntil: "networkidle" });
await page.evaluate(() => window.localStorage.removeItem("mirav.putovanje"));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(500);
for (let i = 0; i < 5; i++) {
  await page
    .getByRole("button", { name: /^Kreni na put$/i })
    .first()
    .click()
    .catch(() => {});
  if (await page.getByRole("button", { name: /^Podgorica$/ }).count()) break;
  await page.waitForTimeout(400);
}
await page.getByRole("button", { name: /^Podgorica$/ }).first().click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: /Zeta \(Golubovci\).*Kreni →/s }).first().click();
await page.waitForTimeout(800);

const PRAG = 60;
const izvj = { prijeTable: null, saTablom: null, poslijeTable: null, kadaSe: [] };
izvj.prijeTable = await najduziBijeliRed();

await page.keyboard.down("ArrowUp");
let najveci = 0;
for (let i = 0; i < 45; i++) {
  await page.waitForTimeout(2000);
  const red = await najduziBijeliRed();
  const txt = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  const t = /VRIJEME (\d+)/i.exec(txt);
  if (red >= PRAG) {
    izvj.kadaSe.push(Number(t ? t[1] : -1));
    if (red > najveci) {
      najveci = red;
      await page.locator("canvas").screenshot({ path: "znamenitost.png" });
    }
  } else if (izvj.kadaSe.length > 0) {
    // Tabla je bila pa je nema — prošli smo je.
    izvj.poslijeTable = red;
    break;
  }
  if (/Stigli ste u/i.test(txt)) break;
}
await page.keyboard.up("ArrowUp");

izvj.saTablom = najveci;
izvj.tablaSePojavila = najveci >= PRAG;
izvj.tablaNijeStalna = izvj.prijeTable < PRAG && izvj.poslijeTable !== null;
izvj.greske = greske;
console.log(JSON.stringify(izvj, null, 2));
await browser.close();
