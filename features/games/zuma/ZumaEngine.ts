import { gameAudio } from "@/lib/audio/gameAudio";
import { ZUMA_LEVELS } from "./levels";
import { createMarbleTextures } from "./marbleTextures";
import type { ZumaCallbacks, ZumaColor, ZumaHud, ZumaStatus } from "./types";

type Point = { x: number; y: number; distance: number };
type Marble = { id: number; color: ZumaColor; s: number };
type Projectile = { x: number; y: number; vx: number; vy: number; color: ZumaColor };
type Burst = { x: number; y: number; color: ZumaColor; age: number };

const WIDTH = 960;
const HEIGHT = 540;
const SPACING = 29;
const RADIUS = 14;
const LAUNCHER = { x: 480, y: 275 };
const COLOR_HEX: Record<ZumaColor, string> = { red: "#ef5b50", blue: "#4ba9f2", yellow: "#f5cf4b", green: "#57c777", purple: "#a76de4" };

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  return .5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}

function buildPath(waypoints: Array<[number, number]>) {
  const raw: Array<{ x: number; y: number }> = [];
  for (let segment = 0; segment < waypoints.length - 1; segment += 1) {
    const p0 = waypoints[Math.max(0, segment - 1)];
    const p1 = waypoints[segment];
    const p2 = waypoints[segment + 1];
    const p3 = waypoints[Math.min(waypoints.length - 1, segment + 2)];
    for (let step = 0; step < 28; step += 1) {
      const t = step / 28;
      raw.push({ x: catmull(p0[0], p1[0], p2[0], p3[0], t), y: catmull(p0[1], p1[1], p2[1], p3[1], t) });
    }
  }
  raw.push({ x: waypoints.at(-1)![0], y: waypoints.at(-1)![1] });
  let distance = 0;
  return raw.map((point, index): Point => {
    if (index > 0) distance += Math.hypot(point.x - raw[index - 1].x, point.y - raw[index - 1].y);
    return { ...point, distance };
  });
}

export class ZumaEngine {
  private context: CanvasRenderingContext2D;
  private sceneLayer: HTMLCanvasElement;
  private sceneContext: CanvasRenderingContext2D;
  private marbleTextures: ReturnType<typeof createMarbleTextures>;
  private animation = 0;
  private lastTime = 0;
  private elapsed = 0;
  private status: ZumaStatus = "idle";
  private levelIndex = 0;
  private path: Point[] = [];
  private pathLength = 0;
  private marbles: Marble[] = [];
  private projectile: Projectile | null = null;
  private bursts: Burst[] = [];
  private aim = -Math.PI / 2;
  private current: ZumaColor = "red";
  private next: ZumaColor = "blue";
  private score = 0;
  private combo = 0;
  private nextId = 1;
  private lastHud = 0;

  constructor(private canvas: HTMLCanvasElement, private callbacks: ZumaCallbacks) {
    this.context = canvas.getContext("2d")!;
    this.sceneLayer = document.createElement("canvas");
    this.sceneContext = this.sceneLayer.getContext("2d")!;
    this.marbleTextures = createMarbleTextures();
    this.path = buildPath(ZUMA_LEVELS[0].waypoints);
    this.pathLength = this.path.at(-1)?.distance ?? 1;
    this.resize();
  }

  resize() {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = WIDTH * ratio;
    this.canvas.height = HEIGHT * ratio;
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.sceneLayer.width = WIDTH * ratio;
    this.sceneLayer.height = HEIGHT * ratio;
    this.sceneContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.rebuildSceneLayer();
    this.draw();
  }

  start(levelIndex = 0, carryScore = 0) {
    this.levelIndex = Math.max(0, Math.min(ZUMA_LEVELS.length - 1, levelIndex));
    const level = ZUMA_LEVELS[this.levelIndex];
    this.path = buildPath(level.waypoints);
    this.pathLength = this.path.at(-1)?.distance ?? 1;
    this.score = carryScore;
    this.combo = 0;
    this.elapsed = 0;
    this.projectile = null;
    this.bursts = [];
    this.marbles = [];
    for (let index = 0; index < level.count; index += 1) {
      let color = this.randomColor(level.colors);
      const previous = this.marbles[index - 1]?.color;
      const before = this.marbles[index - 2]?.color;
      if (color === previous && color === before) color = level.colors[(level.colors.indexOf(color) + 1) % level.colors.length];
      this.marbles.push({ id: this.nextId++, color, s: level.count * SPACING + 165 - index * SPACING });
    }
    this.rebuildSceneLayer();
    this.current = this.randomActiveColor();
    this.next = this.randomActiveColor();
    this.status = "playing";
    this.lastTime = performance.now();
    cancelAnimationFrame(this.animation);
    this.animation = requestAnimationFrame(this.tick);
    this.emitHud(true);
  }

