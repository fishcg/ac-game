import { groupAt, playMove } from "./goRules";
import type { BoardSize, PlayerStone, Stone } from "./types";
import type { LifeDeathLevel, LifeDeathEvaluation } from "./lifeDeathTypes";

const DEFAULT_SIZE: BoardSize = 9;

export function targetGroupState(board: Stone[], level: LifeDeathLevel) {
  const size = level.boardSize;
  const seed = level.targetGroup.find((index) => board[index] === level.targetColor);
  if (seed === undefined) return { present: false, stones: new Set<number>(), liberties: new Set<number>(), eyes: 0 };
  const group = groupAt(board, seed, size);
  const targetStones = new Set(level.targetGroup.filter((index) => board[index] === level.targetColor));
  const sameGroup = [...targetStones].some((index) => group.stones.has(index));
  if (!sameGroup) return { present: false, stones: new Set<number>(), liberties: new Set<number>(), eyes: 0 };
  return { present: true, stones: group.stones, liberties: group.liberties, eyes: countEyes(board, group.stones, size) };
}

export function countEyes(board: Stone[], stones: Set<number>, size: BoardSize = DEFAULT_SIZE) {
  const visited = new Set<number>();
  let eyes = 0;
  board.forEach((stone, start) => {
    if (stone !== 0 || visited.has(start)) return;
    const region = new Set<number>();
    const borders = new Set<number>();
    const queue = [start];
    while (queue.length) {
      const index = queue.pop();
      if (index === undefined || visited.has(index) || board[index] !== 0) continue;
      visited.add(index);
      region.add(index);
      const row = Math.floor(index / size);
      const col = index % size;
      const neighbors: number[] = [];
      if (row > 0) neighbors.push(index - size);
      if (row < size - 1) neighbors.push(index + size);
      if (col > 0) neighbors.push(index - 1);
      if (col < size - 1) neighbors.push(index + 1);
      neighbors.forEach((neighbor) => {
        if (board[neighbor] === 0 && !visited.has(neighbor)) queue.push(neighbor);
        else if (board[neighbor] !== 0) borders.add(neighbor);
      });
    }
    if (region.size > 0 && borders.size > 0 && [...borders].every((index) => stones.has(index))) eyes += 1;
  });
  return eyes;
}

export function evaluateLifeDeath(level: LifeDeathLevel, board: Stone[], moves: number, solutionProgress = 0): LifeDeathEvaluation {
  const state = targetGroupState(board, level);
  if (level.goal === "solve") {
    if (solutionProgress >= level.solution.length) {
      return { status: "won", reason: "已完成题库标准变化", targetPresent: state.present, liberties: state.liberties.size, eyes: state.eyes };
    }
    if (moves >= level.maxMoves) {
      return { status: "lost", reason: "主变化未完成，步数已用尽", targetPresent: state.present, liberties: state.liberties.size, eyes: state.eyes };
    }
    return { status: "playing", reason: "继续寻找标准变化", targetPresent: state.present, liberties: state.liberties.size, eyes: state.eyes };
  }
  if (level.goal === "kill" || level.goal === "break-eye") {
    if (!state.present) return { status: "won", reason: "目标棋块已被提净", targetPresent: false, liberties: 0, eyes: 0 };
    if (moves >= level.maxMoves) return { status: "lost", reason: "步数用尽，目标棋块仍未气尽", targetPresent: true, liberties: state.liberties.size, eyes: state.eyes };
  } else {
    if (state.present && moves > 0 && state.liberties.size >= level.requiredLiberties) {
      return { status: "won", reason: `目标棋块已做出 ${state.liberties.size} 气`, targetPresent: true, liberties: state.liberties.size, eyes: state.eyes };
    }
    if (moves >= level.maxMoves) return { status: "lost", reason: "步数用尽，目标棋块没有活出足够的气", targetPresent: state.present, liberties: state.liberties.size, eyes: state.eyes };
  }
  return { status: "playing", reason: "继续寻找关键手", targetPresent: state.present, liberties: state.liberties.size, eyes: state.eyes };
}

export function applyLifeDeathMove(board: Stone[], index: number, color: PlayerStone, history: string[]) {
  const size = Math.sqrt(board.length) as BoardSize;
  return playMove(board, index, color, size, history);
}

export function formatPoint(index: number, size: BoardSize = DEFAULT_SIZE) {
  const letters = "ABCDEFGHJKLMNOPQRST";
  const row = Math.floor(index / size);
  const col = index % size;
  return `${letters[col] ?? "?"}${size - row}`;
}
