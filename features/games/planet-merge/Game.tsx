"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { MiniGameProps } from "../types";
import { PLANET_PORTRAITS, VICTORY_CG_SRC } from "./assets";
import { PLANET_TIERS } from "./data";
import { PlanetMergeEngine } from "./Engine";
import type { PlanetHud, PlanetMergeStatus } from "./types";
import styles from "./PlanetMerge.module.css";

const INITIAL: PlanetHud = {
  score: 0,
  combo: 0,
  drops: 0,
  maxTier: 0,
  next: 0,
  danger: 0,
  mission: "合成一颗莓果月球",
  message: "移动投放器，点击落下星球",
  planets: 0,
};

export function PlanetMerge({ bestScore, onScore }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PlanetMergeEngine | null>(null);
  const scoreRef = useRef(onScore);
  const [status, setStatus] = useState<PlanetMergeStatus>("idle");
  const [hud, setHud] = useState(INITIAL);
  const [result, setResult] = useState("");
  const [showVictoryCg, setShowVictoryCg] = useState(false);

  useEffect(() => {
    scoreRef.current = onScore;
  }, [onScore]);

  useEffect(() => {
    const image = new window.Image();
    image.decoding = "async";
    image.src = VICTORY_CG_SRC;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new PlanetMergeEngine(canvas, {
      onHud: setHud,
      onStatus: (next, score, message) => {
        setStatus(next);
        setResult(message);
        setShowVictoryCg(next === "won");
        if (next === "won" || next === "lost") scoreRef.current(score);
      },
    });
    engineRef.current = engine;

    const resize = () => engine.resize();
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") engine.setMove(-1);
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") engine.setMove(1);
      if (event.code === "Space") {
        event.preventDefault();
        engine.drop();
      }
      if (event.key.toLowerCase() === "p") engine.togglePause();
    };
    const keyUp = (event: KeyboardEvent) => {
      if (["arrowleft", "arrowright", "a", "d"].includes(event.key.toLowerCase())) engine.setMove(0);
    };

    window.addEventListener("resize", resize);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      engine.destroy();
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, []);

  const startGame = () => {
    setShowVictoryCg(false);
    engineRef.current?.start();
  };
  const nextColor = hud.next === "comet" ? null : PLANET_TIERS[hud.next].color;
  const nextPortrait = hud.next === "comet" ? null : PLANET_PORTRAITS[hud.next];
  const showResult = status === "lost" || (status === "won" && !showVictoryCg);

  return (
    <div className={styles.game}>
      <canvas
        ref={canvasRef}
        aria-label="合成大 Saber 星仓"
        onPointerMove={(event) => engineRef.current?.pointer(event.clientX)}
        onPointerDown={(event) => {
          engineRef.current?.pointer(event.clientX);
          engineRef.current?.drop();
        }}
      />
      {status !== "idle" && (
        <>
          <div className={styles.hud}>
            <div className={styles.panel}><small>得分</small><strong>{hud.score.toLocaleString()}</strong></div>
            <div className={styles.panel}><small>最高星球</small><strong>{PLANET_TIERS[hud.maxTier].name}</strong><em>{PLANET_PORTRAITS[hud.maxTier].shortName}</em></div>
            <div className={styles.panel}><small>投放</small><strong>{hud.drops}</strong></div>
            <button className={styles.pause} onClick={() => engineRef.current?.togglePause()}>{status === "paused" ? "▶" : "Ⅱ"}</button>
          </div>
          <div className={styles.danger}>
            <span><b>星仓压力</b><b>{Math.round(hud.danger * 100)}%</b></span>
            <div className={styles.bar}><i style={{ width: `${hud.danger * 100}%` }} /></div>
          </div>
          <div className={styles.mission}>当前目标 · {hud.mission}</div>
          <div className={styles.coach}>{hud.message} · 同屏 {hud.planets}/{58}</div>
          {hud.combo > 1 && <div className={styles.combo}>COMBO ×{hud.combo}</div>}
          <div className={styles.next}>
            <small>NEXT</small>
            {hud.next === "comet" ? (
              <span className={styles.comet}>✦</span>
            ) : nextPortrait && (
              <Image
                className={styles.planetDot}
                src={nextPortrait.src}
                alt=""
                width={43}
                height={43}
                style={{ "--planet": nextColor } as React.CSSProperties}
              />
            )}
          </div>
        </>
      )}
      {status === "idle" && (
        <div className={styles.overlay}>
          <span className={styles.mark}><Image src={PLANET_PORTRAITS[10].src} alt="" width={92} height={92} /></span>
          <h3>合成大 Saber</h3>
          <p>投放 Fate 英灵头像，让相同角色相遇并逐级合成。合成第 11 级的阿尔托莉雅（最大 Saber）即可胜利，同时不要让球堆稳定越过警戒线。</p>
          <ul><li>移动鼠标 / 手指选择落点</li><li>点击 / 空格投放</li><li>每 6 次投放获得清理彗星</li></ul>
          <button onClick={startGame}>开始合成</button>
        </div>
      )}
      {status === "won" && showVictoryCg && (
        <div className={styles.victoryCg} role="dialog" aria-modal="true" aria-label="大 Saber 胜利动画">
          <Image
            className={styles.victoryCgImage}
            src={VICTORY_CG_SRC}
            alt="阿尔托莉雅高举圣剑的胜利画面"
            fill
            sizes="100vw"
            unoptimized
            priority
          />
          <div className={styles.victoryLight} />
          <div className={styles.victoryCopy}>
            <span>FINAL MERGE</span>
            <h2>大 Saber 降临</h2>
            <p>阿尔托莉雅完成了最终合成</p>
            <button autoFocus onClick={() => setShowVictoryCg(false)}>查看结算</button>
          </div>
        </div>
      )}
      {showResult && (
        <div className={styles.overlay}>
          <span className={styles.mark}><Image src={PLANET_PORTRAITS[status === "won" ? 10 : hud.maxTier].src} alt="" width={92} height={92} /></span>
          <h3>{status === "won" ? "大 Saber 合成成功" : "星仓已满"}</h3>
          <p>{result}。本局 {hud.score.toLocaleString()} 分，历史最高 {Math.max(bestScore, hud.score).toLocaleString()}。</p>
          <ul><li>投放 {hud.drops} 次</li><li>最高合成 {PLANET_TIERS[hud.maxTier].name} · {PLANET_PORTRAITS[hud.maxTier].shortName}</li></ul>
          <button onClick={startGame}>再合一局</button>
        </div>
      )}
    </div>
  );
}
