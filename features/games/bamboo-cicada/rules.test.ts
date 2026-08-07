import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's built-in TypeScript test runner requires the explicit extension.
import { advancePhraseProgress, advanceTension, completionBonus, finalScore, frameScore, judgeSpeed } from "./rules.ts";

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
