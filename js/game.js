/* =========================================================
 * 哈利·波特与魔法石 · 游戏引擎
 * （渲染 / 移动 / 对话 / 迷你游戏 / 决斗 / 存档）
 * ========================================================= */
'use strict';

/* ---------- 小工具 ---------- */
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const SAVE_KEY = 'hp1_save_v1';

/* ---------- 3D 渲染引擎（js/render3d.js） ----------
 * 无头测试环境不会加载 render3d.js，这里做一个安全兜底，
 * 保证逻辑层（任务 / 对话 / 迷你游戏 / 存档）始终可用。 */
const GFX = (typeof R3 !== 'undefined' && R3) ? R3 : {
  ready: false, error: '',
  init() { return false; }, loadMap() {}, frame() {}, resize() {},
  snapCamera() {}, updateCamera() {}, resetView() {}, setYaw() {}, yaw() { return 0; },
  yawCurrent() { return 0; },
  basis() { const fx = -1, fz = 0; return { fx, fz, rx: -fz, rz: fx }; },
};
/* ---------- 音效与音乐（WebAudio 实时合成，无外部素材） ---------- */
let actx = null;
let soundOn = true;
try { soundOn = localStorage.getItem('hp1_sound') !== 'off'; } catch (e) {}

function ensureAudio() {
  if (!actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { return false; }
  }
  if (actx.state === 'suspended') actx.resume().catch(() => {});
  return true;
}
function tone(freq, t, dur, vol, type) {
  if (!actx) return;
  const o = actx.createOscillator();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t);
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.001), t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(actx.destination);
  o.start(t); o.stop(t + dur + 0.05);
}
function tone2(freq, t, dur, vol) {
  // 主音 + 弱泛音，类似音乐盒
  tone(freq, t, dur, vol, 'sine');
  tone(freq * 2, t, dur, vol * 0.22, 'sine');
}
function noiseBurst(t, dur, vol, filterFreq) {
  if (!actx) return;
  const len = Math.max(1, Math.floor(actx.sampleRate * dur));
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = actx.createBufferSource();
  src.buffer = buf;
  const f = actx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = filterFreq || 800;
  const g = actx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(actx.destination);
  src.start(t);
}
function sfx(kind) {
  if (!soundOn) return;
  if (!ensureAudio()) return;
  const t = actx.currentTime;
  try {
    switch (kind) {
      case 'pickup': tone2(660, t, 0.14, 0.12); tone2(990, t + 0.09, 0.16, 0.10); break;
      case 'success': tone2(523, t, 0.14, 0.12); tone2(659, t + 0.1, 0.14, 0.11); tone2(784, t + 0.2, 0.26, 0.11); break;
      case 'fail': tone(180, t, 0.22, 0.09, 'sawtooth'); break;
      case 'hit': noiseBurst(t, 0.12, 0.16, 500); tone(110, t, 0.14, 0.12, 'square'); break;
      case 'step': noiseBurst(t, 0.05, 0.04, 700); break;
      case 'tick': tone(1750, t, 0.03, 0.012, 'sine'); break;
      case 'pop': tone(520, t, 0.07, 0.08, 'sine'); tone(760, t + 0.04, 0.06, 0.05, 'sine'); break;
      case 'whoosh': noiseBurst(t, 0.3, 0.1, 1400); break;
      case 'spell': noiseBurst(t, 0.22, 0.12, 2400); tone(880, t, 0.2, 0.06, 'sine'); break;
      case 'fluteNote': tone2(784, t, 0.35, 0.12); break;
      case 'fluteBad': tone(150, t, 0.28, 0.1, 'sawtooth'); break;
      case 'catch': noiseBurst(t, 0.14, 0.12, 1800); tone2(1320, t, 0.1, 0.08); break;
      case 'fanfare': [523, 659, 784, 1046].forEach((f, i) => tone2(f, t + i * 0.12, 0.26, 0.11)); break;
      default: break;
    }
  } catch (e) { /* 音频异常静默 */ }
}

/* 背景音乐：原创轻柔 3/4 拍魔法风循环（A 小调五声音阶，音乐盒音色） */
const BEAT = 0.34;
const MUSIC = [76, 72, 69, 67, 69, 72, 76, 72, 69, 67, 64, 60, 62, 65, 69, 67, 64, 60, 69, 72, 76, 69, null, 64];
const BASS  = [57, 55, 57, 55, 53, 55, 57, 57];
function midiHz(n) { return 440 * Math.pow(2, (n - 69) / 12); }
let musicTimer = null, mi = 0, mtime = 0;
function pumpMusic() {
  if (!actx || actx.state !== 'running') return;
  while (mtime < actx.currentTime + 0.5) {
    const idx = mi % MUSIC.length;
    const f = MUSIC[idx];
    if (f) tone2(midiHz(f), mtime, 0.3, 0.05);
    if (idx % 3 === 0) tone(midiHz(BASS[(idx / 3) % BASS.length]), mtime, 0.55, 0.032, 'triangle');
    mi++;
    mtime += BEAT;
  }
}
function startMusic() {
  if (!soundOn) return;
  if (musicTimer) return;
  ensureAudio();
  musicTimer = setInterval(pumpMusic, 120);
}
function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  mi = 0; mtime = 0;
}
function toggleSound() {
  soundOn = !soundOn;
  try { localStorage.setItem('hp1_sound', soundOn ? 'on' : 'off'); } catch (e) {}
  if (soundOn) { ensureAudio(); sfx('success'); startMusic(); }
  else stopMusic();
  updateSoundBtn();
}
function updateSoundBtn() {
  const b = $('btnSound');
  if (b) b.textContent = soundOn ? '🔊' : '🔇';
}
function resumeAudio() {
  if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
}
document.addEventListener('pointerdown', resumeAudio);
document.addEventListener('keydown', resumeAudio);

/* ---------- 提示浮层 ---------- */
let toastTimer = null;
function toast(msg, ms) {
  const el = $('toast');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, ms || 2600);
}

/* ---------- 全局状态 ---------- */
const S = {
  mapId: 'privet',
  pos: { x: 0, y: 0 },
  face: 'down',
  hp: 100, maxHp: 100,
  mana: 4,
  gold: 0,
  items: [], spells: [], wand: null, wands: [],
  flags: {}, pts: 0,
  walkT: 0,
  faceAng: Math.PI / 4,
};

function freshState() {
  S.mapId = 'privet';
  S.pos = { x: 0, y: 0 };
  S.face = 'down';
  S.hp = 100; S.maxHp = 100; S.mana = 4;
  S.gold = 0;
  S.items = []; S.spells = []; S.wand = null; S.wands = [];
  S.flags = {}; S.pts = 0; S.walkT = 0; S.faceAng = Math.PI / 4;
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      mapId: S.mapId, pos: S.pos, face: S.face, faceAng: S.faceAng,
      hp: S.hp, maxHp: S.maxHp, mana: S.mana, gold: S.gold,
      items: S.items, spells: S.spells, wand: S.wand ? S.wand.id : null,
      wands: S.wands,
      flags: S.flags, pts: S.pts,
    }));
  } catch (e) { /* 存档失败忽略 */ }
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

/* ---------- 地图编译 ---------- */
const compiled = {};
function compileMaps() {
  for (const k in MAPS) {
    const d = MAPS[k];
    compiled[k] = {
      name: d.name, w: d.w, h: d.h, g: d.g, dark: d.dark,
      doors: d.doors || [], transitions: d.transitions || [],
      npcs: d.npcs || [], props: d.props || [],
      enter: d.enter, spawn: d.spawn,
    };
  }
}

let cur = null;
let stepTimer = 0;
let cam = { x: 0, y: 0 };
let lastFailTime = 0;

function isSolidAt(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= cur.w || ty >= cur.h) return true;
  const c = cur.g[ty][tx];
  if (c === 'd') {
    const door = cur.doors.find(d => d.x === tx && d.y === ty);
    return !(door && S.flags[door.flag]);
  }
  return SOLID.has(c);
}
function solidAtPixel(px, py) { return isSolidAt(Math.floor(px / TS), Math.floor(py / TS)); }

function canStand(x, y) {
  const hw = 9, hh = 12;
  return !solidAtPixel(x - hw, y - hh) && !solidAtPixel(x + hw, y - hh) &&
         !solidAtPixel(x - hw, y + hh) && !solidAtPixel(x + hw, y + hh);
}

/* 四向朝向对应的世界偏航角（角色正面朝 +Z） */
const FACE_ANG = { down: Math.PI / 4, up: -3 * Math.PI / 4, left: -Math.PI / 4, right: 3 * Math.PI / 4 };

/* ---------- 视角与相机（3D） ----------
 * 场景由一台绕 Y 轴旋转的跟随相机呈现：
 *   · viewRotTarget：目标偏航角，Q / R 每次 ±ROT_STEP（30°）
 *   · 平滑过渡、跟随与投影全部由 R3 引擎负责
 * 移动方向使用「相机基向量」换算，因此任何视角下 W 都是「朝画面里走」。
 *
 * 注意：移动基向量在 R3.basis() 里被量化到最近的 90°，所以无论视角转到哪，
 * WASD 永远落在瓦片轴上——一格宽走廊不会被斜着撞墙。 */
let viewRot = 0;          // 当前视角（弧度）
let viewRotTarget = 0;    // 目标视角（ROT_STEP 的整数倍）

/* 视角旋转步长：30°（一次转 90° 太生硬，30° 更柔和，转 3 次正好 90°） */
const ROT_STEP = (typeof R3 !== 'undefined' && R3 && R3.ROT_STEP) || Math.PI / 6;

/* 旋转视角：dir = +1 / -1（每次 ROT_STEP） */
function rotateView(dir) {
  /* 若玩家用鼠标拖拽微调过视角，以引擎当前角度为基准继续转，避免跳回旧档位 */
  if (GFX.ready) viewRotTarget = GFX.yaw();
  viewRotTarget += dir * ROT_STEP;
  if (GFX.ready) GFX.setYaw(viewRotTarget);
  else viewRot = viewRotTarget;
  sfx('pop');
}

/* 当前视角（用于小地图朝向）：优先取引擎里正在过渡的真实角度 */
function currentYaw() {
  return GFX.ready ? GFX.yawCurrent() : viewRot;
}

/* 屏幕方向 → 世界方向的基向量（相对当前相机） */
function viewBasis() {
  if (GFX.ready) return GFX.basis();
  const a = viewRot;
  const fx = -Math.cos(a), fz = -Math.sin(a);
  return { fx, fz, rx: -fz, rz: fx };
}

