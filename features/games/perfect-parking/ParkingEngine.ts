import { gameAudio } from "@/lib/audio/gameAudio";
import { PARKING_ROUND_SECONDS, PARKING_STAGES } from "./data";
import { evaluateParking, parkingScore } from "./rules";
import type { ParkingCallbacks, ParkingHud, ParkingStage, ParkingStatus } from "./types";

const WIDTH = 960;
const HEIGHT = 540;
const ROAD_Y = 370;
const ACCELERATION_BOOST = 7.2;
const BRAKING_BOOST = 6;
const TOP_SPEED_BOOST = 4.7;
const LAUNCH_SPEED = 180;

type Spark = { x: number; y: number; vx: number; vy: number; age: number; color: string };
type Phase = "driving" | "success" | "mistake";

export class ParkingEngine {
  private context: CanvasRenderingContext2D;
  private animation = 0;
  private lastTime = 0;
  private lastHud = 0;
  private status: ParkingStatus = "idle";
  private phase: Phase = "driving";
  private phaseTime = 0;
  private level = 0;
  private score = 0;
  private combo = 0;
  private lives = 3;
  private x = 112;
  private speed = 0;
  private throttle = false;
  private wheelRotation = 0;
  private settleTime = 0;
  private timeLeft = PARKING_ROUND_SECONDS;
  private message = "按住油门，松开制动";
  private quality = 0;
  private elapsed = 0;
  private sparks: Spark[] = [];

  constructor(private canvas: HTMLCanvasElement, private callbacks: ParkingCallbacks) {
    this.context = canvas.getContext("2d")!;
    this.resize();
  }

  resize() {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = WIDTH * ratio;
    this.canvas.height = HEIGHT * ratio;
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.draw();
  }

  start() {
    this.level = 0;
    this.score = 0;
    this.combo = 0;
    this.lives = 3;
    this.status = "playing";
    this.elapsed = 0;
    this.resetStage();
    this.lastTime = performance.now();
    cancelAnimationFrame(this.animation);
    this.animation = requestAnimationFrame(this.tick);
    gameAudio.play("start");
    this.callbacks.onStatus("playing", 0, "");
    this.emitHud(true);
  }

  destroy() { cancelAnimationFrame(this.animation); }
  press() { if (this.status === "playing" && this.phase === "driving") { this.throttle = true; this.speed = Math.max(this.speed, LAUNCH_SPEED); gameAudio.play("move"); } }
  release() { this.throttle = false; }

  togglePause() {
    if (this.status === "playing") {
      this.status = "paused";
      this.throttle = false;
      this.callbacks.onStatus("paused", this.score, "");
      this.draw();
    } else if (this.status === "paused") {
      this.status = "playing";
      this.lastTime = performance.now();
      this.callbacks.onStatus("playing", this.score, "");
    }
  }

  private get stage(): ParkingStage { return PARKING_STAGES[this.level]; }

  private resetStage() {
    this.phase = "driving";
    this.phaseTime = 0;
    this.x = 102 + this.stage.carLength / 2;
    this.speed = 0;
    this.throttle = false;
    this.settleTime = 0;
    this.timeLeft = PARKING_ROUND_SECONDS;
    this.message = this.stage.hint;
    this.quality = 0;
    this.sparks = [];
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
    this.phaseTime += delta;
    if (this.phase === "success") {
      this.updateSparks(delta);
      if (this.phaseTime >= 1.05) {
        if (this.level >= PARKING_STAGES.length - 1) this.finish("won", "十个车位全部完美收官！");
        else { this.level += 1; this.resetStage(); gameAudio.play("start"); this.emitHud(true); }
      }
      return;
    }
    if (this.phase === "mistake") {
      this.updateSparks(delta);
      if (this.phaseTime >= 1.15) {
        if (this.lives <= 0) this.finish("lost", "最后一次机会也用完了");
        else { this.resetStage(); this.emitHud(true); }
      }
      return;
    }

    this.timeLeft = Math.max(0, this.timeLeft - delta);
    const stage = this.stage;
    if (this.throttle) this.speed += stage.acceleration * ACCELERATION_BOOST * delta;
    else this.speed -= stage.braking * BRAKING_BOOST * delta;
    if (this.speed > .1) this.speed += stage.slope * delta;
    this.speed = Math.max(0, Math.min(stage.maxSpeed * TOP_SPEED_BOOST, this.speed));
    this.x += this.speed * delta;
    this.wheelRotation += this.speed * delta / 13;

    const evaluation = evaluateParking(this.x, stage.carLength, stage.bayStart, stage.bayWidth, this.speed);
    this.quality = evaluation.quality;
    if (evaluation.parked && !this.throttle) this.settleTime += delta;
    else this.settleTime = 0;

    if (evaluation.crashed) { this.failStage("撞到车位尽头了"); return; }
    if (this.timeLeft <= 0) { this.failStage("停车时间用完了"); return; }
    if (this.settleTime >= .38) { this.clearStage(evaluation.quality); return; }

    const carFront = this.x + stage.carLength / 2;
    if (carFront < stage.bayStart - 70) this.message = this.throttle ? "保持油门，接近车位" : "还没到，再按住前进";
    else if (carFront < stage.bayStart) this.message = this.speed > 175 ? "立即松开！" : "准备松开油门";
    else if (evaluation.quality > .55) this.message = this.speed > 48 ? "正在入位，继续制动" : "稳住，就在这里";
    else if (this.x > stage.bayStart + stage.bayWidth / 2) this.message = "车头偏后，快停下";
    else this.message = "车身进入停车框";
    this.updateSparks(delta);
    this.emitHud(false);
  }

