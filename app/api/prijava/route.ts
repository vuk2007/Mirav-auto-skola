/**
 * Prijava greške sa sajta.
 *
 * Sa `GITHUB_PRIJAVE_TOKEN` prijava postaje Issue u privatnom repou. Bez tokena
 * ostaje samo u Vercel logovima, koji se brzo brišu. Token nema prefiks
 * `NEXT_PUBLIC_`, pa nikad ne stiže u browser. IP adresa se koristi samo za
 * ograničenje broja prijava i nigdje se ne upisuje.
 */

import { NextResponse } from "next/server";
import { naslovPrijave, napraviOgranicenje, procitajPrijavu, tijeloPrijave } from "@/lib/prijava";

export const dynamic = "force-dynamic";

const MAX_ZAHTJEV = 8000;
const PODRAZUMIJEVANI_REPO = "vuk2007/Mirav-auto-skola";
const preLimita = napraviOgranicenje(10, 10 * 60 * 1000);

const odgovor = (ok: boolean, status: number) => NextResponse.json({ ok }, { status });

export async function POST(request: Request) {
  const sirovo = await request.text();
  if (sirovo.length > MAX_ZAHTJEV) return odgovor(false, 413);

  let telo: unknown;
  try {
    telo = JSON.parse(sirovo);
  } catch {
    return odgovor(false, 400);
  }

  // Skriveno polje popunjavaju samo botovi: odgovor je „uspjeh", da ne znaju da su otkriveni.
  if (telo && typeof telo === "object" && (telo as { adresaSajta?: unknown }).adresaSajta) {
    return odgovor(true, 200);
  }

  const prijava = procitajPrijavu(telo);
  if (!prijava) return odgovor(false, 400);

  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (preLimita(ip || "nepoznata", Date.now())) return odgovor(false, 429);

  const title = naslovPrijave(prijava);
  const body = tijeloPrijave(prijava, {
    uredjaj: request.headers.get("user-agent") ?? "",
    verzija: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "",
  });

  const token = process.env.GITHUB_PRIJAVE_TOKEN;
  if (!token) {
    console.log("[prijava]", JSON.stringify({ title, body }));
    return odgovor(true, 200);
  }

  const repo = process.env.GITHUB_PRIJAVE_REPO || PODRAZUMIJEVANI_REPO;
  let status = 0;
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "mirav-prijave",
      },
      body: JSON.stringify({ title, body }),
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) return odgovor(true, 200);
    status = r.status;
  } catch {
    // Mreža ili istek vremena; prijava se upisuje ispod.
  }

  // Korisnik dobija grešku pa može ponoviti, a prijava ostaje bar u logu.
  console.error("[prijava] GitHub nije primio prijavu", status, JSON.stringify({ title, body }));
  return odgovor(false, 502);
}
