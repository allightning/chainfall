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
  | "warden";
export type PilotId = "iron" | "line" | "patch";
export type SkillId = "punch" | "cannon" | "pave" | "hook" | "stomp";
export type IntentKind = "melee" | "smash" | "shot" | "row";

export interface Tile {
  kind: TileKind;
  collapseTurn: number;
  core: boolean;
  fire: boolean;
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
}

export interface Intent {
  enemyId: string;
  kind: IntentKind;
  tiles: Pos[];
  damage: number;
}

export interface Pos {
  x: number;
  y: number;
}

export interface Mods {
  pushBonus: number;
  slamDamage: number;
  moveBonus: number;
  coreArmor: number;
  chainScrap: boolean;
  igniteSlam: boolean;
  extraStructure: number;
  extraTurns: number;
  extraScrap: number;
  cannonPush: number;
  hookPush: number;
  paveRange: number;
}

export const DEFAULT_MODS: Mods = {
  pushBonus: 0,
  slamDamage: 1,
  moveBonus: 0,
  coreArmor: 0,
  chainScrap: false,
  igniteSlam: false,
  extraStructure: 0,
  extraTurns: 0,
  extraScrap: 0,
  cannonPush: 0,
  hookPush: 0,
  paveRange: 0,
};

export type Ev =
  | { t: "move"; id: string; x: number; y: number }
  | { t: "push"; id: string; x: number; y: number }
  | { t: "slam"; id: string; x: number; y: number; dmg: number }
  | { t: "hit"; id?: string; x: number; y: number; dmg: number }
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
    hint: "相邻一格，推 2 格",
    targeting: "dir",
  },
  cannon: {
    id: "cannon",
    name: "线炮",
    hint: "直线 6 格内第一个单位，推 1 格",
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
    hint: "直线 7 格内，拉到身前；贴身则拽到身后",
    targeting: "dir",
  },
  stomp: {
    id: "stomp",
    name: "震地",
    hint: "把相邻敌人全部推开 1 格",
    targeting: "self",
  },
};

export function emptyMods(): Mods {
  return { ...DEFAULT_MODS };
}
