// Mjerilo crtanja igre — `/igra/bench`, iz pregledača.
//
// Pokretanje: `npx next start -p 3100` u jednom terminalu, pa se ova skripta
// kopira u folder u kojem je `npm i playwright` već urađen i pokrene odatle:
//
//     node igra_bench.mjs canvas          # samo Canvas 2D
//     node igra_bench.mjs canvas pixi     # oba, jedan za drugim
//
// Mjeri se na ekranu telefona (390 px, gustina piksela 2), dva puta: punom
// brzinom računara i sa procesorom usporenim četiri puta — to je približno
// telefon srednje klase iz 2021–22, koji je referentni (vidi odluke za fazu 6).
// Usporenje važi samo dok se mjeri; odvoženje do tačke ide punom brzinom.
//
// Ograničenje: grafički čip se ne usporava. Za WebGL je zato ovaj broj
// optimističan, i konačna riječ je mjerenje na pravom telefonu.

import { chromium } from "playwright";

const URL = "http://localhost:3100/igra/bench";
const RENDERERI = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ["canvas"];
const USPORENJA = [1, 4];

// Pravi grafički čip: bez ovih zastavica headless Chromium crta WebGL (a i
// Canvas) softverski, kroz SwiftShader — i brojevi i slika bi bili tuđi.
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const redovi = [];
for (const render of RENDERERI) {
  for (const usporenje of USPORENJA) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    const greske = [];
    page.on("pageerror", (e) => greske.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && !/_vercel|Failed to load resource/.test(m.text())) greske.push(m.text());
    });
    const cdp = await ctx.newCDPSession(page);
    await page.exposeFunction("__benchFaza", async (faza) => {
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: faza === "mjerim" ? usporenje : 1 });
    });
    await page.goto(`${URL}?render=${render}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__bench !== undefined, null, { timeout: 15 * 60 * 1000, polling: 1000 });
    const r = await page.evaluate(() => window.__bench);
    await page.screenshot({ path: `bench-${render}-x${usporenje}.png`, fullPage: true });
    if (r.greska) {
      redovi.push(`${render} x${usporenje}: GRESKA ${r.greska}`);
    } else {
      const u = r.ukupno;
      redovi.push(
        `${render.padEnd(7)} procesor x${usporenje}: crtanje medijana ${u.crtanje.medijana.toFixed(2)} ms, ` +
          `p95 ${u.crtanje.p95.toFixed(2)} ms, max ${u.crtanje.najvise.toFixed(2)} ms, ` +
          `${u.fps.toFixed(1)} fps (${r.tacke.length} tacaka, platno ${r.platno} px x${r.dpr})`,
      );
      for (const x of r.tacke) {
        redovi.push(
          `    t ${String(x.t).padStart(5)} s: med ${x.crtanje.medijana.toFixed(2)}  p95 ${x.crtanje.p95.toFixed(2)}  ` +
            `max ${x.crtanje.najvise.toFixed(2)} ms  ${x.fps.toFixed(1)} fps`,
        );
      }
    }
    if (greske.length > 0) redovi.push(`    greske u konzoli: ${greske.join(" | ")}`);
    await ctx.close();
  }
}
await browser.close();
console.log(redovi.join("\n"));
