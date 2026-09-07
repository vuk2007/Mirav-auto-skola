// Igra „Prođi raskrsnicu" — autoput (faza 5).
//
// Pokretanje: `npx next start -p 3100` u jednom terminalu, pa se ova skripta
// kopira u folder u kojem je `npm i playwright` već urađen i pokrene odatle.
// NODE_PATH ovdje ne pomaže — ESM ga ne gleda.
//
// Provjerava:
//  - da se sva četiri scenarija autoputa vide na spisku i otvaraju bez greške,
//  - da dugmad za promjenu trake postoje na autoputu, a na raskrsnici ne,
//  - da kamera prati vozilo (ostaje na istoj visini kadra dok scena klizi),
//  - da se traka stvarno mijenja: sa uključenjem nema prekršaja zaustavne
//    trake, a bez njega ga ima,
//  - da se prekršaj autoputa objasni pravilom.
//
// Dvije zamke na koje se već nasjelo: `innerText` vraća tekst POSLIJE
// `text-transform` (pa poređenja idu bez obzira na veličinu slova), a
// pristupačno ime dugmeta normalizuje razmake (pa „…uključivanje" i „Nije"
// nisu spojeni).

import { chromium, webkit } from "playwright";

const URL = "http://localhost:3100/igra";
const SCENARIJI = [
  "Autoput — uključivanje",
  "Autoput — preticanje",
  "Autoput — isključivanje",
  "Autoput — uključivanje u gust saobraćaj",
];

const ISHOD = /Prošli ste bez prekršaja|Vožnja nije ispravna/i;

/** Gdje je plavo (igračevo) vozilo na platnu i koliko se scena promijenila. */
const kadar = (page) =>
  page.evaluate(() => {
    const c = document.querySelector("canvas");
    const g = c.getContext("2d");
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    let sy = 0;
    let suma = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const gg = d[i + 1];
      const b = d[i + 2];
      suma = (suma + r * 3 + gg * 5 + b * 7) % 1000003;
      // Boja igrača je `PALETTE.blue` = #2f6fd0.
      if (Math.abs(r - 47) < 45 && Math.abs(gg - 111) < 45 && Math.abs(b - 208) < 45) {
        n += 1;
        sy += Math.floor(i / 4 / c.width);
      }
    }
    return { y: n > 0 ? sy / n / c.height : null, piksela: n, suma };
  });

/**
 * Otvori scenario sa spiska i sačekaj brifing.
 *
 * Klik se ponavlja: prvi zna da padne u trenutak prije hidracije, pa React na
 * njega ne reaguje, a spisak ostane na ekranu.
 */
async function otvori(page, re) {
  const kreni = page.getByRole("button", { name: /^Kreni$/ });
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: re }).first().click();
    try {
      await kreni.waitFor({ timeout: 2000 });
      return;
    } catch {
      await page.waitForTimeout(400);
    }
  }
  throw new Error(`ne otvara se: ${re}`);
}

/** Vozi punim gasom do ishoda i vrati tekst rezultata. */
async function doKraja(page) {
  await page.keyboard.down("ArrowUp");
  let kraj = "";
  for (let i = 0; i < 240; i++) {
    kraj = await page.locator("main").innerText();
    if (ISHOD.test(kraj)) break;
    await page.waitForTimeout(250);
  }
  await page.keyboard.up("ArrowUp");
  return kraj;
}

