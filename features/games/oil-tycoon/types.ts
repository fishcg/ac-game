export type PlotStatus = "hidden" | "surveyed" | "drilled" | "connected";

export type UndergroundDeposit = {
  id: string;
  kind: "oil" | "gas" | "magma";
  x: number;
  y: number;
  radius: number;
  shape: 0 | 1 | 2 | 3;
};

export type OilPlot = {
  id: number;
  name: string;
  x: number;
  y: number;
  bid: number;
  reserve: number;
  deposits: UndergroundDeposit[];
  rocks: Array<{ x: number; y: number; radius: number }>;
  geology: "平稳" | "坚硬" | "高压";
  hasGas: boolean;
  status: PlotStatus;
};

export type UpgradeKey = "dowser" | "mole" | "scanner" | "drill" | "rock" | "pipe" | "branch" | "silo" | "wagon" | "gas";

export type UpgradeState = Record<UpgradeKey, number>;
