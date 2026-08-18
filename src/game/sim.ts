import {
  cardinalDir,
  cloneBattle,
  dirToward,
  firstInLine,
  idx,
  inb,
  reachable,
  tile,
  unitAt,
  unitById,
} from "./grid";
import type { Action, Battle, Ev, Pos, SkillId, Unit } from "./types";
import { DX, DY, SKILLS } from "./types";

const PUSH_CAP = 12;

function checkOutcome(b: Battle): void {
  if (b.outcome !== "ongoing") return;
  const players = b.units.filter((u) => u.team === "player" && u.hp > 0);
  if (players.length === 0) {
    b.outcome = "lost";
    b.loseReason = "小队全灭";
    return;
  }
  if (b.structure <= 0) {
    b.outcome = "lost";
    b.loseReason = "核心被掏空";
    return;
  }
  const enemies = b.units.filter((u) => u.team === "enemy" && u.hp > 0);
  if (enemies.length === 0) {
    b.outcome = "won";
    return;
  }
  if (b.turn > b.maxTurns) {
    if (b.objective === "hold" && b.structure > 0 && players.length > 0) {
      b.outcome = "won";
      return;
    }
    b.outcome = "lost";
    b.loseReason = b.objective === "hold" ? "未能守到撤离窗口" : "结构支撑超时";
  }
}

function hitStructure(b: Battle, dmg: number, events: Ev[]): void {
  const real = Math.max(0, dmg - b.mods.coreArmor);
  if (real <= 0) return;
  b.structure -= real;
  if (b.structure < 0) b.structure = 0;
  events.push({ t: "structure", n: b.structure });
}

function kill(b: Battle, u: Unit, reason: "fall" | "die", events: Ev[]): void {
  if (u.hp <= 0) return;
  u.hp = 0;
  events.push(
    reason === "fall"
      ? { t: "fall", id: u.id, x: u.x, y: u.y }
      : { t: "die", id: u.id, x: u.x, y: u.y, name: u.name },
  );
  b.intents = b.intents.filter((i) => i.enemyId !== u.id);
  if (u.enemy === "bomber") {
    events.push({ t: "log", s: `${u.name} 爆了` });
    for (let d = 0; d < 4; d++) {
      const n = unitAt(b, u.x + DX[d], u.y + DY[d]);
      if (n && n.hp > 0) pushUnit(b, n, d, 1, events, 0);
    }
  }
  if (u.team === "enemy") {
    b.scrap += 2;
    if (b.chainPeak >= 3 && b.mods.chainScrap) b.scrap += 2;
  }
}

function damage(b: Battle, u: Unit, dmg: number, events: Ev[]): void {
  if (u.hp <= 0 || dmg <= 0) return;
  u.hp -= dmg;
  events.push({ t: "hit", id: u.id, x: u.x, y: u.y, dmg });
  if (u.hp <= 0) kill(b, u, "die", events);
}

function hitTile(b: Battle, x: number, y: number, dmg: number, events: Ev[]): void {
  const t = tile(b, x, y);
  if (!t || t.kind === "void") return;
  const u = unitAt(b, x, y);
  if (u) damage(b, u, dmg, events);
  if (t.core) hitStructure(b, dmg, events);
  events.push({ t: "hit", x, y, dmg });
}

function pushForce(u: Unit, dist: number): number {
  const w = Math.max(1, u.weight || 1);
  return Math.max(1, dist - (w - 1));
}

