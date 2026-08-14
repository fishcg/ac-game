// @ts-expect-error Node 的内置 TypeScript 测试运行器需要显式扩展名。
import { ROAD_PATH } from "./data.ts";
import type { Enemy, EnemyType, Point, TowerBranch, TowerType } from "./types";

export function canAfford(food: number, cost: number) {
  return food >= cost && cost >= 0;
}

export function damageMultiplier(tower: TowerType, enemy: EnemyType, branch: TowerBranch | null = null) {
  if (tower === "archer" && enemy === "shield") return branch === "fire" ? .75 : .48;
  if (tower === "spear" && enemy === "cavalry") return branch === "phalanx" ? 2.15 : 1.7;
  if (tower === "catapult" && (enemy === "shield" || enemy === "siege")) return branch === "thunder" ? 1.85 : 1.45;
  if (branch === "fire" && (enemy === "siege" || enemy === "boss")) return 1.45;
  return 1;
}

export function pathLength(path: Point[] = ROAD_PATH) {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) total += Math.hypot(path[index].x - path[index - 1].x, path[index].y - path[index - 1].y);
  return total;
}

export function pointAtDistance(distance: number, path: Point[] = ROAD_PATH) {
  let remaining = Math.max(0, distance);
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1]; const to = path[index];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (remaining <= length) {
      const ratio = length === 0 ? 0 : remaining / length;
      return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio, angle: Math.atan2(to.y - from.y, to.x - from.x) };
    }
    remaining -= length;
  }
  const last = path[path.length - 1]; const previous = path[path.length - 2] ?? last;
  return { x: last.x, y: last.y, angle: Math.atan2(last.y - previous.y, last.x - previous.x) };
}

export function nearestRoadDistance(point: Point, path: Point[] = ROAD_PATH) {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < path.length; index += 1) {
    const a = path[index - 1]; const b = path[index]; const dx = b.x - a.x; const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    const ratio = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
    best = Math.min(best, Math.hypot(point.x - (a.x + dx * ratio), point.y - (a.y + dy * ratio)));
  }
  return best;
}

export function selectFrontEnemy(enemies: Enemy[], positions: Map<number, Point>, center: Point, range: number) {
  let selected: Enemy | null = null;
  for (const enemy of enemies) {
    if (enemy.dead) continue;
    const position = positions.get(enemy.id); if (!position) continue;
    if (Math.hypot(position.x - center.x, position.y - center.y) > range) continue;
    if (!selected || enemy.progress > selected.progress) selected = enemy;
  }
  return selected;
}

export function calculateScore(kills: number, food: number, castleHp: number, wave: number) {
  return Math.max(0, Math.round(kills * 28 + food * 2 + castleHp * 120 + wave * 300));
}

export function pickDecreeChoices(ids: readonly string[], owned: ReadonlySet<string>, seed: number, count = 3) {
  const available = ids.filter((id) => !owned.has(id));
  const result: string[] = [];
  let value = seed >>> 0;
  while (available.length > 0 && result.length < count) {
    value = (value * 1664525 + 1013904223) >>> 0;
    const index = value % available.length;
    result.push(available.splice(index, 1)[0]);
  }
  return result;
}
