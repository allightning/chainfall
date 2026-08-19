import type { Battle, EnemyKind, Mods, PilotId, Tile, Unit } from "./types";
import { DEFAULT_MODS } from "./types";
import { rebuildIntents } from "./sim";
import type { Mission } from "./missions";

export interface Relic {
  id: string;
  name: string;
  desc: string;
  apply: (m: Mods) => void;
}

export const RELICS: Relic[] = [
  { id: "pluspush", name: "过载推击", desc: "所有击退距离 +1", apply: (m) => { m.pushBonus += 1; } },
  { id: "slam2", name: "重撞铆钉", desc: "撞击伤害 +1", apply: (m) => { m.slamDamage += 1; } },
  { id: "stride", name: "磁长步", desc: "所有机甲移动 +1", apply: (m) => { m.moveBonus += 1; } },
  { id: "armor", name: "护核板", desc: "舰核受到的伤害 -1", apply: (m) => { m.coreArmor += 1; } },
  { id: "chain", name: "连锁回收", desc: "单次连锁 ≥ 3 时额外获得废料", apply: (m) => { m.chainScrap = true; } },
  { id: "ignite", name: "灼热拳套", desc: "造成伤害时点燃目标脚下", apply: (m) => { m.igniteHit = true; } },
  { id: "brace", name: "备用支柱", desc: "每场战斗结构 +2", apply: (m) => { m.extraStructure += 2; } },
  { id: "clock", name: "延时锚", desc: "每场战斗限时 +1 回合", apply: (m) => { m.extraTurns += 1; } },
  { id: "pocket", name: "口袋废料", desc: "每场开局 +6 废料", apply: (m) => { m.extraScrap += 6; } },
  { id: "rail", name: "磁轨弹", desc: "线炮击退 +1", apply: (m) => { m.cannonPush += 1; } },
  { id: "winch", name: "重型绞盘", desc: "钩索拉近 +1", apply: (m) => { m.hookPush += 1; } },
  { id: "foam", name: "速凝泡沫", desc: "铺路范围 +1", apply: (m) => { m.paveRange += 1; } },
  { id: "fist", name: "增压活塞", desc: "重拳伤害 +1（可叠加）", apply: (m) => { m.punchDamage += 1; } },
  { id: "slug", name: "高爆弹头", desc: "线炮伤害 +1（可叠加）", apply: (m) => { m.cannonDamage += 1; } },
  { id: "barb", name: "倒刺钩", desc: "钩索伤害 +1（可叠加）", apply: (m) => { m.hookDamage += 1; } },
  { id: "pierce", name: "穿甲板", desc: "线炮贯穿，最多打中 3 个单位", apply: (m) => { m.cannonPierce = true; } },
  { id: "stun", name: "震荡配重", desc: "撞击会使目标晕眩一回合", apply: (m) => { m.stunOnSlam = true; } },
  { id: "siphon", name: "汲血管", desc: "击杀敌人时回复伤势最重的机甲 1 点生命", apply: (m) => { m.killHeal = true; } },
  { id: "corekill", name: "残骸回填", desc: "击杀敌人时回复 1 点结构", apply: (m) => { m.coreOnKill = true; } },
  { id: "laststand", name: "最后支柱", desc: "结构第一次被打到 0 时，强制保留 1 点", apply: (m) => { m.lastStand = true; } },
  { id: "scrapbonus", name: "拆解许可", desc: "击杀额外 +1 废料", apply: (m) => { m.scrapBonus += 1; } },
  { id: "plate", name: "反应装甲", desc: "机甲受到的伤害 -1（至少仍受 1 点）", apply: (m) => { m.pilotArmor += 1; } },
  { id: "thorns", name: "倒刺外壳", desc: "机甲被打时，攻击者受到 1 点伤害", apply: (m) => { m.thorns += 1; } },
  { id: "quake", name: "震波靴", desc: "震地伤害 +1", apply: (m) => { m.stompDamage += 1; } },
  { id: "vamp", name: "吸血回路", desc: "技能造成伤害时，出手机甲回复 1 点生命", apply: (m) => { m.vamp = true; } },
  { id: "markkit", name: "破甲弹头", desc: "打中带破甲标记的敌人额外 +2 伤害", apply: (m) => { m.detonateMark += 2; } },
];

export type UpgradeKind = "combo" | "mech" | "stat";

export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  kind: UpgradeKind;
}

