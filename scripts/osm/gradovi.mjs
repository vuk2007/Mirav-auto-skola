/**
 * Gradovi koji se prave u razmjeri 1:1 (faza 6), sa okvirom za Overpass.
 *
 * Okvir je „jug,zapad,sjever,istok" u stepenima i obuhvata gradsko područje
 * sa rubom — tačne granice zona crta škola u editoru (`cityZones/<grad>.json`),
 * a ovo je samo koliko se povlači iz OSM-a.
 *
 * Podgorica: od Tološa do Konika i od Zagoriča do Momišića; u procjeni
 * izmjereno 190 semafora, 101 STOP, 31 113 zgrada unutar 42,40–42,48 /
 * 19,20–19,31, pa je ovdje po pola kilometra rezerve.
 */
export const GRADOVI = {
  // Ishodište lokalnih metara je Trg nezavisnosti.
  podgorica: { ime: "Podgorica", okvir: "42.395,19.195,42.485,19.315", centar: { lat: 42.4413, lon: 19.2629 } },
};
