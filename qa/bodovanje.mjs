// Faza 3.3 — bodovanje. Testira se stvarni `examPassPoints` iz lib/config.ts.
//
//   node qa/bodovanje.mjs
//
// Formule prolaza i procenta su prepisane iz components/ResultCard.tsx (red 42–47):
//     const percent    = Math.round((scored / maxPoints) * 100);
//     const passPoints = examPassPoints(maxPoints);
//     const passed     = scored >= passPoints;
// Ako se tamo promijene, ovaj test to neće primijetiti — zato je i citiran.
import { EXAM_PASS_PERCENT, examPassPoints } from "../.tmpbuild/config.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? "PASS  " : "FAIL  ") + m); };

const prosao = (scored, max) => scored >= examPassPoints(max);
const procenat = (scored, max) => (max > 0 ? Math.round((scored / max) * 100) : 0);

console.log("=".repeat(78));
console.log(`3.3  BODOVANJE  (prag ${EXAM_PASS_PERCENT}%)`);
console.log("=".repeat(78));

// Opseg ukupnih bodova koji se stvarno javlja (izmjereno u 3.1: 90–116).
const TOTALI = Array.from({ length: 41 }, (_, i) => 80 + i);

// — svi tačni i svi netačni
ok(TOTALI.every((t) => prosao(t, t) && procenat(t, t) === 100), "svi tačni → 100%, položeno");
ok(TOTALI.every((t) => !prosao(0, t) && procenat(0, t) === 0), "svi netačni → 0%, pad");

// — neodgovoreno se broji kao 0 bodova, NE izbacuje se iz imenioca
{
  const max = 100, odgovoreno = 84;      // 16 bodova neodgovoreno
  const kadaSeBroji = procenat(odgovoreno, max);
  const kadaSeIzbaci = procenat(odgovoreno, odgovoreno);
  ok(kadaSeBroji === 84 && kadaSeIzbaci === 100,
     `neodgovoreno ostaje u imeniocu: 84/100 = ${kadaSeBroji}%, a ne ${kadaSeIzbaci}%`);
  ok(!prosao(84, 100), "84 od 100 pada (neodgovoreno ne diže procenat)");
}

// — granica: tačno 85,0% prolazi, ispod pada. Za svaki mogući ukupan zbir.
{
  const losi = [];
  for (const max of TOTALI) {
    const prag = examPassPoints(max);
    // prag mora prolaziti, prag-1 mora padati
    if (!prosao(prag, max)) losi.push(`${prag}/${max} bi trebalo da prođe`);
    if (prosao(prag - 1, max)) losi.push(`${prag - 1}/${max} NE bi smjelo da prođe`);
    // i prag mora biti >= 85% — nikad ispod
    if ((prag / max) * 100 < EXAM_PASS_PERCENT - 1e-9) losi.push(`prag ${prag}/${max} je ispod 85%`);
  }
  ok(losi.length === 0, `granica prolaza tačna za svih ${TOTALI.length} mogućih zbirova` +
     (losi.length ? `: ${losi.slice(0, 3).join("; ")}` : ""));
}

// — koristi se >=, ne >
{
  const max = 100;
  ok(examPassPoints(100) === 85, `examPassPoints(100) = ${examPassPoints(100)} (85% od 100)`);
  ok(prosao(85, max), "85/100 = tačno 85,0% → POLOŽENO (dokaz da je >= a ne >)");
  ok(!prosao(84, max), "84/100 = 84,0% → PAD");
}

// — zaokruživanje NE smije dići nekog ispod praga
{
  const losi = [];
  for (const max of TOTALI) {
    const prag = examPassPoints(max);
    for (let s = 0; s <= max; s++) {
      const stvarni = (s / max) * 100;
      if (stvarni < EXAM_PASS_PERCENT - 1e-9 && prosao(s, max)) {
        losi.push(`${s}/${max} = ${stvarni.toFixed(2)}% je prošlo`);
      }
    }
    void prag;
  }
  ok(losi.length === 0, "nijedan rezultat ispod 85% ne prolazi (Math.ceil je konzervativan)" +
     (losi.length ? `: ${losi.slice(0, 3).join("; ")}` : ""));
}

// — PRIKAZ: procenat se zaokružuje, prolaz se ne. Može li pisati „85%" a „PAO"?
{
  const zamke = [];
  for (const max of TOTALI) {
    for (let s = 0; s <= max; s++) {
      const p = procenat(s, max);
      if (p >= EXAM_PASS_PERCENT && !prosao(s, max)) {
        zamke.push({ s, max, p, stvarni: ((s / max) * 100).toFixed(2), prag: examPassPoints(max) });
      }
    }
  }
  console.log(`\nprikazani procenat ≥85% a rezultat PAD: ${zamke.length} kombinacija`);
  for (const z of zamke.slice(0, 12)) {
    console.log(`   ${z.s}/${z.max} = ${z.stvarni}% → prikazuje se „${z.p}%" uz „PAO"  (prag je ${z.prag})`);
  }
  ok(zamke.length === 0, `prikazani procenat nikad ne protivrječi ishodu (${zamke.length} slučajeva)`);
}

// — procenat se računa od BODOVA, ne od broja pitanja
{
  // 41 pitanje, 20 tačnih, ali sva jeftina: bodovi i pitanja daju različit procenat
  const bodoviTacnih = 20, bodoviUkupno = 100, pitanjaTacnih = 20, pitanjaUkupno = 41;
  const poBodovima = procenat(bodoviTacnih, bodoviUkupno);
  const poPitanjima = Math.round((pitanjaTacnih / pitanjaUkupno) * 100);
  ok(poBodovima === 20 && poPitanjima === 49,
     `procenat ide od bodova (${poBodovima}%), ne od broja pitanja (${poPitanjima}%)`);
}

console.log(`\n${fail === 0 ? "3.3 SVE PROSLO" : `3.3 PALO: ${fail}`}  (${pass} provjera)`);
process.exit(fail ? 1 : 0);
