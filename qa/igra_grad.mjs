// Igra „Prođi raskrsnicu" — gradska vožnja u putovanju.
//
// Pokretanje: `npx next start -p 3100` u jednom terminalu, pa se ova skripta
// kopira u folder u kojem je `npm i playwright` već urađen i pokrene odatle.
//
// Provjerava da poslije dionice, kad se stigne u OPŠTINU, slijedi ulica kroz
// grad — dvije do tri raskrsnice — i tek onda dolazak. I obrnuto: u čvorište
// se ulazi bez ijedne raskrsnice.
//
// Vozi se Podgorica → Zeta (magistrala, opština). Za poređenje se u drugom
// prolazu vozi Podgorica → Smokovac, koje je čvorište i ne smije imati grad.
//
// Sudar na raskrsnici je ovdje očekivan: skripta drži gas i ne poštuje
// prvenstvo. Zato se dugme „Vozi ponovo" klikće kad se pojavi — provjerava se
// da ponavljanje radi, ne da robot vozi ispravno.

import { chromium } from "playwright";

const URL = "http://localhost:3100/igra";

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
const greske = [];
page.on("pageerror", (e) => greske.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !/_vercel|Failed to load resource/.test(m.text())) {
    greske.push(`console: ${m.text()}`);
  }
});

const txt = () => page.locator("main").innerText();

async function novoPutovanje() {
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.removeItem("mirav.putovanje"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  for (let i = 0; i < 5; i++) {
    await page
      .getByRole("button", { name: /^Kreni na put$/i })
      .first()
      .click()
      .catch(() => {});
    if (await page.getByRole("button", { name: /^Podgorica$/ }).count()) break;
    await page.waitForTimeout(400);
  }
  await page.getByRole("button", { name: /^Podgorica$/ }).first().click();
  await page.waitForTimeout(500);
}

/**
 * Vozi do zadatog stanja i usput bilježi šta je viđeno.
 * Vraća najveći viđeni brojač „Kroz grad N/M" i broj ponavljanja.
 */
async function voziDoDolaska(minuta) {
  let uGradu = 0;
  let ukupno = 0;
  let ponavljanja = 0;
  await page.keyboard.down("ArrowUp");
  for (let i = 0; i < minuta * 30; i++) {
    await page.waitForTimeout(2000);
    const t = (await txt()).replace(/\s+/g, " ");
    const m = /KROZ GRAD (\d+)\/(\d+)/i.exec(t);
    if (m) {
      uGradu = Math.max(uGradu, Number(m[1]));
      ukupno = Number(m[2]);
    }
    if (/Sudar/i.test(t)) {
      ponavljanja += 1;
      await page.keyboard.up("ArrowUp");
      await page.getByRole("button", { name: /Vozi ponovo/i }).first().click();
      await page.waitForTimeout(600);
      await page.keyboard.down("ArrowUp");
      continue;
    }
    if (/Stigli ste u/i.test(t)) break;
  }
  await page.keyboard.up("ArrowUp");
  return { uGradu, ukupno, ponavljanja };
}

const izvj = {};

// ── Opština: poslije dionice ide ulica ─────────────────────────────────────
await novoPutovanje();
await page.getByRole("button", { name: /Zeta \(Golubovci\).*Kreni →/s }).first().click();
await page.waitForTimeout(1000);
const zeta = await voziDoDolaska(9);
const posljeZete = await txt();
izvj.opstina = {
  ...zeta,
  imaGradskuVoznju: zeta.ukupno >= 2 && zeta.ukupno <= 3,
  provezenoSve: zeta.uGradu === zeta.ukupno,
  stigao: /Stigli ste u/i.test(posljeZete) && /Zeta/i.test(posljeZete),
};

// ── Čvorište: ulice nema ───────────────────────────────────────────────────
await novoPutovanje();
await page.getByRole("button", { name: /Smokovac.*Kreni →/s }).first().click();
await page.waitForTimeout(1000);
const smokovac = await voziDoDolaska(9);
const posljeSmokovca = await txt();
izvj.cvoriste = {
  ...smokovac,
  bezGradskeVoznje: smokovac.ukupno === 0,
  stigao: /Stigli ste u/i.test(posljeSmokovca) && /Smokovac/i.test(posljeSmokovca),
};

// ── Ponavljanje poslije sudara ─────────────────────────────────────────────
//
// Sudar se ne čeka da se desi sam: sjeme putovanja 72 je nađeno tako da
// bezobzirna vožnja kroz Zetu udari na PRVOJ gradskoj raskrsnici (traženo
// jednim prolazom kroz `flooringBot`). Putovanje se zato ubacuje u skladište
// i nastavlja, umjesto da se pravi novo sa nasumičnim sjemenom.
//
// Provjerava se zamka koju je lako napraviti: poslije sudara mora nastati NOV
// svijet. Sa starim, već završenim, platno bi odmah opet javilo ishod i ekran
// bi se zavrtio u petlji.
await page.goto(URL, { waitUntil: "networkidle" });
await page.evaluate(() =>
  window.localStorage.setItem(
    "mirav.putovanje",
    JSON.stringify({
      seed: 72,
      at: "podgorica",
      from: null,
      legs: 0,
      km: 0,
      visited: ["podgorica"],
      seen: [],
      ljeto: true,
    }),
  ),
);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(400);
for (let i = 0; i < 5; i++) {
  await page
    .getByRole("button", { name: /^Kreni na put$/i })
    .first()
    .click()
    .catch(() => {});
  if (await page.getByRole("button", { name: /Nastavi putovanje/i }).count()) break;
  await page.waitForTimeout(400);
}
await page.getByRole("button", { name: /Nastavi putovanje/i }).first().click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: /Zeta \(Golubovci\).*Kreni →/s }).first().click();
await page.waitForTimeout(1000);

