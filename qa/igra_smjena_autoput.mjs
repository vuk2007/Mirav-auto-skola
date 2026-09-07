// Igra „Prođi raskrsnicu" — autoput u lancu smjene (faza 6).
//
// Pokretanje: `npx next start -p 3100` u jednom terminalu, pa se ova skripta
// kopira u folder u kojem je `npm i playwright` već urađen i pokrene odatle.
//
// Provjerava ono što se iz jedinicnih testova ne vidi: da se dionica autoputa
// u smjeni stvarno nacrta i odigra, da se uz nju pojave dugmad za traku i
// rečenica zadatka, da se to NIKAD ne desi na prvom nivou, i da smjena poslije
// nje nastavi normalno.
//
// Nivo se ne može podesiti spolja — zarađuje se čistom vožnjom. Zato skripta
// vozi više smjena zaredom i gleda šta je od toga vidjela; koliko je smjena
// trebalo, piše u izvještaju.

import { chromium, webkit } from "playwright";

const URL = "http://localhost:3100/igra";
const SMJENA = /Smjena je gotova/i;
const nivoIz = (txt) => {
  const m = /NIVO\s+(\d+)/i.exec(txt.replace(/\s+/g, " "));
  return m ? Number(m[1]) : null;
};

for (const [ime, pokreni, viewport] of [
  ["chromium-desktop", chromium, { width: 1440, height: 1100 }],
  ["webkit-mobile", webkit, { width: 390, height: 900 }],
]) {
  const browser = await pokreni.launch();
  const page = await (await browser.newContext({ viewport })).newPage();
  const greske = [];
  page.on("pageerror", (e) => greske.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    // „Failed to load resource" u konzoli NE nosi URL, pa se po njemu ne može
    // reći šta je palo — za HTTP greške je mjerodavan slušalac odgovora ispod,
    // koji vidi adresu. Ovo je već dvaput navelo na pogrešan trag.
    if (m.type() === "error" && !/_vercel|Failed to load resource/.test(m.text())) {
      greske.push(`console: ${m.text()}`);
    }
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("_vercel")) greske.push(`${r.status()} ${r.url()}`);
  });

  const izvj = {
    motor: ime,
    smjena: 0,
    najviseNivo: 0,
    dioniceAutoputa: 0,
    nivoiSaAutoputem: [],
    zadatakUzAutoput: false,
    smjenaZavrsena: false,
    rezimeVidjen: false,
  };

  for (let krug = 0; krug < 12 && izvj.dioniceAutoputa === 0; krug++) {
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    // Prvi klik zna da padne prije hidracije — vidi `igra_autoput.mjs`.
    for (let i = 0; i < 4; i++) {
      await page
        .getByRole("button", { name: /Počni smjenu/ })
        .first()
        .click()
        .catch(() => {});
      if (await page.getByRole("button", { name: /^Gas$/ }).count()) break;
      await page.waitForTimeout(400);
    }
    izvj.smjena += 1;

    await page.keyboard.down("ArrowUp");
    let uAutoputu = false;
    // Broji se dovoljno dugo da se smjena stvarno završi: poenta nije samo da
    // se dionica autoputa vidi, nego i da lanac poslije nje ide dalje do
    // rezimea. Sa kraćim brojačem je webkit prijavljivao „nema rezimea" iako
    // je smjena bila u toku.
    for (let i = 0; i < 700; i++) {
      const txt = await page.locator("main").innerText();
      const nivo = nivoIz(txt);
      if (nivo) izvj.najviseNivo = Math.max(izvj.najviseNivo, nivo);

      const traka = (await page.getByRole("button", { name: /U lijevu/ }).count()) > 0;
      if (traka && !uAutoputu) {
        uAutoputu = true;
        izvj.dioniceAutoputa += 1;
        izvj.nivoiSaAutoputem.push(nivo);
        if (/držite odstojanje|Uključujete se na autoput/i.test(txt)) {
          izvj.zadatakUzAutoput = true;
        }
      }
      if (!traka) uAutoputu = false;

      if (SMJENA.test(txt)) {
        izvj.smjenaZavrsena = true;
        izvj.rezimeVidjen = /Raskrsnica|Najduži niz/i.test(txt);
        break;
      }
      await page.waitForTimeout(200);
    }
    await page.keyboard.up("ArrowUp");
  }

  // Dugmad za traku se ne smiju pojaviti dok je nivo jedan.
  izvj.nikadNaPrvomNivou = izvj.nivoiSaAutoputem.every((n) => n === null || n >= 2);
  izvj.greske = greske;
  console.log(JSON.stringify(izvj, null, 2));
  await browser.close();
}
