import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest pokriva samo `lib/game/sim/` i pravila prvenstva — čistu TypeScript
 * logiku bez React-a. UI se ne testira ovdje; za njega postoje browser provjere
 * u `qa/`.
 */
export default defineConfig({
  resolve: {
    // Isti alias kao u tsconfig.json, da testovi uvoze kao i aplikacija.
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
