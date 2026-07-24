import { PLANET_PORTRAITS, preloadPlanetPortraits } from "./assets";
import { planetMergeAudio } from "./audio";
import {
  BIN_FLOOR,
  BIN_LEFT,
  BIN_RIGHT,
  MAX_PLANETS,
  PLANET_HEIGHT,
  PLANET_TIERS,
  PLANET_WIDTH,
  WARNING_Y,
} from "./data";
import { canMerge, isDangerous, mergeScore, missionForTier, nextDropKind } from "./rules";
import type { DropKind, PlanetBall, PlanetCallbacks, PlanetMergeStatus } from "./types";

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };
type Wave = { x: number; y: number; radius: number; life: number; color: string };
type FloatingLabel = { x: number; y: number; life: number; color: string; title: string; value: string };
type PlanetSprite = { image: HTMLCanvasElement; size: number };
type ImpactFlash = { x: number; y: number; life: number; size: number; color: string; angle: number };
type MergeSigil = { x: number; y: number; life: number; radius: number; color: string; rotation: number; tier: number };

export class PlanetMergeEngine {
  private context: CanvasRenderingContext2D;
  private background: HTMLCanvasElement;
  private portraits: HTMLImageElement[];
  private planetSprites: Array<PlanetSprite | null> = Array.from({ length: PLANET_TIERS.length }, () => null);
  private destroyed = false;
  private animation = 0;
  private lastTime = 0;
  private accumulator = 0;
  private lastHud = 0;
  private status: PlanetMergeStatus = "idle";
  private balls: PlanetBall[] = [];
  private particles: Particle[] = [];
  private waves: Wave[] = [];
  private labels: FloatingLabel[] = [];
  private impacts: ImpactFlash[] = [];
  private sigils: MergeSigil[] = [];
  private nextId = 1;
  private dropX = (BIN_LEFT + BIN_RIGHT) / 2;
  private current: DropKind = 0;
  private upcoming: DropKind = 0;
  private score = 0;
  private combo = 0;
  private comboTime = 0;
  private drops = 0;
  private maxTier = 0;
  private danger = 0;
  private dropCooldown = 0;
  private moveDirection = 0;
  private randomState = 1;
  private message = "移动投放器，点击落下星球";
  private screenPulse = 0;
  private lastImpactSound = 0;
  private lastImpactVisual = 0;
  private viewScale = 1;
  private viewOffsetX = 0;
  private viewOffsetY = 0;
  private spriteResolution = 2;

