import type { BoardSize, PlayerStone, Stone } from "./types";
import type { KataGoAnalysisPayload, KataGoWorkerResponse } from "./neural/engine/types";
import type { BoardState, KataGoBackendPreference, Move, Player } from "./neural/types";

const PREFERRED_BACKEND: KataGoBackendPreference = "webgpu";

export type GoModelTier = "small" | "high";
export type GoModelCacheStatus = "hit" | "stored" | "unavailable";
export type GoModelProgress = {
  stage: "checking-cache" | "reading-cache" | "downloading" | "storing-cache" | "parsing" | "warming-up";
  loadedBytes: number;
  totalBytes: number;
};

export const GO_MODEL_STORAGE_KEY = "ac-game:go-model-tier";
export const GO_MODELS: Record<GoModelTier, { label: string; shortLabel: string; sizeBytes: number; url: string }> = {
  small: {
    label: "轻量模型",
    shortLabel: "轻量",
    sizeBytes: 3_827_339,
    url: "/assets/go/models/katago-small.bin.gz?v=f5d32604",
  },
  high: {
    label: "96MB 高棋力模型",
    shortLabel: "高棋力",
    sizeBytes: 97_898_094,
    url: "/api/go-model/high?v=kata1-b18c384nbt-s9996604416-d4316597426",
  },
};

export type GoMoveRecord = {
  index: number | null;
  color: PlayerStone;
};

export type NeuralEngineInfo = {
  backend: "webgpu" | "wasm" | "cpu";
  modelName: string;
  cacheStatus: GoModelCacheStatus;
};

export type NeuralAiResult = Pick<NeuralEngineInfo, "backend" | "modelName"> & {
  index: number | null;
  blackWinRate: number;
  blackScoreLead: number;
  visits: number;
};

type PendingAnalysis = {
  resolve: (result: NeuralAiResult) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  size: BoardSize;
};

const colorToPlayer = (color: PlayerStone): Player => color === 1 ? "black" : "white";

export function getDefaultGoModelTier(args: {
  viewportWidth: number;
  coarsePointer: boolean;
  userAgent: string;
}): GoModelTier {
  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(args.userAgent);
  return args.viewportWidth <= 760 || args.coarsePointer || mobileUserAgent ? "small" : "high";
}

export function toNeuralBoard(board: Stone[], size: BoardSize): BoardState {
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => {
    const stone = board[row * size + col];
    return stone === 1 ? "black" : stone === 2 ? "white" : null;
  }));
}

export function toNeuralMoves(records: GoMoveRecord[], size: BoardSize): Move[] {
  return records.map(({ index, color }) => ({
    x: index === null ? -1 : index % size,
    y: index === null ? -1 : Math.floor(index / size),
    player: colorToPlayer(color),
  }));
}

export function normalizeNeuralAnalysis(
  analysis: KataGoAnalysisPayload,
  size: BoardSize,
  backend: string | undefined,
  modelName: string | undefined,
): NeuralAiResult {
  const best = [...analysis.moves].sort((left, right) => left.order - right.order)[0];
  const index = best && best.x >= 0 && best.y >= 0 && best.x < size && best.y < size
    ? best.y * size + best.x
    : null;
  const normalizedBackend = backend === "webgpu" || backend === "wasm" ? backend : "cpu";
  return {
    index,
    blackWinRate: Math.max(0, Math.min(1, analysis.rootWinRate)),
    blackScoreLead: analysis.rootScoreLead,
    visits: analysis.rootVisits,
    backend: normalizedBackend,
    modelName: modelName || "KataGo small",
  };
}

export class GoNeuralAiClient {
  private worker: Worker;
  private nextId = 1;
  private pendingInit: Promise<NeuralEngineInfo> | null = null;
  private initResolve: ((value: NeuralEngineInfo) => void) | null = null;
  private initReject: ((reason: Error) => void) | null = null;
  private analyses = new Map<number, PendingAnalysis>();
  private destroyed = false;
  private modelTier: GoModelTier;
  private modelUrl: string;
  private onProgress?: (progress: GoModelProgress) => void;

