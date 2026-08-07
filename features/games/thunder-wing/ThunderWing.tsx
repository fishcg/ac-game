"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import type { MiniGameProps } from "../types";
import { gameAudio } from "@/lib/audio/gameAudio";
import { loadThunderImages, thunderAssets, type ThunderImages } from "./assets";
import { playThunderSound, primeThunderAudio } from "./audio";
import { ThunderWingEngine } from "./gameEngine";
import { GAME_HEIGHT, GAME_WIDTH, type GameStatus, type MovementInput, type ThunderHud } from "./types";
import styles from "./ThunderWing.module.css";

const INITIAL_HUD: ThunderHud = { score: 0, lives: 5, shield: 100, power: 2, weapon: "cannon", wingmen: 0, wave: 1, bossHp: null, bossName: null, bossPhase: null };
const WEAPON_LABEL = { cannon: "脉冲炮", laser: "贯穿激光", spread: "散射弹" } as const;
const MAX_GAME_HEIGHT = 1120;

function fitCanvasToViewport(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const height = Math.max(GAME_HEIGHT, Math.min(MAX_GAME_HEIGHT, Math.round(GAME_WIDTH * rect.height / Math.max(1, rect.width))));
  if (canvas.width !== GAME_WIDTH) canvas.width = GAME_WIDTH;
  if (canvas.height !== height) canvas.height = height;
  return height;
}

