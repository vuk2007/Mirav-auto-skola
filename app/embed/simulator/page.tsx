import type { Metadata } from "next";
import AppProvider from "@/components/AppProvider";
import EmbedHeightReporter from "@/components/EmbedHeightReporter";
import SimulatorPage from "@/components/SimulatorPage";

export const metadata: Metadata = {
  title: "Simulator raskrsnica — MIRAV",
  robots: { index: false, follow: false },
};

/** Samo simulator, za ugradnju u <iframe> odvojeno od kviza. */
export default function EmbedSimulatorRoute() {
  return (
    <AppProvider>
      <main className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-4">
        <EmbedHeightReporter />
        <SimulatorPage />
      </main>
    </AppProvider>
  );
}
