"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Point } from "@/lib/game/sim/types";
import {
  listaZnakova,
  pogodi,
  procitajKoordinate,
  tackaIzmjene,
  traziUlice,
  ukloni,
  upozorenja,
  type Pogodak,
  type Potpis,
} from "@/lib/game/grad/editorAlati";
import { prazanOverlay, zapisiOverlay, type Overlay, type Zona } from "@/lib/game/grad/overlay";
import { procitaj, type Paket } from "@/lib/game/grad/paket";
import { svijetGrada, type SvijetGrada } from "@/lib/game/grad/svijet";
import { ucitajOverlay } from "@/lib/game/grad/ucitajOverlay";
import type { BojeDekora } from "@/lib/game/grad/dekor";
import type { Palete } from "@/lib/game/grad/zgrade";
import type { BojeOsvjetljenja, GradRenderer } from "@/lib/game/ui/gradRenderer";
import { dprUredjaja } from "@/lib/game/ui/renderer";
import { crtajPreklop, type Nacrt } from "./preklop";
import { PanelKraka, PanelRaskrsnice, PanelUlice, PanelZadataka, PanelZona, PanelNoveUlice, PanelCvora } from "./paneli";

/**
 * Editor grada (faza 6, stavka 6) — samo uz `npm run dev`, otvara se sa
 * `/igra?editor=1`. Radi nad istim svijetom kao igra (OSM paket + overlay),
 * kamera se slobodno pomjera i zumira, sjever je gore. Svaka izmjena odmah
 * pravi novi svijet (oko 0,1 s) i vidi se onako kako će se voziti i suditi.
 *
 * Izmjene se čuvaju u overlay (`public/data/grad/overrides/<grad>.json`) preko
 * razvojne rute sa lozinkom (`GRAD_EDITOR_LOZINKA`); dok se ne sačuvaju,
 * nacrt je u ovom browseru. Uputstvo: `docs/grad-editor.md`.
 *
 * Interni alat (kao editor kazni): tekstovi su samo na crnogorskom.
 */

const GRAD = "podgorica";
const NACRT = `grad-editor-nacrt-${GRAD}`;
const AUTOR = "grad-editor-autor";
const LOZINKA = "grad-editor-lozinka";

export type Rezim = "odaberi" | "cvor" | "ulica" | "zona" | "zadatak";

interface Kamera {
  wx: number;
  wy: number;
  /** Piksela po metru. */
  scale: number;
}

const ucitajLokalno = (k: string, sesija = false): string => {
  try {
    return (sesija ? sessionStorage : localStorage).getItem(k) ?? "";
  } catch {
    return "";
  }
};
const sacuvajLokalno = (k: string, v: string, sesija = false) => {
  try {
    if (v) (sesija ? sessionStorage : localStorage).setItem(k, v);
    else (sesija ? sessionStorage : localStorage).removeItem(k);
  } catch {
    /* privatni prozor — nacrt se ne pamti */
  }
};

