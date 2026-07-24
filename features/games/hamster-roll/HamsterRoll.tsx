"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { gameAudio } from "@/lib/audio/gameAudio";
import type { MiniGameProps } from "../types";
import styles from "../casual/CasualGames.module.css";

const LANES=[-2.6,0,2.6];
function HamsterScene({active,lane,onTick,onHit}:{active:boolean;lane:React.RefObject<number>;onTick:(score:number,speed:number)=>void;onHit:()=>void}){
  const hamster=useRef<THREE.Group>(null);const obstacles=useRef<THREE.Mesh[]>([]);const seeds=useRef<THREE.Mesh[]>([]);const elapsed=useRef(0);const score=useRef(0);const invulnerable=useRef(0);
  useFrame((_state,delta)=>{if(!active||!hamster.current)return;const step=Math.min(.045,delta);elapsed.current+=step;invulnerable.current=Math.max(0,invulnerable.current-step);const speed=Math.min(23,9+elapsed.current*.32);
    hamster.current.position.x=THREE.MathUtils.lerp(hamster.current.position.x,LANES[lane.current],Math.min(1,step*10));hamster.current.rotation.x-=step*speed*1.2;
    obstacles.current.forEach((mesh,index)=>{mesh.position.z+=step*speed;if(mesh.position.z>7){mesh.position.z=-45-index*10-Math.random()*16;mesh.position.x=LANES[Math.floor(Math.random()*3)];}if(invulnerable.current<=0&&Math.abs(mesh.position.z-3)<1.05&&Math.abs(mesh.position.x-hamster.current!.position.x)<1){invulnerable.current=1;mesh.position.z=-55-Math.random()*18;onHit();}});
    seeds.current.forEach((mesh,index)=>{mesh.position.z+=step*speed;if(mesh.position.z>7){mesh.position.z=-30-index*7-Math.random()*14;mesh.position.x=LANES[Math.floor(Math.random()*3)];mesh.visible=true;}if(mesh.visible&&Math.abs(mesh.position.z-3)<.9&&Math.abs(mesh.position.x-hamster.current!.position.x)<.9){mesh.visible=false;score.current+=50;gameAudio.play("score");}});
    score.current+=step*8;onTick(Math.floor(score.current),speed);
  });
  return <><color attach="background" args={["#9edb85"]}/><fog attach="fog" args={["#ccebb8",18,62]}/><ambientLight intensity={1.8}/><directionalLight position={[5,9,7]} intensity={3}/>
    <mesh position={[0,-1,-20]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[9,70]}/><meshStandardMaterial color="#d5b77a"/></mesh><mesh position={[-5,-1.05,-20]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[3,70]}/><meshStandardMaterial color="#64a854"/></mesh><mesh position={[5,-1.05,-20]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[3,70]}/><meshStandardMaterial color="#64a854"/></mesh>
    {LANES.slice(0,2).map((x,index)=><mesh key={x} position={[(x+LANES[index+1])/2,-.96,-20]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.08,70]}/><meshBasicMaterial color="#fff0b8" transparent opacity={.75}/></mesh>)}
    <group ref={hamster} position={[0,0,3]}><mesh><sphereGeometry args={[.82,20,16]}/><meshStandardMaterial color="#d99658" roughness={.8}/></mesh><mesh position={[-.37,.6,0]}><sphereGeometry args={[.25,14,10]}/><meshStandardMaterial color="#b96e48"/></mesh><mesh position={[.37,.6,0]}><sphereGeometry args={[.25,14,10]}/><meshStandardMaterial color="#b96e48"/></mesh><mesh position={[-.28,.19,.73]}><sphereGeometry args={[.08,8,8]}/><meshBasicMaterial color="#191713"/></mesh><mesh position={[.28,.19,.73]}><sphereGeometry args={[.08,8,8]}/><meshBasicMaterial color="#191713"/></mesh><mesh position={[0,-.05,.8]}><sphereGeometry args={[.09,8,8]}/><meshBasicMaterial color="#f08b88"/></mesh></group>
    {Array.from({length:7},(_,index)=><mesh key={`o-${index}`} ref={mesh=>{if(mesh)obstacles.current[index]=mesh;}} position={[LANES[index%3],-.25,-12-index*10]} rotation={[0,index*.4,0]}><boxGeometry args={[1.35,1.25,1.2]}/><meshStandardMaterial color={index%2?"#8b5b35":"#b9773f"}/></mesh>)}
    {Array.from({length:9},(_,index)=><mesh key={`s-${index}`} ref={mesh=>{if(mesh)seeds.current[index]=mesh;}} position={[LANES[(index+1)%3],.05,-8-index*7]} rotation={[Math.PI/2,0,index]}><torusGeometry args={[.3,.12,7,10]}/><meshStandardMaterial color="#f1ca43" emissive="#8f5f08" emissiveIntensity={.3}/></mesh>)}</>;
}

