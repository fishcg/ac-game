"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import type { MiniGameProps } from "../types";
import { gameAudio } from "@/lib/audio/gameAudio";
import { ironAssets, loadIronImages, type IronImages } from "./assets";
import { playIronSound, primeIronAudio } from "./audio";
import { IronFrontEngine } from "./gameEngine";
import { VIEW_HEIGHT, VIEW_WIDTH, type IronHud, type IronInput, type IronStatus } from "./types";
import styles from "./IronFront.module.css";

const INITIAL_HUD: IronHud = { score: 0, hp: 7, maxHp: 7, weapon: "pistol", ammo: -1, grenades: 7, rescued: 0, distance: 0, bossHp: null };
const EMPTY_INPUT: IronInput = { left: false, right: false, jump: false, crouch: false, aimUp: false, shoot: false, grenade: false };
const WEAPON_NAMES = { pistol: "制式手枪", machine: "重型机枪", shotgun: "战斗霰弹枪" } as const;

export function IronFront({ bestScore, onScore }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<IronFrontEngine | null>(null);
  const imagesRef = useRef<IronImages | null>(null);
  const inputRef = useRef<IronInput>({ ...EMPTY_INPUT });
  const [status, setStatus] = useState<IronStatus>("intro");
  const [session, setSession] = useState(0);
  const [hud, setHud] = useState<IronHud>(INITIAL_HUD);
  const [loadError, setLoadError] = useState("");

  const startGame = useCallback(async () => {
    setStatus("loading");
    setLoadError("");
    primeIronAudio();
    try {
      imagesRef.current = await loadIronImages();
      gameAudio.play("start");
      inputRef.current = { ...EMPTY_INPUT };
      setHud(INITIAL_HUD);
      setSession((value) => value + 1);
      setStatus("playing");
    } catch {
      setLoadError("素材加载失败，请稍后重试");
      setStatus("intro");
    }
  }, []);

  useEffect(() => {
    if (status !== "playing" || !imagesRef.current || !canvasRef.current) return;
    const context = canvasRef.current.getContext("2d");
    if (!context) return;
    const engine = new IronFrontEngine(context, imagesRef.current, {
      onHud: setHud,
      onSound: playIronSound,
      onEnd: (score, won) => {
        onScore(score);
        setStatus(won ? "won" : "over");
      },
    });
    engineRef.current = engine;
    let frame = 0;
    let previous = performance.now();
    const animate = (now: number) => {
      engine.update((now - previous) / 1000, inputRef.current);
      engine.draw();
      previous = now;
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); engineRef.current = null; };
  }, [onScore, session, status]);

  useEffect(() => {
    const keys: Record<string, keyof IronInput> = {
      a: "left", A: "left", ArrowLeft: "left",
      d: "right", D: "right", ArrowRight: "right",
      w: "aimUp", W: "aimUp", ArrowUp: "aimUp",
      s: "crouch", S: "crouch", ArrowDown: "crouch",
      " ": "jump", j: "shoot", J: "shoot", z: "shoot", Z: "shoot",
      k: "grenade", K: "grenade", x: "grenade", X: "grenade",
    };
    const updateKey = (event: KeyboardEvent, pressed: boolean) => {
      const action = keys[event.key];
      if (!action) return;
      event.preventDefault();
      inputRef.current[action] = pressed;
    };
    const down = (event: KeyboardEvent) => updateKey(event, true);
    const up = (event: KeyboardEvent) => updateKey(event, false);
    const reset = () => { inputRef.current = { ...EMPTY_INPUT }; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", reset);
    };
  }, []);

  const touch = (action: keyof IronInput, pressed: boolean) => { inputRef.current[action] = pressed; };
  const weaponAmmo = hud.ammo < 0 ? "∞" : hud.ammo;

  return (
    <div className={styles.game}>
      <canvas ref={canvasRef} width={VIEW_WIDTH} height={VIEW_HEIGHT} className={styles.canvas} aria-label="钢铁突围横版战场" />

      {status === "playing" && <>
        <div className={styles.hud}>
          <div className={styles.profile}><img src={ironAssets.face} alt="玩家头像" /><span><small>PLAYER 1</small><strong>{Array.from({ length: hud.maxHp }, (_, index) => <i key={index} className={index < hud.hp ? styles.hpOn : ""} />)}</strong></span></div>
          <div className={styles.score}><small>SCORE</small><strong>{hud.score.toString().padStart(7, "0")}</strong></div>
          <div className={styles.loadout}><small>{WEAPON_NAMES[hud.weapon]}</small><strong>{weaponAmmo}</strong><span>弹药</span></div>
          <div className={styles.grenades}><img src={ironAssets.grenade} alt="手雷" /><strong>× {hud.grenades}</strong></div>
          <div className={styles.rescue}><small>RESCUE</small><strong>{hud.rescued}/3</strong></div>
        </div>
        <div className={styles.progress}><span style={{ width: `${hud.distance * 100}%` }} /></div>
        {hud.bossHp !== null && <div className={styles.boss}><span>⚠ 装甲堡垒</span><i><b style={{ width: `${hud.bossHp * 100}%` }} /></i></div>}
        <div className={styles.touchControls}>
          <div><button onPointerDown={() => touch("left", true)} onPointerUp={() => touch("left", false)} onPointerCancel={() => touch("left", false)}>◀</button><button onPointerDown={() => touch("right", true)} onPointerUp={() => touch("right", false)} onPointerCancel={() => touch("right", false)}>▶</button></div>
          <div><button onPointerDown={() => touch("jump", true)} onPointerUp={() => touch("jump", false)} onPointerCancel={() => touch("jump", false)}>跳</button><button className={styles.fireButton} onPointerDown={() => touch("shoot", true)} onPointerUp={() => touch("shoot", false)} onPointerCancel={() => touch("shoot", false)}>火</button><button onPointerDown={() => touch("grenade", true)} onPointerUp={() => touch("grenade", false)} onPointerCancel={() => touch("grenade", false)}>雷</button></div>
        </div>
      </>}

      {(status === "intro" || status === "loading") && <div className={styles.intro}>
        <div className={styles.scanlines} />
        <span className={styles.mission}>ORIGINAL RUN &amp; GUN · MISSION 01</span>
        <h3>钢铁<span>突围</span></h3>
        <p>深入被占领的像素城市，营救三名队友并摧毁装甲堡垒。</p>
        <div className={styles.introScene}><i className={styles.heroSprite} /><i className={styles.tankSprite} /><b>VS</b></div>
        <div className={styles.featureList}><span>重型机枪</span><span>战斗霰弹枪</span><span>高爆手雷</span><span>逐帧动作</span></div>
        <button onClick={startGame} disabled={status === "loading"}>{status === "loading" ? "正在装载任务…" : "开始任务"}</button>
        {loadError && <small className={styles.error}>{loadError}</small>}
        <small className={styles.credit}>美术：16Pixel · CC-BY-SA 4.0　音效：Kenney · CC0</small>
      </div>}

      {(status === "over" || status === "won") && <div className={styles.result}>
        <span>{status === "won" ? "MISSION COMPLETE" : "MISSION FAILED"}</span>
        <h3>{status === "won" ? "装甲堡垒已摧毁" : "突围行动失败"}</h3>
        <strong>{hud.score}</strong>
        <p>营救 {hud.rescued}/3 · 历史最高 {Math.max(bestScore, hud.score)}</p>
        <button onClick={startGame}>再次出击</button>
      </div>}
    </div>
  );
}
