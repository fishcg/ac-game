// @ts-expect-error Node 的内置 TypeScript 测试运行器需要显式扩展名。
import { boardHash, groupAt, neighbors, otherColor, playMove, scoreBoard } from "./goRules.ts";
import type { BoardSize, PlayerStone, Stone } from "./types";

export type AiSearchOptions = {
  maxTimeMs?: number;
  maxSimulations?: number;
  seed?: number;
};

type Candidate = {
  index: number | null;
  prior: number;
  board: Stone[];
  captured: number;
};

type SearchNode = {
  board: Stone[];
  toPlay: PlayerStone;
  hashes: string[];
  moveNumber: number;
  passes: number;
  move: number | null;
  prior: number;
  visits: number;
  valueSum: number;
  children: SearchNode[];
  unexpanded: Candidate[] | null;
};

const now = () => globalThis.performance?.now() ?? Date.now();
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function createRandom(seed: number) {
  let value = seed >>> 0 || 0x9e3779b9;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 0x1_0000_0000;
  };
}

function collectGroups(board: Stone[], size: BoardSize, color?: PlayerStone) {
  const seen = new Set<number>();
  const groups: ReturnType<typeof groupAt>[] = [];
  board.forEach((stone, index) => {
    if (stone === 0 || (color && stone !== color) || seen.has(index)) return;
    const group = groupAt(board, index, size);
    group.stones.forEach((item) => seen.add(item));
    groups.push(group);
  });
  return groups;
}

function isLikelyOwnEye(board: Stone[], index: number, color: PlayerStone, size: BoardSize) {
  const adjacent = neighbors(index, size);
  if (!adjacent.length || adjacent.some((item) => board[item] !== color)) return false;
  const row = Math.floor(index / size);
  const col = index % size;
  let friendlyCorners = 0;
  let existingCorners = 0;
  for (const rowOffset of [-1, 1]) {
    for (const colOffset of [-1, 1]) {
      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;
      if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size) continue;
      existingCorners += 1;
      if (board[nextRow * size + nextCol] === color) friendlyCorners += 1;
    }
  }
  return friendlyCorners >= Math.max(1, existingCorners - 1);
}

type LifeProfile = {
  eyes: number;
  eyeSpace: number;
  liberties: number;
  alive: boolean;
};

function lifeProfile(board: Stone[], group: ReturnType<typeof groupAt>, color: PlayerStone, size: BoardSize): LifeProfile {
  const checked = new Set<number>();
  const maximumEyeSpace = size === 9 ? 9 : 14;
  if (group.liberties.size > maximumEyeSpace * 2) {
    return { eyes: 0, eyeSpace: 0, liberties: group.liberties.size, alive: false };
  }
  let eyes = 0;
  let eyeSpace = 0;

  for (const liberty of group.liberties) {
    if (checked.has(liberty)) continue;
    const region = new Set<number>();
    const borderColors = new Set<PlayerStone>();
    const borderStones = new Set<number>();
    const queue = [liberty];
    let overflow = false;

    while (queue.length) {
      const point = queue.pop();
      if (point === undefined || region.has(point) || board[point] !== 0) continue;
      region.add(point);
      checked.add(point);
      if (region.size > maximumEyeSpace) { overflow = true; break; }
      for (const neighbor of neighbors(point, size)) {
        const stone = board[neighbor];
        if (stone === 0 && !region.has(neighbor)) queue.push(neighbor);
        else if (stone !== 0) {
          borderColors.add(stone as PlayerStone);
          borderStones.add(neighbor);
        }
      }
    }

    if (overflow || borderColors.size !== 1 || !borderColors.has(color)) continue;
    const touchesGroup = [...borderStones].some((stone) => group.stones.has(stone));
    if (!touchesGroup || borderStones.size < 2) continue;
    if (region.size === 1 && !isLikelyOwnEye(board, liberty, color, size)) continue;
    eyes += 1;
    eyeSpace += region.size;
  }

  return { eyes, eyeSpace, liberties: group.liberties.size, alive: eyes >= 2 };
}

