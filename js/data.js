/* =========================================================
 * 哈利·波特与魔法石 · 游戏数据
 * （地图 / NPC / 道具 / 咒语 / 对话 / 迷你游戏）
 * ========================================================= */

/* ---------- 基础常量 ---------- */
const TS = 32;              // 瓦片像素大小
const VW = 960, VH = 540;   // 画布逻辑分辨率
const SOLID = new Set(['#', '=', 't', 'T', 'f', 'w', 'r', 'm']);  // 实心瓦片（m = 镜面，不能走上去）

/* ---------- 物品 ---------- */
const ITEMS = {
  letter: { n: '录取通知书', i: '📜', d: '霍格沃茨魔法学校寄来的信。' },
  cake:   { n: '生日蛋糕',   i: '🎂', d: '海格亲手做的，虽然被压扁了一点。' },
  wand:   { n: '魔杖',       i: '🪄', d: '由奥利凡德先生为你挑选。' },
  robe:   { n: '学院长袍',   i: '🧥', d: '摩金夫人长袍店出品，黑色巫师袍。' },
  book:   { n: '课本',       i: '📚', d: '《标准咒语·初级》等一年级课本。' },
  owl:    { n: '海德薇',     i: '🦉', d: '雪鸮，海格送你的宠物，很安静。' },
  frog:   { n: '巧克力蛙',   i: '🐸', d: '会跳的巧克力，附赠巫师卡片。' },
  card:   { n: '邓布利多卡', i: '🃏', d: '巧克力蛙附赠——阿不思·邓布利多。' },
  toad:   { n: '莱福',       i: '🐸', d: '纳威走失的蟾蜍。' },
  beans:  { n: '比比多味豆', i: '🍬', d: '每颗味道都不同：耳朵屎味还是太妃糖味？' },
  flute:  { n: '木笛',       i: '🎵', d: '海格送的圣诞礼物，粗糙但能吹响。' },
  broom:  { n: '光轮2000',   i: '🧹', d: '最新款飞天扫帚，麦格教授送的。' },
  potion: { n: '疗伤剂',     i: '🧪', d: '斯内普课堂上配的，能恢复 25 点体力。' },
  key:    { n: '古灵阁钥匙', i: '🔑', d: '通往 687 号金库的钥匙，妖精保管得比龙还严。' },
  stone:  { n: '魔法石',     i: '💎', d: '能点石成金、让人永生的神秘石头。' },
};

/* ---------- 咒语 ---------- */
const SPELLS = {
  lumos:     { n: '荧光闪烁', i: '✨', d: '杖尖发出亮光，照亮黑暗。' },
  wingardium:{ n: '羽加迪姆勒维奥萨', i: '🪶', d: '让物体飘浮起来的悬浮咒。' },
  stupefy:   { n: '昏昏倒地', i: '💥', d: '战斗咒语，让对手昏迷。' },
  incendio:  { n: '火焰熊熊', i: '🔥', d: '战斗咒语，从杖尖喷出火焰。' },
};

/* ---------- 魔杖选项 ---------- */
const WANDS = {
  holly:   { id: 'holly',   n: '冬青木 · 凤凰羽毛', i: '🪄', d: '哈利母亲魔杖的木材。威力与命中均衡，威力×1.3。', power: 1.3, hit: 0.10, guard: 0 },
  yew:     { id: 'yew',     n: '紫杉木 · 龙心弦',   i: '🪄', d: '威力强大却难以驾驭。威力×1.5，命中 −10%。', power: 1.5, hit: -0.10, guard: 0 },
  beech:   { id: 'beech',   n: '山毛榉木 · 独角兽毛', i: '🪄', d: '温和而精准。威力×1.1，命中 +25%。', power: 1.1, hit: 0.25, guard: 0.10 },
};

/* ---------- 迷你游戏 ---------- */
const MINIS = {
  leviosa: {
    title: '魔咒课 · 羽加迪姆勒维奥萨',
    type: 'lev', success: 3,
    desc: '羽毛在桌面上不安分地晃动。把光标对准绿色区域，在指针扫过时按下空格 / 点击屏幕，让羽毛浮起来。连续成功 3 次！',
    passFlags: { lessonDone: 1 },
    passDialog: 'd_after_leviosa',
  },
  flute: {
    title: '三头犬弗拉菲',
    type: 'rhythm', success: 4, failHp: 12,
    desc: '弗拉菲的三个脑袋一起朝你咆哮。你举起海格的木笛——等白色光环缩到最小的一瞬间，按下空格 / 点击屏幕。吹出 4 个准确的音符，让它入睡！',
    passFlags: { fluffyDone: 1 },
    passDialog: 'd_after_fluffy',
  },
  snare: {
    title: '魔鬼网',
    type: 'quiz', failHp: 10,
    questions: [
      { q: '魔鬼网缠住了你的双腿，越挣扎越紧。赫敏教过你怎么对付它——', opts: ['大声挣扎', '全身放松', '念缴械咒'], ans: 1,
        right: '你放松下来，魔鬼网缓缓把你放到了下一层地面。', wrong: '你越挣扎，缠得越紧！（失去体力）' },
      { q: '脚下的魔鬼网又开始蠕动。它最怕什么？', opts: ['水', '火焰', '光'], ans: 2,
        right: '「荧光闪烁！」杖尖亮起——魔鬼网嗖地缩回墙角。', wrong: '网蔓卷住了你的脚踝！（失去体力）' },
    ],
    passFlags: { snareDone: 1 },
    passDialog: 'd_after_snare',
  },
  keys: {
    title: '会飞的钥匙',
    type: 'keys',
    desc: '一大群长着翅膀的钥匙在头顶盘旋。其中一把银色、翅膀上有伤的钥匙能打开通往下一关的门。点击它！',
    passFlags: { keysDone: 1 },
    passDialog: 'd_after_keys',
  },
  chess: {
    title: '活人棋局',
    type: 'chess',
    desc: '巨大的巫师棋盘上，棋子们等待着命令。罗恩是骑士，赫敏是城堡，而你是主教。指挥你的棋子走向胜利！',
    passFlags: { chessDone: 1 },
    passDialog: 'd_after_chess',
  },
  potions: {
    title: '魔药谜题',
    type: 'quiz', failHp: 10,
    questions: [
      { q: '七个瓶子摆在你面前，瓶下写道：「危险潜伏于七瓶之中，三瓶毒药、两瓶荨麻酒，最小的一瓶带你向前，最右的一瓶让你回头。」你应该——', opts: ['喝最小的一瓶', '喝最右边的一瓶', '随便开一瓶尝尝', '把瓶子全砸了'], ans: 0,
        right: '你咽下最小瓶里紫蓝色的药剂——紫色的火焰在面前分开，你走了过去。', wrong: '舌尖一阵刺痛……你喝错了！（失去体力）' },
    ],
    passFlags: { potionsDone: 1 },
    passDialog: 'd_after_potions',
  },
  snape: {
    title: '魔药课 · 斯内普的提问',
    type: 'quiz', failHp: 0,
    questions: [
      { q: '斯内普：把水仙根粉加入艾草浸液会得到什么？', opts: ['生死水', '福灵剂', '迷情剂'], ans: 0,
        right: '「看来你还不算完全没救，波特。」（＋15 分）', wrong: '「波特先生显然没读过《千种神奇药草》。」（－5 分）' },
      { q: '斯内普：月长石和什么混在一起可以变成魔药之毒？', opts: ['龙血', '毒触手汁', '山泉'], ans: 1,
        right: '「哼，勉强及格。」（＋15 分）', wrong: '斯内普用眼神把你钉在了座位上。（－5 分）' },
      { q: '斯内普：制作生死水时，应该让药剂静置多久？', opts: ['一星期', '一个月', '一小时'], ans: 0,
        right: '他嘴角抽搐了一下，居然没扣分。（＋15 分）', wrong: '「愚蠢。」斯内普拂袖而去。（－5 分）' },
    ],
    passFlags: { quizDone: 1, pts: 15 },
  },
  snitch: {
    title: '魁地奇 · 追逐金色飞贼',
    type: 'snitch', time: 45,
    desc: '金色飞贼在球场上翻飞，游走球横冲直撞。用鼠标 / 手指点击飞贼 3 次，别碰到游走球！',
    passFlags: { quidditchDone: 1, pts: 40 },
    passDialog: 'd_after_snitch',
  },
};

/* ---------- 地图 ---------- */

