import { describe, expect, it } from "vitest";
import { createBattle, defaultPilots } from "./content";
import { cloneBattle, tile, unitAt, unitById } from "./grid";
import { MISSIONS, type Mission } from "./missions";
import {
  applyAction,
  applySkill,
  endTurn,
  legalActions,
  previewAction,
} from "./sim";
import { inspectTile } from "./inspect";
import type { Battle } from "./types";
import { fillOffers, newRun, rewardChoices, startMain, upgradeById } from "./run";

function battleOf(id: string): Battle {
  const m = MISSIONS.find((x) => x.id === id);
  if (!m) throw new Error(id);
  return createBattle(m, defaultPilots(), []);
}

function living(b: Battle) {
  return b.units.filter((u) => u.hp > 0);
}

function assertSane(b: Battle): void {
  const seen = new Set<string>();
  for (const u of living(b)) {
    const key = `${u.x},${u.y}`;
    expect(seen.has(key), `重叠 ${key}`).toBe(false);
    seen.add(key);
    const t = tile(b, u.x, u.y);
    expect(t, `${u.name} 越界`).toBeTruthy();
    expect(t?.kind, `${u.name} 站在坑里`).not.toBe("void");
    expect(t?.kind, `${u.name} 站在路障上`).not.toBe("block");
    expect(u.hp).toBeGreaterThan(0);
    expect(u.hp).toBeLessThanOrEqual(u.maxHp);
  }
  expect(b.structure).toBeGreaterThanOrEqual(0);
}

describe("航路", () => {
  it("第一章第一战固定码头缺口", () => {
    const run = newRun(7);
    startMain(run);
    expect(run.offers).toHaveLength(1);
    expect(run.offers[0]?.missionId).toBe("c1-1");
  });

  it("码头缺口之后仍是战斗而不是交易所", () => {
    const run = newRun(7);
    startMain(run);
    run.fightsDone = 1;
    run.usedMissions = ["c1-1"];
    fillOffers(run);
    expect(run.offers.some((o) => o.type === "shop" || o.type === "event")).toBe(false);
    expect(run.offers.every((o) => o.type === "fight")).toBe(true);
  });
});

describe("战后改装", () => {
  it("三选一必出组合技和机制", () => {
    const run = newRun(3);
    run.tut = false;
    run.wins = 1;
    const picks = rewardChoices(run);
    expect(picks).toHaveLength(3);
    const kinds = picks.map((p) => (p.kind === "upgrade" ? upgradeById(p.id)?.kind : "relic"));
    expect(kinds).toContain("combo");
    expect(kinds).toContain("mech");
  });
});

describe("关卡都能开局", () => {
  it("全部地图可创建且意图合法", () => {
    for (const m of MISSIONS) {
      const b = createBattle(m, defaultPilots(), []);
      expect(b.units.filter((u) => u.team === "player").length).toBe(3);
      expect(b.units.filter((u) => u.team === "enemy").length).toBe(m.enemies.length);
      expect(b.intents.length).toBeGreaterThan(0);
      assertSane(b);
    }
  });
});

