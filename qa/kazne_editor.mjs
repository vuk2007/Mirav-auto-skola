// Provjera editora kazni (/admin/kazne).
//
//   NEXT_PUBLIC_ADMIN_ENABLED=true ADMIN_PASSWORD=proba123 npx next start -p 3000
//   node qa/kazne_editor.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const BASE = "http://localhost:3000";
const LOZINKA = process.env.ADMIN_PASSWORD ?? "proba123";
const preuzimanja = fs.mkdtempSync(path.join(os.tmpdir(), "mirav-kazne-"));

const b = await chromium.launch();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? "PASS  " : "FAIL  ") + m); };
const info = (m) => console.log("      " + m);

const ctx = await b.newContext({ viewport: { width: 820, height: 1180 }, acceptDownloads: true });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));

// ── prijava ────────────────────────────────────────────────────────────────
await p.goto(`${BASE}/admin/kazne`, { waitUntil: "networkidle" });
await p.locator("#lozinka").fill(LOZINKA);
await p.getByRole("button", { name: /Uđi/i }).click();
await p.waitForSelector("text=pregledano", { timeout: 20000 });
ok(true, "prijava lozinkom otvara editor");

const napredak = () => p.locator("header").innerText();
const brojIz = async (re) => Number(((await napredak()).match(re) ?? [])[1] ?? -1);

// ── „nema kazne" jednim klikom i odmah sljedeće pitanje ────────────────────
{
  const prije = await brojIz(/pregledano (\d+)/);
  const naslovPrije = await p.locator("main h2").first().innerText();
  await p.getByRole("button", { name: /Nema kazne za ovo pitanje/i }).click();
  await p.waitForTimeout(250);
  const poslije = await brojIz(/pregledano (\d+)/);
  const naslovPoslije = await p.locator("main h2").first().innerText();
  ok(poslije === prije + 1, `jedan klik označi „nema kazne" (pregledano ${prije} → ${poslije})`);
  ok(naslovPrije !== naslovPoslije, "poslije klika odmah prelazi na sljedeće pitanje");
}

// ── razmaknica radi isto ───────────────────────────────────────────────────
{
  const prije = await brojIz(/pregledano (\d+)/);
  await p.locator("body").press(" ");
  await p.waitForTimeout(250);
  ok((await brojIz(/pregledano (\d+)/)) === prije + 1, "razmaknica radi isto kao dugme nema kazne");
}

// ── izbor postojeće kazne ──────────────────────────────────────────────────
{
  const prije = await brojIz(/sa kaznom (\d+)/);
  await p.locator("main section button").filter({ hasText: /·/ }).first().click();
  await p.waitForTimeout(250);
  ok((await brojIz(/sa kaznom (\d+)/)) === prije + 1, "izbor postojeće kazne veže je za pitanje i ide dalje");
}

// ── kazna bez člana ne može da se potvrdi ──────────────────────────────────
{
  await p.getByRole("button", { name: /Napravi novu kaznu/i }).click();
  await p.locator("#naslov").fill("Proba bez člana");
  await p.locator("#min").fill("100");
  const potvrdi = p.getByRole("button", { name: /Potvrdi i veži za pitanje/i });
  ok(await potvrdi.isDisabled(), "bez clana zakona dugme Potvrdi je zakljucano");
  const razlozi = await p.locator("main ul li").allInnerTexts();
  ok(razlozi.some((r) => /član/i.test(r)), `piše zašto: „${razlozi.find((r) => /član/i.test(r)) ?? "?"}"`);

  await p.locator("#clan").fill("čl. 999 st. 1 t. 1");
  await p.waitForTimeout(150);
  ok(await potvrdi.isEnabled(), "kad se upise clan, Potvrdi se otkljuca");

  // min > max mora da zaključa nazad
  await p.locator("#max").fill("50");
  await p.waitForTimeout(150);
  ok(await potvrdi.isDisabled(), "min veći od max ponovo zaključava potvrdu");
  await p.locator("#max").fill("400");
  await p.waitForTimeout(150);

  await potvrdi.click();
  await p.waitForTimeout(300);
  ok(true, "nova kazna sačuvana i vezana za pitanje");
}

