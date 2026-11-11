import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node 内置 TypeScript 测试运行器要求显式扩展名。
import { DEFEAT_DAMAGE_SCORE, HEALTH_BONUS, TIME_LIMIT, VICTORY_BASE, computeScore, formatDuration, formatScore, readResult } from "./rules.ts";

test("胜利积分：基础分 + 速度奖励 + 剩余血量奖励", () => {
  const score = computeScore({ outcome: "victory", seconds: 120, playerHp: 195, playerMaxHp: 390, bossHp: 0, bossMaxHp: 6480 });
  assert.equal(score, VICTORY_BASE + (TIME_LIMIT - 120) * 2 + HEALTH_BONUS / 2);
});

test("胜利积分：瞬杀满血为上限，超时不倒扣", () => {
  const perfect = computeScore({ outcome: "victory", seconds: 0, playerHp: 390, playerMaxHp: 390, bossHp: 0, bossMaxHp: 6480 });
  assert.equal(perfect, VICTORY_BASE + TIME_LIMIT * 2 + HEALTH_BONUS);
  const slow = computeScore({ outcome: "victory", seconds: 9999, playerHp: 0, playerMaxHp: 390, bossHp: 0, bossMaxHp: 6480 });
  assert.equal(slow, VICTORY_BASE);
});

test("失败积分：按对虎先锋造成的伤害比例计算，零伤害为 0", () => {
  const half = computeScore({ outcome: "defeat", seconds: 80, playerHp: 0, playerMaxHp: 390, bossHp: 3240, bossMaxHp: 6480 });
  assert.equal(half, DEFEAT_DAMAGE_SCORE / 2);
  const noDamage = computeScore({ outcome: "defeat", seconds: 2, playerHp: 0, playerMaxHp: 390, bossHp: 6480, bossMaxHp: 6480 });
  assert.equal(noDamage, 0);
});

test("血量与时间边界会被夹紧，不会产生负数或小数", () => {
  const score = computeScore({ outcome: "victory", seconds: -10, playerHp: 999, playerMaxHp: 390, bossHp: -3, bossMaxHp: 6480 });
  assert.equal(score, VICTORY_BASE + TIME_LIMIT * 2 + HEALTH_BONUS);
  const negative = computeScore({ outcome: "defeat", seconds: 10, playerHp: 0, playerMaxHp: 390, bossHp: 99999, bossMaxHp: 6480 });
  assert.equal(negative, 0);
  assert.equal(Number.isInteger(score), true);
});

test("从调试状态读取结算：只接受 victory / defeat，缺角色数据无效", () => {
  const victory = readResult({ state: "victory", simTime: 120.9, player: { hp: 195, maxHp: 390 }, boss: { hp: 0, maxHp: 6480 } });
  assert.ok(victory);
  assert.equal(victory.outcome, "victory");
  assert.equal(victory.seconds, 120.9);
  assert.equal(readResult({ state: "fight", simTime: 30, player: { hp: 390, maxHp: 390 }, boss: { hp: 6480, maxHp: 6480 } }), null);
  assert.equal(readResult({ state: "victory", simTime: 1, player: null, boss: { hp: 0, maxHp: 6480 } }), null);
  assert.equal(readResult(null), null);
});

test("结算文案格式化", () => {
  assert.equal(formatScore(3200), "3,200");
  assert.equal(formatScore(0), "0");
  assert.equal(formatDuration(95), "01:35");
  assert.equal(formatDuration(3599), "59:59");
});
