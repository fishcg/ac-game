import type {
  BeanEvent,
  ChickenCharge,
  Meld,
  Rank,
  RoundScore,
  RoundScoreInput,
  ScoreLine,
  Suit,
  Tile,
  TileKey,
  WinAnalysis,
  WinPattern,
} from "./types";

export const SUITS: readonly Suit[] = ["wan", "tiao", "tong"];
export const ALL_TILE_KEYS: readonly TileKey[] = SUITS.flatMap((suit) =>
  Array.from({ length: 9 }, (_, index) => `${suit}-${index + 1}` as TileKey),
);

export function seeded(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function tileKey(tile: Pick<Tile, "suit" | "rank">): TileKey {
  return `${tile.suit}-${tile.rank}`;
}

export function tileFromKey(key: TileKey, id = -1): Tile {
  const [suit, rank] = key.split("-") as [Suit, `${Rank}`];
  return { id, suit, rank: Number(rank) as Rank };
}

export function createWall(random: () => number): Tile[] {
  const wall: Tile[] = [];
  let id = 0;
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 9; rank += 1) {
      for (let copy = 0; copy < 4; copy += 1) wall.push({ id: id += 1, suit, rank: rank as Rank });
    }
  }
  for (let index = wall.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [wall[index], wall[swap]] = [wall[swap], wall[index]];
  }
  return wall;
}

export function sortTiles(tiles: Tile[]) {
  const suitOrder: Record<Suit, number> = { wan: 0, tiao: 1, tong: 2 };
  return [...tiles].sort((left, right) => suitOrder[left.suit] - suitOrder[right.suit] || left.rank - right.rank || left.id - right.id);
}

export function countTiles(tiles: Tile[]) {
  const counts = Array<number>(27).fill(0);
  for (const tile of tiles) counts[SUITS.indexOf(tile.suit) * 9 + tile.rank - 1] += 1;
  return counts;
}

function canFormMelds(counts: number[], meldsNeeded: number): boolean {
  if (meldsNeeded === 0) return counts.every((count) => count === 0);
  const first = counts.findIndex((count) => count > 0);
  if (first < 0) return false;

  if (counts[first] >= 3) {
    counts[first] -= 3;
    if (canFormMelds(counts, meldsNeeded - 1)) {
      counts[first] += 3;
      return true;
    }
    counts[first] += 3;
  }

  const rank = first % 9;
  if (rank <= 6 && counts[first + 1] > 0 && counts[first + 2] > 0) {
    counts[first] -= 1;
    counts[first + 1] -= 1;
    counts[first + 2] -= 1;
    if (canFormMelds(counts, meldsNeeded - 1)) {
      counts[first] += 1;
      counts[first + 1] += 1;
      counts[first + 2] += 1;
      return true;
    }
    counts[first] += 1;
    counts[first + 1] += 1;
    counts[first + 2] += 1;
  }
  return false;
}

function canFormTriplets(counts: number[], meldsNeeded: number): boolean {
  if (meldsNeeded === 0) return counts.every((count) => count === 0);
  const first = counts.findIndex((count) => count > 0);
  if (first < 0 || counts[first] < 3) return false;
  counts[first] -= 3;
  const valid = canFormTriplets(counts, meldsNeeded - 1);
  counts[first] += 3;
  return valid;
}

function hasStandardShape(tiles: Tile[], meldCount: number, tripletsOnly = false) {
  const meldsNeeded = 4 - meldCount;
  if (meldsNeeded < 0 || tiles.length !== meldsNeeded * 3 + 2) return false;
  const counts = countTiles(tiles);
  for (let pair = 0; pair < counts.length; pair += 1) {
    if (counts[pair] < 2) continue;
    counts[pair] -= 2;
    const valid = tripletsOnly ? canFormTriplets(counts, meldsNeeded) : canFormMelds(counts, meldsNeeded);
    counts[pair] += 2;
    if (valid) return true;
  }
  return false;
}

function isSevenPairs(tiles: Tile[], melds: Meld[]) {
  if (melds.length > 0 || tiles.length !== 14) return false;
  return countTiles(tiles).every((count) => count === 0 || count === 2 || count === 4);
}

