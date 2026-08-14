import type { DecreeId, EnemyConfig, Point, TowerConfig, TowerType, WaveConfig } from "./types";

export const WORLD_WIDTH = 540;
export const WORLD_HEIGHT = 900;
export const MAX_CASTLE_HP = 20;
export const INITIAL_FOOD = 520;
export const INITIAL_MORALE = 35;

export const ROAD_PATH: Point[] = [
  { x: -24, y: 112 }, { x: 78, y: 136 }, { x: 132, y: 190 }, { x: 170, y: 264 },
  { x: 184, y: 340 }, { x: 235, y: 405 }, { x: 246, y: 490 }, { x: 282, y: 570 },
  { x: 324, y: 648 }, { x: 366, y: 724 }, { x: 440, y: 792 }, { x: 552, y: 835 },
];

export const TOWER_SLOTS: Array<Point & { id: number }> = [
  { id: 1, x: 320, y: 225 }, { id: 2, x: 307, y: 292 }, { id: 3, x: 191, y: 339 },
  { id: 4, x: 307, y: 382 }, { id: 5, x: 220, y: 451 }, { id: 6, x: 357, y: 520 },
];

export const HERO_POSTS: Array<Point & { id: number }> = [
  { id: 1, x: 142, y: 246 }, { id: 2, x: 272, y: 462 }, { id: 3, x: 344, y: 673 },
];

export const TOWERS: Record<TowerType, TowerConfig> = {
  archer: {
    id: "archer", name: "弓哨", description: "远射轻甲，升级后可选连弩或火矢", cost: 160, range: 132, damage: 16, cooldown: .72, color: "#e8c669",
    branches: [
      { id: "rapid", name: "连弩营", description: "攻速大幅提升，连续射出两箭" },
      { id: "fire", name: "火箭营", description: "箭矢点燃目标并克制攻城单位" },
    ],
  },
  spear: {
    id: "spear", name: "枪兵营", description: "阻挡地面部队，专门克制骑兵", cost: 190, range: 78, damage: 22, cooldown: .9, color: "#78b68b",
    branches: [
      { id: "guard", name: "羽林卫", description: "更高伤害，并为城门恢复耐久" },
      { id: "phalanx", name: "长枪阵", description: "扩大阻挡范围并显著减速骑兵" },
    ],
  },
  catapult: {
    id: "catapult", name: "投石台", description: "范围轰击，克制盾兵与攻城单位", cost: 240, range: 150, damage: 38, cooldown: 1.8, color: "#c68756",
    branches: [
      { id: "thunder", name: "霹雳车", description: "爆炸范围扩大并破除盾甲" },
      { id: "boulder", name: "巨石炮", description: "伤害翻倍，但攻击速度降低" },
    ],
  },
};

export const ENEMIES: Record<EnemyConfig["id"], EnemyConfig> = {
  infantry: { id: "infantry", name: "黄巾步兵", hp: 72, speed: 31, reward: 22, castleDamage: 1, color: "#d5a84c" },
  shield: { id: "shield", name: "黄巾盾兵", hp: 152, speed: 22, reward: 38, castleDamage: 2, color: "#8b7351" },
  cavalry: { id: "cavalry", name: "轻骑突袭", hp: 124, speed: 48, reward: 45, castleDamage: 2, color: "#b85b45" },
  siege: { id: "siege", name: "黄巾冲车", hp: 390, speed: 14, reward: 82, castleDamage: 4, color: "#604a3b" },
  boss: { id: "boss", name: "人公将军 · 张梁", hp: 2600, speed: 14, reward: 800, castleDamage: 10, color: "#a73838" },
};

export const WAVES: WaveConfig[] = [
  { name: "流民裹巾", entries: [{ type: "infantry", count: 12, interval: 1.05 }] },
  { name: "盾阵压境", entries: [{ type: "infantry", count: 8, interval: .85 }, { type: "shield", count: 5, interval: 1.45, delay: 3 }] },
  { name: "轻骑绕村", entries: [{ type: "cavalry", count: 8, interval: 1.15 }, { type: "infantry", count: 12, interval: .72, delay: 2 }] },
  { name: "冲车破门", entries: [{ type: "shield", count: 8, interval: 1.15 }, { type: "siege", count: 3, interval: 3.2, delay: 3 }] },
  { name: "黄巾夜潮", entries: [{ type: "infantry", count: 22, interval: .5 }, { type: "cavalry", count: 10, interval: .88, delay: 2 }, { type: "shield", count: 8, interval: 1.1, delay: 5 }] },
  { name: "张梁亲征", entries: [{ type: "infantry", count: 16, interval: .65 }, { type: "shield", count: 8, interval: 1.05, delay: 3 }, { type: "siege", count: 2, interval: 3.4, delay: 7 }, { type: "boss", count: 1, interval: 1, delay: 12 }] },
];

export const DECREES: Record<DecreeId, { name: string; icon: string; description: string }> = {
  strongBow: { name: "强弓劲弩", icon: "弓", description: "所有弓哨伤害 +35%，箭矢射程 +10%" },
  spearWall: { name: "拒马枪林", icon: "枪", description: "枪兵伤害 +35%，对骑兵减速更强" },
  thunderStone: { name: "霹雳飞石", icon: "石", description: "投石爆炸范围 +40%，对盾兵伤害提升" },
  militia: { name: "乡勇来援", icon: "援", description: "关羽攻击速度 +30%，大招充能加快" },
  repair: { name: "抢修城门", icon: "城", description: "立即恢复 6 点城门耐久，之后每波恢复 1 点" },
  inspire: { name: "擂鼓鼓舞", icon: "鼓", description: "全军伤害 +15%，士气获取 +30%" },
};

export const TOWER_UPGRADE_COST: Record<1 | 2, number> = { 1: 170, 2: 260 };
