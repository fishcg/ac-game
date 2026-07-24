import { gameAudio } from "@/lib/audio/gameAudio";
import { createMoonCourse, MOON_GRAVITY, PLAYER_RADIUS } from "./data";
import { findGrappleTarget, grappleQuality, grappleScore } from "./rules";
import type { MoonCourse, MoonSwingCallbacks, MoonSwingHud, MoonSwingStatus } from "./types";

const WIDTH = 960;
const HEIGHT = 540;

type Particle = { x: number; y: number; vx: number; vy: number; age: number; color: string; size: number };
type TrailPoint = { x: number; y: number; age: number };

export class MoonSwingEngine {
  private context: CanvasRenderingContext2D;
  private animation = 0;
  private lastTime = 0;
  private lastHud = 0;
  private status: MoonSwingStatus = "idle";
  private course: MoonCourse = createMoonCourse();
  private x = 220;
  private y = 315;
  private vx = 180;
  private vy = 0;
  private attachedId: number | null = 1;
  private lastAnchorId: number | null = 1;
  private ropeLength = 110;
  private cameraX = 0;
  private score = 0;
  private stars = 0;
  private combo = 0;
  private maxDistance = 0;
  private elapsed = 0;
  private grappleBuffer = 0;
  private actionCooldown = 0;
  private message = "点击释放绳索";
  private particles: Particle[] = [];
  private trail: TrailPoint[] = [];

  constructor(private canvas: HTMLCanvasElement, private callbacks: MoonSwingCallbacks) {
    this.context = canvas.getContext("2d")!;
    this.resize();
  }

  resize() {
    const ratio = Math.min(2,window.devicePixelRatio||1);
    this.canvas.width=WIDTH*ratio;this.canvas.height=HEIGHT*ratio;
    this.context.setTransform(ratio,0,0,ratio,0,0);
    this.draw();
  }

  start(seed = Math.floor(performance.now())) {
    this.course=createMoonCourse(seed);
    const first=this.course.bodies[0];
    this.x=first.x;this.y=first.y+110;this.vx=185;this.vy=0;
    this.attachedId=first.id;this.lastAnchorId=first.id;this.ropeLength=110;
    this.cameraX=0;this.score=0;this.stars=0;this.combo=0;this.maxDistance=0;this.elapsed=0;
    this.grappleBuffer=0;this.actionCooldown=0;this.message="点击释放绳索";this.particles=[];this.trail=[];
    this.status="playing";this.lastTime=performance.now();
    cancelAnimationFrame(this.animation);this.animation=requestAnimationFrame(this.tick);
    gameAudio.play("start");this.callbacks.onStatus("playing",0,"");this.emitHud(true);
  }

  destroy(){cancelAnimationFrame(this.animation);}

  action(){
    if(this.status!=="playing"||this.actionCooldown>0)return;
    this.actionCooldown=.11;
    if(this.attachedId!==null){
      this.attachedId=null;
      this.vx=Math.max(this.vx,165+Math.min(55,this.maxDistance*.012));
      this.vy=Math.min(this.vy,-105);
      this.grappleBuffer=0;
      this.message="等目标亮起，再次点击抓住";
      gameAudio.play("drop");
    }else{
      this.grappleBuffer=.48;
      if(!this.tryAttach()) gameAudio.play("tap");
    }
    this.emitHud(true);
  }

  togglePause(){
    if(this.status==="playing"){this.status="paused";this.callbacks.onStatus("paused",this.score,"");this.draw();}
    else if(this.status==="paused"){this.status="playing";this.lastTime=performance.now();this.callbacks.onStatus("playing",this.score,"");}
  }

  private tick=(time:number)=>{
    const delta=Math.min(.03,Math.max(0,(time-this.lastTime)/1000));this.lastTime=time;
    if(this.status==="playing")this.update(delta);
    this.draw();
    if(this.status==="playing"||this.status==="paused")this.animation=requestAnimationFrame(this.tick);
  };

