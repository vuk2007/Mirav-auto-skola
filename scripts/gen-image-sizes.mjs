/**
 * Generira lib/imageSizes.ts — mapu <ime fajla> -> [width, height] za sve slike
 * u public/web_images (PNG i JPEG). Dimenzije su potrebne <Image> komponenti kako
 * ne bi dolazilo do pomjeranja sadržaja (layout shift) dok se slika učitava, i da
 * se slika nikad ne razvuče preko svoje prirodne veličine.
 *
 * Pokreni ponovo ako se doda/zamijeni neka slika:  npm run gen:image-sizes
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "public", "web_images");

/** Čita širinu/visinu iz IHDR chunka PNG zaglavlja. */
function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

/** Čita širinu/visinu iz SOF segmenta JPEG-a. */
function jpegSize(buf) {
  if (buf.length < 4 || buf.readUInt16BE(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset++; // preskoči popunu između segmenata
      continue;
    }
    const marker = buf[offset + 1];

    // SOF0–SOF15 nose dimenzije; DHT/DAC/RST/SOS ih nemaju.
    const isSOF =
      marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isSOF) {
      return [buf.readUInt16BE(offset + 7), buf.readUInt16BE(offset + 5)];
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2; // segmenti bez dužine
      continue;
    }
    if (marker === 0xda) break; // početak podataka — dalje nema zaglavlja
    offset += 2 + buf.readUInt16BE(offset + 2);
  }
  return null;
}

function imageSize(file, buf) {
  return file.toLowerCase().endsWith(".png") ? pngSize(buf) : jpegSize(buf);
}

const files = readdirSync(dir)
  .filter((f) => /\.(png|jpe?g)$/i.test(f))
  .sort();

const entries = [];
let failed = 0;

for (const file of files) {
  const size = imageSize(file, readFileSync(join(dir, file)));
  if (!size || !size[0] || !size[1]) {
    console.warn(`GREŠKA: dimenzije se ne mogu pročitati — ${file}`);
    failed++;
    continue;
  }
  entries.push(`  "${file}": [${size[0]}, ${size[1]}],`);
}

if (failed > 0) {
  console.error(`\nPrekinuto: ${failed} slika bez dimenzija.`);
  process.exit(1);
}

const out = `// GENERISANO AUTOMATSKI — ne mijenjaj ručno.
// Izvor: public/web_images/*  ·  Regeneriši sa: npm run gen:image-sizes

export const IMAGE_SIZES: Record<string, readonly [number, number]> = {
${entries.join("\n")}
};

/** Dimenzije slike, uz razuman fallback ako fajl nije u mapi. */
export function imageSize(file: string): readonly [number, number] {
  return IMAGE_SIZES[file] ?? [700, 470];
}
`;

writeFileSync(join(root, "lib", "imageSizes.ts"), out, "utf8");
console.log(`Zapisano lib/imageSizes.ts — ${entries.length} slika.`);