/* 相机：立即对齐 / 平滑跟随 */
function snapCamera() { if (GFX.ready) GFX.snapCamera(S.pos.x, S.pos.y); }
function updateCamera(dt) { if (GFX.ready) GFX.updateCamera(dt, S.pos.x, S.pos.y); }
/* ---------- 地图名 ---------- */
function setMapName(name) {
  const el = $('mapName');
  if (!el) return;
  el.textContent = name;
  if (el.classList) {
    el.classList.remove('flash');
    // 强制重排以重启动画（无头环境下 offsetWidth 为 undefined，忽略即可）
    if (typeof el.offsetWidth === 'number') void el.offsetWidth;
    el.classList.add('flash');
  }
}

/* ---------- 传送 / 加载地图 ---------- */
function doTeleport(mapId, px, py, useSpawn) {
  if (!compiled[mapId]) return;
  cur = compiled[mapId];
  S.mapId = mapId;
  if (useSpawn) {
    S.pos = { x: cur.spawn.x * TS + TS / 2, y: cur.spawn.y * TS + TS / 2 };
  } else if (px !== undefined && py !== undefined) {
    S.pos = { x: px * TS + TS / 2, y: py * TS + TS / 2 };
  } else if (!S.pos || S.pos.x === 0 && S.pos.y === 0) {
    S.pos = { x: cur.spawn.x * TS + TS / 2, y: cur.spawn.y * TS + TS / 2 };
  }
  // 防卡死：若落点在实心瓦片上（含旧存档），自动回位到出生点或最近可站立处
  if (!canStand(S.pos.x, S.pos.y)) {
    S.pos = { x: cur.spawn.x * TS + TS / 2, y: cur.spawn.y * TS + TS / 2 };
    if (!canStand(S.pos.x, S.pos.y)) {
      outer:
      for (let y = 0; y < cur.h; y++) {
        for (let x = 0; x < cur.w; x++) {
          const tx = x * TS + TS / 2, ty = y * TS + TS / 2;
          if (canStand(tx, ty)) { S.pos = { x: tx, y: ty }; break outer; }
        }
      }
    }
  }
  if (GFX.ready) GFX.loadMap(cur, mapId);
  snapCamera();
  setMapName(cur.name);
  sfx('whoosh');
  const seen = 'seen_' + mapId;
  if (cur.enter && !S.flags[seen]) {
    S.flags[seen] = 1;
    startDialog(cur.enter);
  }
  saveGame();
}

/* 当前地图上可见的 NPC / 道具 */
function visibleNpcs() { return cur.npcs.filter(n => !n.show || n.show(S)); }
function visibleProps() { return cur.props.filter(p => !p.show || p.show(S)); }

/* ---------- 输入 ---------- */
const keys = {};
let touchDir = null;

function setTouchDir(d) { touchDir = d; }

/* ---------- 交互 ---------- */
function getNear() {
  const px = S.pos.x, py = S.pos.y;
  let best = null, bestD = 999;
  for (const n of visibleNpcs()) {
    const cx = n.x * TS + TS / 2, cy = n.y * TS + TS / 2;
    const d = Math.hypot(cx - px, cy - py);
    if (d < 52 && d < bestD) { bestD = d; best = { kind: 'npc', obj: n }; }
  }
  for (const p of visibleProps()) {
    const cx = p.x * TS + TS / 2, cy = p.y * TS + TS / 2;
    const d = Math.hypot(cx - px, cy - py);
    if (d < 52 && d < bestD) { bestD = d; best = { kind: 'prop', obj: p }; }
  }
  return best;
}

function tryInteract() {
  const near = getNear();
  if (!near) return;
  sfx('pop');
  const id = near.obj.dialog;
  if (id && DIALOGS[id]) startDialog(id);
}

/* ---------- 效果应用 ---------- */
function learnSpell(id) {
  if (S.spells.indexOf(id) === -1) {
    S.spells.push(id);
    toast('学会咒语：' + SPELLS[id].i + ' ' + SPELLS[id].n, 2200);
  }
}

function applyEffects(set, gain, hp, pts) {
  if (set) {
    for (const k in set) {
      const v = set[k];
      if (k === 'pts') { S.pts += v; }
      else if (k === 'gold') { S.gold += v; }
      else if (k === 'wand') {
        S.wand = WANDS[v];
        if (v && S.wands.indexOf(v) === -1) S.wands.push(v);
      }
      else { S.flags[k] = v; }
    }
    if (set.hasStone) { learnSpell('stupefy'); learnSpell('incendio'); }
    if (set.lessonDone) { learnSpell('lumos'); learnSpell('wingardium'); }
  }
  if (gain) {
    for (const id of gain) {
      S.items.push(id);
      if (ITEMS[id]) toast('获得：' + ITEMS[id].i + ' ' + ITEMS[id].n, 2000);
    }
  }
  if (set) {
    if (set.lettersDone === 1) toast('又一封信飘进了院子——跟着金色的 ✦ 就能找到它！', 3000);
    if (set.lettersDone === 2) toast('门口传来一声巨响——是海格来了！', 2600);
    if (set.hagridDone) toast('海格在院子里等你——穿过院门，去对角巷！', 2800);
  }
  if (hp) S.hp = clamp(S.hp + hp, 1, S.maxHp);
  if (pts) S.pts += pts;
  saveGame();
}

/* ---------- 对话系统 ---------- */
let dialog = null;
let typing = null;

function showDialogBox(on) { $('dialog').style.display = on ? 'block' : 'none'; }

function startDialog(id) {
  const lines = DIALOGS[id];
  if (!lines || !lines.length) return;
  dialog = { id, lines, idx: -1 };
  showDialogBox(true);
  advanceDialog();
}

function advanceDialog() {
  dialog.idx++;
  if (dialog.idx >= dialog.lines.length) { closeDialog(); return; }
  processLine(dialog.lines[dialog.idx]);
}

function processLine(line) {
  // 先应用行内效果
  applyEffects(line.set, line.gain, line.hp, line.pts);
  if (line.go) { closeDialog(); doTeleport(line.go, undefined, undefined, !!line.goSpawn); return; }
  if (line.m) {
    const mId = line.m;
    closeDialog();
    if (mId === 'duel') runDuel(line.mAfter);
    else openMini(mId, line.mAfter);
    return;
  }
  if (line.c) { $('dText').textContent = line.t || ''; showChoices(line.c); return; }
  if (line.t) { showLine(line); return; }
  // 纯效果行：直接继续
  advanceDialog();
}

function showLine(line) {
  $('dIcon').textContent = line.i || '💬';
  $('dName').textContent = line.n || '';
  typing = { text: line.t, shown: 0 };
  $('dChoices').innerHTML = '';
  renderTyping();
}

function renderTyping() {
  if (!typing) return;
  $('dText').textContent = typing.text.slice(0, Math.floor(typing.shown));
}

function updateTyping(dt) {
  if (!typing) return;
  const prev = Math.floor(typing.shown);
  typing.shown += dt * 42;
  const now = Math.floor(typing.shown);
  if (now > prev && now % 4 === 0 && now < typing.text.length) sfx('tick');
  if (typing.shown >= typing.text.length) {
    $('dText').textContent = typing.text;
    typing = null;
    return;
  }
  $('dText').textContent = typing.text.slice(0, Math.floor(typing.shown));
}

function showChoices(choices) {
  typing = null;
  $('dText').textContent = '';
  const box = $('dChoices');
  box.innerHTML = '';
  choices.forEach(ch => {
    const b = document.createElement('button');
    b.className = 'choice-btn';
    b.innerHTML = (ch.t || '') + (ch.sub ? '<small>' + ch.sub + '</small>' : '');
    b.addEventListener('click', e => { e.stopPropagation(); pickChoice(ch); });
    box.appendChild(b);
  });
}

function pickChoice(ch) {
  applyEffects(ch.set || {}, ch.gain || [], ch.hp || 0, ch.pts || 0);
  if (ch.go) { closeDialog(); doTeleport(ch.go, undefined, undefined, !!ch.goSpawn); return; }
  if (ch.d) {
    dialog.lines = DIALOGS[ch.d] || [];
    dialog.idx = -1;
    advanceDialog();
  } else closeDialog();
}

function closeDialog() {
  showDialogBox(false);
  dialog = null;
  typing = null;
  if (S.flags.duelWon && S.flags.gameEnd === undefined) {
    S.flags.gameEnd = 1;
    saveGame();
    showCredits();
  }
}

/* 推进对话（打字机未完成则补全，否则下一行） */
function advancePress() {
  if (!dialog) return;
  if (typing) { $('dText').textContent = typing.text; typing = null; return; }
  const line = dialog.lines[dialog.idx];
  if (line && line.c) return; // 选择支等待点击
  advanceDialog();
}

/* ---------- 迷你游戏 ---------- */
let currentMini = null;

function miniWrap() { return $('miniBody'); }

function openMini(id, after) {
  const def = MINIS[id];
  if (!def) return;
  currentMini = { id, def, after, done: false, keyHandler: null, raf: null };
  $('mini').style.display = 'flex';
  const w = miniWrap();
  w.innerHTML = '';
  if (def.title) {
    const h = document.createElement('h3');
    h.textContent = def.title;
    w.appendChild(h);
  }
  const desc = document.createElement('div');
  desc.className = 'mini-desc';
  desc.textContent = def.desc || '';
  w.appendChild(desc);

  const handlers = {
    lev: () => runLevMini(def),
    rhythm: () => runRhythmMini(def),
    quiz: () => runQuizMini(def),
    keys: () => runKeysMini(def),
    chess: () => runChessMini(def),
    snitch: () => runSnitchMini(def),
  };
  (handlers[def.type] || (() => {}))();
}

function miniStatus(msg) {
  let el = miniWrap().querySelector('.mini-status');
  if (!el) {
    el = document.createElement('div');
    el.className = 'mini-status';
    miniWrap().appendChild(el);
  }
  el.textContent = msg || '';
}

function miniHp(msg) {
  let el = miniWrap().querySelector('.mini-hp');
  if (!el) {
    el = document.createElement('div');
    el.className = 'mini-hp';
    miniWrap().appendChild(el);
  }
  el.textContent = msg || '';
}

function loseHp(n) {
  S.hp = clamp(S.hp - n, 1, S.maxHp);
  miniHp('⚡ 哈利体力：' + S.hp + '/' + S.maxHp);
  sfx('fail');
  updateHud();
}

function miniSuccess() {
  const m = currentMini;
  if (!m || m.done) return;
  m.done = true;
  cancelMiniRaf();
  applyEffects(m.def.passFlags);
  sfx('success');
  $('mini').style.display = 'none';
  currentMini = null;
  if (m.after && DIALOGS[m.after]) startDialog(m.after);
}

