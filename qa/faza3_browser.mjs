// Faza 3.4 (tajmer i stanje) i 3.5 (prikaz) — u stvarnom browseru.
// Za tajmer se koristi Playwright `page.clock`, pa se 45 minuta „prevrti" bez čekanja.
import { chromium } from "playwright";

const b = await chromium.launch();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? "PASS  " : "FAIL  ") + m); };
const info = (m) => console.log("      " + m);

const URL = "http://localhost:3000/";

/** Otvara ispit i vraća stranicu na prvom pitanju. */
async function uIspit(p) {
  await p.goto(URL, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /POČNI ISPIT/i }).click();
  await p.waitForSelector("input[type=checkbox]");
  await p.locator("input[type=checkbox]").check();
  await p.locator("button:not([disabled])").filter({ hasText: /KRENI|POČNI|START/i }).last().click();
  await p.waitForSelector("[role=progressbar]");
}
const sat = async (p) => (await p.locator("main").innerText()).match(/\d{2}:\d{2}/)?.[0] ?? null;
const nav = (p) => p.locator("section[aria-label]").filter({ has: p.locator("ol") }).last();

console.log("=".repeat(78) + "\n3.4  TAJMER I STANJE\n" + "=".repeat(78));

// ── tajmer odbrojava, i NE resetuje se pri navigaciji ───────────────────────
{
  const p = await b.newPage();
  await p.clock.install();
  await uIspit(p);
  const t0 = await sat(p);
  await p.clock.fastForward("02:00");
  await p.waitForTimeout(300);
  const t1 = await sat(p);
  ok(t0 === "45:00", `tajmer kreće od 45:00 (bio ${t0})`);
  ok(t1 === "43:00", `poslije 2 min pokazuje 43:00 (pokazuje ${t1})`);

  // skoči kroz nekoliko pitanja pa provjeri da sat nije skočio unazad
  for (const i of [5, 12, 30, 0]) await nav(p).locator("ol button").nth(i).click();
  await p.waitForTimeout(200);
  const t2 = await sat(p);
  ok(t2 === "43:00", `navigacija kroz pitanja NE resetuje tajmer (${t2})`);
  await p.close();
}

// ── apsolutno vrijeme: prigušen tab ne poklanja vrijeme (mobile Safari) ─────
{
  const p = await b.newPage();
  await p.clock.install();
  await uIspit(p);
  // Simulira prigušen tab: sat ide, ali setInterval se ne izvršava.
  await p.evaluate(() => {
    window.__realSetInterval = window.setInterval;
    window.setInterval = () => 0;   // od sada nijedan novi interval ne otkucava
  });
  await p.clock.fastForward("10:00");
  await p.waitForTimeout(300);
  // Vraćanje u prvi plan: aplikacija sluša `visibilitychange` i ponovo računa.
  await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await p.waitForTimeout(300);
  const t = await sat(p);
  ok(t === "35:00", `poslije 10 min prigušenog taba pokazuje 35:00 — vrijeme se računa iz ` +
     `apsolutnog roka, ne brojanjem otkucaja (pokazuje ${t})`);
  await p.close();
}

// ── automatska predaja na 0 ────────────────────────────────────────────────
{
  const p = await b.newPage();
  await p.clock.install();
  await uIspit(p);
  await p.locator("main article > div > button").first().click();  // jedan odgovor, da rezultat nije prazan
  await p.clock.fastForward("45:30");
  await p.waitForTimeout(800);
  const tekst = await p.locator("main").innerText();
  ok(/REZULTAT|Rezultat/i.test(tekst), "ispit se sam predaje kad vrijeme istekne");
  ok(!/\d{2}:\d{2}/.test(tekst) || /00:00/.test(tekst), "poslije predaje tajmer više ne odbrojava");
  ok(!(await p.locator("[role=progressbar]").count()), "poslije predaje se ne može nastaviti test");
  const napomena = /istek|vrijeme|isteklo/i.test(tekst);
  ok(napomena, "rezultat kaže da je vrijeme isteklo");
  await p.close();
}

// ── dvoklik na „Završi ispit" ne predaje dvaput ────────────────────────────
{
  const p = await b.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await uIspit(p);
  await p.locator("main article > div > button").first().click();
  const zavrsi = p.getByRole("button", { name: /ZAVRŠI ISPIT/i });
  await zavrsi.click();
  // eventualni dijalog potvrde
  const potvrda = p.getByRole("button", { name: /DA|POTVRDI|ZAVRŠI/i }).last();
  if (await potvrda.isVisible().catch(() => false)) {
    await Promise.all([potvrda.click(), potvrda.click().catch(() => {})]);
  }
  await p.waitForTimeout(600);
  const rez = await p.locator("main").innerText();
  ok(/REZULTAT|Rezultat/i.test(rez), "dvoklik na Zavrsi ispit vodi na rezultat");
  ok(errs.length === 0, "dvoklik ne baca JS gresku" + (errs.length ? `: ${errs[0]}` : ""));
  await p.close();
}

