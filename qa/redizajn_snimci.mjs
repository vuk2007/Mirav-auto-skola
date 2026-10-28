// Redizajn — snimci svih glavnih ekrana na telefonu i desktopu.
//
//   node qa/redizajn_snimci.mjs <izlazni-folder> [osnova]
//
// Prolazi kroz ekrane na crnogorskom (natpisi dugmadi su poznati), a jezik se
// prebacuje dugmetom na samom ekranu, pa skript ne zavisi od prevoda. Osim snimka,
// za svaki ekran javlja vodoravni preliv (scrollWidth > širina prozora).
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const IZLAZ = process.argv[2] ?? "qa/snimci-redizajn";
const OSNOVA = process.argv[3] ?? "http://localhost:3000";
const SIRINE = [
  { w: 390, h: 844, ime: "390" },
  { w: 1440, h: 900, ime: "1440" },
];
const SVI_JEZICI = ["ME", "EN", "AL", "RU", "TR"];
const DUGI_JEZICI = ["ME", "RU", "AL"];

mkdirSync(IZLAZ, { recursive: true });
const b = await chromium.launch();
const prelivi = [];

/** Next-ov razvojni indikator (krug sa „N") nije dio sajta. */
async function sakrijDevAlate(p) {
  await p.addStyleTag({ content: "nextjs-portal{display:none!important}" });
}

async function snimi(p, ime) {
  await p.waitForTimeout(350);
  const preliv = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (preliv > 1) prelivi.push(`${ime}: ${preliv}px`);
  await p.screenshot({ path: `${IZLAZ}/${ime}.png`, fullPage: true });
  console.log(`  ${ime}.png${preliv > 1 ? `  PRELIV ${preliv}px` : ""}`);
}

async function jezik(p, oznaka) {
  await p.locator('[role="group"] button', { hasText: new RegExp(`^${oznaka}$`) }).first().click();
  await p.waitForTimeout(250);
  await potvrdiUpozorenje(p);
}

/** Upozorenje o jeziku ispita (EN/RU) može iskočiti u više trenutaka; potvrdi ga ako je tu. */
async function potvrdiUpozorenje(p) {
  const modal = p.locator('[role="alertdialog"]');
  if (await modal.count()) await modal.locator("button").first().click();
}

async function nova(s) {
  const ctx = await b.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on("dialog", (d) => d.accept());
  await p.goto(OSNOVA + "/", { waitUntil: "networkidle" });
  await sakrijDevAlate(p);
  return { ctx, p };
}

const dugme = (p, re) => p.getByRole("button", { name: re }).first();

for (const s of SIRINE) {
  // ── Početna, svih pet jezika ─────────────────────────────────────────────
  {
    const { ctx, p } = await nova(s);
    for (const j of SVI_JEZICI) {
      await jezik(p, j);
      await snimi(p, `${s.ime}-pocetna-${j}`);
    }
    await jezik(p, "ME");
    await dugme(p, /literatura/i).click();
    await snimi(p, `${s.ime}-literatura-ME`);
    await ctx.close();
  }

  // ── Vježba: pitanje, pa otkriven odgovor ─────────────────────────────────
  for (const j of DUGI_JEZICI) {
    const { ctx, p } = await nova(s);
    await jezik(p, "ME");
    await dugme(p, /počni vježbu/i).click();
    await p.waitForSelector("[role=progressbar]");
    await jezik(p, j);
    // Na EN/RU iskoči upozorenje o jeziku tek pri pokretanju, pa ovdje nema modala.
    await snimi(p, `${s.ime}-vjezba-${j}`);
    // Odgovor je prvo dugme sa aria-pressed koje nije u grupi jezika ili kategorija.
    const opcije = p.locator("main button[aria-pressed='false']:not([role=group] button)");
    const n = await opcije.count();
    for (let k = 0; k < n; k++) {
      const t = (await opcije.nth(k).innerText()).trim();
      if (t.length > 3) {
        await opcije.nth(k).click();
        break;
      }
    }
    await snimi(p, `${s.ime}-vjezba-otkriveno-${j}`);
    await ctx.close();
  }

  // ── Uputstvo, ispit, rezultat ────────────────────────────────────────────
  for (const j of DUGI_JEZICI) {
    const { ctx, p } = await nova(s);
    await jezik(p, "ME");
    await dugme(p, /počni ispit/i).click();
    await p.waitForSelector("input[type=checkbox]");
    await jezik(p, j);
    await snimi(p, `${s.ime}-uputstvo-${j}`);
    await p.locator("input[type=checkbox]").check();
    await p.locator("main button:not([disabled])").last().click();
    await p.waitForTimeout(400);
    if (await p.locator('[role="alertdialog"]').count()) {
      await snimi(p, `${s.ime}-ispit-upozorenje-${j}`);
      await potvrdiUpozorenje(p);
    }
    await p.waitForSelector("[role=progressbar]");
    await snimi(p, `${s.ime}-ispit-${j}`);
    await jezik(p, "ME");
    await dugme(p, /završi ispit/i).click();
    await p.waitForTimeout(600);
    await jezik(p, j);
    await snimi(p, `${s.ime}-rezultat-${j}`);
    await ctx.close();
  }

  // ── Simulator i igra ─────────────────────────────────────────────────────
  {
    const { ctx, p } = await nova(s);
    await jezik(p, "ME");
    await dugme(p, /počni simulator/i).click();
    await p.waitForTimeout(1500);
    await snimi(p, `${s.ime}-simulator-ME`);
    await ctx.close();
  }
  {
    const { ctx, p } = await nova(s);
    await jezik(p, "ME");
    await dugme(p, /otvori igru/i).click();
    await p.waitForTimeout(2000);
    await snimi(p, `${s.ime}-igra-ME`);
    await ctx.close();
  }

  // ── Ostale rute ──────────────────────────────────────────────────────────
  for (const [ruta, ime] of [
    ["/kazne", "kazne"],
    ["/embed", "embed"],
  ]) {
    const ctx = await b.newContext({ viewport: { width: s.w, height: s.h } });
    const p = await ctx.newPage();
    await p.goto(OSNOVA + ruta, { waitUntil: "networkidle" });
    await sakrijDevAlate(p);
    await snimi(p, `${s.ime}-${ime}`);
    await ctx.close();
  }
}

await b.close();
console.log(prelivi.length ? `\nPrelivi:\n  ${prelivi.join("\n  ")}` : "\nBez vodoravnog preliva.");
