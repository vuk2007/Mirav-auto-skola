import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import KazneEditor from "@/components/admin/KazneEditor";
import { KOLACIC_ADMIN } from "@/lib/kazne";
import Prijava from "@/components/admin/Prijava";

/**
 * Editor kazni — interni alat, nije dio kviza.
 *
 * Tri brave, svaka za drugu vrstu greške:
 *   1. `NEXT_PUBLIC_ADMIN_ENABLED` — kad nije „true", ruta je 404. Ne prazna
 *      stranica i ne „u izradi": 404, kao da je nema.
 *   2. lozinka iz `ADMIN_PASSWORD`, provjerena na serveru (vidi
 *      `app/api/admin/prijava/route.ts`).
 *   3. `noindex, nofollow, noarchive` + isto zaglavlje u next.config.mjs.
 *
 * Stranica je `force-dynamic` jer čita kolačić — inače bi Next pokušao da je
 * prerenderuje i uvijek bi pokazivala isto stanje prijave.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kazne — unos",
  robots: { index: false, follow: false, nocache: true },
};

const UKLJUCEN = process.env.NEXT_PUBLIC_ADMIN_ENABLED === "true";

export default async function AdminKaznePage() {
  if (!UKLJUCEN) notFound();

  const jar = await cookies();
  const prijavljen = jar.get(KOLACIC_ADMIN)?.value === "1";
  const imaLozinku = Boolean(process.env.ADMIN_PASSWORD);

  if (!prijavljen) return <Prijava imaLozinku={imaLozinku} />;
  return <KazneEditor />;
}
