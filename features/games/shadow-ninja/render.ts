import { GROUND_Y, VIEW_H, VIEW_W } from "./data";
import type { DuelEngine } from "./Engine";
import type { CharacterDef, Fighter, Particle, Projectile, StageDef, TrailSample } from "./types";

type Vec = { x: number; y: number };

const STAGE_W = 1400;

function rng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

function lerpVec(a: Vec, b: Vec, k: number): Vec {
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function easeOut(k: number): number {
  return 1 - (1 - clamp01(k)) * (1 - clamp01(k));
}

function easeIn(k: number): number {
  return clamp01(k) * clamp01(k);
}

// ── 静态舞台层缓存 ─────────────────────────────────────────────

const layerCache = new Map<string, HTMLCanvasElement>();

function getLayer(dpr: number, key: string, paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const cacheKey = `${key}@${dpr}`;
  const hit = layerCache.get(cacheKey);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(STAGE_W * dpr);
  canvas.height = Math.round(VIEW_H * dpr);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.scale(dpr, dpr);
    paint(ctx);
  }
  layerCache.set(cacheKey, canvas);
  return canvas;
}

function drawRidge(
  ctx: CanvasRenderingContext2D,
  w: number,
  baseY: number,
  amp: number,
  step: number,
  seed: number,
  color: string,
): void {
  const rand = rng(seed);
  ctx.beginPath();
  ctx.moveTo(0, baseY + amp);
  for (let x = 0; x <= w + step; x += step) {
    const peak = baseY - rand() * amp;
    ctx.quadraticCurveTo(x - step / 2, baseY + amp * 0.2, x, peak);
  }
  ctx.lineTo(w, VIEW_H);
  ctx.lineTo(0, VIEW_H);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function paintBamboo(ctx: CanvasRenderingContext2D, stage: StageDef): void {
  const rand = rng(19);
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, stage.sky[0]);
  sky.addColorStop(0.52, stage.sky[1]);
  sky.addColorStop(1, stage.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, STAGE_W, VIEW_H);

  for (let i = 0; i < 170; i += 1) {
    const x = rand() * STAGE_W;
    const y = rand() * 340;
    const a = 0.15 + rand() * 0.7;
    ctx.fillStyle = `rgba(214,238,255,${a.toFixed(3)})`;
    ctx.fillRect(x, y, rand() > 0.9 ? 2.2 : 1.4, rand() > 0.9 ? 2.2 : 1.4);
  }

  const moonX = STAGE_W * 0.7;
  const moonY = 118;
  const glow = ctx.createRadialGradient(moonX, moonY, 10, moonX, moonY, 210);
  glow.addColorStop(0, "rgba(198,232,255,0.55)");
  glow.addColorStop(0.4, "rgba(120,180,255,0.14)");
  glow.addColorStop(1, "rgba(80,140,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(moonX - 220, moonY - 220, 440, 440);
  ctx.beginPath();
  ctx.arc(moonX, moonY, 66, 0, Math.PI * 2);
  ctx.fillStyle = "#e8f4ff";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(moonX - 18, moonY - 14, 12, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(180,205,235,0.55)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(moonX + 20, moonY + 18, 8, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(180,205,235,0.4)";
  ctx.fill();

  drawRidge(ctx, STAGE_W, 300, 120, 130, 5, "rgba(24,38,66,0.85)");
  drawRidge(ctx, STAGE_W, 340, 90, 96, 11, "rgba(16,27,50,0.95)");

  for (let i = 0; i < 26; i += 1) {
    const x = rand() * STAGE_W;
    const width = 5 + rand() * 11;
    const height = 250 + rand() * 210;
    const alpha = 0.24 + rand() * 0.4;
    const green = rand() > 0.5 ? "28,62,58" : "22,48,52";
    ctx.fillStyle = `rgba(${green},${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.roundRect(x, GROUND_Y - height, width, height, width / 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(12,30,34,${(alpha * 0.8).toFixed(3)})`;
    ctx.lineWidth = 1.4;
    for (let y = GROUND_Y - height + 24; y < GROUND_Y; y += 46) {
      ctx.beginPath();
      ctx.moveTo(x + 1, y);
      ctx.lineTo(x + width - 1, y);
      ctx.stroke();
    }
    if (rand() > 0.45) {
      ctx.strokeStyle = `rgba(60,110,96,${(alpha * 0.9).toFixed(3)})`;
      ctx.lineWidth = 2.6;
      for (let l = 0; l < 3; l += 1) {
        const ly = GROUND_Y - height + 40 + l * 34;
        const dir = l % 2 === 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(x + width * 0.5, ly);
        ctx.quadraticCurveTo(x + width * 0.5 + dir * 26, ly - 18, x + width * 0.5 + dir * 52, ly - 30);
        ctx.stroke();
      }
    }
  }

  const mist = ctx.createLinearGradient(0, GROUND_Y - 150, 0, GROUND_Y);
  mist.addColorStop(0, "rgba(90,130,170,0)");
  mist.addColorStop(1, "rgba(90,140,180,0.3)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, GROUND_Y - 150, STAGE_W, 150);
}

function paintShrine(ctx: CanvasRenderingContext2D, stage: StageDef): void {
  const rand = rng(43);
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, stage.sky[0]);
  sky.addColorStop(0.5, stage.sky[1]);
  sky.addColorStop(1, stage.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, STAGE_W, VIEW_H);

  const storm = ctx.createRadialGradient(STAGE_W * 0.32, 90, 20, STAGE_W * 0.32, 90, 420);
  storm.addColorStop(0, "rgba(255,236,170,0.32)");
  storm.addColorStop(0.45, "rgba(150,120,200,0.12)");
  storm.addColorStop(1, "rgba(60,40,90,0)");
  ctx.fillStyle = storm;
  ctx.fillRect(0, 0, STAGE_W, 460);

  for (let i = 0; i < 34; i += 1) {
    const x = rand() * STAGE_W;
    const y = 40 + rand() * 260;
    const w = 120 + rand() * 240;
    const h = 16 + rand() * 26;
    ctx.fillStyle = `rgba(58,38,80,${(0.12 + rand() * 0.18).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawRidge(ctx, STAGE_W, 318, 96, 150, 23, "rgba(34,22,52,0.9)");
  drawRidge(ctx, STAGE_W, 356, 62, 110, 29, "rgba(24,15,38,0.95)");

  const gate = (x: number, s: number, alpha: number) => {
    ctx.save();
    ctx.translate(x, GROUND_Y - 8);
    ctx.scale(s, s);
    ctx.fillStyle = `rgba(150,58,64,${alpha})`;
    ctx.fillRect(-62, -34, 9, 34);
    ctx.fillRect(53, -34, 9, 34);
    ctx.fillRect(-74, -44, 148, 9);
    ctx.fillRect(-58, -68, 116, 8);
    ctx.fillRect(-6, -34, 12, 8);
    ctx.shadowColor = `rgba(255,120,110,${alpha * 0.7})`;
    ctx.shadowBlur = 18;
    ctx.fillRect(-74, -44, 148, 4);
    ctx.restore();
  };
  gate(STAGE_W * 0.18, 1.5, 0.72);
  gate(STAGE_W * 0.62, 1.15, 0.55);
  gate(STAGE_W * 0.86, 1.7, 0.66);

  ctx.fillStyle = "rgba(18,12,28,0.9)";
  for (let i = 0; i < 34; i += 1) {
    const x = rand() * STAGE_W;
    const y = GROUND_Y - rand() * 210;
    ctx.fillRect(x, y, 1.6, 5 + rand() * 9);
  }
  const fog = ctx.createLinearGradient(0, GROUND_Y - 190, 0, GROUND_Y);
  fog.addColorStop(0, "rgba(120,100,150,0)");
  fog.addColorStop(1, "rgba(120,100,150,0.28)");
  ctx.fillStyle = fog;
  ctx.fillRect(0, GROUND_Y - 190, STAGE_W, 190);
}

function paintVolcano(ctx: CanvasRenderingContext2D, stage: StageDef): void {
  const rand = rng(71);
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, stage.sky[0]);
  sky.addColorStop(0.48, stage.sky[1]);
  sky.addColorStop(1, stage.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, STAGE_W, VIEW_H);

  const haze = ctx.createRadialGradient(STAGE_W * 0.5, GROUND_Y - 60, 30, STAGE_W * 0.5, GROUND_Y - 60, 620);
  haze.addColorStop(0, "rgba(255,140,60,0.34)");
  haze.addColorStop(1, "rgba(255,80,30,0)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, STAGE_W, GROUND_Y);

  ctx.beginPath();
  ctx.moveTo(STAGE_W * 0.28, GROUND_Y);
  ctx.lineTo(STAGE_W * 0.42, 190);
  ctx.lineTo(STAGE_W * 0.52, 152);
  ctx.lineTo(STAGE_W * 0.62, 196);
  ctx.lineTo(STAGE_W * 0.78, GROUND_Y);
  ctx.closePath();
  ctx.fillStyle = "rgba(28,12,14,0.94)";
  ctx.fill();

  const crater = ctx.createRadialGradient(STAGE_W * 0.52, 156, 4, STAGE_W * 0.52, 156, 70);
  crater.addColorStop(0, "rgba(255,196,90,0.95)");
  crater.addColorStop(0.4, "rgba(255,96,40,0.55)");
  crater.addColorStop(1, "rgba(255,60,20,0)");
  ctx.fillStyle = crater;
  ctx.fillRect(STAGE_W * 0.52 - 90, 80, 180, 170);

  ctx.beginPath();
  ctx.moveTo(STAGE_W * 0.505, 168);
  ctx.lineTo(STAGE_W * 0.49, GROUND_Y);
  ctx.lineTo(STAGE_W * 0.55, GROUND_Y);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,110,40,0.6)";
  ctx.fill();

  drawRidge(ctx, STAGE_W, 392, 54, 120, 37, "rgba(30,14,16,0.92)");

  for (let i = 0; i < 40; i += 1) {
    const x = rand() * STAGE_W;
    const y = 150 + rand() * 260;
    const r = 1 + rand() * 2.6;
    ctx.fillStyle = `rgba(255,150,70,${(0.2 + rand() * 0.5).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintStage(stage: StageDef, dpr: number): HTMLCanvasElement {
  return getLayer(dpr, `stage:${stage.id}`, (ctx) => {
    if (stage.id === "bamboo") paintBamboo(ctx, stage);
    else if (stage.id === "shrine") paintShrine(ctx, stage);
    else paintVolcano(ctx, stage);
  });
}

// ── 地面 ─────────────────────────────────────────────────────

function drawGround(ctx: CanvasRenderingContext2D, stage: StageDef, camX: number, time: number): void {
  ctx.save();
  ctx.translate(-camX, 0);

  const base = ctx.createLinearGradient(0, GROUND_Y, 0, VIEW_H);
  if (stage.id === "volcano") {
    base.addColorStop(0, "#2a1114");
    base.addColorStop(0.5, "#1a0a0c");
    base.addColorStop(1, "#0d0506");
  } else if (stage.id === "shrine") {
    base.addColorStop(0, "#241b32");
    base.addColorStop(0.5, "#181122");
    base.addColorStop(1, "#0c0714");
  } else {
    base.addColorStop(0, "#122029");
    base.addColorStop(0.5, "#0b141c");
    base.addColorStop(1, "#05090d");
  }
  ctx.fillStyle = base;
  ctx.fillRect(-40, GROUND_Y, STAGE_W + 120, VIEW_H - GROUND_Y);

  ctx.fillStyle = `${stage.accent}44`;
  ctx.fillRect(-40, GROUND_Y - 1.5, STAGE_W + 120, 2.4);

  const rand = rng(91);
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 26; i += 1) {
    const x = rand() * STAGE_W;
    const len = 30 + rand() * 120;
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y + 8 + rand() * 20);
    ctx.lineTo(x + len, GROUND_Y + 12 + rand() * 26);
    ctx.stroke();
  }

  if (stage.id === "volcano") {
    const pulse = 0.4 + Math.sin(time * 2.2) * 0.2;
    ctx.strokeStyle = `rgba(255,110,50,${pulse.toFixed(3)})`;
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 5; i += 1) {
      const x = 120 + i * 280 + Math.sin(i * 2.1) * 40;
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y + 2);
      ctx.lineTo(x + 42, GROUND_Y + 26);
      ctx.lineTo(x + 26, GROUND_Y + 48);
      ctx.lineTo(x + 70, GROUND_Y + 74);
      ctx.stroke();
    }
  }

  if (stage.id === "shrine") {
    ctx.fillStyle = "rgba(70,52,96,0.5)";
    for (let i = 0; i < 9; i += 1) {
      ctx.fillRect(-40 + i * 168, GROUND_Y + 12, 8, VIEW_H - GROUND_Y);
    }
  }

  ctx.restore();
}

function drawForegroundAmbience(
  ctx: CanvasRenderingContext2D,
  stage: StageDef,
  camX: number,
  time: number,
): void {
  ctx.save();
  ctx.translate(-camX, 0);
  if (stage.id === "shrine") {
    const rand = rng(131);
    ctx.strokeStyle = "rgba(170,196,255,0.22)";
    ctx.lineWidth = 1.1;
    const drift = (time * 420) % 90;
    for (let i = 0; i < 90; i += 1) {
      const x = (rand() * (STAGE_W + 200) + drift * 0.3) % (STAGE_W + 200);
      const y = ((rand() * VIEW_H + time * 460 + drift) % VIEW_H) - 30;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 7, y + 22);
      ctx.stroke();
    }
    const bolt = Math.pow(Math.max(0, Math.sin(time * 0.83 + 2.1)), 18);
    if (bolt > 0.01) {
      ctx.fillStyle = `rgba(210,226,255,${(bolt * 0.5).toFixed(3)})`;
      ctx.fillRect(0, 0, STAGE_W, GROUND_Y);
    }
  } else if (stage.id === "volcano") {
    const rand = rng(157);
    for (let i = 0; i < 46; i += 1) {
      const x = (rand() * STAGE_W + Math.sin(time * 0.6 + i) * 40) % STAGE_W;
      const y = GROUND_Y - ((rand() * 400 + time * (30 + (i % 7) * 9)) % 400);
      const r = 1.2 + rand() * 2.4;
      ctx.fillStyle = `rgba(255,${120 + (i % 5) * 20},60,${(0.25 + rand() * 0.45).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    for (let i = 0; i < 16; i += 1) {
      const x = (i * 137 + Math.sin(time * 0.5 + i) * 60 + time * 6) % STAGE_W;
      const y = 250 + Math.sin(time * 0.9 + i * 1.7) * 70;
      const a = 0.25 + Math.sin(time * 2.4 + i) * 0.2;
      ctx.fillStyle = `rgba(140,240,220,${Math.max(0, a).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ── 角色姿态 ──────────────────────────────────────────────────

type Pose = {
  lean: number;
  bob: number;
  crouch: number;
  headTilt: number;
  rot: number;
  frontHand: Vec;
  backHand: Vec;
  frontFoot: Vec;
  backFoot: Vec;
  weaponAngle: number;
  scarfFlow: number;
};

function basePose(f: Fighter, time: number): Pose {
  const t = time * 1 + (f.side === 1 ? 1.9 : 0);
  return {
    lean: -0.05,
    bob: Math.sin(t * 3.2) * 1.7,
    crouch: 0,
    headTilt: 0,
    rot: 0,
    frontHand: { x: 27, y: -30 },
    backHand: { x: -7, y: -38 },
    frontFoot: { x: 19, y: 68 },
    backFoot: { x: -21, y: 68 },
    weaponAngle: 0.15,
    scarfFlow: Math.sin(t * 2.6) * 0.5,
  };
}

function attackPose(f: Fighter, p: Pose): void {
  const move = f.move;
  if (!move) return;
  const first = move.hits[0];
  const last = move.hits[move.hits.length - 1];
  const frame = f.moveFrame;
  let k: number;
  if (frame < first.from) k = easeIn(frame / Math.max(1, first.from));
  else if (frame <= last.to) k = 1;
  else k = 1 - easeOut((frame - last.to) / Math.max(1, move.total - last.to));

  if (move.kind === "light") {
    p.frontHand = lerpVec({ x: -8, y: -34 }, { x: 66, y: -26 }, k);
    p.backHand = lerpVec({ x: -24, y: -30 }, { x: -4, y: -46 }, k);
    p.lean = lerp(-0.14, 0.18, k);
    p.frontFoot = lerpVec({ x: 15, y: 68 }, { x: 28, y: 66 }, k);
    p.weaponAngle = lerp(-0.4, 0.12, k);
  } else if (move.kind === "heavy") {
    p.frontHand = { x: lerp(-12, 54, k), y: lerp(-62, -8, k) };
    p.backHand = { x: lerp(-28, 2, k), y: lerp(-24, -48, k) };
    p.lean = lerp(-0.2, 0.24, k);
    p.frontFoot = lerpVec({ x: 13, y: 68 }, { x: 32, y: 66 }, k);
    p.backFoot = { x: -26, y: 68 };
    p.weaponAngle = lerp(-1.15, 0.72, k);
  } else if (move.kind === "special") {
    const shiver = Math.sin(f.moveFrame * 1.3) * 2;
    p.frontHand = { x: 40 + shiver, y: -34 };
    p.backHand = { x: 24 - shiver, y: -46 };
    p.lean = 0.3;
    p.frontFoot = { x: 34, y: 64 };
    p.backFoot = { x: -26, y: 68 };
    p.weaponAngle = 0.1;
  } else {
    const shiver = Math.sin(f.moveFrame * 1.9) * 3;
    p.frontHand = { x: 46 + shiver, y: -40 };
    p.backHand = { x: 30 - shiver, y: -54 };
    p.lean = 0.34;
    p.frontFoot = { x: 38, y: 62 };
    p.backFoot = { x: -30, y: 68 };
    p.weaponAngle = 0;
  }
}

function poseFor(f: Fighter, time: number): Pose {
  const p = basePose(f, time);
  const t = time + (f.side === 1 ? 1.4 : 0);

  if (f.state === "attack" && f.move) {
    attackPose(f, p);
    return p;
  }

  switch (f.state) {
    case "walk": {
      const phase = f.stateFrame * 0.32;
      const swing = Math.sin(phase);
      p.frontFoot = { x: 18 + swing * 20, y: 68 - Math.max(0, swing) * 10 };
      p.backFoot = { x: -20 - swing * 18, y: 68 - Math.max(0, -swing) * 10 };
      p.frontHand = { x: 24 - swing * 6, y: -30 };
      p.backHand = { x: -8 + swing * 8, y: -38 };
      p.lean = 0.06;
      p.bob = Math.abs(Math.sin(phase)) * 1.6;
      break;
    }
    case "air": {
      const falling = f.vy < 0;
      p.frontFoot = { x: 20, y: falling ? 52 : 40 };
      p.backFoot = { x: -12, y: falling ? 40 : 26 };
      p.frontHand = { x: 20, y: -44 };
      p.backHand = { x: -16, y: -50 };
      p.lean = 0.12;
      p.scarfFlow = Math.sin(t * 6) * 1.4;
      break;
    }
    case "block": {
      p.crouch = 9;
      p.frontFoot = { x: 24, y: 59 };
      p.backFoot = { x: -25, y: 59 };
      p.frontHand = { x: 22, y: -34 };
      p.backHand = { x: 14, y: -48 };
      p.lean = -0.02;
      p.bob = 0;
      break;
    }
    case "hit": {
      p.lean = -0.26;
      p.headTilt = -0.22;
      p.frontHand = { x: -6, y: -32 };
      p.backHand = { x: -28, y: -20 };
      p.frontFoot = { x: 10, y: 68 };
      p.backFoot = { x: -28, y: 68 };
      break;
    }
    case "launch": {
      p.rot = Math.max(-0.7, Math.min(0.7, -f.vy * 0.045)) + 0.42;
      p.frontHand = { x: 24, y: -58 };
      p.backHand = { x: -26, y: -46 };
      p.frontFoot = { x: 24, y: 54 };
      p.backFoot = { x: -22, y: 44 };
      break;
    }
    case "down": {
      p.rot = 1.32;
      p.frontHand = { x: 26, y: -30 };
      p.backHand = { x: -14, y: -44 };
      p.frontFoot = { x: 34, y: 62 };
      p.backFoot = { x: -16, y: 60 };
      break;
    }
    case "getup": {
      p.rot = 0.5 * (f.stateFrame / 16);
      p.crouch = 16 * (f.stateFrame / 16);
      p.frontFoot = { x: 24, y: 52 };
      p.backFoot = { x: -22, y: 54 };
      p.frontHand = { x: 16, y: -22 };
      p.backHand = { x: -14, y: -30 };
      break;
    }
    case "ko": {
      p.rot = 1.5;
      p.frontHand = { x: 30, y: -26 };
      p.backHand = { x: -18, y: -30 };
      p.frontFoot = { x: 40, y: 58 };
      p.backFoot = { x: -10, y: 62 };
      p.bob = 0;
      break;
    }
    case "victory": {
      const k = Math.min(1, f.stateFrame / 24);
      p.frontHand = { x: 22, y: -30 - 48 * k };
      p.backHand = { x: -18, y: -38 - 12 * k };
      p.lean = -0.04;
      p.bob = Math.sin(t * 4) * 2.4;
      p.scarfFlow = Math.sin(t * 3.4) * 1.2;
      break;
    }
    default: {
      p.frontHand = { x: 27 + Math.sin(t * 2.1) * 2, y: -30 + Math.cos(t * 2.1) * 1.4 };
      p.backHand = { x: -7 + Math.sin(t * 2.1 + 1) * 1.6, y: -38 };
      break;
    }
  }
  return p;
}

// ── 绘制角色 ──────────────────────────────────────────────────

function limb(
  ctx: CanvasRenderingContext2D,
  a: Vec,
  b: Vec,
  bend: number,
  width: number,
  color: string,
): void {
  const mx = (a.x + b.x) / 2 + bend;
  const my = (a.y + b.y) / 2;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(mx, my, b.x, b.y);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.stroke();
}

function drawWeapon(
  ctx: CanvasRenderingContext2D,
  char: CharacterDef,
  hand: Vec,
  angle: number,
  glow: number,
  time: number,
): void {
  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(angle);
  if (char.weapon === "kunai") {
    ctx.strokeStyle = "#d8e2ee";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(6, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(6, -4.4);
    ctx.lineTo(26, 0);
    ctx.lineTo(6, 4.4);
    ctx.closePath();
    ctx.fillStyle = "#eef6ff";
    ctx.fill();
    if (glow > 0) {
      ctx.shadowColor = char.colors.glow;
      ctx.shadowBlur = 12;
      ctx.stroke();
    }
  } else if (char.weapon === "katana") {
    const grad = ctx.createLinearGradient(0, 0, 66, 0);
    grad.addColorStop(0, "#8d97a8");
    grad.addColorStop(0.35, "#f2f7ff");
    grad.addColorStop(1, "#c8d6ea");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(4, -3.4);
    ctx.quadraticCurveTo(40, -5.2, 66, -1.2);
    ctx.lineTo(66, 1.2);
    ctx.quadraticCurveTo(40, 1.6, 4, 3.4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = char.colors.trim;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.lineTo(6, 0);
    ctx.stroke();
    ctx.shadowColor = char.colors.glow;
    ctx.shadowBlur = 10 + glow * 8;
    ctx.strokeStyle = `rgba(255,240,190,${0.5 + glow * 0.4})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(10, -1.6);
    ctx.lineTo(64, -1);
    ctx.stroke();
  } else {
    const sway = Math.sin(time * 8) * 4;
    ctx.strokeStyle = "#9aa7b8";
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 6; i += 1) {
      const x = 8 + i * 11;
      const y = Math.sin(i * 0.9 + time * 6) * 3 + sway * (i / 6);
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = char.colors.trim;
    ctx.beginPath();
    ctx.arc(8, 0, 3.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSilhouette(ctx: CanvasRenderingContext2D, x: number, y: number, facing: 1 | -1, alpha: number, color: string): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, -62, 17, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(3, -112, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTrail(ctx: CanvasRenderingContext2D, trail: TrailSample[], char: CharacterDef): void {
  for (const t of trail) {
    const alpha = 0.16 * (1 - t.age / 12);
    if (alpha <= 0.01) continue;
    drawSilhouette(ctx, t.x, GROUND_Y - t.y, t.facing, alpha, char.colors.glow);
  }
}

export function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter, time: number): void {
  const char = f.def;
  const pose = poseFor(f, time);
  const dim = f.state === "ko" ? 0.75 : 1;

  // 影子
  const shadowScale = 1 - Math.min(0.6, f.y / 320);
  ctx.save();
  ctx.globalAlpha = 0.42 * shadowScale;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.ellipse(f.x, GROUND_Y + 5, 34 * shadowScale, 9 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawTrail(ctx, f.trail, char);

  ctx.save();
  ctx.translate(f.x, GROUND_Y - f.y);
  if (f.flash > 0) {
    ctx.globalAlpha = 0.6 + Math.sin(f.flash) * 0.2;
  }
  ctx.scale(f.facing, 1);
  ctx.translate(0, -68 + pose.crouch + pose.bob);
  ctx.rotate(pose.rot);
  ctx.globalAlpha = dim;

  const c = char.colors;
  const head: Vec = { x: 3 + pose.lean * 26, y: -66 + pose.headTilt * 6 };

  // 围巾（身后飘带）
  ctx.save();
  const scarfBase: Vec = { x: -2, y: -54 };
  const flow = pose.scarfFlow;
  ctx.strokeStyle = c.trim;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.globalAlpha = dim * 0.85;
  ctx.beginPath();
  ctx.moveTo(scarfBase.x, scarfBase.y);
  ctx.quadraticCurveTo(-30, -52 + flow * 8, -54, -34 + flow * 16);
  ctx.stroke();
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = c.glow;
  ctx.beginPath();
  ctx.moveTo(scarfBase.x, scarfBase.y);
  ctx.quadraticCurveTo(-26, -56 + flow * 6, -46, -44 + flow * 12);
  ctx.stroke();
  ctx.restore();

  // 后腿
  limb(ctx, { x: -4, y: 0 }, pose.backFoot, 8, 13, c.bodyDark);
  ctx.strokeStyle = c.bodyDark;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(pose.backFoot.x - 6, pose.backFoot.y - 2);
  ctx.lineTo(pose.backFoot.x + 8, pose.backFoot.y - 2);
  ctx.stroke();

  // 后臂
  limb(ctx, { x: -7, y: -44 }, pose.backHand, -7, 10.5, c.bodyDark);

  // 躯干
  ctx.beginPath();
  ctx.moveTo(-12, -48);
  ctx.quadraticCurveTo(-15, -26, -9, -2);
  ctx.lineTo(9, -2);
  ctx.quadraticCurveTo(15, -26, 12, -48);
  ctx.quadraticCurveTo(0, -54, -12, -48);
  ctx.closePath();
  const torso = ctx.createLinearGradient(-12, -48, 12, 0);
  torso.addColorStop(0, c.cloth);
  torso.addColorStop(0.6, c.body);
  torso.addColorStop(1, c.bodyDark);
  ctx.fillStyle = torso;
  ctx.fill();

  // 腰带
  ctx.fillStyle = c.trim;
  ctx.globalAlpha = dim * 0.9;
  ctx.fillRect(-10, -14, 20, 4);

  // 胸口纹样
  ctx.strokeStyle = c.glow;
  ctx.globalAlpha = dim * 0.6;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-6, -38);
  ctx.lineTo(0, -30);
  ctx.lineTo(6, -38);
  ctx.stroke();
  ctx.globalAlpha = dim;

  // 前腿
  limb(ctx, { x: 4, y: 0 }, pose.frontFoot, -6, 13.5, c.body);
  ctx.strokeStyle = c.cloth;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(pose.frontFoot.x - 5, pose.frontFoot.y - 3);
  ctx.lineTo(pose.frontFoot.x + 9, pose.frontFoot.y - 3);
  ctx.stroke();

  // 头
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(pose.lean * 0.5 + pose.headTilt * 0.4);
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.fillStyle = c.skin;
  ctx.fill();

  // 面罩
  ctx.beginPath();
  ctx.arc(0, 0, 15, Math.PI * 0.96, Math.PI * 2.06);
  ctx.lineTo(14, 8);
  ctx.quadraticCurveTo(0, 13, -14, 8);
  ctx.closePath();
  ctx.fillStyle = c.bodyDark;
  ctx.fill();

  // 眼
  ctx.shadowColor = c.glow;
  ctx.shadowBlur = 8;
  ctx.fillStyle = c.glow;
  ctx.beginPath();
  ctx.ellipse(6, -2.5, 3.4, 1.7, -0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-2, -2.5, 2.6, 1.4, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 头巾
  ctx.strokeStyle = c.trim;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.arc(0, 0, 14.4, Math.PI * 0.78, Math.PI * 2.28);
  ctx.stroke();
  ctx.fillStyle = c.trim;
  ctx.beginPath();
  ctx.moveTo(-12, -6);
  ctx.quadraticCurveTo(-26, -10 + pose.scarfFlow * 5, -34, -2 + pose.scarfFlow * 8);
  ctx.lineTo(-29, 2 + pose.scarfFlow * 6);
  ctx.quadraticCurveTo(-22, -3, -11, 0);
  ctx.closePath();
  ctx.fill();

  // 角色专属头饰
  if (char.id === "rai") {
    ctx.strokeStyle = c.trim;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(2, -14);
    ctx.quadraticCurveTo(16, -22, 22, -12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-4, -14);
    ctx.quadraticCurveTo(-16, -24, -22, -14);
    ctx.stroke();
  } else if (char.id === "jumon") {
    ctx.strokeStyle = c.trim;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-9, -12);
    ctx.quadraticCurveTo(-16, -26, -8, -30);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(9, -12);
    ctx.quadraticCurveTo(16, -26, 8, -30);
    ctx.stroke();
  } else {
    ctx.fillStyle = c.cloth;
    ctx.beginPath();
    ctx.moveTo(-15, -4);
    ctx.quadraticCurveTo(-24, -22, -10, -26);
    ctx.lineTo(2, -15);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 前臂
  limb(ctx, { x: 7, y: -44 }, pose.frontHand, 7, 11, c.body);

  // 武器
  drawWeapon(ctx, char, pose.frontHand, pose.weaponAngle, f.superGlow > 0 ? 1 : 0, time);

  // 查克拉充盈光晕
  if (f.chakra >= 99.5 && f.state !== "ko") {
    const pulse = 0.35 + Math.sin(time * 5) * 0.18;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = c.glow;
    ctx.lineWidth = 2;
    ctx.shadowColor = c.glow;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.ellipse(0, -60, 30, 66, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 防御盾
  if (f.state === "block") {
    ctx.save();
    const boost = f.blockFlash > 0 ? 0.75 : 0.4;
    ctx.globalAlpha = boost;
    ctx.strokeStyle = "#9fe6ff";
    ctx.lineWidth = 3 + (f.blockFlash > 0 ? 3 : 0);
    ctx.shadowColor = "#7cd4ff";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(14, -40, 46, -1.05, 1.05);
    ctx.stroke();
    ctx.restore();
  }

  // 受创闪白
  if (f.flash > 0) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.18 * (f.flash / 8);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(0, -62, 22, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.restore();
}

// ── 飞行道具与粒子 ────────────────────────────────────────────

function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, time: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (p.spec.speed === 0) {
    const flick = 0.82 + Math.sin(time * 22 + p.seed) * 0.18;
    const grad = ctx.createLinearGradient(0, p.y + p.h / 2, 0, p.y - p.h / 2);
    grad.addColorStop(0, `${p.color}00`);
    grad.addColorStop(0.35, `${p.color}cc`);
    grad.addColorStop(1, "#fff4c8");
    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.85;
    const w = p.w * flick;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 20, w / 2, p.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#fff6d0";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 30, w / 4, p.h / 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const wobble = Math.sin(time * 26 + p.seed) * 3;
    const r = p.w / 2;
    const grad = ctx.createRadialGradient(p.x, p.y + wobble, 2, p.x, p.y + wobble, r * 1.7);
    grad.addColorStop(0, "#fffbe8");
    grad.addColorStop(0.35, p.color);
    grad.addColorStop(1, `${p.color}00`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y + wobble, r * 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(p.x, p.y + wobble, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
  const life = p.life / p.maxLife;
  if (life <= 0) return;
  ctx.save();
  if (p.kind === "ring") {
    const r = p.size * (1.15 - life);
    ctx.globalAlpha = life * 0.85;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2 + life * 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(2, r), 0, Math.PI * 2);
    ctx.stroke();
  } else if (p.kind === "slash") {
    ctx.globalAlpha = life * 0.9;
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 3 * life;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 0.6, p.angle - 0.9, p.angle + 0.9);
    ctx.stroke();
  } else if (p.kind === "dust") {
    ctx.globalAlpha = life * 0.45;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (1.4 - life * 0.4), 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === "spark") {
    ctx.globalAlpha = life;
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = p.color;
    ctx.lineWidth = p.size * life + 0.6;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - Math.cos(p.angle) * (6 + p.size * 3), p.y - Math.sin(p.angle) * (6 + p.size * 3));
    ctx.stroke();
  } else if (p.kind === "flame") {
    ctx.globalAlpha = life * 0.8;
    ctx.globalCompositeOperation = "lighter";
    const grad = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.size);
    grad.addColorStop(0, "#fff2c4");
    grad.addColorStop(0.5, p.color);
    grad.addColorStop(1, `${p.color}00`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.globalAlpha = life;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = p.color;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillRect(-2, -2, 4 * life + 2, 4 * life + 2);
  }
  ctx.restore();
}

// ── 主渲染 ────────────────────────────────────────────────────

export function renderScene(
  ctx: CanvasRenderingContext2D,
  engine: DuelEngine,
  width: number,
  height: number,
  time: number,
): void {
  // 等比缩放居中：画布比例与舞台不一致时补黑边，不做拉伸。
  const scale = Math.min(width / VIEW_W, height / VIEW_H);
  if (!Number.isFinite(scale) || scale <= 0) return;
  const offsetX = (width - VIEW_W * scale) / 2;
  const offsetY = (height - VIEW_H * scale) / 2;
  const stage = engine.stageDef;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#05070c";
  ctx.fillRect(0, 0, width, height);
  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

  const shake = engine.cameraShake;
  const shakeX = shake > 0 ? (Math.random() - 0.5) * shake * 1.6 : 0;
  const shakeY = shake > 0 ? (Math.random() - 0.5) * shake * 1.2 : 0;
  const camX = engine.camX;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  const layer = paintStage(stage, scale);
  ctx.drawImage(layer, -camX * 0.55, 0, STAGE_W, VIEW_H);

  if (engine.freezeActive && engine.freezeOwner !== null) {
    const owner = engine.fighters[engine.freezeOwner];
    const grad = ctx.createRadialGradient(
      owner.x - camX,
      GROUND_Y - owner.y - 80,
      40,
      owner.x - camX,
      GROUND_Y - owner.y - 80,
      520,
    );
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(1, "rgba(6,4,14,0.72)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  drawGround(ctx, stage, camX, time);

  ctx.save();
  ctx.translate(-camX, 0);
  for (const p of engine.projectiles) drawProjectile(ctx, p, time);
  const behind = engine.fighters[1];
  const front = engine.fighters[0];
  drawFighter(ctx, behind, time);
  drawFighter(ctx, front, time);
  ctx.restore();

  drawForegroundAmbience(ctx, stage, camX, time);

  ctx.save();
  ctx.translate(-camX, 0);
  for (const p of engine.particles) drawParticle(ctx, p);
  for (const f of engine.floaters) {
    const alpha = Math.min(1, f.life / f.maxLife) * 1.2;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.font = `800 ${f.size}px "PingFang SC", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(6,8,16,0.75)";
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }
  ctx.restore();

  // 全屏闪光
  if (engine.flashScreen > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(engine.flashScreen * 0.8).toFixed(3)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // 必杀演出速度线
  if (engine.freezeActive) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const cx = VIEW_W / 2;
    const cy = VIEW_H / 2;
    for (let i = 0; i < 26; i += 1) {
      const a = (i / 26) * Math.PI * 2 + time * 1.6;
      const inner = 190 + Math.sin(time * 9 + i) * 26;
      ctx.strokeStyle = `rgba(255,255,255,${0.05 + (i % 3) * 0.02})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner * 0.62);
      ctx.lineTo(cx + Math.cos(a) * 620, cy + Math.sin(a) * 620 * 0.62);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 暗角
  const vignette = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 210, VIEW_W / 2, VIEW_H / 2, 640);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // 血量告急的红边
  for (const f of engine.fighters) {
    if (f.hp > f.def.maxHp * 0.25) continue;
    const side = f.side === 0 ? -1 : 1;
    const pulse = 0.16 + Math.sin(time * 6) * 0.06;
    const grad = ctx.createLinearGradient(
      side < 0 ? 0 : VIEW_W,
      0,
      side < 0 ? 260 : VIEW_W - 260,
      0,
    );
    grad.addColorStop(0, `rgba(255,40,60,${pulse.toFixed(3)})`);
    grad.addColorStop(1, "rgba(255,40,60,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  ctx.restore();
}

export function clearStageCache(): void {
  layerCache.clear();
}
