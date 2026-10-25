/* =========================================================
 * 3D 渲染引擎（Three.js）
 * ---------------------------------------------------------
 * 负责把 data.js 里的 2D 瓦片地图与角色，渲染成一个真正的
 * 三维世界：
 *   · 地形：地板 / 石墙 / 木墙 / 树 / 灌木 / 火把 / 魔镜 / 门
 *   · 角色：低多边形人形（哈利与各 NPC）、人马、三头犬、幽灵
 *   · 相机：可 90° 平滑旋转的跟随视角（Q / R）
 *   · 光照：日光 / 黑暗地图的火把与荧光闪烁
 *   · 精灵：名字、道具图标、任务指引 ✦、环境粒子
 *
 * 世界坐标系：X = 列 * TILE，Z = 行 * TILE，Y = 高度（地面 y = 0）
 * ========================================================= */
const R3 = (function () {
  'use strict';

  /* three.js 未加载时给出安全空实现（无头测试环境不会崩溃） */
  if (typeof THREE === 'undefined') {
    return {
      ready: false, error: 'THREE 未加载',
      ROT_STEP: Math.PI / 6,
      init() { return false; }, loadMap() {}, frame() {}, resize() {},
      yaw() { return 0; }, yawCurrent() { return 0; }, setYaw() {},
      snapCamera() {}, updateCamera() {}, resetView() {},
      basis() { return { fx: -1, fz: 0, rx: 0, rz: -1 }; },
      debug: {
        camera() { return { x: 0, y: 0, z: 0, dist: 0, yaw: 0, pitch: 0, zoom: 1, camX: 0, camZ: 0 }; },
        nodes() { return { player: null, npcs: [], props: [], doors: [] }; },
        marker() { return null; }, lights() { return {}; },
        zoomBy() {}, dragBy() {}, counts() { return { meshes: 0, npcs: 0, props: 0, doors: 0 }; },
      },
    };
  }

  const TILE = 32;               // 瓦片尺寸（与 data.js 中的 TILE 一致）
  const FLOOR_T = 12;          // 地板厚度
  const FOV = 32;              // 相机垂直视场角
  const PITCH_DEF = 52 * Math.PI / 180;   // 默认俯角
  const PITCH_MIN = 22 * Math.PI / 180;   // 拖拽可调到的最平视角
  const PITCH_MAX = 76 * Math.PI / 180;   // 拖拽可调到的最俯视角
  const ZOOM_MIN = 0.55, ZOOM_MAX = 1.9;  // 滚轮缩放范围
  /* 视角旋转步长：与 game.js 的 ROT_STEP 保持一致。
   * 90° → 一次跳转太生硬；30° 一次转得更柔和，转 3 次正好回到 90° 正向。 */
  const ROT_STEP = Math.PI / 6;
  const LOOK_Y = 22;           // 注视点高度
  const MARGIN_X = 205;        // 相机横向可视半径（世界单位）
  const MARGIN_Z = 150;        // 相机纵向可视半径
  const HUMAN_H = 50;          // 人形角色基准高度

  let renderer = null, scene = null, camera = null;
  let ready = false, error = '';
  let worldRoot = null, actorRoot = null, fxRoot = null;
  let terrain = null, glass = null, glow = null;
  let sun = null, hemi = null, fill = null;
  let playerLight = null;
  let torchPool = [], torchSpots = [];
  let playerRig = null;
  let npcRigs = [], propRigs = [], doorRigs = [];
  let marker = null;
  let motes = null, moteData = null;
  let yaw = 0, yawTarget = 0;
  let look = null, lookDesired = null;
  let curMap = null, curMapId = '';
  let time = 0;

  const V3 = THREE.Vector3;
  const tmpV = new V3();

  /* ---------------- 工具 ---------------- */
  function hash(x, y) { return ((x * 73856093) ^ (y * 19349663) ^ ((x + y) * 83492791)) >>> 0; }
  function rnd(x, y, i) { return ((hash(x, y) >> (i * 5)) & 63) / 63; }

  /* 按比例提亮/压暗一个 0xRRGGBB 颜色（k>0 更亮，k<0 更暗）。
   * 用来给相邻瓦片制造细微色差，避免整片地面看起来是一块死板的色块。 */
  function tint(hex, k) {
    const f = 1 + k;
    const r = Math.max(0, Math.min(255, Math.round(((hex >> 16) & 255) * f)));
    const g = Math.max(0, Math.min(255, Math.round(((hex >> 8) & 255) * f)));
    const b = Math.max(0, Math.min(255, Math.round((hex & 255) * f)));
    return (r << 16) | (g << 8) | b;
  }

  /* 把几何体按法线方向着色：朝上 = 顶面，其余 = 侧面 */
  function paint(geo, topHex, sideHex) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    const n = g.attributes.normal;
    const cnt = n.count;
    const col = new Float32Array(cnt * 3);
    const tc = new THREE.Color(topHex), sc = new THREE.Color(sideHex);
    const bc = sc.clone().multiplyScalar(0.62);
    for (let i = 0; i < cnt; i++) {
      const ny = n.getY(i);
      const c = ny > 0.5 ? tc : (ny < -0.5 ? bc : sc);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!g.attributes.uv) g.deleteAttribute('uv');
    return g;
  }

  /* 合并一组（已平移到世界坐标的）非索引几何体 */
  function mergeGeoms(list) {
    let total = 0;
    for (const g of list) total += g.attributes.position.count;
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
    let o = 0;
    for (const g of list) {
      pos.set(g.attributes.position.array, o);
      nor.set(g.attributes.normal.array, o);
      col.set(g.attributes.color.array, o);
      o += g.attributes.position.array.length;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    return geo;
  }

  function darken(hex) {
    const c = new THREE.Color(hex);
    c.multiplyScalar(0.46);
    c.lerp(new THREE.Color(0x0a1226), 0.24);
    return c.getHex();
  }

  function disposeNode(obj) {
    if (!obj) return;
    obj.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
    if (obj.parent) obj.parent.remove(obj);
  }

  /* ---------------- 材质 ---------------- */
  const MAT = {
    solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.02, flatShading: true }),
    rock:  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.0, flatShading: true }),
    glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.25, transparent: true, opacity: 0.62, flatShading: true }),
    glow:  new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  };

  /* ---------------- 瓦片调色板 ---------------- */
  const PAL = {
    g:   { top: 0x4f8440, side: 0x2c5427, h: 0, deco: 'grass' },
    p:   { top: 0xb09a6a, side: 0x6b5733, h: 0 },
    '.': { top: 0x767065, side: 0x4a463f, h: 0 },
    s:   { top: 0x8a8076, side: 0x5b554c, h: 0 },
    c:   { top: 0x773c4e, side: 0x431f2b, h: 0 },
    w:   { top: 0x3a76ad, side: 0x1d3f63, h: 44, glass: true },
    '#': { top: 0x74747d, side: 0x4a4a52, h: 52, wall: true },
    '=': { top: 0x84623f, side: 0x58432c, h: 34, wall: true },
    t:   { tree: true }, T: { tree: true },
    f:   { top: 0x4f8440, side: 0x315a28, h: 14, bush: true },
    r:   { torch: true },
    k:   { top: 0xd8b02c, side: 0x8a6d1e, h: 14, gold: true },
    m:   { mirror: true },
    W:   { top: 0x8a7a5a, side: 0x5a5040, h: 44, window: true },
    d:   { door: true },
  };
  const GRASS_TOPS = [0x4f8440, 0x558b46, 0x477d3c];

  function tilePal(c, tx, ty, dark) {
    const p = PAL[c] || PAL['.'];
    if (dark) {
      return { top: darken(p.top !== undefined ? p.top : 0x767065), side: darken(p.side !== undefined ? p.side : 0x4a463f), h: p.h || 0, kind: p.kind, wall: p.wall, tree: p.tree, bush: p.bush, torch: p.torch, mirror: p.mirror, door: p.door, glass: p.glass, gold: p.gold, window: p.window, deco: p.deco };
    }
    return p;
  }

  /* ---------------- 地形 ---------------- */
  function buildTerrain(m) {
    const dark = !!m.dark;
    const solids = [], glassG = [], glowG = [];
    torchSpots = [];

    for (let ty = 0; ty < m.h; ty++) {
      for (let tx = 0; tx < m.w; tx++) {
        const c = m.g[ty][tx];
        const cx = tx * TILE + TILE / 2, cz = ty * TILE + TILE / 2;
        const r0 = rnd(tx, ty, 0), r1 = rnd(tx, ty, 1);
        const p = tilePal(c, tx, ty, dark);

        /* --- 地板 --- */
        if (!p.wall && !p.tree && !p.torch && !p.mirror && !p.door && !p.glass && !p.window) {
          let top = p.top, side = p.side, lift = 0;
          if (p.deco === 'grass') {
            top = dark ? darken(GRASS_TOPS[hash(tx, ty) % 3]) : GRASS_TOPS[hash(tx, ty) % 3];
            lift = Math.floor(r0 * 3);           // 草地高低起伏
          } else {
            /* 石板 / 泥地 / 地毯：逐格轻微色差，避免大片纯色 */
            const k = (r0 - 0.5) * 0.12;
            top = tint(top, k);
            side = tint(side, k * 0.7);
          }
          const g = paint(new THREE.BoxGeometry(TILE, FLOOR_T + lift, TILE), top, side);
          g.translate(cx, (FLOOR_T + lift) / 2 - FLOOR_T, cz);
          solids.push(g);

          if (p.deco === 'grass') {
            if (hash(tx, ty) % 9 === 0) {          // 小花
              const f = paint(new THREE.SphereGeometry(2.4, 6, 4), hash(tx, ty) % 2 ? 0xe8d76a : 0xe8e8f0, 0xc9bd5a);
              f.translate(cx, lift + 1.6, cz);
              solids.push(f);
            } else if (hash(tx, ty) % 14 === 3) {   // 草丛
              const b = paint(new THREE.ConeGeometry(4.5, 9, 6), dark ? 0x24401d : 0x3d7031, dark ? 0x1a2c14 : 0x2a5223);
              b.translate(cx, lift + 4.5, cz);
              solids.push(b);
            }
          }
          continue;
        }

        /* --- 树 --- */
        if (p.tree) {
          const trunkH = 22 + Math.floor(r0 * 8);
          const tr = paint(new THREE.CylinderGeometry(3.4, 4.6, trunkH, 6), dark ? 0x3a2a1a : 0x5a3d2e, dark ? 0x2a1d12 : 0x402a1f);
          tr.translate(cx, trunkH / 2, cz);
          solids.push(tr);
          const leafA = dark ? 0x2c4a22 : 0x3f7a35, leafB = dark ? 0x24401d : 0x356a2c;
          const c1 = paint(new THREE.SphereGeometry(12, 8, 6), leafA, leafA);
          c1.translate(cx, trunkH + 8, cz);
          const c2 = paint(new THREE.SphereGeometry(8.5, 8, 6), leafB, leafB);
          c2.translate(cx - 7, trunkH + 15, cz);
          const c3 = paint(new THREE.SphereGeometry(8.5, 8, 6), leafB, leafB);
          c3.translate(cx + 7, trunkH + 15, cz);
          solids.push(c1, c2, c3);
          continue;
        }

        /* --- 灌木 / 栅栏 --- */
        if (p.bush) {
          const post = paint(new THREE.BoxGeometry(6, p.h, 6), dark ? 0x3a2a1a : 0x5a3d2e, dark ? 0x2a1d12 : 0x402a1f);
          post.translate(cx, p.h / 2, cz);
          const bush = paint(new THREE.SphereGeometry(10, 8, 6), p.top, p.side);
          bush.translate(cx, p.h + 4, cz);
          solids.push(post, bush);
          continue;
        }

        /* --- 火把（发光 + 点光源） --- */
        if (p.torch) {
          const post = paint(new THREE.BoxGeometry(6, 26, 6), dark ? 0x3a3a40 : 0x6a6a72, dark ? 0x232327 : 0x46464d);
          post.translate(cx, 13, cz);
          solids.push(post);
          const flame = paint(new THREE.SphereGeometry(5.2, 8, 6), 0xffb347, 0xff8a2b);
          flame.translate(cx, 30, cz);
          glowG.push(flame);
          torchSpots.push({ x: cx, y: 30, z: cz });
          continue;
        }

        /* --- 玻璃窗（实心装饰） --- */
        if (p.glass) {
          const g = paint(new THREE.BoxGeometry(TILE, p.h, TILE), p.top, p.side);
          g.translate(cx, p.h / 2, cz);
          glassG.push(g);
          continue;
        }

        /* --- 带窗的墙 --- */
        if (p.window) {
          const wall = paint(new THREE.BoxGeometry(TILE, p.h, TILE), p.top, p.side);
          wall.translate(cx, p.h / 2, cz);
          solids.push(wall);
          const pane = paint(new THREE.BoxGeometry(TILE * 0.62, 14, 3), 0xffd76a, 0xe0a83a);
          pane.translate(cx, p.h * 0.62, cz + TILE / 2 - 1);
          glowG.push(pane);
          continue;
        }

        /* --- 魔镜 --- */
        if (p.mirror) {
          const frame = paint(new THREE.BoxGeometry(TILE * 1.25, 62, 9), 0xc9a227, 0x8a6d1e);
          frame.translate(cx, 31, cz);
          solids.push(frame);
          const pane = paint(new THREE.PlaneGeometry(TILE * 1.05, 54), 0xbfe3ff, 0x9dd0f5);
          pane.rotateX(0);
          pane.translate(cx, 31, cz + 5.2);
          glowG.push(pane);
          const foot = paint(new THREE.BoxGeometry(TILE * 1.35, 6, 16), 0x6b5320, 0x4a3a16);
          foot.translate(cx, 3, cz);
          solids.push(foot);
          continue;
        }

        /* --- 金币 / 钥匙堆 --- */
        if (p.gold) {
          const base = paint(new THREE.CylinderGeometry(TILE * 0.42, TILE * 0.46, p.h, 10), p.top, p.side);
          base.translate(cx, p.h / 2, cz);
          solids.push(base);
          const spark = paint(new THREE.SphereGeometry(3, 6, 5), 0xfff0a8, 0xd8b02c);
          spark.translate(cx, p.h + 4, cz);
          glowG.push(spark);
          continue;
        }

        /* --- 墙 / 门 --- */
        if (p.wall) {
          const h = p.h + Math.floor(r0 * 6);      // 墙顶高低错落
          const kw = (r1 - 0.5) * 0.16;            // 砖块之间的明暗差
          const w = paint(new THREE.BoxGeometry(TILE, h, TILE), tint(p.top, kw), tint(p.side, kw * 0.8));
          w.translate(cx, h / 2, cz);
          solids.push(w);
          continue;
        }
        if (p.door) {
          /* 地板先铺上（门开着时要能看见地面） */
          const f = paint(new THREE.BoxGeometry(TILE, FLOOR_T, TILE), dark ? 0x33322e : 0x6f6a62, dark ? 0x22211d : 0x4a463f);
          f.translate(cx, -FLOOR_T / 2 + 0.2, cz);
          solids.push(f);
          const dr = curMap.doors.find(d => d.x === tx && d.y === ty);
          const alongX = isWallAt(m, tx - 1, ty) || isWallAt(m, tx + 1, ty);
          const g = alongX
            ? paint(new THREE.BoxGeometry(TILE, 44, 11), dark ? 0x4a3520 : 0x7a5a3a, dark ? 0x33240f : 0x5b3d1f)
            : paint(new THREE.BoxGeometry(11, 44, TILE), dark ? 0x4a3520 : 0x7a5a3a, dark ? 0x33240f : 0x5b3d1f);
          g.translate(cx, 22, cz);
          const mesh = new THREE.Mesh(g, MAT.solid);
          mesh.castShadow = true; mesh.receiveShadow = true;
          doorRigs.push({ mesh, flag: dr ? dr.flag : null });
          continue;
        }
      }
    }

    if (terrain) { disposeNode(terrain); terrain = null; }
    if (glass) { disposeNode(glass); glass = null; }
    if (glow) { disposeNode(glow); glow = null; }

    if (solids.length) {
      terrain = new THREE.Mesh(mergeGeoms(solids), MAT.solid);
      terrain.castShadow = true; terrain.receiveShadow = true;
      worldRoot.add(terrain);
    }
    if (glassG.length) {
      glass = new THREE.Mesh(mergeGeoms(glassG), MAT.glass);
      glass.receiveShadow = true;
      worldRoot.add(glass);
    }
    if (glowG.length) {
      glow = new THREE.Mesh(mergeGeoms(glowG), MAT.glow);
      worldRoot.add(glow);
    }
    for (const d of doorRigs) worldRoot.add(d.mesh);
  }

  function isWallAt(m, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
    const c = m.g[ty][tx];
    return !!(PAL[c] && PAL[c].wall);
  }

  /* ---------------- 文字 / 图标精灵 ---------------- */
  const spriteCache = {};

  function makeCanvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    return cv;
  }

  function textTexture(text, opt) {
    opt = opt || {};
    const fs = opt.fontSize || 26;
    const font = opt.font || 'bold ' + fs + 'px Georgia, "Songti SC", serif';
    const pad = opt.pad === undefined ? 10 : opt.pad;
    const bg = opt.bg === undefined ? 'rgba(8,10,18,0.72)' : opt.bg;
    const fg = opt.fg || '#ffe9a8';
    const ms = makeCanvas(8, 8).getContext('2d');
    ms.font = font;
    const tw = Math.ceil(ms.measureText(text).width);
    const w = Math.max(16, tw + pad * 2), h = fs + pad * 2;
    const cv = makeCanvas(w, h);
    const g = cv.getContext('2d');
    if (bg) {
      g.fillStyle = bg;
      const r = Math.min(8, h / 2);
      g.beginPath();
      g.moveTo(r, 0); g.lineTo(w - r, 0); g.quadraticCurveTo(w, 0, w, r);
      g.lineTo(w, h - r); g.quadraticCurveTo(w, h, w - r, h);
      g.lineTo(r, h); g.quadraticCurveTo(0, h, 0, h - r);
      g.lineTo(0, r); g.quadraticCurveTo(0, 0, r, 0);
      g.closePath(); g.fill();
    }
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = fg;
    g.fillText(text, w / 2, h / 2 + 1);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return { tex, aspect: w / h };
  }

  function makeLabel(text, worldH, opt) {
    const t = textTexture(text, opt);
    const mat = new THREE.SpriteMaterial({ map: t.tex, transparent: true, depthTest: false, depthWrite: false });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(worldH * t.aspect, worldH, 1);
    sp.renderOrder = 20;
    return sp;
  }

  function iconTexture(emoji) {
    if (spriteCache[emoji]) return spriteCache[emoji];
    const S = 128;
    const cv = makeCanvas(S, S);
    const g = cv.getContext('2d');
    g.font = '92px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, S / 2, S / 2 + 4);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    spriteCache[emoji] = tex;
    return tex;
  }

  function makeIcon(emoji, worldH) {
    const mat = new THREE.SpriteMaterial({ map: iconTexture(emoji || '✨'), transparent: true, depthWrite: false });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(worldH, worldH, 1);
    return sp;
  }

  /* 地面圆形阴影（贴图），保证角色不“飘” */
  let blobTex = null;
  function blobShadow(radius) {
    if (!blobTex) {
      const S = 64;
      const cv = makeCanvas(S, S);
      const g = cv.getContext('2d');
      const grad = g.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
      grad.addColorStop(0, 'rgba(0,0,0,0.55)');
      grad.addColorStop(0.6, 'rgba(0,0,0,0.28)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, S, S);
      blobTex = new THREE.CanvasTexture(cv);
      blobTex.colorSpace = THREE.SRGBColorSpace;
    }
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 2, radius * 2),
      new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.75 })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.8;
    m.renderOrder = 2;
    return m;
  }

  /* ---------------- 角色模型 ---------------- */
  const GEO = {
    leg: new THREE.BoxGeometry(4.6, 13, 4.6),
    arm: new THREE.BoxGeometry(3.6, 14, 3.6),
    robe: new THREE.CylinderGeometry(7, 13, 25, 10, 1),
    chest: new THREE.BoxGeometry(15, 9, 10),
    head: new THREE.SphereGeometry(6.6, 12, 9),
    hairCap: new THREE.SphereGeometry(7.1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairSpike: new THREE.ConeGeometry(2.6, 7, 5),
    eye: new THREE.BoxGeometry(1.7, 1.7, 0.7),
    glasses: new THREE.TorusGeometry(2.7, 0.42, 6, 12),
    bridge: new THREE.BoxGeometry(2.2, 0.5, 0.5),
    scarf: new THREE.CylinderGeometry(5.2, 5.6, 4, 10),
    stripe: new THREE.CylinderGeometry(5.7, 6.0, 1.3, 10),
    beard: new THREE.BoxGeometry(9, 12, 6),
    hatCone: new THREE.ConeGeometry(9.5, 15, 10),
    brim: new THREE.CylinderGeometry(11, 11, 1.2, 12),
    wand: new THREE.CylinderGeometry(0.65, 0.85, 17, 6),
  };

  function mat(color, opt) {
    opt = opt || {};
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: opt.roughness === undefined ? 0.85 : opt.roughness,
      metalness: opt.metalness === undefined ? 0.03 : opt.metalness,
      flatShading: opt.flat === undefined ? true : opt.flat,
      transparent: !!opt.transparent,
      opacity: opt.opacity === undefined ? 1 : opt.opacity,
      emissive: opt.emissive === undefined ? 0x000000 : opt.emissive,
    });
  }

  function addMesh(parent, geo, m, x, y, z) {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  /* 人形：长袍 + 头 + 头发（+ 眼镜 / 围巾 / 胡子 / 帽子 / 魔杖） */
  function makeHumanoid(o) {
    const s = o.scale || 1;
    const robe = new THREE.Color(o.robe || '#5a4a3a');
    const hair = new THREE.Color(o.hair || '#4a3520');
    const skin = new THREE.Color(o.skin || '#e8b98a');
    const ghost = !!o.ghost;

    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);

    const robeMat = mat(robe, { transparent: ghost, opacity: ghost ? 0.55 : 1 });
    const darkMat = mat(robe.clone().multiplyScalar(0.7), { transparent: ghost, opacity: ghost ? 0.55 : 1 });
    const skinMat = mat(skin, { flat: false, transparent: ghost, opacity: ghost ? 0.62 : 1 });
    const hairMat = mat(hair, { transparent: ghost, opacity: ghost ? 0.6 : 1 });

    const legL = addMesh(body, GEO.leg, darkMat, -3.6, 6.5, 0);
    const legR = addMesh(body, GEO.leg, darkMat, 3.6, 6.5, 0);
    addMesh(body, GEO.robe, robeMat, 0, 20, 0);
    addMesh(body, GEO.chest, robeMat, 0, 34, 0);
    const armL = addMesh(body, GEO.arm, robeMat, -8.6, 31, 0);
    const armR = addMesh(body, GEO.arm, robeMat, 8.6, 31, 0);

    /* 学院围巾 */
    if (o.scarf) {
      addMesh(body, GEO.scarf, mat(o.scarf), 0, 38.5, 0);
      addMesh(body, GEO.stripe, mat(o.scarfStripe || 0xc9a227), 0, 37.2, 0);
    }

    addMesh(body, GEO.head, skinMat, 0, 44, 0);
    addMesh(body, GEO.hairCap, hairMat, 0, 44.6, 0);

    /* 眼睛 */
    const eyeMat = mat(0x241a10, { flat: false });
    addMesh(body, GEO.eye, eyeMat, -2.5, 44.5, 6.1);
    addMesh(body, GEO.eye, eyeMat, 2.5, 44.5, 6.1);

    if (o.glasses) {
      const gm = mat(0xb9922f, { metalness: 0.5, roughness: 0.4, flat: false });
      addMesh(body, GEO.glasses, gm, -2.5, 44.5, 6.3);
      addMesh(body, GEO.glasses, gm, 2.5, 44.5, 6.3);
      addMesh(body, GEO.bridge, gm, 0, 44.5, 6.3);
    }

    if (o.harry) {
      /* 乱糟糟的头发 + 闪电疤 */
      const s1 = addMesh(body, GEO.hairSpike, hairMat, -3.2, 49.5, 2.2); s1.rotation.z = 0.5;
      const s2 = addMesh(body, GEO.hairSpike, hairMat, 3.4, 49.5, 1.6); s2.rotation.z = -0.45;
      const scar = addMesh(body, new THREE.BoxGeometry(0.9, 4.4, 0.7), mat(0xc0392b, { flat: false }), 3.4, 47.5, 5.6);
      scar.rotation.z = -0.28;
    }
    if (o.beard) {
      addMesh(body, GEO.beard, hairMat, 0, 37.5, 3.2);
    }
    if (o.hat !== undefined && o.hat !== null) {
      addMesh(body, GEO.hatCone, mat(o.hat), 0, 53, 0);
      addMesh(body, GEO.brim, mat(o.hat), 0, 46.5, 0);
    }

    let wandMesh = null;
    if (o.wand) {
      wandMesh = addMesh(body, GEO.wand, mat(0x8a6a3a, { flat: false }), 10.5, 34, 3.5);
      wandMesh.rotation.z = -0.42;
      wandMesh.rotation.x = -0.18;
    }

    g.scale.setScalar(s);
    return { group: g, body, parts: { legL, legR, armL, armR }, wandMesh, height: HUMAN_H * s, ghost };
  }

  /* 人马（火雷恩） */
  function makeCentaur(o) {
    const s = o.scale || 1.1;
    const coat = new THREE.Color(o.robe || '#8a6a4a');
    const hair = new THREE.Color(o.hair || '#5a4a3a');
    const skin = new THREE.Color(o.skin || '#e8b98a');
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);

    const coatMat = mat(coat);
    const legMat = mat(coat.clone().multiplyScalar(0.72));
    // 马身
    addMesh(body, new THREE.BoxGeometry(15, 12, 26), coatMat, 0, 24, 0);
    for (const dx of [-5.5, 5.5]) for (const dz of [-9, 9]) {
      addMesh(body, new THREE.BoxGeometry(4.4, 18, 4.4), legMat, dx, 9, dz);
    }
    // 马尾
    const tail = addMesh(body, new THREE.ConeGeometry(4, 16, 6), mat(hair), 0, 25, 15);
    tail.rotation.x = -0.9;
    // 人的上半身
    addMesh(body, new THREE.BoxGeometry(11, 16, 9), mat(coat.clone().multiplyScalar(1.05)), 0, 40, -11);
    addMesh(body, GEO.head, mat(skin, { flat: false }), 0, 52, -11);
    addMesh(body, GEO.hairCap, mat(hair), 0, 52.6, -11);
    const eyeMat = mat(0x241a10, { flat: false });
    addMesh(body, GEO.eye, eyeMat, -2.5, 52.4, -5.2);
    addMesh(body, GEO.eye, eyeMat, 2.5, 52.4, -5.2);

    g.scale.setScalar(s);
    return { group: g, body, parts: {}, height: HUMAN_H * s * 1.15 };
  }

  /* 三头犬（弗拉菲） */
  function makeDog(o) {
    const s = o.scale || 1.5;
    const fur = new THREE.Color(o.robe || '#3a3028');
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    const furMat = mat(fur);
    const darkMat = mat(fur.clone().multiplyScalar(0.7));

    const torso = addMesh(body, new THREE.CapsuleGeometry(11, 20, 4, 10), furMat, 0, 24, 0);
    torso.rotation.z = Math.PI / 2;
    for (const dx of [-7, 7]) for (const dz of [-8, 8]) addMesh(body, new THREE.BoxGeometry(5, 18, 5), darkMat, dx, 9, dz);
    addMesh(body, new THREE.ConeGeometry(4, 14, 6), darkMat, 0, 33, 14).rotation.x = 1.2;

    const heads = [];
    const offsets = [[-8, 8], [8, 8], [0, 10]];
    for (const [hx, hz] of offsets) {
      const hg = new THREE.Group();
      hg.position.set(hx, 38, -12 + hz * 0.2);
      addMesh(hg, new THREE.SphereGeometry(8, 10, 8), furMat, 0, 0, 0);
      addMesh(hg, new THREE.SphereGeometry(3.4, 8, 6), mat(fur.clone().multiplyScalar(1.15)), 0, -2.5, 7);
      const e = addMesh(hg, GEO.eye, mat(0xd23b2b, { flat: false }), -3, 1.5, 6.6);
      const e2 = addMesh(hg, GEO.eye, mat(0xd23b2b, { flat: false }), 3, 1.5, 6.6);
      heads.push(hg);
      body.add(hg);
    }

    g.scale.setScalar(s);
    return { group: g, body, parts: {}, heads, height: HUMAN_H * s * 0.9 };
  }

  /* ---------------- NPC 外观配置 ---------------- */
  const NPC_STYLE = {
    hagrid: { scale: 1.32, beard: true },
    hagrid2: { scale: 1.32, beard: true },
    hagrid_forest: { scale: 1.32, beard: true },
    flitwick: { scale: 0.78 },
    dumbledore: { scale: 1.16, hat: 0xc9a227, hair: '#e8e8e8', beard: true },
    mcgonagall: { hat: 0x2b2b33, robe: '#2f3b3a' },
    mcgonagall_hall: { hat: 0x2b2b33, robe: '#2f3b3a' },
    snape: { robe: '#24242b' },
    quirrell: { skin: '#c8b090' },
    nick: { ghost: true },
    peeves: { ghost: true },
    wood: { robe: '#7a2b2b' },
  };
  const RED_HAIR = ['ron_train', 'ron_castle', 'ron_hall', 'ron_class', 'ron_chess', 'ron_mum'];
  const BROWN_HAIR = ['hermione_train', 'hermione_castle', 'hermione_hall', 'hermione_class'];

  function npcStyle(n) {
    const o = {
      robe: n.color || '#5a4a3a',
      hair: n.hair || '#4a3520',
      skin: n.skin || '#e8b98a',
      scarf: /^ron|^hermione|^neville|^harry/.test(n.id) ? (RED_HAIR.indexOf(n.id) !== -1 || BROWN_HAIR.indexOf(n.id) !== -1 ? 0x8b1a1a : 0x8b1a1a) : null,
      scarfStripe: 0xc9a227,
    };
    Object.assign(o, NPC_STYLE[n.id] || {});
    if (RED_HAIR.indexOf(n.id) !== -1) o.hair = '#e04818';
    if (BROWN_HAIR.indexOf(n.id) !== -1) o.hair = '#7a3a20';
    if (n.id === 'harry' || n.id === 'harry_castle') { o.harry = true; o.glasses = true; }
    return o;
  }

  function buildNpcRig(n) {
    let rig;
    if (n.id === 'fluffy') rig = makeDog({ robe: n.color || '#3a3028', scale: 1.55 });
    else if (n.id === 'firenze') rig = makeCentaur({ robe: n.color || '#8a6a4a', hair: n.hair, skin: n.skin });
    else rig = makeHumanoid(npcStyle(n));

    if (rig.ghost) {
      rig.group.traverse(o2 => {
        if (o2.material) { o2.material.transparent = true; o2.material.opacity = 0.5; o2.material.emissive = new THREE.Color(0x223355); }
      });
    }
    rig.src = n;
    rig.baseY = 0;
    rig.phase = hash(n.x, n.y) % 100 / 10;
    rig.group.position.set(n.x * TILE + TILE / 2, 0, n.y * TILE + TILE / 2);
    rig.group.rotation.y = faceYaw(n.face);
    rig.group.add(blobShadow(rig.ghost ? 12 : 14));
    if (n.name) {
      rig.label = makeLabel(n.name, 13, { fontSize: 26 });
      rig.label.position.y = rig.height + 16;
      rig.group.add(rig.label);
    }
    if (n.icon) {
      rig.icon = makeIcon(n.icon, 15);
      rig.icon.position.y = rig.height + 36;
      rig.group.add(rig.icon);
    }
    return rig;
  }

  const FACE_YAW = { down: Math.PI / 4, up: -3 * Math.PI / 4, left: -Math.PI / 4, right: 3 * Math.PI / 4 };
  function faceYaw(f) { return FACE_YAW[f] === undefined ? Math.PI / 4 : FACE_YAW[f]; }

  /* ---------------- 道具 ---------------- */
  function buildPropRig(p) {
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    g.position.set(p.x * TILE + TILE / 2, 0, p.y * TILE + TILE / 2);

    /* 基座：一圈石台 + 金色光环 */
    const base = addMesh(body, new THREE.CylinderGeometry(12, 14, 3, 12), mat(0x5a5a62, { roughness: 0.9 }), 0, 1.5, 0);
    base.receiveShadow = true;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(13, 0.7, 6, 22),
      new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.55, toneMapped: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 3.2;
    body.add(ring);

    const icon = makeIcon(p.icon || '✨', 30);
    icon.position.y = 26;
    body.add(icon);

    const rig = { group: g, body, ring, icon, src: p, phase: hash(p.x, p.y) % 100 / 10, height: 46 };
    if (p.label) {
      rig.label = makeLabel(p.label, 12, { fontSize: 24 });
      rig.label.position.y = 52;
      rig.group.add(rig.label);
      rig.label.visible = false;
    }
    return rig;
  }

  /* ---------------- 任务指引标记 ---------------- */
  function buildMarker() {
    const g = new THREE.Group();
    const star = makeLabel('✦', 30, { fontSize: 64, bg: null, fg: '#ffd76a' });
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(11, 1.1, 8, 26),
      new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.75, toneMapped: false })
    );
    g.add(star); g.add(ring);
    g.renderOrder = 15;
    marker = { group: g, ring };
    fxRoot.add(g);
  }

  /* ---------------- 环境粒子 ---------------- */
  function buildMotes() {
    const N = 220;
    const pos = new Float32Array(N * 3);
    moteData = new Float32Array(N * 3);   // 速度/相位
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 900;
      pos[i * 3 + 1] = Math.random() * 90;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 900;
      moteData[i * 3] = (Math.random() - 0.5) * 6;
      moteData[i * 3 + 1] = 4 + Math.random() * 10;
      moteData[i * 3 + 2] = Math.random() * 6.28;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat2 = new THREE.PointsMaterial({
      color: 0xffe9a8, size: 2.6, transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    motes = new THREE.Points(geo, mat2);
    motes.frustumCulled = false;
    fxRoot.add(motes);
  }

  function updateMotes(dt, px, pz) {
    if (!motes) return;
    const arr = motes.geometry.attributes.position.array;
    const N = arr.length / 3;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      const ph = moteData[i3 + 2];
      arr[i3] += Math.sin(time * 0.7 + ph) * 5 * dt;
      arr[i3 + 1] += moteData[i3 + 1] * dt;
      arr[i3 + 2] += Math.cos(time * 0.6 + ph) * 5 * dt;
      if (arr[i3 + 1] > 96) arr[i3 + 1] = 2;
      // 环绕玩家循环
      const dx = arr[i3] - px, dz = arr[i3 + 2] - pz;
      if (dx > 460) arr[i3] -= 920; else if (dx < -460) arr[i3] += 920;
      if (dz > 460) arr[i3 + 2] -= 920; else if (dz < -460) arr[i3 + 2] += 920;
    }
    motes.geometry.attributes.position.needsUpdate = true;
  }

  /* ---------------- 地图氛围（天空 / 雾 / 光照） ---------------- */
  const AMBIENT = {
    privet:   { sky: 0x8fbde8, fog: [520, 1500], sun: 1.55, hemi: 0.62, fill: 0.30, ground: 0x2f4a24 },
    diagon:   { sky: 0x7d9fc4, fog: [420, 1350], sun: 1.42, hemi: 0.62, fill: 0.34, ground: 0x33333a },
    station:  { sky: 0x39414f, fog: [320, 1100], sun: 0.95, hemi: 0.56, fill: 0.40, ground: 0x2a2a30 },
    train:    { sky: 0x4a3a30, fog: [280, 950],  sun: 0.90, hemi: 0.54, fill: 0.44, ground: 0x2a1f18 },
    hall:     { sky: 0x2e2440, fog: [380, 1300], sun: 0.92, hemi: 0.56, fill: 0.48, ground: 0x2e2440 },
    classroom:{ sky: 0x322b3e, fog: [340, 1150], sun: 1.02, hemi: 0.60, fill: 0.44, ground: 0x322b3e },
    pitch:    { sky: 0x76a8d8, fog: [600, 1900], sun: 1.60, hemi: 0.68, fill: 0.28, ground: 0x2f5a2a },
    forest:   { sky: 0x141b23, fog: [220, 900],  sun: 0.40, hemi: 0.32, fill: 0.32, ground: 0x141b23 },
    mirror:   { sky: 0x22222f, fog: [300, 1050], sun: 0.68, hemi: 0.44, fill: 0.44, ground: 0x22222f },
    dungeon:  { sky: 0x0a0c12, fog: [240, 880],  sun: 0.22, hemi: 0.22, fill: 0.26, ground: 0x0a0c12 },
    castle:   { sky: 0x3a3f52, fog: [420, 1400], sun: 1.18, hemi: 0.62, fill: 0.44, ground: 0x3a3f52 },
  };
  const DEF_AMB = { sky: 0x3a3f52, fog: [400, 1350], sun: 1.25, hemi: 0.60, fill: 0.40, ground: 0x3a3f52 };

  function applyMood(m, id) {
    const a = AMBIENT[id] || DEF_AMB;
    const night = !!m.dark;
    scene.background = new THREE.Color(a.sky);
    scene.fog = new THREE.Fog(a.sky, a.fog[0], a.fog[1]);
    hemi.intensity = night ? a.hemi * 0.45 : a.hemi;
    sun.intensity = night ? a.sun * 0.28 : a.sun;
    fill.intensity = night ? a.fill * 0.7 : a.fill;
    /* 黑暗地图：玩家自带微光（手里的魔杖/灯笼感） */
    playerLight.visible = night;
    if (night) {
      playerLight.intensity = 14000;
      playerLight.distance = 340;
    }
    if (motes) motes.material.opacity = night ? 0.35 : 0.5;
  }

  /* ---------------- 光源 ---------------- */
  function buildLights() {
    hemi = new THREE.HemisphereLight(0xbcd4f0, 0x4a4636, 0.6);
    scene.add(hemi);

    sun = new THREE.DirectionalLight(0xfff1d4, 1.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -430; sc.right = 430; sc.top = 430; sc.bottom = -430;
    sc.near = 20; sc.far = 1700;
    sun.shadow.bias = -0.0012;
    sun.shadow.normalBias = 0.8;
    scene.add(sun);
    scene.add(sun.target);

    fill = new THREE.DirectionalLight(0x9fb8e8, 0.3);
    fill.position.set(-260, 340, -220);
    scene.add(fill);

    playerLight = new THREE.PointLight(0xffc078, 0, 340, 2);
    playerLight.visible = false;
    scene.add(playerLight);

    /* 火把点光源池（最多 6 盏，随玩家移动复用） */
    for (let i = 0; i < 6; i++) {
      const pl = new THREE.PointLight(0xffa040, 0, 330, 2);
      pl.visible = false;
      scene.add(pl);
      torchPool.push(pl);
    }
  }

  function updateTorchLights(px, pz, night) {
    if (!night || !torchSpots.length) {
      for (const l of torchPool) { l.visible = false; l.intensity = 0; }
      return;
    }
    const near = torchSpots
      .map(s => ({ s, d: Math.hypot(s.x - px, s.z - pz) }))
      .filter(o => o.d < 460)
      .sort((a, b) => a.d - b.d)
      .slice(0, torchPool.length);
    for (let i = 0; i < torchPool.length; i++) {
      const l = torchPool[i];
      if (i < near.length) {
        l.visible = true;
        l.intensity = 13000;
        l.position.set(near[i].s.x, near[i].s.y, near[i].s.z);
      } else {
        l.visible = false;
        l.intensity = 0;
      }
    }
  }

  /* ---------------- 相机 ---------------- */
  let dist = 420;
  let pitch = PITCH_DEF;
  let zoom = 1;

  function recomputeDist() {
    const aspect = camera.aspect || 1.6;
    /* 目标：横向大约能看到 13 格；窄屏时适当拉远，但不超过上限 */
    const halfW = 208;
    const d = halfW / (Math.tan(FOV * Math.PI / 360) * Math.max(aspect, 0.85));
    dist = Math.max(360, Math.min(820, d)) * zoom;
  }

  function clampToMap(px, pz) {
    if (!curMap) return { x: px, z: pz };
    const w = curMap.w * TILE, h = curMap.h * TILE;
    let x = px, z = pz;
    if (w <= MARGIN_X * 2) x = w / 2;
    else x = Math.max(MARGIN_X, Math.min(w - MARGIN_X, px));
    if (h <= MARGIN_Z * 2) z = h / 2;
    else z = Math.max(MARGIN_Z, Math.min(h - MARGIN_Z, pz));
    return { x, z };
  }

  /* 相机方位角与 yaw 一致（不再 +45°）。
   * 好处：走廊沿瓦片轴排布时，WASD 单键方向正好是瓦片轴向，
   * 既「屏幕相对」又不会斜着撞墙；Q/R 转 90° 后依然轴对齐。 */
  function placeCamera(px, pz) {
    const Rh = dist * Math.cos(pitch), H = dist * Math.sin(pitch);
    const a = yaw;
    camera.position.set(
      px + Math.cos(a) * Rh,
      H,
      pz + Math.sin(a) * Rh
    );
    camera.lookAt(px, LOOK_Y, pz);
  }

  /* ---------------- 鼠标 / 触控：拖拽微调视角、滚轮缩放 ---------------- */
  let dragging = false, dragId = null, lastX = 0, lastY = 0, dragMoved = 0;

  function onPointerDown(e) {
    if (!ready) return;
    dragging = true; dragMoved = 0;
    dragId = (e.pointerId === undefined ? null : e.pointerId);
    lastX = e.clientX || 0; lastY = e.clientY || 0;
  }
  function onPointerMove(e) {
    if (!dragging || !ready) return;
    const x = e.clientX || 0, y = e.clientY || 0;
    const dx = x - lastX, dy = y - lastY;
    lastX = x; lastY = y;
    dragMoved += Math.abs(dx) + Math.abs(dy);
    /* 水平拖拽：绕世界 Y 轴自由旋转（不受 90° 步进限制） */
    yawTarget -= dx * 0.006;
    yaw -= dx * 0.006;
    /* 垂直拖拽：调整俯角 */
    pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch + dy * 0.004));
  }
  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    if (dragId !== null && e && e.pointerId !== undefined && e.pointerId !== dragId) return;
    dragId = null;
    /* 松手后：只有本来就已经很接近某个档位时才轻微吸附过去，
     * 其余情况保留玩家的自由角度（移动方向由 basis() 量化保证不会歪）。 */
    if (dragMoved > 4) {
      const step = ROT_STEP;
      const near = Math.round(yawTarget / step) * step;
      if (Math.abs(yawTarget - near) < ROT_STEP * 0.3) yawTarget = near;
    }
  }
  function onWheel(e) {
    if (!ready) return;
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const k = Math.exp((e && e.deltaY ? e.deltaY : 0) * 0.0012);
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * k));
    recomputeDist();
  }

  function bindInput(canvas) {
    if (!canvas || typeof canvas.addEventListener !== 'function') return;
    const opt = { passive: false };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);
    canvas.addEventListener('wheel', onWheel, opt);
    /* 老浏览器回退 */
    if (typeof window.PointerEvent === 'undefined') {
      canvas.addEventListener('mousedown', onPointerDown);
      canvas.addEventListener('mousemove', onPointerMove);
      if (typeof window.addEventListener === 'function') {
        window.addEventListener('mouseup', onPointerUp);
      }
    }
  }

  function resetView() { pitch = PITCH_DEF; zoom = 1; recomputeDist(); }

  function snapCamera(px, pz) {
    if (!ready) return;
    const t = clampToMap(px, pz);
    look.set(t.x, 0, t.z);
    yaw = yawTarget;
    placeCamera(look.x, look.z);
  }

  function updateCamera(dt, px, pz) {
    if (!ready) return;
    if (Math.abs(yawTarget - yaw) > 1e-4) {
      yaw += (yawTarget - yaw) * Math.min(1, dt * 9);
      if (Math.abs(yawTarget - yaw) < 0.002) yaw = yawTarget;
    }
    const t = clampToMap(px, pz);
    lookDesired.set(t.x, 0, t.z);
    const k = Math.min(1, dt * 6.5);
    look.lerp(lookDesired, k);
    placeCamera(look.x, look.z);
  }

  /* ---------------- 玩家 ---------------- */
  function buildPlayer() {
    if (playerRig) disposeNode(playerRig.group);
    playerRig = makeHumanoid({
      /* 略微提亮长袍：3D 逆光下深褐色会糊成一团黑 */
      robe: '#63492f', hair: '#2e1c0d', skin: '#f0c496',
      glasses: true, harry: true, scarf: 0x9e1f1f, scarfStripe: 0xd8b13a,
      wand: true, scale: 1.15,
    });
    playerRig.group.add(blobShadow(15));
    if (playerRig.wandMesh) playerRig.wandMesh.visible = false;
    actorRoot.add(playerRig.group);
  }

  /* ---------------- 对外接口 ---------------- */
  function init(canvas) {
    if (ready) return true;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    } catch (e) {
      error = '无法创建 WebGL 上下文：' + (e && e.message ? e.message : e);
      return false;
    }
    if (!renderer) { error = 'WebGL 不可用'; return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a2c3a);

    camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 1, 3000);
    look = new V3(); lookDesired = new V3();

    worldRoot = new THREE.Group(); scene.add(worldRoot);
    actorRoot = new THREE.Group(); scene.add(actorRoot);
    fxRoot = new THREE.Group(); scene.add(fxRoot);

    buildLights();
    buildPlayer();
    buildMarker();
    buildMotes();
    recomputeDist();
    bindInput(canvas);

    ready = true;
    resize(window.innerWidth || 960, window.innerHeight || 540);
    return true;
  }

  function loadMap(m, id) {
    if (!ready || !m) return;
    curMap = m;
    curMapId = id || (m.name || '');
    doorRigs = [];
    buildTerrain(m);

    for (const r of npcRigs) disposeNode(r.group);
    for (const r of propRigs) disposeNode(r.group);
    npcRigs = []; propRigs = [];
    for (const n of m.npcs) { const r = buildNpcRig(n); npcRigs.push(r); actorRoot.add(r.group); }
    for (const p of m.props) { const r = buildPropRig(p); propRigs.push(r); actorRoot.add(r.group); }

    applyMood(m, curMapId);
  }

  function resize(w, h) {
    if (!ready) return;
    w = Math.max(1, w | 0); h = Math.max(1, h | 0);
    camera.aspect = w / h;
    recomputeDist();
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function frame(dt, st) {
    if (!ready || !curMap) return;
    if (!(dt > 0)) dt = 0.016;
    time += dt;

    const px = st.pos.x, pz = st.pos.y;

    /* --- 玩家 --- */
    if (playerRig) {
      playerRig.group.position.set(px, 0, pz);
      const target = st.faceAng || 0;
      let diff = target - playerRig.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      playerRig.group.rotation.y += diff * Math.min(1, dt * 12);
      const walking = st.walkT > 0;
      const s = walking ? Math.sin(st.walkT * 10) : 0;
      const p = playerRig.parts;
      if (p.legL) p.legL.rotation.x = s * 0.55;
      if (p.legR) p.legR.rotation.x = -s * 0.55;
      if (p.armL) p.armL.rotation.x = -s * 0.45;
      if (p.armR) p.armR.rotation.x = s * 0.30;
      playerRig.body.position.y = walking ? Math.abs(Math.sin(st.walkT * 10)) * 1.8 : Math.sin(time * 1.8) * 0.5;
      if (playerRig.wandMesh) playerRig.wandMesh.visible = !!st.wand;
    }

    /* --- NPC --- */
    for (const r of npcRigs) {
      const vis = st.npcs.indexOf(r.src) !== -1;
      r.group.visible = vis;
      if (!vis) continue;
      const dx = r.src.x * TILE + TILE / 2 - px, dz = r.src.y * TILE + TILE / 2 - pz;
      const d = Math.hypot(dx, dz);
      r.body.position.y = Math.sin(time * 1.6 + r.phase) * 0.9;
      if (r.label) r.label.visible = d < 108;
      if (r.icon) r.icon.visible = d < 108;
    }

    /* --- 道具 --- */
    for (const r of propRigs) {
      const vis = st.props.indexOf(r.src) !== -1;
      r.group.visible = vis;
      if (!vis) continue;
      const dx = r.src.x * TILE + TILE / 2 - px, dz = r.src.y * TILE + TILE / 2 - pz;
      const d = Math.hypot(dx, dz);
      const bob = Math.sin(time * 2 + r.phase) * 3;
      r.body.position.y = bob;
      if (r.ring) {
        const k = 0.35 + (d < 52 ? 0.45 + Math.sin(time * 5) * 0.15 : 0.15);
        r.ring.material.opacity = k;
        r.ring.scale.setScalar(d < 52 ? 1.08 + Math.sin(time * 5) * 0.06 : 1);
      }
      if (r.label) r.label.visible = d < 76;
    }

    /* --- 门（按进度开合） --- */
    for (const d of doorRigs) {
      const open = d.flag ? !!st.flags[d.flag] : false;
      d.mesh.visible = !open;
    }

    /* --- 任务指引 ✦ --- */
    if (marker) {
      const tgt = st.target;
      let tx = null, tz = null, h = 0;
      if (tgt) {
        if (tgt.kind === 'tile') {
          tx = tgt.x * TILE + TILE / 2; tz = tgt.y * TILE + TILE / 2; h = 40;
        } else {
          const list = tgt.kind === 'npc' ? st.npcs : st.props;
          const o = list.find(o2 => o2.id === tgt.id);
          if (o) { tx = o.x * TILE + TILE / 2; tz = o.y * TILE + TILE / 2; h = 72; }
        }
      }
      marker.group.visible = tx !== null;
      if (tx !== null) {
        marker.group.position.set(tx, h + 26 + Math.sin(time * 3) * 4, tz);
        marker.ring.rotation.z = time * 1.2;
        marker.ring.rotation.x = Math.PI / 2 + Math.sin(time * 0.8) * 0.35;
      }
    }

    /* --- 光源跟随玩家 --- */
    if (playerLight.visible) {
      playerLight.position.set(px, 46 + Math.sin(time * 6) * 1.5, pz);
      playerLight.intensity = 13500 + Math.sin(time * 9) * 900;
    }
    updateTorchLights(px, pz, !!curMap.dark);
    sun.position.set(look.x + 300, 620, look.z + 210);
    sun.target.position.set(look.x, 0, look.z);

    updateCamera(dt, px, pz);
    updateMotes(dt, px, pz);

    renderer.render(scene, camera);
  }

  return {
    get ready() { return ready; },
    get error() { return error; },
    ROT_STEP: ROT_STEP,
    init,
    loadMap,
    frame,
    resize,
    snapCamera,
    updateCamera,
    resetView,
    setYaw(a) { yawTarget = a; },
    yaw() { return yawTarget; },
    yawCurrent() { return yaw; },
    /* 供游戏逻辑换算「屏幕方向 → 世界方向」。
     * 注意：这里把方位角量化到最近的 90°，因此无论相机被拖到哪个角度，
     * WASD 永远落在「最近的瓦片轴向」上——一格宽走廊不会被斜着撞墙。 */
    basis() {
      const step = Math.PI / 2;
      const a = Math.round(yawTarget / step) * step;
      const fx = -Math.cos(a), fz = -Math.sin(a);
      return { fx, fz, rx: -fz, rz: fx };
    },
    /* 仅供自动化测试读取内部状态 / 触发输入，游戏逻辑不依赖它 */
    debug: {
      camera() {
        return {
          x: look.x, z: look.z,
          y: camera ? camera.position.y : 0,
          dist: dist, yaw: yaw, pitch: pitch, zoom: zoom,
          camX: camera ? camera.position.x : 0,
          camZ: camera ? camera.position.z : 0,
        };
      },
      nodes() {
        return {
          player: playerRig ? playerRig.group : null,
          npcs: npcRigs, props: propRigs, doors: doorRigs,
        };
      },
      marker() { return marker; },
      lights() { return { player: playerLight, torches: torchPool, sun: sun }; },
      zoomBy(deltaY) { onWheel({ deltaY: deltaY, preventDefault() {} }); },
      dragBy(dx, dy) {
        onPointerDown({ clientX: 0, clientY: 0, pointerId: 1 });
        onPointerMove({ clientX: dx, clientY: dy, pointerId: 1 });
        onPointerUp({ clientX: dx, clientY: dy, pointerId: 1 });
      },
      counts() {
        let meshes = 0;
        scene.traverse(o => { if (o.isMesh) meshes++; });
        return { meshes: meshes, npcs: npcRigs.length, props: propRigs.length, doors: doorRigs.length };
      },
    },
  };
})();
