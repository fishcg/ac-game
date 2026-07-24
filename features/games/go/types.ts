export type Stone = 0 | 1 | 2;
export type PlayerStone = 1 | 2;
export type BoardSize = 9 | 19;

export type MoveResult = {
  legal: boolean;
  board: Stone[];
  captured: number;
  reason?: "occupied" | "suicide" | "ko";
};

export type AreaScore = {
  black: number;
  white: number;
  blackTerritory: number;
  whiteTerritory: number;
  neutral: number;
  komi: number;
};

export type MatchResult = AreaScore & {
  winner: PlayerStone;
  reason: "score" | "resign";
};

export type Captures = { black: number; white: number };
