import {
  cardinalDir,
  cloneBattle,
  dirToward,
  firstInLine,
  idx,
  inb,
  reachable,
  tile,
  tilesAlong,
  unitAt,
  unitById,
} from "./grid";
import type { Action, Battle, Ev, IntentKind, Pos, SkillId, Unit } from "./types";
import { DX, DY, INTENT_LABEL, SKILLS } from "./types";

const PUSH_CAP = 12;
const MAX_ENEMIES = 12;

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
  if (b.structure <= 0 && b.mods.lastStand && !b.lastStandUsed) {
    b.structure = 1;
    b.lastStandUsed = true;
    events.push({ t: "log", s: "应急支柱咬住了舰核" });
  }
  events.push({ t: "structure", n: b.structure });
}

function alreadyKilled(u: Unit, events: Ev[]): boolean {
  return events.some((e) => (e.t === "die" || e.t === "fall") && e.id === u.id);
}

function kill(b: Battle, u: Unit, reason: "fall" | "die", events: Ev[]): void {
  if (alreadyKilled(u, events)) return;
  u.hp = 0;
  events.push(
    reason === "fall"
      ? { t: "fall", id: u.id, x: u.x, y: u.y }
      : { t: "die", id: u.id, x: u.x, y: u.y, name: u.name },
  );
  b.intents = b.intents.filter((i) => i.enemyId !== u.id);
  if (u.enemy === "bomber") {
    events.push({ t: "log", s: `${u.name} 殉爆` });
    for (let d = 0; d < 4; d++) {
      const n = unitAt(b, u.x + DX[d], u.y + DY[d]);
      if (n && n.hp > 0) damage(b, n, 2, events);
    }
  }
  if (u.team === "enemy") {
    const pay = 3 + b.mods.scrapBonus;
    b.scrap += pay;
    if (b.chainPeak >= 3 && b.mods.chainScrap) b.scrap += 2;
    if (b.mods.coreOnKill && b.structure < b.maxStructure) {
      b.structure += 1;
      events.push({ t: "structure", n: b.structure });
    }
    if (b.mods.killHeal) {
      const hurt = b.units
        .filter((x) => x.team === "player" && x.hp > 0 && x.hp < x.maxHp)
        .sort((a, c) => a.hp - c.hp)[0];
      if (hurt) {
        hurt.hp += 1;
        events.push({ t: "hit", id: hurt.id, x: hurt.x, y: hurt.y, dmg: -1 });
      }
    }
  }
}

function damage(b: Battle, u: Unit, dmg: number, events: Ev[], src?: Unit): void {
  if (u.hp <= 0 || dmg <= 0) return;
  if (u.team === "player" && u.shield > 0) {
    u.shield -= 1;
    events.push({ t: "log", s: `${u.name} 护盾挡住了这一击` });
    return;
  }
  let real = dmg;
  if (u.team === "player") real = Math.max(1, dmg - b.mods.pilotArmor);
  if (u.team === "enemy" && u.hp <= 2 && b.mods.executeBonus > 0) real += b.mods.executeBonus;
  u.hp -= real;
  events.push({ t: "hit", id: u.id, x: u.x, y: u.y, dmg: real });
  if (src && src.team === "player" && b.mods.vamp && src.hp > 0 && src.hp < src.maxHp) {
    src.hp += 1;
    events.push({ t: "hit", id: src.id, x: src.x, y: src.y, dmg: -1 });
  }
  if (src && u.team === "player" && b.mods.thorns > 0 && src.hp > 0) {
    src.hp -= b.mods.thorns;
    events.push({ t: "hit", id: src.id, x: src.x, y: src.y, dmg: b.mods.thorns });
    if (src.hp <= 0) kill(b, src, "die", events);
  }
  if (u.hp <= 0) kill(b, u, "die", events);
}

