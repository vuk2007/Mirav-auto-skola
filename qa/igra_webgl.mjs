// Igra — crtanje na WebGL-u (PixiJS) u pravoj igri, faza 6 stavka 2.
//
// Pokretanje: `npx next start -p 3100` u jednom terminalu, pa se ova skripta
// kopira u folder u kojem je `npm i playwright` već urađen i pokrene odatle.
//
// Šta se provjerava:
//  - Ruta se crta na WebGL-u, vozi se (brzina raste), bez greške u konzoli;
//  - `?render=canvas` vraća Canvas 2D na istoj ruti;
//  - ispitna situacija ostaje na Canvas 2D;
//  - Putovanje: dionica je na WebGL-u, a kad se stigne u grad, isto mjesto na
//    stranici dobija novo platno sa Canvas 2D — isto platno ne može imati oba.
//
// Vozi se sporije od toka (60 % ograničenja) i koči se po TTC-u iz dev
// preklopa (`?debug=1`): skripta ne vidi razmak, a ko drži gas udari u kolonu.

import { chromium } from "playwright";

const URL = "http://localhost:3100/igra";
// Pravi grafički čip — bez toga headless crta WebGL softverski.
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });

const izvj = {};
// `SAMO=putovanje` pušta samo Putovanje — dionica sa kočenjem traje desetak
// minuta, pa se zna ponavljati odvojeno.
const SAMO = process.env.SAMO ?? "";

async function stranica(adresa) {
  const page = await (await browser.newContext({ viewport: { width: 900, height: 1250 } })).newPage();
  const greske = [];
  page.on("pageerror", (e) => greske.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/_vercel|Failed to load resource/.test(m.text())) greske.push(`console: ${m.text()}`);
  });
  await page.goto(adresa, { waitUntil: "networkidle" });
  return { page, greske };
}

/**
 * Vrsta konteksta platna. Zove se tek kad renderer već crta: `getContext` na
 * praznom platnu bi ga sam napravio. Na 2D platnu `webgl2` vraća `null`.
 */
const vrsta = (page) =>
  page.evaluate(() => {
    const c = document.querySelector("main canvas");
    if (!c) return "nema";
    return c.getContext("webgl2") || c.getContext("webgl") ? "webgl" : "2d";
  });

const tekst = async (page) => (await page.locator("main").innerText()).replace(/\s+/g, " ");

/** Jedan korak vozača: gas do 60 % ograničenja, kočnica po TTC-u. */
async function vozi(page, stanje) {
  const t = await tekst(page);
  const dbg = (await page.locator("[data-debug-preklop]").innerText().catch(() => "")).replace(/\s+/g, " ");
  const ttc = Number(/TTC ([\d.]+) s/.exec(dbg)?.[1] ?? Infinity);
  const tabla = Number(/·\s*(\d+)\s*km\/h/.exec(t)?.[1] ?? 50);
  const cilj = Math.round(tabla * 0.6);
  const v = Number(/BRZINA (\d+)/i.exec(t)?.[1] ?? 0);
  if (ttc < 6 || v > cilj + 3) {
    if (stanje.gas) {
      await page.keyboard.up("ArrowUp");
      stanje.gas = false;
    }
    await page.keyboard.down("ArrowDown");
    await page.waitForTimeout(ttc < 3 ? 300 : 150);
    await page.keyboard.up("ArrowDown");
  } else if (v < cilj && ttc > 10 && !stanje.gas) {
    await page.keyboard.down("ArrowUp");
    stanje.gas = true;
  } else if ((v >= cilj || ttc <= 10) && stanje.gas) {
    await page.keyboard.up("ArrowUp");
    stanje.gas = false;
  }
  return { t, v };
}

// ── Ruta, WebGL ─────────────────────────────────────────────────────────────
for (const [ime, adresa] of SAMO === "putovanje" ? [] : [
  ["rutaWebgl", `${URL}?debug=1`],
  ["rutaCanvas", `${URL}?debug=1&render=canvas`],
]) {
  const { page, greske } = await stranica(adresa);
  await page.getByRole("button", { name: /^Vozi rutu$/i }).first().click();
  await page.getByRole("button", { name: /^Kreni$/ }).click();
  await page.waitForSelector("main canvas", { timeout: 120000 });
  await page.waitForTimeout(2500);
  const stanje = { gas: false };
  let prvaBrzina = null;
  let zadnja = 0;
  const kraj = Date.now() + 20000;
  while (Date.now() < kraj) {
    const { v } = await vozi(page, stanje);
    if (prvaBrzina === null) prvaBrzina = v;
    zadnja = v;
    await page.waitForTimeout(150);
  }
  if (stanje.gas) await page.keyboard.up("ArrowUp");
  const dbg = (await page.locator("[data-debug-preklop]").innerText()).replace(/\s+/g, " ");
  await page.locator("main canvas").locator("..").screenshot({ path: `webgl-${ime}.png` });
  izvj[ime] = {
    platno: await vrsta(page),
    brzina: `${prvaBrzina} -> ${zadnja} km/h`,
    fps: Number(/fps (\d+)/.exec(dbg)?.[1] ?? 0),
    pao: /SUDAR/i.test(await tekst(page)),
    greske,
  };
  await page.context().close();
}

// ── Ispitna situacija ostaje na Canvasu ───────────────────────────────────
if (SAMO !== "putovanje") {
  const { page, greske } = await stranica(URL);
  await page.locator("main ul > li > button").first().click();
  await page.getByRole("button", { name: "Kreni" }).click();
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(2500);
  await page.keyboard.up("ArrowUp");
  izvj.ispit = { platno: await vrsta(page), greske };
  await page.context().close();
}

// ── Putovanje: dionica na WebGL-u, grad na Canvasu ─────────────────────────
{
  const { page, greske } = await stranica(`${URL}?debug=1`);
  await page.getByRole("button", { name: /^Kreni na put$/i }).first().click();
  await page.getByRole("button", { name: /^Podgorica$/ }).first().click();
  await page.getByRole("button", { name: /Danilovgrad.*Kreni →/s }).first().click();
  await page.waitForSelector("main canvas", { timeout: 60000 });
  await page.waitForTimeout(2500);
  const naDionici = await vrsta(page);
  const stanje = { gas: false };
  let uGradu = null;
  let pao = false;
  const kraj = Date.now() + 16 * 60 * 1000;
  while (Date.now() < kraj) {
    const { t } = await vozi(page, stanje);
    if (/SUDAR/i.test(t)) {
      pao = true;
      break;
    }
    // Grad: brojač raskrsnica u HUD-u (npr. „Kroz grad 1/3 — Danilovgrad").
    if (/Kroz grad \d+\/\d+/i.test(t)) {
      await page.waitForTimeout(1500);
      uGradu = await vrsta(page);
      await page.locator("main canvas").locator("..").screenshot({ path: "webgl-grad.png" });
      break;
    }
    await page.waitForTimeout(150);
  }
  if (stanje.gas) await page.keyboard.up("ArrowUp");
  izvj.putovanje = { naDionici, uGradu, pao, greske };
  await page.context().close();
}

await browser.close();
console.log(JSON.stringify(izvj, null, 2));