describe("击退", () => {
  it("推进坑里会掉下去", () => {
    const m: Mission = {
      id: "t-pit",
      chapter: 1,
      kind: "fight",
      title: "t",
      briefing: "",
      map: `.#......\n........\n........\n........\n........\n........\n........\n........`,
      pilots: [{ x: 1, y: 2 }, { x: 4, y: 2 }, { x: 6, y: 2 }],
      enemies: [{ kind: "gunner", x: 1, y: 1 }],
      structure: 4,
      maxTurns: 8,
    };
    const b = createBattle(m, defaultPilots(), []);
    const gunner = b.units.find((u) => u.enemy === "gunner")!;
    const ev = applySkill(b, "iron", "punch", 1, 1);
    expect(ev).toBeTruthy();
    expect(gunner.hp).toBe(0);
    assertSane(b);
  });

  it("重拳先结算伤害", () => {
    const m: Mission = {
      id: "t-dmg",
      chapter: 1,
      kind: "fight",
      title: "t",
      briefing: "",
      map: `........\n........\n........\n........\n........\n........\n........\n........`,
      pilots: [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 6, y: 2 }],
      enemies: [{ kind: "beetle", x: 2, y: 1 }],
      structure: 4,
      maxTurns: 8,
    };
    const b = createBattle(m, defaultPilots(), []);
    const beetle = b.units.find((u) => u.enemy === "beetle")!;
    expect(beetle.hp).toBe(2);
    const ev = applySkill(b, "iron", "punch", 2, 1);
    expect(ev).toBeTruthy();
    expect(beetle.hp).toBe(0);
    assertSane(b);
  });

  it("撞墙扣血并停住", () => {
    const m: Mission = {
      id: "t-wall",
      chapter: 1,
      kind: "fight",
      title: "t",
      briefing: "",
      map: `........\n........\n........\n........\n........\n........\n........\n........`,
      pilots: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }],
      enemies: [{ kind: "beetle", x: 0, y: 1 }],
      structure: 4,
      maxTurns: 8,
    };
    const b = createBattle(m, defaultPilots(), []);
    const ev = applySkill(b, "iron", "punch", 0, 1);
    expect(ev).toBeTruthy();
    const beetle = b.units.find((u) => u.enemy === "beetle")!;
    expect(beetle.hp).toBe(0);
    expect(beetle.x).toBe(0);
  });
});

describe("预览等于结算", () => {
  it("随机合法动作的预览与真实结算一致", () => {
    const b = battleOf("c1-2");
    const acts = legalActions(b, []);
    expect(acts.length).toBeGreaterThan(1);
    for (const a of acts.slice(0, 12)) {
      const preview = previewAction(b, a);
      expect(preview).toBeTruthy();
      const copy = cloneBattle(b);
      const ev = applyAction(copy, a);
      expect(ev).toBeTruthy();
      expect(JSON.stringify(copy.units.map((u) => [u.id, u.x, u.y, u.hp]))).toEqual(
        JSON.stringify(preview!.next.units.map((u) => [u.id, u.x, u.y, u.hp])),
      );
      expect(copy.structure).toBe(preview!.next.structure);
      expect(copy.outcome).toBe(preview!.next.outcome);
    }
  });
});

describe("回合结束", () => {
  it("结束回合不会把活人留在坑里", () => {
    const b = battleOf("c1-2");
    const ev = endTurn(b);
    expect(ev.length).toBeGreaterThan(0);
    assertSane(b);
  });
});

describe("教学关", () => {
  it("铁腕从西侧一拳打死甲虫", () => {
    const b = battleOf("tut-1");
    const iron = b.units.find((u) => u.id === "iron")!;
    expect(iron.x).toBe(1);
    expect(iron.y).toBe(4);
    const mv = applyAction(b, { type: "move", id: "iron", x: 1, y: 1 });
    expect(mv).toBeTruthy();
    const ev = applyAction(b, { type: "skill", id: "iron", skill: "punch", tx: 2, ty: 1 });
    expect(ev).toBeTruthy();
    const beetle = b.units.find((u) => u.enemy === "beetle")!;
    expect(beetle.hp).toBe(0);
    expect(b.outcome).toBe("won");
  });
});

describe("线炮", () => {
  it("可以隔着深渊打到对面", () => {
    const m: Mission = {
      id: "t-cannon-void",
      chapter: 1,
      kind: "fight",
      title: "t",
      briefing: "",
      map: `........\n.#......\n........\n........\n........\n........\n........\n........`,
      pilots: [{ x: 0, y: 6 }, { x: 1, y: 3 }, { x: 3, y: 6 }],
      enemies: [{ kind: "beetle", x: 1, y: 0 }],
      structure: 4,
      maxTurns: 8,
    };
    const b = createBattle(m, defaultPilots(), []);
    const beetle = b.units.find((u) => u.enemy === "beetle")!;
    const ev = applySkill(b, "line", "cannon", 1, 0);
    expect(ev).toBeTruthy();
    expect(beetle.hp).toBe(0);
    assertSane(b);
  });

  it("路障仍然挡住线炮", () => {
    const m: Mission = {
      id: "t-cannon-block",
      chapter: 1,
      kind: "fight",
      title: "t",
      briefing: "",
      map: `........\n.X......\n........\n........\n........\n........\n........\n........`,
      pilots: [{ x: 0, y: 6 }, { x: 1, y: 3 }, { x: 3, y: 6 }],
      enemies: [{ kind: "beetle", x: 1, y: 0 }],
      structure: 4,
      maxTurns: 8,
    };
    const b = createBattle(m, defaultPilots(), []);
    const ev = applySkill(b, "line", "cannon", 1, 0);
    expect(ev).toBeNull();
    const beetle = b.units.find((u) => u.enemy === "beetle")!;
    expect(beetle.hp).toBe(2);
  });
});

