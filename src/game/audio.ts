let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  return ctx;
}

export function unlockAudio(): void {
  const c = ac();
  void c?.resume();
}

export function toggleMute(): boolean {
  muted = !muted;
  return muted;
}

export function isMuted(): boolean {
  return muted;
}

function beep(freq: number, dur: number, gain = 0.04, type: OscillatorType = "square"): void {
  const c = ac();
  if (!c || c.state !== "running") return;
  const t0 = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export const sfx = {
  ui: () => beep(520, 0.05, 0.03, "triangle"),
  move: () => beep(240, 0.07, 0.03, "sine"),
  skill: () => beep(380, 0.08, 0.04, "square"),
  slam: () => beep(90, 0.12, 0.06, "sawtooth"),
  fall: () => beep(70, 0.18, 0.05, "sine"),
  chain: () => {
    beep(440, 0.06, 0.04);
    setTimeout(() => beep(660, 0.08, 0.04), 40);
  },
  hit: () => beep(180, 0.07, 0.04, "square"),
  win: () => {
    beep(523, 0.1, 0.04);
    setTimeout(() => beep(659, 0.1, 0.04), 80);
    setTimeout(() => beep(784, 0.16, 0.04), 160);
  },
  lose: () => beep(110, 0.35, 0.05, "sawtooth"),
};
