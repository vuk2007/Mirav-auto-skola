"use client";

/**
 * Dinamički ulaz u prikaz kazni.
 *
 * Sve što dodiruje `lib/penalties.ts` živi u `PenaltyNote.tsx`, a ovdje se
 * uvozi **dinamički**. Razlog je mjerljiv: sa statičkim uvozom podaci o kaznama
 * završe u zajedničkom bundle-u i putuju svakom korisniku i kad je prikaz
 * isključen — provjereno `grep`-om kroz `.next/static`, gdje se nalazio i tekst
 * „Prekoračenje dozvoljene brzine" i polja `minEur`/`maxEur`.
 *
 * Ovako se komad koda sa kaznama traži sa mreže tek kad je
 * `NEXT_PUBLIC_KAZNE_ENABLED=true` i kad pitanju stvarno odgovara prekršaj.
 *
 * `ssr: false` jer se kazna ionako prikazuje tek poslije odgovora korisnika —
 * na serveru se nema šta iscrtati.
 */

import dynamic from "next/dynamic";

export const PenaltyForQuestion = dynamic(
  () => import("./PenaltyNote").then((m) => m.PenaltyForQuestion),
  { ssr: false },
);


export const LinkKazne = dynamic(() => import("./PenaltyNote").then((m) => m.LinkKazne), {
  ssr: false,
});