  destroy() { cancelAnimationFrame(this.animation); }
  getLevel() { return this.levelIndex; }
  getScore() { return this.score; }
  getStatus() { return this.status; }

  togglePause() {
    if (this.status === "playing") { this.status = "paused"; this.callbacks.onStatus("paused", this.score); this.draw(); }
    else if (this.status === "paused") { this.status = "playing"; this.lastTime = performance.now(); this.callbacks.onStatus("playing", this.score); }
  }

  aimAt(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width * WIDTH;
    const y = (clientY - rect.top) / rect.height * HEIGHT;
    this.aim = Math.atan2(y - LAUNCHER.y, x - LAUNCHER.x);
  }

  shoot() {
    if (this.status !== "playing" || this.projectile) return;
    const speed = 650;
    this.projectile = { x: LAUNCHER.x + Math.cos(this.aim) * 31, y: LAUNCHER.y + Math.sin(this.aim) * 31, vx: Math.cos(this.aim) * speed, vy: Math.sin(this.aim) * speed, color: this.current };
    this.current = this.next;
    this.next = this.randomActiveColor();
    gameAudio.play("tap");
    this.emitHud(true);
  }

  swap() {
    if (this.status !== "playing" || this.projectile) return;
    [this.current, this.next] = [this.next, this.current];
    gameAudio.play("move");
    this.emitHud(true);
  }