  constructor(private canvas: HTMLCanvasElement, private callbacks: PlanetCallbacks) {
    this.context = canvas.getContext("2d")!;
    this.context.imageSmoothingEnabled = true;
    this.context.imageSmoothingQuality = "high";
    this.background = document.createElement("canvas");
    this.portraits = preloadPlanetPortraits((tier) => {
      this.planetSprites[tier] = this.createPlanetSprite(tier);
      if (!this.destroyed) this.draw();
    });
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width || PLANET_WIDTH);
    const cssHeight = Math.max(1, rect.height || PLANET_HEIGHT);
    const pixelBudgetRatio = Math.sqrt(6_200_000 / (cssWidth * cssHeight));
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1, pixelBudgetRatio));
    const pixelWidth = Math.max(1, Math.round(cssWidth * ratio));
    const pixelHeight = Math.max(1, Math.round(cssHeight * ratio));
    this.canvas.width = pixelWidth;
    this.canvas.height = pixelHeight;
    this.viewScale = Math.min(pixelWidth / PLANET_WIDTH, pixelHeight / PLANET_HEIGHT);
    this.viewOffsetX = (pixelWidth - PLANET_WIDTH * this.viewScale) / 2;
    this.viewOffsetY = (pixelHeight - PLANET_HEIGHT * this.viewScale) / 2;
    const nextSpriteResolution = Math.max(2, Math.min(4, Math.ceil(this.viewScale)));
    if (nextSpriteResolution !== this.spriteResolution || !this.background.width) {
      this.spriteResolution = nextSpriteResolution;
      this.rebuildStaticCaches();
    }
    this.context.setTransform(this.viewScale, 0, 0, this.viewScale, this.viewOffsetX, this.viewOffsetY);
    this.context.imageSmoothingEnabled = true;
    this.context.imageSmoothingQuality = "high";
    this.draw();
  }

  private rebuildStaticCaches() {
    const backgroundResolution = Math.min(3, this.spriteResolution);
    this.background.width = PLANET_WIDTH * backgroundResolution;
    this.background.height = PLANET_HEIGHT * backgroundResolution;
    const backgroundContext = this.background.getContext("2d")!;
    backgroundContext.setTransform(backgroundResolution, 0, 0, backgroundResolution, 0, 0);
    this.drawBackdrop(backgroundContext);
    for (let tier = 0; tier < this.portraits.length; tier += 1) {
      if (this.portraits[tier]?.complete && this.portraits[tier].naturalWidth) {
        this.planetSprites[tier] = this.createPlanetSprite(tier);
      }
    }
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.animation);
    for (const portrait of this.portraits) portrait.onload = null;
  }

  start(seed = Date.now()) {
    this.balls = [];
    this.particles = [];
    this.waves = [];
    this.labels = [];
    this.impacts = [];
    this.sigils = [];
    this.nextId = 1;
    this.dropX = (BIN_LEFT + BIN_RIGHT) / 2;
    this.score = 0;
    this.combo = 0;
    this.comboTime = 0;
    this.drops = 0;
    this.maxTier = 0;
    this.danger = 0;
    this.dropCooldown = 0;
    this.moveDirection = 0;
    this.randomState = seed >>> 0 || 1;
    this.current = nextDropKind(this.random, 0, 0);
    this.upcoming = nextDropKind(this.random, 1, 0);
    this.message = "移动投放器，点击落下星球";
    this.screenPulse = 0;
    this.status = "playing";
    this.lastTime = performance.now();
    this.accumulator = 0;
    cancelAnimationFrame(this.animation);
    this.animation = requestAnimationFrame(this.tick);
    this.lastImpactSound = 0;
    this.lastImpactVisual = 0;
    planetMergeAudio.start();
    this.callbacks.onStatus("playing", 0, "");
    this.emitHud(true);
  }

  pointer(clientX: number) {
    const rect = this.canvas.getBoundingClientRect();
    const pixelX = ((clientX - rect.left) / rect.width) * this.canvas.width;
    const x = (pixelX - this.viewOffsetX) / this.viewScale;
    this.dropX = Math.max(BIN_LEFT + 24, Math.min(BIN_RIGHT - 24, x));
  }

  setMove(direction: number) {
    this.moveDirection = Math.max(-1, Math.min(1, direction));
  }

  drop() {
    if (this.status !== "playing" || this.dropCooldown > 0 || this.balls.length >= MAX_PLANETS) return;
    const comet = this.current === "comet";
    const tier = comet ? 0 : (this.current as number);
    const radius = comet ? 17 : PLANET_TIERS[tier].radius;
    this.balls.push({
      id: this.nextId++,
      tier,
      comet,
      x: this.dropX,
      y: 78,
      vx: 0,
      vy: 115,
      radius,
      age: 0,
      mergeLock: 0.18,
      alive: true,
      rotation: 0,
      squash: 0,
      squashVelocity: 0,
      squashAngle: 0,
    });
    this.drops += 1;
    this.dropCooldown = 0.44;
    this.current = this.upcoming;
    this.upcoming = nextDropKind(this.random, this.drops + 1, this.maxTier);
    this.message = comet ? "彗星已投放：可清除前两级小星球" : "寻找相同英灵，让她们相遇";
    this.spawn(this.dropX, 82, comet ? "#fff3b0" : PLANET_TIERS[tier].color, 7);
    planetMergeAudio.drop(tier, comet);
    this.emitHud(true);
  }

  togglePause() {
    if (this.status === "playing") {
      this.status = "paused";
      this.moveDirection = 0;
      this.callbacks.onStatus("paused", this.score, "");
      this.draw();
    } else if (this.status === "paused") {
      this.status = "playing";
      this.lastTime = performance.now();
      this.callbacks.onStatus("playing", this.score, "");
    }
  }

  private random = () => {
    this.randomState = (this.randomState * 1664525 + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  };

  private tick = (time: number) => {
    const delta = Math.min(0.034, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    if (this.status === "playing") this.update(delta);
    this.draw();
    if (this.status === "playing" || this.status === "paused") this.animation = requestAnimationFrame(this.tick);
  };

  private update(delta: number) {
    this.dropCooldown = Math.max(0, this.dropCooldown - delta);
    this.comboTime = Math.max(0, this.comboTime - delta);
    if (this.comboTime <= 0) this.combo = 0;
    this.screenPulse = Math.max(0, this.screenPulse - delta);
    this.dropX = Math.max(BIN_LEFT + 24, Math.min(BIN_RIGHT - 24, this.dropX + this.moveDirection * 310 * delta));
    this.accumulator = Math.min(0.06, this.accumulator + delta);
    let steps = 0;
    while (this.accumulator >= 1 / 120 && steps < 6) {
      this.physics(1 / 120);
      this.accumulator -= 1 / 120;
      steps += 1;
    }
    this.updateEffects(delta);
    const dangerous = this.balls.some(isDangerous);
    this.danger = dangerous ? Math.min(1, this.danger + delta / 2) : Math.max(0, this.danger - delta * 1.8);
    if (this.danger >= 1) {
      this.finish("lost", "星球稳定越过警戒线，星仓已经装满");
      return;
    }
    if (this.balls.length >= MAX_PLANETS) {
      this.finish("lost", "星仓达到安全容量上限");
      return;
    }
    if (this.maxTier >= PLANET_TIERS.length - 1) {
      this.finish("won", "阿尔托莉雅完成最终合成，最大的 Saber 诞生了");
      return;
    }
    this.emitHud(false);
  }

  private physics(dt: number) {
    for (const ball of this.balls) {
      if (!ball.alive) continue;
      ball.age += dt;
      ball.mergeLock = Math.max(0, ball.mergeLock - dt);
      ball.vy += 745 * dt;
      ball.vx *= 0.9992;
      ball.rotation += (ball.vx * dt) / Math.max(10, ball.radius);
      ball.squashVelocity += -ball.squash * 185 * dt;
      ball.squashVelocity *= Math.exp(-12 * dt);
      ball.squash += ball.squashVelocity * dt;
      ball.squash = Math.max(-0.075, Math.min(0.15, ball.squash));
      if (Math.abs(ball.squash) < 0.0008 && Math.abs(ball.squashVelocity) < 0.008) {
        ball.squash = 0;
        ball.squashVelocity = 0;
      }
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.x - ball.radius < BIN_LEFT) {
        const impactSpeed = Math.max(0, -ball.vx);
        ball.x = BIN_LEFT + ball.radius;
        if (impactSpeed > 48) this.onBoundaryImpact(ball, 1, 0, impactSpeed);
        ball.vx = impactSpeed * 0.54;
      }
      if (ball.x + ball.radius > BIN_RIGHT) {
        const impactSpeed = Math.max(0, ball.vx);
        ball.x = BIN_RIGHT - ball.radius;
        if (impactSpeed > 48) this.onBoundaryImpact(ball, -1, 0, impactSpeed);
        ball.vx = -impactSpeed * 0.54;
      }
      if (ball.y + ball.radius > BIN_FLOOR) {
        const impactSpeed = Math.max(0, ball.vy);
        ball.y = BIN_FLOOR - ball.radius;
        if (impactSpeed > 46) this.onBoundaryImpact(ball, 0, -1, impactSpeed);
        const floorBounce = Math.max(0.24, 0.47 - ball.radius / 480);
        ball.vy = -impactSpeed * floorBounce;
        if (Math.abs(ball.vy) < 18) ball.vy = 0;
        ball.vx *= 0.965;
      }
    }

    const additions: PlanetBall[] = [];
    for (let i = 0; i < this.balls.length; i += 1) {
      const a = this.balls[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < this.balls.length; j += 1) {
        const b = this.balls[j];
        if (!b.alive) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.radius + b.radius;
        const distSq = dx * dx + dy * dy;
        if (distSq >= min * min) continue;
        const distance = Math.sqrt(Math.max(0.001, distSq));
        const nx = dx / distance;
        const ny = dy / distance;
        if ((a.comet || b.comet) && this.resolveComet(a, b)) continue;
        if (canMerge(a, b)) {
          const tier = a.tier + 1;
          const x = (a.x + b.x) / 2;
          const y = (a.y + b.y) / 2;
          a.alive = false;
          b.alive = false;
          const radius = PLANET_TIERS[tier].radius;
          additions.push({
            id: this.nextId++,
            tier,
            comet: false,
            x,
            y,
            vx: (a.vx + b.vx) * 0.18,
            vy: Math.min(-55, (a.vy + b.vy) * 0.12),
            radius,
            age: 0,
            mergeLock: 0.22,
            alive: true,
            rotation: (a.rotation + b.rotation) / 2,
            squash: 0.04,
            squashVelocity: 0,
            squashAngle: Math.atan2(dy, dx),
          });
          this.onMerge(tier, x, y);
          continue;
        }
        const overlap = min - distance;
        const total = Math.max(1, a.radius + b.radius);
        const aShare = b.radius / total;
        const bShare = a.radius / total;
        a.x -= nx * overlap * aShare;
        a.y -= ny * overlap * aShare;
        b.x += nx * overlap * bShare;
        b.y += ny * overlap * bShare;
        const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (relative < -46) this.onImpact(a, b, nx, ny, -relative);
        if (relative < 0) {
          const averageRadius = (a.radius + b.radius) / 2;
          const restitution = Math.max(0.32, 0.55 - averageRadius / 310);
          const impulse = (-(1 + restitution) * relative) / (1 / a.radius + 1 / b.radius);
          a.vx -= (impulse * nx) / a.radius;
          a.vy -= (impulse * ny) / a.radius;
          b.vx += (impulse * nx) / b.radius;
          b.vy += (impulse * ny) / b.radius;
        }
      }
    }
    if (additions.length) this.balls.push(...additions);
    if (additions.length || this.balls.some((ball) => !ball.alive)) this.balls = this.balls.filter((ball) => ball.alive);
  }

  private resolveComet(a: PlanetBall, b: PlanetBall) {
    const comet = a.comet ? a : b;
    const target = a.comet ? b : a;
    if (target.comet) return false;
    comet.alive = false;
    if (target.tier <= 1) {
      target.alive = false;
      this.score += 60 + target.tier * 80;
      this.message = `彗星清除了 ${PLANET_PORTRAITS[target.tier].shortName}`;
      this.spawn(target.x, target.y, "#fff0a8", 20);
      this.waves.push({ x: target.x, y: target.y, radius: 10, life: 0.55, color: "#fff0a8" });
      this.screenPulse = 0.12;
      this.impacts.push({ x: target.x, y: target.y, life: 0.3, size: 22, color: "#fff0a8", angle: 0 });
      planetMergeAudio.cometImpact(this.panFor(target.x));
      return true;
    }
    target.vy -= 90;
    target.vx += (target.x < comet.x ? -1 : 1) * 34;
    this.message = `彗星撞击了 ${PLANET_PORTRAITS[target.tier].shortName}，但只能清理前两级星球`;
    this.spawn(comet.x, comet.y, "#fff0a8", 9);
    this.impacts.push({ x: comet.x, y: comet.y, life: 0.22, size: 15, color: "#fff0a8", angle: 0 });
    planetMergeAudio.cometImpact(this.panFor(comet.x));
    return true;
  }

  private onMerge(tier: number, x: number, y: number) {
    this.combo = this.comboTime > 0 ? this.combo + 1 : 1;
    this.comboTime = 1.65;
    const gained = mergeScore(tier, this.combo);
    this.score += gained;
    this.maxTier = Math.max(this.maxTier, tier);
    this.message = this.combo > 1
      ? `连续合成 ×${this.combo} · ${PLANET_PORTRAITS[tier].shortName}登场`
      : `召唤 ${PLANET_PORTRAITS[tier].character} · +${gained}`;
    this.spawn(x, y, PLANET_TIERS[tier].color, Math.min(26, 10 + tier * 2));
    this.waves.push({ x, y, radius: 12, life: 0.68, color: PLANET_TIERS[tier].color });
    if (tier >= 4) this.waves.push({ x, y, radius: 4, life: 0.5, color: "#fff6cf" });
    this.sigils.push({
      x,
      y,
      life: 0.82,
      radius: Math.max(22, PLANET_TIERS[tier].radius * 0.72),
      color: PLANET_TIERS[tier].color,
      rotation: tier * 0.37,
      tier,
    });
    if (this.sigils.length > 8) this.sigils.shift();
    this.labels.push({
      x,
      y: y - Math.max(18, PLANET_TIERS[tier].radius * 0.7),
      life: 1.05,
      color: PLANET_TIERS[tier].color,
      title: PLANET_PORTRAITS[tier].shortName,
      value: `+${gained}`,
    });
    if (this.labels.length > 10) this.labels.shift();
    this.screenPulse = Math.min(0.22, 0.06 + tier * 0.015);
    planetMergeAudio.merge(tier, this.combo, this.panFor(x));
    this.emitHud(true);
  }

  private onImpact(a: PlanetBall, b: PlanetBall, nx: number, ny: number, speed: number) {
    const intensity = Math.min(1, speed / 235);
    const angle = Math.atan2(ny, nx);
    const squash = Math.min(0.14, 0.025 + intensity * 0.105);
    a.squash = Math.max(a.squash, squash);
    b.squash = Math.max(b.squash, squash);
    a.squashVelocity = 0;
    b.squashVelocity = 0;
    a.squashAngle = angle;
    b.squashAngle = angle;

    const now = performance.now();
    const x = a.x + nx * a.radius;
    const y = a.y + ny * a.radius;
    const tier = Math.max(a.tier, b.tier);
    const color = PLANET_TIERS[tier].color;
    if (now - this.lastImpactVisual > 28) {
      this.lastImpactVisual = now;
      this.impacts.push({ x, y, life: 0.15 + intensity * 0.12, size: 5 + intensity * 13, color, angle });
      if (this.impacts.length > 12) this.impacts.shift();
      this.spawn(x, y, color, Math.round(2 + intensity * 4));
      if (intensity > 0.72 && this.waves.length < 14) {
        this.waves.push({ x, y, radius: 3, life: 0.2, color });
      }
    }
    if (now - this.lastImpactSound > 58) {
      this.lastImpactSound = now;
      planetMergeAudio.impact(intensity, tier, this.panFor(x));
    }
  }

  private onBoundaryImpact(ball: PlanetBall, nx: number, ny: number, speed: number) {
    const intensity = Math.min(1, speed / 420);
    const angle = Math.atan2(ny, nx);
    const squash = Math.min(0.145, 0.028 + intensity * 0.115);
    ball.squash = Math.max(ball.squash, squash);
    ball.squashVelocity = 0;
    ball.squashAngle = angle;

    const x = ball.x - nx * ball.radius;
    const y = ball.y - ny * ball.radius;
    const color = PLANET_TIERS[ball.tier].color;
    const now = performance.now();
    if (now - this.lastImpactVisual > 30) {
      this.lastImpactVisual = now;
      this.impacts.push({ x, y, life: 0.14 + intensity * 0.13, size: 5 + intensity * 14, color, angle });
      if (this.impacts.length > 12) this.impacts.shift();
      this.spawn(x, y, color, Math.round(2 + intensity * 5));
    }
    if (now - this.lastImpactSound > 58) {
      this.lastImpactSound = now;
      planetMergeAudio.impact(Math.max(0.18, intensity), ball.tier, this.panFor(x));
    }
  }

  private panFor(x: number) {
    return Math.max(-0.72, Math.min(0.72, ((x - PLANET_WIDTH / 2) / (PLANET_WIDTH / 2)) * 0.9));
  }

  private spawn(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count && this.particles.length < 140; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 45 + (i % 6) * 17;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 15,
        life: 0.55 + (i % 3) * 0.08,
        color,
        size: 2 + (i % 4),
      });
    }
  }

  private updateEffects(delta: number) {
    for (const particle of this.particles) {
      particle.life -= delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vy += 90 * delta;
    }
    this.particles = this.particles.filter((item) => item.life > 0);
    for (const wave of this.waves) {
      wave.life -= delta;
      wave.radius += 170 * delta;
    }
    this.waves = this.waves.filter((item) => item.life > 0);
    for (const label of this.labels) {
      label.life -= delta;
      label.y -= 19 * delta;
    }
    this.labels = this.labels.filter((item) => item.life > 0);
    for (const impact of this.impacts) impact.life -= delta;
    this.impacts = this.impacts.filter((item) => item.life > 0);
    for (const sigil of this.sigils) {
      sigil.life -= delta;
      sigil.radius += 26 * delta;
      sigil.rotation += delta * (sigil.tier % 2 ? -1.7 : 1.7);
    }
    this.sigils = this.sigils.filter((item) => item.life > 0);
  }

  private finish(status: "won" | "lost", message: string) {
    this.status = status;
    this.moveDirection = 0;
    this.message = message;
    if (status === "won") this.score += 12000;
    this.callbacks.onStatus(status, this.score, message);
    this.emitHud(true);
    planetMergeAudio.finish(status === "won");
  }

  private emitHud(force: boolean) {
    const now = performance.now();
    if (!force && now - this.lastHud < 95) return;
    this.lastHud = now;
    this.callbacks.onHud({
      score: this.score,
      combo: this.combo,
      drops: this.drops,
      maxTier: this.maxTier,
      next: this.upcoming,
      danger: this.danger,
      mission: missionForTier(this.maxTier),
      message: this.message,
      planets: this.balls.length,
    });
  }

  private draw() {
    const c = this.context;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = "#070a21";
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.restore();
    c.drawImage(this.background, 0, 0, PLANET_WIDTH, PLANET_HEIGHT);
    this.drawBin(c);
    this.drawGuide(c);
    this.drawSigils(c);
    for (const ball of this.balls) this.drawPlanet(c, ball);
    this.drawImpacts(c);
    for (const wave of this.waves) {
      c.save();
      c.globalAlpha = Math.max(0, wave.life / 0.68);
      c.strokeStyle = wave.color;
      c.lineWidth = 4;
      c.shadowColor = wave.color;
      c.shadowBlur = 18;
      c.beginPath();
      c.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
    for (const particle of this.particles) {
      c.save();
      c.globalAlpha = Math.min(1, particle.life / 0.5);
      c.fillStyle = particle.color;
      c.shadowColor = particle.color;
      c.shadowBlur = 9;
      c.translate(particle.x, particle.y);
      c.rotate(Math.PI / 4 + particle.life * 7);
      c.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
      c.restore();
    }
    for (const label of this.labels) {
      c.save();
      c.globalAlpha = Math.min(1, label.life / 0.35);
      c.textAlign = "center";
      c.shadowColor = "#07091d";
      c.shadowBlur = 7;
      c.fillStyle = "#fffaf0";
      c.font = "700 12px ui-rounded, sans-serif";
      c.fillText(label.title, label.x, label.y);
      c.fillStyle = label.color;
      c.font = "800 10px ui-rounded, sans-serif";
      c.fillText(label.value, label.x, label.y + 12);
      c.restore();
    }
    if (this.screenPulse > 0) {
      c.fillStyle = `rgba(255,255,255,${this.screenPulse * 0.42})`;
      c.fillRect(0, 0, PLANET_WIDTH, PLANET_HEIGHT);
    }
    if (this.status === "paused") {
      c.fillStyle = "#080a20dc";
      c.fillRect(0, 0, PLANET_WIDTH, PLANET_HEIGHT);
      c.fillStyle = "#fff";
      c.textAlign = "center";
      c.font = "700 32px Georgia";
      c.fillText("星海暂停", PLANET_WIDTH / 2, PLANET_HEIGHT / 2);
    }
  }

  private drawSigils(c: CanvasRenderingContext2D) {
    for (const sigil of this.sigils) {
      const alpha = Math.max(0, Math.min(1, sigil.life / 0.45));
      c.save();
      c.translate(sigil.x, sigil.y);
      c.rotate(sigil.rotation);
      c.globalCompositeOperation = "screen";
      c.globalAlpha = alpha * 0.72;
      c.strokeStyle = sigil.color;
      c.fillStyle = sigil.color;
      c.shadowColor = sigil.color;
      c.shadowBlur = 14;
      c.lineWidth = 1.4;
      c.beginPath();
      c.arc(0, 0, sigil.radius, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = alpha * 0.42;
      c.setLineDash([3, 5]);
      c.beginPath();
      c.arc(0, 0, sigil.radius * 0.72, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      c.globalAlpha = alpha * 0.58;
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2;
        const innerX = Math.cos(angle) * sigil.radius * 0.42;
        const innerY = Math.sin(angle) * sigil.radius * 0.42;
        const outerX = Math.cos(angle) * sigil.radius * 0.92;
        const outerY = Math.sin(angle) * sigil.radius * 0.92;
        c.beginPath();
        c.moveTo(innerX, innerY);
        c.lineTo(outerX, outerY);
        c.stroke();
        c.save();
        c.translate(outerX, outerY);
        c.rotate(Math.PI / 4);
        const node = Math.max(1.5, sigil.radius * 0.045);
        c.fillRect(-node / 2, -node / 2, node, node);
        c.restore();
      }
      c.restore();
    }
  }

  private drawImpacts(c: CanvasRenderingContext2D) {
    for (const impact of this.impacts) {
      const alpha = Math.max(0, Math.min(1, impact.life / 0.16));
      c.save();
      c.translate(impact.x, impact.y);
      c.rotate(impact.angle);
      c.globalCompositeOperation = "screen";
      c.globalAlpha = alpha;
      c.strokeStyle = "#ffffff";
      c.fillStyle = impact.color;
      c.shadowColor = impact.color;
      c.shadowBlur = 12;
      c.lineCap = "round";
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(-impact.size, 0);
      c.lineTo(impact.size, 0);
      c.moveTo(0, -impact.size * 0.48);
      c.lineTo(0, impact.size * 0.48);
      c.stroke();
      c.rotate(Math.PI / 4);
      c.globalAlpha = alpha * 0.7;
      c.fillRect(-2.3, -2.3, 4.6, 4.6);
      c.restore();
    }
  }

  private drawBackdrop(c: CanvasRenderingContext2D) {
    const sky = c.createLinearGradient(0, 0, 0, PLANET_HEIGHT);
    sky.addColorStop(0, "#080b24");
    sky.addColorStop(0.48, "#171946");
    sky.addColorStop(1, "#080b23");
    c.fillStyle = sky;
    c.fillRect(0, 0, PLANET_WIDTH, PLANET_HEIGHT);

    const violetNebula = c.createRadialGradient(180, 370, 20, 180, 370, 310);
    violetNebula.addColorStop(0, "#7d4fd34f");
    violetNebula.addColorStop(0.45, "#42349b24");
    violetNebula.addColorStop(1, "#17194600");
    c.fillStyle = violetNebula;
    c.fillRect(0, 0, PLANET_WIDTH, PLANET_HEIGHT);

    const blueNebula = c.createRadialGradient(780, 160, 10, 780, 160, 280);
    blueNebula.addColorStop(0, "#4eb9e845");
    blueNebula.addColorStop(0.44, "#3350bc1f");
    blueNebula.addColorStop(1, "#17194600");
    c.fillStyle = blueNebula;
    c.fillRect(0, 0, PLANET_WIDTH, PLANET_HEIGHT);

    for (let i = 0; i < 92; i += 1) {
      const x = (i * 157 + (i % 7) * 19) % PLANET_WIDTH;
      const y = (i * 83 + (i % 5) * 11) % PLANET_HEIGHT;
      const size = 0.7 + (i % 4) * 0.55;
      c.globalAlpha = 0.18 + (i % 5) * 0.13;
      c.fillStyle = i % 9 === 0 ? "#ffe7a8" : i % 6 === 0 ? "#c9a9ff" : "#ccefff";
      c.beginPath();
      c.arc(x, y, size, 0, Math.PI * 2);
      c.fill();
      if (i % 17 === 0) {
        c.strokeStyle = c.fillStyle;
        c.lineWidth = 0.7;
        c.beginPath();
        c.moveTo(x - size * 4, y);
        c.lineTo(x + size * 4, y);
        c.moveTo(x, y - size * 4);
        c.lineTo(x, y + size * 4);
        c.stroke();
      }
    }
    c.globalAlpha = 1;

    c.save();
    c.translate(480, 315);
    c.strokeStyle = "#c3a6ff17";
    c.lineWidth = 1;
    for (const radius of [112, 168, 226, 284]) {
      c.beginPath();
      c.arc(0, 0, radius, 0, Math.PI * 2);
      c.stroke();
    }
    c.setLineDash([4, 13]);
    c.strokeStyle = "#83e3ff25";
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(0, 0, 255, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      c.strokeStyle = i % 2 ? "#856cff17" : "#ffda8f1c";
      c.beginPath();
      c.moveTo(Math.cos(angle) * 105, Math.sin(angle) * 105);
      c.lineTo(Math.cos(angle) * 285, Math.sin(angle) * 285);
      c.stroke();
    }
    c.restore();

    c.save();
    c.translate(110, 116);
    c.shadowColor = "#ff9ccd";
    c.shadowBlur = 24;
    const moon = c.createRadialGradient(-12, -14, 4, 0, 0, 42);
    moon.addColorStop(0, "#fff4e4");
    moon.addColorStop(0.35, "#f5a9d2");
    moon.addColorStop(1, "#7352c5");
    c.fillStyle = moon;
    c.beginPath();
    c.arc(0, 0, 37, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 0.3;
    c.fillStyle = "#593f9b";
    c.beginPath();
    c.arc(12, -8, 8, 0, Math.PI * 2);
    c.arc(-14, 13, 5, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  private drawBin(c: CanvasRenderingContext2D) {
    const glass = c.createLinearGradient(BIN_LEFT, 112, BIN_RIGHT, BIN_FLOOR);
    glass.addColorStop(0, "#10152b99");
    glass.addColorStop(0.45, "#12183dba");
    glass.addColorStop(1, "#060a20de");
    c.fillStyle = glass;
    c.fillRect(BIN_LEFT, 112, BIN_RIGHT - BIN_LEFT, BIN_FLOOR - 112);

    c.strokeStyle = "#8adfff1c";
    c.lineWidth = 1;
    for (let x = BIN_LEFT + 32; x < BIN_RIGHT; x += 42) {
      c.beginPath();
      c.moveTo(x, 112);
      c.lineTo(x, BIN_FLOOR);
      c.stroke();
    }
    for (let y = 126; y < BIN_FLOOR; y += 42) {
      c.beginPath();
      c.moveTo(BIN_LEFT, y);
      c.lineTo(BIN_RIGHT, y);
      c.stroke();
    }

    const wall = c.createLinearGradient(BIN_LEFT - 10, 0, BIN_LEFT + 5, 0);
    wall.addColorStop(0, "#27458e");
    wall.addColorStop(0.23, "#86e9ff");
    wall.addColorStop(0.48, "#e8fbff");
    wall.addColorStop(1, "#3158b4");
    c.shadowColor = "#4ccfff";
    c.shadowBlur = 12;
    c.fillStyle = wall;
    c.fillRect(BIN_LEFT - 10, 104, 12, BIN_FLOOR - 96);
    c.save();
    c.translate(BIN_RIGHT + 10, 0);
    c.scale(-1, 1);
    c.fillStyle = wall;
    c.fillRect(0, 104, 12, BIN_FLOOR - 96);
    c.restore();
    c.shadowBlur = 0;

    const floor = c.createLinearGradient(0, BIN_FLOOR, 0, BIN_FLOOR + 13);
    floor.addColorStop(0, "#84ecff");
    floor.addColorStop(0.2, "#4068c2");
    floor.addColorStop(1, "#17245d");
    c.fillStyle = floor;
    c.fillRect(BIN_LEFT - 10, BIN_FLOOR, BIN_RIGHT - BIN_LEFT + 20, 13);
    c.fillStyle = "#c5f7ff";
    c.fillRect(BIN_LEFT, BIN_FLOOR, BIN_RIGHT - BIN_LEFT, 2);

    c.setLineDash([12, 8]);
    c.strokeStyle = this.danger > 0 ? `rgba(255,92,128,${0.45 + this.danger * 0.55})` : "#ff7b9b69";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(BIN_LEFT + 2, WARNING_Y);
    c.lineTo(BIN_RIGHT - 2, WARNING_Y);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = "#ffb0c1";
    c.font = "700 9px sans-serif";
    c.textAlign = "right";
    c.fillText("警戒线", BIN_LEFT - 18, WARNING_Y + 3);
  }

  private drawGuide(c: CanvasRenderingContext2D) {
    const comet = this.current === "comet";
    const tier = comet ? 0 : (this.current as number);
    const radius = comet ? 17 : PLANET_TIERS[tier].radius;
    c.save();
    c.globalAlpha = 0.3;
    c.setLineDash([4, 9]);
    c.strokeStyle = comet ? "#fff1a0" : PLANET_TIERS[tier].color;
    c.lineWidth = 2;
    c.shadowColor = c.strokeStyle;
    c.shadowBlur = 8;
    c.beginPath();
    c.moveTo(this.dropX, 72);
    c.lineTo(this.dropX, Math.max(100, WARNING_Y - 5));
    c.stroke();
    c.setLineDash([]);
    c.globalAlpha = 0.72;
    if (comet) this.drawComet(c, this.dropX, 70, radius, 0);
    else this.drawPlanetShape(c, this.dropX, 70, radius, tier, 0);
    c.restore();
  }

  private drawPlanet(c: CanvasRenderingContext2D, ball: PlanetBall) {
    if (ball.comet) {
      this.drawComet(c, ball.x, ball.y, ball.radius, ball.rotation);
      return;
    }
    this.drawPlanetShape(c, ball.x, ball.y, ball.radius, ball.tier, ball.rotation, ball.squash, ball.squashAngle);
  }

  private createPlanetSprite(tier: number): PlanetSprite | null {
    const portrait = this.portraits[tier];
    if (!portrait?.complete || !portrait.naturalWidth) return null;
    const radius = PLANET_TIERS[tier].radius;
    const size = Math.ceil(radius * 3.55);
    const resolution = this.spriteResolution;
    const image = document.createElement("canvas");
    image.width = size * resolution;
    image.height = size * resolution;
    const c = image.getContext("2d")!;
    c.scale(resolution, resolution);
    c.translate(size / 2, size / 2);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    this.paintPlanetVisual(c, radius, tier, portrait);
    return { image, size };
  }

  private drawPlanetShape(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    tier: number,
    rotation: number,
    squash = 0,
    squashAngle = 0,
  ) {
    c.save();
    c.translate(x, y);
    if (Math.abs(squash) > 0.0005) {
      c.rotate(squashAngle);
      c.scale(1 - squash, 1 + squash);
      c.rotate(rotation - squashAngle);
    } else {
      c.rotate(rotation);
    }
    const sprite = this.planetSprites[tier];
    if (sprite) c.drawImage(sprite.image, -sprite.size / 2, -sprite.size / 2, sprite.size, sprite.size);
    else this.paintPlanetVisual(c, radius, tier, null);
    c.restore();
  }

  private paintPlanetVisual(
    c: CanvasRenderingContext2D,
    radius: number,
    tier: number,
    portrait: HTMLImageElement | null,
  ) {
    const style = PLANET_TIERS[tier];
    const hasRing = tier === 5 || tier === 7 || tier === 9;
    if (hasRing) {
      c.save();
      c.rotate(-0.18);
      c.shadowColor = style.color;
      c.shadowBlur = 12 + tier;
      const ring = c.createLinearGradient(-radius * 1.35, 0, radius * 1.35, 0);
      ring.addColorStop(0, `${style.shade}99`);
      ring.addColorStop(0.45, "#fff7d9");
      ring.addColorStop(1, `${style.color}dd`);
      c.strokeStyle = ring;
      c.lineWidth = Math.max(3, radius * 0.11);
      c.beginPath();
      c.ellipse(0, 0, radius * 1.35, radius * 0.34, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }

    c.shadowColor = style.color;
    c.shadowBlur = 12 + tier * 1.8;
    const shell = c.createRadialGradient(-radius * 0.34, -radius * 0.4, radius * 0.05, 0, 0, radius);
    shell.addColorStop(0, "#ffffff");
    shell.addColorStop(0.12, style.color);
    shell.addColorStop(0.72, style.shade);
    shell.addColorStop(1, "#070b24");
    c.fillStyle = shell;
    c.beginPath();
    c.arc(0, 0, radius, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;

    const inner = radius * 0.84;
    c.save();
    c.beginPath();
    c.arc(0, 0, inner, 0, Math.PI * 2);
    c.clip();
    if (portrait) {
      c.drawImage(portrait, -inner, -inner, inner * 2, inner * 2);
    } else {
      const fallback = c.createRadialGradient(-inner * 0.3, -inner * 0.35, 1, 0, 0, inner);
      fallback.addColorStop(0, "#fff9");
      fallback.addColorStop(0.22, style.color);
      fallback.addColorStop(1, style.shade);
      c.fillStyle = fallback;
      c.fillRect(-inner, -inner, inner * 2, inner * 2);
    }
    const vignette = c.createLinearGradient(0, -inner, 0, inner);
    vignette.addColorStop(0, "#ffffff08");
    vignette.addColorStop(0.55, "#00000000");
    vignette.addColorStop(1, `${style.shade}88`);
    c.fillStyle = vignette;
    c.fillRect(-inner, -inner, inner * 2, inner * 2);
    c.restore();

    const rim = c.createConicGradient(-0.7, 0, 0);
    rim.addColorStop(0, "#ffffff");
    rim.addColorStop(0.2, style.color);
    rim.addColorStop(0.48, "#ffffff99");
    rim.addColorStop(0.78, style.shade);
    rim.addColorStop(1, "#ffffff");
    c.strokeStyle = rim;
    c.lineWidth = Math.max(2, radius * 0.09);
    c.beginPath();
    c.arc(0, 0, radius * 0.94, 0, Math.PI * 2);
    c.stroke();

    c.save();
    c.globalCompositeOperation = "screen";
    c.globalAlpha = 0.72;
    c.strokeStyle = "#ffffff";
    c.lineCap = "round";
    c.lineWidth = Math.max(1.2, radius * 0.055);
    c.beginPath();
    c.arc(0, 0, radius * 0.76, Math.PI * 1.08, Math.PI * 1.52);
    c.stroke();
    c.globalAlpha = 0.55;
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.ellipse(-radius * 0.36, -radius * 0.44, radius * 0.12, radius * 0.065, -0.5, 0, Math.PI * 2);
    c.fill();
    if (tier >= 6) {
      c.globalAlpha = 0.46;
      for (let i = 0; i < 3; i += 1) {
        const angle = tier + i * 2.1;
        c.beginPath();
        c.arc(Math.cos(angle) * radius * 0.68, Math.sin(angle) * radius * 0.62, Math.max(1, radius * 0.025), 0, Math.PI * 2);
        c.fill();
      }
    }
    c.restore();
  }

  private drawComet(c: CanvasRenderingContext2D, x: number, y: number, radius: number, rotation: number) {
    c.save();
    c.translate(x, y);
    c.rotate(rotation);
    const tail = c.createLinearGradient(-radius * 3, 0, radius, 0);
    tail.addColorStop(0, "#ffffff00");
    tail.addColorStop(0.68, "#95dfff66");
    tail.addColorStop(1, "#fff1a8dd");
    c.fillStyle = tail;
    c.beginPath();
    c.moveTo(-radius * 3, -radius * 0.45);
    c.lineTo(0, -radius);
    c.lineTo(0, radius);
    c.lineTo(-radius * 3, radius * 0.45);
    c.closePath();
    c.fill();
    c.shadowColor = "#fff1a8";
    c.shadowBlur = 18;
    const core = c.createRadialGradient(-radius * 0.3, -radius * 0.35, 1, 0, 0, radius);
    core.addColorStop(0, "#ffffff");
    core.addColorStop(0.34, "#fff3bb");
    core.addColorStop(1, "#dd785f");
    c.fillStyle = core;
    c.strokeStyle = "#ffffff";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0, radius, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = "#7e4261";
    c.font = `700 ${Math.round(radius * 0.95)}px sans-serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("✦", 0, 1);
    c.restore();
  }
}
