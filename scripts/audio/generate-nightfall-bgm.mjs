import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const SAMPLE_RATE = 44_100;
const OUTPUT_DIR = resolve("public/assets/nightfall-survivors/audio");

const tracks = [
  {
    file: "nightfall-adventure.ogg", bpm: 150, leadRoot: 72,
    chords: [0, 5, 9, 7, 0, 9, 5, 7], modes: [0, 0, 1, 0, 0, 1, 0, 0],
    melody: [0, 4, 7, 12, 7, 4, 2, 4, 5, 9, 12, 9, 7, 5, 4, 2, 0, 4, 7, 11, 12, 11, 7, 4, 9, 7, 5, 4, 2, 4, 5, 7, 12, 11, 9, 7, 5, 4, 2, 0, 4, 5, 7, 9, 7, 5, 4, 2, 0, 2, 4, 7, 9, 12, 11, 7, 9, 7, 5, 4, 2, 0, 0, null],
  },
  {
    file: "nightfall-mystic.ogg", bpm: 156, leadRoot: 74,
    chords: [0, 3, 8, 10, 0, 8, 3, 10], modes: [1, 0, 0, 0, 1, 0, 0, 0],
    melody: [0, 3, 7, 10, 12, 10, 7, 3, 5, 8, 12, 15, 12, 8, 7, 5, 0, 7, 10, 12, 15, 12, 10, 7, 8, 7, 5, 3, 2, 3, 5, 7, 12, 10, 8, 7, 5, 3, 2, 0, 3, 5, 7, 10, 8, 7, 5, 3, 0, 3, 7, 8, 10, 12, 15, 12, 10, 8, 7, 5, 3, 2, 0, null],
  },
  {
    file: "nightfall-crown.ogg", bpm: 162, leadRoot: 76,
    chords: [0, 7, 8, 5, 0, 8, 10, 7], modes: [1, 0, 0, 1, 1, 0, 0, 0],
    melody: [0, 7, 12, 11, 7, 4, 7, 11, 12, 16, 14, 12, 11, 7, 4, 7, 0, 4, 7, 12, 14, 12, 11, 7, 8, 12, 15, 12, 10, 8, 7, 5, 12, 11, 8, 7, 5, 4, 2, 0, 4, 7, 8, 11, 12, 11, 8, 7, 0, 4, 7, 11, 12, 16, 14, 12, 11, 8, 7, 5, 4, 2, 0, null],
  },
];

function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function envelope(time, duration, attack = .008, release = .06) {
  if (time < 0 || time >= duration) return 0;
  if (time < attack) return time / attack;
  if (time > duration - release) return Math.max(0, (duration - time) / release);
  return 1;
}

function addSquare(buffer, start, duration, frequency, volume, duty = .25) {
  const startSample = Math.floor(start * SAMPLE_RATE); const length = Math.floor(duration * SAMPLE_RATE);
  for (let index = 0; index < length && startSample + index < buffer.length; index += 1) {
    const time = index / SAMPLE_RATE; const phase = (time * frequency) % 1;
    buffer[startSample + index] += (phase < duty ? 1 : -1) * volume * envelope(time, duration);
  }
}

function addTriangle(buffer, start, duration, frequency, volume) {
  const startSample = Math.floor(start * SAMPLE_RATE); const length = Math.floor(duration * SAMPLE_RATE);
  for (let index = 0; index < length && startSample + index < buffer.length; index += 1) {
    const time = index / SAMPLE_RATE; const phase = (time * frequency) % 1;
    const wave = 1 - 4 * Math.abs(Math.round(phase) - phase);
    buffer[startSample + index] += wave * volume * envelope(time, duration, .006, .08);
  }
}

function makeRandom(seed) {
  let value = seed >>> 0;
  return () => { value = (value * 1_664_525 + 1_013_904_223) >>> 0; return value / 0xffff_ffff; };
}