function pushUnit(
  b: Battle,
  u: Unit,
  dir: number,
  dist: number,
  events: Ev[],
  depth: number,
  passId?: string,
): void {
  if (u.hp <= 0 || dist <= 0) return;
  let remaining = dist;
  let steps = 0;
  while (remaining > 0 && steps < PUSH_CAP && u.hp > 0) {
    steps++;
    remaining--;
    const nx = u.x + DX[dir];
    const ny = u.y + DY[dir];
    if (!inb(b, nx, ny)) {
      const dmg = b.mods.slamDamage;
      damage(b, u, dmg, events);
      events.push({ t: "slam", id: u.id, x: u.x, y: u.y, dmg });
      if (b.mods.igniteSlam) {
        const t = tile(b, u.x, u.y);
        if (t && t.kind === "floor") {
          t.fire = true;
          events.push({ t: "fire", x: u.x, y: u.y });
        }
      }
      b.chainPeak++;
      resolveOverlap(b, u, events);
      return;
    }
    const t = tile(b, nx, ny);
    if (!t || t.kind === "void") {
      events.push({ t: "push", id: u.id, x: nx, y: ny });
      u.x = nx;
      u.y = ny;
      b.chainPeak++;
      kill(b, u, "fall", events);
      return;
    }
    if (t.kind === "block") {
      const dmg = b.mods.slamDamage;
      damage(b, u, dmg, events);
      events.push({ t: "slam", id: u.id, x: u.x, y: u.y, dmg });
      b.chainPeak++;
      resolveOverlap(b, u, events);
      return;
    }
    const blocker = unitAt(b, nx, ny);
    if (blocker && blocker.id !== u.id) {
      if (passId && blocker.id === passId) {
        u.x = nx;
        u.y = ny;
        events.push({ t: "push", id: u.id, x: nx, y: ny });
        b.chainPeak++;
        if (t.kind === "spring" || t.kind === "oil") remaining++;
        continue;
      }
      const dmg = b.mods.slamDamage;
      damage(b, u, dmg, events);
      damage(b, blocker, dmg, events);
      events.push({ t: "slam", id: u.id, x: u.x, y: u.y, dmg });
      events.push({ t: "log", s: `${u.name} 撞上 ${blocker.name}` });
      b.chainPeak++;
      if (depth < 6 && blocker.hp > 0) pushUnit(b, blocker, dir, 1, events, depth + 1);
      resolveOverlap(b, u, events);
      return;
    }
    u.x = nx;
    u.y = ny;
    events.push({ t: "push", id: u.id, x: nx, y: ny });
    b.chainPeak++;
    if (t.kind === "spring" || t.kind === "oil") remaining++;
  }
  resolveOverlap(b, u, events);
}

function resolveOverlap(b: Battle, u: Unit, events: Ev[]): void {
  if (u.hp <= 0) return;
  const stacked = b.units.find((x) => x.hp > 0 && x.id !== u.id && x.x === u.x && x.y === u.y);
  if (!stacked) return;
  for (let d = 0; d < 4; d++) {
    const nx = u.x + DX[d];
    const ny = u.y + DY[d];
    const cell = tile(b, nx, ny);
    if (!cell || cell.kind === "void" || cell.kind === "block") continue;
    if (b.units.some((x) => x.hp > 0 && x.id !== u.id && x.x === nx && x.y === ny)) continue;
    u.x = nx;
    u.y = ny;
    events.push({ t: "push", id: u.id, x: nx, y: ny });
    return;
  }
}

function pullToward(b: Battle, vic: Unit, caster: Unit, power: number, events: Ev[]): void {
  const dir = cardinalDir(caster, vic);
  if (dir === null) return;
  const toward = (dir + 2) % 4;
  const dist = Math.abs(vic.x - caster.x) + Math.abs(vic.y - caster.y);
  const force = Math.max(1, power - Math.max(0, (vic.weight || 1) - 1));
  if (dist <= 1) {
    const pastX = caster.x + DX[toward];
    const pastY = caster.y + DY[toward];
    if (inb(b, pastX, pastY)) {
      pushUnit(b, vic, toward, 2, events, 0, caster.id);
    }
    return;
  }
  const steps = Math.min(force, dist - 1);
  pushUnit(b, vic, toward, steps, events, 0, caster.id);
}

function resetChain(b: Battle): void {
  b.chainPeak = 0;
}

