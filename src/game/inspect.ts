import { tile, unitAt } from "./grid";
import type { Battle, Pos, Tile } from "./types";

export function inspectTile(b: Battle, p: Pos | null): { title: string; body: string } {
  if (!p) {
    return { title: "瞄准", body: "把鼠标放到格子或单位上，看它是什么。" };
  }
  const u = unitAt(b, p.x, p.y);
  const t = tile(b, p.x, p.y);
  if (!t) return { title: "界外", body: "棋盘外面，走不到。" };
  if (u) {
    const w = u.weight > 1 ? ` · ${u.weight === 3 ? "超重" : "重型"}，推距缩短` : "";
    const team = u.team === "player" ? "我方" : "敌方";
    const under = t ? underfoot(t) : "";
    return {
      title: `${u.name} · ${team}`,
      body: `生命 ${u.hp}/${u.maxHp}${w}。${u.team === "enemy" ? "红格是它下一击落地的位置。" : "点它选中，点青格走，点敌人出手。"}${under ? ` ${under}` : ""}`,
    };
  }
  if (t.core) {
    return {
      title: "舰核",
      body: "轨道城的心脏。敌人打在这格上会扣顶部结构条，结构掉光就失败。站上去也会一起挨打。",
    };
  }
  if (t.kind === "void") {
    return { title: "深渊", body: "推进去的人会掉下去，直接出局。补丁可以把坑铺回地面。" };
  }
  if (t.kind === "laser") {
    return { title: "激光槽", body: "回合结束时这格上的一切都会被烧。敌人也一样。" };
  }
  if (t.kind === "spring") {
    return { title: "弹簧", body: "被推到这格会多飞一格。预览会把整条链演完。" };
  }
  if (t.kind === "oil") {
    return { title: "油污", body: "和弹簧类似：击退经过这里会再滑一格。" };
  }
  if (t.kind === "belt") {
    const names = ["北", "东", "南", "西"];
    return {
      title: `传送带 · ${names[t.beltDir ?? 1]}`,
      body: "回合结束时，站在上面的人会被送一格。可以用来把敌人送进坑，也会把你自己送走。",
    };
  }
  if (t.kind === "repair") {
    return { title: "维修垫", body: "回合结束时，站在这格上的我方机甲回复 1 点生命。" };
  }
  if (t.kind === "block") {
    return { title: "路障", body: "不能走、不能射穿。推上去会撞停并受伤。可以当肉盾挡炮手。" };
  }
  if (t.collapseTurn > 0) {
    return {
      title: `将塌 · ${t.collapseTurn} 回合`,
      body: "这个数字回合结束时地板会掉成深渊。可以把敌人推上来，自己别站着。",
    };
  }
  if (t.fire) {
    return { title: "火焰", body: "回合结束时这格会再烧一下，然后熄灭。" };
  }
  return { title: "甲板", body: "普通落脚点。青格表示当前机甲可以走到这里。" };
}

function underfoot(t: Tile): string {
  if (t.core) return "它正站在舰核上。";
  if (t.kind === "void") return "它正在往深渊里掉。";
  if (t.kind === "laser") return "它正站在激光槽上。";
  if (t.kind === "spring") return "它正站在弹簧上。";
  if (t.kind === "oil") return "它正站在油污上。";
  if (t.kind === "belt") return "它正站在传送带上，回合结束会被送走。";
  if (t.kind === "repair") return "它正站在维修垫上。";
  if (t.kind === "block") return "它正卡在路障上。";
  if (t.collapseTurn > 0) return `脚下的地板 ${t.collapseTurn} 回合后会塌。`;
  if (t.fire) return "它正站在火里。";
  return "";
}

export function describeTileShort(t: Tile): string {
  if (t.core) return "核";
  if (t.kind === "void") return "渊";
  if (t.kind === "laser") return "激光";
  if (t.kind === "spring") return "簧";
  if (t.kind === "oil") return "油";
  if (t.kind === "belt") return "带";
  if (t.kind === "repair") return "修";
  if (t.kind === "block") return "障";
  if (t.collapseTurn > 0) return String(t.collapseTurn);
  return "";
}
