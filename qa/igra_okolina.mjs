// Igra „Prođi raskrsnicu" — okolina pored puta.
//
// Pokretanje: `npx next start -p 3100` u jednom terminalu, pa se ova skripta
// kopira u folder u kojem je `npm i playwright` već urađen i pokrene odatle.
//
// Vozi se Kotor → Herceg Novi, uz Boku, gdje su i more i naselje uz put.
// Provjerava se ono što se iz jediničnih testova ne vidi:
//  - tile-ovi se stvarno dovuku i okolina dođe do sto posto,
//  - kadar se ne uspori kad se nacrta (mjeri se broj kadrova u sekundi),
//  - nijedna greška u konzoli.
//
// Slike se snimaju uz put, da se okolina može i pogledati, a ne samo izmjeriti.

import { chromium } from "playwright";
const b = await chromium.launch();
const p = await (await b.newContext({viewport:{width:900,height:1000}})).newPage();
const greske=[];
p.on("pageerror", e=>greske.push("pageerror: "+e.message));
p.on("console", m=>{if(m.type()==="error" && !/_vercel|Failed to load resource/.test(m.text())) greske.push("console: "+m.text());});
await p.goto("http://localhost:3100/igra", {waitUntil:"networkidle"});
await p.getByRole("button", { name: /^Vozi rutu$/i }).first().click();
await p.waitForTimeout(300);
await p.locator("select").first().selectOption("kotor");
await p.locator("select").nth(1).selectOption("herceg-novi");
await p.getByRole("button", { name: /^Kreni$/i }).first().click();
await p.waitForSelector("canvas", {timeout:60000});
await p.waitForTimeout(2500);
await p.keyboard.down("ArrowUp");
for (let i=0;i<6;i++){ await p.waitForTimeout(7000);
  await p.locator("canvas").screenshot({path:`boka-${i}.png`});
  const txt=(await p.locator("main").innerText()).replace(/\s+/g," ");
  console.log(`  t=${(i+1)*7}s ostalo=${/OSTALO ([\d.]+) km/i.exec(txt)?.[1]} okolina=${/OKOLINA (\d+)%/i.exec(txt)?.[1] ?? "gotova"}`);
  if (/Stigli ste|Sudar\./i.test(txt)) break; }
await p.keyboard.up("ArrowUp");
// mjerenje kadrova
const fps = await p.evaluate(()=>new Promise(res=>{let n=0;const t0=performance.now();
  const f=()=>{n++; if(performance.now()-t0<2000) requestAnimationFrame(f); else res(Math.round(n/((performance.now()-t0)/1000)));};
  requestAnimationFrame(f);}));
console.log("kadrova u sekundi:", fps, "| greske:", JSON.stringify(greske));
await b.close();
