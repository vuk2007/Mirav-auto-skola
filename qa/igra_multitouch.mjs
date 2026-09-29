// Igra „Prođi raskrsnicu" — volan i gas na dodir, istovremeno.
//
// Pokretanje: `npx next start -p 3100` u jednom terminalu, pa se ova skripta
// kopira u folder u kojem je `npm i playwright` već urađen i pokrene odatle.
//
// Iz zadatka (faza 5, odjeljak 7): „Testiraj da rade istovremeno na touch-u
// (multitouch) i da klizač volana ne hvata skrol stranice." Jedinični test to
// ne može: dodir, `touch-action` i skrol postoje samo u pregledaču.
//
// Šta se mjeri, i zašto baš to:
//  - dva prsta, jedan na volanu i jedan na gasu, pomjeraju OBJE kvake u isto
//    vrijeme — i auto ubrzava dok je volan okrenut;
//  - vertikalno povlačenje prstom po volanu ne pomjera stranicu, a isto
//    povlačenje van klizača je pomjera — bez te kontrole bi „nije skrolovalo"
//    moglo značiti samo da stranica i nema šta da skroluje;
//  - svaki klizač, kad ga prst uhvati, pozove vibraciju (haptika);
//  - nijedna greška u konzoli.
// Dodir se šalje kroz Chrome DevTools protokol, jer samo on pravi PRAVE
// dodire sa više prstiju — Playwrightov `tap` je jedan prst.

import { chromium } from "playwright";

const URL = "http://localhost:3100/igra";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 640 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
// Vibracija se broji umjesto da se izvrši.
await page.addInitScript(() => {
  window.__vibracije = [];
  navigator.vibrate = (ms) => {
    window.__vibracije.push(ms);
    return true;
  };
});
const greske = [];
page.on("pageerror", (e) => greske.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !/_vercel|Failed to load resource/.test(m.text())) greske.push(`console: ${m.text()}`);
});

const rezultat = [];
const ok = (uslov, opis) => {
  rezultat.push(`${uslov ? "PASS" : "FAIL"}  ${opis}`);
  return uslov;
};

await page.goto(URL, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /^Vozi rutu$/i }).first().click();
await page.getByRole("button", { name: /^Kreni$/i }).first().click();
await page.waitForSelector("canvas", { timeout: 120000 });
await page.waitForTimeout(1500);

const cdp = await ctx.newCDPSession(page);
const dodir = (type, tacke) =>
  cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: tacke.map((t) => ({ x: t.x, y: t.y, id: t.id, radiusX: 4, radiusY: 4, force: 1 })),
  });
const kvaka = (koja) =>
  page.evaluate((k) => getComputedStyle(document.querySelector(`[data-kvaka="${k}"]`)).transform, koja);
const pomak = (m) => {
  // matrix(a, b, c, d, tx, ty)
  const d = /matrix\(([^)]+)\)/.exec(m)?.[1]?.split(",").map(Number) ?? [];
  return { x: d[4] ?? 0, y: d[5] ?? 0 };
};
const brzina = async () =>
  Number(/(\d+)\s*km\/h/.exec(await page.locator("main").innerText())?.[1] ?? 0);

// ── skrol ────────────────────────────────────────────────────────────────
/** Povuci jednim prstom od tačke nagore za `koliko` piksela. */
const povuci = async (x, y, koliko) => {
  await dodir("touchStart", [{ id: 3, x, y }]);
  for (let i = 1; i <= 10; i++) {
    await dodir("touchMove", [{ id: 3, x, y: y - (koliko * i) / 10 }]);
    await page.waitForTimeout(16);
  }
  await dodir("touchEnd", []);
  await page.waitForTimeout(400);
};

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
// Kontrolna tačka: gore na stranici, van platna i van klizača — tamo se
// stranica mora pomjeriti, inače mjerenje ispod ne dokazuje ništa.
const van = { x: 195, y: 110 };
const tamoJe = await page.evaluate(({ x, y }) => {
  const e = document.elementFromPoint(x, y);
  return e ? `${e.tagName}${e.closest("canvas,[role=slider]") ? " (kontrola!)" : ""}` : "ništa";
}, van);
const skrolVan0 = await page.evaluate(() => window.scrollY);
await povuci(van.x, van.y, 100);
const skrolVan = await page.evaluate(() => window.scrollY);
const stranicaSkroluje = ok(skrolVan > skrolVan0, `kontrola: povlačenje van klizača (${tamoJe}) skroluje stranicu (${skrolVan0} → ${skrolVan} px)`);

