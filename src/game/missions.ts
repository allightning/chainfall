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
  enemies: { kind: EnemyKind; x: number; y: number; hp?: number }[];
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
    "港区接舷",
    "一号坞的甲虫破开了密封。先看舰核和结构，再让铁腕、线炮、补丁各出一手，然后结束回合。",
    `
........
........
........
........
....#...
........
.#......
........
`,
    [{ x: 1, y: 3 }, { x: 4, y: 7 }, { x: 1, y: 7 }],
    [{ kind: "beetle", x: 3, y: 2, hp: 6 }],
    6,
    8,
  ),
  M(
    "c1-1",
    1,
    "fight",
    "码头缺口",
    "两侧甲虫同时咬向舰核。重兵会横扫三格。传送带在回合结束带走站在上面的人。",
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
    4,
    7,
  ),
  M(
    "c1-2",
    1,
    "fight",
    "将塌甲板",
    "数字格会在那一回合结束掉下去。维修垫能接合伤势。别让舰核先塌。",
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
    "不必清场。守住舰核撑过时限即可撤离。路障能挡住炮手的直线。",
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
    "两路重兵夹着舰核。传送带会在回合结束改写站位。对撞会双方受伤。",
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
    "弹簧会让击退多飞一格。爆虫在红区内殉爆。蚀刻虫会在甲板上留下持续灼烧。",
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
      { kind: "etcher", x: 10, y: 1 },
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
    "拆楼机打出五格切割梁，被打中的地板会塌。它超重，打得动但很难挪。先拆炮手，再打梁。",
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
    "激光格在回合结束烧一切。炮台不会走。跃虫一回合跨两格。",
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
    "穿甲手的射线穿过整条通道。路障不能射穿。重兵在近处横扫。",
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
      { kind: "sniper", x: 9, y: 1 },
      { kind: "grappler", x: 5, y: 2 },
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
    "油污会让击退再滑一格。爆虫死会炸开四周。绞手会把人拽进红区。",
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
      { kind: "grappler", x: 4, y: 2 },
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
    "重锤砸 2×2。冲车会把人撞开。别站在同一片红区。",
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
      { kind: "bully", x: 5, y: 2 },
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
    "激光还在。拆楼机打出五格切割梁，被打中的地板会塌。铺路能抢回一拍。",
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
      { kind: "mortar", x: 10, y: 2 },
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
    "弹簧和激光同时在。坑会往外裂。监卫的下一击会压制机甲一整回合。",
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
      { kind: "mortar", x: 9, y: 1 },
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
    "三台重锤。落点重叠时会把甲板砸穿。坑会吃掉落脚点。",
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
    "落脚点很少。铺路抢回甲板，钩索改写站位。孵母会往场上补幼虫。",
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
      { kind: "sniper", x: 3, y: 1 },
      { kind: "gunner", x: 8, y: 1 },
      { kind: "brood", x: 5, y: 3 },
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
    "拆楼机带切割梁，两侧还有炮手。甲板每一回合都在往外裂。",
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
    "两台拆楼机。别让两道切割梁同时打上舰核。这是轨道城的最后一根梁。",
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
      { kind: "mortar", x: 5, y: 3 },
      { kind: "warden", x: 10, y: 3 },
      { kind: "brood", x: 1, y: 3 },
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
