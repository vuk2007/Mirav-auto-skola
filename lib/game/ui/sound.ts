/**
 * Zvuk igre — sintetisan, bez ijednog fajla.
 *
 * Dvije stvari trebaju: truba iza leđa dok zadržavaš saobraćaj, i udarac pri
 * sudaru. Oba su kratka i jednostavna, pa se prave WebAudio-om umjesto da se u
 * repo ubacuju snimci: nema pitanja licence, nema dodatnog zahtjeva sa mreže i
 * nema binarnog fajla koji niko ne može da pregleda u diffu.
 *
 * `AudioContext` se pravi tek na prvi zvuk, jer ga pregledači ne dozvoljavaju
 * prije korisničke radnje.
 */

export interface Sound {
  horn(): void;
  crash(): void;
  setMuted(muted: boolean): void;
  close(): void;
}

type Ctor = typeof AudioContext;

function audioCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export function createSound(): Sound {
  let ctx: AudioContext | null = null;
  let muted = false;

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

    setMuted(next) {
      muted = next;
      if (next && ctx) {
        void ctx.close();
        ctx = null;
      }
    },

    close() {
      if (ctx) void ctx.close();
      ctx = null;
    },
  };
}