export function ThunderWing({ bestScore, onScore }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ThunderWingEngine | null>(null);
  const imagesRef = useRef<ThunderImages | null>(null);
  const movementRef = useRef<MovementInput>({ left: false, right: false, up: false, down: false });
  const [status, setStatus] = useState<GameStatus>("intro");
  const [session, setSession] = useState(0);
  const [hud, setHud] = useState<ThunderHud>(INITIAL_HUD);
  const [loadError, setLoadError] = useState("");

  const startGame = useCallback(async () => {
    setStatus("loading");
    setLoadError("");
    primeThunderAudio();
    try {
      imagesRef.current = await loadThunderImages();
      gameAudio.play("start");
      setHud(INITIAL_HUD);
      setSession((value) => value + 1);
      setStatus("running");
    } catch {
      setLoadError("素材加载失败，请检查网络后重试");
      setStatus("intro");
    }
  }, []);

  useEffect(() => {
    if (status !== "running" || !imagesRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const logicalHeight = fitCanvasToViewport(canvas);
    const context = canvas.getContext("2d");
    if (!context) return;
    const engine = new ThunderWingEngine(context, imagesRef.current, {
      onHud: setHud,
      onSound: playThunderSound,
      onGameOver: (score) => {
        onScore(score);
        setStatus("over");
      },
    }, GAME_WIDTH, logicalHeight);
    engineRef.current = engine;
    const resizeObserver = new ResizeObserver(() => {
      const nextHeight = fitCanvasToViewport(canvas);
      engine.resize(GAME_WIDTH, nextHeight);
    });
    resizeObserver.observe(canvas);
    let frame = 0;
    let previous = performance.now();
    const animate = (now: number) => {
      const delta = (now - previous) / 1000;
      previous = now;
      engine.update(delta, movementRef.current);
      engine.draw();
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      engineRef.current = null;
    };
  }, [onScore, session, status]);

  useEffect(() => {
    const keys: Record<string, keyof MovementInput> = {
      ArrowLeft: "left", a: "left", A: "left",
      ArrowRight: "right", d: "right", D: "right",
      ArrowUp: "up", w: "up", W: "up",
      ArrowDown: "down", s: "down", S: "down",
    };
    const handleKey = (event: KeyboardEvent, pressed: boolean) => {
      if (["q", "Q"].includes(event.key) && pressed) {
        event.preventDefault();
        engineRef.current?.cycleWeapon();
        return;
      }
      const direction = keys[event.key];
      if (!direction) return;
      event.preventDefault();
      movementRef.current[direction] = pressed;
    };
    const keydown = (event: KeyboardEvent) => handleKey(event, true);
    const keyup = (event: KeyboardEvent) => handleKey(event, false);
    const reset = () => { movementRef.current = { left: false, right: false, up: false, down: false }; };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", reset);
    };
  }, []);

  const moveToPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (status !== "running") return;
    const rect = event.currentTarget.getBoundingClientRect();
    engineRef.current?.setPlayerTarget(
      ((event.clientX - rect.left) / rect.width) * event.currentTarget.width,
      ((event.clientY - rect.top) / rect.height) * event.currentTarget.height,
    );
  };

  return (
    <div className={styles.game}>
      <div className={styles.cabinet}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); moveToPointer(event); }}
          onPointerMove={(event) => { if (event.buttons || event.pointerType === "touch") moveToPointer(event); }}
          aria-label="雷霆突击游戏区域"
        />

        {status === "running" && <>
          <div className={styles.hud} aria-live="polite">
            <div className={styles.score}><span>SCORE</span><strong>{hud.score.toString().padStart(6, "0")}</strong></div>
            <div className={styles.wave}>WAVE {hud.wave}</div>
            <div className={styles.lives}>{Array.from({ length: hud.lives }, (_, index) => <img key={index} src={thunderAssets.playerLife} alt="生命" />)}</div>
            <div className={styles.power}><span>火力</span><i>{Array.from({ length: 5 }, (_, index) => <b key={index} className={index < hud.power ? styles.active : ""} />)}</i></div>
            <div className={styles.shield}><span>护盾</span><i><b style={{ width: `${hud.shield}%` }} /></i></div>
            <div className={styles.wingmen}><span>僚机 {hud.wingmen}/2</span><i>{Array.from({ length: 2 }, (_, index) => <b key={index} className={index < hud.wingmen ? styles.active : ""} />)}</i></div>
          </div>
          <button className={styles.weaponSwitch} onClick={() => engineRef.current?.cycleWeapon()}><span>{WEAPON_LABEL[hud.weapon]}</span><small>Q 切换</small></button>
          {hud.bossHp !== null && <div className={styles.bossBar}><span>⚠ {hud.bossName} · 阶段 {hud.bossPhase}</span><i><b style={{ width: `${hud.bossHp * 100}%` }} /></i></div>}
          <div className={styles.dragHint}>拖动战机 · 自动射击</div>
        </>}

        {(status === "intro" || status === "loading") && <div className={styles.intro}>
          <div className={styles.introGlow} />
          <img className={styles.introBoss} src={thunderAssets.bossScarlet} alt="敌方旗舰" />
          <img className={styles.introMeteor} src={thunderAssets.meteor} alt="太空陨石" />
          <div className={styles.titleBlock}>
            <span>ORIGINAL ARCADE MISSION</span>
            <h3>雷霆<br /><em>突击</em></h3>
            <p>突破敌群 · 强化火力 · 击落旗舰</p>
          </div>
          <img className={styles.introPlayer} src={thunderAssets.player} alt="蓝色雷霆战机" />
          <img className={`${styles.introWingman} ${styles.introWingmanLeft}`} src={thunderAssets.wingmanLeft} alt="绿色僚机" />
          <img className={`${styles.introWingman} ${styles.introWingmanRight}`} src={thunderAssets.wingmanRight} alt="橙色僚机" />
          <button onClick={startGame} disabled={status === "loading"}>{status === "loading" ? "正在装载战机…" : "进入战场"}</button>
          {loadError && <small className={styles.error}>{loadError}</small>}
          <small className={styles.credit}>美术与音效：Kenney · CC0</small>
        </div>}

        {status === "over" && <div className={styles.over}>
          <span>MISSION OVER</span>
          <h3>本次得分</h3>
          <strong>{hud.score}</strong>
          <p>{hud.score > bestScore ? "新纪录！成绩已写入玩家排名" : `个人最高 ${bestScore}`}</p>
          <button onClick={startGame}>再次出击</button>
        </div>}
      </div>
      <aside className={styles.missionPanel}>
        <span>MISSION 01</span>
        <strong>星门防线</strong>
        <p>三套主武器可随时切换，绿色核心会呼叫追踪导弹僚机。旗舰将在第 35 秒跃迁。</p>
        <div><i>01</i><b>三型主武器</b><small>脉冲 / 激光 / 散射</small></div>
        <div><i>02</i><b>双僚机协同</b><small>自动发射追踪导弹</small></div>
        <div><i>03</i><b>多形态旗舰</b><small>扇形 / 环形 / 旋转弹幕</small></div>
      </aside>
    </div>
  );
}
