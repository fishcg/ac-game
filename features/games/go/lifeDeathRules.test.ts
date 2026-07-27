import assert from "node:assert/strict";
import test from "node:test";
import { applyLifeDeathMove, evaluateLifeDeath } from "./lifeDeathRules";
import { lifeDeathLevels } from "./lifeDeathLevels";
import { boardHash, otherColor } from "./goRules";

test("死活棋题库包含连续 50 关，棋盘尺寸与目标坐标有效", () => {
  assert.equal(lifeDeathLevels.length, 50);
  lifeDeathLevels.forEach((level, index) => {
    assert.equal(level.id, index + 1);
    assert.equal(level.board.length, level.boardSize * level.boardSize);
    level.targetGroup.forEach((point) => assert.equal(level.board[point], level.targetColor));
  });
});

test("每关的标准解都能通过正式落子规则完成", () => {
  lifeDeathLevels.forEach((level) => {
    let board = level.board.slice();
    let history = [boardHash(board)];
    let evaluation = evaluateLifeDeath(level, board, 0);
    level.solution.forEach((point, index) => {
      if (evaluation.status !== "playing") return;
      const move = applyLifeDeathMove(board, point, level.playerColor, history);
      assert.equal(move.legal, true, `第 ${level.id} 关第 ${index + 1} 手应合法`);
      board = move.board;
      history = [...history, boardHash(board)];
      evaluation = evaluateLifeDeath(level, board, index + 1, index + 1);
      const response = level.opponentResponses[index];
      if (evaluation.status === "playing" && response !== null && response !== undefined) {
        const reply = applyLifeDeathMove(board, response, otherColor(level.playerColor), history);
        assert.equal(reply.legal, true, `第 ${level.id} 关题目应手应合法`);
        board = reply.board;
        history = [...history, boardHash(board)];
        evaluation = evaluateLifeDeath(level, board, index + 1, index + 1);
      }
    });
    assert.equal(evaluation.status, "won", `第 ${level.id} 关标准解应成功`);
  });
});

test("非法落子不会改变死活棋局面", () => {
  const level = lifeDeathLevels[0];
  const occupied = level.targetGroup[0];
  const board = level.board.slice();
  const move = applyLifeDeathMove(board, occupied, level.playerColor, [boardHash(board)]);
  assert.equal(move.legal, false);
  assert.deepEqual(move.board, board);
});
