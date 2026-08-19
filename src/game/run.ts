import { createBattle, defaultPilots, RELICS, UPGRADES, type PilotSave, type Upgrade } from "./content";
import { MISSION_BY_ID } from "./missions";
import { pickN, mulberry32 } from "./rng";
import type { Battle, SkillId } from "./types";

export interface RunOffer {
  type: "fight" | "elite" | "boss" | "shop" | "event";
  missionId?: string;
  eventId?: string;
  title: string;
  blurb: string;
}

export interface RunState {
  seed: number;
  chapter: number;
  tut: boolean;
  introShop: boolean;
  fightsDone: number;
  elitesDone: number;
  shopsDone: number;
  eventsDone: number;
  usedMissions: string[];
  usedEvents: string[];
  offers: RunOffer[];
  current: RunOffer | null;
  scrap: number;
  relics: string[];
  upgrades: string[];
  pilots: PilotSave[];
  wins: number;
}

interface ChapterNeed {
  fights: number;
  elites: number;
  shops: number;
  events: number;
  boss: string;
  fightPool: string[];
  elitePool: string[];
  eventPool: string[];
}

const CHAPTER_NEED: ChapterNeed[] = [
  {
    fights: 3,
    elites: 0,
    shops: 1,
    events: 1,
    boss: "c1-boss",
    fightPool: ["c1-1", "c1-2", "c1-hold", "c1-3", "c1-4"],
    elitePool: [],
    eventPool: ["repair", "wreck", "cache"],
  },
  {
    fights: 3,
    elites: 1,
    shops: 1,
    events: 1,
    boss: "c2-boss",
    fightPool: ["c2-1", "c2-2", "c2-3", "g2-a", "g2-b"],
    elitePool: ["c2-elite", "g2-c"],
    eventPool: ["market", "deserter", "forge"],
  },
  {
    fights: 3,
    elites: 1,
    shops: 1,
    events: 1,
    boss: "c3-boss",
    fightPool: ["c3-1", "c3-2", "g3-a", "g3-b"],
    elitePool: ["c3-elite", "g3-c"],
    eventPool: ["storm", "shrine", "market"],
  },
  {
    fights: 2,
    elites: 1,
    shops: 1,
    events: 1,
    boss: "c4-final",
    fightPool: ["c4-1", "g4-a", "g4-b", "g4-d"],
    elitePool: ["c4-elite", "g4-c"],
    eventPool: ["lastgate", "forge", "wreck"],
  },
];

export function newRun(seed = Date.now() % 1_000_000): RunState {
  return {
    seed,
    chapter: 1,
    tut: true,
    introShop: false,
    fightsDone: 0,
    elitesDone: 0,
    shopsDone: 0,
    eventsDone: 0,
    usedMissions: [],
    usedEvents: [],
    offers: [],
    current: null,
    scrap: 0,
    relics: [],
    upgrades: [],
    pilots: defaultPilots(),
    wins: 0,
  };
}

export function startMain(run: RunState): void {
  run.tut = false;
  run.introShop = false;
  run.current = null;
  fillOffers(run);
}

function spec(run: RunState): ChapterNeed {
  return CHAPTER_NEED[Math.max(0, Math.min(3, run.chapter - 1))];
}

function missionOffer(id: string, type: RunOffer["type"]): RunOffer {
  const m = MISSION_BY_ID[id];
  return {
    type,
    missionId: id,
    title: m?.title ?? id,
    blurb: m?.briefing ?? "",
  };
}

export function fillOffers(run: RunState): void {
  if (run.tut) {
    run.offers = [missionOffer("tut-1", "fight")];
    return;
  }
  const need = spec(run);
  if (run.chapter === 1 && run.fightsDone === 0 && !run.usedMissions.includes("c1-1")) {
    run.offers = [missionOffer("c1-1", "fight")];
    return;
  }
  const rng = mulberry32(run.seed + run.chapter * 97 + run.wins * 13 + run.fightsDone * 7);
  const unused = (pool: string[]) => pool.filter((id) => !run.usedMissions.includes(id) && MISSION_BY_ID[id]);
  const offers: RunOffer[] = [];

  const fightsLeft = need.fights - run.fightsDone;
  const elitesLeft = need.elites - run.elitesDone;
  const shopsLeft = need.shops - run.shopsDone;
  const eventsLeft = need.events - run.eventsDone;
  const chapterClear = fightsLeft <= 0 && elitesLeft <= 0 && shopsLeft <= 0 && eventsLeft <= 0;

  if (chapterClear) {
    run.offers = [missionOffer(need.boss, "boss")];
    return;
  }

  if (fightsLeft > 0) {
    const pool = unused(need.fightPool);
    for (const id of pickN(rng, pool, Math.min(2, pool.length, fightsLeft))) {
      offers.push(missionOffer(id, "fight"));
    }
  }
  if (elitesLeft > 0 && offers.length < 3) {
    const pool = unused(need.elitePool);
    const id = pickN(rng, pool, 1)[0];
    if (id) offers.push(missionOffer(id, "elite"));
  }
  const unlockedSide = run.chapter > 1 || run.fightsDone >= 2;
  if (unlockedSide && shopsLeft > 0 && offers.length < 3) {
    offers.push({
      type: "shop",
      title: "废料交易所",
      blurb: "用战场拆下来的东西换改装件。维修要另付钱。",
    });
  }
  if (unlockedSide && eventsLeft > 0 && offers.length < 3) {
    const pool = need.eventPool.filter((id) => !run.usedEvents.includes(id));
    const id = pickN(rng, pool.length ? pool : need.eventPool, 1)[0];
    if (id) {
      const ev = eventById(id);
      offers.push({
        type: "event",
        eventId: id,
        title: ev?.title ?? "未知信号",
        blurb: ev?.text ?? "",
      });
    }
  }
  if (offers.length === 0) {
    run.offers = [missionOffer(need.boss, "boss")];
    return;
  }
  run.offers = offers;
}

