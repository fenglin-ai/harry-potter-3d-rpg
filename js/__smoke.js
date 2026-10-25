/* 无头冒烟测试：stub DOM + 加载 data.js / game.js，验证任务指引 / 背包 / 引导流程 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function makeEl(id) {
  const el = {
    id, style: {}, dataset: {}, children: [],
    textContent: '',
    className: '', disabled: false,
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
  // 模拟 DOM：innerHTML = '' 时清空子节点
  let _html = '';
  Object.defineProperty(el, 'innerHTML', {
    get() { return _html; },
    set(v) { _html = String(v); if (_html === '') el.children.length = 0; },
  });
  return el;
}

const els = {};
function getEl(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; }

const drawnTexts = [];
const ctx = new Proxy({}, {
  get: (t, p) => {
    if (p === 'measureText') return (s) => ({ width: String(s || '').length * 6 });
    if (p === 'fillText') return (s, x, y) => { drawnTexts.push({ s: String(s), x, y }); };
    if (p === 'canvas') return { width: 64, height: 64 };
    if (p === 'createRadialGradient' || p === 'createLinearGradient') return () => ({ addColorStop() {} });
    if (!(p in t)) t[p] = () => {};
    return t[p];
  },
  set: (t, p, v) => { t[p] = v; return true; },
});

const documentStub = {
  getElementById: getEl,
  createElement: makeEl,
  addEventListener() {},
  querySelectorAll() { return []; },
};
global.document = documentStub;
global.window = {
  innerWidth: 960, innerHeight: 540,
  addEventListener() {},
  matchMedia: () => ({ matches: false }),
  AudioContext: undefined, webkitAudioContext: undefined,
};
global.localStorage = {
  _d: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; },
};
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};
global.setInterval = () => 0;   // 音乐调度：禁用真实定时器
global.clearInterval = () => {};
global.setTimeout = (fn, ms) => 0;

/* three.js：只把 WebGLRenderer 换成假的，其余几何/矩阵/材质全部真实执行 */
try {
  const THREE = require('./vendor/three.min.js');
  global.THREE = THREE;
  class FakeRenderer {
    constructor(opt) {
      this.domElement = opt && opt.canvas;
      this.shadowMap = { enabled: false, type: 0 };
      this.capabilities = { isWebGL2: true, getMaxAnisotropy: () => 1, getMaxPrecision: () => 'highp' };
      this.outputColorSpace = ''; this.toneMapping = 0; this.toneMappingExposure = 1;
    }
    setPixelRatio() {} setSize() {} setClearColor() {} setAnimationLoop() {} dispose() {}
    render(scene, camera) { if (!scene || !camera) throw new Error('render() 缺少 scene/camera'); }
  }
  THREE.WebGLRenderer = FakeRenderer;
} catch (e) {
  /* 没有 three.js 时游戏会自动降级到无渲染模式，测试仍然有效 */
}

const src = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8') + '\n' +
            (global.THREE ? fs.readFileSync(path.join(__dirname, 'render3d.js'), 'utf8') + '\n' : '') +
            fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
vm.runInThisContext(src, { filename: 'game-bundle.js' });

/* ---- 断言工具 ---- */
let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.log('  ✗ FAIL: ' + msg); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

/* ---- 1. 任务指引面板 ---- */
section('任务指引面板');
freshState(); doTeleport('privet'); S.flags.seen_privet = 1;
ok(!!questTarget() && questTarget().kind === 'prop' && questTarget().id === 'letter1', '初始目标为 letter1');
openTasks();
ok(els['panelTasks'].style.display === 'flex', '任务面板打开');
ok((els['questNow'].textContent || '').indexOf('信') !== -1, '当前目标文字为读信');
const qChildren = els['questList'].children;
ok(qChildren.some(c => (c.innerHTML || '').indexOf('女贞路') !== -1), '任务清单含第一阶段');
ok(qChildren.some(c => (c.className || '').indexOf('current') !== -1), '当前任务被标记');

applyEffects({ lettersDone: 2 });
ok(questTarget().kind === 'npc' && questTarget().id === 'hagrid', '读完信后目标指向海格');
openTasks();
ok((els['questNow'].textContent || '').indexOf('海格') !== -1, '当前目标更新为找海格');

applyEffects({ hagridDone: 1 });
ok(questTarget().kind === 'tile' && questTarget().x === 21, '见完海格目标指向院门');

/* ---- 2. 背包面板 ---- */
section('背包面板');
applyEffects(null, ['letter', 'cake', 'cake']);
applyEffects({ pts: 10, gold: 100 });
openBag();
ok(els['panelBag'].style.display === 'flex', '背包面板打开');
ok(els['bagItems'].innerHTML.indexOf('生日蛋糕') !== -1 && els['bagItems'].innerHTML.indexOf('×2') !== -1, '物品与数量正确');
ok(els['bagStats'].innerHTML.indexOf('100') !== -1, '金币统计显示');
closePanels();
ok(els['panelBag'].style.display === 'none', '面板可关闭');

/* ---- 3. 院门引导（按进度出不同提示） ---- */
section('院门引导');
freshState(); S.flags.seen_privet = 1; doTeleport('privet');
closeDialog(); // 清掉前面遗留的对话状态
S.pos = { x: 21 * TS + TS / 2, y: 11 * TS + TS / 2 };
lastFailTime = -1e9;
update(0.016);
ok(dialog && dialog.id === 'd_privet_gate1', '未读信 → 提示 d_privet_gate1 (got ' + (dialog && dialog.id) + ')');
closeDialog();