export const UPGRADES: Upgrade[] = [
  { id: "markcombo", kind: "combo", name: "组合 · 破甲协同", desc: "重拳/震地挂上破甲。线炮或钩索打中破甲目标额外 +3 伤害并揭掉标记。" },
  { id: "volley", kind: "combo", name: "组合 · 击杀连射", desc: "线炮击杀后，本回合可再开一炮。" },
  { id: "relay", kind: "combo", name: "组合 · 击杀再动", desc: "击杀后，另一台已行动的机甲可以再行动一次。" },
  { id: "pulse", kind: "combo", name: "组合 · 三人超载", desc: "同一回合三人全部出手后，所有敌人受到 2 点伤害。" },
  { id: "hookcombo", kind: "combo", name: "组合 · 钩拳连携", desc: "钩索把敌人拉到铁腕身边时，额外结算一次 2 点伤害。" },
  { id: "stomp", kind: "mech", name: "铁腕 · 震地", desc: "解锁：相邻敌人各受 1 伤害并被推开" },
  { id: "execute", kind: "mech", name: "斩杀协议", desc: "对生命 ≤2 的敌人额外 +2 伤害" },
  { id: "firststrike", kind: "mech", name: "先手电容", desc: "每回合第一次技能额外 +1 伤害" },
  { id: "overclock", kind: "mech", name: "过载回路", desc: "同一回合第二发及之后的技能额外 +2 伤害" },
  { id: "bleed", kind: "mech", name: "破甲渗血", desc: "回合结束时，带破甲的敌人再掉 1 点生命" },
  { id: "shield", kind: "mech", name: "电容盾", desc: "每场开局每台机甲获得 1 点护盾，护盾可挡一次伤害" },
  { id: "anchor", kind: "mech", name: "锚定爪", desc: "我方机甲不会被击退" },
  { id: "ricochet", kind: "mech", name: "溅射配重", desc: "撞击时对相邻单位再造成 1 点伤害" },
  { id: "vamp", kind: "mech", name: "吸血回路", desc: "技能造成伤害时，出手机甲回复 1 点生命" },
  { id: "linepierce", kind: "mech", name: "线炮 · 穿甲", desc: "线炮贯穿，最多打中 3 个单位" },
  { id: "ironfist", kind: "stat", name: "铁腕 · 增压", desc: "重拳伤害 +1" },
  { id: "linegun", kind: "stat", name: "线炮 · 高爆", desc: "线炮伤害 +1" },
  { id: "patchhook", kind: "stat", name: "补丁 · 倒刺", desc: "钩索伤害 +1" },
  { id: "teampush", kind: "stat", name: "过载推击", desc: "所有击退距离 +1" },
  { id: "ironhp", kind: "stat", name: "铁腕 · 加厚", desc: "铁腕生命 +2" },
  { id: "linehp", kind: "stat", name: "线炮 · 加厚", desc: "线炮生命 +2" },
  { id: "patchhp", kind: "stat", name: "补丁 · 加厚", desc: "补丁生命 +2" },
  { id: "ironmove", kind: "stat", name: "铁腕 · 快步", desc: "铁腕移动 +1" },
  { id: "linemove", kind: "stat", name: "线炮 · 快步", desc: "线炮移动 +1" },
  { id: "patchmove", kind: "stat", name: "补丁 · 快步", desc: "补丁移动 +1" },
  { id: "patchrange", kind: "stat", name: "补丁 · 速凝", desc: "铺路范围 +1" },
  { id: "ironfist2", kind: "stat", name: "铁腕 · 二次增压", desc: "重拳伤害再 +1" },
  { id: "linegun2", kind: "stat", name: "线炮 · 二次高爆", desc: "线炮伤害再 +1" },
  { id: "fieldmed", kind: "stat", name: "战地接合", desc: "立刻回复所有机甲 2 点生命" },
];

export const PILOT_BASE: Record<
  PilotId,
  { name: string; hp: number; move: number; glyph: string; color: string }
> = {
  iron: { name: "铁腕", hp: 5, move: 3, glyph: "铁", color: "#3ec8c8" },
  line: { name: "线炮", hp: 4, move: 3, glyph: "线", color: "#7ab0ff" },
  patch: { name: "补丁", hp: 4, move: 4, glyph: "补", color: "#b7e07a" },
};

export const CHAPTERS = [
  { id: 1, name: "解体港", sub: "码头正在从轨道上撕开" },
  { id: 2, name: "垂直街", sub: "三十层高的巷战" },
  { id: 3, name: "镜面站", sub: "弹簧把车厢弹进深渊" },
  { id: 4, name: "炉心", sub: "最后的梁，没有退路" },
];

