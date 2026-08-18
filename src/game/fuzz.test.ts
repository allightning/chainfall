import { describe, expect, it } from "vitest";
import { createBattle, defaultPilots } from "./content";
import { tile } from "./grid";
import { MISSIONS } from "./missions";
import { applyAction, legalActions } from "./sim";
import { mulberry32 } from "./rng";
import type { Battle } from "./types";

function assertSane(b: Battle, label: string): void {
  const seen = new Set<string>();
  for (const u of b.units.filter((x) => x.hp > 0)) {
    const key = `${u.x},${u.y}`;
    if (seen.has(key)) throw new Error(`${label} 重叠 ${key}`);
    seen.add(key);
    const t = tile(b, u.x, u.y);
    if (!t) throw new Error(`${label} 越界 ${u.name}`);
    if (t.kind === "void") throw new Error(`${label} ${u.name} 站在坑里`);
  }
  if (Number.isNaN(b.structure)) throw new Error(`${label} 结构 NaN`);
}

describe("随机对局压测", () => {
  it("每关随机合法操作 80 步不崩溃", () => {
    for (const m of MISSIONS) {
      const rng = mulberry32(m.id.length * 999 + 7);
      const b = createBattle(m, defaultPilots(), ["pluspush"]);
      for (let step = 0; step < 80; step++) {
        if (b.outcome !== "ongoing") break;
        const acts = legalActions(b, ["stomp"]);
        if (acts.length === 0) break;
        const bias = step > 6 && rng() < 0.22 ? acts.find((a) => a.type === "end") : undefined;
        const a = bias ?? acts[Math.floor(rng() * acts.length)];
        const ev = applyAction(b, a);
        if (!ev) throw new Error(`${m.id} 合法动作被拒绝 ${JSON.stringify(a)}`);
        assertSane(b, `${m.id}#${step}`);
      }
    }
  });

  it("再跑 200 次随机种子开局", () => {
    const rng = mulberry32(20260818);
    for (let i = 0; i < 200; i++) {
      const m = MISSIONS[Math.floor(rng() * MISSIONS.length)];
      const b = createBattle(m, defaultPilots(), []);
      assertSane(b, `seed ${i} ${m.id}`);
      const acts = legalActions(b, []);
      expect(acts.length).toBeGreaterThan(0);
      applyAction(b, acts[Math.floor(rng() * acts.length)]!);
      assertSane(b, `seed ${i} after`);
    }
  });
});
