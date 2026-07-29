import type { Metadata } from "next";
import EmbedHeightReporter from "@/components/EmbedHeightReporter";
import LangProvider from "@/components/LangProvider";
import Quiz from "@/components/Quiz";

export const metadata: Metadata = {
  title: "Teorijski test — MIRAV",
  // Ugrađena verzija se ne indeksira zasebno; kanonska je stranica na mirav.me.
  robots: { index: false, follow: false },
};

/** Verzija za <iframe>: bez zaglavlja i footera, providna pozadina. */
export default function EmbedPage() {
  return (
    <LangProvider>
      <main className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-4">
        <EmbedHeightReporter />
        <Quiz compact />
      </main>
    </LangProvider>
  );
}
