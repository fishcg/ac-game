export type ParkingStatus = "idle" | "playing" | "paused" | "won" | "lost";
export type RoadSurface = "dry" | "wet" | "ice";
export type VehicleKind = "compact" | "sedan" | "van";

export type ParkingStage = {
  name: string;
  hint: string;
  surface: RoadSurface;
  vehicle: VehicleKind;
  carLength: number;
  bayStart: number;
  bayWidth: number;
  acceleration: number;
  braking: number;
  maxSpeed: number;
  slope: number;
  theme: "morning" | "day" | "sunset" | "night";
};

export type ParkingHud = {
  level: number;
  totalLevels: number;
  score: number;
  combo: number;
  lives: number;
  speed: number;
  timeLeft: number;
  message: string;
  quality: number;
};

export type ParkingCallbacks = {
  onHud: (hud: ParkingHud) => void;
  onStatus: (status: ParkingStatus, score: number, message: string) => void;
};
