import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AppProvider from "@/components/AppProvider";
import BrandHeader from "@/components/BrandHeader";
import SiteFooter from "@/components/SiteFooter";
import SpisakKazni from "@/components/SpisakKazni";
import biblioteka from "@/data/javno/kazne.json";
import { PENALTIES_ENABLED } from "@/lib/config";
import type { BibliotekaKazni } from "@/lib/kazne";

export const metadata: Metadata = {
  title: "Kazne — Auto škola MIRAV",
  description:
    "Novčane kazne po Zakonu o bezbjednosti saobraćaja, uz član i izvor. Informativno.",
};

/**
 * Spisak kazni.
 *
 * Ruta je **404** u dva slučaja, i to namjerno isto: kad je prikaz kazni
 * isključen, i kad nema nijedne potvrđene kazne. Prazna stranica ili poruka
 * „u izradi" bi kandidatu rekla da nešto postoji a ne radi; ovako ne postoji.
 *
 * Za razliku od prikaza uz pitanje, ovdje se podaci uvoze statički — stranica
 * bez njih nema šta da prikaže, pa dinamičko učitavanje ne bi ništa uštedjelo.
 * Do stranice se ionako dolazi samo preko linka koji izostaje kad je isključena.
 */
export default function KaznePage() {
  const imaPotvrdjenih = (biblioteka as BibliotekaKazni).kazne.length > 0;
  if (!PENALTIES_ENABLED || !imaPotvrdjenih) notFound();

  return (
    <AppProvider>
      <BrandHeader />
      <div className="road-line" aria-hidden="true" />
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <SpisakKazni />
      </main>
      <SiteFooter />
    </AppProvider>
  );
}
