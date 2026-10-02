import type { Point } from "@/lib/game/sim/types";
import { pointAt } from "@/lib/game/sim/geometry";
import { dionicaIvice, type Pogodak } from "@/lib/game/grad/editorAlati";
import type { SvijetGrada } from "@/lib/game/grad/svijet";

/**
 * Preklop editora grada: 2D crtež preko WebGL karte, u istom kadru (sjever
 * gore). Izbor, krakovi sa brojevima (paneli ih tako zovu), smjer ulice
 * `a → b` (formular dionice kaže „naprijed" za taj smjer), izvedene
 * raskrsnice, zone, nacrt nove ulice ili poligona, ruta zadatka.
 */

export interface Nacrt {
  tacke: Point[];
  /** Zadnji klik u režimu zadatka (na koju ulicu). */
  pogodak?: Pogodak;
  /** Pregled rute zadatka. */
  ruta?: Point[];
}

interface Kadar {
  wx: number;
  wy: number;
  scale: number;
  W: number;
  H: number;
}

export function crtajPreklop(
  g: CanvasRenderingContext2D,
  k: Kadar,
  s: SvijetGrada,
  st: { izbor: Pogodak | null; nacrt: Nacrt; prikaziIzvedeno: boolean; rezim: string },
): void {
  const ek = (p: Point) => ({ x: (p.x - k.wx) * k.scale + k.W / 2, y: (p.y - k.wy) * k.scale + k.H / 2 });
  const vidi = (p: Point, r = 50) => Math.abs(p.x - k.wx) * k.scale < k.W / 2 + r * k.scale && Math.abs(p.y - k.wy) * k.scale < k.H / 2 + r * k.scale;
  const linija = (t: readonly Point[], boja: string, w: number, crtice: number[] = []) => {
    if (t.length < 2) return;
    g.beginPath();
    t.forEach((p, i) => {
      const q = ek(p);
      if (i === 0) g.moveTo(q.x, q.y);
      else g.lineTo(q.x, q.y);
    });
    g.setLineDash(crtice);
    g.strokeStyle = boja;
    g.lineWidth = w;
    g.stroke();
    g.setLineDash([]);
  };
  const krug = (p: Point, r: number, boja: string, puna = false) => {
    const q = ek(p);
    g.beginPath();
    g.arc(q.x, q.y, r, 0, 2 * Math.PI);
    if (puna) {
      g.fillStyle = boja;
      g.fill();
    } else {
      g.strokeStyle = boja;
      g.lineWidth = 2;
      g.stroke();
    }
  };
  const tekst = (p: Point, t: string, boja = "#111") => {
    const q = ek(p);
    g.font = "bold 12px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 3;
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.strokeText(t, q.x, q.y);
    g.fillStyle = boja;
    g.fillText(t, q.x, q.y);
  };
  const m = s.mreza;

  // Zone sa poligonom.
  for (const z of s.zone) {
    if (z.poligon.length < 3) continue;
    const t = z.poligon.map(([x, y]) => ({ x, y }));
    linija([...t, t[0]!], "rgba(31,95,191,0.8)", 2, [8, 5]);
    tekst(t[0]!, z.ime.slice(0, 30), "#1f5fbf");
  }

  // Izvedene raskrsnice (prioritet ili faze) — narandžasto, da se prođu.
  if (st.prikaziIzvedeno && k.scale > 0.6) {
    for (const r of s.raskrsnice.lista) {
      if ((r.inferredPriority || r.inferredPhases) && vidi(r.centar)) krug(r.centar, 5, "rgba(230,120,0,0.85)", true);
    }
  }

  // Čvorovi u režimu pomjeranja.
  if (st.rezim === "cvor" && k.scale > 2.5) {
    m.cvorovi.forEach((c, i) => {
      if ((m.izCvora[i]?.length ?? 0) > 0 && vidi(c, 10)) krug(c, 3, "#333", true);
    });
  }

  const iz = st.izbor;
  if (iz?.vrsta === "raskrsnica" || iz?.vrsta === "krak") {
    const r = s.raskrsnice.lista[iz.r]!;
    const poluprecnik = Math.max(8, ...r.cvorovi.map((c) => Math.hypot(m.cvorovi[c]!.x - r.centar.x, m.cvorovi[c]!.y - r.centar.y) + 6));
    krug(r.centar, poluprecnik * k.scale, "#f5c400");
    r.kraci.forEach((kr, j) => {
      const iv = m.ivice[kr.ivica]!;
      const d = Math.min(16, iv.duzina * 0.6);
      const p = pointAt(iv.tacke, iv.cum, kr.kraj === 1 ? iv.duzina - d : d);
      const izabran = iz.vrsta === "krak" && iz.k === j;
      if (izabran) {
        const s0 = kr.kraj === 1 ? Math.max(0, iv.duzina - 30) : 0;
        const s1 = kr.kraj === 1 ? iv.duzina : Math.min(iv.duzina, 30);
        const t: Point[] = [];
        for (let x = s0; x <= s1; x += 1) t.push(pointAt(iv.tacke, iv.cum, x));
        linija(t, "rgba(245,196,0,0.9)", Math.max(4, iv.sirina * k.scale * 0.5));
      }
      tekst(p, `${j + 1}${kr.ulaz ? "" : "↑"}`, izabran ? "#c8102e" : "#111");
    });
  }
  if (iz?.vrsta === "ulica") {
    for (const i of dionicaIvice(m, iz.ivica)) linija(m.ivice[i]!.tacke, "rgba(245,196,0,0.85)", Math.max(4, m.ivice[i]!.sirina * k.scale * 0.4));
    // Strelica smjera `a → b` izabrane ivice: „naprijed" u formularu.
    const a = iz.tacka;
    const b = { x: a.x + iz.pravac.x * 8, y: a.y + iz.pravac.y * 8 };
    linija([a, b], "#c8102e", 3);
    const n = { x: -iz.pravac.y, y: iz.pravac.x };
    linija([{ x: b.x - iz.pravac.x * 2.5 + n.x * 1.5, y: b.y - iz.pravac.y * 2.5 + n.y * 1.5 }, b, { x: b.x - iz.pravac.x * 2.5 - n.x * 1.5, y: b.y - iz.pravac.y * 2.5 - n.y * 1.5 }], "#c8102e", 3);
    krug(iz.tacka, 4, "#c8102e", true);
  }
  if (iz?.vrsta === "cvor") krug(m.cvorovi[iz.cvor]!, 8, "#c8102e");

  // Nacrt: nova ulica, poligon zone, tačke zadatka; ruta zadatka.
  if (st.nacrt.ruta) linija(st.nacrt.ruta, "rgba(52,199,89,0.9)", 5);
  if (st.nacrt.tacke.length) {
    linija(st.nacrt.tacke, "#c8102e", 2, [6, 4]);
    st.nacrt.tacke.forEach((p, i) => {
      krug(p, 4, "#c8102e", true);
      if (st.rezim === "zadatak") tekst({ x: p.x, y: p.y - 4 / k.scale - 3 }, i === 0 ? "S" : String(i));
    });
  }
}
