import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's built-in TypeScript test runner requires the explicit extension.
import { advancePhraseProgress, advanceTension, completionBonus, finalScore, frameScore, judgeSpeed } from "./rules.ts";
// @ts-expect-error Node's built-in TypeScript test runner requires the explicit extension.
import { normalizeMotionReading } from "./motion.ts";

const PHRASES = [
  { id: "first", name: "初蝉试声", subtitle: "", minRps: 1, maxRps: 2.1, holdSeconds: 4.5, accent: "#fff" },
  { id: "second", name: "竹影和鸣", subtitle: "", minRps: 1.8, maxRps: 2.9, holdSeconds: 6.5, accent: "#fff" },
];

test("圈速判定覆盖静止、过慢、稳定、过快和危险区", () => {
  const phrase = PHRASES[1];
  assert.equal(judgeSpeed(0.2, 0.8, phrase), "silent");
  assert.equal(judgeSpeed(1.3, 0.8, phrase), "slow");
  assert.equal(judgeSpeed(1.8, 0.8, phrase), "steady");
  assert.equal(judgeSpeed(2.9, 0.8, phrase), "steady");
  assert.equal(judgeSpeed(3.4, 0.8, phrase), "fast");
  assert.equal(judgeSpeed(4.8, 0.8, phrase), "danger");
});

test("稳定鸣叫推进乐句，偏离目标会缓慢回退但不越界", () => {
  const phrase = PHRASES[0];
  const advanced = advancePhraseProgress(0, "steady", phrase.holdSeconds / 2, phrase);
  assert.equal(advanced, 0.5);
  assert.equal(advancePhraseProgress(advanced, "slow", 1, phrase) < advanced, true);
  assert.equal(advancePhraseProgress(0, "danger", 10, phrase), 0);
  assert.equal(advancePhraseProgress(0.9, "steady", 10, phrase), 1);
});

test("危险圈速累计绳索张力，恢复速度后张力下降", () => {
  const stressed = advanceTension(0, 5.2, 1.4);
  assert.equal(stressed > 0.5, true);
  assert.equal(advanceTension(stressed, 2.2, 0.5) < stressed, true);
  assert.equal(advanceTension(0.9, 7, 3), 1);
});

test("只有稳定区产生持续得分，乐句和终局奖励始终为非负整数", () => {
  assert.equal(frameScore(1, 2, 5, "slow"), 0);
  assert.equal(frameScore(1, 2, 5, "steady") > 0, true);
  assert.equal(completionBonus(2, 12) > completionBonus(0, 0), true);
  assert.equal(Number.isInteger(finalScore(1200.4, 12.3, 9)), true);
  assert.equal(finalScore(-100, 0, 0), 0);
});

test("体感归一化过滤静止与轻微抖动，并限制到 0–1", () => {
  const stationary = normalizeMotionReading({
    rotationRate: { alpha: 3, beta: -2, gamma: 1 },
    accelerationIncludingGravity: { x: 0, y: 0, z: 9.81 },
  });
  assert.equal(stationary.intensity, 0);

  const swing = normalizeMotionReading({
    rotationRate: { alpha: 84, beta: 20, gamma: -12 },
    acceleration: { x: 3.2, y: 1.4, z: 0.2 },
  });
  assert.equal(swing.intensity > 0, true);
  assert.equal(swing.intensity < 1, true);

  const extreme = normalizeMotionReading({
    rotationRate: { alpha: 600, beta: 400, gamma: 200 },
    acceleration: { x: 40, y: 20, z: 10 },
  });
  assert.equal(extreme.intensity, 1);
});

test("体感方向跟随最强旋转轴，无旋转率时回退到加速度方向", () => {
  assert.equal(normalizeMotionReading({ rotationRate: { alpha: 10, beta: -120, gamma: 30 } }).direction, -1);
  assert.equal(normalizeMotionReading({
    rotationRate: { alpha: null, beta: null, gamma: null },
    acceleration: { x: 1, y: 8, z: 0 },
  }).direction, 1);
  assert.equal(normalizeMotionReading({
    rotationRate: { alpha: null, beta: null, gamma: null },
    acceleration: { x: -9, y: 2, z: 0 },
  }).direction, -1);
});
