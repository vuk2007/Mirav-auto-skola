// Prijava greške u pravom pregledniku: vježba, ispit, rezultat, footer i iframe.
//
//   node qa/prijava.mjs <izlazni-folder> <osnova>
//
// Slanje ide na pravu rutu; bez GITHUB_PRIJAVE_TOKEN prijava završi u logu servera.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const IZLAZ = process.argv[2] ?? "qa/snimci-prijava";
const OSNOVA = process.argv[3] ?? "http://localhost:3100";
mkdirSync(IZLAZ, { recursive: true });

const b = await chromium.launch();
const greske = [];
const provjeri = (uslov, opis) => {
  console.log(`  ${uslov ? "ok " : "PAD"} ${opis}`);
  if (!uslov) greske.push(opis);
};

let kontekst = 0;

/** Svaki kontekst je druga adresa, da test ne udari u ograničenje broja prijava po IP-u. */
async function nova(sirina, sema = "dark") {
  const ctx = await b.newContext({
    colorScheme: sema,
    viewport: { width: sirina, height: 844 },
    extraHTTPHeaders: { "x-real-ip": `10.${process.pid % 250}.${Date.now() % 250}.${++kontekst}` },
  });
  const p = await ctx.newPage();
  p.on("dialog", (d) => d.accept());
  p.on("pageerror", (e) => greske.push(`greška na stranici: ${e.message}`));
  p.on("console", (m) => {
    const izvor = m.location().url;
    // Vercel analitika postoji samo na Vercelu; 429 izaziva sama provjera ograničenja.
    if (m.type() !== "error" || izvor.includes("/_vercel/")) return;
    if (m.text().includes("/_vercel/") || m.text().includes("429")) return;
    greske.push(`konzola: ${m.text()} (${izvor})`);
  });
  return { ctx, p };
}

async function preliv(p, ime) {
  const px = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  provjeri(px <= 1, `${ime}: bez vodoravnog preliva (${px}px)`);
}

/** Otvori prvu prijavu u `okvir`, pošalji opis, i vrati šta je otišlo na server. */
async function posalji(p, okvir, opis) {
  await okvir.locator("[data-qa=prijava]").first().click();
  const forma = okvir.locator("form[aria-label]").first();
  await forma.locator("textarea").fill(opis);
  const [zahtjev] = await Promise.all([
    p.waitForRequest("**/api/prijava"),
    forma.locator("button[type=submit]").click(),
  ]);
  await okvir.locator("[role=status]").first().waitFor({ timeout: 5000 });
  return zahtjev.postDataJSON();
}

