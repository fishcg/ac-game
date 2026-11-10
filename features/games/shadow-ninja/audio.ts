import { gameAudio } from "@/lib/audio/gameAudio";
import type { SoundName } from "./types";

type ToneOptions = {
  type?: OscillatorType;
  volume?: number;
  slideTo?: number;
  delay?: number;
};

type NoiseOptions = {
  volume?: number;
  highpass?: number;
  lowpass?: number;
  delay?: number;
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let synced = false;

function syncMute(): void {
  if (synced) return;
  synced = true;
  muted = gameAudio.isMuted();
  gameAudio.subscribe((next) => {
    muted = next;
    if (master && ctx) master.gain.setTargetAtTime(next ? 0 : 0.5, ctx.currentTime, 0.02);
  });
}

function ensure(): AudioContext | null {
  syncMute();
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor({ latencyHint: "interactive" });
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function unlockAudio(): void {
  ensure();
}

function tone(frequency: number, duration: number, options: ToneOptions = {}): void {
  const context = ensure();
  if (!context || !master) return;
  const start = context.currentTime + (options.delay ?? 0);
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = options.type ?? "sine";
  osc.frequency.setValueAtTime(frequency, start);
  if (options.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.slideTo), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(options.volume ?? 0.14, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function noise(duration: number, options: NoiseOptions = {}): void {
  const context = ensure();
  if (!context || !master) return;
  const start = context.currentTime + (options.delay ?? 0);
  const length = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  source.buffer = buffer;
  const hp = context.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = options.highpass ?? 400;
  const lp = context.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = options.lowpass ?? 8000;
  const gain = context.createGain();
  gain.gain.setValueAtTime(options.volume ?? 0.14, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(hp);
  hp.connect(lp);
  lp.connect(gain);
  gain.connect(master);
  source.start(start);
}

export function playSfx(name: SoundName): void {
  if (gameAudio.isMuted()) return;
  switch (name) {
    case "select":
      tone(620, 0.09, { type: "triangle", volume: 0.1 });
      tone(920, 0.12, { type: "triangle", volume: 0.08, delay: 0.06 });
      break;
    case "light":
      noise(0.07, { volume: 0.1, highpass: 1800 });
      tone(210, 0.08, { type: "square", volume: 0.07, slideTo: 120 });
      break;
    case "heavy":
      noise(0.13, { volume: 0.16, highpass: 260, lowpass: 2600 });
      tone(120, 0.2, { type: "sine", volume: 0.2, slideTo: 48 });
      break;
    case "block":
      tone(1450, 0.07, { type: "square", volume: 0.07, slideTo: 900 });
      noise(0.06, { volume: 0.1, highpass: 2400 });
      break;
    case "special":
      noise(0.34, { volume: 0.14, highpass: 500, lowpass: 5200 });
      tone(300, 0.32, { type: "sawtooth", volume: 0.1, slideTo: 900 });
      tone(560, 0.22, { type: "triangle", volume: 0.07, delay: 0.1, slideTo: 300 });
      break;
    case "super":
      noise(0.7, { volume: 0.18, highpass: 300, lowpass: 7000 });
      tone(110, 0.75, { type: "sawtooth", volume: 0.13, slideTo: 70 });
      tone(220, 0.66, { type: "square", volume: 0.08, slideTo: 140 });
      tone(660, 0.4, { type: "triangle", volume: 0.07, delay: 0.12, slideTo: 1320 });
      break;
    case "ko":
      tone(440, 0.6, { type: "sawtooth", volume: 0.14, slideTo: 55 });
      noise(0.5, { volume: 0.12, highpass: 200, lowpass: 1800 });
      break;
    case "jump":
      tone(420, 0.12, { type: "triangle", volume: 0.07, slideTo: 720 });
      break;
    case "land":
      noise(0.08, { volume: 0.08, highpass: 120, lowpass: 900 });
      break;
    case "round":
      tone(540, 0.14, { type: "square", volume: 0.09 });
      tone(810, 0.18, { type: "square", volume: 0.07, delay: 0.12 });
      break;
    case "win":
      [523, 659, 784, 1047].forEach((freq, i) => tone(freq, 0.2, { type: "triangle", volume: 0.1, delay: i * 0.1 }));
      break;
    case "lose":
      [392, 330, 262, 196].forEach((freq, i) => tone(freq, 0.28, { type: "sine", volume: 0.12, delay: i * 0.12 }));
      break;
    default:
      break;
  }
}
