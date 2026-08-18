import type { Battle, Pos, Tile, Unit } from "./types";
import { DX, DY } from "./types";

export function idx(b: Battle, x: number, y: number): number {
  return y * b.w + x;
}

export function inb(b: Battle, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < b.w && y < b.h;
}

export function tile(b: Battle, x: number, y: number): Tile | undefined {
  if (!inb(b, x, y)) return undefined;
  return b.tiles[idx(b, x, y)];
}

export function unitAt(b: Battle, x: number, y: number): Unit | undefined {
  for (const u of b.units) {
    if (u.hp > 0 && u.x === x && u.y === y) return u;
  }
  return undefined;
}

export function unitById(b: Battle, id: string): Unit | undefined {
  return b.units.find((u) => u.id === id && u.hp > 0);
}

export function cloneBattle(b: Battle): Battle {
  return structuredClone(b);
}

export function manh(a: Pos, b: Pos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function dirToward(from: Pos, to: Pos): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 1 : 3;
  return dy >= 0 ? 2 : 0;
}

export function cardinalDir(from: Pos, to: Pos): number | null {
  if (from.x === to.x && from.y === to.y) return null;
  if (from.x !== to.x && from.y !== to.y) return null;
  if (from.x === to.x) return to.y < from.y ? 0 : 2;
  return to.x > from.x ? 1 : 3;
}

export function walkable(b: Battle, x: number, y: number, passer: Unit): boolean {
  const t = tile(b, x, y);
  if (!t || t.kind === "void") return false;
  const u = unitAt(b, x, y);
  if (!u) return true;
  return u.team === passer.team && u.id !== passer.id;
}

export function reachable(b: Battle, u: Unit): Pos[] {
  const range = u.move + b.mods.moveBonus;
  const out: Pos[] = [];
  const seen = new Int8Array(b.w * b.h);
  const qx: number[] = [u.x];
  const qy: number[] = [u.y];
  const qd: number[] = [0];
  seen[idx(b, u.x, u.y)] = 1;
  let qh = 0;
  while (qh < qx.length) {
    const x = qx[qh];
    const y = qy[qh];
    const d = qd[qh];
    qh++;
    if (d > 0) {
      if (!unitAt(b, x, y)) out.push({ x, y });
    }
    if (d >= range) continue;
    for (let dir = 0; dir < 4; dir++) {
      const nx = x + DX[dir];
      const ny = y + DY[dir];
      if (!inb(b, nx, ny)) continue;
      const i = idx(b, nx, ny);
      if (seen[i]) continue;
      if (!walkable(b, nx, ny, u)) continue;
      seen[i] = 1;
      qx.push(nx);
      qy.push(ny);
      qd.push(d + 1);
    }
  }
  return out;
}

export function firstInLine(
  b: Battle,
  x: number,
  y: number,
  dir: number,
  max: number,
): Unit | undefined {
  let cx = x;
  let cy = y;
  for (let i = 0; i < max; i++) {
    cx += DX[dir];
    cy += DY[dir];
    if (!inb(b, cx, cy)) return undefined;
    const t = tile(b, cx, cy);
    if (!t || t.kind === "void") return undefined;
    const u = unitAt(b, cx, cy);
    if (u) return u;
  }
  return undefined;
}
