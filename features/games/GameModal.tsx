"use client";

import { useEffect, useRef, useState } from "react";
import type { GameInfo } from "@/config/games";
import { CloseIcon, FullscreenExitIcon, FullscreenIcon, TrophyIcon, VolumeIcon, VolumeOffIcon } from "@/components/ui/Icons";
import { gameAudio } from "@/lib/audio/gameAudio";
import { OrbitDash } from "./orbit-dash/OrbitDash";
import { StackUp } from "./stack-up/StackUp";
import { MemoryPairs } from "./memory-pairs/MemoryPairs";
import { BeatRush } from "./beat-rush/BeatRush";
import { ThunderWing } from "./thunder-wing/ThunderWing";
import { IronFront } from "./iron-front/IronFront";
import { NightfallSurvivors } from "./nightfall-survivors/NightfallSurvivors";
import { HamsterRoll } from "./hamster-roll/HamsterRoll";
import { GoldMiner } from "./gold-miner/GoldMiner";
import { OilTycoon } from "./oil-tycoon/OilTycoon";
import { Minesweeper } from "./minesweeper/Minesweeper";
import { GoGame } from "./go/GoGame";
import { ZumaGame } from "./zuma/ZumaGame";
import { PerfectParking } from "./perfect-parking/PerfectParking";
import { MoonSwing } from "./moon-swing/MoonSwing";
import { WormFront } from "./worm-front/WormFront";
import { PrismDash } from "./prism-dash/Game";
import { RunePeg } from "./rune-peg/Game";
import { FateChamber } from "./fate-chamber/Game";
import { PlanetMerge } from "./planet-merge/Game";
import { GuiyangMahjong } from "./guiyang-mahjong/Game";
import { GameViewport } from "./GameViewport";

type Props = {
  game: GameInfo;
  bestScore: number;
  onClose: () => void;
  onScore: (score: number) => void;
};

export function GameModal({ game, bestScore, onClose, onScore }: Props) {
  const [muted, setMuted] = useState(() => gameAudio.isMuted());
  const [fullscreen, setFullscreen] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef(false);

  useEffect(() => { fullscreenRef.current = fullscreen; }, [fullscreen]);

  useEffect(() => {
    const frame = frameRef.current;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.fullscreenElement) return;
      if (fullscreenRef.current) { setFullscreen(false); return; }
      onClose();
    };
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === frame);
    window.addEventListener("keydown", close);
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", close);
      document.removeEventListener("fullscreenchange", syncFullscreen);
      if (document.fullscreenElement === frame) void document.exitFullscreen();
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => gameAudio.subscribe(setMuted), []);

  const toggleAudio = () => {
    const next = !muted;
    gameAudio.setMuted(next);
    if (!next) gameAudio.play("tap");
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) { await document.exitFullscreen(); return; }
    if (fullscreen) { setFullscreen(false); return; }
    try {
      await frameRef.current?.requestFullscreen();
      if (document.fullscreenElement !== frameRef.current) setFullscreen(true);
    } catch {
      setFullscreen(true);
    }
  };

  return (
    <div className="game-modal" role="dialog" aria-modal="true" aria-label={game.title}>
      <div ref={frameRef} className={`game-modal__frame ${fullscreen ? "game-modal__frame--fullscreen" : ""}`}>
        <header className="game-modal__header">
          <div>
            <span className="game-modal__eyebrow">正在游玩</span>
            <h2>{game.title}</h2>
          </div>
          <div className="game-modal__meta">
            <span><TrophyIcon size={17} /> 最高 {bestScore}</span>
            <button className="icon-button" onClick={toggleAudio} aria-label={muted ? "开启声音" : "关闭声音"}>{muted ? <VolumeOffIcon /> : <VolumeIcon />}</button>
            <button className="icon-button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "退出全屏" : "进入全屏"}>{fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}</button>
            <button className="icon-button" onClick={onClose} aria-label="关闭游戏"><CloseIcon /></button>
          </div>
        </header>
        <div className={`game-stage game-stage--${game.id}`}>
          <GameViewport gameId={game.id}>
            {game.id === "worm-front" && <WormFront bestScore={bestScore} onScore={onScore} />}
            {game.id === "prism-dash" && <PrismDash bestScore={bestScore} onScore={onScore} />}
            {game.id === "rune-peg" && <RunePeg bestScore={bestScore} onScore={onScore} />}
            {game.id === "fate-chamber" && <FateChamber bestScore={bestScore} onScore={onScore} />}
            {game.id === "planet-merge" && <PlanetMerge bestScore={bestScore} onScore={onScore} />}
            {game.id === "orbit-dash" && <OrbitDash bestScore={bestScore} onScore={onScore} />}
            {game.id === "stack-up" && <StackUp bestScore={bestScore} onScore={onScore} />}
            {game.id === "memory-pairs" && <MemoryPairs bestScore={bestScore} onScore={onScore} />}
            {game.id === "beat-rush" && <BeatRush bestScore={bestScore} onScore={onScore} />}
            {game.id === "thunder-wing" && <ThunderWing bestScore={bestScore} onScore={onScore} />}
            {game.id === "iron-front" && <IronFront bestScore={bestScore} onScore={onScore} />}
            {game.id === "nightfall-survivors" && <NightfallSurvivors bestScore={bestScore} onScore={onScore} />}
            {game.id === "hamster-roll" && <HamsterRoll bestScore={bestScore} onScore={onScore} />}
            {game.id === "gold-miner" && <GoldMiner bestScore={bestScore} onScore={onScore} />}
            {game.id === "oil-tycoon" && <OilTycoon bestScore={bestScore} onScore={onScore} />}
            {game.id === "minesweeper" && <Minesweeper bestScore={bestScore} onScore={onScore} />}
            {game.id === "go" && <GoGame bestScore={bestScore} onScore={onScore} />}
            {game.id === "guiyang-mahjong" && <GuiyangMahjong bestScore={bestScore} onScore={onScore} />}
            {game.id === "zuma" && <ZumaGame bestScore={bestScore} onScore={onScore} />}
            {game.id === "perfect-parking" && <PerfectParking bestScore={bestScore} onScore={onScore} />}
            {game.id === "moon-swing" && <MoonSwing bestScore={bestScore} onScore={onScore} />}
          </GameViewport>
        </div>
        <footer className="game-modal__footer">
          <span className="key-hint">操作方式</span>
          <span>{game.controls}</span>
          <span className="esc-hint">ESC 退出</span>
        </footer>
      </div>
    </div>
  );
}
