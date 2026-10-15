// Mjerilo grada sa drugim vozačima i pješacima (faza 6, stavka 8; zadatak,
// odjeljak 8: centar, 40 vozila i 60 pješaka): cilj ≥ 55 fps na referentnom
// telefonu.
//
// Pokretanje: `npm run build && npx next start -p 3100`, pa se ova skripta
// kopira u folder sa `npm i playwright` i pokrene odatle:
//
//     node faza8_bench_grad.mjs                  # Podgorica, centar
//     node faza8_bench_grad.mjs 140,-216 30      # druga tačka, 30 s mjerenja
//
// Kao `igra_bench.mjs`: ekran telefona (390 px, gustina piksela 2), procesor
// punom brzinom i usporen četiri puta (≈ telefon srednje klase 2021–22).
// Grad se otvara sa `?debug=1&gdje=x,y`: auto stoji, saobraćaj (nivo 5, dan
// = 40 vozila) vozi oko njega, a 60 pješaka hoda trotoarima i prelazi. Mjeri
// se svaki kadar (requestAnimationFrame) i korak simulacije iz debug prikaza. Grafički čip se ne usporava — za WebGL je
// broj optimističan, konačna riječ je pravi telefon.

import { chromium } from "playwright";

const GDJE = process.argv[2] ?? "-17,271";
const SEKUNDI = Number(process.argv[3] ?? 20);
// Gustina 3 van zona: 40 vozila (van zona je inače 25, stavka 7e) i 60 pješaka (stavka 8).
// Sat 8 (stavka 8d): dan, svjetlo kao i prije; broj vozila i pješaka uz `gustina` i
// `pjesaci` ne zavisi od sata, pa se mjeri isti puni grad u svako doba.
const URL = `http://localhost:3100/igra?debug=1&gustina=3&pjesaci=3&sat=8&gdje=${GDJE}`;
const USPORENJA = [1, 4];

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const redovi = [];
for (const usporenje of USPORENJA) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const greske = [];
  page.on("pageerror", (e) => greske.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/_vercel|Failed to load resource/.test(m.text())) greske.push(m.text());
  });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^Vozi po Podgorici$/i }).click();
  await page.waitForFunction(() => /Ulica:/.test(document.querySelector("main")?.innerText ?? ""), null, { timeout: 120000 });
  // Nivo 5 (dan je podrazumijevan): 40 vozila. Saobraćaj se popuni i rasporedi.
  await page.getByRole("button", { name: "5", exact: true }).click();
  await page.waitForFunction(
    () => {
      const tekst = document.querySelector("main")?.innerText ?? "";
      return Number(tekst.match(/(\d+) vozila/)?.[1] ?? 0) >= 40 && Number(tekst.match(/(\d+) pješaka/)?.[1] ?? 0) >= 60;
    },
    null,
    { timeout: 120000 },
  );
  await page.waitForTimeout(5000);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: usporenje });
  const r = await page.evaluate(async (sekundi) => {
    const kadrovi = [];
    const koraci = [];
    const vozila = [];
    const pjesaka = [];
    let zadnji = performance.now();
    const kraj = zadnji + sekundi * 1000;
    await new Promise((gotovo) => {
      const kadar = (t) => {
        kadrovi.push(t - zadnji);
        zadnji = t;
        const tekst = document.querySelector("main")?.innerText ?? "";
        const k = tekst.match(/korak ([\d.]+) ms/);
        const v = tekst.match(/(\d+) vozila/);
        if (k) koraci.push(Number(k[1]));
        if (v) vozila.push(Number(v[1]));
        const pj = tekst.match(/(\d+) pješaka/);
        if (pj) pjesaka.push(Number(pj[1]));
        if (t < kraj) requestAnimationFrame(kadar);
        else gotovo();
      };
      requestAnimationFrame(kadar);
    });
    const sort = (a) => [...a].sort((x, y) => x - y);
    const p = (a, q) => sort(a)[Math.min(a.length - 1, Math.floor(a.length * q))];
    const zbir = kadrovi.reduce((s, x) => s + x, 0);
    return {
      fps: (1000 * kadrovi.length) / zbir,
      kadarMed: p(kadrovi, 0.5),
      kadarP95: p(kadrovi, 0.95),
      kadarMax: Math.max(...kadrovi),
      sporih: kadrovi.filter((x) => x > 1000 / 55).length,
      kadrova: kadrovi.length,
      korakMed: koraci.length ? p(koraci, 0.5) : null,
      korakMax: koraci.length ? Math.max(...koraci) : null,
      vozilaMin: vozila.length ? Math.min(...vozila) : null,
      vozilaMax: vozila.length ? Math.max(...vozila) : null,
      pjesakaMin: pjesaka.length ? Math.min(...pjesaka) : null,
      pjesakaMax: pjesaka.length ? Math.max(...pjesaka) : null,
    };
  }, SEKUNDI);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await page.screenshot({ path: `bench-grad8-x${usporenje}.png` });
  redovi.push(
    `procesor x${usporenje}: ${r.fps.toFixed(1)} fps, kadar medijana ${r.kadarMed.toFixed(1)} ms, p95 ${r.kadarP95.toFixed(1)} ms, ` +
      `max ${r.kadarMax.toFixed(1)} ms, sporijih od 55 fps ${r.sporih}/${r.kadrova}; ` +
      `korak simulacije medijana ${r.korakMed?.toFixed(2)} ms, max ${r.korakMax?.toFixed(2)} ms; vozila ${r.vozilaMin}–${r.vozilaMax}, pješaka ${r.pjesakaMin}–${r.pjesakaMax}`,
  );
  if (greske.length > 0) redovi.push(`    greske u konzoli: ${greske.join(" | ")}`);
  await ctx.close();
}
await browser.close();
console.log(`Grad, ${GDJE}, ${SEKUNDI} s po mjerenju\n` + redovi.join("\n"));