export function selectOffer(run: RunState, offer: RunOffer): void {
  run.current = offer;
}

export function currentNode(run: RunState): RunOffer | null {
  return run.current;
}

export function unlockedSkills(run: RunState): SkillId[] {
  const s: SkillId[] = [];
  if (run.upgrades.includes("stomp")) s.push("stomp");
  return s;
}

export function applyUpgrade(run: RunState, id: string): void {
  if (id === "fieldmed") {
    for (const p of run.pilots) p.hp = Math.min(p.maxHp, p.hp + 2);
    return;
  }
  if (run.upgrades.includes(id)) return;
  run.upgrades.push(id);
  const bump = (pilot: PilotSave["id"], key: "maxHp" | "move", n: number) => {
    const p = run.pilots.find((x) => x.id === pilot);
    if (!p) return;
    p[key] += n;
    if (key === "maxHp") p.hp = Math.min(p.maxHp, p.hp + n);
  };
  if (id === "ironhp") bump("iron", "maxHp", 2);
  if (id === "linehp") bump("line", "maxHp", 2);
  if (id === "patchhp") bump("patch", "maxHp", 2);
  if (id === "ironmove") bump("iron", "move", 1);
  if (id === "linemove") bump("line", "move", 1);
  if (id === "patchmove") bump("patch", "move", 1);
}

export function startBattle(run: RunState): Battle {
  const node = run.current;
  if (!node?.missionId) throw new Error("当前不是战斗节点");
  const mission = MISSION_BY_ID[node.missionId];
  if (!mission) throw new Error(`缺少关卡 ${node.missionId}`);
  for (const p of run.pilots) {
    if (p.hp < 0) p.hp = 0;
  }
  return createBattle(mission, run.pilots, run.relics, run.upgrades);
}

export function afterBattle(run: RunState, battle: Battle): void {
  run.scrap += battle.scrap;
  if (run.tut && battle.id === "tut-1") run.scrap += 10;
  run.wins += 1;
  for (const p of run.pilots) {
    const live = battle.units.find((u) => u.id === p.id);
    if (live) p.hp = live.hp > 0 ? live.hp : 0;
  }
}

export function healShop(run: RunState): void {
  for (const p of run.pilots) p.hp = p.maxHp;
}

export function buyRepair(run: RunState, cost = 8): boolean {
  if (run.scrap < cost) return false;
  run.scrap -= cost;
  healShop(run);
  return true;
}

export function completeCurrent(run: RunState): "won" | "next" {
  const cur = run.current;
  if (cur) {
    if (run.tut && cur.missionId === "tut-1") {
      run.tut = false;
      run.introShop = true;
      run.current = null;
      run.offers = [
        {
          type: "shop",
          title: "废料交易所",
          blurb: "接舷拆下的零件可以换改装。买一件带走，或先离开。",
        },
      ];
      return "next";
    }
    if (run.introShop && cur.type === "shop") {
      run.introShop = false;
      run.current = null;
      fillOffers(run);
      return "next";
    }
    if (cur.type === "fight" && cur.missionId) {
      run.fightsDone += 1;
      run.usedMissions.push(cur.missionId);
    } else if (cur.type === "elite" && cur.missionId) {
      run.elitesDone += 1;
      run.usedMissions.push(cur.missionId);
    } else if (cur.type === "boss" && cur.missionId) {
      run.usedMissions.push(cur.missionId);
      if (run.chapter >= 4) {
        run.current = null;
        run.offers = [];
        return "won";
      }
      run.chapter += 1;
      run.fightsDone = 0;
      run.elitesDone = 0;
      run.shopsDone = 0;
      run.eventsDone = 0;
    } else if (cur.type === "shop") {
      run.shopsDone += 1;
    } else if (cur.type === "event" && cur.eventId) {
      run.eventsDone += 1;
      run.usedEvents.push(cur.eventId);
    }
  }
  run.current = null;
  fillOffers(run);
  return "next";
}

