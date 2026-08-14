export type DefenseStatus = "idle" | "playing" | "paused" | "decree" | "won" | "lost";

export type TowerType = "archer" | "spear" | "catapult";
export type TowerBranch = "rapid" | "fire" | "guard" | "phalanx" | "thunder" | "boulder";
export type EnemyType = "infantry" | "shield" | "cavalry" | "siege" | "boss";
export type DecreeId = "strongBow" | "spearWall" | "thunderStone" | "militia" | "repair" | "inspire";

export type Point = { x: number; y: number };

export type TowerConfig = {
  id: TowerType;
  name: string;
  description: string;
  cost: number;
  range: number;
  damage: number;
  cooldown: number;
  color: string;
  branches: Array<{ id: TowerBranch; name: string; description: string }>;
};

export type EnemyConfig = {
  id: EnemyType;
  name: string;
  hp: number;
  speed: number;
  reward: number;
  castleDamage: number;
  color: string;
};

export type WaveEntry = { type: EnemyType; count: number; interval: number; delay?: number };
export type WaveConfig = { name: string; entries: WaveEntry[] };

export type Tower = {
  id: number;
  slotId: number;
  type: TowerType;
  level: 1 | 2 | 3;
  branch: TowerBranch | null;
  cooldown: number;
};

export type Enemy = {
  id: number;
  type: EnemyType;
  hp: number;
  maxHp: number;
  progress: number;
  speed: number;
  reward: number;
  castleDamage: number;
  dead: boolean;
  burnTime: number;
  burnTick: number;
  slowTime: number;
  hitFlash: number;
  phase: 1 | 2;
};

export type Projectile = {
  active: boolean;
  x: number;
  y: number;
  tx: number;
  ty: number;
  age: number;
  duration: number;
  color: string;
  size: number;
};

export type Particle = {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  color: string;
  size: number;
};

export type DefenseHud = {
  castleHp: number;
  maxCastleHp: number;
  food: number;
  morale: number;
  score: number;
  wave: number;
  totalWaves: number;
  waveName: string;
  enemiesAlive: number;
  nextWaveIn: number;
  selectedSlotId: number | null;
  selectedTower: Tower | null;
  heroCharge: number;
  heroReady: boolean;
  fireReady: boolean;
  speed: 1 | 2;
  message: string;
  bossHp: number | null;
  bossName: string | null;
};

export type DefenseCallbacks = {
  onHud: (hud: DefenseHud) => void;
  onStatus: (status: DefenseStatus, score: number, message: string) => void;
  onDecree: (choices: DecreeId[]) => void;
};