function finishChain(b: Battle, events: Ev[]): void {
  if (b.chainPeak >= 2) {
    events.push({ t: "chain", n: b.chainPeak });
    b.scrap += b.chainPeak;
  }
}

export function skillTargets(b: Battle, u: Unit, skill: SkillId): Pos[] {
  const def = SKILLS[skill];
  const out: Pos[] = [];
  if (def.targeting === "self") {
    out.push({ x: u.x, y: u.y });
    return out;
  }
  if (skill === "pave") {
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        if (Math.abs(x - u.x) + Math.abs(y - u.y) > 2 + b.mods.paveRange) continue;
        if (x === u.x && y === u.y) continue;
        const t = tile(b, x, y);
        if (!t) continue;
        if (t.kind === "void" || t.collapseTurn > 0) out.push({ x, y });
      }
    }
    return out;
  }
  for (let d = 0; d < 4; d++) {
    if (skill === "punch") {
      const x = u.x + DX[d];
      const y = u.y + DY[d];
      if (unitAt(b, x, y)) out.push({ x, y });
    } else if (skill === "hook") {
      const hit = firstInLine(b, u.x, u.y, d, 7);
      if (hit) out.push({ x: hit.x, y: hit.y });
    } else {
      const hit = firstInLine(b, u.x, u.y, d, 6);
      if (hit) out.push({ x: hit.x, y: hit.y });
    }
  }
  return out;
}

export function skillsFor(u: Unit, unlocked: SkillId[]): SkillId[] {
  if (u.pilot === "iron") {
    const s: SkillId[] = ["punch"];
    if (unlocked.includes("stomp")) s.push("stomp");
    return s;
  }
  if (u.pilot === "line") return ["cannon"];
  if (u.pilot === "patch") return ["hook", "pave"];
  return [];
}

function applySkillInner(
  b: Battle,
  u: Unit,
  skill: SkillId,
  tx: number,
  ty: number,
  events: Ev[],
): boolean {
  const targets = skillTargets(b, u, skill);
  if (!targets.some((p) => p.x === tx && p.y === ty)) return false;
  resetChain(b);

  if (skill === "punch") {
    const dir = cardinalDir(u, { x: tx, y: ty });
    if (dir === null) return false;
    const vic = unitAt(b, tx, ty);
    if (!vic) return false;
    events.push({ t: "log", s: `${u.name} 铁拳 → ${vic.name}` });
    pushUnit(b, vic, dir, pushForce(vic, 2 + b.mods.pushBonus), events, 0);
  } else if (skill === "cannon") {
    const dir = cardinalDir(u, { x: tx, y: ty });
    if (dir === null) return false;
    const vic = firstInLine(b, u.x, u.y, dir, 6);
    if (!vic) return false;
    events.push({ t: "log", s: `${u.name} 线炮 → ${vic.name}` });
    pushUnit(b, vic, dir, pushForce(vic, 1 + b.mods.pushBonus + b.mods.cannonPush), events, 0);
  } else if (skill === "hook") {
    const dir = cardinalDir(u, { x: tx, y: ty });
    if (dir === null) return false;
    const vic = firstInLine(b, u.x, u.y, dir, 7);
    if (!vic) return false;
    events.push({ t: "log", s: `${u.name} 钩索 → ${vic.name}` });
    pullToward(b, vic, u, 3 + b.mods.hookPush, events);
  } else if (skill === "pave") {
    const t = tile(b, tx, ty);
    if (!t) return false;
    t.kind = "floor";
    t.collapseTurn = 0;
    t.fire = false;
    events.push({ t: "tile", x: tx, y: ty, kind: "floor" });
    events.push({ t: "log", s: `${u.name} 铺回 (${tx},${ty})` });
  } else if (skill === "stomp") {
    events.push({ t: "log", s: `${u.name} 震地` });
    const adj: Unit[] = [];
    for (let d = 0; d < 4; d++) {
      const n = unitAt(b, u.x + DX[d], u.y + DY[d]);
      if (n && n.team === "enemy") adj.push(n);
    }
    for (const n of adj) {
      const dir = cardinalDir(u, n);
      if (dir !== null) pushUnit(b, n, dir, pushForce(n, 1 + b.mods.pushBonus), events, 0);
    }
  } else {
    return false;
  }

  u.acted = true;
  finishChain(b, events);
  rebuildIntents(b);
  return true;
}

