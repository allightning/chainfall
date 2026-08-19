export type Team = "player" | "enemy";
export type Dir = 0 | 1 | 2 | 3;

export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;
export const DIR_NAME = ["北", "东", "南", "西"] as const;

export type TileKind = "floor" | "void" | "laser" | "spring" | "belt" | "repair" | "block" | "oil";
export type EnemyKind =
  | "beetle"
  | "brute"
  | "hammer"
  | "gunner"
  | "bomber"
  | "demo"
  | "turret"
  | "leaper"
  | "warden"
  | "etcher"
  | "sniper"
  | "mortar"
  | "grappler"
  | "brood"
  | "bully";
export type PilotId = "iron" | "line" | "patch";
export type SkillId = "punch" | "cannon" | "pave" | "hook" | "stomp";

/** 十二种以上互不相同的敌方出手。 */
export type IntentKind =
  | "melee"
  | "cleave"
  | "smash"
  | "shot"
  | "pierce"
  | "beam"
  | "burst"
  | "acid"
  | "mortar"
  | "pull"
  | "shove"
  | "spawn"
  | "lock";

export const INTENT_LABEL: Record<IntentKind, string> = {
  melee: "啃咬",
  cleave: "横扫",
  smash: "重劈",
  shot: "点射",
  pierce: "穿甲",
  beam: "切割梁",
  burst: "爆散",
  acid: "蚀刻",
  mortar: "曲射",
  pull: "绞索",
  shove: "冲撞",
  spawn: "孵化",
  lock: "压制",
};

export interface Tile {
  kind: TileKind;
  collapseTurn: number;
  core: boolean;
  fire: boolean;
  acid: number;
  beltDir?: Dir;
}

export interface Unit {
  id: string;
  team: Team;
  pilot?: PilotId;
  enemy?: EnemyKind;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  move: number;
  moved: boolean;
  acted: boolean;
  /** 1=轻，2=重，3=超重。击退距离会按重量削减。 */
  weight: number;
  facing: Dir;
  stunned: boolean;
  marked: boolean;
  shield: number;
}

export interface Intent {
  enemyId: string;
  kind: IntentKind;
  tiles: Pos[];
  damage: number;
  dir?: Dir;
}

export interface Pos {
  x: number;
  y: number;
}

export interface Mods {
  punchDamage: number;
  cannonDamage: number;
  hookDamage: number;
  stompDamage: number;
  pushBonus: number;
  slamDamage: number;
  moveBonus: number;
  coreArmor: number;
  pilotArmor: number;
  chainScrap: boolean;
  igniteHit: boolean;
  extraStructure: number;
  extraTurns: number;
  extraScrap: number;
  cannonPush: number;
  hookPush: number;
  paveRange: number;
  cannonPierce: boolean;
  stunOnSlam: boolean;
  coreOnKill: boolean;
  killHeal: boolean;
  lastStand: boolean;
  scrapBonus: number;
  thorns: number;
  markOnHit: boolean;
  detonateMark: number;
  hookCombo: boolean;
  teamPulse: boolean;
  executeBonus: number;
  firstStrike: number;
  shieldStart: number;
  anchor: boolean;
  ricochet: boolean;
  relayKill: boolean;
  volley: boolean;
  vamp: boolean;
  overclock: number;
  bleed: boolean;
}

export const DEFAULT_MODS: Mods = {
  punchDamage: 0,
  cannonDamage: 0,
  hookDamage: 0,
  stompDamage: 0,
  pushBonus: 0,
  slamDamage: 1,
  moveBonus: 0,
  coreArmor: 0,
  pilotArmor: 0,
  chainScrap: false,
  igniteHit: false,
  extraStructure: 0,
  extraTurns: 0,
  extraScrap: 0,
  cannonPush: 0,
  hookPush: 0,
  paveRange: 0,
  cannonPierce: false,
  stunOnSlam: false,
  coreOnKill: false,
  killHeal: false,
  lastStand: false,
  scrapBonus: 0,
  thorns: 0,
  markOnHit: false,
  detonateMark: 0,
  hookCombo: false,
  teamPulse: false,
  executeBonus: 0,
  firstStrike: 0,
  shieldStart: 0,
  anchor: false,
  ricochet: false,
  relayKill: false,
  volley: false,
  vamp: false,
  overclock: 0,
  bleed: false,
};

export type Ev =
  | { t: "move"; id: string; x: number; y: number }
  | { t: "push"; id: string; x: number; y: number }
  | { t: "slam"; id: string; x: number; y: number; dmg: number }
  | { t: "hit"; id?: string; x: number; y: number; dmg: number; core?: boolean }
  | { t: "fall"; id: string; x: number; y: number }
  | { t: "die"; id: string; x: number; y: number; name: string }
  | { t: "tile"; x: number; y: number; kind: TileKind }
  | { t: "fire"; x: number; y: number }
  | { t: "chain"; n: number }
  | { t: "log"; s: string }
  | { t: "structure"; n: number };

export interface Battle {
  w: number;
  h: number;
  tiles: Tile[];
  units: Unit[];
  intents: Intent[];
  turn: number;
  maxTurns: number;
  structure: number;
  maxStructure: number;
  scrap: number;
  chainPeak: number;
  mods: Mods;
  outcome: "ongoing" | "won" | "lost";
  loseReason: string;
  briefing: string;
  title: string;
  chapter: number;
  id: string;
  objective: "kill" | "hold";
  spreading: boolean;
  lastStandUsed: boolean;
  firstSkillUsed: boolean;
  skillsThisTurn: number;
  volleyUsed: boolean;
  pulseUsed: boolean;
  relayUsed: boolean;
  tutBeat: number;
}

export type Action =
  | { type: "move"; id: string; x: number; y: number }
  | { type: "skill"; id: string; skill: SkillId; tx: number; ty: number }
  | { type: "end" };

export interface SkillDef {
  id: SkillId;
  name: string;
  hint: string;
  targeting: "dir" | "tile" | "self";
}

export const SKILLS: Record<SkillId, SkillDef> = {
  punch: {
    id: "punch",
    name: "重拳",
    hint: "相邻目标，2 伤害，附带击退 1 格",
    targeting: "dir",
  },
  cannon: {
    id: "cannon",
    name: "线炮",
    hint: "直线 6 格内第一个单位，2 伤害",
    targeting: "dir",
  },
  pave: {
    id: "pave",
    name: "铺路",
    hint: "2 格内，把坑或将塌格铺回地面",
    targeting: "tile",
  },
  hook: {
    id: "hook",
    name: "钩索",
    hint: "直线钩取，1 伤害并拉近；贴身则拽到身后",
    targeting: "dir",
  },
  stomp: {
    id: "stomp",
    name: "震地",
    hint: "相邻敌人各受 1 伤害，并被推开 1 格",
    targeting: "self",
  },
};

export function emptyMods(): Mods {
  return { ...DEFAULT_MODS };
}