applyEffects({ lettersDone: 1 });
lastFailTime = -1e9;
update(0.016);
ok(dialog && dialog.id === 'd_privet_gate2', '读一封 → 提示 d_privet_gate2 (got ' + (dialog && dialog.id) + ')');
closeDialog();

applyEffects({ lettersDone: 2 });
lastFailTime = -1e9;
update(0.016);
ok(dialog && dialog.id === 'd_privet_gate3', '读完信未找海格 → 提示 d_privet_gate3 (got ' + (dialog && dialog.id) + ')');
closeDialog();

applyEffects({ hagridDone: 1 });
lastFailTime = -1e9;
update(0.016);
ok(S.mapId === 'diagon', '找海格后穿过院门 → 到达对角巷 (got ' + S.mapId + ')');

/* ---- 4. 各地图任务目标不崩溃 ---- */
section('各地图任务目标');
const targets = ['diagon', 'station', 'train', 'hall', 'castle', 'classroom', 'pitch', 'forest', 'mirror', 'dungeon'];
targets.forEach(m => {
  freshState();
  S.mapId = m; cur = compiled[m];
  const t = questTarget();
  ok(t !== null, m + ' 有任务目标 (got ' + JSON.stringify(t) + ')');
});
freshState(); S.mapId = 'castle'; cur = compiled['castle'];
applyEffects({ broomGiven: 1, mirrorDone: 1, hasStone: 1 });
ok(questTarget() && questTarget().x === 16, '城堡最后阶段目标为地下走廊门');
applyEffects({ duelWon: 1 });
closeDialog(); // 触发结算逻辑（不会显示 credits，仅设置 flags）

/* ---- 5. 渲染包含任务标记 ---- */
section('渲染冒烟');
freshState(); doTeleport('privet'); S.flags.seen_privet = 1;
render();
ok(true, 'render() 无异常（含 drawQuestMarker）');

/* ---- 6. 真实对话流：读信 → 第二封 → 海格 → 穿门 ---- */
section('信件流程（对话框驱动）');
freshState(); S.flags.seen_privet = 1; doTeleport('privet'); closeDialog();
ok(!S.flags.lettersDone, '初始未读信');
ok(visibleProps().some(p => p.id === 'letter1'), '第一封信在场');
ok(!visibleProps().some(p => p.id === 'letter2'), '第二封信尚未出现');
startDialog('d_letter1');
let g1 = 0;
while (dialog && g1++ < 20) advanceDialog();
ok(S.flags.lettersDone === 1, '读完第一封 → lettersDone=1 (got ' + S.flags.lettersDone + ')');
ok(visibleProps().some(p => p.id === 'letter2'), '第二封信出现');
ok(questTarget().kind === 'prop' && questTarget().id === 'letter2', '目标指向第二封信');
startDialog('d_letter2');
g1 = 0;
while (dialog && g1++ < 20) advanceDialog();
ok(S.flags.lettersDone === 2, '读完第二封 → lettersDone=2 (got ' + S.flags.lettersDone + ')');
ok(visibleNpcs().some(n => n.id === 'hagrid'), '海格出现');
ok(questTarget().kind === 'npc' && questTarget().id === 'hagrid', '目标指向海格');
startDialog('d_hagrid');
g1 = 0;
while (dialog && g1++ < 30) advanceDialog();
ok(S.flags.hagridDone === 1, '海格对话后 hagridDone=1');
ok(questTarget().kind === 'tile' && questTarget().label === '院门', '目标指向院门（带标签）');
S.pos = { x: 21 * TS + TS / 2, y: 11 * TS + TS / 2 };
lastFailTime = -1e9;
update(0.016);
ok(S.mapId === 'diagon', '穿过院门到达对角巷 (got ' + S.mapId + ')');

/* ---- 7. 卡墙自动回位（礼堂→城堡传送到实心瓦片的旧 bug） ---- */
section('卡墙自动回位');
freshState(); S.mapId = 'castle'; cur = compiled['castle'];
S.pos = { x: 16 * TS + TS / 2, y: 3 * TS + TS / 2 }; // 旧版本会落在讲台 '=' 上
ok(!canStand(S.pos.x, S.pos.y), '确认 (16,3) 讲台瓦片不可站立');
doTeleport('castle');
ok(canStand(S.pos.x, S.pos.y), '传送后回位到可站立处');
ok(S.mapId === 'castle', '仍在城堡地图');

