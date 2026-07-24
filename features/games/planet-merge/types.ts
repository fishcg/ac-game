export type PlanetMergeStatus = "idle" | "playing" | "paused" | "won" | "lost";
export type DropKind = number | "comet";

export type PlanetBall = {
  id: number;
  tier: number;
  comet: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  age: number;
  mergeLock: number;
  alive: boolean;
  rotation: number;
  squash: number;
  squashVelocity: number;
  squashAngle: number;
};

export type PlanetHud = {
  score: number;
  combo: number;
  drops: number;
  maxTier: number;
  next: DropKind;
  danger: number;
  mission: string;
  message: string;
  planets: number;
};

export type PlanetCallbacks = {
  onHud: (hud: PlanetHud) => void;
  onStatus: (status: PlanetMergeStatus, score: number, message: string) => void;
};
