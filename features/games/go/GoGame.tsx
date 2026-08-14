"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gameAudio } from "@/lib/audio/gameAudio";
import type { MiniGameProps } from "../types";
import { LifeDeathMode } from "./LifeDeathMode";
import { GO_MODELS, GO_MODEL_STORAGE_KEY, GoNeuralAiClient, getDefaultGoModelTier, type GoModelCacheStatus, type GoModelProgress, type GoModelTier, type GoMoveRecord, type NeuralAiResult } from "./goNeuralAi";
import { boardHash, otherColor, playMove, scoreBoard, starPoints } from "./goRules";
import type { BoardSize, Captures, MatchResult, PlayerStone, Stone } from "./types";
import styles from "./GoGame.module.css";

const EMPTY_CAPTURES: Captures = { black: 0, white: 0 };
const colorName = (color: PlayerStone) => color === 1 ? "黑棋" : "白棋";
type AiEngineStatus =
  | { mode: "loading" }
  | { mode: "neural"; backend: "webgpu" | "wasm" | "cpu"; modelName: string; cacheStatus: GoModelCacheStatus }
  | { mode: "fallback"; reason: string };

const backendName = (backend: "webgpu" | "wasm" | "cpu") => backend === "webgpu" ? "WebGPU" : backend === "wasm" ? "WASM" : "CPU";

