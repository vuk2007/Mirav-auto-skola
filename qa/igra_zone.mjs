// Igra „Prođi raskrsnicu" — vidljivost zona pokazivača po nivou.
//
// Pokretanje: `npx next start -p 3100` u jednom terminalu, pa se ova skripta
// kopira u folder u kojem je `npm i playwright` već urađen i pokrene odatle.
//
// Skala je: nivo 1–2 zone sa slovom strane, 3–4 samo zone, 5 ništa. Prije ove
// izmjene je bilo 1 sa slovom, 2 bez, 3+ ništa — pa se na trećem i četvrtom
// nivou nije vidjelo ništa iako skala ide do pet.
//
// Mjeri se u pikselima platna. Zona se NE crta punom bojom nego providno
// (`globalAlpha` 0.55), pa traženje tačnog #f4c300 ne nalazi skoro ništa — to
// je prva verzija ove skripte i naučila. Zato se traži žućkasta nijansa: crvena
// osjetno iznad plave. Trava (#dfe3d8), ivičnjak i asfalt su sivi, pa prolaze
// mimo. Semaforske situacije se ne mjere — žuto svjetlo je iste boje kao zona.

import { chromium } from "playwright";

const URL = "http://localhost:3100/igra";

/** Koliko je na platnu zone (žuto) i koliko slova u njoj (tamno na žutom). */
const zoneNaPlatnu = (page) =>
  page.evaluate(() => {
    const c = document.querySelector("canvas");
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    const zuto = new Uint8Array(c.width * c.height);
    let zona = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 140 && d[i] - d[i + 2] > 60 && d[i + 1] - d[i + 2] > 30) {
        zuto[i / 4] = 1;
        zona += 1;
      }
    }
    // Slovo u krugu: tamnija tačka OKRUŽENA žutim. Krug je poluprečnika oko
    // osam piksela, pa se gleda prsten na pet — susjedni piksel je često opet
    // dio istog slova, i prva verzija je zato nalazila nulu iako slovo ima.
    const PRSTEN = [
      [5, 0],
      [-5, 0],
      [0, 5],
      [0, -5],
      [4, 4],
      [-4, 4],
      [4, -4],
      [-4, -4],
    ];
    let slovo = 0;
    for (let y = 6; y < c.height - 6; y++) {
      for (let x = 6; x < c.width - 6; x++) {
        const i = y * c.width + x;
        const p = i * 4;
        if (zuto[i] || d[p] + d[p + 1] + d[p + 2] > 330) continue;
        let oko = 0;
        for (const [dx, dy] of PRSTEN) if (zuto[i + dy * c.width + dx]) oko += 1;
        if (oko >= 5) slovo += 1;
      }
    }
    return { zona, slovo };
  });

async function otvori(page, re) {
  const kreni = page.getByRole("button", { name: /^Kreni$/ });
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: re }).first().click();
    try {
      await kreni.waitFor({ timeout: 2000 });
      return;
    } catch {
      await page.waitForTimeout(400);
    }
  }
  throw new Error(`ne otvara se: ${re}`);
}

// `vozi` je koliko sekundi treba držati gas prije mjerenja. Na autoputu je
// zona uključenja na 210–300 m, a kamera prati vozilo — na startu je van kadra.
// Devet sekundi dovede vozilo na oko 250 m, pa u kadar uđe i slovo, koje stoji
// na sredini zone.
const SITUACIJE = [
  ["kruzni-izlaz2", /Kružni tok — drugi izlaz/, 1, 0],
  ["kruzni-stop", /Kružni tok — STOP na ulazu/, 2, 0],
  ["ljevak", /Skretanje ulijevo pred susretnim/, 3, 0],
  ["kruzni-polukruzno", /Kružni tok — polukružno/, 3, 0],
  ["autoput-ukljucenje", /Autoput — uključivanje Nije/, 2, 9],
];

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
const greske = [];
page.on("pageerror", (e) => greske.push(`pageerror: ${e.message}`));

const izvj = { situacije: {} };
for (const [id, re, nivo, vozi] of SITUACIJE) {
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await otvori(page, re);
  await page.getByRole("button", { name: /^Kreni$/ }).click();
  await page.waitForTimeout(600);
  if (vozi > 0) {
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(vozi * 1000);
    await page.keyboard.up("ArrowUp");
    await page.waitForTimeout(200);
  }
  const m = await zoneNaPlatnu(page);
  izvj.situacije[id] = {
    nivo,
    imaZonu: m.zona > 200,
    imaSlovo: m.slovo > 10,
    piksela: m,
  };
  await page.locator("canvas").screenshot({ path: `zona-${id}.png` });
}

izvj.greske = greske;
console.log(JSON.stringify(izvj, null, 2));
await browser.close();