  private tick = (time: number) => {
    const delta = Math.min(.034, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    if (this.status === "playing") this.update(delta);
    this.draw();
    if (this.status === "playing" || this.status === "paused") this.animation = requestAnimationFrame(this.tick);
  };

  private update(delta: number) {
    this.elapsed += delta;
    const level = ZUMA_LEVELS[this.levelIndex];
    if (this.marbles.length) {
      this.marbles[0].s += level.speed * delta;
      for (let index = 1; index < this.marbles.length; index += 1) {
        const target = this.marbles[index - 1].s - SPACING;
        if (this.marbles[index].s < target) this.marbles[index].s = Math.min(target, this.marbles[index].s + level.speed * 4.2 * delta);
        else if (this.marbles[index].s > target) this.marbles[index].s = target;
      }
      if (this.marbles[0].s >= this.pathLength - 24) { this.finish("lost"); return; }
      this.checkChainMatches();
    }
    if (this.projectile) {
      this.projectile.x += this.projectile.vx * delta;
      this.projectile.y += this.projectile.vy * delta;
      const collision = this.marbles.findIndex((marble) => {
        const point = this.pointAt(marble.s);
        return Math.hypot(point.x - this.projectile!.x, point.y - this.projectile!.y) < RADIUS * 1.82;
      });
      if (collision >= 0) this.insertProjectile(collision);
      else if (this.projectile.x < -30 || this.projectile.x > WIDTH + 30 || this.projectile.y < -30 || this.projectile.y > HEIGHT + 30) {
        this.projectile = null; this.combo = 0; this.emitHud(true);
      }
    }
    this.bursts.forEach((burst) => { burst.age += delta; });
    this.bursts = this.bursts.filter((burst) => burst.age < .55);
    if (!this.marbles.length && !this.projectile) this.finish(this.levelIndex === ZUMA_LEVELS.length - 1 ? "won" : "level-clear");
    this.emitHud(false);
  }

  private insertProjectile(collisionIndex: number) {
    if (!this.projectile) return;
    const target = this.marbles[collisionIndex];
    const ahead = this.pointAt(target.s + SPACING * .55);
    const behind = this.pointAt(target.s - SPACING * .55);
    const aheadDistance = Math.hypot(ahead.x - this.projectile.x, ahead.y - this.projectile.y);
    const behindDistance = Math.hypot(behind.x - this.projectile.x, behind.y - this.projectile.y);
    const insertIndex = aheadDistance < behindDistance ? collisionIndex : collisionIndex + 1;
    let insertS: number;
    if (insertIndex === 0) insertS = this.marbles[0].s + SPACING;
    else if (insertIndex === this.marbles.length) insertS = this.marbles.at(-1)!.s - SPACING;
    else {
      for (let index = 0; index < insertIndex; index += 1) this.marbles[index].s += SPACING;
      insertS = this.marbles[insertIndex].s + SPACING;
    }
    this.marbles.splice(insertIndex, 0, { id: this.nextId++, color: this.projectile.color, s: insertS });
    this.projectile = null;
    const removed = this.removeMatchAt(insertIndex, false);
    if (!removed) { this.combo = 0; gameAudio.play("drop"); }
    this.emitHud(true);
  }

  private removeMatchAt(index: number, chain: boolean) {
    const marble = this.marbles[index];
    if (!marble) return false;
    let start = index;
    let end = index;
    while (start > 0 && this.marbles[start - 1].color === marble.color && this.marbles[start - 1].s - this.marbles[start].s <= SPACING * 1.35) start -= 1;
    while (end < this.marbles.length - 1 && this.marbles[end + 1].color === marble.color && this.marbles[end].s - this.marbles[end + 1].s <= SPACING * 1.35) end += 1;
    const count = end - start + 1;
    if (count < 3) return false;
    const removed = this.marbles.splice(start, count);
    removed.forEach((item) => { const point = this.pointAt(item.s); this.bursts.push({ x: point.x, y: point.y, color: item.color, age: 0 }); });
    this.combo = chain ? this.combo + 1 : 1;
    this.score += count * 100 * this.combo;
    gameAudio.play(chain ? "perfect" : "match");
    return true;
  }

  private checkChainMatches() {
    for (let index = 0; index < this.marbles.length - 1; index += 1) {
      const current = this.marbles[index];
      const next = this.marbles[index + 1];
      if (current.color === next.color && current.s - next.s <= SPACING + 1.2 && this.removeMatchAt(index, true)) {
        this.emitHud(true); return;
      }
    }
  }

  private finish(status: "level-clear" | "won" | "lost") {
    this.status = status;
    if (status === "lost") gameAudio.play("crash"); else gameAudio.play("win");
    this.callbacks.onStatus(status, this.score);
    this.emitHud(true);
  }

  private randomColor(colors: ZumaColor[]) { return colors[Math.floor(Math.random() * colors.length)]; }
  private randomActiveColor() {
    const active = [...new Set(this.marbles.map((marble) => marble.color))];
    return this.randomColor(active.length ? active : ZUMA_LEVELS[this.levelIndex].colors);
  }

  private pointAt(distance: number) {
    const target = Math.max(0, Math.min(this.pathLength, distance));
    let low = 0; let high = this.path.length - 1;
    while (low < high) { const middle = Math.floor((low + high) / 2); if (this.path[middle].distance < target) low = middle + 1; else high = middle; }
    const next = this.path[low];
    const previous = this.path[Math.max(0, low - 1)];
    const span = Math.max(.001, next.distance - previous.distance);
    const ratio = (target - previous.distance) / span;
    return { x: previous.x + (next.x - previous.x) * ratio, y: previous.y + (next.y - previous.y) * ratio };
  }

  private emitHud(force: boolean) {
    const now = performance.now();
    if (!force && now - this.lastHud < 100) return;
    this.lastHud = now;
    const front = this.marbles[0]?.s ?? 0;
    const hud: ZumaHud = { score: this.score, level: this.levelIndex, combo: this.combo, remaining: this.marbles.length, current: this.current, next: this.next, progress: Math.max(0, Math.min(1, front / this.pathLength)) };
    this.callbacks.onHud(hud);
  }

  private draw() {
    const context = this.context;
    context.drawImage(this.sceneLayer, 0, 0, this.sceneLayer.width, this.sceneLayer.height, 0, 0, WIDTH, HEIGHT);
    const level = ZUMA_LEVELS[this.levelIndex];
    const end = this.pointAt(this.pathLength - 7); this.drawGate(context, end.x, end.y, level.palette.accent);
    [...this.marbles].reverse().forEach((marble) => {
      const point = this.pointAt(marble.s);
      this.drawMarble(context, point.x, point.y, marble.color, 1, marble.s / RADIUS + marble.id * .37);
    });
    if (this.projectile) this.drawMarble(context, this.projectile.x, this.projectile.y, this.projectile.color, .94, this.elapsed * 11);
    this.bursts.forEach((burst) => this.drawBurst(context, burst));
    this.drawLauncher(context);
    if (this.status === "paused") { context.fillStyle = "#09110dd0"; context.fillRect(0,0,WIDTH,HEIGHT); context.fillStyle = "#fff"; context.textAlign = "center"; context.font = "700 28px Georgia"; context.fillText("游戏暂停",WIDTH/2,HEIGHT/2); }
  }

  private rebuildSceneLayer() {
    const context = this.sceneContext;
    const level = ZUMA_LEVELS[this.levelIndex];
    context.clearRect(0, 0, WIDTH, HEIGHT);
    const gradient = context.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, level.palette.sky);
    gradient.addColorStop(.58, level.palette.ground);
    gradient.addColorStop(1, level.palette.sky);
    context.fillStyle = gradient;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    this.drawDecorations(context, level.palette.accent);
    const vignette = context.createRadialGradient(WIDTH / 2, HEIGHT / 2, 125, WIDTH / 2, HEIGHT / 2, 570);
    vignette.addColorStop(0, "#00000000");
    vignette.addColorStop(.72, "#00000012");
    vignette.addColorStop(1, "#0304059c");
    context.fillStyle = vignette;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.shadowColor = "#050403a8";
    context.shadowBlur = 13;
    context.shadowOffsetY = 7;
    context.strokeStyle = "#100d0c";
    context.lineWidth = 49;
    this.strokePath(context);
    context.shadowColor = "transparent";
    context.strokeStyle = "#2a201b";
    context.lineWidth = 45;
    this.strokePath(context);
    context.strokeStyle = level.palette.track;
    context.lineWidth = 39;
    this.strokePath(context);
    context.strokeStyle = "#e9cf9c58";
    context.lineWidth = 33;
    this.strokePath(context);
    context.strokeStyle = "#3a2b23";
    context.lineWidth = 29;
    this.strokePath(context);
    context.strokeStyle = "#160f0dc0";
    context.lineWidth = 23;
    this.strokePath(context);

    for (let distance = 18; distance < this.pathLength; distance += 39) {
      const point = this.pointAt(distance);
      const before = this.pointAt(distance - 3);
      const after = this.pointAt(distance + 3);
      const angle = Math.atan2(after.y - before.y, after.x - before.x) + Math.PI / 2;
      const nx = Math.cos(angle);
      const ny = Math.sin(angle);
      context.strokeStyle = "#0c09087d";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(point.x - nx * 18, point.y - ny * 18);
      context.lineTo(point.x + nx * 18, point.y + ny * 18);
      context.stroke();
      context.strokeStyle = "#ffe0a42e";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(point.x - nx * 16 + 1, point.y - ny * 16 + 1);
      context.lineTo(point.x + nx * 16 + 1, point.y + ny * 16 + 1);
      context.stroke();
    }
    context.restore();
  }

