import { napraviMrezu, type Mreza } from "./mreza";
import { krajeviLinija } from "./oznake";
import {
  primijeniNaPaket,
  pravilaOverlaya,
  provjeriIshodiste,
  zoneGrada,
  type Nevezana,
  type Overlay,
  type PravilaOverlaya,
  type Zona,
} from "./overlay";
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
  /** Zone grada: šablon sa izmjenama iz overlay-a. */
  zone: Zona[];
  crtez: CrtezPravila;
  zaSudiju: GradZaSudiju;
  pravila: PravilaOverlaya | null;
  /** Izmjene čije sidro nije nađeno — ne važe; editor ih pokazuje. */
  nevezane: Nevezana[];
}

export function svijetGrada(osm: Paket, overlay: Overlay | null, sablonZona: readonly Zona[] = []): SvijetGrada {
  if (overlay) provjeriIshodiste(overlay, osm);
  const prvi = overlay ? primijeniNaPaket(osm, overlay) : { paket: osm, nevezane: [] };
  const paket = prvi.paket;
  const mreza = napraviMrezu(paket);
  const povrsina = napraviPovrsinu(mreza);
  const odsjeci = krajeviLinija(mreza);
  const pravila = overlay ? pravilaOverlaya(overlay, mreza) : null;
  const raskrsnice = napraviRaskrsnice(paket, mreza, odsjeci, pravila ?? undefined);
  const zabrane = zabraneSkretanja(paket);
  // Znak skretanja iz editora zamjenjuje sve OSM zabrane sa tog kraka (i
  // `null` ih samo briše): overlay ima prednost u svakom polju.
  for (const k of pravila?.skretanja.keys() ?? []) {
    const [ivica, kraj] = k.split(":").map(Number) as [number, number];
    const iv = mreza.ivice[ivica]!;
    zabrane.delete(`${ivica}:${kraj === 1 ? iv.b : iv.a}`);
  }
  const zone = overlay ? zoneGrada([...sablonZona], overlay) : [...sablonZona];
  const zaSudiju = gradZaSudiju(paket, povrsina, raskrsnice, zabrane, odsjeci, zone);
  const crtez = crtezPravila(povrsina, raskrsnice, zabrane, odsjeci, zaSudiju);
  return {
    paket,
    mreza,
    povrsina,
    odsjeci,
    raskrsnice,
    zabrane,
    zone,
    crtez,
    zaSudiju,
    pravila,
    nevezane: [...prvi.nevezane, ...(pravila?.nevezane ?? [])],
  };
}
