import type { Action, Battle, Pos, SkillId } from "./types";
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
  mode?: "next" | "do" | "end";
  hud?: "struct" | "scrap" | "turn";
}

export type TutPhase =
  | "intro-squad"
  | "intro-core"
  | "intro-red"
  | "intro-scrap"
  | "iron-select"
  | "iron-move"
  | "iron-punch"
  | "line-select"
  | "line-cannon"
  | "patch-select"
  | "patch-pave"
  | "end-turn"
  | "finish";

export function isTutorial(b: Battle | null): boolean {
  return b?.id === "tut-1";
}

/** 铁腕贴到甲虫西侧后再出拳。 */
export const TUT_STAND: Pos = { x: 2, y: 2 };
/** 补丁这一步要铺回的裂口。 */
export const TUT_PAVE: Pos = { x: 1, y: 6 };

const TOTAL = 12;

function coresOf(b: Battle): Pos[] {
  const cores: Pos[] = [];
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (tile(b, x, y)?.core) cores.push({ x, y });
    }
  }
  return cores;
}

function redOf(b: Battle): Pos[] {
  const red: Pos[] = [];
  for (const it of b.intents) {
    for (const t of it.tiles) red.push(t);
  }
  return red;
}

function manh(a: Pos, b: Pos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function hint(
  step: number,
  title: string,
  body: string,
  tiles: Pos[],
  color: CoachHint["color"],
  extra: Partial<CoachHint> = {},
): CoachHint {
  return {
    step,
    total: TOTAL,
    title,
    body,
    tiles,
    color,
    allowEnd: false,
    mode: "do",
    ...extra,
  };
}

export function tutorialPhase(b: Battle, selected: string | null): TutPhase | null {
  if (!isTutorial(b) || b.outcome !== "ongoing") return null;
  const beat = b.tutBeat ?? 0;
  if (beat <= 0) return "intro-squad";
  if (beat === 1) return "intro-core";
  if (beat === 2) return "intro-red";
  if (beat === 3) return "intro-scrap";

  const iron = b.units.find((u) => u.id === "iron" && u.hp > 0);
  const line = b.units.find((u) => u.id === "line" && u.hp > 0);
  const patch = b.units.find((u) => u.id === "patch" && u.hp > 0);
  const beetle = b.units.find((u) => u.team === "enemy" && u.hp > 0);
  if (!iron || !line || !patch || !beetle) return "finish";

  if (!iron.acted) {
    if (selected !== "iron") return "iron-select";
    if (manh(iron, beetle) !== 1) return "iron-move";
    return "iron-punch";
  }
  if (!line.acted) {
    if (selected !== "line") return "line-select";
    return "line-cannon";
  }
  if (!patch.acted) {
    if (selected !== "patch") return "patch-select";
    return "patch-pave";
  }
  if (b.turn <= 1) return "end-turn";
  return "finish";
}

export function advanceTutorial(b: Battle): void {
  const phase = tutorialPhase(b, null);
  if (phase === "intro-squad" || phase === "intro-core" || phase === "intro-red" || phase === "intro-scrap") {
    b.tutBeat = (b.tutBeat ?? 0) + 1;
  }
}

export function tutorialMaySelect(b: Battle, id: string): boolean {
  const phase = tutorialPhase(b, id);
  if (!phase) return true;
  if (phase.startsWith("intro")) return false;
  if (phase.startsWith("iron")) return id === "iron";
  if (phase.startsWith("line")) return id === "line";
  if (phase.startsWith("patch")) return id === "patch";
  return true;
}

export function tutorialDesiredSkill(b: Battle, selected: string | null): SkillId | null {
  const phase = tutorialPhase(b, selected);
  if (phase === "line-cannon") return "cannon";
  if (phase === "patch-pave") return "pave";
  if (phase === "iron-punch") return "punch";
  return null;
}

export function tutorialBlocks(b: Battle, selected: string | null, action: Action): string | null {
  const phase = tutorialPhase(b, selected);
  if (!phase) return null;
  if (phase.startsWith("intro")) return "先看完调度说明。";
  if (action.type === "end") {
    if (phase === "end-turn" || phase === "finish") return null;
    return "三台机甲都还没出完手。";
  }
  if (phase === "end-turn") return "点「结束回合」。红格上的攻击会落地。";
  if (action.type === "move") {
    if (phase === "iron-move" && action.id === "iron" && action.x === TUT_STAND.x && action.y === TUT_STAND.y) {
      return null;
    }
    if (phase === "finish") return null;
    return "这一步还不用换位置。";
  }
  if (action.type === "skill") {
    const beetle = b.units.find((u) => u.team === "enemy" && u.hp > 0);
    if (phase === "iron-punch" && action.id === "iron" && action.skill === "punch" && beetle && action.tx === beetle.x && action.ty === beetle.y) {
      return null;
    }
    if (phase === "line-cannon" && action.id === "line" && action.skill === "cannon" && beetle && action.tx === beetle.x && action.ty === beetle.y) {
      return null;
    }
    if (
      phase === "patch-pave" &&
      action.id === "patch" &&
      action.skill === "pave" &&
      action.tx === TUT_PAVE.x &&
      action.ty === TUT_PAVE.y
    ) {
      return null;
    }
    if (phase === "finish") return null;
    return "按调度出手。";
  }
  return null;
}

export function tutorialCoach(
  b: Battle,
  selected: string | null,
  hover: Pos | null,
): CoachHint | null {
  const phase = tutorialPhase(b, selected);
  if (!phase) return null;
  const iron = b.units.find((u) => u.id === "iron" && u.hp > 0);
  const line = b.units.find((u) => u.id === "line" && u.hp > 0);
  const patch = b.units.find((u) => u.id === "patch" && u.hp > 0);
  const beetle = b.units.find((u) => u.team === "enemy" && u.hp > 0);
  const cores = coresOf(b);
  const red = redOf(b);
  const squad = [iron, line, patch].filter((u): u is NonNullable<typeof u> => !!u).map((u) => ({ x: u.x, y: u.y }));

  if (phase === "intro-squad") {
    return hint(
      1,
      "三人小队",
      "铁腕近战重拳，线炮打直线，补丁钩人铺路。点左侧名单或棋盘上的机甲切换。先看完战场记号。",
      squad,
      "cyan",
      { mode: "next" },
    );
  }
  if (phase === "intro-core") {
    return hint(
      2,
      "舰核和结构",
      "金色两格是舰核。顶栏那一排圆点是结构。敌人打上舰核会掉结构，掉光就失败。全灭同样失败。",
      cores,
      "gold",
      { mode: "next", hud: "struct" },
    );
  }
  if (phase === "intro-red") {
    return hint(
      3,
      "红格是下一击",
      "甲虫已经瞄准。红格是它回合结束时会打的地方。招式写在右侧瞄准里。先别结束回合。",
      red.length ? red : beetle ? [{ x: beetle.x, y: beetle.y }] : [],
      "red",
      { mode: "next" },
    );
  }
  if (phase === "intro-scrap") {
    return hint(
      4,
      "废料",
      "顶栏的废料是战后货币。击杀掉落，用来选改装、去交易所换遗物。打完这一场就会用到。",
      [],
      "gold",
      { mode: "next", hud: "scrap" },
    );
  }
  if (!iron || !line || !patch || !beetle) {
    return hint(12, "接舷结束", "甲壳打穿了。离开战场后选改装，再进交易所。", cores, "gold", {
      mode: "end",
      allowEnd: true,
    });
  }

  if (phase === "iron-select") {
    return hint(5, "呼叫铁腕", "左边青甲、带拳头的是铁腕。点棋盘上的它，或点左侧名单。", [{ x: iron.x, y: iron.y }], "cyan");
  }
  if (phase === "iron-move") {
    const free = !unitAt(b, TUT_STAND.x, TUT_STAND.y);
    const dest = free ? TUT_STAND : { x: beetle.x - 1, y: beetle.y };
    return hint(6, "贴上去", "重拳是近战，2 点伤害，击退只是附带。点青格走到甲虫西侧。", [dest], "cyan");
  }
  if (phase === "iron-punch") {
    const aiming = hover?.x === beetle.x && hover?.y === beetle.y;
    return hint(
      7,
      aiming ? "重拳" : "瞄准甲虫",
      aiming ? "造成 2 点伤害。点它，打断甲壳。它还不会倒。" : "把指针停在甲虫身上，确认伤害，再出手。",
      [{ x: beetle.x, y: beetle.y }],
      "gold",
    );
  }
  if (phase === "line-select") {
    return hint(
      8,
      "换线炮",
      "铁腕这回合打过了。点线炮。它打直线上的第一个目标，深渊挡不住炮弹，路障会挡住。",
      [{ x: line.x, y: line.y }],
      "cyan",
    );
  }
  if (phase === "line-cannon") {
    return hint(
      9,
      "线炮",
      "点甲虫开炮，2 点伤害。炮弹会飞过深渊。打完换补丁。",
      [{ x: beetle.x, y: beetle.y }],
      "gold",
    );
  }
  if (phase === "patch-select") {
    return hint(
      10,
      "换补丁",
      "补丁有两手：钩索拉近并造成伤害，铺路把坑铺回甲板。这一步先铺裂口。",
      [{ x: patch.x, y: patch.y }, TUT_PAVE],
      "cyan",
    );
  }
  if (phase === "patch-pave") {
    return hint(
      11,
      "铺路",
      "点黄格里的裂口，把坑铺回来。钩索以后自己找直线用：拉人、补伤害。",
      [TUT_PAVE],
      "void",
    );
  }
  if (phase === "end-turn") {
    return hint(
      12,
      "结束回合",
      "三人这一回合都出过手了。空格或点「结束回合」。敌人按红格攻击，然后走动。顶栏回合数会 +1。",
      red,
      "red",
      { mode: "end", allowEnd: true, hud: "turn" },
    );
  }
  return hint(
    12,
    "收尾",
    "红格已经结算过了。继续打，打穿甲壳。打完用废料选改装，下一站是交易所。",
    beetle ? [{ x: beetle.x, y: beetle.y }] : cores,
    "gold",
    { mode: "end", allowEnd: true },
  );
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
    mode: "end",
  };
}
