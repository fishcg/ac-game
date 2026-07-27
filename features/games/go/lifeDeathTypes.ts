import type { BoardSize, Stone, PlayerStone } from "./types";

export type LifeDeathGoal = "kill" | "break-eye" | "live" | "solve";

export type LifeDeathLevel = {
  id: number;
  title: string;
  chapter: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  boardSize: BoardSize;
  board: Stone[];
  playerColor: PlayerStone;
  targetColor: PlayerStone;
  targetGroup: number[];
  goal: LifeDeathGoal;
  requiredLiberties: number;
  maxMoves: number;
  solution: number[];
  opponentResponses: Array<number | null>;
  hint: string;
  explanation: string;
  source: string;
  sourceUrl: string;
  license: string;
};

export type LifeDeathEvaluation = {
  status: "playing" | "won" | "lost";
  reason: string;
  targetPresent: boolean;
  liberties: number;
  eyes: number;
};
