/* 3D 渲染引擎无头冒烟测试
 * 用 stub DOM + stub WebGLRenderer（其余 three.js 代码全部真实执行）
 * 跑通所有地图的加载、角色构建、相机旋转与逐帧渲染。 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

/* ---------------- 最小 DOM stub ---------------- */
const canvasStub = {
  width: 960, height: 540,
  getContext: () => ctx2d,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540, right: 960, bottom: 540 }),
  addEventListener() {}, removeEventListener() {},
  style: {},
};
const gradientStub = { addColorStop() {} };
const ctx2d = new Proxy({}, {
  get: (t, p) => {
    if (p === 'measureText') return (s) => ({ width: String(s || '').length * 6 });
    if (p === 'canvas') return canvasStub;
    if (p === 'createRadialGradient' || p === 'createLinearGradient' || p === 'createPattern') return () => gradientStub;
    if (p === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0)) * 4), width: w | 0, height: h | 0 });
    if (!(p in t)) t[p] = () => {};
    return t[p];
  },
  set: (t, p, v) => { t[p] = v; return true; },
});

function makeEl(id) {
  const el = {
    id, style: {}, dataset: {}, children: [],
    textContent: '', innerHTML: '', className: '',
    disabled: false, offsetWidth: 100, offsetHeight: 40,
    classList: {
      _s: [],
      add(c) { if (this._s.indexOf(c) < 0) this._s.push(c); },
      remove(c) { const i = this._s.indexOf(c); if (i >= 0) this._s.splice(i, 1); },
      contains(c) { return this._s.indexOf(c) >= 0; },
    },
    addEventListener() {}, removeEventListener() {},
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); },
    insertBefore(c) { this.children.push(c); return c; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540, right: 960, bottom: 540 }; },
    getContext: () => ctx2d,
    remove() {},
    focus() {},
  };
  return el;
}
const els = {};
function getEl(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; }
global.document = {
  getElementById: getEl,
  createElement: (t) => (t === 'canvas' ? canvasStub : makeEl(t)),
  addEventListener() {},
  querySelectorAll() { return []; },
};
global.window = {
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 2,
  addEventListener() {}, matchMedia: () => ({ matches: false }),
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
global.setInterval = () => 0;
global.clearInterval = () => {};
global.setTimeout = () => 0;
global.performance = global.performance || { now: () => Date.now() };

/* ---------------- three.js（只替换 WebGLRenderer） ---------------- */
const THREE = require('./vendor/three.min.js');
global.THREE = THREE;
let renderCalls = 0;
class FakeRenderer {
  constructor(opt) {
    this.domElement = opt && opt.canvas;
    this.shadowMap = { enabled: false, type: 0 };
    this.capabilities = { isWebGL2: true, getMaxAnisotropy: () => 1, getMaxPrecision: () => 'highp' };
    this.outputColorSpace = '';
    this.toneMapping = 0;
    this.toneMappingExposure = 1;
  }
  setPixelRatio() {}
  setSize() {}
  setClearColor() {}
  setAnimationLoop() {}
  render(scene, camera) {
    renderCalls++;
    if (!scene || !camera) throw new Error('render() 缺少 scene/camera');
    if (!(camera.projectionMatrix && camera.matrixWorld)) throw new Error('camera 矩阵未初始化');
  }
  dispose() {}
}
THREE.WebGLRenderer = FakeRenderer;

/* ---------------- 载入 data + render3d + game ---------------- */
const src = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8') + '\n' +
            fs.readFileSync(path.join(__dirname, 'render3d.js'), 'utf8') + '\n' +
            fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
vm.runInThisContext(src, { filename: 'bundle3d.js' });

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) pass++;
  else { fail++; console.log('  ✗ FAIL: ' + msg); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

/* ---------------- 1. 初始化 ---------------- */
section('3D 渲染器初始化');
ok(GFX.ready === true, '渲染器初始化成功' + (GFX.ready ? '' : '（错误：' + GFX.error + '）'));
if (!GFX.ready) process.exit(1);

/* ---------------- 2. 每张地图 ---------------- */
section('全部地图加载与渲染');
const mapIds = Object.keys(MAPS);
ok(mapIds.length >= 10, '地图数量 ' + mapIds.length + ' 张');
for (const id of mapIds) {
  let err = null;
  try {
    doTeleport(id);
    for (let i = 0; i < 15; i++) { update(0.016); render(0.016); }
    keys['d'] = true;
    for (let i = 0; i < 12; i++) { update(0.016); render(0.016); }
    keys['d'] = false;
    keys['w'] = true;
    for (let i = 0; i < 12; i++) { update(0.016); render(0.016); }
    keys['w'] = false;
    ok(canStand(S.pos.x, S.pos.y), '地图 ' + id + '：移动后仍站在合法位置');
  } catch (e) { err = e; }
  ok(!err, '地图 ' + id + ' 无异常' + (err ? ': ' + err.message + '\n' + (err.stack || '').split('\n')[1] : ''));
}

/* ---------------- 3. 视角旋转 ---------------- */
section('视角旋转');
doTeleport('privet');
const RSTEP = (typeof ROT_STEP !== 'undefined') ? ROT_STEP : Math.PI / 6;
ok(Math.abs(RSTEP - Math.PI / 6) < 1e-9, '旋转步长为 30°（' + Math.round(RSTEP * 180 / Math.PI) + '°）');
const yaw0 = GFX.yawCurrent();
rotateView(1);
for (let i = 0; i < 80; i++) { update(0.016); render(0.016); }
ok(Math.abs(GFX.yawCurrent() - (yaw0 + RSTEP)) < 0.02,
   'Q 单次旋转 ' + Math.round(RSTEP * 180 / Math.PI) + '°（当前 ' + GFX.yawCurrent().toFixed(3) + '）');
/* 连按 3 次应正好回到 90°，且每次都平滑收敛 */
let rotOk = true;
for (let r = 0; r < 2; r++) {
  rotateView(1);
  for (let i = 0; i < 80; i++) { update(0.016); render(0.016); }
  if (Math.abs(GFX.yawCurrent() - (yaw0 + RSTEP * (r + 2))) > 0.02) rotOk = false;
}
ok(rotOk && Math.abs(GFX.yawCurrent() - (yaw0 + Math.PI / 2)) < 0.02,
   '连按 3 次累计 90°（当前 ' + GFX.yawCurrent().toFixed(3) + '）');
for (let r = 0; r < 3; r++) {
  rotateView(-1);
  for (let i = 0; i < 80; i++) { update(0.016); render(0.016); }
}
ok(Math.abs(GFX.yawCurrent() - yaw0) < 0.02, 'R 反向旋转复位');

/* ---------------- 4. 缩放 ---------------- */
section('窗口缩放');
let err2 = null;
try {
  GFX.resize(768, 1024); render(0.016);
  GFX.resize(1920, 1080); render(0.016);
  GFX.resize(320, 480); render(0.016);
} catch (e) { err2 = e; }
ok(!err2, '多分辨率 resize 无异常' + (err2 ? ': ' + err2.message : ''));

/* ---------------- 5. 小孩体型（《魔法石》版哈利） ---------------- */
section('小孩体型：头身比与五官');

const M = R3.debug;

/* 找出头部球：全身只有头用 r=6.6 的球（后脑发 7.0、发盖 7.05、手 2.4、肩 2.9） */
function findHead(rig) {
  let head = null;
  rig.body.traverse(o => {
    if (o.isMesh && o.geometry && o.geometry.type === 'SphereGeometry' &&
        o.geometry.parameters && Math.abs(o.geometry.parameters.radius - 6.6) < 1e-6) head = o;
  });
  return head;
}
/* 找出胸腔方块：BoxGeometry(12.6, 9.6, 9.2) 是唯一的 */
function findChest(rig) {
  let chest = null;
  rig.body.traverse(o => {
    if (o.isMesh && o.geometry && o.geometry.type === 'BoxGeometry') {
      const p = o.geometry.parameters;
      if (Math.abs(p.width - 12.6) < 1e-6 && Math.abs(p.height - 9.6) < 1e-6) chest = o;
    }
  });
  return chest;
}
function hasScar(rig) {
  let found = false;
  rig.body.traverse(o => {
    if (o.isMesh && o.geometry && o.geometry.type === 'BoxGeometry') {
      const p = o.geometry.parameters;
      if (Math.abs(p.width - 0.5) < 1e-6 && Math.abs(p.height - 1.3) < 1e-6 &&
          Math.abs(p.depth - 0.4) < 1e-6) found = true;
    }
  });
  return found;
}
function ringMeshes(rig) {
  const out = [];
  rig.body.traverse(o => { if (o.isMesh && o.geometry && o.geometry.type === 'TorusGeometry') out.push(o); });
  return out;
}
function anyNaN(rig) {
  let bad = false;
  rig.group.traverse(o => {
    for (const v of [o.position.x, o.position.y, o.position.z,
                     o.scale.x, o.scale.y, o.scale.z]) {
      if (!isFinite(v)) bad = true;
    }
  });
  return bad;
}

const kidRig = M.makeHumanoid({ kid: true, harry: true, iris: 0x4a86c8, glasses: true, glassColor: 0x1c1f28 });
const adultRig = M.makeHumanoid({ harry: true, glasses: true, glassColor: 0x1c1f28 });

const kidHead = findHead(kidRig), adultHead = findHead(adultRig);
ok(!!kidHead && !!adultHead, '两套体型都能找到头部球');
ok(kidHead.scale.x > adultHead.scale.x * 1.05,
   '小孩的头更大（' + kidHead.scale.x.toFixed(3) + ' vs ' + adultHead.scale.x.toFixed(3) + '）');

/* 真正决定「显小」的是头高比，不是绝对尺寸 */
const kidRatio = (2 * 6.6 * kidHead.scale.x) / kidRig.height;
const adultRatio = (2 * 6.6 * adultHead.scale.x) / adultRig.height;
ok(kidRatio > adultRatio * 1.08,
   '头身比更幼（' + kidRatio.toFixed(3) + ' vs ' + adultRatio.toFixed(3) + '）');
ok(kidRig.height < adultRig.height, '小孩整体更矮（' + kidRig.height.toFixed(1) + ' vs ' + adultRig.height + '）');

/* 回归点：躯干必须「更窄」。曾经把头部放大系数也乘到胸腔上，
 * 结果小孩的胸比成人还宽 11%，两条胳膊整根埋进胸腔里变成一块方砖。 */
const kidChest = findChest(kidRig), adultChest = findChest(adultRig);
ok(kidChest.scale.x < adultChest.scale.x * 0.95,
   '小孩的躯干更窄，不是更宽（' + kidChest.scale.x.toFixed(3) + ' vs ' + adultChest.scale.x.toFixed(3) + '）');
ok(kidChest.scale.x < 1, '躯干宽度系数 < 1（' + kidChest.scale.x.toFixed(3) + '）');

/* 眼镜：两个环绝不能叠成「8」字。
 * 环外径 = (radius + tube) * 眼组缩放；两个环心相距 2 * EX。 */
for (const [name, rig] of [['小孩', kidRig], ['成人', adultRig]]) {
  const rings = ringMeshes(rig);
  ok(rings.length === 2, name + '：两只镜片环（' + rings.length + '）');
  if (rings.length === 2) {
    const outer = (rings[0].geometry.parameters.radius + rings[0].geometry.parameters.tube) * rings[0].parent.scale.x;
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    rings[0].getWorldPosition(a); rings[1].getWorldPosition(b);
    const sep = Math.abs(a.x - b.x);
    ok(sep > outer * 2, name + '：两环不重叠（间距 ' + sep.toFixed(2) + ' > 外径 ' + (outer * 2).toFixed(2) + '）');
    /* 哈利的镜框是黑的，不是黄铜 */
    const c = rings[0].material.color;
    const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
    ok(lum < 0.25, name + '：镜框是暗色圆黑框（亮度 ' + lum.toFixed(3) + '）');
  }
}

/* 蓝色虹膜：只有配了 iris 的角色才有眼珠层 */
function hasIris(rig) {
  let found = false;
  rig.body.traverse(o => {
    if (o.isMesh && o.geometry && o.geometry.type === 'BoxGeometry') {
      const p = o.geometry.parameters;
      if (Math.abs(p.width - 1.72) < 1e-6 && Math.abs(p.height - 1.88) < 1e-6) found = true;
    }
  });
  return found;
}
ok(hasIris(kidRig), '哈利有蓝色虹膜层');
ok(!hasIris(M.makeHumanoid({ kid: true })), '没配 iris 的小孩不加虹膜层');

/* 闪电疤只属于哈利：罗恩额头上不能长疤 */
ok(hasScar(kidRig), '哈利头上有闪电疤');
ok(!hasScar(M.makeHumanoid({ kid: true })), '其他小孩没有闪电疤');

ok(!anyNaN(kidRig) && !anyNaN(adultRig), '所有网格的位置/缩放都是有限数');

/* ---------------- 6. 谁按小孩建 ---------------- */
section('一年级新生都按小孩体型建');
const KID_IDS = [
  'ron_train', 'ron_castle', 'ron_hall', 'ron_class', 'ron_chess',
  'hermione_train', 'hermione_castle', 'hermione_hall', 'hermione_class',
  'neville_train', 'malfoy_diagon', 'malfoy_pitch', 'malfoy_station',
];
/* 成人：罗恩的妈妈最容易踩坑——不能拿 /^ron/ 一刀切 */
const ADULT_IDS = [
  'hagrid', 'hagrid2', 'hagrid_forest', 'dumbledore',
  'mcgonagall', 'mcgonagall_hall', 'snape', 'quirrell', 'flitwick',
  'ron_mum', 'wood', 'ollivander', 'madam_malkin',
];
/* 先确认这些 id 真的出现在地图的 npcs 里，否则等于在测幽灵数据。
 * （trolley 是 props、harry 是玩家，都不能算进来） */
const liveIds = {};
for (const id of Object.keys(MAPS)) {
  for (const n of (MAPS[id].npcs || [])) liveIds[n.id] = true;
}
const missing = KID_IDS.concat(ADULT_IDS).filter(id => liveIds[id] !== true);
ok(missing.length === 0, '测试用到的 id 都真实存在（缺：' + (missing.join(',') || '无') + '）');

const kidBad = KID_IDS.filter(id => M.npcStyle({ id: id }).kid !== true);
ok(kidBad.length === 0, '学生全部 kid=true（漏了：' + (kidBad.join(',') || '无') + '）');
const adultBad = ADULT_IDS.filter(id => M.npcStyle({ id: id }).kid === true);
ok(adultBad.length === 0, '成人全部不加小孩体型（误加：' + (adultBad.join(',') || '无') + '）');

ok(typeof M.npcStyle({ id: 'ron_train' }).iris === 'number', '罗恩有瞳色');
ok(typeof M.npcStyle({ id: 'hermione_hall' }).iris === 'number', '赫敏有瞳色');
ok(M.npcStyle({ id: 'ron_mum' }).iris === undefined, '罗恩的妈妈没有小孩瞳色');

/* 玩家角色和哈利 NPC 共用 HARRY_STYLE，两边必须一致 */
const hp = M.npcStyle({ id: 'harry' });
ok(hp.harry === true && hp.glasses === true && hp.kid === true && hp.iris === 0x4a86c8,
   '哈利 NPC 预设：疤痕 + 黑框 + 小孩体型 + 蓝眼');

/* ---------------- 7. 真实的玩家角色 ---------------- */
section('游戏里的主角确实是小孩版');
doTeleport('privet');
const realPlayer = M.playerRig();
ok(!!realPlayer, '玩家角色已构建');
if (realPlayer) {
  const rh = findHead(realPlayer);
  ok(!!rh, '能定位玩家的头部球');
  if (rh) {
    ok(rh.scale.x > 1.05, '玩家头按小孩比例放大（' + rh.scale.x.toFixed(3) + '）');
    /* 玩家带 group.scale（1.15），头身比要把这个缩放一并算进去才是量纲一致的 */
    const ps = realPlayer.group.scale.x || 1;
    const rRatio = (2 * 6.6 * rh.scale.x * ps) / realPlayer.height;
    ok(rRatio > adultRatio * 1.08, '玩家头身比更幼（' + rRatio.toFixed(3) + ' vs ' + adultRatio.toFixed(3) + '）');
  }
  ok(hasScar(realPlayer), '玩家（哈利）有闪电疤');
  ok(hasIris(realPlayer), '玩家有蓝色虹膜');
  ok(!anyNaN(realPlayer), '玩家模型无 NaN');
}

/* ---------------- 8. 输出 ---------------- */
console.log('\nrender() 调用次数：' + renderCalls);
ok(renderCalls > 100, '渲染循环正常执行');
console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