function candidateIndexes(board: Stone[], size: BoardSize, moveNumber: number) {
  const occupied: number[] = [];
  const tactical = new Set<number>();
  const nearby = new Set<number>();

  board.forEach((stone, index) => {
    if (stone === 0) return;
    occupied.push(index);
    const group = groupAt(board, index, size);
    if (group.liberties.size <= 2) group.liberties.forEach((liberty) => tactical.add(liberty));
    const row = Math.floor(index / size);
    const col = index % size;
    for (let rowOffset = -2; rowOffset <= 2; rowOffset += 1) {
      for (let colOffset = -2; colOffset <= 2; colOffset += 1) {
        if (Math.abs(rowOffset) + Math.abs(colOffset) > 3) continue;
        const nextRow = row + rowOffset;
        const nextCol = col + colOffset;
        if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size) continue;
        const candidate = nextRow * size + nextCol;
        if (board[candidate] === 0) nearby.add(candidate);
      }
    }
  });

  if (occupied.length === 0) {
    if (size === 9) return [4 * size + 4, 2 * size + 2, 2 * size + 6, 6 * size + 2, 6 * size + 6];
    return [3 * size + 15, 15 * size + 3, 3 * size + 3, 15 * size + 15, 9 * size + 9];
  }

  const openingPoints = size === 9
    ? [4 * size + 4, 2 * size + 2, 2 * size + 6, 6 * size + 2, 6 * size + 6]
    : [3 * size + 3, 3 * size + 15, 15 * size + 3, 15 * size + 15, 9 * size + 9, 3 * size + 9, 9 * size + 3, 9 * size + 15, 15 * size + 9];
  if (moveNumber < size * 1.7) openingPoints.forEach((index) => { if (board[index] === 0) nearby.add(index); });

  if (nearby.size < Math.min(22, size * 3)) board.forEach((stone, index) => { if (stone === 0) nearby.add(index); });
  return [...tactical, ...[...nearby].filter((index) => !tactical.has(index))];
}

