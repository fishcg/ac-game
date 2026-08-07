import { gameAudio } from "@/lib/audio/gameAudio";

type AudioContextWithWebkit = typeof AudioContext & { webkitAudioContext?: typeof AudioContext };

const SAMPLE_URL = "/assets/bamboo-cicada/cicada-call.m4a";
const RECORDED_RPS = 2.33;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

export class BambooCicadaAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private sample: AudioBufferSourceNode | null = null;
  private carrier: OscillatorNode | null = null;
  private overtone: OscillatorNode | null = null;
  private noise: AudioBufferSourceNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private noiseGain: GainNode | null = null;
  private currentRps = 0;
  private currentVoice = 0;
  private disposed = false;
  private muted = gameAudio.isMuted();
  private unsubscribe = gameAudio.subscribe((muted) => {
    this.muted = muted;
    this.applyGain();
  });

  unlock() {
    const context = this.ensureContext();
    if (context?.state === "suspended") void context.resume();
  }

  setVoice(rps: number, voice: number) {
    this.currentRps = rps;
    this.currentVoice = voice;
    if (voice > 0.02) this.unlock();
    const context = this.context;
    if (!context) return;
    const now = context.currentTime;
    this.applyGain();

    if (this.sample) {
      const rate = clamp(Math.pow(Math.max(0.01, rps) / RECORDED_RPS, 0.7), 0.6, 1.5);
      this.sample.playbackRate.setTargetAtTime(voice > 0.02 ? rate : 0.9, now, 0.09);
      this.sample.detune.setTargetAtTime(Math.sin(now * (5.4 + rps)) * 42 * voice, now, 0.04);
      return;
    }

    this.carrier?.frequency.setTargetAtTime(58 + rps * 19, now, 0.04);
    this.overtone?.frequency.setTargetAtTime(118 + rps * 42, now, 0.055);
    this.filter?.frequency.setTargetAtTime(820 + voice * 1450 + Math.sin(now * 17) * 170 * voice, now, 0.035);
    this.noiseGain?.gain.setTargetAtTime(0.012 + voice * 0.08, now, 0.07);
  }

  silence() {
    this.currentVoice = 0;
    this.applyGain();
  }

  dispose() {
    this.disposed = true;
    this.unsubscribe();
    this.sample?.stop();
    this.carrier?.stop();
    this.overtone?.stop();
    this.noise?.stop();
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.sample = null;
    this.carrier = null;
    this.overtone = null;
    this.noise = null;
    this.filter = null;
    this.noiseGain = null;
  }

  private applyGain() {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;
    const scale = this.sample ? 0.72 : 0.16;
    const level = this.muted ? 0.0001 : Math.max(0.0001, scale * Math.pow(Math.max(0, this.currentVoice), 1.3));
    master.gain.setTargetAtTime(level, context.currentTime, this.currentVoice > 0.05 ? 0.045 : 0.1);
  }

  private ensureContext() {
    if (typeof window === "undefined") return null;
    if (this.context) return this.context;
    const Constructor = (window.AudioContext ?? (window as unknown as AudioContextWithWebkit).webkitAudioContext) as typeof AudioContext | undefined;
    if (!Constructor) return null;
    const context = new Constructor({ latencyHint: "interactive" });
    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    master.gain.value = 0.0001;
    compressor.threshold.value = -18;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.18;
    master.connect(compressor);
    compressor.connect(context.destination);

    this.context = context;
    this.master = master;
    void this.loadRecordedVoice(context, master);
    return context;
  }

  private async loadRecordedVoice(context: AudioContext, master: GainNode) {
    try {
      const response = await fetch(SAMPLE_URL, { cache: "force-cache" });
      if (!response.ok) throw new Error(`竹知了录音加载失败: ${response.status}`);
      const decoded = await context.decodeAudioData(await response.arrayBuffer());
      if (this.disposed || this.context !== context) return;
      this.startRecordedVoice(context, master, decoded);
    } catch {
      if (!this.disposed && this.context === context) this.startSynthVoice(context, master);
    }
  }

  private startRecordedVoice(context: AudioContext, master: GainNode, decoded: AudioBuffer) {
    const fadeFrames = Math.floor(decoded.sampleRate * 0.05);
    const loopFrames = decoded.length - fadeFrames;
    if (loopFrames <= decoded.sampleRate * 0.2) {
      this.startSynthVoice(context, master);
      return;
    }

    const loop = context.createBuffer(1, loopFrames, decoded.sampleRate);
    const sourceData = decoded.getChannelData(0);
    const loopData = loop.getChannelData(0);
    loopData.set(sourceData.subarray(0, loopFrames));
    for (let index = 0; index < fadeFrames; index += 1) {
      const phase = Math.PI / 2 * index / fadeFrames;
      loopData[index] = sourceData[index] * Math.sin(phase) + sourceData[loopFrames + index] * Math.cos(phase);
    }

    const sample = context.createBufferSource();
    sample.buffer = loop;
    sample.loop = true;
    sample.connect(master);
    sample.start();
    this.sample = sample;
    this.applyGain();
  }

  private startSynthVoice(context: AudioContext, master: GainNode) {
    if (this.sample || this.carrier) return;
    const filter = context.createBiquadFilter();
    const carrier = context.createOscillator();
    const carrierGain = context.createGain();
    const overtone = context.createOscillator();
    const overtoneGain = context.createGain();
    const noise = context.createBufferSource();
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();

    filter.type = "bandpass";
    filter.frequency.value = 900;
    filter.Q.value = 7.5;
    carrier.type = "sawtooth";
    carrier.frequency.value = 70;
    carrierGain.gain.value = 0.72;
    overtone.type = "square";
    overtone.frequency.value = 145;
    overtoneGain.gain.value = 0.16;

    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
    noise.buffer = buffer;
    noise.loop = true;
    noiseFilter.type = "highpass";
    noiseFilter.frequency.value = 1800;
    noiseGain.gain.value = 0.02;

    carrier.connect(carrierGain);
    overtone.connect(overtoneGain);
    carrierGain.connect(filter);
    overtoneGain.connect(filter);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    filter.connect(master);
    noiseGain.connect(master);
    carrier.start();
    overtone.start();
    noise.start();

    this.carrier = carrier;
    this.overtone = overtone;
    this.noise = noise;
    this.filter = filter;
    this.noiseGain = noiseGain;
    this.applyGain();
  }
}