/* ---- 8. 全部传送落点可站立（防"出生在墙里"回归） ---- */
section('所有传送落点可站立');
const need = {
  privet: { hagridDone: 1 }, diagon: { wandBought: 1 },
  train: { meetRon: 1 }, hall: { sorted: 1 },
  castle: { sorted: 1, broomGiven: 1, hasStone: 1 },
  classroom: { sorted: 1 }, pitch: { broomGiven: 1 },
  forest: { unicornSeen: 1 }, mirror: { mirrorDone: 1 },
};
for (const m in compiled) {
  const d = compiled[m];
  if (!d.transitions.length) continue;
  freshState(); closeDialog();
  Object.assign(S.flags, need[m] || {});
  S.mapId = m; cur = d;
  d.transitions.forEach(tr => {
    S.mapId = m; cur = d; // 回到被测地图（上次传送会改变 cur）
    S.pos = { x: (tr.x + tr.w / 2) * TS, y: (tr.y + tr.h / 2) * TS };
    lastFailTime = -1e9;
    update(0.016);
    ok(S.mapId === tr.to && canStand(S.pos.x, S.pos.y),
      m + ' → ' + tr.to + ' 落点可站立 (got ' + S.mapId + ')');
    closeDialog();
  });
}
// go: 型传送（保持当前位置），验证落点可站立
freshState(); closeDialog();
S.mapId = 'castle'; cur = compiled['castle'];
S.pos = { x: 27 * TS + TS / 2, y: 14 * TS + TS / 2 }; // 海格旁（"跟你去禁林"时的位置）
doTeleport('forest');
ok(S.mapId === 'forest' && canStand(S.pos.x, S.pos.y),
  '海格→禁林（go 传送）落点可站立 (got ' + Math.floor(S.pos.x / TS) + ',' + Math.floor(S.pos.y / TS) + ')');

/* ---- 9. 相机：3D 轨道跟随、俯角与缩放 ---- */
section('相机行为（3D 轨道）');
freshState(); doTeleport('hall'); closeDialog();
const camAt = () => {
  const c = GFX.debug && GFX.debug.camera ? GFX.debug.camera() : null;
  return c || { x: 0, y: 0, z: 0, dist: 0, yaw: 0, pitch: 0 };
};
snapCamera();
const c0 = camAt();
/* 相机注视点要么对准玩家，要么被地图边界夹住 */
const clampX = (v) => {
  const w = cur.w * TS;
  return w <= 410 ? w / 2 : Math.max(205, Math.min(w - 205, v));
};
const clampZ = (v) => {
  const h = cur.h * TS;
  return h <= 300 ? h / 2 : Math.max(150, Math.min(h - 150, v));
};
const onPlayerX = Math.abs(c0.x - S.pos.x) < 1.5, onClampX = Math.abs(c0.x - clampX(S.pos.x)) < 1.5;
const onPlayerZ = Math.abs(c0.z - S.pos.y) < 1.5, onClampZ = Math.abs(c0.z - clampZ(S.pos.y)) < 1.5;
ok((onPlayerX || onClampX) && (onPlayerZ || onClampZ),
  '礼堂：相机注视点对准玩家（或被地图边界夹住） (look ' + c0.x.toFixed(1) + ',' + c0.z.toFixed(1) +
  ' player ' + S.pos.x.toFixed(1) + ',' + S.pos.y.toFixed(1) + ')');
ok(c0.y > 0, '相机位于地平线之上（俯视） y=' + c0.y.toFixed(1));
ok(c0.dist > 0 && isFinite(c0.dist), '相机距离有效 dist=' + c0.dist.toFixed(1));

/* 缩放：滚轮应改变相机与玩家的距离 */
const d0 = camAt().dist;
GFX.debug && GFX.debug.zoomBy ? GFX.debug.zoomBy(-400) : null;
const d1 = camAt().dist;
ok(Math.abs(d1 - d0) > 1, '滚轮缩放改变相机距离 (' + d0.toFixed(1) + ' → ' + d1.toFixed(1) + ')');
GFX.debug && GFX.debug.zoomBy ? GFX.debug.zoomBy(4000) : null;
ok(camAt().dist <= d0 * 2.2, '缩小有上限，不会拉到无限远');
GFX.debug && GFX.debug.zoomBy ? GFX.debug.zoomBy(-4000) : null;
ok(camAt().dist >= d0 * 0.3, '放大有下限，不会穿进模型');
if (GFX.debug && GFX.debug.zoomBy) GFX.debug.zoomBy(400); // 复位再拉远近似原值

/* 关键不变量：无论相机被拖到哪个角度，移动基向量必须轴对齐，
 * 否则一格宽走廊会斜着撞墙（这是 3D 化最容易踩的坑）。 */
if (GFX.debug && GFX.debug.dragBy) {
  let axisAligned = true, offAngles = [];
  for (const deg of [7, 23, 37, 44, 58, 71, 88, 103, 137, 200]) {
    GFX.setYaw(deg * Math.PI / 180);
    const b = GFX.basis();
    const okAxis = (Math.abs(b.fx) < 1e-9 || Math.abs(b.fz) < 1e-9);
    if (!okAxis) { axisAligned = false; offAngles.push(deg); }
  }
  ok(axisAligned, '任意视角下移动基向量都轴对齐' + (offAngles.length ? '（失败角度 ' + offAngles.join(',') + '）' : ''));
  GFX.setYaw(0);
}

/* 拖拽：水平拖拽改变方位角，垂直拖拽改变俯角但不越界 */
const yawA = camAt().yaw, pitchA = camAt().pitch;
if (GFX.debug && GFX.debug.dragBy) {
  GFX.debug.dragBy(120, 0);
  ok(Math.abs(camAt().yaw - yawA) > 0.05, '水平拖拽微调方位角');
  GFX.debug.dragBy(0, -900);
  ok(camAt().pitch <= pitchA + 1e-6, '俯角有下限（不会翻到地平面下）');
  GFX.debug.dragBy(0, 9000);
  ok(camAt().pitch < Math.PI / 2, '俯角有上限（不会完全垂直）');
} else {
  ok(true, '（无 debug 接口，跳过拖拽断言）');
}

