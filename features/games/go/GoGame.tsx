"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gameAudio } from "@/lib/audio/gameAudio";
import type { MiniGameProps } from "../types";
import { chooseAiMove } from "./goAi";
import { LifeDeathMode } from "./LifeDeathMode";
import { boardHash, otherColor, playMove, scoreBoard, starPoints } from "./goRules";
import type { BoardSize, Captures, MatchResult, PlayerStone, Stone } from "./types";
import styles from "./GoGame.module.css";

const EMPTY_CAPTURES: Captures = { black: 0, white: 0 };
const colorName = (color: PlayerStone) => color === 1 ? "黑棋" : "白棋";

export function GoGame({ bestScore, onScore }: MiniGameProps) {
  const [mode, setMode] = useState<"match" | "life-death">("match");
  const [setupSize, setSetupSize] = useState<BoardSize>(9);
  const [setupColor, setSetupColor] = useState<PlayerStone>(1);
  const [size, setSize] = useState<BoardSize>(9);
  const [board, setBoard] = useState<Stone[]>(() => Array(81).fill(0) as Stone[]);
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
  const aiTimer = useRef<number | null>(null);
  const stars = useMemo(() => starPoints(size), [size]);
  const aiColor = otherColor(playerColor);
  useEffect(() => () => { if (aiTimer.current !== null) window.clearTimeout(aiTimer.current); }, []);

  if (mode === "life-death") return <LifeDeathMode bestScore={bestScore} onScore={onScore} onBack={() => setMode("match")} />;

  const finishByScore = (finalBoard: Stone[]) => {
    const score = scoreBoard(finalBoard, size);
    const winner: PlayerStone = score.black > score.white ? 1 : 2;
    const matchResult: MatchResult = { ...score, winner, reason: "score" };
    setResult(matchResult);
    setStatus("finished");
    setThinking(false);
    const won = winner === playerColor;
    gameAudio.play(won ? "win" : "mismatch");
    if (won) onScore((size === 19 ? 5000 : 1800) + Math.max(0, Math.round(Math.abs(score.black - score.white) * 20)));
  };

  const scheduleAi = (currentBoard: Stone[], hashes: string[], currentPasses: number, currentCaptures: Captures, currentMove: number, currentSize: BoardSize, currentPlayerColor: PlayerStone) => {
    const computerColor = otherColor(currentPlayerColor);
    setThinking(true);
    setMessage("对手正在思考…");
    aiTimer.current = window.setTimeout(() => {
      const index = chooseAiMove(currentBoard, computerColor, currentSize, hashes, currentMove);
      if (index === null) {
        const nextPasses = currentPasses + 1;
        setPasses(nextPasses);
        setLastMove(null);
        setMoveNumber(currentMove + 1);
        if (nextPasses >= 2) { finishByScore(currentBoard); return; }
        setTurn(currentPlayerColor);
        setThinking(false);
        setMessage("对手停一手，轮到你");
        return;
      }
      const move = playMove(currentBoard, index, computerColor, currentSize, hashes);
      if (!move.legal) {
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
      setCaptures(nextCaptures);
      setPasses(0);
      setMoveNumber(currentMove + 1);
      setLastMove(index);
      setTurn(currentPlayerColor);
      setThinking(false);
      setMessage(move.captured ? `对手提走 ${move.captured} 子，轮到你` : "轮到你落子");
      gameAudio.play(move.captured ? "score" : "tap");
    }, 580);
  };

  const start = () => {
    if (aiTimer.current !== null) window.clearTimeout(aiTimer.current);
    const nextBoard = Array(setupSize * setupSize).fill(0) as Stone[];
    const hashes = [boardHash(nextBoard)];
    setSize(setupSize);
    setBoard(nextBoard);
    setHistory(hashes);
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
    if (setupColor === 2) scheduleAi(nextBoard, hashes, 0, { ...EMPTY_CAPTURES }, 0, setupSize, setupColor);
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
    const nextMove = moveNumber + 1;
    setBoard(move.board);
    setHistory(hashes);
    setCaptures(nextCaptures);
    setPasses(0);
    setMoveNumber(nextMove);
    setLastMove(index);
    setTurn(aiColor);
    setMessage(move.captured ? `提走 ${move.captured} 子` : "落子完成");
    gameAudio.play(move.captured ? "score" : "tap");
    scheduleAi(move.board, hashes, 0, nextCaptures, nextMove, size, playerColor);
  };

  const pass = () => {
    if (status !== "playing" || thinking || turn !== playerColor) return;
    const nextPasses = passes + 1;
    setPasses(nextPasses);
    setLastMove(null);
    setMoveNumber((value) => value + 1);
    gameAudio.play("move");
    if (nextPasses >= 2) { finishByScore(board); return; }
    setTurn(aiColor);
    scheduleAi(board, history, nextPasses, captures, moveNumber + 1, size, playerColor);
  };

  const resign = () => {
    if (status !== "playing" || thinking) return;
    if (aiTimer.current !== null) window.clearTimeout(aiTimer.current);
    const score = scoreBoard(board, size);
    setResult({ ...score, winner: aiColor, reason: "resign" });
    setStatus("finished");
    setThinking(false);
    gameAudio.play("mismatch");
  };

  const openSetup = () => {
    if (aiTimer.current !== null) window.clearTimeout(aiTimer.current);
    setThinking(false);
    setStatus("intro");
  };

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
          <dl><div><dt>贴目</dt><dd>白棋 {size === 9 ? "5.5" : "7.5"} 目</dd></div><div><dt>规则</dt><dd>中国数子法</dd></div><div><dt>结束</dt><dd>双方连续停一手</dd></div></dl>
          <div className={styles.actions}><button onClick={pass} disabled={status !== "playing" || thinking || turn !== playerColor}>停一手</button><button onClick={resign} disabled={status !== "playing" || thinking}>认输</button><button onClick={openSetup}>重新开局</button></div>
          <small className={styles.best}>历史最高 {bestScore}</small>
        </aside>
      </main>

      {status === "intro" && <div className={styles.overlay}><div className={styles.introPanel}><span className={styles.seal}>弈</span><h3>围棋</h3><p>一边与本地 AI 对弈，一边挑战 50 道公开 SGF 标准死活题，练习眼形、攻杀和复杂劫活。</p><div className={styles.modeChoices}><button className={styles.selected} onClick={() => setMode("match")}><strong>人机对战</strong><small>9 路 / 19 路 · 实战计分</small></button><button onClick={() => setMode("life-death")}><strong>死活棋 50 关</strong><small>入门到高级 · 标准变化图</small></button></div><label>选择棋盘</label><div className={styles.choices}><button className={setupSize === 9 ? styles.selected : ""} onClick={() => setSetupSize(9)}><strong>9 路</strong><small>9×9 · 快速对局</small></button><button className={setupSize === 19 ? styles.selected : ""} onClick={() => setSetupSize(19)}><strong>标准 19 路</strong><small>19×19 · 完整棋局</small></button></div><label>选择执子</label><div className={styles.colors}><button className={setupColor === 1 ? styles.selected : ""} onClick={() => setSetupColor(1)}><i className={`${styles.sample} ${styles.black}`} />执黑先行</button><button className={setupColor === 2 ? styles.selected : ""} onClick={() => setSetupColor(2)}><i className={`${styles.sample} ${styles.white}`} />执白后手</button></div><button className={styles.start} onClick={start}>开始对弈</button></div></div>}

      {status === "finished" && result && <div className={styles.overlay}><div className={styles.resultPanel}><span className={styles.seal}>{result.winner === playerColor ? "胜" : "负"}</span><h3>{result.reason === "resign" ? "你已认输" : result.winner === playerColor ? "对局胜利" : "电脑获胜"}</h3>{result.reason === "score" ? <><p>黑棋 {result.black.toFixed(1)} 目 · 白棋 {result.white.toFixed(1)} 目</p><div className={styles.scoreDetails}><span>黑方领地 {result.blackTerritory}</span><span>白方领地 {result.whiteTerritory}</span><span>白棋贴目 {result.komi}</span></div></> : <p>{colorName(result.winner)}中盘胜</p>}<div className={styles.resultActions}><button onClick={start}>再来一局</button><button onClick={openSetup}>更换棋盘</button></div></div></div>}
    </div>
  );
}
