import type { Metadata } from "next";
import AppProvider from "@/components/AppProvider";
import BrandHeader from "@/components/BrandHeader";
import SimulatorPage from "@/components/SimulatorPage";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Simulator raskrsnica — Auto škola MIRAV",
  description:
    "Vježba prvenstva prolaza: pravilo desne strane, glavni i sporedni put, semafor, kružni tok.",
};

/** Simulator kao samostalna stranica, mimo kviza. */
export default function SimulatorRoute() {
  return (
    <AppProvider>
      <BrandHeader />

      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <SimulatorPage showControls={false} />
      </main>

      <SiteFooter />
    </AppProvider>
  );
}
