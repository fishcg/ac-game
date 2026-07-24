import type { OilPlot, UpgradeKey, UpgradeState } from "./types";

export const ROUND_SECONDS = 600;
export const STARTING_CASH = 2600;
export const MARKET_BASE = 74;

export const PLOT_SEEDS: Omit<OilPlot, "status">[] = [
  { id: 0, name: "红杉坡", x: 17, y: 27, bid: 160, reserve: 74, deposits: [
    { id: "p0-oil-a", kind: "oil", x: 16, y: 75, radius: 10, shape: 0 }, { id: "p0-oil-b", kind: "oil", x: 47, y: 69, radius: 5, shape: 2 }, { id: "p0-oil-c", kind: "oil", x: 72, y: 82, radius: 3, shape: 1 },
    { id: "p0-gas-a", kind: "gas", x: 31, y: 61, radius: 4, shape: 3 }, { id: "p0-gas-b", kind: "gas", x: 84, y: 68, radius: 3, shape: 1 }, { id: "p0-magma", kind: "magma", x: 61, y: 88, radius: 3, shape: 2 },
  ], rocks: [{ x: 29, y: 57, radius: 7 }], geology: "平稳", hasGas: true },
  { id: 1, name: "黑岩谷", x: 39, y: 25, bid: 220, reserve: 108, deposits: [
    { id: "p1-oil-a", kind: "oil", x: 24, y: 72, radius: 12, shape: 1 }, { id: "p1-oil-b", kind: "oil", x: 66, y: 78, radius: 8, shape: 0 }, { id: "p1-oil-c", kind: "oil", x: 88, y: 61, radius: 4, shape: 3 },
    { id: "p1-gas-a", kind: "gas", x: 57, y: 56, radius: 5, shape: 2 }, { id: "p1-gas-b", kind: "gas", x: 82, y: 86, radius: 3, shape: 0 }, { id: "p1-magma", kind: "magma", x: 39, y: 87, radius: 4, shape: 1 },
  ], rocks: [{ x: 46, y: 57, radius: 8 }, { x: 66, y: 82, radius: 6 }], geology: "坚硬", hasGas: true },
  { id: 2, name: "风车丘", x: 63, y: 30, bid: 120, reserve: 84, deposits: [
    { id: "p2-oil-a", kind: "oil", x: 74, y: 77, radius: 8, shape: 0 }, { id: "p2-oil-b", kind: "oil", x: 29, y: 72, radius: 6, shape: 2 }, { id: "p2-oil-c", kind: "oil", x: 52, y: 88, radius: 3, shape: 3 },
    { id: "p2-gas-a", kind: "gas", x: 38, y: 61, radius: 4, shape: 1 }, { id: "p2-gas-b", kind: "gas", x: 88, y: 58, radius: 3, shape: 3 }, { id: "p2-magma", kind: "magma", x: 15, y: 82, radius: 3, shape: 2 },
  ], rocks: [{ x: 59, y: 60, radius: 5 }], geology: "平稳", hasGas: true },
  { id: 3, name: "老河床", x: 79, y: 54, bid: 190, reserve: 92, deposits: [
    { id: "p3-oil-a", kind: "oil", x: 84, y: 74, radius: 11, shape: 3 }, { id: "p3-oil-b", kind: "oil", x: 42, y: 80, radius: 7, shape: 1 }, { id: "p3-oil-c", kind: "oil", x: 17, y: 62, radius: 4, shape: 0 },
    { id: "p3-gas-a", kind: "gas", x: 61, y: 59, radius: 5, shape: 2 }, { id: "p3-gas-b", kind: "gas", x: 28, y: 90, radius: 3, shape: 3 }, { id: "p3-magma", kind: "magma", x: 69, y: 89, radius: 3, shape: 0 },
  ], rocks: [{ x: 73, y: 64, radius: 8 }], geology: "高压", hasGas: true },
  { id: 4, name: "铜矿沟", x: 48, y: 62, bid: 145, reserve: 68, deposits: [
    { id: "p4-oil-a", kind: "oil", x: 57, y: 79, radius: 9, shape: 2 }, { id: "p4-oil-b", kind: "oil", x: 21, y: 86, radius: 5, shape: 0 }, { id: "p4-oil-c", kind: "oil", x: 83, y: 67, radius: 4, shape: 1 },
    { id: "p4-gas-a", kind: "gas", x: 25, y: 64, radius: 4, shape: 3 }, { id: "p4-gas-b", kind: "gas", x: 73, y: 91, radius: 3, shape: 0 }, { id: "p4-magma", kind: "magma", x: 91, y: 84, radius: 3, shape: 2 },
  ], rocks: [{ x: 42, y: 71, radius: 7 }], geology: "坚硬", hasGas: true },
  { id: 5, name: "金盏地", x: 21, y: 70, bid: 260, reserve: 126, deposits: [
    { id: "p5-oil-a", kind: "oil", x: 35, y: 79, radius: 13, shape: 0 }, { id: "p5-oil-b", kind: "oil", x: 76, y: 76, radius: 10, shape: 3 }, { id: "p5-oil-c", kind: "oil", x: 58, y: 58, radius: 5, shape: 1 },
    { id: "p5-gas-a", kind: "gas", x: 73, y: 60, radius: 5, shape: 2 }, { id: "p5-gas-b", kind: "gas", x: 17, y: 91, radius: 4, shape: 1 }, { id: "p5-magma", kind: "magma", x: 55, y: 91, radius: 4, shape: 3 },
  ], rocks: [{ x: 48, y: 59, radius: 8 }, { x: 75, y: 76, radius: 5 }], geology: "高压", hasGas: true },
];

