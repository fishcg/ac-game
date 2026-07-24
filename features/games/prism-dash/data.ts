import type { DashObstacle, DashShard } from "./types";

export const DASH_WIDTH = 960;
export const DASH_HEIGHT = 540;
export const DASH_GROUND = 438;
export const DASH_LENGTH = 16_800;

const patterns = [
  ["spike"], ["spike", "spike"], ["block"], ["spike", "block"],
  ["pad", "spike"], ["block", "orb", "spike"], ["spike", "spike", "block"],
] as const;

export function createDashLevel() {
  const obstacles: DashObstacle[] = [];
  const shards: DashShard[] = [];
  let id = 1;
  for (let phrase = 0; phrase < 32; phrase += 1) {
    const baseX = 760 + phrase * 500;
    const pattern = patterns[phrase % patterns.length];
    pattern.forEach((type, index) => {
      const x = baseX + index * 86;
      if (type === "spike") obstacles.push({ id: id++, type, x, y: DASH_GROUND - 34, width: 36, height: 34 });
      if (type === "block") obstacles.push({ id: id++, type, x, y: DASH_GROUND - 58, width: 58, height: 58 });
      if (type === "pad") obstacles.push({ id: id++, type, x, y: DASH_GROUND - 9, width: 64, height: 9 });
      if (type === "orb") obstacles.push({ id: id++, type, x: x + 12, y: DASH_GROUND - 148, width: 34, height: 34 });
    });
    if (phrase % 2 === 0) shards.push({ id: phrase, x: baseX + 44, y: DASH_GROUND - (phrase % 4 === 0 ? 122 : 80) });
  }
  return { obstacles, shards };
}

export function getDashZone(progress: number) {
  if (progress < .34) return { name: "霓虹序章", colors: ["#07142f", "#112c61", "#42d9ff"] as const };
  if (progress < .67) return { name: "熔光回廊", colors: ["#271033", "#69264d", "#ff8061"] as const };
  return { name: "棱镜天际", colors: ["#170f3b", "#3131a0", "#b56cff"] as const };
}