function miniRetry(msg) {
  const btn = document.createElement('button');
  btn.className = 'mini-btn';
  btn.textContent = msg || '再试一次';
  btn.addEventListener('click', () => {
    const m = currentMini;
    if (m) { cancelMiniRaf(); openMini(m.id, m.after); }
  });
  miniWrap().appendChild(btn);
}

function cancelMiniRaf() {
  if (currentMini && currentMini.raf) { cancelAnimationFrame(currentMini.raf); currentMini.raf = null; }
}

/* --- 魔咒课：漂浮羽毛（对时机） --- */
function runLevMini(def) {
  let n = 0;
  const bar = document.createElement('div');
  bar.className = 'lev-bar';
  const zoneW = 22; // 百分比
  const zone = document.createElement('div');
  zone.className = 'lev-zone';
  zone.style.left = (50 - zoneW / 2) + '%';
  zone.style.width = zoneW + '%';
  bar.appendChild(zone);
  const marker = document.createElement('div');
  marker.className = 'lev-marker';
  bar.appendChild(marker);
  miniWrap().appendChild(bar);
  miniStatus('第 1 / ' + def.success + ' 次：在指针进入金色区域时按下空格 / 点击');

  const press = () => {
    if (currentMini && currentMini.id !== 'leviosa') return;
    const px = parseFloat(marker.style.left || '0');
    if (px >= 50 - zoneW / 2 + 2 && px <= 50 + zoneW / 2 - 6) {
      n++;
      sfx('pickup');
      if (n >= def.success) { miniStatus('羽毛轻盈地浮了起来！'); miniSuccess(); return; }
      miniStatus('成功！第 ' + (n + 1) + ' / ' + def.success + ' 次');
    } else {
      miniStatus('「羽加迪姆勒维奥萨——」羽毛只是抖了抖……再试一次');
    }
  };
  currentMini.keyHandler = press;
  const w = miniWrap();
  w.addEventListener('click', press);
  currentMini.clickCleanup = () => w.removeEventListener('click', press);

  let last = performance.now();
  const tick = t => {
    if (!currentMini || currentMini.id !== 'leviosa' || currentMini.done) return;
    const dt = (t - last) / 1000; last = t;
    const pos = (Math.sin(t / 420) + 1) / 2 * (100 - 7);
    marker.style.left = pos + '%';
    currentMini.raf = requestAnimationFrame(tick);
  };
  currentMini.raf = requestAnimationFrame(tick);
}

/* --- 三头犬：吹笛节奏 --- */
function runRhythmMini(def) {
  let n = 0;
  const stage = document.createElement('div');
  stage.className = 'ring-stage';
  stage.innerHTML = '<div class="ring-outer"></div><div class="ring-pulse"></div><div class="ring-inner"></div>';
  miniWrap().appendChild(stage);
  miniStatus('第 1 / ' + def.success + ' 个音符：光环缩到最小时吹响！');

  const press = () => {
    if (currentMini && currentMini.id !== 'flute') return;
    if (currentMini.lastPress && performance.now() - currentMini.lastPress < 360) return;
    currentMini.lastPress = performance.now();
    const phase = (performance.now() % 1100) / 1100;
    if (phase <= 0.24) {
      n++;
      sfx('fluteNote');
      if (n >= def.success) { miniStatus('弗拉菲的鼾声响了起来……'); miniSuccess(); return; }
      miniStatus('♪ 完美！第 ' + (n + 1) + ' / ' + def.success + ' 个音符');
    } else {
      miniStatus('♪ 刺耳的音符——弗拉菲咆哮起来！');
      sfx('fluteBad');
      loseHp(def.failHp || 0);
    }
  };
  currentMini.keyHandler = press;
  const w = miniWrap();
  w.addEventListener('click', press);
  currentMini.clickCleanup = () => w.removeEventListener('click', press);
}

/* --- 答题（魔鬼网 / 魔药谜题 / 魔药课） --- */
function runQuizMini(def) {
  let qi = 0;
  const status = document.createElement('div');
  status.className = 'mini-status';
  miniWrap().appendChild(status);
  const hpLine = document.createElement('div');
  hpLine.className = 'mini-hp';
  hpLine.textContent = '⚡ 哈利体力：' + S.hp + '/' + S.maxHp;
  miniWrap().appendChild(hpLine);

  function renderQ() {
    if (qi >= def.questions.length) { miniSuccess(); return; }
    const q = def.questions[qi];
    status.textContent = q.q;
    const old = miniWrap().querySelector('.q-zone');
    if (old) old.remove();
    const zone = document.createElement('div');
    zone.className = 'q-zone';
    q.opts.forEach((t, i) => {
      const b = document.createElement('button');
      b.className = 'mini-btn';
      b.textContent = t;
      b.addEventListener('click', () => {
        if (i === q.ans) {
          status.textContent = q.right;
          sfx('pickup');
          qi++;
          setTimeout(renderQ, 900);
        } else {
          status.textContent = q.wrong;
          if (def.failHp) loseHp(def.failHp);
          hpLine.textContent = '⚡ 哈利体力：' + S.hp + '/' + S.maxHp;
          b.disabled = true;
        }
      });
      zone.appendChild(b);
    });
    miniWrap().insertBefore(zone, hpLine);
  }
  renderQ();
}

/* --- 会飞的钥匙 --- */
function runKeysMini(def) {
  const box = document.createElement('div');
  box.className = 'key-box';
  miniWrap().appendChild(box);
  miniStatus('找到那把银色、翅膀有伤的钥匙！');

  const keys = [];
  const correctIdx = Math.floor(Math.random() * 12);
  for (let i = 0; i < 12; i++) {
    keys.push({
      x: rand(30, box.clientWidth - 40), y: rand(24, 200),
      vx: rand(-2.4, 2.4), vy: rand(-2.4, 2.4),
      correct: i === correctIdx,
    });
  }
  let wrongCount = 0;
  let raf = null;

  function spawn() {
    box.innerHTML = '';
    keys.forEach(k => {
      const el = document.createElement('div');
      el.className = 'fkey';
      el.textContent = k.correct ? '🔑' : '🗝️';
      if (k.correct) el.style.color = '#d8d8e8';
      el.style.left = k.x + 'px';
      el.style.top = k.y + 'px';
      el.dataset.idx = keys.indexOf(k);
      box.appendChild(el);
    });
  }
  spawn();

  function tick() {
    if (!currentMini || currentMini.id !== 'keys' || currentMini.done) return;
    const W = box.clientWidth, H = 240;
    keys.forEach(k => {
      k.x += k.vx; k.y += k.vy;
      if (k.x < 24 || k.x > W - 40) k.vx *= -1;
      if (k.y < 20 || k.y > H - 44) k.vy *= -1;
      const el = box.children[keys.indexOf(k)];
      if (el) { el.style.left = k.x + 'px'; el.style.top = k.y + 'px'; }
    });
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  currentMini.raf = raf;

  box.addEventListener('click', e => {
    if (currentMini && currentMini.id !== 'keys') return;
    const r = box.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    for (let i = keys.length - 1; i >= 0; i--) {
      const k = keys[i];
      if (Math.hypot(mx - k.x - 12, my - k.y - 14) < 20) {
        if (k.correct) {
          sfx('success');
          miniStatus('「咔嗒」——银色钥匙插进了锁孔！');
          miniSuccess();
          return;
        } else {
          const el = box.children[i];
          if (el) el.remove();
          keys.splice(i, 1);
          wrongCount++;
          sfx('fail');
          if (wrongCount >= 5) {
            wrongCount = 0;
            loseHp(10);
            miniStatus('钥匙群恼羞成怒地撞了你一下！重新寻找那把银色的钥匙……');
          } else {
            miniStatus('不是这把！还有 ' + (12 - wrongCount) + ' 次机会——注意那把翅膀有伤的银色钥匙');
          }
          return;
        }
      }
    }
  });
}

/* --- 巫师棋 --- */
function runChessMini(def) {
  const STEPS = [
    {
      pieces: [['e1', '♚', 'w'], ['a1', '♜', 'w'], ['c3', '♗', 'p'], ['d5', '♛', 'b'], ['h8', '♜', 'b']],
      hl: 'c3',
      q: '黑方皇后正盯着你的国王。罗恩（骑士）喊道：「我来挡她——主教斜走两步，绕到黑王左侧！」',
      opts: [
        { t: '♗ 斜走到 f3', ok: true, desc: '绕开黑后，逼近黑王阵线' },
        { t: '♗ 直走到 c5', ok: false, desc: '与黑后正面相对——危险' },
        { t: '原地防守', ok: false, desc: '黑后会逐渐包围' },
      ],
      hint: 'f3',
    },
    {
      pieces: [['e1', '♚', 'w'], ['a1', '♜', 'w'], ['f3', '♗', 'p'], ['d5', '♛', 'b'], ['h8', '♜', 'b']],
      hl: 'f3',
      q: '黑方城堡封锁了纵线。赫敏（城堡）喊：「左移两格，别站黑后的对角线！」',
      opts: [
        { t: '♗ 斜进到 h5', ok: true, desc: '贴着黑后侧面，棋路更灵活' },
        { t: '♗ 斜退到 e2', ok: false, desc: '正好落在黑后的对角线——被将军' },
        { t: '♗ 直冲 d6', ok: false, desc: '冲进黑棋阵中——送死' },
      ],
      hint: 'h5',
    },
    {
      pieces: [['e1', '♚', 'w'], ['a1', '♜', 'w'], ['h5', '♗', 'p'], ['g1', '♚', 'b'], ['d5', '♛', 'b'], ['h8', '♜', 'b']],
      hl: 'h5',
      q: '罗恩的声音从远处传来：「将军！黑王在 g1——斜进 g2，和我的骑士联手！」',
      opts: [
        { t: '♗ 斜进到 g2，喊出「将军！」', ok: true, desc: '配合罗恩的骑士，黑王无路可退' },
        { t: '♗ 后退到 h4', ok: false, desc: '太保守，黑后要反击了' },
        { t: '♗ 直走 f3', ok: false, desc: '走法正确但慢了一步' },
      ],
      hint: 'g2',
    },
  ];

  let step = 0;
  const board = document.createElement('div');
  board.className = 'chess-board';
  miniWrap().appendChild(board);
  const status = document.createElement('div');
  status.className = 'mini-status';
  miniWrap().appendChild(status);

  function renderBoard(stepDef) {
    board.innerHTML = '';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = document.createElement('div');
        cell.className = 'chess-cell ' + ((r + c) % 2 ? 'dark' : 'light');
        const name = String.fromCharCode(97 + c) + (8 - r);
        if (stepDef.hl === name) cell.classList.add('hl');
        const piece = stepDef.pieces.find(p => p[0] === name);
        if (piece) {
          cell.textContent = piece[1];
          if (piece[2] === 'p') { cell.style.color = '#ffd76a'; cell.style.fontSize = '30px'; }
          else if (piece[2] === 'w') cell.style.color = '#fff8ea';
          else cell.style.color = '#241a10';
        }
        board.appendChild(cell);
      }
    }
  }

  function renderStep() {
    const sd = STEPS[step];
    renderBoard(sd);
    status.textContent = sd.q;
    const old = miniWrap().querySelector('.q-zone');
    if (old) old.remove();
    const zone = document.createElement('div');
    zone.className = 'q-zone';
    sd.opts.forEach(o => {
      const b = document.createElement('button');
      b.className = 'mini-btn';
      b.innerHTML = o.t + '<small style="display:block;font-size:11px;color:#b0a488">' + o.desc + '</small>';
      b.addEventListener('click', () => {
        if (!o.ok) {
          status.textContent = '「糟糕！」——这一步让你损失惨重（失去体力）';
          loseHp(15);
          b.disabled = true;
          return;
        }
        step++;
        sfx('pickup');
        if (step >= STEPS.length) {
          status.textContent = '「将军！！」罗恩的骑士拼死拦下黑后——黑王轰然倒下！';
          setTimeout(() => {
            status.textContent = '……罗恩倒下了。但棋盘碎成齑粉，通往魔药房间的门开了。';
            sfx('success');
            setTimeout(miniSuccess, 1200);
          }, 600);
        } else renderStep();
      });
      zone.appendChild(b);
    });
    miniWrap().insertBefore(zone, status.nextSibling || null);
  }
  renderStep();
}