  private clearStage(quality: number) {
    const perfect = quality >= .78;
    this.combo = perfect ? this.combo + 1 : 0;
    const multiplier = perfect ? Math.max(1, this.combo) : 1;
    this.score += parkingScore(quality, multiplier, this.level + 1);
    this.message = perfect ? `完美入位 ×${multiplier}` : quality >= .45 ? "漂亮停车" : "成功入位";
    this.phase = "success";
    this.phaseTime = 0;
    this.spawnSparks("#ffe071", 24);
    gameAudio.play(perfect ? "perfect" : "stack");
    this.emitHud(true);
  }

  private failStage(message: string) {
    this.lives -= 1;
    this.combo = 0;
    this.message = message;
    this.phase = "mistake";
    this.phaseTime = 0;
    this.throttle = false;
    this.spawnSparks("#ff735f", 14);
    gameAudio.play("crash");
    this.emitHud(true);
  }

  private finish(status: "won" | "lost", message: string) {
    this.status = status;
    this.throttle = false;
    this.callbacks.onStatus(status, this.score, message);
    gameAudio.play(status === "won" ? "win" : "miss");
    this.emitHud(true);
  }

  private spawnSparks(color: string, count: number) {
    for (let index = 0; index < count; index += 1) {
      const angle = index / count * Math.PI * 2;
      this.sparks.push({ x: this.x, y: ROAD_Y - 32, vx: Math.cos(angle) * (45 + index % 5 * 13), vy: Math.sin(angle) * (38 + index % 4 * 11) - 24, age: 0, color });
    }
  }

  private updateSparks(delta: number) {
    this.sparks.forEach((spark) => { spark.age += delta; spark.x += spark.vx * delta; spark.y += spark.vy * delta; spark.vy += 80 * delta; });
    this.sparks = this.sparks.filter((spark) => spark.age < .7);
  }

  private emitHud(force: boolean) {
    const now = performance.now();
    if (!force && now - this.lastHud < 90) return;
    this.lastHud = now;
    const hud: ParkingHud = { level: this.level + 1, totalLevels: PARKING_STAGES.length, score: this.score, combo: this.combo, lives: this.lives, speed: this.speed, timeLeft: this.timeLeft, message: this.message, quality: this.quality };
    this.callbacks.onHud(hud);
  }

  private draw() {
    const context = this.context;
    const stage = PARKING_STAGES[Math.min(this.level, PARKING_STAGES.length - 1)];
    this.drawBackground(context, stage);
    this.drawParkingBay(context, stage);
    this.drawCar(context, stage);
    this.drawSparks(context);
    if (this.phase === "success") this.drawStageBanner(context, this.message, "#ffe071");
    if (this.phase === "mistake") this.drawStageBanner(context, this.message, "#ff806b");
    if (this.status === "paused") {
      context.fillStyle = "#11212ad4"; context.fillRect(0,0,WIDTH,HEIGHT);
      context.fillStyle = "#fff"; context.textAlign = "center"; context.font = "700 31px Georgia"; context.fillText("游戏暂停",WIDTH/2,HEIGHT/2);
    }
  }

