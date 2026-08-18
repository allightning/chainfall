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
  { id: "stride", name: "磁长步", desc: "所有人移动 +1", apply: (m) => { m.moveBonus += 1; } },
  { id: "armor", name: "护核板", desc: "核心受到的伤害 -1", apply: (m) => { m.coreArmor += 1; } },
  { id: "chain", name: "连锁回收", desc: "单次连锁 ≥ 3 时额外废料", apply: (m) => { m.chainScrap = true; } },
  { id: "ignite", name: "撞击点火", desc: "撞墙点燃脚下，回合结束灼烧", apply: (m) => { m.igniteSlam = true; } },
  { id: "brace", name: "备用支柱", desc: "每场战斗结构 +2", apply: (m) => { m.extraStructure += 2; } },
  { id: "clock", name: "延时锚", desc: "每场战斗限时 +2 回合", apply: (m) => { m.extraTurns += 2; } },
  { id: "pocket", name: "口袋废料", desc: "每场开局 +4 废料", apply: (m) => { m.extraScrap += 4; } },
  { id: "rail", name: "磁轨弹", desc: "线炮击退 +1", apply: (m) => { m.cannonPush += 1; } },
  { id: "winch", name: "重型绞盘", desc: "钩索拉近 +1", apply: (m) => { m.hookPush += 1; } },
  { id: "foam", name: "速凝泡沫", desc: "铺路范围 +1", apply: (m) => { m.paveRange += 1; } },
];

export interface Upgrade {
  id: string;
  name: string;
  desc: string;
}

export const UPGRADES: Upgrade[] = [
  { id: "stomp", name: "铁腕 · 震地", desc: "解锁：把相邻敌人全部推开" },
  { id: "ironhp", name: "铁腕 · 加厚", desc: "铁腕生命 +1" },
  { id: "linehp", name: "线炮 · 加厚", desc: "线炮生命 +1" },
  { id: "patchhp", name: "补丁 · 加厚", desc: "补丁生命 +1" },
  { id: "ironmove", name: "铁腕 · 快步", desc: "铁腕移动 +1" },
  { id: "linemove", name: "线炮 · 快步", desc: "线炮移动 +1" },
  { id: "patchmove", name: "补丁 · 快步", desc: "补丁移动 +1" },
  { id: "ironhp2", name: "铁腕 · 再加厚", desc: "铁腕生命再 +1" },
  { id: "linehp2", name: "线炮 · 再加厚", desc: "线炮生命再 +1" },
  { id: "patchhp2", name: "补丁 · 再加厚", desc: "补丁生命再 +1" },
];

export const PILOT_BASE: Record<
  PilotId,
  { name: string; hp: number; move: number; glyph: string; color: string }
> = {
  iron: { name: "铁腕", hp: 3, move: 3, glyph: "铁", color: "#3ec8c8" },
  line: { name: "线炮", hp: 2, move: 3, glyph: "线", color: "#7ab0ff" },
  patch: { name: "补丁", hp: 3, move: 4, glyph: "补", color: "#b7e07a" },
};

export const CHAPTERS = [
  { id: 1, name: "解体港", sub: "潮水般的甲板正在往下掉" },
  { id: 2, name: "垂直街", sub: "激光巷和重锤同时朝你走" },
  { id: 3, name: "镜面站", sub: "弹簧、折射、几乎没有落脚点" },
  { id: 4, name: "炉心", sub: "两台拆楼机，没有退路" },
];

export const ENEMY_BASE: Record<
  EnemyKind,
  { name: string; hp: number; glyph: string }
> = {
  beetle: { name: "甲虫", hp: 1, glyph: "虫" },
  brute: { name: "重兵", hp: 2, glyph: "兵" },
  hammer: { name: "重锤", hp: 2, glyph: "锤" },
  gunner: { name: "炮手", hp: 2, glyph: "炮" },
  bomber: { name: "爆虫", hp: 1, glyph: "爆" },
  demo: { name: "拆楼机", hp: 5, glyph: "拆" },
  turret: { name: "炮台", hp: 2, glyph: "台" },
  leaper: { name: "跃虫", hp: 1, glyph: "跃" },
  warden: { name: "监卫", hp: 3, glyph: "卫" },
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

export function modsFromRelics(ids: string[]): Mods {
  const m: Mods = { ...DEFAULT_MODS };
  for (const id of ids) {
    RELICS.find((r) => r.id === id)?.apply(m);
  }
  return m;
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
      const t: Tile = { kind: "floor", collapseTurn: 0, core: false, fire: false };
      if (ch === "#") t.kind = "void";
      else if (ch === "L") t.kind = "laser";
      else if (ch === "S") t.kind = "spring";
      else if (ch === "C") t.core = true;
      else if (ch >= "1" && ch <= "9") t.collapseTurn = Number(ch);
      tiles.push(t);
    }
  }
  return { tiles, w, h };
}

export function createBattle(
  mission: Mission,
  pilots: PilotSave[],
  relicIds: string[],
): Battle {
  const { tiles, w, h } = parseMap(mission.map);
  const units: Unit[] = [];
  const used = new Set<string>();

  const place = (x: number, y: number) => {
    const key = `${x},${y}`;
    if (used.has(key)) throw new Error(`重叠放置 ${key} @ ${mission.id}`);
    if (x < 0 || y < 0 || x >= w || y >= h) throw new Error(`越界 ${key} @ ${mission.id}`);
    const t = tiles[y * w + x];
    if (t.kind === "void") throw new Error(`坑上放人 ${key} @ ${mission.id}`);
    used.add(key);
  };

  mission.pilots.forEach((p, i) => {
    const save = pilots[i];
    if (!save) return;
    place(p.x, p.y);
    const base = PILOT_BASE[save.id];
    units.push({
      id: save.id,
      team: "player",
      pilot: save.id,
      name: base.name,
      x: p.x,
      y: p.y,
      hp: Math.max(1, Math.min(save.hp, save.maxHp)),
      maxHp: save.maxHp,
      move: save.move,
      moved: false,
      acted: false,
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
    });
  });

  const mods = modsFromRelics(relicIds);
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
  };
  rebuildIntents(battle);
  return battle;
}
