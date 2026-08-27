// Korak 4 — prikaz kazni polaznicima.
//
//   NEXT_PUBLIC_KAZNE_ENABLED=true npx next start -p 3000
//   node qa/kazne_prikaz.mjs
//
// Traži se pitanje koje ima POTVRĐENU kaznu i provjerava se gdje se prikazuje,
// a gdje ne smije.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const biblioteka = JSON.parse(fs.readFileSync("data/kazne.json", "utf8"));
const veza = JSON.parse(fs.readFileSync("data/pitanje-kazna.json", "utf8"));
const qs = JSON.parse(fs.readFileSync("public/questions.json", "utf8"));

const potvrdjene = new Map(
  biblioteka.kazne.filter((k) => k.status === "potvrdjeno").map((k) => [k.id, k]),
);
const saKaznom = Object.entries(veza)
  .filter(([, v]) => v.pregledano && v.kazna_id && potvrdjene.has(v.kazna_id))
  .map(([pid, v]) => ({ q: qs.find((x) => String(x.id) === pid), kazna: potvrdjene.get(v.kazna_id) }))
  .filter((x) => x.q && x.q.options);

const nepotvrdjena = biblioteka.kazne.find((k) => k.status === "nepotvrdjeno");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? "PASS  " : "FAIL  ") + m); };
const info = (m) => console.log("      " + m);

if (saKaznom.length === 0) {
  console.log("Nema nijednog pitanja sa potvrđenom kaznom — nema šta da se provjeri.");
  process.exit(0);
}
const primjer = saKaznom[0];
info(`primjer: pitanje ${primjer.q.id} → „${primjer.kazna.naslov}"`);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const mreza = [];
p.on("response", (r) => { if (r.url().endsWith(".js") || r.url().endsWith(".json")) mreza.push(r.url()); });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));

/** Nađe traženo pitanje u vježbi i odgovori namjerno netačno. */
async function uVjezbiOdgovoriNetacno(q) {
  await p.goto(BASE, { waitUntil: "networkidle" });

  // Suzi vježbu na kategoriju traženog pitanja. Bez toga obilazak zapne na
  // prvom `ordering` pitanju — ono nema ponuđene odgovore, pa „Sljedeće" ostaje
  // zaključano i petlja stane prije nego što stigne do cilja.
  const filter = q.kind === "teorija" ? "Tekstualna" : q.kind === "znak" ? "Znaci" : "Raskrsnice";
  await p.getByRole("button", { name: filter, exact: true }).click();

  await p.getByRole("button", { name: /POČNI VJEŽBU/i }).click();
  await p.waitForSelector("main article");
  const cilj = ["a", "b", "c"].map((k) => q.options[k].trim()).join("|");
  for (let i = 0; i < 440; i++) {
    const vid = (await p.locator("main article > div > button").allInnerTexts())
      .map((s) => s.replace(/^[✕\s]+/, "").trim());
    if (vid.length === 3 && vid.join("|") === cilj) {
      const tacan = ["a", "b", "c"].indexOf(q.correct);
      await p.locator("main article > div > button").nth((tacan + 1) % 3).click();
      await p.waitForTimeout(400);
      return true;
    }
    if (vid.length === 3) await p.locator("main article > div > button").first().click();
    else await p.locator("main article input[inputmode=numeric]").fill("9").catch(() => {});
    const dalje = p.getByRole("button", { name: /SLJEDEĆE/i });
    if (!(await dalje.isEnabled().catch(() => false))) break;
    await dalje.click();
    await p.waitForTimeout(60);
  }
  return false;
}

// ── 4.1 vježba: kazna se prikazuje poslije odgovora ────────────────────────
{
  const nasao = await uVjezbiOdgovoriNetacno(primjer.q);
  ok(nasao, `pitanje ${primjer.q.id} nađeno u vježbi`);
  const tekst = await p.locator("main").innerText();
  ok(tekst.includes(primjer.kazna.naslov), `vježba prikazuje kaznu: „${primjer.kazna.naslov}"`);
  ok(tekst.includes(primjer.kazna.clan), `prikazan je i član: ${primjer.kazna.clan}`);
  if (primjer.kazna.objasnjenje) {
    ok(tekst.includes(primjer.kazna.objasnjenje.slice(0, 30)), "prikazano je objašnjenje");
  }
}

