/* 完整流程复现：从女贞路一路走到麦格教授场景，验证每一步移动都正常 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function makeEl(id) {
  const el = {
    id, style: {}, dataset: {}, children: [],
    textContent: '', innerHTML: '', className: '', disabled: false,
    classList: { _s: [], add(c) { if (this._s.indexOf(c) < 0) this._s.push(c); }, remove(c) { const i = this._s.indexOf(c); if (i >= 0) this._s.splice(i, 1); }, contains(c) { return this._s.indexOf(c) >= 0; } },
    offsetWidth: 100,
    addEventListener() {},
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); },
    insertBefore(c, ref) { this.children.push(c); return c; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540, right: 960, bottom: 540 }; },
    getContext: () => ctx,
    remove() {},
  };
  return el;
}
const els = {};
function getEl(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; }
const ctx = new Proxy({}, {
  get: (t, p) => { if (p === 'measureText') return (s) => ({ width: String(s || '').length * 6 }); if (!(p in t)) t[p] = () => {}; return t[p]; },
  set: (t, p, v) => { t[p] = v; return true; },
});
global.document = { getElementById: getEl, createElement: makeEl, addEventListener() {}, querySelectorAll() { return []; } };
global.window = { innerWidth: 960, innerHeight: 540, addEventListener() {}, matchMedia: () => ({ matches: false }), AudioContext: undefined, webkitAudioContext: undefined };
global.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};
global.setInterval = () => 0;
global.clearInterval = () => {};
global.setTimeout = () => 0;

const src = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8') + '\n' +
            fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
vm.runInThisContext(src, { filename: 'bundle.js' });

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL: ' + msg); } }
function section(t) { console.log('\n== ' + t + ' =='); }

/* 3D 化后 WASD 是「相对相机」的：给定想走的世界方向，反解该按哪个键。
 * 引擎里：wx = vx*rx - vy*fx ; wy = vx*rz - vy*fz （rx=-fz, rz=fx，det=1）
 * 反解得：vx = -fz*wx + fx*wy ; vy = -fx*wx - fz*wy */
function keyFor(dx, dy) {
  const b = viewBasis();
  const L = Math.hypot(dx, dy) || 1;
  const wx = dx / L, wy = dy / L;
  const vx = -b.fz * wx + b.fx * wy;
  const vy = -b.fx * wx - b.fz * wy;
  return Math.abs(vx) >= Math.abs(vy) ? (vx < 0 ? 'a' : 'd') : (vy < 0 ? 'w' : 's');
}

/* 走到目标瓦片中心（先对齐横轴再走纵轴，避免一格宽通道卡角） */
function walkTo(tx, ty, max) {
  const startMap = S.mapId;
  const gx = tx * TS + TS / 2, gy = ty * TS + TS / 2;
  for (let steps = 0; steps < (max || 800); steps++) {
    if (S.mapId !== startMap) return true; // 中途触发了传送，视为到达
    const dx = gx - S.pos.x, dy = gy - S.pos.y;
    if (Math.abs(dx) < 12 && Math.abs(dy) < 8) return true;
    for (const k in keys) delete keys[k];
    /* 只走一个轴：优先横轴，接近后改走纵轴 */
    const axis = Math.abs(dx) > 10 ? { x: dx, y: 0 } : { x: 0, y: dy };
    keys[keyFor(axis.x, axis.y)] = true;
    const bx = S.pos.x, by = S.pos.y;
    update(0.05);
    if (Math.abs(S.pos.x - bx) < 0.01 && Math.abs(S.pos.y - by) < 0.01) {
      // 被挡住：改走另一个轴，尝试绕开
      for (const k in keys) delete keys[k];
      const alt = Math.abs(dx) > 10 ? { x: 0, y: dy } : { x: dx, y: 0 };
      keys[keyFor(alt.x, alt.y)] = true;
      update(0.016);
    }
  }
  console.log('   [walkTo fail] target', tx, ty, 'pos', S.pos.x.toFixed(1), S.pos.y.toFixed(1),
    'tile', Math.floor(S.pos.x / TS), Math.floor(S.pos.y / TS),
    'map', S.mapId, 'dialog', dialog && dialog.id);
  return false;
}
/* 关闭当前对话（逐行推进；遇到选择支自动选第一项） */
function finishDialog() {
  let g = 0;
  while (dialog && g++ < 40) {
    const line = dialog.lines[dialog.idx];
    if (line && line.c) { pickChoice(line.c[0]); continue; }
    advanceDialog();
  }
  ok(!dialog, '对话已关闭（剩 ' + (dialog && dialog.id) + '）');
}
/* 关闭当前迷你游戏（等价于按 Esc 跳过） */
function closeMini() {
  if (!currentMini) return;
  if (currentMini.clickCleanup) currentMini.clickCleanup();
  cancelMiniRaf();
  $('mini').style.display = 'none';
  currentMini = null;
}

