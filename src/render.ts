import { PILOT_BASE } from "./game/content";
import { idx, tile } from "./game/grid";
import type { Battle, Pos, Unit } from "./game/types";

export interface Tweens {
  [id: string]: { x: number; y: number };
}

export interface DrawOpts {
  battle: Battle;
  selected: string | null;
  moves: Pos[];
  skills: Pos[];
  hover: Pos | null;
  preview: Battle | null;
  tweens: Tweens;
  pulse: number;
  hint: string;
}

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
};
type Floater = { x: number; y: number; text: string; life: number; color: string };

const PAL = [
  { a: "#1b2a33", b: "#22343e", void: "#070b10", accent: "#4ad4c8", core: "#e0b14a", laser: "#9a2a3c", spring: "#1d5a5c" },
  { a: "#261c2c", b: "#2e2236", void: "#0c0810", accent: "#e07aa0", core: "#e0b14a", laser: "#b03048", spring: "#3a3060" },
  { a: "#173038", b: "#1c3a42", void: "#061014", accent: "#7fe0e8", core: "#d8c878", laser: "#8a2840", spring: "#2a6a70" },
  { a: "#2c1c14", b: "#352016", void: "#120a08", accent: "#f0a050", core: "#f0c060", laser: "#c04030", spring: "#6a4020" },
];

function pal(chapter: number) {
  return PAL[Math.max(0, Math.min(3, chapter - 1))];
}

type Atlas = Record<string, CanvasImageSource>;
const atlas: Atlas = {};
let artReady = false;

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(src));
    im.src = src;
  });
}

const BASE = import.meta.env.BASE_URL;