/** 兼容旧调用名 */
export function advance(run: RunState): "won" | "next" {
  return completeCurrent(run);
}

export type RewardPick = { kind: "upgrade" | "relic"; id: string };

function availableUpgrades(run: RunState, kind?: Upgrade["kind"]): Upgrade[] {
  return UPGRADES.filter((u) => {
    if (kind && u.kind !== kind) return false;
    if (u.id === "fieldmed") return true;
    return !run.upgrades.includes(u.id);
  });
}

export function rewardChoices(run: RunState): RewardPick[] {
  const rng = mulberry32(run.seed + run.wins * 17 + 91);
  const combos = availableUpgrades(run, "combo").map((u) => ({ kind: "upgrade" as const, id: u.id }));
  const mechs = availableUpgrades(run, "mech").map((u) => ({ kind: "upgrade" as const, id: u.id }));
  const stats = availableUpgrades(run, "stat").map((u) => ({ kind: "upgrade" as const, id: u.id }));
  const relics = RELICS.filter((r) => !run.relics.includes(r.id)).map((r) => ({
    kind: "relic" as const,
    id: r.id,
  }));
  const out: RewardPick[] = [];
  const taken = new Set<string>();
  const add = (pick: RewardPick | undefined) => {
    if (!pick) return;
    const key = `${pick.kind}:${pick.id}`;
    if (taken.has(key)) return;
    taken.add(key);
    out.push(pick);
  };
  add(pickN(rng, combos, 1)[0]);
  add(pickN(rng, mechs, 1)[0]);
  const filler = [...combos, ...mechs, ...stats, ...relics];
  for (const pick of pickN(rng, filler, filler.length)) {
    if (out.length >= 3) break;
    add(pick);
  }
  return out;
}

export function shopChoices(run: RunState): string[] {
  const rng = mulberry32(run.seed + run.chapter * 31 + run.relics.length * 9 + 7);
  const pool = RELICS.filter((r) => !run.relics.includes(r.id)).map((r) => r.id);
  return pickN(rng, pool, 5);
}

export function shopCost(run: RunState): number {
  return 8 + run.relics.length * 3;
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
  return run.chapter;
}

export function chapterProgress(run: RunState): { now: number; max: number } {
  const need = spec(run);
  const max = need.fights + need.elites + need.shops + need.events + 1;
  const now = run.fightsDone + run.elitesDone + run.shopsDone + run.eventsDone + (run.current?.type === "boss" ? 1 : 0);
  return { now, max };
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
    text: "一间没人的维修舱还亮着灯。冷却液还没冻住，工具墙上空了一半。",
    choices: [
      { id: "heal", label: "占用床位", desc: "全体生命回满" },
      { id: "scrap", label: "拆空这间舱", desc: "立刻获得 8 废料，不维修" },
    ],
  },
  {
    id: "market",
    title: "黑市浮台",
    text: "戴焊面罩的人敲了敲柜台。货按斤称，不问来历。",
    choices: [
      { id: "buy", label: "花 6 废料拿货", desc: "从剩余遗物里随机一件" },
      { id: "pass", label: "只问路", desc: "获得 3 废料" },
    ],
  },
  {
    id: "lastgate",
    title: "炉心闸门",
    text: "再往前就是拆楼机的作业半径。闸门旁堆着应急箱，也有人在喊价卖命。",
    choices: [
      { id: "prep", label: "打开应急箱", desc: "生命回满，并获得 4 废料" },
      { id: "relic", label: "花 8 废料拿改装", desc: "随机一件遗物，不回血" },
    ],
  },
  {
    id: "wreck",
    title: "断裂桥段",
    text: "半截走廊还挂在真空里。里面有热源，也有可能只是泄漏的反应剂。",
    choices: [
      { id: "search", label: "搜残骸", desc: "随机一件遗物，全队各受伤 1 点" },
      { id: "bypass", label: "绕开", desc: "获得 5 废料" },
    ],
  },
  {
    id: "cache",
    title: "密封货柜",
    text: "条码已经烧糊了。气压表还在跳。",
    choices: [
      { id: "open", label: "破封", desc: "随机：10 废料，或一件遗物" },
      { id: "mark", label: "做标记离开", desc: "获得 4 废料" },
    ],
  },
  {
    id: "deserter",
    title: "逃兵频道",
    text: "有人用公共频段喊：用零件换一条活路。声音很近，也可能是诱饵。",
    choices: [
      { id: "trade", label: "交出 7 废料", desc: "随机一件遗物" },
      { id: "ignore", label: "切断频道", desc: "无事发生" },
    ],
  },
  {
    id: "forge",
    title: "过热锻台",
    text: "还在工作的冲压机。可以把拳套再压紧一档，机师得挨着热浪。",
    choices: [
      { id: "punch", label: "加压铁腕", desc: "重拳伤害 +1，铁腕受伤 1 点" },
      { id: "leave", label: "关掉电源", desc: "获得 6 废料" },
    ],
  },
  {
    id: "storm",
    title: "碎片雨",
    text: "上层街区正在剥落。可以冲过去抢时间，也可以躲进梁下。",
    choices: [
      { id: "rush", label: "抢时间", desc: "下一场战斗限时 +1，全队各受伤 1 点" },
      { id: "hide", label: "躲进梁下", desc: "回复伤势最重的机甲 2 点生命" },
    ],
  },
  {
    id: "shrine",
    title: "弃用神龛",
    text: "旧教的应急祭坛，底下藏着结构加固件。有人在上面刻过名字。",
    choices: [
      { id: "stand", label: "装上支柱", desc: "获得「最后支柱」" },
      { id: "loot", label: "只取废料", desc: "获得 8 废料" },
    ],
  },
];