  private update(delta:number){
    this.elapsed+=delta;this.actionCooldown=Math.max(0,this.actionCooldown-delta);this.grappleBuffer=Math.max(0,this.grappleBuffer-delta);
    this.vy+=MOON_GRAVITY*delta;this.x+=this.vx*delta;this.y+=this.vy*delta;
    if(this.attachedId!==null){
      const anchor=this.bodyById(this.attachedId);
      if(anchor){
        const dx=this.x-anchor.x;const dy=this.y-anchor.y;const distance=Math.max(.001,Math.hypot(dx,dy));const nx=dx/distance;const ny=dy/distance;
        this.x=anchor.x+nx*this.ropeLength;this.y=anchor.y+ny*this.ropeLength;
        const radialVelocity=this.vx*nx+this.vy*ny;this.vx-=radialVelocity*nx;this.vy-=radialVelocity*ny;
        this.vx+=Math.max(0,28-this.vx)*delta*.35;
      }
      this.message="点击释放，借惯性飞向下一颗星球";
    }else{
      if(this.grappleBuffer>0)this.tryAttach();
      const target=this.currentTarget();
      this.message=target?"目标已锁定，点击抓住":"飞向发光范围";
    }

    this.maxDistance=Math.max(this.maxDistance,this.x-this.course.bodies[0].x);
    const targetCamera=Math.max(0,this.x-286);this.cameraX+=(targetCamera-this.cameraX)*Math.min(1,delta*4.5);
    this.collectStars();
    this.checkHazards();
    if(this.status!=="playing")return;
    if(this.y>HEIGHT+135||this.x<this.cameraX-110){this.finish("lost","小兔坠入了星海");return;}
    if(this.x>=this.course.goalX-72){this.finish("won","你荡到了月宫门前！");return;}
    this.trail.push({x:this.x,y:this.y,age:0});
    if(this.trail.length>28)this.trail.shift();
    this.trail.forEach((point)=>point.age+=delta);
    this.updateParticles(delta);this.emitHud(false);
  }

  private tryAttach(){
    const target=findGrappleTarget(this.x,this.y,this.course.bodies,this.lastAnchorId);
    if(!target)return false;
    const dx=this.x-target.x;const dy=this.y-target.y;const distance=Math.hypot(dx,dy);
    this.attachedId=target.id;this.lastAnchorId=target.id;this.ropeLength=Math.max(target.radius+42,Math.min(178,distance));this.grappleBuffer=0;
    const nx=dx/Math.max(.001,distance);const ny=dy/Math.max(.001,distance);const radial=this.vx*nx+this.vy*ny;this.vx-=radial*nx*.9;this.vy-=radial*ny*.9;
    const quality=grappleQuality(distance);const perfect=quality>=.72;this.combo=perfect?this.combo+1:0;const multiplier=perfect?Math.max(1,this.combo):1;
    this.score+=grappleScore(quality,multiplier);this.message=perfect?`完美抓取 ×${multiplier}`:"抓住了！";
    this.spawnParticles(this.x,this.y,perfect?"#fff1a8":"#9cecff",perfect?18:10);gameAudio.play(perfect?"perfect":"match");this.emitHud(true);return true;
  }

  private currentTarget(){return findGrappleTarget(this.x,this.y,this.course.bodies,this.lastAnchorId);}
  private bodyById(id:number){return this.course.bodies.find((body)=>body.id===id);}

  private collectStars(){
    for(const star of this.course.stars){
      if(star.collected||Math.abs(star.x-this.x)>28||Math.abs(star.y-this.y)>28)continue;
      if(Math.hypot(star.x-this.x,star.y-this.y)<=PLAYER_RADIUS+10){star.collected=true;this.stars+=1;this.score+=50;this.spawnParticles(star.x,star.y,"#ffe77a",8);gameAudio.play("score");}
    }
  }

  private checkHazards(){
    for(const body of this.course.bodies){
      if(body.kind!=="hazard"||Math.abs(body.x-this.x)>body.radius+PLAYER_RADIUS+5)continue;
      if(Math.hypot(body.x-this.x,body.y-this.y)<body.radius+PLAYER_RADIUS){this.finish("lost","撞上了危险的赤红陨星");return;}
    }
  }

  private finish(status:"won"|"lost",message:string){
    if(this.status!=="playing")return;
    this.status=status;this.message=message;this.callbacks.onStatus(status,this.score,message);gameAudio.play(status==="won"?"win":"crash");this.emitHud(true);
  }

  private spawnParticles(x:number,y:number,color:string,count:number){
    for(let index=0;index<count&&this.particles.length<70;index+=1){const angle=index/count*Math.PI*2;this.particles.push({x,y,vx:Math.cos(angle)*(30+(index%4)*18),vy:Math.sin(angle)*(30+(index%5)*14),age:0,color,size:2+(index%3)});}
  }

  private updateParticles(delta:number){this.particles.forEach((particle)=>{particle.age+=delta;particle.x+=particle.vx*delta;particle.y+=particle.vy*delta;particle.vx*=.98;particle.vy*=.98;});this.particles=this.particles.filter((particle)=>particle.age<.65);}

