"use client";

import { useEffect, useMemo, useState } from "react";
import type { Point } from "@/lib/game/sim/types";
import { ruta, ZA_BOTA, type Korak } from "@/lib/game/grad/botGrad";
import {
  dionicaIvice,
  izmjenaDionice,
  izmjeneKraka,
  najblizaUlica,
  noviId,
  poljaIvice,
  postavi,
  potvrdaRaskrsnice,
  sidroKraka,
  sidroNaIvici,
  ukloni,
  type Pogodak,
  type Potpis,
} from "@/lib/game/grad/editorAlati";
import type { Manevar } from "@/lib/game/grad/mreza";
import {
  tackaOverlaya,
  vezaniCvor,
  zadaciGrada,
  type Izmjena,
  type KontrolaOverlaya,
  type Overlay,
  type PlanOverlaya,
  type PoljaDionice,
  type Zadatak,
  type ZnakNaUlici,
  type Zona,
} from "@/lib/game/grad/overlay";
import { svjetlo, zelenaStrelica } from "@/lib/game/grad/raskrsnica";
import type { SvijetGrada } from "@/lib/game/grad/svijet";
import type { Nacrt } from "./preklop";

/**
 * Paneli editora grada (stavka 6c): šta se može izmijeniti na izabranom
 * kraku, raskrsnici, ulici, čvoru, zoni i zadatku. Svaki panel pravi
 * izmjene overlay-a (`editorAlati`) i predaje ih editoru (`primijeni`), koji
 * pamti istoriju za „poništi".
 */

interface Zajednicko {
  svijet: SvijetGrada;
  overlay: Overlay;
  primijeni: (o: Overlay) => void;
  potpis: () => Potpis | null;
}

const MANEVRI: readonly [Manevar, string][] = [
  ["lijevo", "lijevo"],
  ["pravo", "pravo"],
  ["desno", "desno"],
  ["polukruzno", "polukružno"],
];
const KONTROLE: readonly [KontrolaOverlaya, string][] = [
  ["stop", "STOP"],
  ["ustupi", "Ustupi (trougao)"],
  ["glavni", "Glavni put"],
  ["desna", "Bez znaka (desna strana)"],
];
const IZVOR: Record<string, string> = { overlay: "editor", osm: "OSM", izvedeno: "izvedeno", pravilo: "pravilo desne strane" };

const dugme = "rounded border border-line bg-paper px-2 py-0.5";
const dugmeGlavno = "rounded bg-blue px-2 py-0.5 font-semibold text-white";
const naslov = "font-bold";

