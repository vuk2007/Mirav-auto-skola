// QA 9b: vožnja od–do u gradu — izbor težine, nasumičan cilj, štoperica i
// zaključan nivo, pa kartica rezultata na cilju (dolazak kroz `?debug=1`
// kuku `stigni`), nova vožnja i prekid.
// Pokretanje: `npm run build && npx next start -p 3100`, pa iz foldera sa
// `npm i playwright`: node faza9_oddo.mjs [port]. Snimci: oddo-*.png.
import { chromium } from "playwright";
const port = process.argv[2] ?? "3100";
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const izvjestaj = {};
const greske = [];

const page = await (await browser.newContext({ viewport: { width: 900, height: 1500 }, deviceScaleFactor: 2 })).newPage();
page.on("pageerror", (e) => greske.push(e.message));
await page.goto(`http://localhost:${port}/igra?debug=1&sat=12`, { waitUntil: "load", timeout: 240000 });
await page.getByRole("button", { name: /^Vozi po Podgorici$/i }).click();
await page.waitForFunction(() => /Ulica:/.test(document.querySelector("main")?.innerText ?? ""), null, { timeout: 240000 });
await page.waitForTimeout(1500);

// Izbor težine.
await page.getByRole("button", { name: /^Vožnja od–do$/ }).click();
const dijalog = page.getByRole("dialog");
await dijalog.waitFor();
await dijalog.getByRole("button", { name: /^Lako/ }).click();
izvjestaj.izbor = await dijalog.innerText();
await page.screenshot({ path: "oddo-izbor.png" });

// Nasumičan cilj: štoperica, putokaz, nivo 1 i zaključan.
await dijalog.getByRole("button", { name: /^Nasumičan cilj$/ }).click();
await page.waitForFunction(() => /Od–do · \d+:\d\d/.test(document.querySelector("main")?.innerText ?? ""), null, { timeout: 20000 });
await page.keyboard.down("ArrowUp");
await page.waitForTimeout(2500);
await page.keyboard.up("ArrowUp");
izvjestaj.stoperica = (await page.locator("main").innerText()).match(/Od–do · \d+:\d\d/)?.[0];
izvjestaj.putokaz = await page.getByRole("status").allInnerTexts();
izvjestaj.cilj = await page.getByRole("button", { name: /^Cilj: / }).innerText();
izvjestaj.nivo = await page.getByRole("button", { name: /^1$/ }).getAttribute("aria-pressed");
izvjestaj.nivoZakljucan = await page.getByRole("button", { name: /^3$/ }).isDisabled();
await page.screenshot({ path: "oddo-voznja.png" });

// Na cilju: kartica rezultata, simulacija stoji.
izvjestaj.stigni = await page.evaluate(() => window.__grad.stigni());
await page.getByRole("alertdialog").waitFor({ timeout: 10000 });
izvjestaj.rezultat = await page.getByRole("alertdialog").innerText();
const s1 = (await page.locator("main").innerText()).match(/(\d+) km\/h/)?.[1];
await page.waitForTimeout(1000);
const s2 = (await page.locator("main").innerText()).match(/(\d+) km\/h/)?.[1];
izvjestaj.stojiBrzina = [s1, s2];
await page.screenshot({ path: "oddo-rezultat.png" });
await page.locator("main canvas").first().locator("..").screenshot({ path: "oddo-kartica.png" });

// Nova vožnja iste težine, pa prekid.
await page.getByRole("alertdialog").getByRole("button", { name: /^Nova vožnja$/ }).click();
await page.waitForFunction(() => /Od–do · \d+:\d\d/.test(document.querySelector("main")?.innerText ?? ""), null, { timeout: 20000 });
izvjestaj.novaVoznja = (await page.locator("main").innerText()).match(/Od–do · \d+:\d\d/)?.[0];
// Drugi put isti cilj: najbolji rezultat se pamti.
await page.evaluate(() => window.__grad.stigni());
await page.getByRole("alertdialog").waitFor({ timeout: 10000 });
izvjestaj.drugiRezultat = await page.getByRole("alertdialog").innerText();
await page.getByRole("alertdialog").getByRole("button", { name: /^Nova vožnja$/ }).click();
await page.waitForFunction(() => /Od–do · \d+:\d\d/.test(document.querySelector("main")?.innerText ?? ""), null, { timeout: 20000 });
await page.getByRole("button", { name: /^Prekini od–do$/ }).click();
await page.waitForTimeout(800);
izvjestaj.poslijePrekida = {
  stoperica: /Od–do · \d+:\d\d/.test(await page.locator("main").innerText()),
  nivoOtkljucan: !(await page.getByRole("button", { name: /^3$/ }).isDisabled()),
};

await browser.close();
console.log(JSON.stringify({ izvjestaj, greske }, null, 1));