/* --- 魁地奇：抓飞贼 --- */
function runSnitchMini(def) {
  const cv = document.createElement('canvas');
  cv.id = 'miniCanvas';
  cv.width = 560; cv.height = 300;
  miniWrap().appendChild(cv);
  const cctx = cv.getContext('2d');
  const status = document.createElement('div');
  status.className = 'mini-status';
  miniWrap().appendChild(status);
  const hpLine = document.createElement('div');
  hpLine.className = 'mini-hp';
  hpLine.textContent = '⚡ 哈利体力：' + S.hp + '/' + S.maxHp;
  miniWrap().appendChild(hpLine);

  let catches = 0;
  let timeLeft = def.time;
  let size = 11;
  const snitch = { x: rand(80, 480), y: rand(60, 240), t: rand(0, 9) };
  const bludgers = [];
  for (let i = 0; i < 3; i++) bludgers.push({ x: rand(40, 520), y: rand(40, 260), vx: rand(1.6, 2.6) * (i % 2 ? 1 : -1), vy: rand(-2, 2) });
  let last = performance.now();
  let endState = null;

  function tick(now) {
    if (!currentMini || currentMini.id !== 'snitch' || currentMini.done) return;
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    timeLeft -= dt;

    snitch.t += dt * (1.2 + catches * 0.5);
    snitch.x = 280 + Math.sin(snitch.t) * 200 * Math.cos(snitch.t * 0.7);
    snitch.y = 150 + Math.cos(snitch.t * 1.3) * 90;

    bludgers.forEach(b => {
      b.x += b.vx; b.y += b.vy;
      if (b.x < 20 || b.x > 540) b.vx *= -1;
      if (b.y < 20 || b.y > 280) b.vy *= -1;
    });

    cctx.clearRect(0, 0, 560, 300);
    // 场地
    cctx.fillStyle = '#0c1428'; cctx.fillRect(0, 0, 560, 300);
    cctx.strokeStyle = '#2a3a5a'; cctx.lineWidth = 2;
    for (let i = 0; i < 560; i += 40) { cctx.beginPath(); cctx.moveTo(i, 0); cctx.lineTo(i, 300); cctx.stroke(); }
    for (let i = 0; i < 300; i += 40) { cctx.beginPath(); cctx.moveTo(0, i); cctx.lineTo(560, i); cctx.stroke(); }
    // 游走球
    bludgers.forEach(b => {
      cctx.fillStyle = '#181c26';
      cctx.beginPath(); cctx.arc(b.x, b.y, 13, 0, 7); cctx.fill();
      cctx.fillStyle = '#3a3f4a';
      cctx.beginPath(); cctx.arc(b.x - 4, b.y - 4, 4, 0, 7); cctx.fill();
    });
    // 金色飞贼
    cctx.fillStyle = '#ffd76a';
    cctx.beginPath(); cctx.arc(snitch.x, snitch.y, size, 0, 7); cctx.fill();
    cctx.fillStyle = '#c9a227';
    cctx.beginPath(); cctx.arc(snitch.x - 2, snitch.y - 2, size * 0.5, 0, 7); cctx.fill();
    cctx.fillStyle = '#fff';
    cctx.beginPath(); cctx.arc(snitch.x, snitch.y, size * 0.22, 0, 7); cctx.fill();

    status.textContent = '抓到飞贼：' + catches + '/3 · 剩余时间 ' + Math.max(0, Math.ceil(timeLeft)) + 's';

    if (timeLeft <= 0) {
      if (!endState) {
        endState = 'fail';
        status.textContent = '飞贼钻进了看台……伍德抱住脑袋：「再来一场！」';
        sfx('fail');
        miniRetry('再战一场');
      }
      return;
    }
    currentMini.raf = requestAnimationFrame(tick);
  }

  cv.addEventListener('click', e => {
    if (currentMini && currentMini.id !== 'snitch') return;
    if (endState) return;
    const r = cv.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (560 / r.width);
    const my = (e.clientY - r.top) * (300 / r.height);
    let hitBludger = false;
    bludgers.forEach(b => { if (Math.hypot(mx - b.x, my - b.y) < 16) hitBludger = true; });
    if (hitBludger) {
      sfx('fail');
      loseHp(10);
      hpLine.textContent = '⚡ 哈利体力：' + S.hp + '/' + S.maxHp;
      status.textContent = '游走球撞到了你！快躲开！';
      return;
    }
    if (Math.hypot(mx - snitch.x, my - snitch.y) < size + 10) {
      catches++;
      size = Math.max(6, size - 2);
      sfx('catch');
      if (catches >= 3) {
        endState = 'win';
        miniSuccess();
      } else {
        status.textContent = '抓住了飞贼！！第 ' + catches + ' 次——它还戴着金链子！';
      }
    }
  });

  currentMini.raf = requestAnimationFrame(tick);
}

/* ---------- 决斗（奇洛 / 伏地魔） ---------- */
function runDuel(after) {
  /* ---------- 决斗流程 ---------- */
  const D = DUEL;
  let over = false, busy = false;

  function setLog(t) { log.textContent = t || ''; }

  function countItem(id) { return S.items.filter(x => x === id).length; }

  function consumeItem(id) {
    const i = S.items.indexOf(id);
    if (i !== -1) S.items.splice(i, 1);
  }

  function wandPower() { return S.wand && S.wand.power ? S.wand.power : 1; }
  function wandHit() { return S.wand && S.wand.hit ? S.wand.hit : 0; }

  /* 刷新血条 / 魔力 / 体力行 */
  function refresh() {
    const hf = hUnit.querySelector('.fill');
    const qf = qUnit.querySelector('.fill');
    if (hf) hf.style.width = clamp(hpH / D.harry.maxHp * 100, 0, 100) + '%';
    if (qf) qf.style.width = clamp(qHp / D.quirrell.maxHp * 100, 0, 100) + '%';
    manaLine.textContent = '✨ 魔力 ' + mana + '/' + D.harry.maxMana +
      '　⚡ 体力 ' + hpH + '/' + S.maxHp;
    S.hp = hpH; S.mana = mana;
    updateHud();
  }

  /* 敌方一次攻击，返回战报文本 */
  function enemyStrike(heavy) {
    const boost = (phase2 ? 1.5 : 1) * (heavy ? 1.3 : 1);
    const raw = Math.round((11 + Math.floor(Math.random() * 9)) * boost);
    const wasDef = defending;
    defending = false;
    const dmg = wasDef ? Math.max(1, Math.round(raw * 0.4)) : raw;
    hpH = clamp(hpH - dmg, 1, S.maxHp);
    let msg = (phase2 ? '伏地魔嘶吼着挥杖——' : '奇洛挥动魔杖——') + '你被击中，体力 -' + dmg + '。';
    if (wasDef) msg += '（防御卸掉了大半力道）';
    return msg;
  }

  function quirellTurn() {
    if (over) return;
    busy = true;
    const msg = enemyStrike(false);
    mana = clamp(mana + 1, 0, D.harry.maxMana);
    refresh();
    if (hpH <= 1) { finish(msg + ' 你再也站不住了……', false); return; }
    setLog(msg);
    busy = false;
    renderActions();
  }

  /* 玩家施法 */
  function cast(key) {
    if (over || busy) return;
    const sp = D.spells[key];
    if (!sp) return;
    if (S.spells.indexOf(key) === -1) { setLog('你还没学会这个咒语。'); return; }
    if (mana < sp.cost) { setLog('魔力不足——先「凝神」恢复魔力。'); return; }
    busy = true;
    mana -= sp.cost;
    let msg;
    if (Math.random() < clamp(sp.hit + wandHit(), 0.05, 0.95)) {
      const dmg = Math.max(1, Math.round(sp.dmg * wandPower()));
      qHp = clamp(qHp - dmg, 0, D.quirrell.maxHp);
      msg = sp.text + ' 奇洛体力 -' + dmg + '。';
      sfx('spell');
    } else {
      msg = '咒语擦着奇洛的肩膀飞了过去——打偏了！';
      sfx('whoosh');
    }
    if (qHp <= 0) { refresh(); finish(msg + ' 奇洛倒下了！', true); return; }
    if (!phase2 && qHp > 0 && qHp <= D.quirrell.maxHp * 0.5) {
      phase2 = true;
      msg += ' 奇洛抽搐着弯下腰——伏地魔的脸从他后脑转了出来：「没用的，波特！」';
    }
    setLog(msg);
    refresh();
    setTimeout(quirellTurn, 480);
  }

  /* 玩家防御 */
  function guard() {
    if (over || busy) return;
    busy = true;
    defending = true;
    mana = clamp(mana + 2, 0, D.harry.maxMana);
    setLog('你稳住呼吸，举起魔杖准备格挡……');
    refresh();
    setTimeout(quirellTurn, 440);
  }

  /* 喝疗伤剂 */
  function drinkPotion() {
    if (over || busy) return;
    if (countItem('potion') <= 0) { setLog('背包里没有疗伤剂了。'); return; }
    busy = true;
    consumeItem('potion');
    hpH = clamp(hpH + 25, 1, S.maxHp);
    setLog('你一口气喝下疗伤剂——伤口开始愈合。');
    refresh();
    setTimeout(quirellTurn, 440);
  }

  /* 行动按钮 */
  function renderActions() {
    if (over) return;
    actions.innerHTML = '';
    const mk = (html, sub, enabled, fn) => {
      const b = document.createElement('button');
      b.className = 'mini-btn' + (enabled ? '' : ' secondary');
      b.innerHTML = html + (sub ? '<small>' + sub + '</small>' : '');
      if (enabled) b.addEventListener('click', fn);
      else { b.disabled = true; b.style.opacity = '.45'; }
      actions.appendChild(b);
    };
    for (const key in D.spells) {
      const sp = D.spells[key];
      const known = S.spells.indexOf(key) !== -1;
      mk(sp.i + ' ' + sp.n, known ? ('魔力 ' + sp.cost + ' · 伤害 ' + sp.dmg) : '未学会',
         known && mana >= sp.cost, () => cast(key));
    }
    mk('🛡 凝神防御', '减伤 60% · 魔力 +2', true, guard);
    const potions = countItem('potion');
    if (potions > 0) mk('🧪 疗伤剂 ×' + potions, '恢复 25 体力', true, drinkPotion);
  }

  /* 空格 = 快速施放昏昏倒地 */
  currentMini.keyHandler = k => { if (k === 'space') cast('stupefy'); };

  setLog('「把石头给我，波特……」伏地魔的声音在石室里回荡。');
  refresh();
  renderActions();
}

  /* ---------- 渲染（交给 3D 引擎） ---------- */