  private strokePath(context: CanvasRenderingContext2D) {
    context.beginPath();
    this.path.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
    context.stroke();
  }

  private drawDecorations(context: CanvasRenderingContext2D, accent: string) {
    context.save();
    for (let x = 0; x < WIDTH; x += 64) {
      for (let y = 0; y < HEIGHT; y += 58) {
        const offset = (Math.floor(y / 58) % 2) * 31;
        context.fillStyle = (Math.floor(x / 64 + y / 58) % 2) ? "#ffffff08" : "#0305040a";
        context.strokeStyle = "#0b0d0b18";
        context.lineWidth = 1;
        context.beginPath();
        context.roundRect(x + offset - 29, y + 4, 58, 49, 7);
        context.fill();
        context.stroke();
      }
    }

    context.globalAlpha = .2;
    context.fillStyle = accent;
    for (let x = 45; x < WIDTH; x += 92) for (let y = 45; y < HEIGHT; y += 88) {
      context.beginPath(); context.arc(x + Math.sin(y) * 12, y, 2.5, 0, Math.PI * 2); context.fill();
    }

    if (this.levelIndex === 0) {
      [[35,120],[910,110],[55,430],[905,440],[510,38]].forEach(([x,y], group) => {
        context.save(); context.translate(x,y); context.rotate(group * 1.2); context.globalAlpha = .34;
        for (let leaf = 0; leaf < 5; leaf += 1) {
          context.rotate(Math.PI * 2 / 5); context.fillStyle = leaf % 2 ? "#76c56e" : "#b3d975";
          context.beginPath(); context.ellipse(0,-17,6,15,.1,0,Math.PI*2); context.fill();
        }
        context.restore();
      });
    } else if (this.levelIndex === 1) {
      [[72,72],[888,72],[70,466],[890,465]].forEach(([x,y]) => {
        context.save(); context.translate(x,y); context.globalAlpha = .34; context.strokeStyle = accent; context.lineWidth = 3;
        context.beginPath(); context.arc(0,0,17,0,Math.PI*2); context.stroke();
        for (let ray = 0; ray < 8; ray += 1) { context.rotate(Math.PI / 4); context.beginPath(); context.moveTo(0,-22); context.lineTo(0,-30); context.stroke(); }
        context.restore();
      });
    } else {
      context.globalAlpha = .34;
      context.strokeStyle = accent;
      context.lineWidth = 2;
      [[55,105],[895,115],[70,445],[885,455],[480,42]].forEach(([x,y], index) => {
        context.beginPath(); context.moveTo(x,y); context.lineTo(x+12,y+13); context.lineTo(x+4,y+28); context.lineTo(x+21,y+41); context.stroke();
        context.fillStyle = "#ff5e3240"; context.beginPath(); context.arc(x + index * 2,y,7,0,Math.PI*2); context.fill();
      });
    }
    context.restore();
  }