function movePrior(board: Stone[], result: Stone[], index: number, color: PlayerStone, size: BoardSize, captured: number, moveNumber: number) {
  const opponent = otherColor(color);
  const row = Math.floor(index / size);
  const col = index % size;
  const edgeDistance = Math.min(row, col, size - 1 - row, size - 1 - col);
  const adjacent = neighbors(index, size);
  const ownGroup = groupAt(result, index, size);
  let score = 5 + captured * 34;

  const adjacentOwnGroups = new Map<number, ReturnType<typeof groupAt>>();
  const adjacentEnemyGroups = new Map<number, ReturnType<typeof groupAt>>();
  for (const neighbor of adjacent) {
    const stone = board[neighbor];
    if (stone === 0) { score += 1.5; continue; }
    const group = groupAt(board, neighbor, size);
    const key = Math.min(...group.stones);
    if (stone === color) adjacentOwnGroups.set(key, group);
    else adjacentEnemyGroups.set(key, group);
  }

  for (const group of adjacentOwnGroups.values()) {
    if (group.liberties.size === 1 && group.liberties.has(index)) score += 22 + group.stones.size * 9;
    else if (group.liberties.size === 2 && group.liberties.has(index)) score += 4 + group.stones.size * 1.8;
  }
  for (const group of adjacentEnemyGroups.values()) {
    if (group.liberties.size === 1 && group.liberties.has(index)) score += 18 + group.stones.size * 7;
    else if (group.liberties.size === 2 && group.liberties.has(index)) score += 5 + group.stones.size * 2.4;
  }

  const beforeProfiles = [...adjacentOwnGroups.values()].map((group) => lifeProfile(board, group, color, size));
  const afterProfile = lifeProfile(result, ownGroup, color, size);
  const previousEyes = beforeProfiles.reduce((best, profile) => Math.max(best, profile.eyes), 0);
  const previousEyeSpace = beforeProfiles.reduce((best, profile) => Math.max(best, profile.eyeSpace), 0);
  const previousLiberties = beforeProfiles.reduce((best, profile) => Math.max(best, profile.liberties), 0);
  const previouslyAlive = beforeProfiles.some((profile) => profile.alive);

  if (!previouslyAlive && afterProfile.alive) score += 150 + ownGroup.stones.size * 2;
  if (previouslyAlive && !afterProfile.alive) score -= 240 + ownGroup.stones.size * 4;
  score += (afterProfile.eyes - previousEyes) * 42;
  if (afterProfile.eyeSpace < previousEyeSpace && afterProfile.eyes <= previousEyes) {
    score -= (previousEyeSpace - afterProfile.eyeSpace) * 18;
  }

  score += Math.min(5, ownGroup.liberties.size) * 2.8;
  if (ownGroup.liberties.size === 1 && captured === 0) score -= 180 + ownGroup.stones.size * 10;
  if (ownGroup.liberties.size === 2) score -= 5;
  if (captured === 0 && previousLiberties > 0 && ownGroup.liberties.size < previousLiberties) {
    score -= (previousLiberties - ownGroup.liberties.size) * (20 + Math.sqrt(ownGroup.stones.size) * 4);
  } else if (ownGroup.liberties.size > previousLiberties) {
    score += Math.min(4, ownGroup.liberties.size - previousLiberties) * 7;
  }
  if (adjacentOwnGroups.size >= 2) score += adjacentOwnGroups.size * 5;
  if (isLikelyOwnEye(board, index, color, size) && captured === 0) score -= 260;

  const resultingEnemySeen = new Set<number>();
  for (const neighbor of adjacent) {
    if (result[neighbor] !== opponent || resultingEnemySeen.has(neighbor)) continue;
    const group = groupAt(result, neighbor, size);
    group.stones.forEach((stone) => resultingEnemySeen.add(stone));
    if (group.liberties.size === 1) score += 12 + group.stones.size * 5;
  }

  if (moveNumber < size * 1.6) {
    if (size === 19) {
      const nearestStar = Math.min(...[3, 9, 15].flatMap((starRow) => [3, 9, 15].map((starCol) => Math.hypot(row - starRow, col - starCol))));
      score += Math.max(0, 5 - nearestStar) * 2.2;
      if (edgeDistance <= 1) score -= 18;
    } else {
      score += Math.max(0, 4 - Math.hypot(row - 4, col - 4)) * 1.5;
      if (edgeDistance === 0) score -= 12;
    }
  } else if (edgeDistance === 0) score -= 2;

  return score;
}

function immediateDanger(board: Stone[], color: PlayerStone, size: BoardSize) {
  let danger = 0;
  for (const group of collectGroups(board, size, color)) {
    if (group.liberties.size === 1) danger += group.stones.size * 7 + 5;
    else if (group.liberties.size === 2) danger += Math.sqrt(group.stones.size) * 1.4;
  }
  return danger;
}

function generateCandidates(board: Stone[], color: PlayerStone, size: BoardSize, hashes: string[], moveNumber: number, limit: number, includePass: boolean) {
  const candidates: Candidate[] = [];
  for (const index of candidateIndexes(board, size, moveNumber)) {
    const move = playMove(board, index, color, size, hashes);
    if (!move.legal) continue;
    if (move.captured === 0 && isLikelyOwnEye(board, index, color, size)) continue;
    let prior = movePrior(board, move.board, index, color, size, move.captured, moveNumber);
    const ownDanger = immediateDanger(move.board, color, size);
    prior -= ownDanger * .85;
    candidates.push({ index, prior, board: move.board, captured: move.captured });
  }
  candidates.sort((a, b) => b.prior - a.prior);
  const selected = candidates.slice(0, limit);
  if (includePass || selected.length === 0) selected.push({ index: null, prior: selected.length ? -4 : 1, board, captured: 0 });
  return selected;
}

