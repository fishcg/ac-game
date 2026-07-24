export type SynthVoice = "lead" | "pluck" | "bass" | "chord" | "kick" | "snare" | "hat";
export type Difficulty = "简单" | "中等" | "困难";

export type MidiEvent = {
  beat: number;
  duration: number;
  midi: number;
  velocity: number;
  voice: SynthVoice;
};

export type ChartNote = {
  id: number;
  beat: number;
  lane: 0 | 1 | 2 | 3;
};

export type SongDefinition = {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  beatsPerBar: 4;
  totalBeats: number;
  beatSeconds: number;
  difficulty: Difficulty;
  difficultyLevel: number;
  accent: string;
  midiEvents: MidiEvent[];
  chart: ChartNote[];
};

type SongConfig = Omit<SongDefinition, "beatsPerBar" | "beatSeconds" | "midiEvents" | "chart"> & {
  chartSteps: (bar: number) => number[];
  lanePatterns: readonly (readonly number[])[];
  leadStep: 0.5 | 1;
  chords?: readonly (readonly number[])[];
  leadPatterns?: readonly (readonly number[])[];
  groove?: "straight" | "dream" | "drive" | "syncopated";
  arpeggio?: boolean;
  counterMelody?: boolean;
};

const CHORDS = [
  [60, 64, 67],
  [57, 60, 64],
  [53, 57, 60],
  [55, 59, 62],
] as const;

const LEAD_PATTERNS = [
  [72, 76, 79, 76, 74, 72, 67, 71],
  [72, 76, 81, 79, 76, 74, 72, 76],
  [77, 81, 84, 81, 79, 77, 72, 76],
  [79, 83, 86, 83, 81, 79, 74, 77],
] as const;

function buildSong(config: SongConfig): SongDefinition {
  const midiEvents: MidiEvent[] = [];
  const chart: ChartNote[] = [];
  const bars = config.totalBeats / 4;
  let noteId = 0;

  for (let bar = 0; bar < bars; bar += 1) {
    const barBeat = bar * 4;
    const chords = config.chords ?? CHORDS;
    const leadPatterns = config.leadPatterns ?? LEAD_PATTERNS;
    const chordIndex = bar % chords.length;
    const chord = chords[chordIndex];
    const lead = leadPatterns[bar % leadPatterns.length];

    chord.forEach((midi, index) => midiEvents.push({ beat: barBeat, duration: 3.72, midi, velocity: (config.difficulty === "简单" ? 0.12 : 0.14) - index * 0.006, voice: "chord" }));
    const bassBeats = config.groove === "syncopated" ? [0, 1.5, 2.75] : config.groove === "drive" ? [0, 1.5, 2, 3.5] : config.groove === "dream" ? [0, 2.5] : [0, 2];
    bassBeats.forEach((beat, index) => midiEvents.push({ beat: barBeat + beat, duration: index % 2 ? 0.46 : 0.68, midi: chord[0] - 12, velocity: index === 0 ? 0.42 : 0.34, voice: "bass" }));

    const leadSteps = config.leadStep === 1 ? [0, 2, 4, 6] : [0, 1, 2, 3, 4, 5, 6, 7];
    leadSteps.forEach((step) => {
      midiEvents.push({ beat: barBeat + step * 0.5, duration: config.leadStep === 1 ? 0.64 : 0.3, midi: lead[step], velocity: step % 4 === 0 ? 0.4 : 0.3, voice: step % 2 ? "pluck" : "lead" });
    });

    if (config.arpeggio) {
      [0.5, 1.5, 2.5, 3.5].forEach((beat, index) => midiEvents.push({
        beat: barBeat + beat,
        duration: 0.32,
        midi: chord[index % chord.length] + 12,
        velocity: 0.16,
        voice: "pluck",
      }));
    }
    if (config.counterMelody && bar % 2 === 1) {
      midiEvents.push({ beat: barBeat + 1.25, duration: 0.5, midi: lead[5] - 12, velocity: 0.2, voice: "lead" });
      midiEvents.push({ beat: barBeat + 3.25, duration: 0.55, midi: lead[7] - 12, velocity: 0.18, voice: "lead" });
    }

    const hatStep = config.difficulty === "简单" && config.groove !== "drive" ? 1 : 0.5;
    for (let beat = 0; beat < 4; beat += hatStep) midiEvents.push({ beat: barBeat + beat, duration: 0.07, midi: 42, velocity: beat % 1 ? 0.13 : 0.2, voice: "hat" });
    const kickBeats = config.groove === "syncopated" ? [0, 1.5, 2.75] : config.groove === "drive" ? [0, 1.5, 2, 3.5] : config.groove === "dream" ? [0, 2.5] : [0, 2];
    kickBeats.forEach((beat, index) => midiEvents.push({ beat: barBeat + beat, duration: 0.18, midi: 36, velocity: index === 0 ? 0.68 : 0.53, voice: "kick" }));
    const snareBeats = config.groove === "dream" ? [1.5, 3.5] : [1, 3];
    snareBeats.forEach((beat, index) => midiEvents.push({ beat: barBeat + beat, duration: 0.12, midi: 38, velocity: index ? 0.54 : 0.48, voice: "snare" }));

    if (bar > 0) {
      const pattern = config.lanePatterns[(bar - 1) % config.lanePatterns.length];
      config.chartSteps(bar).forEach((step) => {
        chart.push({ id: noteId++, beat: barBeat + step * 0.5, lane: pattern[step] as 0 | 1 | 2 | 3 });
      });
    }
  }

  return {
    ...config,
    beatsPerBar: 4,
    beatSeconds: 60 / config.bpm,
    midiEvents: midiEvents.sort((a, b) => a.beat - b.beat),
    chart,
  };
}

