"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { MiniGameProps } from "../types";
import { gameAudio } from "@/lib/audio/gameAudio";

const LANES = [-3, 0, 3];
const BASE_SPEED = 8.5;
const MAX_SPEED = 25;

function speedForSurvivalTime(seconds: number) {
  return Math.min(MAX_SPEED, BASE_SPEED + seconds * 0.85 + Math.pow(seconds, 1.35) * 0.07);
}

function RunnerScene({ session, onCrash, onTick, targetLane }: { session: number; onCrash: (score: number) => void; onTick: (score: number, speed: number) => void; targetLane: React.RefObject<number> }) {
  const player = useRef<THREE.Mesh>(null);
  const obstacles = useRef<THREE.Mesh[]>([]);
  const survivalTime = useRef(0);
  const lastReported = useRef(-1);
  const ended = useRef(false);

  useEffect(() => {
    survivalTime.current = 0;
    lastReported.current = -1;
    ended.current = false;
    obstacles.current.forEach((mesh, index) => {
      mesh.position.set(LANES[Math.floor(Math.random() * LANES.length)], 0, -14 - index * 9);
    });
  }, [session]);

  useFrame((_state, delta) => {
    if (!player.current || ended.current) return;
    const step = Math.min(delta, 0.05);
    survivalTime.current += step;
    const speed = speedForSurvivalTime(survivalTime.current);
    player.current.position.x = THREE.MathUtils.lerp(player.current.position.x, LANES[targetLane.current], Math.min(1, step * 11));
    player.current.rotation.y += step * (1.8 + speed * 0.035);
    player.current.rotation.z = -player.current.position.x * 0.04;

    obstacles.current.forEach((mesh) => {
      mesh.position.z += step * speed;
      mesh.rotation.x += step * (0.6 + speed * 0.035);
      mesh.rotation.y += step * (0.8 + speed * 0.045);
      if (mesh.position.z > 8) {
        mesh.position.z = -62 - Math.random() * 14;
        mesh.position.x = LANES[Math.floor(Math.random() * LANES.length)];
        gameAudio.play("score");
      }
      if (Math.abs(mesh.position.z - 3) < 1.2 && Math.abs(mesh.position.x - player.current!.position.x) < 1.15) {
        ended.current = true;
        onCrash(Math.floor(survivalTime.current * 10));
      }
    });

    const displayScore = Math.floor(survivalTime.current * 10);
    if (displayScore !== lastReported.current) {
      lastReported.current = displayScore;
      onTick(displayScore, speed);
    }
  });

  return (
    <>
      <color attach="background" args={["#090b21"]} />
      <fog attach="fog" args={["#090b21", 16, 62]} />
      <ambientLight intensity={1.1} />
      <pointLight position={[0, 6, 5]} color="#ff6b4a" intensity={35} distance={18} />
      <pointLight position={[-6, 2, -8]} color="#706ff0" intensity={50} distance={20} />
      <mesh ref={player} position={[0, 0, 3]} castShadow>
        <octahedronGeometry args={[0.78, 0]} />
        <meshStandardMaterial color="#fff7de" emissive="#ff6b4a" emissiveIntensity={0.45} roughness={0.25} metalness={0.35} />
      </mesh>
      {Array.from({ length: 8 }, (_, index) => (
        <mesh key={index} ref={(mesh) => { if (mesh) obstacles.current[index] = mesh; }} position={[LANES[index % 3], 0, -14 - index * 9]}>
          <dodecahedronGeometry args={[index % 2 ? 0.9 : 1.08, 0]} />
          <meshStandardMaterial color={index % 2 ? "#ff5e66" : "#7772ff"} emissive={index % 2 ? "#9c1824" : "#332b99"} emissiveIntensity={0.8} roughness={0.45} />
        </mesh>
      ))}
      {LANES.map((x) => <mesh key={x} position={[x, -1.08, -20]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.06, 65]} /><meshBasicMaterial color="#5c5ee6" transparent opacity={0.5} /></mesh>)}
      <mesh position={[0, -1.12, -20]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[11, 70, 12, 20]} /><meshBasicMaterial color="#111532" wireframe transparent opacity={0.75} /></mesh>
      {Array.from({ length: 40 }, (_, index) => <mesh key={`star-${index}`} position={[(index * 7.31) % 24 - 12, (index * 3.7) % 10 - 1, -((index * 11.2) % 58)]}><sphereGeometry args={[0.035 + (index % 3) * 0.018, 5, 5]} /><meshBasicMaterial color="#fffbd7" /></mesh>)}
    </>
  );
}

export function OrbitDash({ bestScore, onScore }: MiniGameProps) {
  const [status, setStatus] = useState<"intro" | "running" | "over">("intro");
  const [score, setScore] = useState(0);
  const [speed, setSpeed] = useState(BASE_SPEED);
  const [session, setSession] = useState(0);
  const targetLane = useRef(1);

  const move = useCallback((direction: -1 | 1) => {
    const nextLane = Math.max(0, Math.min(2, targetLane.current + direction));
    if (nextLane !== targetLane.current) gameAudio.play("move");
    targetLane.current = nextLane;
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (["ArrowLeft", "a", "A"].includes(event.key)) move(-1);
      if (["ArrowRight", "d", "D"].includes(event.key)) move(1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [move]);

  const start = () => {
    gameAudio.play("start");
    targetLane.current = 1;
    setScore(0);
    setSpeed(BASE_SPEED);
    setSession((value) => value + 1);
    setStatus("running");
  };

  const crash = (finalScore: number) => {
    gameAudio.play("crash");
    setScore(finalScore);
    onScore(finalScore);
    setStatus("over");
  };

  const tick = (nextScore: number, nextSpeed: number) => {
    setScore(nextScore);
    setSpeed(nextSpeed);
  };

  return (
    <div className="mini-game orbit-game">
      <Canvas camera={{ position: [0, 5.4, 10], fov: 56 }} dpr={[1, 1.7]} gl={{ antialias: true }}>
        {status === "running" && <RunnerScene session={session} onCrash={crash} onTick={tick} targetLane={targetLane} />}
        {status !== "running" && <><color attach="background" args={["#090b21"]} /><ambientLight intensity={1} /><mesh rotation={[0.45, 0.6, 0.2]}><icosahedronGeometry args={[1.5, 1]} /><meshStandardMaterial color="#ff6b4a" wireframe /></mesh><pointLight position={[3, 3, 4]} intensity={45} color="#ff6b4a" /></>}
      </Canvas>
      <div className="game-hud"><span>坚持时间</span><strong>{(score / 10).toFixed(1)}<small>s</small></strong><span className="hud-best">BEST {(Math.max(bestScore, score) / 10).toFixed(1)}s</span><span className="hud-speed">速度 ×{(speed / BASE_SPEED).toFixed(2)}</span></div>
      {status !== "running" && <div className="game-overlay"><span className="overlay-mark">✦</span><h3>{status === "intro" ? "星轨已就绪" : "撞上能量块了"}</h3><p>{status === "intro" ? "左右移动躲避障碍，飞行速度会随时间持续提升。" : `坚持了 ${(score / 10).toFixed(1)} 秒，再来一次刷新纪录。`}</p><button onClick={start}>{status === "intro" ? "开始穿梭" : "再试一次"}</button></div>}
      <div className="touch-controls"><button onPointerDown={() => move(-1)} aria-label="向左">←</button><button onPointerDown={() => move(1)} aria-label="向右">→</button></div>
    </div>
  );
}
