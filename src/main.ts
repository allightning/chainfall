import { CHAPTERS } from "./game/content";
import { reachable } from "./game/grid";
import {
  applyAction,
  previewAction,
  skillTargets,
  skillsFor,
} from "./game/sim";
import { cloneBattle } from "./game/grid";
import {
  advance,
  afterBattle,
  buyRelic,
  chapterOf,
  currentNode,
  healShop,
  newRun,
  relicById,
  rewardChoices,
  shopChoices,
  shopCost,
  startBattle,
  unlockedSkills,
  upgradeById,
  applyUpgrade,
  applyEventChoice,
  eventById,
  type RunState,
} from "./game/run";
import { CAMPAIGN } from "./game/missions";
import type { Action, Battle, Ev, Pos, SkillId, Unit } from "./game/types";
import { SKILLS } from "./game/types";
import { BoardView, drawTitleFx, loadArt } from "./render";
import { sfx, toggleMute, unlockAudio } from "./game/audio";

type Screen = "title" | "help" | "brief" | "combat" | "reward" | "shop" | "lost" | "won" | "event";

const found = document.querySelector<HTMLDivElement>("#app");
if (!found) throw new Error("#app 不存在");
const root = found;

root.innerHTML = `
  <div id="err" class="err hidden"></div>
  <div id="chain-pop" class="chain-pop hidden">连锁</div>
  <div class="title-bg" id="fx-wrap"><canvas id="title-fx"></canvas></div>
  <section id="sc-title" class="screen">
    <div class="center">
      <div class="kicker">ORBITAL TACTICS</div>
      <h1>连崩</h1>
      <p class="sublead">看见红格，再动手。击退是伤害，地图会自己往下垮。预览等于结算。</p>
      <div class="rules">
        <div><b>上手</b>别站红格。点人选、点地走，点敌人就会推。Z 撤销。</div>
        <div><b>爽点</b>把人推进坑、互相撞、送上将塌格。连锁会跳数字。</div>
        <div><b>上限</b>弹簧、激光、炮台、拆楼机改整列。预览把整条链演完。</div>
        <div><b>一局</b>四座城、商店、事件、遗物。结构条空了或全灭即失败。</div>
      </div>
      <div class="row">
        <button class="primary" id="btn-start">开始撤离</button>
        <button id="btn-help">作战手册</button>
      </div>
    </div>
  </section>
  <section id="sc-help" class="screen hidden">
    <div class="center stack">
      <div class="kicker">MANUAL</div>
      <h2>战场怎么读</h2>
      <p>红格是敌人下一击，数字是那一回合结束会塌的地板。青格是移动范围，黄格是技能目标。悬停技能目标时，幽灵会告诉你谁会被推到哪、谁会掉下去。</p>
      <p>铁腕近推两格。线炮打直线第一个人。补丁铺回坑/将塌格，也能把人钩过来。商店买遗物，战后三选一升级。事件会给你喘息或赌一把。</p>
      <p>1 / 2 / 3 选人 · Q / W 技能 · Z 撤销 · Esc 取消 · 空格结束回合 · M 静音</p>
      <div class="row"><button class="primary" id="btn-help-back">返回</button></div>
    </div>
  </section>
  <section id="sc-brief" class="screen hidden">
    <div class="center stack">
      <div class="kicker" id="brief-kicker">CHAPTER</div>
      <h2 id="brief-title">关卡</h2>
      <p id="brief-text"></p>
      <p class="brief-meta" id="brief-meta"></p>
      <div id="brief-nodes" class="nodes"></div>
      <div class="row">
        <button class="primary" id="btn-brief-go">进入战场</button>
      </div>
    </div>
  </section>
  <section id="sc-event" class="screen hidden">
    <div class="center stack">
      <div class="kicker">EVENT</div>
      <h2 id="event-title">事件</h2>
      <p id="event-text"></p>
      <div class="cards" id="event-cards"></div>
    </div>
  </section>
  <section id="sc-combat" class="combat hidden">
    <div class="hud">
      <span class="logo">CHAINFALL</span>
      <span id="hud-mission"></span>
      <span class="nodes" id="hud-nodes"></span>
      <span class="sp" id="hud-turn"></span>
      <span class="pips" id="hud-struct" title="结构"></span>
      <span id="hud-scrap"></span>
      <span class="relics" id="hud-relics"></span>
      <span style="flex:1"></span>
      <button id="btn-mute">音效</button>
    </div>
    <div class="stage">
      <aside class="squad">
        <div class="side-label">小队</div>
        <div id="pilots"></div>
      </aside>
      <div class="table">
        <div class="frame"><div id="board-wrap"><canvas id="board"></canvas></div></div>
      </div>
      <aside class="tactics">
        <div class="side-label">战术</div>
        <div id="skills"></div>
        <div class="row" style="margin-top:10px">
          <button id="btn-undo">撤销 Z</button>
          <button class="danger" id="btn-end">结束回合</button>
        </div>
        <div class="log" id="log"></div>
      </aside>
    </div>
    <div class="keys"><span id="keys-hint">点地移动 · 点敌人出技能 · 悬停即预览</span><span>空格结束回合</span></div>
  </section>
  <section id="sc-reward" class="screen hidden">
    <div class="center">
      <div class="kicker">UPGRADE</div>
      <h2>战场冷却</h2>
      <p id="reward-sub"></p>
      <div class="cards" id="reward-cards"></div>
      <button id="btn-reward-skip">不升级，继续走</button>
    </div>
  </section>
  <section id="sc-shop" class="screen hidden">
    <div class="center">
      <div class="kicker">SHOP</div>
      <h2>废料交易所</h2>
      <p id="shop-sub"></p>
      <div class="cards" id="shop-cards"></div>
      <button class="primary" id="btn-shop-leave">离开并回满生命</button>
    </div>
  </section>
  <section id="sc-lost" class="screen hidden">
    <div class="center stack">
      <div class="kicker">HULL BREACH</div>
      <h2>结构崩溃</h2>
      <p id="lost-text"></p>
      <button class="primary" id="btn-retry">再来一局</button>
    </div>
  </section>
  <section id="sc-won" class="screen hidden">
    <div class="center stack">
      <div class="kicker">CLEAR</div>
      <h2>逃出轨道城</h2>
      <p id="won-text"></p>
      <button class="primary" id="btn-again">再逃一次</button>
    </div>
  </section>
`;

