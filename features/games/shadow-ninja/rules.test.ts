import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node 内置 TypeScript 测试运行器要求显式扩展名。
import { BLOCK_DAMAGE_RATE, COMBO_FLOOR, GUARD_MAX, canBlock, chakraFromDealing, chakraFromTaking, clampChakra, comboMultiplier, computeScore, guardAfter, guardCost, isGuardBroken, matchDecided, recoverGuard, roundOutcome, scaledDamage } from "./rules.ts";

test("连击倍率递减且不低于下限", () => {
  assert.equal(comboMultiplier(0), 1);
  assert.ok(comboMultiplier(1) < comboMultiplier(0));
  assert.ok(comboMultiplier(2) < comboMultiplier(1));
  assert.ok(comboMultiplier(20) >= COMBO_FLOOR);
  assert.ok(comboMultiplier(50) <= comboMultiplier(3));
  for (let i = 0; i <= 30; i += 1) {
    assert.ok(comboMultiplier(i) >= COMBO_FLOOR && comboMultiplier(i) <= 1);
  }
});

test("伤害随连击段数衰减，且始终为正整数", () => {
  const first = scaledDamage(20, 0);
  const later = scaledDamage(20, 5);
  assert.ok(later < first);
  assert.ok(later > 0);
  assert.ok(Number.isInteger(first) && Number.isInteger(later));
  assert.equal(scaledDamage(0, 3), 0);
});

test("防御成立要求着地、非攻击、非硬直、按住防御且有护盾", () => {
  const base = { grounded: true, attacking: false, hitstun: 0, holdingGuard: true, guard: 60 };
  assert.equal(canBlock(base), true);
  assert.equal(canBlock({ ...base, grounded: false }), false, "空中不可防御");
  assert.equal(canBlock({ ...base, attacking: true }), false);
  assert.equal(canBlock({ ...base, hitstun: 6 }), false);
  assert.equal(canBlock({ ...base, holdingGuard: false }), false);
  assert.equal(canBlock({ ...base, guard: 0 }), false);
});

test("护盾消耗与回复被限制在 0–100，破防只在归零时成立", () => {
  assert.ok(guardCost(30) > guardCost(10));
  assert.ok(guardCost(0) > 0, "即使零伤害也有最低消耗");
  assert.equal(guardAfter(50, 30) < 50, true);
  assert.equal(guardAfter(5, 200), 0);
  assert.ok(guardAfter(100, 0) <= GUARD_MAX);
  assert.equal(isGuardBroken(0), true);
  assert.equal(isGuardBroken(0.5), false);
  assert.equal(recoverGuard(90, 30), GUARD_MAX);
  assert.equal(recoverGuard(0, 5), 5);
});

test("查克拉：命中全额、被防半额、挨打按比例回收，且不超上限", () => {
  assert.equal(chakraFromDealing(10, false), 10);
  assert.equal(chakraFromDealing(10, true), 5);
  assert.equal(chakraFromDealing(-5, false), 0);
  assert.ok(chakraFromTaking(20) > 0 && chakraFromTaking(20) < 20);
  assert.equal(clampChakra(130), 100);
  assert.equal(clampChakra(-3), 0);
});

test("回合结算：KO 优先、血多者胜、同血与双 KO 判平", () => {
  assert.deepEqual(roundOutcome(0, 80, 12), { winner: 1, reason: "ko" });
  assert.deepEqual(roundOutcome(120, 0, 30), { winner: 0, reason: "ko" });
  assert.deepEqual(roundOutcome(0, 0, 0), { winner: -1, reason: "double-ko" });
  assert.deepEqual(roundOutcome(90, 40, 0), { winner: 0, reason: "time" });
  assert.deepEqual(roundOutcome(30, 70, 0), { winner: 1, reason: "time" });
  assert.equal(roundOutcome(50, 50, 0).winner, -1);
});

test("三局两胜：任一方先拿到两胜即结束", () => {
  assert.equal(matchDecided([0, 0]), false);
  assert.equal(matchDecided([1, 1]), false);
  assert.equal(matchDecided([2, 0]), true);
  assert.equal(matchDecided([1, 2]), true);
});

test("结算分数：胜场、伤害、连击、剩余时间与完胜都为正收益", () => {
  const base = {
    win: false,
    wins: [0, 2] as [number, number],
    damageDealt: 180,
    maxCombo: 4,
    timeLeft: 0,
    perfect: false,
  };
  const lose = computeScore(base);
  const win = computeScore({ ...base, win: true });
  const perfect = computeScore({ ...base, win: true, perfect: true });
  const moreDamage = computeScore({ ...base, win: true, damageDealt: 320 });
  const moreTime = computeScore({ ...base, win: true, timeLeft: 38 });

  assert.ok(win > lose, "胜利必须高于失败");
  assert.ok(perfect >= win, "完胜不得低于普通胜利");
  assert.ok(moreDamage > win);
  assert.ok(moreTime > win);
  assert.ok(lose >= 0);
  for (const value of [lose, win, perfect, moreDamage, moreTime]) {
    assert.equal(Number.isInteger(value), true);
    assert.ok(value >= 0);
  }
});

test("防御造成的伤害低于直接命中，且不低于 1 点被防伤害以外的量级", () => {
  assert.ok(BLOCK_DAMAGE_RATE > 0 && BLOCK_DAMAGE_RATE < 1);
});