/* 移动时相机始终跟随，且注视点被地图边界夹住 */
freshState(); doTeleport('hall'); closeDialog();
keys['d'] = true;
let camOk = true;
for (let i = 0; i < 240; i++) {
  update(0.016);
  const c = camAt();
  const m = cur;
  const inX = c.x >= -1 && c.x <= m.w * TS + 1;
  const inZ = c.z >= -1 && c.z <= m.h * TS + 1;
  if (!(inX && inZ && isFinite(c.x) && isFinite(c.z))) { camOk = false; break; }
}
keys['d'] = false;
ok(camOk, '移动过程中相机注视点始终在地图范围内');

/* ---- 10. 禁林小径可达（BFS 连通性） ---- */
section('禁林小径可达');
function bfsFrom(mapId, flags) {
  const prevCur = cur, prevMap = S.mapId;
  S.mapId = mapId; cur = compiled[mapId];
  Object.assign(S.flags, flags || {});
  const d = cur;
  const walkable = (x, y) => x >= 0 && y >= 0 && x < d.w && y < d.h &&
    canStand(x * TS + TS / 2, y * TS + TS / 2);
  const seen = new Set();
  const q = [[d.spawn.x, d.spawn.y]];
  seen.add(d.spawn.y * d.w + d.spawn.x);
  while (q.length) {
    const [x, y] = q.shift();
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      const k = ny * d.w + nx;
      if (seen.has(k) || !walkable(nx, ny)) return;
      seen.add(k); q.push([nx, ny]);
    });
  }
  const res = { seen, walkable, w: d.w, spawn: d.spawn };
  cur = prevCur; S.mapId = prevMap;
  return res;
}
const fr = bfsFrom('forest', { unicornSeen: 1 });
ok(fr.seen.has(6 * 32 + 3), '禁林出生点在地面');
ok(fr.seen.has(10 * 32 + 17), '血迹 (17,10) 可走到');
ok(fr.seen.has(10 * 32 + 18), '独角兽 (18,10) 可走到');
ok(fr.seen.has(13 * 32 + 26), '火雷恩 (26,13) 可走到');
ok(fr.seen.has(16 * 32 + 30), '出口 (30,16) 可走到');
// 所有 'p' 小径瓦片都应与出生点连通（看得见的路都能走）
let pathTotal = 0, pathOk = 0;
for (let y = 0; y < compiled.forest.h; y++) {
  for (let x = 0; x < compiled.forest.w; x++) {
    if (compiled.forest.g[y][x] !== 'p') continue;
    pathTotal++;
    if (fr.seen.has(y * 32 + x)) pathOk++;
  }
}
ok(pathTotal > 0 && pathOk === pathTotal,
  '所有小径瓦片都连通 (' + pathOk + '/' + pathTotal + ')');

/* ---- 11. 场景名显示 ---- */
section('场景名显示');
freshState(); doTeleport('privet');
ok(els['mapName'].textContent === '女贞路 4 号', '女贞路显示场景名 (got ' + els['mapName'].textContent + ')');
doTeleport('forest');
ok(els['mapName'].textContent === '禁林', '禁林显示场景名 (got ' + els['mapName'].textContent + ')');
doTeleport('hall');
ok(els['mapName'].textContent === '霍格沃茨礼堂', '礼堂显示场景名 (got ' + els['mapName'].textContent + ')');
ok(els['mapName'].classList.contains('flash'), '切换场景时播放闪入动画');

/* ---- 12. goSpawn：从城堡选择"跟你去禁林"落在禁林入口 ---- */
section('对话式传送落点');
freshState(); closeDialog();
S.mapId = 'castle'; cur = compiled['castle'];
S.flags.sorted = 1;
S.pos = { x: 27 * TS + TS / 2, y: 14 * TS + TS / 2 };
startDialog('d_hagrid2');
let guard = 0;
while (dialog && guard++ < 20) {
  const line = dialog.lines[dialog.idx];
  if (line && line.c) { pickChoice(line.c[0]); continue; }
  advanceDialog();
}
ok(S.mapId === 'forest', '对话选择后进入禁林 (got ' + S.mapId + ')');
ok(Math.floor(S.pos.x / TS) === compiled.forest.spawn.x && Math.floor(S.pos.y / TS) === compiled.forest.spawn.y,
  '落在禁林入口而非原地坐标 (got ' + Math.floor(S.pos.x / TS) + ',' + Math.floor(S.pos.y / TS) + ')');

/* ---- 13. 渲染坐标一致性（3D 世界坐标） ---- */
section('渲染坐标一致性（3D）');
freshState(); doTeleport('privet'); closeDialog();
S.flags.seen_privet = 1;
S.flags.lettersDone = 2;          // 让海格出现
S.pos = { x: 5 * TS + TS / 2, y: 11 * TS + TS / 2 };
snapCamera();
render(0.016);   // 先跑一帧，让 3D 节点同步到最新逻辑坐标