const screens: Record<Screen, HTMLElement> = {
  title: must("#sc-title"),
  help: must("#sc-help"),
  brief: must("#sc-brief"),
  combat: must("#sc-combat"),
  reward: must("#sc-reward"),
  shop: must("#sc-shop"),
  lost: must("#sc-lost"),
  won: must("#sc-won"),
  event: must("#sc-event"),
};

function must<T extends HTMLElement>(sel: string): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`缺少 ${sel}`);
  return el;
}

const errEl = must<HTMLDivElement>("#err");
const canvas = must<HTMLCanvasElement>("#board");
const view = new BoardView(canvas);
void loadArt();

let screen: Screen = "title";
let run: RunState = newRun();
let battle: Battle | null = null;
let selected: string | null = null;
let skill: SkillId | null = null;
let hover: Pos | null = null;
let undo: Battle[] = [];
let logLines: string[] = [];
let pulse = 0;
let lerpFrom: Record<string, Pos> = {};
let lerpStart = 0;
const titleFx = must<HTMLCanvasElement>("#title-fx");
const chainPop = must("#chain-pop");

function show(next: Screen): void {
  screen = next;
  (Object.keys(screens) as Screen[]).forEach((k) => {
    screens[k].classList.toggle("hidden", k !== next);
  });
  must("#fx-wrap").classList.toggle("hidden", next === "combat");
}

function showErr(msg: string): void {
  errEl.textContent = msg;
  errEl.classList.remove("hidden");
  setTimeout(() => errEl.classList.add("hidden"), 4000);
}

window.addEventListener("error", (e) => showErr(e.message || "未知错误"));
window.addEventListener("unhandledrejection", (e) => {
  const r = e.reason;
  showErr(r instanceof Error ? r.message : String(r));
});

function setScreen(next: Screen): void {
  show(next);
  if (next === "combat") requestDraw();
}

