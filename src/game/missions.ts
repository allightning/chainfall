import type { EnemyKind, Pos } from "./types";
import { GENERATED } from "./gen";

export interface Mission {
  id: string;
  chapter: number;
  kind: "fight" | "elite" | "boss";
  title: string;
  briefing: string;
  map: string;
  pilots: Pos[];
  enemies: { kind: EnemyKind; x: number; y: number }[];
  structure: number;
  maxTurns: number;
}

export interface RunNode {
  type: "fight" | "elite" | "boss" | "shop" | "event";
  missionId?: string;
  eventId?: string;
}

function M(
  id: string,
  chapter: number,
  kind: Mission["kind"],
  title: string,
  briefing: string,
  map: string,
  pilots: Pos[],
  enemies: Mission["enemies"],
  structure = 4,
  maxTurns = 8,
): Mission {
  return { id, chapter, kind, title, briefing, map, pilots, enemies, structure, maxTurns };
}

export const MISSIONS: Mission[] = [
  M(
    "c1-1",
    1,
    "fight",
    "码头缺口",
    "红格是下一击。把甲虫推进坑里。不要站在红格上。",
    `
........
..#.....
........
....#...
..CCC...
........
........
........
`,
    [{ x: 2, y: 6 }, { x: 4, y: 6 }, { x: 6, y: 6 }],
    [
      { kind: "beetle", x: 1, y: 1 },
      { kind: "beetle", x: 5, y: 2 },
    ],
    4,
    7,
  ),
  M(
    "c1-2",
    1,
    "fight",
    "将塌甲板",
    "带数字的格子会在那一回合结束时掉下去。可以把敌人推上去。",
    `
........
..2..2..
........
.#....#.
..CCC...
........
........
........
`,
    [{ x: 1, y: 6 }, { x: 4, y: 6 }, { x: 6, y: 6 }],
    [
      { kind: "beetle", x: 2, y: 1 },
      { kind: "beetle", x: 5, y: 1 },
      { kind: "brute", x: 4, y: 3 },
    ],
  ),
  M(
    "c1-3",
    1,
    "fight",
    "夹击走廊",
    "互撞会双方受伤并挤开。把它们撞到一起。",
    `
........
........
.#....#.
........
.C.CC.C.
........
.#....#.
........
`,
    [{ x: 3, y: 6 }, { x: 4, y: 7 }, { x: 5, y: 6 }],
    [
      { kind: "beetle", x: 1, y: 1 },
      { kind: "beetle", x: 6, y: 1 },
      { kind: "brute", x: 4, y: 2 },
    ],
  ),
  M(
    "c1-4",
    1,
    "fight",
    "弹簧井",
    "弹簧会让击退多飞一格。看预览，别把自己弹进坑。",
    `
..#..#..
........
..S..S..
........
..CCC...
........
........
........
`,
    [{ x: 2, y: 6 }, { x: 4, y: 7 }, { x: 6, y: 6 }],
    [
      { kind: "beetle", x: 1, y: 1 },
      { kind: "beetle", x: 6, y: 1 },
      { kind: "bomber", x: 4, y: 3 },
    ],
  ),
  M(
    "c1-boss",
    1,
    "boss",
    "拆楼机 · 港",
    "它会砸一整列。被砸到的地板会立刻进入塌方。把它推进自己挖的坑。",
    `
........
........
..#..#..
........
.CCCCCC.
........
........
........
`,
    [{ x: 2, y: 6 }, { x: 4, y: 6 }, { x: 6, y: 6 }],
    [
      { kind: "demo", x: 4, y: 1 },
      { kind: "beetle", x: 1, y: 2 },
      { kind: "beetle", x: 6, y: 2 },
    ],
    5,
    9,
  ),
  M(
    "c2-1",
    2,
    "fight",
    "激光巷",
    "站在激光格上，回合结束会被烧。敌人也一样。",
    `
........
.L....L.
........
.#.LL.#.
..CCC...
........
.L....L.
........
`,
    [{ x: 2, y: 5 }, { x: 4, y: 6 }, { x: 6, y: 5 }],
    [
      { kind: "gunner", x: 1, y: 1 },
      { kind: "beetle", x: 6, y: 1 },
      { kind: "brute", x: 4, y: 2 },
    ],
  ),
  M(
    "c2-2",
    2,
    "fight",
    "垂直街",
    "炮手隔空点名。推开它们的瞄准线，或把挡拆到它们面前。",
    `
.#....#.
........
..#..#..
........
C.C.C.C.
........
........
.#....#.
`,
    [{ x: 2, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 7 }],
    [
      { kind: "gunner", x: 2, y: 1 },
      { kind: "gunner", x: 5, y: 1 },
      { kind: "beetle", x: 4, y: 3 },
    ],
  ),
  M(
    "c2-3",
    2,
    "fight",
    "油然",
    "爆虫死会炸开四周。可以当人肉炸弹用。",
    `
........
..#..#..
........
.2....2.
..CCC...
........
........
........
`,
    [{ x: 1, y: 6 }, { x: 4, y: 7 }, { x: 7, y: 6 }],
    [
      { kind: "bomber", x: 1, y: 1 },
      { kind: "bomber", x: 6, y: 1 },
      { kind: "brute", x: 4, y: 2 },
    ],
  ),
  M(
    "c2-elite",
    2,
    "elite",
    "重锤双人",
    "重锤砸 2×2。别站在同一片里。把它们互推到对方的红区。",
    `
........
........
.#....#.
........
.CCCCC..
........
.#....#.
........
`,
    [{ x: 2, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 }],
    [
      { kind: "hammer", x: 1, y: 1 },
      { kind: "hammer", x: 6, y: 1 },
      { kind: "beetle", x: 4, y: 2 },
    ],
    5,
    8,
  ),
  M(
    "c2-boss",
    2,
    "boss",
    "拆楼机 · 街",
    "激光还在。拆楼机会把整列变成坑。铺路能抢回一拍。",
    `
.L....L.
........
..#..#..
........
.CCCCCC.
........
.L....L.
........
`,
    [{ x: 2, y: 5 }, { x: 4, y: 6 }, { x: 6, y: 5 }],
    [
      { kind: "demo", x: 3, y: 1 },
      { kind: "gunner", x: 6, y: 2 },
      { kind: "bomber", x: 1, y: 2 },
    ],
    5,
    9,
  ),
  M(
    "c3-1",
    3,
    "fight",
    "镜面站入口",
    "弹簧 + 激光。预览会把整条连锁演完，以它为准。",
    `
#......#
..S..S..
........
.L....L.
.C.CC.C.
.L....L.
........
#......#
`,
    [{ x: 2, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 }],
    [
      { kind: "hammer", x: 2, y: 1 },
      { kind: "gunner", x: 5, y: 1 },
      { kind: "beetle", x: 4, y: 3 },
    ],
  ),
  M(
    "c3-elite",
    3,
    "elite",
    "三重锤",
    "三台重锤。先制造互撞，再把活口送进数字格。",
    `
........
.2....2.
........
.#....#.
.CCCCC..
........
.3....3.
........
`,
    [{ x: 2, y: 5 }, { x: 4, y: 5 }, { x: 6, y: 5 }],
    [
      { kind: "hammer", x: 1, y: 1 },
      { kind: "hammer", x: 6, y: 1 },
      { kind: "hammer", x: 4, y: 2 },
    ],
    5,
    8,
  ),
  M(
    "c3-2",
    3,
    "fight",
    "窄梁",
    "落脚点很少。补丁的铺路是这关的武器。",
    `
##....##
#......#
..#..#..
........
#.CCCC.#
........
#......#
##....##
`,
    [{ x: 2, y: 5 }, { x: 4, y: 6 }, { x: 5, y: 5 }],
    [
      { kind: "gunner", x: 2, y: 1 },
      { kind: "gunner", x: 5, y: 1 },
      { kind: "bomber", x: 4, y: 3 },
      { kind: "beetle", x: 1, y: 3 },
    ],
  ),
  M(
    "c3-boss",
    3,
    "boss",
    "拆楼机 · 镜",
    "Boss 加两名炮手。先拆瞄准，再处理拆楼机。",
    `
.S....S.
........
L#....#L
........
.CCCCCC.
........
........
.S....S.
`,
    [{ x: 2, y: 6 }, { x: 4, y: 5 }, { x: 6, y: 6 }],
    [
      { kind: "demo", x: 4, y: 1 },
      { kind: "gunner", x: 1, y: 3 },
      { kind: "gunner", x: 6, y: 3 },
      { kind: "beetle", x: 3, y: 3 },
    ],
    6,
    10,
  ),
  M(
    "c4-1",
    4,
    "fight",
    "核心外围",
    "全图都在掉。每一回合都要把人从数字格上挪走或推走。",
    `
.2....2.
........
3......3
........
.CCCCCC.
........
.4....4.
........
`,
    [{ x: 2, y: 6 }, { x: 4, y: 6 }, { x: 6, y: 6 }],
    [
      { kind: "hammer", x: 2, y: 1 },
      { kind: "gunner", x: 5, y: 1 },
      { kind: "bomber", x: 4, y: 3 },
      { kind: "brute", x: 1, y: 3 },
    ],
    5,
    8,
  ),
  M(
    "c4-elite",
    4,
    "elite",
    "送葬队列",
    "四只爆虫。引爆顺序决定你是清场还是同归于尽。",
    `
........
.#....#.
........
.L....L.
.CCCCC..
........
.#....#.
........
`,
    [{ x: 2, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 }],
    [
      { kind: "bomber", x: 1, y: 0 },
      { kind: "bomber", x: 6, y: 0 },
      { kind: "bomber", x: 2, y: 2 },
      { kind: "bomber", x: 5, y: 2 },
      { kind: "hammer", x: 4, y: 1 },
    ],
    5,
    8,
  ),
  M(
    "c4-final",
    4,
    "boss",
    "核心拆楼",
    "两台拆楼机。别让它们同时砸核心。这是最后一战。",
    `
........
S......S
..#..#..
........
.CCCCCC.
........
L......L
........
`,
    [{ x: 2, y: 6 }, { x: 4, y: 6 }, { x: 6, y: 6 }],
    [
      { kind: "demo", x: 2, y: 1 },
      { kind: "demo", x: 5, y: 1 },
      { kind: "gunner", x: 4, y: 3 },
      { kind: "brute", x: 7, y: 3 },
    ],
    6,
    10,
  ),
  ...GENERATED,
];