function addNoise(buffer, start, duration, volume, random) {
  const startSample = Math.floor(start * SAMPLE_RATE); const length = Math.floor(duration * SAMPLE_RATE); let previous = 0;
  for (let index = 0; index < length && startSample + index < buffer.length; index += 1) {
    const time = index / SAMPLE_RATE; const raw = random() * 2 - 1; const high = raw - previous * .78; previous = raw;
    buffer[startSample + index] += high * volume * envelope(time, duration, .001, duration * .72);
  }
}

function encodeWav(samples) {
  const dataSize = samples.length * 2; const output = Buffer.alloc(44 + dataSize);
  output.write("RIFF", 0); output.writeUInt32LE(36 + dataSize, 4); output.write("WAVE", 8);
  output.write("fmt ", 12); output.writeUInt32LE(16, 16); output.writeUInt16LE(1, 20); output.writeUInt16LE(1, 22);
  output.writeUInt32LE(SAMPLE_RATE, 24); output.writeUInt32LE(SAMPLE_RATE * 2, 28); output.writeUInt16LE(2, 32); output.writeUInt16LE(16, 34);
  output.write("data", 36); output.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < samples.length; index += 1) output.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[index])) * 32_767), 44 + index * 2);
  return output;
}

function synthesize(track, trackIndex) {
  const beat = 60 / track.bpm; const eighth = beat / 2; const sixteenth = beat / 4;
  const duration = track.melody.length * eighth; const samples = new Float32Array(Math.ceil(duration * SAMPLE_RATE));
  const random = makeRandom(0x5f_37_59 + trackIndex * 97);

  track.melody.forEach((note, index) => {
    if (note === null) return;
    const accent = index % 8 === 0 ? 1.08 : 1;
    addSquare(samples, index * eighth, eighth * .82, midiToFrequency(track.leadRoot + note), .105 * accent, index % 4 === 0 ? .125 : .25);
  });

  for (let index = 0; index < track.melody.length * 2; index += 1) {
    const chordIndex = Math.floor(index / 16) % track.chords.length; const minor = track.modes[chordIndex] === 1;
    const chord = [0, minor ? 3 : 4, 7, 12]; const note = track.leadRoot - 12 + track.chords[chordIndex] + chord[index % chord.length];
    addSquare(samples, index * sixteenth, sixteenth * .7, midiToFrequency(note), .038, .5);
  }

  for (let beatIndex = 0; beatIndex < duration / beat; beatIndex += 1) {
    const chordIndex = Math.floor(beatIndex / 4) % track.chords.length;
    const note = track.leadRoot - 24 + track.chords[chordIndex] + (beatIndex % 4 === 3 ? 7 : 0);
    addTriangle(samples, beatIndex * beat, beat * .86, midiToFrequency(note), .12);
    addTriangle(samples, beatIndex * beat, .055, beatIndex % 4 === 0 ? 72 : 96, beatIndex % 4 === 0 ? .13 : .065);
    if (beatIndex % 2 === 1) addNoise(samples, beatIndex * beat, .075, .032, random);
  }
  for (let index = 0; index < duration / eighth; index += 1) addNoise(samples, index * eighth, .025, index % 2 === 0 ? .014 : .009, random);

  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const scale = peak > 0 ? .68 / peak : 1;
  for (let index = 0; index < samples.length; index += 1) samples[index] = Math.tanh(samples[index] * scale * 1.2) * .82;
  return samples;
}

mkdirSync(OUTPUT_DIR, { recursive: true });
tracks.forEach((track, index) => {
  const wavPath = resolve(OUTPUT_DIR, `${track.file}.wav`); const oggPath = resolve(OUTPUT_DIR, track.file);
  mkdirSync(dirname(wavPath), { recursive: true }); writeFileSync(wavPath, encodeWav(synthesize(track, index)));
  const result = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wavPath, "-c:a", "libvorbis", "-q:a", "5", oggPath], { stdio: "inherit" });
  unlinkSync(wavPath); if (result.status !== 0) process.exit(result.status ?? 1);
  console.log(`generated ${track.file}`);
});
