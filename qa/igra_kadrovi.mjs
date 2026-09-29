// Kadrovi iz mjerila crtanja, i poređenje dvije serije piksel po piksel.
//
// Pokretanje (server na 3100, skripta u folderu sa `npm i playwright`):
//
//     node igra_kadrovi.mjs snimi canvas prije     # kadrovi u folder `prije`
//     node igra_kadrovi.mjs snimi pixi pixi        # kadrovi u folder `pixi`
//     node igra_kadrovi.mjs uporedi prije pixi     # razlika po kadru
//
// Svaki kadar je posljednji sa jedne tačke mjerila (`/igra/bench?kadrovi=1`):
// ista ruta, isto sjeme, isti bot, pa dvije serije snimljene sa istim kodom
// simulacije prikazuju ISTI trenutak. Razlika je onda samo u crtanju.
//
// Piksel je „različit" kad mu se bilo koji kanal razlikuje za više od PRAG.
// Mala razlika u boji na ivici (umekšavanje) nije razlika u slici.

import { chromium } from "playwright";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const URL = "http://localhost:3100/igra/bench";
const PRAG = 48;
const [radnja, a, b] = process.argv.slice(2);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

if (radnja === "snimi") {
  const greske = [];
  page.on("pageerror", (e) => greske.push(e.message));
  await page.goto(`${URL}?render=${a}&kadrovi=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__bench !== undefined, null, { timeout: 15 * 60 * 1000, polling: 1000 });
  const kadrovi = await page.evaluate(() => window.__benchKadrovi ?? []);
  mkdirSync(b, { recursive: true });
  kadrovi.forEach((k, i) => {
    writeFileSync(`${b}/${String(i + 1).padStart(2, "0")}.png`, Buffer.from(k.split(",")[1], "base64"));
  });
  console.log(`${kadrovi.length} kadrova u ${b}${greske.length ? " | greske: " + greske.join(" | ") : ""}`);
} else if (radnja === "uporedi") {
  const imena = readdirSync(a).filter((f) => f.endsWith(".png")).sort();
  let najvise = 0;
  for (const ime of imena) {
    const png = (folder) => `data:image/png;base64,${readFileSync(`${folder}/${ime}`).toString("base64")}`;
    const r = await page.evaluate(
      async ({ x, y, prag }) => {
        const ucitaj = (src) =>
          new Promise((ok, ne) => {
            const img = new Image();
            img.onload = () => ok(img);
            img.onerror = ne;
            img.src = src;
          });
        const [i1, i2] = await Promise.all([ucitaj(x), ucitaj(y)]);
        if (i1.width !== i2.width || i1.height !== i2.height) return { greska: `velicina ${i1.width}x${i1.height} / ${i2.width}x${i2.height}` };
        const piksele = (img) => {
          const c = document.createElement("canvas");
          c.width = img.width;
          c.height = img.height;
          const g = c.getContext("2d");
          g.drawImage(img, 0, 0);
          return g.getImageData(0, 0, c.width, c.height).data;
        };
        const p1 = piksele(i1);
        const p2 = piksele(i2);
        let razlicitih = 0;
        let zbir = 0;
        for (let i = 0; i < p1.length; i += 4) {
          const d = Math.max(Math.abs(p1[i] - p2[i]), Math.abs(p1[i + 1] - p2[i + 1]), Math.abs(p1[i + 2] - p2[i + 2]));
          zbir += d;
          if (d > prag) razlicitih += 1;
        }
        const n = p1.length / 4;
        return { udio: (100 * razlicitih) / n, srednje: zbir / n };
      },
      { x: png(a), y: png(b), prag: PRAG },
    );
    if (r.greska) {
      console.log(`${ime}: ${r.greska}`);
      continue;
    }
    najvise = Math.max(najvise, r.udio);
    console.log(`${ime}: ${r.udio.toFixed(3)} % piksela razlicito, srednja razlika ${r.srednje.toFixed(2)}`);
  }
  console.log(`najvise: ${najvise.toFixed(3)} %`);
} else {
  console.log("upotreba: snimi <renderer> <folder> | uporedi <folder1> <folder2>");
}
await browser.close();
