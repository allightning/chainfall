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
  objective?: "kill" | "hold";
  spreading?: boolean;
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
  extra?: { objective?: "kill" | "hold"; spreading?: boolean },
): Mission {
  return {
    id,
    chapter,
    kind,
    title,
    briefing,
    map,
    pilots,
    enemies,
    structure,
    maxTurns,
    objective: extra?.objective ?? "kill",
    spreading: extra?.spreading ?? false,
  };
}

export const MISSIONS: Mission[] = [
  M(
    "tut-1",
    1,
    "fight",
    "教学 · 第一次推击",
    "只做一件事：让铁腕走到甲虫旁边，再把它推进黑洞。画面上的教练会一步一步指给你看。",
    `
........
....#...
........
........
........
........
..CCC...
........
`,
    [{ x: 1, y: 4 }, { x: 5, y: 7 }, { x: 7, y: 6 }],
    [{ kind: "beetle", x: 2, y: 1 }],
    4,
    8,
  ),
  M(
    "c1-1",
    1,
    "fight",
    "码头缺口",
    "两侧甲虫会同时咬舰核。传送带会在回合结束把人送走，路障能挡炮。重兵推不了两格。",
    `
............
..#......#..
....>>>>....
.#.X.##.X.#.
............
...CCCCCC...
......RR....
.#........#.
............
............
`,
    [{ x: 2, y: 8 }, { x: 6, y: 8 }, { x: 11, y: 8 }],
    [
      { kind: "beetle", x: 1, y: 1 },
      { kind: "beetle", x: 10, y: 1 },
      { kind: "beetle", x: 4, y: 2 },
      { kind: "brute", x: 7, y: 2 },
    ],
    3,
    6,
  ),
  M(
    "c1-2",
    1,
    "fight",
    "将塌甲板",
    "数字格会在那一回合结束掉下去。维修垫回合结束回 1 血。把重兵送上数字格，别让舰核先掉。",
    `
............
.2...2...2..
............
#.X......X.#
....3..3....
...CCCCCC...
......RR....
.#........#.
............
............
`,
    [{ x: 2, y: 8 }, { x: 6, y: 8 }, { x: 9, y: 8 }],
    [
      { kind: "beetle", x: 1, y: 2 },
      { kind: "beetle", x: 10, y: 2 },
      { kind: "brute", x: 4, y: 1 },
      { kind: "brute", x: 8, y: 3 },
    ],
    3,
    6,
  ),
  M(
    "c1-hold",
    1,
    "fight",
    "撤离窗口",
    "不必杀光。守住舰核撑过时限即可撤离。路障能挡住炮手的直线。",
    `
............
............
.L........L.
....#..#....
..X......X..
...CCCCCC...
............
.#........#.
............
............
`,
    [{ x: 3, y: 8 }, { x: 6, y: 7 }, { x: 9, y: 8 }],
    [
      { kind: "gunner", x: 1, y: 1 },
      { kind: "gunner", x: 10, y: 1 },
      { kind: "beetle", x: 4, y: 2 },
      { kind: "beetle", x: 7, y: 2 },
      { kind: "brute", x: 5, y: 3 },
    ],
    4,
    5,
    { objective: "hold" },
  ),
  M(
    "c1-3",
    1,
    "fight",
    "夹击走廊",
    "互撞会双方受伤。传送带会在回合结束把人送走。两路重兵夹舰核，用钩索把它们拽到同一条线上对撞。",
    `
............
............
.#........#.
..>>>..<<<..
.C.CCCCCC.C.
............
.#........#.
............
.#........#.
............
`,
    [{ x: 3, y: 8 }, { x: 6, y: 9 }, { x: 9, y: 8 }],
    [
      { kind: "beetle", x: 1, y: 1 },
      { kind: "beetle", x: 10, y: 1 },
      { kind: "brute", x: 2, y: 2 },
      { kind: "brute", x: 9, y: 2 },
      { kind: "gunner", x: 5, y: 1 },
    ],
    3,
    6,
  ),
  M(
    "c1-4",
    1,
    "fight",
    "弹簧井",
    "弹簧会让击退多飞一格。重兵要靠弹簧才能送进坑。预览，别把自己弹进去。",
    `
..#......#..
............
..S......S..
............
....#..#....
...CCCCCC...
............
............
.#........#.
............
`,
    [{ x: 2, y: 8 }, { x: 6, y: 8 }, { x: 11, y: 8 }],
    [
      { kind: "beetle", x: 1, y: 1 },
      { kind: "beetle", x: 10, y: 1 },
      { kind: "bomber", x: 4, y: 3 },
      { kind: "brute", x: 7, y: 3 },
      { kind: "bomber", x: 5, y: 1 },
    ],
    3,
    6,
  ),
  M(
    "c1-boss",
    1,
    "boss",
    "拆楼机 · 港",
    "它砸一整列，被砸到的地板立刻进入塌方。超重，一拳只能推一格。借坑、借弹簧、借钩。",
    `
............
............
..#......#..
............
.CCCCCCCCCC.
............
.#........#.
............
............
............
`,
    [{ x: 2, y: 8 }, { x: 6, y: 8 }, { x: 11, y: 8 }],
    [
      { kind: "demo", x: 6, y: 1 },
      { kind: "beetle", x: 1, y: 2 },
      { kind: "beetle", x: 10, y: 2 },
      { kind: "gunner", x: 3, y: 2 },
      { kind: "brute", x: 8, y: 3 },
    ],
    4,
    8,
  ),
  M(
    "c2-1",
    2,
    "fight",
    "激光巷",
    "激光格在回合结束烧一切。把敌人推进去，自己绕开。炮台不会走。",
    `
............
.L........L.
............
.#.L.LL.L.#.
............
...CCCCCC...
............
.L........L.
.#........#.
............
`,
    [{ x: 2, y: 8 }, { x: 6, y: 8 }, { x: 11, y: 8 }],
    [
      { kind: "turret", x: 1, y: 1 },
      { kind: "turret", x: 10, y: 1 },
      { kind: "gunner", x: 4, y: 2 },
      { kind: "brute", x: 7, y: 2 },
      { kind: "leaper", x: 5, y: 1 },
    ],
    3,
    6,
  ),
  M(
    "c2-2",
    2,
    "fight",
    "垂直街",
    "两名炮手锁死通道。路障不能射穿。推开瞄准线，或把挡拆到它们面前当肉盾。",
    `
.#........#.
............
..#......#..
X..........X
C.CCCCCCCC.C
............
............
.#........#.
............
.#........#.
`,
    [{ x: 3, y: 8 }, { x: 6, y: 7 }, { x: 9, y: 8 }],
    [
      { kind: "gunner", x: 2, y: 1 },
      { kind: "gunner", x: 9, y: 1 },
      { kind: "beetle", x: 5, y: 2 },
      { kind: "leaper", x: 6, y: 2 },
      { kind: "brute", x: 4, y: 3 },
    ],
    3,
    6,
  ),
  M(
    "c2-3",
    2,
    "fight",
    "油然",
    "油污会让击退再滑一格。爆虫死会炸开四周。可以当人肉炸弹，也可以把你小队一并掀进坑。",
    `
............
..#......#..
..O......O..
.2........2.
...CCCCCC...
............
.3........3.
............
.#........#.
............
`,
    [{ x: 2, y: 8 }, { x: 6, y: 8 }, { x: 11, y: 8 }],
    [
      { kind: "bomber", x: 1, y: 1 },
      { kind: "bomber", x: 10, y: 1 },
      { kind: "bomber", x: 4, y: 2 },
      { kind: "brute", x: 7, y: 2 },
      { kind: "leaper", x: 5, y: 1 },
    ],
    3,
    6,
  ),
  M(
    "c2-elite",
    2,
    "elite",
    "重锤双人",
    "重锤砸 2×2。别站在同一片红区。把它们互推到对方的落点。",
    `
............
............
.#........#.
............
.CCCCCCCCCC.
............
.#........#.
............
.#........#.
............
`,
    [{ x: 3, y: 8 }, { x: 6, y: 8 }, { x: 9, y: 8 }],
    [
      { kind: "hammer", x: 1, y: 1 },
      { kind: "hammer", x: 10, y: 1 },
      { kind: "beetle", x: 5, y: 2 },
      { kind: "gunner", x: 7, y: 2 },
      { kind: "leaper", x: 3, y: 2 },
    ],
    4,
    7,
  ),
  M(
    "c2-boss",
    2,
    "boss",
    "拆楼机 · 街",
    "激光还在。拆楼机会把整列变成坑。铺路能抢回一拍，钩索能把它拽偏一列。",
    `
.L........L.
............
..#......#..
............
.CCCCCCCCCC.
............
.L........L.
............
.#........#.
............
`,
    [{ x: 2, y: 8 }, { x: 6, y: 8 }, { x: 11, y: 8 }],
    [
      { kind: "demo", x: 5, y: 1 },
      { kind: "gunner", x: 10, y: 2 },
      { kind: "bomber", x: 1, y: 2 },
      { kind: "turret", x: 8, y: 3 },
      { kind: "brute", x: 3, y: 3 },
    ],
    4,
    8,
  ),
  M(
    "c3-1",
    3,
    "fight",
    "镜面站入口",
    "弹簧 + 激光。坑会蔓延。预览会把整条连锁演完，以它为准。",
    `
#..........#
..S......S..
............
.L........L.
.C.CCCCCC.C.
.L........L.
............
#..........#
............
.#........#.
`,
    [{ x: 3, y: 8 }, { x: 6, y: 8 }, { x: 9, y: 8 }],
    [
      { kind: "hammer", x: 2, y: 1 },
      { kind: "gunner", x: 9, y: 1 },
      { kind: "leaper", x: 5, y: 2 },
      { kind: "warden", x: 7, y: 3 },
    ],
    3,
    7,
    { spreading: true },
  ),
  M(
    "c3-elite",
    3,
    "elite",
    "三重锤",
    "三台重锤。先制造互撞，再把活口送进数字格。坑会吃掉落脚点。",
    `
............
.2........2.
............
.#........#.
.CCCCCCCCCC.
............
.3........3.
............
.#........#.
............
`,
    [{ x: 3, y: 8 }, { x: 6, y: 8 }, { x: 9, y: 8 }],
    [
      { kind: "hammer", x: 1, y: 1 },
      { kind: "hammer", x: 10, y: 1 },
      { kind: "hammer", x: 5, y: 2 },
      { kind: "leaper", x: 7, y: 3 },
    ],
    4,
    7,
    { spreading: true },
  ),
  M(
    "c3-2",
    3,
    "fight",
    "窄梁",
    "落脚点很少。补丁的铺路和钩索是这关的武器，铁腕推不动所有人。",
    `
##........##
#..........#
..#......#..
............
#.CCCCCCCC.#
............
#..........#
##........##
............
.#........#.
`,
    [{ x: 3, y: 8 }, { x: 6, y: 5 }, { x: 8, y: 8 }],
    [
      { kind: "gunner", x: 3, y: 1 },
      { kind: "gunner", x: 8, y: 1 },
      { kind: "bomber", x: 5, y: 3 },
      { kind: "turret", x: 1, y: 3 },
      { kind: "warden", x: 10, y: 3 },
    ],
    3,
    7,
    { spreading: true },
  ),
  M(
    "c3-boss",
    3,
    "boss",
    "拆楼机 · 镜",
    "Boss 加两名炮手。先拆瞄准，再处理拆楼机。甲板每一回合都在往外裂。",
    `
.S........S.
............
L#........#L
............
.CCCCCCCCCC.
............
............
.S........S.
............
.#........#.
`,
    [{ x: 3, y: 8 }, { x: 6, y: 8 }, { x: 9, y: 8 }],
    [
      { kind: "demo", x: 6, y: 1 },
      { kind: "gunner", x: 1, y: 3 },
      { kind: "gunner", x: 10, y: 3 },
      { kind: "warden", x: 4, y: 2 },
      { kind: "leaper", x: 8, y: 2 },
    ],
    5,
    9,
    { spreading: true },
  ),
  M(
    "c4-1",
    4,
    "fight",
    "核心外围",
    "全图都在掉。每一回合都要把人从数字格上挪走。超重单位只能一格一格挤。",
    `
.2........2.
............
3..........3
............
.CCCCCCCCCC.
............
.4........4.
............
.#........#.
............
`,
    [{ x: 3, y: 8 }, { x: 6, y: 8 }, { x: 9, y: 8 }],
    [
      { kind: "hammer", x: 2, y: 1 },
      { kind: "gunner", x: 9, y: 1 },
      { kind: "bomber", x: 5, y: 3 },
      { kind: "warden", x: 1, y: 3 },
      { kind: "leaper", x: 10, y: 3 },
    ],
    4,
    7,
    { spreading: true },
  ),
  M(
    "c4-elite",
    4,
    "elite",
    "送葬队列",
    "四只爆虫加一台重锤。引爆顺序决定你是清场还是同归于尽。",
    `
............
.#........#.
............
.L........L.
.CCCCCCCCCC.
............
.#........#.
............
.L........L.
............
`,
    [{ x: 3, y: 8 }, { x: 6, y: 8 }, { x: 9, y: 8 }],
    [
      { kind: "bomber", x: 1, y: 0 },
      { kind: "bomber", x: 10, y: 0 },
      { kind: "bomber", x: 3, y: 2 },
      { kind: "bomber", x: 8, y: 2 },
      { kind: "hammer", x: 5, y: 1 },
      { kind: "warden", x: 6, y: 3 },
    ],
    4,
    7,
    { spreading: true },
  ),
  M(
    "c4-final",
    4,
    "boss",
    "核心拆楼",
    "两台拆楼机。别让它们同时砸核心。这是轨道城的最后一根梁。",
    `
............
S..........S
..#......#..
............
.CCCCCCCCCC.
............
L..........L
............
.#........#.
............
`,
    [{ x: 2, y: 8 }, { x: 6, y: 8 }, { x: 11, y: 8 }],
    [
      { kind: "demo", x: 3, y: 1 },
      { kind: "demo", x: 8, y: 1 },
      { kind: "gunner", x: 5, y: 3 },
      { kind: "warden", x: 10, y: 3 },
      { kind: "turret", x: 1, y: 3 },
      { kind: "leaper", x: 6, y: 2 },
    ],
    5,
    10,
    { spreading: true },
  ),
  ...GENERATED,
];

export const MISSION_BY_ID: Record<string, Mission> = Object.fromEntries(
  MISSIONS.map((m) => [m.id, m]),
);

export const CAMPAIGN: RunNode[] = [
  { type: "fight", missionId: "tut-1" },
  { type: "fight", missionId: "c1-1" },
  { type: "fight", missionId: "c1-2" },
  { type: "fight", missionId: "c1-hold" },
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
  { type: "elite", missionId: "g2-c" },
  { type: "elite", missionId: "c2-elite" },
  { type: "event", eventId: "market" },
  { type: "shop" },
  { type: "boss", missionId: "c2-boss" },
  { type: "fight", missionId: "c3-1" },
  { type: "fight", missionId: "g3-a" },
  { type: "fight", missionId: "g3-b" },
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
  { type: "fight", missionId: "g4-d" },
  { type: "event", eventId: "lastgate" },
  { type: "boss", missionId: "c4-final" },
];
