import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node 的内置 TypeScript 测试运行器需要显式扩展名。
import { ROAD_PATH } from "./data.ts";
// @ts-expect-error Node 的内置 TypeScript 测试运行器需要显式扩展名。
import { calculateScore, canAfford, damageMultiplier, nearestRoadDistance, pathLength, pickDecreeChoices, pointAtDistance, selectFrontEnemy } from "./rules.ts";
import type { Enemy } from "./types.ts";

test("资源判断覆盖足额、不足和非法花费", () => {
  assert.equal(canAfford(160, 160), true);
  assert.equal(canAfford(159, 160), false);
  assert.equal(canAfford(100, -1), false);
});

test("兵种克制与分支升级产生可感知差异", () => {
  assert.ok(damageMultiplier("spear", "cavalry") > 1);
  assert.ok(damageMultiplier("spear", "cavalry", "phalanx") > damageMultiplier("spear", "cavalry"));
  assert.ok(damageMultiplier("catapult", "shield", "thunder") > damageMultiplier("archer", "shield"));
  assert.ok(damageMultiplier("archer", "siege", "fire") > 1);
});

test("路径插值覆盖起点、中段和终点", () => {
  const length = pathLength();
  assert.deepEqual(pointAtDistance(0), { ...ROAD_PATH[0], angle: pointAtDistance(0).angle });
  assert.notDeepEqual(pointAtDistance(length / 2), ROAD_PATH[0]);
  assert.deepEqual({ x: pointAtDistance(length + 999).x, y: pointAtDistance(length + 999).y }, ROAD_PATH.at(-1));
});

test("火攻目标必须靠近道路", () => {
  assert.ok(nearestRoadDistance({ x: ROAD_PATH[4].x, y: ROAD_PATH[4].y }) < 1);
  assert.ok(nearestRoadDistance({ x: 520, y: 20 }) > 100);
});

test("防御塔优先锁定射程内最靠前敌军", () => {
  const base = { type: "infantry", hp: 10, maxHp: 10, speed: 1, reward: 1, castleDamage: 1, dead: false, burnTime: 0, burnTick: 0, slowTime: 0, hitFlash: 0, phase: 1 } as const;
  const enemies: Enemy[] = [{ ...base, id: 1, progress: 20 }, { ...base, id: 2, progress: 40 }, { ...base, id: 3, progress: 80 }];
  const positions = new Map([[1, { x: 10, y: 0 }], [2, { x: 20, y: 0 }], [3, { x: 200, y: 0 }]]);
  assert.equal(selectFrontEnemy(enemies, positions, { x: 0, y: 0 }, 60)?.id, 2);
});

test("军令选择不重复已拥有内容且固定种子可复现", () => {
  const ids = ["a", "b", "c", "d", "e"];
  const first = pickDecreeChoices(ids, new Set(["b"]), 42);
  assert.deepEqual(first, pickDecreeChoices(ids, new Set(["b"]), 42));
  assert.equal(first.includes("b"), false);
  assert.equal(new Set(first).size, 3);
});

test("结算分数非负且城门、击杀和波次均能提高分数", () => {
  const base = calculateScore(0, 0, 0, 0);
  assert.equal(base, 0);
  assert.ok(calculateScore(10, 100, 5, 2) > calculateScore(5, 50, 2, 1));
});
