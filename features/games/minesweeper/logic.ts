import type { Difficulty, DifficultyId, MineCell, RevealResult } from "./types";

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  beginner: { id: "beginner", label: "初级", rows: 9, cols: 9, mines: 10, cellSize: 42, baseScore: 500, parSeconds: 180, timeBonus: 5 },
  intermediate: { id: "intermediate", label: "中级", rows: 16, cols: 16, mines: 40, cellSize: 22, baseScore: 2000, parSeconds: 600, timeBonus: 8 },
  expert: { id: "expert", label: "专家", rows: 16, cols: 30, mines: 99, cellSize: 22, baseScore: 5000, parSeconds: 1200, timeBonus: 10 },
};

export function emptyBoard(difficulty: Difficulty): MineCell[] {
  return Array.from({ length: difficulty.rows * difficulty.cols }, (_, id) => ({
    id,
    row: Math.floor(id / difficulty.cols),
    col: id % difficulty.cols,
    mine: false,
    adjacent: 0,
    state: "hidden" as const,
    exploded: false,
    wrongFlag: false,
  }));
}

function neighborIds(id: number, rows: number, cols: number) {
  const row = Math.floor(id / cols);
  const col = id % cols;
  const ids: number[] = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) continue;
      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;
      if (nextRow >= 0 && nextRow < rows && nextCol >= 0 && nextCol < cols) ids.push(nextRow * cols + nextCol);
    }
  }
  return ids;
}

export function seedBoard(difficulty: Difficulty, firstId: number, source?: MineCell[]): MineCell[] {
  const board = emptyBoard(difficulty);
  if (source) board.forEach((cell) => { cell.state = source[cell.id]?.state ?? "hidden"; });
  const safe = new Set([firstId, ...neighborIds(firstId, difficulty.rows, difficulty.cols)]);
  const candidates = board.map((cell) => cell.id).filter((id) => !safe.has(id));
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [candidates[index], candidates[target]] = [candidates[target], candidates[index]];
  }
  candidates.slice(0, difficulty.mines).forEach((id) => { board[id].mine = true; });
  board.forEach((cell) => {
    if (!cell.mine) cell.adjacent = neighborIds(cell.id, difficulty.rows, difficulty.cols).filter((id) => board[id].mine).length;
  });
  return board;
}

function finishLoss(board: MineCell[], explodedId: number) {
  return board.map((cell) => ({
    ...cell,
    state: cell.mine ? "revealed" as const : cell.state,
    exploded: cell.id === explodedId,
    wrongFlag: cell.state === "flagged" && !cell.mine,
  }));
}

export function revealCells(source: MineCell[], startIds: number[], difficulty: Difficulty): RevealResult {
  const board = source.map((cell) => ({ ...cell }));
  const queue = [...startIds];
  const visited = new Set<number>();
  while (queue.length) {
    const id = queue.shift();
    if (id === undefined || visited.has(id)) continue;
    visited.add(id);
    const cell = board[id];
    if (!cell || cell.state === "flagged" || cell.state === "revealed") continue;
    if (cell.mine) return { board: finishLoss(board, id), hitMine: true, won: false };
    cell.state = "revealed";
    if (cell.adjacent === 0) {
      neighborIds(id, difficulty.rows, difficulty.cols).forEach((neighborId) => {
        if (!visited.has(neighborId) && board[neighborId].state === "hidden") queue.push(neighborId);
      });
    }
  }
  const won = board.every((cell) => cell.mine || cell.state === "revealed");
  if (won) board.forEach((cell) => { if (cell.mine) cell.state = "flagged"; });
  return { board, hitMine: false, won };
}

export function chordCells(board: MineCell[], id: number, difficulty: Difficulty): RevealResult | null {
  const cell = board[id];
  if (!cell || cell.state !== "revealed" || cell.adjacent === 0) return null;
  const neighbors = neighborIds(id, difficulty.rows, difficulty.cols);
  const flagCount = neighbors.filter((neighborId) => board[neighborId].state === "flagged").length;
  if (flagCount !== cell.adjacent) return null;
  return revealCells(board, neighbors.filter((neighborId) => board[neighborId].state === "hidden"), difficulty);
}

export function toggleFlag(board: MineCell[], id: number, maxFlags: number) {
  const cell = board[id];
  if (!cell || cell.state === "revealed") return board;
  const flagCount = board.filter((candidate) => candidate.state === "flagged").length;
  if (cell.state === "hidden" && flagCount >= maxFlags) return board;
  return board.map((candidate) => candidate.id === id
    ? { ...candidate, state: candidate.state === "flagged" ? "hidden" as const : "flagged" as const }
    : candidate);
}

export function scoreFor(difficulty: Difficulty, seconds: number) {
  return difficulty.baseScore + Math.max(0, difficulty.parSeconds - seconds) * difficulty.timeBonus;
}
