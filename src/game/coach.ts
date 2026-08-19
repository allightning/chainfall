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
      step: 6,
      total: 6,
      title: "甲壳打穿了",
      body: "金色舰核在小队前方，被打会掉结构。红格是敌人下一击。深渊能吞人，但伤害才是正路。",
      tiles: cores,
      color: "gold",
      allowEnd: true,
    };
  }
  if (!iron) {
    return {
      step: 1,
      total: 6,
      title: "铁腕倒下了",
      body: "换线炮点射，或让补丁钩过去补伤害。",
      tiles: [{ x: beetle.x, y: beetle.y }],
      color: "gold",
      allowEnd: true,
    };
  }

  const adj = Math.abs(iron.x - beetle.x) + Math.abs(iron.y - beetle.y) === 1;
  const selectedIron = selected === "iron";

  if (!selectedIron) {
    return {
      step: 1,
      total: 6,
      title: "呼叫铁腕",
      body: "左边青甲、带拳头的是铁腕。点棋盘上的它，或点左侧名单。",
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
      total: 6,
      title: "贴上去",
      body: "重拳是近战。点青格走到甲虫西侧。金色舰核在小队前方，别让它咬到。",
      tiles: [dest, ...cores],
      color: "cyan",
      allowEnd: false,
    };
  }

  if (!iron.acted && adj) {
    if (hover?.x === beetle.x && hover?.y === beetle.y) {
      return {
        step: 4,
        total: 6,
        title: "重拳",
        body: "造成 2 点伤害。击退只是附带。点它，打穿甲壳。",
        tiles: [{ x: beetle.x, y: beetle.y }],
        color: "gold",
        allowEnd: false,
      };
    }
    return {
      step: 3,
      total: 6,
      title: "瞄准甲虫",
      body: "把指针停在它身上，确认伤害，再出手。",
      tiles: [{ x: beetle.x, y: beetle.y }],
      color: "gold",
      allowEnd: false,
    };
  }

  if (iron.acted && beetle.hp > 0) {
    return {
      step: 5,
      total: 6,
      title: "换人",
      body: "铁腕这回合已经打过了。线炮可以补枪，或者结束回合。",
      tiles: red.length ? red : [{ x: beetle.x, y: beetle.y }],
      color: "red",
      allowEnd: true,
    };
  }

  return {
    step: 6,
    total: 6,
    title: "结束回合",
    body: "空格或点「结束回合」。敌人会按红格攻击。",
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
    title: "战场记号",
    body: "金色舰核在小队前方：被打就掉结构。红格是敌人下一击，招式写在右侧瞄准里。深渊会吞人。箭头格是传送带。",
    tiles: cores,
    color: "gold",
    allowEnd: true,
    dismissOnly: true,
  };
}