for (const [ime, pokreni, viewport] of [
  ["chromium-desktop", chromium, { width: 1440, height: 1100 }],
  ["webkit-mobile", webkit, { width: 390, height: 900 }],
]) {
  const browser = await pokreni.launch();
  const page = await (await browser.newContext({ viewport })).newPage();
  const greske = [];
  page.on("pageerror", (e) => greske.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    // Vercelov skript ne postoji van produkcije — to nije greška aplikacije.
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

  const izvj = { motor: ime };
  await page.goto(URL, { waitUntil: "networkidle" });
  const spisak = await page.locator("main").innerText();
  izvj.naSpisku = SCENARIJI.filter((s) => spisak.includes(s));

  // ── raskrsnica NEMA dugmad za traku ────────────────────────────────────────
  await otvori(page, /Pravilo desne strane — ustupate/);
  await page.getByRole("button", { name: /^Kreni$/ }).click();
  await page.waitForTimeout(300);
  izvj.raskrsnicaImaDugmadZaTraku = await page
    .getByRole("button", { name: /U lijevu|U desnu/ })
    .count();
  await page.getByRole("button", { name: /Druga situacija/ }).first().click();
  await page.waitForTimeout(300);

  // ── autoput: brifing ───────────────────────────────────────────────────────
  await otvori(page, /Autoput — uključivanje Nije/);
  await page.waitForTimeout(200);
  const brief = await page.locator("main").innerText();
  izvj.zadatak = /Uključujete se na autoput/i.test(brief);
  izvj.objasnjenjeImaDijakritike = /[čćžšđ]/i.test(brief);

  await page.getByRole("button", { name: /^Kreni$/ }).click();
  await page.waitForTimeout(400);
  izvj.imaDugmadZaTraku = await page.getByRole("button", { name: /U lijevu|U desnu/ }).count();
  izvj.imaSavjetZaTastaturu = /Shift/i.test(await page.locator("main").innerText());

  // ── kamera prati ───────────────────────────────────────────────────────────
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(700);
  const k1 = await kadar(page);
  await page.waitForTimeout(1500);
  const k2 = await kadar(page);
  izvj.kamera = {
    vidiSeIgrac: k1.piksela > 0 && k2.piksela > 0,
    // Scena mora da klizi…
    scenaSeMijenja: k1.suma !== k2.suma,
    // …a igrač da ostane na istoj visini kadra.
    igracNaIstojVisini: k1.y !== null && k2.y !== null ? Math.abs(k1.y - k2.y) < 0.05 : null,
    visina: k2.y === null ? null : Number(k2.y.toFixed(3)),
  };

  // ── uključenje tastaturom: pokazivač pa Shift + strelica ───────────────────
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(1300);
  await page.keyboard.down("Shift");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.up("Shift");
  await page.waitForTimeout(2500);
  await page.keyboard.press("ArrowLeft"); // gasi pokazivač
  await page.keyboard.up("ArrowUp");
  const saUkljucenjem = await doKraja(page);
  izvj.saUkljucenjem = {
    ishod: ISHOD.test(saUkljucenjem),
    zaustavnaTraka: /Vožnja zaustavnom trakom/i.test(saUkljucenjem),
  };

  // ── isti scenario bez uključenja: mora pasti na zaustavnoj traci ───────────
  await page.getByRole("button", { name: /Pokušaj ponovo/ }).first().click();
  await page.waitForTimeout(400);
  const bezUkljucenja = await doKraja(page);
  izvj.bezUkljucenja = {
    ishod: ISHOD.test(bezUkljucenja),
    zaustavnaTraka: /Vožnja zaustavnom trakom/i.test(bezUkljucenja),
    imaPravilo: /Spoljna traka je zaustavna/i.test(bezUkljucenja),
  };

  // ── dugme za traku mišem ───────────────────────────────────────────────────
  await page.getByRole("button", { name: /Pokušaj ponovo/ }).first().click();
  await page.waitForTimeout(400);
  await page.keyboard.down("ArrowUp");
  await page.getByRole("button", { name: /U lijevu/ }).first().click();
  await page.waitForTimeout(2500);
  await page.keyboard.up("ArrowUp");
  const misem = await doKraja(page);
  izvj.misem = {
    // Bez pokazivača je uključenje prekršaj — ali se DESILO, pa nema prekršaja
    // zaustavne trake. To dvoje zajedno dokazuju da dugme radi.
    bezPokazivaca: /Bez pokazivača/i.test(misem),
    zaustavnaTraka: /Vožnja zaustavnom trakom/i.test(misem),
  };

  izvj.greske = greske;
  console.log(JSON.stringify(izvj, null, 2));
  await browser.close();
}
