// WCAG kontrast za parove tekst/pozadina iz dizajn tokena.
//
//   node qa/kontrast.mjs
//
// Vrijednosti se čitaju iz app/globals.css (@theme), pa skript prati svaku
// promjenu tokena. Providne površine (staklo, *-soft) se računaju kao
// stopljene preko najsvjetlije pozadine na kojoj se pojavljuju (bg-2), jer je
// tamo kontrast najmanji. Prag: 4,5:1 za tekst, 3:1 za veliki tekst i obrise.
import { readFileSync } from "node:fs";

const css = readFileSync("app/globals.css", "utf8");
const tema = css.slice(css.indexOf("@theme"), css.indexOf("@layer base"));
const tokeni = {};
for (const m of tema.matchAll(/--color-([a-z0-9-]+):\s*([^;]+);/g)) tokeni[m[1]] = m[2].trim();

function boja(ime) {
  let v = tokeni[ime];
  if (!v) throw new Error(`nema tokena --color-${ime}`);
  const alias = v.match(/^var\(--color-([a-z0-9-]+)\)$/);
  if (alias) return boja(alias[1]);
  const heks = v.match(/^#([0-9a-f]{6})$/i);
  if (heks) {
    const n = parseInt(heks[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgb = v.match(/^rgb\((\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)\)$/);
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3], +rgb[4]];
  throw new Error(`ne znam da pročitam --color-${ime}: ${v}`);
}

/** Boja sa providnošću stopljena preko neprovidne podloge. */
function stopi(gore, dolje) {
  const a = gore[3];
  return [0, 1, 2].map((k) => gore[k] * a + dolje[k] * (1 - a)).concat(1);
}

function osvjetljenje([r, g, b]) {
  const kanal = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
}

function odnos(a, b) {
  const [l1, l2] = [osvjetljenje(a), osvjetljenje(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const BIJELA = [255, 255, 255, 1];
const podloga = (ime) => {
  const p = boja(ime);
  return p[3] < 1 ? stopi(p, boja("bg-2")) : p;
};

/* [tekst, podloga, prag, opis] */
const PAROVI = [
  ["text", "bg", 4.5, "naslov i tekst na pozadini"],
  ["text", "bg-2", 4.5, "tekst na svjetlijem dijelu vinjete"],
  ["text", "glass-strong", 4.5, "tekst na staklu (hover)"],
  ["text", "surface-2", 4.5, "tekst u meniju i modalu"],
  ["text-muted", "bg-2", 4.5, "sekundarni tekst"],
  ["text-muted", "glass-strong", 4.5, "sekundarni tekst na staklu"],
  ["text-muted", "surface-2", 4.5, "sekundarni tekst u modalu"],
  ["accent-2", "bg-2", 4.5, "plavi tekst, linkovi, oznake"],
  ["accent-2", "surface-2", 4.5, "plavi tekst u modalu"],
  ["accent-2", "accent-soft", 4.5, "plavi tekst na plavoj podlozi (izabrano)"],
  ["ok", "bg-2", 4.5, "zeleni tekst"],
  ["ok", "ok-soft", 4.5, "zeleni tekst na zelenoj podlozi"],
  ["err", "bg-2", 4.5, "crveni tekst"],
  ["err", "err-soft", 4.5, "crveni tekst na crvenoj podlozi"],
  ["bg", "ok", 4.5, "kvačica u zelenom krugu"],
  ["bg", "err", 4.5, "iksić u crvenom krugu; natpis na pritisnutoj kočnici"],
  ["bg", "signal-yellow", 4.5, "strelica na upaljenom žmigavcu (igra)"],
  ["glass-line-strong", "bg-2", 1.5, "ivica stakla (dekorativna)"],
  ["accent-2", "bg-2", 3, "plava ivica izabranog odgovora (WCAG 1.4.11)"],
  ["accent-line", "bg-2", 1.5, "plava ivica ikonica i oznaka (dekorativna)"],
];

let palo = 0;
for (const [t, p, prag, opis] of PAROVI) {
  const r = odnos(podloga(t), podloga(p));
  const ok = r >= prag;
  if (!ok) palo++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${r.toFixed(2).padStart(5)}:1  (≥ ${prag})  ${t} na ${p}  — ${opis}`);
}

/* Bijeli tekst na primarnom dugmetu: oba kraja gradijenta (accent → accent-deep). */
for (const p of ["accent", "accent-deep"]) {
  const r = odnos(BIJELA, boja(p));
  const ok = r >= 4.5;
  if (!ok) palo++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${r.toFixed(2).padStart(5)}:1  (≥ 4.5)  bijela na ${p}  — tekst primarnog dugmeta`);
}

console.log(`\nKontrast: ${PAROVI.length + 2} parova, ${palo} ispod praga`);
process.exit(palo ? 1 : 0);
