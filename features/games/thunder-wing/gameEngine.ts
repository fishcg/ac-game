import type { ThunderImages } from "./assets";
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  type Bullet,
  type BossVariant,
  type Enemy,
  type EnemyKind,
  type MovementInput,
  type Particle,
  type PlayerState,
  type Powerup,
  type SoundEvent,
  type ThunderHud,
  type WeaponKind,
} from "./types";

type EngineCallbacks = {
  onHud: (hud: ThunderHud) => void;
  onSound: (sound: SoundEvent) => void;
  onGameOver: (score: number) => void;
};

const ENEMY_STATS: Record<EnemyKind, { hp: number; radius: number; speed: number; score: number }> = {
  scout: { hp: 2, radius: 25, speed: 125, score: 80 },
  zigzag: { hp: 4, radius: 28, speed: 100, score: 150 },
  tank: { hp: 8, radius: 34, speed: 68, score: 300 },
  boss: { hp: 90, radius: 50, speed: 40, score: 3000 },
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distanceSquared = (a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const collides = (a: { x: number; y: number; radius: number }, b: { x: number; y: number; radius: number }) => distanceSquared(a, b) < (a.radius + b.radius) ** 2;
const WEAPON_ORDER: WeaponKind[] = ["cannon", "laser", "spread"];
const BOSS_VARIANTS: BossVariant[] = ["scarlet", "azure", "verdant"];
const BOSS_NAMES: Record<BossVariant, string> = {
  scarlet: "赤红堡垒",
  azure: "苍蓝母舰",
  verdant: "翠光收割者",
};
const ENEMY_SAFE_TOP = 105;

export class ThunderWingEngine {
  private width: number;
  private height: number;
  private player: PlayerState = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT - 100,
    targetX: GAME_WIDTH / 2,
    targetY: GAME_HEIGHT - 100,
    radius: 18,
    hp: 5,
    shield: 100,
    power: 2,
    weapon: "cannon",
    wingmen: 0,
    wingmanCooldown: 0,
    invulnerable: 2.4,
    shootCooldown: 0,
  };
  private bullets: Bullet[] = [];
  private enemies: Enemy[] = [];
  private powerups: Powerup[] = [];
  private particles: Particle[] = [];
  private elapsed = 0;
  private score = 0;
  private survivalScoreTimer = 0;
  private spawnCooldown = 0.85;
  private nextBossTime = 35;
  private nextWingmanDrop = 8;
  private wingmanDrops = 0;
  private bossCount = Math.floor(Math.random() * BOSS_VARIANTS.length);
  private laserDamageCooldown = 0;
  private backgroundOffset = 0;
  private id = 0;
  private ended = false;
  private hudCooldown = 0;
  private stars: Array<{ x: number; y: number; size: number; speed: number }> = [];

  constructor(
    private context: CanvasRenderingContext2D,
    private images: ThunderImages,
    private callbacks: EngineCallbacks,
    width = GAME_WIDTH,
    height = GAME_HEIGHT,
  ) {
    this.width = width;
    this.height = height;
    this.player.x = width / 2;
    this.player.y = height - 100;
    this.player.targetX = this.player.x;
    this.player.targetY = this.player.y;
    this.stars = Array.from({ length: Math.round(70 * Math.max(1, height / GAME_HEIGHT)) }, (_, index) => ({
      x: (index * 83.17) % width,
      y: (index * 137.31) % height,
      size: 0.8 + (index % 4) * 0.55,
      speed: 28 + (index % 5) * 16,
    }));
    this.emitHud();
  }

  resize(width: number, height: number) {
    if (width === this.width && height === this.height) return;
    const scaleX = width / Math.max(1, this.width);
    const scaleY = height / Math.max(1, this.height);
    const migrate = (entity: { x: number; y: number }) => {
      entity.x *= scaleX;
      entity.y *= scaleY;
    };
    migrate(this.player);
    this.player.targetX *= scaleX;
    this.player.targetY *= scaleY;
    for (const collection of [this.bullets, this.enemies, this.powerups, this.particles, this.stars]) {
      collection.forEach(migrate);
    }
    this.width = width;
    this.height = height;
    this.player.x = clamp(this.player.x, 35, width - 35);
    this.player.y = clamp(this.player.y, 90, height - 55);
    this.player.targetX = clamp(this.player.targetX, 35, width - 35);
    this.player.targetY = clamp(this.player.targetY, 90, height - 55);
  }

  setPlayerTarget(x: number, y: number) {
    this.player.targetX = clamp(x, 35, this.width - 35);
    this.player.targetY = clamp(y, 90, this.height - 55);
  }

  cycleWeapon() {
    const index = WEAPON_ORDER.indexOf(this.player.weapon);
    this.player.weapon = WEAPON_ORDER[(index + 1) % WEAPON_ORDER.length];
    this.player.shootCooldown = 0;
    this.callbacks.onSound("powerup");
    this.emitHud();
  }

  update(rawDelta: number, input: MovementInput) {
    if (this.ended) return;
    const delta = Math.min(rawDelta, 0.034);
    this.elapsed += delta;
    this.backgroundOffset = (this.backgroundOffset + delta * (90 + this.elapsed * 0.75)) % 256;
    this.player.invulnerable = Math.max(0, this.player.invulnerable - delta);
    this.updatePlayer(delta, input);
    this.updateSpawning(delta);
    this.updateBullets(delta);
    this.updateEnemies(delta);
    this.updatePlayerLaser(delta);
    this.updatePowerups(delta);
    this.updateParticles(delta);
    this.resolveCollisions();

    this.survivalScoreTimer += delta;
    if (this.survivalScoreTimer >= 1) {
      this.score += 10 * Math.floor(this.survivalScoreTimer);
      this.survivalScoreTimer %= 1;
    }

    this.hudCooldown -= delta;
    if (this.hudCooldown <= 0) {
      this.emitHud();
      this.hudCooldown = 0.08;
    }
  }

  draw() {
    const context = this.context;
    context.clearRect(0, 0, this.width, this.height);
    this.drawBackground();
    this.drawPowerups();
    this.drawPlayerLaser();
    this.drawBullets();
    this.drawEnemies();
    this.drawParticles();
    this.drawPlayer();
  }

  private updatePlayer(delta: number, input: MovementInput) {
    const keyboardX = Number(input.right) - Number(input.left);
    const keyboardY = Number(input.down) - Number(input.up);
    if (keyboardX || keyboardY) {
      const length = Math.hypot(keyboardX, keyboardY) || 1;
      const moveSpeed = 650;
      this.player.x = clamp(this.player.x + (keyboardX / length) * moveSpeed * delta, 35, this.width - 35);
      this.player.y = clamp(this.player.y + (keyboardY / length) * moveSpeed * delta, 90, this.height - 55);
      this.player.targetX = this.player.x;
      this.player.targetY = this.player.y;
    } else {
      const follow = 1 - Math.exp(-delta * 30);
      this.player.x += (this.player.targetX - this.player.x) * follow;
      this.player.y += (this.player.targetY - this.player.y) * follow;
    }

    this.player.shootCooldown -= delta;
    if (this.player.shootCooldown <= 0) {
      this.firePlayerWeapon();
      this.player.shootCooldown = this.player.weapon === "laser" ? 0.26 : Math.max(0.105, 0.22 - this.player.power * 0.025);
    }
    this.player.wingmanCooldown -= delta;
    if (this.player.wingmen > 0 && this.player.wingmanCooldown <= 0) {
      this.fireWingmen();
      this.player.wingmanCooldown = Math.max(0.42, 0.68 - this.player.power * 0.035);
    }
  }

  private firePlayerWeapon() {
    const { x, y, power, weapon } = this.player;
    if (weapon === "cannon") {
      const offset = power >= 3 ? 14 : 0;
      this.bullets.push({ x: x - offset, y: y - 32, vx: power >= 4 ? -34 : 0, vy: -560, radius: 6, enemy: false, damage: 1, kind: "bolt" });
      if (power >= 2) this.bullets.push({ x: x + offset, y: y - 32, vx: power >= 4 ? 34 : 0, vy: -560, radius: 6, enemy: false, damage: 1, kind: "bolt" });
      if (power >= 5) this.bullets.push({ x, y: y - 38, vx: 0, vy: -610, radius: 7, enemy: false, damage: 2, kind: "bolt" });
    }
    if (weapon === "spread") {
      const count = power >= 4 ? 5 : 3;
      const center = (count - 1) / 2;
      for (let index = 0; index < count; index += 1) {
        const angle = (index - center) * 0.15;
        const speed = 505;
        this.bullets.push({ x, y: y - 30, vx: Math.sin(angle) * speed, vy: -Math.cos(angle) * speed, radius: 5, enemy: false, damage: 1, kind: "spread" });
      }
    }
    this.callbacks.onSound("shoot");
  }

  private fireWingmen() {
    this.getWingmanPositions().forEach((position) => {
      this.bullets.push({ x: position.x, y: position.y - 18, vx: 0, vy: -390, radius: 8, enemy: false, damage: 2, kind: "missile" });
    });
    this.callbacks.onSound("shoot");
  }

  private getWingmanPositions() {
    const bob = Math.sin(this.elapsed * 5) * 4;
    const positions = [{ x: this.player.x - 58, y: this.player.y + 18 + bob }];
    if (this.player.wingmen >= 2) positions.push({ x: this.player.x + 58, y: this.player.y + 18 - bob });
    return positions.slice(0, this.player.wingmen);
  }

  private updateSpawning(delta: number) {
    const bossAlive = this.enemies.some((enemy) => enemy.kind === "boss");
    if (this.elapsed >= this.nextWingmanDrop && this.player.wingmen < 2) {
      this.powerups.push({
        x: this.player.x,
        y: ENEMY_SAFE_TOP,
        vx: 0,
        vy: 115,
        radius: 18,
        kind: "wingman",
        spin: 0,
      });
      this.wingmanDrops += 1;
      this.nextWingmanDrop += this.wingmanDrops === 1 ? 15 : 30;
    }
    if (this.elapsed >= this.nextBossTime && !bossAlive) {
      this.spawnEnemy("boss");
      this.nextBossTime += 34;
      return;
    }
    this.spawnCooldown -= delta;
    if (this.spawnCooldown > 0 || bossAlive) return;
    const difficulty = Math.min(1, this.elapsed / 75);
    const roll = Math.random();
    const kind: EnemyKind = roll < 0.58 - difficulty * 0.16 ? "scout" : roll < 0.88 - difficulty * 0.08 ? "zigzag" : "tank";
    this.spawnEnemy(kind);
    this.spawnCooldown = Math.max(0.38, 1.08 - this.elapsed * 0.0065) * (0.88 + Math.random() * 0.34);
  }

  private spawnEnemy(kind: EnemyKind) {
    const stats = ENEMY_STATS[kind];
    const bossVariant = kind === "boss" ? BOSS_VARIANTS[this.bossCount % BOSS_VARIANTS.length] : undefined;
    if (kind === "boss") this.bossCount += 1;
    const hpScale = kind === "boss" ? 1 + Math.floor(this.elapsed / 60) * 0.3 : 1 + Math.min(0.8, this.elapsed / 120);
    const hp = Math.ceil(stats.hp * hpScale);
    this.enemies.push({
      id: this.id += 1,
      kind,
      x: kind === "boss" ? this.width / 2 : 45 + Math.random() * (this.width - 90),
      y: kind === "boss" ? ENEMY_SAFE_TOP - 45 : ENEMY_SAFE_TOP,
      vx: kind === "boss" ? 105 : 0,
      vy: stats.speed * (1 + Math.min(0.65, this.elapsed / 100)),
      radius: stats.radius,
      hp,
      maxHp: hp,
      score: stats.score,
      phase: Math.random() * Math.PI * 2,
      shootCooldown: kind === "boss" ? 1.2 : 1.6 + Math.random() * 1.8,
      shotCount: 0,
      bossVariant,
    });
  }

  private updateBullets(delta: number) {
    this.bullets.forEach((bullet) => {
      if (bullet.kind === "missile") {
        const targets = this.enemies.filter((enemy) => enemy.y < bullet.y + 70);
        const target = targets.reduce<Enemy | null>((closest, enemy) => {
          if (!closest) return enemy;
          return distanceSquared(enemy, bullet) < distanceSquared(closest, bullet) ? enemy : closest;
        }, null);
        if (target) {
          const desired = Math.atan2(target.y - bullet.y, target.x - bullet.x);
          const current = Math.atan2(bullet.vy, bullet.vx);
          const difference = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
          const next = current + clamp(difference, -delta * 4.8, delta * 4.8);
          const speed = 430;
          bullet.vx = Math.cos(next) * speed;
          bullet.vy = Math.sin(next) * speed;
        }
      }
      bullet.x += bullet.vx * delta;
      bullet.y += bullet.vy * delta;
    });
    this.bullets = this.bullets.filter((bullet) => bullet.y > -80 && bullet.y < this.height + 80 && bullet.x > -40 && bullet.x < this.width + 40);
  }

  private updateEnemies(delta: number) {
    this.enemies.forEach((enemy) => {
      enemy.phase += delta;
      if (enemy.kind === "boss") {
        if (enemy.y < 185) enemy.y += enemy.vy * delta;
        else {
          if (enemy.bossVariant === "azure") {
            enemy.x = this.width / 2 + Math.sin(enemy.phase * 0.82) * Math.min(178, this.width * 0.33);
            enemy.y = 187 + Math.sin(enemy.phase * 1.55) * 22;
          } else if (enemy.bossVariant === "verdant") {
            enemy.x += enemy.vx * delta * 0.72;
            enemy.y = 183 + Math.sin(enemy.phase * 2.3) * 28;
            if (enemy.x < 72 || enemy.x > this.width - 72) enemy.vx *= -1;
          } else {
            enemy.x += enemy.vx * delta;
            if (enemy.x < 80 || enemy.x > this.width - 80) enemy.vx *= -1;
          }
        }
      } else {
        enemy.y += enemy.vy * delta;
        if (enemy.kind === "zigzag") enemy.x += Math.sin(enemy.phase * 4.3) * 125 * delta;
        if (enemy.kind === "scout") enemy.x += Math.sin(enemy.phase * 2.1) * 42 * delta;
        enemy.x = clamp(enemy.x, 32, this.width - 32);
      }
      enemy.shootCooldown -= delta;
      if (this.elapsed > 4 && enemy.shootCooldown <= 0 && enemy.y > 25 && enemy.y < this.height - 180) {
        this.fireEnemyWeapon(enemy);
        const enraged = enemy.kind === "boss" && enemy.hp / enemy.maxHp <= 0.5;
        const base = enemy.kind === "boss" ? (enraged ? 0.55 : 0.84) : enemy.kind === "tank" ? 1.7 : 2.25;
        enemy.shootCooldown = Math.max(0.62, base - this.elapsed * 0.004) * (0.88 + Math.random() * 0.35);
      }
    });
    this.enemies = this.enemies.filter((enemy) => enemy.y <= this.height + 75);
  }

  private fireEnemyWeapon(enemy: Enemy) {
    const angle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
    const speed = enemy.kind === "boss" ? 220 : 165 + Math.min(80, this.elapsed * 1.05);
    if (enemy.kind !== "boss") {
      this.pushEnemyBullet(enemy, angle, speed, "enemyBolt");
      this.callbacks.onSound("enemyShoot");
      return;
    }

    enemy.shotCount += 1;
    const enraged = enemy.hp / enemy.maxHp <= 0.5;
    if (enemy.bossVariant === "scarlet") {
      const count = enraged ? 7 : 5;
      const center = (count - 1) / 2;
      for (let index = 0; index < count; index += 1) this.pushEnemyBullet(enemy, angle + (index - center) * 0.2, speed + (enraged ? 18 : 0), "enemyBolt");
    } else if (enemy.bossVariant === "azure") {
      const count = enraged ? 14 : 10;
      const offset = enemy.shotCount % 2 ? Math.PI / count : 0;
      for (let index = 0; index < count; index += 1) this.pushEnemyBullet(enemy, offset + (index / count) * Math.PI * 2, speed * 0.72, "enemyOrb");
      if (enemy.shotCount % 2 === 0) {
        this.pushEnemyBullet(enemy, angle - 0.12, speed, "enemyBolt");
        this.pushEnemyBullet(enemy, angle + 0.12, speed, "enemyBolt");
      }
    } else {
      const arms = enraged ? 6 : 4;
      const sweep = enemy.shotCount * 0.34;
      for (let index = 0; index < arms; index += 1) this.pushEnemyBullet(enemy, sweep + (index / arms) * Math.PI * 2, speed * 0.82, "enemyOrb");
      if (enemy.shotCount % 3 === 0) {
        [-0.28, 0, 0.28].forEach((offset) => this.pushEnemyBullet(enemy, angle + offset, speed * 1.08, "enemyBolt"));
      }
    }
    this.callbacks.onSound("enemyShoot");
  }

  private pushEnemyBullet(enemy: Enemy, angle: number, speed: number, kind: "enemyBolt" | "enemyOrb") {
    this.bullets.push({
      x: enemy.x,
      y: enemy.y + enemy.radius * 0.6,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: kind === "enemyOrb" ? 7 : enemy.kind === "boss" ? 8 : 7,
      enemy: true,
      damage: 1,
      kind,
    });
  }

  private updatePowerups(delta: number) {
    this.powerups.forEach((powerup) => {
      powerup.y += powerup.vy * delta;
      powerup.spin += delta * 4;
    });
    this.powerups = this.powerups.filter((powerup) => powerup.y < this.height + 50);
  }

  private updatePlayerLaser(delta: number) {
    if (this.player.weapon !== "laser") return;
    this.laserDamageCooldown -= delta;
    if (this.laserDamageCooldown > 0) return;
    this.laserDamageCooldown = 0.11;
    const beamRadius = 7 + this.player.power * 2.2;
    const defeated = new Set<Enemy>();
    let hit = false;
    this.enemies.forEach((enemy) => {
      if (enemy.y >= this.player.y || Math.abs(enemy.x - this.player.x) > enemy.radius + beamRadius) return;
      enemy.hp -= this.player.power >= 4 ? 2 : 1;
      hit = true;
      this.spawnSparks(enemy.x, enemy.y + enemy.radius * 0.4, "#8ff7ff", 2);
      if (enemy.hp <= 0) defeated.add(enemy);
    });
    defeated.forEach((enemy) => this.destroyEnemy(enemy));
    if (defeated.size) this.enemies = this.enemies.filter((enemy) => !defeated.has(enemy));
    if (hit) this.callbacks.onSound("hit");
  }

  private updateParticles(delta: number) {
    this.particles.forEach((particle) => {
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vy += 25 * delta;
      particle.life -= delta;
    });
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  private resolveCollisions() {
    const playerBullets = this.bullets.filter((bullet) => !bullet.enemy);
    const enemyBullets = this.bullets.filter((bullet) => bullet.enemy);
    const usedBullets = new Set<Bullet>();
    const deadEnemies = new Set<Enemy>();

    this.enemies.forEach((enemy) => {
      playerBullets.forEach((bullet) => {
        if (usedBullets.has(bullet) || !collides(enemy, bullet)) return;
        usedBullets.add(bullet);
        enemy.hp -= bullet.damage;
        this.spawnSparks(bullet.x, bullet.y, "#71e9ff", 3);
        this.callbacks.onSound("hit");
        if (enemy.hp <= 0) deadEnemies.add(enemy);
      });
      if (collides(enemy, this.player) && this.player.invulnerable <= 0) {
        if (enemy.kind !== "boss") deadEnemies.add(enemy);
        this.damagePlayer(enemy.kind === "boss" ? 2 : 1);
      }
    });

    deadEnemies.forEach((enemy) => this.destroyEnemy(enemy));
    enemyBullets.forEach((bullet) => {
      if (!usedBullets.has(bullet) && collides(bullet, this.player) && this.player.invulnerable <= 0) {
        usedBullets.add(bullet);
        this.damagePlayer(bullet.damage);
      }
    });

    this.powerups = this.powerups.filter((powerup) => {
      if (!collides(powerup, this.player)) return true;
      if (powerup.kind === "shield") this.player.shield = Math.min(100, this.player.shield + 65);
      if (powerup.kind === "fire") this.player.power = Math.min(5, this.player.power + 1);
      if (powerup.kind === "wingman") this.player.wingmen = Math.min(2, this.player.wingmen + 1);
      this.score += 150;
      this.callbacks.onSound("powerup");
      const color = powerup.kind === "shield" ? "#62eaff" : powerup.kind === "wingman" ? "#65ff9b" : "#ffe45c";
      this.spawnSparks(powerup.x, powerup.y, color, 18);
      return false;
    });

    this.bullets = this.bullets.filter((bullet) => !usedBullets.has(bullet));
    this.enemies = this.enemies.filter((enemy) => !deadEnemies.has(enemy));
  }

  private destroyEnemy(enemy: Enemy) {
    this.score += enemy.score;
    this.callbacks.onSound("explode");
    this.spawnSparks(enemy.x, enemy.y, enemy.kind === "boss" ? "#ffdc68" : "#ff6d73", enemy.kind === "boss" ? 45 : 15);
    if (enemy.kind === "boss" || Math.random() < 0.24) {
      const roll = Math.random();
      const kind = this.player.shield < 25 && roll < 0.48
        ? "shield"
        : this.player.wingmen < 2 && roll < 0.7
          ? "wingman"
          : roll < 0.82 ? "fire" : "shield";
      this.powerups.push({
        x: enemy.x,
        y: enemy.y,
        vx: 0,
        vy: 92,
        radius: 17,
        kind,
        spin: 0,
      });
    }
  }

  private damagePlayer(amount: number) {
    if (this.ended || this.player.invulnerable > 0) return;
    if (this.player.shield > 0) {
      this.player.shield = Math.max(0, this.player.shield - amount * 50);
      this.player.invulnerable = 0.55;
      this.callbacks.onSound("shield");
      this.spawnSparks(this.player.x, this.player.y, "#70ecff", 20);
      return;
    }
    this.player.hp -= amount;
    this.player.power = Math.max(1, this.player.power - 1);
    this.player.invulnerable = 1.85;
    this.callbacks.onSound("explode");
    this.spawnSparks(this.player.x, this.player.y, "#ff8068", 26);
    if (this.player.hp <= 0) this.finishGame();
  }

  private finishGame() {
    if (this.ended) return;
    this.ended = true;
    this.emitHud();
    this.callbacks.onSound("gameOver");
    this.callbacks.onGameOver(Math.floor(this.score));
  }

  private spawnSparks(x: number, y: number, color: string, count: number) {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 190;
      const life = 0.22 + Math.random() * 0.55;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1,
        life,
        maxLife: life,
        color,
        size: 1.5 + Math.random() * 4,
      });
    }
  }

  private emitHud() {
    const boss = this.enemies.find((enemy) => enemy.kind === "boss");
    const bossVariant = boss?.bossVariant;
    this.callbacks.onHud({
      score: Math.floor(this.score),
      lives: Math.max(0, this.player.hp),
      shield: this.player.shield,
      power: this.player.power,
      weapon: this.player.weapon,
      wingmen: this.player.wingmen,
      wave: Math.floor(this.elapsed / 15) + 1,
      bossHp: boss ? boss.hp / boss.maxHp : null,
      bossName: bossVariant ? BOSS_NAMES[bossVariant] : null,
      bossPhase: boss ? (boss.hp / boss.maxHp <= 0.5 ? 2 : 1) : null,
    });
  }

  private drawBackground() {
    const context = this.context;
    const background = this.images.background;
    for (let x = 0; x < this.width; x += 256) {
      for (let y = -256 + this.backgroundOffset; y < this.height; y += 256) context.drawImage(background, x, y, 256, 256);
    }
    const gradient = context.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, "rgba(10, 8, 38, .15)");
    gradient.addColorStop(0.55, "rgba(12, 10, 42, .05)");
    gradient.addColorStop(1, "rgba(2, 6, 24, .56)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, this.width, this.height);
    context.fillStyle = "#dffbff";
    this.stars.forEach((star) => {
      star.y += star.speed / 60;
      if (star.y > this.height) star.y = 0;
      context.globalAlpha = 0.3 + (star.size % 1) * 0.6;
      context.fillRect(star.x, star.y, star.size, star.size * 2.3);
    });
    context.globalAlpha = 1;
  }

  private drawPlayer() {
    const context = this.context;
    const player = this.player;
    if (player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0) context.globalAlpha = 0.4;
    if (player.shield > 0) {
      context.globalAlpha = 0.42 + Math.sin(this.elapsed * 8) * 0.1;
      context.drawImage(this.images.shield, player.x - 55, player.y - 46, 110, 90);
      context.globalAlpha = 1;
    }
    context.drawImage(this.images.flame, player.x - 8, player.y + 23, 16, 40);
    context.drawImage(this.images.player, player.x - 42, player.y - 32, 84, 64);
    this.getWingmanPositions().forEach((position, index) => {
      const image = index === 0 ? this.images.wingmanLeft : this.images.wingmanRight;
      context.drawImage(this.images.flame, position.x - 4, position.y + 10, 8, 22);
      context.drawImage(image, position.x - 25, position.y - 16, 50, 34);
    });
    context.globalAlpha = 1;
  }

  private drawPlayerLaser() {
    if (this.player.weapon !== "laser") return;
    const context = this.context;
    const width = 7 + this.player.power * 2.2;
    const gradient = context.createLinearGradient(this.player.x, this.player.y, this.player.x, 0);
    gradient.addColorStop(0, "rgba(107, 243, 255, .95)");
    gradient.addColorStop(0.75, "rgba(103, 129, 255, .82)");
    gradient.addColorStop(1, "rgba(180, 241, 255, .18)");
    context.save();
    context.globalCompositeOperation = "lighter";
    context.shadowColor = "#5eeaff";
    context.shadowBlur = 22;
    context.fillStyle = "rgba(50, 167, 255, .28)";
    context.fillRect(this.player.x - width * 1.6, 0, width * 3.2, this.player.y - 22);
    context.fillStyle = gradient;
    context.fillRect(this.player.x - width / 2, 0, width, this.player.y - 22);
    context.fillStyle = "rgba(255,255,255,.92)";
    context.fillRect(this.player.x - Math.max(1.5, width * 0.16), 0, Math.max(3, width * 0.32), this.player.y - 22);
    context.restore();
  }

  private drawBullets() {
    this.bullets.forEach((bullet) => {
      this.context.save();
      this.context.translate(bullet.x, bullet.y);
      const angle = Math.atan2(bullet.vy, bullet.vx) + Math.PI / 2;
      this.context.rotate(angle);
      if (bullet.kind === "enemyOrb") {
        this.context.shadowColor = "#d568ff";
        this.context.shadowBlur = 15;
        this.context.fillStyle = "#eaa1ff";
        this.context.beginPath();
        this.context.arc(0, 0, 7, 0, Math.PI * 2);
        this.context.fill();
        this.context.fillStyle = "white";
        this.context.beginPath();
        this.context.arc(0, 0, 2.5, 0, Math.PI * 2);
        this.context.fill();
      } else if (bullet.kind === "missile") {
        this.context.shadowColor = "#74ffab";
        this.context.shadowBlur = 13;
        this.context.fillStyle = "#eafff0";
        this.context.beginPath();
        this.context.moveTo(0, -13);
        this.context.lineTo(6, 8);
        this.context.lineTo(0, 5);
        this.context.lineTo(-6, 8);
        this.context.closePath();
        this.context.fill();
        this.context.fillStyle = "#69ffac";
        this.context.fillRect(-2, 8, 4, 12);
      } else {
        const image = bullet.enemy ? this.images.enemyLaser : this.images.playerLaser;
        this.context.shadowColor = bullet.enemy ? "#ff405d" : bullet.kind === "spread" ? "#ffd55f" : "#54e9ff";
        this.context.shadowBlur = 12;
        this.context.drawImage(image, -5, -20, 10, 40);
      }
      this.context.restore();
    });
  }

  private drawEnemies() {
    this.enemies.forEach((enemy) => {
      const bossImage = enemy.bossVariant === "azure" ? this.images.bossAzure : enemy.bossVariant === "verdant" ? this.images.bossVerdant : this.images.bossScarlet;
      const image = enemy.kind === "boss" ? bossImage : enemy.kind === "tank" ? this.images.enemyTank : enemy.kind === "zigzag" ? this.images.enemyZigzag : this.images.enemyScout;
      const width = enemy.kind === "boss" ? 116 : enemy.kind === "tank" ? 82 : 70;
      const height = enemy.kind === "boss" ? 116 : 64;
      this.context.save();
      this.context.translate(enemy.x, enemy.y);
      if (enemy.kind !== "boss") this.context.rotate(Math.sin(enemy.phase * 3) * 0.05);
      if (enemy.kind === "boss" && enemy.hp / enemy.maxHp <= 0.5) {
        this.context.shadowColor = enemy.bossVariant === "azure" ? "#5be7ff" : enemy.bossVariant === "verdant" ? "#6cff9b" : "#ff5573";
        this.context.shadowBlur = 22 + Math.sin(this.elapsed * 9) * 7;
      }
      this.context.drawImage(image, -width / 2, -height / 2, width, height);
      if (enemy.kind === "tank" || enemy.kind === "boss") {
        const barWidth = enemy.kind === "boss" ? 105 : 60;
        this.context.fillStyle = "rgba(0,0,0,.45)";
        this.context.fillRect(-barWidth / 2, -height / 2 - 10, barWidth, 4);
        this.context.fillStyle = enemy.kind === "boss" ? "#ff5e78" : "#67e4ff";
        this.context.fillRect(-barWidth / 2, -height / 2 - 10, barWidth * (enemy.hp / enemy.maxHp), 4);
      }
      this.context.restore();
    });
  }

  private drawPowerups() {
    this.powerups.forEach((powerup) => {
      const image = powerup.kind === "shield" ? this.images.shieldPowerup : powerup.kind === "wingman" ? this.images.wingmanPowerup : this.images.firePowerup;
      this.context.save();
      this.context.translate(powerup.x, powerup.y);
      this.context.rotate(Math.sin(powerup.spin) * 0.18);
      this.context.shadowColor = powerup.kind === "shield" ? "#53e6ff" : powerup.kind === "wingman" ? "#65ff9b" : "#ffe469";
      this.context.shadowBlur = 18;
      this.context.drawImage(image, -20, -20, 40, 40);
      this.context.restore();
    });
  }

  private drawParticles() {
    this.particles.forEach((particle) => {
      this.context.globalAlpha = particle.life / particle.maxLife;
      this.context.fillStyle = particle.color;
      this.context.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    });
    this.context.globalAlpha = 1;
  }
}
