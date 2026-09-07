// Igra „Prođi raskrsnicu" — težina, problematični događaji, reakcija, zvuk.
//
// Pokretanje: `npx next start -p 3100` u jednom terminalu, pa u drugom se ova
// skripta kopira u folder u kojem je `npm i playwright` već urađen i pokrene
// odatle. NODE_PATH ovdje ne pomaže — ESM ga ne gleda.
//
// Provjerava: da su tri nova scenarija na spisku sa težinom 4–5, da bezobzirna
// vožnja u njima daje očekivani prekršaj, da se poslije scenarija vidi kartica
// o tuđem prekršaju i izmjereno vrijeme reakcije, i da dugme za zvuk radi.

import { chromium, webkit } from "playwright";

const URL = "http://localhost:3100/igra";

const OCEKIVANO = [
  { naslov: "Neko vam ne ustupa", prekrsaj: /Sudar/ },
  { naslov: "Pješak iskače na prelaz", prekrsaj: /Nepropuštanje pješaka/ },
  { naslov: "Vozilo pod pratnjom iza zaklona", prekrsaj: /Oduzeto prvenstvo prolaza/ },
];

async function cekajKraj(page, ms = 45000) {
  const kraj = Date.now() + ms;
  while (Date.now() < kraj) {
    const txt = await page.locator("main").innerText();
    if (/bez prekršaja/i.test(txt)) return "prosao";
    if (/nije ispravna/i.test(txt)) return "pao";
    await page.waitForTimeout(150);
  }
  return "isteklo";
}

for (const [ime, pokreni, viewport] of [
  ["chromium-desktop", chromium, { width: 1440, height: 1200 }],
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
  const stavke = page.locator("main ul > li > button");
  izvj.brojSituacija = await stavke.count();

  // Tezina se prikazuje kao „Težina: n/5" u skrivenom tekstu.
  const svi = await stavke.allInnerTexts();
  izvj.imaPeticu = svi.some((x) => /Težina: 5\/5/.test(x));
  izvj.imaCetvorku = svi.some((x) => /Težina: 4\/5/.test(x));

  const otvori = async (naslov) => {
    const lista = await stavke.allInnerTexts();
    const i = lista.findIndex((x) => x.includes(naslov));
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
      imaKarticuDogadjaja: /Neko nije poštovao pravila/i.test(txt),
      imaReakciju: /Vrijeme reakcije/.test(txt),
    };
    await page.getByRole("button", { name: "Druga situacija" }).click();
  }

  // Zvuk: dugme mijenja stanje.
  await otvori("Pješak iskače na prelaz");
  const zvuk = page.getByRole("button", { name: /zvuk|Mute|Unmute|zërin|звук/i });
  const prije = await zvuk.getAttribute("aria-pressed");
  await zvuk.click();
  const poslije = await zvuk.getAttribute("aria-pressed");
  izvj.zvukPrekidac = prije !== poslije;

  izvj.greske = greske;
  console.log(JSON.stringify(izvj, null, 2));
  await browser.close();
}
