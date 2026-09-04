// Igra „Prođi raskrsnicu", faza 2 — provjera u pregledaču.
//
// Pokretanje: `npx next start -p 3100` u jednom terminalu, pa u drugom se ova
// skripta kopira u folder u kojem je `npm i playwright` već urađen i pokrene
// odatle. NODE_PATH ovdje ne pomaže — ESM ga ne gleda. Playwright namjerno NIJE
// zavisnost projekta, kao ni za ostale skripte u ovom folderu.
//
// Provjerava: da se platno stvarno iscrtava, da gas radi i sa tastature i sa
// dugmeta, da pun gas od starta oduzme prvenstvo, da čekanje pa polazak prolazi
// bez prekršaja, i da su pedale vidljive bez skrolovanja.
import { chromium, webkit } from "playwright";

const URL = "http://localhost:3100/igra";
const OUT = process.argv[2] ?? ".";

const MOTORI = [
  { ime: "chromium-desktop", pokreni: chromium, viewport: { width: 1440, height: 900 }, touch: false },
  { ime: "chromium-mobile", pokreni: chromium, viewport: { width: 390, height: 844 }, touch: true },
  { ime: "webkit-mobile", pokreni: webkit, viewport: { width: 390, height: 844 }, touch: true },
];

const platno = (page) =>
  page.evaluate(() => {
    const c = document.querySelector("canvas");
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const set = new Set();
    for (let i = 0; i < d.length; i += 4 * 97) set.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
    return { boja: set.size, w: c.width, h: c.height };
  });

const kmh = (s) => {
  const m = /(\d+)\s*km\/h/.exec(s ?? "");
  return m ? Number(m[1]) : null;
};

async function cekajKraj(page, ms = 25000) {
  const kraj = Date.now() + ms;
  while (Date.now() < kraj) {
    const txt = await page.locator("main").innerText();
    if (/bez prekršaja/i.test(txt)) return { ishod: "prosao", txt };
    if (/nije ispravna/i.test(txt)) return { ishod: "pao", txt };
    await page.waitForTimeout(200);
  }
  return { ishod: "istekло", txt: await page.locator("main").innerText() };
}

const PREKRSAJI =
  /(Oduzeto prvenstvo prolaza|Sudar|Zadržavanje saobraćaja|Prolazak stop-linije bez zaustavljanja|Prolazak na crveno svjetlo|Prekoračenje dozvoljene brzine)/g;

for (const m of MOTORI) {
  const browser = await m.pokreni.launch();
  const ctx = await browser.newContext({
    viewport: m.viewport,
    hasTouch: m.touch,
    isMobile: m.touch && m.pokreni === chromium,
  });
  const page = await ctx.newPage();
  const greske = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") greske.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on("pageerror", (e) => greske.push(`pageerror: ${e.message}`));

  const izvj = { motor: m.ime };
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  izvj.platno = await platno(page);
  await page.screenshot({ path: `${OUT}/igra-${m.ime}-1-brief.png` });

  // ── 1) pun gas od starta: mora oduzeti prvenstvo ─────────────────────────
  await page.getByRole("button", { name: "Kreni" }).click();
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(1500);
  izvj.brzinaTastaturaKmh = kmh(await page.locator("main").innerText());
  const a = await cekajKraj(page);
  await page.keyboard.up("ArrowUp");
  izvj.gasDoKraja = { ishod: a.ishod, prekrsaji: a.txt.match(PREKRSAJI) ?? [] };
  await page.screenshot({ path: `${OUT}/igra-${m.ime}-2-pad.png` });

  // ── 2) sačekaj pa kreni: mora proći bez prekršaja ────────────────────────
  await page.getByRole("button", { name: "Pokušaj ponovo" }).click();
  await page.waitForTimeout(1900); // pusti da vozilo sa lijeva prođe
  const gas = page.getByRole("button", { name: "Gas" });
  izvj.gasVidljivBezSkrola = await gas.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom <= window.innerHeight && r.top >= 0;
  });
  await gas.scrollIntoViewIfNeeded();
  const box = await gas.boundingBox();
  if (m.touch) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1200);
  izvj.brzinaDodirKmh = kmh(await page.locator("main").innerText());
  const b = await cekajKraj(page);
  await page.mouse.up();
  izvj.cekajPaKreni = { ishod: b.ishod, prekrsaji: b.txt.match(PREKRSAJI) ?? [] };
  await page.screenshot({ path: `${OUT}/igra-${m.ime}-3-ishod.png` });

  izvj.greske = greske;
  console.log(JSON.stringify(izvj, null, 2));
  await browser.close();
}
