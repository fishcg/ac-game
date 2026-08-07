import type { PhraseConfig, SpeedJudgement } from "./types";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export const DANGER_RPS = 4.6;
export const BREAK_SECONDS = 2.8;

export function judgeSpeed(rps: number, voice: number, phrase: PhraseConfig): SpeedJudgement {
  if (voice < 0.12 || rps < 0.55) return "silent";
  if (rps < phrase.minRps) return "slow";
  if (rps <= phrase.maxRps) return "steady";
  if (rps >= DANGER_RPS) return "danger";
  return "fast";
}

export function advancePhraseProgress(progress: number, judgement: SpeedJudgement, delta: number, phrase: PhraseConfig) {
  const change = judgement === "steady" ? delta / phrase.holdSeconds : -delta * (judgement === "danger" ? 0.34 : 0.12);
  return clamp01(progress + change);
}

export function advanceTension(tension: number, rps: number, delta: number) {
  if (rps >= DANGER_RPS) {
    const intensity = 1 + Math.min(1.25, (rps - DANGER_RPS) * 0.6);
    return clamp01(tension + delta * intensity / BREAK_SECONDS);
  }
  return clamp01(tension - delta * 0.52);
}

export function frameScore(delta: number, rps: number, combo: number, judgement: SpeedJudgement) {
  if (judgement !== "steady") return 0;
  const comboMultiplier = 1 + Math.min(2, combo * 0.045);
  return delta * (115 + rps * 34) * comboMultiplier;
}

export function completionBonus(phraseIndex: number, combo: number) {
  return 850 + phraseIndex * 500 + Math.min(1200, combo * 24);
}

export function finalScore(rawScore: number, remaining: number, bestCombo: number) {
  return Math.max(0, Math.round(rawScore + remaining * 38 + bestCombo * 18));
}
