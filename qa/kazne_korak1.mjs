// Korak 1 — provjera da sa KAZNE_ENABLED=false nema traga kaznama, a ostalo radi.
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const b = await chromium.launch();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? "PASS  " : "FAIL  ") + m); };

// Riječi koje se pojavljuju samo ako se kazne prikazuju.
const TRAG = /Prekoračenje dozvoljene brzine|KOLIKO BI OVO KOŠTALO|čl\. 3\d\d st\.|Nevezan sigurnosni pojas|€/;

const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const preuzeto = [];               // svi JS komadi koje browser stvarno povuče
p.on("response", (r) => { if (r.url().endsWith(".js")) preuzeto.push(r.url()); });
const errs = []; p.on("pageerror", (e) => errs.push(String(e)));

// ── vježba: odgovori NETAČNO, tu se kazna inače prikazuje ───────────────────
await p.goto(BASE, { waitUntil: "networkidle" });
await p.getByRole("button", { name: /POČNI VJEŽBU/i }).click();
await p.waitForSelector("main article");
let netacnih = 0;
for (let i = 0; i < 14 && netacnih < 6; i++) {
  const dugmad = await p.locator("main article > div > button").count();
  if (dugmad === 3) {
    await p.locator("main article > div > button").first().click();
    await p.waitForTimeout(200);
    if (/Netačan odgovor/.test(await p.locator("main").innerText())) netacnih++;
  } else {
    await p.locator("main article input[inputmode=numeric]").fill("9-9-9-9").catch(() => {});
  }
  await p.getByRole("button", { name: /SLJEDEĆE/i }).click().catch(() => {});
  await p.waitForTimeout(120);
}
const uVjezbi = await p.locator("main").innerText();
ok(netacnih > 0, `u vježbi je namjerno promašeno ${netacnih} pitanja`);
ok(!TRAG.test(uVjezbi), "vježba ne prikazuje kaznu uz netačan odgovor");

// ── ispit do rezultata: tu je bio i zbir kazni ──────────────────────────────
await p.goto(BASE, { waitUntil: "networkidle" });
await p.getByRole("button", { name: /POČNI ISPIT/i }).click();
await p.waitForSelector("input[type=checkbox]");
await p.locator("input[type=checkbox]").check();
await p.locator("button:not([disabled])").filter({ hasText: /KRENI|POČNI|START/i }).last().click();
await p.waitForSelector("[role=progressbar]");
const nav = p.locator("section[aria-label]").filter({ has: p.locator("ol") }).last();
for (let i = 0; i < 8; i++) {
  await nav.locator("ol button").nth(i).click();
  await p.locator("main article > div > button").first().click().catch(() => {});
  await p.waitForTimeout(70);
}
await p.getByRole("button", { name: /ZAVRŠI ISPIT/i }).click();
const pot = p.getByRole("button", { name: /DA|POTVRDI|ZAVRŠI/i }).last();
if (await pot.isVisible().catch(() => false)) await pot.click();
await p.waitForTimeout(900);
const naRezultatu = await p.locator("main").innerText();
ok(/%/.test(naRezultatu), "rezultat se prikazuje normalno");
ok(!TRAG.test(naRezultatu), "pregled grešaka ne prikazuje ni pojedinačnu kaznu ni zbir");

// ── ključno: da li je komad koda sa kaznama uopšte povučen sa mreže ─────────
const sumnjivi = [];
for (const url of [...new Set(preuzeto)]) {
  const t = await (await fetch(url)).text();
  if (/Prekoračenje dozvoljene brzine|minEur/.test(t)) sumnjivi.push(url.split("/").pop());
}
ok(sumnjivi.length === 0,
   `nijedan od ${new Set(preuzeto).size} povučenih JS komada ne sadrži podatke o kaznama` +
   (sumnjivi.length ? `: ${sumnjivi.join(", ")}` : ""));

ok(errs.length === 0, "bez JS grešaka" + (errs.length ? `: ${errs[0]}` : ""));
await p.close();

// ── ostatak sajta radi ─────────────────────────────────────────────────────
for (const [put, marker] of [["/simulator", /RASKRSNIC|SIMULATOR|Simulator/i], ["/embed", /POČNI/i], ["/embed/simulator", /./]]) {
  const q = await b.newPage({ viewport: { width: 390, height: 844 } });
  const e2 = []; q.on("pageerror", (x) => e2.push(String(x)));
  const r = await q.goto(BASE + put, { waitUntil: "networkidle" });
  const txt = await q.locator("body").innerText();
  ok(r.status() === 200 && marker.test(txt) && e2.length === 0, `${put} radi normalno (HTTP ${r.status()})`);
  await q.close();
}

await b.close();
console.log(`\n${fail === 0 ? "SVE PROSLO" : `PALO: ${fail}`}  (${pass} provjera)`);
process.exit(fail ? 1 : 0);