export function applyMove(b: Battle, id: string, x: number, y: number): Ev[] | null {
  if (b.outcome !== "ongoing") return null;
  const u = unitById(b, id);
  if (!u || u.team !== "player" || u.moved) return null;
  const spots = reachable(b, u);
  if (!spots.some((p) => p.x === x && p.y === y)) return null;
  u.x = x;
  u.y = y;
  u.moved = true;
  rebuildIntents(b);
  return [
    { t: "move", id, x, y },
    { t: "log", s: `${u.name} 移动` },
  ];
}

export function applySkill(
  b: Battle,
  id: string,
  skill: SkillId,
  tx: number,
  ty: number,
): Ev[] | null {
  if (b.outcome !== "ongoing") return null;
  const u = unitById(b, id);
  if (!u || u.team !== "player" || u.acted) return null;
  const events: Ev[] = [];
  if (!applySkillInner(b, u, skill, tx, ty, events)) return null;
  checkOutcome(b);
  return events;
}

function collapseNow(b: Battle, events: Ev[]): void {
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const t = b.tiles[idx(b, x, y)];
      if (t.collapseTurn === 0 || t.collapseTurn > b.turn) continue;
      if (t.core) hitStructure(b, 1, events);
      t.kind = "void";
      t.collapseTurn = 0;
      t.core = false;
      t.fire = false;
      events.push({ t: "tile", x, y, kind: "void" });
      const u = unitAt(b, x, y);
      if (u) kill(b, u, "fall", events);
    }
  }
}

function lasers(b: Battle, events: Ev[]): void {
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const t = b.tiles[idx(b, x, y)];
      if (t.kind === "laser") hitTile(b, x, y, 2, events);
    }
  }
}

function fires(b: Battle, events: Ev[]): void {
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const t = b.tiles[idx(b, x, y)];
      if (!t.fire) continue;
      hitTile(b, x, y, 1, events);
      t.fire = false;
    }
  }
}

function resolveIntents(b: Battle, events: Ev[]): void {
  for (const intent of b.intents) {
    const e = unitById(b, intent.enemyId);
    if (!e) continue;
    events.push({ t: "log", s: `${e.name} 出手` });
    if (intent.kind === "row") {
      for (const p of intent.tiles) {
        hitTile(b, p.x, p.y, intent.damage, events);
        const t = tile(b, p.x, p.y);
        if (t && t.kind === "floor") t.collapseTurn = b.turn;
      }
    } else {
      for (const p of intent.tiles) hitTile(b, p.x, p.y, intent.damage, events);
    }
  }
  b.intents = [];
}

function nearestThreat(b: Battle, e: Unit): Pos {
  let best: Pos = { x: e.x, y: e.y };
  let bestD = 99;
  for (const u of b.units) {
    if (u.team !== "player" || u.hp <= 0) continue;
      const d = Math.abs(u.x - e.x) + Math.abs(u.y - e.y);
    if (d < bestD) {
      bestD = d;
      best = u;
    }
  }
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (!b.tiles[idx(b, x, y)].core) continue;
      const d = Math.abs(x - e.x) + Math.abs(y - e.y) - 1;
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
  }
  return best;
}