must("#btn-start").onclick = () => {
  unlockAudio();
  sfx.ui();
  beginRun();
};
must("#btn-help").onclick = () => {
  sfx.ui();
  setScreen("help");
};
must("#btn-help-back").onclick = () => {
  sfx.ui();
  setScreen("title");
};
must("#btn-brief-go").onclick = () => {
  sfx.ui();
  enterCombat();
};
must("#btn-undo").onclick = () => undoMove();
must("#btn-end").onclick = () => tryEndTurn();
must("#btn-mute").onclick = () => {
  const m = toggleMute();
  must("#btn-mute").textContent = m ? "音效关" : "音效";
};
must("#btn-retry").onclick = () => beginRun();
must("#btn-again").onclick = () => beginRun();
must("#btn-reward-skip").onclick = () => afterReward();
must("#btn-shop-leave").onclick = () => leaveShop();

function beginRun(): void {
  run = newRun();
  logLines = [];
  goNode();
}

function goNode(): void {
  const node = currentNode(run);
  if (!node) {
    finishWin();
    return;
  }
  if (node.type === "shop") {
    openShop();
    return;
  }
  if (node.type === "event") {
    openEvent();
    return;
  }
  openBrief();
}

function openBrief(): void {
  const b = startBattle(run);
  battle = b;
  selected = b.units.find((u) => u.team === "player" && u.hp > 0)?.id ?? null;
  skill = null;
  undo = [];
  logLines = [b.briefing];
  const node = currentNode(run);
  const n = (run.node + 1).toString();
  const ch = CHAPTERS[chapterOf(run) - 1];
  must("#brief-kicker").textContent = `第 ${chapterOf(run)} 章 · ${ch?.name ?? ""} · ${n}/${CAMPAIGN.length}`;
  must("#brief-title").textContent = b.title;
  must("#brief-text").textContent = b.briefing;
  must("#brief-meta").textContent = `${node?.type === "boss" ? "BOSS" : node?.type === "elite" ? "精英" : "战斗"} · 结构 ${b.structure} · ${b.maxTurns} 回合`;
  must("#brief-nodes").innerHTML = nodeDots();
  setScreen("brief");
}

function nodeDots(): string {
  return CAMPAIGN.map((n, i) => {
    const cls = i === run.node ? "now" : i < run.node ? "on" : "";
    const title = n.missionId ?? n.eventId ?? n.type;
    return `<i class="${cls}" title="${title}"></i>`;
  }).join("");
}

function openEvent(): void {
  const node = currentNode(run);
  const ev = eventById(node?.eventId ?? "");
  if (!ev) {
    const r = advance(run);
    if (r === "won") finishWin();
    else goNode();
    return;
  }
  must("#event-title").textContent = ev.title;
  must("#event-text").textContent = ev.text;
  const box = must("#event-cards");
  box.innerHTML = "";
  for (const ch of ev.choices) {
    const btn = document.createElement("button");
    btn.className = "card";
    btn.innerHTML = `<b>${ch.label}</b><span>${ch.desc}</span>`;
    btn.onclick = () => {
      const msg = applyEventChoice(run, ev.id, ch.id);
      if (msg.includes("不够")) {
        showErr(msg);
        return;
      }
      sfx.ui();
      const r = advance(run);
      if (r === "won") finishWin();
      else goNode();
    };
    box.appendChild(btn);
  }
  setScreen("event");
}

function enterCombat(): void {
  if (!battle) return;
  view.resize(battle.w, battle.h);
  refreshSide();
  setScreen("combat");
  requestDraw();
}

function openShop(): void {
  healShop(run);
  const cost = shopCost(run);
  const choices = shopChoices(run);
  must("#shop-sub").textContent = `废料 ${run.scrap} · 每件 ${cost} · 生命已回满`;
  const box = must("#shop-cards");
  box.innerHTML = "";
  if (choices.length === 0) {
    box.textContent = "货架空了。";
  }
  for (const id of choices) {
    const r = relicById(id);
    if (!r) continue;
    const btn = document.createElement("button");
    btn.className = "card";
    btn.innerHTML = `<b>${r.name}</b><span>${r.desc}</span>`;
    btn.disabled = run.scrap < cost;
    btn.onclick = () => {
      if (!buyRelic(run, id)) return;
      sfx.ui();
      openShop();
    };
    box.appendChild(btn);
  }
  setScreen("shop");
}

