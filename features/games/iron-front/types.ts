export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 540;
export const WORLD_WIDTH = 5200;
export const GROUND_Y = 430;

export type IronStatus = "intro" | "loading" | "playing" | "over" | "won";
export type WeaponKind = "pistol" | "machine" | "shotgun";
export type EnemyKind = "soldier" | "gunner" | "dog" | "tank";
export type PickupKind = "machine" | "shotgun" | "health" | "grenade";

export type IronInput = {
  left: boolean;
  right: boolean;
  jump: boolean;
  crouch: boolean;
  aimUp: boolean;
  shoot: boolean;
  grenade: boolean;
};

export type PlayerState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  facing: -1 | 1;
  onGround: boolean;
  hp: number;
  maxHp: number;
  weapon: WeaponKind;
  ammo: number;
  grenades: number;
  invulnerable: number;
  shootCooldown: number;
  animationTime: number;
};

export type Bullet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  enemy: boolean;
  ttl: number;
  shell?: boolean;
};

export type Enemy = {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  hp: number;
  maxHp: number;
  facing: -1 | 1;
  shootCooldown: number;
  animationTime: number;
  alive: boolean;
};

export type Grenade = { x: number; y: number; vx: number; vy: number; ttl: number; rotation: number };
export type Explosion = { x: number; y: number; age: number; size: number };
export type Pickup = { x: number; y: number; kind: PickupKind; active: boolean; bob: number };
export type Crate = { x: number; y: number; hp: number; pickup: PickupKind; opened: boolean };
export type Hostage = { x: number; rescued: boolean; wave: number };
export type Platform = { x: number; y: number; width: number; height: number };

export type IronHud = {
  score: number;
  hp: number;
  maxHp: number;
  weapon: WeaponKind;
  ammo: number;
  grenades: number;
  rescued: number;
  distance: number;
  bossHp: number | null;
};
