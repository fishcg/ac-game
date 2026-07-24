import { SPECIAL_CHICKENS } from "./data";
import { countTiles, getReadyTileKeys, tileKey } from "./rules";
import type { Meld, Tile, TileKey } from "./types";

function shapeValue(hand: Tile[]) {
  const counts = countTiles(hand);
  let score = 0;
  counts.forEach((count, index) => {
    if (count >= 2) score += 8 + count * 3;
    const rank = index % 9;
    if (rank < 8 && counts[index + 1] > 0) score += 2;
    if (rank < 7 && counts[index + 2] > 0) score += 1;
  });
  return score;
}
export function chooseDiscard(hand: Tile[], melds: Meld[]) {
  let best = hand[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const tile of hand) {
    const next = hand.filter((candidate) => candidate.id !== tile.id);
    const waits = getReadyTileKeys(next, melds);
    const specialPenalty = SPECIAL_CHICKENS.includes(tileKey(tile)) ? 8 : 0;
    const edgePenalty = tile.rank === 1 || tile.rank === 9 ? -1 : 0;
    const score = waits.length * 120 + shapeValue(next) + specialPenalty + edgePenalty;
    if (score > bestScore) {
      bestScore = score;
      best = tile;
    }
  }
  return best;
}

export function shouldClaimPong(hand: Tile[], melds: Meld[], key: TileKey) {
  const before = shapeValue(hand);
  const removed = hand.filter((tile) => tileKey(tile) !== key).length;
  const pairCount = hand.length - removed;
  if (pairCount < 2) return false;
  const after = shapeValue(hand.filter((tile, index, all) => tileKey(tile) !== key || all.slice(0, index).filter((candidate) => tileKey(candidate) === key).length >= 2));
  return melds.length >= 2 || after + 10 >= before;
}