/* 世界坐标约定：X = 列 * TS，Z = 行 * TS，地面 y = 0 */
const nodes = GFX.debug && GFX.debug.nodes ? GFX.debug.nodes() : null;
if (nodes) {
  const pl = nodes.player;
  ok(!!pl, '玩家节点存在于场景中');
  ok(pl && Math.abs(pl.position.x - S.pos.x) < 0.5 && Math.abs(pl.position.z - S.pos.y) < 0.5,
    '玩家世界坐标与逻辑坐标一致 (node ' + (pl && pl.position.x.toFixed(1)) + ',' +
    (pl && pl.position.z.toFixed(1)) + ')');
  ok(pl && pl.position.y >= 0, '玩家站在地面上 (y=' + (pl && pl.position.y.toFixed(2)) + ')');

  const hagrid = visibleNpcs().find(n => n.id === 'hagrid');
  ok(!!hagrid, '海格在场景中');
  const hn = nodes.npcs.find(r => r.src.id === 'hagrid');
  ok(!!hn, '海格节点已构建');
  ok(hn && Math.abs(hn.group.position.x - (hagrid.x * TS + TS / 2)) < 0.5 &&
     Math.abs(hn.group.position.z - (hagrid.y * TS + TS / 2)) < 0.5,
    'NPC 世界坐标与逻辑坐标一致');

  const prop = visibleProps().find(p => p.id === 'door1');
  ok(!!prop, '德思礼家的门道具在场');
  const pn = nodes.props.find(r => r.src.id === 'door1');
  ok(!!pn, '道具节点已构建');
  ok(pn && Math.abs(pn.group.position.x - (prop.x * TS + TS / 2)) < 0.5 &&
     Math.abs(pn.group.position.z - (prop.y * TS + TS / 2)) < 0.5,
    '道具世界坐标与逻辑坐标一致');
} else {
  ok(true, '（无 debug 接口，跳过节点坐标断言）');
}

/* 任务指引 ✦ 标记跟随目标 */
freshState(); doTeleport('privet'); closeDialog();
render(0.016);
const mk = GFX.debug && GFX.debug.marker ? GFX.debug.marker() : null;
ok(!!mk, '任务指引标记存在');
const tgt = questTarget();
ok(!!tgt, '当前有任务目标');
if (mk && tgt) {
  const tx = tgt.kind === 'tile' ? tgt.x * TS + TS / 2 : null;
  ok(tx === null || Math.abs(mk.group.position.x - tx) < 0.5, '指引标记对准目标 X');
}
render(0.016);
ok(true, '连续渲染无异常');

/* ---- 14. 魔镜房间：站在镜前可以互动 ---- */
section('厄里斯魔镜互动');
freshState(); doTeleport('mirror'); closeDialog();
const mirrorProp = visibleProps().find(p => p.id === 'mirror');
ok(!!mirrorProp, '魔镜道具在场');
ok(!canStand(mirrorProp.x * TS + TS / 2, mirrorProp.y * TS + TS / 2), '镜面本身不可站立');
S.pos = { x: 8 * TS + TS / 2, y: 1 * TS + TS / 2 }; // 镜前
ok(canStand(S.pos.x, S.pos.y), '镜前 (8,1) 可站立');
const nearMirror = getNear();
ok(nearMirror && nearMirror.obj.id === 'mirror', '站在镜前能识别到魔镜 (got ' + (nearMirror && nearMirror.obj.id) + ')');
tryInteract();
ok(dialog && dialog.id === 'd_mirror', '能与魔镜对话');
closeDialog();
// 从出生点可走到镜前
function reachMap(mapId, flags) {
  const prevCur = cur, prevMap = S.mapId;
  S.mapId = mapId; cur = compiled[mapId];
  Object.assign(S.flags, flags || {});
  const d = cur;
  const seen = new Set(); const q = [[d.spawn.x, d.spawn.y]];
  seen.add(d.spawn.y * d.w + d.spawn.x);
  const walk = (x, y) => x >= 0 && y >= 0 && x < d.w && y < d.h && canStand(x * TS + TS / 2, y * TS + TS / 2);
  while (q.length) {
    const [x, y] = q.shift();
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const nx = x + dx, ny = y + dy, k = ny * d.w + nx;
      if (seen.has(k) || !walk(nx, ny)) return;
      seen.add(k); q.push([nx, ny]);
    });
  }
  const res = seen; cur = prevCur; S.mapId = prevMap; return res;
}
const mr = reachMap('mirror', {});
ok(mr.has(1 * 18 + 8), '从出生点可以走到镜前 (8,1)');

/* ---- 15. 换魔杖 ---- */
section('魔杖切换');
freshState(); closeDialog();
ok(WANDS.holly && WANDS.holly.id === 'holly', '魔杖数据带 id（存档可用）');
applyEffects({ wand: 'holly' });
ok(S.wand && S.wand.id === 'holly', '买下后装备冬青木');
ok(S.wands.indexOf('holly') !== -1, '冬青木进入已拥有列表');
S.gold = 20;
switchWand('yew');
ok(S.wand.id === 'yew' && S.gold === 13, '花 7 加隆买下并装备紫杉木 (gold=' + S.gold + ')');
switchWand('beech');
ok(S.wand.id === 'beech' && S.gold === 6, '再买山毛榉木 (gold=' + S.gold + ')');
const goldBefore = S.gold;
switchWand('holly');
ok(S.wand.id === 'holly' && S.gold === goldBefore, '切换回已拥有的魔杖不花钱');
S.gold = 0;
switchWand('yew'); // 已拥有，免费
ok(S.wand.id === 'yew', '已拥有的魔杖随时可切回');
// 未拥有且钱不够：不改变装备
freshState(); S.gold = 3;
switchWand('beech');
ok(!S.wand && S.gold === 3, '钱不够时购买失败且不扣钱');
// 背包面板渲染出 3 张魔杖卡
freshState(); applyEffects({ wand: 'holly' }); S.gold = 10;
openBag();
const wandBox = els['bagWands'];
const wandRow = wandBox.children[1];
ok(wandBox.children.length >= 2, '背包里有魔杖区块');
ok(wandRow && wandRow.children.length === 3, '魔杖列表有 3 张卡');
// 存档往返
saveGame();
const saved = JSON.parse(global.localStorage.getItem('hp1_save_v1'));
ok(saved.wand === 'holly' && Array.isArray(saved.wands) && saved.wands.indexOf('holly') !== -1,
  '存档记录当前魔杖与已拥有魔杖');