// ── 4.1 nepotvrđena kazna se ne vidi NIGDJE, ni u mrežnom odgovoru ─────────
if (nepotvrdjena) {
  const naStrani = (await p.locator("body").innerText()).includes(nepotvrdjena.naslov);
  ok(!naStrani, `nepotvrđena kazna „${nepotvrdjena.naslov}" nije na ekranu`);

  let uMrezi = null;
  for (const url of [...new Set(mreza)]) {
    const t = await (await fetch(url)).text();
    if (t.includes(nepotvrdjena.naslov)) { uMrezi = url.split("/").pop(); break; }
  }
  ok(uMrezi === null,
     `nepotvrđena kazna nije ni u jednom od ${new Set(mreza).size} preuzetih fajlova` +
     (uMrezi ? ` — nađena u ${uMrezi}` : ""));
}

// ── 4.1 tokom SIMULACIJE ispita kazna se NE prikazuje ──────────────────────
{
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /POČNI ISPIT/i }).click();
  await p.waitForSelector("input[type=checkbox]");
  await p.locator("input[type=checkbox]").check();
  await p.locator("button:not([disabled])").filter({ hasText: /KRENI|POČNI|START/i }).last().click();
  await p.waitForSelector("[role=progressbar]");
  const nav = p.locator("section[aria-label]").filter({ has: p.locator("ol") }).last();
  let procurilo = 0;
  const n = await nav.locator("ol button").count();
  for (let i = 0; i < n; i++) {
    await nav.locator("ol button").nth(i).click();
    await p.locator("main article > div > button").first().click().catch(() => {});
    await p.waitForTimeout(60);
    const t = await p.locator("main article").innerText();
    if (/KOLIKO BI OVO KOŠTALO|Kazna za ovaj prekršaj/i.test(t)) procurilo++;
  }
  ok(procurilo === 0, `tokom simulacije kazna se ne prikazuje ni na jednom od ${n} pitanja`);

  // ── 4.1 pregled grešaka: tu se prikazuje ────────────────────────────────
  await p.getByRole("button", { name: /ZAVRŠI ISPIT/i }).click();
  const pot = p.getByRole("button", { name: /DA|POTVRDI|ZAVRŠI/i }).last();
  if (await pot.isVisible().catch(() => false)) await pot.click();
  await p.waitForTimeout(900);
  // U pregledu je okvir SKLOPLJEN — vidi se naslov okvira i iznos, ne naziv
  // kazne. Zato se traži zaglavlje, pa se okvir otvori i provjeri sadržaj.
  const zaglavlja = p.locator("main aside button");
  const koliko = await zaglavlja.count();
  ok(koliko > 0, `u pregledu grešaka ima ${koliko} kazni (sklopljene)`);
  if (koliko > 0) {
    const prijeOtvaranja = await p.locator("main aside").first().innerText();
    await zaglavlja.first().click();
    await p.waitForTimeout(200);
    const poslije = await p.locator("main aside").first().innerText();
    ok(poslije.length > prijeOtvaranja.length, "klik na okvir ga otvara i prikazuje detalje");
    const nasao = [...potvrdjene.values()].some((k) => poslije.includes(k.naslov));
    ok(nasao, `otvoren okvir prikazuje naziv kazne`);
    const imaClan = [...potvrdjene.values()].some((k) => poslije.includes(k.clan));
    ok(imaClan, "otvoren okvir prikazuje član zakona");
  }
}

// ── 4.2 spisak kazni ───────────────────────────────────────────────────────
{
  const r = await p.goto(`${BASE}/kazne`, { waitUntil: "networkidle" });
  ok(r.status() === 200, `/kazne vraća ${r.status()}`);
  const t = await p.locator("main").innerText();
  ok(t.includes(primjer.kazna.naslov), "spisak sadrži potvrđenu kaznu");
  ok(!nepotvrdjena || !t.includes(nepotvrdjena.naslov), "spisak NE sadrži nepotvrđene kazne");
  ok(t.toLowerCase().includes(primjer.kazna.kategorija.toLowerCase()),
     `kazne su grupisane po kategoriji (${primjer.kazna.kategorija}) — naslov je verzalom u CSS-u`);
  ok(/Posljednja provjera/i.test(t), "u dnu piše datum posljednje provjere");
  ok(/informativn/i.test(t), "u dnu stoji napomena da su iznosi informativni");

  await p.locator("#trazi-kaznu").fill("qqqq-nema-ovoga");
  await p.waitForTimeout(200);
  ok(/Nema kazne koja odgovara/i.test(await p.locator("main").innerText()), "pretraga radi");
}

ok(errs.length === 0, "bez JS grešaka" + (errs.length ? `: ${errs[0]}` : ""));
await b.close();
console.log(`\n${fail === 0 ? "SVE PROSLO" : `PALO: ${fail}`}  (${pass} provjera)`);
process.exit(fail ? 1 : 0);
