/**
 * Dnevni ciklus (faza 6, stavka 8d): sat igre ide 24 min za 24 h. Iz sata se
 * čitaju svjetlo grada (nijansa, sjenke, svjetla), udio vozila i pješaka, i da
 * li se oko škola završava nastava. Sat zavisi samo od početnog sata i
 * vremena simulacije — isti ulaz, isti dan.
 */
import { GRAD_PJESACI_PO_SATU, GRAD_SAOBRACAJ_PO_SATU, GRAD_SAT_TRAJE, GRAD_SKOLA_KRAJ, GRAD_SVJETLO_PO_SATU } from "../sim/config";

/** Sat igre [0, 24) poslije `t` sekundi simulacije, kad je počelo u `pocetak` h. */
export function satIgre(pocetak: number, t: number): number {
  const s = (pocetak + t / GRAD_SAT_TRAJE) % 24;
  return s < 0 ? s + 24 : s;
}

/** Sat kao „08:05". */
export function satTekst(sat: number): string {
  const m = Math.floor((((sat % 24) + 24) % 24) * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Udio dana, sumraka i noći u svjetlu sata (zbir 1): prelaz između sati iz tabele. */
export interface SvjetloSata {
  dan: number;
  sumrak: number;
  noc: number;
}

export function svjetloSata(sat: number): SvjetloSata {
  const h = ((sat % 24) + 24) % 24;
  const t = GRAD_SVJETLO_PO_SATU;
  let i = 0;
  while (i + 2 < t.length && t[i + 1]![0] <= h) i++;
  const [h0, a] = t[i]!;
  const [h1, b] = t[i + 1]!;
  const u = h1 > h0 ? Math.max(0, Math.min(1, (h - h0) / (h1 - h0))) : 0;
  const out: SvjetloSata = { dan: 0, sumrak: 0, noc: 0 };
  out[a] += 1 - u;
  out[b] += u;
  return out;
}

/** Vrijednost tabele po satu (0–23 h), linearno između sati. */
function poSatu(tabela: readonly number[], sat: number): number {
  const h = ((sat % 24) + 24) % 24;
  const i = Math.floor(h);
  const u = h - i;
  return tabela[i]! * (1 - u) + tabela[(i + 1) % 24]! * u;
}

/** Udio vozila u ovo doba dana (gužva ujutru i popodne, noću rijetko). */
export function saobracajSata(sat: number): number {
  return poSatu(GRAD_SAOBRACAJ_PO_SATU, sat);
}

/** Udio pješaka u ovo doba dana. */
export function pjesaciSata(sat: number): number {
  return poSatu(GRAD_PJESACI_PO_SATU, sat);
}

/** Da li se u ovo doba završava nastava (oko škola tada ima najviše pješaka). */
export function krajNastave(sat: number): boolean {
  const h = ((sat % 24) + 24) % 24;
  return GRAD_SKOLA_KRAJ.some(([od, do_]) => h >= od && h <= do_);
}
