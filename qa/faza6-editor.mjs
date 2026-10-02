// QA editora grada (6c): dev server na 3210 sa GRAD_EDITOR_LOZINKA=proba123.
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";

const FAJL = "C:/Users/Vuk/Desktop/MIRAV/public/data/grad/overrides/podgorica.json";
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
const greske = [];
page.on("pageerror", (e) => greske.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !/_vercel|Failed to load resource|overrides/.test(m.text())) greske.push(`console: ${m.text()}`);
});
const korak = [];
const snimi = (ime) => page.screenshot({ path: `editor-${ime}.png` });
const skok = async (k) => {
  const ulaz = page.getByPlaceholder("42.4411, 19.2627 ↵");
  await ulaz.fill(k);
  await ulaz.press("Enter");
  await page.waitForTimeout(700);
};
const klikSredina = async (dx = 0, dy = 0) => {
  const b = await page.locator("canvas").nth(1).boundingBox();
  await page.mouse.click(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy);
  await page.waitForTimeout(500);
};

await page.goto("http://localhost:3210/igra?editor=1", { waitUntil: "load", timeout: 180000 });
await page.getByText("Editor grada — Podgorica").waitFor({ timeout: 120000 });
await page.waitForFunction(() => !document.body.innerText.includes("Učitavam grad"), null, { timeout: 120000 });
await page.waitForTimeout(2500);
await snimi("01-pocetak");
await page.getByPlaceholder("ime i prezime").fill("QA test");

// 1. Raskrsnica sa semaforom (bulevar): izbor, plan, promjena zelenog.
await skok("140,-216");
await klikSredina();
await snimi("02-raskrsnica");
korak.push(`panel raskrsnice: ${await page.getByText(/^Raskrsnica #/).count()}`);
const zelena = page.locator("aside input[type=number]").nth(3);
if (await zelena.count()) {
  await zelena.fill("33");
  await page.getByRole("button", { name: "Primijeni plan" }).click();
  await page.waitForTimeout(800);
}
korak.push(`izmjena semafora: ${await page.getByText(/^semafor/).count()}`);

// 2. Izvedeni prioritet: potvrda, pa krak sa STOP.
await skok("-17,271");
await klikSredina();
const potvrdi = page.getByRole("button", { name: "Potvrdi kako je" });
korak.push(`izvedeno ponuđeno: ${await potvrdi.count()}`);
if (await potvrdi.count()) await potvrdi.click();
await page.waitForTimeout(800);
await page.locator("aside li button").filter({ hasText: /ustupi|glavni|desna/ }).first().click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "STOP", exact: true }).click();
await page.waitForTimeout(1500);
await snimi("03-stop");

// 3. Ulica: puna razdjelna linija i znak ograničenja.
await skok("-937.5,2189.1");
await klikSredina();
await page.waitForTimeout(300);
const linija = page.locator("aside select").filter({ hasText: "dvostruka puna" });
await linija.selectOption("puna");
await page.getByRole("button", { name: "Primijeni na dionicu" }).click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Postavi znak" }).click();
await page.waitForTimeout(1500);
await snimi("04-ulica");

// 4. Poništi i ponovi.
const brojIzmjena = async () => Number((await page.getByRole("button", { name: /^Izmjene \(/ }).innerText()).match(/\d+/)[0]);
const prije = await brojIzmjena();
await page.getByRole("button", { name: "↶ Poništi" }).click();
await page.waitForTimeout(500);
const poslije = await brojIzmjena();
await page.getByRole("button", { name: "↷ Ponovi" }).click();
await page.waitForTimeout(500);
korak.push(`izmjena ${prije}, poništi → ${poslije}, ponovi → ${await brojIzmjena()}`);

// 5. Upozorenja, pa čuvanje (pogrešna lozinka, pa prava).
await page.getByRole("button", { name: /^Upozorenja/ }).click();
korak.push(`upozorenja: ${await page.getByRole("button", { name: /^Upozorenja/ }).innerText()}`);
await page.locator("input[type=password]").fill("pogresna");
await page.getByRole("button", { name: /^Sačuvaj/ }).click();
await page.waitForTimeout(1000);
korak.push(`pogrešna lozinka: ${(await page.getByText("Nije sačuvano").count()) > 0}`);
await page.locator("input[type=password]").fill("proba123");
await page.getByRole("button", { name: /^Sačuvaj/ }).click();
await page.waitForTimeout(1500);
korak.push(`sačuvano: ${await page.getByText(/^Sačuvano/).innerText().catch(() => "NE")}`);
if (existsSync(FAJL)) {
  const o = JSON.parse(readFileSync(FAJL, "utf8"));
  korak.push(`fajl: ${o.izmjene.length} izmjena: ${o.izmjene.map((x) => x.vrsta).join(",")}`);
}
await snimi("05-kraj");
await browser.close();
console.log(JSON.stringify({ korak, greske }, null, 2));
