export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 760;

export type GameStatus = "intro" | "loading" | "running" | "over";
export type EnemyKind = "scout" | "zigzag" | "tank" | "boss";
export type BossVariant = "scarlet" | "azure" | "verdant";
export type WeaponKind = "cannon" | "laser" | "spread";
export type BulletKind = "bolt" | "spread" | "missile" | "enemyBolt" | "enemyOrb";
export type PowerupKind = "fire" | "shield" | "wingman";
export type SoundEvent = "shoot" | "enemyShoot" | "hit" | "explode" | "powerup" | "shield" | "gameOver";

export type VectorEntity = { x: number; y: number; vx: number; vy: number; radius: number };
export type Bullet = VectorEntity & { enemy: boolean; damage: number; kind: BulletKind };
export type Enemy = VectorEntity & {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  score: number;
  phase: number;
  shootCooldown: number;
  shotCount: number;
  bossVariant?: BossVariant;
};
export type Powerup = VectorEntity & { kind: PowerupKind; spin: number };
export type Particle = VectorEntity & { life: number; maxLife: number; color: string; size: number };

export type PlayerState = {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  radius: number;
  hp: number;
  shield: number;
  power: number;
  weapon: WeaponKind;
  wingmen: number;
  wingmanCooldown: number;
  invulnerable: number;
  shootCooldown: number;
};

export type ThunderHud = {
  score: number;
  lives: number;
  shield: number;
  power: number;
  weapon: WeaponKind;
  wingmen: number;
  wave: number;
  bossHp: number | null;
  bossName: string | null;
  bossPhase: number | null;
};

export type MovementInput = { left: boolean; right: boolean; up: boolean; down: boolean };