const EASY = buildSong({
  id: "morning-walk",
  title: "晨光漫步",
  artist: "狗耳GAME EASY GROOVE",
  bpm: 92,
  totalBeats: 36,
  difficulty: "简单",
  difficultyLevel: 2,
  accent: "#5ce1e6",
  leadStep: 1,
  groove: "straight",
  lanePatterns: [
    [0, 0, 1, 1, 2, 2, 3, 3],
    [3, 3, 2, 2, 1, 1, 0, 0],
  ],
  chartSteps: () => [0, 2, 4, 6],
});

const MEDIUM = buildSong({
  id: "city-cruise",
  title: "城市漫游",
  artist: "狗耳GAME NIGHT DRIVE",
  bpm: 114,
  totalBeats: 44,
  difficulty: "中等",
  difficultyLevel: 5,
  accent: "#8a7dff",
  leadStep: 0.5,
  groove: "syncopated",
  counterMelody: true,
  lanePatterns: [
    [0, 1, 1, 2, 2, 3, 1, 2],
    [1, 0, 2, 1, 3, 2, 1, 3],
    [3, 2, 2, 1, 1, 0, 2, 1],
  ],
  chartSteps: (bar) => bar % 3 === 0 ? [0, 1, 3, 4, 6, 7] : [0, 2, 3, 4, 6],
});

const HARD = buildSong({
  id: "neon-pulse",
  title: "霓虹脉冲",
  artist: "狗耳GAME MIDI LAB",
  bpm: 132,
  totalBeats: 52,
  difficulty: "困难",
  difficultyLevel: 8,
  accent: "#ff67b1",
  leadStep: 0.5,
  groove: "drive",
  arpeggio: true,
  counterMelody: true,
  lanePatterns: [
    [0, 1, 2, 3, 1, 2, 0, 3],
    [1, 0, 2, 1, 3, 2, 1, 3],
    [0, 2, 1, 3, 2, 0, 3, 1],
    [3, 2, 1, 0, 2, 1, 3, 0],
  ],
  chartSteps: (bar) => bar < 3 ? [0, 2, 4, 6] : bar % 4 === 0 ? [0, 1, 3, 4, 6, 7] : [0, 1, 2, 3, 4, 5, 6, 7],
});

const STARRY_ECHO = buildSong({
  id: "starry-echo",
  title: "星雨回声",
  artist: "狗耳GAME DREAM SIGNAL",
  bpm: 104,
  totalBeats: 48,
  difficulty: "中等",
  difficultyLevel: 4,
  accent: "#72d8ff",
  leadStep: 0.5,
  groove: "dream",
  arpeggio: true,
  counterMelody: true,
  chords: [
    [59, 62, 66, 69],
    [55, 59, 62, 66],
    [50, 54, 57, 61],
    [57, 61, 64, 71],
  ],
  leadPatterns: [
    [74, 78, 81, 83, 81, 78, 76, 74],
    [71, 74, 78, 81, 78, 76, 74, 71],
    [69, 74, 76, 78, 81, 78, 76, 74],
    [73, 76, 81, 83, 85, 83, 81, 76],
  ],
  lanePatterns: [
    [0, 1, 2, 1, 3, 2, 1, 0],
    [3, 2, 1, 2, 0, 1, 2, 3],
    [1, 0, 2, 3, 2, 1, 3, 0],
  ],
  chartSteps: (bar) => bar % 4 === 0 ? [0, 2, 4, 6] : [0, 1, 3, 4, 6, 7],
});

const MIDNIGHT_RADIO = buildSong({
  id: "midnight-radio",
  title: "午夜电台",
  artist: "狗耳GAME CITY POP UNIT",
  bpm: 122,
  totalBeats: 56,
  difficulty: "中等",
  difficultyLevel: 6,
  accent: "#ff9d6c",
  leadStep: 0.5,
  groove: "syncopated",
  arpeggio: true,
  counterMelody: true,
  chords: [
    [57, 60, 64, 67],
    [62, 65, 69, 72],
    [55, 59, 62, 65],
    [60, 64, 67, 71],
  ],
  leadPatterns: [
    [76, 79, 81, 84, 83, 81, 79, 76],
    [77, 81, 84, 86, 84, 81, 79, 77],
    [74, 77, 79, 83, 81, 79, 77, 74],
    [76, 79, 83, 84, 88, 84, 83, 79],
  ],
  lanePatterns: [
    [0, 2, 1, 3, 2, 0, 1, 3],
    [1, 3, 2, 0, 3, 1, 0, 2],
    [3, 1, 0, 2, 1, 3, 2, 0],
  ],
  chartSteps: (bar) => bar % 3 === 1 ? [0, 1, 2, 4, 5, 7] : [0, 2, 3, 4, 6, 7],
});

export const SONGS = [EASY, STARRY_ECHO, MEDIUM, MIDNIGHT_RADIO, HARD] as const;