export const UPGRADE_INFO: Record<UpgradeKey, { name: string; icon: string; description: string; baseCost: number }> = {
  dowser: { name: "探矿员训练", icon: "♧", description: "探矿员更快、更准确地定位油层", baseCost: 120 },
  mole: { name: "鼹鼠巢穴", icon: "◉", description: "鼹鼠深入地下，发现油气与钻石线索", baseCost: 170 },
  scanner: { name: "地质扫描仪", icon: "⌁", description: "显示油层边界，规划管线更精准", baseCost: 250 },
  drill: { name: "井架马达", icon: "✦", description: "降低井架建造费用，提升钻探效率", baseCost: 210 },
  rock: { name: "岩层钻头", icon: "◆", description: "穿透坚硬岩层，不再被石块拖慢", baseCost: 230 },
  pipe: { name: "加压管线", icon: "╱", description: "加粗主管道，提升原油流速", baseCost: 230 },
  branch: { name: "分支阀门", icon: "Y", description: "允许多条支管并行抽油", baseCost: 220 },
  silo: { name: "加固油罐", icon: "▥", description: "增加储油容量，低价时囤油", baseCost: 190 },
  wagon: { name: "运油货车", icon: "▰", description: "增加货仓载重与往返速度，快速运油", baseCost: 160 },
  gas: { name: "天然气阀门", icon: "♨", description: "让天然气把目标油价抬得更高", baseCost: 200 },
};

export const INITIAL_UPGRADES: UpgradeState = { dowser: 0, mole: 0, scanner: 0, drill: 0, rock: 0, pipe: 0, branch: 0, silo: 0, wagon: 0, gas: 0 };

const jitter = (value: number, amount: number, min: number, max: number) => Math.max(min, Math.min(max, value + (Math.random() - .5) * amount));

export const createPlots = (): OilPlot[] => PLOT_SEEDS.map((plot) => ({
  ...plot,
  deposits: plot.deposits.map((deposit) => ({
    ...deposit,
    x: jitter(deposit.x, 15, 7, 93),
    y: jitter(deposit.y, 12, 49, 92),
    radius: Math.round(jitter(deposit.radius, Math.max(2, deposit.radius * .7), 2.5, 14) * 10) / 10,
    shape: Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3,
  })),
  rocks: plot.rocks.map((rock) => ({ ...rock, x: jitter(rock.x, 10, 10, 90), y: jitter(rock.y, 8, 48, 90) })),
  status: "hidden",
}));

export const upgradeCost = (key: UpgradeKey, level: number) => UPGRADE_INFO[key].baseCost + level * 95;

export const plotCost = (plot: OilPlot, upgrades: UpgradeState) => ({
  dowser: Math.max(35, 100 - upgrades.dowser * 15),
  mole: Math.max(45, 100 - upgrades.mole * 15),
  scanner: Math.max(55, 100 - upgrades.scanner * 15),
  drill: Math.max(180, (plot.geology === "坚硬" ? 425 : 350) - upgrades.drill * 30 - upgrades.rock * 20),
  pipe: Math.max(35, 82 - upgrades.pipe * 15 - upgrades.branch * 8),
});

export const siloCapacity = (upgrades: UpgradeState) => 28 + upgrades.silo * 14;
export const truckCapacity = (upgrades: UpgradeState) => 3 + upgrades.wagon * 1.4;
export const pumpRate = (plot: OilPlot, upgrades: UpgradeState) =>
  (plot.geology === "高压" ? .068 : .052) +
  upgrades.pipe * .015 +
  upgrades.branch * .012;