function isPureSuit(tiles: Tile[], melds: Meld[]) {
  const suits = new Set([...tiles, ...melds.flatMap((meld) => meld.tiles)].map((tile) => tile.suit));
  return suits.size === 1;
}

export function analyzeWinningHand(tiles: Tile[], melds: Meld[] = []): WinAnalysis {
  const sevenPairs = isSevenPairs(tiles, melds);
  const standard = hasStandardShape(tiles, melds.length);
  const valid = sevenPairs || standard;
  const pureSuit = valid && isPureSuit(tiles, melds);
  const dragonPairs = sevenPairs && countTiles(tiles).some((count) => count === 4);
  const allTriplets = standard && hasStandardShape(tiles, melds.length, true);

  let pattern: WinPattern | null = null;
  let fan = 0;
  if (valid) {
    if (pureSuit && dragonPairs) [pattern, fan] = ["清龙背", 20];
    else if (pureSuit && sevenPairs) [pattern, fan] = ["清七对", 17];
    else if (pureSuit && allTriplets) [pattern, fan] = ["清大对", 15];
    else if (pureSuit) [pattern, fan] = ["清一色", 10];
    else if (dragonPairs) [pattern, fan] = ["龙七对", 10];
    else if (sevenPairs) [pattern, fan] = ["七对", 7];
    else if (allTriplets) [pattern, fan] = ["大对子", 5];
    else [pattern, fan] = ["平胡", 1];
  }
  return { valid, pattern, fan, pureSuit, sevenPairs, dragonPairs, allTriplets };
}

export function analyzeWinWithTile(hand: Tile[], melds: Meld[], tile: Tile) {
  return analyzeWinningHand([...hand, tile], melds);
}

export function canClaimDiscardWin(hand: Tile[], melds: Meld[], tile: Tile, hasBean: boolean) {
  const analysis = analyzeWinWithTile(hand, melds, tile);
  return { analysis, allowed: analysis.valid && (hasBean || analysis.fan >= 5) };
}

export function getReadyTileKeys(hand: Tile[], melds: Meld[] = []) {
  const existing = countTiles([...hand, ...melds.flatMap((meld) => meld.tiles)]);
  return ALL_TILE_KEYS.filter((key, index) => existing[index] < 4 && analyzeWinWithTile(hand, melds, tileFromKey(key)).valid);
}

export function getReadyDiscards(hand: Tile[], melds: Meld[] = []) {
  const seen = new Set<TileKey>();
  const result: Array<{ discard: TileKey; waits: TileKey[] }> = [];
  for (const tile of hand) {
    const key = tileKey(tile);
    if (seen.has(key)) continue;
    seen.add(key);
    const index = hand.findIndex((candidate) => candidate.id === tile.id);
    const waits = getReadyTileKeys([...hand.slice(0, index), ...hand.slice(index + 1)], melds);
    if (waits.length > 0) result.push({ discard: key, waits });
  }
  return result;
}

export function countKey(tiles: Tile[], key: TileKey) {
  return tiles.reduce((total, tile) => total + Number(tileKey(tile) === key), 0);
}

export function removeTilesByKey(tiles: Tile[], key: TileKey, amount: number) {
  const removed: Tile[] = [];
  const kept: Tile[] = [];
  for (const tile of tiles) {
    if (removed.length < amount && tileKey(tile) === key) removed.push(tile);
    else kept.push(tile);
  }
  return removed.length === amount ? { kept, removed } : null;
}

export function findConcealedKongs(hand: Tile[]) {
  return ALL_TILE_KEYS.filter((key) => countKey(hand, key) === 4);
}

export function findAddedKongs(hand: Tile[], melds: Meld[]) {
  return melds.filter((meld) => meld.kind === "pong" && countKey(hand, tileKey(meld.tiles[0])) > 0).map((meld) => tileKey(meld.tiles[0]));
}

export function getChickenKey(indicator: Tile): TileKey {
  const rank = (indicator.rank === 9 ? 1 : indicator.rank + 1) as Rank;
  return `${indicator.suit}-${rank}`;
}

