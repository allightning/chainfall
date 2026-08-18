import type { EnemyKind } from "./types";
import { mulberry32 } from "./rng";

type Mission = {
  id: string;
  chapter: number;
  kind: "fight" | "elite" | "boss";
  title: string;
  briefing: string;
  map: string;
  pilots: { x: number; y: number }[];
  enemies: { kind: EnemyKind; x: number; y: number }[];
  structure: number;
  maxTurns: number;
  objective?: "kill" | "hold";
  spreading?: boolean;
};

const T1 = `
............
..#......#..
............
....CCCC....
....CCCC....
............
..#......#..
............
.#........#.
............
`;

const T2 = `
#..........#
..S......S..
............
.L.CCCCCC.L.
............
..#......#..
............
#..........#
..#......#..
............
`;

const T3 = `
..#......#..
2..........2
............
.C.CCCCCC.C.
............
....LLLL....
3..........3
..#......#..
............
.#........#.
`;

const T4 = `
............
.#........#.
..S......S..
....CCCC....
....CCCC....
..#......#..
............
.#........#.
............
.#........#.
`;

function rowsOf(map: string): string[] {
  return map
    .trim()
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);
}

function pick<T>(rng: () => number, list: T[], n: number): T[] {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy.slice(0, n);
}

function gen(
  id: string,
  chapter: number,
  kind: "fight" | "elite" | "boss",
  title: string,
  briefing: string,
  map: string,
  roster: EnemyKind[],
  seed: number,
  structure = 5,
  maxTurns = 8,
): Mission {
  const rows = rowsOf(map);
  const h = rows.length;
  const w = rows[0].length;
  const rng = mulberry32(seed);
  const floors: { x: number; y: number }[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch !== "#") floors.push({ x, y });
    }
  }
  const bottom = floors.filter((p) => p.y >= h - 3);
  const top = floors.filter((p) => p.y <= Math.floor(h * 0.45));
  const pilots = pick(rng, bottom, 3).sort((a, b) => a.x - b.x);
  const spots = pick(rng, top, roster.length);
  const enemies = roster.map((ek, i) => ({
    kind: ek,
    x: spots[i]?.x ?? i + 1,
    y: spots[i]?.y ?? 1,
  }));
  const used = new Set(pilots.map((p) => `${p.x},${p.y}`));
  for (const e of enemies) {
    let guard = 0;
    while (used.has(`${e.x},${e.y}`) && guard++ < 20) {
      const alt = floors[Math.floor(rng() * floors.length)];
      e.x = alt.x;
      e.y = alt.y;
    }
    used.add(`${e.x},${e.y}`);
  }
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
    objective: "kill" as const,
    spreading: chapter >= 3,
  };
}

export const GENERATED: Mission[] = [
  gen("g2-a", 2, "fight", "锈轨夹道", "炮台不会走。绕开射线，再把它推进坑。", T2, ["turret", "beetle", "gunner", "brute"], 1101, 4, 7),
  gen("g2-b", 2, "fight", "跃虫潮", "跃虫一回合走两格。先推，再铺，再钩。", T1, ["leaper", "leaper", "brute", "gunner"], 1102, 4, 7),
  gen("g2-c", 2, "elite", "监卫到岗", "监卫血厚体重。用互撞、将塌格和钩索磨死它。", T4, ["warden", "gunner", "beetle", "leaper"], 1103, 4, 8),
  gen("g3-a", 3, "fight", "镜雨", "弹簧和激光同时在。以预览为准。", T2, ["leaper", "gunner", "hammer", "bomber"], 2201, 4, 7),
  gen("g3-b", 3, "fight", "静默炮廊", "两座炮台锁死通道。钩索是钥匙。", T3, ["turret", "turret", "bomber", "warden"], 2202, 4, 8),
  gen("g3-c", 3, "elite", "监卫双人", "两个监卫。不要正面对殴。", T4, ["warden", "warden", "leaper", "gunner"], 2203, 5, 8),
  gen("g4-a", 4, "fight", "炉前台阶", "数字格很多。每一回合都要给人挪窝。", T3, ["hammer", "turret", "bomber", "leaper", "brute"], 3301, 4, 7),
  gen("g4-b", 4, "fight", "送葬加强", "爆虫加跃虫。引爆顺序就是这关。", T1, ["bomber", "bomber", "leaper", "warden"], 3302, 4, 7),
  gen("g4-c", 4, "elite", "炉心卫队", "拆楼机还没到，先过这关。", T2, ["warden", "hammer", "gunner", "turret"], 3303, 5, 8),
  gen("g4-d", 4, "fight", "最后的梁", "落脚点极少。铺路、钩、推，三个人都要用。", T4, ["leaper", "turret", "bomber", "brute", "warden"], 3304, 4, 7),
];