export function eventById(id: string): GameEvent | undefined {
  return EVENTS.find((e) => e.id === id);
}

function giveRandomRelic(run: RunState, rng: () => number): string {
  const pool = RELICS.filter((r) => !run.relics.includes(r.id)).map((r) => r.id);
  const pick = pickN(rng, pool, 1)[0];
  if (!pick) return "";
  run.relics.push(pick);
  return relicById(pick)?.name ?? pick;
}

function hurtAll(run: RunState, n: number): void {
  for (const p of run.pilots) p.hp = Math.max(0, p.hp - n);
}

export function applyEventChoice(run: RunState, eventId: string, choiceId: string): string {
  const rng = mulberry32(run.seed + run.wins * 53 + choiceId.length * 9 + eventId.length);
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
      if (run.scrap < 6) return "废料不够。";
      const name = giveRandomRelic(run, rng);
      if (!name) return "没有能买的了。";
      run.scrap -= 6;
      return `拿下了 ${name}。`;
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
    if (run.scrap < 8) return "废料不够。";
    const name = giveRandomRelic(run, rng);
    if (!name) return "货架空了。";
    run.scrap -= 8;
    return `拿到了 ${name}。`;
  }
  if (eventId === "wreck") {
    if (choiceId === "search") {
      hurtAll(run, 1);
      const name = giveRandomRelic(run, rng);
      return name ? `搜到 ${name}。全队各受伤 1 点。` : "什么也没有，全队各受伤 1 点。";
    }
    run.scrap += 5;
    return "废料 +5。";
  }
  if (eventId === "cache") {
    if (choiceId === "open") {
      if (rng() < 0.5) {
        run.scrap += 10;
        return "货柜里是零件。废料 +10。";
      }
      const name = giveRandomRelic(run, rng);
      return name ? `货柜里是 ${name}。` : "空柜。";
    }
    run.scrap += 4;
    return "废料 +4。";
  }
  if (eventId === "deserter") {
    if (choiceId === "trade") {
      if (run.scrap < 7) return "废料不够。";
      const name = giveRandomRelic(run, rng);
      if (!name) return "对方已经跑了。";
      run.scrap -= 7;
      return `换到了 ${name}。`;
    }
    return "频道切断。";
  }
  if (eventId === "forge") {
    if (choiceId === "punch") {
      const iron = run.pilots.find((p) => p.id === "iron");
      if (iron) iron.hp = Math.max(0, iron.hp - 1);
      if (!run.upgrades.includes("ironfist")) applyUpgrade(run, "ironfist");
      else applyUpgrade(run, "ironfist2");
      return "铁腕拳套加压完成。";
    }
    run.scrap += 6;
    return "废料 +6。";
  }
  if (eventId === "storm") {
    if (choiceId === "rush") {
      hurtAll(run, 1);
      if (!run.relics.includes("clock")) run.relics.push("clock");
      return "抢到了时间。全队各受伤 1 点。";
    }
    const hurt = run.pilots.filter((p) => p.hp < p.maxHp).sort((a, b) => a.hp - b.hp)[0];
    if (hurt) hurt.hp = Math.min(hurt.maxHp, hurt.hp + 2);
    return hurt ? `${hurt.id === "iron" ? "铁腕" : hurt.id === "line" ? "线炮" : "补丁"} 接合了 2 点。` : "没有人需要接合。";
  }
  if (eventId === "shrine") {
    if (choiceId === "stand") {
      if (!run.relics.includes("laststand")) run.relics.push("laststand");
      return "应急支柱就位。";
    }
    run.scrap += 8;
    return "废料 +8。";
  }
  return "";
}
