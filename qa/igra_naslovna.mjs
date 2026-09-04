// Igra na naslovnoj strani — kartica, otvaranje, povratak i bundle.
//
// Pokretanje: `npx next start -p 3100` u jednom terminalu, pa u drugom se ova
// skripta kopira u folder u kojem je `npm i playwright` vec uradjen i pokrene
// odatle. NODE_PATH ovdje ne pomaze — ESM ga ne gleda.
//
// Najvaznija provjera je `igraUBundluPrijeKlika`: igra se ucitava dinamicki, pa
// njen kod ne smije stici korisniku koji je samo otvorio kviz. Sa statickim
// uvozom je to bilo +22 kB First Load na naslovnoj.
import { chromium, webkit } from "playwright";

for (const [ime, pokreni, vp] of [
  ["chromium-desktop", chromium, { width: 1440, height: 1000 }],
  ["webkit-mobile", webkit, { width: 390, height: 844 }],
]) {
  const b = await pokreni.launch();
  const page = await (await b.newContext({ viewport: vp })).newPage();
  const js = [];
  const greske = [];
  page.on("response", (r) => {
    if (r.url().endsWith(".js")) js.push(r.url());
    if (r.status() >= 400 && !r.url().includes("_vercel")) greske.push(`${r.status()} ${r.url()}`);
  });
  page.on("pageerror", (e) => greske.push(`pageerror: ${e.message}`));

  const izvj = { motor: ime };
  for (const put of ["/", "/embed"]) {
    await page.goto(`http://localhost:3100${put}`, { waitUntil: "networkidle" });
    const txt = await page.locator("main").innerText();
    izvj[`karticaNa_${put}`] = /Prođi raskrsnicu/i.test(txt) && /Otvori igru/i.test(txt);
  }

  // Kod igre ne smije biti povucen dok se ona ne otvori.
  await page.goto("http://localhost:3100/", { waitUntil: "networkidle" });
  const prije = new Set(js);
  const imaIgru = async (skup) => {
    for (const u of skup) {
      const t = await page.evaluate((x) => fetch(x).then((r) => r.text()), u);
      // Naslov igre je i u rjecniku UI-ja, pa nije trag simulacije. Traze se
      // stringovi koji postoje SAMO u kodu igre i prezive minifikaciju.
      if (/cross-lights-kratki|desna-ustupi/.test(t)) return true;
    }
    return false;
  };
  izvj.igraUBundluPrijeKlika = await imaIgru(prije);

  await page.getByRole("button", { name: "Otvori igru" }).click();
  await page.waitForTimeout(1200);
  const txt = await page.locator("main").innerText();
  izvj.otvorenSpisak = /Svaka situacija vježba jedno pravilo/i.test(txt);
  izvj.brojSituacija = await page.locator("main ul > li > button").count();
  izvj.jedanPrebacivacJezika = (await page.getByRole("group", { name: /Jezik|Gjuha|Language|Язык/ }).count()) === 1;

  // Odigraj jednu situaciju do kraja, pa nazad na naslovnu.
  await page.locator("main ul > li > button").first().click();
  await page.getByRole("button", { name: "Kreni" }).click();
  await page.keyboard.down("ArrowUp");
  for (let i = 0; i < 200; i++) {
    if (/bez prekršaja|nije ispravna/i.test(await page.locator("main").innerText())) break;
    await page.waitForTimeout(150);
  }
  await page.keyboard.up("ArrowUp");
  izvj.odigrana = /nije ispravna|bez prekršaja/i.test(await page.locator("main").innerText());

  await page.getByRole("button", { name: /^← Nazad$/ }).click();
  await page.waitForTimeout(300);
  izvj.nazadNaNaslovnu = /Pripremite se za teorijski ispit/.test(
    await page.locator("main").innerText(),
  );

  izvj.greske = greske;
  console.log(JSON.stringify(izvj, null, 2));
  await b.close();
}