function leaveShop(): void {
  sfx.ui();
  const r = advance(run);
  if (r === "won") finishWin();
  else goNode();
}

function openReward(b: Battle): void {
  must("#reward-sub").textContent = `本战废料 +${b.scrap} · 现有 ${run.scrap}`;
  const box = must("#reward-cards");
  box.innerHTML = "";
  const choices = rewardChoices(run);
  if (choices.length === 0) {
    box.textContent = "升级已满。";
  }
  for (const id of choices) {
    const u = upgradeById(id);
    if (!u) continue;
    const btn = document.createElement("button");
    btn.className = "card";
    btn.innerHTML = `<b>${u.name}</b><span>${u.desc}</span>`;
    btn.onclick = () => {
      applyUpgrade(run, id);
      sfx.ui();
      afterReward();
    };
    box.appendChild(btn);
  }
  setScreen("reward");
}

function afterReward(): void {
  const r = advance(run);
  if (r === "won") finishWin();
  else goNode();
}

function finishWin(): void {
  sfx.win();
  must("#won-text").textContent = `通关节点 ${run.wins} · 废料 ${run.scrap} · 遗物 ${run.relics.length}`;
  setScreen("won");
}

function loseNow(reason: string): void {
  sfx.lose();
  must("#lost-text").textContent = `${reason} · 走到第 ${chapterOf(run)} 章，废料 ${run.scrap}`;
  setScreen("lost");
}

function requestDraw(): void {
  /* combat 画面每帧都会画 */
}

function refreshSide(): void {
  if (!battle) return;
  const b = battle;
  must("#hud-mission").textContent = `${CHAPTERS[b.chapter - 1]?.name ?? ""} · ${b.title}`;
  must("#hud-nodes").innerHTML = nodeDots();
  must("#hud-turn").textContent = `${b.turn} / ${b.maxTurns}`;
  const st = must("#hud-struct");
  st.innerHTML = "";
  for (let i = 0; i < b.maxStructure; i++) {
    const pip = document.createElement("i");
    if (i < b.structure) pip.className = b.structure <= 1 ? "warn" : "full";
    st.appendChild(pip);
  }
  must("#hud-scrap").textContent = `${run.scrap + b.scrap} 废料`;
  const rel = must("#hud-relics");
  rel.innerHTML = run.relics
    .map((id) => `<span class="chip">${escapeHtml(relicById(id)?.name ?? id)}</span>`)
    .join("");
  const box = must("#pilots");
  box.innerHTML = "";
  for (const u of b.units.filter((x) => x.team === "player")) {
    const d = document.createElement("div");
    d.className = "pilot" + (u.id === selected ? " on" : "");
    const pct = Math.max(0, (u.hp / u.maxHp) * 100);
    const mv = u.hp <= 0 ? "已倒下" : u.moved ? "已移动" : "可移动";
    const ac = u.hp <= 0 ? "" : u.acted ? "已行动" : "可行动";
    d.innerHTML = `<div class="nm">${u.name}<span>${u.hp}/${u.maxHp}</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="pips-act"><span class="${u.moved ? "" : "on"}">${mv}</span><span class="${u.acted ? "" : "on"}">${ac}</span></div>`;
    d.onclick = () => {
      if (u.hp <= 0) return;
      selected = u.id;
      skill = null;
      sfx.ui();
      refreshSide();
    };
    box.appendChild(d);
  }
  const sk = must("#skills");
  sk.innerHTML = "";
  const u = selectedUnit();
  const unlocked = unlockedSkills(run);
  if (u && u.hp > 0) {
    for (const id of skillsFor(u, unlocked)) {
      const def = SKILLS[id];
      const btn = document.createElement("button");
      btn.className = "skill" + (skill === id ? " primary" : "");
      btn.innerHTML = `${def.name}<small>${def.hint}</small>`;
      btn.disabled = u.acted;
      btn.onclick = () => {
        skill = skill === id ? null : id;
        sfx.ui();
        refreshSide();
      };
      sk.appendChild(btn);
    }
  }
  const log = must("#log");
  log.innerHTML = logLines
    .slice(-12)
    .map((s) => `<div>${escapeHtml(s)}</div>`)
    .join("");
  log.scrollTop = log.scrollHeight;
  must<HTMLButtonElement>("#btn-undo").disabled = undo.length === 0;
  must<HTMLButtonElement>("#btn-end").disabled = b.outcome !== "ongoing";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c));
}