/* 当前地图上的任务目标（金色 ✦ 标记指引） */
function questTarget() {
  const f = S.flags;
  switch (S.mapId) {
    case 'privet':
      if (!f.lettersDone) return { kind: 'prop', id: 'letter1' };
      if (f.lettersDone < 2) return { kind: 'prop', id: 'letter2' };
      if (!f.hagridDone) return { kind: 'npc', id: 'hagrid' };
      return { kind: 'tile', x: 21, y: 11, label: '院门' };
    case 'diagon':
      if (!f.gringottsDone) return { kind: 'npc', id: 'gringotts' };
      if (!f.wandBought) return { kind: 'npc', id: 'ollivander' };
      if (!f.robesBought) return { kind: 'npc', id: 'madam_malkin' };
      if (!f.booksBought) return { kind: 'npc', id: 'bookshop' };
      if (!f.owlBought) return { kind: 'npc', id: 'owl_shop' };
      return { kind: 'tile', x: 28, y: 7, label: '车站入口' };
    case 'station': return { kind: 'prop', id: 'barrier' };
    case 'train':
      if (!f.meetRon) return { kind: 'npc', id: 'ron_train' };
      if (!f.meetHermione) return { kind: 'npc', id: 'hermione_train' };
      if (!f.toadFound) return { kind: 'prop', id: 'toad' };
      return { kind: 'tile', x: 26, y: 6, label: '列车尽头' };
    case 'hall':
      if (!f.sorted) return { kind: 'prop', id: 'hat' };
      return { kind: 'tile', x: 24, y: 7, label: '城堡入口' };
    case 'classroom':
      if (!f.lessonDone) return { kind: 'npc', id: 'flitwick' };
      if (!f.quizDone) return { kind: 'npc', id: 'snape' };
      return { kind: 'tile', x: 1, y: 7, label: '回城堡' };
    case 'pitch':
      if (!f.quidditchDone) return { kind: 'prop', id: 'match' };
      return { kind: 'tile', x: 1, y: 8, label: '回城堡' };
    case 'forest':
      if (!f.unicornSeen) return { kind: 'prop', id: 'blood' };
      return { kind: 'tile', x: 30, y: 16, label: '禁林出口' };
    case 'mirror':
      if (!f.mirrorDone) return { kind: 'prop', id: 'mirror' };
      return { kind: 'tile', x: 16, y: 6, label: '回城堡' };
    case 'dungeon':
      if (!f.fluffyDone) return { kind: 'npc', id: 'fluffy' };
      if (!f.snareDone) return { kind: 'prop', id: 'snare' };
      if (!f.keysDone) return { kind: 'prop', id: 'keys' };
      if (!f.chessDone) return { kind: 'npc', id: 'ron_chess' };
      if (!f.potionsDone) return { kind: 'prop', id: 'potions' };
      return { kind: 'npc', id: 'quirrell' };
    case 'castle':
      if (!f.broomGiven) return { kind: 'npc', id: 'mcgonagall' };
      if (!f.mirrorDone) return { kind: 'tile', x: 7, y: 1, label: '魔镜房间' };
      if (!f.hasStone) return null;
      return { kind: 'tile', x: 16, y: 16, label: '地下走廊' };
  }
  return null;
}
/* ---------- 渲染（交给 3D 引擎） ---------- */
/* ---------- 小地图 ---------- */
/* 以玩家为中心、随视角一起旋转的局部地图：
 *   灰蓝 = 地面 / 深蓝 = 墙 / 褐色 = 门 / 绿 = 草木
 *   青点 = 道具 · 黄点 = NPC · 金色 ✦ = 当前任务目标 · 白色箭头 = 玩家朝向 */
let miniOn = true;
const MINI_W = 172, MINI_H = 122, MINI_TILE = 9;
let miniCv = null, miniCtx = null, miniDpr = 1, miniTick = 0;

function initMinimap() {
  miniCv = $('minimap');
  if (!miniCv || !miniCv.getContext) return;
  miniDpr = Math.min(window.devicePixelRatio || 1, 2);
  miniCv.width = Math.round(MINI_W * miniDpr);
  miniCv.height = Math.round(MINI_H * miniDpr);
  miniCv.style.width = MINI_W + 'px';
  miniCv.style.height = MINI_H + 'px';
  miniCtx = miniCv.getContext('2d');
}

function miniTerrainColor(ch) {
  if (ch === '#' || ch === '=') return '#2b3044';
  if (ch === 't' || ch === 'T' || ch === 'f') return '#3c6a33';
  if (ch === 'w') return '#2f5f8f';
  if (ch === 'r') return '#8a5a2a';
  if (ch === 'm' || ch === 'k') return '#8a6d1e';
  if (ch === 'd') return '#7a5a3a';
  if (ch === 'c') return '#5a2f3c';
  if (ch === 'g') return '#3f6a37';
  if (ch === 'p') return '#6b5733';
  return '#565b6c';
}

function drawMinimap() {
  if (!miniCtx || !cur || !miniOn) return;
  const c = miniCtx;
  c.setTransform(miniDpr, 0, 0, miniDpr, 0, 0);
  c.clearRect(0, 0, MINI_W, MINI_H);
  c.fillStyle = 'rgba(6,8,16,.9)';
  c.fillRect(0, 0, MINI_W, MINI_H);

  const px = S.pos.x / TS, py = S.pos.y / TS;
  const yaw = currentYaw();
  const s = MINI_TILE;

  c.save();
  c.beginPath();
  c.rect(0, 0, MINI_W, MINI_H);
  c.clip();
  /* 平移到中心 → 旋转，让「画面上方」正好是小地图上方 */
  c.translate(MINI_W / 2, MINI_H / 2);
  c.rotate(Math.PI / 2 - yaw);

  /* 旋转后要覆盖到四角，按对角线算半径 */
  const R = Math.ceil(Math.hypot(MINI_W, MINI_H) / 2 / s) + 1;
  const tx0 = Math.floor(px) - R, tx1 = Math.floor(px) + R;
  const ty0 = Math.floor(py) - R, ty1 = Math.floor(py) + R;

  for (let ty = ty0; ty <= ty1; ty++) {
    const row = cur.g[ty];
    if (!row) continue;
    for (let tx = tx0; tx <= tx1; tx++) {
      const ch = row[tx];
      if (ch === undefined || ch === ' ') continue;
      /* 门已打开时按地面画 */
      const isOpenDoor = ch === 'd' && cur.doors && cur.doors.some(d => d.x === tx && d.y === ty && S.flags[d.flag]);
      c.fillStyle = isOpenDoor ? '#4a4a58' : miniTerrainColor(ch);
      /* 瓦片 (tx,ty) 占据 [tx,tx+1)×[ty,ty+1)，玩家就在自己的精确位置上（原点） */
      c.fillRect((tx - px) * s, (ty - py) * s, s - 0.6, s - 0.6);
    }
  }

  /* 道具 */
  c.fillStyle = '#6fd8e8';
  for (const p of visibleProps()) {
    c.beginPath();
    c.arc((p.x + 0.5 - px) * s, (p.y + 0.5 - py) * s, 1.9, 0, Math.PI * 2);
    c.fill();
  }
  /* NPC */
  c.fillStyle = '#ffe9a8';
  for (const n of visibleNpcs()) {
    c.beginPath();
    c.arc((n.x + 0.5 - px) * s, (n.y + 0.5 - py) * s, 2.1, 0, Math.PI * 2);
    c.fill();
  }
  /* 玩家朝向箭头：模型朝向 = (sin faceAng, cos faceAng) */
  const fa = S.faceAng || 0;
  const fvx = Math.sin(fa), fvy = Math.cos(fa);
  c.save();
  c.rotate(Math.atan2(fvx, -fvy));
  c.fillStyle = '#ffffff';
  c.strokeStyle = 'rgba(0,0,0,.75)';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(0, -6.4); c.lineTo(4.2, 4.4); c.lineTo(0, 2.2); c.lineTo(-4.2, 4.4);
  c.closePath();
  c.fill(); c.stroke();
  c.restore();
  c.restore();

  /* 任务目标 ✦：在屏幕空间画，超出可视范围时贴边并给出方向指示 */
  const tgt = questTarget();
  if (tgt) {
    let gx = null, gy = null;
    if (tgt.kind === 'tile') { gx = tgt.x + 0.5; gy = tgt.y + 0.5; }
    else {
      const list = tgt.kind === 'npc' ? visibleNpcs() : visibleProps();
      const o = list.find(o2 => o2.id === tgt.id);
      if (o) { gx = o.x + 0.5; gy = o.y + 0.5; }
    }
    if (gx !== null) {
      const th = Math.PI / 2 - yaw;
      const lx = (gx - px) * s, ly = (gy - py) * s;
      const cosT = Math.cos(th), sinT = Math.sin(th);
      let sx = lx * cosT - ly * sinT + MINI_W / 2;
      let sy = lx * sinT + ly * cosT + MINI_H / 2;
      const pad = 9;
      const inside = sx > pad && sx < MINI_W - pad && sy > pad && sy < MINI_H - pad;
      if (!inside) {
        /* 从中心朝目标方向射线，与内框求交 */
        const dx = sx - MINI_W / 2, dy = sy - MINI_H / 2;
        const hw = MINI_W / 2 - pad, hh = MINI_H / 2 - pad;
        const k = Math.min(hw / Math.max(1e-6, Math.abs(dx)), hh / Math.max(1e-6, Math.abs(dy)));
        sx = MINI_W / 2 + dx * k;
        sy = MINI_H / 2 + dy * k;
      }
      c.fillStyle = '#ffd76a';
      c.font = 'bold 11px sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('✦', sx, sy + 0.5);
      if (!inside) {
        /* 贴边时补一个指向外侧的小三角 */
        c.save();
        c.translate(sx, sy);
        c.rotate(Math.atan2(sy - MINI_H / 2, sx - MINI_W / 2));
        c.beginPath();
        c.moveTo(10, 0); c.lineTo(5.5, -3.6); c.lineTo(5.5, 3.6);
        c.closePath();
        c.fill();
        c.restore();
      } else {
        c.strokeStyle = 'rgba(255,215,106,.85)';
        c.lineWidth = 1.4;
        c.beginPath(); c.arc(sx, sy, 6.2, 0, Math.PI * 2); c.stroke();
      }
    }
  }

  /* 指北针（不随地图旋转）：世界「北」= -z */
  const nx = MINI_W - 17, ny = 17;
  c.strokeStyle = 'rgba(255,255,255,.28)';
  c.lineWidth = 1;
  c.beginPath(); c.arc(nx, ny, 10, 0, Math.PI * 2); c.stroke();
  c.save();
  c.translate(nx, ny);
  c.rotate(-yaw);
  c.strokeStyle = '#ff9d8a'; c.fillStyle = '#ff9d8a'; c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(0, 6); c.lineTo(0, -6); c.stroke();
  c.beginPath(); c.moveTo(0, -8); c.lineTo(2.6, -4.4); c.lineTo(-2.6, -4.4); c.closePath(); c.fill();
  c.restore();
  c.fillStyle = 'rgba(255,255,255,.55)';
  c.font = 'bold 7px sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('N', nx, ny + 0.5);
}

