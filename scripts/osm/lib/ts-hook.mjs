/**
 * Uvoz TypeScript izvora u obicnu Node skriptu.
 *
 * Node 24 sam skida tipove sa `.ts` fajlova, ali ne razrjesava uvoz bez
 * ekstenzije — a cio projekat pise `from "../sim/config"`. Ova kuka dodaje
 * `.ts` kad putanja bez nje ne postoji, i razrjesava alias `@/`.
 *
 * Postoji da bi graf puteva imao JEDAN izvor istine: skripta cita
 * `lib/game/road/roadGraph.ts`, isti fajl koji igra vozi. Prepisivanje cvorova
 * u zaseban JSON bi znacilo da se dvije kopije mogu razici.
 */

import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";

const KORIJEN = resolvePath(fileURLToPath(import.meta.url), "../../../..");

registerHooks({
  resolve(specifier, context, nextResolve) {
    let spec = specifier;
    if (spec.startsWith("@/")) {
      spec = pathToFileURL(resolvePath(KORIJEN, spec.slice(2))).href;
    }
    const relativan = spec.startsWith("./") || spec.startsWith("../");
    if (relativan || spec.startsWith("file:")) {
      const osnova = relativan
        ? resolvePath(dirname(fileURLToPath(context.parentURL)), spec)
        : fileURLToPath(spec);
      if (!existsSync(osnova)) {
        for (const kraj of [".ts", ".tsx", "/index.ts"]) {
          if (existsSync(osnova + kraj)) {
            return nextResolve(pathToFileURL(osnova + kraj).href, context);
          }
        }
      }
      return nextResolve(pathToFileURL(osnova).href, context);
    }
    return nextResolve(specifier, context);
  },
});