describe("铺路", () => {
  it("可以把坑铺回地面", () => {
    const m: Mission = {
      id: "t-pave",
      chapter: 1,
      kind: "fight",
      title: "t",
      briefing: "",
      map: `........\n..#.....\n........\n........\n........\n........\n........\n........`,
      pilots: [{ x: 0, y: 2 }, { x: 4, y: 2 }, { x: 6, y: 2 }],
      enemies: [{ kind: "beetle", x: 5, y: 1 }],
      structure: 4,
      maxTurns: 8,
    };
    const b = createBattle(m, defaultPilots(), []);
    const patch = unitById(b, "patch")!;
    patch.x = 2;
    patch.y = 2;
    const ev = applySkill(b, "patch", "pave", 2, 1);
    expect(ev).toBeTruthy();
    expect(tile(b, 2, 1)?.kind).toBe("floor");
  });
});

describe("钩索", () => {
  it("两格外的敌人会被拉到身前而不是撞上补丁", () => {
    const m: Mission = {
      id: "t-hook",
      chapter: 1,
      kind: "fight",
      title: "t",
      briefing: "",
      map: `........\n........\n........\n........\n........\n........\n........\n........`,
      pilots: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 4 }],
      enemies: [{ kind: "beetle", x: 3, y: 2 }],
      structure: 4,
      maxTurns: 8,
    };
    const b = createBattle(m, defaultPilots(), []);
    const ev = applySkill(b, "patch", "hook", 3, 2);
    expect(ev).toBeTruthy();
    const beetle = b.units.find((u) => u.enemy === "beetle")!;
    expect(beetle.hp).toBeGreaterThan(0);
    expect(beetle.x).toBe(3);
    expect(beetle.y).toBe(3);
    const patch = unitById(b, "patch")!;
    expect(patch.x).toBe(3);
    expect(patch.y).toBe(4);
  });

  it("贴身钩索会把人拽到身后", () => {
    const m: Mission = {
      id: "t-hook2",
      chapter: 1,
      kind: "fight",
      title: "t",
      briefing: "",
      map: `........\n........\n........\n........\n........\n........\n........\n........`,
      pilots: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 3 }],
      enemies: [{ kind: "beetle", x: 3, y: 2 }],
      structure: 4,
      maxTurns: 8,
    };
    const b = createBattle(m, defaultPilots(), []);
    const ev = applySkill(b, "patch", "hook", 3, 2);
    expect(ev).toBeTruthy();
    const beetle = b.units.find((u) => u.enemy === "beetle")!;
    expect(beetle.hp).toBeGreaterThan(0);
    expect(beetle.x).toBe(3);
    expect(beetle.y).toBe(4);
  });
});

describe("占用", () => {
  it("不能走到敌人身上", () => {
    const b = battleOf("c1-1");
    const enemy = b.units.find((u) => u.team === "enemy")!;
    const acts = legalActions(b, []);
    const illegal = acts.some(
      (a) => a.type === "move" && a.x === enemy.x && a.y === enemy.y,
    );
    expect(illegal).toBe(false);
    expect(unitAt(b, enemy.x, enemy.y)?.id).toBe(enemy.id);
  });
});

