"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gameAudio } from "@/lib/audio/gameAudio";
import type { MiniGameProps } from "../types";
import styles from "../casual/CasualGames.module.css";

type PrizeKind = "coin" | "rock" | "diamond";
type Prize = { id: number; x: number; y: number; icon: string; value: number; size: number; weight: number; kind: PrizeKind };
const LEVEL_TIME = [60, 56, 52, 48, 44];
const POSITIONS = [[14,48],[28,61],[43,52],[57,68],[72,51],[86,59],[20,70],[36,74],[63,73],[80,69],[11,63],[90,46],[50,78],[76,78],[25,43],[68,43]] as const;
const PRIZE_DATA: Record<PrizeKind, { icon: string; value: number; size: number; weight: number }> = {
  coin: { icon: "🪙", value: 120, size: 30, weight: 1 },
  rock: { icon: "🪨", value: 40, size: 38, weight: 2.3 },
  diamond: { icon: "💎", value: 420, size: 25, weight: .8 },
};

const makePrizes = (level: number): Prize[] => {
  const count = Math.min(POSITIONS.length, 7 + level * 2);
  return POSITIONS.slice(0, count).map(([x, y], index) => {
    const kind: PrizeKind = index % (level >= 3 ? 5 : 6) === 0 ? "diamond" : index % 3 === 0 ? "rock" : "coin";
    const data = PRIZE_DATA[kind];
    return { id: index, x, y, kind, ...data };
  });
};