export function HamsterRoll({bestScore,onScore}:MiniGameProps){
  const [status,setStatus]=useState<"intro"|"running"|"paused"|"over">("intro");const [score,setScore]=useState(0);const [speed,setSpeed]=useState(9);const [health,setHealth]=useState(3);const lane=useRef(1);const scoreRef=useRef(0);
  const move=useCallback((direction:-1|1)=>{if(status!=="running")return;const next=Math.max(0,Math.min(2,lane.current+direction));if(next!==lane.current)gameAudio.play("move");lane.current=next;},[status]);
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(["a","A","ArrowLeft"].includes(event.key))move(-1);if(["d","D","ArrowRight"].includes(event.key))move(1);};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);},[move]);
  const finish=useCallback((finalScore:number)=>{setScore(finalScore);onScore(finalScore);setStatus("over");gameAudio.play("crash");},[onScore]);
  const hit=useCallback(()=>{gameAudio.play("crash");setHealth(value=>{if(value<=1){finish(scoreRef.current);return 0;}return value-1;});},[finish]);
  const tick=useCallback((value:number,nextSpeed:number)=>{scoreRef.current=value;setScore(value);setSpeed(nextSpeed);},[]);
  const start=()=>{lane.current=1;scoreRef.current=0;setScore(0);setSpeed(9);setHealth(3);setStatus("running");gameAudio.play("start");};
  return <div className={`${styles.game} ${styles.hamster}`}><Canvas camera={{position:[0,4.8,9],fov:55}} dpr={[1,1.5]}>{(status==="running"||status==="paused")&&<HamsterScene active={status==="running"} lane={lane} onTick={tick} onHit={hit}/>}</Canvas>
    <div className={styles.topbar}><div className={styles.stat}><small>路程积分</small><strong>{score}</strong></div><div className={styles.stat}><small>生命</small><strong>{"♥".repeat(health)}</strong></div><div className={styles.stat}><small>速度</small><strong>×{(speed/9).toFixed(1)}</strong></div><button className={styles.pause} onClick={()=>setStatus(status==="paused"?"running":"paused")}>Ⅱ</button></div>
    <div className={styles.laneControls}><button onPointerDown={()=>move(-1)}>←</button><button onPointerDown={()=>move(1)}>→</button></div>
    {status!=="running"&&<div className={styles.overlay}><div className={styles.panel}><span className={styles.mark}>🐹</span><h3>{status==="intro"?"花园赛道开放":status==="paused"?"仓鼠正在休息":"滚出赛道了"}</h3><p>{status==="intro"?"左右换道躲开木箱，收集葵花籽获得额外积分。":status==="paused"?"速度和赛道已经暂停。":`本局 ${score} 分，最高 ${Math.max(bestScore,score)} 分。`}</p><button className={styles.primary} onClick={status==="paused"?()=>setStatus("running"):start}>{status==="paused"?"继续滚动":status==="intro"?"开始滚动":"再跑一次"}</button></div></div>}
  </div>;
}