function punchDark(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    if (l < 16) d[i + 3] = 0;
    else if (l < 38) d[i + 3] = Math.round(((l - 16) / 22) * d[i + 3]);
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

export function loadArt(): Promise<void> {
  if (artReady) return Promise.resolve();
  const tiles = ["floor", "void", "core", "laser", "spring", "crack"];
  const units = [
    "iron",
    "line",
    "patch",
    "beetle",
    "brute",
    "hammer",
    "gunner",
    "bomber",
    "demo",
    "turret",
    "leaper",
    "warden",
  ];
  return Promise.all([
    ...tiles.map((k) =>
      loadImg(`${BASE}assets/tile-${k}.png`).then((im) => {
        atlas[`tile-${k}`] = im;
      }),
    ),
    ...units.map((k) =>
      loadImg(`${BASE}assets/unit-${k}.png`).then((im) => {
        atlas[`unit-${k}`] = punchDark(im);
      }),
    ),
    loadImg(`${BASE}assets/bg-title.jpg`).then((im) => {
      atlas.bg = im;
    }),
  ])
    .then(() => {
      artReady = true;
    })
    .catch(() => {
      artReady = false;
    });
}

function blit(
  c: CanvasRenderingContext2D,
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  const im = atlas[key];
  if (!im) return false;
  c.drawImage(im, x, y, w, h);
  return true;
}

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export class BoardView {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  cell = 56;
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private shakeAmt = 0;
  private last = 0;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("无法创建画布");
    this.canvas = canvas;
    this.ctx = ctx;
  }

  resize(w: number, h: number): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const maxW = Math.max(380, window.innerWidth - 560);
    const maxH = Math.max(380, window.innerHeight - 150);
    this.cell = Math.max(40, Math.min(72, Math.floor(Math.min(maxW / w, maxH / h))));
    const pw = this.cell * w;
    const ph = this.cell * h;
    this.canvas.style.width = `${pw}px`;
    this.canvas.style.height = `${ph}px`;
    this.canvas.width = Math.floor(pw * dpr);
    this.canvas.height = Math.floor(ph * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  tileAt(clientX: number, clientY: number, b: Battle): Pos | null {
    const r = this.canvas.getBoundingClientRect();
    const x = Math.floor((clientX - r.left) / this.cell);
    const y = Math.floor((clientY - r.top) / this.cell);
    if (x < 0 || y < 0 || x >= b.w || y >= b.h) return null;
    return { x, y };
  }

  burst(tx: number, ty: number, color: string, n = 10): void {
    const s = this.cell;
    const cx = tx * s + s / 2;
    const cy = ty * s + s / 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.6 + Math.random() * 2.2;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        max: 1,
        color,
        size: 1.5 + Math.random() * 2.5,
      });
    }
    if (this.particles.length > 90) this.particles.splice(0, this.particles.length - 90);
  }

  float(tx: number, ty: number, text: string, color: string): void {
    const s = this.cell;
    this.floaters.push({ x: tx * s + s / 2, y: ty * s + 10, text, life: 1, color });
    if (this.floaters.length > 16) this.floaters.shift();
  }

  shake(n: number): void {
    this.shakeAmt = Math.min(8, this.shakeAmt + n);
  }

  draw(o: DrawOpts): void {
    const now = performance.now();
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016;
    this.last = now;
    this.shakeAmt *= Math.pow(0.04, dt * 8);

    const { battle: b } = o;
    const c = this.ctx;
    const s = this.cell;
    const p = pal(b.chapter);
    const sx = (Math.random() - 0.5) * this.shakeAmt;
    const sy = (Math.random() - 0.5) * this.shakeAmt;
    c.fillStyle = p.void;
    c.fillRect(0, 0, s * b.w, s * b.h);
    c.save();
    c.translate(sx, sy);

    const src = o.preview ?? b;
    const intentTiles = new Map<string, number>();
    for (const it of src.intents) {
      for (const t of it.tiles) intentTiles.set(`${t.x},${t.y}`, it.damage);
    }
    const moveSet = new Set(o.moves.map((q) => `${q.x},${q.y}`));
    const skillSet = new Set(o.skills.map((q) => `${q.x},${q.y}`));

    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        drawTile(c, b, x, y, s, p, o.pulse);
      }
    }

    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        const key = `${x},${y}`;
        const t = b.tiles[idx(b, x, y)];
        if (t.kind === "void") continue;
        if (moveSet.has(key)) {
          c.fillStyle = "rgba(74, 212, 200, 0.16)";
          round(c, x * s + 8, y * s + 8, s - 16, s - 16, 4);
          c.fill();
          c.strokeStyle = "rgba(74, 212, 200, 0.55)";
          c.lineWidth = 1.5;
          c.stroke();
        }
        if (skillSet.has(key)) {
          c.fillStyle = "rgba(232, 196, 80, 0.2)";
          round(c, x * s + 6, y * s + 6, s - 12, s - 12, 4);
          c.fill();
          c.strokeStyle = "rgba(232, 196, 80, 0.7)";
          c.lineWidth = 1.5;
          c.stroke();
        }
        const dmg = intentTiles.get(key);
        if (dmg) {
          const pulse = 0.35 + Math.sin(o.pulse) * 0.12;
          c.fillStyle = `rgba(220, 40, 48, ${pulse})`;
          round(c, x * s + 4, y * s + 4, s - 8, s - 8, 3);
          c.fill();
          c.strokeStyle = "rgba(255, 90, 80, 0.85)";
          c.lineWidth = 1.5;
          c.stroke();
          c.fillStyle = "#ffd0cc";
          c.font = `700 ${Math.floor(s * 0.22)}px Oxanium, sans-serif`;
          c.textAlign = "center";
          c.textBaseline = "middle";
          c.fillText(String(dmg), x * s + s / 2, y * s + s / 2);
        }
      }
    }

    if (o.hover) {
      c.strokeStyle = "rgba(255,255,255,0.55)";
      c.lineWidth = 2;
      round(c, o.hover.x * s + 2, o.hover.y * s + 2, s - 4, s - 4, 4);
      c.stroke();
    }

    if (o.preview) {
      for (const u of o.preview.units) {
        if (u.hp <= 0) continue;
        const cur = b.units.find((x) => x.id === u.id);
        if (cur && (cur.x !== u.x || cur.y !== u.y)) {
          c.globalAlpha = 0.45;
          drawUnit(c, u, u.x * s, u.y * s, s, false, true);
          c.globalAlpha = 1;
          c.strokeStyle = u.team === "player" ? p.accent : "#e07070";
          c.setLineDash([4, 4]);
          c.beginPath();
          c.moveTo(cur.x * s + s / 2, cur.y * s + s / 2);
          c.lineTo(u.x * s + s / 2, u.y * s + s / 2);
          c.stroke();
          c.setLineDash([]);
        }
      }
      for (let y = 0; y < b.h; y++) {
        for (let x = 0; x < b.w; x++) {
          const a = tile(b, x, y);
          const n = tile(o.preview, x, y);
          if (a && n && a.kind !== n.kind) {
            c.strokeStyle = "#b7e07a";
            c.lineWidth = 2;
            round(c, x * s + 5, y * s + 5, s - 10, s - 10, 3);
            c.stroke();
          }
        }
      }
    }

    const order = b.units.filter((u) => u.hp > 0).sort((a, z) => a.y - z.y || a.x - z.x);
    for (const u of order) {
      const tw = o.tweens[u.id];
      const x = (tw ? tw.x : u.x) * s;
      const y = (tw ? tw.y : u.y) * s;
      drawUnit(c, u, x, y, s, u.id === o.selected, false);
    }

    for (const pt of this.particles) {
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vy += 0.04;
      pt.life -= dt * 1.8;
      c.globalAlpha = Math.max(0, pt.life);
      c.fillStyle = pt.color;
      c.fillRect(pt.x, pt.y, pt.size, pt.size);
    }
    c.globalAlpha = 1;
    this.particles = this.particles.filter((pt) => pt.life > 0);

    for (const f of this.floaters) {
      f.y -= 18 * dt;
      f.life -= dt * 1.1;
      c.globalAlpha = Math.max(0, f.life);
      c.fillStyle = f.color;
      c.font = `700 ${Math.floor(s * 0.26)}px Oxanium, sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(f.text, f.x, f.y);
    }
    c.globalAlpha = 1;
    this.floaters = this.floaters.filter((f) => f.life > 0);

    c.restore();
    if (o.hint) {
      c.fillStyle = "rgba(8,10,14,0.72)";
      c.fillRect(0, s * b.h - 28, s * b.w, 28);
      c.fillStyle = "#d5dee6";
      c.font = `500 12px "Noto Sans SC", sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(o.hint, (s * b.w) / 2, s * b.h - 14);
    }
  }
}