function skillDamage(b: Battle, vic: Unit, base: number, events: Ev[]): number {
  let dmg = base;
  if (!b.firstSkillUsed && b.mods.firstStrike > 0) {
    dmg += b.mods.firstStrike;
    b.firstSkillUsed = true;
  }
  if (b.skillsThisTurn >= 1 && b.mods.overclock > 0) dmg += b.mods.overclock;
  if (vic.marked && b.mods.detonateMark > 0) {
    dmg += b.mods.detonateMark;
    vic.marked = false;
    events.push({ t: "log", s: `${vic.name} 的破甲被引爆` });
  }
  return dmg;
}

function markTarget(b: Battle, vic: Unit, events: Ev[]): void {
  if (!b.mods.markOnHit || vic.hp <= 0 || vic.team !== "enemy") return;
  vic.marked = true;
  events.push({ t: "log", s: `${vic.name} 被挂上破甲` });
}

function maybeIgnite(b: Battle, x: number, y: number, events: Ev[]): void {
  if (!b.mods.igniteHit) return;
  const t = tile(b, x, y);
  if (t && t.kind === "floor") {
    t.fire = true;
    events.push({ t: "fire", x, y });
  }
}

function hitTile(b: Battle, x: number, y: number, dmg: number, events: Ev[], src?: Unit): void {
  const t = tile(b, x, y);
  if (!t || t.kind === "void") return;
  const u = unitAt(b, x, y);
  if (u) damage(b, u, dmg, events, src);
  if (t.core) {
    const before = b.structure;
    hitStructure(b, dmg, events);
    if (!u && b.structure < before) {
      events.push({ t: "hit", x, y, dmg: before - b.structure, core: true });
    }
  }
}

function pushForce(u: Unit, dist: number): number {
  const w = Math.max(1, u.weight || 1);
  return Math.max(0, dist - (w - 1));
}

function maybeStun(b: Battle, u: Unit, events: Ev[]): void {
  if (!b.mods.stunOnSlam || u.hp <= 0) return;
  u.stunned = true;
  events.push({ t: "log", s: `${u.name} 被撞懵了` });
}

