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
  // 疤是多段细条拼的闪电，靠 mesh.name 认，不要靠 BoxGeometry 的尺寸
  rig.body.traverse(o => { if (o.isMesh && o.name === 'scar') found = true; });
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

/* 蓝色虹膜：只有配了 iris 的角色才有眼珠层。
 * 眼球现在是压扁的球，靠 geometry.name 认（见 render3d 的 named()）。 */
function hasIris(rig) {
  let found = false;
  rig.body.traverse(o => { if (o.isMesh && o.geometry && o.geometry.name === 'iris') found = true; });
  return found;
}
ok(hasIris(kidRig), '哈利有蓝色虹膜层');
ok(!hasIris(M.makeHumanoid({ kid: true })), '没配 iris 的小孩不加虹膜层');

/* 后脑勺不能秃：这是真 bug。hairBack 的 z 半轴 + 中心偏移必须盖过头部后沿，
 * 否则从背后看整个后脑勺是皮肤色。 */
function backHeadCovered(rig) {
  let head = null, back = null;
  rig.body.traverse(o => {
    if (!o.isMesh || !o.geometry || o.geometry.type !== 'SphereGeometry') return;
    const r = o.geometry.parameters.radius;
    if (Math.abs(r - 6.6) < 1e-6) head = o;
    if (Math.abs(r - 7.0) < 1e-6) back = o;
  });
  if (!head || !back) return false;
  /* 两者都以头心为原点：头沿 -Z 到 -r*scale，发块沿 -Z 到 pos.z - r*scale.z */
  const headBack = -6.6 * head.scale.x;
  const hairBack = back.position.z - 7.0 * back.scale.z;
  return hairBack <= headBack - 0.3;      // 至少盖过 0.3，别只差 0.07
}
ok(backHeadCovered(kidRig), '小孩后脑勺被头发盖住（不是秃的）');
ok(backHeadCovered(adultRig), '成人后脑勺被头发盖住（不是秃的）');

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
    /* 玩家带 group.scale（0.95），头身比要把这个缩放一并算进去才是量纲一致的 */
    const ps = realPlayer.group.scale.x || 1;
    const rRatio = (2 * 6.6 * rh.scale.x * ps) / realPlayer.height;
    ok(rRatio > adultRatio * 1.08, '玩家头身比更幼（' + rRatio.toFixed(3) + ' vs ' + adultRatio.toFixed(3) + '）');
  }
  ok(hasScar(realPlayer), '玩家（哈利）有闪电疤');
  ok(hasIris(realPlayer), '玩家有蓝色虹膜');
  ok(!anyNaN(realPlayer), '玩家模型无 NaN');
}

/* ---------------- 8. 头发 / 巨人 / 长发 / 树 ---------------- */
section('头发不是尖刺，后脑是蓬乱的');

/* 老版本用 ConeGeometry（圆锥）朝外戳，近看像刺猬。现在头发全在球壳上。 */
let spikes = 0;
kidRig.body.traverse(o => { if (o.isMesh && o.geometry.type === 'ConeGeometry') spikes++; });
ok(spikes === 0, '哈利的头发里没有圆锥尖刺（' + spikes + ' 个）');

/* 发壳必须「表面不平」：抖动量不够就是一颗光滑的球（用户说的「像头盔」）。
 * 同时最小半径不能小于基准半径，否则局部会缩进头球里、露出一块头皮。 */
function shellStats(rig, name) {
  let g = null;
  rig.body.traverse(o => { if (o.isMesh && o.geometry && o.geometry.name === name) g = o.geometry; });
  if (!g) return null;
  const a = g.attributes.position;
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < a.count; i++) {
    const r = Math.hypot(a.getX(i), a.getY(i), a.getZ(i));
    if (r < mn) mn = r;
    if (r > mx) mx = r;
  }
  return { min: mn, max: mx };
}
const shell = shellStats(kidRig, 'hairBack');
ok(!!shell, '能定位后脑发壳');
if (shell) {
  ok(shell.min >= 7.0 - 1e-3, '发壳只往外鼓、不缩进头皮（最小半径 ' + shell.min.toFixed(2) + '）');
  ok(shell.max - shell.min > 0.8, '发壳表面有明显起伏（' + (shell.max - shell.min).toFixed(2) + '）');
}

