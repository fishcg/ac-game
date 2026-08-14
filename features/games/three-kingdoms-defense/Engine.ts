import { defenseAudio } from "./audio";
import { DEFENSE_ASSETS } from "./assets";
import {
  DECREES,
  ENEMIES,
  HERO_POSTS,
  INITIAL_FOOD,
  INITIAL_MORALE,
  MAX_CASTLE_HP,
  ROAD_PATH,
  TOWERS,
  TOWER_SLOTS,
  TOWER_UPGRADE_COST,
  WAVES,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./data";
import {
  calculateScore,
  canAfford,
  damageMultiplier,
  nearestRoadDistance,
  pathLength,
  pickDecreeChoices,
  pointAtDistance,
  selectFrontEnemy,
} from "./rules";
import type {
  DecreeId,
  DefenseCallbacks,
  DefenseHud,
  DefenseStatus,
  Enemy,
  EnemyType,
  Particle,
  Point,
  Projectile,
  Tower,
  TowerBranch,
  TowerType,
} from "./types";

type SpawnTask = { type: EnemyType; remaining: number; timer: number; interval: number };
type FireZone = { x: number; y: number; radius: number; life: number; tick: number };
type FloatingText = { x: number; y: number; value: string; color: string; life: number };
type LoadedAssets = Record<keyof typeof DEFENSE_ASSETS, HTMLImageElement>;

const HERO_RANGE = 112;
const PATH_LENGTH = pathLength();
const MAX_ENEMIES = 100;
const MAX_PROJECTILES = 96;
const MAX_PARTICLES = 180;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const EMPTY_HUD: DefenseHud = {
  castleHp: MAX_CASTLE_HP,
  maxCastleHp: MAX_CASTLE_HP,
  food: INITIAL_FOOD,
  morale: INITIAL_MORALE,
  score: 0,
  wave: 0,
  totalWaves: WAVES.length,
  waveName: "布置防线",
  enemiesAlive: 0,
  nextWaveIn: 8,
  selectedSlotId: null,
  selectedTower: null,
  heroCharge: 0,
  heroReady: false,
  fireReady: true,
  speed: 1,
  message: "先在营地上建造防御，再迎击黄巾军",
  bossHp: null,
  bossName: null,
};

export class ThreeKingdomsDefenseEngine {
  private context: CanvasRenderingContext2D;
  private assets = {} as LoadedAssets;
  private destroyed = false;
  private animation = 0;
  private lastTime = 0;
  private lastHudAt = 0;
  private status: DefenseStatus = "idle";
  private speed: 1 | 2 = 1;
  private castleHp = MAX_CASTLE_HP;
  private food = INITIAL_FOOD;
  private morale = INITIAL_MORALE;
  private kills = 0;
  private score = 0;
  private wave = 0;
  private waveActive = false;
  private nextWaveIn = 8;
  private betweenWaveDelay = 0;
  private spawns: SpawnTask[] = [];
  private enemies: Enemy[] = [];
  private towers: Tower[] = [];
  private projectiles: Projectile[] = [];
  private particles: Particle[] = [];
  private texts: FloatingText[] = [];
  private fireZones: FireZone[] = [];
  private nextId = 1;
  private selectedSlotId: number | null = null;
  private heroPostId = 1;
  private heroCooldown = 0;
  private heroCharge = 0;
  private heroUltTime = 0;
  private fireCooldown = 0;
  private fireTargeting = false;
  private message = EMPTY_HUD.message;
  private messageTime = 0;
  private ownedDecrees = new Set<DecreeId>();
  private repairPerWave = 0;
  private globalDamage = 1;
  private decreeSeed = 913;
  private pendingDecreeAt = 0;
  private bossPhasePulse = 0;
  private bossSandTimer = 0;
  private screenShake = 0;
  private dpr = 1;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  constructor(private canvas: HTMLCanvasElement, private callbacks: DefenseCallbacks) {
    this.context = canvas.getContext("2d", { alpha: false })!;
    this.preloadAssets();
    this.resize();
    this.draw();
  }

  private preloadAssets() {
    for (const [id, source] of Object.entries(DEFENSE_ASSETS) as Array<[keyof typeof DEFENSE_ASSETS, string]>) {
      const image = new Image();
      image.decoding = "async";
      image.src = source;
      image.onload = () => { if (!this.destroyed) this.draw(); };
      this.assets[id] = image;
    }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width || WORLD_WIDTH);
    const cssHeight = Math.max(1, rect.height || WORLD_HEIGHT);
    const pixelBudget = Math.sqrt(3_200_000 / (cssWidth * cssHeight));
    this.dpr = clamp(window.devicePixelRatio || 1, 1, Math.min(2, pixelBudget));
    this.canvas.width = Math.round(cssWidth * this.dpr);
    this.canvas.height = Math.round(cssHeight * this.dpr);
    this.scale = Math.min(this.canvas.width / WORLD_WIDTH, this.canvas.height / WORLD_HEIGHT);
    this.offsetX = (this.canvas.width - WORLD_WIDTH * this.scale) / 2;
    this.offsetY = (this.canvas.height - WORLD_HEIGHT * this.scale) / 2;
    this.context.imageSmoothingEnabled = true;
    this.context.imageSmoothingQuality = "high";
    this.draw();
  }

  start(options?: { debugWave?: number; debugFood?: number; debugNoDefense?: boolean }) {
    this.status = "playing";
    this.speed = 1;
    this.castleHp = MAX_CASTLE_HP;
    this.food = INITIAL_FOOD;
    this.morale = INITIAL_MORALE;
    this.kills = 0;
    this.score = 0;
    this.wave = 0;
    this.waveActive = false;
    this.nextWaveIn = 8;
    this.betweenWaveDelay = 0;
    this.spawns = [];
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
    this.particles = [];
    this.texts = [];
    this.fireZones = [];
    this.nextId = 1;
    this.selectedSlotId = null;
    this.heroPostId = 1;
    this.heroCooldown = 0;
    this.heroCharge = 0;
    this.heroUltTime = 0;
    this.fireCooldown = 0;
    this.fireTargeting = false;
    this.ownedDecrees.clear();
    this.repairPerWave = 0;
    this.globalDamage = 1;
    this.pendingDecreeAt = 0;
    this.bossPhasePulse = 0;
    this.bossSandTimer = 0;
    this.screenShake = 0;
    if (options?.debugWave !== undefined) {
      this.wave = clamp(Math.floor(options.debugWave), 0, WAVES.length - 1);
      this.food = Math.max(this.food, options.debugFood ?? 5000);
      this.morale = 100;
      this.heroCharge = 100;
      if (options.debugNoDefense) {
        this.castleHp = 3;
      } else {
        this.globalDamage = 6;
        const debugBranches: TowerBranch[] = ["fire", "phalanx", "thunder", "rapid", "guard", "boulder"];
        const debugTypes: TowerType[] = ["archer", "spear", "catapult", "archer", "spear", "catapult"];
        this.towers = TOWER_SLOTS.map((slot, index) => ({
          id: this.nextId++, slotId: slot.id, type: debugTypes[index], level: 3,
          branch: debugBranches[index], cooldown: .1 + index * .03,
        }));
      }
      this.nextWaveIn = .4;
    }
    this.setMessage("八秒后敌军抵达，先建一座弓哨与枪兵营", 4);
    this.lastTime = performance.now();
    this.lastHudAt = 0;
    cancelAnimationFrame(this.animation);
    this.animation = requestAnimationFrame(this.tick);
    defenseAudio.start();
    this.callbacks.onStatus("playing", 0, "");
    this.emitHud(true);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.animation);
    defenseAudio.stop();
  }

  togglePause() {
    if (this.status === "playing") {
      this.status = "paused";
      defenseAudio.pause();
      this.callbacks.onStatus("paused", this.score, "战局已暂停");
      this.emitHud(true);
      this.draw();
      return;
    }
    if (this.status === "paused") {
      this.status = "playing";
      defenseAudio.resume();
      this.lastTime = performance.now();
      this.callbacks.onStatus("playing", this.score, "");
      this.emitHud(true);
      this.animation = requestAnimationFrame(this.tick);
    }
  }

  setSpeed(speed: 1 | 2) {
    this.speed = speed;
    this.emitHud(true);
  }

  callWaveEarly() {
    if (this.status !== "playing" || this.waveActive || this.wave >= WAVES.length) return;
    if (this.nextWaveIn > 1) {
      const bonus = Math.round(this.nextWaveIn * 8);
      this.food += bonus;
      this.addText(270, 92, `提前迎敌 +${bonus}`, "#f7d37a");
    }
    this.nextWaveIn = 0;
  }

  pointer(clientX: number, clientY: number) {
    if (this.status !== "playing") return;
    const point = this.clientToWorld(clientX, clientY);
    if (!point) return;

    if (this.fireTargeting) {
      if (nearestRoadDistance(point) > 76) {
        this.setMessage("火攻必须落在敌军行进的道路附近", 2);
        return;
      }
      this.castFire(point);
      return;
    }

    let nearestSlot: (typeof TOWER_SLOTS)[number] | null = null;
    let slotDistance = 44;
    for (const slot of TOWER_SLOTS) {
      const distance = Math.hypot(point.x - slot.x, point.y - slot.y);
      if (distance < slotDistance) { nearestSlot = slot; slotDistance = distance; }
    }
    if (nearestSlot) {
      this.selectedSlotId = nearestSlot.id;
      this.emitHud(true);
      this.draw();
      return;
    }

    for (const post of HERO_POSTS) {
      if (Math.hypot(point.x - post.x, point.y - post.y) < 42) {
        this.heroPostId = post.id;
        defenseAudio.play("build");
        this.setMessage("关羽已调往新的防线", 1.5);
        this.draw();
        return;
      }
    }
    this.selectedSlotId = null;
    this.emitHud(true);
  }

  clearSelection() {
    this.selectedSlotId = null;
    this.fireTargeting = false;
    this.emitHud(true);
    this.draw();
  }

  buildTower(type: TowerType) {
    if (this.status !== "playing" || this.selectedSlotId === null) return false;
    if (this.towers.some((tower) => tower.slotId === this.selectedSlotId)) return false;
    const config = TOWERS[type];
    if (!canAfford(this.food, config.cost)) {
      this.setMessage("军粮不足，击退敌军后可获得更多军粮", 2);
      return false;
    }
    this.food -= config.cost;
    this.towers.push({ id: this.nextId++, slotId: this.selectedSlotId, type, level: 1, branch: null, cooldown: .2 });
    const slot = TOWER_SLOTS.find((item) => item.id === this.selectedSlotId)!;
    this.burst(slot.x, slot.y, config.color, 12);
    defenseAudio.play("build");
    this.setMessage(`${config.name}已投入防守`, 1.5);
    this.emitHud(true);
    return true;
  }

  upgradeTower(branch?: TowerBranch) {
    if (this.status !== "playing" || this.selectedSlotId === null) return false;
    const tower = this.towers.find((item) => item.slotId === this.selectedSlotId);
    if (!tower || tower.level === 3) return false;
    const cost = TOWER_UPGRADE_COST[tower.level];
    if (!canAfford(this.food, cost)) {
      this.setMessage("军粮不足，暂时无法升级", 2);
      return false;
    }
    if (tower.level === 1) {
      const allowed = TOWERS[tower.type].branches.map((item) => item.id);
      if (!branch || !allowed.includes(branch)) return false;
      tower.branch = branch;
    }
    this.food -= cost;
    tower.level = (tower.level + 1) as 2 | 3;
    const slot = TOWER_SLOTS.find((item) => item.id === tower.slotId)!;
    this.burst(slot.x, slot.y, "#ffe5a1", 18);
    defenseAudio.play("upgrade");
    this.setMessage(`${TOWERS[tower.type].name}升至 ${tower.level} 级`, 1.5);
    this.emitHud(true);
    return true;
  }

  sellTower() {
    if (this.status !== "playing" || this.selectedSlotId === null) return;
    const index = this.towers.findIndex((tower) => tower.slotId === this.selectedSlotId);
    if (index < 0) return;
    const tower = this.towers[index];
    const spent = TOWERS[tower.type].cost + (tower.level >= 2 ? TOWER_UPGRADE_COST[1] : 0) + (tower.level >= 3 ? TOWER_UPGRADE_COST[2] : 0);
    this.food += Math.round(spent * .65);
    this.towers.splice(index, 1);
    defenseAudio.play("build");
    this.setMessage("已撤除营地，并返还六成军粮", 1.5);
    this.emitHud(true);
  }

  prepareFire() {
    if (this.status !== "playing") return false;
    if (this.fireCooldown > 0) { this.setMessage(`火攻还需 ${Math.ceil(this.fireCooldown)} 秒`, 1.5); return false; }
    if (this.morale < 30) { this.setMessage("士气不足，火攻需要 30 点士气", 2); return false; }
    this.fireTargeting = !this.fireTargeting;
    this.setMessage(this.fireTargeting ? "点击道路施放火攻" : "已取消火攻", 2);
    this.emitHud(true);
    return true;
  }

  useHeroUltimate() {
    if (this.status !== "playing" || this.heroCharge < 100) return false;
    const post = HERO_POSTS.find((item) => item.id === this.heroPostId)!;
    const targets = this.enemies.filter((enemy) => !enemy.dead).sort((a, b) => b.progress - a.progress).slice(0, 18);
    for (const enemy of targets) {
      const position = pointAtDistance(enemy.progress);
      const distance = Math.hypot(position.x - post.x, position.y - post.y);
      if (distance < 250) {
        this.hitEnemy(enemy, enemy.type === "boss" ? 260 : 520, position, "#83f1ce");
        enemy.slowTime = Math.max(enemy.slowTime, 1.2);
      }
    }
    this.heroCharge = 0;
    this.heroUltTime = .7;
    this.screenShake = .32;
    this.burst(post.x, post.y, "#7ff1c7", 46);
    defenseAudio.play("hero");
    this.setMessage("青龙偃月 · 千军辟易！", 2.2);
    this.emitHud(true);
    return true;
  }

  chooseDecree(id: DecreeId) {
    if (this.status !== "decree" || !DECREES[id]) return;
    this.ownedDecrees.add(id);
    if (id === "repair") {
      this.castleHp = Math.min(MAX_CASTLE_HP, this.castleHp + 6);
      this.repairPerWave = 1;
    }
    if (id === "inspire") this.globalDamage *= 1.15;
    this.status = "playing";
    defenseAudio.resume();
    this.nextWaveIn = 10;
    this.setMessage(`军令生效：${DECREES[id].name}`, 2.5);
    this.callbacks.onStatus("playing", this.score, "");
    this.emitHud(true);
    this.lastTime = performance.now();
    this.animation = requestAnimationFrame(this.tick);
  }

  private castFire(point: Point) {
    this.morale -= 30;
    this.fireCooldown = 24;
    this.fireTargeting = false;
    this.fireZones.push({ x: point.x, y: point.y, radius: 88, life: 5.5, tick: 0 });
    this.screenShake = .24;
    this.burst(point.x, point.y, "#ff8b3e", 38);
    defenseAudio.play("fire");
    this.setMessage("烈焰封路！范围内敌军将持续灼烧", 2);
    this.emitHud(true);
  }

  private tick = (time: number) => {
    if (this.destroyed || this.status !== "playing") return;
    const rawDelta = Math.min(.05, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    const delta = rawDelta * this.speed;
    this.update(delta);
    this.draw();
    if (time - this.lastHudAt > 100) { this.lastHudAt = time; this.emitHud(); }
    if (!this.destroyed && this.status === "playing") this.animation = requestAnimationFrame(this.tick);
  };

  private update(delta: number) {
    if (this.messageTime > 0) this.messageTime -= delta;
    this.fireCooldown = Math.max(0, this.fireCooldown - delta);
    this.heroUltTime = Math.max(0, this.heroUltTime - delta);
    this.bossPhasePulse = Math.max(0, this.bossPhasePulse - delta);
    this.screenShake = Math.max(0, this.screenShake - delta);

    if (!this.waveActive) {
      this.nextWaveIn -= delta;
      if (this.nextWaveIn <= 0 && this.wave < WAVES.length) this.beginWave();
    }

    this.updateSpawns(delta);
    this.updateEnemies(delta);
    this.updateTowers(delta);
    this.updateHero(delta);
    this.updateFire(delta);
    this.updateEffects(delta);
    this.checkWaveComplete(delta);
  }

  private beginWave() {
    const config = WAVES[this.wave];
    this.wave += 1;
    this.waveActive = true;
    this.nextWaveIn = 0;
    this.spawns = config.entries.map((entry) => ({ type: entry.type, remaining: entry.count, timer: entry.delay ?? 0, interval: entry.interval }));
    this.setMessage(`第 ${this.wave} 波 · ${config.name}`, 3);
    if (this.wave === WAVES.length) defenseAudio.play("boss");
  }

  private updateSpawns(delta: number) {
    for (const task of this.spawns) {
      task.timer -= delta;
      while (task.remaining > 0 && task.timer <= 0 && this.enemies.length < MAX_ENEMIES) {
        this.spawnEnemy(task.type);
        task.remaining -= 1;
        task.timer += task.interval;
      }
    }
    this.spawns = this.spawns.filter((task) => task.remaining > 0);
  }

  private spawnEnemy(type: EnemyType) {
    const config = ENEMIES[type];
    const waveScale = 1 + Math.max(0, this.wave - 1) * .085;
    const maxHp = Math.round(config.hp * waveScale);
    this.enemies.push({
      id: this.nextId++, type, hp: maxHp, maxHp, progress: 0, speed: config.speed,
      reward: config.reward, castleDamage: config.castleDamage, dead: false,
      burnTime: 0, burnTick: 0, slowTime: 0, hitFlash: 0, phase: 1,
    });
  }

  private updateEnemies(delta: number) {
    let leakedDamage = 0;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - delta);
      enemy.slowTime = Math.max(0, enemy.slowTime - delta);
      if (enemy.burnTime > 0) {
        enemy.burnTime -= delta;
        enemy.burnTick -= delta;
        if (enemy.burnTick <= 0) {
          enemy.burnTick += .45;
          this.hitEnemy(enemy, 7 + this.wave * 1.5, pointAtDistance(enemy.progress), "#ff963f", false);
        }
      }
      if (enemy.dead) continue;
      if (enemy.type === "boss" && enemy.phase === 1 && enemy.hp / enemy.maxHp <= .5) {
        enemy.phase = 2;
        enemy.speed *= 1.32;
        this.bossPhasePulse = 2.5;
        this.bossSandTimer = 0;
        this.screenShake = .45;
        this.setMessage("张梁施展黄天妖术：狂沙遮日！", 3.5);
        defenseAudio.play("boss");
      }
      if (enemy.type === "boss" && enemy.phase === 2) {
        this.bossSandTimer -= delta;
        if (this.bossSandTimer <= 0) {
          this.bossSandTimer = 4.6;
          this.morale = Math.max(0, this.morale - 4);
          const position = pointAtDistance(enemy.progress);
          this.burst(position.x, position.y, "#e5b64a", 28);
          this.setMessage("黄沙符咒吞噬了 4 点士气", 1.5);
        }
      }
      const speedFactor = enemy.slowTime > 0 ? .55 : 1;
      enemy.progress += enemy.speed * speedFactor * delta;
      if (enemy.progress >= PATH_LENGTH) {
        enemy.dead = true;
        leakedDamage += enemy.castleDamage;
      }
    }
    if (leakedDamage > 0) {
      this.castleHp = Math.max(0, this.castleHp - leakedDamage);
      this.screenShake = .35;
      defenseAudio.play("leak");
      this.setMessage(`敌军撞击城门，耐久 -${leakedDamage}`, 2);
      if (this.castleHp <= 0) this.finish("lost", "城门失守，重新布阵再战");
    }
    this.enemies = this.enemies.filter((enemy) => !enemy.dead);
  }

  private updateTowers(delta: number) {
    if (this.enemies.length === 0) return;
    const positions = new Map<number, Point>();
    for (const enemy of this.enemies) positions.set(enemy.id, pointAtDistance(enemy.progress));
    const sandPenalty = this.enemies.some((enemy) => enemy.type === "boss" && enemy.phase === 2) ? 1.14 : 1;
    for (const tower of this.towers) {
      tower.cooldown -= delta;
      if (tower.cooldown > 0) continue;
      const config = TOWERS[tower.type];
      const slot = TOWER_SLOTS.find((item) => item.id === tower.slotId)!;
      let range = config.range * (1 + (tower.level - 1) * .08);
      if (tower.type === "archer" && this.ownedDecrees.has("strongBow")) range *= 1.1;
      const target = selectFrontEnemy(this.enemies, positions, slot, range);
      if (!target) { tower.cooldown = .08; continue; }
      const targetPoint = positions.get(target.id)!;
      let damage = config.damage * (1 + (tower.level - 1) * .6);
      let cooldown = config.cooldown * (1 - (tower.level - 1) * .1) * sandPenalty;
      if (tower.type === "archer" && this.ownedDecrees.has("strongBow")) damage *= 1.35;
      if (tower.type === "spear" && this.ownedDecrees.has("spearWall")) damage *= 1.35;
      if (tower.branch === "rapid") { cooldown *= .58; damage *= .82; }
      if (tower.branch === "boulder") { damage *= 1.9; cooldown *= 1.38; }
      damage *= damageMultiplier(tower.type, target.type, tower.branch) * this.globalDamage;
      if (tower.type === "catapult") this.areaHit(targetPoint, damage, tower.branch === "thunder" ? 66 : 46, target.id);
      else this.hitEnemy(target, damage, targetPoint, config.color);
      if (tower.type === "spear" && target.type === "cavalry") target.slowTime = Math.max(target.slowTime, tower.branch === "phalanx" ? 1.5 : .65);
      if (tower.branch === "fire") { target.burnTime = Math.max(target.burnTime, 3); target.burnTick = 0; }
      this.addProjectile(slot, targetPoint, config.color, tower.type === "catapult" ? 8 : 4);
      defenseAudio.play(tower.type === "archer" ? "arrow" : tower.type === "spear" ? "spear" : "stone");
      tower.cooldown = Math.max(.14, cooldown);
    }
  }

  private updateHero(delta: number) {
    this.heroCooldown -= delta;
    if (this.heroCooldown > 0 || this.enemies.length === 0) return;
    const post = HERO_POSTS.find((item) => item.id === this.heroPostId)!;
    const candidates = this.enemies.filter((enemy) => {
      const point = pointAtDistance(enemy.progress);
      return Math.hypot(point.x - post.x, point.y - post.y) <= HERO_RANGE;
    }).sort((a, b) => b.progress - a.progress);
    const target = candidates[0];
    if (!target) { this.heroCooldown = .1; return; }
    const targetPoint = pointAtDistance(target.progress);
    const damage = 30 * this.globalDamage * (this.ownedDecrees.has("militia") ? 1.25 : 1);
    this.hitEnemy(target, damage, targetPoint, "#7be0b4");
    this.addProjectile(post, targetPoint, "#7be0b4", 6);
    this.heroCharge = clamp(this.heroCharge + (this.ownedDecrees.has("militia") ? 6 : 4.5), 0, 100);
    this.heroCooldown = this.ownedDecrees.has("militia") ? .58 : .78;
    defenseAudio.play("spear");
  }

  private updateFire(delta: number) {
    for (const zone of this.fireZones) {
      zone.life -= delta;
      zone.tick -= delta;
      if (zone.tick <= 0) {
        zone.tick += .35;
        for (const enemy of this.enemies) {
          const point = pointAtDistance(enemy.progress);
          if (Math.hypot(point.x - zone.x, point.y - zone.y) <= zone.radius) {
            this.hitEnemy(enemy, enemy.type === "boss" ? 18 : 34, point, "#ff7038", false);
            enemy.burnTime = Math.max(enemy.burnTime, 1.4);
          }
        }
        if (this.particles.length < MAX_PARTICLES) this.burst(zone.x + (Math.random() - .5) * 70, zone.y + (Math.random() - .5) * 36, "#ff933f", 3);
      }
    }
    this.fireZones = this.fireZones.filter((zone) => zone.life > 0);
  }

  private updateEffects(delta: number) {
    for (const projectile of this.projectiles) projectile.age += delta;
    this.projectiles = this.projectiles.filter((projectile) => projectile.age < projectile.duration);
    for (const particle of this.particles) {
      particle.age += delta; particle.x += particle.vx * delta; particle.y += particle.vy * delta; particle.vy += 75 * delta;
    }
    this.particles = this.particles.filter((particle) => particle.age < particle.life);
    for (const text of this.texts) { text.life -= delta; text.y -= 24 * delta; }
    this.texts = this.texts.filter((text) => text.life > 0);
  }

  private checkWaveComplete(delta: number) {
    if (!this.waveActive || this.spawns.length > 0 || this.enemies.length > 0) return;
    this.betweenWaveDelay += delta;
    if (this.betweenWaveDelay < .5) return;
    this.betweenWaveDelay = 0;
    this.waveActive = false;
    this.castleHp = Math.min(MAX_CASTLE_HP, this.castleHp + this.repairPerWave);
    this.food += 70 + this.wave * 15;
    this.morale = Math.min(100, this.morale + 12);
    if (this.wave >= WAVES.length) {
      this.finish("won", "张梁败退，黄巾围村之危已解");
      return;
    }
    if (this.wave === 2 || this.wave === 4) {
      this.pendingDecreeAt = this.wave;
      const choices = pickDecreeChoices(Object.keys(DECREES), this.ownedDecrees, this.decreeSeed + this.wave, 3) as DecreeId[];
      this.status = "decree";
      defenseAudio.pause();
      this.callbacks.onStatus("decree", this.score, "请选择一项军令");
      this.callbacks.onDecree(choices);
      this.emitHud(true);
      return;
    }
    this.nextWaveIn = 10;
    this.setMessage(`第 ${this.wave} 波守住了！获得军粮与士气补给`, 3);
  }

  private hitEnemy(enemy: Enemy, damage: number, point: Point, color: string, feedback = true) {
    if (enemy.dead) return;
    enemy.hp -= damage;
    enemy.hitFlash = .09;
    if (feedback && this.particles.length < MAX_PARTICLES - 4) this.burst(point.x, point.y, color, 3);
    if (enemy.hp > 0) return;
    enemy.dead = true;
    this.kills += 1;
    this.food += enemy.reward;
    const moraleGain = enemy.type === "boss" ? 30 : enemy.type === "siege" ? 4 : 1;
    this.morale = Math.min(100, this.morale + moraleGain * (this.ownedDecrees.has("inspire") ? 1.3 : 1));
    this.heroCharge = Math.min(100, this.heroCharge + (enemy.type === "boss" ? 20 : 1.3));
    this.score = calculateScore(this.kills, this.food, this.castleHp, this.wave);
    if (this.texts.length < 18) this.addText(point.x, point.y - 20, `+${enemy.reward}`, "#f7d37a");
    if (enemy.type === "boss") { this.screenShake = .65; this.burst(point.x, point.y, "#fff0aa", 60); }
  }

  private areaHit(center: Point, damage: number, radius: number, directId: number) {
    for (const enemy of this.enemies) {
      const point = pointAtDistance(enemy.progress);
      if (Math.hypot(point.x - center.x, point.y - center.y) > radius) continue;
      this.hitEnemy(enemy, damage * (enemy.id === directId ? 1 : .68), point, "#d8a968", enemy.id === directId);
    }
  }

  private addProjectile(from: Point, to: Point, color: string, size: number) {
    if (this.projectiles.length >= MAX_PROJECTILES) return;
    this.projectiles.push({ active: true, x: from.x, y: from.y, tx: to.x, ty: to.y, age: 0, duration: .16, color, size });
  }

  private burst(x: number, y: number, color: string, count: number) {
    const available = Math.min(count, MAX_PARTICLES - this.particles.length);
    for (let index = 0; index < available; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 28 + Math.random() * 78;
      this.particles.push({ active: true, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 22, age: 0, life: .35 + Math.random() * .45, color, size: 2 + Math.random() * 4 });
    }
  }

  private addText(x: number, y: number, value: string, color: string) {
    if (this.texts.length >= 20) this.texts.shift();
    this.texts.push({ x, y, value, color, life: .9 });
  }

  private finish(status: "won" | "lost", message: string) {
    if (this.status === "won" || this.status === "lost") return;
    this.status = status;
    this.score = calculateScore(this.kills, this.food, this.castleHp, this.wave);
    defenseAudio.stop();
    this.callbacks.onStatus(status, this.score, message);
    this.emitHud(true);
    this.draw();
  }

  private emitHud(force = false) {
    if (!force && this.destroyed) return;
    const selectedTower = this.selectedSlotId === null ? null : this.towers.find((tower) => tower.slotId === this.selectedSlotId) ?? null;
    const boss = this.enemies.find((enemy) => enemy.type === "boss" && !enemy.dead);
    this.callbacks.onHud({
      castleHp: this.castleHp,
      maxCastleHp: MAX_CASTLE_HP,
      food: Math.round(this.food),
      morale: Math.round(this.morale),
      score: this.score,
      wave: this.wave,
      totalWaves: WAVES.length,
      waveName: this.wave > 0 ? WAVES[this.wave - 1]?.name ?? "战局结束" : "布置防线",
      enemiesAlive: this.enemies.length + this.spawns.reduce((sum, task) => sum + task.remaining, 0),
      nextWaveIn: Math.max(0, this.nextWaveIn),
      selectedSlotId: this.selectedSlotId,
      selectedTower: selectedTower ? { ...selectedTower } : null,
      heroCharge: this.heroCharge,
      heroReady: this.heroCharge >= 100,
      fireReady: this.fireCooldown <= 0 && this.morale >= 30,
      speed: this.speed,
      message: this.messageTime > 0 ? this.message : "点击营地建塔，点击绿色军旗调动关羽",
      bossHp: boss ? Math.max(0, boss.hp / boss.maxHp) : null,
      bossName: boss ? `${ENEMIES.boss.name}${boss.phase === 2 ? " · 黄天化身" : ""}` : null,
    });
  }

  private setMessage(message: string, duration: number) {
    this.message = message;
    this.messageTime = duration;
    this.emitHud(true);
  }

  private clientToWorld(clientX: number, clientY: number): Point | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width * this.canvas.width - this.offsetX) / this.scale;
    const y = ((clientY - rect.top) / rect.height * this.canvas.height - this.offsetY) / this.scale;
    if (x < 0 || x > WORLD_WIDTH || y < 0 || y > WORLD_HEIGHT) return null;
    return { x, y };
  }

  private draw() {
    const ctx = this.context;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#203a31";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const shakeX = this.screenShake > 0 ? (Math.random() - .5) * 7 * this.scale : 0;
    const shakeY = this.screenShake > 0 ? (Math.random() - .5) * 7 * this.scale : 0;
    ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX + shakeX, this.offsetY + shakeY);
    this.drawBackground(ctx);
    this.drawFireZones(ctx);
    this.drawSlots(ctx);
    this.drawTowers(ctx);
    this.drawHero(ctx);
    this.drawEnemies(ctx);
    this.drawProjectiles(ctx);
    this.drawEffects(ctx);
    if (this.bossPhasePulse > 0) {
      ctx.fillStyle = `rgba(210,154,48,${Math.min(.32, this.bossPhasePulse * .12)})`;
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    }
    if (this.status === "paused") {
      ctx.fillStyle = "rgba(17,25,22,.56)"; ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      ctx.fillStyle = "#fff1c4"; ctx.font = "700 28px system-ui"; ctx.textAlign = "center"; ctx.fillText("战局暂停", WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    }
  }

  private drawBackground(ctx: CanvasRenderingContext2D) {
    const background = this.assets.battlefield;
    if (background?.complete && background.naturalWidth) {
      ctx.drawImage(background, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      ctx.fillStyle = "rgba(25,48,36,.07)"; ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    } else {
      const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
      gradient.addColorStop(0, "#759c68"); gradient.addColorStop(.55, "#9f9a5c"); gradient.addColorStop(1, "#546f50");
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    }
    ctx.save();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(65,43,29,.26)"; ctx.lineWidth = 62; ctx.beginPath();
    ROAD_PATH.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.stroke();
    ctx.strokeStyle = "rgba(202,164,103,.38)"; ctx.lineWidth = 50; ctx.stroke();
    ctx.strokeStyle = "rgba(255,229,159,.14)"; ctx.lineWidth = 3; ctx.setLineDash([7, 13]); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#562f26"; ctx.fillRect(488, 780, 52, 95);
    ctx.fillStyle = "#d0a666"; ctx.fillRect(495, 792, 45, 8);
    ctx.fillStyle = "#3e4c3c"; ctx.fillRect(501, 800, 39, 75);
  }

  private drawSlots(ctx: CanvasRenderingContext2D) {
    for (const slot of TOWER_SLOTS) {
      const occupied = this.towers.some((tower) => tower.slotId === slot.id);
      const selected = this.selectedSlotId === slot.id;
      ctx.save(); ctx.translate(slot.x, slot.y);
      ctx.fillStyle = occupied ? "rgba(22,37,31,.22)" : selected ? "rgba(255,222,142,.88)" : "rgba(44,68,52,.72)";
      ctx.strokeStyle = selected ? "#fff0aa" : "rgba(244,218,150,.78)"; ctx.lineWidth = selected ? 4 : 2;
      ctx.beginPath(); ctx.ellipse(0, 7, 29, 18, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (!occupied) { ctx.fillStyle = "#fff0c1"; ctx.font = "700 22px system-ui"; ctx.textAlign = "center"; ctx.fillText("+", 0, 14); }
      ctx.restore();
    }
    for (const post of HERO_POSTS) {
      ctx.save(); ctx.translate(post.x, post.y); ctx.globalAlpha = this.heroPostId === post.id ? 1 : .55;
      ctx.fillStyle = "#3b765c"; ctx.fillRect(-2, -17, 4, 30);
      ctx.fillStyle = this.heroPostId === post.id ? "#79e0ae" : "#49725e"; ctx.beginPath(); ctx.moveTo(2, -17); ctx.lineTo(20, -10); ctx.lineTo(2, -3); ctx.fill();
      ctx.restore();
    }
  }

  private drawTowers(ctx: CanvasRenderingContext2D) {
    for (const tower of this.towers) {
      const slot = TOWER_SLOTS.find((item) => item.id === tower.slotId)!;
      const image = this.assets[tower.type];
      ctx.save(); ctx.translate(slot.x, slot.y);
      if (image?.complete && image.naturalWidth) ctx.drawImage(image, -35 - tower.level * 2, -51 - tower.level * 3, 70 + tower.level * 4, 70 + tower.level * 4);
      else {
        ctx.fillStyle = TOWERS[tower.type].color; ctx.strokeStyle = "#293c32"; ctx.lineWidth = 3;
        ctx.fillRect(-18, -27, 36, 35); ctx.strokeRect(-18, -27, 36, 35);
        ctx.fillStyle = "#59432e"; ctx.fillRect(-24, 6, 48, 8);
      }
      ctx.fillStyle = "#1b2823"; ctx.strokeStyle = "#f1d58d"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(-14, 14, 28, 12, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff3c8"; ctx.font = "700 9px system-ui"; ctx.textAlign = "center"; ctx.fillText(`LV.${tower.level}`, 0, 23);
      ctx.restore();
    }
  }

  private drawHero(ctx: CanvasRenderingContext2D) {
    const post = HERO_POSTS.find((item) => item.id === this.heroPostId)!;
    ctx.save(); ctx.translate(post.x, post.y);
    if (this.heroUltTime > 0) {
      const effect = this.assets.heroEffect;
      ctx.globalAlpha = clamp(this.heroUltTime * 1.7, 0, 1);
      if (effect?.complete && effect.naturalWidth) ctx.drawImage(effect, -105, -120, 210, 160);
      else { ctx.strokeStyle = "rgba(103,255,203,.7)"; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, -18, 45 + this.heroUltTime * 80, -.8, 2.7); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    const image = this.assets.guanYu;
    if (image?.complete && image.naturalWidth) ctx.drawImage(image, -39, -72, 78, 78);
    else { ctx.fillStyle = "#2d8a68"; ctx.beginPath(); ctx.arc(0, -20, 22, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#123227"; ctx.fillRect(-25, 9, 50, 5);
    ctx.fillStyle = "#59d39e"; ctx.fillRect(-25, 9, 50 * (this.heroCharge / 100), 5);
    ctx.restore();
  }

  private drawEnemies(ctx: CanvasRenderingContext2D) {
    for (const enemy of this.enemies) {
      const point = pointAtDistance(enemy.progress);
      const size = enemy.type === "boss" ? 82 : enemy.type === "siege" ? 62 : enemy.type === "cavalry" ? 55 : 42;
      ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(point.angle * .08);
      if (enemy.hitFlash > 0) { ctx.shadowColor = "#fff"; ctx.shadowBlur = 14; }
      const image = enemy.type === "boss" ? this.assets.zhangLiang : this.assets[enemy.type];
      if (image?.complete && image.naturalWidth) ctx.drawImage(image, -size / 2, -size * .72, size, size);
      else {
        ctx.fillStyle = enemy.hitFlash > 0 ? "#fff4ca" : ENEMIES[enemy.type].color;
        ctx.strokeStyle = "#372b24"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -14, size * .28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      const barWidth = enemy.type === "boss" ? 64 : 34;
      ctx.fillStyle = "rgba(26,24,21,.85)"; ctx.fillRect(-barWidth / 2, -size * .73 - 7, barWidth, 5);
      ctx.fillStyle = enemy.type === "boss" ? "#d44235" : "#dc5749"; ctx.fillRect(-barWidth / 2, -size * .73 - 7, barWidth * clamp(enemy.hp / enemy.maxHp, 0, 1), 5);
      if (enemy.type === "boss") { ctx.fillStyle = "#fff1bd"; ctx.font = "700 10px system-ui"; ctx.textAlign = "center"; ctx.fillText("张梁", 0, -size * .73 - 11); }
      ctx.restore();
    }
  }

  private drawFireZones(ctx: CanvasRenderingContext2D) {
    for (const zone of this.fireZones) {
      const pulse = 1 + Math.sin(zone.life * 14) * .05;
      const gradient = ctx.createRadialGradient(zone.x, zone.y, 4, zone.x, zone.y, zone.radius * pulse);
      gradient.addColorStop(0, "rgba(255,235,131,.74)"); gradient.addColorStop(.35, "rgba(255,105,39,.52)"); gradient.addColorStop(1, "rgba(106,28,18,0)");
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.radius * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,193,70,.72)"; ctx.lineWidth = 3; ctx.setLineDash([8, 5]); ctx.stroke(); ctx.setLineDash([]);
      const effect = this.assets.fireEffect;
      if (effect?.complete && effect.naturalWidth) {
        ctx.globalAlpha = clamp(zone.life, 0, 1) * .86;
        ctx.drawImage(effect, zone.x - zone.radius, zone.y - zone.radius * .78, zone.radius * 2, zone.radius * 1.55);
        ctx.globalAlpha = 1;
      }
    }
  }

  private drawProjectiles(ctx: CanvasRenderingContext2D) {
    for (const projectile of this.projectiles) {
      const ratio = clamp(projectile.age / projectile.duration, 0, 1);
      const x = projectile.x + (projectile.tx - projectile.x) * ratio;
      const y = projectile.y + (projectile.ty - projectile.y) * ratio - Math.sin(ratio * Math.PI) * (projectile.size > 6 ? 24 : 5);
      ctx.strokeStyle = projectile.color; ctx.lineWidth = Math.max(2, projectile.size * .45); ctx.globalAlpha = 1 - ratio * .35;
      ctx.beginPath(); ctx.moveTo(projectile.x + (projectile.tx - projectile.x) * Math.max(0, ratio - .18), projectile.y + (projectile.ty - projectile.y) * Math.max(0, ratio - .18)); ctx.lineTo(x, y); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  private drawEffects(ctx: CanvasRenderingContext2D) {
    for (const particle of this.particles) {
      ctx.globalAlpha = 1 - particle.age / particle.life; ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    ctx.textAlign = "center";
    for (const text of this.texts) {
      ctx.globalAlpha = clamp(text.life * 1.5, 0, 1); ctx.fillStyle = text.color; ctx.strokeStyle = "rgba(22,28,24,.75)"; ctx.lineWidth = 3;
      ctx.font = "800 13px system-ui"; ctx.strokeText(text.value, text.x, text.y); ctx.fillText(text.value, text.x, text.y);
    }
    ctx.globalAlpha = 1;
    if (this.fireTargeting) {
      ctx.fillStyle = "rgba(255,211,107,.9)"; ctx.strokeStyle = "#6f2d20"; ctx.lineWidth = 3;
      ctx.font = "800 15px system-ui"; ctx.textAlign = "center"; ctx.strokeText("点击道路落下火攻", WORLD_WIDTH / 2, 112); ctx.fillText("点击道路落下火攻", WORLD_WIDTH / 2, 112);
    }
    if (this.bossPhasePulse > 0) {
      const effect = this.assets.sandEffect;
      if (effect?.complete && effect.naturalWidth) {
        ctx.globalAlpha = clamp(this.bossPhasePulse / 2.5, 0, 1) * .55;
        ctx.drawImage(effect, 90, 230, 360, 300);
        ctx.globalAlpha = 1;
      }
    }
  }
}
