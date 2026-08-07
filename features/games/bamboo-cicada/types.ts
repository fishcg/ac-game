export type BambooGameStatus = "idle" | "playing" | "paused" | "won" | "lost";

export type SpeedJudgement = "silent" | "slow" | "steady" | "fast" | "danger";

export type PhraseConfig = {
  id: string;
  name: string;
  subtitle: string;
  minRps: number;
  maxRps: number;
  holdSeconds: number;
  accent: string;
};
export type BambooHud = {
  status: BambooGameStatus;
  remaining: number;
  score: number;
  combo: number;
  bestCombo: number;
  rps: number;
  voice: number;
  tension: number;
  phraseIndex: number;
  phraseProgress: number;
  judgement: SpeedJudgement;
  direction: -1 | 0 | 1;
};

export type BambooFinishReason = "concert-complete" | "time-up" | "rope-broken";

export type BambooEffect = "phrase" | "pulse" | "warning" | "win" | "lost";

export type BambooEngineCallbacks = {
  onHud: (hud: BambooHud) => void;
  onStatus: (status: BambooGameStatus, score: number, reason?: BambooFinishReason) => void;
  onVoice: (rps: number, voice: number) => void;
  onEffect: (effect: BambooEffect) => void;
  onGesture: () => void;
};
