import type { Metadata } from "next";
import AppProvider from "@/components/AppProvider";
import BrandHeader from "@/components/BrandHeader";
import GameScreen from "@/components/game/GameScreen";
import SiteFooter from "@/components/SiteFooter";
import { SCENARIOS } from "@/lib/game/scenarios";

export const metadata: Metadata = {
  title: "Prođi raskrsnicu — Auto škola MIRAV",
  description:
    "Vježba tajminga u raskrsnici: držite gas i kočnicu i prođite bez ijednog prekršaja.",
};

/**
 * Igra „Prođi raskrsnicu".
 *
 * U ovoj fazi je igriv jedan scenario; izbor scenarija i progres dolaze u
 * sljedećoj fazi (vidi `lib/game/scenarios/index.ts`).
 */
export default function GameRoute() {
  const scenario = SCENARIOS[0]!;

  return (
    <AppProvider>
      <BrandHeader />
      <div className="road-line" aria-hidden="true" />

      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <GameScreen scenario={scenario} />
      </main>

      <SiteFooter />
    </AppProvider>
  );
}
