/**
 * Generira lib/imageSizes.ts — mapu <ime fajla> -> [width, height] za sve PNG-ove
 * u public/web_images. Dimenzije su potrebne <Image> komponenti kako ne bi
 * dolazilo do pomjeranja sadržaja (layout shift) dok se slika učitava.
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
  const isPng = buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47;
  if (!isPng) return null;
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".png")).sort();
const entries = [];

for (const file of files) {
  const size = pngSize(readFileSync(join(dir, file)));
  if (!size) {
    console.warn(`preskočeno (nije validan PNG): ${file}`);
    continue;
  }
  entries.push(`  "${file}": [${size[0]}, ${size[1]}],`);
}

const out = `// GENERISANO AUTOMATSKI — ne mijenjaj ručno.
// Izvor: public/web_images/*.png  ·  Regeneriši sa: npm run gen:image-sizes

export const IMAGE_SIZES: Record<string, readonly [number, number]> = {
${entries.join("\n")}
};

/** Dimenzije slike, uz razuman fallback ako fajl nije u mapi. */
export function imageSize(file: string): readonly [number, number] {
  return IMAGE_SIZES[file] ?? [480, 320];
}
`;

writeFileSync(join(root, "lib", "imageSizes.ts"), out, "utf8");
console.log(`Zapisano lib/imageSizes.ts — ${entries.length} slika.`);
