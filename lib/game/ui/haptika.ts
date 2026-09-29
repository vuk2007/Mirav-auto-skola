/**
 * Kratka vibracija, na uređajima koji je imaju.
 *
 * `navigator.vibrate` postoji na Androidu; na desktopu i u Safariju na iPhone-u
 * ga nema, i tada se ne dešava ništa — haptika je potvrda, ne jedini znak.
 * Poziv ne smije da obori ništa, pa je u `try`: neki pregledači ga odbiju bez
 * prethodnog dodira korisnika.
 */
export function haptika(ms: number): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(ms);
  } catch {
    // Pregledač je odbio — ništa se ne mijenja.
  }
}
