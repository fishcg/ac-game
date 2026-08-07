"use client";

import { useEffect, useRef, useState } from "react";
import { gameAudio } from "@/lib/audio/gameAudio";
import type { MiniGameProps } from "../types";
import { BambooCicadaAudio } from "./audio";
import { BAMBOO_ART_CREDIT } from "./assets";
import { INITIAL_HUD, PHRASES } from "./data";
import { BambooCicadaEngine } from "./Engine";
import type { BambooFinishReason, BambooGameStatus, BambooHud } from "./types";
import styles from "./Game.module.css";

const JUDGEMENT_LABEL = {
  silent: "还没鸣响",
  slow: "再快一点",
  steady: "正合鸣律",
  fast: "稍微放慢",
  danger: "危险！竹绳过载",
};

const RESULT_COPY: Record<BambooFinishReason, { title: string; detail: string }> = {
  "concert-complete": { title: "一庭鸣夏", detail: "三段鸣律已经连成完整的夏夜回响。" },
  "time-up": { title: "蝉声未成", detail: "时间到了。沿着提示圈稳定画圆，会比拼命甩动更快完成。" },
  "rope-broken": { title: "竹绳崩断", detail: "长时间超速会让绳子过载；出现红色警告时放慢手腕。" },
};

export function BambooCicada({ bestScore, onScore }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BambooCicadaEngine | null>(null);
  const audioRef = useRef<BambooCicadaAudio | null>(null);
  const onScoreRef = useRef(onScore);
  const submittedRef = useRef(false);
  const [status, setStatus] = useState<BambooGameStatus>("idle");
  const [hud, setHud] = useState<BambooHud>(INITIAL_HUD);
  const [finishReason, setFinishReason] = useState<BambooFinishReason>("time-up");

  useEffect(() => { onScoreRef.current = onScore; }, [onScore]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const audio = new BambooCicadaAudio();
    audioRef.current = audio;
    const engine = new BambooCicadaEngine(canvas, {
      onHud: setHud,
      onStatus: (nextStatus, score, reason) => {
        setStatus(nextStatus);
        if (reason) setFinishReason(reason);
        if (nextStatus === "won" && !submittedRef.current) {
          submittedRef.current = true;
          onScoreRef.current(score);
        }
      },
      onVoice: (rps, voice) => audio.setVoice(rps, voice),
      onEffect: (effect) => {
        if (effect === "phrase") gameAudio.play("perfect");
        else if (effect === "pulse") gameAudio.play("great");
        else if (effect === "warning") gameAudio.play("miss");
        else if (effect === "win") gameAudio.play("win");
        else if (effect === "lost") gameAudio.play("crash");
      },
      onGesture: () => audio.unlock(),
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      audio.dispose();
      engineRef.current = null;
      audioRef.current = null;
    };
  }, []);

  const start = () => {
    submittedRef.current = false;
    audioRef.current?.unlock();
    gameAudio.play("start");
    engineRef.current?.start();
  };

  const togglePause = () => {
    gameAudio.play("tap");
    engineRef.current?.togglePause();
  };

  const phrase = PHRASES[hud.phraseIndex];
  const result = RESULT_COPY[finishReason];
  const displayBest = Math.max(bestScore, status === "won" ? hud.score : 0);
  const direction = hud.direction === 1 ? "顺时针" : hud.direction === -1 ? "逆时针" : "等待起转";
  const rpsPosition = Math.min(100, hud.rps / 5.2 * 100);
  const targetLeft = phrase.minRps / 5.2 * 100;
  const targetWidth = (phrase.maxRps - phrase.minRps) / 5.2 * 100;

  return (
    <div className={`${styles.game} ${styles[`state-${status}`]}`}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="竹知了甩动区域，按住鼠标或手指画圆" />

      <header className={styles.hud} aria-live="polite">
        <div className={styles.branding}><span>夏夜玩物</span><strong>竹知了</strong><small>{phrase.name} · {phrase.subtitle}</small></div>
        <div className={styles.phraseTrack} aria-label={`当前第 ${hud.phraseIndex + 1} 段，共 ${PHRASES.length} 段`}>
          {PHRASES.map((item, index) => (
            <span key={item.id} className={index < hud.phraseIndex ? styles.complete : index === hud.phraseIndex ? styles.current : ""}>
              <i style={{ "--phrase-accent": item.accent } as React.CSSProperties} />
              <b>{item.name}</b>
            </span>
          ))}
        </div>
        <div className={styles.scoreBlock}><small>得分</small><strong>{hud.score.toLocaleString()}</strong><span>最高 {displayBest.toLocaleString()}</span></div>
        <div className={styles.timer}><small>剩余</small><strong>{Math.ceil(hud.remaining)}</strong><span>秒</span></div>
        <button className={styles.pauseButton} onClick={togglePause} disabled={status !== "playing" && status !== "paused"} aria-label={status === "paused" ? "继续游戏" : "暂停游戏"}>{status === "paused" ? "▶" : "Ⅱ"}</button>
      </header>

      <aside className={styles.meterPanel}>
        <div className={`${styles.judgement} ${styles[`judgement-${hud.judgement}`]}`}><i />{JUDGEMENT_LABEL[hud.judgement]}</div>
        <div className={styles.rpsReadout}><strong>{hud.rps.toFixed(1)}</strong><span>圈 / 秒</span></div>
        <div className={styles.speedTrack}>
          <span className={styles.targetBand} style={{ left: `${targetLeft}%`, width: `${targetWidth}%`, background: phrase.accent }} />
          <i className={styles.speedNeedle} style={{ left: `${rpsPosition}%` }} />
        </div>
        <div className={styles.range}><span>0</span><b>目标 {phrase.minRps.toFixed(1)}–{phrase.maxRps.toFixed(1)}</b><span>5.2</span></div>
        <div className={styles.progressLabel}><span>鸣律稳定度</span><b>{Math.round(hud.phraseProgress * 100)}%</b></div>
        <div className={styles.progressBar}><i style={{ width: `${hud.phraseProgress * 100}%`, background: phrase.accent }} /></div>
        <div className={styles.tensionLabel}><span>竹绳压力</span><b>{Math.round(hud.tension * 100)}%</b></div>
        <div className={`${styles.tensionBar} ${hud.tension > 0.55 ? styles.tensionDanger : ""}`}><i style={{ width: `${hud.tension * 100}%` }} /></div>
      </aside>

      <div className={styles.combo} data-active={hud.combo > 1}><span>连鸣</span><strong>×{hud.combo}</strong><small>{direction}</small></div>
      {status === "playing" && hud.voice < 0.12 && <div className={styles.gestureHint}><i>↻</i><span>按住 · 画圆 · 让绳子绷紧</span></div>}
      <div className={styles.bottomLore}><span>竹膜为鼓 · 松香为弦</span><i /> <span>稳住圈速，鸣声自然会来</span></div>

      {status === "idle" && (
        <div className={styles.overlay}>
          <div className={styles.seal}>鸣</div>
          <span className={styles.kicker}>原创互动玩具 · 夏夜鸣律</span>
          <h3>竹知了·鸣夏</h3>
          <p>按住鼠标或手指画圆。真正的鸣叫来自圈速与绳子张力，把速度稳定在金色目标区，完成三段夏夜鸣奏。</p>
          <div className={styles.rules}><span><b>01</b>画圆起声</span><span><b>02</b>稳住目标</span><span><b>03</b>避免超速</span></div>
          <button onClick={start}>开始鸣夏</button>
          <small>{BAMBOO_ART_CREDIT}</small>
        </div>
      )}

      {status === "paused" && (
        <div className={`${styles.overlay} ${styles.pauseOverlay}`}>
          <div className={styles.seal}>歇</div><h3>竹影暂静</h3><p>计时、物理、连击和声音都已暂停。</p>
          <div className={styles.overlayActions}><button onClick={togglePause}>继续甩动</button><button onClick={start}>重新开始</button></div>
        </div>
      )}

      {(status === "won" || status === "lost") && (
        <div className={`${styles.overlay} ${styles.resultOverlay}`}>
          <div className={styles.seal}>{status === "won" ? "成" : "止"}</div>
          <span className={styles.kicker}>{status === "won" ? "鸣奏完成" : "本局结束"}</span>
          <h3>{result.title}</h3><p>{result.detail}</p>
          <div className={styles.resultScore}><span>本局得分</span><strong>{hud.score.toLocaleString()}</strong><small>最高连鸣 ×{hud.bestCombo}</small></div>
          <button onClick={start}>再鸣一局</button>
        </div>
      )}
    </div>
  );
}