function enemyStep(b: Battle, e: Unit): void {
  if (e.enemy === "turret") return;
  const steps = e.enemy === "leaper" ? 2 : 1;
  for (let i = 0; i < steps; i++) {
    const t = nearestThreat(b, e);
    const dir = dirToward(e, t);
    let order = [dir, (dir + 1) % 4, (dir + 3) % 4];
    if (e.enemy === "gunner") order = [dir];
    let moved = false;
    for (const d of order) {
      const nx = e.x + DX[d];
      const ny = e.y + DY[d];
      const cell = tile(b, nx, ny);
      if (!cell || cell.kind === "void" || cell.kind === "block") continue;
      if (unitAt(b, nx, ny)) continue;
      e.x = nx;
      e.y = ny;
      moved = true;
      break;
    }
    if (!moved) break;
  }
}

function smashTiles(e: Unit, dir: number): Pos[] {
  const ox = DX[dir];
  const oy = DY[dir];
  const px = -oy;
  const py = ox;
  return [
    { x: e.x + ox, y: e.y + oy },
    { x: e.x + ox * 2, y: e.y + oy * 2 },
    { x: e.x + ox + px, y: e.y + oy + py },
    { x: e.x + ox * 2 + px, y: e.y + oy * 2 + py },
  ];
}

export function rebuildIntents(b: Battle): void {
  b.intents = [];
  for (const e of b.units) {
    if (e.team !== "enemy" || e.hp <= 0) continue;
    const t = nearestThreat(b, e);
    const dir = dirToward(e, t);
    if (e.enemy === "hammer") {
      b.intents.push({
        enemyId: e.id,
        kind: "smash",
        tiles: smashTiles(e, dir).filter((p) => inb(b, p.x, p.y)),
        damage: 2,
      });
    } else if (e.enemy === "gunner" || e.enemy === "turret") {
      const range = e.enemy === "turret" ? 5 : 4;
      const shot = firstInLine(b, e.x, e.y, dir, range);
      const tiles = shot
        ? [{ x: shot.x, y: shot.y }]
        : [{ x: e.x + DX[dir] * 2, y: e.y + DY[dir] * 2 }].filter((p) =>
            inb(b, p.x, p.y),
          );
      b.intents.push({ enemyId: e.id, kind: "shot", tiles, damage: 2 });
    } else if (e.enemy === "demo") {
      const tiles: Pos[] = [];
      if (Math.abs(t.x - e.x) >= Math.abs(t.y - e.y)) {
        for (let y = 0; y < b.h; y++) tiles.push({ x: t.x, y });
      } else {
        for (let x = 0; x < b.w; x++) tiles.push({ x, y: t.y });
      }
      b.intents.push({ enemyId: e.id, kind: "row", tiles, damage: 2 });
    } else {
      b.intents.push({
        enemyId: e.id,
        kind: "melee",
        tiles: [{ x: e.x + DX[dir], y: e.y + DY[dir] }].filter((p) =>
          inb(b, p.x, p.y),
        ),
        damage: e.enemy === "brute" || e.enemy === "warden" ? 2 : 1,
      });
    }
  }
}

function spreadCracks(b: Battle, events: Ev[]): void {
  if (!b.spreading) return;
  const seen = new Set<string>();
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (b.tiles[idx(b, x, y)].kind !== "void") continue;
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (!inb(b, nx, ny)) continue;
        const n = b.tiles[idx(b, nx, ny)];
        if (n.kind === "void" || n.core || n.collapseTurn > 0) continue;
        const key = `${nx},${ny}`;
        if (seen.has(key)) continue;
        seen.add(key);
        n.collapseTurn = b.turn + 1;
      }
    }
  }
  if (seen.size) events.push({ t: "log", s: `崩塌蔓延 ${seen.size} 格` });
}

