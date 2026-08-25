// Faza 4.2 — isti tok u tri motora. WebKit je motor Safarija (i iOS-a), Firefox je Gecko.
// Hvata se SVAKA poruka iz konzole, ne samo greške.
import { chromium, firefox, webkit } from "playwright";

const URL = "http://localhost:3000/";
const MOTORI = [
  { ime: "WebKit (Safari / iOS)", pokreni: webkit, viewport: { width: 390, height: 844 } },
  { ime: "Chromium (Chrome Android)", pokreni: chromium, viewport: { width: 412, height: 915 } },
  { ime: "Chromium (Chrome desktop)", pokreni: chromium, viewport: { width: 1440, height: 900 } },
  { ime: "Firefox (desktop)", pokreni: firefox, viewport: { width: 1440, height: 900 } },
];

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "PASS  " : "FAIL  ") + m); };
const nav = (p) => p.locator("section[aria-label]").filter({ has: p.locator("ol") }).last();

for (const motor of MOTORI) {
  console.log("\n" + "=".repeat(78) + `\n${motor.ime}\n` + "=".repeat(78));
  const b = await motor.pokreni.launch();
  const p = await b.newPage({ viewport: motor.viewport });

  const poruke = [];
  const greske = [];
  const losiZahtjevi = [];
  p.on("console", (m) => {
    // Vercel Analytics lokalno traži /_vercel/insights/script.js kojeg nema — očekivano
    // i dokumentovano. Poruka o 404 ne sadrži URL u tekstu, nego u `location()`,
    // pa filtriranje po tekstu ne radi (na tome mi je prva verzija testa pala).
    const url = m.location()?.url ?? "";
    if (url.includes("_vercel/insights") || m.text().includes("_vercel/insights")) return;
    if (["error", "warning"].includes(m.type())) {
      poruke.push(`${m.type()}: ${m.text().slice(0, 100)} @ ${url.slice(-50)}`);
    }
  });
  p.on("pageerror", (e) => greske.push(String(e).slice(0, 160)));
  p.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("_vercel/insights")) {
      losiZahtjevi.push(`${r.status()} ${r.url().slice(-60)}`);
    }
  });

  // ── cio tok: landing → vježba → ispit → rezultat ─────────────────────────
  await p.goto(URL, { waitUntil: "networkidle" });
  ok(await p.getByRole("button", { name: /POČNI VJEŽBU/i }).isVisible(), "landing se učitava");

  await p.getByRole("button", { name: /POČNI VJEŽBU/i }).click();
  await p.waitForSelector("main article", { timeout: 20000 });
  // Vježba kreće na nasumičnom pitanju. Ako je to `ordering`, ono nema dugmad
  // nego polje za unos — preskoči do prvog pitanja sa ponuđenim odgovorima.
  for (let i = 0; i < 6; i++) {
    if (await p.locator("main article > div > button").count()) break;
    await p.locator("main article input[inputmode=numeric]").fill("1-2-3-4").catch(() => {});
    await p.getByRole("button", { name: /SLJEDEĆE/i }).click().catch(() => {});
    await p.waitForTimeout(250);
  }
  await p.locator("main article > div > button").first().click();
  await p.waitForTimeout(300);
  ok(/Tačan odgovor|Netačan odgovor/i.test(await p.locator("main").innerText()),
     "vježba: odgovor se bilježi i prikazuje se povratna informacija");

  await p.goto(URL, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /POČNI ISPIT/i }).click();
  await p.waitForSelector("input[type=checkbox]", { timeout: 20000 });
  await p.locator("input[type=checkbox]").check();
  await p.locator("button:not([disabled])").filter({ hasText: /KRENI|POČNI|START/i }).last().click();
  await p.waitForSelector("[role=progressbar]", { timeout: 20000 });
  ok((await nav(p).locator("ol button").count()) === 41, "ispit: 41 pitanje u navigaciji");

  // tajmer stvarno otkucava (bez page.clock — provjerava se realno vrijeme)
  const t1 = (await p.locator("main").innerText()).match(/\d{2}:\d{2}/)?.[0];
  await p.waitForTimeout(2200);
  const t2 = (await p.locator("main").innerText()).match(/\d{2}:\d{2}/)?.[0];
  ok(t1 && t2 && t1 !== t2, `tajmer otkucava (${t1} → ${t2})`);

  for (let i = 0; i < 6; i++) {
    await nav(p).locator("ol button").nth(i).click();
    await p.locator("main article > div > button").first().click().catch(() => {});
    await p.waitForTimeout(90);
  }
  await p.getByRole("button", { name: /ZAVRŠI ISPIT/i }).click();
  const pot = p.getByRole("button", { name: /DA|POTVRDI|ZAVRŠI/i }).last();
  if (await pot.isVisible().catch(() => false)) await pot.click();
  await p.waitForTimeout(900);
  ok(/%/.test(await p.locator("main").innerText()), "rezultat se prikazuje");

  // Slike se stvarno iscrtavaju (naturalWidth > 0), ne samo da postoji <img>.
  // Sve su `loading="lazy"`, pa se mora doskrolovati — inače su ispod pregiba
  // i naturalWidth je 0, što nije greška aplikacije nego testa.
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
  });
  await p.waitForTimeout(1200);
  const slike = await p.evaluate(() =>
    [...document.querySelectorAll("main img")].map((im) => ({ w: im.naturalWidth, src: im.src.slice(-24) })));
  const neiscrtane = slike.filter((s) => s.w === 0);
  ok(neiscrtane.length === 0,
     `sve slike u pregledu su se iscrtale (${slike.length} slika)` +
     (neiscrtane.length ? `, neiscrtanih ${neiscrtane.length}: ${neiscrtane[0].src}` : ""));

  ok(greske.length === 0, "nula JS grešaka" + (greske.length ? `: ${greske[0]}` : ""));
  ok(poruke.length === 0, "nula error/warning poruka u konzoli" +
     (poruke.length ? `: ${poruke.slice(0, 3).join(" | ")}` : ""));
  ok(losiZahtjevi.length === 0, "nula neuspjelih zahtjeva" +
     (losiZahtjevi.length ? `: ${losiZahtjevi[0]}` : ""));

  await b.close();
}

console.log(`\n${fail === 0 ? "SVE PROSLO" : `PALO: ${fail}`}  (${pass} provjera)`);
process.exit(fail ? 1 : 0);