describe("功能格", () => {
  it("推上路障会撞停并受伤", () => {
    const m: Mission = {
      id: "t-block",
      chapter: 1,
      kind: "fight",
      title: "t",
      briefing: "",
      map: `........\n...X....\n........\n........\n........\n........\n........\n........`,
      pilots: [{ x: 3, y: 3 }, { x: 0, y: 0 }, { x: 1, y: 0 }],
      enemies: [{ kind: "gunner", x: 3, y: 2 }],
      structure: 4,
      maxTurns: 8,
    };
    const b = createBattle(m, defaultPilots(), []);
    const gunner = b.units.find((u) => u.enemy === "gunner")!;
    const hp = gunner.hp;
    const ev = applySkill(b, "iron", "punch", 3, 2);
    expect(ev).toBeTruthy();
    expect(gunner.hp).toBe(hp - 3);
    expect(gunner.x).toBe(3);
    expect(gunner.y).toBe(2);
    expect(tile(b, 3, 1)?.kind).toBe("block");
    assertSane(b);
  });

  it("传送带在回合结束把人送一格", () => {
    const m: Mission = {
      id: "t-belt",
      chapter: 1,
      kind: "fight",
      title: "t",
      briefing: "",
      map: `C.......\n........\n..>.....\n........\n........\n........\n........\n........`,
      pilots: [{ x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }],
      enemies: [{ kind: "turret", x: 2, y: 2 }],
      structure: 8,
      maxTurns: 8,
    };
    const b = createBattle(m, defaultPilots(), []);
    const turret = b.units.find((u) => u.enemy === "turret")!;
    endTurn(b);
    expect(turret.hp).toBeGreaterThan(0);
    expect(turret.x).toBe(3);
    expect(turret.y).toBe(2);
    assertSane(b);
  });

  it("码头缺口传送带上的敌人回合结束会离开原格", () => {
    const b = battleOf("c1-1");
    const onBelt = b.units.filter((u) => u.team === "enemy" && tile(b, u.x, u.y)?.kind === "belt");
    expect(onBelt.length).toBeGreaterThan(0);
    const before = onBelt.map((u) => ({ id: u.id, x: u.x, y: u.y }));
    endTurn(b);
    for (const p of before) {
      const u = b.units.find((x) => x.id === p.id);
      if (!u || u.hp <= 0) continue;
      expect(u.x !== p.x || u.y !== p.y, `${u.name} 仍停在传送带原格`).toBe(true);
    }
    assertSane(b);
  });

  it("维修垫在回合结束给我方回血", () => {
    const m: Mission = {
      id: "t-repair",
      chapter: 1,
      kind: "fight",
      title: "t",
      briefing: "",
      map: `C.......\n........\n........\n........\n........\n....R...\n........\n........`,
      pilots: [{ x: 4, y: 5 }, { x: 0, y: 6 }, { x: 1, y: 6 }],
      enemies: [{ kind: "beetle", x: 7, y: 0 }],
      structure: 8,
      maxTurns: 8,
    };
    const b = createBattle(m, defaultPilots(), []);
    const iron = unitById(b, "iron")!;
    iron.hp = 1;
    endTurn(b);
    expect(iron.hp).toBe(2);
    expect(iron.x).toBe(4);
    expect(iron.y).toBe(5);
    assertSane(b);
  });
});

describe("瞄准说明", () => {
  it("舰核和功能格有名字", () => {
    const b = battleOf("c1-1");
    let corePos = { x: 0, y: 0 };
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        if (b.tiles[y * b.w + x].core) corePos = { x, y };
      }
    }
    const core = inspectTile(b, corePos);
    expect(core.title).toBe("舰核");
    const belt = inspectTile(b, { x: 5, y: 2 });
    expect(belt.title).toContain("传送带");
    const block = inspectTile(b, { x: 3, y: 3 });
    expect(block.title).toBe("路障");
    const repair = inspectTile(b, { x: 6, y: 6 });
    expect(repair.title).toBe("维修垫");
  });
});