/* 交互面前最近的 NPC / 道具 */
function interactNear() {
  const n = getNear();
  ok(!!n, '附近有可交互目标 (' + (n && n.obj.id) + ')');
  if (!n) console.log('   [fail ctx] mapId=' + S.mapId + ' tile=' + Math.floor(S.pos.x / TS) + ',' + Math.floor(S.pos.y / TS) + ' dialog=' + (dialog && dialog.id) + ' pos=' + S.pos.x.toFixed(0) + ',' + S.pos.y.toFixed(0));
  if (n) tryInteract();
}
/* 移动冒烟：按一下方向键，位置应变化 */
function moveWorks(where) {
  const bx = S.pos.x, by = S.pos.y;
  keys['d'] = true;
  update(0.05);
  keys['d'] = false;
  const moved = Math.hypot(S.pos.x - bx, S.pos.y - by) > 1;
  if (!moved) { // 试着向下
    keys['s'] = true;
    update(0.05);
    keys['s'] = false;
  }
  const moved2 = Math.hypot(S.pos.x - bx, S.pos.y - by) > 1;
  ok(moved || moved2, where + '：按键后玩家可以移动');
}

/* ================= 流程 ================= */
section('女贞路 → 海格 → 对角巷');
freshState(); S.flags.seen_privet = 1; doTeleport('privet');
moveWorks('女贞路出生点');
walkTo(9, 5, 300);          // 第一封信
interactNear();             // d_letter1
finishDialog();
ok(S.flags.lettersDone === 1, '读完第一封信 lettersDone=1');
walkTo(12, 10, 300);        // 第二封信（新位置）
interactNear();             // d_letter2
finishDialog();
ok(S.flags.lettersDone === 2, '读完第二封信 lettersDone=2');
walkTo(19, 11, 300);        // 海格
moveWorks('海格面前');
interactNear();             // d_hagrid
finishDialog();
ok(S.flags.hagridDone === 1, '海格对话完成');
walkTo(21, 11, 200);
ok(S.mapId === 'diagon', '穿过院门 → 对角巷 (got ' + S.mapId + ')');

section('对角巷 → 车站');
walkTo(4, 5, 200);          // 拉环（古灵阁）
interactNear(); finishDialog();
ok(S.flags.gringottsDone === 1, '古灵阁取金完成');
walkTo(14, 5, 200);         // 奥利凡德
interactNear(); finishDialog();
ok(S.flags.wandBought === 1, '买到魔杖');
walkTo(23, 5, 400);         // 书店
interactNear(); finishDialog();
walkTo(4, 9, 700);          // 摩金夫人
interactNear(); finishDialog();
walkTo(28, 7, 300);
ok(S.mapId === 'station', '到站台 (got ' + S.mapId + ')');
finishDialog();             // 关闭入场对话 d_station 再走动

section('站台 → 列车 → 礼堂（麦格教授场景）');
walkTo(8, 6, 200);          // 罗恩（站台）
interactNear(); finishDialog();
walkTo(15, 6, 300);         // 9¾ 站台入口（入口贴图在墙里，站旁边即可）
interactNear(); finishDialog();
ok(S.mapId === 'train', '穿墙进入列车 (got ' + S.mapId + ')');
finishDialog();             // 关闭入场对话 d_train_enter 再走动
walkTo(6, 6, 200);          // 罗恩（车厢）
interactNear(); finishDialog();
walkTo(12, 6, 200);         // 赫敏
interactNear(); finishDialog();
walkTo(23, 5, 200);         // 蟾蜍
interactNear(); finishDialog();
walkTo(26, 6, 300);
ok(S.mapId === 'hall', '到达礼堂 (got ' + S.mapId + ')');
ok(!!dialog, '入场对话已弹出（d_hall_enter）');
finishDialog();
moveWorks('礼堂对话关闭后可移动');

section('礼堂 → 城堡（麦格教授送扫帚）');
walkTo(12, 8, 300);         // 分院帽
interactNear();             // d_sort（有选择）
ok(!!dialog, '分院帽对话弹出');
finishDialog();
ok(S.flags.sorted === 1, '分院完成 sorted=1');
walkTo(24, 7, 300);
ok(S.mapId === 'castle', '进入城堡 (got ' + S.mapId + ')');
moveWorks('城堡出生点');
walkTo(20, 4, 200);         // 麦格教授
moveWorks('麦格教授面前');
interactNear();             // d_mcgonagall（有选择）
ok(!!dialog, '麦格教授对话弹出');
finishDialog();
ok(S.flags.broomGiven === 1, '麦格教授送扫帚 broomGiven=1');
moveWorks('麦格教授对话后仍可移动');