function updateMinimap() {
  const box = $('miniMapBox');
  if (box) box.classList[miniOn ? 'remove' : 'add']('hide');
  if (!miniOn) return;
  const nm = $('miniMapName');
  if (nm) nm.textContent = cur ? cur.name : '';
  drawMinimap();
}

function toggleMinimap() {
  miniOn = !miniOn;
  updateMinimap();
  toast(miniOn ? '小地图已开启' : '小地图已关闭', 1200);
}

/* ---------- 操作说明 ---------- */
const HELP_SECTIONS = [
  {
    title: '移动与互动',
    rows: [
      { keys: ['W', 'A', 'S', 'D'], desc: '移动（也可用方向键；方向始终跟随当前视角）' },
      { keys: ['E'], desc: '与面前的 NPC / 道具互动' },
      { keys: ['空格'], desc: '互动；对话中用于推进到下一句' },
    ],
  },
  {
    title: '视角',
    rows: [
      { keys: ['Q'], desc: '逆时针旋转视角 30°' },
      { keys: ['R'], desc: '顺时针旋转视角 30°' },
      { keys: ['鼠标拖拽'], desc: '自由环视（上下还能调整俯角）' },
      { keys: ['滚轮'], desc: '拉近 / 拉远镜头' },
    ],
  },
  {
    title: '面板与系统',
    rows: [
      { keys: ['T'], desc: '任务指引：当前目标与全流程进度' },
      { keys: ['B'], desc: '背包：物品、魔杖与已学咒语' },
      { keys: ['M'], desc: '小地图开关' },
      { keys: ['H'], desc: '打开本说明' },
      { keys: ['Esc'], desc: '关闭面板；小游戏中可跳过' },
    ],
  },
];

function openHelp() {
  closePanels();
  const body = $('helpBody');
  if (!body) return;
  const steps = Math.round(ROT_STEP * 180 / Math.PI);
  let html = '';
  for (const sec of HELP_SECTIONS) {
    html += '<div class="help-sec">' + sec.title + '</div><div class="help-grid">';
    for (const r of sec.rows) {
      html += '<div class="help-keys">' + r.keys.map(k => '<kbd>' + k + '</kbd>').join('') + '</div>' +
              '<div class="help-desc">' + r.desc.replace('30°', steps + '°') + '</div>';
    }
    html += '</div>';
  }
  html += '<div class="help-note">' +
    '<b>移动小提示：</b>按键方向会自动对齐到最近的通道方向，' +
    '所以在一条宽的走廊里按住对应的方向键就能笔直走到底，不会因为视角斜着而卡墙。<br>' +
    '<b>小地图：</b>白箭头是你的朝向，金色 ✦ 是当前任务目标，青点是道具、黄点是可交谈的人，' +
    '右上角指针指向北方，整张图会跟着视角一起转。' +
    '</div>';
  body.innerHTML = html;
  $('panelHelp').style.display = 'flex';
}

function render(dt) {
  if (!cur) return;
  /* 小地图 10Hz 重绘，没必要每帧画 */
  if ((miniTick++ & 3) === 0) updateMinimap();
  GFX.frame(dt, {
    pos: S.pos,
    faceAng: S.faceAng || 0,
    walkT: S.walkT,
    npcs: visibleNpcs(),
    props: visibleProps(),
    flags: S.flags,
    wand: S.wand,
    target: questTarget(),
  });
}
/* ---------- 更新 ---------- */
function update(dt) {
  if (!cur) return;
  updateTyping(dt);
  // 移动（对话/迷你游戏时锁定）
  if (!dialog && !currentMini) {
    let vx = 0, vy = 0;
    if (touchDir) { vx = touchDir.x || 0; vy = touchDir.y || 0; }
    else {
      if (keys['ArrowLeft'] || keys['a'] || keys['A']) vx -= 1;
      if (keys['ArrowRight'] || keys['d'] || keys['D']) vx += 1;
      if (keys['ArrowUp'] || keys['w'] || keys['W']) vy -= 1;
      if (keys['ArrowDown'] || keys['s'] || keys['S']) vy += 1;
    }
    const len = Math.hypot(vx, vy);
    if (len > 0) {
      vx /= len; vy /= len;
      /* 屏幕输入换算成世界方向（始终相对当前视角） */
      const b = viewBasis();
      const wx = vx * b.rx - vy * b.fx;
      const wy = vx * b.rz - vy * b.fz;
      const spd = 140 * dt;
      S.faceAng = Math.atan2(wx, wy);
      if (Math.abs(wx) > Math.abs(wy)) S.face = wx < 0 ? 'left' : 'right';
      else if (wy !== 0) S.face = wy < 0 ? 'up' : 'down';
      const nx = S.pos.x + wx * spd;
      if (canStand(nx, S.pos.y)) S.pos.x = nx;
      const ny = S.pos.y + wy * spd;
      if (canStand(S.pos.x, ny)) S.pos.y = ny;
      S.walkT += dt;
      stepTimer += dt;
      if (stepTimer > 0.32) { stepTimer = 0; sfx('step'); }
    } else { S.walkT = 0; stepTimer = 0; }
    checkTransitions();
  }
  // 视角旋转（90° 吸附 + 平滑过渡）
  if (viewRot !== viewRotTarget) {
    const diff = viewRotTarget - viewRot;
    viewRot = Math.abs(diff) < 0.002 ? viewRotTarget : viewRot + diff * Math.min(1, dt * 9);
  }
  // 相机
  updateCamera(dt);
}

function checkTransitions() {
  const cx = Math.floor(S.pos.x / TS), cy = Math.floor(S.pos.y / TS);
  for (const tr of cur.transitions) {
    if (cx >= tr.x && cx < tr.x + tr.w && cy >= tr.y && cy < tr.y + tr.h) {
      if (tr.require && !S.flags[tr.require]) {
        const fid = tr.failFn ? tr.failFn(S) : tr.fail;
        if (fid && DIALOGS[fid] && performance.now() - lastFailTime > 2500) {
          lastFailTime = performance.now();
          startDialog(fid);
        }
        return;
      }
      applyEffects(tr.set);
      doTeleport(tr.to, tr.px, tr.py);
      return;
    }
  }
}

/* ---------- HUD 与提示 ---------- */
function updateHud() {
  $('hpFill').style.width = clamp(S.hp / S.maxHp * 100, 0, 100) + '%';
  $('hpText').textContent = S.hp + '/' + S.maxHp;
  $('hudPoints').textContent = '🏆 学院分 ' + S.pts;
  $('hudGold').textContent = '🪙 ' + S.gold;
  $('hudWand').textContent = S.wand ? '🪄 ' + S.wand.n : '';
  $('hudSpells').innerHTML = S.spells.map(id => {
    const sp = SPELLS[id];
    return sp ? '<span class="spell-chip">' + sp.i + ' ' + sp.n + '</span>' : '';
  }).join('');
  const counts = {};
  S.items.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  $('hudItems').innerHTML = Object.keys(counts).map(id => {
    const it = ITEMS[id];
    if (!it) return '';
    const n = counts[id] > 1 ? '×' + counts[id] : '';
    return '<span class="item-chip" title="' + it.d + '">' + it.i + ' ' + n + '</span>';
  }).join('');
  $('hintText').textContent = hintsFor();
}