export const MISSION_BY_ID: Record<string, Mission> = Object.fromEntries(
  MISSIONS.map((m) => [m.id, m]),
);

export const CAMPAIGN: RunNode[] = [
  { type: "fight", missionId: "c1-1" },
  { type: "fight", missionId: "c1-2" },
  { type: "fight", missionId: "c1-3" },
  { type: "fight", missionId: "c1-4" },
  { type: "event", eventId: "repair" },
  { type: "shop" },
  { type: "boss", missionId: "c1-boss" },
  { type: "fight", missionId: "c2-1" },
  { type: "fight", missionId: "c2-2" },
  { type: "fight", missionId: "c2-3" },
  { type: "fight", missionId: "g2-a" },
  { type: "fight", missionId: "g2-b" },
  { type: "elite", missionId: "c2-elite" },
  { type: "event", eventId: "market" },
  { type: "shop" },
  { type: "boss", missionId: "c2-boss" },
  { type: "fight", missionId: "c3-1" },
  { type: "fight", missionId: "g3-a" },
  { type: "elite", missionId: "c3-elite" },
  { type: "fight", missionId: "c3-2" },
  { type: "elite", missionId: "g3-c" },
  { type: "shop" },
  { type: "boss", missionId: "c3-boss" },
  { type: "fight", missionId: "c4-1" },
  { type: "fight", missionId: "g4-a" },
  { type: "elite", missionId: "c4-elite" },
  { type: "fight", missionId: "g4-b" },
  { type: "elite", missionId: "g4-c" },
  { type: "event", eventId: "lastgate" },
  { type: "boss", missionId: "c4-final" },
];
