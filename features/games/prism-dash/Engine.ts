import { gameAudio } from "@/lib/audio/gameAudio";
import { createDashLevel, DASH_GROUND, DASH_HEIGHT, DASH_LENGTH, DASH_WIDTH, getDashZone } from "./data";
import type { DashObstacle, PrismDashCallbacks, PrismDashStatus } from "./types";

type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string };

export class PrismDashEngine {
  private context: CanvasRenderingContext2D;
  private animation = 0;
  private lastTime = 0;
  private lastHud = 0;
  private status: PrismDashStatus = "idle";
  private obstacles = createDashLevel().obstacles;
  private shards = createDashLevel().shards;
  private collected = new Set<number>();
  private usedOrbs = new Set<number>();
  private worldX = 0;
  private playerY = DASH_GROUND - 31;
  private velocityY = 0;
  private grounded = true;
  private rotation = 0;
  private shardCount = 0;
  private score = 0;
  private sparks: Spark[] = [];
  private pulse = 0;

  constructor(private canvas: HTMLCanvasElement, private callbacks: PrismDashCallbacks) {
    this.context = canvas.getContext("2d")!;
    this.resize();
  }

  resize() {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = DASH_WIDTH * ratio;
    this.canvas.height = DASH_HEIGHT * ratio;
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.draw();
  }

  start() {
    const level = createDashLevel();
    this.obstacles = level.obstacles;
    this.shards = level.shards;
    this.collected.clear(); this.usedOrbs.clear();
    this.worldX = 0; this.playerY = DASH_GROUND - 31; this.velocityY = 0; this.grounded = true;
    this.rotation = 0; this.shardCount = 0; this.score = 0; this.sparks = []; this.pulse = 0;
    this.status = "playing";
    this.lastTime = performance.now();
    cancelAnimationFrame(this.animation);
    this.animation = requestAnimationFrame(this.tick);
    gameAudio.play("start");
    this.callbacks.onStatus("playing", 0, "");
    this.emitHud(true, "点击或空格起跳");
  }

  destroy() { cancelAnimationFrame(this.animation); }

  action() {
    if (this.status !== "playing") return;
    if (this.grounded) {
      this.velocityY = -620; this.grounded = false; gameAudio.play("move");
      this.spawn(204, this.playerY + 29, "#73f3ff", 8);
      return;
    }
    const playerWorldX = this.worldX + 204;
    const orb = this.obstacles.find((item) => item.type === "orb" && !this.usedOrbs.has(item.id) && Math.abs(item.x + 17 - playerWorldX) < 62 && Math.abs(item.y + 17 - (this.playerY + 15)) < 76);
    if (orb) {
      this.usedOrbs.add(orb.id); this.velocityY = -700; this.pulse = .28; gameAudio.play("perfect");
      this.spawn(orb.x - this.worldX + 17, orb.y + 17, "#ffe77a", 18);
    }
  }

  togglePause() {
    if (this.status === "playing") { this.status = "paused"; this.callbacks.onStatus("paused", this.score, ""); this.draw(); }
    else if (this.status === "paused") { this.status = "playing"; this.lastTime = performance.now(); this.callbacks.onStatus("playing", this.score, ""); }
  }

