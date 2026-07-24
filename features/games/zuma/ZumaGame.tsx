"use client";

import { useEffect, useRef, useState } from "react";
import type { MiniGameProps } from "../types";
import { ZUMA_LEVELS } from "./levels";
import { ZumaEngine } from "./ZumaEngine";
import type { ZumaColor, ZumaHud, ZumaStatus } from "./types";
import styles from "./ZumaGame.module.css";

const INITIAL_HUD: ZumaHud = { score: 0, level: 0, combo: 0, remaining: 0, current: "red", next: "blue", progress: 0 };
const COLOR: Record<ZumaColor,string> = { red: "#ef5b50", blue: "#4ba9f2", yellow: "#f5cf4b", green: "#57c777", purple: "#a76de4" };

export function ZumaGame({ bestScore, onScore }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ZumaEngine | null>(null);
  const scoreRef = useRef(onScore);
  const [status, setStatus] = useState<ZumaStatus>("idle");
  const [hud, setHud] = useState<ZumaHud>(INITIAL_HUD);

  useEffect(() => { scoreRef.current = onScore; }, [onScore]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new ZumaEngine(canvas, {
      onHud: setHud,
      onStatus: (nextStatus, score) => {
        setStatus(nextStatus);
        if (nextStatus === "lost" || nextStatus === "won") scoreRef.current(score);
      },
    });
    engineRef.current = engine;
    const resize = () => engine.resize();
    const keyboard = (event: KeyboardEvent) => {
      if (event.code === "Space") { event.preventDefault(); engine.swap(); }
      if (event.key.toLowerCase() === "p") engine.togglePause();
    };
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", keyboard);
    return () => { engine.destroy(); window.removeEventListener("resize", resize); window.removeEventListener("keydown", keyboard); };
  }, []);

  const start = (level = 0, score = 0) => { engineRef.current?.start(level, score); setStatus("playing"); };
  const pointerPosition = (event: React.PointerEvent<HTMLCanvasElement>) => engineRef.current?.aimAt(event.clientX, event.clientY);
  const shoot = (event: React.PointerEvent<HTMLCanvasElement>) => { event.preventDefault(); engineRef.current?.aimAt(event.clientX,event.clientY); engineRef.current?.shoot(); };
  const nextLevel = () => start(Math.min(ZUMA_LEVELS.length - 1, hud.level + 1), hud.score);
  const level = ZUMA_LEVELS[hud.level] ?? ZUMA_LEVELS[0];

  return <div className={styles.game}>
    <canvas ref={canvasRef} onPointerMove={pointerPosition} onPointerDown={shoot} onContextMenu={(event) => { event.preventDefault(); engineRef.current?.swap(); }} aria-label="祖玛彩球轨道" />
    {status !== "idle" && <div className={styles.hud}>
      <div><small>关卡 {hud.level + 1}/3</small><strong>{level.name}</strong></div>
      <div><small>得分</small><strong>{hud.score.toLocaleString()}</strong></div>
      <div><small>剩余彩球</small><strong>{hud.remaining}</strong></div>
      {hud.combo > 1 && <em>连锁 ×{hud.combo}</em>}
      <button onClick={() => engineRef.current?.togglePause()}>{status === "paused" ? "▶" : "Ⅱ"}</button>
    </div>}
    {status !== "idle" && <div className={styles.queue}><span style={{ backgroundColor: COLOR[hud.current] }} /><i>当前</i><button onClick={() => engineRef.current?.swap()} aria-label="交换彩球">⇄</button><i>下一颗</i><span className={styles.next} style={{ backgroundColor: COLOR[hud.next] }} /></div>}
    {status !== "idle" && <div className={styles.progress}><i style={{ width: `${hud.progress * 100}%` }} /></div>}

    {status === "idle" && <div className={styles.overlay}><span className={styles.sun}>☀</span><h3>太阳祖玛</h3><p>瞄准彩球链发射，相连三颗同色彩球即可消除。制造连续消除，在彩球进入终点前清空整条轨道。</p><ul><li>鼠标移动或触摸瞄准</li><li>点击发射彩球</li><li>空格 / 右键交换彩球</li></ul><button onClick={() => start()}>开始第一关</button></div>}
    {status === "level-clear" && <div className={styles.result}><span>✦</span><h3>{level.name} 已净化</h3><p>当前得分 {hud.score.toLocaleString()}，下一关彩球更多、推进速度更快。</p><button onClick={nextLevel}>进入下一关</button></div>}
    {status === "lost" && <div className={styles.result}><span>☠</span><h3>彩球进入祭坛</h3><p>本局得分 {hud.score.toLocaleString()}。观察下一颗彩球，提前准备连锁会更容易。</p><button onClick={() => start(hud.level, 0)}>重试本关</button><button className={styles.secondary} onClick={() => start(0,0)}>从第一关开始</button></div>}
    {status === "won" && <div className={`${styles.result} ${styles.victory}`}><span>☀</span><h3>太阳神殿重获光明</h3><p>三条轨道全部净化，最终得分 {hud.score.toLocaleString()}。</p><button onClick={() => start(0,0)}>重新挑战</button></div>}
    <span className={styles.best}>历史最高 {Math.max(bestScore,hud.score).toLocaleString()}</span>
  </div>;
}
