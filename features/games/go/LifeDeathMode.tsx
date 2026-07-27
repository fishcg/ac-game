"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gameAudio } from "@/lib/audio/gameAudio";
import type { MiniGameProps } from "../types";
import { boardHash, otherColor, starPoints } from "./goRules";
import { applyLifeDeathMove, evaluateLifeDeath, formatPoint, targetGroupState } from "./lifeDeathRules";
import { lifeDeathLevels } from "./lifeDeathLevels";
import type { LifeDeathLevel } from "./lifeDeathTypes";
import type { PlayerStone, Stone } from "./types";
import styles from "./GoGame.module.css";

type Props = Pick<MiniGameProps, "bestScore" | "onScore"> & { onBack: () => void };
type Phase = "select" | "playing" | "won" | "lost";

const UNLOCK_KEY = "ac-game-go-life-death-unlocked";
const colorName = (color: PlayerStone) => color === 1 ? "黑棋" : "白棋";

function targetText(level: LifeDeathLevel) {
  if (level.goal === "solve") return `按标准变化完成 ${level.solution.length} 手`;
  if (level.goal === "live") return `救活 ${colorName(level.targetColor)}目标棋块，至少做出 ${level.requiredLiberties} 气`;
  if (level.goal === "break-eye") return `破坏 ${colorName(level.targetColor)}假眼并提净目标棋块`;
  return `在 ${level.maxMoves} 手内提净 ${colorName(level.targetColor)}目标棋块`;
}

