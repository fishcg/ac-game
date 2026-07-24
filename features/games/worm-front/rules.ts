import type { WeaponDefinition, WormTeam, WormUnit } from "./types";

export function explosionDamage(distance: number, weapon: Pick<WeaponDefinition,"damage"|"radius">) {
  if (distance >= weapon.radius) return 0;
  const ratio = 1 - distance / weapon.radius;
  return Math.max(1,Math.round(weapon.damage * (.22 + ratio * .78)));
}

export function projectilePoint(originX: number, originY: number, velocityX: number, velocityY: number, windAcceleration: number, gravity: number, time: number) {
  return { x: originX + velocityX * time + windAcceleration * time * time / 2, y: originY + velocityY * time + gravity * time * time / 2 };
}

export function chooseAiShot(shooter: Pick<WormUnit,"x"|"y">, target: Pick<WormUnit,"x"|"y">, windAcceleration: number, speedMin: number, speedMax: number) {
  let best = { angle: -Math.PI / 4, power: .65, error: Number.POSITIVE_INFINITY };
  const direction = target.x >= shooter.x ? 1 : -1;
  for (let angleStep = 18; angleStep <= 78; angleStep += 3) {
    const angle = direction > 0 ? -angleStep / 180 * Math.PI : Math.PI + angleStep / 180 * Math.PI;
    for (let powerStep = 4; powerStep <= 10; powerStep += 1) {
      const power = powerStep / 10;
      const speed = speedMin + (speedMax - speedMin) * power;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      for (let time = .25; time <= 4.2; time += .08) {
        const point = projectilePoint(shooter.x,shooter.y,vx,vy,windAcceleration,310,time);
        const error = Math.hypot(point.x-target.x,point.y-target.y);
        if (error < best.error) best = { angle, power, error };
        if (point.y > 560) break;
      }
    }
  }
  return best;
}

export function matchWinner(units: WormUnit[], maxTurnsReached = false): WormTeam | "draw" | null {
  const playerAlive = units.some((unit)=>unit.team==="player"&&unit.alive);
  const enemyAlive = units.some((unit)=>unit.team==="enemy"&&unit.alive);
  if (!playerAlive && !enemyAlive) return "draw";
  if (!playerAlive) return "enemy";
  if (!enemyAlive) return "player";
  if (!maxTurnsReached) return null;
  const playerHp = units.filter((unit)=>unit.team==="player"&&unit.alive).reduce((sum,unit)=>sum+unit.hp,0);
  const enemyHp = units.filter((unit)=>unit.team==="enemy"&&unit.alive).reduce((sum,unit)=>sum+unit.hp,0);
  return playerHp===enemyHp?"draw":playerHp>enemyHp?"player":"enemy";
}

export function finalBattleScore(units: WormUnit[], turns: number) {
  const playerHp=units.filter((unit)=>unit.team==="player"&&unit.alive).reduce((sum,unit)=>sum+unit.hp,0);
  const defeated=units.filter((unit)=>unit.team==="enemy"&&!unit.alive).length;
  return Math.max(0,defeated*1000+playerHp*12+Math.max(0,20-turns)*120);
}
