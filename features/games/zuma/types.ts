export type ZumaColor = "red" | "blue" | "yellow" | "green" | "purple";
export type ZumaStatus = "idle" | "playing" | "paused" | "level-clear" | "won" | "lost";

export type ZumaHud = {
  score: number;
  level: number;
  combo: number;
  remaining: number;
  current: ZumaColor;
  next: ZumaColor;
  progress: number;
};

export type ZumaLevel = {
  name: string;
  subtitle: string;
  speed: number;
  count: number;
  colors: ZumaColor[];
  palette: { sky: string; ground: string; track: string; accent: string };
  waypoints: Array<[number, number]>;
};

export type ZumaCallbacks = {
  onHud: (hud: ZumaHud) => void;
  onStatus: (status: ZumaStatus, score: number) => void;
};