/* ---- 16. 地下走廊：逐关门的连通性 ---- */
section('地下走廊关卡连通');
function reachDungeon(flags) {
  freshState(); closeDialog();
  S.flags = Object.assign({}, flags);
  S.mapId = 'dungeon'; cur = compiled['dungeon'];
  const d = cur, W = d.w, H = d.h;
  const walk = (x, y) => x >= 0 && y >= 0 && x < W && y < H &&
    canStand(x * TS + TS / 2, y * TS + TS / 2);
  const seen = new Set([d.spawn.y * W + d.spawn.x]);
  const q = [[d.spawn.x, d.spawn.y]];
  while (q.length) {
    const [x, y] = q.shift();
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const nx = x + dx, ny = y + dy, k = ny * W + nx;
      if (seen.has(k) || !walk(nx, ny)) return;
      seen.add(k); q.push([nx, ny]);
    });
  }
  return { seen, W };
}
const dsteps = [
  [{}, [15, 10, '魔鬼网'], false],
  [{ fluffyDone: 1 }, [15, 10, '魔鬼网'], true],
  [{ fluffyDone: 1 }, [24, 10, '钥匙群'], false],
  [{ fluffyDone: 1, snareDone: 1 }, [24, 10, '钥匙群'], true],
  [{ fluffyDone: 1, snareDone: 1 }, [34, 10, '罗恩'], false],
  [{ fluffyDone: 1, snareDone: 1, keysDone: 1 }, [34, 10, '罗恩'], true],
  [{ fluffyDone: 1, snareDone: 1, keysDone: 1 }, [43, 10, '魔药'], false],
  [{ fluffyDone: 1, snareDone: 1, keysDone: 1, chessDone: 1 }, [43, 10, '魔药'], true],
  [{ fluffyDone: 1, snareDone: 1, keysDone: 1, chessDone: 1 }, [50, 10, '奇洛'], false],
  [{ fluffyDone: 1, snareDone: 1, keysDone: 1, chessDone: 1, potionsDone: 1 }, [50, 10, '奇洛'], true],
];
dsteps.forEach(([flags, [x, y, name], expect]) => {
  const r = reachDungeon(flags);
  ok(r.seen.has(y * r.W + x) === expect,
    '地下走廊 ' + JSON.stringify(flags) + ' → ' + name + (expect ? ' 可达' : ' 不可达'));
});
// 不应存在「没有 doors 条目」的门瓦片（那种门永远打不开）
const dmap = compiled['dungeon'];
let orphan = 0;
for (let y = 0; y < dmap.h; y++) for (let x = 0; x < dmap.w; x++) {
  if (dmap.g[y][x] !== 'd') continue;
  if (!dmap.doors.some(d => d.x === x && d.y === y)) orphan++;
}
ok(orphan === 0, '没有永久锁死的门瓦片（孤儿门 ' + orphan + '）');


/* ---- 17. 通关庆祝画面 ---- */
section('通关庆祝画面');
freshState();
S.pts = 100; S.gold = 42;
S.items = ['wand', 'robe'];
S.spells = ['lumos'];
S.wand = WANDS.holly;
showCredits();
ok(els['credits'].style.display === 'flex', '结算画面显示');
ok(els['gameWrap'].style.display === 'none', '游戏画面隐藏');
const ch = els['creditsBody'].innerHTML;
ok(ch.indexOf('260') !== -1, '显示学院杯总分（100+160=260）');
ok(ch.indexOf('冬青木') !== -1, '显示当前魔杖');
ok(ch.indexOf('收藏物品') !== -1 && ch.indexOf('学会咒语') !== -1, '显示物品 / 咒语统计');
ok(fxParts.length > 0, '通关时立即放出烟花粒子 (' + fxParts.length + ')');
ok(!!fxCtx, '烟花绘制上下文已创建');
stopFireworks();
ok(fxParts.length === 0, 'stopFireworks 清理粒子');
startNew();
ok(els['credits'].style.display === 'none', '再玩一次会关闭结算画面');

// 结构回归：结算层必须在 gameWrap 之外，否则会跟着 gameWrap 一起被 display:none 隐藏
const htmlSrc = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function depthAt(src, pos) {
  const re = /<div\b[^>]*>|<\/div>/g;
  let depth = 0, m;
  while ((m = re.exec(src)) && m.index < pos) {
    if (m[0].indexOf('</div') === 0) depth--; else depth++;
  }
  return depth;
}
const gwPos = htmlSrc.indexOf('<div id="gameWrap"');
const creditsPos = htmlSrc.indexOf('<div id="credits"');
ok(gwPos > 0 && creditsPos > gwPos, 'index.html 中能找到 gameWrap 与 credits');
ok(depthAt(htmlSrc, gwPos) === depthAt(htmlSrc, creditsPos),
  '结算层与 gameWrap 同级（不会被一起隐藏） depth ' + depthAt(htmlSrc, gwPos) + '/' + depthAt(htmlSrc, creditsPos));


