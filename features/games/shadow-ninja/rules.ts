import type { FighterState } from "./types";

/**
 * 纯规则层：连段衰减、防御判定、查克拉换算、回合与总分的结算。
 * 这里不碰 DOM、不碰 canvas，可以被单独测试。
 */

export const COMBO_FLOOR = 0.35;
export const BLOCK_DAMAGE_RATE = 0.18;
export const GUARD_MAX = 100;
export const GUARD_RECOVER = 0.3;
export const ROUNDS_TO_WIN = 2;
export const MAX_CHAKRA = 100;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** 连段第 n 段（从 0 起）的伤害倍率，最低衰减到 35%。 */
export function comboMultiplier(hitIndex: number): number {
  if (hitIndex <= 0) return 1;
  return Math.max(COMBO_FLOOR, 1 - hitIndex * 0.075);
}

/** 命中伤害：先按连段衰减，再取整，至少 1 点。 */
export function scaledDamage(base: number, hitIndex: number): number {
  if (base <= 0) return 0;
  return Math.max(1, Math.round(base * comboMultiplier(hitIndex)));
}

/** 被防御时的削减伤害（含削血），约为原伤害的 18%，至少 1 点。 */
export function blockedDamage(base: number, hitIndex: number): number {
  return Math.max(1, Math.round(scaledDamage(base, hitIndex) * BLOCK_DAMAGE_RATE));
}

export type DefenderView = {
  grounded: boolean;
  attacking: boolean;
  hitstun: number;
  holdingGuard: boolean;
  guard: number;
};

/**
 * 防御成立条件：双脚着地、没有处于攻击动作、没有硬直、按住防御键且护盾没被破。
 * 空中不能防御，这是本作压制空中起跳的核心规则。
 */
export function canBlock(view: DefenderView): boolean {
  return view.grounded && !view.attacking && view.hitstun <= 0 && view.holdingGuard && view.guard > 0;
}

/** 每次防御成功消耗的护盾值。 */
export function guardCost(damage: number): number {
  return Math.max(7, damage * 2.6);
}

export function guardAfter(guard: number, damage: number): number {
  return clamp(guard - guardCost(damage), 0, GUARD_MAX);
}

export function isGuardBroken(guard: number): boolean {
  return guard <= 0;
}

export function recoverGuard(guard: number, amount = GUARD_RECOVER): number {
  return clamp(guard + amount, 0, GUARD_MAX);
}

/** 攻击方获得的查克拉：命中全额，被防御只拿一半。 */
export function chakraFromDealing(gain: number, blocked: boolean): number {
  return Math.max(0, gain) * (blocked ? 0.5 : 1);
}

/** 防守方受创获得的查克拉（挨打也能攒资源）。 */
export function chakraFromTaking(damage: number): number {
  return Math.max(0, damage) * 0.55;
}

export function clampChakra(value: number): number {
  return clamp(value, 0, MAX_CHAKRA);
}

export type RoundOutcome = {
  winner: 0 | 1 | -1;
  reason: "ko" | "time" | "double-ko";
};

/** 回合结算：血量归零优先，其次时间到比血量，同血或双 KO 判平局。 */
export function roundOutcome(hp1: number, hp2: number, timeLeft: number): RoundOutcome {
  if (hp1 <= 0 && hp2 <= 0) return { winner: -1, reason: "double-ko" };
  if (hp2 <= 0) return { winner: 0, reason: "ko" };
  if (hp1 <= 0) return { winner: 1, reason: "ko" };
  if (timeLeft > 0) return { winner: -1, reason: "time" };
  if (hp1 === hp2) return { winner: -1, reason: "time" };
  return { winner: hp1 > hp2 ? 0 : 1, reason: "time" };
}

export function matchDecided(wins: [number, number]): boolean {
  return wins[0] >= ROUNDS_TO_WIN || wins[1] >= ROUNDS_TO_WIN;
}

export function isActionState(state: FighterState): boolean {
  return state === "idle" || state === "walk" || state === "block";
}

/** 结算分数：胜场、总伤害、最大连段、剩余时间与完胜都会计入。 */
export function computeScore(input: {
  win: boolean;
  wins: [number, number];
  damageDealt: number;
  maxCombo: number;
  timeLeft: number;
  perfect: boolean;
}): number {
  const base =
    Math.max(0, input.wins[0]) * 1150 +
    Math.max(0, Math.round(input.damageDealt)) * 3 +
    Math.max(0, input.maxCombo) * 70 +
    (input.win ? 1600 : 0) +
    Math.max(0, Math.round(input.timeLeft)) * 9 +
    (input.perfect ? 900 : 0);
  return Math.max(0, Math.round(base));
}
