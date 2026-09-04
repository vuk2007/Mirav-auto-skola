import type { Metadata } from "next";
import AppProvider from "@/components/AppProvider";
import BrandHeader from "@/components/BrandHeader";
import GamePage from "@/components/game/GamePage";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Prođi raskrsnicu — Auto škola MIRAV",
  description:
    "Vježba tajminga u raskrsnici: držite gas i kočnicu i prođite bez ijednog prekršaja.",
};

/** Igra „Prođi raskrsnicu" — osam situacija, napredak u localStorage-u. */
export default function GameRoute() {
  return (
    <AppProvider>
      <BrandHeader />
      <div className="road-line" aria-hidden="true" />

      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <GamePage />
      </main>

      <SiteFooter />
    </AppProvider>
  );
}
