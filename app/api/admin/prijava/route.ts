/**
 * Prijava u editor kazni.
 *
 * Lozinka se provjerava **na serveru**. `ADMIN_PASSWORD` nema prefiks
 * `NEXT_PUBLIC_`, pa je Next nikad ne ugrađuje u klijentski bundle — u
 * browser stiže samo „da" ili „ne", nikad sama lozinka.
 *
 * Poslije uspjeha se postavlja kratkotrajan `httpOnly` kolačić. `httpOnly`
 * znači da mu ni JavaScript na stranici ne može prići, pa se ne može ukrasti
 * kroz XSS.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { KOLACIC_ADMIN } from "@/lib/kazne";

export const dynamic = "force-dynamic";

/** Osam sati je jedan radni dan; duže nema potrebe. */
const TRAJANJE_S = 8 * 60 * 60;

/** Ista brava kao na stranici — bez nje bi ruta izdavala kolačić i kad je editor ugašen. */
const UKLJUCEN = process.env.NEXT_PUBLIC_ADMIN_ENABLED === "true";

export async function POST(request: Request) {
  if (!UKLJUCEN) return new NextResponse(null, { status: 404 });

  const ocekivana = process.env.ADMIN_PASSWORD;

  // Bez postavljene lozinke editor se ne otvara nikako — inače bi prazna
  // lozinka bila „tačna" i svako bi ušao.
  if (!ocekivana) {
    return NextResponse.json(
      { ok: false, greska: "ADMIN_PASSWORD nije postavljen na serveru." },
      { status: 503 },
    );
  }

  let lozinka = "";
  try {
    const telo: unknown = await request.json();
    if (telo && typeof telo === "object" && "lozinka" in telo) {
      lozinka = String((telo as { lozinka: unknown }).lozinka ?? "");
    }
  } catch {
    return NextResponse.json({ ok: false, greska: "Neispravan zahtjev." }, { status: 400 });
  }

  if (lozinka !== ocekivana) {
    return NextResponse.json({ ok: false, greska: "Pogrešna lozinka." }, { status: 401 });
  }

  const jar = await cookies();
  jar.set(KOLACIC_ADMIN, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TRAJANJE_S,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  if (!UKLJUCEN) return new NextResponse(null, { status: 404 });
  const jar = await cookies();
  jar.delete(KOLACIC_ADMIN);
  return NextResponse.json({ ok: true });
}
