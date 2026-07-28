import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // next-env.d.ts i lib/imageSizes.ts su generisani fajlovi.
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "lib/imageSizes.ts"],
  },
];

export default eslintConfig;
