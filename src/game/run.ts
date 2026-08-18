import { createBattle, defaultPilots, RELICS, UPGRADES, type PilotSave } from "./content";
import { CAMPAIGN, MISSION_BY_ID, type RunNode } from "./missions";
import { pickN, mulberry32 } from "./rng";
import type { Battle, SkillId } from "./types";

export interface RunState {
  seed: number;
  node: number;
  scrap: number;
  relics: string[];
  upgrades: string[];
  pilots: PilotSave[];
  wins: number;
}

export function newRun(seed = Date.now() % 1_000_000): RunState {
  return {
    seed,
    node: 0,
    scrap: 0,
    relics: [],
    upgrades: [],
    pilots: defaultPilots(),
    wins: 0,
  };
}

export function currentNode(run: RunState): RunNode | undefined {
  return CAMPAIGN[run.node];
}

export function unlockedSkills(run: RunState): SkillId[] {
  const s: SkillId[] = [];
  if (run.upgrades.includes("stomp")) s.push("stomp");
  return s;
}

export function applyUpgrade(run: RunState, id: string): void {
  if (run.upgrades.includes(id)) return;
  run.upgrades.push(id);
  const bump = (pilot: PilotSave["id"], key: "maxHp" | "move", n: number) => {
    const p = run.pilots.find((x) => x.id === pilot);
    if (!p) return;
    p[key] += n;
    if (key === "maxHp") p.hp = Math.min(p.maxHp, p.hp + n);
  };
  if (id === "ironhp" || id === "ironhp2") bump("iron", "maxHp", 1);
  if (id === "linehp" || id === "linehp2") bump("line", "maxHp", 1);
  if (id === "patchhp" || id === "patchhp2") bump("patch", "maxHp", 1);
  if (id === "ironmove") bump("iron", "move", 1);
  if (id === "linemove") bump("line", "move", 1);
  if (id === "patchmove") bump("patch", "move", 1);
}

export function startBattle(run: RunState): Battle {
  const node = currentNode(run);
  if (!node?.missionId) throw new Error("当前不是战斗节点");
  const mission = MISSION_BY_ID[node.missionId];
  if (!mission) throw new Error(`缺少关卡 ${node.missionId}`);
  applyRunStats(run);
  return createBattle(mission, run.pilots, run.relics);
}

function applyRunStats(run: RunState): void {
  for (const p of run.pilots) {
    if (p.hp < 1) p.hp = 1;
  }
}

export function afterBattle(run: RunState, battle: Battle): void {
  run.scrap += battle.scrap;
  run.wins += 1;
  for (const p of run.pilots) {
    const live = battle.units.find((u) => u.id === p.id);
    if (live) {
      p.hp = live.hp > 0 ? live.hp : 0;
    }
    p.hp = Math.min(p.maxHp, Math.max(0, p.hp) + 1);
    if (p.hp < 1) p.hp = 1;
  }
}

export function healShop(run: RunState): void {
  for (const p of run.pilots) p.hp = p.maxHp;
}

export function advance(run: RunState): "won" | "next" {
  run.node += 1;
  if (run.node >= CAMPAIGN.length) return "won";
  return "next";
}

export function rewardChoices(run: RunState): string[] {
  const rng = mulberry32(run.seed + run.node * 17 + 91);
  const pool = UPGRADES.filter((u) => !run.upgrades.includes(u.id)).map((u) => u.id);
  return pickN(rng, pool, 3);
}

export function shopChoices(run: RunState): string[] {
  const rng = mulberry32(run.seed + run.node * 31 + 7);
  const pool = RELICS.filter((r) => !run.relics.includes(r.id)).map((r) => r.id);
  return pickN(rng, pool, 3);
}

export function shopCost(run: RunState): number {
  return 6 + run.relics.length * 2;
}

export function buyRelic(run: RunState, id: string): boolean {
  const cost = shopCost(run);
  if (run.scrap < cost) return false;
  if (run.relics.includes(id)) return false;
  if (!RELICS.some((r) => r.id === id)) return false;
  run.scrap -= cost;
  run.relics.push(id);
  return true;
}

export function relicById(id: string) {
  return RELICS.find((r) => r.id === id);
}

export function upgradeById(id: string) {
  return UPGRADES.find((u) => u.id === id);
}

export function chapterOf(run: RunState): number {
  for (let i = run.node; i >= 0; i--) {
    const id = CAMPAIGN[i]?.missionId;
    if (id && MISSION_BY_ID[id]) return MISSION_BY_ID[id].chapter;
  }
  return 1;
}

export interface GameEvent {
  id: string;
  title: string;
  text: string;
  choices: { id: string; label: string; desc: string }[];
}

export const EVENTS: GameEvent[] = [
  {
    id: "repair",
    title: "漂流船坞",
    text: "一间没人的维修舱还亮着灯。你们可以在这里睡一觉，或把能拆的全拆走。",
    choices: [
      { id: "heal", label: "全体回满", desc: "三人生命全部恢复" },
      { id: "scrap", label: "拆空这间舱", desc: "立刻获得 8 废料" },
    ],
  },
  {
    id: "market",
    title: "黑市浮台",
    text: "一个戴焊面罩的人敲了敲柜台。东西不便宜，但不问来历。",
    choices: [
      { id: "buy", label: "花 5 废料买一件遗物", desc: "从剩余遗物里随机一件" },
      { id: "pass", label: "只问路", desc: "获得 3 废料，不买" },
    ],
  },
  {
    id: "lastgate",
    title: "炉心闸门",
    text: "再往前就是两台拆楼机。闸门前有一箱应急物资，也有人在喊着要卖命。",
    choices: [
      { id: "prep", label: "吃掉应急物资", desc: "回满生命，并获得 4 废料" },
      { id: "relic", label: "花 6 废料拿遗物", desc: "随机一件遗物，不回血" },
    ],
  },
];

export function eventById(id: string): GameEvent | undefined {
  return EVENTS.find((e) => e.id === id);
}

export function applyEventChoice(run: RunState, eventId: string, choiceId: string): string {
  const rng = mulberry32(run.seed + run.node * 53 + choiceId.length * 9);
  if (eventId === "repair") {
    if (choiceId === "heal") {
      healShop(run);
      return "生命回满。";
    }
    run.scrap += 8;
    return "废料 +8。";
  }
  if (eventId === "market") {
    if (choiceId === "buy") {
      if (run.scrap < 5) return "废料不够。";
      const pool = RELICS.filter((r) => !run.relics.includes(r.id)).map((r) => r.id);
      const pick = pickN(rng, pool, 1)[0];
      if (!pick) return "没有能买的了。";
      run.scrap -= 5;
      run.relics.push(pick);
      const r = relicById(pick);
      return `买下了 ${r?.name ?? pick}。`;
    }
    run.scrap += 3;
    return "废料 +3。";
  }
  if (eventId === "lastgate") {
    if (choiceId === "prep") {
      healShop(run);
      run.scrap += 4;
      return "回满，废料 +4。";
    }
    if (run.scrap < 6) return "废料不够。";
    const pool = RELICS.filter((r) => !run.relics.includes(r.id)).map((r) => r.id);
    const pick = pickN(rng, pool, 1)[0];
    if (!pick) return "货架空了。";
    run.scrap -= 6;
    run.relics.push(pick);
    return `拿到了 ${relicById(pick)?.name ?? pick}。`;
  }
  return "";
}