  constructor(args: { modelTier: GoModelTier; onProgress?: (progress: GoModelProgress) => void }) {
    this.modelTier = args.modelTier;
    this.modelUrl = GO_MODELS[args.modelTier].url;
    this.onProgress = args.onProgress;
    this.worker = new Worker(new URL("./neural/engine/worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<KataGoWorkerResponse>) => this.handleMessage(event.data);
    this.worker.onerror = () => this.failAll(new Error("神经引擎 Worker 启动失败"));
  }

  private handleMessage(message: KataGoWorkerResponse) {
    if (message.type === "katago:model_progress") {
      if (message.modelUrl === this.modelUrl) this.onProgress?.({
        stage: message.stage,
        loadedBytes: message.loadedBytes,
        totalBytes: message.totalBytes || GO_MODELS[this.modelTier].sizeBytes,
      });
      return;
    }
    if (message.type === "katago:init_result") {
      if (message.ok) {
        this.initResolve?.({
          backend: message.backend === "webgpu" || message.backend === "wasm" ? message.backend : "cpu",
          modelName: message.modelName || GO_MODELS[this.modelTier].label,
          cacheStatus: message.cacheStatus || "unavailable",
        });
      } else {
        this.initReject?.(new Error(message.error || "神经模型初始化失败"));
      }
      this.initResolve = null;
      this.initReject = null;
      return;
    }
    if (message.type !== "katago:analyze_result") return;
    const pending = this.analyses.get(message.id);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.analyses.delete(message.id);
    if (!message.ok || !message.analysis) {
      pending.reject(new Error(message.error || "神经搜索失败"));
      return;
    }
    pending.resolve(normalizeNeuralAnalysis(message.analysis, pending.size, message.backend, message.modelName));
  }

  init(): Promise<NeuralEngineInfo> {
    if (this.pendingInit) return this.pendingInit;
    this.pendingInit = new Promise<NeuralEngineInfo>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.initResolve = null;
        this.initReject = null;
        reject(new Error("神经模型加载超时"));
      }, this.modelTier === "high" ? 180_000 : 30_000);
      this.initResolve = (value) => { clearTimeout(timeout); resolve(value); };
      this.initReject = (reason) => { clearTimeout(timeout); reject(reason); };
      this.worker.postMessage({ type: "katago:init", modelUrl: this.modelUrl, backend: PREFERRED_BACKEND });
    });
    return this.pendingInit;
  }

  async analyze(args: {
    board: Stone[];
    boardHistory: Stone[][];
    moveHistory: GoMoveRecord[];
    color: PlayerStone;
    size: BoardSize;
    maxTimeMs?: number;
  }): Promise<NeuralAiResult> {
    if (this.destroyed) throw new Error("神经引擎已经关闭");
    await this.init();
    const id = this.nextId++;
    const maxTimeMs = Math.min(3_000, Math.max(400, args.maxTimeMs ?? 2_600));
    const currentIndex = args.boardHistory.length - 1;
    const previous = currentIndex > 0 ? args.boardHistory[currentIndex - 1] : undefined;
    const previousPrevious = currentIndex > 1 ? args.boardHistory[currentIndex - 2] : undefined;

    return new Promise<NeuralAiResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.analyses.delete(id);
        reject(new Error("神经搜索超时"));
      }, maxTimeMs + 3_000);
      this.analyses.set(id, { resolve, reject, timeout, size: args.size });
      this.worker.postMessage({
        type: "katago:analyze",
        id,
        analysisGroup: "interactive",
        modelUrl: this.modelUrl,
        backend: PREFERRED_BACKEND,
        board: toNeuralBoard(args.board, args.size),
        previousBoard: previous ? toNeuralBoard(previous, args.size) : undefined,
        previousPreviousBoard: previousPrevious ? toNeuralBoard(previousPrevious, args.size) : undefined,
        currentPlayer: colorToPlayer(args.color),
        moveHistory: toNeuralMoves(args.moveHistory, args.size),
        komi: args.size === 9 ? 5.5 : 7.5,
        rules: "chinese",
        topK: 12,
        analysisPvLen: 8,
        includeMovesOwnership: false,
        wideRootNoise: 0.02,
        nnRandomize: false,
        conservativePass: true,
        visits: args.size === 9 ? 480 : 360,
        maxTimeMs,
        maxChildren: args.size === 9 ? 81 : 96,
        reuseTree: false,
        ownershipMode: "none",
      });
    });
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.worker.terminate();
    this.failAll(new Error("神经引擎已关闭"));
  }

  private failAll(reason: Error) {
    this.initReject?.(reason);
    this.initResolve = null;
    this.initReject = null;
    for (const pending of this.analyses.values()) {
      clearTimeout(pending.timeout);
      pending.reject(reason);
    }
    this.analyses.clear();
  }
}
