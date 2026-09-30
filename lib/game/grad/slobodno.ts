import {
  A_MAX,
  B_MAX,
  CAR_LENGTH,
  CAR_WIDTH,
  DT,
  GRAD_BOCNO_UBRZANJE,
  GRAD_DRAG,
  GRAD_IVICNJAK_OKRET,
  GRAD_IVICNJAK_UGAO,
  GRAD_IVICNJAK_USPORENJE,
  GRAD_MEDJUOSOVINSKO,
  GRAD_RIKVERC_A,
  GRAD_RIKVERC_CEKANJE,
  GRAD_RIKVERC_PEDALA,
  GRAD_RIKVERC_V,
  GRAD_V_TOP,
  GRAD_VOLAN_BRZINA,
  GRAD_VOLAN_UGAO,
  STEER_DEAD_ZONE,
} from "../sim/config";
import { integrate } from "../sim/dinamika";
import type { Input, Point } from "../sim/types";
import { pocetniBok } from "./mreza";
import { naPovrsini, pravacUlice, type Povrsina } from "./povrsina";
import { pravacNaIvici, tackaNaIvici } from "./voznja";

/**
 * Igračev auto u gradu, slobodan (faza 6, stavka 3c): volan okreće točkove, a
 * auto ide kuda točkovi kažu — skreće se tamo gdje igrač skrene, ne bira se
 * izlaz unaprijed. Bez pravila; ona dolaze u stavci 5 i sude po tome gdje je
 * auto, a ne po tome koju je ivicu grafa izabrao.
 *
 * Kretanje je model bicikla: zadnja osovina ide pravo naprijed, prednja je
 * okrenuta za ugao točkova. Auto ne može napustiti asfalt (`Povrsina`): kad bi
 * ijedna tačka oboda prešla ivičnjak, auto koso okrznut ivičnjakom klizi uz
 * njega, usporava i poravnava se sa ulicom; čeono udaren staje u mjestu, i iz
 * toga se izlazi rikvercom.
 */

export interface SlobodnoVozilo {
  /** Sredina auta [m]. */
  x: number;
  y: number;
  /** Smjer auta [rad], kao `atan2(y, x)`; `y` raste nadolje. */
  ugao: number;
  /** Brzina [m/s]; negativna je unazad. */
  v: number;
  /** Ugao prednjih točkova [rad]; pozitivan je udesno. */
  tocak: number;
  /** Ubačen rikverc: kočnica tada vozi unazad, a gas koči. */
  rikverc: boolean;
  /** Koliko se kočnica drži u mjestu [s] — rikverc se ubacuje tek poslije `GRAD_RIKVERC_CEKANJE`. */
  kocnicaStoji: number;
  /** Auto je u ovom koraku udario u ivičnjak. */
  udar: boolean;
  /** Ukupno pređeno, bez obzira na smjer [m]. */
  predjeno: number;
}

/** Auto na ivici `ivica`, `s` metara od početka u smjeru `smjer`, u desnoj traci. */
export function slobodnoNaIvici(p: Povrsina, ivica: number, smjer: 1 | -1, s: number): SlobodnoVozilo {
  const iv = p.mreza.ivice[ivica]!;
  const c = tackaNaIvici(iv, smjer, s);
  const h = pravacNaIvici(iv, smjer, s);
  const bok = pocetniBok(iv);
  return {
    x: c.x - h.y * bok,
    y: c.y + h.x * bok,
    ugao: Math.atan2(h.y, h.x),
    v: 0,
    tocak: 0,
    rikverc: false,
    kocnicaStoji: 0,
    udar: false,
    predjeno: 0,
  };
}

/**
 * Najveći ugao točkova na brzini `v` [rad]: pun ugao u mjestu i polako, a na
 * brzini onoliko koliko dopušta `GRAD_BOCNO_UBRZANJE` (v²/R ≤ a).
 */
export function najveciTocak(v: number): number {
  const pun = (GRAD_VOLAN_UGAO * Math.PI) / 180;
  const v2 = v * v;
  if (v2 < 1e-6) return pun;
  return Math.min(pun, Math.atan((GRAD_BOCNO_UBRZANJE * GRAD_MEDJUOSOVINSKO) / v2));
}

/**
 * Tačke oboda auta koje ne smiju preći ivičnjak: četiri ugla, sredine bokova i
 * sredine prednje i zadnje strane. Samo uglovi nisu dovoljni — pri skretanju
 * ugao trotoara zalazi u bok auta između njih.
 */
const OBOD: readonly [number, number][] = [
  [0.5, 0.5],
  [0.5, -0.5],
  [-0.5, 0.5],
  [-0.5, -0.5],
  [0, 0.5],
  [0, -0.5],
  [0.5, 0],
  [-0.5, 0],
].map(([u, w]): [number, number] => [u! * CAR_LENGTH, w! * CAR_WIDTH]);

/** Da li je cijeli auto u položaju (`x`, `y`, `ugao`) na asfaltu. */
export function autoNaPovrsini(p: Povrsina, x: number, y: number, ugao: number): boolean {
  const c = Math.cos(ugao);
  const s = Math.sin(ugao);
  for (const [u, w] of OBOD) {
    if (!naPovrsini(p, x + u * c - w * s, y + u * s + w * c)) return false;
  }
  return true;
}

