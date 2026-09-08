/**
 * Zvuk igre — sintetisan, bez ijednog fajla.
 *
 * Tri stvari trebaju: truba iza leđa dok zadržavaš saobraćaj, udarac pri
 * sudaru, i motor dok se vozi. Sve troje se pravi WebAudio-om umjesto da se u
 * repo ubacuju snimci: nema pitanja licence, nema dodatnog zahtjeva sa mreže i
 * nema binarnog fajla koji niko ne može da pregleda u diffu.
 *
 * `AudioContext` se pravi tek na prvi zvuk, jer ga pregledači ne dozvoljavaju
 * prije korisničke radnje.
 */

export interface Sound {
  horn(): void;
  crash(): void;
  /** Motor: zove se svaki kadar dok se vozi. Sam se pali na prvi poziv. */
  engine(speed: number, throttle: number): void;
  /** Gasi motor — kad vožnja stane ili ekran ode. */
  engineOff(): void;
  setMuted(muted: boolean): void;
  close(): void;
}

// ── Motor ───────────────────────────────────────────────────────────────────

/**
 * Koliko brzine „stane" u jedan stepen prenosa [m/s].
 *
 * Simulacija nema mjenjač i ne treba joj. Ali motor koji samo ravnomjerno raste
 * sa brzinom ne zvuči kao auto nego kao sirena, pa se stepeni prenosa glume:
 * ton raste do kraja stepena, pa padne i kreće ponovo. Sedam m/s je oko 25
 * km/h, pa se u gradu (do 65 km/h) čuju tri stepena, a na autoputu šest.
 */
const GEAR_SPAN = 7;
/** Broj obrtaja u praznom hodu, kao učestanost osnovnog tona [Hz]. */
const IDLE_HZ = 52;
/** Koliko se ta učestanost popne na punim obrtajima [Hz]. */
const RANGE_HZ = 78;

/**
 * Učestanost i jačina motora za datu brzinu i gas.
 *
 * Izdvojeno iz zvučnog grafa da bi se moglo testirati: WebAudio se u testu
 * nema gdje pustiti, a ovo je jedini dio koji ima logiku.
 */
export function engineTone(speed: number, throttle: number): { freq: number; gain: number } {
  const v = Math.max(0, speed);
  const gas = Math.min(1, Math.max(0, throttle));
  // Gdje smo unutar tekućeg stepena prenosa, 0–1.
  const uStepenu = (v % GEAR_SPAN) / GEAR_SPAN;
  // Gas diže obrtaje i kad vozilo stoji — inače pritisak na gas iz mjesta ne
  // bi imao zvuk dok vozilo ne krene.
  const obrtaji = Math.min(1, uStepenu * 0.75 + gas * 0.25);
  return {
    freq: IDLE_HZ + obrtaji * RANGE_HZ,
    // Prazan hod se jedva čuje; puni gas je i dalje tiši od trube (0,18).
    gain: 0.02 + obrtaji * 0.05 + gas * 0.03,
  };
}

type Ctor = typeof AudioContext;

function audioCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

interface Motor {
  osc: OscillatorNode;
  okt: OscillatorNode;
  gain: GainNode;
  filter: BiquadFilterNode;
}

export function createSound(): Sound {
  let ctx: AudioContext | null = null;
  let muted = false;
  let motor: Motor | null = null;

  /**
   * Zvučni graf motora.
   *
   * Testera na osnovnoj učestanosti i tiša oktava iznad nje, kroz niskopropusni
   * filtar — dovoljno da zvuči kao motor, a da ne struže. Filtar prati
   * učestanost, pa se sa obrtajima zvuk i „otvara".
   */
  const napraviMotor = (c: AudioContext): Motor => {
    const gain = c.createGain();
    gain.gain.value = 0.0001;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;
    filter.Q.value = 0.7;
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    const okt = c.createOscillator();
    okt.type = "square";
    const oktGain = c.createGain();
    oktGain.gain.value = 0.35;
    osc.connect(filter);
    okt.connect(oktGain);
    oktGain.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    osc.start();
    okt.start();
    return { osc, okt, gain, filter };
  };

  const ugasiMotor = () => {
    if (!motor) return;
    try {
      motor.osc.stop();
      motor.okt.stop();
      motor.gain.disconnect();
    } catch {
      // Kontekst je već zatvoren — nema šta da se gasi.
    }
    motor = null;
  };

  const ensure = (): AudioContext | null => {
    if (muted) return null;
    if (ctx) return ctx;
    const C = audioCtor();
    if (!C) return null;
    try {
      ctx = new C();
    } catch {
      // Zvuk je dodatak, ne uslov — ako ga nema, igra radi bez njega.
      return null;
    }
    return ctx;
  };

  return {
    /** Truba: dva bliska tona, kratko. */
    horn() {
      const c = ensure();
      if (!c) return;
      const t = c.currentTime;
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.setValueAtTime(0.18, t + 0.28);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      gain.connect(c.destination);
      for (const f of [440, 554]) {
        const osc = c.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = f;
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.42);
      }
    },

    /** Udarac: kratak šum sa naglim opadanjem. */
    crash() {
      const c = ensure();
      if (!c) return;
      const t = c.currentTime;
      const trajanje = 0.35;
      const buffer = c.createBuffer(1, Math.floor(c.sampleRate * trajanje), c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const k = 1 - i / data.length;
        data[i] = (Math.random() * 2 - 1) * k * k;
      }
      const src = c.createBufferSource();
      src.buffer = buffer;
      const gain = c.createGain();
      gain.gain.value = 0.35;
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1200;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(c.destination);
      src.start(t);
    },

    /**
     * Motor. Vrijednosti se ne postavljaju naglo nego se ka njima ide
     * (`setTargetAtTime`) — skok učestanosti se čuje kao pucketanje.
     */
    engine(speed, throttle) {
      const c = ensure();
      if (!c) return;
      if (!motor) motor = napraviMotor(c);
      const { freq, gain } = engineTone(speed, throttle);
      const t = c.currentTime;
      motor.osc.frequency.setTargetAtTime(freq, t, 0.05);
      motor.okt.frequency.setTargetAtTime(freq * 2, t, 0.05);
      motor.filter.frequency.setTargetAtTime(freq * 6, t, 0.08);
      motor.gain.gain.setTargetAtTime(gain, t, 0.05);
    },

    engineOff() {
      if (!motor || !ctx) return ugasiMotor();
      // Kratko utišavanje prije gašenja, da se ne odsiječe.
      motor.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03);
      const m = motor;
      motor = null;
      window.setTimeout(() => {
        try {
          m.osc.stop();
          m.okt.stop();
          m.gain.disconnect();
        } catch {
          // Kontekst je u međuvremenu zatvoren.
        }
      }, 150);
    },

    setMuted(next) {
      muted = next;
      if (next && ctx) {
        ugasiMotor();
        void ctx.close();
        ctx = null;
      }
    },

    close() {
      ugasiMotor();
      if (ctx) void ctx.close();
      ctx = null;
    },
  };
}