/* 眼睛：虹膜不能铺满眼眶，否则「一颗蓝豆子镶在肉里」 */
function geoSize(rig, name) {
  let g = null;
  rig.body.traverse(o => { if (o.isMesh && o.geometry && o.geometry.name === name) g = o.geometry; });
  if (!g) return null;
  g.computeBoundingBox();
  const b = g.boundingBox;
  return { w: b.max.x - b.min.x, h: b.max.y - b.min.y, g: g };
}
const irisS = geoSize(kidRig, 'iris'), whiteS = geoSize(kidRig, 'eyeWhite');
ok(!!irisS && !!whiteS, '能定位虹膜与眼白');
if (irisS && whiteS) {
  ok(irisS.w < whiteS.w * 0.8,
     '虹膜比眼白小一圈（' + irisS.w.toFixed(2) + ' vs ' + whiteS.w.toFixed(2) + '）');
  /* 高光必须落在虹膜里面，不能挂在眼白/眼眶上 */
  let eyeGroup = null;
  kidRig.body.traverse(o => { if (o.isMesh && o.geometry && o.geometry.name === 'glint') eyeGroup = o.parent; });
  ok(!!eyeGroup, '能定位高光');
  if (eyeGroup) {
    const gl = eyeGroup.children.find(c => c.geometry && c.geometry.name === 'glint');
    const gw = geoSize(kidRig, 'glint');
    const insideX = Math.abs(gl.position.x) + gw.w / 2 <= irisS.w / 2 + 1e-6;
    const insideY = Math.abs(gl.position.y) + gw.h / 2 <= irisS.h / 2 + 1e-6;
    ok(insideX && insideY, '高光落在虹膜上，不在眼白上');
  }
}

section('海格是混血巨人');
const harryStyle = M.npcStyle({ id: 'harry' });
const harryRig2 = M.makeHumanoid(Object.assign({ robe: '#7a5a38', scale: 0.95 }, harryStyle));
const hagRig = M.makeHumanoid(Object.assign({ robe: '#5a4a3a' }, M.npcStyle({ id: 'hagrid' })));
/* 原著里海格约为常人的两倍高；这里的量纲是人比格子大，所以看的是「相对哈利」的倍数 */
ok(hagRig.height > harryRig2.height * 2.0,
   '海格比哈利高得多（' + (hagRig.height / harryRig2.height).toFixed(2) + ' 倍：' +
   hagRig.height.toFixed(1) + ' vs ' + harryRig2.height.toFixed(1) + '）');
/* 身上的毛：一圈圈压扁的毛球，数量少了就还是一片布 */
let furTufts = 0;
hagRig.body.traverse(o => {
  if (o.isMesh && o.geometry && o.geometry.type === 'SphereGeometry' &&
      o.geometry.parameters && Math.abs(o.geometry.parameters.radius - 1.7) < 1e-6) furTufts++;
});
ok(furTufts >= 40, '海格身上有成片的毛（' + furTufts + ' 团）');
ok(furTufts === 0 || (() => {   // 毛不能只有四块大方块：旧的 furPatch 方块必须已经不用了
  let boxes = 0;
  hagRig.body.traverse(o => {
    if (o.isMesh && o.geometry && o.geometry.type === 'BoxGeometry') {
      const p = o.geometry.parameters;
      if (Math.abs(p.width - 6.5) < 1e-6) boxes++;
    }
  });
  return boxes === 0;
})(), '海格的毛不再是 6.5 见方的大方块');