function Izmjene({ izmjene, overlay, primijeni }: { izmjene: Izmjena[]; overlay: Overlay; primijeni: (o: Overlay) => void }) {
  if (!izmjene.length) return null;
  return (
    <ul className="space-y-1">
      {izmjene.map((iz) => (
        <li key={iz.id} className="flex items-center gap-1 rounded border border-line px-1">
          <span className="flex-1">
            {iz.vrsta} <span className="text-muted">· {iz.autor}</span>
          </span>
          <button type="button" onClick={() => primijeni(ukloni(overlay, iz.id))} className="px-1 text-red" aria-label="Obriši izmjenu">
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}

function Manevri({ izabrani, promijeni }: { izabrani: Manevar[]; promijeni: (m: Manevar[]) => void }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {MANEVRI.map(([m, ime]) => (
        <label key={m} className="flex items-center gap-0.5">
          <input
            type="checkbox"
            checked={izabrani.includes(m)}
            onChange={(e) => promijeni(e.target.checked ? [...izabrani, m] : izabrani.filter((x) => x !== m))}
          />
          {ime}
        </label>
      ))}
    </span>
  );
}

// ── krak ─────────────────────────────────────────────────────────────────

export function PanelKraka({ svijet, overlay, primijeni, potpis, r, k }: Zajednicko & { r: number; k: number }) {
  const rs = svijet.raskrsnice.lista[r]!;
  const krak = rs.kraci[k]!;
  const iv = svijet.mreza.ivice[krak.ivica]!;
  const kljuc = `${krak.ivica}:${krak.kraj}`;
  const znak = svijet.raskrsnice.skretanja.get(kljuc);
  const [vrsta, setVrsta] = useState<"nema" | "zabrana" | "obavezno" | "ukloniOsm">(znak?.vrsta ?? "nema");
  const [manevri, setManevri] = useState<Manevar[]>(znak?.manevri ?? []);
  useEffect(() => {
    setVrsta(znak?.vrsta ?? "nema");
    setManevri(znak?.manevri ?? []);
  }, [r, k, znak]);
  const bezUlaska = svijet.raskrsnice.bezUlaska.has(kljuc);
  const sidro = sidroKraka(svijet, r, k);
  const dodaj = (iz: Izmjena) => primijeni(postavi(overlay, iz));

  return (
    <div className="space-y-2">
      <p className={naslov}>
        Krak {k + 1} raskrsnice #{r} — {iv.ime || "bez imena"} ({iv.klasa})
      </p>
      <p className="text-muted">
        {krak.ulaz ? `Ulaz: ${krak.kontrola} (${IZVOR[krak.izvor]})` : "Samo izlaz (jednosmjerna ka ovom kraku)."}
      </p>
      {krak.ulaz && krak.kontrola !== "semafor" && (
        <div className="flex flex-wrap gap-1">
          {KONTROLE.map(([kon, ime]) => (
            <button
              key={kon}
              type="button"
              className={krak.kontrola === kon && krak.izvor === "overlay" ? dugmeGlavno : dugme}
              onClick={() => {
                const p = potpis();
                if (p) dodaj({ id: noviId(), ...p, vrsta: "kontrola", krak: sidro, kontrola: kon });
              }}
            >
              {ime}
            </button>
          ))}
        </div>
      )}
      {krak.kontrola === "semafor" && <p>Krak je pod semaforom — kontrola se mijenja u planu semafora (klikni raskrsnicu).</p>}
      {krak.ulaz && (
        <div className="space-y-1 rounded border border-line p-1">
          <p className="font-semibold">Znak skretanja sa ovog kraka</p>
          <select value={vrsta} onChange={(e) => setVrsta(e.target.value as typeof vrsta)} className="rounded border border-line">
            <option value="nema">bez znaka iz editora</option>
            <option value="zabrana">zabrana (precrtana strelica)</option>
            <option value="obavezno">obavezan smjer (plavi krug)</option>
            <option value="ukloniOsm">ukloni zabrane iz OSM-a (greška)</option>
          </select>
          {(vrsta === "zabrana" || vrsta === "obavezno") && <Manevri izabrani={manevri} promijeni={setManevri} />}
          <button
            type="button"
            className={dugmeGlavno}
            onClick={() => {
              const p = potpis();
              if (!p) return;
              const postojeca = overlay.izmjene.find((x) => x.vrsta === "skretanje" && svijet.pravila?.skretanja.get(kljuc)?.id === x.id);
              if (vrsta === "nema") {
                if (postojeca) primijeni(ukloni(overlay, postojeca.id));
                return;
              }
              if ((vrsta === "zabrana" || vrsta === "obavezno") && manevri.length === 0) return;
              dodaj({
                id: noviId(),
                ...p,
                vrsta: "skretanje",
                krak: sidro,
                znak: vrsta === "ukloniOsm" ? null : { vrsta, manevri },
              });
            }}
          >
            Primijeni znak
          </button>
        </div>
      )}
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={bezUlaska}
          onChange={(e) => {
            const p = potpis();
            if (!p) return;
            if (e.target.checked) dodaj({ id: noviId(), ...p, vrsta: "zabranaUlaska", krak: sidro });
            else {
              const id = svijet.pravila?.zabraneUlaska.get(kljuc)?.id;
              if (id) primijeni(ukloni(overlay, id));
            }
          }}
        />
        Zabrana ulaska u ovaj krak iz raskrsnice
      </label>
      <Izmjene izmjene={izmjeneKraka(svijet, overlay, r, k)} overlay={overlay} primijeni={primijeni} />
    </div>
  );
}

// ── raskrsnica i semafor ─────────────────────────────────────────────────

interface FazaUredjivanja {
  zeleno: number;
  /** Po kraku (indeks): crveno, zeleno za sve (`null`), ili samo za pravce. */
  kraci: Record<number, Manevar[] | null | undefined>;
  strelice: Record<number, Manevar[]>;
  pjesaci: number[];
}

export function PanelRaskrsnice({
  svijet,
  overlay,
  primijeni,
  potpis,
  r,
  vrijeme,
  onKrak,
}: Zajednicko & { r: number; vrijeme: number; onKrak: (k: number) => void }) {
  const rs = svijet.raskrsnice.lista[r]!;
  const ulazi = rs.kraci.map((k, j) => ({ k, j })).filter(({ k }) => k.ulaz);
  const pocetne = useMemo((): { faze: FazaUredjivanja[]; zuto: number; sveCrveno: number; pomak: number } | null => {
    if (!rs.plan) return null;
    return {
      faze: rs.plan.faze.map((f) => ({
        zeleno: f.zeleno,
        kraci: Object.fromEntries([...f.kraci.map((j) => [j, null]), ...f.djelimicno.map((d) => [d.krak, d.manevri])]),
        strelice: Object.fromEntries(f.strelice.map((d) => [d.krak, d.manevri])),
        pjesaci: f.pjesaci,
      })),
      zuto: rs.plan.zuto,
      sveCrveno: rs.plan.sveCrveno,
      pomak: rs.plan.pomak,
    };
  }, [rs]);
  const [plan, setPlan] = useState(pocetne);
  useEffect(() => setPlan(pocetne), [pocetne]);

  const novPlan = () =>
    setPlan({
      faze: ulazi.map(({ j }) => ({ zeleno: 20, kraci: { [j]: null }, strelice: {}, pjesaci: [] })),
      zuto: 3,
      sveCrveno: 2,
      pomak: 0,
    });
  const uOverlay = (p: NonNullable<typeof plan>): PlanOverlaya => ({
    zuto: p.zuto,
    sveCrveno: p.sveCrveno,
    pomak: p.pomak,
    faze: p.faze.map((f) => ({
      zeleno: f.zeleno,
      kraci: Object.entries(f.kraci)
        .filter(([, v]) => v !== undefined && (v === null || v.length > 0))
        .map(([j, v]) => ({ krak: sidroKraka(svijet, r, Number(j)), manevri: v ?? null })),
      strelice: Object.entries(f.strelice)
        .filter(([, v]) => v.length > 0)
        .map(([j, v]) => ({ krak: sidroKraka(svijet, r, Number(j)), manevri: v })),
      pjesaci: f.pjesaci.map((j) => sidroKraka(svijet, r, j)),
    })),
  });
  const izmijeniFazu = (i: number, f: Partial<FazaUredjivanja>) =>
    plan && setPlan({ ...plan, faze: plan.faze.map((x, j) => (j === i ? { ...x, ...f } : x)) });
  const sidroR = tackaOverlaya(svijet.mreza.cvorovi[rs.cvorovi[0]!]!);

  return (
    <div className="space-y-2">
      <p className={naslov}>
        Raskrsnica #{r} {rs.kruzni ? "(kružni tok)" : ""}
      </p>
      <ul className="space-y-0.5">
        {rs.kraci.map((k, j) => {
          const iv = svijet.mreza.ivice[k.ivica]!;
          const sv = svjetlo(rs, j, vrijeme);
          return (
            <li key={j}>
              <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => onKrak(j)}>
                {j + 1}. {iv.ime || "bez imena"} — {k.ulaz ? `${k.kontrola} (${IZVOR[k.izvor]})` : "izlaz"}
                {sv ? ` · ${sv}` : ""}
                {MANEVRI.filter(([m]) => zelenaStrelica(rs, j, vrijeme, m)).map(([, ime]) => ` · strelica ${ime}`).join("")}
              </button>
            </li>
          );
        })}
      </ul>
      {(rs.inferredPriority || rs.inferredPhases) && (
        <div className="rounded border border-line p-1">
          <p>
            Izvedeno: {rs.inferredPriority ? "prioritet" : ""} {rs.inferredPhases ? "faze semafora" : ""} — provjeri na terenu.
          </p>
          <button
            type="button"
            className={dugmeGlavno}
            onClick={() => {
              const p = potpis();
              if (!p) return;
              let o = overlay;
              for (const iz of potvrdaRaskrsnice(svijet, r, p)) o = postavi(o, iz);
              primijeni(o);
            }}
          >
            Potvrdi kako je
          </button>
        </div>
      )}
      <div className="space-y-1 rounded border border-line p-1">
        <p className="font-semibold">Semafor</p>
        {!plan && (
          <button type="button" className={dugme} onClick={novPlan}>
            Dodaj semafor
          </button>
        )}
        {plan && (
          <>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["zuto", "žuto"],
                  ["sveCrveno", "sve crveno"],
                  ["pomak", "pomak (zeleni talas)"],
                ] as const
              ).map(([polje, ime]) => (
                <label key={polje} className="flex items-center gap-1">
                  {ime}
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={plan[polje]}
                    onChange={(e) => setPlan({ ...plan, [polje]: Number(e.target.value) })}
                    className="w-14 rounded border border-line px-1"
                  />
                  s
                </label>
              ))}
            </div>
            {plan.faze.map((f, i) => (
              <div key={i} className="space-y-1 rounded border border-line p-1">
                <div className="flex items-center gap-2">
                  <strong>Faza {i + 1}</strong>
                  <label className="flex items-center gap-1">
                    zeleno
                    <input
                      type="number"
                      min={1}
                      value={f.zeleno}
                      onChange={(e) => izmijeniFazu(i, { zeleno: Math.max(1, Number(e.target.value)) })}
                      className="w-14 rounded border border-line px-1"
                    />
                    s
                  </label>
                  <button type="button" className="text-red" onClick={() => setPlan({ ...plan, faze: plan.faze.filter((_, j) => j !== i) })}>
                    ukloni fazu
                  </button>
                </div>
                {ulazi.map(({ j }) => {
                  const v = f.kraci[j];
                  const stanje = v === undefined ? "crveno" : v === null ? "sve" : "pravci";
                  return (
                    <div key={j} className="border-t border-line pt-0.5">
                      <span className="mr-1">Krak {j + 1}:</span>
                      <select
                        value={stanje}
                        onChange={(e) =>
                          izmijeniFazu(i, {
                            kraci: { ...f.kraci, [j]: e.target.value === "crveno" ? undefined : e.target.value === "sve" ? null : ["pravo"] },
                          })
                        }
                        className="rounded border border-line"
                      >
                        <option value="crveno">crveno</option>
                        <option value="sve">zeleno za sve</option>
                        <option value="pravci">zeleno samo za pravce (strelice)</option>
                      </select>
                      {stanje === "pravci" && <Manevri izabrani={v ?? []} promijeni={(m) => izmijeniFazu(i, { kraci: { ...f.kraci, [j]: m } })} />}
                      <div className="text-muted">
                        dopunska zelena strelica:{" "}
                        <Manevri izabrani={f.strelice[j] ?? []} promijeni={(m) => izmijeniFazu(i, { strelice: { ...f.strelice, [j]: m } })} />
                      </div>
                      <label className="flex items-center gap-1 text-muted">
                        <input
                          type="checkbox"
                          checked={f.pjesaci.includes(j)}
                          onChange={(e) => izmijeniFazu(i, { pjesaci: e.target.checked ? [...f.pjesaci, j] : f.pjesaci.filter((x) => x !== j) })}
                        />
                        zeleno za pješake preko kraka
                      </label>
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className={dugme}
                onClick={() => setPlan({ ...plan, faze: [...plan.faze, { zeleno: 15, kraci: {}, strelice: {}, pjesaci: [] }] })}
              >
                Dodaj fazu
              </button>
              <button
                type="button"
                className={dugmeGlavno}
                onClick={() => {
                  const p = potpis();
                  if (!p) return;
                  if (plan.faze.length === 0) return;
                  primijeni(postavi(overlay, { id: noviId(), ...p, vrsta: "semafor", raskrsnica: sidroR, plan: uOverlay(plan) }));
                }}
              >
                Primijeni plan
              </button>
              <button
                type="button"
                className={dugme}
                onClick={() => {
                  const p = potpis();
                  if (p) primijeni(postavi(overlay, { id: noviId(), ...p, vrsta: "semafor", raskrsnica: sidroR, plan: null }));
                }}
              >
                Semafora nema (ukloni)
              </button>
            </div>
            <p className="text-muted">Ciklus: {plan.faze.reduce((a, f) => a + f.zeleno + plan.zuto + plan.sveCrveno, 0)} s. Klizač „Semafori u“ gore pokazuje svjetla u vremenu.</p>
          </>
        )}
      </div>
      <Izmjene
        izmjene={overlay.izmjene.filter((x) => x.vrsta === "semafor" && vezaniCvor(svijet.mreza, x.raskrsnica) !== null && rs.cvorovi.includes(vezaniCvor(svijet.mreza, x.raskrsnica)!))}
        overlay={overlay}
        primijeni={primijeni}
      />
    </div>
  );
}

// ── ulica (dionica) ──────────────────────────────────────────────────────

const ZNAKOVI: readonly [ZnakNaUlici, string][] = [
  ["brzina", "Ograničenje brzine"],
  ["krajGlavnog", "Kraj glavnog puta"],
  ["zabranaPreticanja", "Zabrana preticanja"],
  ["krajZabranePreticanja", "Kraj zabrane preticanja"],
  ["skolskaZona", "Zona škole"],
  ["djeca", "Djeca na putu"],
];
const KLASE = ["primary", "secondary", "tertiary", "residential", "unclassified", "living_street", "service"];

export function PanelUlice({ svijet, overlay, primijeni, potpis, pogodak }: Zajednicko & { pogodak: Extract<Pogodak, { vrsta: "ulica" }> }) {
  const m = svijet.mreza;
  const iv = m.ivice[pogodak.ivica]!;
  const dionica = useMemo(() => dionicaIvice(m, iv.i), [m, iv.i]);
  const postojece = izmjenaDionice(svijet, overlay, dionica);
  const pocetna = useMemo(() => poljaIvice(m, iv.i), [m, iv.i]);
  const [polja, setPolja] = useState(pocetna);
  const [mijenjano, setMijenjano] = useState<Set<keyof PoljaDionice>>(new Set());
  const [znak, setZnak] = useState<ZnakNaUlici>("brzina");
  const [brzina, setBrzina] = useState(40);
  const [naprijedZnak, setNaprijedZnak] = useState(true);
  useEffect(() => {
    setPolja(pocetna);
    setMijenjano(new Set());
  }, [pocetna]);
  const polje = <K extends keyof typeof polja>(k: K, v: (typeof polja)[K]) => {
    setPolja({ ...polja, [k]: v });
    setMijenjano(new Set([...mijenjano, k as keyof PoljaDionice]));
  };
  const sidro = sidroNaIvici(m, iv.i, pogodak.s, true);
  const dodaj = (iz: Izmjena) => primijeni(postavi(overlay, iz));

  const primijeniDionicu = () => {
    const p = potpis();
    if (!p) return;
    // Polja koja je postojeća izmjena dionice već mijenjala, i ona promijenjena
    // sad — vrijednosti iz formulara (koji je popunjen trenutnim stanjem, u
    // pravcu strelice na karti). Nova izmjena zamjenjuje staru.
    const kljucevi = new Set<keyof PoljaDionice>([...mijenjano]);
    if (postojece) for (const k of Object.keys(postojece) as (keyof PoljaDionice)[]) if (k in pocetna) kljucevi.add(k);
    const nova: Record<string, unknown> = {};
    for (const k of kljucevi) nova[k] = polja[k as keyof typeof polja];
    let o = overlay;
    if (postojece) o = ukloni(o, postojece.id);
    primijeni(postavi(o, { id: noviId(), ...p, vrsta: "dionica", ulica: sidro, ...(nova as PoljaDionice) }));
  };

  return (
    <div className="space-y-2">
      <p className={naslov}>
        {iv.ime || "Ulica bez imena"} <span className="font-normal text-muted">({iv.klasa}, OSM {iv.osm || "editor"}, {dionica.length} komada)</span>
      </p>
      <p className="text-muted">„Naprijed“ = u smjeru crvene strelice na karti. Izmjena važi za cijelu dionicu do raskrsnica (žuto).</p>
      <div className="grid grid-cols-2 gap-1">
        <label>
          Smjer
          <select value={polja.smjer} onChange={(e) => polje("smjer", e.target.value as typeof polja.smjer)} className="w-full rounded border border-line">
            <option value="oba">dvosmjerna</option>
            <option value="naprijed">jednosmjerna naprijed</option>
            <option value="nazad">jednosmjerna nazad</option>
          </select>
        </label>
        <label>
          Klasa
          <select value={polja.klasa} onChange={(e) => polje("klasa", e.target.value)} className="w-full rounded border border-line">
            {[...new Set([polja.klasa, ...KLASE])].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          Trake naprijed
          <input type="number" min={0} max={8} value={polja.trakeNaprijed} onChange={(e) => polje("trakeNaprijed", Number(e.target.value))} className="w-full rounded border border-line px-1" />
        </label>
        <label>
          Trake nazad
          <input type="number" min={0} max={8} value={polja.trakeNazad} onChange={(e) => polje("trakeNazad", Number(e.target.value))} className="w-full rounded border border-line px-1" />
        </label>
        <label className="col-span-2">
          Strelice naprijed (lijevo→desno, npr. left|through;right)
          <input value={polja.skretanjaNaprijed} onChange={(e) => polje("skretanjaNaprijed", e.target.value)} className="w-full rounded border border-line px-1" />
        </label>
        <label className="col-span-2">
          Strelice nazad
          <input value={polja.skretanjaNazad} onChange={(e) => polje("skretanjaNazad", e.target.value)} className="w-full rounded border border-line px-1" />
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={polja.busNaprijed} onChange={(e) => polje("busNaprijed", e.target.checked)} />
          Bus traka naprijed
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={polja.busNazad} onChange={(e) => polje("busNazad", e.target.checked)} />
          Bus traka nazad
        </label>
        <label>
          Razdjelna linija
          <select value={polja.linija} onChange={(e) => polje("linija", e.target.value as typeof polja.linija)} className="w-full rounded border border-line">
            <option value="isprekidana">isprekidana</option>
            <option value="puna">puna</option>
            <option value="dvostruka">dvostruka puna</option>
            <option value="bez">bez linije</option>
          </select>
        </label>
        <label>
          Puna pred raskrsnicom [m]
          <input type="number" min={0} max={250} value={polja.punaPrije} onChange={(e) => polje("punaPrije", Number(e.target.value))} className="w-full rounded border border-line px-1" />
        </label>
        <label>
          Pune između traka pred raskrsnicom [m]
          <input type="number" min={0} max={250} value={polja.trakePrije} onChange={(e) => polje("trakePrije", Number(e.target.value))} className="w-full rounded border border-line px-1" />
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={polja.zatvorena} onChange={(e) => polje("zatvorena", e.target.checked)} />
          Zatvorena (gradilište, pješačka zona)
        </label>
        <label className="col-span-2">
          Ime
          <input value={polja.ime} onChange={(e) => polje("ime", e.target.value)} className="w-full rounded border border-line px-1" />
        </label>
      </div>
      <button type="button" className={dugmeGlavno} disabled={mijenjano.size === 0} onClick={primijeniDionicu}>
        Primijeni na dionicu
      </button>

      <div className="space-y-1 rounded border border-line p-1">
        <p className="font-semibold">Na kliknutom mjestu</p>
        <div className="flex flex-wrap items-center gap-1">
          <select value={znak} onChange={(e) => setZnak(e.target.value as ZnakNaUlici)} className="rounded border border-line">
            {ZNAKOVI.map(([z, ime]) => (
              <option key={z} value={z}>
                {ime}
              </option>
            ))}
          </select>
          {znak === "brzina" && (
            <input type="number" min={10} max={130} step={10} value={brzina} onChange={(e) => setBrzina(Number(e.target.value))} className="w-14 rounded border border-line px-1" />
          )}
          <select value={naprijedZnak ? "n" : "z"} onChange={(e) => setNaprijedZnak(e.target.value === "n")} className="rounded border border-line">
            <option value="n">za vožnju naprijed</option>
            <option value="z">za vožnju nazad</option>
          </select>
          <button
            type="button"
            className={dugme}
            onClick={() => {
              const p = potpis();
              if (p)
                dodaj({ id: noviId(), ...p, vrsta: "znak", znak, mjesto: sidroNaIvici(m, iv.i, pogodak.s, naprijedZnak), brzina: znak === "brzina" ? brzina : null });
            }}
          >
            Postavi znak
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className={dugme}
            onClick={() => {
              const p = potpis();
              if (p) dodaj({ id: noviId(), ...p, vrsta: "prelaz", mjesto: sidro, ukloni: false });
            }}
          >
            Dodaj pješački prelaz
          </button>
          <button
            type="button"
            className={dugme}
            onClick={() => {
              const p = potpis();
              if (p) dodaj({ id: noviId(), ...p, vrsta: "prelaz", mjesto: sidro, ukloni: true });
            }}
          >
            Ukloni pješački prelaz
          </button>
          <button
            type="button"
            className="rounded border border-red px-2 py-0.5 text-red"
            onClick={() => {
              const p = potpis();
              if (p) dodaj({ id: noviId(), ...p, vrsta: "ukloniUlicu", ulica: sidro });
            }}
          >
            Ukloni ovaj komad ulice (greška u OSM-u)
          </button>
        </div>
      </div>
      <Izmjene
        izmjene={overlay.izmjene.filter((x) => (x.vrsta === "dionica" && x.id === postojece?.id) || ((x.vrsta === "znak" || x.vrsta === "prelaz") && najblizaUlica(m, x.mjesto, 8)?.ivica === iv.i))}
        overlay={overlay}
        primijeni={primijeni}
      />
    </div>
  );
}

// ── čvor, nova ulica ─────────────────────────────────────────────────────

export function PanelCvora({ svijet, overlay, primijeni, potpis, izbor, nacrt, ocisti }: Zajednicko & { izbor: Pogodak | null; nacrt: Nacrt; ocisti: () => void }) {
  if (izbor?.vrsta !== "cvor") return <p className="text-muted">Klikni čvor (tačke na karti kad je zum dovoljan), pa novo mjesto.</p>;
  const c = svijet.mreza.cvorovi[izbor.cvor]!;
  const na = nacrt.tacke[nacrt.tacke.length - 1];
  return (
    <div className="space-y-2">
      <p className={naslov}>
        Čvor @ {c.x.toFixed(1)}, {c.y.toFixed(1)}
      </p>
      <p className="text-muted">{na ? `Novo mjesto: ${na.x.toFixed(1)}, ${na.y.toFixed(1)}` : "Klikni novo mjesto na karti."}</p>
      <button
        type="button"
        className={dugmeGlavno}
        disabled={!na}
        onClick={() => {
          const p = potpis();
          if (!p || !na) return;
          primijeni(postavi(overlay, { id: noviId(), ...p, vrsta: "cvor", cvor: tackaOverlaya(c), na: tackaOverlaya(na) }));
          ocisti();
        }}
      >
        Pomjeri čvor
      </button>
      <button type="button" className={dugme} onClick={ocisti}>
        Odustani
      </button>
    </div>
  );
}

export function PanelNoveUlice({
  overlay,
  primijeni,
  potpis,
  nacrt,
  setNacrt,
}: Omit<Zajednicko, "svijet"> & { nacrt: Nacrt; setNacrt: (n: Nacrt) => void }) {
  const [klasa, setKlasa] = useState("residential");
  const [ime, setIme] = useState("");
  const [smjer, setSmjer] = useState<0 | 1>(0);
  const [trake, setTrake] = useState(2);
  return (
    <div className="space-y-2">
      <p className={naslov}>Nova ulica</p>
      <p className="text-muted">
        Klikni tačke redom ({nacrt.tacke.length}). Kraj na postojećoj ulici je dijeli (nova raskrsnica); kraj na čvoru se veže za njega.
      </p>
      <div className="grid grid-cols-2 gap-1">
        <label>
          Klasa
          <select value={klasa} onChange={(e) => setKlasa(e.target.value)} className="w-full rounded border border-line">
            {KLASE.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          Trake ukupno
          <input type="number" min={1} max={8} value={trake} onChange={(e) => setTrake(Number(e.target.value))} className="w-full rounded border border-line px-1" />
        </label>
        <label className="col-span-2">
          Ime
          <input value={ime} onChange={(e) => setIme(e.target.value)} className="w-full rounded border border-line px-1" />
        </label>
        <label className="col-span-2 flex items-center gap-1">
          <input type="checkbox" checked={smjer === 1} onChange={(e) => setSmjer(e.target.checked ? 1 : 0)} />
          Jednosmjerna, od prve tačke ka zadnjoj
        </label>
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          className={dugmeGlavno}
          disabled={nacrt.tacke.length < 2}
          onClick={() => {
            const p = potpis();
            if (!p) return;
            primijeni(postavi(overlay, { id: noviId(), ...p, vrsta: "novaUlica", tacke: nacrt.tacke.map(tackaOverlaya), klasa, ime, smjer, trake }));
            setNacrt({ tacke: [] });
          }}
        >
          Dodaj ulicu
        </button>
        <button type="button" className={dugme} onClick={() => setNacrt({ tacke: nacrt.tacke.slice(0, -1) })}>
          Ukloni zadnju tačku
        </button>
      </div>
    </div>
  );
}

// ── zone ─────────────────────────────────────────────────────────────────

export function PanelZona({
  svijet,
  overlay,
  primijeni,
  potpis,
  zonaId,
  setZonaId,
  nacrt,
  setNacrt,
  skoci,
}: Zajednicko & { zonaId: string | null; setZonaId: (id: string | null) => void; nacrt: Nacrt; setNacrt: (n: Nacrt) => void; skoci: (p: Point) => void }) {
  const zona = svijet.zone.find((z) => z.id === zonaId) ?? null;
  const [polja, setPolja] = useState<Zona | null>(zona);
  useEffect(() => setPolja(zona), [zona]);
  return (
    <div className="space-y-2">
      <p className={naslov}>Zone</p>
      <ul className="space-y-0.5">
        {svijet.zone.map((z) => (
          <li key={z.id}>
            <button
              type="button"
              className={`w-full rounded border px-1 text-left ${z.id === zonaId ? "border-blue" : "border-line"}`}
              onClick={() => {
                setZonaId(z.id);
                setNacrt({ tacke: [] });
                if (z.poligon.length) skoci({ x: z.poligon[0]![0], y: z.poligon[0]![1] });
              }}
            >
              {z.ime} <span className="text-muted">· {z.poligon.length ? `${z.poligon.length} tjemena` : "nije nacrtana"}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={dugme}
        onClick={() => {
          const id = `zona-${Date.now().toString(36)}`;
          setPolja({ id, ime: "Nova zona", poligon: [], paleta: null, speedLimit: null, pedestrianDensity: null, trafficDensity: null, handAuthored: true });
          setZonaId(id);
        }}
      >
        Nova zona
      </button>
      {polja && (
        <div className="space-y-1 rounded border border-line p-1">
          <label className="block">
            Ime
            <input value={polja.ime} onChange={(e) => setPolja({ ...polja, ime: e.target.value })} className="w-full rounded border border-line px-1" />
          </label>
          {(
            [
              ["speedLimit", "Ograničenje brzine [km/h] (znak zone na ulazu)"],
              ["pedestrianDensity", "Gustina pješaka (0–3)"],
              ["trafficDensity", "Gustina saobraćaja (0–3)"],
            ] as const
          ).map(([k, ime]) => (
            <label key={k} className="block">
              {ime}
              <input
                type="number"
                min={0}
                value={polja[k] ?? ""}
                onChange={(e) => setPolja({ ...polja, [k]: e.target.value === "" ? null : Number(e.target.value) })}
                className="w-full rounded border border-line px-1"
              />
            </label>
          ))}
          <label className="block">
            Paleta zgrada
            <input value={polja.paleta ?? ""} onChange={(e) => setPolja({ ...polja, paleta: e.target.value || null })} className="w-full rounded border border-line px-1" />
          </label>
          <p className="text-muted">
            Poligon: klikni tjemena na karti ({nacrt.tacke.length} novih). Bez novih tjemena ostaje postojeći ({polja.poligon.length}).
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              className={dugmeGlavno}
              onClick={() => {
                const p = potpis();
                if (!p) return;
                const poligon: [number, number][] = nacrt.tacke.length >= 3 ? nacrt.tacke.map((t) => [Math.round(t.x * 100) / 100, Math.round(t.y * 100) / 100]) : polja.poligon;
                primijeni(postavi(overlay, { id: noviId(), ...p, vrsta: "zona", zona: { ...polja, poligon, handAuthored: true } }));
                setNacrt({ tacke: [] });
              }}
            >
              Sačuvaj zonu
            </button>
            <button type="button" className={dugme} onClick={() => setNacrt({ tacke: nacrt.tacke.slice(0, -1) })}>
              Ukloni zadnje tjeme
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── zadaci ───────────────────────────────────────────────────────────────

/** Korak rute za tačku: najbliža ulica za bota, u smjeru ka sljedećoj tački (ili od prethodne). */
function korakZa(svijet: SvijetGrada, p: Point, ka: Point | null, od: Point | null): Korak | null {
  const u = najblizaUlica(svijet.mreza, p, 15);
  if (!u) return null;
  const iv = svijet.mreza.ivice[u.ivica]!;
  if (!ZA_BOTA(iv)) return null;
  const v = ka ? { x: ka.x - p.x, y: ka.y - p.y } : od ? { x: p.x - od.x, y: p.y - od.y } : u.pravac;
  let smjer: 1 | -1 = v.x * u.pravac.x + v.y * u.pravac.y >= 0 ? 1 : -1;
  if (iv.smjer !== 0) smjer = iv.smjer as 1 | -1;
  return { ivica: u.ivica, smjer };
}

export function PanelZadataka({
  svijet,
  overlay,
  primijeni,
  potpis,
  zadatakId,
  setZadatakId,
  nacrt,
  setNacrt,
}: Zajednicko & { zadatakId: string | null; setZadatakId: (id: string | null) => void; nacrt: Nacrt; setNacrt: (n: Nacrt) => void }) {
  const zadaci = zadaciGrada(overlay);
  const [ime, setIme] = useState("Nova ruta");
  const [vrsta, setVrsta] = useState<Zadatak["vrsta"]>("ispitna");
  const [manevri, setManevri] = useState<Record<number, Zadatak["manevri"][number]["vrsta"] | "">>({});
  const t = nacrt.tacke;

  // Pregled rute: A* bota od tačke do tačke (iste zabrane kao u vožnji).
  const pregled = useMemo(() => {
    if (t.length < 2) return { duzina: 0, ruta: undefined as Point[] | undefined, greska: "" };
    const koraci: Korak[] = [];
    for (let i = 0; i + 1 < t.length; i++) {
      const od = korakZa(svijet, t[i]!, t[i + 1]!, i > 0 ? t[i - 1]! : null);
      const do_ = korakZa(svijet, t[i + 1]!, t[i + 2] ?? null, t[i]!);
      if (!od || !do_) return { duzina: 0, ruta: undefined, greska: `Tačka ${i + 1}: nema vozne ulice blizu.` };
      const dio = od.ivica === do_.ivica && od.smjer === do_.smjer ? [od] : ruta(svijet.mreza, svijet.raskrsnice, svijet.zabrane, od, do_);
      if (!dio) return { duzina: 0, ruta: undefined, greska: `Između tačaka ${i + 1} i ${i + 2} nema propisne rute.` };
      koraci.push(...(koraci.length ? dio.slice(1) : dio));
    }
    const linija: Point[] = [];
    let duzina = 0;
    for (const k of koraci) {
      const iv = svijet.mreza.ivice[k.ivica]!;
      linija.push(...(k.smjer === 1 ? iv.tacke : [...iv.tacke].reverse()));
      duzina += iv.duzina;
    }
    return { duzina, ruta: linija, greska: "" };
  }, [svijet, t]);
  useEffect(() => {
    if (pregled.ruta !== nacrt.ruta) setNacrt({ ...nacrt, ruta: pregled.ruta });
    // `nacrt` se mijenja samo ovdje i klikom; ruta zavisi od tačaka.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pregled]);

  const sidroTacke = (p: Point, ka: Point | null, od: Point | null) => {
    const k = korakZa(svijet, p, ka, od);
    const u = najblizaUlica(svijet.mreza, p, 15);
    return k && u ? sidroNaIvici(svijet.mreza, k.ivica, u.s, k.smjer === 1) : null;
  };

  return (
    <div className="space-y-2">
      <p className={naslov}>Zadaci (rute)</p>
      <ul className="space-y-0.5">
        {zadaci.map((z) => (
          <li key={z.id} className="flex items-center gap-1">
            <span className="flex-1">
              {z.ime} <span className="text-muted">· {z.vrsta} · {z.tacke.length + 2} tačaka</span>
            </span>
            <button
              type="button"
              className="text-red"
              onClick={() => {
                const iz = overlay.izmjene.find((x) => x.vrsta === "zadatak" && x.zadatak.id === z.id);
                if (iz) primijeni(ukloni(overlay, iz.id));
              }}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <p className="text-muted">Klikni start, obavezne tačke redom, pa cilj ({t.length} tačaka). Zelena linija je ruta koju bi bot vozio.</p>
      {pregled.greska && <p className="text-red">{pregled.greska}</p>}
      {pregled.ruta && <p>Dužina rute: {(pregled.duzina / 1000).toFixed(2)} km</p>}
      <label className="block">
        Ime
        <input value={ime} onChange={(e) => setIme(e.target.value)} className="w-full rounded border border-line px-1" />
      </label>
      <select value={vrsta} onChange={(e) => setVrsta(e.target.value as Zadatak["vrsta"])} className="rounded border border-line">
        <option value="ispitna">ispitna ruta</option>
        <option value="odDo">vožnja od–do</option>
      </select>
      {t.slice(1, -1).map((_, i) => (
        <label key={i} className="flex items-center gap-1">
          Tačka {i + 1}:
          <select
            value={manevri[i + 1] ?? ""}
            onChange={(e) => setManevri({ ...manevri, [i + 1]: e.target.value as Zadatak["manevri"][number]["vrsta"] | "" })}
            className="rounded border border-line"
          >
            <option value="">obavezna tačka</option>
            <option value="parkiranje">manevar: parkiranje</option>
            <option value="polukruzno">manevar: polukružno</option>
            <option value="uspon">manevar: kretanje uz uspon</option>
          </select>
        </label>
      ))}
      <div className="flex gap-1">
        <button
          type="button"
          className={dugmeGlavno}
          disabled={t.length < 2 || !!pregled.greska}
          onClick={() => {
            const p = potpis();
            if (!p) return;
            const s = (i: number) => sidroTacke(t[i]!, t[i + 1] ?? null, t[i - 1] ?? null);
            const start = s(0);
            const cilj = s(t.length - 1);
            if (!start || !cilj) return;
            const id = zadatakId ?? `zadatak-${Date.now().toString(36)}`;
            const tacke = t.slice(1, -1).flatMap((_, i) => (manevri[i + 1] ? [] : [s(i + 1)!]));
            const man = t.slice(1, -1).flatMap((_, i) => (manevri[i + 1] ? [{ vrsta: manevri[i + 1] as Zadatak["manevri"][number]["vrsta"], mjesto: s(i + 1)! }] : []));
            primijeni(postavi(overlay, { id: noviId(), ...p, vrsta: "zadatak", zadatak: { id, ime, vrsta, start, cilj, tacke, manevri: man } }));
            setNacrt({ tacke: [] });
            setZadatakId(null);
          }}
        >
          Sačuvaj zadatak
        </button>
        <button type="button" className={dugme} onClick={() => setNacrt({ tacke: t.slice(0, -1) })}>
          Ukloni zadnju tačku
        </button>
      </div>
    </div>
  );
}