export function chickenValue(key: TileKey, chickenKey: TileKey) {
  if (key === chickenKey) {
    if (key === "tiao-1") return 2;
    if (key === "tong-8") return 4;
    return 1;
  }
  if (key === "tiao-1") return 1;
  if (key === "tong-8") return 2;
  return 0;
}

export function countChickenFan(tiles: Tile[], chickenKey: TileKey) {
  return tiles.reduce((total, tile) => total + chickenValue(tileKey(tile), chickenKey), 0);
}

function transfer(deltas: number[], lines: ScoreLine[], from: number, to: number, amount: number, label: string) {
  if (amount <= 0 || from === to) return;
  deltas[from] -= amount;
  deltas[to] += amount;
  lines.push({ label, from, to, amount });
}

function scoreBeans(events: BeanEvent[], burned: Set<number>, base: number, deltas: number[], lines: ScoreLine[]) {
  for (const event of events) {
    if (burned.has(event.owner)) continue;
    if (event.payer !== null) {
      transfer(deltas, lines, event.payer, event.owner, event.fan * base, event.kind === "point" ? "点豆" : "豆");
      continue;
    }
    for (let seat = 0; seat < 4; seat += 1) {
      if (seat !== event.owner) transfer(deltas, lines, seat, event.owner, event.fan * base, event.kind === "concealed" ? "闷豆" : "爬坡豆");
    }
  }
}

function chargeBonus(charge: ChickenCharge | null, chickenKey: TileKey) {
  if (!charge) return 0;
  return chickenValue(charge.tile, chickenKey);
}

export function scoreRound(input: RoundScoreInput): RoundScore {
  const base = input.base ?? 1;
  const deltas = [0, 0, 0, 0];
  const lines: ScoreLine[] = [];
  const burned = new Set(input.burnedSeats ?? []);
  const chickenKey = getChickenKey(input.indicator);
  const chickenFan = input.players.map((player) => player.ready && !burned.has(player.seat) ? countChickenFan(player.tiles, chickenKey) : 0);

  if (input.winner !== null) {
    const winner = input.players[input.winner];
    const handFan = (winner.analysis?.fan ?? 1) + Number(input.dealer === input.winner) + Number(input.selfDraw);
    if (input.liabilityPayer !== null && input.liabilityPayer !== undefined) {
      transfer(deltas, lines, input.liabilityPayer, input.winner, handFan * base * 3, `${winner.analysis?.pattern ?? "胡牌"}·包三家`);
    } else if (input.selfDraw) {
      for (let seat = 0; seat < 4; seat += 1) if (seat !== input.winner) transfer(deltas, lines, seat, input.winner, handFan * base, `${winner.analysis?.pattern ?? "胡牌"}·自摸`);
    } else if (input.discarder !== null) {
      transfer(deltas, lines, input.discarder, input.winner, handFan * base, winner.analysis?.pattern ?? "胡牌");
    }
  } else {
    const ready = input.players.filter((player) => player.ready);
    const notReady = input.players.filter((player) => !player.ready);
    for (const receiver of ready) {
      const fan = Math.max(1, receiver.analysis?.fan ?? 1);
      for (const payer of notReady) transfer(deltas, lines, payer.seat, receiver.seat, fan * base, "黄牌查叫");
    }
  }

  scoreBeans(input.beanEvents, burned, base, deltas, lines);

  for (const player of input.players) {
    const fan = chickenFan[player.seat];
    if (fan <= 0) continue;
    for (let seat = 0; seat < 4; seat += 1) if (seat !== player.seat) transfer(deltas, lines, seat, player.seat, fan * base, "鸡牌");
  }

  const bonus = chargeBonus(input.charge, chickenKey);
  if (input.charge && bonus > 0) {
    if (input.charge.claimant !== null) {
      transfer(deltas, lines, input.charge.discarder, input.charge.claimant, bonus * base, "责任鸡");
    } else if (input.players[input.charge.discarder]?.ready && !burned.has(input.charge.discarder)) {
      for (let seat = 0; seat < 4; seat += 1) {
        if (seat !== input.charge.discarder) transfer(deltas, lines, seat, input.charge.discarder, bonus * base, "冲锋鸡加倍");
      }
    }
  }

  return { deltas, lines, chickenKey, chickenFan };
}
