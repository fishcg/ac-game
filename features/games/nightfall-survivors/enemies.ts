import type { NightfallSprite } from "./assets";
import type { BossVariant, EnemyKind } from "./types";

export type EnemyStats = {
  hp: number;
  radius: number;
  speed: number;
  damage: number;
  xp: number;
  armor: number;
  sprite: NightfallSprite;
};

export const ENEMY_STATS: Record<Exclude<EnemyKind, "boss">, EnemyStats> = {
  shade: { hp: 12, radius: 15, speed: 54, damage: 4, xp: 3, armor: 0, sprite: "shade" },
  wolf: { hp: 18, radius: 16, speed: 78, damage: 6, xp: 4, armor: 0, sprite: "wolf" },
  spider: { hp: 25, radius: 17, speed: 68, damage: 6, xp: 6, armor: 1, sprite: "spider" },
  brute: { hp: 42, radius: 25, speed: 42, damage: 8, xp: 8, armor: 2, sprite: "brute" },
  cultist: { hp: 56, radius: 20, speed: 58, damage: 9, xp: 11, armor: 2, sprite: "cultist" },
  slime: { hp: 72, radius: 23, speed: 46, damage: 10, xp: 15, armor: 3, sprite: "slime" },
  wraith: { hp: 94, radius: 24, speed: 70, damage: 11, xp: 20, armor: 4, sprite: "wraith" },
  demon: { hp: 145, radius: 27, speed: 60, damage: 13, xp: 28, armor: 6, sprite: "demon" },
  knight: { hp: 205, radius: 29, speed: 48, damage: 15, xp: 38, armor: 9, sprite: "knight" },
};

export const BOSS_STATS: Record<BossVariant, EnemyStats & { name: string; projectile: "fire" | "orb" | "web" | "stone" }> = {
  infernal: { name: "炼狱魔王", hp: 480, radius: 42, speed: 38, damage: 12, xp: 90, armor: 4, sprite: "boss", projectile: "fire" },
  lich: { name: "永夜巫妖", hp: 540, radius: 40, speed: 34, damage: 11, xp: 105, armor: 6, sprite: "bossLich", projectile: "orb" },
  brood: { name: "蛛巢女皇", hp: 620, radius: 44, speed: 40, damage: 13, xp: 120, armor: 5, sprite: "bossSpider", projectile: "web" },
  golem: { name: "墓穴守卫", hp: 780, radius: 46, speed: 30, damage: 16, xp: 145, armor: 9, sprite: "bossGolem", projectile: "stone" },
  sand: { name: "沙暴执政官 · 赫沙", hp: 2400, radius: 62, speed: 43, damage: 14, xp: 220, armor: 7, sprite: "bossDesert", projectile: "stone" },
  forest: { name: "荆棘女巫 · 维萝", hp: 3000, radius: 64, speed: 40, damage: 15, xp: 270, armor: 9, sprite: "bossForest", projectile: "web" },
  volcano: { name: "炼狱将军 · 卡戎", hp: 3700, radius: 68, speed: 41, damage: 17, xp: 330, armor: 11, sprite: "bossVolcano", projectile: "fire" },
  ice: { name: "霜冠巨人 · 乌尔", hp: 4600, radius: 74, speed: 33, damage: 19, xp: 410, armor: 14, sprite: "bossIce", projectile: "orb" },
  town: { name: "堕誓骑士 · 莱恩", hp: 5600, radius: 70, speed: 48, damage: 20, xp: 500, armor: 16, sprite: "bossTown", projectile: "stone" },
  demonKing: { name: "永夜魔王 · 阿斯莫德", hp: 9800, radius: 84, speed: 40, damage: 24, xp: 1000, armor: 19, sprite: "bossKing", projectile: "fire" },
};

export const BOSS_ORDER: BossVariant[] = ["infernal", "lich", "brood", "golem"];

export const WAVE_PHASES: Array<{ minute: number; name: string; pool: Array<Exclude<EnemyKind, "boss">> }> = [
  { minute: 0, name: "墓园余烬", pool: ["shade", "shade", "shade", "wolf", "wolf", "spider"] },
  { minute: 2, name: "蛛巢蔓延", pool: ["spider", "spider", "wolf", "brute", "brute", "cultist"] },
  { minute: 5, name: "腐化圣堂", pool: ["cultist", "cultist", "slime", "slime", "brute", "wraith"] },
  { minute: 9, name: "深渊裂隙", pool: ["wraith", "wraith", "demon", "demon", "knight", "slime"] },
  { minute: 14, name: "永夜终局", pool: ["demon", "demon", "demon", "knight", "knight", "wraith"] },
];

export function getWavePhase(minutes: number) {
  return WAVE_PHASES.reduce((current, phase) => minutes >= phase.minute ? phase : current, WAVE_PHASES[0]);
}
