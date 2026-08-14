import { gameAudio } from "@/lib/audio/gameAudio";

type Cue = "arrow" | "spear" | "stone" | "build" | "upgrade" | "fire" | "hero" | "boss" | "leak";

class DefenseAudio {
  private context: AudioContext | null = null;
  private bgmTimer = 0;
  private beat = 0;

  start() {
    if (gameAudio.isMuted() || this.bgmTimer) return;
    this.ensure();
    this.beat = 0;
    this.bgmTimer = window.setInterval(() => this.bgmBeat(), 430);
    gameAudio.play("start");
  }

  stop() {
    if (this.bgmTimer) window.clearInterval(this.bgmTimer);
    this.bgmTimer = 0;
  }

  pause() {
    if (this.bgmTimer) window.clearInterval(this.bgmTimer);
    this.bgmTimer = 0;
  }

  resume() {
    if (gameAudio.isMuted() || this.bgmTimer) return;
    this.ensure();
    this.bgmTimer = window.setInterval(() => this.bgmBeat(), 430);
  }

  play(cue: Cue) {
    if (gameAudio.isMuted()) return;
    const context = this.ensure(); if (!context) return;
    const presets: Record<Cue, Array<[number, number, OscillatorType, number]>> = {
      arrow: [[740, .045, "triangle", .035]],
      spear: [[210, .07, "square", .05]],
      stone: [[94, .18, "sine", .12]],
      build: [[330, .07, "square", .05], [494, .09, "triangle", .04]],
      upgrade: [[392, .08, "triangle", .07], [587, .1, "triangle", .06], [784, .13, "triangle", .05]],
      fire: [[120, .25, "sawtooth", .09], [240, .18, "triangle", .06]],
      hero: [[196, .12, "square", .08], [392, .18, "sawtooth", .07]],
      boss: [[82, .35, "sawtooth", .11], [110, .35, "square", .08]],
      leak: [[160, .18, "sawtooth", .08]],
    };
    presets[cue].forEach(([frequency, duration, type, volume], index) => this.tone(frequency, duration, type, volume, index * .045));
  }

  private ensure() {
    if (typeof window === "undefined") return null;
    if (!this.context) {
      const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.context = new AudioContextClass({ latencyHint: "interactive" });
    }
    if (this.context.state === "suspended") void this.context.resume();
    return this.context;
  }

  private tone(frequency: number, duration: number, type: OscillatorType, volume: number, offset = 0) {
    const context = this.context; if (!context) return;
    const oscillator = context.createOscillator(); const gain = context.createGain(); const start = context.currentTime + offset;
    oscillator.type = type; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(volume, start + .008); gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(start); oscillator.stop(start + duration + .02);
  }

  private bgmBeat() {
    if (gameAudio.isMuted()) return;
    const scale = [196, 220, 262, 294, 330, 294, 262, 220];
    const frequency = scale[this.beat % scale.length];
    this.tone(frequency, .12, "square", .018);
    if (this.beat % 4 === 0) this.tone(82, .12, "triangle", .028);
    if (this.beat % 8 === 6) this.tone(frequency * 2, .16, "triangle", .015, .11);
    this.beat += 1;
  }
}

export const defenseAudio = new DefenseAudio();
