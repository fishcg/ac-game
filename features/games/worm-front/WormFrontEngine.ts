import { createWormVisualAssets, type WormVisualAssets } from "./assets";
import { MAX_TURNS, MOVE_FUEL, PLAYER_NAMES, ENEMY_NAMES, TURN_SECONDS, WEAPONS, createInventory } from "./data";
import { chooseAiShot, explosionDamage, finalBattleScore, matchWinner, projectilePoint } from "./rules";
import { playWormSound } from "./audio";
import { createWormMap, seededRandom, type WormMapLayout } from "./map";
import { paintMapFeatures } from "./mapArt";
import type { Projectile, WeaponId, WeaponInventory, WormCallbacks, WormGameStatus, WormHud, WormTeam, WormUnit } from "./types";

const WIDTH = 960;
const HEIGHT = 540;
const GRAVITY = 310;
const WORM_RADIUS = 14;
const MAX_PARTICLES = 96;
const MAX_LABELS = 18;

type ParticleKind = "fire" | "smoke" | "dirt" | "spark";
type Particle = { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; rotation: number; spin: number; kind: ParticleKind; color: string };
type DamageLabel = { x: number; y: number; value: string; age: number; color: string };
type AirstrikeDrop = { x: number; delay: number; ownerId: number };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export class WormFrontEngine {
  private context: CanvasRenderingContext2D;
  private terrainCanvas = document.createElement("canvas");
  private backgroundCanvas = document.createElement("canvas");
  private terrainContext: CanvasRenderingContext2D;
  private backgroundContext: CanvasRenderingContext2D;
  private terrainMask = new Uint8Array(WIDTH * HEIGHT);
  private surface = new Int16Array(WIDTH);
  private assets: WormVisualAssets;
  private units: WormUnit[] = [];
  private projectiles: Projectile[] = [];
  private particles: Particle[] = [];
  private labels: DamageLabel[] = [];
  private airstrikeDrops: AirstrikeDrop[] = [];
  private inventory: WeaponInventory = createInventory();
  private enemyInventory: WeaponInventory = createInventory();
  private status: WormGameStatus = "idle";
  private phase: WormHud["phase"] = "intro";
  private activeTeam: WormTeam = "player";
  private activeUnitId = -1;
  private teamCursor: Record<WormTeam, number> = { player: -1, enemy: -1 };
  private turn = 1;
  private turnTime = TURN_SECONDS;
  private wind = 0;
  private power = 0.38;
  private powerDirection = 1;
  private charging = false;
  private selectedWeapon: WeaponId = "bazooka";
  private moveIntent: -1 | 0 | 1 = 0;
  private aimX = WIDTH * 0.5;
  private aimY = HEIGHT * 0.4;
  private phaseTimer = 0;
  private aiTimer = 0;
  private score = 0;
  private notice = "准备战斗";
  private animation = 0;
  private lastTime = 0;
  private lastHud = 0;
  private projectileId = 1;
  private shake = 0;
  private seed = 1;
  private random = seededRandom(1);
  private mapLayout: WormMapLayout = createWormMap(1);

  constructor(private canvas: HTMLCanvasElement, private callbacks: WormCallbacks) {
    this.context = canvas.getContext("2d")!;
    this.terrainCanvas.width = WIDTH;
    this.terrainCanvas.height = HEIGHT;
    this.backgroundCanvas.width = WIDTH;
    this.backgroundCanvas.height = HEIGHT;
    this.terrainContext = this.terrainCanvas.getContext("2d")!;
    this.backgroundContext = this.backgroundCanvas.getContext("2d")!;
    this.assets = createWormVisualAssets(() => this.draw());
    this.resize();
    this.buildBackground();
    this.buildTerrain();
    this.draw();
  }

  resize() {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = WIDTH * ratio;
    this.canvas.height = HEIGHT * ratio;
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.draw();
  }

  start(seed = Math.floor(performance.now())) {
    this.seed = seed;
    this.random = seededRandom(seed);
    this.mapLayout = createWormMap(seed);
    this.buildBackground();
    this.buildTerrain();
    this.units = this.createUnits();
    this.projectiles = [];
    this.particles = [];
    this.labels = [];
    this.airstrikeDrops = [];
    this.inventory = createInventory();
    this.enemyInventory = createInventory();
    this.status = "playing";
    this.phase = "intro";
    this.activeTeam = "player";
    this.teamCursor = { player: -1, enemy: -1 };
    this.turn = 1;
    this.turnTime = TURN_SECONDS;
    this.wind = this.rollWind();
    this.power = 0.38;
    this.charging = false;
    this.moveIntent = 0;
    this.score = 0;
    this.notice = `${this.mapLayout.theme.name} · 青团小队先手，注意利用建筑掩体！`;
    this.selectNextUnit("player");
    this.phaseTimer = 1.15;
    this.lastTime = performance.now();
    cancelAnimationFrame(this.animation);
    this.animation = requestAnimationFrame(this.tick);
    playWormSound("start");
    this.callbacks.onStatus("playing", 0, "");
    this.emitHud(true);
  }

  destroy() {
    cancelAnimationFrame(this.animation);
    this.projectiles.length = 0;
    this.particles.length = 0;
    this.labels.length = 0;
    this.airstrikeDrops.length = 0;
  }

  togglePause() {
    if (this.status === "playing") {
      this.status = "paused";
      this.moveIntent = 0;
      this.charging = false;
      this.callbacks.onStatus("paused", this.score, "战场已经冻结");
      this.emitHud(true);
      this.draw();
    } else if (this.status === "paused") {
      this.status = "playing";
      this.lastTime = performance.now();
      this.callbacks.onStatus("playing", this.score, "");
      this.emitHud(true);
      this.animation = requestAnimationFrame(this.tick);
    }
  }

  setMove(direction: -1 | 0 | 1) {
    this.moveIntent = this.canPlayerAct() ? direction : 0;
  }

  jump() {
    const unit = this.activeUnit();
    if (!unit || !this.canPlayerAct() || !unit.grounded || unit.moveFuel < 15) return;
    unit.vy = -178;
    unit.grounded = false;
    unit.moveFuel -= 15;
    playWormSound("jump");
    this.emitHud(true);
  }

  aimAt(x: number, y: number) {
    this.aimX = clamp(x, 24, WIDTH - 24);
    this.aimY = clamp(y, 42, HEIGHT - 40);
    const unit = this.activeUnit();
    if (!unit || !this.canPlayerAct()) return;
    const dx = this.aimX - unit.x;
    const dy = this.aimY - unit.y;
    unit.facing = dx >= 0 ? 1 : -1;
    const raw = Math.atan2(dy, dx);
    if (unit.facing === 1) unit.angle = clamp(raw, -1.42, -0.16);
    else unit.angle = clamp(raw, -Math.PI + 0.16, -1.72);
    this.emitHud(false);
  }

  adjustAim(direction: -1 | 1) {
    const unit = this.activeUnit();
    if (!unit || !this.canPlayerAct()) return;
    const elevation = unit.facing === 1 ? -unit.angle : unit.angle + Math.PI;
    const next = clamp(elevation + direction * 0.055, 0.16, 1.42);
    unit.angle = unit.facing === 1 ? -next : -Math.PI + next;
    this.emitHud(false);
  }

  selectWeapon(weapon: WeaponId) {
    if (!this.canPlayerAct() || (this.inventory[weapon] === 0)) return;
    this.selectedWeapon = weapon;
    this.notice = WEAPONS[weapon].description;
    playWormSound("turn");
    this.emitHud(true);
  }

  beginCharge() {
    if (!this.canPlayerAct() || this.charging) return;
    if (this.inventory[this.selectedWeapon] === 0) return;
    this.charging = true;
    this.power = this.selectedWeapon === "airstrike" ? 1 : Math.max(0.28, this.power);
    this.powerDirection = 1;
    playWormSound("charge");
    this.emitHud(true);
  }

  releaseCharge() {
    if (!this.canPlayerAct() || !this.charging) return;
    this.charging = false;
    const unit = this.activeUnit();
    if (!unit) return;
    if (this.selectedWeapon === "airstrike") this.launchAirstrike(unit, this.aimX);
    else this.launchWeapon(unit, this.selectedWeapon, this.power);
  }

  private tick = (time: number) => {
    const delta = Math.min(0.032, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    if (this.status === "playing") this.update(delta);
    this.draw();
    if (this.status === "playing") this.animation = requestAnimationFrame(this.tick);
  };

  private update(delta: number) {
    if (this.charging) {
      this.power += this.powerDirection * delta * 0.72;
      if (this.power >= 1) { this.power = 1; this.powerDirection = -1; }
      if (this.power <= 0.28) { this.power = 0.28; this.powerDirection = 1; }
    }

    if (this.phase === "intro") {
      this.phaseTimer -= delta;
      if (this.phaseTimer <= 0) this.beginAimPhase();
    } else if (this.phase === "aiming" || this.phase === "ai-thinking") {
      this.turnTime = Math.max(0, this.turnTime - delta);
      if (this.phase === "aiming") this.updatePlayerMovement(delta);
      else {
        this.aiTimer -= delta;
        if (this.aiTimer <= 0) this.fireAiShot();
      }
      if (this.turnTime <= 0 && (this.phase === "aiming" || this.phase === "ai-thinking")) this.skipShot("回合时间耗尽");
    } else if (this.phase === "projectile") {
      this.updateProjectiles(delta);
      this.updateAirstrike(delta);
      if (!this.projectiles.length && !this.airstrikeDrops.length) {
        this.phase = "settling";
        this.phaseTimer = 1.2;
        this.notice = "尘埃落定……";
      }
    } else if (this.phase === "settling") {
      this.phaseTimer -= delta;
      if (this.phaseTimer <= 0 && this.units.every((unit) => !unit.alive || Math.abs(unit.vy) < 5)) this.finishTurn();
    }

    for (const unit of this.units) this.updateUnitPhysics(unit, delta);
    this.updateParticles(delta);
    this.updateLabels(delta);
    this.shake = Math.max(0, this.shake - delta * 18);
    this.emitHud(false);
  }

  private beginAimPhase() {
    this.turnTime = TURN_SECONDS;
    this.power = 0.38;
    this.charging = false;
    const unit = this.activeUnit();
    if (!unit) return;
    unit.moveFuel = MOVE_FUEL;
    if (this.activeTeam === "player") {
      this.phase = "aiming";
      this.notice = `${unit.name} 的回合 · 移动、瞄准后蓄力发射`;
    } else {
      this.phase = "ai-thinking";
      this.aiTimer = 0.34 + this.random() * 0.46;
      this.notice = `${unit.name} 正在测算风向……`;
    }
    playWormSound("turn");
    this.emitHud(true);
  }

  private updatePlayerMovement(delta: number) {
    const unit = this.activeUnit();
    if (!unit || !this.moveIntent || unit.moveFuel <= 0) return;
    const speed = 62;
    const distance = Math.min(unit.moveFuel, speed * delta);
    const direction = this.moveIntent;
    unit.facing = direction;
    const elevation = unit.facing === 1 ? clamp(-unit.angle, 0.16, 1.42) : clamp(unit.angle + Math.PI, 0.16, 1.42);
    unit.angle = direction === 1 ? -elevation : -Math.PI + elevation;
    const moved = this.moveUnitHorizontal(unit, direction * distance);
    if (moved > 0) unit.moveFuel = Math.max(0, unit.moveFuel - moved);
  }

  private moveUnitHorizontal(unit: WormUnit, amount: number) {
    const targetX = clamp(unit.x + amount, WORM_RADIUS + 2, WIDTH - WORM_RADIUS - 2);
    if (!this.collidesCircle(targetX, unit.y, WORM_RADIUS - 2)) { unit.x = targetX; return Math.abs(amount); }
    for (let rise = 1; rise <= 8; rise += 1) {
      if (!this.collidesCircle(targetX, unit.y - rise, WORM_RADIUS - 2)) { unit.x = targetX; unit.y -= rise; return Math.abs(amount); }
    }
    return 0;
  }

  private updateUnitPhysics(unit: WormUnit, delta: number) {
    if (!unit.alive) return;
    unit.hurtFlash = Math.max(0, unit.hurtFlash - delta);
    unit.vy += GRAVITY * delta;
    if (Math.abs(unit.vx) > 0.2) {
      this.moveUnitHorizontal(unit, unit.vx * delta);
      unit.vx *= Math.pow(0.12, delta);
    } else unit.vx = 0;
    const distance = unit.vy * delta;
    const steps = Math.max(1, Math.ceil(Math.abs(distance) / 3));
    const step = distance / steps;
    unit.grounded = false;
    for (let index = 0; index < steps; index += 1) {
      const nextY = unit.y + step;
      if (this.collidesCircle(unit.x, nextY, WORM_RADIUS - 2)) {
        if (unit.vy > 0) unit.grounded = true;
        unit.vy = 0;
        break;
      }
      unit.y = nextY;
    }
    if (!unit.grounded && this.isSolid(unit.x, unit.y + WORM_RADIUS + 1)) unit.grounded = true;
    if (unit.y > HEIGHT + 45 || unit.x < -20 || unit.x > WIDTH + 20) this.killUnit(unit, "落入深谷");
  }

  private launchWeapon(unit: WormUnit, weaponId: WeaponId, power: number) {
    const definition = WEAPONS[weaponId];
    const inventory = unit.team === "player" ? this.inventory : this.enemyInventory;
    if (inventory[weaponId] === 0) return;
    if (inventory[weaponId] > 0) inventory[weaponId] -= 1;
    const speed = definition.speedMin + (definition.speedMax - definition.speedMin) * power;
    const x = unit.x + Math.cos(unit.angle) * 23;
    const y = unit.y + Math.sin(unit.angle) * 23;
    this.projectiles.push({ id: this.projectileId++, weapon: weaponId, ownerId: unit.id, x, y, vx: Math.cos(unit.angle) * speed, vy: Math.sin(unit.angle) * speed, age: 0, fuse: definition.fuse, bounces: 0, radius: weaponId === "bazooka" ? 5 : 7 });
    this.phase = "projectile";
    this.notice = `${unit.name} 发射了${definition.name}`;
    playWormSound("fire");
    this.spawnParticles(x, y, "smoke", 7, "#e6d2b3", 35);
    this.emitHud(true);
  }

  private launchAirstrike(unit: WormUnit, targetX: number) {
    const inventory = unit.team === "player" ? this.inventory : this.enemyInventory;
    if (inventory.airstrike === 0) return;
    if (inventory.airstrike > 0) inventory.airstrike -= 1;
    this.airstrikeDrops = [-64, -32, 0, 32, 64].map((offset, index) => ({ x: clamp(targetX + offset, 20, WIDTH - 20), delay: 0.16 * index, ownerId: unit.id }));
    this.phase = "projectile";
    this.notice = "蒲公英空袭正在接近目标区";
    playWormSound("fire");
    this.emitHud(true);
  }

  private updateAirstrike(delta: number) {
    if (!this.airstrikeDrops.length) return;
    const pending: AirstrikeDrop[] = [];
    for (const drop of this.airstrikeDrops) {
      drop.delay -= delta;
      if (drop.delay <= 0) {
        this.projectiles.push({ id: this.projectileId++, weapon: "bomb", ownerId: drop.ownerId, x: drop.x, y: -18, vx: this.wind * 1.4, vy: 88, age: 0, fuse: 0, bounces: 0, radius: 6 });
      } else pending.push(drop);
    }
    this.airstrikeDrops = pending;
  }

  private updateProjectiles(delta: number) {
    const next: Projectile[] = [];
    const additions: Projectile[] = [];
    for (const projectile of this.projectiles) {
      const previousX = projectile.x;
      const previousY = projectile.y;
      projectile.age += delta;
      projectile.vx += this.wind * 3.4 * delta;
      projectile.vy += GRAVITY * delta;
      projectile.x += projectile.vx * delta;
      projectile.y += projectile.vy * delta;
      const hitUnit = projectile.age > 0.2 ? this.units.find((unit) => unit.alive && unit.id !== projectile.ownerId && Math.hypot(unit.x - projectile.x, unit.y - projectile.y) < WORM_RADIUS + projectile.radius) : undefined;
      const hitTerrain = this.isSolid(projectile.x, projectile.y);
      const out = projectile.x < -90 || projectile.x > WIDTH + 90 || projectile.y > HEIGHT + 90;

      if (projectile.weapon === "cluster" && projectile.age >= projectile.fuse) {
        for (let index = 0; index < 5; index += 1) {
          const angle = -Math.PI + (index + 1) * Math.PI / 6;
          additions.push({ id: this.projectileId++, weapon: "shard", ownerId: projectile.ownerId, x: projectile.x, y: projectile.y, vx: Math.cos(angle) * (105 + index * 7), vy: Math.sin(angle) * 145 - 28, age: 0, fuse: 0, bounces: 0, radius: 4 });
        }
        this.spawnParticles(projectile.x, projectile.y, "spark", 13, "#ffea85", 80);
        playWormSound("bounce");
        continue;
      }

      if (projectile.weapon === "grenade") {
        if (projectile.age >= projectile.fuse) { this.explode(projectile.x, projectile.y, "grenade", projectile.ownerId); continue; }
        if (hitTerrain || hitUnit) {
          projectile.x = previousX;
          projectile.y = previousY - 2;
          projectile.vx *= 0.68;
          projectile.vy = -Math.max(48, Math.abs(projectile.vy) * 0.58);
          projectile.bounces += 1;
          if (projectile.bounces > 4) { projectile.vx *= 0.35; projectile.vy = -24; }
          playWormSound("bounce");
        }
        if (!out) next.push(projectile);
        continue;
      }

      if (hitTerrain || hitUnit) {
        const weapon = projectile.weapon === "shard" ? "cluster" : projectile.weapon === "bomb" ? "airstrike" : projectile.weapon;
        this.explode(projectile.x, projectile.y, weapon, projectile.ownerId);
        continue;
      }
      if (!out) {
        if (projectile.weapon === "bazooka") this.spawnParticles(projectile.x, projectile.y, "smoke", 1, "#f5e5ca", 18);
        next.push(projectile);
      }
    }
    this.projectiles = next.concat(additions);
  }

  private explode(x: number, y: number, weaponId: WeaponId, ownerId: number) {
    const definition = WEAPONS[weaponId];
    this.carveTerrain(x, y, definition.terrainRadius);
    let damaged = 0;
    for (const unit of this.units) {
      if (!unit.alive) continue;
      const distance = Math.hypot(unit.x - x, unit.y - y);
      const damage = explosionDamage(distance, definition);
      if (!damage) continue;
      damaged += 1;
      unit.hp = Math.max(0, unit.hp - damage);
      unit.hurtFlash = 0.24;
      const force = (1 - Math.min(1, distance / definition.radius)) * 215 + 36;
      const nx = (unit.x - x) / Math.max(1, distance);
      const ny = (unit.y - y) / Math.max(1, distance);
      unit.vx += nx * force;
      unit.vy += ny * force - 92;
      this.addLabel(unit.x, unit.y - 22, `-${damage}`, unit.team === "player" ? "#b9f5ff" : "#ffd1c7");
      if (unit.hp <= 0) this.killUnit(unit, "被炸出了战场");
      if (this.units.find((candidate) => candidate.id === ownerId)?.team === "player" && unit.team === "enemy") this.score += damage * 12 + (unit.hp <= 0 ? 650 : 0);
    }
    this.spawnExplosionParticles(x, y, definition.radius);
    this.shake = Math.min(10, 5 + definition.radius * 0.07);
    this.notice = damaged ? `爆炸命中 ${damaged} 名虫兵！` : "地形被炸开了";
    playWormSound("explode");
    if (damaged) playWormSound("hurt");
  }

  private carveTerrain(x: number, y: number, radius: number) {
    const minX = Math.max(0, Math.floor(x - radius));
    const maxX = Math.min(WIDTH - 1, Math.ceil(x + radius));
    const minY = Math.max(0, Math.floor(y - radius));
    const maxY = Math.min(HEIGHT - 1, Math.ceil(y + radius));
    const radiusSquared = radius * radius;
    for (let pixelY = minY; pixelY <= maxY; pixelY += 1) {
      for (let pixelX = minX; pixelX <= maxX; pixelX += 1) {
        const dx = pixelX - x;
        const dy = pixelY - y;
        if (dx * dx + dy * dy <= radiusSquared) this.terrainMask[pixelY * WIDTH + pixelX] = 0;
      }
    }
    this.terrainContext.save();
    this.terrainContext.globalCompositeOperation = "destination-out";
    const gradient = this.terrainContext.createRadialGradient(x, y, radius * 0.72, x, y, radius);
    gradient.addColorStop(0, "rgba(0,0,0,1)");
    gradient.addColorStop(1, "rgba(0,0,0,.96)");
    this.terrainContext.fillStyle = gradient;
    this.terrainContext.beginPath();
    this.terrainContext.arc(x, y, radius, 0, Math.PI * 2);
    this.terrainContext.fill();
    this.terrainContext.restore();
  }

  private finishTurn() {
    const winner = matchWinner(this.units, this.turn >= MAX_TURNS);
    if (winner) { this.finishMatch(winner); return; }
    this.turn += 1;
    this.activeTeam = this.activeTeam === "player" ? "enemy" : "player";
    this.selectNextUnit(this.activeTeam);
    this.wind = this.rollWind();
    this.phase = "intro";
    this.phaseTimer = 0.9;
    const unit = this.activeUnit();
    this.notice = unit ? `${unit.name} 接过了回合` : "切换回合";
    this.emitHud(true);
  }

  private skipShot(reason: string) {
    this.charging = false;
    this.moveIntent = 0;
    this.phase = "settling";
    this.phaseTimer = 0.7;
    this.notice = reason;
    playWormSound("miss");
    this.emitHud(true);
  }

  private finishMatch(winner: WormTeam | "draw") {
    const won = winner === "player";
    this.score = won ? this.score + finalBattleScore(this.units, this.turn) : Math.max(0, this.score);
    this.status = won ? "won" : "lost";
    this.phase = "settling";
    this.notice = winner === "draw" ? "双方战成平局" : won ? "青团小队守住了荒丘！" : "红椒军团占领了荒丘";
    this.callbacks.onStatus(this.status, this.score, this.notice);
    playWormSound(won ? "win" : "lose");
    this.emitHud(true);
  }

  private fireAiShot() {
    const shooter = this.activeUnit();
    if (!shooter || shooter.team !== "enemy") return;
    const targets = this.units.filter((unit) => unit.alive && unit.team === "player");
    const target = targets.sort((left, right) => Math.hypot(left.x - shooter.x, left.y - shooter.y) - Math.hypot(right.x - shooter.x, right.y - shooter.y))[0];
    if (!target) { this.finishMatch("enemy"); return; }
    const roll = this.random();
    const weapon: WeaponId = roll < 0.16 && this.enemyInventory.grenade > 0 ? "grenade" : roll < 0.22 && this.enemyInventory.cluster > 0 ? "cluster" : "bazooka";
    const definition = WEAPONS[weapon];
    const shot = chooseAiShot(shooter, target, this.wind * 3.4, definition.speedMin, definition.speedMax);
    const difficultyError = this.turn < 6 ? 0.085 : 0.05;
    shooter.angle = shot.angle + (this.random() - 0.5) * difficultyError * 2;
    if (shooter.angle > Math.PI) shooter.angle -= Math.PI * 2;
    shooter.facing = target.x >= shooter.x ? 1 : -1;
    this.power = clamp(shot.power + (this.random() - 0.5) * 0.08, 0.3, 1);
    this.launchWeapon(shooter, weapon, this.power);
  }

  private selectNextUnit(team: WormTeam) {
    const teamUnits = this.units.filter((unit) => unit.team === team);
    for (let offset = 1; offset <= teamUnits.length; offset += 1) {
      const index = (this.teamCursor[team] + offset) % teamUnits.length;
      if (teamUnits[index].alive) {
        this.teamCursor[team] = index;
        this.activeUnitId = teamUnits[index].id;
        return;
      }
    }
    this.activeUnitId = -1;
  }

  private activeUnit() {
    return this.units.find((unit) => unit.id === this.activeUnitId && unit.alive);
  }

  private canPlayerAct() {
    return this.status === "playing" && this.phase === "aiming" && this.activeTeam === "player";
  }

  private killUnit(unit: WormUnit, reason: string) {
    if (!unit.alive) return;
    unit.alive = false;
    unit.hp = 0;
    unit.vx = 0;
    unit.vy = 0;
    this.addLabel(unit.x, unit.y - 25, reason, "#fff1a8");
    this.spawnParticles(unit.x, unit.y, "smoke", 10, "#65556b", 45);
  }

  private createUnits() {
    const playerX = [118, 302, 452];
    const enemyX = [842, 680, 548];
    const create = (team: WormTeam, name: string, x: number, id: number): WormUnit => ({
      id, team, name, x, y: this.findSurface(x) - WORM_RADIUS - 1, vx: 0, vy: 0, hp: 100, alive: true, grounded: true,
      facing: team === "player" ? 1 : -1, angle: team === "player" ? -0.72 : -Math.PI + 0.72, moveFuel: MOVE_FUEL, hurtFlash: 0,
    });
    return [
      ...PLAYER_NAMES.map((name, index) => create("player", name, playerX[index], index + 1)),
      ...ENEMY_NAMES.map((name, index) => create("enemy", name, enemyX[index], index + 4)),
    ];
  }

  private rollWind() {
    return Math.round((this.random() * 2 - 1) * 9);
  }

  private findSurface(x: number) {
    for (let y = 100; y < HEIGHT; y += 1) if (this.isSolid(x, y)) return y;
    return HEIGHT - 20;
  }

  private isSolid(x: number, y: number) {
    const pixelX = Math.floor(x);
    const pixelY = Math.floor(y);
    if (pixelX < 0 || pixelX >= WIDTH || pixelY < 0 || pixelY >= HEIGHT) return false;
    return this.terrainMask[pixelY * WIDTH + pixelX] === 1;
  }

  private collidesCircle(x: number, y: number, radius: number) {
    if (this.isSolid(x, y)) return true;
    for (let index = 0; index < 12; index += 1) {
      const angle = index / 12 * Math.PI * 2;
      if (this.isSolid(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)) return true;
    }
    return false;
  }

  private buildTerrain() {
    const random = seededRandom(this.seed ^ 0x51a3);
    const palette = this.mapLayout.theme.palette;
    this.terrainMask.fill(0);
    this.surface.set(this.mapLayout.surface);
    for (let x = 0; x < WIDTH; x += 1) {
      for (let pixelY = this.surface[x]; pixelY < HEIGHT; pixelY += 1) this.terrainMask[pixelY * WIDTH + x] = 1;
    }
    const image = this.terrainContext.createImageData(WIDTH, HEIGHT);
    const data = image.data;
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        if (!this.terrainMask[y * WIDTH + x]) continue;
        const depth = clamp((y - this.surface[x]) / 220, 0, 1);
        const noise = (random() - 0.5) * 16;
        const index = (y * WIDTH + x) * 4;
        data[index] = palette.dirt[0] - depth * 31 + noise;
        data[index + 1] = palette.dirt[1] - depth * 24 + noise * 0.55;
        data[index + 2] = palette.dirt[2] - depth * 12 + noise * 0.35;
        data[index + 3] = 255;
      }
    }
    this.terrainContext.clearRect(0, 0, WIDTH, HEIGHT);
    this.terrainContext.putImageData(image, 0, 0);
    this.terrainContext.lineWidth = 8;
    this.terrainContext.strokeStyle = palette.grassDark;
    this.terrainContext.beginPath();
    this.terrainContext.moveTo(0, this.surface[0]);
    for (let x = 1; x < WIDTH; x += 2) this.terrainContext.lineTo(x, this.surface[x]);
    this.terrainContext.stroke();
    this.terrainContext.lineWidth = 3;
    this.terrainContext.strokeStyle = palette.grassLight;
    this.terrainContext.stroke();
    for (let index = 0; index < 110; index += 1) {
      const x = random() * WIDTH;
      const y = this.surface[Math.floor(x)] + 14 + random() * 180;
      this.terrainContext.fillStyle = random() > 0.45 ? "#4e3529" : "#9b6740";
      this.terrainContext.globalAlpha = 0.25 + random() * 0.2;
      this.terrainContext.beginPath();
      this.terrainContext.ellipse(x, y, 2 + random() * 5, 1 + random() * 3, random() * Math.PI, 0, Math.PI * 2);
      this.terrainContext.fill();
    }
    this.terrainContext.globalAlpha = 1;
    paintMapFeatures(this.terrainContext, this.terrainMask, WIDTH, HEIGHT, this.mapLayout);
  }

  private buildBackground() {
    const ctx = this.backgroundContext;
    const palette = this.mapLayout.theme.palette;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, palette.skyTop);
    sky.addColorStop(0.48, palette.skyMiddle);
    sky.addColorStop(1, palette.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const sun = ctx.createRadialGradient(760, 102, 8, 760, 102, 72);
    sun.addColorStop(0, "#fff8c9");
    sun.addColorStop(0.28, "#f8d879");
    sun.addColorStop(1, "rgba(248,216,121,0)");
    ctx.fillStyle = sun;
    ctx.fillRect(680, 22, 160, 160);
    this.drawCloud(ctx, 150, 85, 1.15);
    this.drawCloud(ctx, 470, 130, 0.72);
    this.drawCloud(ctx, 840, 62, 0.62);
    this.drawMountainLayer(ctx, 250, palette.mountainFar, 75, 0.017);
    this.drawMountainLayer(ctx, 292, palette.mountainNear, 58, 0.023);
    ctx.fillStyle = palette.ridge;
    ctx.beginPath();
    ctx.moveTo(0, 350);
    for (let x = 0; x <= WIDTH; x += 24) ctx.lineTo(x, 337 + Math.sin(x * 0.057) * 14);
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.lineTo(0, HEIGHT);
    ctx.fill();
    for (const [x, y, scale] of [[52, 300, 0.8], [210, 277, 1.05], [755, 284, 0.9], [902, 313, 0.7]] as Array<[number, number, number]>) this.drawPine(ctx, x, y, scale);
    const vignette = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 170, WIDTH / 2, HEIGHT / 2, 620);
    vignette.addColorStop(0, "rgba(255,255,255,0)");
    vignette.addColorStop(1, "rgba(27,39,45,.28)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  private drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(255,250,226,.63)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 42, 15, 0, 0, Math.PI * 2);
    ctx.ellipse(-26, 3, 28, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(24, 5, 32, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(3, -12, 27, 21, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawMountainLayer(ctx: CanvasRenderingContext2D, baseline: number, color: string, amplitude: number, frequency: number) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, baseline);
    for (let x = 0; x <= WIDTH; x += 10) ctx.lineTo(x, baseline - Math.abs(Math.sin(x * frequency + 0.7)) * amplitude - Math.sin(x * 0.006) * 24);
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.lineTo(0, HEIGHT);
    ctx.fill();
  }

  private drawPine(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#3c5547";
    ctx.fillRect(-4, 0, 8, 42);
    ctx.fillStyle = "#294a3b";
    for (let index = 0; index < 3; index += 1) {
      ctx.beginPath();
      ctx.moveTo(0, -42 + index * 17);
      ctx.lineTo(-24 + index * 2, 14 + index * 9);
      ctx.lineTo(24 - index * 2, 14 + index * 9);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private spawnExplosionParticles(x: number, y: number, radius: number) {
    this.spawnParticles(x, y, "fire", 13, "#ffb447", radius * 1.3);
    this.spawnParticles(x, y, "smoke", 10, "#554a4a", radius * 0.85);
    this.spawnParticles(x, y, "dirt", 12, "#8f5d36", radius * 1.55);
    this.spawnParticles(x, y, "spark", 8, "#ffe59a", radius * 1.7);
  }

  private spawnParticles(x: number, y: number, kind: ParticleKind, count: number, color: string, speed: number) {
    for (let index = 0; index < count && this.particles.length < MAX_PARTICLES; index += 1) {
      const angle = this.random() * Math.PI * 2;
      const velocity = speed * (0.35 + this.random() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity - (kind === "dirt" ? 35 : 0), age: 0, life: 0.48 + this.random() * 0.52, size: 7 + this.random() * 14, rotation: this.random() * Math.PI * 2, spin: (this.random() - 0.5) * 8, kind, color });
    }
  }

  private updateParticles(delta: number) {
    let write = 0;
    for (let read = 0; read < this.particles.length; read += 1) {
      const particle = this.particles[read];
      particle.age += delta;
      if (particle.age >= particle.life) continue;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vx *= Math.pow(0.28, delta);
      particle.vy += (particle.kind === "dirt" ? GRAVITY * 0.48 : -10) * delta;
      particle.rotation += particle.spin * delta;
      this.particles[write++] = particle;
    }
    this.particles.length = write;
  }

  private addLabel(x: number, y: number, value: string, color: string) {
    if (this.labels.length >= MAX_LABELS) this.labels.shift();
    this.labels.push({ x, y, value, age: 0, color });
  }

  private updateLabels(delta: number) {
    let write = 0;
    for (let read = 0; read < this.labels.length; read += 1) {
      const label = this.labels[read];
      label.age += delta;
      label.y -= delta * 25;
      if (label.age < 1.05) this.labels[write++] = label;
    }
    this.labels.length = write;
  }

  private emitHud(force: boolean) {
    const now = performance.now();
    if (!force && now - this.lastHud < 90) return;
    this.lastHud = now;
    const active = this.activeUnit();
    const sumHealth = (team: WormTeam) => this.units.filter((unit) => unit.team === team && unit.alive).reduce((sum, unit) => sum + unit.hp, 0);
    const inventory = { ...this.inventory };
    this.callbacks.onHud({
      status: this.status, phase: this.phase, activeTeam: this.activeTeam, activeName: active?.name ?? "—", turn: this.turn,
      turnTime: this.turnTime, wind: this.wind, power: this.power, charging: this.charging, selectedWeapon: this.selectedWeapon, inventory,
      playerHealth: sumHealth("player"), enemyHealth: sumHealth("enemy"), playerAlive: this.units.filter((unit) => unit.team === "player" && unit.alive).length,
      enemyAlive: this.units.filter((unit) => unit.team === "enemy" && unit.alive).length, moveFuel: active?.moveFuel ?? 0, score: this.score,
      aimDegrees: active ? Math.round((active.facing === 1 ? -active.angle : active.angle + Math.PI) * 180 / Math.PI) : 0,
      mapName: this.mapLayout.theme.name, notice: this.notice,
    });
  }

  private draw() {
    const ctx = this.context;
    ctx.save();
    const shakeX = this.shake ? (this.random() - 0.5) * this.shake : 0;
    const shakeY = this.shake ? (this.random() - 0.5) * this.shake : 0;
    ctx.translate(shakeX, shakeY);
    ctx.drawImage(this.backgroundCanvas, 0, 0);
    this.drawWindWisps(ctx);
    ctx.drawImage(this.terrainCanvas, 0, 0);
    this.drawTerrainDetails(ctx);
    if (this.status !== "idle") {
      this.drawAimGuide(ctx);
      this.drawUnits(ctx);
      this.drawProjectiles(ctx);
      this.drawParticles(ctx);
      this.drawLabels(ctx);
    }
    ctx.restore();
  }

  private drawWindWisps(ctx: CanvasRenderingContext2D) {
    if (!this.wind || this.status === "idle") return;
    const time = performance.now() * 0.025 * Math.sign(this.wind);
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "#effff8";
    ctx.lineWidth = 1.5;
    for (let index = 0; index < 5; index += 1) {
      const x = ((time + index * 211) % 1100 + 1100) % 1100 - 70;
      const y = 120 + index * 31;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + this.wind * 3, y - 5, x + this.wind * 8, y + 5, x + this.wind * 12, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawTerrainDetails(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const decoration of this.mapLayout.decorations) {
      const x = Math.round(decoration.x);
      const y = this.surface[x] - 3;
      if (!this.isSolid(x, y + 5)) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(decoration.scale, decoration.scale);
      if (decoration.kind === "flower") {
        ctx.strokeStyle = "#48643c"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(2, -13); ctx.stroke();
        ctx.fillStyle = decoration.color; ctx.beginPath(); ctx.arc(2, -15, 4, 0, Math.PI * 2); ctx.fill();
      } else if (decoration.kind === "grass") {
        ctx.strokeStyle = "#426440"; ctx.lineWidth = 2;
        for (let blade = -1; blade <= 1; blade += 1) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(blade * 4, -8, blade * 6, -13); ctx.stroke(); }
      } else if (decoration.kind === "rock") {
        ctx.fillStyle = "#6f6a61"; ctx.strokeStyle = "#4a4844"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-5, -8); ctx.lineTo(3, -11); ctx.lineTo(9, -3); ctx.lineTo(8, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else {
        ctx.strokeStyle = "#4c372d"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, -20); ctx.stroke();
        ctx.fillStyle = "#a57545"; ctx.strokeStyle = "#4c372d"; ctx.lineWidth = 2; ctx.fillRect(-11, -25, 22, 10); ctx.strokeRect(-11, -25, 22, 10);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  private drawAimGuide(ctx: CanvasRenderingContext2D) {
    const unit = this.activeUnit();
    if (!unit || (this.phase !== "aiming" && this.phase !== "ai-thinking")) return;
    if (this.selectedWeapon === "airstrike" && this.activeTeam === "player") {
      ctx.save();
      ctx.strokeStyle = "rgba(255,244,177,.9)";
      ctx.fillStyle = "rgba(255,104,80,.12)";
      ctx.setLineDash([8, 7]);
      ctx.lineWidth = 2;
      ctx.fillRect(this.aimX - 75, 0, 150, HEIGHT);
      ctx.strokeRect(this.aimX - 75, 12, 150, HEIGHT - 24);
      ctx.restore();
      return;
    }
    const definition = WEAPONS[this.activeTeam === "player" ? this.selectedWeapon : "bazooka"];
    if (!definition.speedMax) return;
    const speed = definition.speedMin + (definition.speedMax - definition.speedMin) * this.power;
    const vx = Math.cos(unit.angle) * speed;
    const vy = Math.sin(unit.angle) * speed;
    ctx.save();
    for (let time = 0.12, index = 0; time < 2.7; time += 0.12, index += 1) {
      const point = projectilePoint(unit.x + Math.cos(unit.angle) * 23, unit.y + Math.sin(unit.angle) * 23, vx, vy, this.wind * 3.4, GRAVITY, time);
      if (point.x < 0 || point.x > WIDTH || point.y > HEIGHT || this.isSolid(point.x, point.y)) break;
      ctx.globalAlpha = clamp(0.8 - time * 0.22, 0.12, 0.8);
      ctx.fillStyle = index % 2 ? "#fff7cf" : this.activeTeam === "player" ? "#81e3d7" : "#ff8c70";
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawUnits(ctx: CanvasRenderingContext2D) {
    for (const unit of this.units) {
      if (!unit.alive) continue;
      const active = unit.id === this.activeUnitId;
      const bob = active && (this.phase === "aiming" || this.phase === "ai-thinking") ? Math.sin(performance.now() * 0.006) * 1.4 : 0;
      ctx.save();
      ctx.translate(unit.x, unit.y + bob);
      if (active) {
        const glow = ctx.createRadialGradient(0, 4, 3, 0, 4, 29);
        glow.addColorStop(0, unit.team === "player" ? "rgba(102,238,213,.32)" : "rgba(255,112,82,.31)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 4, 29, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.scale(unit.facing, 1);
      ctx.fillStyle = "rgba(24,23,25,.28)";
      ctx.beginPath();
      ctx.ellipse(0, 15, 17, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      const body = ctx.createLinearGradient(-10, -14, 10, 15);
      if (unit.hurtFlash > 0) { body.addColorStop(0, "#fff5d9"); body.addColorStop(1, "#ff685d"); }
      else if (unit.team === "player") { body.addColorStop(0, "#d7f07c"); body.addColorStop(0.55, "#88bc56"); body.addColorStop(1, "#527b3c"); }
      else { body.addColorStop(0, "#ff9b6c"); body.addColorStop(0.55, "#d95348"); body.addColorStop(1, "#8f343f"); }
      ctx.fillStyle = body;
      ctx.strokeStyle = "#342d37";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-12, 13);
      ctx.bezierCurveTo(-17, 3, -11, -12, -2, -15);
      ctx.bezierCurveTo(9, -19, 16, -9, 14, 3);
      ctx.bezierCurveTo(12, 13, 7, 16, 1, 13);
      ctx.bezierCurveTo(-3, 17, -8, 17, -12, 13);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = unit.team === "player" ? "#4dc4ad" : "#ed704f";
      ctx.beginPath();
      ctx.moveTo(-11, -10);
      ctx.quadraticCurveTo(0, -22, 14, -11);
      ctx.lineTo(12, -6);
      ctx.quadraticCurveTo(0, -12, -13, -5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fffaf0";
      ctx.strokeStyle = "#342d37";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(2, -6, 4.8, 6.3, -0.08, 0, Math.PI * 2);
      ctx.ellipse(9, -5.5, 4.3, 5.8, 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#27232c";
      ctx.beginPath();
      ctx.arc(3.5, -4.7, 1.7, 0, Math.PI * 2);
      ctx.arc(10.2, -4.4, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#3a2930";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(7, 3, 4, 0.15, Math.PI - 0.15);
      ctx.stroke();
      if (active && (this.phase === "aiming" || this.phase === "ai-thinking")) {
        ctx.rotate(unit.facing === 1 ? unit.angle : Math.PI - unit.angle);
        ctx.fillStyle = "#3e4245";
        ctx.strokeStyle = "#24272a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(8, -3.5, 23, 7, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#e7b75c";
        ctx.fillRect(25, -2, 8, 4);
      }
      ctx.restore();
      this.drawUnitHud(ctx, unit, active);
    }
  }

  private drawUnitHud(ctx: CanvasRenderingContext2D, unit: WormUnit, active: boolean) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = `${active ? "700 12px" : "600 10px"} system-ui, sans-serif`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(31,29,34,.82)";
    ctx.strokeText(unit.name, unit.x, unit.y - 32);
    ctx.fillStyle = "#fff8df";
    ctx.fillText(unit.name, unit.x, unit.y - 32);
    const width = 38;
    ctx.fillStyle = "#2a2530";
    ctx.fillRect(unit.x - width / 2 - 1, unit.y - 27, width + 2, 6);
    ctx.fillStyle = unit.team === "player" ? "#54d7a4" : "#ff685c";
    ctx.fillRect(unit.x - width / 2, unit.y - 26, width * unit.hp / 100, 4);
    ctx.restore();
  }

  private drawProjectiles(ctx: CanvasRenderingContext2D) {
    for (const projectile of this.projectiles) {
      ctx.save();
      ctx.translate(projectile.x, projectile.y);
      const angle = Math.atan2(projectile.vy, projectile.vx);
      ctx.rotate(angle);
      if (projectile.weapon === "bazooka") {
        ctx.fillStyle = "#e6bb55";
        ctx.strokeStyle = "#342f35";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-3, -4);
        ctx.lineTo(-8, -4);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-8, 4);
        ctx.lineTo(-3, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (projectile.weapon === "bomb") {
        ctx.fillStyle = "#424c50";
        ctx.strokeStyle = "#24292c";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-5, -5);
        ctx.lineTo(-9, 0);
        ctx.lineTo(-5, 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#ecb755";
        ctx.fillRect(-10, -6, 4, 12);
      } else {
        const gradient = ctx.createRadialGradient(-2, -3, 1, 0, 0, projectile.radius + 2);
        gradient.addColorStop(0, "#fff1a1");
        gradient.addColorStop(0.35, projectile.weapon === "cluster" || projectile.weapon === "shard" ? "#ad79e8" : "#67b472");
        gradient.addColorStop(1, "#34333c");
        ctx.fillStyle = gradient;
        ctx.strokeStyle = "#292731";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, projectile.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "#f3c66a";
        ctx.beginPath();
        ctx.moveTo(0, -projectile.radius);
        ctx.quadraticCurveTo(4, -projectile.radius - 7, 8, -projectile.radius - 5);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    for (const particle of this.particles) {
      const alpha = clamp(1 - particle.age / particle.life, 0, 1);
      const image = this.assets[particle.kind];
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.globalAlpha = alpha * 0.9;
      if (image) ctx.drawImage(image, -particle.size, -particle.size, particle.size * 2, particle.size * 2);
      else {
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(0, 0, particle.size * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawLabels(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "800 14px system-ui, sans-serif";
    for (const label of this.labels) {
      ctx.globalAlpha = clamp(1 - label.age / 1.05, 0, 1);
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(39,31,35,.78)";
      ctx.strokeText(label.value, label.x, label.y);
      ctx.fillStyle = label.color;
      ctx.fillText(label.value, label.x, label.y);
    }
    ctx.restore();
  }
}