export const ENEMY_BASE: Record<
  EnemyKind,
  { name: string; hp: number; glyph: string; weight: number }
> = {
  beetle: { name: "甲虫", hp: 2, glyph: "虫", weight: 1 },
  brute: { name: "重兵", hp: 8, glyph: "兵", weight: 2 },
  hammer: { name: "重锤", hp: 8, glyph: "锤", weight: 2 },
  gunner: { name: "炮手", hp: 6, glyph: "炮", weight: 1 },
  bomber: { name: "爆虫", hp: 4, glyph: "爆", weight: 1 },
  demo: { name: "拆楼机", hp: 16, glyph: "拆", weight: 3 },
  turret: { name: "炮台", hp: 7, glyph: "台", weight: 3 },
  leaper: { name: "跃虫", hp: 6, glyph: "跃", weight: 1 },
  warden: { name: "监卫", hp: 10, glyph: "卫", weight: 2 },
  etcher: { name: "蚀刻虫", hp: 7, glyph: "蚀", weight: 1 },
  sniper: { name: "穿甲手", hp: 6, glyph: "穿", weight: 1 },
  mortar: { name: "曲射台", hp: 7, glyph: "曲", weight: 3 },
  grappler: { name: "绞手", hp: 7, glyph: "绞", weight: 1 },
  brood: { name: "孵母", hp: 10, glyph: "孵", weight: 2 },
  bully: { name: "冲车", hp: 8, glyph: "冲", weight: 2 },
};

export interface PilotSave {
  id: PilotId;
  hp: number;
  maxHp: number;
  move: number;
}

export function defaultPilots(): PilotSave[] {
  return (Object.keys(PILOT_BASE) as PilotId[]).map((id) => ({
    id,
    hp: PILOT_BASE[id].hp,
    maxHp: PILOT_BASE[id].hp,
    move: PILOT_BASE[id].move,
  }));
}

function applyUpgradeMods(m: Mods, ids: string[]): void {
  for (const id of ids) {
    if (id === "ironfist" || id === "ironfist2") m.punchDamage += 1;
    if (id === "linegun" || id === "linegun2") m.cannonDamage += 1;
    if (id === "patchhook") m.hookDamage += 1;
    if (id === "linepierce") m.cannonPierce = true;
    if (id === "patchrange") m.paveRange += 1;
    if (id === "markcombo") {
      m.markOnHit = true;
      m.detonateMark += 3;
    }
    if (id === "volley") m.volley = true;
    if (id === "relay") m.relayKill = true;
    if (id === "pulse") m.teamPulse = true;
    if (id === "hookcombo") m.hookCombo = true;
    if (id === "execute") m.executeBonus += 2;
    if (id === "firststrike") m.firstStrike += 1;
    if (id === "overclock") m.overclock += 2;
    if (id === "bleed") m.bleed = true;
    if (id === "shield") m.shieldStart += 1;
    if (id === "anchor") m.anchor = true;
    if (id === "ricochet") m.ricochet = true;
    if (id === "vamp") m.vamp = true;
    if (id === "teampush") m.pushBonus += 1;
  }
}

export function modsFrom(relicIds: string[], upgradeIds: string[] = []): Mods {
  const m: Mods = { ...DEFAULT_MODS };
  for (const id of relicIds) {
    RELICS.find((r) => r.id === id)?.apply(m);
  }
  applyUpgradeMods(m, upgradeIds);
  return m;
}

export function modsFromRelics(ids: string[]): Mods {
  return modsFrom(ids, []);
}

function parseMap(ascii: string): { tiles: Tile[]; w: number; h: number } {
  const rows = ascii
    .trim()
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  if (w === 0 || rows.some((r) => r.length !== w)) {
    throw new Error("地图宽度不一致");
  }
  const tiles: Tile[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      const t: Tile = { kind: "floor", collapseTurn: 0, core: false, fire: false, acid: 0 };
      if (ch === "#") t.kind = "void";
      else if (ch === "L") t.kind = "laser";
      else if (ch === "S") t.kind = "spring";
      else if (ch === "O") t.kind = "oil";
      else if (ch === "R") t.kind = "repair";
      else if (ch === "X") t.kind = "block";
      else if (ch === ">") {
        t.kind = "belt";
        t.beltDir = 1;
      } else if (ch === "<") {
        t.kind = "belt";
        t.beltDir = 3;
      } else if (ch === "^") {
        t.kind = "belt";
        t.beltDir = 0;
      } else if (ch === "v") {
        t.kind = "belt";
        t.beltDir = 2;
      } else if (ch === "C") t.core = true;
      else if (ch >= "1" && ch <= "9") t.collapseTurn = Number(ch);
      tiles.push(t);
    }
  }
  return { tiles, w, h };
}