function evaluateBoard(board: Stone[], rootColor: PlayerStone, size: BoardSize) {
  const opponent = otherColor(rootColor);
  let rootStones = 0;
  let opponentStones = 0;
  let influence = 0;
  board.forEach((stone, index) => {
    if (stone === rootColor) rootStones += 1;
    else if (stone === opponent) opponentStones += 1;
    if (stone !== 0) return;
    const row = Math.floor(index / size);
    const col = index % size;
    let local = 0;
    for (let rowOffset = -2; rowOffset <= 2; rowOffset += 1) {
      for (let colOffset = -2; colOffset <= 2; colOffset += 1) {
        const distance = Math.abs(rowOffset) + Math.abs(colOffset);
        if (distance === 0 || distance > 2) continue;
        const nextRow = row + rowOffset;
        const nextCol = col + colOffset;
        if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size) continue;
        const nearby = board[nextRow * size + nextCol];
        if (nearby === rootColor) local += distance === 1 ? 1 : .35;
        else if (nearby === opponent) local -= distance === 1 ? 1 : .35;
      }
    }
    influence += clamp(local, -1.4, 1.4);
  });

  const groupValue = (color: PlayerStone) => collectGroups(board, size, color).reduce((sum, group) => {
    const liberties = group.liberties.size;
    const profile = lifeProfile(board, group, color, size);
    const safety = Math.min(5, liberties) * Math.sqrt(group.stones.size);
    const atariPenalty = liberties === 1 ? group.stones.size * 7 : liberties === 2 ? group.stones.size * 1.2 : 0;
    const lifeValue = profile.alive
      ? 34 + group.stones.size * 1.6 + profile.eyeSpace * 2
      : profile.eyes * 11 + profile.eyeSpace * 1.4;
    return sum + safety + lifeValue - atariPenalty;
  }, 0);
  const occupiedRatio = (rootStones + opponentStones) / board.length;
  const komi = rootColor === 2 ? (size === 9 ? 5.5 : 7.5) : -(size === 9 ? 5.5 : 7.5);
  const score = scoreBoard(board, size);
  const areaDifference = rootColor === 1 ? score.black - score.white : score.white - score.black;
  const areaValue = occupiedRatio >= .34 && rootStones > 0 && opponentStones > 0 ? areaDifference * .65 : komi;
  const raw = (rootStones - opponentStones) * 1.15 + influence * .85 + (groupValue(rootColor) - groupValue(opponent)) * 1.45 + areaValue;
  return Math.tanh(raw / (size === 9 ? 22 : 48));
}

function weightedCandidate(candidates: Candidate[], random: () => number) {
  const best = candidates[0]?.prior ?? 0;
  const weights = candidates.map((candidate) => Math.exp(clamp((candidate.prior - best) / 9, -7, 0)));
  let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = 0; index < candidates.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return candidates[index];
  }
  return candidates[candidates.length - 1];
}

function rollout(node: SearchNode, rootColor: PlayerStone, size: BoardSize, random: () => number) {
  let board = node.board;
  let color = node.toPlay;
  let hashes = node.hashes;
  let moveNumber = node.moveNumber;
  let passes = node.passes;
  const depthLimit = size === 9 ? 24 : 15;
  for (let depth = 0; depth < depthLimit && passes < 2; depth += 1) {
    const occupied = board.reduce<number>((count, stone) => count + (stone === 0 ? 0 : 1), 0);
    const includePass = occupied / board.length > .68;
    const candidates = generateCandidates(board, color, size, hashes, moveNumber, size === 9 ? 10 : 8, includePass);
    if (!candidates.length) { passes += 1; color = otherColor(color); moveNumber += 1; continue; }
    const candidate = weightedCandidate(candidates, random);
    if (candidate.index === null) {
      passes += 1;
    } else {
      board = candidate.board;
      hashes = [...hashes.slice(-10), boardHash(board)];
      passes = 0;
    }
    color = otherColor(color);
    moveNumber += 1;
  }
  return evaluateBoard(board, rootColor, size);
}

