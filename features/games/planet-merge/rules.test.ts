import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's built-in TypeScript test runner requires the explicit extension.
import { createPlanetLayout } from "./data.ts";

test("竖屏布局占满手机高度并保持星仓边界有效", () => {
  const layout = createPlanetLayout(390, 786);
  assert.equal(layout.portrait, true);
  assert.equal(layout.width, 540);
  assert.equal(layout.height, 1088);
  assert.ok(layout.binLeft < layout.binRight);
  assert.ok(layout.dropY < layout.warningY);
  assert.ok(layout.warningY < layout.binFloor);
});

test("桌面布局保持横屏世界且按容器补足纵向区域", () => {
  const layout = createPlanetLayout(1080, 670);
  assert.equal(layout.portrait, false);
  assert.equal(layout.width, 960);
  assert.equal(layout.height, 596);
  assert.equal(layout.binLeft, 240);
  assert.equal(layout.binRight, 720);
});

test("极端长屏会限制世界高度并保持警戒线在星仓内部", () => {
  const layout = createPlanetLayout(320, 900);
  assert.equal(layout.height, 1120);
  assert.ok(layout.warningY > layout.binTop);
  assert.ok(layout.warningY < layout.binFloor);
});
