"use client";

import { useEffect, useMemo, useState } from "react";
import type { MiniGameProps } from "../types";
import { gameAudio } from "@/lib/audio/gameAudio";

const SYMBOLS = ["✦", "●", "◆", "▲", "☘", "☀"];
type Card = { id: number; symbol: string; matched: boolean };

function shuffledCards(): Card[] {
  return [...SYMBOLS, ...SYMBOLS]
    .map((symbol, index) => ({ id: index, symbol, matched: false, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ id, symbol, matched }) => ({ id, symbol, matched }));
}

export function MemoryPairs({ bestScore, onScore }: MiniGameProps) {
  const [status, setStatus] = useState<"intro" | "running" | "won">("intro");
  const [cards, setCards] = useState<Card[]>([]);
  const [open, setOpen] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const locked = open.length === 2;
  const matchedCount = useMemo(() => cards.filter((card) => card.matched).length, [cards]);

  useEffect(() => {
    if (status !== "running") return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (open.length !== 2) return;
    const [first, second] = open;
    const isMatch = cards[first]?.symbol === cards[second]?.symbol;
    const timer = window.setTimeout(() => {
      if (isMatch) {
        gameAudio.play("match");
        setCards((current) => current.map((card, index) => index === first || index === second ? { ...card, matched: true } : card));
      } else gameAudio.play("mismatch");
      setOpen([]);
    }, isMatch ? 420 : 760);
    return () => window.clearTimeout(timer);
  }, [open, cards]);

  const start = () => {
    gameAudio.play("start");
    setCards(shuffledCards());
    setOpen([]);
    setMoves(0);
    setSeconds(0);
    setStatus("running");
  };

  const flip = (index: number) => {
    if (status !== "running" || locked || open.includes(index) || cards[index].matched) return;
    gameAudio.play("flip");
    const next = [...open, index];
    setOpen(next);
    if (next.length === 2) {
      const nextMoves = moves + 1;
      setMoves(nextMoves);
      const [first, second] = next;
      const completesBoard = cards[first].symbol === cards[second].symbol && matchedCount === cards.length - 2;
      if (completesBoard) {
        window.setTimeout(() => {
          gameAudio.play("win");
          onScore(Math.max(100, 1200 - nextMoves * 35 - seconds * 4));
          setStatus("won");
        }, 440);
      }
    }
  };

  const liveScore = Math.max(100, 1200 - moves * 35 - seconds * 4);
  return (
    <div className="mini-game memory-game">
      <div className="memory-backdrop"><i /><i /><i /></div>
      <div className="memory-hud"><span><small>步数</small><strong>{moves}</strong></span><span><small>时间</small><strong>{seconds}s</strong></span><span><small>预计得分</small><strong>{liveScore}</strong></span></div>
      <div className="memory-board">
        {cards.map((card, index) => {
          const visible = open.includes(index) || card.matched;
          return <button key={card.id} className={`memory-tile ${visible ? "memory-tile--open" : ""} ${card.matched ? "memory-tile--matched" : ""}`} onClick={() => flip(index)} aria-label={visible ? card.symbol : "未翻开的卡片"}><span className="memory-tile__inner"><i className="memory-tile__back">?</i><i className="memory-tile__front">{card.symbol}</i></span></button>;
        })}
      </div>
      {status !== "running" && <div className="game-overlay game-overlay--memory"><span className="overlay-mark">☘</span><h3>{status === "intro" ? "岛屿记忆" : "全部找到啦"}</h3><p>{status === "intro" ? "记住每个图案的位置，用更少的步数完成配对。" : `用 ${moves} 步完成挑战，获得 ${liveScore} 分。`}</p><button onClick={start}>{status === "intro" ? "开始翻牌" : "重新洗牌"}</button></div>}
      <span className="memory-best">历史最高 {Math.max(bestScore, status === "won" ? liveScore : 0)}</span>
    </div>
  );
}
