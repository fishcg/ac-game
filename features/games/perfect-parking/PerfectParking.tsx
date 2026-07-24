"use client";

import { useEffect, useRef, useState } from "react";
import type { MiniGameProps } from "../types";
import { ParkingEngine } from "./ParkingEngine";
import type { ParkingHud, ParkingStatus } from "./types";
import styles from "./PerfectParking.module.css";

const INITIAL_HUD: ParkingHud = { level: 1, totalLevels: 10, score: 0, combo: 0, lives: 3, speed: 0, timeLeft: 30, message: "按住油门，松开制动", quality: 0 };

export function PerfectParking({ bestScore, onScore }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ParkingEngine | null>(null);
  const scoreRef = useRef(onScore);
  const [status,setStatus] = useState<ParkingStatus>("idle");
  const [hud,setHud] = useState<ParkingHud>(INITIAL_HUD);
  const [resultMessage,setResultMessage] = useState("");

  useEffect(()=>{ scoreRef.current=onScore; },[onScore]);
  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas) return;
    const engine=new ParkingEngine(canvas,{onHud:setHud,onStatus:(next,score,message)=>{setStatus(next);setResultMessage(message);if(next==="won"||next==="lost")scoreRef.current(score);}});
    engineRef.current=engine;
    const resize=()=>engine.resize();
    const keyDown=(event:KeyboardEvent)=>{if(event.code==="Space"){event.preventDefault();engine.press();}if(event.key.toLowerCase()==="p")engine.togglePause();};
    const keyUp=(event:KeyboardEvent)=>{if(event.code==="Space"){event.preventDefault();engine.release();}};
    window.addEventListener("resize",resize);window.addEventListener("keydown",keyDown);window.addEventListener("keyup",keyUp);
    return()=>{engine.destroy();window.removeEventListener("resize",resize);window.removeEventListener("keydown",keyDown);window.removeEventListener("keyup",keyUp);};
  },[]);

  const start=()=>engineRef.current?.start();
  const press=()=>engineRef.current?.press();
  const release=()=>engineRef.current?.release();

  return <div className={styles.game}>
    <canvas ref={canvasRef} aria-label="完美停车道路" onPointerDown={(event)=>{event.currentTarget.setPointerCapture(event.pointerId);press();}} onPointerUp={release} onPointerCancel={release} onPointerLeave={(event)=>{if(event.buttons)release();}} />
    {status!=="idle"&&<><div className={styles.hud}>
      <div className={styles.panel}><small>关卡</small><strong>{hud.level}/{hud.totalLevels}</strong></div>
      <div className={styles.panel}><small>得分</small><strong>{hud.score.toLocaleString()}</strong></div>
      <div className={styles.panel}><small>速度</small><strong>{Math.round(hud.speed)} km/h</strong></div>
      <div className={styles.panel}><small>剩余</small><strong>{hud.timeLeft.toFixed(1)}s</strong></div>
      <span className={styles.lives}>{"♥".repeat(Math.max(0,hud.lives))}</span>
      {hud.combo>1&&<span className={styles.combo}>PERFECT ×{hud.combo}</span>}
      <button className={styles.pause} onClick={()=>engineRef.current?.togglePause()} aria-label={status==="paused"?"继续游戏":"暂停游戏"}>{status==="paused"?"▶":"Ⅱ"}</button>
    </div><div className={styles.coach}>{hud.message}</div><div className={styles.quality}><i style={{width:`${Math.round(hud.quality*100)}%`}}/></div>
    {status==="playing"&&<button className={styles.pedal} onPointerDown={(event)=>{event.currentTarget.setPointerCapture(event.pointerId);press();}} onPointerUp={release} onPointerCancel={release}>按住油门</button>}</>}
    {status==="idle"&&<div className={styles.overlay}><span className={styles.mark}>P</span><h3>完美停车</h3><p>按住让车辆前进，松开后自动制动。让整辆车稳稳停进停车框，越接近中心得分越高。</p><ul><li>按住鼠标 / 触摸 / 空格加速</li><li>松开即可制动</li><li>连续完美停车提升倍率</li></ul><button onClick={start}>开始练习</button></div>}
    {(status==="won"||status==="lost")&&<div className={styles.overlay}><span className={styles.mark}>{status==="won"?"★":"P"}</span><h3>{status==="won"?"金牌泊车员":"本次练习结束"}</h3><p>{resultMessage} 最终得分 {hud.score.toLocaleString()}，历史最高 {Math.max(bestScore,hud.score).toLocaleString()}。</p><button onClick={start}>再停一轮</button></div>}
  </div>;
}
