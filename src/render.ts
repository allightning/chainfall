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
  coachTiles?: Pos[];
  coachColor?: "cyan" | "gold" | "red" | "void";
}

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  spark: boolean;
};
type Floater = { x: number; y: number; text: string; life: number; color: string };

const PAL = [
  { void: "#05080c", accent: "#6ee7dc", core: "#f0c45a", laser: "#e05058", spring: "#3ec8c0" },
  { void: "#0a0610", accent: "#e07aa0", core: "#f0c45a", laser: "#e05058", spring: "#8a70d0" },
  { void: "#050c10", accent: "#7fe0e8", core: "#e8d080", laser: "#e05058", spring: "#3ec8c0" },
  { void: "#0c0705", accent: "#f0a050", core: "#f0c060", laser: "#e05058", spring: "#d08040" },
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

function downscale(img: HTMLImageElement, maxDim: number): HTMLCanvasElement {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

function punchBg(img: HTMLImageElement, maxDim = 384): HTMLCanvasElement {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  const w = c.width;
  const h = c.height;
  const dark = (i: number) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] < 12;
  const seen = new Uint8Array(w * h);
  const qx: number[] = [];
  const qy: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p]) return;
    const i = p * 4;
    if (!dark(i)) return;
    seen[p] = 1;
    qx.push(x);
    qy.push(y);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  let qh = 0;
  while (qh < qx.length) {
    const x = qx[qh];
    const y = qy[qh++];
    d[(y * w + x) * 4 + 3] = 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    if (l < 6) d[i + 3] = 0;
    else if (l < 16) d[i + 3] = Math.round(((l - 6) / 10) * d[i + 3]);
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
    "etcher",
    "sniper",
    "mortar",
    "grappler",
    "brood",
    "bully",
  ];
  return Promise.allSettled([
    ...tiles.map((k) =>
      loadImg(`${BASE}assets/tile-${k}.png`).then((im) => {
        atlas[`tile-${k}`] =
          k === "floor" || k === "void" ? downscale(im, k === "floor" ? 1024 : 768) : punchBg(im, 320);
      }),
    ),
    ...units.map((k) =>
      loadImg(`${BASE}assets/unit-${k}.png`).then((im) => {
        atlas[`unit-${k}`] = punchBg(im);
      }),
    ),
    loadImg(`${BASE}assets/bg-title.jpg`).then((im) => {
      atlas.bg = im;
    }),
  ])
    .then(() => {
      artReady = true;
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

function blitCover(
  c: CanvasRenderingContext2D,
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
  ox: number,
  oy: number,
): boolean {
  const im = atlas[key];
  if (!im || !("width" in im)) return false;
  const iw = Math.max(1, (im as HTMLImageElement).width || 1);
  const ih = Math.max(1, (im as HTMLImageElement).height || 1);
  let sx = ((Math.floor(ox) % iw) + iw) % iw;
  let sy = ((Math.floor(oy) % ih) + ih) % ih;
  const sw = Math.min(w, iw - sx);
  const sh = Math.min(h, ih - sy);
  c.drawImage(im, sx, sy, sw, sh, x, y, sw, sh);
  if (sw < w) c.drawImage(im, 0, sy, w - sw, sh, x + sw, y, w - sw, sh);
  if (sh < h) c.drawImage(im, sx, 0, sw, h - sh, x, y + sh, sw, h - sh);
  if (sw < w && sh < h) c.drawImage(im, 0, 0, w - sw, h - sh, x + sw, y + sh, w - sw, h - sh);
  return true;
}

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
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
    const slot = this.canvas.closest(".board-slot") as HTMLElement | null;
    const table = this.canvas.closest(".table") as HTMLElement | null;
    const box = slot && slot.clientWidth > 40 ? slot : table;
    const maxW = Math.max(240, (box?.clientWidth || 640) - 12);
    const maxH = Math.max(240, (box?.clientHeight || 520) - 12);
    this.cell = Math.max(28, Math.min(120, Math.floor(Math.min(maxW / w, maxH / h))));
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
      const sp = 0.5 + Math.random() * 2.6;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.4,
        life: 1,
        color,
        size: 1.2 + Math.random() * 2.8,
        spark: Math.random() > 0.45,
      });
    }
    if (this.particles.length > 140) this.particles.splice(0, this.particles.length - 140);
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
    const coachSet = new Set((o.coachTiles ?? []).map((q) => `${q.x},${q.y}`));

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
          c.fillStyle = "rgba(110, 231, 220, 0.14)";
          round(c, x * s + 7, y * s + 7, s - 14, s - 14, 5);
          c.fill();
          c.strokeStyle = "rgba(110, 231, 220, 0.7)";
          c.lineWidth = 1.4;
          c.stroke();
        }
        if (skillSet.has(key)) {
          c.fillStyle = "rgba(240, 196, 90, 0.18)";
          round(c, x * s + 6, y * s + 6, s - 12, s - 12, 5);
          c.fill();
          c.strokeStyle = "rgba(240, 196, 90, 0.78)";
          c.lineWidth = 1.5;
          c.stroke();
        }
        const dmg = intentTiles.get(key);
        if (dmg) {
          const pulse = 0.28 + Math.sin(o.pulse * 1.4) * 0.14;
          c.fillStyle = `rgba(210, 36, 48, ${pulse})`;
          round(c, x * s + 3, y * s + 3, s - 6, s - 6, 4);
          c.fill();
          c.strokeStyle = "rgba(255, 110, 96, 0.9)";
          c.lineWidth = 1.6;
          c.stroke();
          drawChevron(c, x * s + s / 2, y * s + s * 0.28, s * 0.12, o.pulse);
          c.fillStyle = "#ffe4de";
          c.font = `700 ${Math.floor(s * 0.22)}px Oxanium, sans-serif`;
          c.textAlign = "center";
          c.textBaseline = "middle";
          c.fillText(String(dmg), x * s + s / 2, y * s + s * 0.62);
        }
        if (coachSet.has(key)) {
          const col =
            o.coachColor === "gold"
              ? "240,196,90"
              : o.coachColor === "red"
                ? "255,90,80"
                : o.coachColor === "void"
                  ? "140,180,220"
                  : "110,231,220";
          const a = 0.45 + Math.sin(o.pulse * 2.2) * 0.25;
          c.fillStyle = `rgba(${col},${0.12 + a * 0.2})`;
          round(c, x * s + 2, y * s + 2, s - 4, s - 4, 6);
          c.fill();
          c.strokeStyle = `rgba(${col},${0.75 + a * 0.2})`;
          c.lineWidth = 3;
          round(c, x * s + 2, y * s + 2, s - 4, s - 4, 6);
          c.stroke();
          const ay = y * s - 14 + Math.sin(o.pulse * 2) * 2;
          c.fillStyle = `rgba(${col},0.95)`;
          c.beginPath();
          c.moveTo(x * s + s / 2, ay + 8);
          c.lineTo(x * s + s / 2 - 6, ay);
          c.lineTo(x * s + s / 2 + 6, ay);
          c.closePath();
          c.fill();
        }
      }
    }

    if (o.hover) {
      c.strokeStyle = "rgba(255,255,255,0.7)";
      c.lineWidth = 2;
      round(c, o.hover.x * s + 1.5, o.hover.y * s + 1.5, s - 3, s - 3, 5);
      c.stroke();
    }

    if (o.preview) {
      for (const u of o.preview.units) {
        if (u.hp <= 0) continue;
        const cur = b.units.find((x) => x.id === u.id);
        if (cur && (cur.x !== u.x || cur.y !== u.y)) {
          c.globalAlpha = 0.42;
          drawUnit(c, u, u.x * s, u.y * s, s, false, true, o.pulse);
          c.globalAlpha = 1;
          c.strokeStyle = u.team === "player" ? p.accent : "#e07070";
          c.setLineDash([3, 5]);
          c.lineWidth = 1.5;
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
            c.strokeStyle = "#c8f09a";
            c.lineWidth = 2;
            round(c, x * s + 5, y * s + 5, s - 10, s - 10, 4);
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
      drawUnit(c, u, x, y, s, u.id === o.selected, false, o.pulse);
    }

    for (const pt of this.particles) {
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vy += 0.05;
      pt.life -= dt * 1.6;
      c.globalAlpha = Math.max(0, pt.life);
      c.fillStyle = pt.color;
      if (pt.spark) {
        c.beginPath();
        c.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        c.fill();
      } else {
        c.fillRect(pt.x, pt.y, pt.size, pt.size);
      }
    }
    c.globalAlpha = 1;
    this.particles = this.particles.filter((pt) => pt.life > 0);

    for (const f of this.floaters) {
      f.y -= 22 * dt;
      f.life -= dt * 0.95;
      c.globalAlpha = Math.max(0, f.life);
      c.fillStyle = f.color;
      c.font = `700 ${Math.floor(s * 0.28)}px Oxanium, sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(f.text, f.x, f.y);
    }
    c.globalAlpha = 1;
    this.floaters = this.floaters.filter((f) => f.life > 0);

    c.restore();

    const vg = c.createRadialGradient(
      (s * b.w) / 2,
      (s * b.h) / 2,
      s * 2,
      (s * b.w) / 2,
      (s * b.h) / 2,
      s * Math.max(b.w, b.h) * 0.72,
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(4,8,12,0.42)");
    c.fillStyle = vg;
    c.fillRect(0, 0, s * b.w, s * b.h);
  }
}

function drawChevron(c: CanvasRenderingContext2D, x: number, y: number, size: number, pulse: number): void {
  const o = Math.sin(pulse * 2) * 2;
  c.beginPath();
  c.moveTo(x, y + o);
  c.lineTo(x - size, y + size + o);
  c.lineTo(x + size, y + size + o);
  c.closePath();
  c.fillStyle = "rgba(255,220,210,0.85)";
  c.fill();
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
  if (t.kind === "void") {
    c.fillStyle = p.void;
    c.fillRect(px, py, s, s);
    blitCover(c, "tile-void", px, py, s, s, x * 37, y * 41 + pulse * 6);
    c.fillStyle = "rgba(4,8,12,0.35)";
    c.fillRect(px, py, s, s);
    for (let i = 0; i < 4; i++) {
      const h = hash(x + i * 3, y + i * 7);
      c.fillStyle = `rgba(210,230,255,${0.12 + h * 0.4})`;
      c.fillRect(px + 5 + h * (s - 12), py + ((pulse * 10 + h * 50) % (s - 4)), 1.4, 1.4);
    }
    return;
  }

  const tiled = blitCover(c, "tile-floor", px, py, s, s, x * s * 0.85, y * s * 0.85);
  if (!tiled) {
    c.fillStyle = (x + y) % 2 === 0 ? "#1b2a33" : "#22343e";
    c.fillRect(px, py, s, s);
  }

  const edge = c.createLinearGradient(px, py, px, py + s);
  edge.addColorStop(0, "rgba(180,220,230,0.10)");
  edge.addColorStop(0.45, "rgba(0,0,0,0)");
  edge.addColorStop(1, "rgba(0,0,0,0.28)");
  c.fillStyle = edge;
  c.fillRect(px, py, s, s);
  c.strokeStyle = "rgba(0,0,0,0.38)";
  c.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
  c.strokeStyle = "rgba(160,200,210,0.08)";
  c.beginPath();
  c.moveTo(px + 1, py + s - 1);
  c.lineTo(px + 1, py + 1);
  c.lineTo(px + s - 1, py + 1);
  c.stroke();

  if (t.kind === "laser") {
    c.fillStyle = `rgba(224,80,88,${0.16 + Math.sin(pulse * 2 + x) * 0.06})`;
    c.fillRect(px + 4, py + s * 0.38, s - 8, s * 0.24);
    blit(c, "tile-laser", px + s * 0.12, py + s * 0.12, s * 0.76, s * 0.76);
  }
  if (t.kind === "spring") {
    blit(c, "tile-spring", px + s * 0.1, py + s * 0.1, s * 0.8, s * 0.8);
  }
  if (t.kind === "oil") {
    c.fillStyle = `rgba(40, 80, 50, ${0.28 + Math.sin(pulse + x) * 0.06})`;
    round(c, px + 6, py + 6, s - 12, s - 12, 8);
    c.fill();
    c.strokeStyle = "rgba(120, 200, 140, 0.45)";
    c.stroke();
  }
  if (t.kind === "repair") {
    c.fillStyle = "rgba(80, 180, 140, 0.22)";
    round(c, px + 8, py + 8, s - 16, s - 16, 4);
    c.fill();
    c.strokeStyle = "rgba(140, 230, 190, 0.7)";
    c.lineWidth = 1.4;
    c.stroke();
    c.fillStyle = "#b8f0d0";
    c.font = `700 ${Math.floor(s * 0.22)}px Oxanium, sans-serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("+", px + s / 2, py + s / 2);
  }
  if (t.kind === "block") {
    c.fillStyle = "#3a3230";
    round(c, px + 7, py + 10, s - 14, s - 18, 3);
    c.fill();
    c.fillStyle = "#6a6058";
    c.fillRect(px + 10, py + 14, s - 20, 5);
    c.fillRect(px + 10, py + s * 0.45, s - 20, 5);
  }
  if (t.kind === "belt") {
    const dir = t.beltDir ?? 1;
    c.fillStyle = "rgba(80, 140, 180, 0.28)";
    round(c, px + 5, py + 5, s - 10, s - 10, 4);
    c.fill();
    c.fillStyle = "#9ad4f0";
    const cx = px + s / 2;
    const cy = py + s / 2;
    c.beginPath();
    if (dir === 1) {
      c.moveTo(cx - 8, cy - 7);
      c.lineTo(cx + 8, cy);
      c.lineTo(cx - 8, cy + 7);
    } else if (dir === 3) {
      c.moveTo(cx + 8, cy - 7);
      c.lineTo(cx - 8, cy);
      c.lineTo(cx + 8, cy + 7);
    } else if (dir === 0) {
      c.moveTo(cx - 7, cy + 8);
      c.lineTo(cx, cy - 8);
      c.lineTo(cx + 7, cy + 8);
    } else {
      c.moveTo(cx - 7, cy - 8);
      c.lineTo(cx, cy + 8);
      c.lineTo(cx + 7, cy - 8);
    }
    c.closePath();
    c.fill();
  }
  if (t.core) {
    const g = c.createRadialGradient(px + s / 2, py + s / 2, 2, px + s / 2, py + s / 2, s * 0.48);
    g.addColorStop(0, `rgba(255,210,90,${0.28 + Math.sin(pulse) * 0.08})`);
    g.addColorStop(1, "rgba(255,180,40,0)");
    c.fillStyle = g;
    c.fillRect(px, py, s, s);
    blit(c, "tile-core", px + s * 0.08, py + s * 0.06, s * 0.84, s * 0.84);
    c.fillStyle = "rgba(8,12,16,0.62)";
    round(c, px + s * 0.22, py + s * 0.68, s * 0.56, s * 0.22, 3);
    c.fill();
    c.fillStyle = "#ffe7a0";
    c.font = `700 ${Math.max(9, Math.floor(s * 0.18))}px "Noto Sans SC", sans-serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("舰核", px + s / 2, py + s * 0.79);
  }
  if (t.collapseTurn > 0) {
    c.globalAlpha = 0.78;
    blit(c, "tile-crack", px, py, s, s);
    c.globalAlpha = 1;
    c.fillStyle = t.collapseTurn === b.turn ? "#ff8a5a" : "#e0b56a";
    c.font = `700 ${Math.floor(s * 0.26)}px Oxanium, sans-serif`;
    c.textAlign = "left";
    c.textBaseline = "top";
    c.fillText(String(t.collapseTurn), px + 6, py + 4);
  }
  if (t.fire) {
    c.fillStyle = `rgba(255,120,40,${0.35 + Math.sin(pulse * 3 + x) * 0.1})`;
    c.fillRect(px + 8, py + 8, s - 16, s - 16);
  }
  if (t.acid > 0) {
    c.fillStyle = `rgba(120,220,80,${0.28 + Math.sin(pulse * 2.4 + y) * 0.08})`;
    c.fillRect(px + 6, py + 6, s - 12, s - 12);
  }
}

const UNIT_ALIAS: Record<string, string> = {
  etcher: "beetle",
  sniper: "gunner",
  mortar: "turret",
  grappler: "leaper",
  brood: "brute",
  bully: "hammer",
};

function unitKey(u: Unit): string {
  if (u.pilot) return `unit-${u.pilot}`;
  if (u.enemy) {
    const key = `unit-${u.enemy}`;
    if (atlas[key]) return key;
    const alias = UNIT_ALIAS[u.enemy];
    if (alias) return `unit-${alias}`;
    return key;
  }
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
  pulse: number,
): void {
  const bob = ghost ? 0 : Math.sin(pulse * 1.3 + u.x * 0.7 + u.y) * 1.4;
  const cx = x + s / 2;
  const cy = y + s / 2 - 2 + bob;

  c.fillStyle = "rgba(0,0,0,0.38)";
  c.beginPath();
  c.ellipse(cx, y + s * 0.78, s * 0.26, s * 0.08, 0, 0, Math.PI * 2);
  c.fill();

  if (selected) {
    c.strokeStyle = "rgba(244,251,255,0.9)";
    c.lineWidth = 1.8;
    c.beginPath();
    c.ellipse(cx, y + s * 0.78, s * 0.34, s * 0.11, 0, 0, Math.PI * 2);
    c.stroke();
  }

  const pad = Math.floor(s * 0.04);
  if (!blit(c, unitKey(u), x + pad, y + pad - 4 + bob, s - pad * 2, s - pad * 2)) {
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
  c.fillStyle = "rgba(8,12,16,0.85)";
  round(c, x + 10, y + s - 11, s - 20, 5, 1);
  c.fill();
  c.fillStyle = ratio > 0.5 ? "#7ae09a" : ratio > 0.25 ? "#e0c060" : "#e06060";
  c.fillRect(x + 10, y + s - 11, (s - 20) * ratio, 5);
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
    const scale = Math.max(w / iw, h / ih) * 1.04;
    const dw = iw * scale;
    const dh = ih * scale;
    const pan = Math.sin(t / 11000) * 28;
    const tilt = Math.cos(t / 14000) * 10;
    c.drawImage(bg, (w - dw) / 2 + pan, (h - dh) / 2 + tilt, dw, dh);
  } else {
    c.fillStyle = "#080b10";
    c.fillRect(0, 0, w, h);
  }
  const g = c.createLinearGradient(0, h * 0.18, 0, h);
  g.addColorStop(0, "rgba(6,10,14,0.18)");
  g.addColorStop(0.55, "rgba(6,10,14,0.45)");
  g.addColorStop(1, "rgba(6,10,14,0.88)");
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 18; i++) {
    const hx = ((t * 0.012 + i * 97) % (w + 40)) - 20;
    const hy = (Math.sin(t * 0.0004 + i) * 0.5 + 0.5) * h;
    c.fillStyle = `rgba(180,220,230,${0.08 + (i % 5) * 0.03})`;
    c.fillRect(hx, hy, 1.2, 1.2);
  }
}
