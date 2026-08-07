"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import type { MiniGameProps } from "../types";
import { gameAudio } from "@/lib/audio/gameAudio";

type Block = { x: number; y: number; width: number; color: string };
const COLORS = ["#ff765c", "#ffae55", "#f4d65e", "#5ec7a2", "#6f80e8", "#a66fe8"];

function TowerScene({ onProgress, onEnd }: { onProgress: (score: number) => void; onEnd: (score: number) => void }) {
  const { size } = useThree();
  const [blocks, setBlocks] = useState<Block[]>([{ x: 0, y: -2, width: 4, color: COLORS[0] }]);
  const moving = useRef<THREE.Mesh>(null);
  const tower = useRef<THREE.Group>(null);
  const dropRequested = useRef(false);
  const ended = useRef(false);
  const phaseStartedAt = useRef<number | null>(null);

  useEffect(() => {
    const drop = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        dropRequested.current = true;
        gameAudio.play("drop");
      }
    };
    window.addEventListener("keydown", drop);
    return () => window.removeEventListener("keydown", drop);
  }, []);

  useFrame((state, delta) => {
    if (tower.current) {
      const targetY = -Math.max(0, (blocks.length - 6) * 0.58);
      tower.current.position.y += (targetY - tower.current.position.y) * Math.min(1, delta * 5);
    }
    if (!moving.current || ended.current) return;
    const level = blocks.length;
    if (phaseStartedAt.current === null) phaseStartedAt.current = state.clock.elapsedTime;
    const phaseTime = state.clock.elapsedTime - phaseStartedAt.current;
    const travel = size.height > size.width * 1.25 ? 2.7 : 4.4;
    moving.current.position.x = Math.sin(phaseTime * (1.7 + level * 0.035)) * travel;

    if (dropRequested.current) {
      dropRequested.current = false;
      const previous = blocks[blocks.length - 1];
      const x = moving.current.position.x;
      const overlap = previous.width - Math.abs(x - previous.x);
      if (overlap <= 0.16) {
        ended.current = true;
        onEnd(blocks.length - 1);
        return;
      }
      const nextX = (x + previous.x) / 2;
      const next = { x: nextX, y: -2 + blocks.length * 0.58, width: overlap, color: COLORS[blocks.length % COLORS.length] };
      const nextBlocks = [...blocks, next];
      setBlocks(nextBlocks);
      onProgress(nextBlocks.length - 1);
      phaseStartedAt.current = state.clock.elapsedTime;
    }
  });

  const current = blocks[blocks.length - 1];
  return (
    <group onPointerDown={() => { dropRequested.current = true; gameAudio.play("drop"); }}>
      <color attach="background" args={["#dce8ff"]} />
      <fog attach="fog" args={["#dce8ff", 15, 28]} />
      <ambientLight intensity={1.8} />
      <directionalLight position={[6, 10, 8]} intensity={2.5} castShadow />
      <group ref={tower}>
        {blocks.map((block, index) => <mesh key={index} position={[block.x, block.y, 0]} castShadow receiveShadow><boxGeometry args={[block.width, 0.54, 3.3]} /><meshStandardMaterial color={block.color} roughness={0.65} /></mesh>)}
        <mesh ref={moving} position={[-4, current.y + 0.58, 0]} castShadow><boxGeometry args={[current.width, 0.54, 3.3]} /><meshStandardMaterial color={COLORS[blocks.length % COLORS.length]} roughness={0.55} /></mesh>
        <mesh position={[0, -2.32, 0]} receiveShadow><cylinderGeometry args={[4, 4.7, 0.3, 48]} /><meshStandardMaterial color="#f7f1df" /></mesh>
      </group>
      <mesh position={[-6, 1, -7]}><sphereGeometry args={[1.7, 16, 12]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.65} /></mesh>
      <mesh position={[7, 4, -9]}><sphereGeometry args={[2.2, 16, 12]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.52} /></mesh>
    </group>
  );
}

export function StackUp({ bestScore, onScore }: MiniGameProps) {
  const [status, setStatus] = useState<"intro" | "running" | "over">("intro");
  const [score, setScore] = useState(0);
  const [session, setSession] = useState(0);
  const [portrait, setPortrait] = useState(() => typeof window !== "undefined" && window.innerHeight > window.innerWidth * 1.25);

  useEffect(() => {
    const sync = () => setPortrait(window.innerHeight > window.innerWidth * 1.25);
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  const start = () => {
    gameAudio.play("start");
    setScore(0);
    setSession((value) => value + 1);
    setStatus("running");
  };

  const finish = (value: number) => {
    gameAudio.play("crash");
    setScore(value);
    onScore(value);
    setStatus("over");
  };

  const progress = (value: number) => {
    gameAudio.play("stack");
    setScore(value);
  };

  return (
    <div className="mini-game stack-game">
      <Canvas shadows camera={portrait ? { position: [8.5, 5, 13], fov: 60 } : { position: [8, 4.8, 9], fov: 48 }} dpr={[1, 1.7]} onPointerDown={() => undefined}>
        {status === "running" ? <TowerScene key={session} onProgress={progress} onEnd={finish} /> : <><color attach="background" args={["#dce8ff"]} /><ambientLight intensity={2} /><directionalLight position={[5, 8, 5]} intensity={3} /><mesh rotation={[0.3, 0.5, 0]}><boxGeometry args={[3, 0.7, 3]} /><meshStandardMaterial color="#6f80e8" /></mesh></>}
      </Canvas>
      <div className="game-hud game-hud--dark"><span>层数</span><strong>{score}</strong><span className="hud-best">BEST {Math.max(bestScore, score)}</span></div>
      {status !== "running" && <div className="game-overlay game-overlay--light"><span className="overlay-mark">▰</span><h3>{status === "intro" ? "搭向云端" : "高塔失去平衡"}</h3><p>{status === "intro" ? "看准方块重合的位置，点击让它落下。" : `成功叠起 ${score} 层，手感越来越好了。`}</p><button onClick={start}>{status === "intro" ? "开始堆叠" : "再搭一次"}</button></div>}
      {status === "running" && <button className="stack-drop" onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }))}>落下方块</button>}
    </div>
  );
}
