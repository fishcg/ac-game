import type { IronImages } from "./assets";
import {
  GROUND_Y,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  WORLD_WIDTH,
  type Bullet,
  type Crate,
  type Enemy,
  type Explosion,
  type Grenade,
  type Hostage,
  type IronHud,
  type IronInput,
  type Pickup,
  type PickupKind,
  type Platform,
  type PlayerState,
} from "./types";

type SoundName = "shoot" | "shotgun" | "hit" | "explode" | "pickup" | "hurt" | "win";
type Callbacks = { onHud: (hud: IronHud) => void; onSound: (sound: SoundName) => void; onEnd: (score: number, won: boolean) => void };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const overlaps = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

const PLATFORMS: Platform[] = [
  { x: 760, y: 342, width: 230, height: 24 },
  { x: 1450, y: 318, width: 190, height: 24 },
  { x: 2070, y: 350, width: 260, height: 24 },
  { x: 2920, y: 310, width: 220, height: 24 },
  { x: 3560, y: 345, width: 250, height: 24 },
];

const ENEMY_LAYOUT: Array<[Enemy["kind"], number, number]> = [
  ["soldier", 620, GROUND_Y - 48], ["dog", 980, GROUND_Y - 42], ["gunner", 1240, GROUND_Y - 48],
  ["soldier", 1530, 270], ["soldier", 1820, GROUND_Y - 48], ["dog", 2180, GROUND_Y - 42],
  ["gunner", 2320, GROUND_Y - 48], ["soldier", 2700, GROUND_Y - 48], ["soldier", 3000, 262],
  ["dog", 3330, GROUND_Y - 42], ["gunner", 3650, 297], ["soldier", 3900, GROUND_Y - 48],
  ["gunner", 4140, GROUND_Y - 48], ["tank", 4630, GROUND_Y - 82],
];

