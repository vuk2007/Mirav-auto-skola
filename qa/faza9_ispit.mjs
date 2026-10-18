// QA 9c: ispitna ruta u gradu — izbor rute iz editora, start na istom mjestu
// (Vasa Raičkovića, uz teniske terene), putokaz i brojač obaveznih tačaka,
// vožnja (gas do prekoračenja), zapisnik na cilju (dolazak kroz `?debug=1`
// kuku `stigni`), ponovni ispit i prekid.
// Pokretanje: `npm run build && npx next start -p 3100`, pa iz foldera sa
// `npm i playwright`: node faza9_ispit.mjs [port]. Snimci: ispit-*.png.
import { chromium } from "playwright";
const port = process.argv[2] ?? "3100";
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const izvjestaj = {};
const greske = [];
const tekst = () => page.locator("main").innerText();
const hud = async () => (await tekst()).match(/Ispit · tačka \d+\/\d+ · \d+:\d\d/)?.[0] ?? null;

const page = await (await browser.newContext({ viewport: { width: 900, height: 1500 }, deviceScaleFactor: 2 })).newPage();
page.on("pageerror", (e) => greske.push(e.message));
await page.goto(`http://localhost:${port}/igra?debug=1&sat=12`, { waitUntil: "load", timeout: 240000 });
await page.getByRole("button", { name: /^Vozi po Podgorici$/i }).click();
await page.waitForFunction(() => /Ulica:/.test(document.querySelector("main")?.innerText ?? ""), null, { timeout: 240000 });
await page.waitForTimeout(1000);

await page.getByRole("button", { name: /^Ispitna ruta$/ }).click();
await page.getByRole("dialog").waitFor();
izvjestaj.izbor = await page.getByRole("dialog").innerText();
await page.screenshot({ path: "ispit-izbor.png" });
await page.getByRole("dialog").getByRole("button", { name: /KBC/ }).click();
await page.waitForFunction(() => /Ispit · tačka 0\/2/.test(document.querySelector("main")?.innerText ?? ""), null, { timeout: 240000 });
await page.waitForTimeout(1500);
izvjestaj.start = { hud: await hud(), ulica: (await tekst()).match(/Ulica: ([^\n·]+)/)?.[1]?.trim(), putokaz: await page.getByRole("status").allInnerTexts() };
izvjestaj.nivo = { tri: await page.getByRole("button", { name: /^3$/ }).getAttribute("aria-pressed"), zakljucan: await page.getByRole("button", { name: /^1$/ }).isDisabled() };
await page.screenshot({ path: "ispit-start.png" });

// Gas do daske — ulicom uz terene, pa prekoračenje (lakši prekršaj u zapisniku).
await page.keyboard.down("ArrowUp");
await page.waitForTimeout(9000);
await page.keyboard.up("ArrowUp");
await page.keyboard.down("ArrowDown");
await page.waitForTimeout(3000);
await page.keyboard.up("ArrowDown");
izvjestaj.voznja = { hud: await hud(), prekrsaji: (await tekst()).match(/Prekršaji: \d+/)?.[0] };
await page.screenshot({ path: "ispit-voznja.png" });

izvjestaj.stigni = await page.evaluate(() => window.__grad.stigni());
await page.getByRole("alertdialog").waitFor({ timeout: 10000 });
izvjestaj.zapisnik = await page.getByRole("alertdialog").innerText();
await page.screenshot({ path: "ispit-zapisnik.png" });
await page.locator("main canvas").first().locator("..").screenshot({ path: "ispit-zapisnik-kadar.png" });

// Ponovni ispit: nova vožnja sa starta, čist zapisnik.
await page.getByRole("alertdialog").getByRole("button", { name: /^Ponovi ispit$/ }).click();
await page.waitForFunction(() => /Ispit · tačka 0\/2 · 0:0\d/.test(document.querySelector("main")?.innerText ?? ""), null, { timeout: 240000 });
izvjestaj.ponovo = { hud: await hud(), prekrsaji: (await tekst()).match(/Prekršaji: \d+/)?.[0] };
await page.getByRole("button", { name: /^Prekini ispit$/ }).click();
await page.waitForTimeout(800);
izvjestaj.prekid = { hud: await hud(), nivoOtkljucan: !(await page.getByRole("button", { name: /^1$/ }).isDisabled()), dugme: await page.getByRole("button", { name: /^Ispitna ruta$/ }).count() };

// Druga ruta: start isti.
await page.getByRole("button", { name: /^Ispitna ruta$/ }).click();
await page.getByRole("dialog").getByRole("button", { name: /Blokovi/ }).click();
await page.waitForFunction(() => /Ispit · tačka 0\/3/.test(document.querySelector("main")?.innerText ?? ""), null, { timeout: 240000 });
await page.waitForTimeout(1500);
izvjestaj.druga = { hud: await hud(), ulica: (await tekst()).match(/Ulica: ([^\n·]+)/)?.[1]?.trim(), putokaz: await page.getByRole("status").allInnerTexts() };
await page.screenshot({ path: "ispit-druga.png" });

await browser.close();
console.log(JSON.stringify({ izvjestaj, greske }, null, 1));