// Volan se prvo dovede u kadar: stranica je viša od ekrana telefona, pa bi
// dodir po klizaču ispod ivice ekrana pao na nešto drugo.
await page.evaluate(() => window.scrollTo(0, 0));
await page.getByRole("slider", { name: /Volan/i }).scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
const v2 = await page.getByRole("slider", { name: /Volan/i }).boundingBox();
const skrolKlizac0 = await page.evaluate(() => window.scrollY);
const naVolanu = await page.evaluate(
  ({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest("[role=slider]")),
  { x: v2.x + v2.width / 2, y: v2.y + v2.height - 8 },
);
ok(naVolanu, "dodir za provjeru skrola pada baš na volan");
await povuci(v2.x + v2.width / 2, v2.y + v2.height - 8, Math.min(180, v2.y + v2.height - 20));
const skrolKlizac = await page.evaluate(() => window.scrollY);
ok(
  stranicaSkroluje && skrolKlizac === skrolKlizac0,
  `povlačenje po volanu ne skroluje stranicu (${skrolKlizac0} → ${skrolKlizac} px)`,
);

// ── dva prsta istovremeno ─────────────────────────────────────────────────
const volan = await page.getByRole("slider", { name: /Volan/i }).boundingBox();
const gas = await page.getByRole("slider", { name: /Gas/i }).boundingBox();
ok(Boolean(volan && gas), "oba klizača su na ekranu");

const prst1 = { id: 1, x: volan.x + volan.width / 2, y: volan.y + volan.height / 2 };
const prst2 = { id: 2, x: gas.x + gas.width / 2, y: gas.y + gas.height / 2 };
const nulaVolan = pomak(await kvaka("volan"));
const nulaGas = pomak(await kvaka("gas"));
const brzinaPrije = await brzina();

await dodir("touchStart", [prst1, prst2]);
for (let i = 1; i <= 8; i++) {
  // Volan udesno (ka bankini, ne u susretnu traku), gas nagore — oba prsta se
  // pomjeraju u istom događaju.
  await dodir("touchMove", [
    { ...prst1, x: prst1.x + i * 8 },
    { ...prst2, y: prst2.y - i * 7 },
  ]);
  await page.waitForTimeout(30);
}
await page.waitForTimeout(1200);
const drziVolan = pomak(await kvaka("volan"));
const drziGas = pomak(await kvaka("gas"));
const brzinaDok = await brzina();
await page.screenshot({ path: "multitouch-dva-prsta.png" });
await dodir("touchEnd", []);

ok(drziVolan.x > nulaVolan.x + 20, `volan pomjeren udesno dok se drži i gas (${nulaVolan.x.toFixed(0)} → ${drziVolan.x.toFixed(0)} px)`);
ok(drziGas.y < nulaGas.y - 10, `gas pomjeren nagore dok se drži i volan (${nulaGas.y.toFixed(0)} → ${drziGas.y.toFixed(0)} px)`);
ok(brzinaDok > brzinaPrije, `auto ubrzava dok su oba prsta na klizačima (${brzinaPrije} → ${brzinaDok} km/h)`);

await page.waitForTimeout(600);
const pustenVolan = pomak(await kvaka("volan"));
ok(Math.abs(pustenVolan.x - nulaVolan.x) < 3, "pušten volan se vraća u sredinu");

const vibracije = await page.evaluate(() => window.__vibracije.length);
ok(vibracije >= 2, `haptika: svaki uhvaćen klizač vibrira (${vibracije} poziva)`);

ok(greske.length === 0, `nijedna greška u konzoli${greske.length ? ": " + greske.join(" | ") : ""}`);

console.log(rezultat.join("\n"));
console.log(rezultat.every((r) => r.startsWith("PASS")) ? "\nSVE PROSLO" : "\nIMA PADOVA");
await browser.close();