function hintsFor() {
  const f = S.flags;
  if (S.mapId === 'privet') {
    if (!f.lettersDone) return '去院子里看看——那封写给你的信是什么来头？';
    if (f.lettersDone < 2) return '信接二连三地飞来……第二封落在小路北边的草地上，跟着金色的 ✦ 走。';
    return '一个叫海格的巨人正在院子里等你——他会带你去对角巷。';
  }
  if (S.mapId === 'diagon') {
    if (!f.wandBought) return '先去奥利凡德魔杖店：魔杖选择巫师。';
    if (!f.robesBought || !f.booksBought || !f.owlBought) return '去各店铺买齐装备：长袍、课本、猫头鹰（其实自由搭配也行）。';
    return '穿过 9¾ 站台需要车票——去街尾的车站入口吧。';
  }
  if (S.mapId === 'station') return '那堵墙看起来是实心的……去 9¾ 站台入口，闭眼冲过去！';
  if (S.mapId === 'train') {
    if (!f.meetRon || !f.meetHermione) return '在车厢里找找罗恩和赫敏——新学期的最好朋友。';
    if (!f.toadFound) return '纳威的蟾蜍丢了，帮他找找。';
    return '列车快到站了——去车厢尽头。';
  }
  if (S.mapId === 'hall') {
    if (!f.sorted) return '走到礼堂中央的分院凳上，让分院帽作出决定。';
    return '宴席散场后，从礼堂右侧的门进入城堡。';
  }
  if (S.mapId === 'classroom') {
    if (!f.lessonDone) return '找弗立维教授学魔咒——羽加迪姆勒维奥萨！';
    if (!f.quizDone) return '去魔药课会会斯内普——答对问题能赚学院分。';
    return '从左侧门回到城堡大厅。';
  }
  if (S.mapId === 'pitch') {
    if (!f.quidditchDone) return '走到球场中央的标记处，参加对斯莱特林的比赛！';
    return '从左侧门回到城堡。';
  }
  if (S.mapId === 'forest') {
    if (!f.unicornSeen) return '沿着银白色的血迹，找到那头受伤的独角兽。';
    return '火雷恩守着它……沿着小径往右下角走，离开禁林。';
  }
  if (S.mapId === 'mirror') {
    if (!f.mirrorDone) return '走到魔镜前（镜面正下方）凝视它——你会在里面看到最深的渴望。';
    return '魔法石已经在你口袋里——和邓布利多聊聊，再从右侧的门回城堡。';
  }
  if (S.mapId === 'dungeon') {
    if (!f.fluffyDone) return '吹响海格的木笛，让三头犬弗拉菲入睡。';
    if (!f.snareDone) return '魔鬼网怕光——放松身体，再用荧光闪烁。';
    if (!f.keysDone) return '捕捉那把银色、翅膀有伤的钥匙。';
    if (!f.chessDone) return '和罗恩一起指挥活人棋局。';
    if (!f.potionsDone) return '破解魔药谜题——最小的一瓶带你向前。';
    return '最后的房间……奇洛教授就在那里。';
  }
  if (S.mapId === 'castle') {
    if (!f.lessonDone && !f.quizDone) return '城堡里有很多事可做：去教室上课，找麦格教授，或和海格聊聊。';
    if (!f.lessonDone) return '去东侧教室上魔咒课。';
    if (!f.quizDone) return '去东侧教室上魔药课。';
    if (!f.broomGiven) return '麦格教授在城堡大厅——她好像要送你一件礼物。';
    if (!f.quidditchDone) return '去右侧球场参加魁地奇比赛！';
    if (!f.mirrorDone) return '去城堡东北角的房间，寻找那面厄里斯魔镜。';
    return '魔法石已经到手——从城堡底部的门进入地下走廊！';
  }
  return '跟随魔法石的指引前进。';
}

/* ---------- 任务指引与背包面板 ---------- */
const TASKS = [
  { label: '女贞路：读信 → 和院子里的海格聊聊 → 穿过院门', done: s => s.flags.hagridDone },
  { label: '对角巷：古灵阁取金 → 奥利凡德买魔杖 → 备齐长袍与课本 → 国王十字车站', done: s => s.flags.wandBought && s.flags.robesBought && s.flags.booksBought },
  { label: '站台与列车：冲过 9¾ 站台，认识罗恩、赫敏，帮纳威找回蟾蜍', done: s => s.flags.meetRon && s.flags.meetHermione && s.flags.toadFound },
  { label: '礼堂：让分院帽为你分到格兰芬多', done: s => s.flags.sorted },
  { label: '城堡生活：魔咒课、魔药课、麦格的扫帚、魁地奇夺冠', done: s => s.flags.lessonDone && s.flags.quizDone && s.flags.quidditchDone },
  { label: '禁林：沿着银白色血迹找到受伤的独角兽', done: s => s.flags.forestDone },
  { label: '厄里斯魔镜：从镜中看到渴望，获得魔法石', done: s => s.flags.hasStone },
  { label: '地下走廊：三头犬 → 魔鬼网 → 飞钥匙 → 巫师棋 → 魔药 → 奇洛决斗', done: s => s.flags.duelWon },
];

function openTasks() {
  $('questMap').textContent = cur ? cur.name : '';
  $('questNow').textContent = hintsFor();
  const list = $('questList');
  list.innerHTML = '';
  const curIdx = TASKS.findIndex(t => !t.done(S));
  TASKS.forEach((t, i) => {
    const done = t.done(S);
    const div = document.createElement('div');
    div.className = 'quest-item' + (done ? ' done' : '') + (i === curIdx ? ' current' : '');
    const mark = done ? '✅' : (i === curIdx ? '✦' : '○');
    div.innerHTML = '<span class="quest-mark">' + mark + '</span><span>' + t.label + '</span>';
    list.appendChild(div);
  });
  $('panelTasks').style.display = 'flex';
}

function openBag() {
  const counts = {};
  S.items.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  $('bagStats').innerHTML =
    '<span class="bag-stat">❤️ ' + S.hp + '/' + S.maxHp + '</span>' +
    '<span class="bag-stat">🪙 ' + S.gold + '</span>' +
    '<span class="bag-stat">🏆 学院分 ' + S.pts + '</span>' +
    '<span class="bag-stat">' + (S.wand ? '🪄 ' + S.wand.n : '🪄 还没有魔杖') + '</span>';
  const ids = Object.keys(counts);
  $('bagItems').innerHTML = '<div class="bag-sec">物品</div>' +
    (ids.length ? ids.map(id => {
      const it = ITEMS[id];
      if (!it) return '';
      const n = counts[id] > 1 ? ' ×' + counts[id] : '';
      return '<div class="bag-item"><span class="bi">' + it.i + '</span>' +
        '<div><div class="bn">' + it.n + n + '</div><div class="bd">' + it.d + '</div></div></div>';
    }).join('') : '<div class="bag-empty">背包空空如也……去院子里看看那封信吧。</div>');
  $('bagSpells').innerHTML = '<div class="bag-sec">咒语</div>' +
    (S.spells.length ? S.spells.map(id => {
      const sp = SPELLS[id];
      if (!sp) return '';
      return '<div class="bag-item"><span class="bi">' + sp.i + '</span>' +
        '<div><div class="bn">' + sp.n + '</div><div class="bd">' + sp.d + '</div></div></div>';
    }).join('') : '<div class="bag-empty">还没学会任何咒语。去教室找弗立维教授吧！</div>');
  renderWandSection();
  $('panelBag').style.display = 'flex';
}

/* ---------- 魔杖：装备 / 购买切换 ---------- */
const WAND_PRICE = 7;
function renderWandSection() {
  const box = $('bagWands');
  if (!box) return;
  box.innerHTML = '';
  const sec = document.createElement('div');
  sec.className = 'bag-sec';
  sec.textContent = '魔杖（点击切换）';
  box.appendChild(sec);

  if (!S.wand && !S.wands.length) {
    const empty = document.createElement('div');
    empty.className = 'bag-empty';
    empty.textContent = '还没有魔杖——去对角巷的奥利凡德那儿挑一根吧。';
    box.appendChild(empty);
    return;
  }

  const row = document.createElement('div');
  row.className = 'wand-row';
  for (const id in WANDS) {
    const w = WANDS[id];
    const owned = S.wands.indexOf(id) !== -1;
    const equipped = !!(S.wand && S.wand.id === id);
    const btn = document.createElement('button');
    btn.className = 'wand-card' + (equipped ? ' equipped' : '') + (owned ? ' owned' : ' locked');
    btn.dataset.wand = id;
    const stats = '威力 ×' + w.power + '，命中 ' + (w.hit >= 0 ? '+' : '') + Math.round(w.hit * 100) + '%';
    const action = equipped ? '✓ 已装备'
      : owned ? '点击装备'
      : (S.gold >= WAND_PRICE ? '花 ' + WAND_PRICE + ' 加隆购买' : '未拥有 · ' + WAND_PRICE + ' 加隆');
    btn.innerHTML = '<span class="wn">' + w.i + ' ' + w.n + '</span>' +
      '<span class="wd">' + stats + '</span>' +
      '<span class="wt">' + action + '</span>';
    btn.addEventListener('click', e => { e.stopPropagation(); switchWand(id); });
    row.appendChild(btn);
  }
  box.appendChild(row);
}

function switchWand(id) {
  const w = WANDS[id];
  if (!w) return;
  if (S.wand && S.wand.id === id) return; // 已装备
  const owned = S.wands.indexOf(id) !== -1;
  if (!owned) {
    if (S.gold < WAND_PRICE) {
      toast('金加隆不够——需要 ' + WAND_PRICE + ' 加隆（现有 ' + S.gold + '）', 2200);
      sfx('fail');
      return;
    }
    S.gold -= WAND_PRICE;
    S.wands.push(id);
    toast('买下魔杖：🪄 ' + w.n + '（-' + WAND_PRICE + ' 加隆）', 2400);
  } else {
    toast('已装备：🪄 ' + w.n, 1800);
  }
  S.wand = w;
  sfx('success');
  saveGame();
  updateHud();
  openBag(); // 重建背包面板（金币 / 装备状态同步刷新）
}

function closePanels() {
  $('panelTasks').style.display = 'none';
  $('panelBag').style.display = 'none';
  const help = $('panelHelp');
  if (help) help.style.display = 'none';
}

/* ---------- 通关庆祝：烟花 ---------- */
let fxRaf = null, fxCtx = null, fxParts = [], fxLast = 0, fxNextBurst = 0;
const FX_COLORS = ['#ffd76a', '#f6e27a', '#ff9d8a', '#bfe3ff', '#c9a227', '#ffffff', '#a0e8b0'];

function fxResize() {
  const cv = $('fxCanvas');
  if (!cv) return;
  cv.width = window.innerWidth || VW;
  cv.height = window.innerHeight || VH;
}
function fxBurst(w, h) {
  const cx = w * (0.08 + Math.random() * 0.84);
  const cy = h * (0.08 + Math.random() * 0.44);
  const color = FX_COLORS[Math.floor(Math.random() * FX_COLORS.length)];
  const n = 64 + Math.floor(Math.random() * 36);
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + rand(-0.08, 0.08);
    const sp = rand(1.6, 6.2);
    fxParts.push({
      x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(0.9, 1.8), age: 0, color, size: rand(1.6, 3.4),
    });
  }
}
function startFireworks() {
  const cv = $('fxCanvas');
  if (!cv || !cv.getContext) return;
  stopFireworks();
  fxResize();
  fxCtx = cv.getContext('2d');
  if (!fxCtx) return;
  fxParts = [];
  fxLast = performance.now();
  // 先立刻放一朵，保证第一眼就能看到庆祝效果
  fxBurst(cv.width, cv.height);
  fxNextBurst = rand(0.5, 1.0);
  const step = (now) => {
    if (!fxCtx) return;
    const w = cv.width, h = cv.height;
    const dt = Math.min((now - fxLast) / 1000, 0.05);
    fxLast = now;
    // 拖尾
    fxCtx.globalCompositeOperation = 'source-over';
    fxCtx.fillStyle = 'rgba(6, 8, 16, 0.22)';
    fxCtx.fillRect(0, 0, w, h);
    // 定时放新烟花
    fxNextBurst -= dt;
    if (fxNextBurst <= 0) {
      fxNextBurst = rand(0.45, 1.1);
      fxBurst(w, h);
    }
    // 粒子
    fxCtx.globalCompositeOperation = 'lighter';
    for (let i = fxParts.length - 1; i >= 0; i--) {
      const p = fxParts[i];
      p.age += dt;
      if (p.age >= p.life) { fxParts.splice(i, 1); continue; }
      p.vy += 42 * dt;          // 重力
      p.vx *= 0.985; p.vy *= 0.985;
      p.x += p.vx * 60 * dt;
      p.y += p.vy * 60 * dt;
      const k = 1 - p.age / p.life;
      fxCtx.globalAlpha = Math.max(0, k);
      fxCtx.fillStyle = p.color;
      fxCtx.beginPath();
      fxCtx.arc(p.x, p.y, p.size * (0.5 + k * 0.8), 0, 7);
      fxCtx.fill();
    }
    fxCtx.globalAlpha = 1;
    fxRaf = requestAnimationFrame(step);
  };
  fxRaf = requestAnimationFrame(step);
}
function stopFireworks() {
  if (fxRaf) { cancelAnimationFrame(fxRaf); fxRaf = null; }
  fxCtx = null;
  fxParts = [];
}

