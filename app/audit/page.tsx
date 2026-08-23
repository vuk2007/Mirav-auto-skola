import type { Metadata } from "next";
import AuditBoard from "@/components/AuditBoard";

/**
 * Interni alat za reviziju slika i pitanja — NIJE dio kviza.
 *
 * Ne postoji nijedan link ka ovoj stranici; do nje se dolazi samo kucanjem
 * adrese. `robots` je noindex/nofollow, a isto zaglavlje (`X-Robots-Tag`) stoji
 * i u next.config.mjs, pa je stranica van pretrage i kad je deploy javan.
 */
export const metadata: Metadata = {
  title: "Revizija pitanja — interni alat",
  robots: { index: false, follow: false, nocache: true },
};

export default function AuditPage() {
  return <AuditBoard />;
}
