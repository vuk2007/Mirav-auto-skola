import type { Metadata } from "next";
import AppProvider from "@/components/AppProvider";
import EmbedHeightReporter from "@/components/EmbedHeightReporter";
import { PrijavaSajta } from "@/components/PrijavaGreske";
import Quiz from "@/components/Quiz";

export const metadata: Metadata = {
  title: "Teorijski test — MIRAV",
  // Ugrađena verzija se ne indeksira zasebno; kanonska je stranica na mirav.me.
  robots: { index: false, follow: false },
};

/** Verzija za <iframe>: bez zaglavlja i footera, providna pozadina. */
export default function EmbedPage() {
  return (
    <AppProvider>
      <main className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-4">
        <EmbedHeightReporter />
        <Quiz compact />
        {/* Ugrađena verzija nema footer, pa prijava za sajt stoji ovdje. */}
        <PrijavaSajta className="mt-4" />
      </main>
    </AppProvider>
  );
}