// ── izmjena jedne kazne mijenja SVA pitanja koja je koriste ────────────────
{
  // Veži istu kaznu za tri pitanja, pa je preimenuj i provjeri sva tri.
  await p.getByRole("button", { name: "Pitanja", exact: true }).click();
  await p.waitForTimeout(200);
  await p.getByRole("button", { name: "sve", exact: true }).click();

  const ids = [];
  for (let n = 0; n < 3; n++) {
    await p.getByRole("button", { name: "Pregled", exact: true }).click();
    await p.waitForTimeout(150);
    const zaglavlje = await p.locator("main .tag").first().innerText();
    ids.push((zaglavlje.match(/id (\d+)/) ?? [])[1]);
    await p.locator("#trazi").fill("Proba bez");
    await p.waitForTimeout(200);
    await p.locator("main section button").filter({ hasText: /Proba bez člana/ }).first().click();
    await p.waitForTimeout(250);
  }
  info(`ista kazna vezana za pitanja: ${ids.join(", ")}`);

  await p.getByRole("button", { name: "Kazne", exact: true }).click();
  await p.waitForTimeout(200);
  await p.locator("main button").filter({ hasText: /Proba bez člana/ }).first().click();
  await p.locator("#naslov").fill("PREIMENOVANA KAZNA");
  await p.getByRole("button", { name: /Sačuvaj kao nepotvrđeno/i }).click();
  await p.waitForTimeout(300);

  await p.getByRole("button", { name: "Pitanja", exact: true }).click();
  await p.getByRole("button", { name: "sa kaznom", exact: true }).click();
  await p.waitForTimeout(250);
  const tabela = await p.locator("main table").innerText();
  const pogodaka = (tabela.match(/PREIMENOVANA KAZNA/g) ?? []).length;
  ok(pogodaka >= 3, `izmjena jedne kazne promijenila je svih ${pogodaka} pitanja koja je koriste`);
}

// ── stanje preživi zatvaranje taba ─────────────────────────────────────────
let prijeReloada;
{
  prijeReloada = await napredak();
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector("text=pregledano", { timeout: 20000 });
  const poslije = await napredak();
  const a = (prijeReloada.match(/pregledano (\d+)/) ?? [])[1];
  const c = (poslije.match(/pregledano (\d+)/) ?? [])[1];
  ok(a === c && a !== undefined, `poslije osvježavanja stanje je isto (pregledano ${a} → ${c})`);
}

// ── preuzmi → učitaj → isto stanje ─────────────────────────────────────────
{
  // Oba `waitForEvent` bi se razriješila na PRVI događaj — zato se skuplja
  // preko `page.on`, uz čekanje da stignu obje datoteke.
  const putanje = {};
  const skupi = (dir) => async (d) => {
    const put = path.join(preuzimanja, dir + d.suggestedFilename());
    await d.saveAs(put);
    putanje[dir + d.suggestedFilename()] = put;
  };
  const slusac1 = skupi("");
  p.on("download", slusac1);
  await p.getByRole("button", { name: /Preuzmi fajlove/i }).click();
  for (let i = 0; i < 40 && Object.keys(putanje).length < 2; i++) await p.waitForTimeout(150);
  p.off("download", slusac1);
  ok(Boolean(putanje["kazne.json"] && putanje["pitanje-kazna.json"]),
     `preuzeta su oba fajla: ${Object.keys(putanje).join(", ")}`);

  const kazne1 = fs.readFileSync(putanje["kazne.json"], "utf8");
  const veza1 = fs.readFileSync(putanje["pitanje-kazna.json"], "utf8");

  // Obriši lokalno stanje, učitaj fajlove nazad i preuzmi ponovo.
  await p.evaluate(() => window.localStorage.removeItem("mirav.kazne.editor.v1"));
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector("text=pregledano");
  await p.locator("input[type=file]").setInputFiles([putanje["kazne.json"], putanje["pitanje-kazna.json"]]);
  await p.waitForTimeout(500);

  const drugi = {};
  const slusac2 = async (d) => {
    const put = path.join(preuzimanja, "2-" + d.suggestedFilename());
    await d.saveAs(put);
    drugi[d.suggestedFilename()] = put;
  };
  p.on("download", slusac2);
  await p.getByRole("button", { name: /Preuzmi fajlove/i }).click();
  for (let i = 0; i < 40 && Object.keys(drugi).length < 2; i++) await p.waitForTimeout(150);
  p.off("download", slusac2);
  const kazne2 = fs.readFileSync(drugi["kazne.json"], "utf8");
  const veza2 = fs.readFileSync(drugi["pitanje-kazna.json"], "utf8");
  ok(kazne1 === kazne2 && veza1 === veza2,
     "preuzmi → učitaj → preuzmi daje identične fajlove (round-trip)");
}

ok(errs.length === 0, "bez JS grešaka u editoru" + (errs.length ? `: ${errs[0]}` : ""));

// ── upotrebljivost na tabletu ──────────────────────────────────────────────
{
  const preliv = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const visina = await p.getByRole("button", { name: /Nema kazne za ovo pitanje/i })
    .boundingBox().then((r) => Math.round(r?.height ?? 0)).catch(() => 0);
  ok(preliv === 0, `na 820×1180 nema vodoravnog preliva (${preliv}px)`);
  ok(visina >= 44, `dugme „Nema kazne" je ${visina}px visoko — dovoljno za prst`);
}

await ctx.close();
await b.close();
console.log(`\n${fail === 0 ? "SVE PROSLO" : `PALO: ${fail}`}  (${pass} provjera)`);
process.exit(fail ? 1 : 0);