/* 确定性随机数，用于地图装饰 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* 地图构造器 */
function mapData(def) {
  const g = [];
  for (let y = 0; y < def.h; y++) {
    const row = [];
    for (let x = 0; x < def.w; x++) row.push(def.base || '.');
    g.push(row);
  }
  const api = {
    set(x, y, c) { if (x >= 0 && y >= 0 && x < def.w && y < def.h) g[y][x] = c; },
    rect(x, y, w, h, c) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) api.set(xx, yy, c); },
    border(c) { for (let x = 0; x < def.w; x++) { api.set(x, 0, c); api.set(x, def.h - 1, c); } for (let y = 0; y < def.h; y++) { api.set(0, y, c); api.set(def.w - 1, y, c); } },
    scatter(c, density) {
      const rnd = mulberry32(def.seed || 7);
      for (let y = 0; y < def.h; y++) for (let x = 0; x < def.w; x++) {
        if (g[y][x] === (def.base || '.') && rnd() < density) api.set(x, y, c);
      }
    },
  };
  def.build(api);
  // 把门自动落位成 'd' 瓦片
  if (def.doors) for (const d of def.doors) {
    if (d.x >= 0 && d.y >= 0 && d.x < def.w && d.y < def.h) g[d.y][d.x] = 'd';
  }
  return { name: def.name, w: def.w, h: def.h, g, dark: !!def.dark, npcs: def.npcs || [], props: def.props || [], doors: def.doors || [], transitions: def.transitions || [], enter: def.enter || null, spawn: def.spawn || { x: 2, y: 2 } };
}

