import type { AreaScore, BoardSize, MoveResult, PlayerStone, Stone } from "./types";

export const otherColor = (color: PlayerStone): PlayerStone => color === 1 ? 2 : 1;

export function boardHash(board: Stone[]) {
  return board.join("");
}

export function neighbors(index: number, size: BoardSize) {
  const row = Math.floor(index / size);
  const col = index % size;
  const result: number[] = [];
  if (row > 0) result.push(index - size);
  if (row < size - 1) result.push(index + size);
  if (col > 0) result.push(index - 1);
  if (col < size - 1) result.push(index + 1);
  return result;
}

export function groupAt(board: Stone[], start: number, size: BoardSize) {
  const color = board[start];
  const stones = new Set<number>();
  const liberties = new Set<number>();
  if (color === 0) return { stones, liberties };
  const queue = [start];
  while (queue.length) {
    const index = queue.pop();
    if (index === undefined || stones.has(index)) continue;
    stones.add(index);
    neighbors(index, size).forEach((neighbor) => {
      if (board[neighbor] === 0) liberties.add(neighbor);
      else if (board[neighbor] === color && !stones.has(neighbor)) queue.push(neighbor);
    });
  }
  return { stones, liberties };
}

export function playMove(source: Stone[], index: number, color: PlayerStone, size: BoardSize, previousHashes: string[]): MoveResult {
  if (source[index] !== 0) return { legal: false, board: source, captured: 0, reason: "occupied" };
  const board = [...source];
  board[index] = color;
  const opponent = otherColor(color);
  let captured = 0;
  const checked = new Set<number>();
  neighbors(index, size).forEach((neighbor) => {
    if (board[neighbor] !== opponent || checked.has(neighbor)) return;
    const group = groupAt(board, neighbor, size);
    group.stones.forEach((stone) => checked.add(stone));
    if (group.liberties.size === 0) {
      captured += group.stones.size;
      group.stones.forEach((stone) => { board[stone] = 0; });
    }
  });
  if (groupAt(board, index, size).liberties.size === 0) return { legal: false, board: source, captured: 0, reason: "suicide" };
  if (previousHashes.includes(boardHash(board))) return { legal: false, board: source, captured: 0, reason: "ko" };
  return { legal: true, board, captured };
}

export function scoreBoard(board: Stone[], size: BoardSize): AreaScore {
  let black = board.filter((stone) => stone === 1).length;
  let white = board.filter((stone) => stone === 2).length;
  let blackTerritory = 0;
  let whiteTerritory = 0;
  let neutral = 0;
  const visited = new Set<number>();
  board.forEach((stone, start) => {
    if (stone !== 0 || visited.has(start)) return;
    const area = new Set<number>();
    const borders = new Set<PlayerStone>();
    const queue = [start];
    while (queue.length) {
      const index = queue.pop();
      if (index === undefined || visited.has(index) || board[index] !== 0) continue;
      visited.add(index);
      area.add(index);
      neighbors(index, size).forEach((neighbor) => {
        if (board[neighbor] === 0 && !visited.has(neighbor)) queue.push(neighbor);
        else if (board[neighbor] !== 0) borders.add(board[neighbor] as PlayerStone);
      });
    }
    if (borders.size === 1 && borders.has(1)) blackTerritory += area.size;
    else if (borders.size === 1 && borders.has(2)) whiteTerritory += area.size;
    else neutral += area.size;
  });
  const komi = size === 9 ? 5.5 : 7.5;
  black += blackTerritory;
  white += whiteTerritory + komi;
  return { black, white, blackTerritory, whiteTerritory, neutral, komi };
}

export function starPoints(size: BoardSize) {
  if (size === 9) return new Set([2 * size + 2, 2 * size + 6, 4 * size + 4, 6 * size + 2, 6 * size + 6]);
  const lines = [3, 9, 15];
  return new Set(lines.flatMap((row) => lines.map((col) => row * size + col)));
}
