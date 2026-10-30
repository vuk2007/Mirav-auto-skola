/**
 * Tema sajta: tamna (brend) ili svijetla. Bira se na `<html data-tema>`, a
 * boje za svijetlu su u app/globals.css (`:root[data-tema="svijetla"]`).
 *
 * Redoslijed (odluka korisnika 2026-10-30):
 *  1. `?tema=svijetla` / `?tema=tamna` u adresi — zaključava temu (npr. kad
 *     Digital Artefakt želi da se iframe na mirav.me slaže sa njihovim sajtom);
 *     tada se prekidač ne prikazuje;
 *  2. izbor sa prekidača, zapamćen na uređaju;
 *  3. podešavanje uređaja (svijetli / tamni režim sistema).
 */

export type Tema = "svijetla" | "tamna";

export const KLJUC_TEME = "mirav-tema";

/** Iz parametra adrese: prihvata i engleske riječi. */
function izAdrese(v: string | null): Tema | null {
  if (v === "svijetla" || v === "light") return "svijetla";
  if (v === "tamna" || v === "dark") return "tamna";
  return null;
}

/**
 * Skripta za `<head>`: postavi temu prije prvog crtanja, da stranica ne
 * bljesne u pogrešnoj. Mora biti samostalna (ide kao tekst u stranicu).
 * localStorage zna da baci izuzetak (iframe sa blokiranim kolačićima), pa je
 * u svom try bloku — podešavanje uređaja važi i tada.
 */
export const SKRIPTA_TEME = `(function(){var d=document.documentElement,t=null;try{var q=new URLSearchParams(location.search).get("tema");if(q==="svijetla"||q==="light")t="svijetla";else if(q==="tamna"||q==="dark")t="tamna";if(t)d.dataset.temaZakljucana="1";}catch(e){}if(!t){try{var s=localStorage.getItem("${KLJUC_TEME}");if(s==="svijetla"||s==="tamna")t=s;}catch(e){}}if(!t){try{t=matchMedia("(prefers-color-scheme: light)").matches?"svijetla":"tamna";}catch(e){t="tamna";}}d.dataset.tema=t;})();`;

export function trenutnaTema(): Tema | null {
  const t = document.documentElement.dataset.tema;
  return t === "svijetla" || t === "tamna" ? t : null;
}

export function temaZakljucana(): boolean {
  return document.documentElement.dataset.temaZakljucana === "1";
}

/** Izbor sa prekidača: odmah na stranicu, i zapamćen na uređaju. */
export function izaberiTemu(t: Tema): void {
  document.documentElement.dataset.tema = t;
  try {
    localStorage.setItem(KLJUC_TEME, t);
  } catch {
    // Bez pamćenja (privatni prozor, iframe) — izbor važi do kraja posjete.
  }
}

/** Da li je tema izabrana na prekidaču (inače prati uređaj). */
function zapamcena(): boolean {
  try {
    return izAdrese(localStorage.getItem(KLJUC_TEME)) !== null;
  } catch {
    return false;
  }
}

/**
 * Dok tema nije izabrana ni zaključana, prati promjenu podešavanja uređaja
 * (npr. telefon uveče sam pređe u tamni). Vraća funkciju za odjavu.
 */
export function pratiUredjaj(): () => void {
  const upit = matchMedia("(prefers-color-scheme: light)");
  const promjena = () => {
    if (temaZakljucana() || zapamcena()) return;
    document.documentElement.dataset.tema = upit.matches ? "svijetla" : "tamna";
  };
  upit.addEventListener("change", promjena);
  return () => upit.removeEventListener("change", promjena);
}

/** Pretplata na promjenu teme (za `useSyncExternalStore`). */
export function pretplatiNaTemu(javi: () => void): () => void {
  const o = new MutationObserver(javi);
  o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema", "data-tema-zakljucana"] });
  return () => o.disconnect();
}