section('城堡内四处走动（绕圈移动，排查卡死）');
function backToCastle() {
  closeDialog();
  S.mapId = 'castle'; cur = compiled['castle'];
  S.pos = { x: 16 * TS + TS / 2, y: 4 * TS + TS / 2 };
  snapCamera();
}
backToCastle(); ok(walkTo(16, 4, 300), '城堡 → 出生点');
backToCastle(); ok(walkTo(27, 14, 700), '城堡 → 海格 (27,14)');
backToCastle(); ok(walkTo(2, 7, 700), '城堡 → 教室门旁');
backToCastle(); ok(walkTo(31, 7, 700), '城堡 → 球场门旁');
backToCastle(); ok(walkTo(7, 2, 700), '城堡 → 魔镜房间门旁');
backToCastle(); ok(walkTo(16, 15, 700), '城堡 → 地下走廊门旁');
moveWorks('城堡全图走动正常');

section('禁林（沿小径实际走一遍）');
freshState(); closeDialog();
S.mapId = 'castle'; cur = compiled['castle'];
S.flags.sorted = 1;
S.pos = { x: 27 * TS + TS / 2, y: 14 * TS + TS / 2 }; // 海格身旁
startDialog('d_hagrid2');
finishDialog();             // 选第一项「我跟你去禁林看看」
ok(S.mapId === 'forest', '进入禁林 (got ' + S.mapId + ')');
ok(Math.floor(S.pos.x / TS) === compiled.forest.spawn.x, '落在禁林入口');
finishDialog();             // 关闭海格在禁林的对话
moveWorks('禁林入口');

// 沿小径实际走：入口 → 血迹 → 出口
ok(walkTo(8, 6, 500), '小径：入口 → (8,6)');
ok(walkTo(8, 11, 500), '小径：向南 → (8,11)');
ok(walkTo(17, 10, 900), '小径：向东 → 血迹 (17,10)');
interactNear();             // d_unicorn
ok(!!dialog, '血迹对话弹出');
finishDialog();
ok(S.flags.unicornSeen === 1, '看过独角兽 unicornSeen=1');
ok(walkTo(21, 11, 600), '小径：向东 → (21,11)');
ok(walkTo(21, 14, 500), '小径：向南 → (21,14)');
ok(walkTo(29, 14, 900), '小径：向东 → (29,14)');
ok(walkTo(30, 16, 500), '小径：走到出口 (30,16)');
ok(S.mapId === 'castle', '禁林出口 → 返回城堡 (got ' + S.mapId + ')');
ok(S.flags.forestDone === 1, 'forestDone 标记写入');


section('地下走廊（逐关实际走一遍）');
freshState(); closeDialog();
S.mapId = 'castle'; cur = compiled['castle'];
S.flags = { sorted: 1, hasStone: 1, fluffyDone: 1 };
doTeleport('dungeon');
finishDialog();
ok(S.mapId === 'dungeon', '进入地下走廊');
ok(walkTo(9, 10, 600), '穿过三头犬房门 (9,10)');
ok(walkTo(12, 10, 400), '进入魔鬼网走廊');
ok(walkTo(15, 10, 500), '走到蠕动的藤蔓 (15,10)');
interactNear();
ok(!!dialog, '藤蔓对话弹出');
finishDialog();                 // 对话推进到迷你游戏
closeMini();                    // 跳过谜题（等价于按 Esc）
applyEffects({ snareDone: 1 });
ok(walkTo(18, 10, 600), '穿过魔鬼网房门 (18,10)');
ok(walkTo(24, 10, 700), '走到盘旋的钥匙群 (24,10)');
applyEffects({ keysDone: 1 });
ok(walkTo(27, 10, 600), '穿过钥匙房门 (27,10)');
ok(walkTo(34, 10, 800), '走到罗恩（巫师棋） (34,10)');
applyEffects({ chessDone: 1 });
ok(walkTo(38, 10, 600), '穿过棋局房门 (38,10)');
ok(walkTo(43, 10, 600), '走到魔药瓶 (43,10)');
applyEffects({ potionsDone: 1 });
ok(walkTo(45, 10, 500), '穿过魔药房门 (45,10)');
ok(walkTo(50, 10, 900), '走到奇洛教授 (50,10)');
moveWorks('地下走廊全程可移动');

console.log('\n结果：' + pass + ' 通过，' + fail + ' 失败');
process.exit(fail ? 1 : 0);
