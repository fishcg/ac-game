import type { CelestialBody, MoonCourse, StarDust } from "./types";

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ mixed >>> 15, mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  };
}

export function createMoonCourse(seed = 4399): MoonCourse {
  const random = seededRandom(seed);
  const bodies: CelestialBody[] = [{ id: 1, x: 220, y: 205, radius: 43, kind: "moon", hue: 48 }];
  const stars: StarDust[] = [];
  let x = 220;
  let y = 205;
  let bodyId = 2;
  let starId = 1;
  for (let index = 1; index <= 21; index += 1) {
    const previousY = y;
    x += 190 + random() * 46;
    y = Math.max(105, Math.min(326, y + (random() - .5) * 176));
    const isGoal = index === 21;
    bodies.push({ id: bodyId++, x, y, radius: isGoal ? 62 : 30 + random() * 13, kind: isGoal ? "palace" : index % 4 === 0 ? "moon" : "planet", hue: (index * 47 + Math.round(random() * 42)) % 360 });
    const midpointX = x - 96;
    const midpointY = (previousY + y) / 2;
    for (let star = 0; star < 3; star += 1) stars.push({ id: starId++, x: midpointX - 30 + star * 31, y: midpointY + Math.sin(star * 2.1 + index) * 32, collected: false });
    if (index >= 4 && index % 3 === 1) {
      const hazardY = midpointY < 245 ? midpointY + 126 : midpointY - 126;
      bodies.push({ id: bodyId++, x: midpointX + 14, y: Math.max(72, Math.min(390, hazardY)), radius: 22 + random() * 8, kind: "hazard", hue: 8 });
    }
  }
  return { bodies, stars, goalX: x };
}

export const MOON_GRAVITY = 255;
export const GRAPPLE_RANGE = 310;
export const PLAYER_RADIUS = 13;
