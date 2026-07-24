export const ARENA_WIDTH = 960;
export const ARENA_HEIGHT = 600;

import type { NightfallSprite } from "./assets";

export type WeaponId =
  | "whip" | "boomerang" | "holy" | "frost" | "bats" | "axes" | "soul" | "meteor" | "chain" | "plague" | "metal" | "wood" | "water" | "fire" | "earth"
  | "shield" | "consecrate" | "lance"
  | "volley" | "windshot" | "trap" | "falcon" | "ricochet"
  | "bones" | "skeletons" | "curse"
  | "skeletonGuard" | "boneMage" | "wraithSummon" | "graveGolem" | "boneArchers" | "deathKnight"
  | "yin" | "yang"
  | "elvenArrow" | "moonArrow" | "vineArrow" | "spiritHawk" | "leafStorm" | "starTrap" | "ancientBow";
export type PassiveId = "might" | "boots" | "vitality" | "greed" | "armor" | "cooldown";
export type TarotId = "mage" | "emperor" | "lovers" | "hermit" | "tower" | "fool";
export type CharacterId = "paladin" | "ranger" | "necromancer" | "mage" | "elf";
export type ElementId = "metal" | "wood" | "water" | "fire" | "earth";
export type ElementComboKey = "wood-fire" | "fire-earth" | "earth-metal" | "metal-water" | "water-wood";
export type StageId = "desert" | "forest" | "volcano" | "ice" | "town" | "throne";
export type EvolutionId =
  | "flameWhip" | "thunderstorm" | "judgement" | "absoluteZero" | "batSwarm" | "deathCyclone" | "soulTempest" | "apocalypse" | "thunderDomain" | "plagueSky" | "metalStorm" | "ancientForest" | "deepSea" | "solarFlame" | "mountainFall"
  | "aegis" | "holyGround" | "heavenLance"
  | "arrowStorm" | "tempestShot" | "hunterDomain" | "stormFalcon" | "infiniteRicochet"
  | "boneLegion" | "deathArmy" | "eternalCurse"
  | "royalGuard" | "lichCouncil" | "wraithHost" | "ossuaryTitan" | "deadeyeVolley" | "dreadCavalier"
  | "lunarVoid" | "solarCrown"
  | "worldTreeArrow" | "moonRain" | "thornHeart" | "emeraldHawk" | "autumnTempest" | "astralSnare" | "sylvanBallista";
export type UpgradeId = WeaponId | PassiveId;

export type SurvivorInput = { left: boolean; right: boolean; up: boolean; down: boolean };
export type ItemLevels = Record<string, number>;
export type EnemyKind = "shade" | "wolf" | "spider" | "brute" | "cultist" | "slime" | "wraith" | "demon" | "knight" | "boss";
export type BossVariant = "infernal" | "lich" | "brood" | "golem" | "sand" | "forest" | "volcano" | "ice" | "town" | "demonKing";
export type MissionId = "first_hunt" | "arsenal" | "survivor" | "veteran" | "boss_hunter" | "horde_breaker";
export type ActiveSkillId = "starfall" | "time_stop" | "sanctuary" | "magnet" | "judgement" | "holy_bomb";
export type SupplyKind = "heal" | "magnet";

export type Enemy = {
  id: number; x: number; y: number; vx: number; vy: number; radius: number; hp: number; maxHp: number;
  armor: number; speed: number; damage: number; xp: number; kind: EnemyKind; bossVariant?: BossVariant;
  frozen: number; slow: number; burn: number; burnTick: number; hitFlash: number; elite: boolean; skillCooldown: number; bounty?: boolean; stageBoss?: boolean;
};

export type HostileProjectile = {
  id: number; kind: "fire" | "orb" | "web" | "stone"; x: number; y: number; vx: number; vy: number;
  radius: number; damage: number; ttl: number;
};

