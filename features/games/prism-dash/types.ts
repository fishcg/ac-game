export type PrismDashStatus = "idle" | "playing" | "paused" | "won" | "lost";

export type DashObstacle = {
  id: number;
  type: "spike" | "block" | "orb" | "pad";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DashShard = { id: number; x: number; y: number };

export type PrismDashHud = {
  score: number;
  progress: number;
  shards: number;
  speed: number;
  zone: string;
  message: string;
};

export type PrismDashCallbacks = {
  onHud: (hud: PrismDashHud) => void;
  onStatus: (status: PrismDashStatus, score: number, message: string) => void;
};