// Brojač mora da pokrije cijelu dionicu (četiri minuta) plus grad; sa 200
// koraka je prva verzija istekla PRIJE grada i prijavila „nema sudara".
const ponavljanje = { sudarNaRaskrsnici: false, istaRaskrsnicaPoslije: null, nastavljeno: false };
await page.keyboard.down("ArrowUp");
for (let i = 0; i < 500; i++) {
  await page.waitForTimeout(1500);
  const t = (await txt()).replace(/\s+/g, " ");
  if (/Sudar/i.test(t)) {
    ponavljanje.porukaRaskrsnica = /Ova raskrsnica se vozi ponovo/i.test(t);
    await page.keyboard.up("ArrowUp");
    await page.getByRole("button", { name: /Vozi ponovo/i }).first().click();
    await page.waitForTimeout(1500);
    const poslije = (await txt()).replace(/\s+/g, " ");
    ponavljanje.istaRaskrsnicaPoslije = /KROZ GRAD 1\/2/i.test(poslije);
    // Ako se svijet nije obnovio, ekran bi se odmah vratio na sudar.
    ponavljanje.nijeUPetlji = !/Sudar/i.test(poslije);
    ponavljanje.sudarNaRaskrsnici = true;
    // Poslije ponavljanja se gas samo dodiruje: ista raskrsnica se prelazi
    // mirno, da se vidi da se lanac nastavlja.
    for (let k = 0; k < 40; k++) {
      await page.waitForTimeout(1000);
      await page.keyboard.press("ArrowUp");
      const u = (await txt()).replace(/\s+/g, " ");
      if (/KROZ GRAD 2\/2/i.test(u)) ponavljanje.presaoPrvu = true;
      if (/Stigli ste u/i.test(u)) {
        ponavljanje.nastavljeno = /Zeta/i.test(u);
        break;
      }
    }
    break;
  }
  if (/Stigli ste u/i.test(t)) {
    ponavljanje.nastavljeno = /Zeta/i.test(t);
    break;
  }
}
await page.keyboard.up("ArrowUp");
izvj.ponavljanje = ponavljanje;

izvj.greske = greske;
console.log(JSON.stringify(izvj, null, 2));
await browser.close();
