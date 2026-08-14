import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node 的内置 TypeScript 测试运行器需要显式扩展名。
import { GO_MODELS, getDefaultGoModelTier, normalizeNeuralAnalysis, toNeuralBoard, toNeuralMoves } from "./goNeuralAi.ts";
import type { KataGoAnalysisPayload } from "./neural/engine/types.ts";
import type { Stone } from "./types.ts";

test("棋盘与停一手历史能转换成神经引擎坐标", () => {
  const board = Array(81).fill(0) as Stone[];
  board[0] = 1;
  board[10] = 2;
  assert.equal(toNeuralBoard(board, 9)[0][0], "black");
  assert.equal(toNeuralBoard(board, 9)[1][1], "white");
  assert.deepEqual(toNeuralMoves([{ index: 10, color: 2 }, { index: null, color: 1 }], 9), [
    { x: 1, y: 1, player: "white" },
    { x: -1, y: -1, player: "black" },
  ]);
});

test("神经分析按 order 选择最佳着并保留黑方评估", () => {
  const analysis = {
    rootWinRate: .73,
    rootScoreLead: 8.5,
    rootVisits: 128,
    moves: [
      { x: 7, y: 7, order: 2 },
      { x: 3, y: 4, order: 0 },
    ],
  } as KataGoAnalysisPayload;
  assert.deepEqual(normalizeNeuralAnalysis(analysis, 9, "wasm", "test-model"), {
    index: 39,
    blackWinRate: .73,
    blackScoreLead: 8.5,
    visits: 128,
    backend: "wasm",
    modelName: "test-model",
  });
});

test("神经分析中的停一手和未知后端会安全归一化", () => {
  const analysis = {
    rootWinRate: 1.4,
    rootScoreLead: -2,
    rootVisits: 12,
    moves: [{ x: -1, y: -1, order: 0 }],
  } as KataGoAnalysisPayload;
  const result = normalizeNeuralAnalysis(analysis, 9, "unknown", undefined);
  assert.equal(result.index, null);
  assert.equal(result.blackWinRate, 1);
  assert.equal(result.backend, "cpu");
});

test("桌面设备默认使用 96MB 高棋力模型", () => {
  assert.equal(getDefaultGoModelTier({
    viewportWidth: 1440,
    coarsePointer: false,
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  }), "high");
});

test("窄屏、粗指针和移动端 UA 默认使用轻量模型", () => {
  assert.equal(getDefaultGoModelTier({ viewportWidth: 760, coarsePointer: false, userAgent: "desktop" }), "small");
  assert.equal(getDefaultGoModelTier({ viewportWidth: 1440, coarsePointer: true, userAgent: "desktop" }), "small");
  assert.equal(getDefaultGoModelTier({ viewportWidth: 1024, coarsePointer: false, userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)" }), "small");
});

test("双模型配置使用固定版本 URL 和准确文件大小", () => {
  assert.deepEqual(GO_MODELS.small, {
    label: "轻量模型",
    shortLabel: "轻量",
    sizeBytes: 3_827_339,
    url: "/assets/go/models/katago-small.bin.gz?v=f5d32604",
  });
  assert.deepEqual(GO_MODELS.high, {
    label: "96MB 高棋力模型",
    shortLabel: "高棋力",
    sizeBytes: 97_898_094,
    url: "/api/go-model/high?v=kata1-b18c384nbt-s9996604416-d4316597426",
  });
});