function placeCoresLow(
  tiles: Tile[],
  w: number,
  h: number,
  avoid: { x: number; y: number }[],
): void {
  for (const t of tiles) t.core = false;
  const blocked = new Set(avoid.map((p) => `${p.x},${p.y}`));
  const mid = Math.floor(w / 2);
  const rows = [h - 3, h - 2, h - 4, h - 5, h - 1].filter((y) => y >= 1 && y < h);
  const xs = [mid - 1, mid, mid + 1, mid - 2, mid + 2];
  let n = 0;
  const want = 2;
  const tryPlace = (x: number, row: number) => {
    if (n >= want) return;
    if (x < 0 || x >= w || row < 0 || row >= h) return;
    if (blocked.has(`${x},${row}`)) return;
    const t = tiles[row * w + x];
    if (!t || t.core || t.kind === "void" || t.kind === "block") return;
    t.core = true;
    n++;
  };
  for (const y of rows) {
    for (const x of xs) tryPlace(x, y);
    for (let x = 0; x < w; x++) tryPlace(x, y);
    if (n >= want) break;
  }
}

export function createBattle(
  mission: Mission,
  pilots: PilotSave[],
  relicIds: string[],
  upgradeIds: string[] = [],
): Battle {
  const { tiles, w, h } = parseMap(mission.map);
  placeCoresLow(tiles, w, h, [...mission.pilots, ...mission.enemies]);
  const units: Unit[] = [];
  const used = new Set<string>();

  const place = (x: number, y: number) => {
    const key = `${x},${y}`;
    if (used.has(key)) throw new Error(`重叠放置 ${key} @ ${mission.id}`);
    if (x < 0 || y < 0 || x >= w || y >= h) throw new Error(`越界 ${key} @ ${mission.id}`);
    const t = tiles[y * w + x];
    if (t.kind === "void" || t.kind === "block") throw new Error(`不能放人 ${key} @ ${mission.id}`);
    used.add(key);
  };

  mission.pilots.forEach((p, i) => {
    const save = pilots[i];
    if (!save) return;
    place(p.x, p.y);
    const base = PILOT_BASE[save.id];
    const hp = save.hp > 0 ? Math.min(save.hp, save.maxHp) : 1;
    units.push({
      id: save.id,
      team: "player",
      pilot: save.id,
      name: base.name,
      x: p.x,
      y: p.y,
      hp,
      maxHp: save.maxHp,
      move: save.move,
      moved: false,
      acted: false,
      weight: 1,
      facing: 0,
      stunned: false,
      marked: false,
      shield: 0,
    });
  });

  mission.enemies.forEach((e, i) => {
    place(e.x, e.y);
    const base = ENEMY_BASE[e.kind];
    units.push({
      id: `e${i}`,
      team: "enemy",
      enemy: e.kind,
      name: base.name,
      x: e.x,
      y: e.y,
      hp: base.hp,
      maxHp: base.hp,
      move: 1,
      moved: false,
      acted: false,
      weight: base.weight,
      facing: 2,
      stunned: false,
      marked: false,
      shield: 0,
    });
  });

  const mods = modsFrom(relicIds, upgradeIds);
  const battle: Battle = {
    w,
    h,
    tiles,
    units,
    intents: [],
    turn: 1,
    maxTurns: mission.maxTurns + mods.extraTurns,
    structure: mission.structure + mods.extraStructure,
    maxStructure: mission.structure + mods.extraStructure,
    scrap: mods.extraScrap,
    chainPeak: 0,
    mods,
    outcome: "ongoing",
    loseReason: "",
    briefing: mission.briefing,
    title: mission.title,
    chapter: mission.chapter,
    id: mission.id,
    objective: mission.objective ?? "kill",
    spreading: mission.spreading ?? false,
    lastStandUsed: false,
    firstSkillUsed: false,
    skillsThisTurn: 0,
    volleyUsed: false,
    pulseUsed: false,
    relayUsed: false,
  };
  if (mods.shieldStart > 0) {
    for (const u of units) {
      if (u.team === "player") u.shield = mods.shieldStart;
    }
  }
  rebuildIntents(battle);
  return battle;
}
