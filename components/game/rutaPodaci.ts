import { parseGeometry, type EdgeGeometry } from "@/lib/game/road/edgeGeometry";
import { parseKicma, type Kicma } from "@/lib/game/road/kicma";
import { edgeById, nodeById } from "@/lib/game/road/roadGraph";

/**
 * Dovlačenje podataka za rutu sa `public/data/osm/`.
 *
 * Koristi ga ekran rute i mjerilo crtanja (`/igra/bench`): mjerilo mora da
 * vozi TAČNO ono što i igra, pa ne smije imati svoju kopiju ovoga.
 */

/** Geometrija se dovlači jednom po ivici i pamti dok stranica živi. */
const KES = new Map<string, EdgeGeometry>();
/** Isto i za gradske kičme, po čvoru. */
const KES_KICME = new Map<string, Kicma>();

export async function dovuciGeometriju(ivice: readonly string[]): Promise<Map<string, EdgeGeometry>> {
  const out = new Map<string, EdgeGeometry>();
  await Promise.all(
    ivice.map(async (id) => {
      const upamceno = KES.get(id);
      if (upamceno) {
        out.set(id, upamceno);
        return;
      }
      const odgovor = await fetch(`/data/osm/edgeGeometry/${id}.json`);
      if (!odgovor.ok) throw new Error(`Nema geometrije za ${id}`);
      const g = parseGeometry(await odgovor.json());
      if (!g) throw new Error(`Neispravna geometrija za ${id}`);
      KES.set(id, g);
      out.set(id, g);
    }),
  );
  return out;
}

/**
 * Gradske kičme za mjesta kroz koja ruta prolazi.
 *
 * Kičma koja nedostaje NIJE greška: taj grad se onda samo dodirne, kao prije
 * nego što su kičme postojale. Zato se ovdje ne baca — traži se, i ako je nema,
 * ide se dalje.
 */
export async function dovuciKicme(cvorovi: readonly string[]): Promise<Map<string, Kicma>> {
  const out = new Map<string, Kicma>();
  const kroz = cvorovi.slice(1, -1).filter((c) => nodeById(c)?.kind === "opstina");
  await Promise.all(
    kroz.map(async (id) => {
      const upamceno = KES_KICME.get(id);
      if (upamceno) {
        out.set(id, upamceno);
        return;
      }
      try {
        const odgovor = await fetch(`/data/osm/kicme/${id}.json`);
        if (!odgovor.ok) return;
        const k = parseKicma(await odgovor.json());
        if (!k) return;
        KES_KICME.set(id, k);
        out.set(id, k);
      } catch {
        // Grad bez kičme se samo dodirne — vožnja se zbog toga ne prekida.
      }
    }),
  );
  return out;
}

/**
 * Ivice koje ruta koristi, po čvorovima.
 *
 * `id` ivice nosi čvorove onako kako su unijeti u graf, a ne onako kako se
 * vozi — pa se prava orijentacija PITA graf, ne pogađa. Prva verzija je tražila
 * obje i padala na 404 za onu koja ne postoji.
 */
export function iviceRute(cvorovi: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i + 1 < cvorovi.length; i++) {
    const a = cvorovi[i]!;
    const b = cvorovi[i + 1]!;
    const e = edgeById(`${a}--${b}`) ?? edgeById(`${b}--${a}`);
    if (!e) throw new Error(`Graf nema vezu ${a} — ${b}`);
    out.push(e.id);
  }
  return out;
}
