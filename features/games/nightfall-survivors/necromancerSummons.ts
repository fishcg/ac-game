import type { NightfallSprite } from "./assets";
import type { SummonKind, WeaponId } from "./types";

export type SummonDefinition = {
  weaponId: WeaponId;
  kind: SummonKind;
  sprite: NightfallSprite;
  count: number;
  maxCount: number;
  duration: number;
  speed: number;
  range: number;
  radius: number;
  attackInterval: number;
  damageScale: number;
  baseHp: number;
  role: "melee" | "ranged" | "spectral" | "tank";
  color: string;
};

export const NECROMANCER_SUMMONS: Partial<Record<WeaponId, SummonDefinition>> = {
  bats: { weaponId: "bats", kind: "bat", sprite: "bat", count: 4, maxCount: 6, duration: 0, speed: 205, range: 30, radius: 9, attackInterval: .62, damageScale: .62, baseHp: 18, role: "melee", color: "#aa79ef" },
  skeletonGuard: { weaponId: "skeletonGuard", kind: "skeletonGuard", sprite: "summonGuard", count: 1, maxCount: 1, duration: 0, speed: 138, range: 28, radius: 15, attackInterval: .72, damageScale: .95, baseHp: 110, role: "melee", color: "#e9e1c2" },
  boneMage: { weaponId: "boneMage", kind: "boneMage", sprite: "summonMage", count: 1, maxCount: 1, duration: 0, speed: 108, range: 220, radius: 14, attackInterval: 1.05, damageScale: .86, baseHp: 52, role: "ranged", color: "#a98cff" },
  wraithSummon: { weaponId: "wraithSummon", kind: "wraith", sprite: "summonWraith", count: 1, maxCount: 1, duration: 0, speed: 185, range: 44, radius: 16, attackInterval: .62, damageScale: .72, baseHp: 42, role: "spectral", color: "#76e9ff" },
  graveGolem: { weaponId: "graveGolem", kind: "graveGolem", sprite: "summonGolem", count: 1, maxCount: 1, duration: 0, speed: 92, range: 38, radius: 22, attackInterval: 1.45, damageScale: 1.55, baseHp: 220, role: "tank", color: "#b7c0ca" },
  boneArchers: { weaponId: "boneArchers", kind: "boneArcher", sprite: "summonArcher", count: 2, maxCount: 2, duration: 0, speed: 116, range: 270, radius: 13, attackInterval: 1.18, damageScale: .72, baseHp: 48, role: "ranged", color: "#d8eeaa" },
  deathKnight: { weaponId: "deathKnight", kind: "deathKnight", sprite: "summonKnight", count: 1, maxCount: 1, duration: 0, speed: 156, range: 40, radius: 18, attackInterval: .88, damageScale: 1.18, baseHp: 125, role: "melee", color: "#ff6f94" },
};

export const SUMMON_SPRITES: Record<SummonKind, NightfallSprite> = {
  bat: "bat",
  skeletonGuard: "summonGuard",
  boneMage: "summonMage",
  wraith: "summonWraith",
  graveGolem: "summonGolem",
  boneArcher: "summonArcher",
  deathKnight: "summonKnight",
  boneDragon: "summonDragon",
  deathLegion: "summonLegion",
};

export const isNecromancerSummon = (id: WeaponId) => Boolean(NECROMANCER_SUMMONS[id]);

export const BONE_DRAGON = {
  name: "骷髅巨龙",
  cooldown: 75,
  duration: 12,
  sprite: "summonDragon" as NightfallSprite,
};