export function LifeDeathMode({ bestScore, onScore, onBack }: Props) {
  const [selectedId, setSelectedId] = useState(1);
  const [unlocked, setUnlocked] = useState(() => {
    if (typeof window === "undefined") return 1;
    try {
      const stored = Number(window.localStorage.getItem(UNLOCK_KEY));
      return Number.isInteger(stored) && stored >= 1 ? Math.min(50, stored) : 1;
    } catch {
      return 1;
    }
  });
  const [phase, setPhase] = useState<Phase>("select");
  const [board, setBoard] = useState<Stone[]>(() => lifeDeathLevels[0].board.slice());
  const [history, setHistory] = useState<string[]>(() => [boardHash(lifeDeathLevels[0].board)]);
  const [moves, setMoves] = useState(0);
  const [solutionProgress, setSolutionProgress] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [lastMove, setLastMove] = useState<number | null>(null);
  const [hintIndex, setHintIndex] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);
  const [message, setMessage] = useState("选择一关开始挑战");
  const responseTimer = useRef<number | null>(null);
  const level = useMemo(() => lifeDeathLevels[selectedId - 1] ?? lifeDeathLevels[0], [selectedId]);
  const stars = useMemo(() => starPoints(level.boardSize), [level.boardSize]);
  const state = useMemo(() => targetGroupState(board, level), [board, level]);

  useEffect(() => {
    return () => { if (responseTimer.current !== null) window.clearTimeout(responseTimer.current); };
  }, []);

  const clearResponse = () => {
    if (responseTimer.current !== null) {
      window.clearTimeout(responseTimer.current);
      responseTimer.current = null;
    }
    setThinking(false);
  };

  const startLevel = (id: number) => {
    const next = lifeDeathLevels[id - 1];
    if (!next || id > unlocked) return;
    clearResponse();
    setSelectedId(id);
    setBoard(next.board.slice());
    setHistory([boardHash(next.board)]);
    setMoves(0);
    setSolutionProgress(0);
    setHintUsed(false);
    setMistakes(0);
    setLastMove(null);
    setHintIndex(null);
    setMessage(`${next.chapter}：${targetText(next)}`);
    setPhase("playing");
    gameAudio.play("start");
  };

  const finishLevel = (evaluation: ReturnType<typeof evaluateLifeDeath>, nextMoves: number) => {
    clearResponse();
    if (evaluation.status === "won") {
      setPhase("won");
      const nextUnlocked = Math.min(50, Math.max(unlocked, level.id + 1));
      setUnlocked(nextUnlocked);
      try { window.localStorage.setItem(UNLOCK_KEY, String(nextUnlocked)); } catch { /* ignore storage errors */ }
      const reward = Math.max(120, 920 + level.id * 38 - nextMoves * 55 - (hintUsed ? 110 : 0) - mistakes * 45);
      onScore(reward);
      setMessage(`解题成功！${evaluation.reason}`);
      gameAudio.play("win");
    } else if (evaluation.status === "lost") {
      setPhase("lost");
      setMessage(`本关未通过：${evaluation.reason}`);
      gameAudio.play("mismatch");
    }
  };

  const applyOpponentResponse = (currentBoard: Stone[], currentHistory: string[], response: number, currentMoves: number, currentProgress: number) => {
    const move = applyLifeDeathMove(currentBoard, response, otherColor(level.playerColor), currentHistory);
    if (!move.legal) {
      setThinking(false);
      setMessage("对手无应手，继续寻找关键点");
      return;
    }
    const nextHistory = [...currentHistory, boardHash(move.board)];
    setBoard(move.board);
    setHistory(nextHistory);
    setLastMove(response);
    setThinking(false);
    const evaluation = evaluateLifeDeath(level, move.board, currentMoves, currentProgress);
    if (evaluation.status !== "playing") {
      finishLevel(evaluation, currentMoves);
      return;
    }
    setMessage(`对手在 ${formatPoint(response, level.boardSize)} 应手，轮到你`);
    gameAudio.play(move.captured > 0 ? "score" : "move");
  };

  const placeStone = (index: number) => {
    if (phase !== "playing" || thinking) return;
    const move = applyLifeDeathMove(board, index, level.playerColor, history);
    if (!move.legal) {
      setMessage(move.reason === "suicide" ? "这里是禁入点，不能自杀" : move.reason === "ko" ? "劫争不能立即回提" : "这里已有棋子");
      gameAudio.play("miss");
      return;
    }
    const nextMoves = moves + 1;
    const expected = level.solution[solutionProgress];
    const correct = expected === index;
    const nextProgress = correct ? solutionProgress + 1 : solutionProgress;
    if (!correct) setMistakes((value) => value + 1);
    setBoard(move.board);
    setHistory([...history, boardHash(move.board)]);
    setMoves(nextMoves);
    setSolutionProgress(nextProgress);
    setLastMove(index);
    setHintIndex(null);
    gameAudio.play(move.captured > 0 ? "score" : "tap");
    const evaluation = evaluateLifeDeath(level, move.board, nextMoves, nextProgress);
    if (evaluation.status !== "playing") {
      finishLevel(evaluation, nextMoves);
      return;
    }
    if (!correct) setMessage("这手没有解决要点，再观察目标棋块的气");
    else setMessage(move.captured > 0 ? `提走 ${move.captured} 子，继续判断` : "关键手正确，留意对手的应手");
    const response = correct ? level.opponentResponses[nextProgress - 1] : null;
    if (response !== null && response !== undefined) {
      setThinking(true);
      setMessage("题目对手正在应手…");
      responseTimer.current = window.setTimeout(() => applyOpponentResponse(move.board, [...history, boardHash(move.board)], response, nextMoves, nextProgress), 440);
    }
  };

  const showHint = () => {
    if (phase !== "playing" || thinking) return;
    const index = level.solution[solutionProgress] ?? level.solution[0];
    setHintUsed(true);
    setHintIndex(index ?? null);
    setMessage(index === undefined ? level.hint : `提示：关键点在 ${formatPoint(index, level.boardSize)}`);
    gameAudio.play("move");
  };

  const reset = () => startLevel(level.id);
  const stateLabel = level.goal === "solve"
    ? `标准变化 ${Math.min(solutionProgress, level.solution.length)} / ${level.solution.length} 手`
    : state.present ? `${state.liberties.size} 气 · ${state.eyes} 眼` : "目标棋块已消失";

  return (
    <div className={styles.game}>
      <div className={styles.ink} aria-hidden="true" />
      <main className={styles.layout}>
        <section className={`${styles.boardShell} ${styles.puzzleBoard}`} aria-label="死活棋题目棋盘">
          <div className={styles.board} style={{ gridTemplateColumns: `repeat(${level.boardSize}, 1fr)` }} role="grid">
            {board.map((stone, index) => {
              const row = Math.floor(index / level.boardSize);
              const col = index % level.boardSize;
              const edgeClasses = [row === 0 ? styles.top : "", row === level.boardSize - 1 ? styles.bottom : "", col === 0 ? styles.left : "", col === level.boardSize - 1 ? styles.right : ""].join(" ");
              const target = level.targetGroup.includes(index) && stone === level.targetColor;
              return <button key={index} className={`${styles.point} ${edgeClasses}`} onClick={() => placeStone(index)} role="gridcell" aria-label={`${row + 1}行${col + 1}列，${stone ? colorName(stone as PlayerStone) : "空位"}`} disabled={phase !== "playing" || thinking || stone !== 0}>
                {stars.has(index) && stone === 0 && <i className={styles.star} />}
                {hintIndex === index && stone === 0 && <i className={styles.hintDot} aria-label="提示点" />}
                {stone !== 0 && <i className={`${styles.stone} ${stone === 1 ? styles.black : styles.white} ${target ? styles.targetStone : ""}`}><b>{lastMove === index ? "·" : ""}</b></i>}
              </button>;
            })}
          </div>
        </section>

        <aside className={styles.panel}>
          <header><span>死活棋 · 第 {level.id} / 50 关</span><strong>Lv.{level.difficulty}</strong></header>
          <div className={styles.puzzleTitle}><strong>{level.title}</strong><small>{level.chapter}</small></div>
          <div className={styles.player}><i className={`${styles.sample} ${level.playerColor === 1 ? styles.black : styles.white}`} /><span><strong>你 · {colorName(level.playerColor)}</strong><small>目标：{targetText(level)}</small></span></div>
          <div className={styles.puzzleTarget}><span>目标状态</span><strong>{stateLabel}</strong><small>第 {moves} / {level.maxMoves} 手 · 解题进度 {Math.min(solutionProgress, level.solution.length)} / {level.solution.length}</small></div>
          <div className={styles.status}><i className={thinking ? styles.thinking : ""} />{message}</div>
          <p className={styles.puzzleExplanation}>{level.explanation}</p>
          <div className={styles.actions}><button onClick={showHint} disabled={phase !== "playing" || thinking}>查看提示</button><button onClick={reset} disabled={phase === "select"}>重置本关</button><button onClick={onBack}>返回人机对战</button></div>
          <small className={styles.best}>最高分 {bestScore} · 已解锁 {unlocked}/50</small>
        </aside>
      </main>

      {phase === "select" && <div className={styles.overlay}><div className={`${styles.introPanel} ${styles.levelSelectPanel}`}><span className={styles.seal}>死</span><h3>死活棋 · 50 关</h3><p>公开 SGF 标准题库：20 道入门、20 道中级、10 道高级题。保留完整 19 路局面与标准应手，通关后解锁下一题。</p><div className={styles.levelGrid}>{lifeDeathLevels.map((item) => <button key={item.id} className={`${styles.levelButton} ${item.id === selectedId ? styles.selected : ""} ${item.id > unlocked ? styles.locked : ""}`} onClick={() => item.id <= unlocked && setSelectedId(item.id)} disabled={item.id > unlocked}><strong>{item.id}</strong><small>{item.id > unlocked ? "锁定" : `难度 ${item.difficulty}`}</small></button>)}</div><button className={styles.start} onClick={() => startLevel(selectedId)}>开始第 {selectedId} 关</button><button className={styles.backLink} onClick={onBack}>返回围棋模式选择</button></div></div>}

      {(phase === "won" || phase === "lost") && <div className={styles.overlay}><div className={styles.resultPanel}><span className={styles.seal}>{phase === "won" ? "活" : "停"}</span><h3>{phase === "won" ? (level.id === 50 ? "全部通关" : "本关通过") : "再想一手"}</h3><p>{message}</p><div className={styles.scoreDetails}><span>{level.chapter}</span><span>用时步数 {moves}</span><span>{hintUsed ? "使用过提示" : "无提示"}</span></div><div className={styles.resultActions}>{phase === "won" && level.id < 50 && <button onClick={() => startLevel(level.id + 1)}>下一关</button>}<button onClick={reset}>{phase === "won" ? "再练一次" : "重新挑战"}</button><button onClick={() => setPhase("select")}>选择关卡</button></div></div></div>}
    </div>
  );
}
