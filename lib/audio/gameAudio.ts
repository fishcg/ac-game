export type GameEffect = "start" | "move" | "score" | "crash" | "drop" | "stack" | "flip" | "match" | "mismatch" | "win" | "tap" | "perfect" | "great" | "good" | "miss";

type ToneOptions = {
  frequency: number;
  duration: number;
  offset?: number;
  volume?: number;
  type?: OscillatorType;
  slideTo?: number;
};

const MUTE_KEY = "ac-game:audio-muted";
const LEGACY_MUTE_KEY = "playnest:audio-muted";

class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private listeners = new Set<(muted: boolean) => void>();

  isMuted() {
    if (typeof window === "undefined") return false;
    let value = window.localStorage.getItem(MUTE_KEY);
    if (value === null) {
      value = window.localStorage.getItem(LEGACY_MUTE_KEY);
      if (value !== null) window.localStorage.setItem(MUTE_KEY, value);
    }
    return value === "true";
  }

  setMuted(muted: boolean) {
    if (typeof window !== "undefined") window.localStorage.setItem(MUTE_KEY, String(muted));
    if (this.context && this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.72, this.context.currentTime, 0.012);
    this.listeners.forEach((listener) => listener(muted));
  }

  subscribe(listener: (muted: boolean) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  play(effect: GameEffect) {
    if (this.isMuted()) return;
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === "suspended") void context.resume();

    switch (effect) {
      case "start":
        this.tones([{ frequency: 392, duration: 0.1 }, { frequency: 523, duration: 0.11, offset: 0.09 }, { frequency: 659, duration: 0.16, offset: 0.18 }]);
        break;
      case "move":
        this.tones([{ frequency: 310, slideTo: 440, duration: 0.07, volume: 0.12, type: "triangle" }]);
        break;
      case "score":
        this.tones([{ frequency: 880, duration: 0.08, volume: 0.12 }, { frequency: 1175, duration: 0.1, offset: 0.05, volume: 0.1 }]);
        break;
      case "crash":
        this.noise(0.22, 0.2, 480);
        this.tones([{ frequency: 210, slideTo: 55, duration: 0.3, volume: 0.25, type: "sawtooth" }]);
        break;
      case "drop":
        this.tones([{ frequency: 150, slideTo: 88, duration: 0.11, volume: 0.2, type: "sine" }]);
        break;
      case "stack":
        this.tones([{ frequency: 520, duration: 0.08, volume: 0.14 }, { frequency: 780, duration: 0.11, offset: 0.045, volume: 0.12 }]);
        break;
      case "flip":
        this.tones([{ frequency: 480, slideTo: 650, duration: 0.08, volume: 0.1, type: "triangle" }]);
        break;
      case "match":
        this.tones([{ frequency: 659, duration: 0.13, volume: 0.16 }, { frequency: 988, duration: 0.17, offset: 0.1, volume: 0.15 }]);
        break;
      case "mismatch":
        this.tones([{ frequency: 260, duration: 0.1, volume: 0.13, type: "triangle" }, { frequency: 196, duration: 0.14, offset: 0.08, volume: 0.12, type: "triangle" }]);
        break;
      case "win":
        this.tones([{ frequency: 523, duration: 0.12 }, { frequency: 659, duration: 0.12, offset: 0.1 }, { frequency: 784, duration: 0.12, offset: 0.2 }, { frequency: 1047, duration: 0.28, offset: 0.3 }]);
        break;
      case "tap":
        this.tones([{ frequency: 360, duration: 0.035, volume: 0.07, type: "square" }]);
        break;
      case "perfect":
        this.tones([{ frequency: 1047, duration: 0.09, volume: 0.11 }, { frequency: 1568, duration: 0.13, offset: 0.035, volume: 0.09 }]);
        break;
      case "great":
        this.tones([{ frequency: 880, duration: 0.1, volume: 0.1, type: "triangle" }]);
        break;
      case "good":
        this.tones([{ frequency: 659, duration: 0.08, volume: 0.08, type: "triangle" }]);
        break;
      case "miss":
        this.tones([{ frequency: 165, slideTo: 120, duration: 0.1, volume: 0.08, type: "triangle" }]);
        break;
    }
  }

  private ensureContext() {
    if (typeof window === "undefined") return null;
    if (!this.context) {
      const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.context = new AudioContextClass({ latencyHint: "interactive" });
      this.master = this.context.createGain();
      this.master.gain.value = this.isMuted() ? 0 : 0.72;
      this.master.connect(this.context.destination);
    }
    return this.context;
  }

  private tones(options: ToneOptions[]) {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;
    const now = context.currentTime;
    options.forEach((option) => {
      const start = now + (option.offset ?? 0);
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = option.type ?? "sine";
      oscillator.frequency.setValueAtTime(option.frequency, start);
      if (option.slideTo) oscillator.frequency.exponentialRampToValueAtTime(option.slideTo, start + option.duration);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(option.volume ?? 0.16, start + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + option.duration);
      oscillator.connect(envelope);
      envelope.connect(master);
      oscillator.start(start);
      oscillator.stop(start + option.duration + 0.02);
    });
  }

  private noise(duration: number, volume: number, highpass: number) {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;
    const length = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = buffer;
    filter.type = "highpass";
    filter.frequency.value = highpass;
    envelope.gain.setValueAtTime(volume, context.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(master);
    source.start();
  }
}

export const gameAudio = new GameAudio();
