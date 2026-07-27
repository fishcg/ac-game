import { otherColor } from "./goRules";
import type { PlayerStone, Stone } from "./types";
import type { LifeDeathGoal, LifeDeathLevel } from "./lifeDeathTypes";

const SIZE = 9;
const ANCHORS: Array<[number, number]> = [
  [2, 2], [2, 4], [2, 6], [4, 2], [4, 4], [4, 6], [6, 2], [6, 4], [6, 6],
];
const SHAPES: number[][][] = [
  [[0, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [1, 0]],
  [[0, 0], [0, 1], [1, 1], [1, 2]],
  [[0, 0], [1, 0], [1, 1], [2, 1]],
];
const RESPONSE_POINTS = [8, 72, 80, 4, 76, 36, 44];
const CHAPTERS = ["角部入门", "真假眼", "紧气攻杀", "接触战", "劫与联络"];
const KILL_TITLES = ["断气", "点杀", "封锁", "破眼", "收官一击"];
const LIVE_TITLES = ["做出一气", "逃出生天", "借力成活", "两气安家", "绝处逢生"];

function point(row: number, col: number) {
  return row * SIZE + col;
}

function adjacent(index: number) {
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  const result: number[] = [];
  if (row > 0) result.push(index - SIZE);
  if (row < SIZE - 1) result.push(index + SIZE);
  if (col > 0) result.push(index - 1);
  if (col < SIZE - 1) result.push(index + 1);
  return result;
}

function uniqueNeighbors(stones: number[]) {
  const stoneSet = new Set(stones);
  return [...new Set(stones.flatMap(adjacent))].filter((index) => !stoneSet.has(index));
}

function addQuietStones(board: Stone[], occupied: Set<number>, color: PlayerStone, seed: number) {
  const candidates = [point(0, 0), point(0, 8), point(8, 0), point(8, 8), point(1, 7), point(7, 1), point(1, 1), point(7, 7)];
  const first = seed % candidates.length;
  for (let offset = 0; offset < 2; offset += 1) {
    const index = candidates[(first + offset) % candidates.length];
    if (!occupied.has(index) && adjacent(index).some((neighbor) => !occupied.has(neighbor))) {
      board[index] = color;
      occupied.add(index);
    }
  }
}

function pickResponse(board: Stone[], reserved: number[], seed: number) {
  for (let offset = 0; offset < RESPONSE_POINTS.length; offset += 1) {
    const candidate = RESPONSE_POINTS[(seed + offset) % RESPONSE_POINTS.length];
    if (board[candidate] === 0 && !reserved.includes(candidate)) return candidate;
  }
  return null;
}

function buildKillLevel(id: number, playerColor: PlayerStone, shape: number[][], libertyCount: number, goal: LifeDeathGoal): LifeDeathLevel {
  const [row, col] = ANCHORS[(id * 3) % ANCHORS.length];
  const targetGroup = shape.map(([dr, dc]) => point(row + dr, col + dc));
  const board = Array<Stone>(SIZE * SIZE).fill(0);
  const occupied = new Set(targetGroup);
  const targetColor = otherColor(playerColor);
  targetGroup.forEach((index) => { board[index] = targetColor; });
  const candidates = uniqueNeighbors(targetGroup);
  const desired = candidates.slice(0, Math.min(libertyCount, candidates.length));
  const desiredSet = new Set(desired);
  candidates.forEach((index) => {
    if (!desiredSet.has(index)) {
      board[index] = playerColor;
      occupied.add(index);
    }
  });
  addQuietStones(board, occupied, playerColor, id);
  const maxMoves = desired.length + (id >= 41 ? 1 : 0);
  const response = id % 5 === 0 ? pickResponse(board, desired, id) : null;
  return {
    id,
    title: `${KILL_TITLES[(id - 1) % KILL_TITLES.length]} · ${desired.length}气`,
    chapter: CHAPTERS[Math.min(4, Math.floor((id - 1) / 10))],
    difficulty: Math.min(5, Math.ceil(id / 10)) as 1 | 2 | 3 | 4 | 5,
    boardSize: SIZE,
    board,
    playerColor,
    targetColor,
    targetGroup,
    goal,
    requiredLiberties: 0,
    maxMoves,
    solution: desired,
    opponentResponses: desired.map((_, index) => index === 0 ? response : null),
    hint: `先找出目标棋块的最后一口气：${desired.length > 0 ? "标记点位会在提示中显示" : "观察连接处"}`,
    explanation: goal === "break-eye" ? "这是一个假眼。先破坏关键眼位，再沿着剩余气口收紧。" : "目标棋块只有有限的气，按顺序收紧外气，最后一手完成提子。",
  };
}

function buildLiveLevel(id: number, playerColor: PlayerStone, shape: number[][], requiredLiberties: number, steps: 1 | 2 = 1): LifeDeathLevel {
  const [row, col] = ANCHORS[(id * 5 + 1) % ANCHORS.length];
  const targetGroup = shape.map(([dr, dc]) => point(row + dr, col + dc));
  const board = Array<Stone>(SIZE * SIZE).fill(0);
  const occupied = new Set(targetGroup);
  const targetColor = playerColor;
  const opponent = otherColor(playerColor);
  targetGroup.forEach((index) => { board[index] = targetColor; });
  const candidates = uniqueNeighbors(targetGroup);
  const key = candidates[0];
  const candidateSet = new Set(candidates);
  candidates.forEach((index) => {
    if (index !== key) {
      board[index] = opponent;
      occupied.add(index);
    }
  });
  const firstGrowthCandidates = adjacent(key).filter((index) => !candidateSet.has(index) && !occupied.has(index));
  const firstGrowth = firstGrowthCandidates[0];
  const solution = steps === 2 && firstGrowth !== undefined ? [key, firstGrowth] : [key];
  const firstOpen = steps === 2 && firstGrowth !== undefined
    ? [firstGrowth]
    : firstGrowthCandidates.slice(0, Math.max(2, requiredLiberties));
  const firstOpenSet = new Set(firstOpen);
  const reservedOpen = new Set([key, ...firstOpen]);
  adjacent(key).forEach((index) => {
    if (!firstOpenSet.has(index) && !occupied.has(index)) {
      board[index] = opponent;
      occupied.add(index);
    }
  });
  if (solution.length === 2 && firstGrowth !== undefined) {
    const finalGrowth = adjacent(firstGrowth).filter((index) => index !== key && !occupied.has(index)).slice(0, Math.max(2, requiredLiberties));
    const finalGrowthSet = new Set(finalGrowth);
    finalGrowth.forEach((index) => reservedOpen.add(index));
    adjacent(firstGrowth).forEach((index) => {
      if (index !== key && !finalGrowthSet.has(index) && !occupied.has(index)) {
        board[index] = opponent;
        occupied.add(index);
      }
    });
  }
  addQuietStones(board, new Set([...occupied, ...reservedOpen]), opponent, id + 2);
  const response = id % 4 === 0 ? pickResponse(board, solution, id + 2) : null;
  return {
    id,
    title: `${LIVE_TITLES[(id - 1) % LIVE_TITLES.length]} · ${requiredLiberties}气`,
    chapter: CHAPTERS[Math.min(4, Math.floor((id - 1) / 10))],
    difficulty: Math.min(5, Math.ceil(id / 10)) as 1 | 2 | 3 | 4 | 5,
    boardSize: SIZE,
    board,
    playerColor,
    targetColor,
    targetGroup,
    goal: "live",
    requiredLiberties,
    maxMoves: solution.length,
    solution,
    opponentResponses: [response, null],
    hint: "先抢占唯一的连接点，让棋块向外伸展，做出两口以上的气。",
    explanation: "目标棋块只有一口气，关键手不是补在棋块内部，而是抢先连接到外部空间。",
  };
}

const levels: LifeDeathLevel[] = [];
for (let id = 1; id <= 50; id += 1) {
  const playerColor: PlayerStone = id % 2 === 0 ? 2 : 1;
  const shape = SHAPES[(id - 1) % SHAPES.length];
  if (id <= 10) levels.push(buildKillLevel(id, playerColor, SHAPES[0], 1, "kill"));
  else if (id <= 20) levels.push(buildLiveLevel(id, playerColor, SHAPES[id % 3], 2));
  else if (id <= 30) levels.push(buildKillLevel(id, playerColor, shape, 2 + (id % 2), "kill"));
  else if (id <= 40) levels.push(buildLiveLevel(id, playerColor, SHAPES[3 + (id % 4)], 2, 2));
  else if (id % 2 === 0) levels.push(buildLiveLevel(id, playerColor, SHAPES[4 + (id % 4)], 2, 2));
  else levels.push(buildKillLevel(id, playerColor, shape, 3 + (id % 2), "break-eye"));
}

export const lifeDeathLevels = levels;
