import type { Metadata } from "next";
import BenchScreen from "@/components/game/BenchScreen";

/**
 * Mjerilo crtanja igre — razvojni alat, NIJE dio igre.
 *
 * Do njega se dolazi samo kucanjem adrese (`/igra/bench`, uz `?render=` za
 * izbor renderera). Van pretrage je i preko `robots` i preko zaglavlja u
 * next.config.mjs, kao i ostali interni alati.
 */
export const metadata: Metadata = {
  title: "Mjerilo crtanja — interni alat",
  robots: { index: false, follow: false, nocache: true },
};

export default function BenchPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <BenchScreen />
    </main>
  );
}
