import type { Metadata } from "next";
import { notFound } from "next/navigation";
import UiPregled from "@/components/ui/UiPregled";

export const metadata: Metadata = { title: "Dizajn sistem — MIRAV", robots: { index: false, follow: false } };

/** Pregled baznih komponenti u svim stanjima. Postoji samo u razvoju. */
export default function Stranica() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiPregled />;
}
