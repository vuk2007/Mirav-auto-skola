"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import {
  CAR_LENGTH,
  CAR_WIDTH,
  DT,
  GRAD_BRZINA_PODRAZUMIJEVANA,
  GRAD_SAT_PRECICE,
  GRAD_HITNO_RITAM,
  GRAD_HITNO_RITAM_NIZAK,
  GRAD_MINI_RUTA,
  GRAD_RADNJE_KADAR,
  GRAD_SAT_TRAJE,
  GRAD_NPC_GUSTINA_NIVO,
  GRAD_SUDAR_PONOVO,
  GRAD_NIVO,
  GRAD_POLA_KADRA,
  GRAD_ZUM,
  HUD_HZ,
  KAMERA_NAPRIJED,
  KAMERA_NAPRIJED_BRZINA,
  type Level,
} from "@/lib/game/sim/config";
import type { Point } from "@/lib/game/sim/types";
import { najblizaIvica } from "@/lib/game/grad/mreza";
import { ucitajOverlay } from "@/lib/game/grad/ucitajOverlay";
import type { Zona } from "@/lib/game/grad/overlay";
import { procitaj } from "@/lib/game/grad/paket";
import { ulicaNa } from "@/lib/game/grad/povrsina";
import { noviSudija, sudi, type GradskiPrekrsaj } from "@/lib/game/grad/sudija";
import { svijetGrada } from "@/lib/game/grad/svijet";
import {
  autobusiUPolasku,
  hitnaZaSudiju,
  igracCekaSaobracaj,
  IGRAC,
  korakSaobracaja,
  noviSaobracaj,
  oduzetoPrvenstvo,
  parkirani,
  tijeloNpc,
  type Tijelo,
} from "@/lib/game/grad/saobracaj";
import { linijeAutobusa, type SiroveLinije } from "@/lib/game/grad/autobusi";
import { korakPjesaka, noviPjesaci, tijelaPjesaka, udaraPjesaka } from "@/lib/game/grad/pjesaci";
import { svjetloPjesaka } from "@/lib/game/grad/trotoari";
import type { Manevar } from "@/lib/game/grad/mreza";
import { polygonsOverlap, rectCorners } from "@/lib/game/sim/geometry";
import { naslovPrekrsaja, praviloPrekrsaja } from "@/lib/game/ui/gradPrekrsaji";
import { korakSlobodno, pozaSlobodno, slobodnoNaIvici, type SlobodnoVozilo } from "@/lib/game/grad/slobodno";
import type { BojeDekora } from "@/lib/game/grad/dekor";
import type { Palete } from "@/lib/game/grad/zgrade";
import type { BojeOsvjetljenja, GradKadar, GradRenderer } from "@/lib/game/ui/gradRenderer";
import { pjesaciSata, saobracajSata, satIgre, satTekst } from "@/lib/game/grad/dan";
import { otvorena, radnjeGrada } from "@/lib/game/grad/radnje";
import { haptika } from "@/lib/game/ui/haptika";
import { zmigavacSvijetli } from "@/lib/game/ui/zmigavac";
import { dprUredjaja } from "@/lib/game/ui/renderer";
import { odredistaGrada, type Odrediste } from "@/lib/game/grad/odredista";
import { korakNavigacije, novaNavigacija, rutaDo, sljedeciManevar, type ManevarRute, type Navigacija } from "@/lib/game/grad/navigacija";
import { uliceOko } from "@/lib/game/grad/miniMapa";
import { dodajDanu, korakStatistike, novaStatistika, procitajDan, type DanVoznje } from "@/lib/game/grad/statistika";
import { najbolji, nasumicanCilj, ocjenaOdDo, tezina as tezinaOdDo, zapisiNajbolji, type Tezina } from "@/lib/game/grad/odDo";
import Brzinomjer from "./Brzinomjer";
import IzborCilja from "./grad/IzborCilja";
import { minSek, OdDoIzbor, OdDoRezultat, type RezultatOdDo } from "./grad/OdDo";
import MiniMapaGrada, { MINI_POLUPRECNIK, type MrljaUlica } from "./grad/MiniMapaGrada";
import Putokaz from "./grad/Putokaz";
import DriveControls from "./DriveControls";
import { useVolan } from "./useVolan";

/** Grad koji se vozi — za sada samo Podgorica (faza 6, stavka 3). */
const GRAD = "podgorica";

/**
 * Koliko brzo kamera sustiže smjer auta [s]. Kamera koja prati auto tačno
 * vrti cijeli grad sa svakim pokretom volana; ovako se okreće mekše.
 */
const KAMERA_SMIRENJE = 0.25;

type Faza = "ucitavam" | "voznja" | "greska" | "bezWebgl";

interface Hud {
  kmh: number;
  ulica: string;
  rikverc: boolean;
  /** Sat igre (stavka 8d), npr. „08:15". */
  sat: string;
  fps: number | null;
  /** Samo `?debug=1`: broj drugih vozila i prosječan korak simulacije [ms] (mjerilo, stavka 7d). */
  vozila: number | null;
  /** Samo `?debug=1`: parkiranih uz ivičnjak (stavka 7e). */
  parkirano: number | null;
  /** Samo `?debug=1`: pješaka (stavka 8). */
  pjesaka: number | null;
  korakMs: number | null;
  /** Navigacija do cilja (stavka 9): sljedeći manevar, koliko do njega i do cilja. */
  nav: { manevar: ManevarRute | null; za: number; doCilja: number; cilj: string } | null;
  /** Mini mapa: auto, ostatak rute i cilj. */
  mini: { auto: { x: number; y: number; ugao: number }; ruta: Point[] | null; cilj: Point | null };
  /** Uzastopni minuti vožnje bez prekršaja (statistika slobodne vožnje). */
  cisto: number;
  /** Vožnja od–do u toku: koliko traje [s]. */
  odDo: number | null;
}

/** Ostatak rute za mini mapu: od auta, najviše `GRAD_MINI_RUTA` metara. */
function ostatakRute(nav: Navigacija): Point[] {
  const { tacke, cum } = nav.ruta;
  const out: Point[] = [];
  for (let k = 0; k < tacke.length; k++) {
    if (cum[k]! < nav.s) continue;
    if (cum[k]! > nav.s + GRAD_MINI_RUTA) break;
    out.push(tacke[k]!);
  }
  return out;
}

/** Trzaj telefona pri udaru u ivičnjak [ms] — samo kad udar počne, ne dok struže. */
const UDAR_HAPTIKA = 30;
/** Trzaj telefona pri prekršaju [ms]. */
const PREKRSAJ_HAPTIKA = 80;
/** Koliko dugo se kartica zadnjeg prekršaja vidi preko mape [ms]. */
const KARTICA_MS = 6000;

