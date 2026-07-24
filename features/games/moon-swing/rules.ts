import { GRAPPLE_RANGE } from "./data";
import type { CelestialBody } from "./types";

export function findGrappleTarget(x: number, y: number, bodies: CelestialBody[], excludedId: number | null) {
  let best: CelestialBody | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const body of bodies) {
    if (body.id === excludedId || body.kind === "hazard") continue;
    const dx = body.x - x;
    const dy = body.y - y;
    const distance = Math.hypot(dx, dy);
    if (distance > GRAPPLE_RANGE || dx < -55) continue;
    const score = distance + Math.max(0, -dx) * 3 - Math.max(0, dx) * .08;
    if (score < bestScore) { best = body; bestScore = score; }
  }
  return best;
}

export function grappleQuality(distance: number) {
  return Math.max(0, 1 - Math.abs(distance - 155) / 145);
}

export function grappleScore(quality: number, combo: number) {
  return Math.round(90 + quality * 110) * Math.max(1, combo);
}