function ricochetFrom(b: Battle, u: Unit, events: Ev[]): void {
  if (!b.mods.ricochet) return;
  for (let d = 0; d < 4; d++) {
    const n = unitAt(b, u.x + DX[d], u.y + DY[d]);
    if (n && n.hp > 0 && n.id !== u.id) damage(b, n, 1, events);
  }
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
  if (u.team === "player" && b.mods.anchor) return;
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
      maybeStun(b, u, events);
      ricochetFrom(b, u, events);
      if (b.mods.igniteHit) maybeIgnite(b, u.x, u.y, events);
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
      maybeStun(b, u, events);
      ricochetFrom(b, u, events);
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
      maybeStun(b, u, events);
      maybeStun(b, blocker, events);
      ricochetFrom(b, u, events);
      ricochetFrom(b, blocker, events);
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

function finishSkillCombos(b: Battle, u: Unit, skill: SkillId, events: Ev[]): void {
  b.skillsThisTurn += 1;
  const killed = events.some((e) => e.t === "die");
  if (killed && b.mods.volley && skill === "cannon" && !b.volleyUsed) {
    b.volleyUsed = true;
    u.acted = false;
    events.push({ t: "log", s: `${u.name} 击杀连射，可以再开一炮` });
  }
  if (killed && b.mods.relayKill && !b.relayUsed) {
    const other = b.units.find((x) => x.team === "player" && x.hp > 0 && x.id !== u.id && x.acted);
    if (other) {
      other.acted = false;
      b.relayUsed = true;
      events.push({ t: "log", s: `${other.name} 因击杀再动` });
    }
  }
  if (b.mods.teamPulse && !b.pulseUsed && b.skillsThisTurn >= 3) {
    b.pulseUsed = true;
    events.push({ t: "log", s: "三人超载" });
    for (const e of b.units) {
      if (e.team === "enemy" && e.hp > 0) damage(b, e, 2, events, u);
    }
  }
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
    const dmg = skillDamage(b, vic, 2 + b.mods.punchDamage, events);
    events.push({ t: "log", s: `${u.name} 重拳 → ${vic.name}` });
    damage(b, vic, dmg, events, u);
    maybeIgnite(b, vic.x, vic.y, events);
    markTarget(b, vic, events);
    if (vic.hp > 0) {
      const knock = pushForce(vic, 1 + b.mods.pushBonus);
      if (knock > 0) pushUnit(b, vic, dir, knock, events, 0);
    }
  } else if (skill === "cannon") {
    const dir = cardinalDir(u, { x: tx, y: ty });
    if (dir === null) return false;
    const dmgBase = 2 + b.mods.cannonDamage;
    if (b.mods.cannonPierce) {
      const line = tilesAlong(b, u.x, u.y, dir, 6, { skipVoid: true });
      events.push({ t: "log", s: `${u.name} 穿甲弹` });
      let hits = 0;
      for (const p of line) {
        const vic = unitAt(b, p.x, p.y);
        if (!vic) continue;
        const dmg = skillDamage(b, vic, dmgBase, events);
        damage(b, vic, dmg, events, u);
        maybeIgnite(b, vic.x, vic.y, events);
        if (vic.hp > 0) {
          const knock = pushForce(vic, b.mods.cannonPush + b.mods.pushBonus);
          if (knock > 0) pushUnit(b, vic, dir, knock, events, 0);
        }
        hits++;
        if (hits >= 3) break;
      }
      if (hits === 0) return false;
    } else {
      const vic = firstInLine(b, u.x, u.y, dir, 6);
      if (!vic) return false;
      const dmg = skillDamage(b, vic, dmgBase, events);
      events.push({ t: "log", s: `${u.name} 线炮 → ${vic.name}` });
      damage(b, vic, dmg, events, u);
      maybeIgnite(b, vic.x, vic.y, events);
      if (vic.hp > 0) {
        const knock = pushForce(vic, b.mods.cannonPush + b.mods.pushBonus);
        if (knock > 0) pushUnit(b, vic, dir, knock, events, 0);
      }
    }
  } else if (skill === "hook") {
    const dir = cardinalDir(u, { x: tx, y: ty });
    if (dir === null) return false;
    const vic = firstInLine(b, u.x, u.y, dir, 7);
    if (!vic) return false;
    const dmg = skillDamage(b, vic, 1 + b.mods.hookDamage, events);
    events.push({ t: "log", s: `${u.name} 钩索 → ${vic.name}` });
    damage(b, vic, dmg, events, u);
    if (vic.hp > 0) pullToward(b, vic, u, 3 + b.mods.hookPush, events);
    if (vic.hp > 0 && b.mods.hookCombo) {
      const iron = b.units.find((x) => x.pilot === "iron" && x.hp > 0);
      if (iron && Math.abs(iron.x - vic.x) + Math.abs(iron.y - vic.y) === 1) {
        events.push({ t: "log", s: "钩拳连携" });
        damage(b, vic, 2 + b.mods.punchDamage, events, iron);
      }
    }
  } else if (skill === "pave") {
    const t = tile(b, tx, ty);
    if (!t) return false;
    t.kind = "floor";
    t.collapseTurn = 0;
    t.fire = false;
    t.acid = 0;
    events.push({ t: "tile", x: tx, y: ty, kind: "floor" });
    events.push({ t: "log", s: `${u.name} 铺回甲板` });
  } else if (skill === "stomp") {
    events.push({ t: "log", s: `${u.name} 震地` });
    const adj: Unit[] = [];
    for (let d = 0; d < 4; d++) {
      const n = unitAt(b, u.x + DX[d], u.y + DY[d]);
      if (n && n.team === "enemy") adj.push(n);
    }
    for (const n of adj) {
      const dmg = skillDamage(b, n, 1 + b.mods.stompDamage, events);
      damage(b, n, dmg, events, u);
      markTarget(b, n, events);
      const dir = cardinalDir(u, n);
      if (dir !== null && n.hp > 0) {
        const knock = pushForce(n, 1 + b.mods.pushBonus);
        if (knock > 0) pushUnit(b, n, dir, knock, events, 0);
      }
    }
  } else {
    return false;
  }

  u.acted = true;
  finishSkillCombos(b, u, skill, events);
  finishChain(b, events);
  rebuildIntents(b);
  return true;
}

