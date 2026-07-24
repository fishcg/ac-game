import { gameAudio } from "@/lib/audio/gameAudio";

type Graph = {
  context: AudioContext;
  dry: GainNode;
  reverb: ConvolverNode;
  compressor: DynamicsCompressorNode;
  noise: AudioBuffer;
};

type Tone = {
  frequency: number;
  duration: number;
  volume: number;
  offset?: number;
  slideTo?: number;
  type?: OscillatorType;
  pan?: number;
  wet?: number;
};

class PlanetMergeAudio {
  private graph: Graph | null = null;

  start() {
    this.tone({ frequency: 392, duration: 0.16, volume: 0.09, type: "triangle", wet: 0.34 });
    this.tone({ frequency: 523.25, duration: 0.2, volume: 0.085, offset: 0.07, type: "sine", wet: 0.38 });
    this.tone({ frequency: 783.99, duration: 0.28, volume: 0.075, offset: 0.14, type: "sine", wet: 0.45 });
  }

  drop(tier: number, comet: boolean) {
    const pan = Math.sin(tier * 1.7) * 0.18;
    if (comet) {
      this.noise(0.14, 0.065, 1800, "highpass", pan, 0.4);
      this.tone({ frequency: 720, slideTo: 190, duration: 0.24, volume: 0.09, type: "triangle", pan, wet: 0.3 });
      return;
    }
    const body = Math.max(82, 158 - tier * 5.5);
    this.tone({ frequency: body, slideTo: body * 0.72, duration: 0.12, volume: 0.075, type: "sine", pan, wet: 0.08 });
    this.tone({ frequency: 660 + tier * 23, duration: 0.055, volume: 0.032, offset: 0.01, type: "triangle", pan, wet: 0.25 });
  }

  impact(intensity: number, tier: number, pan: number) {
    const force = Math.max(0.12, Math.min(1, intensity));
    const body = Math.max(56, 132 - tier * 5);
    this.tone({
      frequency: body * (1 + force * 0.18),
      slideTo: body * 0.68,
      duration: 0.08 + force * 0.09,
      volume: 0.025 + force * 0.075,
      type: "sine",
      pan,
      wet: 0.08,
    });
    this.tone({
      frequency: 820 + tier * 62,
      slideTo: 620 + tier * 40,
      duration: 0.035 + force * 0.025,
      volume: 0.012 + force * 0.026,
      type: "triangle",
      pan,
      wet: 0.22,
    });
    if (force > 0.48) this.noise(0.045 + force * 0.035, 0.012 + force * 0.022, 1100 + tier * 70, "bandpass", pan, 0.18);
  }

  merge(tier: number, combo: number, pan: number) {
    const root = 440 * Math.pow(2, tier / 20);
    const lift = Math.min(0.08, combo * 0.006);
    this.tone({ frequency: root, duration: 0.21, volume: 0.075 + lift, type: "sine", pan, wet: 0.42 });
    this.tone({ frequency: root * 1.25, duration: 0.24, volume: 0.06 + lift, offset: 0.045, type: "triangle", pan: pan * 0.5, wet: 0.48 });
    this.tone({ frequency: root * 2, duration: 0.34, volume: 0.045 + lift, offset: 0.09, type: "sine", pan: -pan * 0.5, wet: 0.56 });
    this.noise(0.15, 0.018 + tier * 0.0015, 3500, "highpass", pan, 0.62);
    if (tier >= 7) {
      this.tone({ frequency: root * 3, duration: 0.42, volume: 0.035, offset: 0.13, type: "sine", pan: -pan, wet: 0.7 });
    }
  }

  cometImpact(pan: number) {
    this.noise(0.18, 0.075, 520, "bandpass", pan, 0.32);
    this.tone({ frequency: 260, slideTo: 58, duration: 0.28, volume: 0.11, type: "sawtooth", pan, wet: 0.18 });
    this.tone({ frequency: 980, slideTo: 1520, duration: 0.15, volume: 0.035, type: "triangle", pan: -pan, wet: 0.5 });
  }