/**
 * Slobodna vožnja kroz Podgoricu, u razmjeri 1:1 — faza 6, stavka 3.
 *
 * Bez pravila i bez drugih vozila: ovo je da se grad pogleda i provoza, prije
 * nego što dobije izgled (stavka 4) i pravila (stavka 5). Vozi se istim volanom
 * i gasom kao Ruta, ali slobodno (stavka 3c): volan okreće točkove i skreće se
 * gdje igrač skrene; kočnica držana u mjestu ubacuje rikverc.
 */
export default function GradScreen({ onExit }: { onExit: () => void }) {
  const { t } = useApp();
  // Petlja čita tekstove kroz ref — jezik se može promijeniti usred vožnje.
  const tRef = useRef(t);
  tRef.current = t;
  // Žmigavac pali igrač (Q/E i dugmad) — sudija ga traži pri skretanju (5e).
  const volan = useVolan(true, { pokazivacRukom: true });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [faza, setFaza] = useState<Faza>("ucitavam");
  const [hud, setHud] = useState<Hud>({
    kmh: 0,
    ulica: "",
    rikverc: false,
    sat: "",
    fps: null,
    vozila: null,
    parkirano: null,
    pjesaka: null,
    korakMs: null,
    nav: null,
    mini: { auto: { x: 0, y: 0, ugao: 0 }, ruta: null, cilj: null },
    cisto: 0,
    odDo: null,
  });
  // Zadaci (stavka 9): odredišta grada, cilj vožnje i poruke navigacije.
  const [odredista, setOdredista] = useState<Odrediste[]>([]);
  const [izborCilja, setIzborCilja] = useState(false);
  const [cilj, setCilj] = useState<Odrediste | null>(null);
  /**
   * Novi cilj iz menija — petlja ga preuzme u sljedećem kadru (`null` — bez
   * cilja). Sa `odDo` počinje vožnja od–do te težine; `nasumicno` — cilj bira
   * petlja, po mjestu auta.
   */
  const zahtjevCiljaRef = useRef<{ o: Odrediste | null; odDo?: Tezina; nasumicno?: boolean } | null>(null);
  // Vožnja od–do (stavka 9): težina vožnje u toku, izbor težine, izbor cilja
  // za nju, i rezultat na cilju (dok se vidi, simulacija stoji).
  const [odDo, setOdDo] = useState<Tezina | null>(null);
  const [odDoIzbor, setOdDoIzbor] = useState(false);
  const [ciljZaOdDo, setCiljZaOdDo] = useState<Tezina | null>(null);
  const [rezultat, setRezultat] = useState<RezultatOdDo | null>(null);
  const zadnjaTezinaRef = useRef<Tezina>("srednje");
  const pauzaRef = useRef(false);
  const [poruka, setPoruka] = useState<string | null>(null);
  const [ulice, setUlice] = useState<MrljaUlica | null>(null);
  const [dan, setDan] = useState<DanVoznje>({ km: 0, cisteMinute: 0, prekrsaja: 0 });
  const [ogranicenje, setOgranicenje] = useState<number | null>(null);
  // Sudija (stavka 5d): prekršaji ove vožnje, zadnji se kratko prikaže.
  const [prekrsaji, setPrekrsaji] = useState<GradskiPrekrsaj[]>([]);
  const [kartica, setKartica] = useState<GradskiPrekrsaj | null>(null);
  // Udaren pješak (stavka 8): vožnja je gotova — posebna kartica, pa ponovo.
  const [udaren, setUdaren] = useState<GradskiPrekrsaj | null>(null);
  const [pokusaj, setPokusaj] = useState(0);
  const [nivo, setNivo] = useState<Level>(GRAD_NIVO);
  const nivoRef = useRef<Level>(GRAD_NIVO);
  /** Vrijeme simulacije — po njemu trepću i lampica pored volana i žmigavac na autu. */
  const simTRef = useRef(0);
  nivoRef.current = nivo;
  const inputRef = volan.inputRef;
  // Udaljavanje kadra — da se grad može pregledati, ne samo voziti. Ide kroz
  // `ref`, jer ga petlja čita svakog kadra.
  const [zum, setZum] = useState(0);
  const zumRef = useRef(0);
  zumRef.current = zum;
  // Vrijeme (stavka 4d): kiša mijenja i kočenje. Doba dana teče samo
  // (stavka 8d, 24 min = 24 h): sat igre je početni sat + vrijeme simulacije;
  // dugmad samo pomjere sat (`GRAD_SAT_PRECICE`).
  const [kisa, setKisa] = useState(false);
  const uslovRef = useRef({ kisa });
  uslovRef.current = { kisa };
  // Početni sat [h]: lokalno vrijeme uređaja, ili `?debug=1&sat=8` (mjerilo, QA).
  const pocetakSataRef = useRef<number | null>(null);
  const sat = () => satIgre(pocetakSataRef.current ?? 12, simTRef.current);
  /** Upis statistike u današnji zbir — i pri izlasku sa ekrana. */
  const upisiDanRef = useRef<(() => void) | null>(null);
  const izaberiCilj = (o: Odrediste | null, tez?: Tezina) => {
    setCilj(o);
    setIzborCilja(false);
    setCiljZaOdDo(null);
    setOdDo(o && tez ? tez : null);
    zahtjevCiljaRef.current = { o, odDo: tez };
  };
  /** Vožnja od–do: težina postavlja nivo saobraćaja i sudije; cilj nasumičan ili izabran. */
  const pocniOdDo = (tez: Tezina, o: Odrediste | null) => {
    zadnjaTezinaRef.current = tez;
    setOdDoIzbor(false);
    setNivo(tezinaOdDo(tez).nivo);
    if (o) izaberiCilj(o, tez);
    else {
      setCilj(null);
      setIzborCilja(false);
      setCiljZaOdDo(null);
      setOdDo(tez);
      zahtjevCiljaRef.current = { o: null, odDo: tez, nasumicno: true };
    }
  };
  const pomjeriSat = (h: number) => {
    pocetakSataRef.current = h - simTRef.current / GRAD_SAT_TRAJE;
  };

  useEffect(() => {
    if (!poruka) return;
    const id = window.setTimeout(() => setPoruka(null), KARTICA_MS);
    return () => window.clearTimeout(id);
  }, [poruka]);

  useEffect(() => {
    if (!kartica) return;
    const id = window.setTimeout(() => setKartica(null), KARTICA_MS);
    return () => window.clearTimeout(id);
  }, [kartica]);

  useEffect(() => {
    let otkazano = false;
    let renderer: GradRenderer | null = null;
    let raf = 0;
    let observer: ResizeObserver | null = null;
    const debug = new URLSearchParams(window.location.search).get("debug") === "1";

    const pokreni = async () => {
      const json = async <T,>(url: string): Promise<T> => {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
        return (await r.json()) as T;
      };
      // Izgled zgrada je podatak: palete i zone (sa paletom po zoni).
      const [spisak, palete, zone, overlay, linije] = await Promise.all([
        json<Record<string, { fajl: string }>>("/data/grad/gradovi.json"),
        json<Palete & { dekor: BojeDekora; osvjetljenje: BojeOsvjetljenja }>("/data/grad/palete.json"),
        json<{ zone: Zona[] }>(`/data/grad/cityZones/${GRAD}.json`),
        ucitajOverlay(GRAD),
        // Autobuske linije (stavka 8c); bez njih autobusi idu bulevarima.
        json<SiroveLinije>(`/data/grad/linije/${GRAD}.json`).catch(() => null),
      ]);
      const fajl = spisak[GRAD]?.fajl;
      if (!fajl) throw new Error(`nema paketa za ${GRAD}`);
      const odgovor = await fetch(`/data/grad/${fajl}`);
      if (!odgovor.ok) throw new Error(`paket grada: HTTP ${odgovor.status}`);
      // OSM paket, pa ručne izmjene iz editora (stavka 6) — jedan model po
      // kojem se crta i sudi (stavka 5).
      const svijet = svijetGrada(procitaj(await odgovor.arrayBuffer()), overlay, zone.zone);
      const { paket, mreza, povrsina, raskrsnice, crtez, zaSudiju } = svijet;
      const sudija = noviSudija(nivoRef.current);
      // Odredišta (stavka 9): javni objekti iz OSM-a, za cilj vožnje.
      const svaOdredista = odredistaGrada(svijet);
      setOdredista(svaOdredista);
      setDan(procitajDan());
      let prijavljeno = 0;
      const parametarSata = debug ? Number(new URLSearchParams(window.location.search).get("sat") ?? NaN) : NaN;
      if (pocetakSataRef.current === null) {
        const d = new Date();
        pocetakSataRef.current = Number.isFinite(parametarSata) ? parametarSata : d.getHours() + d.getMinutes() / 60;
      } else {
        // Nova vožnja (poslije udara): dan teče dalje, ne vraća se na početak.
        pocetakSataRef.current = sat();
      }
      simTRef.current = 0;
      // Drugi učesnici (stavka 7): vozila sa ciljem oko igrača — po nivou i
      // satu (gužva ujutru i popodne, noću rijetko; stavka 8d).
      // Mjerilo: `?debug=1&gustina=3` — gustina van zona (0–3), npr. 40 vozila,
      // i tada bez obzira na doba dana (mjeri se puni grad u svako doba).
      const gustinaParam = debug ? Number(new URLSearchParams(window.location.search).get("gustina") ?? NaN) : NaN;
      const gustina = () => GRAD_NPC_GUSTINA_NIVO[nivoRef.current] * (Number.isFinite(gustinaParam) ? 1 : saobracajSata(sat()));
      const saobracaj = noviSaobracaj(svijet, 1, gustina());
      if (Number.isFinite(gustinaParam)) saobracaj.gustinaVanZona = gustinaParam;
      // Pješaci (stavka 8): po gustini zone × doba dana. Mjerilo:
      // `?debug=1&pjesaci=3` — gustina pješaka van zona (0–3), npr. 60, u svako doba.
      const pjesaciParam = debug ? Number(new URLSearchParams(window.location.search).get("pjesaci") ?? NaN) : NaN;
      const gustinaPjesaka = () => (Number.isFinite(pjesaciParam) ? 1 : pjesaciSata(sat()));
      const pjesaci = noviPjesaci(svijet, 1, gustinaPjesaka());
      saobracaj.pjesaci = pjesaci;
      saobracaj.linije = linijeAutobusa(svijet, linije);
      // Izlozi radnji (stavka 8d): otvorene po satu igre. Spisak u kadru se
      // računa ponovo tek kad se kamera pomjeri 5 m ili prođe minut igre —
      // inače isti niz (renderer ga tada ne crta ponovo).
      // `?debug=1&radnje=0` — bez izloga (mjerilo: koliko koštaju).
      const bezRadnji = debug && new URLSearchParams(window.location.search).get("radnje") === "0";
      const radnje = bezRadnji ? [] : radnjeGrada(svijet, pjesaci.mreza);
      let uKadru: { x: number; y: number; ugao: number; boja: number; otvorena: boolean }[] = [];
      let kadarRadnji = { x: Infinity, y: Infinity, minut: -1 };
      const radnjeKadra = (x: number, y: number) => {
        const minut = Math.floor(sat() * 60);
        if (Math.abs(x - kadarRadnji.x) < 5 && Math.abs(y - kadarRadnji.y) < 5 && minut === kadarRadnji.minut) return uKadru;
        kadarRadnji = { x, y, minut };
        const h = sat();
        uKadru = radnje
          .filter((r) => Math.abs(r.x - x) < GRAD_RADNJE_KADAR && Math.abs(r.y - y) < GRAD_RADNJE_KADAR)
          .map((r) => ({ x: r.x, y: r.y, ugao: r.ugao, boja: r.boja, otvorena: otvorena(r.vrijeme, h) }));
        return uKadru;
      };
      if (Number.isFinite(pjesaciParam)) pjesaci.gustinaVanZona = pjesaciParam;
      // `?debug=1&hitno=20` — hitno vozilo u prosjeku na ovoliko s (QA).
      const hitnoParam = debug ? Number(new URLSearchParams(window.location.search).get("hitno") ?? NaN) : NaN;
      // `?debug=1&hitnoPrsten=1` — hitno iz prstena oko igrača, ne iza njega (QA sklanjanja).
      const hitnoPrsten = debug && new URLSearchParams(window.location.search).get("hitnoPrsten") === "1";
      // Samo `?debug=1`, za QA snimke: parkirani auti i kamera na zadatoj tački.
      let kameraQa: Point | null = null;
      if (debug) {
        (window as unknown as { __grad?: object }).__grad = {
          parkirani: () => parkirani(saobracaj).map((p) => ({ x: p.x, y: p.y })),
          pjesaci: () => pjesaci.lista.map((x) => ({ x: x.x, y: x.y, stanje: x.stanje })),
          // Autobusi (stavka 8c): gdje su, stoje li na stajalištu, polaze li.
          autobusi: () =>
            saobracaj.npc
              .filter((n) => n.autobus)
              .map((n) => ({ x: n.x, y: n.y, linija: n.autobus!.ref, stoji: n.autobus!.stojiOd !== null, polazi: !!n.autobus!.polazi })),
          // Hitna vozila (stavka 8e): gdje su i koja, i ko se pred njima sklonio.
          hitna: () =>
            saobracaj.npc
              .filter((n) => n.hitno)
              .map((n) => ({
                x: n.x,
                y: n.y,
                vrsta: n.hitno,
                v: n.v,
                razlog: n.razlog,
                sklonjeni: saobracaj.npc
                  .filter((o) => o.razlog.vrsta === "hitno" && o.razlog.kome === n.id && o.bok > 0.5)
                  .map((o) => ({ x: o.x, y: o.y })),
              })),
          // Stanje sudije oko hitnih vozila (stavka 8e): da li ga vidi iza, i zašto ne sudi.
          sudijaHitno: () => ({
            hitnoIza: sudija.hitnoIza,
            hitni: [...sudija.hitni.entries()],
            prolaz: sudija.prolaz?.r ?? null,
            prilaz: sudija.prilaz ? { r: sudija.prilaz.r, doLinije: sudija.prilaz.doLinije, svjetlo: sudija.prilaz.svjetlo } : null,
            uKoloni: igracCekaSaobracaj(saobracaj, tijeloIgraca(), sudija.prolaz?.r ?? sudija.prilaz?.r ?? null),
            igrac: { x: st.x, y: st.y, ugao: st.ugao, v: st.v },
          }),
          // Pješak prelazi ulicu `ispred` m pred autom (QA kartice udara).
          pjesakIspred: (ispred: number) => {
            const x = pjesaci.lista[0];
            if (!x) return false;
            const c = Math.cos(st.ugao);
            const s = Math.sin(st.ugao);
            const px = st.x + c * ispred;
            const py = st.y + s * ispred;
            x.vanZebre = { k: x.k, d: x.d, a: { x: px + s * 4, y: py - c * 4 }, b: { x: px - s * 4, y: py + c * 4 }, u: 0 };
            x.stanje = "prelazi";
            return true;
          },
          kamera: (p: Point | null) => {
            kameraQa = p;
          },
          // Navigacija javlja dolazak u sljedećem koraku (QA kartice od–do).
          stigni: () => {
            if (nav) nav.stigao = true;
            return nav !== null;
          },
        };
      }
      /** Zadnji sudar sa svakim vozilom [s] — isti se ne prijavljuje ponovo odmah. */
      const sudari = new Map<number, number>();
      // Oduzeto prvenstvo: na kraju prolaza igrača kroz raskrsnicu — da li je
      // neko ko je imao prednost (ili je već bio u njoj) morao naglo kočiti
      // zbog njega. Manevar igrača se tad zna.
      let ulazak: { r: number; t: number } | null = null;
      // Traka u prstenu dvotračnog kružnog toka, zadnja koju je sudija
      // zabilježio: ostaje i poslije izlaza (sudija tada briše `prsten`), do
      // ulaska u sljedeći prsten.
      let trakaPrstena: "unutra" | "spolja" | null = null;
      sudija.naUlazu = (r) => {
        ulazak = { r, t: koraka_ * DT };
      };
      sudija.dnevnik = (p) => {
        const k = oduzetoPrvenstvo(saobracaj, {
          r: p.r,
          ulaz: p.ulaz,
          izlaz: p.izlaz,
          manevar: p.manevar as Manevar,
          od: ulazak?.r === p.r ? ulazak.t - 3 : p.t - 10,
          do_: p.t,
          izUnutrasnje: trakaPrstena === "unutra",
          ulazak: ulazak?.r === p.r ? ulazak.t : undefined,
        });
        if (k) sudija.prekrsaji.push({ vrsta: "rightOfWay", ozbiljnost: "fail", t: p.t, x: st.x, y: st.y, detalji: { vozilo: k.id } });
        saobracaj.kocenja = saobracaj.kocenja.filter((k) => k.t > p.t - 30);
      };
      if (otkazano) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Pixi se učitava tek ovdje — ostatak igre ga ne plaća u početnom paketu.
      const { createGradRenderer } = await import("@/lib/game/ui/gradRenderer");
      renderer = await createGradRenderer(canvas, paket, povrsina, { palete, zone: svijet.zone }, { raskrsnice, crtez, produzeci: zaSudiju.produzeci, pjesackiSemafori: zaSudiju.pjesackiSemafori });
      if (otkazano) {
        renderer?.destroy();
        return;
      }
      if (!renderer) {
        setFaza("bezWebgl");
        return;
      }

      // Start: najbliža ulica Trgu nezavisnosti (ishodište paketa). Za
      // provjeru (`?debug=1&gdje=x,y`) start je najbliža ulica zadatoj tački.
      const gdje = debug ? new URLSearchParams(window.location.search).get("gdje")?.split(",").map(Number) : undefined;
      const tacka = gdje && gdje.length === 2 && gdje.every(Number.isFinite) ? { x: gdje[0]!, y: gdje[1]! } : { x: 0, y: 0 };
      const start = najblizaIvica(mreza, tacka);
      if (!start) throw new Error("mreža nema nijednu voznu ulicu");
      const st: SlobodnoVozilo = slobodnoNaIvici(povrsina, start.ivica, 1, start.s);
      const tijeloIgraca = (): Tijelo => ({
        id: IGRAC,
        x: st.x,
        y: st.y,
        ugao: st.ugao,
        v: st.v,
        duzina: CAR_LENGTH,
        sirina: CAR_WIDTH,
        nivo: mreza.ivice[sudija.ivicaAuta ?? start.ivica]!.nivo,
      });
      // Prvo popunjavanje saobraćaja dok se još učitava.
      korakSaobracaja(saobracaj, { x: st.x, y: st.y }, tijeloIgraca());
      let prije = pozaSlobodno(st);
      let sada = prije;
      let ugaoKamere = Math.atan2(sada.heading.y, sada.heading.x);

      let cssW = 0;
      let cssH = 0;
      const resize = () => {
        const r = canvas.getBoundingClientRect();
        cssW = r.width;
        cssH = r.height;
        renderer?.resize(cssW, cssH, dprUredjaja());
      };
      resize();
      observer = new ResizeObserver(resize);
      observer.observe(canvas);
      setFaza("voznja");
      volan.release();

      let zadnji = 0;
      let acc = 0;
      let zadnjiHud = 0;
      let kadrova = 0;
      let odFps = performance.now();
      let fps: number | null = null;
      // Vrijeme simulacije (igrač, saobraćaj, sudija) po koraku, za `?debug=1`.
      let simMs = 0;
      let simKoraka = 0;
      let bioUdar = false;
      /** Koraci simulacije od početka — njima teče vrijeme semafora, ne satom. */
      let koraka_ = 0;
      let ulica = start.ivica;
      let gotovo = false;
      // Navigacija (stavka 9): ruta do cilja; nova kad igrač ode sa nje.
      let nav: Navigacija | null = null;
      // Vožnja od–do u toku: od kada [s], dužina prve rute (po njoj je
      // referentno vrijeme) i od kojeg prekršaja se broji.
      let odDoV: { tezina: Tezina; t0: number; duzina: number; od: number } | null = null;
      // Cilj iz prethodne vožnje (poslije udara pješaka) ostaje — vožnja
      // od–do ne (udar je kraj vožnje).
      if (cilj) zahtjevCiljaRef.current = { o: cilj };
      setOdDo(null);
      pauzaRef.current = false;
      // Statistika slobodne vožnje i dio koji je već upisan u današnji zbir.
      const stat = novaStatistika();
      let upisano = { metara: 0, cisteMinute: 0, prekrsaja: 0 };
      let zadnjiUpis = 0;
      const upisiDan = () => {
        const razlika = { km: (stat.metara - upisano.metara) / 1000, cisteMinute: stat.cisteMinute - upisano.cisteMinute, prekrsaja: stat.prekrsaja - upisano.prekrsaja };
        upisano = { metara: stat.metara, cisteMinute: stat.cisteMinute, prekrsaja: stat.prekrsaja };
        if (razlika.km > 0 || razlika.cisteMinute > 0 || razlika.prekrsaja > 0) setDan(dodajDanu(razlika));
      };
      upisiDanRef.current = upisiDan;
      let mrlja: MrljaUlica | null = null;
      const kadar = (now: number) => {
        raf = requestAnimationFrame(kadar);
        const dt = zadnji === 0 ? 0 : Math.min(0.25, (now - zadnji) / 1000);
        zadnji = now;
        acc += dt;
        let koraka = 0;
        if (gotovo || pauzaRef.current) acc = 0;
        const zahtjev = zahtjevCiljaRef.current;
        if (zahtjev) {
          zahtjevCiljaRef.current = null;
          let o = zahtjev.o;
          if (zahtjev.nasumicno && zahtjev.odDo) {
            o = nasumicanCilj(svaOdredista, st.x, st.y, zahtjev.odDo, Math.random);
            setCilj(o);
            if (!o) setPoruka(tRef.current.gradOdDoNoTarget);
          }
          const r = o ? rutaDo(svijet, st.x, st.y, st.ugao, o) : null;
          nav = r ? novaNavigacija(r) : null;
          odDoV = r && zahtjev.odDo ? { tezina: zahtjev.odDo, t0: koraka_ * DT, duzina: r.duzina, od: sudija.prekrsaji.length } : null;
          if (o && !r) setPoruka(tRef.current.gradNavNoRoute);
          if (zahtjev.odDo && !r) {
            setOdDo(null);
            setCilj(null);
          }
        }
        while (acc >= DT && koraka < 8) {
          const t0Koraka = debug ? performance.now() : 0;
          prije = sada;
          korakSlobodno(povrsina, st, inputRef.current, { kisa: uslovRef.current.kisa });
          saobracaj.gustina = gustina();
          // Hitna vozila (stavka 8e): oko jednom u 5 min, na nivou 1–2 rjeđe.
          saobracaj.hitnoRitam = Number.isFinite(hitnoParam) ? hitnoParam : nivoRef.current <= 2 ? GRAD_HITNO_RITAM_NIZAK : GRAD_HITNO_RITAM;
          saobracaj.hitnoUPrstenu = hitnoPrsten;
          if (sudija.prsten) trakaPrstena = sudija.prsten.uzorci.at(-1)?.traka ?? null;
          korakSaobracaja(saobracaj, { x: st.x, y: st.y }, tijeloIgraca(), {
            tijelo: tijeloIgraca(),
            ivica: sudija.ivica,
            smjer: sudija.smjer,
            zmigavac: inputRef.current.indicator,
            trakaUPrstenu: trakaPrstena,
          });
          if (saobracaj.kocenja.length > 200) saobracaj.kocenja.splice(0, 100);
          // Pješaci vide vozila (i igrača): na prelaz ne stupaju ispred onoga ko ih ugrožava.
          pjesaci.gustina = gustinaPjesaka();
          pjesaci.sat = sat();
          korakPjesaka(pjesaci, { x: st.x, y: st.y }, [...saobracaj.npc.map(tijeloNpc), tijeloIgraca()]);
          // Udar pješaka: trenutan kraj vožnje i posebna kartica (zadatak, odjeljak 6).
          const tijeloAuta = { x: st.x, y: st.y, ugao: st.ugao, duzina: CAR_LENGTH, sirina: CAR_WIDTH };
          const pjesak = pjesaci.lista.find((x) => Math.abs(x.x - st.x) < CAR_LENGTH && Math.abs(x.y - st.y) < CAR_LENGTH && udaraPjesaka(tijeloAuta, x));
          if (pjesak) {
            const p: GradskiPrekrsaj = { vrsta: "pedestrianCollision", ozbiljnost: "fail", t: koraka_ * DT, x: st.x, y: st.y, detalji: { pjesak: pjesak.id } };
            sudija.prekrsaji.push(p);
            st.v = 0;
            gotovo = true;
            setUdaren(p);
            setPrekrsaji([...sudija.prekrsaji]);
            prijavljeno = sudija.prekrsaji.length;
            haptika(PREKRSAJ_HAPTIKA);
            break;
          }
          // Sudar sa drugim vozilom: prekršaj, i auto staje.
          const ja = rectCorners({ x: st.x, y: st.y }, { x: Math.cos(st.ugao), y: Math.sin(st.ugao) }, CAR_LENGTH, CAR_WIDTH);
          const nivoIgraca = tijeloIgraca().nivo;
          // Sudar i sa parkiranim autom uz ivičnjak (stavka 7e).
          for (const n of [...saobracaj.npc.map(tijeloNpc), ...parkirani(saobracaj)]) {
            if (n.nivo !== nivoIgraca || Math.hypot(n.x - st.x, n.y - st.y) > (CAR_LENGTH + n.duzina) / 2 + 0.5) continue;
            if (!polygonsOverlap(ja, rectCorners({ x: n.x, y: n.y }, { x: Math.cos(n.ugao), y: Math.sin(n.ugao) }, n.duzina, n.sirina))) continue;
            st.v = 0;
            const t = koraka_ * DT;
            if (t - (sudari.get(n.id) ?? -Infinity) > GRAD_SUDAR_PONOVO) {
              sudija.prekrsaji.push({ vrsta: "collision", ozbiljnost: "fail", t, x: st.x, y: st.y, detalji: {} });
            }
            sudari.set(n.id, t);
          }
          koraka_ += 1;
          sudija.nivo = nivoRef.current;
          // Stoji zbog saobraćaja (kolona, čeka da prođe drugi) — nije parkiranje.
          const zbogSaobracaja = igracCekaSaobracaj(saobracaj, tijeloIgraca(), sudija.prolaz?.r ?? sudija.prilaz?.r ?? null);
          sudi(zaSudiju, sudija, st, koraka_ * DT, inputRef.current.indicator, zbogSaobracaja, pjesaci, autobusiUPolasku(saobracaj), hitnaZaSudiju(saobracaj, IGRAC));
          simTRef.current = koraka_ * DT;
          korakStatistike(stat, st.v, DT, sudija.prekrsaji.length - stat.prekrsaja);
          if (nav) {
            const { novaRuta } = korakNavigacije(nav, st.x, st.y, koraka_ * DT);
            if (nav.stigao) {
              if (odDoV) {
                // Na cilju od–do: ocjena, najbolji rezultat, i stanka dok se gleda.
                const nove = sudija.prekrsaji.slice(odDoV.od);
                const upozorenja = nove.filter((p) => p.ozbiljnost === "minor").length;
                const padova = nove.length - upozorenja;
                const sekundi = koraka_ * DT - odDoV.t0;
                const ocjena = ocjenaOdDo(odDoV.tezina, odDoV.duzina, sekundi, upozorenja, padova);
                const ime = nav.ruta.cilj.ime;
                const prije = najbolji(ime, odDoV.tezina);
                const rekord = zapisiNajbolji(ime, odDoV.tezina, ocjena.bodovi);
                setRezultat({ cilj: ime, tezina: odDoV.tezina, sekundi, upozorenja, padova, ocjena, prije, rekord });
                setOdDo(null);
                odDoV = null;
                pauzaRef.current = true;
              } else setPoruka(tRef.current.gradNavArrived.replace("{cilj}", nav.ruta.cilj.ime));
              setCilj(null);
              nav = null;
            } else if (novaRuta) {
              const r = rutaDo(svijet, st.x, st.y, st.ugao, nav.ruta.cilj);
              if (r) {
                nav = novaNavigacija(r);
                setPoruka(tRef.current.gradNavRerouting);
              } else nav.vanOd = koraka_ * DT;
            }
          }
          sada = pozaSlobodno(st);
          if (st.udar && !bioUdar) haptika(UDAR_HAPTIKA);
          bioUdar = st.udar;
          acc -= DT;
          koraka += 1;
          if (debug) {
            simMs += performance.now() - t0Koraka;
            simKoraka += 1;
          }
        }
        if (koraka === 8) acc = 0;
        const alfa = acc / DT;
        const pos: Point = {
          x: prije.pos.x + (sada.pos.x - prije.pos.x) * alfa,
          y: prije.pos.y + (sada.pos.y - prije.pos.y) * alfa,
        };
        const cilj = Math.atan2(sada.heading.y, sada.heading.x);
        let razlika = cilj - ugaoKamere;
        while (razlika > Math.PI) razlika -= 2 * Math.PI;
        while (razlika < -Math.PI) razlika += 2 * Math.PI;
        ugaoKamere += razlika * Math.min(1, dt / KAMERA_SMIRENJE);

        // Kamera kao na otvorenom putu: pravac vožnje nagore, igrač na 62 %
        // visine, i niže što se brže vozi. Unazad kamera ostaje iza auta.
        const naprijed = KAMERA_NAPRIJED * Math.min(1, Math.max(0, st.v) / KAMERA_NAPRIJED_BRZINA);
        const hx = Math.cos(ugaoKamere);
        const hy = Math.sin(ugaoKamere);
        const k: GradKadar = {
          wx: kameraQa?.x ?? pos.x,
          wy: kameraQa?.y ?? pos.y,
          cx: cssW / 2,
          cy: cssH * (0.62 + naprijed),
          rot: -Math.PI / 2 - Math.atan2(-hy, -hx),
          scale: Math.min(cssW, cssH) / (2 * GRAD_POLA_KADRA * GRAD_ZUM[zumRef.current]!),
        };
        renderer?.draw({
          kadar: k,
          simT: koraka_ * DT,
          vozila: [
            ...saobracaj.npc.map((n) => ({
              pos: { x: n.x, y: n.y },
              heading: { x: Math.cos(n.ugao), y: Math.sin(n.ugao) },
              boja: n.boja,
              koci: n.a < -0.5 || n.v < 0.1,
              zmigavac: n.zmigavac,
              duzina: n.plan.vozilo.duzina,
              sirina: n.plan.vozilo.sirina,
              autobus: !!n.autobus,
              hitno: n.hitno,
            })),
            // Parkirani: ugašena svjetla.
            ...parkirani(saobracaj).map((p) => ({
              pos: { x: p.x, y: p.y },
              heading: { x: Math.cos(p.ugao), y: Math.sin(p.ugao) },
              boja: p.boja,
              koci: false,
              zmigavac: null,
            })),
          ],
          pjesaci: tijelaPjesaka(pjesaci).map((p) => ({ pos: { x: p.x, y: p.y }, ugao: p.ugao, boja: p.boja, korak: p.korak, stoji: p.stoji })),
          // Svjetla za pješake na prelazima sa semaforom oko kamere.
          pjesackaSvjetla: pjesaci.mreza.prelazi.flatMap((p) => {
            if (!p.semafor || Math.abs(p.centar.x - k.wx) > 120 || Math.abs(p.centar.y - k.wy) > 120) return [];
            const s = svjetloPjesaka(svijet, p, koraka_ * DT)!.stanje;
            const ux = (p.b.x - p.a.x) / p.duzina;
            const uy = (p.b.y - p.a.y) / p.duzina;
            // Na trotoaru, malo iza kraja prelaza, i u stranu od zebre.
            return [
              { x: p.a.x - ux * 0.6 - uy * 2, y: p.a.y - uy * 0.6 + ux * 2, stanje: s },
              { x: p.b.x + ux * 0.6 + uy * 2, y: p.b.y + uy * 0.6 - ux * 2, stanje: s },
            ];
          }),
          radnje: radnjeKadra(k.wx, k.wy),
          osvjetljenje: { ...uslovRef.current, sat: sat(), sekunde: now / 1000 },
          igrac: {
            pos,
            heading: sada.heading,
            koci: inputRef.current.brake > 0,
            rikverc: st.rikverc,
            tocak: st.tocak,
            zmigavac: inputRef.current.indicator,
          },
        });

        kadrova += 1;
        if (now - odFps > 1000) {
          fps = (1000 * kadrova) / (now - odFps);
          kadrova = 0;
          odFps = now;
        }
        if (now - zadnjiHud > 1000 / HUD_HZ) {
          zadnjiHud = now;
          // Van ulice (ne bi trebalo da se desi) ostaje zadnja poznata.
          ulica = ulicaNa(povrsina, st.x, st.y) ?? ulica;
          const iv = mreza.ivice[ulica]!;
          setHud({
            kmh: Math.abs(st.v) * 3.6,
            ulica: iv.ime,
            rikverc: st.rikverc,
            sat: satTekst(sat()),
            fps: debug ? fps : null,
            vozila: debug ? saobracaj.npc.length : null,
            parkirano: debug ? saobracaj.mjesta.filter((z) => z.parkirano).length : null,
            pjesaka: debug ? pjesaci.lista.length : null,
            korakMs: debug && simKoraka > 0 ? simMs / simKoraka : null,
            nav: nav
              ? (() => {
                  const sl = sljedeciManevar(nav);
                  return { manevar: sl?.manevar ?? null, za: sl?.za ?? 0, doCilja: nav.ruta.duzina - nav.s, cilj: nav.ruta.cilj.ime };
                })()
              : null,
            mini: {
              auto: { x: st.x, y: st.y, ugao: st.ugao },
              ruta: nav ? ostatakRute(nav) : null,
              cilj: nav ? nav.ruta.cilj.ulaz : null,
            },
            cisto: stat.niz,
            odDo: odDoV ? koraka_ * DT - odDoV.t0 : null,
          });
          // Ulice mini mape: ponovo tek kad auto ode dalje od pola kruga.
          if (!mrlja || Math.hypot(st.x - mrlja.centar.x, st.y - mrlja.centar.y) > MINI_POLUPRECNIK / 2) {
            mrlja = uliceOko(mreza, { x: st.x, y: st.y }, MINI_POLUPRECNIK * 1.6);
            setUlice(mrlja);
          }
          if (now - zadnjiUpis > 5000) {
            zadnjiUpis = now;
            upisiDan();
          }
          simMs = 0;
          simKoraka = 0;
          // Ograničenje po kojem sudija sudi: znak, zona, OSM, ili ono u naselju.
          setOgranicenje(sudija.ogranicenje || GRAD_BRZINA_PODRAZUMIJEVANA);
          if (sudija.prekrsaji.length > prijavljeno) {
            const novi = sudija.prekrsaji.slice(prijavljeno);
            prijavljeno = sudija.prekrsaji.length;
            setPrekrsaji([...sudija.prekrsaji]);
            setKartica(novi[novi.length - 1]!);
            haptika(PREKRSAJ_HAPTIKA);
          }
        }
      };
      raf = requestAnimationFrame(kadar);
    };

    pokreni().catch(() => {
      if (!otkazano) setFaza("greska");
    });
    return () => {
      otkazano = true;
      upisiDanRef.current?.();
      upisiDanRef.current = null;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      renderer?.destroy();
    };
    // Petlja se pokreće jednom po otvaranju ekrana (i iznova poslije udara
    // pješaka — `pokusaj`); `volan` i `inputRef` su stabilni za cijeli život
    // komponente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pokusaj]);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => {
          volan.release();
          onExit();
        }}
        className="text-sm font-semibold text-blue underline-offset-4 hover:underline"
      >
        ← {t.tripBack}
      </button>
      <div className="relative">
        <canvas
          // Novi canvas za svaki pokušaj: stari WebGL kontekst je uništen sa rendererom.
          key={pokusaj}
          ref={canvasRef}
          role="img"
          aria-label={t.gradTitle}
          className="block aspect-square w-full rounded border border-line bg-[#e8e4dc] touch-none select-none"
        />
        {faza !== "voznja" && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center">
            <p className="rounded border border-line bg-panel px-3 py-2 text-sm font-semibold">
              {faza === "ucitavam" ? t.gradLoading : faza === "bezWebgl" ? t.gradNoWebgl : t.gradFailed}
            </p>
          </div>
        )}
        {faza === "voznja" && udaren && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/40 p-4">
            <div role="alertdialog" aria-labelledby="udaren-naslov" className="max-w-sm rounded border border-red bg-paper p-4 text-center shadow-lg">
              <p id="udaren-naslov" className="font-display text-lg font-bold text-red">
                {t.gradHitTitle}
              </p>
              <p className="mt-2 text-sm">{t.gradHitText}</p>
              <p className="mt-2 text-sm text-muted">{praviloPrekrsaja(udaren, t)}</p>
              <button
                type="button"
                onClick={() => {
                  setUdaren(null);
                  setKartica(null);
                  setPrekrsaji([]);
                  setFaza("ucitavam");
                  setPokusaj((x) => x + 1);
                }}
                className="mt-4 rounded border border-blue bg-blue px-4 py-2 font-semibold text-white"
              >
                {t.gradHitAgain}
              </button>
            </div>
          </div>
        )}
        {faza === "voznja" && kartica && !udaren && (
          <div
            role="alert"
            className={`absolute top-2 right-2 max-w-[18rem] rounded border p-2 text-xs shadow ${
              kartica.ozbiljnost === "fail" ? "border-red bg-red-soft" : "border-line bg-paper"
            }`}
          >
            <p className={`font-display font-bold ${kartica.ozbiljnost === "fail" ? "text-red" : "text-muted"}`}>
              {naslovPrekrsaja(kartica, t)}
            </p>
            <p className="mt-1">{praviloPrekrsaja(kartica, t)}</p>
          </div>
        )}
        {faza === "voznja" && (
          <div className="absolute right-2 bottom-2 flex gap-1">
            <button
              type="button"
              onClick={() => setZum((z) => Math.min(GRAD_ZUM.length - 1, z + 1))}
              disabled={zum === GRAD_ZUM.length - 1}
              aria-label={t.gradZoomOut}
              className="h-9 w-9 rounded border border-line bg-panel text-lg font-bold disabled:opacity-40"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => setZum((z) => Math.max(0, z - 1))}
              disabled={zum === 0}
              aria-label={t.gradZoomIn}
              className="h-9 w-9 rounded border border-line bg-panel text-lg font-bold disabled:opacity-40"
            >
              +
            </button>
          </div>
        )}
        {faza === "voznja" && (
          <div className="pointer-events-none absolute top-2 left-2 flex flex-col items-start gap-2">
            {/* Ograničenje samo kad ga OSM zna — bez pretpostavke, pravila još nema. */}
            <div className="flex items-start gap-2">
              <Brzinomjer brzina={hud.kmh} ogranicenje={ogranicenje} t={t} />
              {hud.rikverc && (
                <p
                  className="rounded border border-line bg-panel/90 px-2 py-1 text-xs font-bold"
                  aria-live="polite"
                >
                  R · {t.gradReverse}
                </p>
              )}
            </div>
            <p className="max-w-[16rem] rounded border border-line bg-panel/90 px-2 py-1 text-xs font-semibold">
              <span aria-label={t.gradClock}>{hud.sat}</span> · {t.gradStreet}: {hud.ulica || t.gradUnnamed}
              {hud.fps !== null ? ` · ${hud.fps.toFixed(0)} fps` : ""}
              {hud.vozila !== null ? ` · ${hud.vozila} vozila` : ""}
              {hud.parkirano !== null ? ` · ${hud.parkirano} parkirano` : ""}
              {hud.pjesaka !== null ? ` · ${hud.pjesaka} pješaka` : ""}
              {hud.korakMs !== null ? ` · korak ${hud.korakMs.toFixed(2)} ms` : ""}
            </p>
            {kisa && (
              <p className="max-w-[16rem] rounded border border-line bg-panel/90 px-2 py-1 text-xs font-semibold">
                {t.gradRainNote}
              </p>
            )}
            <p className="rounded border border-line bg-panel/90 px-2 py-1 text-xs font-semibold" aria-live="polite">
              {t.gradViolations}: {prekrsaji.length} · {t.gradStatClean.replace("{n}", String(hud.cisto))}
            </p>
            {hud.odDo !== null && (
              <p className="rounded border border-blue bg-blue px-2 py-1 text-xs font-bold text-white tabular-nums">
                {t.gradOdDoTimer.replace("{vrijeme}", minSek(hud.odDo))}
              </p>
            )}
            {hud.nav && <Putokaz manevar={hud.nav.manevar} za={hud.nav.za} doCilja={hud.nav.doCilja} cilj={hud.nav.cilj} t={t} />}
          </div>
        )}
        {faza === "voznja" && (
          <div className="pointer-events-none absolute bottom-2 left-2">
            <MiniMapaGrada ulice={ulice} auto={hud.mini.auto} ruta={hud.mini.ruta} cilj={hud.mini.cilj} t={t} />
          </div>
        )}
        {faza === "voznja" && poruka && !kartica && (
          <p role="status" className="absolute top-2 right-2 max-w-[18rem] rounded border border-blue bg-paper px-2 py-1 text-xs font-semibold shadow">
            {poruka}
          </p>
        )}
        {faza === "voznja" && izborCilja && (
          <IzborCilja
            odredista={ciljZaOdDo ? odredista.filter((o) => o.kategorija !== "znamenitost") : odredista}
            izaberi={(o) => (ciljZaOdDo ? pocniOdDo(ciljZaOdDo, o) : izaberiCilj(o))}
            nasumicno={() => {
              if (ciljZaOdDo) {
                pocniOdDo(ciljZaOdDo, null);
                return;
              }
              const lista = odredista.filter((o) => o.kategorija !== "znamenitost");
              if (lista.length > 0) izaberiCilj(lista[Math.floor(Math.random() * lista.length)]!);
            }}
            zatvori={() => {
              setIzborCilja(false);
              setCiljZaOdDo(null);
            }}
            t={t}
          />
        )}
        {faza === "voznja" && odDoIzbor && (
          <OdDoIzbor
            pocetna={zadnjaTezinaRef.current}
            nasumicno={(tez) => pocniOdDo(tez, null)}
            izaberi={(tez) => {
              zadnjaTezinaRef.current = tez;
              setOdDoIzbor(false);
              setCiljZaOdDo(tez);
              setIzborCilja(true);
            }}
            zatvori={() => setOdDoIzbor(false)}
            t={t}
          />
        )}
        {faza === "voznja" && rezultat && !udaren && (
          <OdDoRezultat
            r={rezultat}
            ponovo={() => {
              setRezultat(null);
              pauzaRef.current = false;
              pocniOdDo(rezultat.tezina, null);
            }}
            zatvori={() => {
              setRezultat(null);
              pauzaRef.current = false;
            }}
            t={t}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => {
            volan.release();
            setIzborCilja(true);
          }}
          disabled={faza !== "voznja"}
          className="rounded border border-blue bg-blue px-3 py-1 font-semibold text-white disabled:opacity-40"
        >
          {cilj ? `${t.gradNavDestination}: ${cilj.ime}` : t.gradNavChoose}
        </button>
        {(cilj || odDo) && (
          <button type="button" onClick={() => izaberiCilj(null)} className="rounded border border-line bg-panel px-2 py-1 font-semibold">
            {odDo ? t.gradOdDoCancel : t.gradNavClear}
          </button>
        )}
        {!odDo && (
          <button
            type="button"
            onClick={() => {
              volan.release();
              setOdDoIzbor(true);
            }}
            disabled={faza !== "voznja"}
            className="rounded border border-blue bg-panel px-3 py-1 font-semibold text-blue disabled:opacity-40"
          >
            {t.gradOdDo}
          </button>
        )}
        <span className="text-muted">
          {t.gradStatToday
            .replace("{km}", dan.km.toFixed(1))
            .replace("{cisto}", String(dan.cisteMinute))
            .replace("{prekrsaji}", String(dan.prekrsaja))}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <fieldset className="flex items-center gap-1">
          <legend className="sr-only">{t.gradTimeOfDay}</legend>
          <span className="mr-1 text-muted" aria-hidden>
            {t.gradTimeOfDay}:
          </span>
          {/* Dan teče sam (stavka 8d); dugmad pomjere sat na to doba. */}
          {(
            [
              ["jutro", t.gradMorning],
              ["dan", t.gradDay],
              ["sumrak", t.gradDusk],
              ["noc", t.gradNight],
            ] as const
          ).map(([d, ime]) => (
            <button
              key={d}
              type="button"
              onClick={() => pomjeriSat(GRAD_SAT_PRECICE[d])}
              aria-label={`${ime} (${satTekst(GRAD_SAT_PRECICE[d])})`}
              className="rounded border border-line bg-panel px-2 py-1 font-semibold"
            >
              {ime}
            </button>
          ))}
        </fieldset>
        <fieldset className="flex items-center gap-1">
          <legend className="sr-only">{t.gradLevel}</legend>
          <span className="mr-1 text-muted" aria-hidden>
            {t.gradLevel}:
          </span>
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={nivo === n}
              onClick={() => setNivo(n)}
              // Za vožnju od–do nivo je dio težine.
              disabled={odDo !== null}
              className={`h-8 w-8 rounded border font-semibold disabled:opacity-40 ${nivo === n ? "border-blue bg-blue text-white" : "border-line bg-panel"}`}
            >
              {n}
            </button>
          ))}
        </fieldset>
        <fieldset className="flex items-center gap-1">
          <legend className="sr-only">{t.gradWeather}</legend>
          <span className="mr-1 text-muted" aria-hidden>
            {t.gradWeather}:
          </span>
          {(
            [
              [false, t.gradSun],
              [true, t.gradRain],
            ] as const
          ).map(([k, ime]) => (
            <button
              key={ime}
              type="button"
              aria-pressed={kisa === k}
              onClick={() => setKisa(k)}
              className={`rounded border px-2 py-1 font-semibold ${kisa === k ? "border-blue bg-blue text-white" : "border-line bg-panel"}`}
            >
              {ime}
            </button>
          ))}
        </fieldset>
      </div>
      <p className="text-sm text-muted">{t.gradHint}</p>
      <DriveControls
        volan={volan}
        steerLabel={t.gameSteer}
        throttleLabel={t.gameThrottle}
        brakeLabel={t.gameBrake}
        indicator={{
          label: t.gameIndicator,
          leftLabel: t.gameIndicatorLeft,
          rightLabel: t.gameIndicatorRight,
          rezim: "rucni",
          autoLabel: t.gameIndicatorAuto,
          autoShort: t.gameIndicatorAutoShort,
          stanje: () => ({ strana: inputRef.current.indicator, svijetli: zmigavacSvijetli(simTRef.current) }),
        }}
      />
    </div>
  );
}
