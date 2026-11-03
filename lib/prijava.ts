/**
 * Prijava greške: šta korisnik šalje i kako se to pretvara u GitHub Issue.
 *
 * Sve što stigne sa klijenta je nepovjerljivo. Zato naslov nosi samo vrijednosti
 * provjerene po spisku (vrsta, broj pitanja), a slobodan tekst ide u kod-blok,
 * gdje GitHub ne pretvara `@ime` i `#123` u obavještenja i veze, niti učitava slike.
 */

import { LANGS, type Lang } from "./i18n";

export const VRSTE = {
  odgovor: "Netačan odgovor",
  tekst: "Greška u tekstu ili prevodu",
  slika: "Problem sa slikom",
  sajt: "Problem na sajtu",
  drugo: "Nešto drugo",
} as const;

export type Vrsta = keyof typeof VRSTE;

/** Ponuda u formi: uz pitanje i za sajt uopšte. */
export const VRSTE_PITANJA: readonly Vrsta[] = ["odgovor", "tekst", "slika", "drugo"];
export const VRSTE_SAJTA: readonly Vrsta[] = ["sajt", "tekst", "drugo"];

export const REZIMI = {
  vjezba: "vježba",
  ispit: "simulacija ispita",
  rezultat: "pregled rezultata",
} as const;

export type Rezim = keyof typeof REZIMI;

export const MIN_OPIS = 5;
export const MAX_OPIS = 2000;
export const MAX_KONTAKT = 120;
const MAX_PITANJE = 500;
const MAX_TEHNICKO = 300;

export interface Prijava {
  vrsta: Vrsta;
  opis: string;
  kontakt: string;
  jezik: Lang | null;
  rezim: Rezim | null;
  pitanjeId: number | null;
  pitanjeTekst: string;
  stranica: string;
  ekran: string;
}

function ocisti(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return (
    v
      .replace(/\r\n?/g, "\n")
      // Kontrolni znakovi nemaju mjesta u prijavi; red i tab ostaju.
      .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
      .trim()
      .slice(0, max)
  );
}

function izSpiska<K extends string>(v: unknown, spisak: readonly K[]): K | null {
  return spisak.find((k) => k === v) ?? null;
}

/** Provjerena prijava, ili `null` ako zahtjev nije ispravan. */
export function procitajPrijavu(telo: unknown): Prijava | null {
  if (!telo || typeof telo !== "object") return null;
  const t = telo as Record<string, unknown>;

  const vrsta = izSpiska(t.vrsta, Object.keys(VRSTE) as Vrsta[]);
  const opis = ocisti(t.opis, MAX_OPIS);
  if (!vrsta || opis.length < MIN_OPIS) return null;

  return {
    vrsta,
    opis,
    kontakt: ocisti(t.kontakt, MAX_KONTAKT),
    jezik: izSpiska(t.jezik, LANGS),
    rezim: izSpiska(t.rezim, Object.keys(REZIMI) as Rezim[]),
    pitanjeId: Number.isSafeInteger(t.pitanjeId) && (t.pitanjeId as number) > 0 ? (t.pitanjeId as number) : null,
    pitanjeTekst: ocisti(t.pitanjeTekst, MAX_PITANJE),
    stranica: ocisti(t.stranica, MAX_TEHNICKO),
    ekran: ocisti(t.ekran, MAX_TEHNICKO),
  };
}

/** Kod-blok čija je ograda duža od svakog niza kosih navodnika u tekstu, pa ga tekst ne može zatvoriti. */
function blok(tekst: string): string {
  const najduzi = Math.max(0, ...(tekst.match(/`+/g) ?? []).map((n) => n.length));
  const ograda = "`".repeat(Math.max(3, najduzi + 1));
  return `${ograda}text\n${tekst}\n${ograda}`;
}

export function naslovPrijave(p: Prijava): string {
  const gdje = p.pitanjeId !== null ? `Pitanje ${p.pitanjeId}` : "Sajt";
  return `[${gdje}] ${VRSTE[p.vrsta]}`;
}

export function tijeloPrijave(p: Prijava, server: { uredjaj: string; verzija: string }): string {
  const djelovi = [`**Opis**\n${blok(p.opis)}`];
  if (p.pitanjeId !== null) {
    djelovi.push(`**Pitanje ${p.pitanjeId}**\n${blok(p.pitanjeTekst || "(bez teksta)")}`);
  }
  if (p.kontakt) djelovi.push(`**Kontakt**\n${blok(p.kontakt)}`);

  const tehnicko = [
    `jezik: ${p.jezik ?? "-"}`,
    `rezim: ${p.rezim ? REZIMI[p.rezim] : "-"}`,
    `stranica: ${p.stranica || "-"}`,
    `ekran: ${p.ekran || "-"}`,
    `uredjaj: ${ocisti(server.uredjaj, MAX_TEHNICKO) || "-"}`,
    `verzija: ${server.verzija || "-"}`,
  ];
  djelovi.push(`**Tehnički podaci**\n${blok(tehnicko.join("\n"))}`);
  return djelovi.join("\n\n");
}

/**
 * Ograničenje broja prijava po ključu u kliznom prozoru. Živi u memoriji jedne
 * serverske instance, pa zaustavlja obične botove, a ne odlučnog napadača.
 * Vraća `true` kad je zahtjev preko granice.
 */
export function napraviOgranicenje(max: number, prozorMs: number) {
  const pokusaji = new Map<string, number[]>();
  return (kljuc: string, sad: number): boolean => {
    // Mapa ne smije da raste bez granice ako stižu zahtjevi sa mnogo adresa.
    if (pokusaji.size > 5000) pokusaji.clear();
    const skorasnji = (pokusaji.get(kljuc) ?? []).filter((t) => sad - t < prozorMs);
    const preko = skorasnji.length >= max;
    if (!preko) skorasnji.push(sad);
    pokusaji.set(kljuc, skorasnji);
    return preko;
  };
}