const MAPS = {
  /* ---------------- 女贞路 ----------------
     流程：捡信 → 海格出现 → 穿过院门去对角巷 */
  privet: mapData({
    name: '女贞路 4 号',
    w: 24, h: 14, base: 'g', seed: 11,
    build(api) {
      api.border('f');
      // 德思礼家的房子（左）
      api.rect(1, 2, 8, 7, '=');
      api.rect(2, 3, 7, 6, '.');
      api.set(5, 8, '.');                 // 房门
      // 通往院门的小路
      api.set(5, 9, 'p'); api.set(5, 10, 'p'); api.set(5, 11, 'p');
      api.rect(6, 11, 16, 1, 'p');
      // 几棵树
      api.set(13, 2, 't'); api.set(17, 3, 't'); api.set(20, 2, 't');
      api.set(11, 12, 't'); api.set(15, 12, 't'); api.set(19, 12, 't');
      api.scatter('g', 0.0);
    },
    spawn: { x: 5, y: 5 },
    enter: 'd_privet1',
    npcs: [
      { id: 'hagrid', name: '海格', icon: '🧔', color: '#5b4a33', hair: '#5b4a33', x: 19, y: 11, face: 'down',
        dialog: 'd_hagrid', show: s => s.flags.lettersDone >= 2 },
    ],
    props: [
      { id: 'letter1', x: 9, y: 5, icon: '✉️', label: '一封信',
        show: s => !s.flags.lettersDone, dialog: 'd_letter1' },
      { id: 'letter2', x: 12, y: 10, icon: '✉️', label: '又一封信',
        show: s => s.flags.lettersDone >= 1 && s.flags.lettersDone < 2, dialog: 'd_letter2' },
      { id: 'door1', x: 4, y: 8, icon: '🚪', label: '德思礼家的门',
        dialog: 'd_dursley_door' },
    ],
    transitions: [
      { x: 21, y: 10, w: 2, h: 3, to: 'diagon', px: 3, py: 8, require: 'hagridDone', fail: 'd_privet_gate',
        failFn: s => !s.flags.lettersDone ? 'd_privet_gate1' : (s.flags.lettersDone < 2 ? 'd_privet_gate2' : 'd_privet_gate3') },
    ],
  }),

  /* ---------------- 对角巷 ----------------
     流程：古灵阁取金 → 奥利凡德买魔杖 → 长袍/书/猫头鹰/糖果 → 街尾去站台 */
  diagon: mapData({
    name: '对角巷',
    w: 30, h: 16, base: 'p', seed: 23,
    build(api) {
      api.border('#');
      // 上排店铺
      api.rect(1, 1, 8, 4, '#');   api.rect(2, 2, 6, 2, '.');   // 古灵阁
      api.rect(10, 1, 8, 4, '#');  api.rect(11, 2, 6, 2, '.');  // 奥利凡德
      api.rect(19, 1, 8, 4, '#');  api.rect(20, 2, 6, 2, '.');  // 丽痕书店
      // 下排店铺
      api.rect(1, 10, 8, 4, '#');  api.rect(2, 11, 6, 2, '.'); // 摩金夫人长袍
      api.rect(10, 10, 8, 4, '#'); api.rect(11, 11, 6, 2, '.');// 咿啦猫头鹰商店
      api.rect(19, 10, 8, 4, '#'); api.rect(20, 11, 6, 2, '.');// 蜂蜜公爵糖果店
    },
    spawn: { x: 3, y: 8 },
    npcs: [
      { id: 'gringotts', name: '拉环（古灵阁）', icon: '👺', color: '#8a7a55', hair: '#8a7a55', x: 4, y: 5, face: 'down', dialog: 'd_gringotts', show: s => !s.flags.gringottsDone },
      { id: 'ollivander', name: '奥利凡德', icon: '🧓', color: '#3a4a5a', hair: '#c0c0c0', x: 14, y: 5, face: 'down', dialog: 'd_ollivander' },
      { id: 'bookshop', name: '书店店员', icon: '👨🦳', color: '#3f4d33', hair: '#c0c0c0', x: 23, y: 5, face: 'down', dialog: 'd_books' },
      { id: 'madam_malkin', name: '摩金夫人', icon: '👩🦰', color: '#5a3a4a', hair: '#a03a3a', x: 4, y: 9, face: 'down', dialog: 'd_robes' },
      { id: 'owl_shop', name: '猫头鹰店员', icon: '👨', color: '#4a3a2a', hair: '#6a5a3a', x: 14, y: 9, face: 'down', dialog: 'd_owl' },
      { id: 'candy', name: '糖果店员', icon: '👩', color: '#7a5a3a', hair: '#5a3a3a', x: 23, y: 9, face: 'down', dialog: 'd_candy' },
      { id: 'malfoy_diagon', name: '马尔福', icon: '🧑', color: '#3a3a4a', hair: '#d0d0d0', x: 9, y: 7, face: 'down', dialog: 'd_malfoy_diagon' },
    ],
    props: [
      { id: 'umbrella', x: 8, y: 7, icon: '☂️', label: '一把坏掉的粉色雨伞', dialog: 'd_umbrella' },
    ],
    transitions: [
      { x: 28, y: 6, w: 1, h: 3, to: 'station', px: 5, py: 6, require: 'wandBought', fail: 'd_diagon_gate' },
    ],
  }),

  /* ---------------- 9¾ 站台 ---------------- */
  station: mapData({
    name: '国王十字车站 · 9¾ 站台',
    w: 20, h: 12, base: 'p', seed: 31,
    build(api) {
      api.border('#');
      api.rect(1, 4, 14, 4, '.');
      api.rect(16, 0, 4, 12, '=');   // 分隔 9/10 站台的墙
      api.rect(17, 2, 2, 2, 'w');    // 墙上的窗户?（装饰，实心）
    },
    spawn: { x: 5, y: 6 },
    enter: 'd_station',
    npcs: [
      { id: 'ron_mum', name: '罗恩·韦斯莱', icon: '🧑🦰', color: '#7a4a2a', hair: '#e04818', x: 8, y: 6, face: 'down', dialog: 'd_ron_platform' },
      { id: 'malfoy_station', name: '马尔福', icon: '🧑', color: '#3a3a4a', hair: '#d0d0d0', x: 13, y: 6, face: 'down', dialog: 'd_malfoy_station' },
    ],
    props: [
      { id: 'barrier', x: 16, y: 6, icon: '🚧', label: '9¾ 站台入口',
        dialog: 'd_barrier' },
      { id: 'trolley', x: 10, y: 5, icon: '🧳', label: '满载行李的手推车', dialog: 'd_trolley' },
    ],
  }),

  /* ---------------- 霍格沃茨特快 ---------------- */
  train: mapData({
    name: '霍格沃茨特快',
    w: 28, h: 12, base: 'c', seed: 43,
    build(api) {
      api.border('#');
      api.rect(2, 4, 24, 1, '=');   // 上排座椅
      api.rect(2, 7, 24, 1, '=');   // 下排座椅
      api.rect(3, 3, 4, 1, 'W');    // 车窗（装饰）
      api.rect(10, 3, 4, 1, 'W');
      api.rect(17, 3, 4, 1, 'W');
    },
    spawn: { x: 4, y: 6 },
    enter: 'd_train_enter',
    npcs: [
      { id: 'ron_train', name: '罗恩·韦斯莱', icon: '🧑🦰', color: '#7a4a2a', hair: '#e04818', x: 6, y: 6, face: 'right', dialog: 'd_train_ron' },
      { id: 'hermione_train', name: '赫敏·格兰杰', icon: '👩', color: '#4a2a2a', hair: '#7a3a20', x: 12, y: 6, face: 'right', dialog: 'd_train_hermione' },
      { id: 'neville_train', name: '纳威·隆巴顿', icon: '🙍', color: '#4a4a3a', hair: '#3a3a2a', x: 18, y: 6, face: 'right', dialog: 'd_train_neville' },
    ],
    props: [
      { id: 'toad', x: 23, y: 5, icon: '🐸', label: '一只蟾蜍', show: s => !s.flags.toadFound, dialog: 'd_toad' },
    ],
    transitions: [
      { x: 26, y: 5, w: 1, h: 3, to: 'hall', px: 12, py: 9, require: 'meetRon', fail: 'd_train_gate', set: { trainDone: 1 } },
    ],
  }),

  /* ---------------- 礼堂（分院） ---------------- */
  hall: mapData({
    name: '霍格沃茨礼堂',
    w: 26, h: 14, base: 's', seed: 53,
    build(api) {
      api.border('#');
      api.rect(4, 2, 16, 1, '=');    // 教师长桌
      api.rect(3, 6, 8, 1, '=');     // 学院长桌一
      api.rect(13, 6, 8, 1, '=');    // 学院长桌二
      api.set(12, 8, 'k');           // 分院凳位置（触发剧情）
      api.rect(2, 10, 7, 1, '=');   // 长凳（左）
      api.rect(14, 10, 8, 1, '=');  // 长凳（右），中间留通道
    },
    spawn: { x: 12, y: 12 },
    enter: 'd_hall_enter',
    npcs: [
      { id: 'mcgonagall_hall', name: '麦格教授', icon: '👩🦱', color: '#1e3a2a', hair: '#3a3a2a', x: 12, y: 3, face: 'down', dialog: 'd_mcgonagall_hall' },
      { id: 'ron_hall', name: '罗恩·韦斯莱', icon: '🧑🦰', color: '#7a4a2a', hair: '#e04818', x: 6, y: 7, face: 'down', dialog: 'd_ron_hall' },
      { id: 'hermione_hall', name: '赫敏·格兰杰', icon: '👩', color: '#4a2a2a', hair: '#7a3a20', x: 17, y: 7, face: 'down', dialog: 'd_hermione_hall' },
    ],
    props: [
      { id: 'hat', x: 12, y: 8, icon: '🎩', label: '分院帽',
        show: s => !s.flags.sorted, dialog: 'd_sort' },
      { id: 'candle', x: 2, y: 4, icon: '🕯️', label: '漂浮的蜡烛', dialog: 'd_candle' },
    ],
    doors: [ { x: 24, y: 7, flag: 'sorted' } ],
    transitions: [
      { x: 24, y: 7, w: 1, h: 1, to: 'castle', px: 16, py: 4, require: 'sorted', fail: 'd_hall_gate' },
    ],
  }),

  /* ---------------- 城堡（主枢纽） ---------------- */
  castle: mapData({
    name: '霍格沃茨城堡',
    w: 34, h: 18, base: 's', seed: 67,
    build(api) {
      api.border('#');
      // 中央大厅的四根柱子
      api.set(8, 8, 'r'); api.set(8, 9, 'r');
      api.set(25, 8, 'r'); api.set(25, 9, 'r');
      api.rect(15, 3, 4, 1, '=');    // 讲台（装饰）
    },
    spawn: { x: 16, y: 4 },
    npcs: [
      { id: 'mcgonagall', name: '麦格教授', icon: '👩🦱', color: '#1e3a2a', hair: '#3a3a2a', x: 20, y: 4, face: 'down', dialog: 'd_mcgonagall' },
      { id: 'hagrid2', name: '海格', icon: '🧔', color: '#5b4a33', hair: '#5b4a33', x: 27, y: 14, face: 'down', dialog: 'd_hagrid2', show: s => s.flags.sorted },
      { id: 'ron_castle', name: '罗恩·韦斯莱', icon: '🧑🦰', color: '#7a4a2a', hair: '#e04818', x: 14, y: 5, face: 'down', dialog: 'd_ron_castle' },
      { id: 'hermione_castle', name: '赫敏·格兰杰', icon: '👩', color: '#4a2a2a', hair: '#7a3a20', x: 18, y: 5, face: 'down', dialog: 'd_hermione_castle' },
      { id: 'nick', name: '差点没头的尼克', icon: '👻', color: '#c8dcff', hair: '#c0c0d0', x: 11, y: 12, face: 'down', dialog: 'd_nick' },
      { id: 'peeves', name: '皮皮鬼', icon: '🤡', color: '#7a4a2a', hair: '#c0a020', x: 24, y: 11, face: 'down', dialog: 'd_peeves' },
    ],
    doors: [
      { x: 16, y: 1, flag: 'sorted' },    // 回礼堂
      { x: 1, y: 7, flag: 'sorted' },     // 教室
      { x: 32, y: 7, flag: 'broomGiven' },// 魁地奇球场
      { x: 7, y: 1, flag: 'sorted' },     // 厄里斯魔镜房间
      { x: 16, y: 16, flag: 'hasStone' }, // 地下走廊
    ],
    transitions: [
      { x: 16, y: 1, w: 1, h: 1, to: 'hall', px: 24, py: 8, require: 'sorted', fail: 'd_cant' },
      { x: 1, y: 7, w: 1, h: 1, to: 'classroom', px: 3, py: 7, require: 'sorted', fail: 'd_cant' },
      { x: 32, y: 7, w: 1, h: 1, to: 'pitch', px: 3, py: 8, require: 'broomGiven', fail: 'd_lock_broom' },
      { x: 7, y: 1, w: 1, h: 1, to: 'mirror', px: 8, py: 10, require: 'sorted', fail: 'd_cant' },
      { x: 16, y: 16, w: 1, h: 1, to: 'dungeon', px: 5, py: 9, require: 'hasStone', fail: 'd_lock_dungeon' },
    ],
  }),

  /* ---------------- 教室（魔咒课 / 魔药课） ---------------- */
  classroom: mapData({
    name: '教室',
    w: 26, h: 14, base: 's', seed: 71,
    build(api) {
      api.border('#');
      api.rect(3, 5, 4, 1, '='); api.rect(9, 5, 4, 1, '='); api.rect(15, 5, 4, 1, '='); api.rect(21, 5, 4, 1, '=');
      api.rect(3, 8, 4, 1, '='); api.rect(9, 8, 4, 1, '='); api.rect(15, 8, 4, 1, '='); api.rect(21, 8, 4, 1, '=');
    },
    spawn: { x: 3, y: 7 },
    npcs: [
      { id: 'flitwick', name: '弗立维教授', icon: '👴', color: '#3a3a5a', hair: '#c0c0c0', x: 6, y: 10, face: 'down', dialog: 'd_flitwick' },
      { id: 'snape', name: '斯内普教授', icon: '👨', color: '#1a1a2a', hair: '#101018', x: 18, y: 10, face: 'down', dialog: 'd_snape' },
      { id: 'ron_class', name: '罗恩', icon: '🧑🦰', color: '#7a4a2a', hair: '#e04818', x: 10, y: 11, face: 'down', dialog: 'd_ron_class' },
      { id: 'hermione_class', name: '赫敏', icon: '👩', color: '#4a2a2a', hair: '#7a3a20', x: 21, y: 11, face: 'down', dialog: 'd_hermione_class' },
    ],
    doors: [ { x: 1, y: 7, flag: 'sorted' } ],
    transitions: [
      { x: 1, y: 7, w: 1, h: 1, to: 'castle', px: 2, py: 7, require: 'sorted', fail: 'd_cant' },
    ],
  }),

  /* ---------------- 魁地奇球场 ---------------- */
  pitch: mapData({
    name: '魁地奇球场',
    w: 30, h: 16, base: 'g', seed: 83,
    build(api) {
      api.border('#');
      api.rect(2, 2, 26, 12, 'g');
      api.set(14, 8, 'k');   // 比赛中心（触发魁地奇）
      api.rect(14, 7, 1, 1, 'g');
    },
    spawn: { x: 3, y: 8 },
    npcs: [
      { id: 'wood', name: '奥利弗·伍德', icon: '🧍', color: '#2a3a4a', hair: '#5a4a3a', x: 14, y: 4, face: 'down', dialog: 'd_wood' },
      { id: 'malfoy_pitch', name: '马尔福', icon: '🧑', color: '#3a3a4a', hair: '#d0d0d0', x: 24, y: 6, face: 'down', dialog: 'd_malfoy_pitch' },
    ],
    props: [
      { id: 'match', x: 14, y: 8, icon: '🏆', label: '比赛开始', show: s => s.flags.broomGiven && !s.flags.quidditchDone, dialog: 'd_quidditch' },
      { id: 'trophy', x: 25, y: 11, icon: '🏆', label: '奖杯柜', show: s => s.flags.quidditchDone, dialog: 'd_trophy' },
    ],
    doors: [ { x: 1, y: 8, flag: 'broomGiven' } ],
    transitions: [
      { x: 1, y: 8, w: 1, h: 1, to: 'castle', px: 31, py: 7, require: 'broomGiven', fail: 'd_cant' },
    ],
  }),

  /* ---------------- 禁林 ---------------- */
  forest: mapData({
    name: '禁林',
    w: 32, h: 18, base: 'g', dark: true, seed: 97,
    build(api) {
      api.border('t');
      api.scatter('t', 0.14);
      // 主干小径：统一两格宽，从入口一路通到出口（避免"看得见路却走不过去"）
      api.rect(1, 5, 9, 2, 'p');     // 入口 → 向东
      api.rect(8, 5, 2, 7, 'p');     // 向南
      api.rect(8, 10, 14, 2, 'p');   // 向东（经过血迹与独角兽）
      api.rect(21, 10, 2, 5, 'p');   // 向南
      api.rect(21, 13, 10, 2, 'p');  // 向东
      api.rect(29, 13, 2, 4, 'p');   // 出口
      // 标志性大树（都落在小径之外）
      api.set(14, 3, 't'); api.set(4, 9, 't'); api.set(8, 12, 't'); api.set(20, 3, 't');
      api.set(28, 3, 't'); api.set(26, 8, 't'); api.set(3, 14, 't'); api.set(24, 4, 't');
    },
    spawn: { x: 3, y: 6 },
    npcs: [
      { id: 'hagrid_forest', name: '海格', icon: '🧔', color: '#5b4a33', hair: '#5b4a33', x: 5, y: 6, face: 'down', dialog: 'd_forest_hagrid' },
      { id: 'firenze', name: '火雷恩（人马）', icon: '🐴', color: '#3a2a3a', hair: '#c0c0c0', x: 26, y: 13, face: 'down', dialog: 'd_firenze', show: s => s.flags.unicornSeen },
    ],
    props: [
      { id: 'blood', x: 17, y: 10, icon: '🩸', label: '银白色的血迹', show: s => !s.flags.unicornSeen, dialog: 'd_unicorn' },
      { id: 'unicorn', x: 18, y: 10, icon: '🦄', label: '垂死的独角兽', show: s => s.flags.unicornSeen && !s.flags.forestDone, dialog: 'd_unicorn2' },
    ],
    doors: [ { x: 30, y: 16, flag: 'unicornSeen' } ],
    transitions: [
      { x: 30, y: 16, w: 1, h: 1, to: 'castle', px: 27, py: 14, require: 'unicornSeen', fail: 'd_forest_gate', set: { forestDone: 1, pts: 15 } },
    ],
  }),

  /* ---------------- 厄里斯魔镜房间 ---------------- */
  mirror: mapData({
    name: '厄里斯魔镜房间',
    w: 18, h: 12, base: 's', dark: true, seed: 101,
    build(api) {
      api.border('#');
      // 魔镜靠北墙：镜面在 y=2（实心），镜框/台基在其下方
      api.rect(6, 2, 6, 1, 'm');   // 镜面
      api.rect(6, 3, 6, 1, '=');   // 镜框底座
      api.rect(7, 4, 4, 1, '=');   // 台基
      api.set(5, 2, 'r'); api.set(12, 2, 'r');  // 两侧火把
    },
    spawn: { x: 8, y: 10 },
    npcs: [
      { id: 'dumbledore', name: '邓布利多', icon: '🧙', color: '#2a1a4a', hair: '#c0c0c0', x: 12, y: 6, face: 'left', dialog: 'd_dumbledore', show: s => s.flags.mirrorSee },
    ],
    props: [
      // 站在魔镜正前方（y=1）即可互动
      { id: 'mirror', x: 8, y: 2, icon: '🪞', label: '厄里斯魔镜', show: s => !s.flags.mirrorDone, dialog: 'd_mirror' },
    ],
    doors: [ { x: 16, y: 6, flag: 'mirrorDone' } ],
    transitions: [
      { x: 16, y: 6, w: 1, h: 1, to: 'castle', px: 7, py: 3, require: 'mirrorDone', fail: 'd_cant' },
    ],
  }),

  /* ---------------- 地下 · 魔法石关卡 ---------------- */
  dungeon: mapData({
    name: '地下走廊',
    w: 52, h: 22, base: '.', dark: true, seed: 113,
    build(api) {
      api.border('#');
      // 顶/底整条封死，避免绕过房门从上下外圈绕到后面的房间
      api.rect(0, 1, 52, 3, '#');
      api.rect(0, 18, 52, 3, '#');
      // A 三头犬房间（外墙 x1..9，内部 x2..8）
      api.rect(1, 4, 9, 14, '#');  api.rect(2, 5, 7, 12, '.');
      // B 魔鬼网房间（外墙 x12..18，内部 x13..17）
      api.rect(12, 4, 7, 14, '#'); api.rect(13, 5, 5, 12, '.');
      // C 钥匙房间（外墙 x21..27，内部 x22..26）
      api.rect(21, 4, 7, 14, '#'); api.rect(22, 5, 5, 12, '.');
      // D 巫师棋房间（外墙 x30..38，内部 x31..37）
      api.rect(30, 4, 9, 14, '#'); api.rect(31, 5, 7, 12, '.');
      // E 魔药房间（外墙 x41..45，内部 x42..44）
      api.rect(41, 4, 5, 14, '#'); api.rect(42, 5, 3, 12, '.');
      // F 最终房间（外墙 x48..51，内部 x49..50）
      api.rect(48, 4, 4, 14, '#'); api.rect(49, 5, 2, 12, '.');
      // 每间房的西墙各留两格高的入口（东墙出口由 doors 生成 'd'，按进度解锁）
      [12, 21, 30, 41, 48].forEach(x => { api.set(x, 10, '.'); api.set(x, 11, '.'); });
      // 火把
      api.set(4, 4, 'r'); api.set(15, 4, 'r'); api.set(24, 4, 'r'); api.set(33, 4, 'r'); api.set(43, 4, 'r');
    },
    spawn: { x: 5, y: 10 },
    npcs: [
      { id: 'fluffy', name: '弗拉菲（三头犬）', icon: '🐕', color: '#5a3a2a', hair: '#5a3a2a', x: 5, y: 10, face: 'down', dialog: 'd_fluffy' },
      { id: 'ron_chess', name: '罗恩', icon: '🧑🦰', color: '#7a4a2a', hair: '#e04818', x: 34, y: 10, face: 'down', dialog: 'd_chess', show: s => s.flags.keysDone },
      { id: 'quirrell', name: '奇洛教授', icon: '😖', color: '#4a3a2a', hair: '#3a2a1a', x: 50, y: 10, face: 'down', dialog: 'd_quirrell', show: s => s.flags.potionsDone },
    ],
    props: [
      { id: 'snare', x: 15, y: 10, icon: '🌿', label: '蠕动的藤蔓', show: s => !s.flags.snareDone, dialog: 'd_snare' },
      { id: 'keys', x: 24, y: 10, icon: '🗝️', label: '盘旋的钥匙群', show: s => !s.flags.keysDone, dialog: 'd_keys' },
      { id: 'potions', x: 43, y: 10, icon: '⚗️', label: '一排药瓶', show: s => !s.flags.potionsDone, dialog: 'd_potions' },
    ],
    doors: [
      { x: 9,  y: 10, flag: 'fluffyDone' },  { x: 9,  y: 11, flag: 'fluffyDone' },
      { x: 18, y: 10, flag: 'snareDone' },   { x: 18, y: 11, flag: 'snareDone' },
      { x: 27, y: 10, flag: 'keysDone' },    { x: 27, y: 11, flag: 'keysDone' },
      { x: 38, y: 10, flag: 'chessDone' },   { x: 38, y: 11, flag: 'chessDone' },
      { x: 45, y: 10, flag: 'potionsDone' }, { x: 45, y: 11, flag: 'potionsDone' },
    ],
  }),
};

