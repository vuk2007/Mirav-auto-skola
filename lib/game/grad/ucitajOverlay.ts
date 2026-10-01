import { procitajOverlay, type Overlay } from "./overlay";

/**
 * Overlay grada je JSON u `public/` — servira se kao statičan fajl, bez
 * ijedne serverske funkcije. Editor (samo na `npm run dev`) ga piše na isto
 * mjesto, pa je u git-u i ide sa sljedećim deploy-em.
 */
export const adresaOverlaya = (grad: string) => `/data/grad/overrides/${grad}.json`;

/** Overlay grada, ili `null` kad ga još nema (grad bez ručnih izmjena). */
export async function ucitajOverlay(grad: string): Promise<Overlay | null> {
  // Bez posebnog keša: Vercel servira `public/` sa ETag-om, pa ponovni
  // dolazak dobija 304 dok se fajl ne promijeni.
  const r = await fetch(adresaOverlaya(grad));
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`overlay ${grad}: HTTP ${r.status}`);
  return procitajOverlay(await r.json());
}
