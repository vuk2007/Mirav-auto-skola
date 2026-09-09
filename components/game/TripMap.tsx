"use client";

import { useMemo } from "react";
import { EDGES, NODES, type RoadNode } from "@/lib/game/road/roadGraph";
import type { TripState } from "@/lib/game/trip/trip";

/**
 * Karta putovanja.
 *
 * Nije navigacija nego dnevnik: pokazuje gdje si bio, kojim si putevima išao i
 * gdje si sada. Sa nje se ne može nigdje otići — do svakog mjesta se stiže
 * vožnjom, a putokaz na čvoru je jedini način da se izabere pravac. Karta koja
 * bi nudila skok obesmislila bi cijelo putovanje.
 *
 * Koordinate su procjena (`coordsVerified: false`), pa je i ovo skica oblika
 * zemlje, a ne mjerenje. Sjever je gore.
 */

/** Ravna projekcija; na širini Crne Gore je iskrivljenje zanemarljivo. */
const SIRINA_SREDINE = 42.7;
const KOSINUS = Math.cos((SIRINA_SREDINE * Math.PI) / 180);

const RUB = 26;
const SIROKO = 640;

interface Tacka {
  x: number;
  y: number;
}

function projekcija(): { tacke: Map<string, Tacka>; visina: number } {
  const xs = NODES.map((n) => n.lon * KOSINUS);
  const ys = NODES.map((n) => -n.lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const razmjera = (SIROKO - 2 * RUB) / (maxX - minX);
  const visina = (maxY - minY) * razmjera + 2 * RUB;

  const tacke = new Map<string, Tacka>();
  for (const n of NODES) {
    tacke.set(n.id, {
      x: RUB + (n.lon * KOSINUS - minX) * razmjera,
      y: RUB + (-n.lat - minY) * razmjera,
    });
  }
  return { tacke, visina };
}

/**
 * Raspoređivanje natpisa.
 *
 * U Boki je pet mjesta na dvadesetak kilometara, pa natpisi jedan preko
 * drugoga ne kažu ništa. Zato svaki natpis dobija četiri moguća mjesta oko
 * svoje tačke i uzima prvo slobodno; ako nijedno nije slobodno, ostaje samo
 * tačka — bolje bez imena nego nečitljivo.
 *
 * Redoslijed je važan i namjeran: prvo mjesto u kojem se stoji, pa ono što
 * putokaz upravo nudi, pa ostalo. Tako se u gužvi gubi ono najmanje potrebno.
 */
interface Natpis {
  id: string;
  text: string;
  x: number;
  y: number;
  size: number;
  weight: number;
  anchor: "start" | "end";
}

function rasporedi(
  kandidati: { id: string; text: string; p: Tacka; r: number; vazno: number }[],
): Natpis[] {
  const zauzeto: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const sudar = (a: (typeof zauzeto)[number]) =>
    zauzeto.some((b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1);

  const out: Natpis[] = [];
  for (const k of [...kandidati].sort((a, b) => a.vazno - b.vazno)) {
    const size = k.vazno === 0 ? 12 : 10;
    const weight = k.vazno === 0 ? 700 : 500;
    // Širina slova se procjenjuje; tačna mjera traži platno, a ovdje je
    // dovoljno da se kutije ne dodiruju.
    const w = k.text.length * size * 0.55;
    const h = size * 1.15;
    const d = k.r + 3;
    // Osam mjesta, od bližih ka daljima. Sa četiri je Njeguši — mjesto tik uz
    // Kotor — ostajao bez imena baš kad ga putokaz nudi.
    const mjesta: { x: number; y: number; anchor: "start" | "end" }[] = [
      { x: k.p.x + d, y: k.p.y + h * 0.35, anchor: "start" },
      { x: k.p.x - d, y: k.p.y + h * 0.35, anchor: "end" },
      { x: k.p.x + d, y: k.p.y - h * 0.7, anchor: "start" },
      { x: k.p.x - d, y: k.p.y + h * 1.4, anchor: "end" },
      { x: k.p.x + d, y: k.p.y + h * 1.5, anchor: "start" },
      { x: k.p.x - d, y: k.p.y - h * 0.8, anchor: "end" },
      { x: k.p.x + d * 2.4, y: k.p.y + h * 0.35, anchor: "start" },
      { x: k.p.x - d * 2.4, y: k.p.y + h * 0.35, anchor: "end" },
    ];
    for (const m of mjesta) {
      const kutija = {
        x1: m.anchor === "start" ? m.x : m.x - w,
        x2: m.anchor === "start" ? m.x + w : m.x,
        y1: m.y - h,
        y2: m.y + h * 0.25,
      };
      if (sudar(kutija)) continue;
      zauzeto.push(kutija);
      out.push({ id: k.id, text: k.text, x: m.x, y: m.y, size, weight, anchor: m.anchor });
      break;
    }
  }
  return out;
}

const BOJA = {
  put: "#c9cdc2",
  predjen: "#2f6fd0",
  cvor: "#9aa093",
  posjecen: "#191b20",
  ovdje: "#2f6fd0",
  tekst: "#191b20",
};

export default function TripMap({
  trip,
  susjedi,
}: {
  trip: TripState;
  /** Čvorovi koje putokaz upravo nudi — njih vrijedi imenovati. */
  susjedi: readonly string[];
}) {
  const { tacke, visina } = useMemo(projekcija, []);
  const posjeceni = useMemo(() => new Set(trip.visited), [trip.visited]);
  const predjeni = useMemo(() => new Set(trip.driven), [trip.driven]);
  const naziv = (n: RoadNode) => (n.kind === "granica" ? `${n.name} ⟶` : n.name);

  const natpisi = useMemo(() => {
    const susjed = new Set(susjedi);
    const kandidati = NODES.flatMap((n) => {
      const p = tacke.get(n.id);
      const vazno = n.id === trip.at ? 0 : susjed.has(n.id) ? 1 : posjeceni.has(n.id) ? 2 : -1;
      if (!p || vazno < 0) return [];
      const r = n.id === trip.at ? 6 : n.kind === "opstina" ? 3.6 : 2.4;
      return [{ id: n.id, text: naziv(n), p, r, vazno }];
    });
    return rasporedi(kandidati);
  }, [tacke, trip.at, susjedi, posjeceni]);

  return (
    <svg
      viewBox={`0 0 ${SIROKO} ${Math.round(visina)}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Karta putovanja, trenutno u mjestu ${NODES.find((n) => n.id === trip.at)?.name ?? ""}`}
    >
      {EDGES.map((e) => {
        const a = tacke.get(e.a);
        const b = tacke.get(e.b);
        if (!a || !b) return null;
        const predjen = predjeni.has(e.id);
        return (
          <line
            key={e.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={predjen ? BOJA.predjen : BOJA.put}
            strokeWidth={predjen ? 3.4 : 1.6}
            strokeLinecap="round"
            // Sezonski prevoj se i na karti vidi kao isprekidan.
            strokeDasharray={e.seasonal ? "5 4" : undefined}
          />
        );
      })}

      {NODES.map((n) => {
        const p = tacke.get(n.id);
        if (!p) return null;
        const ovdje = n.id === trip.at;
        const bio = posjeceni.has(n.id);
        const r = ovdje ? 6 : n.kind === "opstina" ? 3.6 : 2.4;
        return (
          <g key={n.id}>
            {ovdje && <circle cx={p.x} cy={p.y} r={10} fill="none" stroke={BOJA.ovdje} strokeWidth={2} />}
            <circle
              cx={p.x}
              cy={p.y}
              r={r}
              fill={ovdje ? BOJA.ovdje : bio ? BOJA.posjecen : "#ffffff"}
              stroke={ovdje ? BOJA.ovdje : bio ? BOJA.posjecen : BOJA.cvor}
              strokeWidth={1.4}
            />
          </g>
        );
      })}

      {natpisi.map((z) => (
        <text
          key={z.id}
          x={z.x}
          y={z.y}
          fontSize={z.size}
          fontWeight={z.weight}
          textAnchor={z.anchor}
          fill={BOJA.tekst}
          // Bijeli obrub odvaja slova od linije puta ispod njih.
          stroke="#f7f6f1"
          strokeWidth={2.4}
          paintOrder="stroke"
        >
          {z.text}
        </text>
      ))}
    </svg>
  );
}
