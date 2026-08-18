import type { Battle, Pos } from "./types";
import { tile, unitAt } from "./grid";

export interface CoachHint {
  step: number;
  total: number;
  title: string;
  body: string;
  tiles: Pos[];
  color: "cyan" | "gold" | "red" | "void";
  allowEnd: boolean;
  dismissOnly?: boolean;
}

export function isTutorial(b: Battle | null): boolean {
  return b?.id === "tut-1";
}

export const TUT_STAND: Pos = { x: 1, y: 1 };
export const TUT_PIT: Pos = { x: 4, y: 1 };

function coresOf(b: Battle): Pos[] {
  const cores: Pos[] = [];
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (tile(b, x, y)?.core) cores.push({ x, y });
    }
  }
  return cores;
}

export function tutorialCoach(
  b: Battle,
  selected: string | null,
  hover: Pos | null,
): CoachHint | null {
  if (!isTutorial(b)) return null;
  const iron = b.units.find((u) => u.id === "iron" && u.hp > 0);
  const beetle = b.units.find((u) => u.team === "enemy" && u.hp > 0);
  const cores = coresOf(b);
  const red: Pos[] = [];
  for (const it of b.intents) {
    for (const t of it.tiles) red.push(t);
  }

  if (!beetle) {
    return {
      step: 7,
      total: 7,
      title: "漂亮",
      body: "金色舰核要保护，红格别站，黑洞能吞人。后面每场都一样，鼠标悬停格子就能读说明。",
      tiles: cores,
      color: "gold",
      allowEnd: true,
    };
  }
  if (!iron) {
    return {
      step: 1,
      total: 7,
      title: "铁腕倒下了",
      body: "用线炮或补丁把甲虫推进旁边的黑洞。点敌人就会出手。",
      tiles: [{ x: beetle.x, y: beetle.y }, TUT_PIT],
      color: "gold",
      allowEnd: true,
    };
  }

  const adj = Math.abs(iron.x - beetle.x) + Math.abs(iron.y - beetle.y) === 1;
  const onStand = iron.x === TUT_STAND.x && iron.y === TUT_STAND.y;
  const hoveringBeetle = hover?.x === beetle.x && hover?.y === beetle.y;
  const selectedIron = selected === "iron";

  if (!selectedIron) {
    return {
      step: 1,
      total: 7,
      title: "先点铁腕",
      body: "左边青甲、带大拳头的是铁腕。点棋盘上的它，或点左侧名单。",
      tiles: [{ x: iron.x, y: iron.y }],
      color: "cyan",
      allowEnd: false,
    };
  }

  if (!iron.moved && !adj) {
    const standFree = !unitAt(b, TUT_STAND.x, TUT_STAND.y);
    const dest = standFree ? TUT_STAND : { x: beetle.x, y: beetle.y + 1 };
    return {
      step: 2,
      total: 7,
      title: "走到甲虫旁边",
      body: "中间那排金色是舰核，被打会掉顶部结构条。青格是能走的位置。点「点这里」那一格，站到甲虫西侧。别踩红格。",
      tiles: [dest, ...cores],
      color: "cyan",
      allowEnd: false,
    };
  }

  if (!iron.acted && (adj || onStand)) {
    if (hoveringBeetle) {
      return {
        step: 4,
        total: 7,
        title: "预览就是结果",
        body: "半透明残影是它会被推到的地方。现在点甲虫，把它推进黑洞。",
        tiles: [{ x: beetle.x, y: beetle.y }, TUT_PIT],
        color: "gold",
        allowEnd: false,
      };
    }
    return {
      step: 3,
      total: 7,
      title: "把鼠标停在甲虫上",
      body: "先别点。悬停时会看到它飞进坑里。击退就是伤害。",
      tiles: [{ x: beetle.x, y: beetle.y }, TUT_PIT],
      color: "gold",
      allowEnd: false,
    };
  }

  if (iron.acted && beetle.hp > 0) {
    return {
      step: 5,
      total: 7,
      title: "还能动手",
      body: "铁腕这回合已经打过了。换线炮点甲虫，或点「结束回合」。",
      tiles: red.length ? red : [{ x: beetle.x, y: beetle.y }],
      color: "red",
      allowEnd: true,
    };
  }

  return {
    step: 6,
    total: 7,
    title: "结束回合",
    body: "空格或点「结束回合」。敌人会按红格攻击。这关打掉甲虫就会过。",
    tiles: red,
    color: "red",
    allowEnd: true,
  };
}

export function fieldCoach(b: Battle, dismissed: boolean): CoachHint | null {
  if (dismissed || isTutorial(b)) return null;
  if (b.id !== "c1-1") return null;
  const cores = coresOf(b);
  return {
    step: 1,
    total: 1,
    title: "先认三样东西",
    body: "金色一排是舰核：被打就掉顶部结构条，掉光就失败。红格是敌人下一击。黑洞是深渊。箭头格是传送带，回合结束会把人送走。把鼠标放到任何格子上，右边会说明它是什么。",
    tiles: cores,
    color: "gold",
    allowEnd: true,
    dismissOnly: true,
  };
}
