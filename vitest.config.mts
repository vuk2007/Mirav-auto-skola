import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest pokriva čistu logiku bez React-a: `lib/` (simulacija, pravila, graf
 * puteva) i `scripts/osm/` (projekcija, uprošćavanje i sječenje OSM podataka).
 * UI se ne testira ovdje; za njega postoje browser provjere u `qa/`.
 *
 * Skripte su `.mjs`, a ne `.ts`, jer se pokreću golim Node-om izvan projekta —
 * pa se i testovi za njih zovu tako.
 */
export default defineConfig({
  resolve: {
    // Isti alias kao u tsconfig.json, da testovi uvoze kao i aplikacija.
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    include: ["lib/**/*.test.ts", "scripts/**/*.test.mjs"],
    environment: "node",
  },
});