/* ================= 对话数据 =================
 * 每条对话是若干行；行可含：
 *  { n: 名字, i: 头像, t: 台词 }
 *  { t: 台词, m: 迷你游戏id, mAfter: 通关后对话 }
 *  { t: 台词, c: [选择] }   选择：{ t, sub, d, set, gain, hp, pts, go }
 */
const DIALOGS = {

  /* ---- 女贞路 ---- */
  d_privet1: [
    { n: '哈利', i: '⚡', t: '……又是德思礼家的碗柜。十年来，我住在楼梯下的碗柜里，从没收到过一封邮件。' },
    { n: '旁白', i: '📖', t: '女贞路 4 号的清晨。今天有些不对劲——信箱里塞满了信，但德思礼一家正拼命把它们抢走。' },
    { n: '哈利', i: '⚡', t: '「海格的生日蛋糕、多出来的一天休息，还有这些信……到底发生了什么事？」' },
  ],
  d_letter1: [
    { n: '哈利', i: '⚡', t: '（捡起一封信）信封上写着：萨里郡 小惠金区 女贞路 4 号 楼梯间的储物间 哈利·波特先生收。' },
    { n: '信', i: '📜', t: '「霍格沃茨魔法学校校长：阿不思·邓布利多。亲爱的波特先生：我们愉快地通知您，您已获准在霍格沃茨魔法学校就读。」' },
    { n: '哈利', i: '⚡', t: '（手抖）魔法……学校？！我……是巫师？！', set: { lettersDone: 1 } },
  ],
  d_letter2: [
    { n: '信', i: '📜', t: '「致我们亲爱的波特先生：收到这封信的第二天，第二封信随即送到——你无处可逃。霍格沃茨永远欢迎你。」' },
    { n: '哈利', i: '⚡', t: '德思礼一家把信全烧了，可信还是源源不断地涌进来……听，门外面是什么动静？', set: { lettersDone: 2 } },
  ],
  d_hagrid: [
    { n: '轰隆！', i: '💥', t: '大门被撞开了！一个比德思礼先生大三倍的巨人站在门口，手里举着一把粉红色的破伞和一个压扁的蛋糕盒。' },
    { n: '海格', i: '🧔', t: '哈利·波特！我是鲁伯·海格，霍格沃茨的猎场看守。来——我给你带来了生日蛋糕。' },
    { n: '海格', i: '🧔', t: '你没收到信？肯定是被德思礼一家拦下了！听着，哈利：你是个巫师，而且你在霍格沃茨早就出名了。' },
    { n: '海格', i: '🧔', t: '明天，对角巷见。去买你的魔杖、课本和校服——我帮你看好钥匙和火车票。' },
    { set: { hagridDone: 1 } },
  ],
  d_dursley_door: [
    { n: '哈利', i: '⚡', t: '（门紧锁着）德思礼一家去了哪儿？……管他呢，反正我大概也不会想念他们。' },
  ],
  d_privet_gate1: [
    { n: '哈利', i: '⚡', t: '（院门紧锁）……奇怪，信箱里塞满了信。也许我该先去看看，那些信到底写了什么？' },
  ],
  d_privet_gate2: [
    { n: '哈利', i: '⚡', t: '（院门还是锁着）信还在不停地飞来……好像还有一封，落在院子里的草地上。' },
  ],
  d_privet_gate3: [
    { n: '哈利', i: '⚡', t: '（海格说会带我去对角巷！）他就在院子里的小路上等着——那个大个子巨人！' },
  ],

  /* ---- 对角巷 ---- */
  d_gringotts: [
    { n: '拉环', i: '👺', t: '（尖声）波特先生。欢迎来到古灵阁——妖精经营的巫师银行，世界上最安全的地方。' },
    { n: '拉环', i: '👺', t: '你的金库在 687 号，钥匙在这儿。小心龙的脾气，别碰那些金加隆以外的东西。' },
    { gain: ['key'], set: { gold: 100, gringottsDone: 1 }, c: [
      { t: '取走 100 金加隆', sub: '解锁 购买装备 的资金', d: 'd_gringotts_done' },
    ] },
  ],
  d_gringotts_done: [
    { n: '哈利', i: '⚡', t: '（掂了掂钱袋）金加隆的叮当声——奥利凡德的魔杖、摩金夫人的长袍，我来啦！' },
  ],
  d_ollivander: [
    { n: '奥利凡德', i: '🧓', t: '（眯起眼睛）啊……哈利·波特。我就知道，总有一天会在这儿见到你。你母亲的那根魔杖是冬青木、凤凰羽毛。' },
    { n: '奥利凡德', i: '🧓', t: '魔杖选择巫师。来吧，试着挥一挥，看看哪一根愿意选你——' },
    { t: '奥利凡德拿出了三根魔杖：', c: [
      { t: '冬青木 · 凤凰羽毛', sub: '威力 ×1.3，命中 +10% —— 母亲同款', d: 'd_wand_holly', set: { wandBought: 1, wand: 'holly' } },
      { t: '紫杉木 · 龙心弦', sub: '威力 ×1.5，命中 −10% —— 强大但危险', d: 'd_wand_yew', set: { wandBought: 1, wand: 'yew' } },
      { t: '山毛榉木 · 独角兽毛', sub: '威力 ×1.1，命中 +25% —— 温和精准', d: 'd_wand_beech', set: { wandBought: 1, wand: 'beech' } },
    ] },
  ],
  d_wand_holly: [
    { n: '奥利凡德', i: '🧓', t: '（喃喃）「冬青木与凤凰羽毛……」奇妙的组合，波特先生。仿佛命中注定。' },
    { n: '奥利凡德', i: '🧓', t: '记住，是魔杖选择巫师。这根魔杖会对你忠诚一生。七加隆，谢谢。' },
    { gain: ['wand'], set: { wandBought: 1, pts: 10 } },
    { n: '提示', i: '💡', t: '（按 B / I 打开背包可以随时换魔杖；也能再花 7 加隆买下另外两根。）' },
  ],
  d_wand_yew: [
    { n: '奥利凡德', i: '🧓', t: '（皱眉）紫杉木……通常是极为危险的选择，波特先生。但愿你能驾驭它。' },
    { n: '奥利凡德', i: '🧓', t: '七加隆。小心使用——它的脾气可不太好。' },
    { gain: ['wand'], set: { wandBought: 1, pts: 10 } },
    { n: '提示', i: '💡', t: '（按 B / I 打开背包可以随时换魔杖；也能再花 7 加隆买下另外两根。）' },
  ],
  d_wand_beech: [
    { n: '奥利凡德', i: '🧓', t: '（微笑）山毛榉木配独角兽毛——最忠贞的搭配。它会非常听你的话。' },
    { n: '奥利凡德', i: '🧓', t: '七加隆。你会和它相处得很愉快的。' },
    { gain: ['wand'], set: { wandBought: 1, pts: 10 } },
    { n: '提示', i: '💡', t: '（按 B / I 打开背包可以随时换魔杖；也能再花 7 加隆买下另外两根。）' },
  ],
  d_books: [
    { n: '店员', i: '👨🦳', t: '一年级新生？《标准咒语·初级》、《魔法史》、还有斯内普教授要求的《千种神奇药草与蕈类》……' },
    { n: '店员', i: '👨🦳', t: '一共十二本，收好。哦对了——听说古灵阁地下有一只逃跑的巨怪，别在银行里乱逛。' },
    { gain: ['book'], set: { booksBought: 1 } },
  ],
  d_robes: [
    { n: '摩金夫人', i: '👩🦰', t: '（拿着软尺绕着你转）哦——又一个波特先生？袖子卷起来，亲爱的，你的新校服正在量尺寸。' },
    { n: '摩金夫人', i: '👩🦰', t: '黑色巫师袍，加上尖顶帽、手套和冬用斗篷。这套穿在你身上一定很精神。' },
    { gain: ['robe'], set: { robesBought: 1 } },
  ],
  d_owl: [
    { n: '店员', i: '👨', t: '（吹了声口哨，一只雪鸮落到他肩上）波特先生！这位小姐叫海德薇，安静、忠诚，是最好的信使。' },
    { n: '店员', i: '👨', t: '驯养的猫头鹰，十一加隆。她会陪你度过整个学年。' },
    { gain: ['owl'], set: { owlBought: 1 } },
  ],
  d_candy: [
    { n: '店员', i: '👩', t: '（咧嘴）蜂蜜公爵的新品！比比多味豆、巧克力蛙、滋滋蜜蜂糖……要来一袋吗？' },
    { n: '店员', i: '👩', t: '（压低声音）这袋豆子里可能有几颗耳朵屎味的，自己当心。' },
    { gain: ['beans'], set: { candyBought: 1 } },
  ],
  d_umbrella: [
    { n: '哈利', i: '⚡', t: '（看着墙角）一把粉红色的破伞……和海格那把一模一样。原来他真的用这个施魔法！' },
  ],
  d_malfoy_diagon: [
    { n: '马尔福', i: '🧑', t: '（打量着哈利）波特？我听说你会来。我父亲说，今年一年级新生里会有个大名人——果然是你。' },
    { n: '马尔福', i: '🧑', t: '你会后悔来霍格沃茨的。有些巫师家庭，可是比别的家庭更高贵。' },
    { t: '马尔福转身离去。你打算——', c: [
      { t: '不理他', sub: '大度地转身去逛商店', d: 'd_malfoy_ignore', set: { pts: 5 } },
      { t: '回敬一句「是吗？」', sub: '（斯莱特林可扣不起你的嘴）', d: 'd_malfoy_retort', set: { pts: -5 } },
    ] },
  ],
  d_malfoy_ignore: [
    { n: '哈利', i: '⚡', t: '（耸耸肩）爱说什么说什么。我今天是来买魔杖的，不是来吵架的。' },
  ],
  d_malfoy_retort: [
    { n: '马尔福', i: '🧑', t: '（脸色铁青）你会为这句话付出代价的，波特！' },
    { n: '哈利', i: '⚡', t: '（嘴硬但有点后悔）……好吧，也许不该跟这种人计较。' },
  ],
  d_diagon_gate: [
    { n: '哈利', i: '⚡', t: '（站在街尾）去国王十字车站的车票在口袋里，但海格说过——先得有一根属于自己的魔杖。' },
  ],

  /* ---- 9¾ 站台 ---- */
  d_station: [
    { n: '旁白', i: '📖', t: '国王十字车站。人流如织，但 9 号站台和 10 号站台之间……只有一堵结实的砖墙。' },
    { n: '哈利', i: '⚡', t: '「9¾ 站台，到底在哪儿？」海格只说了一句「一直走就是了」，可前面明明是堵墙！' },
  ],
  d_ron_platform: [
    { n: '罗恩', i: '🧑🦰', t: '（火车头蒸汽里钻出来，脸红红的）你好！你也是去霍格沃茨的？我——我是罗恩·韦斯莱。' },
    { n: '罗恩', i: '🧑🦰', t: '我老妈一直想找个机会看看 9¾ 站台……他们说那堵墙能穿过去。你打算怎么过去？' },
    { n: '哈利', i: '⚡', t: '（盯着墙）听说……闭着眼睛冲过去就行。' },
    { set: { meetRon: 1 } },
  ],
  d_malfoy_station: [
    { n: '马尔福', i: '🧑', t: '（远远地）波特，还有韦斯莱——我父亲警告过我要提防像你们这样的人。' },
    { n: '罗恩', i: '🧑🦰', t: '（压低声音）他爸跟韦斯莱家有过节……总之，别理他。' },
  ],
  d_barrier: [
    { n: '哈利', i: '⚡', t: '（深吸一口气）好……推着手推车，闭眼，冲！' },
    { n: '旁白', i: '📖', t: '你一头撞向砖墙——眼前白光一闪！' },
    { t: '穿过 9¾ 站台！', go: 'train', goSpawn: 1 },
  ],
  d_trolley: [
    { n: '哈利', i: '⚡', t: '（手推车上堆满行李）海德薇在笼子里安静地眨着眼。这趟旅程，一定和以前去姨父家的野营完全不一样。' },
  ],

  /* ---- 列车 ---- */
  d_train_enter: [
    { n: '旁白', i: '📖', t: '霍格沃茨特快呼啸着驶向北方。窗外的田野渐渐变成荒原，夜幕降临。' },
    { n: '哈利', i: '⚡', t: '（推开车厢门）呃……这里有人吗？' },
  ],
  d_train_ron: [
    { n: '罗恩', i: '🧑🦰', t: '（缩在座位上，鼠斑满脸惊恐地瞪着你）哦！……你吓到斑斑了。坐吧——我是罗恩，之前站台上我们见过。' },
    { n: '罗恩', i: '🧑🦰', t: '要不要来点巧克力蛙？我本来想留着吃，但你是「那个哈利·波特」——（咧嘴）我的两个哥哥在开玩笑时老提到你。' },
    { n: '哈利', i: '⚡', t: '（拆开巧克力蛙）它跳走了！等等——卡片上是……阿不思·邓布利多？！' },
    { gain: ['frog', 'card'], set: { meetRon: 1 } },
  ],
  d_train_hermione: [
    { n: '赫敏', i: '👩', t: '（推了推门，抱着一摞书）你们好！有人看到一只蟾蜍吗？纳威的宠物不见了。' },
    { n: '赫敏', i: '👩', t: '（眼睛一亮）哦！你一定是哈利·波特。我是赫敏·格兰杰。顺便说一句，我已经把《霍格沃茨：一段校史》背完了。' },
    { n: '罗恩', i: '🧑🦰', t: '（嘀咕）难怪你这么肯定自己是格兰芬多……' },
    { set: { meetHermione: 1 } },
  ],
  d_train_neville: [
    { n: '纳威', i: '🙍', t: '（揉着眼睛，快哭出来）我的莱福……我的蟾蜍不见了！奶奶会杀了我的……' },
    { n: '哈利', i: '⚡', t: '（四处张望）别急，我们帮你找找。' },
    { t: '在车厢里寻找蟾蜍。', c: [
      { t: '继续找！', sub: '看看座位底下和行李架', d: 'd_train_neville2', set: { toadFound: 1, pts: 10 }, gain: ['toad'] },
    ] },
  ],
  d_train_neville2: [
    { n: '哈利', i: '⚡', t: '（在行李架下找到了那只蟾蜍，递给纳威）给，莱福在这儿。它大概是跳累了。' },
    { n: '纳威', i: '🙍', t: '（破涕为笑）谢谢你，哈利！你人真好。' },
  ],
  d_toad: [
    { n: '哈利', i: '⚡', t: '（蹲下来）一只圆滚滚的蟾蜍，正趴在一个行李包下面——这一定是纳威的莱福！' },
    { gain: ['toad'], set: { toadFound: 1, pts: 10 } },
  ],
  d_train_gate: [
    { n: '哈利', i: '⚡', t: '（望了望窗外）好像快到站了……要不要先去隔壁车厢看看有没有人知道霍格沃茨的情况？' },
  ],

  /* ---- 礼堂 ---- */
  d_hall_enter: [
    { n: '旁白', i: '📖', t: '漂浮的蜡烛点亮了礼堂，天花板像夜空一样深邃。新生们站成一排，前方是一顶又旧又破的帽子。' },
    { n: '麦格', i: '👩🦱', t: '（站在教师席前，声音清楚）欢迎来到霍格沃茨。分院仪式马上开始——分院帽会决定你们属于哪个学院。' },
    { n: '哈利', i: '⚡', t: '（紧张地搓手）礼堂真大……而且好像所有人都认识我。' },
  ],
  d_sort: [
    { n: '分院帽', i: '🎩', t: '（唱着歌）「哦，你们也许觉得我不漂亮……但我的判断绝不会错——哪个学院更适合你？」' },
    { n: '分院帽', i: '🎩', t: '（压低声音）啊……你！你很勇敢，也很有才华，而且急着证明自己。那种渴望，我以前只在斯莱特林身上见过。' },
    { n: '哈利', i: '⚡', t: '（在心里大喊）不去斯莱特林！绝对不去斯莱特林！' },
    { n: '分院帽', i: '🎩', t: '（大笑）不去斯莱特林？那就……格兰芬多！！！' },
    { n: '旁白', i: '📖', t: '（台下）格兰芬多的长桌爆发出欢呼声，罗恩和双胞胎兄弟拍着桌子大喊。' },
    { set: { sorted: 1, pts: 10 }, c: [
      { t: '走向格兰芬多长桌', sub: '和罗恩击掌，开始晚宴', d: 'd_feast' },
    ] },
  ],
  d_feast: [
    { n: '旁白', i: '📖', t: '晚宴无比丰盛：烤鸡、肉饼、约克布丁、火焰冰淇淋……邓布利多站起来宣布了几条校规。' },
    { n: '邓布利多', i: '🧙', t: '（举起酒杯）「祝大家用餐愉快！对了——格兰芬多的哈利·波特，我知道是你让分院帽选了格兰芬多。干得好。」' },
    { n: '罗恩', i: '🧑🦰', t: '（嘴里塞满鸡腿）他刚才说你的名字了！你出名了，哈利！' },
  ],
  d_candle: [
    { n: '哈利', i: '⚡', t: '（抬头）成百上千根蜡烛漂浮在半空，照亮了镀金的天花板……这可比德思礼家的灯泡气派多了。' },
  ],
  d_mcgonagall_hall: [
    { n: '麦格', i: '👩🦱', t: '（严肃地）各位一年级新生。禁林禁止入内，四楼走廊禁止入内。违者将面临最严厉的惩罚。' },
    { n: '罗恩', i: '🧑🦰', t: '（小声）她越这么说，越让人好奇里面有什么……' },
  ],
  d_ron_hall: [
    { n: '罗恩', i: '🧑🦰', t: '（嚼着馅饼）格兰芬多！我全家都是格兰芬多！除了我那个讨厌的表哥，他在斯莱特林。' },
  ],
  d_hermione_hall: [
    { n: '赫敏', i: '👩', t: '（挺直腰板）我父亲是麻瓜牙医，我是从书里认识这个世界的。但我保证，我会是最优秀的那个。' },
  ],
  d_hall_gate: [
    { n: '哈利', i: '⚡', t: '（拉住门把手）门锁着——宴会还没结束，先回去听听麦格教授的训话吧。' },
  ],

  /* ---- 城堡枢纽 ---- */
  d_mcgonagall: [
    { n: '麦格', i: '👩🦱', t: '波特先生。伍德——魁地奇球队的队长——在点名时提到了你。他说你在飞行课上抓住了被赫敏失手放走的记忆球。' },
    { n: '麦格', i: '👩🦱', t: '（停顿）你是我见过飞行天赋最好的新生。拿着——光轮 2000，最新款。去球场上会会伍德吧。' },
    { gain: ['broom'], set: { broomGiven: 1, pts: 20 }, c: [
      { t: '接过光轮 2000', sub: '「谢谢教授！」（魁地奇球场解锁）', d: 'd_mcgonagall2' },
    ] },
  ],
  d_mcgonagall2: [
    { n: '麦格', i: '👩🦱', t: '（难得露出一丝笑意）去吧。如果斯内普问起来，就说是我批准的。' },
  ],
  d_hagrid2: [
    { n: '海格', i: '🧔', t: '（神秘兮兮地招手）哈利！过来过来——我的诺伯就要孵出来了！一条威尔士绿龙，我准备叫它诺伯。' },
    { n: '海格', i: '🧔', t: '（压低声音）圣诞节我偷偷给你削了根木笛，拿着。不过今晚——我得去禁林巡逻，听说有人看见银白色的血迹……' },
    { gain: ['flute'], set: { christmasGift: 1, pts: 5 } },
    { t: '海格搓着手，看起来又想请你帮忙。', c: [
      { t: '「我跟你去禁林看看」', sub: '（进入禁林——寻找独角兽）', go: 'forest', goSpawn: 1 },
      { t: '「我晚点再过去」', sub: '（留在城堡里转转）', d: 'd_hagrid_later' },
    ] },
  ],
  d_hagrid_later: [
    { n: '海格', i: '🧔', t: '（挠头）成。不过我提醒你，天黑以后禁林里什么都有——狼人、人马，还有更糟的东西。' },
  ],
  d_ron_castle: [
    { n: '罗恩', i: '🧑🦰', t: '（趴在窗台上）马尔福又要找我们麻烦……他说他爸能买下整个魁地奇队。哦，对了——我听说四楼走廊里有条三头犬。' },
  ],
  d_hermione_castle: [
    { n: '赫敏', i: '👩', t: '（从书里抬头）我在禁书区查过——四楼走廊守着一条三头犬，而魔法石就在它的正下方。有人在偷魔法石，哈利。我们必须管这件事。' },
    { set: { hermioneHint: 1 } },
  ],
  d_nick: [
    { n: '差点没头的尼克', i: '👻', t: '（飘过来，尴尬地咳了一声）晚上好。我能穿过墙，却没法保住自己的脑袋——他们管这叫「差点没头」。' },
    { n: '哈利', i: '⚡', t: '（憋着笑）祝你的「无头骑士俱乐部」申请成功，尼克。' },
    { set: { pts: 5 } },
  ],
  d_peeves: [
    { n: '皮皮鬼', i: '🤡', t: '（尖叫着倒空一桶粉笔灰）啊哈！波特和他的朋友们！粉笔灰攻击——嗒嗒嗒！' },
    { t: '皮皮鬼在半空中翻了个跟头。你——', c: [
      { t: '躲开，不跟他一般见识', sub: '（皮皮鬼无趣地飞走了）', d: 'd_peeves_ok', set: { pts: 5 } },
      { t: '扔出一个纸团还击', sub: '（正中皮皮鬼，但也惊动了费尔奇）', d: 'd_peeves_fight', set: { pts: -5 } },
    ] },
  ],
  d_peeves_ok: [
    { n: '皮皮鬼', i: '🤡', t: '（失望地飘走）无趣！太无趣了！' },
  ],
  d_peeves_fight: [
    { n: '费尔奇', i: '👴', t: '（远远地）波特！！又是你！格兰芬多扣五分！' },
    { n: '哈利', i: '⚡', t: '（缩了缩脖子）好吧……这不值得。' },
  ],
  d_cant: [
    { n: '哈利', i: '⚡', t: '（推了推门）锁着。大概时机还没到。' },
  ],
  d_lock_broom: [
    { n: '伍德', i: '🧍', t: '（隔着球场门喊）波特！没有扫帚可进不了球场——去找麦格教授，她好像有东西要给你！' },
  ],
  d_lock_dungeon: [
    { n: '哈利', i: '⚡', t: '（握住地下走廊的门把）门纹丝不动……赫敏说过，魔法石就藏在下面。也许我应该先找到那面厄里斯魔镜。' },
  ],

  /* ---- 教室 ---- */
  d_flitwick: [
    { n: '弗立维教授', i: '👴', t: '（站上凳子，挥着魔杖）一年级魔咒课！今天我们学习基础咒语——「荧光闪烁」和「羽加迪姆勒维奥萨」！' },
    { n: '弗立维教授', i: '👴', t: '（示范）先看我的——羽加迪姆勒维奥萨！羽毛浮起来了！记住要领：轻轻一点，准确发音。' },
    { n: '弗立维教授', i: '👴', t: '现在轮到你了，波特先生。让我们看看格兰芬多的天赋——（把羽毛放在你面前）' },
    { t: '练习漂浮咒！', m: 'leviosa', mAfter: 'd_after_leviosa' },
  ],
  d_after_leviosa: [
    { n: '弗立维教授', i: '👴', t: '（鼓掌）妙极了！格兰芬多加十分！你已经掌握了两条咒语——荧光闪烁和羽加迪姆勒维奥萨！' },
    { n: '赫敏', i: '👩', t: '（在座位上小声）他说得对，你做得很标准。' },
    { gain: [], set: { lessonDone: 1, pts: 10 } },
  ],
  d_snape: [
    { n: '斯内普', i: '👨', t: '（黑袍一甩，目光如刀）波特先生。看来你又一次迟到了——没有。那就让我看看，你的脑袋里除了「大难不死的男孩」的光环，还剩些什么。' },
    { n: '斯内普', i: '👨', t: '回答我三个问题。答对了，格兰芬多加十五分；答错了——扣五分，外加我毫不掩饰的失望。' },
    { t: '斯内普开始提问。', m: 'snape', mAfter: 'd_after_snape' },
  ],
  d_after_snape: [
    { n: '斯内普', i: '👨', t: '（冷冷地）哼……这次就放过你。把这份疗伤剂拿去——以防你在「巡逻」时把自己弄伤。' },
    { gain: ['potion', 'potion'], set: { quizDone: 1 } },
  ],
  d_ron_class: [
    { n: '罗恩', i: '🧑🦰', t: '（趴在桌上）魔药课太吓人了……斯内普看我的眼神，就像看一只蟑螂。' },
  ],
  d_hermione_class: [
    { n: '赫敏', i: '👩', t: '（一边预习一边说）我早说了，课堂笔记要提前背熟。不过我更喜欢图书馆——那里有答案。' },
  ],

  /* ---- 魁地奇 ---- */
  d_wood: [
    { n: '伍德', i: '🧍', t: '（热身的动作停住，眼睛发亮）波特！终于来了！我是格兰芬多队长奥利弗·伍德。' },
    { n: '伍德', i: '🧍', t: '听麦格教授说，你在飞行课上展露出了惊人的天赋。我从来没让一年级生上场——直到看到你。' },
    { n: '伍德', i: '🧍', t: '今天的对手是斯莱特林。规则很简单：金色飞贼——抓住它，比赛就赢了。别管游走球，我会替你挡着。' },
  ],
  d_malfoy_pitch: [
    { n: '马尔福', i: '🧑', t: '（骑着扫帚掠过）波特，听说你被选进球队了？哈！我父亲送了我最新的光轮 2001，比你那「生日礼物」快多了。' },
    { n: '罗恩', i: '🧑🦰', t: '（在旁边嘀咕）扫帚快有什么用，飞行技术才决定胜负。' },
  ],
  d_quidditch: [
    { n: '旁白', i: '📖', t: '哨声响起！斯莱特林的绿色队服和格兰芬多的红色队服在天空中交织。' },
    { n: '旁白', i: '📖', t: '金色飞贼出现了——就在球场上空翻飞！游走球呼啸着掠过你的耳边。' },
    { n: '伍德', i: '🧍', t: '（喊道）波特！看见了吗？抓住它！赢了这场比赛，我们就是院杯冠军的有力竞争者！' },
    { t: '比赛开始！', m: 'snitch', mAfter: 'd_after_snitch' },
  ],
  d_after_snitch: [
    { n: '旁白', i: '📖', t: '你俯冲而下——指尖擦过飞贼的金色翅膀，一把抓住！' },
    { n: '解说员', i: '📣', t: '「波特抓住了金色飞贼！格兰芬多获胜！！」' },
    { n: '伍德', i: '🧍', t: '（激动得把你举起来）你是天才！波特，你是天才！' },
    { set: { quidditchDone: 1, pts: 40 } },
  ],
  d_trophy: [
    { n: '哈利', i: '⚡', t: '（看着奖杯柜）这座学院杯……今年，我们把它带回家。' },
  ],

  /* ---- 禁林 ---- */
  d_forest_hagrid: [
    { n: '海格', i: '🧔', t: '（提着油灯，声音发颤）哈利，你来了。我找到了那滩银白色的血迹——银白色，只有独角兽的血才是那个颜色。' },
    { n: '海格', i: '🧔', t: '（压低声音）杀死独角兽是极大的罪过……有人为了活命，正在猎杀它们。我们必须找到它。' },
    { n: '哈利', i: '⚡', t: '（攥紧魔杖）沿着血迹走，快！' },
  ],
  d_unicorn: [
    { n: '旁白', i: '📖', t: '血迹一直延伸到一棵老橡树下——一只纯白的独角兽倒在地上，胸口汩汩地流着血，眼神浑浊。' },
    { n: '旁白', i: '📖', t: '（黑暗里传来黏腻的脚步声）……有人来了。一个穿着斗篷的身影俯身向独角兽——' },
    { n: '哈利', i: '⚡', t: '（手臂上的伤疤灼痛起来）那个人……他喝了独角兽的血！' },
    { n: '火雷恩', i: '🐴', t: '（马蹄声由远及近）凡人，离开这里。独角兽的血，是为了让你活下去的人饮下的——那是伏地魔的影子。' },
    { n: '哈利', i: '⚡', t: '（浑身发冷）伏地魔……不是死了吗？' },
    { set: { unicornSeen: 1, pts: 15 } },
  ],
  d_unicorn2: [
    { n: '火雷恩', i: '🐴', t: '（守候在独角兽身边，轻声）它离开了我们。记住今夜看到的一切——黑暗正等着你们。' },
  ],
  d_firenze: [
    { n: '火雷恩', i: '🐴', t: '（站在星光下）波特。火星明亮，预示着厄运。魔法石藏在霍格沃茨不是秘密——它被一条三头犬、无数魔法机关守护着。' },
    { n: '火雷恩', i: '🐴', t: '（凝视远方）可是石头本身，才是最大的陷阱。想要利用它的人，永远找不到它；只有不想利用它的人，才能得到它。' },
    { set: { firenzeSeen: 1, pts: 10 } },
  ],
  d_forest_gate: [
    { n: '哈利', i: '⚡', t: '（望向密林深处）夜色太黑了……海格说得先去找到那头受伤的独角兽。' },
  ],

  /* ---- 厄里斯魔镜 ---- */
  d_mirror: [
    { n: '旁白', i: '📖', t: '你推开废弃教室的门——一面高大的镜子立在房间中央，镜框上刻着字：' },
    { n: '镜铭', i: '🪞', t: '「厄里斯 · 斯特拉 · 厄赫鲁 · 阿伊特乌比 · 卡弗鲁 · 阿伊特昂 · 沃赫西。」' },
    { n: '旁白', i: '📖', t: '（厄里斯魔镜——反着读，就是「渴望」）你凝视着镜面……' },
    { n: '哈利', i: '⚡', t: '（倒吸一口气）妈妈……爸爸！他们站在我身后，对我微笑。还有我自己——我握着……一块发光的石头。' },
    { n: '邓布利多', i: '🧙', t: '（不知何时出现在你身后）看到你想看的东西了，是吗？' },
    { n: '邓布利多', i: '🧙', t: '（缓缓地说）这面镜子不会给我们知识和真相。人们在其中看到的是内心深处的渴望。' },
    { n: '邓布利多', i: '🧙', t: '（目光深邃）魔法石很安全，哈利。它被藏在一个只对「想要它的人」可见的地方。而现在——' },
    { n: '邓布利多', i: '🧙', t: '（把手伸进长袍口袋，又缓缓抽出，摊开手掌）它已经在你口袋里了。' },
    { gain: ['stone'], set: { mirrorDone: 1, hasStone: 1, mirrorSee: 1, pts: 20 } },
  ],
  d_dumbledore: [
    { n: '邓布利多', i: '🧙', t: '（微笑着捻着银白胡须）你在镜子里看到了自己的家人，还有那颗魔法石。' },
    { n: '邓布利多', i: '🧙', t: '记住：渴望并不能替代真正的拥有。走吧，该来的总会来。' },
  ],

  /* ---- 地下关卡 ---- */
  d_fluffy: [
    { n: '旁白', i: '📖', t: '你推开门——三头犬弗拉菲的三个脑袋同时转向你，六只眼睛在黑暗中亮起。' },
    { n: '罗恩', i: '🧑🦰', t: '（声音发颤）我……我记得海格说过，他教过弗拉菲，一听音乐就睡觉！' },
    { n: '哈利', i: '⚡', t: '（从袍子里抽出海格的木笛）那好——你们谁来给我打拍子？' },
    { t: '吹响木笛！', m: 'flute', mAfter: 'd_after_fluffy' },
  ],
  d_after_fluffy: [
    { n: '旁白', i: '📖', t: '悠扬的笛声回荡在石室里——弗拉菲的三个脑袋一个接一个地耷拉下去，响起了如雷的鼾声。' },
    { n: '罗恩', i: '🧑🦰', t: '（长舒一口气）下次演出记得买票……快，我们进去！' },
  ],
  d_snare: [
    { n: '旁白', i: '📖', t: '下一扇门里没有地板——只有一大片翻涌的魔鬼网，藤蔓像蛇一样朝你爬来。' },
    { n: '赫敏', i: '👩', t: '（飞快地翻着书）魔鬼网！斯普劳特教授课上讲过——它怕光，喜欢黑暗和潮湿！' },
    { n: '罗恩', i: '🧑🦰', t: '（脚踝已经被缠住）废话！现在怎么办？！' },
    { t: '闯过魔鬼网！', m: 'snare', mAfter: 'd_after_snare' },
  ],
  d_after_snare: [
    { n: '赫敏', i: '👩', t: '（收起魔杖，拍掉裙子上的草屑）看，我说了吧。魔鬼网最怕光。' },
    { n: '罗恩', i: '🧑🦰', t: '（从网里爬出来，龇牙）你怎么不早说！' },
  ],
  d_keys: [
    { n: '旁白', i: '📖', t: '这是一间装满钥匙的房间——几百把长着翅膀的钥匙在头顶盘旋，扑棱棱地响成一片。' },
    { n: '赫敏', i: '👩', t: '（眯起眼）其中有一把特别的老式钥匙——银色、翅膀上还有一道裂痕。它能打开对面的门。' },
    { n: '罗恩', i: '🧑🦰', t: '（盯着满屋子的钥匙）说得容易……那可是一屋子带翅膀的钥匙！' },
    { t: '捕捉正确的钥匙！', m: 'keys', mAfter: 'd_after_keys' },
  ],
  d_after_keys: [
    { n: '旁白', i: '📖', t: '你一把抓住那把银色的、翅膀有伤的钥匙，插入锁孔——咔嗒，门开了。' },
    { n: '赫敏', i: '👩', t: '（得意地）我说得没错吧。' },
  ],
  d_chess: [
    { n: '罗恩', i: '🧑🦰', t: '（大步走进棋室，眼睛发亮）我的天……真人大小的高脚棋！你们不懂下棋，对吧？' },
    { n: '罗恩', i: '🧑🦰', t: '（指挥若定）那就听我的：我是骑士，赫敏是城堡，你是主教。记住了——每一步都关系到生死。' },
    { n: '旁白', i: '📖', t: '棋盘的对面，斯莱特林的黑色棋子虎视眈眈。罗恩的表情前所未有地认真。' },
    { t: '指挥棋局！', m: 'chess', mAfter: 'd_after_chess' },
  ],
  d_after_chess: [
    { n: '旁白', i: '📖', t: '棋局到了生死关头。黑方的皇后杀死了罗恩扮演的骑士——' },
    { n: '罗恩', i: '🧑🦰', t: '（倒下的瞬间喊道）快走！别管我！只要再走一步，你就能吃掉黑王——快！！' },
    { n: '赫敏', i: '👩', t: '（冲过去扶住罗恩）罗恩！你流血了！' },
    { n: '旁白', i: '📖', t: '你踩上最后一步——黑王被逼入绝境，哗啦一声，整个棋盘化作碎片。门，开了。' },
    { set: { chessDone: 1, pts: 20 } },
  ],
  d_potions: [
    { n: '旁白', i: '📖', t: '最后一间石室。七个瓶子排成一列，脚下是翻腾的紫色火焰，头上是黑色的火焰。' },
    { n: '赫敏', i: '👩', t: '（飞快读着羊皮纸）「危险潜伏于七瓶之中……最小的一瓶带你向前，最右的一瓶让你回头。」这是逻辑题，不是魔法！' },
    { t: '破解魔药谜题！', m: 'potions', mAfter: 'd_after_potions' },
  ],
  d_after_potions: [
    { n: '赫敏', i: '👩', t: '（长舒一口气）我们做到了。紫色火焰分开了……前面就是最后的房间。' },
    { n: '罗恩', i: '🧑🦰', t: '（跟上来，脸色发白）奇洛教授。他偷魔法石……现在他就在里面。' },
  ],
  d_quirrell: [
    { n: '奇洛', i: '😖', t: '（声音颤抖，却又带着狂热）哈——哈……波特。我就知道会是你。邓布利多那么信任我，可他们都不知道……' },
    { n: '奇洛', i: '😖', t: '（猛地扯下头巾，后脑勺上浮现出另一张脸）……伏地魔大人就在我身上。把魔法石交出来！' },
    { n: '伏地魔', i: '🐍', t: '（嘶嘶地）把石头给我，男孩……我可以饶你一命。' },
    { n: '哈利', i: '⚡', t: '（攥紧魔杖，手心全是汗）我妈妈……为了救我而死。你休想！' },
    { t: '与奇洛教授决斗！', m: 'duel', mAfter: 'd_after_duel' },
  ],
  d_after_duel: [
    { n: '旁白', i: '📖', t: '奇洛被打得节节败退，伏地魔的声音在他后脑嘶吼着。他踉跄着扑向你——' },
    { n: '奇洛', i: '😖', t: '（嘶吼）把石头给我！！' },
    { n: '旁白', i: '📖', t: '你抓住他的手腕——奇洛的皮肤灼烧起来！他惨叫着后退，整张脸痛苦地扭曲。' },
    { n: '哈利', i: '⚡', t: '（在昏过去前听到邓布利多的声音）做得好，哈利……做得好。' },
    { n: '旁白', i: '📖', t: '……等你醒来，已经是医务室了。邓布利多站在床边，手里转动着那块魔法石。' },
  ],
};

/* ---- 决斗数据 ---- */
const DUEL = {
  harry: { name: '哈利', maxHp: 100, maxMana: 4 },
  quirrell: { name: '奇洛', maxHp: 100 },
  spells: {
    stupefy:  { n: '昏昏倒地', i: '💥', cost: 1, dmg: 26, hit: 0.75, text: '一道红光击中奇洛！' },
    incendio: { n: '火焰熊熊', i: '🔥', cost: 2, dmg: 44, hit: 0.55, text: '杖尖喷出烈焰！' },
  },
};
