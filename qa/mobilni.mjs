// Igra na telefonu (dodir): svaki način vožnje do same vožnje, snimak
// ekrana, pa otvoren meni podešavanja. node mobilni.mjs <folder> [sirina] [visina]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const [folder, sirina = "390", visina = "844"] = process.argv.slice(2);
mkdirSync(folder, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: Number(sirina), height: Number(visina) }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const greske = [];
const izvjestaj = {};
const nacini = {
  grad: async (p) => {
    await p.getByRole("button", { name: /^Vozi po Podgorici$/i }).click();
    await p.waitForFunction(() => /Ulica:/.test(document.body.innerText), null, { timeout: 120000 });
  },
  ruta: async (p) => {
    await p.getByRole("button", { name: /^Vozi rutu$/i }).click();
    await p.getByRole("button", { name: /^Kreni$/ }).click();
    await p.waitForSelector("main canvas", { timeout: 120000 });
  },
  put: async (p) => {
    await p.getByRole("button", { name: /^Kreni na put$/i }).click();
    await p.getByRole("button", { name: /^Podgorica$/ }).first().click();
    await p.locator("ul li button").first().click();
    await p.waitForSelector("main canvas", { timeout: 120000 });
  },
  smjena: async (p) => {
    await p.getByRole("button", { name: /^Počni smjenu$/i }).click();
    await p.getByRole("button", { name: /^Počni smjenu$/i }).click();
  },
  scenario: async (p) => {
    await p.locator("main ul li button").first().click();
    await p.getByRole("button", { name: /^Kreni$|^Start$/ }).click();
  },
};
for (const [ime, udji] of Object.entries(nacini)) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => greske.push(`${ime}: ${e.message}`));
  await page.goto("http://localhost:3100/igra", { waitUntil: "load", timeout: 120000 });
  try {
    await udji(page);
  } catch (e) {
    greske.push(`${ime}: ulaz ${e.message.split("\n")[0]}`);
  }
  await page.waitForTimeout(ime === "grad" ? 4000 : 3000);
  await page.screenshot({ path: `${folder}/${ime}.png` });
  izvjestaj[ime] = await page.evaluate(() => {
    const c = document.querySelector("main canvas") ?? document.querySelector("canvas");
    const r = c?.getBoundingClientRect();
    return { platno: r ? { w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.top) } : null, skrol: document.documentElement.scrollHeight > innerHeight + 2 };
  });
  const meni = page.getByRole("button", { name: /Podešavanja|Settings/ });
  if ((await meni.count()) > 0) {
    await meni.first().click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${folder}/${ime}-meni.png` });
  }
  await page.close();
}
await browser.close();
console.log(JSON.stringify({ izvjestaj, greske }, null, 1));
