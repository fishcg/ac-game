import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node 内置 TypeScript 测试运行器要求显式扩展名。
import { ACCURACY_SCORE, COMPLETION_BASE, KILL_SCORE, MIN_SCORE, RETRY_PENALTY, TIME_BONUS_CAP, computeScore, formatScore, parseAccuracy, parseCount, parseDebrief, parseMissionTime } from "./rules.ts";

test("解析行动用时：mm:ss 与纯秒数都能识别，非法输入返回 null", () => {
  assert.equal(parseMissionTime("05:42"), 342);
  assert.equal(parseMissionTime("00:00"), 0);
  assert.equal(parseMissionTime("12:05"), 725);
  assert.equal(parseMissionTime("342"), 342);
  assert.equal(parseMissionTime(""), null);
  assert.equal(parseMissionTime("abc"), null);
  assert.equal(parseMissionTime("1:2"), null);
  assert.equal(parseMissionTime("-1"), null);
});

test("解析命中率：百分数转小数并夹在 0–1，未开枪为 null", () => {
  assert.equal(parseAccuracy("56%"), 0.56);
  assert.equal(parseAccuracy("100%"), 1);
  assert.equal(parseAccuracy("120%"), 1);
  assert.equal(parseAccuracy("—"), null);
  assert.equal(parseAccuracy(""), null);
});

test("解析数量：容忍单位与空白", () => {
  assert.equal(parseCount("11"), 11);
  assert.equal(parseCount("11 台"), 11);
  assert.equal(parseCount("0/3"), 3);
  assert.equal(parseCount("—"), 0);
});

test("撤离积分：基础分 + 击杀 + 命中 + 用时奖励 - 重试惩罚", () => {
  const score = computeScore({ timeSeconds: 342, accuracy: 0.56, kills: 11, retries: 0 });
  assert.equal(score, 3544);
  assert.ok(score > COMPLETION_BASE);
});

test("撤离积分：更快、更准、更多击杀、更少重试都只增加分数", () => {
  const base = { timeSeconds: 400, accuracy: 0.4, kills: 8, retries: 1 };
  const score = computeScore(base);
  assert.ok(computeScore({ ...base, timeSeconds: 300 }) > score);
  assert.ok(computeScore({ ...base, accuracy: 0.7 }) > score);
  assert.ok(computeScore({ ...base, kills: 9 }) > score);
  assert.ok(computeScore({ ...base, retries: 0 }) > score);
});

test("用时奖励封顶：超时不再倒扣额外奖励，重试按次扣分", () => {
  const slow = computeScore({ timeSeconds: 999, accuracy: 0, kills: 0, retries: 0 });
  assert.equal(slow, COMPLETION_BASE);
  const withRetry = computeScore({ timeSeconds: TIME_BONUS_CAP, accuracy: 0, kills: 0, retries: 1 });
  assert.equal(withRetry, COMPLETION_BASE - RETRY_PENALTY);
});

test("命中率与击杀都是正向权重，且分数为整数、不跌破保底", () => {
  assert.equal(KILL_SCORE > 0, true);
  assert.equal(ACCURACY_SCORE > 0, true);
  const worst = computeScore({ timeSeconds: 9999, accuracy: null, kills: 0, retries: 99 });
  assert.equal(worst, MIN_SCORE);
  const score = computeScore({ timeSeconds: 123.4, accuracy: 0.333, kills: 3.9, retries: 1.2 });
  assert.equal(Number.isInteger(score), true);
});

test("解析完整简报到计分，缺用时视为无效", () => {
  const stats = parseDebrief({ time: "04:20", accuracy: "50%", kills: "9", retries: "0" });
  assert.deepEqual(stats, { timeSeconds: 260, accuracy: 0.5, kills: 9, retries: 0 });
  assert.equal(parseDebrief({ time: "—", accuracy: "50%", kills: "9", retries: "0" }), null);
});

test("分数显示带千分位", () => {
  assert.equal(formatScore(3544), "3,544");
  assert.equal(formatScore(0), "0");
});