  private drawBackground(context: CanvasRenderingContext2D, stage: ParkingStage) {
    const palettes = {
      morning: ["#a9def0", "#f8d7a5"], day: ["#73c9e7", "#d9f1de"], sunset: ["#796faa", "#ffb77c"], night: ["#172544", "#5c567d"],
    } as const;
    const [top,bottom] = palettes[stage.theme];
    const sky = context.createLinearGradient(0,0,0,HEIGHT);
    sky.addColorStop(0,top); sky.addColorStop(.72,bottom); sky.addColorStop(1,"#d9c6a2");
    context.fillStyle = sky; context.fillRect(0,0,WIDTH,HEIGHT);
    context.fillStyle = stage.theme === "night" ? "#fff6bd" : "#fff2b5";
    context.globalAlpha = stage.theme === "night" ? .76 : .9;
    context.beginPath(); context.arc(818,76,stage.theme === "night" ? 27 : 38,0,Math.PI*2); context.fill(); context.globalAlpha = 1;
    if (stage.theme === "night") {
      context.fillStyle = "#fff";
      for (let index=0; index<24; index+=1) { context.globalAlpha=.25+(index%3)*.18; context.fillRect((index*83)%930+12,(index*47)%175+18,1.5,1.5); }
      context.globalAlpha=1;
    }
    for (let index=0; index<11; index+=1) {
      const x=index*94-20; const h=58+(index*31)%92;
      context.fillStyle = stage.theme === "night" ? (index%2?"#26314c":"#303958") : (index%2?"#c4a983":"#d1b894");
      context.fillRect(x,ROAD_Y-h-32,82,h);
      context.fillStyle = stage.theme === "night" ? "#f8d37a99" : "#fff8d1a8";
      for(let row=0;row<3;row+=1) for(let col=0;col<3;col+=1) context.fillRect(x+12+col*21,ROAD_Y-h-18+row*22,8,11);
    }
    context.fillStyle="#6e765c"; context.fillRect(0,ROAD_Y-44,WIDTH,44);
    for(let x=25;x<WIDTH;x+=118) { context.fillStyle="#3d674e"; context.beginPath(); context.arc(x,ROAD_Y-47,28,0,Math.PI*2); context.fill(); context.fillStyle="#59452f"; context.fillRect(x-4,ROAD_Y-48,8,48); }
    context.fillStyle = stage.surface === "ice" ? "#b9d8df" : stage.surface === "wet" ? "#34434a" : "#4d5252"; context.fillRect(0,ROAD_Y,WIDTH,HEIGHT-ROAD_Y);
    context.fillStyle = stage.surface === "wet" ? "#b9e7f02e" : stage.surface === "ice" ? "#ffffff55" : "#ffffff18";
    for(let x=0;x<WIDTH;x+=74) context.fillRect(x,ROAD_Y+62,43,3);
    context.fillStyle="#e6d7ad"; context.fillRect(0,ROAD_Y-6,WIDTH,8);
    if(stage.surface==="wet") { context.fillStyle="#8fd8e630"; context.beginPath(); context.ellipse(505,467,170,13,0,0,Math.PI*2); context.fill(); }
    if(stage.surface==="ice") { context.strokeStyle="#ffffff80"; context.lineWidth=2; for(let x=180;x<890;x+=170){ context.beginPath(); context.moveTo(x,440); context.lineTo(x+42,423); context.lineTo(x+76,440); context.stroke(); } }
  }

  private drawParkingBay(context: CanvasRenderingContext2D, stage: ParkingStage) {
    const end=stage.bayStart+stage.bayWidth;
    context.save();
    context.strokeStyle="#fff8c9"; context.lineWidth=5; context.setLineDash([14,7]); context.strokeRect(stage.bayStart,ROAD_Y-68,stage.bayWidth,91); context.setLineDash([]);
    context.fillStyle="#fff8c91f"; context.fillRect(stage.bayStart,ROAD_Y-68,stage.bayWidth,91);
    context.fillStyle="#fff"; context.globalAlpha=.68; context.font="700 34px Arial"; context.textAlign="center"; context.fillText("P",stage.bayStart+stage.bayWidth/2,ROAD_Y+10); context.globalAlpha=1;
    context.fillStyle="#ef6b50"; for(const x of [stage.bayStart-14,end+11]) { context.beginPath(); context.moveTo(x,ROAD_Y-83); context.lineTo(x-9,ROAD_Y-49); context.lineTo(x+9,ROAD_Y-49); context.closePath(); context.fill(); context.fillStyle="#fff1d2"; context.fillRect(x-7,ROAD_Y-64,14,5); context.fillStyle="#ef6b50"; }
    const target=stage.bayStart+stage.bayWidth/2;
    context.strokeStyle="#78f2aa99"; context.lineWidth=2; context.beginPath(); context.moveTo(target,ROAD_Y-76); context.lineTo(target,ROAD_Y+30); context.stroke();
    context.restore();
  }