/* ---- 18. 视角旋转（Q / R，每次 90°） ---- */
section('视角旋转');
freshState(); doTeleport('privet'); closeDialog();
if (GFX.ready) {
  GFX.setYaw(0);
  snapCamera();
  const c0r = camAt();
  const RSTEP = (typeof ROT_STEP !== 'undefined') ? ROT_STEP : Math.PI / 6;
  ok(Math.abs(RSTEP - Math.PI / 6) < 1e-9, '旋转步长为 30°（每次转动更柔和）');
  rotateView(1);
  ok(Math.abs(viewRotTarget - RSTEP) < 1e-6, '目标角度 +' + Math.round(RSTEP * 180 / Math.PI) + '°');
  for (let i = 0; i < 60; i++) { update(0.05); render(0.05); }
  ok(Math.abs(GFX.yawCurrent() - RSTEP) < 0.02,
    '视角平滑转到 ' + Math.round(RSTEP * 180 / Math.PI) + '° (got ' + GFX.yawCurrent().toFixed(3) + ')');
  /* 连按到 90°：3 次 30° */
  for (let r = 0; r < 2; r++) {
    rotateView(1);
    for (let i = 0; i < 60; i++) { update(0.05); render(0.05); }
  }
  ok(Math.abs(GFX.yawCurrent() - Math.PI / 2) < 0.02,
    '连按 3 次累计 90° (got ' + GFX.yawCurrent().toFixed(3) + ')');
  const c1r = camAt();
  ok(Math.hypot(c1r.camX - c0r.camX, c1r.camZ - c0r.camZ) > 1,
    '旋转后相机位置发生变化 (Δ=' + Math.hypot(c1r.camX - c0r.camX, c1r.camZ - c0r.camZ).toFixed(1) + ')');
  ok(Math.abs(Math.hypot(c1r.x - S.pos.x, c1r.z - S.pos.y) -
              Math.hypot(c0r.x - S.pos.x, c0r.z - S.pos.y)) < 1,
    '旋转前后相机与玩家的水平距离保持一致');
  ok(c1r.y > 0, '旋转后相机仍在地面之上');
  render(0.016);
  ok(true, '旋转后渲染无异常');
  for (let r = 0; r < 3; r++) {
    rotateView(-1);
    for (let i = 0; i < 60; i++) { update(0.05); render(0.05); }
  }
  ok(Math.abs(GFX.yawCurrent()) < 0.02, '可以转回初始角度');
} else {
  /* 无 3D 环境时退化为只验证角度累进 */
  const RSTEP = (typeof ROT_STEP !== 'undefined') ? ROT_STEP : Math.PI / 6;
  viewRot = 0; viewRotTarget = 0;
  rotateView(1);
  ok(Math.abs(viewRotTarget - RSTEP) < 1e-6, '目标角度 +' + Math.round(RSTEP * 180 / Math.PI) + '°');
  for (let i = 0; i < 60; i++) update(0.05);
  ok(Math.abs(viewRot - RSTEP) < 0.01, '视角平滑转到 ' + Math.round(RSTEP * 180 / Math.PI) + '°');
  for (let r = 0; r < 2; r++) { rotateView(1); for (let i = 0; i < 60; i++) update(0.05); }
  ok(Math.abs(viewRot - Math.PI / 2) < 0.01, '连按 3 次累计 90°');
  for (let r = 0; r < 3; r++) { rotateView(-1); for (let i = 0; i < 60; i++) update(0.05); }
  ok(Math.abs(viewRot) < 0.01, '可以转回初始角度');
}

/* ---- 19. 小地图 ---- */
section('小地图');
freshState(); doTeleport('privet'); closeDialog();
render(0.016); render(0.016); render(0.016); render(0.016); // 触发一次节流重绘
ok(typeof drawMinimap === 'function', '小地图绘制函数存在');
let miniErr = null;
try {
  for (const id of Object.keys(MAPS)) {
    doTeleport(id);
    for (let i = 0; i < 8; i++) { update(0.016); render(0.016); }
  }
} catch (e) { miniErr = e; }
ok(!miniErr, '全部地图下小地图绘制无异常' + (miniErr ? ': ' + miniErr.message : ''));
/* 任意视角下都要能画（含 30° 这种非 90° 档位） */
let rotMiniErr = null;
try {
  for (let a = 0; a < 12; a++) { rotateView(1); for (let i = 0; i < 8; i++) { update(0.05); render(0.05); } }
} catch (e) { rotMiniErr = e; }
ok(!rotMiniErr, '旋转一圈（12 × 30°）中小地图绘制无异常' + (rotMiniErr ? ': ' + rotMiniErr.message : ''));
ok(miniOn === true, '小地图默认开启');
toggleMinimap();
ok(miniOn === false, 'M 可以关闭小地图');
render(0.016);
ok(true, '关闭状态下渲染不报错');
toggleMinimap();
ok(miniOn === true, 'M 可以再次开启');

