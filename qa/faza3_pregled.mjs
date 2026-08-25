// Faza 3.5 — „Pregled grešaka" u oba ekstrema: 0 promašaja i svi promašaji.
// Ordering pitanja se rješavaju upisom niza, pa se i ona odgovaraju.
import { chromium } from "playwright";
import fs from "node:fs";

const qs = JSON.parse(fs.readFileSync("C:/Users/Vuk/Desktop/MIRAV/public/questions.json", "utf8"));
const URL = "http://localhost:3000/";
const b = await chromium.launch();
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "PASS  " : "FAIL  ") + m); };

const nav = (p) => p.locator("section[aria-label]").filter({ has: p.locator("ol") }).last();

async function uIspit(p) {
  await p.goto(URL, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /POČNI ISPIT/i }).click();
  await p.waitForSelector("input[type=checkbox]");
  await p.locator("input[type=checkbox]").check();
  await p.locator("button:not([disabled])").filter({ hasText: /KRENI|POČNI|START/i }).last().click();
  await p.waitForSelector("[role=progressbar]");
}

/**
 * Vezuje prikazano pitanje za zapis u bazi po NASLOVU **i** opcijama.
 * Ni jedno ni drugo samo za sebe nije jedinstveno: 70 pitanja dijeli isti tekst,
 * a 13 dijeli isti skup opcija.
 */
function nadji(naslov, vidljive) {
  const kljuc = vidljive.join("|");
  const kand = qs.filter(
    (q) => q.options &&
      q.text.trim() === naslov.trim() &&
      ["a", "b", "c"].map((k) => q.options[k].trim()).join("|") === kljuc,
  );
  return kand.length === 1 ? kand[0] : null;
}

/**
 * Prolazi kroz svih 41 pitanje i odgovara. `kako` = "tacno" ili "netacno".
 * Vraća koliko je pitanja stvarno odgovoreno.
 */
async function popuni(p, kako) {
  const n = await nav(p).locator("ol button").count();
  let odgovoreno = 0;
  for (let i = 0; i < n; i++) {
    await nav(p).locator("ol button").nth(i).click();
    const unos = p.locator("main article input[inputmode=numeric]");
    if (await unos.count()) {
      // ordering: upiši tačan ili namjerno pogrešan niz
      const naslov = (await p.locator("main article h2").innerText()).trim();
      const q = qs.find((x) => x.type === "ordering" && x.text.trim() === naslov);
      const tacan = q ? q.answer_sequence.join("-") : "1-2-3-4";
      await unos.fill(kako === "tacno" ? tacan : "9-9-9-9");
      const potvrdi = p.locator("main article button").filter({ hasText: /PROVJERI|POTVRDI|UNESI|OK/i });
      if (await potvrdi.count()) await potvrdi.first().click().catch(() => {});
      else await unos.press("Enter").catch(() => {});
      odgovoreno++;
      continue;
    }
    const naslov = (await p.locator("main article h2").innerText()).trim();
    const vid = (await p.locator("main article > div > button").allInnerTexts())
      .map((s) => s.replace(/^[✕\s]+/, "").trim());
    if (vid.length !== 3) { console.log(`      preskoceno (${vid.length} opcija): ${naslov.slice(0, 50)}`); continue; }
    const q = nadji(naslov, vid);
    if (!q) { console.log(`      NIJE VEZANO: ${naslov.slice(0, 60)}`); continue; }
    const tacanIdx = ["a", "b", "c"].indexOf(q.correct);
    const idx = kako === "tacno" ? tacanIdx : (tacanIdx + 1) % 3;
    await p.locator("main article > div > button").nth(idx).click();
    odgovoreno++;
    await p.waitForTimeout(50);
  }
  return odgovoreno;
}

async function zavrsi(p) {
  await p.getByRole("button", { name: /ZAVRŠI ISPIT/i }).click();
  const pot = p.getByRole("button", { name: /DA|POTVRDI|ZAVRŠI/i }).last();
  if (await pot.isVisible().catch(() => false)) await pot.click();
  await p.waitForTimeout(800);
}

// ── SVI TAČNI ──────────────────────────────────────────────────────────────
{
  const p = await b.newPage();
  await uIspit(p);
  const n = await popuni(p, "tacno");
  await zavrsi(p);
  const t = await p.locator("main").innerText();
  const pct = t.match(/(\d+)%/)?.[1];
  const stavki = await p.locator("main section:last-of-type ol > li").count();
  console.log(`      odgovoreno ${n}/41 pitanja tačno → ${pct}%`);
  ok(pct === "100", `svi tačni daju 100% (dobijeno ${pct}%)`);
  ok(/POLOŽ|Polož/i.test(t), "ishod je POLOŽENO");
  ok(stavki === 0, `pregled grešaka je prazan kad nema promašaja (stavki: ${stavki})`);
  ok(/Sva pitanja su tacna|Sva pitanja su ta.na/i.test(t), "prikazuje se poruka umjesto praznog spiska");
  await p.close();
}

// ── SVI NETAČNI ────────────────────────────────────────────────────────────
{
  const p = await b.newPage();
  await uIspit(p);
  const n = await popuni(p, "netacno");
  await zavrsi(p);
  const t = await p.locator("main").innerText();
  const pct = t.match(/(\d+)%/)?.[1];
  const pregled = p.locator("main section").last();
  const stavki = await pregled.locator("ol > li").count();
  const saSlikom = await pregled.locator("ol > li img").count();
  const sVasOdgovor = (t.match(/VAŠ ODGOVOR/g) || []).length;
  const sTacno = (t.match(/TAČAN ODGOVOR|TAČNO/g) || []).length;
  console.log(`      odgovoreno ${n}/41 pitanja netačno → ${pct}%`);
  ok(pct === "0", `svi netačni daju 0% (dobijeno ${pct}%)`);
  ok(/PAO|Pao|NIJE POLOŽ/i.test(t), "ishod je PAD");
  ok(stavki === 41, `pregled lista SVIH 41 pitanje (listano: ${stavki})`);
  ok(saSlikom === 21, `svako pitanje sa slikom u pregledu ima sliku (${saSlikom} slika)`);
  ok(sVasOdgovor >= 40, `pregled pokazuje izabrani odgovor (${sVasOdgovor} puta)`);
  ok(sTacno >= 41, `pregled pokazuje tačan odgovor (${sTacno} puta)`);
  await p.close();
}

await b.close();
console.log(`\n${fail === 0 ? "SVE PROSLO" : `PALO: ${fail}`}  (${pass} provjera)`);
process.exit(fail ? 1 : 0);
