"use client";

import { useEffect, useMemo, useState } from "react";
import { gameAudio } from "@/lib/audio/gameAudio";
import type { MiniGameProps } from "../types";
import { chordCells, DIFFICULTIES, emptyBoard, revealCells, scoreFor, seedBoard, toggleFlag } from "./logic";
import type { DifficultyId, MineCell } from "./types";
import styles from "./Minesweeper.module.css";

type GameStatus = "intro" | "ready" | "playing" | "won" | "lost";

const NUMBER_CLASS = ["", styles.one, styles.two, styles.three, styles.four, styles.five, styles.six, styles.seven, styles.eight];

export function Minesweeper({ bestScore, onScore }: MiniGameProps) {
  const [difficultyId, setDifficultyId] = useState<DifficultyId>("beginner");
  const difficulty = DIFFICULTIES[difficultyId];
  const [board, setBoard] = useState<MineCell[]>(() => emptyBoard(difficulty));
  const [status, setStatus] = useState<GameStatus>("intro");
  const [seconds, setSeconds] = useState(0);
  const [flagMode, setFlagMode] = useState(false);
  const [lastScore, setLastScore] = useState(0);
  const flags = useMemo(() => board.filter((cell) => cell.state === "flagged").length, [board]);

  useEffect(() => {
    if (status !== "playing") return;
    const timer = window.setInterval(() => setSeconds((value) => Math.min(999, value + 1)), 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  const start = (nextDifficulty: DifficultyId = difficultyId) => {
    const next = DIFFICULTIES[nextDifficulty];
    gameAudio.play("start");
    setDifficultyId(nextDifficulty);
    setBoard(emptyBoard(next));
    setSeconds(0);
    setLastScore(0);
    setFlagMode(false);
    setStatus("ready");
  };

  useEffect(() => {
    const reset = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "r") start(difficultyId);
    };
    window.addEventListener("keydown", reset);
    return () => window.removeEventListener("keydown", reset);
  });

  const finishReveal = (result: ReturnType<typeof revealCells>) => {
    setBoard(result.board);
    if (result.hitMine) {
      gameAudio.play("crash");
      setStatus("lost");
      return;
    }
    if (result.won) {
      const score = scoreFor(difficulty, seconds);
      gameAudio.play("win");
      setLastScore(score);
      setStatus("won");
      onScore(score);
      return;
    }
    gameAudio.play("flip");
  };

  const openCell = (id: number) => {
    if (status === "intro" || status === "won" || status === "lost") return;
    if (flagMode) {
      setBoard((current) => toggleFlag(current, id, difficulty.mines));
      gameAudio.play("move");
      return;
    }
    if (board[id].state === "flagged") return;
    if (board[id].state === "revealed") {
      const result = chordCells(board, id, difficulty);
      if (result) finishReveal(result);
      return;
    }
    const source = status === "ready" ? seedBoard(difficulty, id, board) : board;
    if (status === "ready") setStatus("playing");
    finishReveal(revealCells(source, [id], difficulty));
  };

  const flagCell = (event: React.MouseEvent, id: number) => {
    event.preventDefault();
    if (status !== "ready" && status !== "playing") return;
    setBoard((current) => toggleFlag(current, id, difficulty.mines));
    gameAudio.play("move");
  };

  const face = status === "lost" ? "☹" : status === "won" ? "😎" : "🙂";
  const boardWidth = difficulty.cols * difficulty.cellSize;

  return (
    <div className={styles.game}>
      <div className={styles.pattern} aria-hidden="true" />
      <section className={styles.cabinet}>
        <nav className={styles.difficulties} aria-label="难度选择">
          {(Object.values(DIFFICULTIES)).map((option) => (
            <button key={option.id} className={difficultyId === option.id ? styles.selected : ""} onClick={() => start(option.id)}>
              <strong>{option.label}</strong><small>{option.cols}×{option.rows} · {option.mines}雷</small>
            </button>
          ))}
        </nav>

        <header className={styles.display}>
          <span aria-label={`剩余雷数 ${difficulty.mines - flags}`}><i>🚩</i>{String(difficulty.mines - flags).padStart(3, "0")}</span>
          <button onClick={() => start()} aria-label="重新开始">{face}</button>
          <span aria-label={`用时 ${seconds} 秒`}><i>⏱</i>{String(seconds).padStart(3, "0")}</span>
        </header>

        <div className={styles.boardViewport}>
          <div className={styles.board} style={{ gridTemplateColumns: `repeat(${difficulty.cols}, 1fr)`, width: boardWidth }} role="grid" aria-label={`${difficulty.label}扫雷棋盘`}>
            {board.map((cell) => {
              const revealed = cell.state === "revealed";
              const numberClass = revealed && !cell.mine ? NUMBER_CLASS[cell.adjacent] ?? "" : "";
              const label = cell.wrongFlag ? "错误旗帜" : cell.mine && revealed ? "地雷" : cell.state === "flagged" ? "旗帜" : revealed ? cell.adjacent ? `数字 ${cell.adjacent}` : "空白" : "未翻开";
              return (
                <button
                  key={cell.id}
                  className={`${styles.cell} ${revealed ? styles.revealed : ""} ${cell.state === "flagged" ? styles.flagged : ""} ${cell.exploded ? styles.exploded : ""} ${cell.wrongFlag ? styles.wrong : ""} ${numberClass}`}
                  onClick={() => openCell(cell.id)}
                  onContextMenu={(event) => flagCell(event, cell.id)}
                  aria-label={`${cell.row + 1}行${cell.col + 1}列，${label}`}
                  role="gridcell"
                >
                  {cell.wrongFlag ? (
                    "✕"
                  ) : cell.state === "flagged" ? (
                    <span className={styles.flagIcon} aria-hidden="true">⚑</span>
                  ) : revealed && cell.mine ? (
                    "✹"
                  ) : revealed && cell.adjacent > 0 ? (
                    cell.adjacent
                  ) : (
                    ""
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <footer className={styles.actions}>
          <button className={flagMode ? styles.flagActive : ""} onClick={() => setFlagMode((active) => !active)}><span>⚑</span>{flagMode ? "旗帜模式：开" : "旗帜模式"}</button>
          <p>左键翻格 · 右键插旗 · 点击数字可快速展开</p>
          <strong>历史最高 {Math.max(bestScore, lastScore)}</strong>
        </footer>
      </section>

      {status === "intro" && (
        <div className={styles.overlay}>
          <span className={styles.mineMark}>✹</span>
          <h3>经典扫雷</h3>
          <p>根据数字判断相邻地雷的位置，标出全部地雷并安全翻开其余方格。第一步永远安全。</p>
          <div className={styles.startChoices}>
            {(Object.values(DIFFICULTIES)).map((option) => <button key={option.id} onClick={() => start(option.id)}><strong>{option.label}</strong><small>{option.cols}×{option.rows} · {option.mines} 雷</small></button>)}
          </div>
        </div>
      )}

      {(status === "won" || status === "lost") && (
        <div className={`${styles.result} ${status === "won" ? styles.victory : ""}`}>
          <span>{status === "won" ? "🏆" : "💥"}</span>
          <h3>{status === "won" ? "雷区已清除" : "踩到地雷了"}</h3>
          <p>{status === "won" ? `${seconds} 秒完成 ${difficulty.label}挑战，获得 ${lastScore} 分。` : "别急，失败的棋盘会显示所有地雷和插错的旗帜。"}</p>
          <button onClick={() => start()}>{status === "won" ? "再来一局" : "重新挑战"}</button>
        </div>
      )}
    </div>
  );
}