for (const [sirina, sema] of [[390, "dark"], [1440, "light"]]) {
  console.log(`\n${sirina}px, ${sema}`);

  // ── Vježba ──────────────────────────────────────────────────────────────
  {
    const { ctx, p } = await nova(sirina, sema);
    await p.goto(OSNOVA + "/", { waitUntil: "networkidle" });
    await p.getByRole("button", { name: /počni vježbu/i }).first().click();
    await p.waitForSelector("[role=progressbar]");

    const kartica = p.locator("main article").first();
    await kartica.locator("[data-qa=prijava]").click();
    provjeri(
      await p.evaluate(() => document.activeElement?.tagName === "SELECT"),
      "fokus ide na prvo polje",
    );
    await kartica.locator("button[type=submit]").click();
    provjeri(await kartica.locator("[role=alert]").isVisible(), "prazan opis: poruka, bez slanja");
    provjeri(
      await p.evaluate(() => document.activeElement?.tagName === "TEXTAREA"),
      "prazan opis: fokus na opisu",
    );
    await p.screenshot({ path: `${IZLAZ}/${sirina}-vjezba-forma.png`, fullPage: true });
    await preliv(p, "vježba, forma");

    await p.keyboard.press("Escape");
    provjeri((await kartica.locator("form").count()) === 0, "Escape zatvara formu");

    const telo = await posalji(p, kartica, "QA: probna prijava iz vježbe.");
    provjeri(Number.isInteger(telo.pitanjeId) && telo.rezim === "vjezba", "vježba: šalje pitanje i režim");
    provjeri(Boolean(telo.pitanjeTekst), "vježba: šalje tekst pitanja");
    provjeri(!telo.adresaSajta, "skriveno polje ostaje prazno");
    await p.screenshot({ path: `${IZLAZ}/${sirina}-vjezba-poslato.png`, fullPage: true });
    await ctx.close();
  }

  // ── Ispit i rezultat ────────────────────────────────────────────────────
  {
    const { ctx, p } = await nova(sirina, sema);
    await p.goto(OSNOVA + "/", { waitUntil: "networkidle" });
    await p.getByRole("button", { name: /počni ispit/i }).first().click();
    await p.waitForSelector("input[type=checkbox]");
    await p.locator("input[type=checkbox]").check();
    await p.locator("main button:not([disabled])").last().click();
    await p.waitForSelector("[role=progressbar]");

    const pitanje = p.locator("section[id^=ispitno-pitanje-]").first();
    await pitanje.locator("input[type=radio]").first().check({ force: true });
    const telo = await posalji(p, pitanje, "QA: probna prijava sa ispita.");
    provjeri(telo.rezim === "ispit", "ispit: režim je ispit");
    provjeri(
      (await p.locator("input[type=radio]:checked").count()) === 1,
      "ispit: odgovor ostaje izabran poslije prijave",
    );
    await p.screenshot({ path: `${IZLAZ}/${sirina}-ispit-poslato.png`, fullPage: true });
    await preliv(p, "ispit");

    await p.getByRole("button", { name: /završi ispit/i }).click();
    await p.waitForTimeout(600);
    const potvrda = p.getByRole("alertdialog");
    if (await potvrda.count()) await potvrda.locator("button").last().click();
    await p.getByRole("heading", { level: 3 }).first().waitFor();
    const stavka = p.locator("main ol > li:has([data-qa=prijava])").first();
    const izRezultata = await posalji(p, stavka, "QA: probna prijava iz rezultata.");
    provjeri(izRezultata.rezim === "rezultat", "rezultat: režim je rezultat");
    await preliv(p, "rezultat");
    await ctx.close();
  }

  // ── Footer ──────────────────────────────────────────────────────────────
  {
    const { ctx, p } = await nova(sirina, sema);
    await p.goto(OSNOVA + "/", { waitUntil: "networkidle" });
    const footer = p.locator("footer");
    const telo = await posalji(p, footer, "QA: probna prijava za sajt.");
    provjeri(telo.pitanjeId === undefined && telo.vrsta === "sajt", "footer: prijava za sajt, bez pitanja");
    await p.screenshot({ path: `${IZLAZ}/${sirina}-footer-poslato.png`, fullPage: true });
    await preliv(p, "footer");
    await ctx.close();
  }

  // ── Ugrađena verzija u pravom iframe-u ──────────────────────────────────
  {
    const { ctx, p } = await nova(sirina, sema);
    // Roditelj na istoj adresi: CSP dozvoljava 'self', a Chromium spoljnom sajtu ne da do localhost-a.
    await p.route(`${OSNOVA}/__roditelj`, (r) =>
      r.fulfill({
        contentType: "text/html",
        body: `<!doctype html><iframe id=f src="${OSNOVA}/embed" style="width:100%;height:600px;border:0"></iframe>
          <script>addEventListener("message",e=>{if(e.data?.type==="mirav-quiz-height")f.style.height=e.data.height+"px"})</script>`,
      }),
    );
    await p.goto(`${OSNOVA}/__roditelj`, { waitUntil: "load" });
    const okvir = p.frameLocator("#f");
    await okvir.locator("[data-qa=prijava]").first().waitFor();
    const visinaPrije = await p.locator("#f").evaluate((f) => f.offsetHeight);
    const telo = await posalji(p, okvir.locator("main"), "QA: probna prijava iz iframe-a.");
    provjeri(telo.stranica.startsWith("/embed"), "iframe: stranica je /embed");
    await p.waitForTimeout(300);
    const visinaPoslije = await p.locator("#f").evaluate((f) => f.offsetHeight);
    provjeri(visinaPoslije !== visinaPrije, `iframe: visina prati formu (${visinaPrije} → ${visinaPoslije})`);
    await p.screenshot({ path: `${IZLAZ}/${sirina}-iframe-poslato.png`, fullPage: true });
    await ctx.close();
  }
}

// ── Previše prijava: korisnik vidi poruku, a uneseni tekst ostaje ──────────
{
  console.log("\nograničenje");
  const { ctx, p } = await nova(390);
  await p.goto(OSNOVA + "/", { waitUntil: "networkidle" });
  for (let i = 0; i < 10; i++) {
    await p.request.post(OSNOVA + "/api/prijava", { data: { vrsta: "sajt", opis: `QA: punjenje ${i}` } });
  }
  const footer = p.locator("footer");
  await footer.locator("[data-qa=prijava]").click();
  await footer.locator("textarea").fill("QA: jedanaesta prijava.");
  await footer.locator("button[type=submit]").click();
  await footer.locator("[role=alert]").waitFor({ timeout: 5000 });
  provjeri((await footer.locator("[role=alert]").innerText()).includes("previše"), "11. prijava: poruka o previše prijava");
  provjeri((await footer.locator("textarea").inputValue()) === "QA: jedanaesta prijava.", "11. prijava: tekst nije izgubljen");
  await ctx.close();
}

await b.close();
console.log(greske.length ? `\nGREŠKE:\n  ${greske.join("\n  ")}` : "\nSve prošlo.");
process.exit(greske.length ? 1 : 0);
