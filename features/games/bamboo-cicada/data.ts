import type { BambooHud, PhraseConfig } from "./types";

export const ROUND_SECONDS = 75;

export const PHRASES: PhraseConfig[] = [
  {
    id: "first-call",
    name: "初蝉试声",
    subtitle: "慢慢画圆，让竹膜第一次醒来",
    minRps: 1,
    maxRps: 2.1,
    holdSeconds: 4.5,
    accent: "#f0c66e",
  },
  {
    id: "bamboo-echo",
    name: "竹影和鸣",
    subtitle: "稳住手腕，把鸣声连成一线",
    minRps: 1.8,
    maxRps: 2.9,
    holdSeconds: 6.5,
    accent: "#76c8a4",
  },
  {
    id: "summer-chorus",
    name: "满庭鸣夏",
    subtitle: "加快圆周，让整座庭院回响",
    minRps: 2.5,
    maxRps: 3.8,
    holdSeconds: 8,
    accent: "#ef8c66",
  },
];

export const INITIAL_HUD: BambooHud = {
  status: "idle",
  remaining: ROUND_SECONDS,
  score: 0,
  combo: 0,
  bestCombo: 0,
  rps: 0,
  voice: 0,
  tension: 0,
  phraseIndex: 0,
  phraseProgress: 0,
  judgement: "silent",
  direction: 0,
};