  private drawMarble(context: CanvasRenderingContext2D, x: number, y: number, color: ZumaColor, scale: number, rotation = 0) {
    const radius = RADIUS * scale;
    const texture = this.marbleTextures.get(color);
    if (!texture) return;
    context.save();
    context.translate(x, y);
    context.globalAlpha = .48;
    context.fillStyle = "#050507";
    context.beginPath(); context.ellipse(2, radius * .58, radius * .86, radius * .47, 0, 0, Math.PI * 2); context.fill();
    context.globalAlpha = 1;
    context.rotate(rotation);
    const size = radius * 2.18;
    context.drawImage(texture, -size / 2, -size / 2, size, size);
    context.restore();
  }

  private drawLauncher(context: CanvasRenderingContext2D) {
    context.save(); context.translate(LAUNCHER.x,LAUNCHER.y);
    const guide = context.createLinearGradient(Math.cos(this.aim) * 38, Math.sin(this.aim) * 38, Math.cos(this.aim) * 130, Math.sin(this.aim) * 130);
    guide.addColorStop(0, "#fff0acaa"); guide.addColorStop(1, "#fff0ac00");
    context.strokeStyle = guide; context.lineWidth = 2; context.setLineDash([4,7]); context.beginPath(); context.moveTo(Math.cos(this.aim)*41,Math.sin(this.aim)*41); context.lineTo(Math.cos(this.aim)*132,Math.sin(this.aim)*132); context.stroke(); context.setLineDash([]);

    context.fillStyle = "#0607067d"; context.beginPath(); context.ellipse(2,24,42,17,0,0,Math.PI*2); context.fill();
    const base = context.createRadialGradient(-11,-13,3,0,0,40);
    base.addColorStop(0,"#f6d486"); base.addColorStop(.28,"#bd8741"); base.addColorStop(.68,"#644326"); base.addColorStop(1,"#1e1713");
    context.fillStyle = base; context.strokeStyle = "#211712"; context.lineWidth = 5; context.beginPath(); context.arc(0,0,37,0,Math.PI*2); context.fill(); context.stroke();
    context.strokeStyle = "#ffe29c68"; context.lineWidth = 2; context.beginPath(); context.arc(0,0,29,Math.PI*1.06,Math.PI*1.9); context.stroke();
    for (let rune = 0; rune < 8; rune += 1) {
      const angle = rune / 8 * Math.PI * 2;
      context.fillStyle = rune % 2 ? "#e8b65d" : "#7f552d";
      context.beginPath(); context.arc(Math.cos(angle)*31,Math.sin(angle)*31,2.3,0,Math.PI*2); context.fill();
    }

    context.save(); context.rotate(this.aim);
    const barrel = context.createLinearGradient(6,-15,48,15);
    barrel.addColorStop(0,"#a76e32"); barrel.addColorStop(.35,"#f0c76e"); barrel.addColorStop(1,"#5d3a21");
    context.fillStyle = barrel; context.strokeStyle = "#382315"; context.lineWidth = 3;
    context.beginPath(); context.moveTo(5,-14); context.lineTo(39,-10); context.quadraticCurveTo(48,0,39,10); context.lineTo(5,14); context.closePath(); context.fill(); context.stroke();
    context.fillStyle = "#26170f"; context.beginPath(); context.ellipse(40,0,5.5,10,0,0,Math.PI*2); context.fill();
    context.fillStyle = "#d8e7c5"; context.strokeStyle = "#27331f"; context.lineWidth = 2;
    context.beginPath(); context.arc(5,-17,7,0,Math.PI*2); context.arc(5,17,7,0,Math.PI*2); context.fill(); context.stroke();
    context.fillStyle = "#182416"; context.beginPath(); context.arc(8,-17,3,0,Math.PI*2); context.arc(8,17,3,0,Math.PI*2); context.fill();
    context.fillStyle = "#ffffff"; context.beginPath(); context.arc(9,-18,1,0,Math.PI*2); context.arc(9,16,1,0,Math.PI*2); context.fill();
    context.restore();
    context.restore();
    this.drawMarble(context,LAUNCHER.x,LAUNCHER.y,this.current,.94,this.elapsed*.8+this.aim*.35);
  }