describe("敌方招式", () => {
  it("十三种敌人各有独立出手", () => {
    const expected: [Mission["enemies"][0]["kind"], string][] = [
      ["beetle", "melee"],
      ["brute", "cleave"],
      ["hammer", "smash"],
      ["gunner", "shot"],
      ["sniper", "pierce"],
      ["demo", "beam"],
      ["bomber", "burst"],
      ["etcher", "acid"],
      ["mortar", "mortar"],
      ["grappler", "pull"],
      ["bully", "shove"],
      ["brood", "spawn"],
      ["warden", "lock"],
    ];
    const seen = new Set<string>();
    for (const [kind, intent] of expected) {
      const m: Mission = {
        id: `t-${kind}`,
        chapter: 1,
        kind: "fight",
        title: "t",
        briefing: "",
        map: `........\n........\n........\n...C....\n........\n........\n........\n........`,
        pilots: [{ x: 1, y: 6 }, { x: 3, y: 6 }, { x: 5, y: 6 }],
        enemies: [{ kind, x: 3, y: 1 }],
        structure: 6,
        maxTurns: 8,
      };
      const b = createBattle(m, defaultPilots(), []);
      expect(b.intents.length).toBe(1);
      expect(b.intents[0].kind).toBe(intent);
      seen.add(b.intents[0].kind);
      assertSane(b);
    }
    expect(seen.size).toBe(13);
  });

  it("拆楼机切割梁不超过五格", () => {
    const b = battleOf("c1-boss");
    const demo = b.intents.find((i) => i.kind === "beam");
    expect(demo).toBeTruthy();
    expect(demo!.tiles.length).toBeLessThanOrEqual(5);
    expect(demo!.tiles.length).toBeGreaterThan(0);
  });
});

describe("舰核布置", () => {
  it("核心更少且在下半场", () => {
    const b = battleOf("c1-1");
    const cores: { x: number; y: number }[] = [];
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        if (b.tiles[y * b.w + x].core) cores.push({ x, y });
      }
    }
    expect(cores.length).toBeGreaterThan(0);
    expect(cores.length).toBeLessThanOrEqual(2);
    for (const c of cores) expect(c.y).toBeGreaterThanOrEqual(Math.floor(b.h / 2));
  });
});

describe("组合技", () => {
  it("破甲协同会在线炮上引爆", () => {
    const m: Mission = {
      id: "t-mark",
      chapter: 1,
      kind: "fight",
      title: "t",
      briefing: "",
      map: `........\n........\n....X...\n........\n........\n........\n........\n........`,
      pilots: [{ x: 4, y: 4 }, { x: 0, y: 3 }, { x: 7, y: 7 }],
      enemies: [{ kind: "gunner", x: 4, y: 3 }],
      structure: 6,
      maxTurns: 8,
    };
    const b = createBattle(m, defaultPilots(), [], ["markcombo"]);
    const gunner = b.units.find((u) => u.enemy === "gunner")!;
    expect(applySkill(b, "iron", "punch", 4, 3)).toBeTruthy();
    expect(gunner.marked).toBe(true);
    expect(gunner.x).toBe(4);
    expect(gunner.y).toBe(3);
    expect(applySkill(b, "line", "cannon", 4, 3)).toBeTruthy();
    expect(gunner.hp).toBe(0);
    assertSane(b);
  });

  it("击杀连射让线炮再动", () => {
    const m: Mission = {
      id: "t-volley",
      chapter: 1,
      kind: "fight",
      title: "t",
      briefing: "",
      map: `........\n........\n........\n........\n........\n........\n........\n........`,
      pilots: [{ x: 0, y: 7 }, { x: 2, y: 4 }, { x: 7, y: 7 }],
      enemies: [{ kind: "beetle", x: 2, y: 1 }],
      structure: 6,
      maxTurns: 8,
    };
    const b = createBattle(m, defaultPilots(), [], ["volley"]);
    expect(applySkill(b, "line", "cannon", 2, 1)).toBeTruthy();
    const line = b.units.find((u) => u.id === "line")!;
    expect(line.acted).toBe(false);
    expect(b.units.find((u) => u.enemy === "beetle")!.hp).toBe(0);
  });
});