function round(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawTile(
  c: CanvasRenderingContext2D,
  b: Battle,
  x: number,
  y: number,
  s: number,
  p: (typeof PAL)[0],
  pulse: number,
): void {
  const t = b.tiles[idx(b, x, y)];
  const px = x * s;
  const py = y * s;
  let key = "tile-floor";
  if (t.kind === "void") key = "tile-void";
  else if (t.kind === "laser") key = "tile-laser";
  else if (t.kind === "spring") key = "tile-spring";
  else if (t.core) key = "tile-core";
  const painted = blit(c, key, px, py, s, s);
  if (!painted) {
    if (t.kind === "void") {
      c.fillStyle = p.void;
      c.fillRect(px, py, s, s);
    } else {
      c.fillStyle = t.kind === "laser" ? p.laser : t.kind === "spring" ? p.spring : (x + y) % 2 === 0 ? p.a : p.b;
      c.fillRect(px, py, s, s);
    }
  }
  if (t.kind !== "void") {
    c.strokeStyle = "rgba(0,0,0,0.35)";
    c.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
  }
  if (t.collapseTurn > 0 && t.kind !== "void") {
    c.globalAlpha = 0.72;
    blit(c, "tile-crack", px, py, s, s);
    c.globalAlpha = 1;
    c.fillStyle = t.collapseTurn === b.turn ? "#ff8a5a" : "#e0b56a";
    c.font = `700 ${Math.floor(s * 0.26)}px Oxanium, sans-serif`;
    c.textAlign = "left";
    c.textBaseline = "top";
    c.fillText(String(t.collapseTurn), px + 6, py + 4);
  }
  if (t.fire) {
    c.fillStyle = "#ff7a30";
    c.fillRect(px + s - 16, py + 6, 8, 10);
    c.fillStyle = "#ffd080";
    c.fillRect(px + s - 14, py + 4, 4, 6);
  }
  if (t.kind === "void" && !atlas["tile-void"]) {
    for (let i = 0; i < 3; i++) {
      const h = hash(x + i * 3, y + i * 7);
      c.fillStyle = `rgba(220,230,255,${0.15 + h * 0.35})`;
      c.fillRect(px + 6 + h * (s - 14), py + ((pulse * 8 + h * 40) % (s - 4)), 1.5, 1.5);
    }
  }
}

function unitKey(u: Unit): string {
  if (u.pilot) return `unit-${u.pilot}`;
  if (u.enemy) return `unit-${u.enemy}`;
  return "unit-beetle";
}

function drawUnit(
  c: CanvasRenderingContext2D,
  u: Unit,
  x: number,
  y: number,
  s: number,
  selected: boolean,
  ghost: boolean,
): void {
  const cx = x + s / 2;
  const cy = y + s / 2 - 2;
  if (selected) {
    c.strokeStyle = "#f4fbff";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
    c.stroke();
  }
  const pad = Math.floor(s * 0.06);
  if (!blit(c, unitKey(u), x + pad, y + pad - 2, s - pad * 2, s - pad * 2)) {
    const color =
      u.team === "player" && u.pilot
        ? PILOT_BASE[u.pilot].color
        : u.enemy === "demo"
          ? "#e8c36a"
          : "#d05656";
    c.fillStyle = color;
    c.fillRect(cx - s * 0.16, cy - s * 0.14, s * 0.32, s * 0.3);
  }
  if (ghost) return;
  const ratio = Math.max(0, u.hp / u.maxHp);
  c.fillStyle = "#0c1014";
  c.fillRect(x + 10, y + s - 12, s - 20, 5);
  c.fillStyle = ratio > 0.5 ? "#6cde8a" : ratio > 0.25 ? "#e0c060" : "#e06060";
  c.fillRect(x + 10, y + s - 12, (s - 20) * ratio, 5);
}

export function drawTitleFx(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext("2d");
  if (!c) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bg = atlas.bg;
  if (bg && "width" in bg) {
    const iw = (bg as HTMLImageElement).width || 1600;
    const ih = (bg as HTMLImageElement).height || 900;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const pan = Math.sin(t / 9000) * 20;
    c.drawImage(bg, (w - dw) / 2 + pan, (h - dh) / 2, dw, dh);
  } else {
    c.fillStyle = "#080b10";
    c.fillRect(0, 0, w, h);
  }
  const g = c.createLinearGradient(0, h * 0.25, 0, h);
  g.addColorStop(0, "rgba(8,11,16,0.15)");
  g.addColorStop(1, "rgba(8,11,16,0.88)");
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}
