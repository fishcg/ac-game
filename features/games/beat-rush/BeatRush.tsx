"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MiniGameProps } from "../types";
import { MidiAudioEngine } from "./MidiAudioEngine";
import { SONGS, type ChartNote, type SongDefinition } from "./song";
import styles from "./BeatRush.module.css";
import { gameAudio } from "@/lib/audio/gameAudio";

const LANE_KEYS = ["D", "F", "J", "K"] as const;
const LANE_COLORS = ["#5ce1e6", "#8a7dff", "#ff67b1", "#ffc857"] as const;
const TRAVEL_BEATS = 4;
const PERFECT_WINDOW = 0.07;
const GREAT_WINDOW = 0.14;
const GOOD_WINDOW = 0.22;

type NoteStatus = "pending" | "hit" | "miss";
type RuntimeNote = ChartNote & { status: NoteStatus };
type GameStatus = "ready" | "playing" | "result";
type Stats = { score: number; combo: number; maxCombo: number; perfect: number; great: number; good: number; miss: number };

const INITIAL_STATS: Stats = { score: 0, combo: 0, maxCombo: 0, perfect: 0, great: 0, good: 0, miss: 0 };

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function accuracyOf(stats: Stats) {
  const total = stats.perfect + stats.great + stats.good + stats.miss;
  if (!total) return 100;
  return ((stats.perfect + stats.great * 0.7 + stats.good * 0.4) / total) * 100;
}

