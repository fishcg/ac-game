import { boardHash, groupAt, neighbors, playMove } from "./goRules";
import type { BoardSize, PlayerStone, Stone } from "./types";

function nearbyCandidates(board: Stone[], size: BoardSize) {
  const occupied = board.reduce<number[]>((result, stone, index) => {
    if (stone !== 0) result.push(index);
    return result;
  }, []);
  if (occupied.length === 0) {
    const center = Math.floor(size / 2);
    return [center * size + center];
  }
  const candidates = new Set<number>();
  occupied.forEach((index) => {
    const row = Math.floor(index / size);
    const col = index % size;
    for (let rowOffset = -2; rowOffset <= 2; rowOffset += 1) {
      for (let colOffset = -2; colOffset <= 2; colOffset += 1) {
        const nextRow = row + rowOffset;
        const nextCol = col + colOffset;
        if (nextRow >= 0 && nextRow < size && nextCol >= 0 && nextCol < size) {
          const candidate = nextRow * size + nextCol;
          if (board[candidate] === 0) candidates.add(candidate);
        }
      }
    }
  });
  if (candidates.size < Math.min(18, size * 2)) board.forEach((stone, index) => { if (stone === 0) candidates.add(index); });
  return [...candidates];
}

export function chooseAiMove(board: Stone[], color: PlayerStone, size: BoardSize, hashes: string[], moveNumber: number) {
  const opponent = color === 1 ? 2 : 1;
  const center = (size - 1) / 2;
  let bestIndex: number | null = null;
  let bestScore = -Infinity;
  for (const index of nearbyCandidates(board, size)) {
    const result = playMove(board, index, color, size, hashes);
    if (!result.legal) continue;
    const row = Math.floor(index / size);
    const col = index % size;
    const distance = Math.hypot(row - center, col - center);
    const ownGroup = groupAt(result.board, index, size);
    let score = result.captured * 90 + ownGroup.liberties.size * 2.4 - distance * (moveNumber < size ? 1.15 : .2);
    const adjacent = neighbors(index, size);
    score += adjacent.filter((neighbor) => board[neighbor] === color).length * 4;
    score += adjacent.filter((neighbor) => board[neighbor] === opponent).length * 5;
    if (ownGroup.liberties.size === 1) score -= 42;
    const seenOpponent = new Set<number>();
    adjacent.forEach((neighbor) => {
      if (result.board[neighbor] !== opponent || seenOpponent.has(neighbor)) return;
      const group = groupAt(result.board, neighbor, size);
      group.stones.forEach((stone) => seenOpponent.add(stone));
      if (group.liberties.size === 1) score += 16 + group.stones.size * 5;
      if (group.liberties.size === 2) score += group.stones.size * 1.5;
    });
    const edgeDistance = Math.min(row, col, size - 1 - row, size - 1 - col);
    if (moveNumber < size * 1.6 && edgeDistance === 0) score -= 12;
    score += Math.random() * 7;
    if (score > bestScore) { bestScore = score; bestIndex = index; }
  }
  return bestIndex;
}

export function nextHash(board: Stone[]) {
  return boardHash(board);
}
