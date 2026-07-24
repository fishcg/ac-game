export type MoonSwingStatus = "idle" | "playing" | "paused" | "won" | "lost";
export type CelestialKind = "moon" | "planet" | "hazard" | "palace";

export type CelestialBody = {
  id: number;
  x: number;
  y: number;
  radius: number;
  kind: CelestialKind;
  hue: number;
};

export type StarDust = { id: number; x: number; y: number; collected: boolean };
export type MoonCourse = { bodies: CelestialBody[]; stars: StarDust[]; goalX: number };

export type MoonSwingHud = {
  score: number;
  distance: number;
  progress: number;
  stars: number;
  combo: number;
  attached: boolean;
  targetReady: boolean;
  message: string;
};

export type MoonSwingCallbacks = {
  onHud: (hud: MoonSwingHud) => void;
  onStatus: (status: MoonSwingStatus, score: number, message: string) => void;
};