export default function GradEditor() {
  const [osm, setOsm] = useState<Paket | null>(null);
  const [sablon, setSablon] = useState<Zona[]>([]);
  const [palete, setPalete] = useState<(Palete & { dekor: BojeDekora; osvjetljenje: BojeOsvjetljenja }) | null>(null);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [sacuvan, setSacuvan] = useState<string>("");
  const [nazad, setNazad] = useState<Overlay[]>([]);
  const [naprijed, setNaprijed] = useState<Overlay[]>([]);
  const [greska, setGreska] = useState<string>("");
  const [poruka, setPoruka] = useState<string>("");
  const [nacrtNadjen, setNacrtNadjen] = useState<Overlay | null>(null);
  const [autor, setAutor] = useState("");
  const [lozinka, setLozinka] = useState("");
  const [rezim, setRezim] = useState<Rezim>("odaberi");
  const [izbor, setIzbor] = useState<Pogodak | null>(null);
  const [nacrt, setNacrt] = useState<Nacrt>({ tacke: [] });
  const [zonaId, setZonaId] = useState<string | null>(null);
  const [zadatakId, setZadatakId] = useState<string | null>(null);
  const [lista, setLista] = useState<"izmjene" | "izvedeno" | "upozorenja">("izmjene");
  const [upit, setUpit] = useState("");
  const [koord, setKoord] = useState("");
  const [vrijeme, setVrijeme] = useState(0);
  const [tece, setTece] = useState(false);
  const [prikaziIzvedeno, setPrikaziIzvedeno] = useState(true);

  const platnoRef = useRef<HTMLCanvasElement | null>(null);
  const preklopRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<GradRenderer | null>(null);
  /** Vrijeme semafora u pregledu — teče u petlji; stanje (klizač) se osvježava rjeđe. */
  const vrijemeRef = useRef(0);
  const kameraRef = useRef<Kamera>({ wx: 0, wy: 0, scale: 6 });
  const stanjeRef = useRef<{ svijet: SvijetGrada | null; izbor: Pogodak | null; nacrt: Nacrt; vrijeme: number; prikaziIzvedeno: boolean; rezim: Rezim }>({
    svijet: null,
    izbor: null,
    nacrt: { tacke: [] },
    vrijeme: 0,
    prikaziIzvedeno: true,
    rezim: "odaberi",
  });

  // ── učitavanje ──────────────────────────────────────────────────────────
  useEffect(() => {
    setAutor(ucitajLokalno(AUTOR));
    setLozinka(ucitajLokalno(LOZINKA, true));
    (async () => {
      const json = async <T,>(url: string): Promise<T> => {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
        return (await r.json()) as T;
      };
      const [spisak, pal, zone, ov] = await Promise.all([
        json<Record<string, { fajl: string }>>("/data/grad/gradovi.json"),
        json<Palete & { dekor: BojeDekora; osvjetljenje: BojeOsvjetljenja }>("/data/grad/palete.json"),
        json<{ zone: Zona[] }>(`/data/grad/cityZones/${GRAD}.json`),
        ucitajOverlay(GRAD),
      ]);
      const r = await fetch(`/data/grad/${spisak[GRAD]!.fajl}`);
      const paket = procitaj(await r.arrayBuffer());
      const { lat, lon } = paket.zaglavlje.ishodiste;
      const pocetni = ov ?? prazanOverlay(GRAD, { lat, lon });
      setOsm(paket);
      setSablon(zone.zone);
      setPalete(pal);
      setOverlay(pocetni);
      setSacuvan(zapisiOverlay(pocetni));
      // Nesačuvan nacrt iz prošlog rada u ovom browseru.
      const tekst = ucitajLokalno(NACRT);
      if (tekst && tekst !== zapisiOverlay(pocetni)) {
        try {
          setNacrtNadjen(JSON.parse(tekst) as Overlay);
        } catch {
          /* pokvaren nacrt se ignoriše */
        }
      }
    })().catch((e: unknown) => setGreska(`Grad nije učitan: ${(e as Error).message}`));
  }, []);

  const svijet = useMemo(() => {
    if (!osm || !overlay) return null;
    try {
      return svijetGrada(osm, overlay, sablon);
    } catch (e) {
      setGreska(`Overlay se ne može primijeniti: ${(e as Error).message}`);
      return null;
    }
  }, [osm, overlay, sablon]);

  const listaUpozorenja = useMemo(() => (svijet && overlay ? upozorenja(svijet, overlay) : []), [svijet, overlay]);

  stanjeRef.current = { svijet, izbor, nacrt, vrijeme, prikaziIzvedeno, rezim };

  // ── renderer: jednom, pa zamjena svijeta poslije svake izmjene ─────────
  useEffect(() => {
    if (!svijet || !palete) return;
    const pravila = { raskrsnice: svijet.raskrsnice, crtez: svijet.crtez, produzeci: svijet.zaSudiju.produzeci };
    const izgled = { palete, zone: svijet.zone };
    if (rendererRef.current) {
      rendererRef.current.zamijeni(svijet.paket, svijet.povrsina, izgled, pravila);
      return;
    }
    let otkazano = false;
    (async () => {
      const { createGradRenderer } = await import("@/lib/game/ui/gradRenderer");
      const canvas = platnoRef.current;
      if (!canvas) return;
      const r = await createGradRenderer(canvas, svijet.paket, svijet.povrsina, izgled, pravila);
      if (otkazano) r?.destroy();
      else if (!r) setGreska("Ovaj browser ne daje WebGL.");
      else rendererRef.current = r;
    })();
    return () => {
      otkazano = true;
    };
  }, [svijet, palete]);

  useEffect(() => () => rendererRef.current?.destroy(), []);

  // ── petlja crtanja ──────────────────────────────────────────────────────
  useEffect(() => {
    let raf = 0;
    let zadnje = 0;
    const kadar = (sada: number) => {
      raf = requestAnimationFrame(kadar);
      const canvas = platnoRef.current;
      const preklop = preklopRef.current;
      if (!canvas || !preklop) return;
      const { width: W, height: H } = canvas.getBoundingClientRect();
      const dpr = dprUredjaja();
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        rendererRef.current?.resize(W, H, dpr);
        preklop.width = Math.round(W * dpr);
        preklop.height = Math.round(H * dpr);
      }
      // Pregled ciklusa semafora: vrijeme teče kad je uključeno; klizač se
      // osvježava četiri puta u sekundi (React stanje svakog kadra bi
      // ponovo crtalo cijeli panel).
      if (tece && zadnje) {
        vrijemeRef.current = (vrijemeRef.current + (sada - zadnje) / 1000) % 600;
        if (Math.floor(sada / 250) !== Math.floor(zadnje / 250)) setVrijeme(vrijemeRef.current);
      }
      zadnje = sada;
      const k = kameraRef.current;
      rendererRef.current?.draw({
        kadar: { wx: k.wx, wy: k.wy, cx: W / 2, cy: H / 2, rot: -Math.PI, scale: k.scale },
        simT: vrijemeRef.current,
        osvjetljenje: { doba: "dan", kisa: false, sekunde: sada / 1000 },
        igrac: null,
      });
      const g = preklop.getContext("2d");
      if (g && stanjeRef.current.svijet) {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, W, H);
        crtajPreklop(g, { ...k, W, H }, stanjeRef.current.svijet, stanjeRef.current);
      }
    };
    raf = requestAnimationFrame(kadar);
    return () => cancelAnimationFrame(raf);
  }, [tece]);

  // ── izmjene, poništi, nacrt ─────────────────────────────────────────────
  const potpis = useCallback((): Potpis | null => {
    if (!autor.trim()) {
      setGreska("Upiši svoje ime (polje „Autor“) — ono ide uz svaku izmjenu.");
      return null;
    }
    return { autor: autor.trim(), datum: new Date().toISOString() };
  }, [autor]);

  const primijeni = useCallback(
    (novi: Overlay) => {
      if (!overlay) return;
      setNazad((n) => [...n.slice(-99), overlay]);
      setNaprijed([]);
      setOverlay(novi);
      setGreska("");
      sacuvajLokalno(NACRT, zapisiOverlay(novi));
    },
    [overlay],
  );
  const ponisti = () => {
    const prosli = nazad[nazad.length - 1];
    if (!prosli || !overlay) return;
    setNazad(nazad.slice(0, -1));
    setNaprijed([overlay, ...naprijed]);
    setOverlay(prosli);
    sacuvajLokalno(NACRT, zapisiOverlay(prosli));
  };
  const ponovi = () => {
    const sljedeci = naprijed[0];
    if (!sljedeci || !overlay) return;
    setNaprijed(naprijed.slice(1));
    setNazad([...nazad, overlay]);
    setOverlay(sljedeci);
    sacuvajLokalno(NACRT, zapisiOverlay(sljedeci));
  };

  const sacuvaj = async () => {
    if (!overlay) return;
    if (!lozinka) {
      setGreska("Upiši lozinku editora (GRAD_EDITOR_LOZINKA iz .env.local).");
      return;
    }
    setPoruka("Čuvam…");
    try {
      const r = await fetch("/api/grad-editor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ grad: GRAD, lozinka, overlay }),
      });
      const telo = (await r.json()) as { ok: boolean; greska?: string; bajtova?: number };
      if (!telo.ok) {
        setPoruka("");
        setGreska(`Nije sačuvano: ${telo.greska ?? `HTTP ${r.status}`}`);
        return;
      }
      sacuvajLokalno(LOZINKA, lozinka, true);
      setGreska("");
      setSacuvan(zapisiOverlay(overlay));
      sacuvajLokalno(NACRT, "");
      setPoruka(`Sačuvano: ${overlay.izmjene.length} izmjena (${Math.round((telo.bajtova ?? 0) / 1024)} kB). Fajl je u repozitorijumu — pošalji ga commit-om.`);
    } catch (e) {
      setPoruka("");
      setGreska(`Nije sačuvano: ${(e as Error).message}`);
    }
  };

  const izvezi = () => {
    if (!svijet || !overlay) return;
    const blob = new Blob(["﻿", listaZnakova(svijet, overlay)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `znakovi-${GRAD}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const skoci = (p: Point, zum = 8) => {
    kameraRef.current = { wx: p.x, wy: p.y, scale: Math.max(kameraRef.current.scale, zum) };
  };

  // ── miš: povlačenje pomjera, točkić zumira, klik bira ──────────────────
  const povlacenje = useRef<{ x: number; y: number; wx: number; wy: number; pomjeren: boolean } | null>(null);
  const uSvijet = (e: { clientX: number; clientY: number }): Point => {
    const r = preklopRef.current!.getBoundingClientRect();
    const k = kameraRef.current;
    return { x: k.wx + (e.clientX - r.left - r.width / 2) / k.scale, y: k.wy + (e.clientY - r.top - r.height / 2) / k.scale };
  };
  const klik = (p: Point) => {
    if (!svijet) return;
    if (rezim === "ulica" || rezim === "zona" || (rezim === "cvor" && izbor?.vrsta === "cvor")) {
      setNacrt((n) => ({ ...n, tacke: [...n.tacke, { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 }] }));
      return;
    }
    if (rezim === "zadatak") {
      const h = pogodi(svijet, p);
      setNacrt((n) => ({ ...n, tacke: [...n.tacke, p], pogodak: h ?? undefined }));
      return;
    }
    setIzbor(pogodi(svijet, p, rezim === "cvor"));
  };

  if (greska && !svijet) return <p className="rounded border border-red bg-red-soft p-3 text-sm">{greska}</p>;

  const izmijenjeno = overlay ? zapisiOverlay(overlay) !== sacuvan : false;
  const pogoci = upit ? traziUlice(svijet?.mreza ?? { cvorovi: [], ivice: [], izCvora: [] }, upit) : [];
  const izvedene = svijet
    ? svijet.raskrsnice.lista
        .filter((r) => r.inferredPriority || r.inferredPhases)
        .map((r) => ({ r, d: Math.hypot(r.centar.x - kameraRef.current.wx, r.centar.y - kameraRef.current.wy) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 60)
    : [];
  const brojIzvedenih = svijet ? svijet.raskrsnice.lista.filter((r) => r.inferredPriority || r.inferredPhases).length : 0;

  // Preko cijelog ekrana: editor treba veliku kartu, a stranica igre je uska kolona.
  return (
    <div className="fixed inset-0 z-50 space-y-2 overflow-auto bg-paper p-2 text-sm">
      <div className="flex flex-wrap items-center gap-2 rounded border border-line bg-panel p-2">
        <strong>Editor grada — Podgorica</strong>
        <label className="flex items-center gap-1">
          Autor
          <input
            value={autor}
            onChange={(e) => {
              setAutor(e.target.value);
              sacuvajLokalno(AUTOR, e.target.value);
            }}
            className="w-32 rounded border border-line px-1"
            placeholder="ime i prezime"
          />
        </label>
        {(
          [
            ["odaberi", "Odaberi"],
            ["cvor", "Pomjeri čvor"],
            ["ulica", "Nova ulica"],
            ["zona", "Zone"],
            ["zadatak", "Zadaci"],
          ] as const
        ).map(([r, ime]) => (
          <button
            key={r}
            type="button"
            aria-pressed={rezim === r}
            onClick={() => {
              setRezim(r);
              setIzbor(null);
              setNacrt({ tacke: [] });
            }}
            className={`rounded border px-2 py-0.5 font-semibold ${rezim === r ? "border-blue bg-blue text-white" : "border-line bg-paper"}`}
          >
            {ime}
          </button>
        ))}
        <button type="button" onClick={ponisti} disabled={!nazad.length} className="rounded border border-line px-2 py-0.5 disabled:opacity-40">
          ↶ Poništi
        </button>
        <button type="button" onClick={ponovi} disabled={!naprijed.length} className="rounded border border-line px-2 py-0.5 disabled:opacity-40">
          ↷ Ponovi
        </button>
        <label className="flex items-center gap-1">
          Lozinka
          <input type="password" value={lozinka} onChange={(e) => setLozinka(e.target.value)} className="w-24 rounded border border-line px-1" />
        </label>
        <button type="button" onClick={sacuvaj} className={`rounded px-2 py-0.5 font-semibold text-white ${izmijenjeno ? "bg-blue" : "bg-muted"}`}>
          Sačuvaj{izmijenjeno ? " *" : ""}
        </button>
        <button type="button" onClick={izvezi} className="rounded border border-line px-2 py-0.5">
          Izvezi listu znakova (CSV)
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1">
          Ulica
          <input value={upit} onChange={(e) => setUpit(e.target.value)} className="w-44 rounded border border-line px-1" placeholder="pretraga po imenu" />
        </label>
        {pogoci.map((x) => (
          <button key={x.ime} type="button" onClick={() => skoci(x.tacka)} className="rounded border border-line bg-paper px-1">
            {x.ime}
          </button>
        ))}
        <label className="flex items-center gap-1">
          Koordinate
          <input
            value={koord}
            onChange={(e) => setKoord(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || !overlay) return;
              const p = procitajKoordinate(koord, overlay.ishodiste);
              if (p) skoci(p);
              else setGreska("Koordinate: „x, y“ u metrima ili „42.44, 19.26“.");
            }}
            className="w-40 rounded border border-line px-1"
            placeholder="42.4411, 19.2627 ↵"
          />
        </label>
        <label className="flex items-center gap-1">
          Semafori u
          <input
            type="range"
            min={0}
            max={180}
            step={0.5}
            value={vrijeme}
            onChange={(e) => {
              vrijemeRef.current = Number(e.target.value);
              setVrijeme(vrijemeRef.current);
            }}
          />
          <span className="w-12 tabular-nums">{vrijeme.toFixed(1)} s</span>
        </label>
        <button type="button" onClick={() => setTece(!tece)} className="rounded border border-line px-2 py-0.5">
          {tece ? "⏸ Zaustavi" : "▶ Pusti ciklus"}
        </button>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={prikaziIzvedeno} onChange={(e) => setPrikaziIzvedeno(e.target.checked)} />
          Označi izvedeno ({brojIzvedenih})
        </label>
      </div>

      {nacrtNadjen && overlay && (
        <div className="flex items-center gap-2 rounded border border-line bg-paper p-2">
          Postoji nesačuvan nacrt iz prošlog rada ({nacrtNadjen.izmjene.length} izmjena).
          <button
            type="button"
            className="rounded bg-blue px-2 py-0.5 text-white"
            onClick={() => {
              primijeni(nacrtNadjen);
              setNacrtNadjen(null);
            }}
          >
            Vrati nacrt
          </button>
          <button
            type="button"
            className="rounded border border-line px-2 py-0.5"
            onClick={() => {
              sacuvajLokalno(NACRT, "");
              setNacrtNadjen(null);
            }}
          >
            Odbaci
          </button>
        </div>
      )}
      {greska && <p className="rounded border border-red bg-red-soft p-2">{greska}</p>}
      {poruka && <p className="rounded border border-line bg-paper p-2">{poruka}</p>}

      <div className="grid gap-2 lg:grid-cols-[1fr_26rem]">
        <div className="relative">
          <canvas ref={platnoRef} className="block h-[calc(100vh-9rem)] w-full rounded border border-line bg-[#e8e4dc]" />
          <canvas
            ref={preklopRef}
            className="absolute inset-0 h-full w-full touch-none"
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              const k = kameraRef.current;
              povlacenje.current = { x: e.clientX, y: e.clientY, wx: k.wx, wy: k.wy, pomjeren: false };
            }}
            onPointerMove={(e) => {
              const p = povlacenje.current;
              if (!p) return;
              const dx = e.clientX - p.x;
              const dy = e.clientY - p.y;
              if (Math.hypot(dx, dy) > 4) p.pomjeren = true;
              if (p.pomjeren) {
                const k = kameraRef.current;
                kameraRef.current = { ...k, wx: p.wx - dx / k.scale, wy: p.wy - dy / k.scale };
              }
            }}
            onPointerUp={(e) => {
              const p = povlacenje.current;
              povlacenje.current = null;
              if (p && !p.pomjeren) klik(uSvijet(e));
            }}
            onWheel={(e) => {
              const prije = uSvijet(e);
              const k = kameraRef.current;
              const scale = Math.max(0.15, Math.min(40, k.scale * Math.exp(-e.deltaY * 0.0015)));
              // Tačka pod mišem ostaje pod mišem.
              kameraRef.current = { scale, wx: prije.x - (prije.x - k.wx) * (k.scale / scale), wy: prije.y - (prije.y - k.wy) * (k.scale / scale) };
            }}
          />
          {!svijet && <p className="absolute inset-0 flex items-center justify-center">Učitavam grad…</p>}
        </div>

        <aside className="max-h-[calc(100vh-9rem)] space-y-2 overflow-y-auto rounded border border-line bg-panel p-2">
          {svijet && overlay && (
            <>
              {rezim === "odaberi" && !izbor && <p className="text-muted">Klikni raskrsnicu, krak (ulicu tik uz raskrsnicu) ili ulicu. Povuci mišem da pomjeriš kartu, točkićem zumiraj.</p>}
              {rezim === "odaberi" && izbor?.vrsta === "krak" && (
                <PanelKraka svijet={svijet} overlay={overlay} r={izbor.r} k={izbor.k} primijeni={primijeni} potpis={potpis} />
              )}
              {rezim === "odaberi" && izbor?.vrsta === "raskrsnica" && (
                <PanelRaskrsnice svijet={svijet} overlay={overlay} r={izbor.r} vrijeme={vrijeme} primijeni={primijeni} potpis={potpis} onKrak={(k) => setIzbor({ vrsta: "krak", r: izbor.r, k })} />
              )}
              {rezim === "odaberi" && izbor?.vrsta === "ulica" && (
                <PanelUlice svijet={svijet} overlay={overlay} pogodak={izbor} primijeni={primijeni} potpis={potpis} />
              )}
              {rezim === "cvor" && (
                <PanelCvora svijet={svijet} overlay={overlay} izbor={izbor} nacrt={nacrt} primijeni={primijeni} potpis={potpis} ocisti={() => { setIzbor(null); setNacrt({ tacke: [] }); }} />
              )}
              {rezim === "ulica" && <PanelNoveUlice overlay={overlay} nacrt={nacrt} setNacrt={setNacrt} primijeni={primijeni} potpis={potpis} />}
              {rezim === "zona" && (
                <PanelZona svijet={svijet} overlay={overlay} zonaId={zonaId} setZonaId={setZonaId} nacrt={nacrt} setNacrt={setNacrt} primijeni={primijeni} potpis={potpis} skoci={skoci} />
              )}
              {rezim === "zadatak" && (
                <PanelZadataka svijet={svijet} overlay={overlay} zadatakId={zadatakId} setZadatakId={setZadatakId} nacrt={nacrt} setNacrt={setNacrt} primijeni={primijeni} potpis={potpis} />
              )}

              <hr className="border-line" />
              <div className="flex gap-1">
                {(
                  [
                    ["izmjene", `Izmjene (${overlay.izmjene.length})`],
                    ["izvedeno", `Izvedeno (${brojIzvedenih})`],
                    ["upozorenja", `Upozorenja (${listaUpozorenja.length})`],
                  ] as const
                ).map(([l, ime]) => (
                  <button key={l} type="button" aria-pressed={lista === l} onClick={() => setLista(l)} className={`rounded border px-1.5 ${lista === l ? "border-blue bg-blue text-white" : "border-line bg-paper"}`}>
                    {ime}
                  </button>
                ))}
              </div>
              {lista === "izmjene" && (
                <ul className="space-y-1">
                  {[...overlay.izmjene].reverse().map((iz) => {
                    const nevezana = svijet.nevezane.find((n) => n.id === iz.id);
                    const t = tackaIzmjene(iz);
                    return (
                      <li key={iz.id} className={`flex items-center gap-1 rounded border px-1 ${nevezana ? "border-red" : "border-line"}`}>
                        <button type="button" className="flex-1 text-left" onClick={() => t && skoci(t)} title={nevezana?.razlog}>
                          {iz.vrsta}
                          <span className="text-muted"> · {iz.autor} · {iz.datum.slice(0, 10)}</span>
                          {nevezana && <span className="text-red"> · nevezana</span>}
                        </button>
                        <button type="button" aria-label="Obriši izmjenu" onClick={() => primijeni(ukloni(overlay, iz.id))} className="px-1 text-red">
                          ✕
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {lista === "izvedeno" && (
                <ul className="space-y-1">
                  <li className="text-muted">Najbliže kameri; klikni, provjeri na terenu, pa „Potvrdi“ ili postavi znakove.</li>
                  {izvedene.map(({ r, d }) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="w-full rounded border border-line px-1 text-left"
                        onClick={() => {
                          setRezim("odaberi");
                          setIzbor({ vrsta: "raskrsnica", r: r.id });
                          skoci(r.centar, 6);
                        }}
                      >
                        #{r.id} {r.inferredPriority ? "prioritet" : ""} {r.inferredPhases ? "faze" : ""} <span className="text-muted">· {Math.round(d)} m</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {lista === "upozorenja" && (
                <ul className="space-y-1">
                  {listaUpozorenja.length === 0 && <li className="text-muted">Nema upozorenja.</li>}
                  {listaUpozorenja.map((u, i) => (
                    <li key={i}>
                      <button type="button" className="w-full rounded border border-line px-1 text-left" onClick={() => skoci(u.tacka)}>
                        {u.tekst}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
