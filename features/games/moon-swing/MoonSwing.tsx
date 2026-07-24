"use client";

import { useEffect, useRef, useState } from "react";
import type { MiniGameProps } from "../types";
import { MoonSwingEngine } from "./MoonSwingEngine";
import type { MoonSwingHud, MoonSwingStatus } from "./types";
import styles from "./MoonSwing.module.css";

const INITIAL_HUD:MoonSwingHud={score:0,distance:0,progress:0,stars:0,combo:0,attached:true,targetReady:false,message:"点击释放绳索"};

export function MoonSwing({bestScore,onScore}:MiniGameProps){
  const canvasRef=useRef<HTMLCanvasElement>(null);const engineRef=useRef<MoonSwingEngine|null>(null);const scoreRef=useRef(onScore);
  const [status,setStatus]=useState<MoonSwingStatus>("idle");const [hud,setHud]=useState<MoonSwingHud>(INITIAL_HUD);const [resultMessage,setResultMessage]=useState("");
  useEffect(()=>{scoreRef.current=onScore;},[onScore]);
  useEffect(()=>{const canvas=canvasRef.current;if(!canvas)return;const engine=new MoonSwingEngine(canvas,{onHud:setHud,onStatus:(next,score,message)=>{setStatus(next);setResultMessage(message);if(next==="won"||next==="lost")scoreRef.current(score);}});engineRef.current=engine;
    const resize=()=>engine.resize();const key=(event:KeyboardEvent)=>{if(event.code==="Space"){event.preventDefault();engine.action();}if(event.key.toLowerCase()==="p")engine.togglePause();};window.addEventListener("resize",resize);window.addEventListener("keydown",key);return()=>{engine.destroy();window.removeEventListener("resize",resize);window.removeEventListener("keydown",key);};},[]);
  const start=()=>engineRef.current?.start();const action=()=>engineRef.current?.action();
  return <div className={styles.game}>
    <canvas ref={canvasRef} aria-label="月亮荡秋千星空" onPointerDown={action}/>
    {status!=="idle"&&<><div className={styles.hud}><div className={styles.panel}><small>距离</small><strong>{hud.distance}m</strong></div><div className={styles.panel}><small>得分</small><strong>{hud.score.toLocaleString()}</strong></div><div className={styles.panel}><small>星尘</small><strong>✦ {hud.stars}</strong></div>{hud.combo>1&&<span className={styles.combo}>PERFECT ×{hud.combo}</span>}<button className={styles.pause} onClick={()=>engineRef.current?.togglePause()} aria-label={status==="paused"?"继续游戏":"暂停游戏"}>{status==="paused"?"▶":"Ⅱ"}</button></div><div className={styles.coach}>{hud.message}</div><div className={styles.progress}><i style={{width:`${hud.progress*100}%`}}/></div>{status==="playing"&&<button className={`${styles.action} ${hud.targetReady?styles.ready:""}`} onClick={action}>{hud.attached?"释放绳索":hud.targetReady?"抓住星球":"等待目标"}</button>}</>}
    {status==="idle"&&<div className={styles.overlay}><span className={styles.mark}>☾</span><h3>月亮荡秋千</h3><p>点击释放绳索，飞近前方星球后再次点击抓住。借助摆动惯性收集星尘，一路荡到月宫。</p><ul><li>点击 / 空格释放</li><li>目标发光时再次点击</li><li>连续完美抓取提升倍率</li></ul><button onClick={start}>荡向月宫</button></div>}
    {(status==="won"||status==="lost")&&<div className={styles.overlay}><span className={styles.mark}>{status==="won"?"♛":"☾"}</span><h3>{status==="won"?"抵达月宫":"坠入星海"}</h3><p>{resultMessage} 本次获得 {hud.score.toLocaleString()} 分，历史最高 {Math.max(bestScore,hud.score).toLocaleString()}。</p><button onClick={start}>再荡一次</button></div>}
  </div>;
}
