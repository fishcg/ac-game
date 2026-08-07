import { BAMBOO_PALETTE } from "./assets";
import { PHRASES, ROUND_SECONDS } from "./data";
import { advancePhraseProgress, advanceTension, completionBonus, finalScore, frameScore, judgeSpeed } from "./rules";
import type { BambooEngineCallbacks, BambooFinishReason, BambooGameStatus, BambooHud, SpeedJudgement } from "./types";

const TAU = Math.PI * 2;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

type Point = { x: number; y: number };
type TrailPoint = Point & { alpha: number };
type Wave = Point & { radius: number; life: number; strength: number; color: string };
type Glyph = Point & { vx: number; vy: number; life: number; rotation: number; text: string; color: string };
type Firefly = Point & { baseX: number; baseY: number; phase: number; speed: number; size: number };

export class BambooCicadaEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly callbacks: BambooEngineCallbacks;
  private resizeObserver: ResizeObserver | null = null;
  private animationFrame = 0;
  private lastTime = performance.now();
  private width = 960;
  private height = 540;
  private dpr = 1;
  private background: HTMLCanvasElement | null = null;
  private status: BambooGameStatus = "idle";
  private remaining = ROUND_SECONDS;
  private score = 0;
  private combo = 0;
  private bestCombo = 0;
  private comboClock = 0;
  private offTargetTime = 0;
  private phraseIndex = 0;
  private phraseProgress = 0;
  private tension = 0;
  private warningPlayed = false;
  private judgement: SpeedJudgement = "silent";
  private pointer = { down: false, id: -1, lift: 0 };
  private target: Point = { x: 480, y: 210 };
  private stick: Point = { x: 480, y: 210 };
  private tube = { x: 486, y: 360, vx: 28, vy: 0 };
  private ropeLength = 145;
  private previousTheta = Math.PI / 2;
  private theta = Math.PI / 2;
  private omega = 0;
  private rps = 0;
  private voice = 0;
  private taut = 0;
  private hudClock = 0;
  private waveClock = 0;
  private glyphClock = 0;
  private trailClock = 0;
  private waves: Wave[] = [];
  private glyphs: Glyph[] = [];
  private trail: TrailPoint[] = [];
  private fireflies: Firefly[] = [];

  constructor(canvas: HTMLCanvasElement, callbacks: BambooEngineCallbacks) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("竹知了画布初始化失败");
    this.canvas = canvas;
    this.context = context;
    this.callbacks = callbacks;
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
    this.canvas.addEventListener("pointercancel", this.handlePointerUp);
    window.addEventListener("keydown", this.handleKeyDown);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(canvas);
    this.resize();
    this.emitHud();
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  start() {
    this.status = "playing";
    this.remaining = ROUND_SECONDS;
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.comboClock = 0;
    this.offTargetTime = 0;
    this.phraseIndex = 0;
    this.phraseProgress = 0;
    this.tension = 0;
    this.warningPlayed = false;
    this.judgement = "silent";
    this.waves.length = 0;
    this.glyphs.length = 0;
    this.trail.length = 0;
    this.resetToy();
    this.lastTime = performance.now();
    this.callbacks.onStatus("playing", 0);
    this.callbacks.onVoice(0, 0);
    this.emitHud();
  }

  pause() {
    if (this.status !== "playing") return;
    this.status = "paused";
    this.pointer.down = false;
    this.callbacks.onVoice(0, 0);
    this.callbacks.onStatus("paused", Math.round(this.score));
    this.emitHud();
  }

  resume() {
    if (this.status !== "paused") return;
    this.status = "playing";
    this.lastTime = performance.now();
    this.callbacks.onStatus("playing", Math.round(this.score));
    this.emitHud();
  }

  togglePause() {
    if (this.status === "playing") this.pause();
    else if (this.status === "paused") this.resume();
  }

  destroy() {
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointercancel", this.handlePointerUp);
    window.removeEventListener("keydown", this.handleKeyDown);
    this.callbacks.onVoice(0, 0);
  }

  private frame = (now: number) => {
    const delta = Math.min(0.04, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;
    if (this.status === "playing") this.update(delta);
    else if (this.status !== "paused") this.updateAmbient(delta, now / 1000);
    this.draw(now / 1000);
    this.animationFrame = requestAnimationFrame(this.frame);
  };

  private update(delta: number) {
    this.remaining = Math.max(0, this.remaining - delta);
    this.updatePhysics(delta);
    this.updateEffects(delta);

    const phrase = PHRASES[Math.min(this.phraseIndex, PHRASES.length - 1)];
    this.judgement = judgeSpeed(this.rps, this.voice, phrase);
    this.phraseProgress = advancePhraseProgress(this.phraseProgress, this.judgement, delta, phrase);
    this.tension = advanceTension(this.tension, this.rps, delta);
    this.score += frameScore(delta, this.rps, this.combo, this.judgement);

    if (this.judgement === "steady") {
      this.offTargetTime = 0;
      this.comboClock += delta;
      if (this.comboClock >= 0.68) {
        this.comboClock -= 0.68;
        this.combo = Math.min(99, this.combo + 1);
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        if (this.combo % 4 === 0) this.callbacks.onEffect("pulse");
      }
    } else {
      this.comboClock = 0;
      this.offTargetTime += delta;
      if (this.offTargetTime > 0.72) this.combo = 0;
    }

    if (this.tension >= 0.55 && !this.warningPlayed) {
      this.warningPlayed = true;
      this.callbacks.onEffect("warning");
    } else if (this.tension < 0.28) {
      this.warningPlayed = false;
    }

    if (this.phraseProgress >= 0.9999) {
      this.score += completionBonus(this.phraseIndex, this.combo);
      this.callbacks.onEffect("phrase");
      this.phraseIndex += 1;
      this.phraseProgress = 0;
      this.combo = Math.min(99, this.combo + 3);
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      if (this.phraseIndex >= PHRASES.length) {
        this.finish("won", "concert-complete");
        return;
      }
    }

    if (this.tension >= 1) {
      this.finish("lost", "rope-broken");
      return;
    }
    if (this.remaining <= 0) {
      this.finish("lost", "time-up");
      return;
    }

    this.callbacks.onVoice(this.rps, this.voice);
    this.hudClock -= delta;
    if (this.hudClock <= 0) {
      this.hudClock = 0.1;
      this.emitHud();
    }
  }

  private updateAmbient(delta: number, time: number) {
    if (this.status === "idle") {
      const centerX = this.width * 0.5;
      const centerY = this.height * 0.38;
      this.target.x = centerX + Math.cos(time * 0.6) * 9;
      this.target.y = centerY + Math.sin(time * 0.8) * 5;
      this.updatePhysics(Math.min(delta, 1 / 30), false);
    }
    this.updateEffects(delta, false);
  }

  private updatePhysics(delta: number, allowVoice = true) {
    const follow = 1 - Math.exp(-delta * 27);
    this.stick.x += (this.target.x - this.stick.x) * follow;
    this.stick.y += (this.target.y - this.stick.y) * follow;

    let accumulator = delta;
    const step = 1 / 180;
    const gravity = clamp(this.height * 2, 760, 1180);
    while (accumulator > 0.00001) {
      const part = Math.min(step, accumulator);
      const dx = this.tube.x - this.stick.x;
      const dy = this.tube.y - this.stick.y;
      const distance = Math.hypot(dx, dy) || 0.0001;
      const ux = dx / distance;
      const uy = dy / distance;
      let accelerationX = -this.tube.vx * 0.38;
      let accelerationY = gravity - this.tube.vy * 0.38;
      if (distance > this.ropeLength) {
        const radialVelocity = this.tube.vx * ux + this.tube.vy * uy;
        const force = -2450 * (distance - this.ropeLength) - 13 * radialVelocity;
        accelerationX += force * ux;
        accelerationY += force * uy;
      }
      this.tube.vx += accelerationX * part;
      this.tube.vy += accelerationY * part;
      this.tube.x += this.tube.vx * part;
      this.tube.y += this.tube.vy * part;
      accumulator -= part;
    }

    const margin = 28;
    if (this.tube.x < margin || this.tube.x > this.width - margin) {
      this.tube.x = clamp(this.tube.x, margin, this.width - margin);
      this.tube.vx *= -0.35;
    }
    if (this.tube.y < margin || this.tube.y > this.height - margin) {
      this.tube.y = clamp(this.tube.y, margin, this.height - margin);
      this.tube.vy *= -0.35;
    }

    this.theta = Math.atan2(this.tube.y - this.stick.y, this.tube.x - this.stick.x);
    let angleDelta = this.theta - this.previousTheta;
    while (angleDelta > Math.PI) angleDelta -= TAU;
    while (angleDelta < -Math.PI) angleDelta += TAU;
    const rawOmega = angleDelta / delta;
    this.omega += (rawOmega - this.omega) * Math.min(1, delta * 9);
    this.previousTheta = this.theta;
    this.rps = Math.min(7, Math.abs(this.omega) / TAU);
    const distance = Math.hypot(this.tube.x - this.stick.x, this.tube.y - this.stick.y);
    this.taut = clamp((distance / this.ropeLength - 0.87) / 0.13, 0, 1);
    const drive = clamp((this.rps - 0.6) / 2.8, 0, 1);
    const targetVoice = allowVoice && this.pointer.down ? Math.pow(drive, 1.18) * this.taut : 0;
    const voiceSpeed = targetVoice > this.voice ? 11 : 3.5;
    this.voice += (targetVoice - this.voice) * Math.min(1, delta * voiceSpeed);
  }

  private updateEffects(delta: number, spawn = true) {
    this.fireflies.forEach((fly) => {
      fly.phase += delta * fly.speed;
      fly.x = fly.baseX + Math.sin(fly.phase * 0.83) * 12;
      fly.y = fly.baseY + Math.cos(fly.phase) * 7;
    });

    this.waves.forEach((wave) => {
      wave.radius += delta * (120 + wave.strength * 150);
      wave.life -= delta;
    });
    this.waves = this.waves.filter((wave) => wave.life > 0);
    this.glyphs.forEach((glyph) => {
      glyph.x += glyph.vx * delta;
      glyph.y += glyph.vy * delta;
      glyph.vy -= delta * 12;
      glyph.rotation += delta * 0.4;
      glyph.life -= delta;
    });
    this.glyphs = this.glyphs.filter((glyph) => glyph.life > 0);
    this.trail.forEach((point) => { point.alpha -= delta * 1.8; });
    this.trail = this.trail.filter((point) => point.alpha > 0);

    if (!spawn) return;
    this.trailClock -= delta;
    if (this.pointer.down && this.trailClock <= 0) {
      this.trailClock = 0.035;
      this.trail.unshift({ x: this.tube.x, y: this.tube.y, alpha: 0.68 });
      if (this.trail.length > 22) this.trail.length = 22;
    }
    this.waveClock -= delta;
    if (this.voice > 0.16 && this.waveClock <= 0) {
      this.waveClock = 0.12;
      this.waves.push({ x: this.tube.x, y: this.tube.y, radius: 18, life: 0.75, strength: this.voice, color: this.currentAccent() });
      if (this.waves.length > 18) this.waves.shift();
    }
    this.glyphClock -= delta;
    if (this.judgement === "steady" && this.glyphClock <= 0) {
      this.glyphClock = 0.28;
      const direction = this.omega >= 0 ? 1 : -1;
      this.glyphs.push({
        x: this.tube.x,
        y: this.tube.y - 14,
        vx: direction * (42 + Math.random() * 38),
        vy: -32 - Math.random() * 25,
        life: 1.05,
        rotation: (Math.random() - 0.5) * 0.5,
        text: Math.random() > 0.5 ? "鸣" : "知",
        color: this.currentAccent(),
      });
      if (this.glyphs.length > 16) this.glyphs.shift();
    }
  }

  private finish(status: "won" | "lost", reason: BambooFinishReason) {
    this.status = status;
    this.pointer.down = false;
    this.voice = 0;
    const result = status === "won" ? finalScore(this.score, this.remaining, this.bestCombo) : Math.max(0, Math.round(this.score));
    this.score = result;
    this.callbacks.onVoice(0, 0);
    this.callbacks.onEffect(status === "won" ? "win" : "lost");
    this.callbacks.onStatus(status, result, reason);
    this.emitHud();
  }

  private emitHud() {
    const hud: BambooHud = {
      status: this.status,
      remaining: this.remaining,
      score: Math.round(this.score),
      combo: this.combo,
      bestCombo: this.bestCombo,
      rps: this.rps,
      voice: this.voice,
      tension: this.tension,
      phraseIndex: Math.min(this.phraseIndex, PHRASES.length - 1),
      phraseProgress: this.phraseProgress,
      judgement: this.judgement,
      direction: this.rps < 0.12 ? 0 : this.omega > 0 ? 1 : -1,
    };
    this.callbacks.onHud(hud);
  }

  private resize = () => {
    const layoutWidth = this.canvas.clientWidth;
    const layoutHeight = this.canvas.clientHeight;
    if (layoutWidth < 1 || layoutHeight < 1) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.width = layoutWidth;
    this.height = layoutHeight;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ropeLength = clamp(Math.min(this.width, this.height) * 0.25, 92, 150);
    this.buildBackground();
    this.resetToy();
  };

  private resetToy() {
    this.target.x = this.stick.x = this.width * 0.5;
    this.target.y = this.stick.y = this.height * 0.38;
    this.tube.x = this.stick.x + 7;
    this.tube.y = this.stick.y + this.ropeLength * 0.94;
    this.tube.vx = 26;
    this.tube.vy = 0;
    this.theta = this.previousTheta = Math.atan2(this.tube.y - this.stick.y, this.tube.x - this.stick.x);
    this.omega = 0;
    this.rps = 0;
    this.voice = 0;
  }

  private buildBackground() {
    const layer = document.createElement("canvas");
    layer.width = Math.round(this.width * this.dpr);
    layer.height = Math.round(this.height * this.dpr);
    const context = layer.getContext("2d");
    if (!context) return;
    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sky = context.createLinearGradient(0, 0, 0, this.height);
    sky.addColorStop(0, BAMBOO_PALETTE.skyTop);
    sky.addColorStop(0.62, "#173745");
    sky.addColorStop(1, BAMBOO_PALETTE.skyBottom);
    context.fillStyle = sky;
    context.fillRect(0, 0, this.width, this.height);

    const glow = context.createRadialGradient(this.width * 0.74, this.height * 0.2, 8, this.width * 0.74, this.height * 0.2, this.height * 0.28);
    glow.addColorStop(0, "#f8e7b633");
    glow.addColorStop(1, "#f8e7b600");
    context.fillStyle = glow;
    context.fillRect(0, 0, this.width, this.height);
    context.fillStyle = BAMBOO_PALETTE.moon;
    context.beginPath();
    context.arc(this.width * 0.76, this.height * 0.2, clamp(this.height * 0.052, 20, 34), 0, TAU);
    context.fill();
    context.fillStyle = "#cdbd9266";
    context.beginPath();
    context.arc(this.width * 0.75, this.height * 0.19, 5, 0, TAU);
    context.fill();

    const random = this.seeded(20260807);
    context.fillStyle = "#f8e7b6";
    for (let index = 0; index < 72; index += 1) {
      context.globalAlpha = 0.18 + random() * 0.52;
      context.beginPath();
      context.arc(random() * this.width, random() * this.height * 0.72, 0.4 + random() * 1.05, 0, TAU);
      context.fill();
    }
    context.globalAlpha = 1;
    this.drawBamboo(context, this.width * 0.04, -0.035, 13, random);
    this.drawBamboo(context, this.width * 0.12, 0.05, 9, random);
    this.drawBamboo(context, this.width * 0.94, 0.025, 12, random);
    this.drawBamboo(context, this.width * 0.87, -0.06, 8, random);

    const ground = context.createLinearGradient(0, this.height * 0.7, 0, this.height);
    ground.addColorStop(0, "#102f2c00");
    ground.addColorStop(1, "#071d20db");
    context.fillStyle = ground;
    context.fillRect(0, this.height * 0.65, this.width, this.height * 0.35);

    const vignette = context.createRadialGradient(this.width * 0.5, this.height * 0.5, this.height * 0.25, this.width * 0.5, this.height * 0.5, this.width * 0.72);
    vignette.addColorStop(0, "#02070a00");
    vignette.addColorStop(1, "#02070a80");
    context.fillStyle = vignette;
    context.fillRect(0, 0, this.width, this.height);
    this.background = layer;

    this.fireflies = Array.from({ length: 16 }, (_, index) => {
      const x = (0.08 + random() * 0.84) * this.width;
      const y = (0.48 + random() * 0.4) * this.height;
      return { x, y, baseX: x, baseY: y, phase: random() * TAU + index, speed: 0.55 + random() * 0.8, size: 1.2 + random() * 1.7 };
    });
  }

  private drawBamboo(context: CanvasRenderingContext2D, startX: number, lean: number, width: number, random: () => number) {
    context.save();
    context.strokeStyle = BAMBOO_PALETTE.bamboo;
    context.fillStyle = BAMBOO_PALETTE.bamboo;
    context.lineCap = "round";
    let x = startX;
    let y = this.height + 25;
    while (y > -80) {
      const segment = 70 + random() * 58;
      const nextX = x + lean * segment + (random() - 0.5) * 5;
      const nextY = y - segment;
      context.lineWidth = width;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(nextX, nextY);
      context.stroke();
      context.lineWidth = 2;
      context.strokeStyle = "#294a3e88";
      context.beginPath();
      context.moveTo(x - width * 0.45, nextY + 4);
      context.lineTo(x + width * 0.45, nextY + 4);
      context.stroke();
      context.strokeStyle = BAMBOO_PALETTE.bamboo;
      if (random() > 0.24) {
        const side = random() > 0.5 ? 1 : -1;
        const leafY = nextY + segment * (0.12 + random() * 0.35);
        for (let leaf = 0; leaf < 3; leaf += 1) {
          const length = 24 + random() * 34;
          context.save();
          context.translate(nextX, leafY + leaf * 10);
          context.rotate(side * (0.42 + leaf * 0.2));
          context.beginPath();
          context.moveTo(0, 0);
          context.quadraticCurveTo(length * 0.55, -5, length, 0);
          context.quadraticCurveTo(length * 0.55, 6, 0, 0);
          context.fill();
          context.restore();
        }
      }
      x = nextX;
      y = nextY;
    }
    context.restore();
  }

  private draw(time: number) {
    const context = this.context;
    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    context.clearRect(0, 0, this.width, this.height);
    if (this.background) context.drawImage(this.background, 0, 0, this.width, this.height);

    this.fireflies.forEach((fly) => {
      const alpha = 0.36 + Math.sin(time * 2.2 + fly.phase) * 0.24;
      context.fillStyle = `rgba(255, 214, 109, ${alpha * 0.2})`;
      context.beginPath();
      context.arc(fly.x, fly.y, fly.size * 3.2, 0, TAU);
      context.fill();
      context.fillStyle = `rgba(248, 211, 111, ${alpha})`;
      context.beginPath();
      context.arc(fly.x, fly.y, fly.size, 0, TAU);
      context.fill();
    });

    this.trail.forEach((point, index) => {
      const radius = Math.max(1.5, 7 - index * 0.24);
      context.fillStyle = `rgba(239, 197, 107, ${point.alpha * 0.42})`;
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, TAU);
      context.fill();
    });

    this.waves.forEach((wave) => {
      context.globalAlpha = Math.min(0.6, wave.life * 0.75);
      context.strokeStyle = wave.color;
      context.lineWidth = 1.5 + wave.strength * 2;
      context.beginPath();
      context.arc(wave.x, wave.y, wave.radius, 0, TAU);
      context.stroke();
    });
    context.globalAlpha = 1;

    if (this.status === "playing" && this.pointer.down) this.drawGuide(context);
    this.drawRopeAndToy(context);

    this.glyphs.forEach((glyph) => {
      context.save();
      context.globalAlpha = clamp(glyph.life, 0, 0.85);
      context.translate(glyph.x, glyph.y);
      context.rotate(glyph.rotation);
      context.fillStyle = glyph.color;
      context.font = `700 ${18 + this.voice * 14}px "STKaiti", "KaiTi", serif`;
      context.textAlign = "center";
      context.fillText(glyph.text, 0, 0);
      context.restore();
    });
    context.globalAlpha = 1;

  }

  private drawGuide(context: CanvasRenderingContext2D) {
    const phrase = PHRASES[Math.min(this.phraseIndex, PHRASES.length - 1)];
    const radius = clamp(Math.min(this.width, this.height) * 0.11, 42, 64);
    context.save();
    context.translate(this.stick.x, this.stick.y);
    context.setLineDash([5, 7]);
    context.lineWidth = 1.5;
    context.strokeStyle = this.judgement === "steady" ? phrase.accent : "#f3dfb25c";
    context.beginPath();
    context.arc(0, 0, radius, -Math.PI * 0.72, Math.PI * 1.04);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = phrase.accent;
    context.beginPath();
    context.moveTo(radius - 5, -11);
    context.lineTo(radius + 7, -3);
    context.lineTo(radius - 6, 3);
    context.closePath();
    context.fill();
    context.restore();
  }

  private drawRopeAndToy(context: CanvasRenderingContext2D) {
    context.save();
    context.strokeStyle = this.tension > 0.55 ? "#ff8c70" : "#e7d7b5";
    context.lineWidth = 1.35 + this.taut * 0.8;
    context.shadowColor = this.tension > 0.55 ? "#ff745d" : "transparent";
    context.shadowBlur = this.tension > 0.55 ? 8 : 0;
    context.beginPath();
    context.moveTo(this.stick.x, this.stick.y);
    context.lineTo(this.tube.x, this.tube.y);
    context.stroke();
    context.shadowBlur = 0;

    const handleAngle = -1.02;
    const handleLength = clamp(this.ropeLength * 0.62, 58, 86);
    context.strokeStyle = "#c58a48";
    context.lineWidth = 7;
    context.lineCap = "round";
    context.shadowColor = "#050b0d88";
    context.shadowBlur = 7;
    context.beginPath();
    context.moveTo(this.stick.x + 4, this.stick.y + 1);
    context.lineTo(this.stick.x + Math.cos(handleAngle) * handleLength, this.stick.y + Math.sin(handleAngle) * handleLength);
    context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = BAMBOO_PALETTE.vermilion;
    context.beginPath();
    context.arc(this.stick.x, this.stick.y, 6, 0, TAU);
    context.fill();
    context.fillStyle = "#f3c76e";
    context.beginPath();
    context.arc(this.stick.x - 1.5, this.stick.y - 1.5, 1.5, 0, TAU);
    context.fill();

    const scale = clamp(Math.min(this.width, this.height) / 530, 0.78, 1.12);
    context.translate(this.tube.x, this.tube.y);
    context.rotate(this.theta - Math.PI / 2);
    context.scale(scale, scale);

    context.fillStyle = "#d6a55755";
    context.strokeStyle = "#e6ba70aa";
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(-18, 11, 13, 31, 0.18, 0, TAU);
    context.ellipse(18, 11, 13, 31, -0.18, 0, TAU);
    context.fill();
    context.stroke();

    const body = context.createLinearGradient(-21, 0, 22, 0);
    body.addColorStop(0, "#9d672e");
    body.addColorStop(0.25, "#d9a84e");
    body.addColorStop(0.58, "#efc66e");
    body.addColorStop(1, "#9b612b");
    context.fillStyle = body;
    context.beginPath();
    context.roundRect(-20, -27, 40, 58, 12);
    context.fill();
    context.strokeStyle = "#6d3e20";
    context.lineWidth = 2.2;
    context.stroke();

    context.strokeStyle = "#79502c88";
    context.lineWidth = 1;
    for (let line = -11; line <= 12; line += 8) {
      context.beginPath();
      context.moveTo(line, -22);
      context.quadraticCurveTo(line + 5, 0, line - 2, 26);
      context.stroke();
    }
    context.fillStyle = BAMBOO_PALETTE.vermilion;
    context.beginPath();
    context.ellipse(0, -27, 21, 6, 0, 0, TAU);
    context.fill();
    context.strokeStyle = "#7a2f24";
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = "#f2d68f";
    context.beginPath();
    context.ellipse(0, -26, 15, 3.2, 0, 0, TAU);
    context.fill();

    context.fillStyle = "#22211c";
    context.beginPath();
    context.arc(-7, -9, 2.7, 0, TAU);
    context.arc(7, -9, 2.7, 0, TAU);
    context.fill();
    context.strokeStyle = "#754423";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(0, 2, 6, 0.15, Math.PI - 0.15);
    context.stroke();
    context.restore();
  }

  private currentAccent() {
    return PHRASES[Math.min(this.phraseIndex, PHRASES.length - 1)]?.accent ?? BAMBOO_PALETTE.gold;
  }

  private mapPointer(event: PointerEvent) {
    const layoutWidth = this.canvas.clientWidth || this.width;
    const layoutHeight = this.canvas.clientHeight || this.height;
    return {
      x: clamp(event.offsetX * this.width / layoutWidth, 12, this.width - 12),
      y: clamp(event.offsetY * this.height / layoutHeight - this.pointer.lift, 12, this.height - 12),
    };
  }

  private handlePointerDown = (event: PointerEvent) => {
    if (this.status !== "playing" || this.pointer.down) return;
    this.pointer.down = true;
    this.pointer.id = event.pointerId;
    this.pointer.lift = event.pointerType === "touch" ? Math.min(68, this.ropeLength * 0.55) : 0;
    this.canvas.setPointerCapture(event.pointerId);
    const position = this.mapPointer(event);
    this.target.x = position.x;
    this.target.y = position.y;
    this.callbacks.onGesture();
    event.preventDefault();
  };

  private handlePointerMove = (event: PointerEvent) => {
    if (!this.pointer.down || event.pointerId !== this.pointer.id) return;
    const position = this.mapPointer(event);
    this.target.x = position.x;
    this.target.y = position.y;
    event.preventDefault();
  };

  private handlePointerUp = (event: PointerEvent) => {
    if (!this.pointer.down || event.pointerId !== this.pointer.id) return;
    this.pointer.down = false;
    this.pointer.id = -1;
    this.callbacks.onVoice(0, 0);
    event.preventDefault();
  };

  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.key.toLowerCase() !== "p") return;
    event.preventDefault();
    this.togglePause();
  };

  private seeded(seed: number) {
    return () => {
      seed |= 0;
      seed = seed + 0x6D2B79F5 | 0;
      let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
      value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }
}