export function applyMove(b: Battle, id: string, x: number, y: number): Ev[] | null {
  if (b.outcome !== "ongoing") return null;
  const u = unitById(b, id);
  if (!u || u.team !== "player" || u.moved || u.stunned) return null;
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
  if (!u || u.team !== "player" || u.acted || u.stunned) return null;
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
      t.acid = 0;
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

function acids(b: Battle, events: Ev[]): void {
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const t = b.tiles[idx(b, x, y)];
      if (t.acid <= 0) continue;
      hitTile(b, x, y, 1, events);
      t.acid -= 1;
    }
  }
}

function spawnBeetle(b: Battle, e: Unit, events: Ev[]): void {
  const living = b.units.filter((u) => u.team === "enemy" && u.hp > 0).length;
  if (living >= MAX_ENEMIES) return;
  for (let d = 0; d < 4; d++) {
    const nx = e.x + DX[d];
    const ny = e.y + DY[d];
    const cell = tile(b, nx, ny);
    if (!cell || cell.kind === "void" || cell.kind === "block") continue;
    if (unitAt(b, nx, ny)) continue;
    const id = `s${b.units.length}-${b.turn}`;
    b.units.push({
      id,
      team: "enemy",
      enemy: "beetle",
      name: "幼虫",
      x: nx,
      y: ny,
      hp: 2,
      maxHp: 2,
      move: 1,
      moved: false,
      acted: false,
      weight: 1,
      facing: d as 0 | 1 | 2 | 3,
      stunned: false,
      marked: false,
      shield: 0,
    });
    events.push({ t: "log", s: `${e.name} 孵出幼虫` });
    return;
  }
}