function ensureUnexpanded(node: SearchNode, size: BoardSize) {
  if (node.unexpanded) return;
  const occupied = node.board.reduce<number>((count, stone) => count + (stone === 0 ? 0 : 1), 0);
  node.unexpanded = generateCandidates(
    node.board,
    node.toPlay,
    size,
    node.hashes,
    node.moveNumber,
    size === 9 ? 22 : 26,
    node.passes > 0 || occupied / node.board.length > .72,
  );
}

function expand(node: SearchNode, size: BoardSize) {
  ensureUnexpanded(node, size);
  const candidate = node.unexpanded?.shift();
  if (!candidate) return null;
  const nextHashes = candidate.index === null ? node.hashes : [...node.hashes.slice(-16), boardHash(candidate.board)];
  const child: SearchNode = {
    board: candidate.board,
    toPlay: otherColor(node.toPlay),
    hashes: nextHashes,
    moveNumber: node.moveNumber + 1,
    passes: candidate.index === null ? node.passes + 1 : 0,
    move: candidate.index,
    prior: Math.max(.05, candidate.prior + 12),
    visits: 0,
    valueSum: 0,
    children: [],
    unexpanded: null,
  };
  node.children.push(child);
  return child;
}

function selectChild(node: SearchNode, rootColor: PlayerStone) {
  const parentVisits = Math.max(1, node.visits);
  const maximizing = node.toPlay === rootColor;
  let best: SearchNode | null = null;
  let bestValue = -Infinity;
  for (const child of node.children) {
    const average = child.visits ? child.valueSum / child.visits : 0;
    const exploitation = maximizing ? average : -average;
    const exploration = 1.15 * child.prior / 20 * Math.sqrt(parentVisits) / (1 + child.visits);
    const value = exploitation + exploration;
    if (value > bestValue) { bestValue = value; best = child; }
  }
  return best;
}

export function chooseAiMove(board: Stone[], color: PlayerStone, size: BoardSize, hashes: string[], moveNumber: number, options: AiSearchOptions = {}) {
  const legal = generateCandidates(board, color, size, hashes, moveNumber, size === 9 ? 28 : 34, false);
  if (!legal.length) return null;
  if (board.every((stone) => stone === 0)) return legal[0].index;

  const maxTimeMs = options.maxTimeMs ?? 2_600;
  const maxSimulations = options.maxSimulations ?? (size === 9 ? 1_500 : 1_200);
  const random = createRandom(options.seed ?? (moveNumber * 2654435761 + Number.parseInt(boardHash(board).slice(0, 8) || "1", 3)));
  const root: SearchNode = {
    board,
    toPlay: color,
    hashes: hashes.slice(-18),
    moveNumber,
    passes: 0,
    move: null,
    prior: 1,
    visits: 0,
    valueSum: 0,
    children: [],
    unexpanded: legal,
  };
  const deadline = now() + maxTimeMs;

  for (let simulation = 0; simulation < maxSimulations && now() < deadline; simulation += 1) {
    const path = [root];
    let node = root;
    while (node.passes < 2) {
      ensureUnexpanded(node, size);
      const expanded = node.unexpanded?.length ? expand(node, size) : null;
      if (expanded) { node = expanded; path.push(node); break; }
      const selected = selectChild(node, color);
      if (!selected) break;
      node = selected;
      path.push(node);
    }
    const value = rollout(node, color, size, random);
    for (const visited of path) { visited.visits += 1; visited.valueSum += value; }
  }

  const occupiedRatio = board.filter((stone) => stone !== 0).length / board.length;
  const ranked = root.children
    .filter((child) => child.move !== null || occupiedRatio > .7)
    .sort((a, b) => b.visits - a.visits || (b.valueSum / Math.max(1, b.visits)) - (a.valueSum / Math.max(1, a.visits)));
  return ranked[0]?.move ?? legal[0].index;
}