section('赫敏是长发');
const hermRig = M.makeHumanoid(Object.assign({ robe: '#5a4a3a' }, M.npcStyle({ id: 'hermione_hall' })));
const locks = [];
hermRig.body.traverse(o => {
  if (o.isMesh && o.geometry && o.geometry.type === 'CylinderGeometry') {
    const p = o.geometry.parameters;
    if (Math.abs(p.height - 15) < 1e-6) locks.push(o);
  }
});
ok(locks.length === 3, '赫敏有三缕垂下来的长发（' + locks.length + '）');
/* 发缕必须挂在发壳外面（壳半径约 7.85），否则会被头发整个盖住看不见 */
const sideLocks = locks.filter(o => Math.abs(o.position.x) > 1).length;
ok(sideLocks === 2, '左右各一缕侧发（' + sideLocks + '）');
if (locks.length) {
  const outer = Math.max.apply(null, locks.map(o => Math.abs(o.position.x) + 2.9 * o.scale.x));
  ok(outer > 8, '侧发露在头发壳外面（外沿 ' + outer.toFixed(2) + '）');
}

section('树更高了，树底不再悬空');
/* terrain 把整张图的地板/树合并成一个 mesh，所以看它的包围盒和顶点分布 */
function biggestMesh() {
  let best = null, n = 0;
  M.scene().traverse(o => {
    if (o.isMesh && o.geometry && o.geometry.attributes &&
        o.geometry.attributes.position && o.geometry.attributes.position.count > n) {
      best = o; n = o.geometry.attributes.position.count;
    }
  });
  return best;
}
let tallest = 0, moundTops = 0, treeMaps = 0;
for (const id of mapIds) {
  doTeleport(id);
  const m = biggestMesh();
  if (!m) continue;
  m.geometry.computeBoundingBox();
  const top = m.geometry.boundingBox.max.y;
  /* 树冠顶 = trunkH(40~54) + 30 + 9 ≈ 79；人物身高 56，之前只有 60 出头 */
  let found = 0;
  const pos = m.geometry.attributes.position;
  const T = 32, HALF = T / 2;      // 与 render3d 的 TILE 一致
  for (let i = 0; i < pos.count; i++) {
    /* 认土丘只看「格子中心 + y=-12」这一对坐标：土丘是唯一一个
     * 底部盖中心刚好压在 -FLOOR_T(-12) 的构件（方块几何体只在八个角上有顶点，
     * 盖心顶点只有圆柱/圆锥/球才有）。只看 y=5 是不行的——实测每张图都有
     * 几十个别的构件也在「格子中心 + y=5」上有顶点，把土丘删掉那条断言照样通过。 */
    if (Math.abs(pos.getY(i) + 12) > 1e-3) continue;
    const fx = (pos.getX(i) - HALF) / T, fz = (pos.getZ(i) - HALF) / T;
    if (Math.abs(fx - Math.round(fx)) < 1e-3 && Math.abs(fz - Math.round(fz)) < 1e-3) found++;
  }
  if (top > 70) treeMaps++;          // 树冠顶过 70 才算「比人高得多的树」
  moundTops += found;
  if (top > tallest) tallest = top;
}
ok(treeMaps > 0, '有地图种了树（' + treeMaps + ' 张）');
ok(moundTops > 0, '每个树坑都补了土丘（' + moundTops + ' 个盖心顶点）');
ok(tallest > 70, '树比人高得多（最高 ' + tallest.toFixed(1) + '，人物身高 ' + harryRig2.height.toFixed(1) + '）');
doTeleport('privet');

/* ---------------- 8. 场景亮度：暗图也要看得见 ----------------
 * 「看不见」有两种成因：灯太弱，或者物体本身固有色被压成近黑（加灯也没用）。
 * 两条都要卡住，只卡一条会漏。 */
