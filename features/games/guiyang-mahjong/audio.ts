import { gameAudio } from "@/lib/audio/gameAudio";
import type { MahjongSound } from "./types";

const midiToFrequency = (note: number) => 440 * 2 ** ((note - 69) / 12);

class GuiyangMahjongAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private running = false;
  private timer: number | null = null;
  private nextStepTime = 0;
  private step = 0;

  constructor() {
    gameAudio.subscribe((muted) => {
      if (!this.context || !this.master) return;
      this.master.gain.setTargetAtTime(muted ? 0 : 0.72, this.context.currentTime, 0.015);
    });
  }

  startBgm() {
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === "suspended") void context.resume();
    if (this.running) return;
    this.running = true;
    this.step = 0;
    this.nextStepTime = context.currentTime + 0.08;
    this.tick();
  }

  stopBgm() {
    this.running = false;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }

  setPaused(paused: boolean) {
    if (!this.context || !this.music) return;
    this.music.gain.setTargetAtTime(paused ? 0.0001 : 0.2, this.context.currentTime, 0.045);
  }

  play(sound: MahjongSound) {
    if (gameAudio.isMuted()) return;
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === "suspended") void context.resume();
    const now = context.currentTime;
    if (sound === "draw") this.wood(now, 460, 0.045, 0.085);
    if (sound === "discard") {
      this.wood(now, 235, 0.075, 0.16);
      this.noise(now, 0.035, 0.035, 1100);
    }
    if (sound === "pong") this.chord(now, [64, 69], 0.22, 0.13);
    if (sound === "kong") {
      this.chord(now, [57, 64, 69], 0.34, 0.15);
      this.gong(now, 116, 0.55, 0.14);
    }
    if (sound === "hu") {
      [69, 72, 76, 81].forEach((note, index) => this.pluck(note, now + index * 0.09, 0.26, 0.14, "fx"));
      this.gong(now + 0.18, 150, 0.8, 0.18);
    }
    if (sound === "chicken") {
      [76, 79, 83].forEach((note, index) => this.pluck(note, now + index * 0.07, 0.2, 0.12, "fx"));
    }
    if (sound === "pass") this.wood(now, 180, 0.05, 0.07);
    if (sound === "lose") this.chord(now, [52, 49, 45], 0.45, 0.09);
    if (sound === "start") this.chord(now, [60, 64, 67, 72], 0.48, 0.11);
  }

  private tick = () => {
    const context = this.context;
    if (!this.running || !context) return;
    const secondsPerStep = 60 / 136 / 2;
    while (this.nextStepTime < context.currentTime + 0.72) {
      this.scheduleMusicStep(this.step, this.nextStepTime);
      this.step = (this.step + 1) % 64;
      this.nextStepTime += secondsPerStep;
    }
    this.timer = window.setTimeout(this.tick, 180);
  };

  private scheduleMusicStep(step: number, time: number) {
    const melody = [
      72, null, 76, 79, 81, 79, 76, null, 74, 76, 79, 76, 74, 72, 69, null,
      72, 74, 76, 79, 76, 74, 72, 69, 67, 69, 72, 74, 72, 69, 67, null,
      69, 72, 74, 76, 79, 76, 74, 72, 69, null, 67, 69, 72, 69, 67, null,
      64, 67, 69, 72, 74, 72, 69, 67, 64, 67, 69, 72, 69, 67, 64, null,
    ] as const;
    const bass = [48, 48, 45, 45, 43, 43, 45, 47] as const;
    const note = melody[step];
    if (note !== null) this.pluck(note, time, step % 8 === 0 ? 0.28 : 0.18, 0.042, "music");
    if (step % 8 === 0) this.bass(bass[Math.floor(step / 8)], time, 0.72, 0.055);
    if (step % 4 === 0) this.wood(time, step % 8 === 0 ? 145 : 205, 0.035, 0.025, true);
    if (step % 8 === 4) this.noise(time, 0.045, 0.013, 1700, true);
    if (step % 16 === 14) this.pluck(note ?? 72, time + 0.06, 0.12, 0.024, "music");
  }

  private pluck(note: number, start: number, duration: number, volume: number, bus: "music" | "fx") {
    const context = this.context;
    const target = bus === "music" ? this.music : this.master;
    if (!context || !target) return;
    const oscillator = context.createOscillator();
    const overtone = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = "triangle";
    overtone.type = "sine";
    oscillator.frequency.value = midiToFrequency(note);
    overtone.frequency.value = midiToFrequency(note + 12);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(3400, start);
    filter.frequency.exponentialRampToValueAtTime(780, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(filter);
    overtone.connect(filter);
    filter.connect(gain);
    gain.connect(target);
    oscillator.start(start);
    overtone.start(start);
    oscillator.stop(start + duration + 0.03);
    overtone.stop(start + duration + 0.03);
  }

  private bass(note: number, start: number, duration: number, volume: number) {
    const context = this.context;
    if (!context || !this.music) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = midiToFrequency(note);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.music);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  private wood(start: number, frequency: number, duration: number, volume: number, music = false) {
    const context = this.context;
    const target = music ? this.music : this.master;
    if (!context || !target) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(70, frequency * 0.58), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(target);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private chord(start: number, notes: number[], duration: number, volume: number) {
    notes.forEach((note, index) => this.pluck(note, start + index * 0.04, duration, volume / Math.max(1, notes.length * 0.55), "fx"));
  }

  private gong(start: number, frequency: number, duration: number, volume: number) {
    const context = this.context;
    if (!context || !this.master) return;
    [1, 1.49, 2.05].forEach((multiple, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency * multiple;
      gain.gain.setValueAtTime(volume / (index + 1), start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(this.master as GainNode);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.03);
    });
  }

  private noise(start: number, duration: number, volume: number, highpass: number, music = false) {
    const context = this.context;
    const target = music ? this.music : this.master;
    if (!context || !target) return;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = "highpass";
    filter.frequency.value = highpass;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(target);
    source.start(start);
  }

  private ensureContext() {
    if (typeof window === "undefined") return null;
    if (!this.context) {
      const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.context = new AudioContextClass({ latencyHint: "interactive" });
      this.master = this.context.createGain();
      this.music = this.context.createGain();
      this.master.gain.value = gameAudio.isMuted() ? 0 : 0.72;
      this.music.gain.value = 0.2;
      this.music.connect(this.master);
      this.master.connect(this.context.destination);
    }
    return this.context;
  }
}

export const guiyangMahjongAudio = new GuiyangMahjongAudio();