  private tick = (time: number) => {
    const delta = Math.min(.033, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    if (this.status === "playing") this.update(delta);
    this.draw();
    if (this.status === "playing" || this.status === "paused") this.animation = requestAnimationFrame(this.tick);
  };

  private update(delta: number) {
    const progress = Math.min(1, this.worldX / DASH_LENGTH);
    const speed = 242 + progress * 74;
    this.worldX += speed * delta;
    this.pulse = Math.max(0, this.pulse - delta);
    this.velocityY += 1780 * delta;
    this.playerY += this.velocityY * delta;
    this.grounded = false;

    const playerWorldX = this.worldX + 204;
    let floor = DASH_GROUND;
    for (const item of this.obstacles) {
      if (item.type !== "block") continue;
      const horizontal = playerWorldX + 13 > item.x && playerWorldX - 13 < item.x + item.width;
      const previousBottom = this.playerY + 31 - this.velocityY * delta;
      if (horizontal && this.velocityY >= 0 && previousBottom <= item.y + 5 && this.playerY + 31 >= item.y) floor = Math.min(floor, item.y);
    }
    if (this.playerY + 31 >= floor) {
      this.playerY = floor - 31; this.velocityY = 0; this.grounded = true;
      this.rotation = Math.round(this.rotation / (Math.PI / 2)) * (Math.PI / 2);
    } else this.rotation += delta * 5.7;

    for (const item of this.obstacles) {
      if (item.x > playerWorldX + 90 || item.x + item.width < playerWorldX - 50) continue;
      if (item.type === "pad" && this.playerY + 32 >= item.y && playerWorldX + 14 > item.x && playerWorldX - 14 < item.x + item.width && this.velocityY >= 0) {
        this.velocityY = -770; this.grounded = false; this.pulse = .2; gameAudio.play("stack");
      }
      if ((item.type === "spike" || item.type === "block") && this.collides(item, playerWorldX)) { this.finish("lost", "撞上障碍，注意落点节奏"); return; }
    }

    for (const shard of this.shards) {
      if (this.collected.has(shard.id)) continue;
      const dx = shard.x - playerWorldX; const dy = shard.y - (this.playerY + 15);
      if (dx * dx + dy * dy < 34 * 34) { this.collected.add(shard.id); this.shardCount += 1; this.pulse = .16; this.spawn(shard.x - this.worldX, shard.y, "#fff18a", 12); gameAudio.play("score"); }
    }

    this.updateSparks(delta);
    this.score = Math.floor(this.worldX / 9) + this.shardCount * 180;
    if (this.worldX >= DASH_LENGTH) { this.finish("won", "三段棱镜轨道全部突破"); return; }
    const message = progress < .08 ? "障碍靠近时点击起跳" : this.grounded ? "保持节奏" : "空中接近光环时再次点击";
    this.emitHud(false, message);
  }

  private collides(item: DashObstacle, playerWorldX: number) {
    const left = playerWorldX - 12, right = playerWorldX + 12, top = this.playerY + 4, bottom = this.playerY + 29;
    if (item.type === "block") return right > item.x + 5 && left < item.x + item.width - 5 && bottom > item.y + 4 && top < item.y + item.height;
    const cx = Math.max(item.x + 7, Math.min(playerWorldX, item.x + item.width - 7));
    const hazardTop = item.y + (Math.abs(cx - (item.x + item.width / 2)) / (item.width / 2)) * item.height;
    return right > item.x + 5 && left < item.x + item.width - 5 && bottom > hazardTop + 3 && top < item.y + item.height;
  }

  private finish(status: "won" | "lost", message: string) {
    this.status = status;
    if (status === "lost") this.spawn(204, this.playerY + 15, "#ff557f", 28);
    this.callbacks.onStatus(status, this.score, message);
    this.emitHud(true, message);
    gameAudio.play(status === "won" ? "win" : "crash");
  }

  private spawn(x: number, y: number, color: string, count: number) {
    for (let index = 0; index < count && this.sparks.length < 100; index += 1) {
      const angle = index / count * Math.PI * 2;
      this.sparks.push({ x, y, vx: Math.cos(angle) * (45 + index % 4 * 18), vy: Math.sin(angle) * (45 + index % 3 * 16), life: .55, color });
    }
  }

  private updateSparks(delta: number) {
    this.sparks.forEach((spark) => { spark.life -= delta; spark.x += spark.vx * delta; spark.y += spark.vy * delta; spark.vy += 90 * delta; });
    this.sparks = this.sparks.filter((spark) => spark.life > 0);
  }

  private emitHud(force: boolean, message: string) {
    const now = performance.now(); if (!force && now - this.lastHud < 90) return; this.lastHud = now;
    const progress = Math.min(1, this.worldX / DASH_LENGTH);
    this.callbacks.onHud({ score: this.score, progress, shards: this.shardCount, speed: 1 + progress * .31, zone: getDashZone(progress).name, message });
  }

  private draw() {
    const context = this.context; const progress = Math.min(1, this.worldX / DASH_LENGTH); const zone = getDashZone(progress);
    const gradient = context.createLinearGradient(0, 0, 0, DASH_HEIGHT); gradient.addColorStop(0, zone.colors[0]); gradient.addColorStop(.7, zone.colors[1]); gradient.addColorStop(1, "#050814");
    context.fillStyle = gradient; context.fillRect(0, 0, DASH_WIDTH, DASH_HEIGHT);
    context.save(); context.globalAlpha = .24; context.strokeStyle = zone.colors[2]; context.lineWidth = 1;
    const gridOffset = -(this.worldX * .35) % 64;
    for (let x = gridOffset; x < DASH_WIDTH; x += 64) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, DASH_HEIGHT); context.stroke(); }
    for (let y = 54; y < DASH_HEIGHT; y += 54) { context.beginPath(); context.moveTo(0, y); context.lineTo(DASH_WIDTH, y); context.stroke(); }
    context.restore();
    for (let index = 0; index < 9; index += 1) {
      const x = ((index * 173 - this.worldX * (.08 + index % 3 * .025)) % 1150 + 1150) % 1150 - 90;
      const y = 80 + (index * 97) % 270; const size = 22 + index % 4 * 14;
      context.save(); context.translate(x, y); context.rotate(index + this.worldX * .0003); context.strokeStyle = `${zone.colors[2]}55`; context.lineWidth = 3; context.strokeRect(-size / 2, -size / 2, size, size); context.restore();
    }
    context.fillStyle = "#08101f"; context.fillRect(0, DASH_GROUND, DASH_WIDTH, DASH_HEIGHT - DASH_GROUND);
    context.fillStyle = zone.colors[2]; context.fillRect(0, DASH_GROUND, DASH_WIDTH, 4);
    context.fillStyle = `${zone.colors[2]}26`;
    for (let x = -(this.worldX % 48); x < DASH_WIDTH; x += 48) context.fillRect(x, DASH_GROUND + 18, 26, 3);
    this.drawLevel(context, zone.colors[2]);
    this.drawPlayer(context, zone.colors[2]);
    this.sparks.forEach((spark) => { context.save(); context.globalAlpha = Math.max(0, spark.life / .55); context.fillStyle = spark.color; context.fillRect(spark.x - 3, spark.y - 3, 6, 6); context.restore(); });
    if (this.pulse > 0) { context.fillStyle = `rgba(255,255,255,${this.pulse * .32})`; context.fillRect(0, 0, DASH_WIDTH, DASH_HEIGHT); }
    if (this.status === "paused") { context.fillStyle = "#050817d9"; context.fillRect(0,0,DASH_WIDTH,DASH_HEIGHT); context.fillStyle="#fff"; context.textAlign="center"; context.font="700 32px Georgia"; context.fillText("节拍暂停",DASH_WIDTH/2,DASH_HEIGHT/2); }
  }

  private drawLevel(context: CanvasRenderingContext2D, accent: string) {
    for (const item of this.obstacles) {
      const x = item.x - this.worldX; if (x < -90 || x > DASH_WIDTH + 90) continue;
      if (item.type === "spike") { context.fillStyle = "#ff4d78"; context.strokeStyle = "#ffd0dd"; context.lineWidth = 2; context.beginPath(); context.moveTo(x, item.y + item.height); context.lineTo(x + item.width / 2, item.y); context.lineTo(x + item.width, item.y + item.height); context.closePath(); context.fill(); context.stroke(); }
      if (item.type === "block") { const fill = context.createLinearGradient(x,item.y,x+item.width,item.y+item.height); fill.addColorStop(0,accent); fill.addColorStop(1,"#283160"); context.fillStyle=fill; context.strokeStyle="#dffcff"; context.lineWidth=2; context.fillRect(x,item.y,item.width,item.height); context.strokeRect(x+3,item.y+3,item.width-6,item.height-6); context.strokeRect(x+13,item.y+13,item.width-26,item.height-26); }
      if (item.type === "pad") { context.fillStyle="#ffdf68"; context.shadowColor="#ffdf68"; context.shadowBlur=12; context.fillRect(x,item.y,item.width,item.height); context.shadowBlur=0; }
      if (item.type === "orb") { const used=this.usedOrbs.has(item.id); context.save(); context.globalAlpha=used?.25:1; context.strokeStyle="#ffea72"; context.lineWidth=5; context.shadowColor="#ffea72"; context.shadowBlur=14; context.beginPath(); context.arc(x+17,item.y+17,14,0,Math.PI*2); context.stroke(); context.restore(); }
    }
    for (const shard of this.shards) {
      if (this.collected.has(shard.id)) continue; const x=shard.x-this.worldX; if(x < -40 || x > DASH_WIDTH+40) continue;
      context.save(); context.translate(x,shard.y); context.rotate(performance.now()*.003); context.fillStyle="#fff18a"; context.shadowColor="#fff18a"; context.shadowBlur=13; context.beginPath(); context.moveTo(0,-12);context.lineTo(9,0);context.lineTo(0,12);context.lineTo(-9,0);context.closePath();context.fill();context.restore();
    }
  }

  private drawPlayer(context: CanvasRenderingContext2D, accent: string) {
    context.save(); context.translate(204,this.playerY+15); context.rotate(this.rotation); context.shadowColor=accent; context.shadowBlur=18;
    const fill=context.createLinearGradient(-16,-16,16,16);fill.addColorStop(0,"#fff");fill.addColorStop(.25,accent);fill.addColorStop(1,"#6c43df"); context.fillStyle=fill; context.strokeStyle="#fff"; context.lineWidth=2; context.fillRect(-15,-15,30,30); context.strokeRect(-15,-15,30,30);
    context.fillStyle="#07142f"; context.fillRect(-8,-5,5,6);context.fillRect(3,-5,5,6);context.fillRect(-5,6,10,3); context.restore();
  }
}
