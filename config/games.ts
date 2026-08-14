export type GameId = "three-kingdoms-defense" | "worm-front" | "prism-dash" | "rune-peg" | "fate-chamber" | "planet-merge" | "nightfall-survivors" | "iron-front" | "thunder-wing" | "orbit-dash" | "stack-up" | "bamboo-cicada" | "memory-pairs" | "beat-rush" | "hamster-roll" | "gold-miner" | "oil-tycoon" | "minesweeper" | "go" | "guiyang-mahjong" | "zuma" | "perfect-parking" | "moon-swing";

export type GameInfo = {
  id: GameId;
  title: string;
  eyebrow: string;
  description: string;
  category: "射击" | "反应" | "益智" | "治愈" | "音乐" | "经营" | "策略";
  players: string;
  duration: string;
  accent: string;
  art: "threeKingdoms" | "worm" | "prism" | "peg" | "chamber" | "planetMerge" | "nightfall" | "iron" | "thunder" | "orbit" | "stack" | "bambooCicada" | "memory" | "beat" | "hamster" | "miner" | "oil" | "minesweeper" | "go" | "mahjong" | "zuma" | "parking" | "moon";
  controls: string;
};

export const games: GameInfo[] = [
  {
    id: "three-kingdoms-defense",
    title: "三国：烽火守城",
    eyebrow: "武将塔防",
    description: "在黄巾围村的六轮攻势中建造三类兵营、选择专精军令，调动关羽并用火攻击败张梁。",
    category: "策略",
    players: "NEW",
    duration: "6–8 分钟",
    accent: "#d19d43",
    art: "threeKingdoms",
    controls: "点击营地建造、升级或选择分支；点击绿色军旗调动关羽；积攒士气发动火攻，Q 释放武将大招，P 暂停",
  },
  {
    id: "worm-front",
    title: "荒丘虫兵",
    eyebrow: "物理炮战",
    description: "观察风向、蓄力轰炸并改变地形，带领三名原创虫兵在回合制荒丘上击败本地 AI。",
    category: "射击",
    players: "NEW",
    duration: "4–7 分钟",
    accent: "#72c8a1",
    art: "worm",
    controls: "A/D 或方向键移动，W 跳跃，鼠标或上下键瞄准，按住空格蓄力、松开发射，1–4 切换武器，P 暂停；支持触屏按钮",
  },
  {
    id: "prism-dash", title: "棱镜跃动", eyebrow: "单键跑酷",
    description: "跟随脉冲穿过三段几何轨道，利用空中光环二段跃升并收集棱晶。", category: "反应", players: "NEW", duration: "1–2 分钟", accent: "#65e3ff", art: "prism",
    controls: "点击 / 空格 / ↑ 跳跃；空中靠近金色光环时再次点击；P 暂停",
  },
  {
    id: "rune-peg", title: "符文弹珠", eyebrow: "弹珠肉鸽",
    description: "瞄准符文钉阵累积伤害，击败三波星门怪物并用遗物构筑弹珠核心。", category: "益智", players: "NEW", duration: "4–8 分钟", accent: "#78c9ff", art: "peg",
    controls: "移动鼠标或手指瞄准，点击 / 空格发射，波次结束后三选一遗物，P 暂停",
  },
  {
    id: "fate-chamber", title: "命运弹仓", eyebrow: "概率博弈",
    description: "判断实能量与惰性能量的顺序，组合七种道具，在本地 AI 庄家手中夺回命运。", category: "益智", players: "NEW", duration: "4–7 分钟", accent: "#d3aa68", art: "chamber",
    controls: "点击道具使用，再选择对自己或庄家释放；惰性能量对自己释放可连续行动；使用界面按钮暂停",
  },
  {
    id: "planet-merge", title: "合成大 Saber", eyebrow: "英灵合成",
    description: "投放 Q版英灵头像，让相同角色碰撞升级，在越过警戒线前合成最大的 Saber。", category: "治愈", players: "NEW", duration: "4–8 分钟", accent: "#e9c775", art: "planetMerge",
    controls: "鼠标 / 手指左右移动并点击投放；A/D 或方向键移动、空格投放；P 暂停",
  },
  {
    id: "nightfall-survivors",
    title: "永夜幸存者",
    eyebrow: "构筑生存",
    description: "在无尽夜潮中自动战斗，组合六系武器、被动与秘法牌完成超级进化。",
    category: "射击",
    players: "NEW",
    duration: "10–25 分钟",
    accent: "#b16cff",
    art: "nightfall",
    controls: "WASD / 方向键移动，P 暂停，1–6 使用任务主动技能，Q 释放祭坛充能的大招",
  },
  {
    id: "iron-front",
    title: "钢铁突围",
    eyebrow: "街机跑轰",
    description: "穿越被占领的像素城市，营救队友、夺取重武器并摧毁装甲堡垒。",
    category: "射击",
    players: "NEW",
    duration: "4–8 分钟",
    accent: "#ffb34f",
    art: "iron",
    controls: "A D 移动，空格跳跃，J 射击，K 手雷，W 向上瞄准",
  },
  {
    id: "thunder-wing",
    title: "雷霆突击",
    eyebrow: "空战新作",
    description: "驾驶雷霆战机突破密集弹幕，升级火力、开启护盾并迎战旗舰。",
    category: "射击",
    players: "NEW",
    duration: "3–6 分钟",
    accent: "#56d9ff",
    art: "thunder",
    controls: "WASD / 方向键移动，鼠标或手指拖动战机",
  },
  {
    id: "orbit-dash",
    title: "星轨闪避",
    eyebrow: "本周热门",
    description: "穿梭在不断加速的霓虹星轨间，看看你能坚持多久。",
    category: "反应",
    players: "12.8k",
    duration: "2–4 分钟",
    accent: "#ff6b4a",
    art: "orbit",
    controls: "方向键 / A D 移动，手机可触控",
  },
  {
    id: "stack-up",
    title: "天空叠叠乐",
    eyebrow: "手感挑战",
    description: "在最恰好的时机落下方块，把小小高塔叠到云端。",
    category: "治愈",
    players: "8.4k",
    duration: "1–3 分钟",
    accent: "#6f71e8",
    art: "stack",
    controls: "空格 / 点击屏幕放下方块",
  },
  {
    id: "bamboo-cicada",
    title: "竹知了·鸣夏",
    eyebrow: "夏夜玩物",
    description: "按住画圆甩响竹知了，把圈速稳定在目标鸣律，完成三段会随手速变化的夏夜蝉鸣。",
    category: "治愈",
    players: "NEW",
    duration: "1–2 分钟",
    accent: "#e1b75f",
    art: "bambooCicada",
    controls: "手机开启体感后甩动游玩，也可用鼠标或手指按住画圆；速度进入目标区会积累鸣律，红色警告时放慢，P 暂停",
  },
  {
    id: "memory-pairs",
    title: "岛屿记忆",
    eyebrow: "轻松益智",
    description: "翻开藏在小岛上的图案，用最少步数找出全部配对。",
    category: "益智",
    players: "6.9k",
    duration: "2–5 分钟",
    accent: "#16a47a",
    art: "memory",
    controls: "点击卡片进行翻牌配对",
  },
  {
    id: "beat-rush",
    title: "霓虹节拍",
    eyebrow: "节奏新作",
    description: "跟随 MIDI 脉冲，在音符抵达判定线的一刻奏响节拍。",
    category: "音乐",
    players: "NEW",
    duration: "1–3 分钟",
    accent: "#ff67b1",
    art: "beat",
    controls: "D / F / J / K 对应四条轨道，手机可触控",
  },
  {
    id: "hamster-roll", title: "仓鼠滚滚", eyebrow: "软萌竞速",
    description: "操控仓鼠球滚过花园赛道，收集葵花籽并避开木箱与水坑。", category: "反应", players: "NEW", duration: "2–5 分钟", accent: "#76b85d", art: "hamster",
    controls: "A D / 方向键换道，手机点击左右区域",
  },
  {
    id: "gold-miner", title: "黄金矿工", eyebrow: "经典抓取",
    description: "看准摇摆角度放下钩爪，在倒计时结束前抓取黄金和钻石。", category: "治愈", players: "NEW", duration: "1–3 分钟", accent: "#d79a2b", art: "miner",
    controls: "空格 / 点击放下钩爪，抓取目标后自动回收",
  },
  {
    id: "oil-tycoon", title: "石油大亨", eyebrow: "经营新作",
    description: "竞标土地、探测油藏、铺设管线，在油价最高时卖出原油成为城镇首富。", category: "经营", players: "NEW", duration: "2–4 分钟", accent: "#d69b3d", art: "oil",
    controls: "探矿员、鼹鼠和地面设施从顶部拖放；扫描仪点击拿起后到地下点击扩圈；管道“+”可拖出支管、单击开关阀门；点击市场或油罐指定货车目标",
  },
  {
    id: "minesweeper", title: "经典扫雷", eyebrow: "电脑经典",
    description: "从数字线索中判断地雷位置，挑战初级、中级和专家三种经典雷区。", category: "益智", players: "NEW", duration: "2–15 分钟", accent: "#3c806b", art: "minesweeper",
    controls: "左键翻格，右键插旗；触屏可开启旗帜模式；点击已翻开的数字快速展开，R 重新开始",
  },
  {
    id: "go", title: "围棋：对弈与死活", eyebrow: "黑白对弈 · 50关题库",
    description: "9 路或标准 19 路人机对弈，加上由简单到困难的 50 关死活棋挑战。", category: "益智", players: "NEW", duration: "2–40 分钟", accent: "#9b6335", art: "go",
    controls: "人机对战点击交叉点落子，可停一手、认输并按中国数子法结算；死活棋使用完整 19 路 SGF 标准局面，按变化图寻找急所，对手会自动应手，可查看提示、重置和选关",
  },
  {
    id: "guiyang-mahjong", title: "贵阳捉鸡麻将", eyebrow: "黔城牌局",
    description: "四人本地对局，做豆拿通行证，围绕幺鸡、乌骨鸡、冲锋鸡和翻牌鸡争夺四局积分。", category: "益智", players: "NEW", duration: "15–25 分钟", accent: "#d3b261", art: "mahjong",
    controls: "点击手牌后选择出牌；其他玩家出牌时选择碰、杠、胡或过；规则与暂停按钮位于牌桌右上角；支持触屏和全屏",
  },
  {
    id: "zuma", title: "太阳祖玛", eyebrow: "连锁消除",
    description: "瞄准推进中的彩球链，凑齐三颗同色彩球并制造连续消除，守住远古祭坛。", category: "反应", players: "NEW", duration: "3–10 分钟", accent: "#e4aa46", art: "zuma",
    controls: "鼠标移动或触摸瞄准，点击发射；空格或右键交换当前彩球与下一颗，P 暂停",
  },
  {
    id: "perfect-parking", title: "完美停车", eyebrow: "一脚入位",
    description: "按住油门前进、松开自动制动，在湿地、冰面与坡道上挑战越来越窄的停车位。", category: "反应", players: "NEW", duration: "2–4 分钟", accent: "#ef765f", art: "parking",
    controls: "按住鼠标、触摸或空格加速，松开自动制动，P 暂停",
  },
  {
    id: "moon-swing", title: "月亮荡秋千", eyebrow: "星空飞荡",
    description: "释放绳索并抓住下一颗星球，借惯性收集星尘，一路荡向遥远的月宫。", category: "治愈", players: "NEW", duration: "1–3 分钟", accent: "#8bcfea", art: "moon",
    controls: "点击或空格释放绳索，目标发光时再次点击抓住星球，P 暂停",
  },
];
