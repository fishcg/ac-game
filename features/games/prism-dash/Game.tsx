"use client";

import { useEffect, useRef, useState } from "react";
import type { MiniGameProps } from "../types";
import { PrismDashEngine } from "./Engine";
import type { PrismDashHud, PrismDashStatus } from "./types";
import styles from "./PrismDash.module.css";

const INITIAL: PrismDashHud = { score: 0, progress: 0, shards: 0, speed: 1, zone: "霓虹序章", message: "点击或空格起跳" };

export function PrismDash({ bestScore, onScore }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null); const engineRef = useRef<PrismDashEngine | null>(null); const scoreRef = useRef(onScore);
  const [status,setStatus]=useState<PrismDashStatus>("idle"); const [hud,setHud]=useState(INITIAL); const [result,setResult]=useState("");
  useEffect(()=>{scoreRef.current=onScore;},[onScore]);
  useEffect(()=>{const canvas=canvasRef.current;if(!canvas)return;const engine=new PrismDashEngine(canvas,{onHud:setHud,onStatus:(next,score,message)=>{setStatus(next);setResult(message);if(next==="won"||next==="lost")scoreRef.current(score);}});engineRef.current=engine;
    const resize=()=>engine.resize();const key=(event:KeyboardEvent)=>{if(event.code==="Space"||event.key==="ArrowUp"){event.preventDefault();engine.action();}if(event.key.toLowerCase()==="p")engine.togglePause();};window.addEventListener("resize",resize);window.addEventListener("keydown",key);return()=>{engine.destroy();window.removeEventListener("resize",resize);window.removeEventListener("keydown",key);};},[]);
  return <div className={styles.game}><canvas ref={canvasRef} aria-label="棱镜跃动几何轨道" onPointerDown={()=>engineRef.current?.action()}/>
    {status!=="idle"&&<><div className={styles.hud}><div className={styles.panel}><small>得分</small><strong>{hud.score.toLocaleString()}</strong></div><div className={styles.panel}><small>棱晶</small><strong>◆ {hud.shards}</strong></div><div className={styles.panel}><small>区域</small><strong>{hud.zone}</strong></div><button className={styles.pause} onClick={()=>engineRef.current?.togglePause()}>{status==="paused"?"▶":"Ⅱ"}</button></div><div className={styles.progress}><i style={{width:`${hud.progress*100}%`}}/></div><div className={styles.coach}>{hud.message} · 速度 ×{hud.speed.toFixed(2)}</div></>}
    {status==="idle"&&<div className={styles.overlay}><span className={styles.mark}>◇</span><h3>棱镜跃动</h3><p>跟随脉冲穿越三段几何轨道。地面点击起跳，空中靠近金色光环时再次点击即可二段跃升。</p><ul><li>点击 / 空格 / ↑ 跳跃</li><li>收集棱晶追加得分</li><li>P 暂停</li></ul><button onClick={()=>engineRef.current?.start()}>开始跃动</button></div>}
    {(status==="won"||status==="lost")&&<div className={styles.overlay}><span className={styles.mark}>{status==="won"?"✦":"◇"}</span><h3>{status==="won"?"突破棱镜天际":"节拍中断"}</h3><p>{result}。本局 {hud.score.toLocaleString()} 分，历史最高 {Math.max(bestScore,hud.score).toLocaleString()}。</p><ul><li>进度 {Math.round(hud.progress*100)}%</li><li>收集 {hud.shards} 枚棱晶</li></ul><button onClick={()=>engineRef.current?.start()}>立即重试</button></div>}
  </div>;
}
