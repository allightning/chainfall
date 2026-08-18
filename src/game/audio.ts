let ctx: AudioContext | null = null;
let muted = false;
let noise: AudioBuffer | null = null;
let ambient: { stop: () => void } | null = null;

function ac(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  return ctx;
}

function noiseBuf(c: AudioContext): AudioBuffer {
  if (noise) return noise;
  const n = c.createBuffer(1, c.sampleRate * 1.2, c.sampleRate);
  const d = n.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = last * 0.96 + (Math.random() * 2 - 1) * 0.04;
    d[i] = last + (Math.random() * 2 - 1) * 0.18;
  }
  noise = n;
  return n;
}

function envGain(c: AudioContext, t0: number, a: number, dur: number, peak: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  return g;
}

function tone(
  c: AudioContext,
  freq: number,
  dur: number,
  peak: number,
  type: OscillatorType,
  t0 = c.currentTime,
  slide?: number,
): void {
  const o = c.createOscillator();
  const g = envGain(c, t0, 0.01, dur, peak);
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function filteredNoise(
  c: AudioContext,
  dur: number,
  peak: number,
  freq: number,
  q: number,
  type: BiquadFilterType = "lowpass",
  t0 = c.currentTime,
): void {
  const src = c.createBufferSource();
  src.buffer = noiseBuf(c);
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t0);
  f.Q.value = q;
  const g = envGain(c, t0, 0.008, dur, peak);
  src.connect(f);
  f.connect(g);
  g.connect(c.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

export function unlockAudio(): void {
  const c = ac();
  void c?.resume();
}

export function toggleMute(): boolean {
  muted = !muted;
  if (muted) stopAmbient();
  return muted;
}

export function isMuted(): boolean {
  return muted;
}

export function startAmbient(): void {
  stopAmbient();
  const c = ac();
  if (!c || c.state !== "running") return;
  const master = c.createGain();
  master.gain.value = 0.045;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 420;
  filter.Q.value = 0.7;
  const lfo = c.createOscillator();
  const lfoG = c.createGain();
  lfo.type = "sine";
  lfo.frequency.value = 0.07;
  lfoG.gain.value = 180;
  lfo.connect(lfoG);
  lfoG.connect(filter.frequency);
  const oscs: OscillatorNode[] = [];
  for (const [f, type, g] of [
    [46, "sine", 0.5],
    [69.3, "sine", 0.28],
    [92, "triangle", 0.08],
    [184, "sine", 0.04],
  ] as const) {
    const o = c.createOscillator();
    const gg = c.createGain();
    o.type = type;
    o.frequency.value = f;
    gg.gain.value = g;
    o.connect(gg);
    gg.connect(filter);
    o.start();
    oscs.push(o);
  }
  const shimmer = c.createOscillator();
  const shG = c.createGain();
  shimmer.type = "sine";
  shimmer.frequency.value = 740;
  shG.gain.value = 0.012;
  const shLfo = c.createOscillator();
  const shLfoG = c.createGain();
  shLfo.frequency.value = 0.13;
  shLfoG.gain.value = 0.01;
  shLfo.connect(shLfoG);
  shLfoG.connect(shG.gain);
  shimmer.connect(shG);
  shG.connect(filter);
  shimmer.start();
  shLfo.start();
  filter.connect(master);
  master.connect(c.destination);
  lfo.start();
  ambient = {
    stop: () => {
      master.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.4);
      setTimeout(() => {
        for (const o of oscs) {
          try {
            o.stop();
          } catch {
            /* already stopped */
          }
        }
        try {
          lfo.stop();
          shimmer.stop();
          shLfo.stop();
        } catch {
          /* already stopped */
        }
      }, 450);
    },
  };
}

export function stopAmbient(): void {
  ambient?.stop();
  ambient = null;
}

export const sfx = {
  ui: () => {
    const c = ac();
    if (!c || c.state !== "running") return;
    const t0 = c.currentTime;
    tone(c, 880, 0.07, 0.03, "sine", t0);
    tone(c, 1320, 0.05, 0.012, "triangle", t0 + 0.02);
  },
  select: () => {
    const c = ac();
    if (!c || c.state !== "running") return;
    tone(c, 520, 0.08, 0.028, "triangle");
  },
  move: () => {
    const c = ac();
    if (!c || c.state !== "running") return;
    const t0 = c.currentTime;
    filteredNoise(c, 0.12, 0.04, 900, 0.6, "lowpass", t0);
    tone(c, 180, 0.14, 0.03, "sine", t0, 90);
  },
  skill: () => {
    const c = ac();
    if (!c || c.state !== "running") return;
    const t0 = c.currentTime;
    tone(c, 240, 0.09, 0.04, "square", t0);
    tone(c, 480, 0.12, 0.025, "triangle", t0 + 0.03);
  },
  slam: () => {
    const c = ac();
    if (!c || c.state !== "running") return;
    const t0 = c.currentTime;
    filteredNoise(c, 0.22, 0.09, 220, 0.8, "lowpass", t0);
    tone(c, 70, 0.2, 0.07, "sine", t0, 38);
    tone(c, 140, 0.08, 0.03, "sawtooth", t0);
  },
  fall: () => {
    const c = ac();
    if (!c || c.state !== "running") return;
    const t0 = c.currentTime;
    filteredNoise(c, 0.35, 0.055, 600, 0.4, "lowpass", t0);
    tone(c, 220, 0.4, 0.045, "sine", t0, 48);
    tone(c, 90, 0.45, 0.05, "triangle", t0 + 0.04, 32);
  },
  chain: () => {
    const c = ac();
    if (!c || c.state !== "running") return;
    const t0 = c.currentTime;
    tone(c, 523, 0.1, 0.04, "triangle", t0);
    tone(c, 659, 0.12, 0.04, "triangle", t0 + 0.05);
    tone(c, 784, 0.16, 0.045, "sine", t0 + 0.1);
  },
  hit: () => {
    const c = ac();
    if (!c || c.state !== "running") return;
    const t0 = c.currentTime;
    filteredNoise(c, 0.08, 0.05, 1400, 1.2, "bandpass", t0);
    tone(c, 160, 0.09, 0.04, "square", t0, 90);
  },
  win: () => {
    const c = ac();
    if (!c || c.state !== "running") return;
    const t0 = c.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => tone(c, f, 0.18, 0.035, "sine", t0 + i * 0.09));
  },
  lose: () => {
    const c = ac();
    if (!c || c.state !== "running") return;
    const t0 = c.currentTime;
    filteredNoise(c, 0.5, 0.06, 180, 0.5, "lowpass", t0);
    tone(c, 196, 0.45, 0.04, "sawtooth", t0, 70);
  },
  coach: () => {
    const c = ac();
    if (!c || c.state !== "running") return;
    tone(c, 640, 0.09, 0.02, "sine");
  },
};