export function GoldMiner({ bestScore, onScore }: MiniGameProps) {
  const [status, setStatus] = useState<"intro" | "running" | "paused" | "over">("intro");
  const [level, setLevel] = useState(1); const [time, setTime] = useState(LEVEL_TIME[0]); const [score, setScore] = useState(0);
  const [angle, setAngle] = useState(-55); const [rope, setRope] = useState(12); const [mode, setMode] = useState<"swing" | "extend" | "retract">("swing");
  const [prizes, setPrizes] = useState<Prize[]>(() => makePrizes(1)); const [caught, setCaught] = useState<Prize | null>(null); const [notice, setNotice] = useState("");
  const [arenaSize, setArenaSize] = useState({ width: 0, height: 0 });
  const direction = useRef(1); const scoreRef = useRef(0); const levelClear = useRef(false); const arenaRef = useRef<HTMLDivElement>(null);
  const maxRope = 72 + level * 4;

  useEffect(() => {
    const measure = () => { const rect = arenaRef.current?.getBoundingClientRect(); if (rect) setArenaSize({ width: rect.width, height: rect.height }); };
    measure(); window.addEventListener("resize", measure); return () => window.removeEventListener("resize", measure);
  }, []);
  const drop = useCallback(() => { if (status !== "running" || mode !== "swing") return; setMode("extend"); gameAudio.play("drop"); }, [mode, status]);
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.code === "Space") { event.preventDefault(); drop(); } }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, [drop]);
  useEffect(() => {
    if (status !== "running") return;
    const timer = window.setInterval(() => setTime((value) => { if (value <= 1) { setStatus("over"); onScore(scoreRef.current); gameAudio.play("win"); return 0; } return value - 1; }), 1000);
    return () => window.clearInterval(timer);
  }, [onScore, status]);
  useEffect(() => {
    if (status !== "running") return;
    const loop = window.setInterval(() => {
      if (mode === "swing") setAngle((value) => { let next = value + direction.current * (1.8 + level * .18); if (next > 64 || next < -64) { direction.current *= -1; next = Math.max(-64, Math.min(64, next)); } return next; });
      if (mode === "extend") setRope((value) => {
        const next = value + (1.55 + level * .12); const radians = angle * Math.PI / 180; const ropePixels = next / 100 * arenaSize.height;
        const hookX = arenaSize.width / 2 + Math.sin(radians) * ropePixels; const hookY = arenaSize.height * .25 + Math.cos(radians) * ropePixels;
        const hit = prizes.find((item) => { const itemX = item.x / 100 * arenaSize.width; const itemY = item.y / 100 * arenaSize.height; const hitRadius = Math.max(13, item.size * .46); return Math.hypot(itemX - hookX, itemY - hookY) <= hitRadius + 10; });
        if (hit) { levelClear.current = prizes.length === 1; setCaught(hit); setPrizes((items) => items.filter((item) => item.id !== hit.id)); setMode("retract"); gameAudio.play(hit.kind === "diamond" ? "match" : "score"); return next; }
        if (next >= maxRope) { setMode("retract"); return maxRope; }
        return next;
      });
      if (mode === "retract") setRope((value) => {
        const speed = caught ? 1.75 / caught.weight : 2.5; const next = value - speed;
        if (next <= 12) {
          if (caught) {
            const finalScore = scoreRef.current + caught.value; scoreRef.current = finalScore; setScore(finalScore); setCaught(null);
            if (levelClear.current) {
              levelClear.current = false;
              if (level >= 5) { setStatus("over"); onScore(finalScore); gameAudio.play("win"); }
              else { const nextLevel = level + 1; setLevel(nextLevel); setTime(LEVEL_TIME[nextLevel - 1]); setPrizes(makePrizes(nextLevel)); setNotice(`第 ${nextLevel} 关 · 新矿层已发现`); window.setTimeout(() => setNotice(""), 1300); }
            }
          }
          setMode("swing"); return 12;
        }
        return next;
      });
    }, 30);
    return () => window.clearInterval(loop);
  }, [angle, arenaSize, caught, level, maxRope, mode, onScore, prizes, status]);

  const start = () => { scoreRef.current = 0; direction.current = 1; levelClear.current = false; setLevel(1); setTime(LEVEL_TIME[0]); setScore(0); setAngle(-55); setRope(12); setMode("swing"); setCaught(null); setPrizes(makePrizes(1)); setNotice(""); setStatus("running"); gameAudio.play("start"); };
  return <div ref={arenaRef} className={`${styles.game} ${styles.miner}`} onPointerDown={drop}>
    <div className={styles.minerGround} /><div className={styles.minerCabin}>👷</div>
    <div className={styles.topbar}><div className={styles.stat}><small>第 {level} 关 · 剩余</small><strong>{time}s</strong></div><div className={styles.stat}><small>矿石价值</small><strong>{score}</strong></div><div className={styles.stat}><small>目标</small><strong>{prizes.length ? `×${prizes.length}` : "清空"}</strong></div><button className={styles.pause} onPointerDown={(event) => event.stopPropagation()} onClick={() => setStatus(status === "paused" ? "running" : "paused")}>Ⅱ</button></div>
    <div className={styles.rope} style={{ "--rope": `${rope}%`, "--angle": `${angle}deg` } as React.CSSProperties}><span className={styles.hook}>🪝</span>{caught && <span style={{ position: "absolute", left: "50%", bottom: -42, transform: "translateX(-50%)", fontSize: caught.size }}>{caught.icon}</span>}</div>
    {prizes.map((item) => <span key={item.id} className={styles.nugget} style={{ left: `${item.x}%`, top: `${item.y}%`, "--size": `${item.size}px` } as React.CSSProperties}>{item.icon}</span>)}
    {notice && <div className={styles.toast}>{notice}</div>}
    {status !== "running" && <div className={styles.overlay} onPointerDown={(event) => event.stopPropagation()}><div className={styles.panel}><span className={styles.mark}>⛏️</span><h3>{status === "intro" ? "五层矿脉待命" : status === "paused" ? "暂停开采" : level >= 5 ? "矿脉全部清空" : "矿区结算"}</h3><p>{status === "intro" ? "每关清空矿物才能进入更深矿层，钻石价值高但矿石重量也不同。" : status === "paused" ? "倒计时和钩爪已经暂停。" : `完成第 ${Math.min(level, 5)} 关，带回价值 ${score} 的矿物，历史最佳 ${Math.max(bestScore, score)}。`}</p><button className={styles.primary} onClick={status === "paused" ? () => setStatus("running") : start}>{status === "paused" ? "继续开采" : status === "intro" ? "开始挖金" : "再挖一次"}</button></div></div>}
  </div>;
}