  private emitHud(force:boolean){
    const now=performance.now();if(!force&&now-this.lastHud<90)return;this.lastHud=now;
    const progress=Math.max(0,Math.min(1,this.maxDistance/Math.max(1,this.course.goalX-this.course.bodies[0].x)));
    const hud:MoonSwingHud={score:this.score,distance:Math.round(this.maxDistance/10),progress,stars:this.stars,combo:this.combo,attached:this.attachedId!==null,targetReady:this.attachedId===null&&Boolean(this.currentTarget()),message:this.message};this.callbacks.onHud(hud);
  }

  private draw(){
    const context=this.context;this.drawSpace(context);
    context.save();context.translate(-this.cameraX,0);
    this.drawStars(context);this.drawBodies(context);this.drawTrail(context);this.drawRopeAndTarget(context);this.drawPlayer(context);this.drawParticles(context);
    context.restore();
    if(this.status==="paused"){context.fillStyle="#090d2bd8";context.fillRect(0,0,WIDTH,HEIGHT);context.fillStyle="#fff";context.textAlign="center";context.font="700 30px Georgia";context.fillText("星空暂停",WIDTH/2,HEIGHT/2);}
  }

  private drawSpace(context:CanvasRenderingContext2D){
    const gradient=context.createLinearGradient(0,0,0,HEIGHT);gradient.addColorStop(0,"#11143d");gradient.addColorStop(.58,"#2b2257");gradient.addColorStop(1,"#5d365f");context.fillStyle=gradient;context.fillRect(0,0,WIDTH,HEIGHT);
    const glow=context.createRadialGradient(760,80,5,760,80,280);glow.addColorStop(0,"#8fcaff45");glow.addColorStop(1,"#8fcaff00");context.fillStyle=glow;context.fillRect(0,0,WIDTH,HEIGHT);
    for(let index=0;index<68;index+=1){const parallax=this.cameraX*(.05+(index%3)*.04);const x=((index*137-parallax)%1040+1040)%1040-40;const y=(index*67)%470+18;const size=1+(index%4===0?1.4:0);context.globalAlpha=.25+(index%5)*.12;context.fillStyle=index%7===0?"#ffd6ed":"#fff";context.beginPath();context.arc(x,y,size,0,Math.PI*2);context.fill();}context.globalAlpha=1;
  }

  private drawStars(context:CanvasRenderingContext2D){
    for(const star of this.course.stars){if(star.collected||star.x<this.cameraX-30||star.x>this.cameraX+WIDTH+30)continue;const pulse=1+Math.sin(this.elapsed*5+star.id)*.16;context.save();context.translate(star.x,star.y);context.scale(pulse,pulse);context.fillStyle="#ffe77a";context.shadowColor="#ffe77a";context.shadowBlur=10;context.beginPath();for(let point=0;point<8;point+=1){const angle=-Math.PI/2+point*Math.PI/4;const radius=point%2?3.5:8;const px=Math.cos(angle)*radius;const py=Math.sin(angle)*radius;if(point===0)context.moveTo(px,py);else context.lineTo(px,py);}context.closePath();context.fill();context.restore();}
  }

  private drawBodies(context:CanvasRenderingContext2D){
    for(const body of this.course.bodies){if(body.x+body.radius<this.cameraX-40||body.x-body.radius>this.cameraX+WIDTH+50)continue;context.save();context.translate(body.x,body.y);
      if(body.kind==="hazard"){context.rotate(this.elapsed*.45+body.id);context.shadowColor="#ff5f4d";context.shadowBlur=18;context.fillStyle="#8e2736";context.beginPath();for(let point=0;point<12;point+=1){const angle=point/12*Math.PI*2;const r=point%2?body.radius*.74:body.radius*1.15;const px=Math.cos(angle)*r,py=Math.sin(angle)*r;if(point===0)context.moveTo(px,py);else context.lineTo(px,py);}context.closePath();context.fill();context.fillStyle="#ff7b58";context.beginPath();context.arc(-5,-6,body.radius*.22,0,Math.PI*2);context.fill();context.restore();continue;}
      context.shadowColor=body.kind==="palace"?"#ffe69b":"hsla("+body.hue+",80%,70%,.6)";context.shadowBlur=body.kind==="palace"?28:15;
      const sphere=context.createRadialGradient(-body.radius*.35,-body.radius*.38,2,0,0,body.radius);sphere.addColorStop(0,"#fff8d6");sphere.addColorStop(.2,`hsl(${body.hue} 72% 72%)`);sphere.addColorStop(.72,`hsl(${body.hue} 55% 44%)`);sphere.addColorStop(1,`hsl(${body.hue} 52% 20%)`);context.fillStyle=sphere;context.beginPath();context.arc(0,0,body.radius,0,Math.PI*2);context.fill();context.shadowBlur=0;
      context.fillStyle="#30244a35";context.beginPath();context.arc(-body.radius*.22,-body.radius*.1,body.radius*.17,0,Math.PI*2);context.arc(body.radius*.3,body.radius*.26,body.radius*.12,0,Math.PI*2);context.fill();
      if(body.kind==="moon"){context.strokeStyle="#fff1b56b";context.lineWidth=3;context.beginPath();context.arc(0,0,body.radius+6,.2,Math.PI*1.65);context.stroke();}
      if(body.kind==="palace"){context.fillStyle="#fff0b5";context.fillRect(-30,-body.radius-28,60,30);context.fillStyle="#9a608d";for(let tower=-1;tower<=1;tower+=1){context.fillRect(tower*22-7,-body.radius-45,14,24);context.beginPath();context.moveTo(tower*22-9,-body.radius-45);context.lineTo(tower*22,-body.radius-57);context.lineTo(tower*22+9,-body.radius-45);context.fill();}}
      context.restore();
    }
  }