function selectedUnit(): Unit | undefined {
  if (!battle || !selected) return undefined;
  return battle.units.find((u) => u.id === selected && u.hp > 0);
}

function currentMoves(): Pos[] {
  const u = selectedUnit();
  if (!battle || !u || u.moved || skill) return [];
  return reachable(battle, u);
}

function currentSkills(): Pos[] {
  const u = selectedUnit();
  if (!battle || !u || !skill || u.acted) return [];
  return skillTargets(battle, u, skill);
}

function hoverAction(): Action | null {
  const h = hover;
  if (!battle || !h || !selected) return null;
  const u = selectedUnit();
  if (!u) return null;
  if (skill) {
    if (currentSkills().some((p) => p.x === h.x && p.y === h.y)) {
      return { type: "skill", id: u.id, skill, tx: h.x, ty: h.y };
    }
    return null;
  }
  if (currentMoves().some((p) => p.x === h.x && p.y === h.y)) {
    return { type: "move", id: u.id, x: h.x, y: h.y };
  }
  return null;
}

function commit(action: Action): void {
  if (!battle || battle.outcome !== "ongoing") return;
  const snap = cloneBattle(battle);
  const events = applyAction(battle, action);
  if (!events) return;
  undo.push(snap);
  if (undo.length > 24) undo.shift();
  lerpFrom = {};
  for (const u of snap.units) lerpFrom[u.id] = { x: u.x, y: u.y };
  lerpStart = performance.now();
  playEvents(events);
}

function undoMove(): void {
  if (!battle || undo.length === 0) return;
  const prev = undo.pop();
  if (!prev) return;
  battle = prev;
  skill = null;
  sfx.ui();
  refreshSide();
  requestDraw();
}

function tryEndTurn(): void {
  commit({ type: "end" });
}

function playEvents(events: Ev[]): void {
  let chainN = 0;
  for (const ev of events) {
    if (ev.t === "log") logLines.push(ev.s);
    if (ev.t === "chain") {
      logLines.push(`连锁 × ${ev.n}`);
      chainN = ev.n;
      sfx.chain();
      view.shake(4);
    }
    if (ev.t === "slam") {
      sfx.slam();
      view.burst(ev.x, ev.y, "#e8c36a", 12);
      view.float(ev.x, ev.y, `-${ev.dmg}`, "#ffb0a0");
      view.shake(2);
    }
    if (ev.t === "fall") {
      sfx.fall();
      view.burst(ev.x, ev.y, "#6aa0c8", 14);
      view.shake(3);
    }
    if (ev.t === "hit" && ev.dmg) {
      sfx.hit();
      view.float(ev.x, ev.y, `-${ev.dmg}`, "#ffd0cc");
    }
    if (ev.t === "move") sfx.move();
    if (ev.t === "die") {
      logLines.push(`${ev.name} 倒下`);
      view.burst(ev.x, ev.y, "#d05656", 16);
    }
    if (ev.t === "structure") view.shake(2);
  }
  if (chainN >= 3) {
    chainPop.textContent = `连锁 × ${chainN}`;
    chainPop.classList.remove("hidden");
    setTimeout(() => chainPop.classList.add("hidden"), 700);
  }
  afterEvents();
}

function afterEvents(): void {
  skill = null;
  refreshSide();
  requestDraw();
  if (!battle) return;
  if (battle.outcome === "won") {
    sfx.win();
    afterBattle(run, battle);
    setTimeout(() => {
      if (battle) openReward(battle);
    }, 280);
  } else if (battle.outcome === "lost") {
    loseNow(battle.loseReason);
  }
}