export function GoGame({ bestScore, onScore }: MiniGameProps) {
  const [mode, setMode] = useState<"match" | "life-death">("match");
  const [setupSize, setSetupSize] = useState<BoardSize>(9);
  const [setupColor, setSetupColor] = useState<PlayerStone>(1);
  const [size, setSize] = useState<BoardSize>(9);
  const [board, setBoard] = useState<Stone[]>(() => Array(81).fill(0) as Stone[]);
  const [boardHistory, setBoardHistory] = useState<Stone[][]>(() => [Array(81).fill(0) as Stone[]]);
  const [moveHistory, setMoveHistory] = useState<GoMoveRecord[]>([]);
  const [turn, setTurn] = useState<PlayerStone>(1);
  const [playerColor, setPlayerColor] = useState<PlayerStone>(1);
  const [history, setHistory] = useState<string[]>(["0".repeat(81)]);
  const [captures, setCaptures] = useState<Captures>(EMPTY_CAPTURES);
  const [passes, setPasses] = useState(0);
  const [moveNumber, setMoveNumber] = useState(0);
  const [lastMove, setLastMove] = useState<number | null>(null);
  const [status, setStatus] = useState<"intro" | "playing" | "finished">("intro");
  const [thinking, setThinking] = useState(false);
  const [message, setMessage] = useState("黑棋先行");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [engineStatus, setEngineStatus] = useState<AiEngineStatus>({ mode: "loading" });
  const [modelTier, setModelTier] = useState<GoModelTier | null>(null);
  const [modelProgress, setModelProgress] = useState<GoModelProgress | null>(null);
  const aiTimer = useRef<number | null>(null);
  const fallbackWorker = useRef<Worker | null>(null);
  const neuralClient = useRef<GoNeuralAiClient | null>(null);
  const aiRequestId = useRef(0);
  const stars = useMemo(() => starPoints(size), [size]);
  const aiColor = otherColor(playerColor);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = window.localStorage.getItem(GO_MODEL_STORAGE_KEY);
      const nextTier = stored === "small" || stored === "high"
        ? stored
        : getDefaultGoModelTier({
          viewportWidth: window.innerWidth,
          coarsePointer: window.matchMedia("(pointer: coarse)").matches,
          userAgent: window.navigator.userAgent,
        });
      setEngineStatus({ mode: "loading" });
      setModelProgress({ stage: "checking-cache", loadedBytes: 0, totalBytes: GO_MODELS[nextTier].sizeBytes });
      setModelTier(nextTier);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!modelTier) return;
    let active = true;
    const client = new GoNeuralAiClient({
      modelTier,
      onProgress: (progress) => { if (active) setModelProgress(progress); },
    });
    neuralClient.current = client;
    client.init().then((info) => {
      if (!active) return;
      setEngineStatus({ mode: "neural", ...info });
      setModelProgress(null);
    }).catch((error: unknown) => {
      if (!active) return;
      setEngineStatus({ mode: "fallback", reason: error instanceof Error ? error.message : "神经引擎不可用" });
      setModelProgress(null);
      client.destroy();
      if (neuralClient.current === client) neuralClient.current = null;
    });
    return () => {
      active = false;
      client.destroy();
      if (neuralClient.current === client) neuralClient.current = null;
    };
  }, [modelTier]);

  useEffect(() => () => {
    if (aiTimer.current !== null) window.clearTimeout(aiTimer.current);
    fallbackWorker.current?.terminate();
  }, []);

  if (mode === "life-death") return <LifeDeathMode bestScore={bestScore} onScore={onScore} onBack={() => setMode("match")} />;

  const finishByScore = (finalBoard: Stone[], finalSize = size, currentPlayerColor = playerColor) => {
    const score = scoreBoard(finalBoard, finalSize);
    const winner: PlayerStone = score.black > score.white ? 1 : 2;
    const matchResult: MatchResult = { ...score, winner, reason: "score" };
    setResult(matchResult);
    setStatus("finished");
    setThinking(false);
    const won = winner === currentPlayerColor;
    gameAudio.play(won ? "win" : "mismatch");
    if (won) onScore((finalSize === 19 ? 5000 : 1800) + Math.max(0, Math.round(Math.abs(score.black - score.white) * 20)));
  };

  const scheduleAi = (
    currentBoard: Stone[],
    hashes: string[],
    currentPasses: number,
    currentCaptures: Captures,
    currentMove: number,
    currentSize: BoardSize,
    currentPlayerColor: PlayerStone,
    currentBoardHistory: Stone[][],
    currentMoveHistory: GoMoveRecord[],
  ) => {
    const computerColor = otherColor(currentPlayerColor);
    setThinking(true);
    setMessage(engineStatus.mode === "loading" ? "正在加载神经棋力模型…" : currentSize === 9 ? "电脑正在推演攻防…" : "电脑正在搜索全局棋形…");
    aiTimer.current = window.setTimeout(() => {
      const requestId = ++aiRequestId.current;
      const finishAiMove = (index: number | null, neuralResult: NeuralAiResult | null) => {
        if (requestId !== aiRequestId.current) return;
        fallbackWorker.current?.terminate();
        fallbackWorker.current = null;
        if (index === null) {
          const nextPasses = currentPasses + 1;
          setBoardHistory([...currentBoardHistory, currentBoard]);
          setMoveHistory([...currentMoveHistory, { index: null, color: computerColor }]);
          setPasses(nextPasses);
          setLastMove(null);
          setMoveNumber(currentMove + 1);
          if (nextPasses >= 2) { finishByScore(currentBoard, currentSize, currentPlayerColor); return; }
          setTurn(currentPlayerColor);
          setThinking(false);
          setMessage("对手停一手，轮到你");
          return;
        }
        const move = playMove(currentBoard, index, computerColor, currentSize, hashes);
        if (!move.legal) {
          if (neuralResult) {
            runFallback("神经着法未通过本地规则校验");
            return;
          }
          setTurn(currentPlayerColor);
          setThinking(false);
          setMessage("轮到你落子");
          return;
        }
        const nextCaptures = { ...currentCaptures };
        if (computerColor === 1) nextCaptures.black += move.captured;
        else nextCaptures.white += move.captured;
        setBoard(move.board);
        setHistory([...hashes, boardHash(move.board)]);
        setBoardHistory([...currentBoardHistory, move.board]);
        setMoveHistory([...currentMoveHistory, { index, color: computerColor }]);
        setCaptures(nextCaptures);
        setPasses(0);
        setMoveNumber(currentMove + 1);
        setLastMove(index);
        setTurn(currentPlayerColor);
        setThinking(false);
        setMessage(move.captured ? `对手提走 ${move.captured} 子，轮到你` : "轮到你落子");
        gameAudio.play(move.captured ? "score" : "tap");
      };

      const runFallback = (reason: string) => {
        if (requestId !== aiRequestId.current) return;
        setEngineStatus({ mode: "fallback", reason });
        setMessage("神经引擎不可用，正在切换轻量 MCTS…");
        fallbackWorker.current?.terminate();
        const worker = new Worker(new URL("./goAi.worker.ts", import.meta.url), { type: "module" });
        fallbackWorker.current = worker;
        worker.onmessage = (event: MessageEvent<{ id: number; index: number | null }>) => {
          if (event.data.id === requestId) finishAiMove(event.data.index, null);
        };
        worker.onerror = () => {
          if (requestId !== aiRequestId.current) return;
          worker.terminate();
          fallbackWorker.current = null;
          setThinking(false);
          setTurn(currentPlayerColor);
          setMessage("电脑思考中断，已轮到你");
        };
        worker.postMessage({ id: requestId, board: currentBoard, color: computerColor, size: currentSize, hashes, moveNumber: currentMove });
      };

      const client = neuralClient.current;
      if (!client) {
        runFallback(engineStatus.mode === "fallback" ? engineStatus.reason : "神经引擎尚未就绪");
        return;
      }
      client.analyze({
        board: currentBoard,
        boardHistory: currentBoardHistory,
        moveHistory: currentMoveHistory,
        color: computerColor,
        size: currentSize,
        maxTimeMs: 2_600,
      }).then((neuralResult) => {
        if (requestId !== aiRequestId.current) return;
        setEngineStatus((previous) => ({
          mode: "neural",
          backend: neuralResult.backend,
          modelName: neuralResult.modelName,
          cacheStatus: previous.mode === "neural" ? previous.cacheStatus : "unavailable",
        }));
        finishAiMove(neuralResult.index, neuralResult);
      }).catch((error: unknown) => {
        runFallback(error instanceof Error ? error.message : "神经搜索失败");
      });
    }, 360);
  };

  const cancelAi = () => {
    aiRequestId.current += 1;
    if (aiTimer.current !== null) window.clearTimeout(aiTimer.current);
    aiTimer.current = null;
    fallbackWorker.current?.terminate();
    fallbackWorker.current = null;
  };

  const start = () => {
    cancelAi();
    const nextBoard = Array(setupSize * setupSize).fill(0) as Stone[];
    const hashes = [boardHash(nextBoard)];
    setSize(setupSize);
    setBoard(nextBoard);
    setHistory(hashes);
    setBoardHistory([nextBoard]);
    setMoveHistory([]);
    setPlayerColor(setupColor);
    setTurn(1);
    setCaptures({ ...EMPTY_CAPTURES });
    setPasses(0);
    setMoveNumber(0);
    setLastMove(null);
    setResult(null);
    setStatus("playing");
    setThinking(false);
    gameAudio.play("start");
    if (setupColor === 2) scheduleAi(nextBoard, hashes, 0, { ...EMPTY_CAPTURES }, 0, setupSize, setupColor, [nextBoard], []);
    else setMessage("你执黑棋，请落子");
  };

  const placeStone = (index: number) => {
    if (status !== "playing" || thinking || turn !== playerColor) return;
    const move = playMove(board, index, playerColor, size, history);
    if (!move.legal) {
      setMessage(move.reason === "suicide" ? "这里是禁入点" : move.reason === "ko" ? "劫争不能立即回提" : "这里已经有棋子");
      gameAudio.play("miss");
      return;
    }
    const nextCaptures = { ...captures };
    if (playerColor === 1) nextCaptures.black += move.captured;
    else nextCaptures.white += move.captured;
    const hashes = [...history, boardHash(move.board)];
    const nextBoardHistory = [...boardHistory, move.board];
    const nextMoveHistory = [...moveHistory, { index, color: playerColor }];
    const nextMove = moveNumber + 1;
    setBoard(move.board);
    setHistory(hashes);
    setBoardHistory(nextBoardHistory);
    setMoveHistory(nextMoveHistory);
    setCaptures(nextCaptures);
    setPasses(0);
    setMoveNumber(nextMove);
    setLastMove(index);
    setTurn(aiColor);
    setMessage(move.captured ? `提走 ${move.captured} 子` : "落子完成");
    gameAudio.play(move.captured ? "score" : "tap");
    scheduleAi(move.board, hashes, 0, nextCaptures, nextMove, size, playerColor, nextBoardHistory, nextMoveHistory);
  };

  const pass = () => {
    if (status !== "playing" || thinking || turn !== playerColor) return;
    const nextPasses = passes + 1;
    const nextBoardHistory = [...boardHistory, board];
    const nextMoveHistory = [...moveHistory, { index: null, color: playerColor }];
    setPasses(nextPasses);
    setBoardHistory(nextBoardHistory);
    setMoveHistory(nextMoveHistory);
    setLastMove(null);
    setMoveNumber((value) => value + 1);
    gameAudio.play("move");
    if (nextPasses >= 2) { finishByScore(board); return; }
    setTurn(aiColor);
    scheduleAi(board, history, nextPasses, captures, moveNumber + 1, size, playerColor, nextBoardHistory, nextMoveHistory);
  };

  const judgeResult = () => {
    if (status !== "playing") return;
    cancelAi();
    finishByScore(board);
  };

  const resign = () => {
    if (status !== "playing" || thinking) return;
    cancelAi();
    const score = scoreBoard(board, size);
    setResult({ ...score, winner: aiColor, reason: "resign" });
    setStatus("finished");
    setThinking(false);
    gameAudio.play("mismatch");
  };

  const openSetup = () => {
    cancelAi();
    setThinking(false);
    setStatus("intro");
  };

  const changeModelTier = (nextTier: GoModelTier) => {
    if (thinking || nextTier === modelTier) return;
    cancelAi();
    window.localStorage.setItem(GO_MODEL_STORAGE_KEY, nextTier);
    setEngineStatus({ mode: "loading" });
    setModelProgress({ stage: "checking-cache", loadedBytes: 0, totalBytes: GO_MODELS[nextTier].sizeBytes });
    setModelTier(nextTier);
    if (status === "playing") setMessage(`正在切换到${GO_MODELS[nextTier].label}…`);
  };

  const currentModel = modelTier ? GO_MODELS[modelTier] : null;
  const progressPercent = modelProgress && modelProgress.totalBytes > 0
    ? Math.min(100, Math.round(modelProgress.loadedBytes / modelProgress.totalBytes * 100))
    : 0;
  const progressText = !modelProgress
    ? ""
    : modelProgress.stage === "checking-cache"
      ? "检查浏览器缓存"
      : modelProgress.stage === "reading-cache"
        ? `读取缓存 ${progressPercent}%`
        : modelProgress.stage === "downloading"
          ? `下载模型 ${progressPercent}%`
          : modelProgress.stage === "storing-cache"
            ? "写入浏览器缓存"
            : modelProgress.stage === "parsing"
              ? "解压并解析模型"
              : "初始化计算后端";

  const engineLabel = engineStatus.mode === "loading"
    ? `${currentModel?.shortLabel || "模型"} · ${progressText || "准备中"}`
    : engineStatus.mode === "neural"
      ? `${currentModel?.shortLabel || "模型"} · KataGo · ${backendName(engineStatus.backend)}`
      : `${currentModel?.shortLabel || "模型"} · MCTS 降级`;
  const engineDetail = engineStatus.mode === "neural"
    ? `${engineStatus.modelName} · ${engineStatus.cacheStatus === "hit" ? "来自浏览器缓存" : engineStatus.cacheStatus === "stored" ? "已下载并缓存" : "本次会话加载"}`
    : engineStatus.mode === "fallback"
      ? engineStatus.reason
      : progressText || "正在准备神经模型";
  const modelStateText = modelProgress
    ? progressText
    : engineStatus.mode === "neural"
      ? engineStatus.cacheStatus === "hit" ? "已从浏览器缓存加载" : engineStatus.cacheStatus === "stored" ? "下载完成，已写入缓存" : "模型已加载"
      : engineStatus.mode === "fallback" ? "神经模型不可用，已安全降级" : "正在识别设备";

  return (
    <div className={styles.game}>
      <div className={styles.ink} aria-hidden="true" />
      <main className={styles.layout}>
        <section className={`${styles.boardShell} ${size === 19 ? styles.standard : ""}`} aria-label={`${size}路围棋棋盘`}>
          <div className={styles.board} style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }} role="grid">
            {board.map((stone, index) => {
              const row = Math.floor(index / size);
              const col = index % size;
              const edgeClasses = [row === 0 ? styles.top : "", row === size - 1 ? styles.bottom : "", col === 0 ? styles.left : "", col === size - 1 ? styles.right : ""].join(" ");
              return <button key={index} className={`${styles.point} ${edgeClasses}`} onClick={() => placeStone(index)} role="gridcell" aria-label={`${row + 1}行${col + 1}列，${stone ? colorName(stone as PlayerStone) : "空位"}`} disabled={status !== "playing" || thinking || turn !== playerColor || stone !== 0}>
                {stars.has(index) && stone === 0 && <i className={styles.star} />}
                {stone !== 0 && <i className={`${styles.stone} ${stone === 1 ? styles.black : styles.white}`}><b>{lastMove === index ? "·" : ""}</b></i>}
              </button>;
            })}
          </div>
        </section>

        <aside className={styles.panel}>
          <header><span>{size} 路棋盘</span><strong>第 {moveNumber + 1} 手</strong></header>
          <div className={`${styles.player} ${turn === 1 && status === "playing" ? styles.active : ""}`}><i className={`${styles.sample} ${styles.black}`} /><span><strong>黑棋</strong><small>{playerColor === 1 ? "你" : "电脑"} · 提子 {captures.black}</small></span></div>
          <div className={`${styles.player} ${turn === 2 && status === "playing" ? styles.active : ""}`}><i className={`${styles.sample} ${styles.white}`} /><span><strong>白棋</strong><small>{playerColor === 2 ? "你" : "电脑"} · 提子 {captures.white}</small></span></div>
          <div className={styles.status}><i className={thinking ? styles.thinking : ""} />{message}</div>
          <div className={styles.modelControl}>
            <div className={styles.modelButtons} role="group" aria-label="AI 模型档位">
              <button aria-pressed={modelTier === "small"} className={modelTier === "small" ? styles.selected : ""} onClick={() => changeModelTier("small")} disabled={thinking}>轻量 <small>3.7MB</small></button>
              <button aria-pressed={modelTier === "high"} className={modelTier === "high" ? styles.selected : ""} onClick={() => changeModelTier("high")} disabled={thinking}>高棋力 <small>96MB</small></button>
            </div>
            {modelProgress && <div className={styles.modelProgress} role="progressbar" aria-label={progressText} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}><i style={{ width: `${progressPercent}%` }} /></div>}
            <small className={styles.modelState}>{modelStateText}</small>
          </div>
          <div className={`${styles.engineStatus} ${styles[engineStatus.mode]}`} title={engineDetail}><span>当前算法</span><strong>{engineLabel}</strong></div>
          <dl><div><dt>贴目</dt><dd>白棋 {size === 9 ? "5.5" : "7.5"} 目</dd></div><div><dt>规则</dt><dd>中国数子法</dd></div><div><dt>结束</dt><dd>双方连续停一手，或手动判断胜负</dd></div></dl>
          <div className={styles.actions}><button onClick={pass} disabled={status !== "playing" || thinking || turn !== playerColor}>停一手</button><button className={styles.judgeButton} onClick={judgeResult} disabled={status !== "playing"}>判断胜负</button><button onClick={resign} disabled={status !== "playing" || thinking}>认输</button><button onClick={openSetup}>重新开局</button></div>
          <small className={styles.best}>历史最高 {bestScore}</small>
        </aside>
      </main>

      {status === "intro" && <div className={styles.overlay}><div className={styles.introPanel}><span className={styles.seal}>弈</span><h3>围棋</h3><p>KataGo 神经网络会通过 WebGPU、WASM 或 CPU 推演攻防；桌面默认高棋力模型，手机默认轻量模型，下载后自动缓存，异常时回退轻量 MCTS。</p><div className={styles.modeChoices}><button className={styles.selected} onClick={() => setMode("match")}><strong>人机对战</strong><small>{engineLabel} · 9 路 / 19 路</small></button><button onClick={() => setMode("life-death")}><strong>死活棋 50 关</strong><small>入门到高级 · 标准变化图</small></button></div><label>AI 模型</label><div className={`${styles.modelButtons} ${styles.introModelButtons}`} role="group" aria-label="AI 模型档位"><button aria-pressed={modelTier === "small"} className={modelTier === "small" ? styles.selected : ""} onClick={() => changeModelTier("small")} disabled={thinking}><strong>轻量模型</strong><small>3.7MB · 手机默认</small></button><button aria-pressed={modelTier === "high"} className={modelTier === "high" ? styles.selected : ""} onClick={() => changeModelTier("high")} disabled={thinking}><strong>高棋力模型</strong><small>96MB · 桌面默认</small></button></div>{modelProgress && <div className={`${styles.modelProgress} ${styles.introProgress}`} role="progressbar" aria-label={progressText} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}><i style={{ width: `${progressPercent}%` }} /></div>}<small className={styles.introModelState}>{modelStateText}</small><label>选择棋盘</label><div className={styles.choices}><button className={setupSize === 9 ? styles.selected : ""} onClick={() => setSetupSize(9)}><strong>9 路</strong><small>更深搜索 · 快速对局</small></button><button className={setupSize === 19 ? styles.selected : ""} onClick={() => setSetupSize(19)}><strong>标准 19 路</strong><small>全局棋形 · 完整棋局</small></button></div><label>选择执子</label><div className={styles.colors}><button className={setupColor === 1 ? styles.selected : ""} onClick={() => setSetupColor(1)}><i className={`${styles.sample} ${styles.black}`} />执黑先行</button><button className={setupColor === 2 ? styles.selected : ""} onClick={() => setSetupColor(2)}><i className={`${styles.sample} ${styles.white}`} />执白后手</button></div><button className={styles.start} onClick={start}>开始对弈</button></div></div>}

      {status === "finished" && result && <div className={styles.overlay}><div className={styles.resultPanel}><span className={styles.seal}>{result.winner === playerColor ? "胜" : "负"}</span><h3>{result.reason === "resign" ? "你已认输" : result.winner === playerColor ? "对局胜利" : "电脑获胜"}</h3>{result.reason === "score" ? <><p>黑棋 {result.black.toFixed(1)} 目 · 白棋 {result.white.toFixed(1)} 目</p><div className={styles.scoreDetails}><span>黑方领地 {result.blackTerritory}</span><span>白方领地 {result.whiteTerritory}</span><span>白棋贴目 {result.komi}</span></div></> : <p>{colorName(result.winner)}中盘胜</p>}<div className={styles.resultActions}><button onClick={start}>再来一局</button><button onClick={openSetup}>更换棋盘</button></div></div></div>}
    </div>
  );
}
