export type CellState = "hidden" | "revealed" | "flagged";

export type MineCell = {
  id: number;
  row: number;
  col: number;
  mine: boolean;
  adjacent: number;
  state: CellState;
  exploded: boolean;
  wrongFlag: boolean;
};

export type DifficultyId = "beginner" | "intermediate" | "expert";

export type Difficulty = {
  id: DifficultyId;
  label: string;
  rows: number;
  cols: number;
  mines: number;
  cellSize: number;
  baseScore: number;
  parSeconds: number;
  timeBonus: number;
};

export type RevealResult = {
  board: MineCell[];
  hitMine: boolean;
  won: boolean;
};