export type Projectile = {
  id: number; kind: "boomerang" | "bat" | "mage" | "soul" | "signature"; x: number; y: number; vx: number; vy: number;
  radius: number; damage: number; ttl: number; age: number; pierce: number; returning?: boolean; hitIds: Set<number>;
  targetId?: number; targetRefresh?: number; homing?: boolean; speed?: number; visual?: NightfallSprite; color?: string; weaponId?: WeaponId;
};

export type SummonKind = "bat" | "skeletonGuard" | "boneMage" | "wraith" | "graveGolem" | "boneArcher" | "deathKnight" | "boneDragon" | "deathLegion";
export type Summon = {
  id: number; kind: SummonKind; weaponId?: WeaponId; x: number; y: number; vx: number; vy: number;
  radius: number; damage: number; speed: number; range: number; attackInterval: number; attackCooldown: number;
  hp: number; maxHp: number; invulnerable: number; ttl: number; maxTtl: number; targetId?: number; phase: number; evolved: boolean;
};

export type Gem = { x: number; y: number; value: number; radius: number };
export type Supply = { id: number; kind: SupplyKind; x: number; y: number; radius: number; ttl: number };
export type Obstacle = { id: number; x: number; y: number; radius: number; sprite: NightfallSprite; filter: string; accent: string };
export type Effect = { kind: "whip" | "holy" | "frost" | "mist" | "shockwave" | "heal" | "chest" | "meteor" | "chain" | "plague" | "metal" | "roots" | "water" | "elementFire" | "earth" | "elementCombo" | "signature" | "hit" | "burst" | "pickup" | "ascended"; x: number; y: number; x2?: number; y2?: number; age: number; duration: number; radius: number; color: string; color2?: string; comboKey?: ElementComboKey; power?: number; visual?: NightfallSprite; visual2?: NightfallSprite };
export type Particle = { x: number; y: number; vx: number; vy: number; life: number; size: number; color: string };
export type DamageNumber = { x: number; y: number; value: number; life: number; critical: boolean };

export type Player = {
  x: number; y: number; radius: number; facingX: number; facingY: number; hp: number; maxHp: number;
  baseSpeed: number; invulnerable: number; shield: boolean; idleTime: number;
};

export type UpgradeOption = {
  id: UpgradeId; kind: "weapon" | "passive"; name: string; icon: string; currentLevel: number; nextLevel: number; description: string;
};

export type MissionHud = {
  id: MissionId; name: string; description: string; progress: number; target: number; reward: string; completed: boolean;
};
export type ActiveSkillHud = { id: ActiveSkillId; name: string; icon: string; description: string; charges: number };
export type ClassUltimateHud = {
  name: string; icon: string; description: string; readyText: string; hotkey: string;
  charge: number; ready: boolean; active: boolean; visual: NightfallSprite; color: string;
};
export type CooldownUltimateHud = {
  name: string; icon: string; description: string; hotkey: string; cooldown: number; cooldownMax: number;
  active: boolean; visual: NightfallSprite; color: string;
};

export type SurvivorHud = {
  hp: number; maxHp: number; level: number; xp: number; nextXp: number; kills: number; elapsed: number;
  weapons: Array<{ id: WeaponId; level: number; evolved: boolean }>;
  passives: Array<{ id: PassiveId; level: number }>;
  tarots: TarotId[]; shield: boolean; buffTime: number; bossHp: number | null; bossName: string | null;
  altarBuff: number; altarActive: boolean; altarCharge: number;
  waveName: string; missions: MissionHud[];
  activeSkills: ActiveSkillHud[]; hordeRemaining: number; nextHordeIn: number; hordeIndex: number;
  combo: number; comboTime: number; feverRemaining: number;
  bountyRemaining: number; bountyName: string | null;
  elementLast: ElementId | null; elementNext: ElementId | null; elementComboName: string | null; elementComboTime: number;
  elementComboCooldown: number; elementWindow: number;
  stageIndex: number; stageCount: number; stageId: StageId; stageName: string; stageSubtitle: string;
  stageElapsed: number; stageDuration: number; stageBossAt: number; stageBossSpawned: boolean;
  classUltimate: ClassUltimateHud | null;
  dragonUltimate: CooldownUltimateHud | null;
};