export class IronFrontEngine {
  private player: PlayerState = {
    x: 130, y: GROUND_Y - 48, vx: 0, vy: 0, width: 38, height: 48, facing: 1, onGround: true,
    hp: 7, maxHp: 7, weapon: "pistol", ammo: -1, grenades: 7, invulnerable: 2.5, shootCooldown: 0, animationTime: 0,
  };
  private enemies: Enemy[] = ENEMY_LAYOUT.map(([kind, x, y], index) => ({
    id: index, kind, x, y, vx: 0, hp: kind === "tank" ? 42 : kind === "gunner" ? 3 : kind === "dog" ? 1 : 2,
    maxHp: kind === "tank" ? 42 : kind === "gunner" ? 3 : kind === "dog" ? 1 : 2,
    facing: -1, shootCooldown: 1.5 + (index % 4) * 0.4, animationTime: index * 0.17, alive: true,
  }));
  private bullets: Bullet[] = [];
  private grenades: Grenade[] = [];
  private explosions: Explosion[] = [];
  private particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }> = [];
  private crates: Crate[] = [
    { x: 370, y: GROUND_Y - 42, hp: 2, pickup: "machine", opened: false },
    { x: 1730, y: GROUND_Y - 42, hp: 2, pickup: "health", opened: false },
    { x: 2440, y: GROUND_Y - 42, hp: 3, pickup: "shotgun", opened: false },
    { x: 3250, y: GROUND_Y - 42, hp: 3, pickup: "health", opened: false },
    { x: 3980, y: GROUND_Y - 42, hp: 3, pickup: "grenade", opened: false },
  ];
  private pickups: Pickup[] = [];
  private hostages: Hostage[] = [
    { x: 880, rescued: false, wave: 0 }, { x: 1980, rescued: false, wave: 1.2 }, { x: 3480, rescued: false, wave: 2.3 },
  ];
  private previousInput: IronInput = { left: false, right: false, jump: false, crouch: false, aimUp: false, shoot: false, grenade: false };
  private score = 0;
  private cameraX = 0;
  private hudCooldown = 0;
  private ended = false;
  private shake = 0;
  private elapsed = 0;

  constructor(private context: CanvasRenderingContext2D, private images: IronImages, private callbacks: Callbacks) {
    this.emitHud();
  }

  update(rawDelta: number, input: IronInput) {
    if (this.ended) return;
    const delta = Math.min(rawDelta, 0.034);
    this.elapsed += delta;
    this.player.invulnerable = Math.max(0, this.player.invulnerable - delta);
    this.player.animationTime += delta;
    this.updatePlayer(delta, input);
    this.updateEnemies(delta);
    this.updateBullets(delta);
    this.updateGrenades(delta);
    this.updatePickups(delta);
    this.updateEffects(delta);
    this.checkHostages();
    this.cameraX += (clamp(this.player.x - 270, 0, WORLD_WIDTH - VIEW_WIDTH) - this.cameraX) * Math.min(1, delta * 5.5);
    this.shake = Math.max(0, this.shake - delta * 18);
    this.hudCooldown -= delta;
    if (this.hudCooldown <= 0) {
      this.emitHud();
      this.hudCooldown = 0.09;
    }
    this.previousInput = { ...input };
  }

  draw() {
    const context = this.context;
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    const shakeX = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const shakeY = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    context.save();
    context.translate(shakeX, shakeY);
    this.drawBackground();
    this.drawWorld();
    this.drawEntities();
    this.drawEffects();
    context.restore();
    this.drawVignette();
  }

  private updatePlayer(delta: number, input: IronInput) {
    const player = this.player;
    const direction = Number(input.right) - Number(input.left);
    const targetSpeed = input.crouch ? 0 : direction * 235;
    player.vx += (targetSpeed - player.vx) * Math.min(1, delta * 14);
    if (direction) player.facing = direction > 0 ? 1 : -1;

    if (input.jump && !this.previousInput.jump && player.onGround) {
      player.vy = -560;
      player.onGround = false;
    }
    player.vy += 1480 * delta;
    player.x = clamp(player.x + player.vx * delta, 30, WORLD_WIDTH - 70);
    const previousBottom = player.y + player.height;
    player.y += player.vy * delta;
    player.onGround = false;

    let landingY = GROUND_Y;
    PLATFORMS.forEach((platform) => {
      const horizontal = player.x + player.width > platform.x && player.x < platform.x + platform.width;
      if (horizontal && player.vy >= 0 && previousBottom <= platform.y + 4 && player.y + player.height >= platform.y) landingY = Math.min(landingY, platform.y);
    });
    if (player.y + player.height >= landingY && player.vy >= 0) {
      player.y = landingY - player.height;
      player.vy = 0;
      player.onGround = true;
    }

    player.shootCooldown -= delta;
    if (input.shoot && player.shootCooldown <= 0) this.firePlayer(input);
    if (input.grenade && !this.previousInput.grenade && player.grenades > 0) this.throwGrenade();
  }

  private firePlayer(input: IronInput) {
    const player = this.player;
    const upward = input.aimUp && !input.crouch;
    const muzzleX = player.x + player.width / 2 + (upward ? 0 : player.facing * 27);
    const muzzleY = player.y + (input.crouch ? 34 : upward ? -2 : 18);
    if (player.weapon === "shotgun") {
      [-0.16, -0.08, 0, 0.08, 0.16].forEach((spread) => {
        const base = upward ? -Math.PI / 2 : player.facing > 0 ? 0 : Math.PI;
        const angle = base + spread;
        this.bullets.push({ x: muzzleX, y: muzzleY, vx: Math.cos(angle) * 620, vy: Math.sin(angle) * 620, radius: 4, damage: 1, enemy: false, ttl: 0.38 });
      });
      player.shootCooldown = 0.5;
      this.callbacks.onSound("shotgun");
    } else {
      const speed = player.weapon === "machine" ? 720 : 660;
      this.bullets.push({ x: muzzleX, y: muzzleY, vx: upward ? 0 : player.facing * speed, vy: upward ? -speed : (Math.random() - 0.5) * (player.weapon === "machine" ? 22 : 4), radius: 3, damage: 1, enemy: false, ttl: 1.05 });
      player.shootCooldown = player.weapon === "machine" ? 0.085 : 0.23;
      this.callbacks.onSound("shoot");
    }
    if (player.ammo > 0) {
      player.ammo -= 1;
      if (player.ammo === 0) { player.weapon = "pistol"; player.ammo = -1; }
    }
    this.spawnParticles(muzzleX, muzzleY, upward ? "#fff09b" : "#ffd45e", 4, 90);
  }

  private throwGrenade() {
    const player = this.player;
    player.grenades -= 1;
    this.grenades.push({ x: player.x + player.width / 2, y: player.y + 8, vx: player.facing * 330, vy: -430, ttl: 1.35, rotation: 0 });
  }

  private updateEnemies(delta: number) {
    this.enemies.forEach((enemy) => {
      if (!enemy.alive || Math.abs(enemy.x - this.player.x) > 1100) return;
      enemy.animationTime += delta;
      enemy.shootCooldown -= delta;
      const dx = this.player.x - enemy.x;
      enemy.facing = dx >= 0 ? 1 : -1;

      if (enemy.kind === "dog") {
        if (Math.abs(dx) < 520) enemy.vx += (enemy.facing * 175 - enemy.vx) * Math.min(1, delta * 5);
        enemy.x += enemy.vx * delta;
        if (overlaps(this.player.x, this.player.y, this.player.width, this.player.height, enemy.x, enemy.y, 42, 40)) this.damagePlayer(1);
        return;
      }
      if (enemy.kind === "tank") {
        if (Math.abs(dx) < 850 && enemy.shootCooldown <= 0) {
          const enraged = enemy.hp / enemy.maxHp < 0.5;
          this.bullets.push({ x: enemy.x + (enemy.facing < 0 ? 3 : 68), y: enemy.y + 19, vx: enemy.facing * (enraged ? 225 : 190), vy: -225, radius: 10, damage: 1, enemy: true, ttl: 3, shell: true });
          enemy.shootCooldown = enraged ? 1.15 : 1.75;
          this.callbacks.onSound("shoot");
        }
        return;
      }
      enemy.vx = enemy.facing * (enemy.kind === "gunner" ? 18 : 28);
      if (Math.abs(dx) > 190) enemy.x += enemy.vx * delta;
      if (Math.abs(dx) < 700 && enemy.shootCooldown <= 0) {
        const shots = enemy.kind === "gunner" ? 2 : 1;
        for (let index = 0; index < shots; index += 1) this.bullets.push({
          x: enemy.x + 24 + enemy.facing * 22, y: enemy.y + 18,
          vx: enemy.facing * (215 + index * 15), vy: (Math.random() - 0.5) * 22,
          radius: 4, damage: 1, enemy: true, ttl: 2.2,
        });
        enemy.shootCooldown = enemy.kind === "gunner" ? 1.85 : 2.55;
        this.callbacks.onSound("shoot");
      }
    });
  }

  private updateBullets(delta: number) {
    const remaining: Bullet[] = [];
    this.bullets.forEach((bullet) => {
      bullet.ttl -= delta;
      if (bullet.shell) bullet.vy += 720 * delta;
      bullet.x += bullet.vx * delta;
      bullet.y += bullet.vy * delta;
      if (bullet.ttl <= 0 || bullet.x < -100 || bullet.x > WORLD_WIDTH + 100) return;

      if (bullet.enemy) {
        if (bullet.shell && bullet.y >= GROUND_Y - 8) {
          this.explode(bullet.x, GROUND_Y - 12, 84, true);
          return;
        }
        if (overlaps(this.player.x, this.player.y, this.player.width, this.player.height, bullet.x - bullet.radius, bullet.y - bullet.radius, bullet.radius * 2, bullet.radius * 2)) {
          this.damagePlayer(bullet.damage);
          return;
        }
        remaining.push(bullet);
        return;
      }

      let consumed = false;
      this.enemies.forEach((enemy) => {
        if (consumed || !enemy.alive) return;
        const width = enemy.kind === "tank" ? 72 : enemy.kind === "dog" ? 42 : 42;
        const height = enemy.kind === "tank" ? 48 : 46;
        if (overlaps(bullet.x - bullet.radius, bullet.y - bullet.radius, bullet.radius * 2, bullet.radius * 2, enemy.x, enemy.y, width, height)) {
          enemy.hp -= bullet.damage;
          consumed = true;
          this.callbacks.onSound("hit");
          this.spawnParticles(bullet.x, bullet.y, "#fff0a0", 4, 130);
          if (enemy.hp <= 0) this.defeatEnemy(enemy);
        }
      });
      this.crates.forEach((crate) => {
        if (consumed || crate.opened) return;
        if (overlaps(bullet.x - 3, bullet.y - 3, 6, 6, crate.x, crate.y, 48, 42)) {
          crate.hp -= bullet.damage;
          consumed = true;
          if (crate.hp <= 0) this.openCrate(crate);
        }
      });
      if (!consumed) remaining.push(bullet);
    });
    this.bullets = remaining;
  }

  private updateGrenades(delta: number) {
    const remaining: Grenade[] = [];
    this.grenades.forEach((grenade) => {
      grenade.ttl -= delta;
      grenade.vy += 920 * delta;
      grenade.x += grenade.vx * delta;
      grenade.y += grenade.vy * delta;
      grenade.rotation += delta * 8;
      if (grenade.y >= GROUND_Y - 10 || grenade.ttl <= 0) this.explode(grenade.x, Math.min(grenade.y, GROUND_Y - 12), 115, false);
      else remaining.push(grenade);
    });
    this.grenades = remaining;
  }

  private explode(x: number, y: number, radius: number, hurtsPlayer: boolean) {
    this.explosions.push({ x, y, age: 0, size: radius * 1.15 });
    this.shake = Math.max(this.shake, radius * 0.14);
    this.callbacks.onSound("explode");
    this.spawnParticles(x, y, "#ff9a42", 22, 260);
    this.enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      const centerX = enemy.x + (enemy.kind === "tank" ? 36 : 22);
      if (Math.hypot(centerX - x, enemy.y + 24 - y) < radius) {
        enemy.hp -= hurtsPlayer ? 0 : 6;
        if (enemy.hp <= 0) this.defeatEnemy(enemy);
      }
    });
    if (hurtsPlayer && Math.hypot(this.player.x + 19 - x, this.player.y + 24 - y) < radius) this.damagePlayer(2);
    this.crates.forEach((crate) => {
      if (!crate.opened && Math.hypot(crate.x + 24 - x, crate.y + 20 - y) < radius) this.openCrate(crate);
    });
  }

  private defeatEnemy(enemy: Enemy) {
    if (!enemy.alive) return;
    enemy.alive = false;
    this.score += enemy.kind === "tank" ? 5000 : enemy.kind === "gunner" ? 350 : enemy.kind === "dog" ? 180 : 250;
    this.explosions.push({ x: enemy.x + (enemy.kind === "tank" ? 36 : 22), y: enemy.y + 24, age: 0, size: enemy.kind === "tank" ? 130 : 62 });
    this.callbacks.onSound("explode");
    if (enemy.kind === "tank") {
      this.callbacks.onSound("win");
      window.setTimeout(() => this.finish(true), 900);
    }
  }

  private openCrate(crate: Crate) {
    if (crate.opened) return;
    crate.opened = true;
    this.explode(crate.x + 24, crate.y + 20, 52, false);
    this.pickups.push({ x: crate.x + 12, y: crate.y - 28, kind: crate.pickup, active: true, bob: Math.random() * Math.PI * 2 });
  }

  private updatePickups(delta: number) {
    this.pickups.forEach((pickup) => {
      if (!pickup.active) return;
      pickup.bob += delta * 4;
      if (!overlaps(this.player.x, this.player.y, this.player.width, this.player.height, pickup.x, pickup.y, 32, 32)) return;
      pickup.active = false;
      this.score += 300;
      if (pickup.kind === "machine") { this.player.weapon = "machine"; this.player.ammo = 120; }
      if (pickup.kind === "shotgun") { this.player.weapon = "shotgun"; this.player.ammo = 30; }
      if (pickup.kind === "health") this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2);
      if (pickup.kind === "grenade") this.player.grenades = Math.min(9, this.player.grenades + 4);
      this.callbacks.onSound("pickup");
    });
  }

  private checkHostages() {
    this.hostages.forEach((hostage) => {
      if (hostage.rescued || Math.abs(this.player.x - hostage.x) > 52 || Math.abs(this.player.y + 48 - GROUND_Y) > 50) return;
      hostage.rescued = true;
      this.score += 600;
      this.callbacks.onSound("pickup");
      this.spawnParticles(hostage.x, GROUND_Y - 40, "#fff3a0", 16, 150);
    });
  }

  private damagePlayer(amount: number) {
    if (this.ended || this.player.invulnerable > 0) return;
    this.player.hp -= amount;
    this.player.invulnerable = 1.9;
    this.shake = Math.max(this.shake, 8);
    this.callbacks.onSound("hurt");
    if (this.player.hp <= 0) this.finish(false);
  }

  private updateEffects(delta: number) {
    this.explosions.forEach((explosion) => { explosion.age += delta; });
    this.explosions = this.explosions.filter((explosion) => explosion.age < 0.62);
    this.particles.forEach((particle) => {
      particle.x += particle.vx * delta; particle.y += particle.vy * delta; particle.vy += 380 * delta; particle.life -= delta;
    });
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  private spawnParticles(x: number, y: number, color: string, count: number, speed: number) {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (0.25 + Math.random() * 0.75);
      this.particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, life: 0.2 + Math.random() * 0.45, color, size: 2 + Math.random() * 4 });
    }
  }

  private finish(won: boolean) {
    if (this.ended) return;
    this.ended = true;
    const distanceBonus = Math.floor((this.player.x / WORLD_WIDTH) * 1000);
    this.score += won ? 2500 : distanceBonus;
    this.emitHud();
    this.callbacks.onEnd(this.score, won);
  }

  private emitHud() {
    const tank = this.enemies.find((enemy) => enemy.kind === "tank" && enemy.alive);
    this.callbacks.onHud({
      score: this.score, hp: Math.max(0, this.player.hp), maxHp: this.player.maxHp,
      weapon: this.player.weapon, ammo: this.player.ammo, grenades: this.player.grenades,
      rescued: this.hostages.filter((hostage) => hostage.rescued).length,
      distance: clamp(this.player.x / (WORLD_WIDTH - 400), 0, 1),
      bossHp: tank && Math.abs(tank.x - this.player.x) < 900 ? tank.hp / tank.maxHp : null,
    });
  }

  private drawBackground() {
    const context = this.context;
    context.fillStyle = "#77a6dc";
    context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    const cloudOffset = -(this.cameraX * 0.08) % 750;
    for (let index = -1; index < 3; index += 1) context.drawImage(this.images.clouds, cloudOffset + index * 750, 0, 750, 550);
    const cityOffset = -(this.cameraX * 0.22) % 750;
    for (let index = -1; index < 3; index += 1) context.drawImage(this.images.city, cityOffset + index * 750, 0, 750, 550);
    const haze = context.createLinearGradient(0, 0, 0, GROUND_Y);
    haze.addColorStop(0, "rgba(22,31,74,.05)");
    haze.addColorStop(1, "rgba(44,24,63,.34)");
    context.fillStyle = haze;
    context.fillRect(0, 0, VIEW_WIDTH, GROUND_Y);
  }

  private drawWorld() {
    const context = this.context;
    const camera = this.cameraX;
    context.fillStyle = "#332744";
    context.fillRect(0, GROUND_Y, VIEW_WIDTH, VIEW_HEIGHT - GROUND_Y);
    context.fillStyle = "#6d566f";
    context.fillRect(0, GROUND_Y, VIEW_WIDTH, 12);
    context.fillStyle = "#d29a69";
    for (let x = -((camera * 1.05) % 72); x < VIEW_WIDTH; x += 72) {
      context.fillRect(x, GROUND_Y + 12, 4, VIEW_HEIGHT - GROUND_Y);
      context.fillRect(x + 4, GROUND_Y + 34, 68, 4);
    }

    PLATFORMS.forEach((platform) => {
      const x = platform.x - camera;
      if (x < -platform.width || x > VIEW_WIDTH) return;
      context.fillStyle = "#2d263b";
      context.fillRect(x, platform.y, platform.width, platform.height + 16);
      context.fillStyle = "#f0a66c";
      context.fillRect(x, platform.y, platform.width, 7);
      context.fillStyle = "#77617b";
      for (let brace = 12; brace < platform.width; brace += 42) context.fillRect(x + brace, platform.y + 7, 5, platform.height + 9);
    });

    [540, 1850, 2820, 4070].forEach((x, index) => {
      const screenX = x - camera;
      if (screenX < -140 || screenX > VIEW_WIDTH) return;
      context.drawImage(this.images.car, 0, 96, 60, 48, screenX, GROUND_Y - 70, 120, 96);
      if (index % 2) { context.fillStyle = "#231b32"; context.fillRect(screenX + 16, GROUND_Y - 12, 95, 14); }
    });

    this.crates.forEach((crate) => {
      if (crate.opened) return;
      const x = crate.x - camera;
      if (x < -60 || x > VIEW_WIDTH) return;
      context.drawImage(this.images.chest, 0, 0, 48, 24, x, crate.y, 72, 36);
    });

    this.hostages.forEach((hostage) => this.drawHostage(hostage));
    this.pickups.forEach((pickup) => this.drawPickup(pickup));
    const bossZone = 4460 - camera;
    if (bossZone > -300 && bossZone < VIEW_WIDTH + 200) {
      context.fillStyle = "#342237";
      context.fillRect(bossZone, 160, 460, GROUND_Y - 160);
      context.fillStyle = "#e0a05e";
      for (let y = 176; y < GROUND_Y; y += 54) context.fillRect(bossZone + 18, y, 420, 7);
    }
  }

  private drawEntities() {
    const context = this.context;
    const camera = this.cameraX;
    this.enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      const x = enemy.x - camera;
      if (x < -150 || x > VIEW_WIDTH + 150) return;
      if (enemy.kind === "tank") {
        const frame = Math.floor(enemy.animationTime * 6) % 7;
        this.drawSheetFrame(this.images.tank, 72, 48, enemy.hp / enemy.maxHp < 0.5 ? 3 : 2, frame, x, enemy.y - 20, 144, 96, enemy.facing);
      } else if (enemy.kind === "dog") {
        const frame = Math.floor(enemy.animationTime * 10) % 7;
        this.drawSheetFrame(this.images.enemyDog, 48, 48, 3, frame, x, enemy.y, 58, 58, enemy.facing);
      } else {
        const image = enemy.kind === "gunner" ? this.images.enemyGunner : this.images.enemySoldier;
        const moving = Math.abs(enemy.vx) > 1;
        const row = moving ? 5 : 0;
        const frames = moving ? 6 : 4;
        this.drawSheetFrame(image, 48, 48, row, Math.floor(enemy.animationTime * 8) % frames, x, enemy.y, 58, 58, enemy.facing);
      }
    });

    const player = this.player;
    const playerX = player.x - camera;
    const crouching = this.previousInput.crouch && player.onGround;
    const aimingUp = this.previousInput.aimUp && !crouching;
    const moving = Math.abs(player.vx) > 18 && player.onGround;
    const row = crouching ? 3 : aimingUp ? 1 : moving ? 5 : 0;
    const frames = moving ? 6 : 4;
    const frame = Math.floor(player.animationTime * (moving ? 10 : 6)) % frames;
    const sprite = player.weapon === "shotgun" ? this.images.playerShotgun : this.images.playerPistol;
    if (player.invulnerable <= 0 || Math.floor(player.invulnerable * 14) % 2) this.drawSheetFrame(sprite, 48, 48, row, frame, playerX - 8, player.y - 8, 64, 64, player.facing);

    this.bullets.forEach((bullet) => {
      const x = bullet.x - camera;
      if (x < -30 || x > VIEW_WIDTH + 30) return;
      context.save();
      context.translate(x, bullet.y);
      context.rotate(Math.atan2(bullet.vy, bullet.vx));
      if (bullet.shell) {
        context.fillStyle = "#3a3044"; context.fillRect(-9, -5, 18, 10); context.fillStyle = "#ffcc65"; context.fillRect(6, -3, 7, 6);
      } else {
        context.shadowColor = bullet.enemy ? "#ff635d" : "#ffe675"; context.shadowBlur = 8;
        context.fillStyle = bullet.enemy ? "#ff796f" : "#fff5a8"; context.fillRect(-8, -2, 16, 4);
      }
      context.restore();
    });

    this.grenades.forEach((grenade) => {
      context.save(); context.translate(grenade.x - camera, grenade.y); context.rotate(grenade.rotation);
      context.drawImage(this.images.grenade, -12, -12, 24, 24); context.restore();
    });
  }

  private drawEffects() {
    const context = this.context;
    this.explosions.forEach((explosion) => {
      const frame = Math.min(7, Math.floor((explosion.age / 0.62) * 8));
      const size = explosion.size;
      context.drawImage(this.images.explosion, frame * 48, 0, 48, 48, explosion.x - this.cameraX - size / 2, explosion.y - size / 2, size, size);
    });
    this.particles.forEach((particle) => {
      context.globalAlpha = clamp(particle.life * 2.5, 0, 1); context.fillStyle = particle.color;
      context.fillRect(particle.x - this.cameraX, particle.y, particle.size, particle.size);
    });
    context.globalAlpha = 1;
  }

  private drawSheetFrame(image: HTMLImageElement, cellW: number, cellH: number, row: number, frame: number, x: number, y: number, width: number, height: number, facing: -1 | 1) {
    const context = this.context;
    context.save();
    if (facing < 0) { context.translate(x + width, y); context.scale(-1, 1); context.drawImage(image, frame * cellW, row * cellH, cellW, cellH, 0, 0, width, height); }
    else context.drawImage(image, frame * cellW, row * cellH, cellW, cellH, x, y, width, height);
    context.restore();
  }

  private drawHostage(hostage: Hostage) {
    if (hostage.rescued) return;
    const x = hostage.x - this.cameraX;
    if (x < -40 || x > VIEW_WIDTH + 40) return;
    const wave = Math.sin(this.elapsed * 5 + hostage.wave) * 3;
    const context = this.context;
    context.fillStyle = "#f6d39c"; context.fillRect(x + 10, GROUND_Y - 48 + wave, 14, 13);
    context.fillStyle = "#fff0cf"; context.fillRect(x + 6, GROUND_Y - 35 + wave, 22, 25);
    context.fillStyle = "#70566e"; context.fillRect(x + 4, GROUND_Y - 10, 10, 10); context.fillRect(x + 21, GROUND_Y - 10, 10, 10);
    context.fillStyle = "#ffda63"; context.font = "bold 10px monospace"; context.fillText("HELP!", x - 2, GROUND_Y - 58 + wave);
  }

  private drawPickup(pickup: Pickup) {
    if (!pickup.active) return;
    const x = pickup.x - this.cameraX;
    if (x < -40 || x > VIEW_WIDTH + 40) return;
    const y = pickup.y + Math.sin(pickup.bob) * 6;
    const labels: Record<PickupKind, string> = { machine: "H", shotgun: "S", health: "+", grenade: "G" };
    const colors: Record<PickupKind, string> = { machine: "#ffd85f", shotgun: "#ff8e59", health: "#6dff91", grenade: "#85d8ff" };
    this.context.fillStyle = "#241d35"; this.context.fillRect(x, y, 32, 32);
    this.context.fillStyle = colors[pickup.kind]; this.context.fillRect(x + 3, y + 3, 26, 26);
    this.context.fillStyle = "#251e34"; this.context.font = "bold 18px monospace"; this.context.fillText(labels[pickup.kind], x + 10, y + 23);
  }

  private drawVignette() {
    const gradient = this.context.createRadialGradient(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 180, VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 620);
    gradient.addColorStop(0, "transparent"); gradient.addColorStop(1, "rgba(16,8,22,.48)");
    this.context.fillStyle = gradient; this.context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  }
}
