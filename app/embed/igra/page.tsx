import type { Metadata } from "next";
import AppProvider from "@/components/AppProvider";
import EmbedHeightReporter from "@/components/EmbedHeightReporter";
import GamePage from "@/components/game/GamePage";

export const metadata: Metadata = {
  title: "Prođi raskrsnicu — MIRAV",
  robots: { index: false, follow: false },
};

/** Samo igra, za ugradnju u <iframe> odvojeno od kviza. */
export default function EmbedGameRoute() {
  return (
    <AppProvider>
      <main className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-4">
        <EmbedHeightReporter />
        <GamePage />
      </main>
    </AppProvider>
  );
}
