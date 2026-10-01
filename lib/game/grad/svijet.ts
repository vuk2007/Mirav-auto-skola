import { napraviMrezu, type Mreza } from "./mreza";
import { krajeviLinija } from "./oznake";
import { primijeniNaPaket, pravilaOverlaya, provjeriIshodiste, type Nevezana, type Overlay, type PravilaOverlaya } from "./overlay";
import type { Paket } from "./paket";
import { napraviPovrsinu, type Povrsina } from "./povrsina";
import { napraviRaskrsnice, zabraneSkretanja, type Raskrsnice, type Zabrana } from "./raskrsnica";
import { gradZaSudiju, type GradZaSudiju } from "./sudija";
import { crtezPravila, type CrtezPravila } from "./znakovi";

/**
 * Svijet grada za vožnju: paket iz OSM-a, pa izmjene iz overlay-a (editor,
 * stavka 6), pa sve što se iz toga gradi — mreža, asfalt, raskrsnice,
 * crtež pravila i ono po čemu sudi sudija. Jedan lanac za igru, editor i
 * fuzz test: šta se crta, po tome se sudi i po tome bot vozi.
 */
export interface SvijetGrada {
  /** Paket POSLIJE overlay-a. */
  paket: Paket;
  mreza: Mreza;
  povrsina: Povrsina;
  odsjeci: Float32Array;
  raskrsnice: Raskrsnice;
  zabrane: Map<string, Zabrana[]>;
  crtez: CrtezPravila;
  zaSudiju: GradZaSudiju;
  pravila: PravilaOverlaya | null;
  /** Izmjene čije sidro nije nađeno — ne važe; editor ih pokazuje. */
  nevezane: Nevezana[];
}

export function svijetGrada(osm: Paket, overlay: Overlay | null): SvijetGrada {
  if (overlay) provjeriIshodiste(overlay, osm);
  const prvi = overlay ? primijeniNaPaket(osm, overlay) : { paket: osm, nevezane: [] };
  const paket = prvi.paket;
  const mreza = napraviMrezu(paket);
  const povrsina = napraviPovrsinu(mreza);
  const odsjeci = krajeviLinija(mreza);
  const pravila = overlay ? pravilaOverlaya(overlay, mreza) : null;
  const raskrsnice = napraviRaskrsnice(paket, mreza, odsjeci, pravila ?? undefined);
  const zabrane = zabraneSkretanja(paket);
  const crtez = crtezPravila(povrsina, raskrsnice, zabrane, odsjeci);
  const zaSudiju = gradZaSudiju(paket, povrsina, raskrsnice, zabrane, odsjeci);
  return {
    paket,
    mreza,
    povrsina,
    odsjeci,
    raskrsnice,
    zabrane,
    crtez,
    zaSudiju,
    pravila,
    nevezane: [...prvi.nevezane, ...(pravila?.nevezane ?? [])],
  };
}
