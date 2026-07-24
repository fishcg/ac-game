export type WormTeam = "player" | "enemy";
export type WormGameStatus = "idle" | "playing" | "paused" | "won" | "lost";
export type TurnPhase = "intro" | "aiming" | "ai-thinking" | "projectile" | "settling";
export type WeaponId = "bazooka" | "grenade" | "cluster" | "airstrike";

export type WeaponDefinition = {
  id: WeaponId;
  name: string;
  icon: string;
  description: string;
  damage: number;
  radius: number;
  terrainRadius: number;
  speedMin: number;
  speedMax: number;
  fuse: number;
  initialStock: number;
};

export type WormUnit = {
  id: number;
  team: WormTeam;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  alive: boolean;
  grounded: boolean;
  facing: -1 | 1;
  angle: number;
  moveFuel: number;
  hurtFlash: number;
};

export type Projectile = {
  id: number;
  weapon: WeaponId | "shard" | "bomb";
  ownerId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  fuse: number;
  bounces: number;
  radius: number;
};

export type WeaponInventory = Record<WeaponId, number>;

export type WormHud = {
  status: WormGameStatus;
  phase: TurnPhase;
  activeTeam: WormTeam;
  activeName: string;
  turn: number;
  turnTime: number;
  wind: number;
  power: number;
  charging: boolean;
  selectedWeapon: WeaponId;
  inventory: WeaponInventory;
  playerHealth: number;
  enemyHealth: number;
  playerAlive: number;
  enemyAlive: number;
  moveFuel: number;
  score: number;
  aimDegrees: number;
  mapName: string;
  notice: string;
};

export type WormCallbacks = {
  onHud: (hud: WormHud) => void;
  onStatus: (status: WormGameStatus, score: number, message: string) => void;
};
