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

/* ---------------- 5. 输出 ---------------- */
console.log('\nrender() 调用次数：' + renderCalls);
ok(renderCalls > 100, '渲染循环正常执行');
console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
