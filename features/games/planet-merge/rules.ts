import { MISSIONS, PLANET_TIERS, WARNING_Y } from "./data";
import type { DropKind, PlanetBall } from "./types";

export function canMerge(a: Pick<PlanetBall,"tier"|"comet"|"alive"|"mergeLock">, b: Pick<PlanetBall,"tier"|"comet"|"alive"|"mergeLock">) {
  return a.alive && b.alive && !a.comet && !b.comet && a.tier === b.tier && a.tier < PLANET_TIERS.length - 1 && a.mergeLock <= 0 && b.mergeLock <= 0;
}

export function mergeScore(newTier: number, combo: number) {
  const tier = Math.max(0, Math.min(PLANET_TIERS.length - 1, newTier));
  return Math.round(PLANET_TIERS[tier].score * (1 + Math.min(8, Math.max(0, combo - 1)) * .18));
}

export function isDangerous(ball: Pick<PlanetBall,"y"|"radius"|"age"|"vy"|"alive">, warningY = WARNING_Y) {
  return ball.alive && ball.age > 1.05 && ball.y - ball.radius < warningY;
}

export function nextPlanetTier(random: () => number, maxTier: number, drops = 0): number {
  const upper = Math.min(5, Math.max(2, Math.floor(maxTier / 2) + 2));
  const lower = Math.min(3, Math.floor(drops / 42), upper);
  const roll = random();
  const weighted = lower + Math.floor(Math.pow(roll, .92) * (upper - lower + 1));
  return Math.max(lower, Math.min(upper, weighted));
}

export function nextDropKind(random: () => number, drops: number, maxTier: number): DropKind {
  if ((drops + 1) % 6 === 0) return "comet";
  return nextPlanetTier(random, maxTier, drops);
}

export function missionForTier(maxTier: number) {
  if (maxTier < 2) return MISSIONS[0];
  if (maxTier < 4) return MISSIONS[1];
  if (maxTier < 6) return MISSIONS[2];
  if (maxTier < 8) return MISSIONS[3];
  return MISSIONS[4];
}