canvas.addEventListener("mousemove", (e) => {
  if (!battle || screen !== "combat") return;
  hover = view.tileAt(e.clientX, e.clientY, battle);
  requestDraw();
});
canvas.addEventListener("mouseleave", () => {
  hover = null;
  requestDraw();
});
canvas.addEventListener("click", (e) => {
  if (!battle || screen !== "combat") return;
  unlockAudio();
  const p = view.tileAt(e.clientX, e.clientY, battle);
  if (!p) return;
  hover = p;
  const occ = battle.units.find((u) => u.hp > 0 && u.x === p.x && u.y === p.y);
  if (occ?.team === "player") {
    selected = occ.id;
    skill = null;
    refreshSide();
    requestDraw();
    sfx.ui();
    return;
  }
  const act = hoverAction();
  if (act) {
    commit(act);
    return;
  }
  const u = selectedUnit();
  if (u && !u.acted && occ) {
    for (const sid of skillsFor(u, unlockedSkills(run))) {
      if (skillTargets(battle, u, sid).some((t) => t.x === p.x && t.y === p.y)) {
        commit({ type: "skill", id: u.id, skill: sid, tx: p.x, ty: p.y });
        return;
      }
    }
  }
  skill = null;
  refreshSide();
  requestDraw();
});
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  skill = null;
  refreshSide();
  requestDraw();
});

window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (screen === "combat") {
    if (e.code === "Space") {
      e.preventDefault();
      tryEndTurn();
    }
    if (e.key === "z" || e.key === "Z") undoMove();
    if (e.key === "Escape") {
      skill = null;
      refreshSide();
      requestDraw();
    }
    if (e.key === "1" || e.key === "2" || e.key === "3") {
      const ps = battle?.units.filter((u) => u.team === "player") ?? [];
      const u = ps[Number(e.key) - 1];
      if (u && u.hp > 0) {
        selected = u.id;
        skill = null;
        refreshSide();
        requestDraw();
      }
    }
    if ((e.key === "q" || e.key === "Q" || e.key === "w" || e.key === "W") && selected) {
      const u = selectedUnit();
      if (u) {
        const list = skillsFor(u, unlockedSkills(run));
        const idx = e.key.toLowerCase() === "q" ? 0 : 1;
        skill = list[idx] ?? null;
        refreshSide();
        requestDraw();
      }
    }
  }
  if (e.key === "m" || e.key === "M") {
    const m = toggleMute();
    must("#btn-mute").textContent = m ? "音效关" : "音效";
  }
});

window.addEventListener("resize", () => {
  if (battle && screen === "combat") {
    view.resize(battle.w, battle.h);
    requestDraw();
  }
});

function currentTweens(): Record<string, { x: number; y: number }> {
  const t = Math.min(1, (performance.now() - lerpStart) / 140);
  if (t >= 1 || !battle) return {};
  const e = t * t * (3 - 2 * t);
  const out: Record<string, { x: number; y: number }> = {};
  for (const u of battle.units) {
    const f = lerpFrom[u.id];
    if (!f) continue;
    if (f.x === u.x && f.y === u.y) continue;
    out[u.id] = { x: f.x + (u.x - f.x) * e, y: f.y + (u.y - f.y) * e };
  }
  return out;
}

function hoverHint(): string {
  if (!battle) return "";
  const u = selectedUnit();
  const act = hoverAction();
  if (act && act.type === "skill") {
    const p = previewAction(battle, act);
    const fall = p?.events.some((e) => e.t === "fall");
    const chain = p?.events.find((e) => e.t === "chain");
    if (fall) return "预览：有人会掉进深渊";
    if (chain && chain.t === "chain") return `预览：连锁 × ${chain.n}`;
    return "预览：技能将立刻结算";
  }
  if (act && act.type === "move") return "移动到这里";
  if (skill) return "点黄格释放，右键取消";
  if (u && !u.moved) return `${u.name} 可移动 · 点青格或点敌人出手`;
  if (u && !u.acted) return `${u.name} 还可行动`;
  return "空格结束回合 · 红格将落地";
}

function frame(now: number): void {
  requestAnimationFrame(frame);
  pulse = now / 280;
  if (screen !== "combat") {
    drawTitleFx(titleFx, now);
    return;
  }
  if (!battle) return;
  const act = hoverAction();
  const preview = act ? previewAction(battle, act)?.next ?? null : null;
  view.draw({
    battle,
    selected,
    moves: currentMoves(),
    skills: currentSkills(),
    hover,
    preview,
    tweens: currentTweens(),
    pulse,
    hint: hoverHint(),
  });
}
requestAnimationFrame(frame);
