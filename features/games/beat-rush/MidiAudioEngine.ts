import type { MidiEvent, SongDefinition } from "./song";
import { gameAudio } from "@/lib/audio/gameAudio";

const LOOK_AHEAD_SECONDS = 0.25;
const SCHEDULER_INTERVAL_MS = 50;

function midiToFrequency(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class MidiAudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private waveform = new Uint8Array(128);
  private spectrum = new Uint8Array(128);
  private songStartedAt = 0;
  private nextEventIndex = 0;
  private scheduler: number | null = null;
  private sources = new Set<AudioScheduledSourceNode>();
  private unsubscribeFromSettings: (() => void) | null = null;

  constructor(private readonly song: SongDefinition) {}

  async start(leadInSeconds = 1.8) {
    this.stop();
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.context = new AudioContextClass({ latencyHint: "interactive" });
    await this.context.resume();

    const compressor = this.context.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 14;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.18;

    this.master = this.context.createGain();
    this.master.gain.value = gameAudio.isMuted() ? 0 : 0.56;
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.82;

    const delay = this.context.createDelay(0.8);
    const feedback = this.context.createGain();
    const wet = this.context.createGain();
    delay.delayTime.value = Math.min(0.36, this.song.beatSeconds * 0.5);
    feedback.gain.value = 0.2;
    wet.gain.value = 0.16;
    this.master.connect(this.analyser);
    this.master.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(this.analyser);
    this.analyser.connect(compressor);
    compressor.connect(this.context.destination);
    this.unsubscribeFromSettings = gameAudio.subscribe((muted) => {
      if (this.context && this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.56, this.context.currentTime, 0.012);
    });

    this.nextEventIndex = 0;
    this.songStartedAt = this.context.currentTime + leadInSeconds;
    this.scheduleUpcoming();
    this.scheduler = window.setInterval(() => this.scheduleUpcoming(), SCHEDULER_INTERVAL_MS);
  }

  getSongTime() {
    if (!this.context) return -Infinity;
    return this.context.currentTime - this.songStartedAt;
  }

  getProgress() {
    return Math.max(0, Math.min(1, this.getSongTime() / (this.song.totalBeats * this.song.beatSeconds)));
  }

  getVisualization() {
    if (!this.analyser) return { waveform: this.waveform, bass: 0, mid: 0, treble: 0, energy: 0 };
    this.analyser.getByteTimeDomainData(this.waveform);
    this.analyser.getByteFrequencyData(this.spectrum);
    const average = (start: number, end: number) => {
      let total = 0;
      for (let index = start; index < end; index += 1) total += this.spectrum[index];
      return total / Math.max(1, end - start) / 255;
    };
    const bass = average(1, 7);
    const mid = average(7, 28);
    const treble = average(28, 78);
    return { waveform: this.waveform, bass, mid, treble, energy: bass * 0.5 + mid * 0.32 + treble * 0.18 };
  }

  stop() {
    if (this.scheduler !== null) window.clearInterval(this.scheduler);
    this.scheduler = null;
    this.unsubscribeFromSettings?.();
    this.unsubscribeFromSettings = null;
    this.sources.forEach((source) => {
      try { source.stop(); } catch { /* Source may already be stopped. */ }
    });
    this.sources.clear();
    if (this.context) void this.context.close();
    this.context = null;
    this.master = null;
    this.analyser = null;
  }

  private scheduleUpcoming() {
    if (!this.context || !this.master) return;
    const maxScheduleTime = this.context.currentTime + LOOK_AHEAD_SECONDS;

    while (this.nextEventIndex < this.song.midiEvents.length) {
      const event = this.song.midiEvents[this.nextEventIndex];
      const eventTime = this.songStartedAt + event.beat * this.song.beatSeconds;
      if (eventTime > maxScheduleTime) break;
      if (eventTime >= this.context.currentTime - 0.03) this.scheduleEvent(event, eventTime);
      this.nextEventIndex += 1;
    }
  }

  private scheduleEvent(event: MidiEvent, startTime: number) {
    if (!this.context || !this.master) return;
    if (event.voice === "kick") return this.scheduleKick(startTime, event.velocity);
    if (event.voice === "snare" || event.voice === "hat") return this.scheduleNoise(startTime, event.voice, event.velocity);

    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    const panner = this.context.createStereoPanner();
    const duration = event.duration * this.song.beatSeconds;
    const releaseAt = startTime + Math.max(0.04, duration * 0.7);
    const endAt = startTime + duration;

    oscillator.type = event.voice === "bass" ? "triangle" : event.voice === "chord" ? "sine" : event.voice === "pluck" ? "triangle" : "sawtooth";
    oscillator.frequency.setValueAtTime(midiToFrequency(event.midi), startTime);
    filter.type = "lowpass";
    const cutoff = event.voice === "bass" ? 520 : event.voice === "chord" ? 1800 : event.voice === "pluck" ? 4200 : 3200;
    filter.frequency.setValueAtTime(cutoff, startTime);
    if (event.voice === "pluck") filter.frequency.exponentialRampToValueAtTime(1100, Math.min(endAt, startTime + 0.22));
    filter.Q.value = event.voice === "pluck" ? 4.5 : 1.1;
    panner.pan.value = event.voice === "chord" ? ((event.midi % 12) - 5.5) / 12 : event.voice === "lead" ? ((event.midi % 7) - 3) / 8 : 0;
    envelope.gain.setValueAtTime(0.0001, startTime);
    const peak = event.voice === "lead" ? event.velocity * 0.72 : event.voice === "pluck" ? event.velocity * 0.68 : event.velocity;
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), startTime + (event.voice === "chord" ? 0.12 : 0.012));
    envelope.gain.exponentialRampToValueAtTime(0.0001, Math.max(startTime + 0.02, releaseAt));

    oscillator.connect(filter);
    filter.connect(envelope);
    envelope.connect(panner);
    panner.connect(this.master);
    oscillator.start(startTime);
    oscillator.stop(endAt + 0.02);
    this.trackSource(oscillator);

    if (event.voice === "lead") {
      const layer = this.context.createOscillator();
      const layerGain = this.context.createGain();
      layer.type = "triangle";
      layer.frequency.setValueAtTime(midiToFrequency(event.midi), startTime);
      layer.detune.value = 7;
      layerGain.gain.value = 0.28;
      layer.connect(layerGain);
      layerGain.connect(filter);
      layer.start(startTime);
      layer.stop(endAt + 0.02);
      this.trackSource(layer);
    }
  }

  private scheduleKick(startTime: number, velocity: number) {
    if (!this.context || !this.master) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(145, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(46, startTime + 0.16);
    envelope.gain.setValueAtTime(Math.max(0.001, velocity), startTime);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.2);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.22);
    this.trackSource(oscillator);
  }

  private scheduleNoise(startTime: number, voice: "snare" | "hat", velocity: number) {
    if (!this.context || !this.master) return;
    const length = Math.floor(this.context.sampleRate * (voice === "hat" ? 0.045 : 0.12));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    source.buffer = buffer;
    filter.type = "highpass";
    filter.frequency.value = voice === "hat" ? 6800 : 1600;
    envelope.gain.setValueAtTime(Math.max(0.001, velocity), startTime);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startTime + (voice === "hat" ? 0.04 : 0.11));
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.master);
    source.start(startTime);
    source.stop(startTime + (voice === "hat" ? 0.05 : 0.13));
    this.trackSource(source);
  }

  private trackSource(source: AudioScheduledSourceNode) {
    this.sources.add(source);
    source.addEventListener("ended", () => this.sources.delete(source), { once: true });
  }
}