/* ---- 20. 操作说明 ---- */
section('操作说明');
let helpErr = null;
try { openHelp(); } catch (e) { helpErr = e; }
ok(!helpErr, '打开操作说明无异常' + (helpErr ? ': ' + helpErr.message : ''));
ok(els['panelHelp'].style.display === 'flex', '说明面板已显示');
const helpHtml = els['helpBody'] ? els['helpBody'].innerHTML : '';
ok(/30°/.test(helpHtml), '说明里标注了 30° 旋转步长');
for (const k of ['W', 'A', 'S', 'D', 'E', 'Q', 'R', 'T', 'B', 'M', 'H', 'Esc']) {
  ok(helpHtml.indexOf('<kbd>' + k + '</kbd>') >= 0, '说明包含按键 ' + k);
}
ok(/滚轮/.test(helpHtml) && /拖拽/.test(helpHtml), '说明包含鼠标操作');
closePanels();
ok(els['panelHelp'].style.display === 'none', 'Esc / 关闭按钮可收起说明');
/* 快捷键说明也要写进标题页 */
ok(/title-keys/.test(htmlSrc), 'index.html 标题页内嵌快捷键列表');
ok(/btnHelp/.test(htmlSrc) && /btnMap/.test(htmlSrc), 'HUD 有说明与小地图按钮');

/* ---- 21. 背景音乐（WebAudio 合成图谱） ---- */
section('背景音乐');
/* 用一个记录型 AudioContext 桩：能检查「有没有真的把声音接到 destination 上」，
 * 这类漏连音乐总线的 bug 单靠听是很难复现的。 */
function param(v) {
  const p = {
    value: v, _max: v,
    setValueAtTime(x) { p._max = Math.max(p._max, x); p.value = x; return p; },
    linearRampToValueAtTime(x) { p._max = Math.max(p._max, x); p.value = x; return p; },
    exponentialRampToValueAtTime(x) { p._max = Math.max(p._max, x); p.value = x; return p; },
  };
  return p;
}
const aNodes = [];
function aNode(kind) {
  const n = {
    _kind: kind, _out: [],
    gain: param(1), frequency: param(440), detune: param(0), delayTime: param(0),
    type: '',
    connect(x) { n._out.push(x); return x; },
    disconnect() {},
    start() {}, stop() {},
  };
  aNodes.push(n);
  return n;
}
const aDest = { _isDest: true };
const aCtx = {
  state: 'running', sampleRate: 44100, currentTime: 0, destination: aDest,
  createOscillator: () => aNode('osc'),
  createGain: () => aNode('gain'),
  createBiquadFilter: () => aNode('filter'),
  createDelay: () => aNode('delay'),
  createBufferSource: () => aNode('src'),
  createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len || 1) }),
  resume: () => Promise.resolve(),
};
global.window.AudioContext = function () { return aCtx; };

ok(BARS.length === 8, '和弦进行是 8 小节的循环');
ok(BARS.every(b => b.mel.length === 3 && b.chord.length === 3), '每小节 3 拍、3 个旋律音与 3 个和弦音');
ok(BEAT >= 0.35 && BEAT <= 0.55, '速度在孩子能接受的舒缓区间（BEAT=' + BEAT + '）');
/* C 大调：主和弦应当是 C-E-G */
const firstChord = BARS[0].chord.map(n => n % 12).sort((a, b) => a - b).join(',');
ok(firstChord === '0,4,7', '开头是 C 大三和弦（明亮、适合儿童）');

let musicErr = null;
try {
  ensureAudio();
  musicBus = null;
  startMusic();
  for (let i = 0; i < 6; i++) { aCtx.currentTime += 1.3; pumpMusic(); }
} catch (e) { musicErr = e; }
ok(!musicErr, '音乐调度无异常' + (musicErr ? ': ' + musicErr.message : ''));

const oscCount = aNodes.filter(n => n._kind === 'osc').length;
ok(oscCount > 30, '确实生成了大量音符振荡器（' + oscCount + '）');
const loud = aNodes.filter(n => n._kind === 'gain' && n.gain._max > 0.02);
ok(loud.length > 10, '存在足够响的音符包络（' + loud.length + ' 个增益 > 0.02）');
/* 从最响的增益节点出发，必须能一路连到 destination，否则就是静音 bug */
function reachesDest(start) {
  const seen = new Set();
  const stack = [start];
  while (stack.length) {
    const n = stack.pop();
    if (n === aDest) return true;
    if (!n || seen.has(n)) continue;
    seen.add(n);
    for (const o of (n._out || [])) stack.push(o);
  }
  return false;
}
ok(loud.length > 0 && loud.some(n => reachesDest(n)), '音符能连到 destination（不是静音）');
ok(!!musicBus && reachesDest(musicBus), '音乐总线接到了 destination');
ok(!!musicEcho, '存在延迟回声节点（大厅感）');
stopMusic();

/* ---- 22. 答题选项随机 ---- */
section('答题选项随机');
ok(shuffleList([0, 1, 2, 3]).sort().join('') === '0123', '打乱后仍是同一组选项，不会丢项');
let firsts = new Set();
for (let i = 0; i < 60; i++) firsts.add(shuffleList([0, 1, 2, 3])[0]);
ok(firsts.size >= 3, '正确项不会永远排在第一（首位出现过 ' + firsts.size + ' 种下标）');
ok(shuffleList([]).length === 0 && shuffleList([7]).join('') === '7', '空数组 / 单元素不报错');

console.log('\n结果：' + pass + ' 通过，' + fail + ' 失败');
process.exit(fail ? 1 : 0);
