/**
 * Brojevi iz mjerenja crtanja.
 *
 * Srednja vrijednost je loša mjera za kadrove: jedan kadar od sto milisekundi
 * je trzaj koji igrač vidi, a u prosjeku stotinu kadrova se izgubi. Zato se
 * gleda medijana (uobičajen kadar) i 95. percentil (loši kadrovi).
 */
export interface Statistika {
  medijana: number;
  p95: number;
  najvise: number;
  prosjek: number;
}

/** Percentil po najbližem rangu: vrijednost koja stvarno postoji u nizu. */
function percentil(sortirano: readonly number[], p: number): number {
  if (sortirano.length === 0) return 0;
  const i = Math.min(sortirano.length - 1, Math.max(0, Math.ceil((p / 100) * sortirano.length) - 1));
  return sortirano[i]!;
}

export function statistika(uzorci: readonly number[]): Statistika {
  const s = [...uzorci].sort((a, b) => a - b);
  return {
    medijana: percentil(s, 50),
    p95: percentil(s, 95),
    najvise: s.length > 0 ? s[s.length - 1]! : 0,
    prosjek: s.length > 0 ? s.reduce((a, x) => a + x, 0) / s.length : 0,
  };
}

/**
 * Sličice u sekundi iz razmaka između kadrova [ms].
 *
 * Broji se koliko je kadrova stalo u izmjereno vrijeme, a ne prosjek recipročnih
 * vrijednosti — jedan spor kadar mora da obori broj koliko stvarno traje.
 */
export function fps(razmaci: readonly number[]): number {
  const ukupno = razmaci.reduce((a, x) => a + x, 0);
  return ukupno > 0 ? (1000 * razmaci.length) / ukupno : 0;
}