  private drawTrail(context:CanvasRenderingContext2D){for(let index=0;index<this.trail.length;index+=1){const point=this.trail[index];context.globalAlpha=(index/this.trail.length)*.28;context.fillStyle="#b9eaff";context.beginPath();context.arc(point.x,point.y,2+index/this.trail.length*3,0,Math.PI*2);context.fill();}context.globalAlpha=1;}

  private drawRopeAndTarget(context:CanvasRenderingContext2D){
    if(this.attachedId!==null){const anchor=this.bodyById(this.attachedId);if(anchor){const rope=context.createLinearGradient(anchor.x,anchor.y,this.x,this.y);rope.addColorStop(0,"#fff0a8");rope.addColorStop(1,"#9de8ff");context.strokeStyle=rope;context.shadowColor="#a5eaff";context.shadowBlur=7;context.lineWidth=3;context.beginPath();context.moveTo(anchor.x,anchor.y);context.lineTo(this.x,this.y);context.stroke();context.shadowBlur=0;}}
    else{const target=this.currentTarget();if(target){const pulse=1+Math.sin(this.elapsed*8)*.08;context.save();context.translate(target.x,target.y);context.scale(pulse,pulse);context.strokeStyle="#a9f3ff";context.shadowColor="#7fe9ff";context.shadowBlur=13;context.lineWidth=3;context.setLineDash([7,6]);context.beginPath();context.arc(0,0,target.radius+16,0,Math.PI*2);context.stroke();context.setLineDash([]);context.restore();context.strokeStyle="#b9efff66";context.lineWidth=1;context.setLineDash([4,7]);context.beginPath();context.moveTo(this.x,this.y);context.lineTo(target.x,target.y);context.stroke();context.setLineDash([]);}}
  }

  private drawPlayer(context:CanvasRenderingContext2D){
    context.save();context.translate(this.x,this.y);const angle=Math.atan2(this.vy,this.vx);context.rotate(Math.max(-.7,Math.min(.7,angle*.25)));
    context.shadowColor="#a9eaff";context.shadowBlur=14;context.fillStyle="#a9eaff35";context.beginPath();context.arc(0,0,PLAYER_RADIUS+8,0,Math.PI*2);context.fill();context.shadowBlur=0;
    context.fillStyle="#f8f0dd";context.strokeStyle="#68577b";context.lineWidth=2;context.beginPath();context.roundRect(-12,-10,24,24,9);context.fill();context.stroke();
    context.fillStyle="#f8f0dd";context.beginPath();context.ellipse(-6,-17,4,10,-.15,0,Math.PI*2);context.ellipse(6,-17,4,10,.15,0,Math.PI*2);context.fill();context.stroke();
    context.fillStyle="#4f4267";context.beginPath();context.arc(-5,-5,2,0,Math.PI*2);context.arc(5,-5,2,0,Math.PI*2);context.fill();context.fillStyle="#ef8fa1";context.beginPath();context.arc(0,0,2,0,Math.PI*2);context.fill();
    context.strokeStyle="#fff";context.globalAlpha=.72;context.beginPath();context.arc(-3,-4,PLAYER_RADIUS+5,Math.PI*1.12,Math.PI*1.7);context.stroke();context.restore();
  }

  private drawParticles(context:CanvasRenderingContext2D){for(const particle of this.particles){context.save();context.globalAlpha=Math.max(0,1-particle.age/.65);context.fillStyle=particle.color;context.shadowColor=particle.color;context.shadowBlur=6;context.translate(particle.x,particle.y);context.rotate(particle.age*5);context.fillRect(-particle.size/2,-particle.size/2,particle.size,particle.size);context.restore();}}
}