export function BeatRush({ bestScore, onScore }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<MidiAudioEngine | null>(null);
  const activeSongRef = useRef<SongDefinition>(SONGS[0]);
  const animationRef = useRef<number | null>(null);
  const statusRef = useRef<GameStatus>("ready");
  const notesRef = useRef<RuntimeNote[]>([]);
  const statsRef = useRef<Stats>({ ...INITIAL_STATS });
  const laneFlashRef = useRef([0, 0, 0, 0]);
  const countdownRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const [status, setStatus] = useState<GameStatus>("ready");
  const [stats, setStats] = useState<Stats>({ ...INITIAL_STATS });
  const [judgement, setJudgement] = useState<{ label: string; tone: string; id: number } | null>(null);
  const [selectedSong, setSelectedSong] = useState<SongDefinition>(SONGS[0]);
  const [activeSong, setActiveSong] = useState<SongDefinition>(SONGS[0]);

  const commitStats = useCallback((next: Stats) => {
    statsRef.current = next;
    setStats(next);
  }, []);

  const handleLane = useCallback((lane: number) => {
    if (statusRef.current !== "playing" || !engineRef.current) return;
    const songTime = engineRef.current.getSongTime();
    if (songTime < 0) return;
    laneFlashRef.current[lane] = performance.now() + 110;

    let nearest: RuntimeNote | null = null;
    let nearestDelta = Infinity;
    notesRef.current.forEach((note) => {
      if (note.lane !== lane || note.status !== "pending") return;
      const delta = Math.abs(note.beat * activeSongRef.current.beatSeconds - songTime);
      if (delta < nearestDelta) {
        nearest = note;
        nearestDelta = delta;
      }
    });

    if (!nearest || nearestDelta > GOOD_WINDOW) {
      gameAudio.play("tap");
      return;
    }
    (nearest as RuntimeNote).status = "hit";
    const previous = statsRef.current;
    const combo = previous.combo + 1;
    const comboBonus = Math.min(300, combo * 6);
    let label = "GOOD";
    let tone = "good";
    let points = 400;
    let perfect = previous.perfect;
    let great = previous.great;
    let good = previous.good;

    if (nearestDelta <= PERFECT_WINDOW) {
      label = "PERFECT";
      tone = "perfect";
      points = 1000;
      perfect += 1;
    } else if (nearestDelta <= GREAT_WINDOW) {
      label = "GREAT";
      tone = "great";
      points = 700;
      great += 1;
    } else {
      good += 1;
    }

    commitStats({ ...previous, score: previous.score + points + comboBonus, combo, maxCombo: Math.max(previous.maxCombo, combo), perfect, great, good });
    gameAudio.play(tone as "perfect" | "great" | "good");
    setJudgement({ label, tone, id: Date.now() });
  }, [commitStats]);

  useEffect(() => {
    const keyToLane: Record<string, number> = { d: 0, f: 1, j: 2, k: 3 };
    const handleKey = (event: KeyboardEvent) => {
      const lane = keyToLane[event.key.toLowerCase()];
      if (lane === undefined || event.repeat) return;
      event.preventDefault();
      handleLane(lane);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleLane]);

  useEffect(() => () => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    engineRef.current?.stop();
  }, []);

  const drawFrame = useCallback((songTime: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, bounds.width);
    const height = Math.max(1, bounds.height);
    if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#11122c");
    gradient.addColorStop(0.55, "#171337");
    gradient.addColorStop(1, "#080a18");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    const boardWidth = Math.min(width * 0.76, 620);
    const boardX = (width - boardWidth) / 2;
    const laneWidth = boardWidth / 4;
    const hitY = height - 82;
    const currentBeat = songTime / activeSongRef.current.beatSeconds;
    const visual = engineRef.current?.getVisualization();

    if (visual) {
      const pulse = 0.16 + visual.energy * 0.7;
      const glow = context.createRadialGradient(width / 2, height * 0.36, 8, width / 2, height * 0.36, Math.min(width, height) * 0.52);
      glow.addColorStop(0, `${activeSongRef.current.accent}${Math.round(Math.min(0.42, pulse) * 255).toString(16).padStart(2, "0")}`);
      glow.addColorStop(0.48, `${activeSongRef.current.accent}16`);
      glow.addColorStop(1, "transparent");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      const centerY = Math.min(190, height * 0.28);
      const amplitude = 38 + visual.energy * 92;
      context.save();
      context.globalCompositeOperation = "lighter";
      context.strokeStyle = activeSongRef.current.accent;
      context.lineWidth = 1.8;
      context.shadowColor = activeSongRef.current.accent;
      context.shadowBlur = 13 + visual.mid * 18;
      context.globalAlpha = 0.34 + visual.treble * 0.5;
      context.beginPath();
      visual.waveform.forEach((sample, index) => {
        const x = boardX + (index / (visual.waveform.length - 1)) * boardWidth;
        const sampledWave = ((sample - 128) / 128) * 4.2;
        const melodyWave = Math.sin(index * 0.34 + currentBeat * Math.PI) * visual.mid * 0.62
          + Math.sin(index * 0.71 - currentBeat * Math.PI * 0.5) * visual.treble * 0.28;
        const y = centerY + (sampledWave + melodyWave) * amplitude;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.stroke();

      [visual.bass, visual.mid, visual.treble].forEach((level, index) => {
        context.beginPath();
        context.globalAlpha = 0.08 + level * 0.2;
        context.lineWidth = 1 + level * 2;
        context.arc(width / 2, centerY, 48 + index * 30 + level * 35, 0, Math.PI * 2);
        context.stroke();
      });
      context.restore();
    }

    for (let lane = 0; lane < 4; lane += 1) {
      const laneX = boardX + lane * laneWidth;
      context.fillStyle = lane % 2 ? "#ffffff07" : "#ffffff0b";
      context.fillRect(laneX, 0, laneWidth, hitY + 28);
      context.strokeStyle = "#ffffff18";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(laneX, 0);
      context.lineTo(laneX, hitY + 28);
      context.stroke();

      if (laneFlashRef.current[lane] > performance.now()) {
        const glow = context.createLinearGradient(0, hitY - 130, 0, hitY + 30);
        glow.addColorStop(0, "transparent");
        glow.addColorStop(1, `${LANE_COLORS[lane]}66`);
        context.fillStyle = glow;
        context.fillRect(laneX, hitY - 130, laneWidth, 160);
      }
    }

    for (let beat = Math.floor(currentBeat); beat <= currentBeat + TRAVEL_BEATS; beat += 1) {
      const y = hitY - ((beat - currentBeat) / TRAVEL_BEATS) * (hitY - 24);
      context.strokeStyle = beat % 4 === 0 ? "#ffffff24" : "#ffffff0c";
      context.lineWidth = beat % 4 === 0 ? 1.5 : 1;
      context.beginPath();
      context.moveTo(boardX, y);
      context.lineTo(boardX + boardWidth, y);
      context.stroke();
    }

    notesRef.current.forEach((note) => {
      if (note.status !== "pending") return;
      const beatsAway = note.beat - currentBeat;
      if (beatsAway < -0.6 || beatsAway > TRAVEL_BEATS + 0.4) return;
      const y = hitY - (beatsAway / TRAVEL_BEATS) * (hitY - 24);
      const x = boardX + note.lane * laneWidth + 9;
      const noteWidth = laneWidth - 18;
      context.shadowColor = LANE_COLORS[note.lane];
      context.shadowBlur = Math.max(8, 22 - Math.abs(beatsAway) * 3);
      context.fillStyle = LANE_COLORS[note.lane];
      roundedRect(context, x, y - 10, noteWidth, 20, 7);
      context.fillStyle = "#ffffff9c";
      roundedRect(context, x + 7, y - 6, noteWidth - 14, 4, 2);
      context.shadowBlur = 0;
    });

    context.shadowColor = "#ffffff";
    context.shadowBlur = 12;
    context.fillStyle = "#ffffff";
    roundedRect(context, boardX, hitY, boardWidth, 4, 2);
    context.shadowBlur = 0;
    context.fillStyle = "#ffffff12";
    context.fillRect(boardX, hitY + 4, boardWidth, 28);
  }, []);

  const startGame = async (song: SongDefinition) => {
    gameAudio.play("start");
    engineRef.current?.stop();
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    const engine = new MidiAudioEngine(song);
    engineRef.current = engine;
    activeSongRef.current = song;
    setActiveSong(song);
    notesRef.current = song.chart.map((note) => ({ ...note, status: "pending" }));
    const freshStats = { ...INITIAL_STATS };
    statsRef.current = freshStats;
    setStats(freshStats);
    setJudgement(null);
    statusRef.current = "playing";
    setStatus("playing");
    await engine.start();

    const animate = () => {
      if (statusRef.current !== "playing") return;
      const songTime = engine.getSongTime();
      drawFrame(songTime);

      let missed = 0;
      notesRef.current.forEach((note) => {
        if (note.status === "pending" && songTime - note.beat * song.beatSeconds > GOOD_WINDOW) {
          note.status = "miss";
          missed += 1;
        }
      });
      if (missed) {
        const previous = statsRef.current;
        commitStats({ ...previous, combo: 0, miss: previous.miss + missed });
        gameAudio.play("miss");
        setJudgement({ label: "MISS", tone: "miss", id: Date.now() });
      }

      if (countdownRef.current) {
        if (songTime < 0) countdownRef.current.textContent = String(Math.max(1, Math.ceil(-songTime / 0.6)));
        else if (songTime < 0.35) countdownRef.current.textContent = "GO";
        else countdownRef.current.textContent = "";
      }
      if (progressRef.current) progressRef.current.style.width = `${engine.getProgress() * 100}%`;

      if (songTime >= song.totalBeats * song.beatSeconds + 0.7) {
        statusRef.current = "result";
        setStatus("result");
        engine.stop();
        onScore(statsRef.current.score);
        return;
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  const accuracy = accuracyOf(stats);
  return (
    <div className={styles.game}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="四轨节奏游戏画面" />
      <div className={styles.topHud}>
        <div><small>SCORE</small><strong>{stats.score.toString().padStart(6, "0")}</strong></div>
        <div className={styles.song}><small>{activeSong.artist}</small><strong>{activeSong.title}</strong><span>{activeSong.bpm} BPM · 4/4 · {activeSong.difficulty}</span></div>
        <div className={styles.accuracy}><small>ACCURACY</small><strong>{accuracy.toFixed(1)}%</strong></div>
      </div>
      <div className={styles.progress}><span ref={progressRef} /></div>
      {stats.combo > 1 && <div className={styles.combo}><strong>{stats.combo}</strong><span>COMBO</span></div>}
      <span ref={countdownRef} className={styles.countdown} />
      {judgement && <span key={judgement.id} className={`${styles.judgement} ${styles[judgement.tone]}`}>{judgement.label}</span>}

      <div className={styles.laneControls}>
        {LANE_KEYS.map((key, lane) => <button key={key} style={{ "--lane-color": LANE_COLORS[lane] } as React.CSSProperties} onPointerDown={() => handleLane(lane)} aria-label={`${key} 轨道`}><span>{key}</span></button>)}
      </div>

      {status === "ready" && <div className={styles.overlay}>
        <span className={styles.albumMark} style={{ background: `linear-gradient(145deg,#242158,${selectedSong.accent}99)` }}><i /><i /><i /><i /></span>
        <small>SELECT A TRACK</small><h3>{selectedSong.title}</h3>
        <p>选择适合你的难度，在音符抵达判定线时按下对应按键。</p>
        <div className={styles.songPicker}>{SONGS.map((song) => <button type="button" key={song.id} className={selectedSong.id === song.id ? styles.songSelected : ""} style={{ "--song-accent": song.accent } as React.CSSProperties} onClick={() => setSelectedSong(song)}><span><strong>{song.title}</strong><small>{song.difficulty} · {song.chart.length} 音符</small></span><span><strong>{song.bpm}</strong><small>BPM</small></span></button>)}</div>
        <div className={styles.keyPreview}>{LANE_KEYS.map((key, lane) => <i key={key} style={{ borderColor: LANE_COLORS[lane] }}>{key}</i>)}</div>
        <button onClick={() => startGame(selectedSong)}>开始演奏</button>
      </div>}

      {status === "result" && <div className={styles.overlay}>
        <small>TRACK COMPLETE</small><h3>{accuracy >= 95 ? "节奏大师" : accuracy >= 80 ? "状态不错" : "再听一遍节拍"}</h3>
        <div className={styles.resultScore}>{stats.score}</div>
        <div className={styles.resultGrid}><span><strong>{accuracy.toFixed(1)}%</strong><small>准确率</small></span><span><strong>{stats.maxCombo}</strong><small>最高连击</small></span><span><strong>{stats.perfect}</strong><small>Perfect</small></span><span><strong>{stats.miss}</strong><small>Miss</small></span></div>
        <p>{activeSong.title} · {activeSong.difficulty}　历史最高分 {Math.max(bestScore, stats.score)}</p><button onClick={() => startGame(activeSong)}>再演奏一次</button>
      </div>}
    </div>
  );
}