  private drawGate(context: CanvasRenderingContext2D, x: number, y: number, accent: string) {
    const pulse = .5 + Math.sin(this.elapsed * 3.2) * .5;
    context.save(); context.translate(x,y);
    context.shadowColor = accent; context.shadowBlur = 10 + pulse * 10;
    context.globalAlpha = .22 + pulse * .18; context.strokeStyle = accent; context.lineWidth = 3;
    context.beginPath(); context.arc(0,0,34+pulse*3,0,Math.PI*2); context.stroke();
    context.globalAlpha = 1; context.shadowColor = "transparent";
    for (let spike = 0; spike < 10; spike += 1) {
      context.save(); context.rotate(spike / 10 * Math.PI * 2); context.fillStyle = spike % 2 ? "#5a4633" : "#87643d";
      context.beginPath(); context.moveTo(-4,-25); context.lineTo(0,-35); context.lineTo(4,-25); context.closePath(); context.fill(); context.restore();
    }
    const stone = context.createRadialGradient(-10,-12,2,0,0,30);
    stone.addColorStop(0,"#a48a61"); stone.addColorStop(.35,"#574736"); stone.addColorStop(1,"#171311");
    context.fillStyle = stone; context.strokeStyle = "#bc8f4c"; context.lineWidth = 3; context.beginPath(); context.arc(0,0,28,0,Math.PI*2); context.fill(); context.stroke();
    context.strokeStyle = "#e4bd6d55"; context.lineWidth = 2; context.beginPath(); context.arc(0,0,22,Math.PI,Math.PI*1.82); context.stroke();
    context.fillStyle = "#080708"; context.beginPath(); context.ellipse(0,5,17,14,0,0,Math.PI*2); context.fill();
    context.fillStyle = accent; context.shadowColor = accent; context.shadowBlur = 8+pulse*5;
    context.beginPath(); context.ellipse(-8,-4,3.5,2.4,-.2,0,Math.PI*2); context.ellipse(8,-4,3.5,2.4,.2,0,Math.PI*2); context.fill();
    context.shadowColor = "transparent"; context.fillStyle = "#d9c69f";
    for (let tooth = -1; tooth <= 1; tooth += 1) { context.beginPath(); context.moveTo(tooth*8-3,-1); context.lineTo(tooth*8+3,-1); context.lineTo(tooth*8,5); context.closePath(); context.fill(); }
    context.restore();
  }

  private drawBurst(context: CanvasRenderingContext2D, burst: Burst) {
    const progress = Math.min(1, burst.age / .55);
    const color = COLOR_HEX[burst.color];
    context.save(); context.translate(burst.x,burst.y); context.globalCompositeOperation = "lighter"; context.globalAlpha = 1-progress;
    context.shadowColor = color; context.shadowBlur = 14;
    context.strokeStyle = color; context.lineWidth = 5-progress*3; context.beginPath(); context.arc(0,0,10+progress*31,0,Math.PI*2); context.stroke();
    context.strokeStyle = "#fff6d2"; context.lineWidth = 1.5; context.beginPath(); context.arc(0,0,7+progress*20,progress*Math.PI,progress*Math.PI+Math.PI*1.45); context.stroke();
    for (let index = 0; index < 9; index += 1) {
      const angle = index / 9 * Math.PI * 2 + burst.x * .013;
      const distance = 7 + progress * (23 + index % 3 * 7);
      const size = 4-progress*2;
      context.save(); context.translate(Math.cos(angle)*distance,Math.sin(angle)*distance); context.rotate(angle+progress*4); context.fillStyle = index % 3 ? color : "#fff3bd"; context.fillRect(-size/2,-size/2,size,size); context.restore();
    }
    context.restore();
  }
}