/* ---------- 结算 / 通关庆祝 ---------- */
function showCredits() {
  $('gameWrap').style.display = 'none';
  $('credits').style.display = 'flex';
  const body = $('creditsBody');
  const total = S.pts + 160;
  body.innerHTML =
    '<p class="ending-story">邓布利多在年终宴会上缓缓起身：<br>' +
    '「罗恩·韦斯莱，下棋时献出自己——格兰芬多 +50 分。」<br>' +
    '「赫敏·格兰杰，冷静的头脑与逻辑——格兰芬多 +50 分。」<br>' +
    '「哈利·波特，直面邪恶的勇气——格兰芬多 +60 分。」<br>' +
    '<b>「格兰芬多总计 ' + total + ' 分——夺得学院杯！」</b></p>' +
    '<div class="ending-stats">' +
      '<div class="es"><span class="esi">🏆</span><span class="esv">' + total + '</span><span class="esl">学院杯总分</span></div>' +
      '<div class="es"><span class="esi">⭐</span><span class="esv">' + S.pts + '</span><span class="esl">你的学院分</span></div>' +
      '<div class="es"><span class="esi">🪙</span><span class="esv">' + S.gold + '</span><span class="esl">金加隆</span></div>' +
      '<div class="es"><span class="esi">🎒</span><span class="esv">' + S.items.length + '</span><span class="esl">收藏物品</span></div>' +
      '<div class="es"><span class="esi">✨</span><span class="esv">' + S.spells.length + '</span><span class="esl">学会咒语</span></div>' +
      '<div class="es"><span class="esi">🪄</span><span class="esv small">' + (S.wand ? S.wand.n : '—') + '</span><span class="esl">魔杖</span></div>' +
    '</div>' +
    '<p class="ending-epilogue">魔法石依然安然无恙。而伏地魔，会回来的——但那已是另一个故事。</p>' +
    '<p class="ending-thanks">✨ 感谢你陪哈利走完第一学年 ✨</p>';
  startFireworks();
  sfx('fanfare');
  clearSave();
}

/* ---------- 主循环 ---------- */
function loop(t) {
  const dt = Math.min((t - lastT) / 1000, 0.05);
  lastT = t;
  if (!inTitle) {
    update(dt);
    render(dt);
    updateHud();
  }
  requestAnimationFrame(loop);
}
let lastT = performance.now();
let inTitle = true;

/* ---------- 开始 / 继续 ---------- */
function startNew() {
  freshState();
  viewRot = 0; viewRotTarget = 0;
  if (GFX.ready) { GFX.resetView(); GFX.setYaw(0); }
  inTitle = false;
  closePanels();
  stopFireworks();
  $('credits').style.display = 'none';
  $('titleScreen').style.display = 'none';
  $('gameWrap').style.display = 'block';
  updateSoundBtn();
  doTeleport('privet');
  startMusic();
  toast('欢迎来到霍格沃茨！WASD 移动，E / 空格 互动', 3200);
}

function continueGame() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!data) { startNew(); return; }
    S.mapId = data.mapId || 'privet';
    S.pos = data.pos || { x: 0, y: 0 };
    S.face = data.face || 'down';
    S.faceAng = typeof data.faceAng === 'number' ? data.faceAng : (FACE_ANG[data.face] || Math.PI / 4);
    S.hp = data.hp || 100; S.maxHp = data.maxHp || 100;
    S.mana = data.mana !== undefined ? data.mana : 4;
    S.gold = data.gold || 0;
    S.items = data.items || []; S.spells = data.spells || [];
    S.wand = data.wand ? WANDS[data.wand] : null;
    S.wands = Array.isArray(data.wands) ? data.wands.filter(id => WANDS[id]) : (data.wand && WANDS[data.wand] ? [data.wand] : []);
    S.flags = data.flags || {}; S.pts = data.pts || 0;
    // 旧存档兼容：买过魔杖但没记录型号（早期版本 bug）→ 默认补发冬青木
    if (!S.wand && S.flags.wandBought) {
      S.wand = WANDS.holly;
      if (S.wands.indexOf('holly') === -1) S.wands.push('holly');
    }
    if (S.flags.sorted === undefined) { /* 旧档容错 */ }
    inTitle = false;
    $('titleScreen').style.display = 'none';
    $('gameWrap').style.display = 'block';
    updateSoundBtn();
    doTeleport(S.mapId);
    startMusic();
    toast('冒险继续！', 1600);
  } catch (e) {
    startNew();
  }
}

/* ---------- 尺寸 / 触屏 ---------- */
function fitCanvas() {
  if (!GFX.ready) return;
  GFX.resize(window.innerWidth || VW, window.innerHeight || VH);
}

function setupTouch() {
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const small = window.innerWidth <= 760;
  if (coarse || small) {
    $('touchControls').style.display = 'block';
    document.querySelectorAll('.dbtn').forEach(b => {
      const dir = b.dataset.dir;
      const on = e => { e.preventDefault(); setTouchDir({ up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[dir].length ? vFromDir(dir) : null); };
      b.addEventListener('touchstart', on, { passive: false });
      b.addEventListener('touchend', () => setTouchDir(null));
    });
    const aBtn = $('touchA');
    aBtn.addEventListener('touchstart', e => {
      e.preventDefault();
      if (dialog) advancePress(); else tryInteract();
    }, { passive: false });
  }
}
function vFromDir(dir) {
  return dir === 'up' ? { x: 0, y: -1 } : dir === 'down' ? { x: 0, y: 1 } : dir === 'left' ? { x: -1, y: 0 } : { x: 1, y: 0 };
}

/* ---------- 事件绑定 ---------- */
document.addEventListener('keydown', e => {
  const k = e.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(k) !== -1) e.preventDefault();
  keys[k] = true;
  if (k === ' ' || k === 'Enter') {
    if (currentMini && currentMini.keyHandler) { currentMini.keyHandler('space'); return; }
    if (dialog) { advancePress(); return; }
    tryInteract();
    return;
  }
  if (k === 'e' || k === 'E') {
    if (dialog) { advancePress(); return; }
    tryInteract();
    return;
  }
  if (k === 'q' || k === 'Q') { rotateView(1); return; }
  if (k === 'r' || k === 'R') { rotateView(-1); return; }
  if (k === 'b' || k === 'B' || k === 'i' || k === 'I') {
    closePanels();
    openBag();
    return;
  }
  if (k === 't' || k === 'T' || k === 'j' || k === 'J') {
    closePanels();
    openTasks();
    return;
  }
  if (k === 'm' || k === 'M') { toggleMinimap(); return; }
  if (k === 'h' || k === 'H' || k === '?' || k === '/') {
    if ($('panelHelp').style.display === 'flex') closePanels();
    else openHelp();
    return;
  }
  if (k === 'Escape') {
    const help = $('panelHelp');
    if ($('panelTasks').style.display !== 'none' || $('panelBag').style.display !== 'none' ||
        (help && help.style.display === 'flex')) {
      closePanels();
      return;
    }
    if (currentMini && currentMini.clickCleanup) {
      // 允许跳过部分迷你游戏（不扣分）
      currentMini.clickCleanup && currentMini.clickCleanup();
      cancelMiniRaf();
      $('mini').style.display = 'none';
      currentMini = null;
    }
  }
});
document.addEventListener('keyup', e => { keys[e.key] = false; });

$('dialog').addEventListener('click', () => {
  if (!dialog) return;
  const line = dialog.lines[dialog.idx];
  if (line && line.c) return;
  advancePress();
});

window.addEventListener('resize', () => { fitCanvas(); if (fxCtx) fxResize(); });

/* ---------- 启动 ---------- */
compileMaps();
if (!GFX.init($('game'))) {
  const box = $('titleScreen');
  if (box && box.appendChild) {
    const tip = document.createElement('p');
    tip.className = 'title-tip';
    tip.style.color = '#ffb0a0';
    tip.textContent = '⚠ 当前浏览器无法启用 WebGL，3D 场景无法启动。请更换浏览器或开启硬件加速后重试。';
    box.appendChild(tip);
  }
}
fitCanvas();
setupTouch();
initMinimap();

$('btnNew').addEventListener('click', startNew);
$('btnContinue').addEventListener('click', continueGame);
$('btnSound').addEventListener('click', toggleSound);
$('btnRotL').addEventListener('click', () => rotateView(1));
$('btnRotR').addEventListener('click', () => rotateView(-1));
$('btnTasks').addEventListener('click', () => { closePanels(); openTasks(); });
$('btnBag').addEventListener('click', () => { closePanels(); openBag(); });
$('btnHelp').addEventListener('click', () => { openHelp(); });
$('btnMap').addEventListener('click', () => { toggleMinimap(); });
$('hudItems').addEventListener('click', () => { closePanels(); openBag(); });
$('panelTasks').addEventListener('click', e => { if (e.target === $('panelTasks')) closePanels(); });
$('panelBag').addEventListener('click', e => { if (e.target === $('panelBag')) closePanels(); });
$('panelHelp').addEventListener('click', e => { if (e.target === $('panelHelp')) closePanels(); });
document.querySelectorAll('.panel-close').forEach(b => {
  b.addEventListener('click', e => { e.stopPropagation(); $(b.dataset.panel).style.display = 'none'; });
});
$('btnAgain').addEventListener('click', () => {
  stopFireworks();
  $('credits').style.display = 'none';
  startNew();
});

if (hasSave()) $('btnContinue').style.display = 'inline-block';

requestAnimationFrame(loop);
