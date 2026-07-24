import assert from "node:assert/strict";
import test from "node:test";
import type { Meld, Tile, TileKey } from "./types.ts";
import {
  analyzeWinningHand,
  canClaimDiscardWin,
  chickenValue,
  createWall,
  getChickenKey,
  getReadyTileKeys,
  scoreRound,
  seeded,
  tileFromKey,
// @ts-expect-error Node's built-in TypeScript test runner requires the explicit extension.
} from "./rules.ts";

let tileId = 0;
const tiles = (keys: TileKey[]): Tile[] => keys.map((key) => ({ ...tileFromKey(key), id: tileId += 1 }));

test("牌墙包含三门各四张，共 108 张", () => {
  const wall = createWall(seeded(7));
  assert.equal(wall.length, 108);
  assert.equal(new Set(wall.map((tile) => tile.id)).size, 108);
  assert.equal(wall.filter((tile) => tile.suit === "wan" && tile.rank === 1).length, 4);
});

test("识别平胡、七对、龙七对和清一色复合牌型", () => {
  const standard = tiles(["wan-1", "wan-2", "wan-3", "wan-2", "wan-3", "wan-4", "tiao-4", "tiao-5", "tiao-6", "tong-7", "tong-8", "tong-9", "wan-9", "wan-9"]);
  assert.equal(analyzeWinningHand(standard).pattern, "平胡");

  const seven = tiles(["wan-1", "wan-1", "wan-2", "wan-2", "wan-3", "wan-3", "tiao-4", "tiao-4", "tiao-5", "tiao-5", "tong-6", "tong-6", "tong-9", "tong-9"]);
  assert.equal(analyzeWinningHand(seven).pattern, "七对");

  const dragon = tiles(["wan-1", "wan-1", "wan-1", "wan-1", "wan-2", "wan-2", "tiao-4", "tiao-4", "tiao-5", "tiao-5", "tong-6", "tong-6", "tong-9", "tong-9"]);
  assert.equal(analyzeWinningHand(dragon).pattern, "龙七对");

  const pure = tiles(["tong-1", "tong-2", "tong-3", "tong-2", "tong-3", "tong-4", "tong-4", "tong-5", "tong-6", "tong-6", "tong-7", "tong-8", "tong-9", "tong-9"]);
  assert.equal(analyzeWinningHand(pure).pattern, "清一色");
});

test("平胡点炮需要豆通行证，大对子不需要", () => {
  const hand = tiles(["wan-1", "wan-2", "wan-3", "wan-2", "wan-3", "wan-4", "tiao-4", "tiao-5", "tiao-6", "tong-7", "tong-8", "tong-9", "wan-9"]);
  const winning = tiles(["wan-9"])[0];
  assert.equal(canClaimDiscardWin(hand, [], winning, false).allowed, false);
  assert.equal(canClaimDiscardWin(hand, [], winning, true).allowed, true);

  const triplets = tiles(["wan-1", "wan-1", "wan-1", "wan-2", "wan-2", "wan-2", "tiao-4", "tiao-4", "tiao-4", "tong-7", "tong-7", "tong-7", "wan-9"]);
  assert.equal(canClaimDiscardWin(triplets, [], winning, false).allowed, true);
});

test("有副露时仍可正确判胡与听牌", () => {
  const meld: Meld = { kind: "pong", fromSeat: 1, tiles: tiles(["wan-3", "wan-3", "wan-3"]) };
  const hand = tiles(["tiao-1", "tiao-2", "tiao-3", "tiao-4", "tiao-5", "tiao-6", "tong-7", "tong-8", "tong-9", "wan-9"]);
  const waits = getReadyTileKeys(hand, [meld]);
  assert.deepEqual(waits, ["wan-9"]);
});

test("翻到九后按同花色回到一，金鸡价值翻倍", () => {
  assert.equal(getChickenKey(tileFromKey("wan-9")), "wan-1");
  assert.equal(getChickenKey(tileFromKey("tiao-9")), "tiao-1");
  assert.equal(chickenValue("tiao-1", "tiao-1"), 2);
  assert.equal(chickenValue("tong-8", "tong-8"), 4);
  assert.equal(chickenValue("tong-8", "wan-3"), 2);
});

test("结算包含自摸、三类豆、鸡牌与零和校验", () => {
  const winning = tiles(["wan-1", "wan-1", "wan-1", "wan-2", "wan-2", "wan-2", "tiao-4", "tiao-4", "tiao-4", "tong-7", "tong-7", "tong-7", "wan-9", "wan-9"]);
  const analysis = analyzeWinningHand(winning);
  const result = scoreRound({
    players: [
      { seat: 0, ready: true, tiles: [...winning, ...tiles(["tiao-1"])], analysis },
      { seat: 1, ready: false, tiles: tiles(["wan-4"]), analysis: null },
      { seat: 2, ready: false, tiles: tiles(["wan-5"]), analysis: null },
      { seat: 3, ready: false, tiles: tiles(["wan-6"]), analysis: null },
    ],
    winner: 0,
    discarder: null,
    dealer: 0,
    selfDraw: true,
    indicator: tileFromKey("wan-8"),
    beanEvents: [
      { kind: "point", owner: 0, payer: 1, fan: 1, tile: "wan-1" },
      { kind: "concealed", owner: 2, payer: null, fan: 2, tile: "wan-2" },
      { kind: "added", owner: 3, payer: null, fan: 3, tile: "wan-3" },
    ],
    charge: null,
  });
  assert.equal(result.deltas.reduce((sum, value) => sum + value, 0), 0);
  assert.ok(result.lines.some((line) => line.label === "闷豆"));
  assert.ok(result.lines.some((line) => line.label === "爬坡豆"));
  assert.ok(result.lines.some((line) => line.label === "鸡牌"));
});
