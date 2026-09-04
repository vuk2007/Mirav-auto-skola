"use client";

/**
 * Dinamički ulaz u igru „Prođi raskrsnicu".
 *
 * Sa statičkim uvozom cijela simulacija (putanje, pravila, četrnaest scenarija)
 * završi u bundle-u naslovne strane: izmjereno +22 kB First Load za svakoga ko
 * je samo otvorio kviz. Ovako se taj komad traži sa mreže tek kad neko stvarno
 * otvori igru.
 *
 * `ssr: false` jer se ionako ne može ništa iscrtati bez platna i bez
 * `localStorage`-a sa napretkom.
 */

import dynamic from "next/dynamic";

export const GamePage = dynamic(() => import("./GamePage"), { ssr: false });
