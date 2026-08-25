// Faza 4.1 — ponašanje na četiri rezolucije, u sva tri ekrana (vježba, ispit, rezultat).
//
//   node qa/faza4_rezolucije.mjs
//
// Provjerava mjerljive stvari, ne „izgleda dobro": vodoravni preliv, slika izvan okvira,
// odsječen tekst (scrollHeight > clientHeight), visina dugmadi, tačnost brojača.
import { chromium } from "playwright";

const URL = "http://localhost:3000/";
const REZOLUCIJE = [
  { w: 360, h: 640, ime: "360x640 mali Android" },
  { w: 390, h: 844, ime: "390x844 iPhone" },
  { w: 820, h: 1180, ime: "820x1180 iPad" },
  { w: 1440, h: 900, ime: "1440x900 desktop" },
];
const MIN_DODIR = 44; // preporuka za visinu dodirne mete

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

/** Mjeri sve što se može izmjeriti umjesto gledati. */
async function izmjeri(p) {
  return p.evaluate(({ MIN }) => {
    const doc = document.documentElement;
    const preliv = doc.scrollWidth - doc.clientWidth;

    // element koji viri izvan širine prozora
    const viri = [];
    for (const el of document.querySelectorAll("main *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      if (r.right > doc.clientWidth + 1 || r.left < -1) {
        viri.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().slice(0, 30)} ` +
                  `[${Math.round(r.left)}..${Math.round(r.right)}]`);
      }
    }

    // slika šira od svog okvira
    const slike = [...document.querySelectorAll("main img")].map((im) => {
      const r = im.getBoundingClientRect();
      const okvir = im.parentElement.getBoundingClientRect();
      return { preko: r.width > okvir.width + 1, w: Math.round(r.width), okvir: Math.round(okvir.width) };
    });

    // odsječen tekst: sadržaj viši od kutije bez mogućnosti skrola
    const odsjeceno = [];
    for (const el of document.querySelectorAll("main p, main li, main h1, main h2, main button span")) {
      const st = getComputedStyle(el);
      if (st.overflow === "hidden" && el.scrollHeight > el.clientHeight + 1) {
        odsjeceno.push(el.textContent.trim().slice(0, 40));
      }
    }

    // Dodirne mete. Odgovori i glavna navigacija su jedno, sporedne kontrole
    // (jezik, „Literatura", „Nazad") drugo — mjere se odvojeno da se ne pomiješa
    // ono što kandidat stalno dodiruje sa onim što dodirne jednom.
    const dugmad = [...document.querySelectorAll("main button")].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        t: el.textContent.trim().slice(0, 24),
        h: Math.round(r.height),
        w: Math.round(r.width),
        // odgovor = dugme unutar kartice pitanja; navigacija = mreža brojeva
        // Mreža brojeva pitanja je GLAVNA kontrola — kandidat njome skače kroz
        // test cijelo vrijeme. Sporedno je samo ono što se dodirne jednom.
        glavno: Boolean(el.closest("article")) || Boolean(el.closest("ol")) ||
                /ZAVRŠI|SLJEDEĆE|PRETHODNO|POČNI|KRENI/i.test(el.textContent),
      };
    }).filter((x) => x.h > 0);

    return {
      preliv, viri: viri.slice(0, 5), slike, odsjeceno,
      malaGlavna: dugmad.filter((x) => x.glavno && x.h < MIN),
      malaSporedna: dugmad.filter((x) => !x.glavno && x.h < MIN),
    };
  }, { MIN: MIN_DODIR });
}

for (const r of REZOLUCIJE) {
  console.log("\n" + "=".repeat(78) + `\n${r.ime}\n` + "=".repeat(78));
  const p = await b.newPage({ viewport: { width: r.w, height: r.h } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));

  // ── ekran 1: landing ─────────────────────────────────────────────────────
  await p.goto(URL, { waitUntil: "networkidle" });
  let m = await izmjeri(p);
  ok(m.preliv === 0, `landing: bez vodoravnog preliva (${m.preliv}px)`);
  ok(m.viri.length === 0, `landing: nijedan element ne viri` + (m.viri.length ? `: ${m.viri[0]}` : ""));

  // ── ekran 2: ispit ───────────────────────────────────────────────────────
  await uIspit(p);
  // nađi pitanje sa slikom i pitanje sa najdužom opcijom
  let saSlikom = -1, najduza = { i: -1, n: 0 };
  const n = await nav(p).locator("ol button").count();
  for (let i = 0; i < n; i++) {
    await nav(p).locator("ol button").nth(i).click();
    if (saSlikom < 0 && (await p.locator("main article img").count())) saSlikom = i;
    const t = (await p.locator("main article > div > button").allInnerTexts()).join("");
    if (t.length > najduza.n) najduza = { i, n: t.length };
  }

  await nav(p).locator("ol button").nth(saSlikom >= 0 ? saSlikom : 0).click();
  m = await izmjeri(p);
  ok(m.preliv === 0, `ispit (pitanje sa slikom): bez preliva (${m.preliv}px)`);
  ok(m.slike.every((s) => !s.preko),
     `slika ne prelazi svoj okvir (${m.slike.map((s) => `${s.w}/${s.okvir}`).join(", ")})`);

  await nav(p).locator("ol button").nth(najduza.i).click();
  m = await izmjeri(p);
  ok(m.odsjeceno.length === 0,
     `najduža opcija (${najduza.n} znakova) se prelama, ne siječe` +
     (m.odsjeceno.length ? `: „${m.odsjeceno[0]}"` : ""));
  ok(m.preliv === 0, `ispit (najduža opcija): bez preliva (${m.preliv}px)`);
  ok(m.malaGlavna.length === 0,
     `odgovori i glavna dugmad su bar ${MIN_DODIR}px visoki` +
     (m.malaGlavna.length ? `: ${m.malaGlavna.slice(0, 3).map((x) => `„${x.t}" ${x.h}x${x.w}px`).join(", ")}` : ""));
  ok(m.malaSporedna.length === 0,
     `sporedne kontrole su bar ${MIN_DODIR}px visoke` +
     (m.malaSporedna.length ? `: ${m.malaSporedna.map((x) => `„${x.t}" ${x.h}x${x.w}px`).join(", ")}` : ""));

  // Brojač pitanja i traka napretka. Čita se aria sa same trake — u tekstu
  // postoji i „Odgovoreno: 0 / 41", pa bi prvi „n/m" iz teksta bio pogrešan.
  const traka = p.locator("[role=progressbar]");
  const sada = Number(await traka.getAttribute("aria-valuenow"));
  const maks = Number(await traka.getAttribute("aria-valuemax"));
  const tekstTrake = await p.locator("[role=progressbar]").locator("xpath=../..").innerText();
  ok(maks === 41, `traka napretka ide do 41 (aria-valuemax = ${maks})`);
  ok(sada === najduza.i + 1,
     `brojač prati izabrano pitanje (na ${najduza.i + 1}. aria-valuenow = ${sada})`);
  ok(new RegExp(String(najduza.i + 1) + "\\s*/\\s*41").test(tekstTrake),
     `natpis uz traku pokazuje ${najduza.i + 1} / 41`);
  const procenat = Number((tekstTrake.match(/(\d+)%/) || [])[1]);
  ok(procenat === Math.round(((najduza.i + 1) / 41) * 100),
     `procenat uz traku odgovara položaju (${procenat}%)`);

  // ── ekran 3: rezultat ────────────────────────────────────────────────────
  await p.locator("main article > div > button").first().click().catch(() => {});
  await p.getByRole("button", { name: /ZAVRŠI ISPIT/i }).click();
  const pot = p.getByRole("button", { name: /DA|POTVRDI|ZAVRŠI/i }).last();
  if (await pot.isVisible().catch(() => false)) await pot.click();
  await p.waitForTimeout(700);
  m = await izmjeri(p);
  ok(m.preliv === 0, `rezultat: bez preliva (${m.preliv}px)`);
  ok(m.slike.every((s) => !s.preko), `rezultat: nijedna slika u pregledu ne prelazi okvir`);
  ok(m.viri.length === 0, `rezultat: nijedan element ne viri` + (m.viri.length ? `: ${m.viri[0]}` : ""));

  ok(errs.length === 0, `bez JS grešaka` + (errs.length ? `: ${errs[0]}` : ""));
  await p.close();
}

await b.close();
console.log(`\n${fail === 0 ? "SVE PROSLO" : `PALO: ${fail}`}  (${pass} provjera)`);
process.exit(fail ? 1 : 0);