/** Pedale: brzina u ovom koraku, i rikverc koji se ubacuje ili izbacuje. */
function pedale(st: SlobodnoVozilo, input: Input): void {
  const gas = input.throttle;
  const kocnica = input.brake;
  if (!st.rikverc) {
    // U mjestu, kočnica držana `GRAD_RIKVERC_CEKANJE` i bez gasa: rikverc.
    if (st.v <= 0.01 && kocnica >= GRAD_RIKVERC_PEDALA && gas === 0) {
      st.kocnicaStoji += DT;
      if (st.kocnicaStoji >= GRAD_RIKVERC_CEKANJE) {
        st.rikverc = true;
        st.kocnicaStoji = 0;
      }
    } else st.kocnicaStoji = 0;
  } else if (st.v >= -0.01 && gas >= GRAD_RIKVERC_PEDALA && kocnica === 0) {
    // U mjestu u rikvercu, gas: nazad u prvu, odmah.
    st.rikverc = false;
  }
  if (!st.rikverc) {
    const k = { v: Math.max(0, st.v), s: 0 };
    integrate(k, gas * A_MAX - kocnica * B_MAX, GRAD_V_TOP, GRAD_DRAG);
    st.v = k.v;
  } else {
    // Unazad su uloge pedala obrnute: kočnica je gas unazad, gas koči.
    const k = { v: Math.max(0, -st.v), s: 0 };
    integrate(k, kocnica * GRAD_RIKVERC_A - gas * B_MAX, GRAD_RIKVERC_V, GRAD_DRAG);
    st.v = -k.v;
  }
}

/** Jedan korak (`DT`). Mijenja `st` na mjestu. */
export function korakSlobodno(p: Povrsina, st: SlobodnoVozilo, input: Input): void {
  pedale(st, input);

  // Točkovi idu ka onome što volan traži, brzinom `GRAD_VOLAN_BRZINA`, i nikad
  // preko onoga što brzina dopušta.
  const steer = input.steer ?? 0;
  const komanda = Math.abs(steer) < STEER_DEAD_ZONE ? 0 : Math.max(-1, Math.min(1, steer));
  const granica = najveciTocak(st.v);
  const cilj = komanda * granica;
  const korakTocka = ((GRAD_VOLAN_BRZINA * Math.PI) / 180) * DT;
  st.tocak += Math.max(-korakTocka, Math.min(korakTocka, cilj - st.tocak));
  st.tocak = Math.max(-granica, Math.min(granica, st.tocak));

  // Model bicikla: zadnja osovina ide duž auta, auto se okreće oko nje.
  const pola = GRAD_MEDJUOSOVINSKO / 2;
  const c = Math.cos(st.ugao);
  const s = Math.sin(st.ugao);
  const zx = st.x - c * pola + c * st.v * DT;
  const zy = st.y - s * pola + s * st.v * DT;
  const ugao = st.ugao + (st.v / GRAD_MEDJUOSOVINSKO) * Math.tan(st.tocak) * DT;
  const x = zx + Math.cos(ugao) * pola;
  const y = zy + Math.sin(ugao) * pola;

  st.udar = false;
  if (st.v === 0 || autoNaPovrsini(p, x, y, ugao) || !autoNaPovrsini(p, st.x, st.y, st.ugao)) {
    // Slobodno — ili je auto već bio van asfalta (start na uskom mjestu), pa
    // se pušta da izađe umjesto da zaglavi.
    pomjeri(st, x, y, ugao);
    return;
  }
  st.udar = true;
  if (!kliziUzIvicnjak(p, st)) st.v = 0;
}

function pomjeri(st: SlobodnoVozilo, x: number, y: number, ugao: number): void {
  st.predjeno += Math.hypot(x - st.x, y - st.y);
  st.x = x;
  st.y = y;
  st.ugao = ugao;
}

/**
 * Ivičnjak okrznut pod malim uglom: auto ide duž ulice, sporije, i okreće se
 * ka njenom pravcu. `false` kad je udar čeon (ugao veći od
 * `GRAD_IVICNJAK_UGAO`) ili kad ni klizanje ne ostavlja auto na asfaltu.
 */
function kliziUzIvicnjak(p: Povrsina, st: SlobodnoVozilo): boolean {
  const osa = pravacUlice(p, st.x, st.y);
  if (!osa) return false;
  // Smjer kretanja: kuda auto gleda, ili suprotno u rikvercu.
  const znak = st.v > 0 ? 1 : -1;
  const kx = Math.cos(st.ugao) * znak;
  const ky = Math.sin(st.ugao) * znak;
  const okreni = osa.x * kx + osa.y * ky < 0 ? -1 : 1;
  const dx = osa.x * okreni;
  const dy = osa.y * okreni;
  const cosA = dx * kx + dy * ky;
  if (cosA < Math.cos((GRAD_IVICNJAK_UGAO * Math.PI) / 180)) return false;

  const brzina = Math.max(0, Math.abs(st.v) * cosA - GRAD_IVICNJAK_USPORENJE * DT);
  // Auto se okreće ka pravcu ulice — nosom kad ide naprijed, zadnjim krajem unazad.
  const cilj = Math.atan2(dy * znak, dx * znak);
  let razlika = cilj - st.ugao;
  while (razlika > Math.PI) razlika -= 2 * Math.PI;
  while (razlika < -Math.PI) razlika += 2 * Math.PI;
  const najvise = ((GRAD_IVICNJAK_OKRET * Math.PI) / 180) * DT;
  const ugao = st.ugao + Math.max(-najvise, Math.min(najvise, razlika));
  const x = st.x + dx * brzina * DT;
  const y = st.y + dy * brzina * DT;
  if (!autoNaPovrsini(p, x, y, ugao)) return false;
  st.v = brzina * znak;
  pomjeri(st, x, y, ugao);
  return true;
}

/** Gdje je auto i kuda gleda — isti oblik kao `poza` u `voznja.ts`. */
export function pozaSlobodno(st: SlobodnoVozilo): { pos: Point; heading: Point } {
  return { pos: { x: st.x, y: st.y }, heading: { x: Math.cos(st.ugao), y: Math.sin(st.ugao) } };
}