section('场景亮度：暗图看得见，亮图不过曝');
function lum(c) { return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; }
function tileLum(id) {
  doTeleport(id);
  const m = biggestMesh();
  if (!m || !m.geometry.attributes.color) return 0;
  const col = m.geometry.attributes.color;
  let s = 0;
  for (let i = 0; i < col.count; i++) s += lum({ r: col.getX(i), g: col.getY(i), b: col.getZ(i) });
  return s / col.count;
}
const lightRow = [];
for (const id of mapIds) {
  doTeleport(id);
  const L = R3.debug.lights();
  const fog = R3.debug.scene().fog;
  const sum = L.sun.intensity + L.hemi.intensity + L.fill.intensity;
  lightRow.push({ id: id, dark: !!MAPS[id].dark, sum: sum, far: fog ? fog.far : 0, tile: tileLum(id) });
}
for (const r of lightRow) {
  console.log('  · ' + r.id.padEnd(10) + (r.dark ? '暗' : '亮') +
              '  光量 ' + r.sum.toFixed(2) + '  雾远 ' + r.far.toFixed(0) + '  地面固有色 ' + r.tile.toFixed(3));
}
const darkRows = lightRow.filter(r => r.dark);
ok(darkRows.length >= 3, '存在夜间地图（' + darkRows.length + ' 张：' + darkRows.map(r => r.id).join('/') + '）');
const minDark = Math.min.apply(null, darkRows.map(r => r.sum));
const maxDark = Math.max.apply(null, darkRows.map(r => r.sum));
const litRows = lightRow.filter(r => !r.dark);
const minLit = Math.min.apply(null, litRows.map(r => r.sum));
/* 原来 dungeon 只有 0.34，白天 2.47 —— 差七倍，玩家在找路不是在探险 */
ok(minDark >= 1.00, '最暗的地图光量不低于 1.00（实测 ' + minDark.toFixed(2) + '）');
ok(maxDark <= 1.80, '夜间地图仍保持暗调，不超过 1.80（实测 ' + maxDark.toFixed(2) + '）');
const maxLit = Math.max.apply(null, litRows.map(r => r.sum));
ok(minLit >= 1.30, '白天地图光量不低于 1.30（实测 ' + minLit.toFixed(2) + '）');
ok(maxLit <= 3.00, '白天地图没有过曝（最亮 ' + maxLit.toFixed(2) + '）');
/* 暗图给玩家一盏随身微光，否则身边一米外就全黑 */
for (const r of darkRows) {
  doTeleport(r.id);
  const P = R3.debug.lights().player;
  ok(P.visible && P.distance >= 400 && P.intensity >= 15000,
     '暗图 ' + r.id + ' 有随身微光（可见 ' + P.visible + '，距离 ' + P.distance + '，强度 ' + P.intensity + '）');
}
/* 雾的远平面太近会让隔两个房间就全黑，和灯无关 */
const minFar = Math.min.apply(null, lightRow.map(r => r.far));
ok(minFar >= 1300, '所有地图的雾远平面不近于 1300（实测 ' + minFar.toFixed(0) + '）');
/* 固有色：darken() 原来乘 0.46 再往近黑偏 24%，地面固有色只剩原来的 39%，
 * 那种表面加多少灯都是黑的。要求压暗后至少还保留一半。
 * （不直接比各图的地面亮度——每张图调色板不同，比出来的数没有意义，
 *   这里比的是 darken() 对同一个颜色的压缩率。） */
const minDarkTile = Math.min.apply(null, darkRows.map(r => r.tile));
ok(minDarkTile > 0.035, '暗图地面不是纯黑（最暗 ' + minDarkTile.toFixed(3) + '）');
const GRASS = 0x767065;
const keep = lum(new THREE.Color(R3.debug.darken(GRASS))) / lum(new THREE.Color(GRASS));
ok(keep >= 0.50, '压暗只吃掉不到一半亮度，表面还有东西可反光（保留 ' + (keep * 100).toFixed(0) + '%）');
/* 色调映射曝光：ACES 会压缩高光，所以抬曝光主要是抬暗部、白天不会过曝 */
doTeleport('privet');
const expo = R3.debug.exposure();
ok(expo >= 1.10 && expo <= 1.40, '色调映射曝光在 1.10~1.40 之间（' + expo + '）');
doTeleport('privet');

/* ---------------- 9. 输出 ---------------- */
console.log('\nrender() 调用次数：' + renderCalls);
ok(renderCalls > 100, '渲染循环正常执行');
console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
