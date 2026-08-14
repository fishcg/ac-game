import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node 的内置 TypeScript 测试运行器需要显式扩展名。
import { chooseAiMove } from "./goAi.ts";
// @ts-expect-error Node 的内置 TypeScript 测试运行器需要显式扩展名。
import { boardHash, playMove } from "./goRules.ts";
import type { Stone } from "./types.ts";

const search = { maxTimeMs: 10_000, maxSimulations: 260, seed: 7 };

test("空棋盘优先选择有全局价值的开局点", () => {
  const board = Array(81).fill(0) as Stone[];
  const move = chooseAiMove(board, 1, 9, [boardHash(board)], 0, search);
  assert.ok(move !== null);
  const row = Math.floor(move / 9);
  const col = move % 9;
  assert.ok(row >= 2 && row <= 6 && col >= 2 && col <= 6);
});

test("电脑能看见立即提子，而不是在远处落子", () => {
  const board = Array(81).fill(0) as Stone[];
  board[4 * 9 + 4] = 2;
  board[3 * 9 + 4] = 1;
  board[4 * 9 + 3] = 1;
  board[5 * 9 + 4] = 1;
  const capture = 4 * 9 + 5;
  const move = chooseAiMove(board, 1, 9, [boardHash(board)], 12, search);
  assert.equal(move, capture);
});

test("电脑会挽救被叫吃的多子棋块", () => {
  const board = Array(81).fill(0) as Stone[];
  board[4 * 9 + 4] = 2;
  board[4 * 9 + 5] = 2;
  board[3 * 9 + 4] = 1;
  board[3 * 9 + 5] = 1;
  board[4 * 9 + 3] = 1;
  board[5 * 9 + 4] = 1;
  board[5 * 9 + 5] = 1;
  const escape = 4 * 9 + 6;
  const move = chooseAiMove(board, 2, 9, [boardHash(board)], 18, search);
  assert.equal(move, escape);
});

test("搜索返回的落子始终通过正式劫争和禁入点规则", () => {
  const board = Array(81).fill(0) as Stone[];
  board[3 * 9 + 4] = 1;
  board[4 * 9 + 3] = 1;
  board[4 * 9 + 5] = 1;
  board[5 * 9 + 4] = 1;
  const hashes = [boardHash(board)];
  const move = chooseAiMove(board, 2, 9, hashes, 9, search);
  assert.ok(move === null || playMove(board, move, 2, 9, hashes).legal);
});
