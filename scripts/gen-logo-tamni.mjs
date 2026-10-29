// Tamna varijanta logotipa za tamnu pozadinu sajta.
//
//   node scripts/gen-logo-tamni.mjs
//
// Original (public/mirav-logo.png) je tamna mornarsko plava (#183d73) na
// providnoj podlozi, pa se na teget pozadini ne vidi. Ovdje se svaki
// neprovidni piksel preboji: volan i natpis MIRAV u akcentnu plavu,
// „AUTO ŠKOLA" u skoro bijelu, kao u referenci. Alfa ostaje ista, pa ivice
// ostaju glatke. Original se ne dira.
//
// Boje su iste kao tokeni accent-2 i text u app/globals.css.
import sharp from "sharp";

const ULAZ = "public/mirav-logo.png";
const IZLAZ = "public/mirav-logo-tamni.png";
const PLAVA = [0x5b, 0x8c, 0xff];
const BIJELA = [0xf2, 0xf5, 0xfa];

/*
  Raspored originala (2400 × 686): volan zauzima lijevu trećinu, natpis MIRAV
  gornji dio desno, a „AUTO ŠKOLA" traku ispod njega. Granice su izmjerene na
  fajlu: tekst „AUTO ŠKOLA" počinje desno od 38 % širine i ispod 66 % visine.
*/
const AUTO_SKOLA = { x: 0.38, y: 0.66 };

const { data, info } = await sharp(ULAZ).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h, channels } = info;
let plavih = 0;
let bijelih = 0;

for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * channels;
    if (data[i + 3] === 0) continue;
    const bijela = x > AUTO_SKOLA.x * w && y > AUTO_SKOLA.y * h;
    const boja = bijela ? BIJELA : PLAVA;
    data[i] = boja[0];
    data[i + 1] = boja[1];
    data[i + 2] = boja[2];
    if (bijela) bijelih++;
    else plavih++;
  }
}

await sharp(data, { raw: { width: w, height: h, channels } }).png({ compressionLevel: 9 }).toFile(IZLAZ);
console.log(`${IZLAZ}: ${w}×${h}, ${plavih} plavih i ${bijelih} bijelih piksela`);