function runBelts(b: Battle, events: Ev[]): void {
  const list = b.units.filter((u) => u.hp > 0);
  for (const u of list) {
    if (u.hp <= 0) continue;
    const t = tile(b, u.x, u.y);
    if (!t || t.kind !== "belt" || t.beltDir === undefined) continue;
    const dir = t.beltDir;
    const nx = u.x + DX[dir];
    const ny = u.y + DY[dir];
    events.push({ t: "log", s: `传送带送走 ${u.name}` });
    if (!inb(b, nx, ny)) {
      const dmg = b.mods.slamDamage;
      damage(b, u, dmg, events);
      events.push({ t: "slam", id: u.id, x: u.x, y: u.y, dmg });
      continue;
    }
    const dest = tile(b, nx, ny);
    if (!dest || dest.kind === "void") {
      u.x = nx;
      u.y = ny;
      kill(b, u, "fall", events);
      continue;
    }
    if (dest.kind === "block" || !inb(b, nx, ny)) {
      const dmg = b.mods.slamDamage;
      damage(b, u, dmg, events);
      events.push({ t: "slam", id: u.id, x: u.x, y: u.y, dmg });
      continue;
    }
    const occ = unitAt(b, nx, ny);
    if (occ && occ.id !== u.id) {
      const dmg = b.mods.slamDamage;
      damage(b, u, dmg, events);
      damage(b, occ, dmg, events);
      events.push({ t: "slam", id: u.id, x: u.x, y: u.y, dmg });
      continue;
    }
    u.x = nx;
    u.y = ny;
    events.push({ t: "move", id: u.id, x: nx, y: ny });
  }
}

function runRepair(b: Battle, events: Ev[]): void {
  for (const u of b.units) {
    if (u.hp <= 0 || u.team !== "player") continue;
    const t = tile(b, u.x, u.y);
    if (!t || t.kind !== "repair") continue;
    if (u.hp >= u.maxHp) continue;
    u.hp += 1;
    events.push({ t: "log", s: `${u.name} 在维修垫上回复` });
    events.push({ t: "hit", id: u.id, x: u.x, y: u.y, dmg: -1 });
  }
}

export function endTurn(b: Battle): Ev[] {
  const events: Ev[] = [];
  if (b.outcome !== "ongoing") return events;
  events.push({ t: "log", s: `第 ${b.turn} 回合结束` });
  resolveIntents(b, events);
  checkOutcome(b);
  if (b.outcome !== "ongoing") return events;
  lasers(b, events);
  fires(b, events);
  collapseNow(b, events);
  spreadCracks(b, events);
  runBelts(b, events);
  runRepair(b, events);
  checkOutcome(b);
  if (b.outcome !== "ongoing") return events;

  for (const e of b.units) {
    if (e.team === "enemy" && e.hp > 0) enemyStep(b, e);
  }
  for (const u of b.units) {
    if (u.team === "player") {
      u.moved = false;
      u.acted = false;
    }
  }
  b.turn += 1;
  rebuildIntents(b);
  checkOutcome(b);
  return events;
}

export function applyAction(b: Battle, a: Action): Ev[] | null {
  if (a.type === "move") return applyMove(b, a.id, a.x, a.y);
  if (a.type === "skill") return applySkill(b, a.id, a.skill, a.tx, a.ty);
  if (a.type === "end") return endTurn(b);
  return null;
}

export function previewAction(b: Battle, a: Action): { next: Battle; events: Ev[] } | null {
  const next = cloneBattle(b);
  const events = applyAction(next, a);
  if (!events) return null;
  return { next, events };
}

export function legalActions(b: Battle, unlocked: SkillId[]): Action[] {
  const acts: Action[] = [{ type: "end" }];
  if (b.outcome !== "ongoing") return [];
  for (const u of b.units) {
    if (u.team !== "player" || u.hp <= 0) continue;
    if (!u.moved) {
      for (const p of reachable(b, u)) acts.push({ type: "move", id: u.id, x: p.x, y: p.y });
    }
    if (!u.acted) {
      for (const s of skillsFor(u, unlocked)) {
        for (const p of skillTargets(b, u, s)) {
          acts.push({ type: "skill", id: u.id, skill: s, tx: p.x, ty: p.y });
        }
      }
    }
  }
  return acts;
}
