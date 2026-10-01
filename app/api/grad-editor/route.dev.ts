/**
 * Čuvanje overlay-a grada iz editora (faza 6, stavka 6).
 *
 * Ova ruta postoji SAMO na `npm run dev`: ekstenzija `.dev.ts` je u
 * `pageExtensions` samo u razvoju (`next.config.mjs`), pa je produkcijski
 * build ne vidi — na Vercel-u nema ni funkcije ni rute. Editor piše fajl u
 * repozitorijum (`public/data/grad/overrides/<grad>.json`), a on ide u git i
 * sa sljedećim deploy-em postaje dio igre kao statičan fajl.
 *
 * Lozinka je `GRAD_EDITOR_LOZINKA` iz `.env.local` — ni na lokalnoj mreži
 * niko drugi ne može da prepiše overlay.
 */

import { timingSafeEqual } from "node:crypto";
import { readFile, rename, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { procitajOverlay, zapisiOverlay } from "@/lib/game/grad/overlay";

export const dynamic = "force-dynamic";

const JAVNO = join(process.cwd(), "public", "data", "grad");

function lozinkaTacna(data: string): boolean {
  const ocekivana = process.env.GRAD_EDITOR_LOZINKA ?? "";
  const a = Buffer.from(data);
  const b = Buffer.from(ocekivana);
  return ocekivana.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  // Dvostruka brava: i kad bi ruta nekako ušla u build, produkcija je ne služi.
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  if (!process.env.GRAD_EDITOR_LOZINKA) {
    return NextResponse.json({ ok: false, greska: "GRAD_EDITOR_LOZINKA nije postavljena u .env.local." }, { status: 503 });
  }
  let telo: { grad?: unknown; lozinka?: unknown; overlay?: unknown; samoPrijava?: unknown };
  try {
    telo = (await request.json()) as typeof telo;
  } catch {
    return NextResponse.json({ ok: false, greska: "Neispravan zahtjev." }, { status: 400 });
  }
  if (!lozinkaTacna(String(telo.lozinka ?? ""))) {
    return NextResponse.json({ ok: false, greska: "Pogrešna lozinka." }, { status: 401 });
  }
  if (telo.samoPrijava === true) return NextResponse.json({ ok: true });

  const grad = String(telo.grad ?? "");
  const spisak = JSON.parse(await readFile(join(JAVNO, "gradovi.json"), "utf8")) as Record<string, unknown>;
  if (!/^[a-z-]+$/.test(grad) || !(grad in spisak)) {
    return NextResponse.json({ ok: false, greska: `Nepoznat grad „${grad}".` }, { status: 400 });
  }
  let tekst: string;
  try {
    const overlay = procitajOverlay(telo.overlay);
    if (overlay.grad !== grad) throw new Error(`overlay je za ${overlay.grad}, ne za ${grad}`);
    tekst = zapisiOverlay(overlay);
  } catch (e) {
    return NextResponse.json({ ok: false, greska: (e as Error).message }, { status: 400 });
  }
  // Prvo u privremeni fajl, pa preimenovanje: prekid usred pisanja ne ostavlja
  // pola overlay-a.
  const dir = join(JAVNO, "overrides");
  await mkdir(dir, { recursive: true });
  const fajl = join(dir, `${grad}.json`);
  await writeFile(`${fajl}.tmp`, tekst, "utf8");
  await rename(`${fajl}.tmp`, fajl);
  return NextResponse.json({ ok: true, bajtova: Buffer.byteLength(tekst) });
}