function resolveIntents(b: Battle, events: Ev[]): void {
  for (const intent of [...b.intents]) {
    const e = unitById(b, intent.enemyId);
    if (!e) continue;
    events.push({ t: "log", s: `${e.name} · ${INTENT_LABEL[intent.kind]}` });
    if (intent.kind === "spawn") {
      spawnBeetle(b, e, events);
      continue;
    }
    if (intent.kind === "pull") {
      for (const p of intent.tiles) {
        const vic = unitAt(b, p.x, p.y);
        if (!vic) continue;
        damage(b, vic, intent.damage, events, e);
        if (vic.hp > 0) pullToward(b, vic, e, 2, events);
      }
      continue;
    }
    if (intent.kind === "shove") {
      const dir = intent.dir ?? dirToward(e, intent.tiles[0] ?? e);
      for (const p of intent.tiles) {
        const vic = unitAt(b, p.x, p.y);
        if (!vic) {
          if (tile(b, p.x, p.y)?.core) hitStructure(b, intent.damage, events);
          continue;
        }
        damage(b, vic, intent.damage, events, e);
        if (vic.hp > 0) {
          const knock = pushForce(vic, 2);
          if (knock > 0) pushUnit(b, vic, dir, knock, events, 0);
        }
      }
      continue;
    }
    if (intent.kind === "lock") {
      for (const p of intent.tiles) {
        hitTile(b, p.x, p.y, intent.damage, events, e);
        const vic = unitAt(b, p.x, p.y);
        if (vic && vic.team === "player" && vic.hp > 0) {
          vic.stunned = true;
          events.push({ t: "log", s: `${vic.name} 被压制，下回合无法行动` });
        }
      }
      continue;
    }
    if (intent.kind === "acid") {
      for (const p of intent.tiles) {
        hitTile(b, p.x, p.y, intent.damage, events, e);
        const t = tile(b, p.x, p.y);
        if (t && t.kind !== "void") t.acid = Math.max(t.acid, 2);
      }
      continue;
    }
    if (intent.kind === "beam") {
      for (const p of intent.tiles) {
        hitTile(b, p.x, p.y, intent.damage, events, e);
        const t = tile(b, p.x, p.y);
        if (t && t.kind === "floor" && !t.core) t.collapseTurn = b.turn;
      }
      continue;
    }
    for (const p of intent.tiles) hitTile(b, p.x, p.y, intent.damage, events, e);
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
  if (e.enemy === "turret" || e.enemy === "mortar") return;
  const steps = e.enemy === "leaper" ? 2 : 1;
  for (let i = 0; i < steps; i++) {
    const t = nearestThreat(b, e);
    const dir = dirToward(e, t);
    let order = [dir, (dir + 1) % 4, (dir + 3) % 4];
    if (e.enemy === "gunner" || e.enemy === "sniper") order = [dir];
    let moved = false;
    for (const d of order) {
      const nx = e.x + DX[d];
      const ny = e.y + DY[d];
      const cell = tile(b, nx, ny);
      if (!cell || cell.kind === "void" || cell.kind === "block") continue;
      if (unitAt(b, nx, ny)) continue;
      e.x = nx;
      e.y = ny;
      e.facing = d as 0 | 1 | 2 | 3;
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

function cleaveTiles(e: Unit, dir: number): Pos[] {
  const ox = DX[dir];
  const oy = DY[dir];
  const px = -oy;
  const py = ox;
  return [
    { x: e.x + ox, y: e.y + oy },
    { x: e.x + ox + px, y: e.y + oy + py },
    { x: e.x + ox - px, y: e.y + oy - py },
  ];
}

function burstTiles(e: Unit): Pos[] {
  const out: Pos[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      out.push({ x: e.x + dx, y: e.y + dy });
    }
  }
  return out;
}

function mortarTarget(b: Battle, e: Unit): Pos {
  let best: Pos = nearestThreat(b, e);
  let bestD = 99;
  for (const u of b.units) {
    if (u.team !== "player" || u.hp <= 0) continue;
    const d = Math.abs(u.x - e.x) + Math.abs(u.y - e.y);
    if (d < bestD && d >= 2) {
      bestD = d;
      best = u;
    }
  }
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (!b.tiles[idx(b, x, y)].core) continue;
      const d = Math.abs(x - e.x) + Math.abs(y - e.y);
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
  }
  return best;
}

function inBoard(b: Battle, p: Pos): boolean {
  return inb(b, p.x, p.y);
}

export function rebuildIntents(b: Battle): void {
  b.intents = [];
  for (const e of b.units) {
    if (e.team !== "enemy" || e.hp <= 0) continue;
    const t = nearestThreat(b, e);
    const dir = dirToward(e, t);
    e.facing = dir as 0 | 1 | 2 | 3;
    const kind = e.enemy;
    const push = (
      ik: IntentKind,
      tiles: Pos[],
      damage: number,
      extra?: { dir?: 0 | 1 | 2 | 3 },
    ) => {
      b.intents.push({
        enemyId: e.id,
        kind: ik,
        tiles: tiles.filter((p) => inBoard(b, p)),
        damage,
        dir: extra?.dir,
      });
    };

    if (kind === "hammer") push("smash", smashTiles(e, dir), 5);
    else if (kind === "brute") push("cleave", cleaveTiles(e, dir), 4);
    else if (kind === "gunner" || kind === "turret") {
      const range = kind === "turret" ? 6 : 4;
      const shot = firstInLine(b, e.x, e.y, dir, range);
      const tiles = shot
        ? [{ x: shot.x, y: shot.y }]
        : [{ x: e.x + DX[dir] * 2, y: e.y + DY[dir] * 2 }];
      push("shot", tiles, kind === "turret" ? 5 : 4);
    } else if (kind === "sniper") {
      push("pierce", tilesAlong(b, e.x, e.y, dir, 7, { skipVoid: true }), 4);
    } else if (kind === "demo") {
      push("beam", tilesAlong(b, e.x, e.y, dir, 5, { skipVoid: true }), 5);
    } else if (kind === "bomber") push("burst", burstTiles(e), 4);
    else if (kind === "etcher") push("acid", cleaveTiles(e, dir), 3);
    else if (kind === "mortar") push("mortar", [mortarTarget(b, e)], 4);
    else if (kind === "grappler") {
      const hit = firstInLine(b, e.x, e.y, dir, 5);
      push("pull", hit ? [{ x: hit.x, y: hit.y }] : [{ x: e.x + DX[dir], y: e.y + DY[dir] }], 2);
    } else if (kind === "bully") {
      push("shove", [{ x: e.x + DX[dir], y: e.y + DY[dir] }], 4, { dir: dir as 0 | 1 | 2 | 3 });
    } else if (kind === "brood") push("spawn", [{ x: e.x, y: e.y }], 0);
    else if (kind === "warden") push("lock", [{ x: e.x + DX[dir], y: e.y + DY[dir] }], 4);
    else push("melee", [{ x: e.x + DX[dir], y: e.y + DY[dir] }], kind === "leaper" ? 4 : 2);
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
  const list = b.units.filter((u) => {
    if (u.hp <= 0) return false;
    const t = tile(b, u.x, u.y);
    return !!(t && t.kind === "belt" && t.beltDir !== undefined);
  });
  list.sort((a, c) => {
    const da = tile(b, a.x, a.y)?.beltDir ?? 1;
    const dc = tile(b, c.x, c.y)?.beltDir ?? 1;
    const pa = a.x * DX[da] + a.y * DY[da];
    const pc = c.x * DX[dc] + c.y * DY[dc];
    return pc - pa;
  });
  for (const u of list) {
    if (u.hp <= 0) continue;
    const t = tile(b, u.x, u.y);
    if (!t || t.kind !== "belt" || t.beltDir === undefined) continue;
    const dir = t.beltDir;
    const nx = u.x + DX[dir];
    const ny = u.y + DY[dir];
    events.push({ t: "log", s: `传送带带走 ${u.name}` });
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
    if (dest.kind === "block") {
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
    events.push({ t: "log", s: `${u.name} 在维修垫上接合` });
    events.push({ t: "hit", id: u.id, x: u.x, y: u.y, dmg: -1 });
  }
}

function tickBleed(b: Battle, events: Ev[]): void {
  if (!b.mods.bleed) return;
  for (const e of b.units) {
    if (e.team !== "enemy" || e.hp <= 0 || !e.marked) continue;
    events.push({ t: "log", s: `${e.name} 破甲渗血` });
    damage(b, e, 1, events);
  }
}

export function endTurn(b: Battle): Ev[] {
  const events: Ev[] = [];
  if (b.outcome !== "ongoing") return events;
  events.push({ t: "log", s: `第 ${b.turn} 回合结束` });
  tickBleed(b, events);
  resolveIntents(b, events);
  checkOutcome(b);
  if (b.outcome !== "ongoing") return events;
  lasers(b, events);
  fires(b, events);
  acids(b, events);
  collapseNow(b, events);
  spreadCracks(b, events);
  for (const e of b.units) {
    if (e.team === "enemy" && e.hp > 0 && !e.stunned) enemyStep(b, e);
    if (e.team === "enemy") e.stunned = false;
  }
  runBelts(b, events);
  runRepair(b, events);
  checkOutcome(b);
  if (b.outcome !== "ongoing") return events;

  for (const u of b.units) {
    if (u.team !== "player") continue;
    if (u.stunned) {
      u.moved = true;
      u.acted = true;
      u.stunned = false;
      events.push({ t: "log", s: `${u.name} 仍在压制中，本回合无法行动` });
    } else {
      u.moved = false;
      u.acted = false;
    }
  }
  b.turn += 1;
  b.firstSkillUsed = false;
  b.skillsThisTurn = 0;
  b.volleyUsed = false;
  b.pulseUsed = false;
  b.relayUsed = false;
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
    if (u.stunned) continue;
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