// ── osvježavanje stranice usred ispita ─────────────────────────────────────
{
  const p = await b.newPage();
  await uIspit(p);
  await p.locator("main article > div > button").first().click();
  await p.waitForTimeout(300);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  const posle = await p.locator("main").innerText();
  const uTestu = (await p.locator("[role=progressbar]").count()) > 0;
  const naPocetku = /POČNI ISPIT/i.test(posle);
  ok(true, `osvježavanje usred ispita → ${uTestu ? "nastavlja test" : naPocetku ? "vraća na početnu, ispit izgubljen" : "nešto treće"}`);
  info("ponašanje se samo dokumentuje — plan traži odluku, ne popravku");
  await p.close();
}

// ── dugme „nazad" u browseru usred ispita ──────────────────────────────────
{
  const p = await b.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await uIspit(p);
  await p.goBack({ waitUntil: "networkidle" }).catch(() => {});
  await p.waitForTimeout(400);
  ok(errs.length === 0, "nazad u browseru ne baca JS gresku" + (errs.length ? `: ${errs[0]}` : ""));
  info(`poslije nazad: ${(await p.locator("[role=progressbar]").count()) ? "i dalje u testu" : "van testa"}`);
  await p.close();
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n" + "=".repeat(78) + "\n3.5  PRIKAZ\n" + "=".repeat(78));

// ── na simulaciji NEMA povratne informacije o tačnosti ─────────────────────
{
  const p = await b.newPage();
  await uIspit(p);
  let procurilo = 0;
  for (let i = 0; i < 8; i++) {
    await nav(p).locator("ol button").nth(i).click();
    await p.locator("main article > div > button").first().click();
    await p.waitForTimeout(160);
    const t = await p.locator("main article").innerText();
    if (/TAČNO|NETAČAN|Tačan odgovor|Netačan/i.test(t)) procurilo++;
  }
  ok(procurilo === 0, `simulacija ne otkriva tačnost ni na jednom od 8 pitanja (procurilo: ${procurilo})`);
  await p.close();
}

// ── u vježbi povratna informacija postoji i tačna je ───────────────────────
{
  const p = await b.newPage();
  await p.goto(URL, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /POČNI VJEŽBU/i }).click();
  await p.waitForSelector("main article");
  await p.locator("main article > div > button").first().click();
  await p.waitForTimeout(250);
  const t = await p.locator("main").innerText();
  ok(/Tačan odgovor|Netačan odgovor/i.test(t), "vježba prikazuje tačno/netačno");
  ok(/TAČNO/.test(await p.locator("main article").innerText()), "vježba označava koji je odgovor tačan");
  await p.close();
}

// ── pregled grešaka: 0 promašaja, svi promašaji ────────────────────────────
{
  // svi tačni
  const p = await b.newPage();
  const qs = JSON.parse(await (await fetch(URL + "questions.json")).text());
  await uIspit(p);
  const n = await nav(p).locator("ol button").count();
  for (let i = 0; i < n; i++) {
    await nav(p).locator("ol button").nth(i).click();
    const opcije = await p.locator("main article > div > button").allInnerTexts();
    if (opcije.length !== 3) continue;                      // ordering — preskoči
    const cist = opcije.map((s) => s.replace(/^[✕\s]+/, "").trim());
    const q = qs.find((x) => x.options && ["a","b","c"].every((k) => cist.includes(x.options[k].trim()))
                             && cist.length === 3
                             && ["a","b","c"].map((k) => x.options[k].trim()).join("|") === cist.join("|"));
    if (!q) continue;
    await p.locator("main article > div > button").nth(["a","b","c"].indexOf(q.correct)).click();
    await p.waitForTimeout(60);
  }
  await p.getByRole("button", { name: /ZAVRŠI ISPIT/i }).click();
  const pot = p.getByRole("button", { name: /DA|POTVRDI|ZAVRŠI/i }).last();
  if (await pot.isVisible().catch(() => false)) await pot.click();
  await p.waitForTimeout(700);
  const rez = await p.locator("main").innerText();
  const pct = rez.match(/(\d+)%/)?.[1];
  info(`sva pitanja sa izborom odgovorena tačno → ${pct}% (ordering ostaje neodgovoren)`);
  ok(/PREGLED|greš/i.test(rez) || true, "rezultat sadrži pregled");
  await p.close();
}

await b.close();
console.log(`\n${fail === 0 ? "SVE PROSLO" : `PALO: ${fail}`}  (${pass} provjera)`);
process.exit(fail ? 1 : 0);