  finish(won: boolean) {
    if (!won) {
      this.tone({ frequency: 174.61, slideTo: 82.41, duration: 0.42, volume: 0.09, type: "triangle", wet: 0.28 });
      this.noise(0.2, 0.025, 320, "lowpass", 0, 0.15);
      return;
    }
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      this.tone({
        frequency,
        duration: index === 3 ? 0.58 : 0.22,
        volume: index === 3 ? 0.09 : 0.07,
        offset: index * 0.09,
        type: index % 2 ? "triangle" : "sine",
        pan: (index - 1.5) * 0.12,
        wet: 0.58,
      });
    });
  }

  private ensure() {
    if (typeof window === "undefined" || gameAudio.isMuted()) return null;
    if (this.graph) {
      if (this.graph.context.state === "suspended") void this.graph.context.resume();
      return this.graph;
    }
    const AudioContextClass = window.AudioContext
      ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new AudioContextClass({ latencyHint: "interactive" });
    const dry = context.createGain();
    const compressor = context.createDynamicsCompressor();
    const reverb = context.createConvolver();
    const wet = context.createGain();
    dry.gain.value = 0.66;
    wet.gain.value = 0.22;
    compressor.threshold.value = -18;
    compressor.knee.value = 16;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.18;
    reverb.buffer = this.createImpulse(context, 0.42, 3.2);
    dry.connect(compressor);
    reverb.connect(wet);
    wet.connect(compressor);
    compressor.connect(context.destination);
    const noise = context.createBuffer(1, Math.floor(context.sampleRate * 0.32), context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    this.graph = { context, dry, reverb, compressor, noise };
    return this.graph;
  }

  private createImpulse(context: AudioContext, seconds: number, decay: number) {
    const length = Math.floor(context.sampleRate * seconds);
    const impulse = context.createBuffer(2, length, context.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    return impulse;
  }

  private route(output: AudioNode, pan: number, wetLevel: number) {
    const graph = this.graph!;
    const panner = graph.context.createStereoPanner();
    const send = graph.context.createGain();
    panner.pan.value = Math.max(-0.72, Math.min(0.72, pan));
    send.gain.value = wetLevel;
    output.connect(panner);
    panner.connect(graph.dry);
    panner.connect(send);
    send.connect(graph.reverb);
    return { panner, send };
  }

  private tone(options: Tone) {
    const graph = this.ensure();
    if (!graph) return;
    const start = graph.context.currentTime + (options.offset ?? 0);
    const oscillator = graph.context.createOscillator();
    const envelope = graph.context.createGain();
    oscillator.type = options.type ?? "sine";
    oscillator.frequency.setValueAtTime(options.frequency, start);
    if (options.slideTo) oscillator.frequency.exponentialRampToValueAtTime(options.slideTo, start + options.duration);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(options.volume, start + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);
    oscillator.connect(envelope);
    const { panner, send } = this.route(envelope, options.pan ?? 0, options.wet ?? 0.2);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
      panner.disconnect();
      send.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + options.duration + 0.025);
  }

  private noise(
    duration: number,
    volume: number,
    frequency: number,
    filterType: BiquadFilterType,
    pan: number,
    wet: number,
  ) {
    const graph = this.ensure();
    if (!graph) return;
    const now = graph.context.currentTime;
    const source = graph.context.createBufferSource();
    const filter = graph.context.createBiquadFilter();
    const envelope = graph.context.createGain();
    source.buffer = graph.noise;
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = filterType === "bandpass" ? 1.8 : 0.72;
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(volume, now + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(envelope);
    const { panner, send } = this.route(envelope, pan, wet);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
      panner.disconnect();
      send.disconnect();
    };
    source.start(now, Math.random() * 0.08, duration + 0.01);
  }
}

export const planetMergeAudio = new PlanetMergeAudio();
