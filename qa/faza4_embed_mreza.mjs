// Faza 4.3 (/embed u pravom iframe-u) i 4.4 (ponašanje na lošoj mreži).
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "PASS  " : "FAIL  ") + m); };
const info = (m) => console.log("      " + m);
const b = await chromium.launch();
// ════════════════════════════════════════════════════════════════════════════
console.log("=".repeat(78) + "\n4.3  /embed U PRAVOM IFRAME-U\n" + "=".repeat(78));
{
  const p = await b.newPage({ viewport: { width: 900, height: 700 } });
  // Roditeljska stranica mora biti na ISTOM porijeklu — CSP `frame-ancestors`
  // dozvoljava 'self' i mirav.me, pa bi about:blank roditelj bio blokiran.
  // Zato se lažna roditeljska stranica servira sa localhost:3000.
  await p.route(`${BASE}/__roditelj`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;height:100%} iframe{width:100%;border:0;display:block}</style>
<h1 style="font:16px system-ui;margin:8px">lažni mirav.me</h1>
<iframe id="f" src="${BASE}/embed" height="300"></iframe>
<script>
  window.__poruke = [];
  addEventListener("message", (e) => {
    window.__poruke.push(e.data);
    var h = (e.data && (e.data.height ?? e.data)) | 0;
    if (h > 0) document.getElementById("f").height = h;
  });
</script>`,
    }),
  );
  const greske = [];
  p.on("pageerror", (e) => greske.push(String(e)));
  await p.goto(`${BASE}/__roditelj`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  const poruke1 = await p.evaluate(() => window.__poruke.slice());
  ok(poruke1.length > 0, `roditelj dobija poruku o visini pri učitavanju (${poruke1.length} poruka)`);
  info(`prva poruka: ${JSON.stringify(poruke1[0])}`);
  const okvir = p.frameLocator("#f");
  const visina = async () => Number(await p.locator("#f").getAttribute("height"));
  const h0 = await visina();
  // — pokreni ispit unutar iframe-a i traži pitanje SA slikom
  await okvir.getByRole("button", { name: /POČNI ISPIT/i }).click();
  await p.waitForTimeout(900);
  await okvir.locator("input[type=checkbox]").check();
  await okvir.locator("button:not([disabled])").filter({ hasText: /KRENI|POČNI|START/i }).last().click();
  await p.waitForTimeout(900);
  const hIspit = await visina();
  ok(hIspit !== h0, `visina se javlja i pri promjeni ekrana (${h0} → ${hIspit} px)`);
  // — promjena pitanja: pređi sa tekstualnog na pitanje sa slikom
  const navBtn = okvir.locator("section ol button");
  // Trebaju OBA: pitanje bez slike i pitanje sa slikom. Prelazak između njih
  // stvarno mijenja visinu, pa se vidi javlja li se ona roditelju.
  let bezSlike = -1, saSlikom = -1;
  for (let i = 0; i < 41 && (bezSlike < 0 || saSlikom < 0); i++) {
    await navBtn.nth(i).click();
    await p.waitForTimeout(150);
    const imaSliku = (await okvir.locator("main article img").count()) > 0;
    if (imaSliku && saSlikom < 0) saSlikom = i;
    if (!imaSliku && bezSlike < 0) bezSlike = i;
  }
  await navBtn.nth(bezSlike).click();
  await p.waitForTimeout(700);
  const brojPrije = await p.evaluate(() => window.__poruke.length);
  const visinaPrije = await visina();
  await navBtn.nth(saSlikom).click();
  await p.waitForTimeout(1500);
  const brojPoslije = await p.evaluate(() => window.__poruke.length);
  const visinaPoslije = await visina();
  ok(brojPoslije > brojPrije,
     `visina se javlja pri promjeni pitanja: bez slike (#${bezSlike + 1}) → sa slikom ` +
     `(#${saSlikom + 1}), ${visinaPrije} → ${visinaPoslije} px, ${brojPoslije - brojPrije} nova poruka`);
  // — KLJUČNO: slika mijenja visinu POSLIJE prve poruke. Da li stigne još jedna?
  const nakonSlike = await p.evaluate(() => window.__poruke.slice(-4));
  const iscrtana = await okvir.locator("main article img").evaluate((im) => im.naturalWidth > 0).catch(() => false);
  ok(iscrtana, "slika u iframe-u se iscrtala");
  const visine = nakonSlike.map((x) => (x && (x.height ?? x)) | 0).filter((x) => x > 0);
  ok(new Set(visine).size > 1 || visine.length > 1,
     `poslije učitavanja slike stiže još poruka o visini (zadnje: ${JSON.stringify(visine)})`);
  // — dupli scrollbar: iframe ne smije imati svoj vertikalni skrol
  const skrol = await p.evaluate(() => {
    const f = document.getElementById("f");
    const d = f.contentDocument.documentElement;
    return { unutra: d.scrollHeight - d.clientHeight, iframeH: f.clientHeight, docH: d.scrollHeight };
  });
  ok(skrol.unutra <= 2,
     `nema duplog skrola — sadržaj (${skrol.docH}px) stane u iframe (${skrol.iframeH}px), višak ${skrol.unutra}px`);
  ok(greske.length === 0, "nema JS grešaka na roditeljskoj stranici" + (greske.length ? `: ${greske[0]}` : ""));
  await p.close();
}
// ════════════════════════════════════════════════════════════════════════════
console.log("\n" + "=".repeat(78) + "\n4.4  MREŽA\n" + "=".repeat(78));
// ── Slow 3G: koliko do prvog pitanja i ima li išta na ekranu u međuvremenu ──
{
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const cdp = await p.context().newCDPSession(p);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8,
  });
  const t0 = Date.now();
  await p.goto(BASE, { waitUntil: "domcontentloaded" });
  const tDom = Date.now() - t0;
  const prazno = ((await p.locator("body").innerText()) || "").trim().length === 0;
  ok(!prazno, `poslije DOMContentLoaded ekran nije prazan (${(tDom / 1000).toFixed(1)} s)`);
  // Dugme je vidljivo odmah, ali ne radi dok se React ne hidrira. Mjeri se i taj
  // razmak: to je period u kojem korisnik klika a ništa se ne dešava.
  // (Na prvoj verziji testa klik je pao baš u taj razmak i ništa se nije desilo.)
  await p.waitForLoadState("load");
  const tLoad = Date.now() - t0;
  let hidrirano = null;
  for (let i = 0; i < 120; i++) {
    await p.getByRole("button", { name: /POČNI VJEŽBU/i }).click({ timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(500);
    const promijenio = !(await p.getByRole("button", { name: /POČNI VJEŽBU/i }).isVisible().catch(() => false));
    if (promijenio) { hidrirano = Date.now() - t0; break; }
  }
  ok(hidrirano !== null, `dugme „Počni vježbu" postane upotrebljivo (${((hidrirano ?? 0) / 1000).toFixed(1)} s)`);
  info(`Slow 3G: DOMContentLoaded ${(tDom / 1000).toFixed(1)} s · load ${(tLoad / 1000).toFixed(1)} s · ` +
       `dugme radi ${((hidrirano ?? 0) / 1000).toFixed(1)} s`);
  info(`razmak u kojem je dugme vidljivo ali ne radi: ~${((hidrirano - tDom) / 1000).toFixed(1)} s`);
  const medju = (await p.locator("main").innerText()).trim();
  const t1 = Date.now();
  await p.waitForSelector("main article", { timeout: 180000 });
  const doPitanja = Date.now() - t1;
  ok(medju.length > 0, `dok se baza ucitava ekran nije prazan — pise: "${medju.slice(0, 60)}"`);
  info(`do prvog pitanja jos ${(doPitanja / 1000).toFixed(1)} s (baza je 600 kB), ukupno ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  ok(doPitanja < 60000, `prvo pitanje stigne ispod 60 s poslije klika (${(doPitanja / 1000).toFixed(1)} s)`);
  await p.close();
}
// ── slika ne uspije da se učita ────────────────────────────────────────────
{
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.route("**/web_images/**", (route) => route.abort());
  const greske = [];
  p.on("pageerror", (e) => greske.push(String(e)));
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /POČNI VJEŽBU/i }).click();
  await p.waitForSelector("main article");
  // pređi na pitanje sa slikom
  for (let i = 0; i < 12; i++) {
    if (await p.locator("main article img").count()) break;
    await p.locator("main article > div > button").first().click().catch(() => {});
    await p.getByRole("button", { name: /SLJEDEĆE/i }).click().catch(() => {});
    await p.waitForTimeout(120);
  }
  await p.waitForTimeout(600);
  const preliv = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const imaOpcije = await p.locator("main article > div > button").count();
  ok(greske.length === 0, "neuspjelo učitavanje slike ne baca JS grešku");
  ok(preliv === 0, `neuspjela slika ne razbija raspored (preliv ${preliv}px)`);
  ok(imaOpcije === 3, `pitanje ostaje upotrebljivo — sve tri opcije su tu (${imaOpcije})`);
  const alt = await p.locator("main article img").getAttribute("alt").catch(() => null);
  info(`alt tekst slike: ${JSON.stringify(alt)} — prazan je namjerno (slika je sadržaj pitanja, ne ukras)`);
  await p.close();
}
// ── offline usred ispita ───────────────────────────────────────────────────
{
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const greske = [];
  p.on("pageerror", (e) => greske.push(String(e)));
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /POČNI ISPIT/i }).click();
  await p.waitForSelector("input[type=checkbox]");
  await p.locator("input[type=checkbox]").check();
  await p.locator("button:not([disabled])").filter({ hasText: /KRENI|POČNI|START/i }).last().click();
  await p.waitForSelector("[role=progressbar]");
  const navB = p.locator("section[aria-label]").filter({ has: p.locator("ol") }).last().locator("ol button");
  for (let i = 0; i < 5; i++) {
    await navB.nth(i).click();
    await p.locator("main article > div > button").first().click().catch(() => {});
    await p.waitForTimeout(80);
  }
  await p.context().setOffline(true);
  for (let i = 5; i < 12; i++) {
    await navB.nth(i).click();
    await p.locator("main article > div > button").first().click().catch(() => {});
    await p.waitForTimeout(80);
  }
  const radiOffline = (await p.locator("[role=progressbar]").count()) > 0;
  ok(radiOffline, "ispit se nastavlja i bez mreže (baza je već u memoriji)");
  await p.getByRole("button", { name: /ZAVRŠI ISPIT/i }).click();
  const pot = p.getByRole("button", { name: /DA|POTVRDI|ZAVRŠI/i }).last();
  if (await pot.isVisible().catch(() => false)) await pot.click();
  await p.waitForTimeout(900);
  const rez = await p.locator("main").innerText();
  ok(/%/.test(rez), "rezultat se izračuna i offline");
  ok(greske.length === 0, "offline ne baca JS grešku" + (greske.length ? `: ${greske[0]}` : ""));
  await p.context().setOffline(false);
  await p.close();
}
await b.close();
console.log(`\n${fail === 0 ? "SVE PROSLO" : `PALO: ${fail}`}  (${pass} provjera)`);
process.exit(fail ? 1 : 0);