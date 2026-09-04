// Koje JS datoteke stranica /igra stvarno povuce, i ima li u njima kataloga kazni.
//
// Pokretanje: `npx next start -p 3100`, pa ovu skriptu iz foldera u kojem je
// playwright instaliran (vidi qa/igra_faza2.mjs).
//
// Zasto: prikaz kazni je iza zastavice `NEXT_PUBLIC_KAZNE_ENABLED`, ali
// zastavica na ekranu ne znaci nista ako podaci ipak putuju u bundle-u. Ranije
// se to vec desilo kvizu, pa se provjerava mjerenjem, a ne citanjem koda.
import { chromium } from "playwright";
// Trazi se ono sto postoji SAMO u katalogu kazni. Naslov kazne nije dobar
// trag: isti tekst je i u rjecniku UI-ja kao naziv prekrsaja.
const POLJA = /iznos_min|kazneni_poeni|zabrana_upravljanja|nepotvrdjeno|Sl\. list CG/;
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const js = [];
p.on("response", (r) => { if (r.url().endsWith(".js")) js.push(r.url()); });
await p.goto("http://localhost:3100/igra", { waitUntil: "networkidle" });
// odigraj jedan prekrsaj — tada bi se kartica kazne prikazala da je ukljucena
await p.locator("main ul > li > button").first().click();
await p.getByRole("button", { name: "Kreni" }).click();
await p.keyboard.down("ArrowUp");
for (let i = 0; i < 200; i++) {
  if (/nije ispravna/i.test(await p.locator("main").innerText())) break;
  await p.waitForTimeout(150);
}
await p.keyboard.up("ArrowUp");
await p.waitForTimeout(1500);
const nadjeno = [];
for (const url of [...new Set(js)]) {
  const txt = await p.evaluate((u) => fetch(u).then((r) => r.text()), url);
  if (POLJA.test(txt)) nadjeno.push(url);
}
console.log(JSON.stringify({ ukupnoJs: new Set(js).size, saKaznama: nadjeno }, null, 2));
await b.close();