  private drawCar(context: CanvasRenderingContext2D, stage: ParkingStage) {
    const length=stage.carLength; const y=ROAD_Y-25;
    const colors = stage.vehicle === "van" ? ["#e7b552","#704327"] : stage.vehicle === "compact" ? ["#ef7164","#7d2833"] : ["#5aa9d6","#244f78"];
    context.save(); context.translate(this.x,y);
    if(this.throttle && this.speed>12) { context.strokeStyle="#ffffff66"; context.lineWidth=3; for(let i=0;i<3;i+=1){ context.beginPath(); context.moveTo(-length/2-14-i*9,-4+i*8); context.lineTo(-length/2-38-i*14,-4+i*8); context.stroke(); } }
    context.fillStyle="#1116"; context.beginPath(); context.ellipse(0,23,length*.56,9,0,0,Math.PI*2); context.fill();
    const body=context.createLinearGradient(0,-35,0,18); body.addColorStop(0,colors[0]); body.addColorStop(1,colors[1]); context.fillStyle=body; context.strokeStyle="#3b2930"; context.lineWidth=3;
    context.beginPath(); context.roundRect(-length/2,-21,length,34,10); context.fill(); context.stroke();
    const roofWidth=stage.vehicle==="van"?length*.68:length*.55; context.beginPath(); context.moveTo(-roofWidth/2,-21); context.lineTo(-roofWidth*.28,-39); context.lineTo(roofWidth*.36,-39); context.lineTo(roofWidth/2,-21); context.closePath(); context.fill(); context.stroke();
    context.fillStyle="#bce5ee"; context.beginPath(); context.moveTo(-roofWidth*.23,-35); context.lineTo(-4,-35); context.lineTo(-4,-23); context.lineTo(-roofWidth*.42,-23); context.closePath(); context.fill(); context.beginPath(); context.moveTo(1,-35); context.lineTo(roofWidth*.32,-35); context.lineTo(roofWidth*.44,-23); context.lineTo(1,-23); context.closePath(); context.fill();
    context.fillStyle="#ffe996"; context.fillRect(length/2-5,-12,5,9); context.fillStyle="#ff5e54"; context.fillRect(-length/2,-12,5,9);
    for(const wx of [-length*.29,length*.29]) { context.save(); context.translate(wx,11); context.rotate(this.wheelRotation); context.fillStyle="#1b1d22"; context.beginPath(); context.arc(0,0,12,0,Math.PI*2); context.fill(); context.strokeStyle="#9da4a5"; context.lineWidth=3; context.beginPath(); context.arc(0,0,5,0,Math.PI*2); context.stroke(); context.beginPath(); context.moveTo(-5,0);context.lineTo(5,0);context.moveTo(0,-5);context.lineTo(0,5);context.stroke(); context.restore(); }
    context.restore();
  }

  private drawSparks(context: CanvasRenderingContext2D) {
    this.sparks.forEach((spark)=>{ context.save(); context.globalAlpha=Math.max(0,1-spark.age/.7); context.fillStyle=spark.color; context.translate(spark.x,spark.y); context.rotate(spark.age*6); context.fillRect(-3,-3,6,6); context.restore(); });
  }

  private drawStageBanner(context: CanvasRenderingContext2D, message: string, color: string) {
    const alpha=Math.min(1,this.phaseTime*5)*Math.min(1,(1.15-this.phaseTime)*5);
    context.save(); context.globalAlpha=Math.max(0,alpha); context.textAlign="center"; context.shadowColor=color; context.shadowBlur=18; context.fillStyle=color; context.font="800 31px Georgia"; context.fillText(message,WIDTH/2,174); context.restore();
  }
}
