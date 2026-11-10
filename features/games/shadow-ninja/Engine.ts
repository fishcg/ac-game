import { DuelAi } from "./ai";
import {
  AIR_FRICTION,
  BODY_H,
  BODY_W,
  CROUCH_H,
  GRAVITY,
  GROUND_FRICTION,
  GROUND_Y,
  GUARD_BREAK_FRAMES,
  GUARD_MAX,
  ROUND_FRAMES,
  START_CHAKRA,
  STEP_MS,
  WORLD_LEFT,
  WORLD_RIGHT,
  characters,
  stageForRound,
} from "./data";
import {
  canBlock,
  chakraFromDealing,
  chakraFromTaking,
  clamp,
  clampChakra,
  computeScore,
  guardAfter,
  isGuardBroken,
  matchDecided,
  recoverGuard,
  roundOutcome,
  scaledDamage,
  blockedDamage,
  type DefenderView,
} from "./rules";
import { createInput } from "./types";
import type {
  AttackKind,
  Box,
  Difficulty,
  Fighter,
  FighterId,
  HitSpec,
  HudSnapshot,
  InputState,
  MatchMode,
  MatchPhase,
  MatchResult,
  Particle,
  Projectile,
  SoundName,
  StageDef,
  TrailSample,
} from "./types";

export type EngineOptions = {
  p1: FighterId;
  p2: FighterId;
  mode: MatchMode;
  difficulty: Difficulty;
  onHud: (hud: HudSnapshot) => void;
  onSound: (name: SoundName) => void;
  onEnd: (result: MatchResult) => void;
};

export type Floater = {
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
  size: number;
};

const ATTACK_ORDER: AttackKind[] = ["super", "special", "heavy", "light"];

function makeFighter(side: 0 | 1, id: FighterId): Fighter {
  const def = characters[id];
  return {
    side,
    def,
    x: side === 0 ? 420 : 780,
    y: 0,
    vx: 0,
    vy: 0,
    facing: side === 0 ? 1 : -1,
    hp: def.maxHp,
    chakra: START_CHAKRA,
    guard: GUARD_MAX,
    state: "idle",
    stateFrame: 0,
    move: null,
    moveFrame: 0,
    hitsDone: [],
    hitstun: 0,
    blockstun: 0,
    invuln: 0,
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    damageDealt: 0,
    airJumps: 1,
    flash: 0,
    guardBroken: 0,
    blockFlash: 0,
    crouch: false,
    tapDir: 0,
    tapTimer: 0,
    trail: [],
    landed: true,
    superGlow: 0,
  };
}

export class DuelEngine {
  readonly fighters: [Fighter, Fighter];
  readonly projectiles: Projectile[] = [];
  readonly particles: Particle[] = [];
  readonly floaters: Floater[] = [];

  readonly input1: InputState = createInput();
  readonly input2: InputState = createInput();

  phase: MatchPhase = "intro";
  stage: StageDef;
  round = 1;
  wins: [number, number] = [0, 0];
  time = 0;
  camX = 0;
  shake = 0;
  flashScreen = 0;
  hitstop = 0;
  freezeOwner: 0 | 1 | null = null;
  freezeTimer = 0;
  callout = "";
  calloutTone: "normal" | "warn" | "win" = "normal";
  calloutTimer = 0;
  banner = "";
  bannerTone: FighterId | null = null;
  bannerTimer = 0;
  paused = false;
  ended = false;
  frame = 0;

  private readonly opts: EngineOptions;
  private readonly ai: DuelAi | null;
  private pressed1 = new Set<AttackKind | "left" | "right" | "up" | "down" | "guard">();
  private pressed2 = new Set<AttackKind | "left" | "right" | "up" | "down" | "guard">();
  private timer = ROUND_FRAMES;
  private phaseTimer = 0;
  private accumulator = 0;
  private hudTick = 0;
  private disposedMark = false;
  private slowFrames = 0;
  private slowToggle = 0;
  private damageTotal = 0;
  private maxComboSeen = 0;
  private perfectRound = false;

  constructor(opts: EngineOptions) {
    this.opts = opts;
    this.fighters = [makeFighter(0, opts.p1), makeFighter(1, opts.p2)];
    this.ai = opts.mode === "cpu" ? new DuelAi(opts.difficulty) : null;
    this.stage = stageForRound(1);
    this.resetRound(1);
    this.pushHud();
  }

  get roundTimeLeft(): number {
    return Math.max(0, this.timer / 60);
  }

  setPaused(next: boolean): void {
    this.paused = next;
    if (next) {
      this.input1.queue.length = 0;
      this.input2.queue.length = 0;
    }
  }

  dispose(): void {
    this.disposedMark = true;
    this.particles.length = 0;
    this.projectiles.length = 0;
    this.floaters.length = 0;
  }

  update(dtMs: number): void {
    if (this.paused || this.disposedMark) return;
    this.accumulator += Math.min(120, Math.max(0, dtMs));
    let steps = 0;
    while (this.accumulator >= STEP_MS && steps < 5) {
      this.accumulator -= STEP_MS;
      steps += 1;
      if (this.slowFrames > 0) {
        this.slowToggle = (this.slowToggle + 1) % 2;
        if (this.slowToggle === 0) continue;
      }
      this.step();
    }
  }

  // ── 回合流程 ───────────────────────────────────────────────

  private resetRound(round: number): void {
    this.round = round;
    this.stage = stageForRound(round);
    this.timer = ROUND_FRAMES;
    this.phase = "intro";
    this.phaseTimer = 132;
    this.hitstop = 0;
    this.freezeOwner = null;
    this.freezeTimer = 0;
    this.shake = 0;
    this.flashScreen = 0;
    this.projectiles.length = 0;
    this.particles.length = 0;
    this.floaters.length = 0;
    this.slowFrames = 0;
    this.ai?.reset();

    const [a, b] = this.fighters;
    for (const [index, f] of [a, b].entries()) {
      f.x = index === 0 ? 420 : 780;
      f.y = 0;
      f.vx = 0;
      f.vy = 0;
      f.hp = f.def.maxHp;
      f.chakra = START_CHAKRA;
      f.guard = GUARD_MAX;
      f.state = "idle";
      f.stateFrame = 0;
      f.move = null;
      f.moveFrame = 0;
      f.hitsDone = [];
      f.hitstun = 0;
      f.blockstun = 0;
      f.invuln = 0;
      f.combo = 0;
      f.comboTimer = 0;
      f.airJumps = 1;
      f.flash = 0;
      f.guardBroken = 0;
      f.blockFlash = 0;
      f.crouch = false;
      f.tapDir = 0;
      f.tapTimer = 0;
      f.trail.length = 0;
      f.superGlow = 0;
      f.facing = index === 0 ? 1 : -1;
      f.combo = 0;
      f.maxCombo = 0;
    }
    a.facing = 1;
    b.facing = -1;
    this.camX = 0;
    this.setCallout(`ROUND ${round}`, "normal", 110);
  }

  private setCallout(text: string, tone: "normal" | "warn" | "win", frames: number): void {
    this.callout = text;
    this.calloutTone = tone;
    this.calloutTimer = frames;
  }

  private setBanner(text: string, tone: FighterId, frames: number): void {
    this.banner = text;
    this.bannerTone = tone;
    this.bannerTimer = frames;
  }

  private endRound(): void {
    const [a, b] = this.fighters;
    const outcome = roundOutcome(a.hp, b.hp, this.timer);
    if (outcome.winner === 0 || outcome.winner === 1) {
      const idx: 0 | 1 = outcome.winner;
      this.wins[idx] += 1;
      const winner = this.fighters[idx];
      const loser = this.fighters[idx === 0 ? 1 : 0];
      winner.state = "victory";
      winner.stateFrame = 0;
      winner.vx = 0;
      if (loser.hp > 0) loser.hp = 0;
      if (idx === 0 && a.hp === a.def.maxHp) this.perfectRound = true;
      if (outcome.reason === "ko") {
        this.setCallout("K.O.", "warn", 130);
        this.flashScreen = 0.55;
        this.onSound("ko");
      } else {
        this.setCallout("TIME UP", "warn", 130);
        this.onSound("ko");
      }
    } else {
      this.setCallout("DRAW", "warn", 120);
      this.onSound("ko");
    }

    for (const f of this.fighters) {
      if (f.state !== "victory") {
        f.state = "ko";
        f.stateFrame = 0;
        f.vx = -f.facing * 3.2;
        f.vy = 3.4;
      }
    }

    this.phase = "roundEnd";
    this.phaseTimer = 138;
    this.slowFrames = 30;
    this.shake = Math.max(this.shake, 8);
    this.pushHud();
  }

  private nextRound(): void {
    if (matchDecided(this.wins)) {
      this.finishMatch();
      return;
    }
    this.resetRound(this.round + 1);
    this.pushHud();
  }

  private finishMatch(): void {
    this.phase = "matchEnd";
    const win = this.wins[0] > this.wins[1];
    this.damageTotal = this.fighters[0].damageDealt + this.fighters[1].damageDealt;
    const score = computeScore({
      win,
      wins: this.wins,
      damageDealt: this.damageTotal,
      maxCombo: Math.max(this.maxComboSeen, this.fighters[0].maxCombo),
      timeLeft: this.timer / 60,
      perfect: this.perfectRound && this.wins[1] === 0,
    });
    this.setCallout(win ? "胜利" : "败北", win ? "win" : "warn", 999);
    this.onSound(win ? "win" : "lose");
    if (!this.ended) {
      this.ended = true;
      this.opts.onEnd({
        win,
        score,
        wins: [this.wins[0], this.wins[1]],
        maxCombo: Math.max(this.maxComboSeen, this.fighters[0].maxCombo),
        perfect: this.perfectRound && this.wins[1] === 0,
        title: win ? (this.perfectRound && this.wins[1] === 0 ? "完胜" : "胜利") : "败北",
      });
    }
    this.pushHud();
  }

  // ── 主循环 ─────────────────────────────────────────────────

  private step(): void {
    this.frame += 1;
    this.time += 1 / 60;
    this.updateParticles();
    this.updateFloaters();
    this.updateTrails();

    if (this.calloutTimer > 0) this.calloutTimer -= 1;
    if (this.bannerTimer > 0) this.bannerTimer -= 1;
    if (this.flashScreen > 0) this.flashScreen = Math.max(0, this.flashScreen - 0.045);
    if (this.freezeTimer > 0) this.freezeTimer -= 1;
    if (this.slowFrames > 0) this.slowFrames -= 1;

    if (this.hitstop > 0) {
      this.hitstop -= 1;
      this.shake *= 0.92;
      return;
    }

    this.shake *= 0.86;
    if (this.shake < 0.15) this.shake = 0;

    if (this.phase === "matchEnd") {
      this.updateCamera();
      this.hudTick += 1;
      if (this.hudTick % 4 === 0) this.pushHud();
      return;
    }

    if (this.phase === "intro") {
      this.phaseTimer -= 1;
      this.faceTowards();
      this.updateCamera();
      if (this.phaseTimer === 40) this.setCallout("FIGHT!", "warn", 44);
      if (this.phaseTimer <= 0) {
        this.phase = "round";
        this.onSound("round");
      }
      this.hudTick += 1;
      if (this.hudTick % 4 === 0) this.pushHud();
      return;
    }

    if (this.phase === "roundEnd") {
      this.phaseTimer -= 1;
      for (const f of this.fighters) this.integrate(f);
      this.updateCamera();
      if (this.phaseTimer <= 0) this.nextRound();
      this.hudTick += 1;
      if (this.hudTick % 4 === 0) this.pushHud();
      return;
    }

    this.timer = Math.max(0, this.timer - 1);
    this.faceTowards();
    this.drainInputs();
    this.updateFighter(0);
    this.updateFighter(1);
    this.separate();
    this.updateProjectiles();
    this.updateCamera();

    if (this.fighters[0].hp <= 0 || this.fighters[1].hp <= 0 || this.timer <= 0) {
      this.endRound();
      return;
    }

    this.hudTick += 1;
    if (this.hudTick % 4 === 0) this.pushHud();
  }

  private drainInputs(): void {
    this.pressed1.clear();
    this.pressed2.clear();
    const drain = (queue: InputState["queue"], target: Set<string>) => {
      for (const action of queue.splice(0, queue.length)) target.add(action);
    };
    drain(this.input1.queue, this.pressed1);
    if (this.ai) {
      this.ai.update(this.fighters[1], this.fighters[0]);
      drain(this.ai.input.queue, this.pressed2);
    } else {
      drain(this.input2.queue, this.pressed2);
    }
  }

  private heldFor(side: 0 | 1): InputState["held"] {
    if (side === 0) return this.input1.held;
    if (this.ai) return this.ai.input.held;
    return this.input2.held;
  }

  private faceTowards(): void {
    const [a, b] = this.fighters;
    const freeze = (f: Fighter) =>
      f.state === "attack" ||
      f.state === "hit" ||
      f.state === "launch" ||
      f.state === "down" ||
      f.state === "getup" ||
      f.state === "ko" ||
      f.state === "victory";
    if (!freeze(a)) a.facing = b.x >= a.x ? 1 : -1;
    if (!freeze(b)) b.facing = a.x >= b.x ? 1 : -1;
  }

  private updateFighter(index: 0 | 1): void {
    const f = this.fighters[index];
    const foe = this.fighters[1 - index];
    const held = this.heldFor(index);
    const pressed = index === 0 ? this.pressed1 : this.pressed2;

    if (f.flash > 0) f.flash -= 1;
    if (f.blockFlash > 0) f.blockFlash -= 1;
    if (f.superGlow > 0) f.superGlow -= 1;
    if (f.invuln > 0) f.invuln -= 1;
    if (f.comboTimer > 0) {
      f.comboTimer -= 1;
      if (f.comboTimer === 0) f.combo = 0;
    }
    if (f.tapTimer > 0) f.tapTimer -= 1;
    else f.tapDir = 0;
    if (f.guardBroken > 0) f.guardBroken -= 1;
    else if (f.state !== "block" && f.blockstun <= 0) f.guard = recoverGuard(f.guard);

    if (f.state === "ko") {
      this.integrate(f);
      return;
    }
    if (f.state === "victory") {
      f.stateFrame += 1;
      this.integrate(f);
      return;
    }

    if (f.state === "launch") {
      const landed = this.integrate(f);
      if (landed) {
        f.state = "down";
        f.stateFrame = 26;
        this.spawnDust(f.x, GROUND_Y, 10, f.def.colors.trim);
        this.shake = Math.max(this.shake, 3);
      }
      return;
    }

    if (f.state === "down") {
      f.stateFrame -= 1;
      this.integrate(f);
      if (f.stateFrame <= 0) {
        f.state = "getup";
        f.stateFrame = 16;
        f.invuln = 18;
      }
      return;
    }

    if (f.state === "getup") {
      f.stateFrame -= 1;
      this.integrate(f);
      if (f.stateFrame <= 0) {
        f.state = "idle";
        f.stateFrame = 0;
      }
      return;
    }

    if (f.hitstun > 0) {
      f.hitstun -= 1;
      const landed = this.integrate(f);
      if (landed && f.state === "hit") f.state = "idle";
      if (f.hitstun <= 0) {
        if (f.state === "hit") f.state = "idle";
        f.vx *= 0.5;
      }
      return;
    }

    if (f.blockstun > 0) {
      f.blockstun -= 1;
      f.state = "block";
      f.crouch = true;
      this.integrate(f);
      return;
    }

    if (f.state === "attack" && f.move) {
      this.advanceMove(f, foe, pressed);
      this.integrate(f);
      return;
    }

    const airborne = f.y > 0.5;

    // 起跳与二段跳
    if (pressed.has("up")) {
      if (!airborne) {
        f.vy = f.def.jumpPower;
        f.y = 0.2;
        f.state = "air";
        f.airJumps = 1;
        const dir = held.left ? -1 : held.right ? 1 : 0;
        f.vx = dir * f.def.walkSpeed * 0.9;
        this.spawnDust(f.x, GROUND_Y, 5, f.def.colors.trim);
        this.onSound("jump");
      } else if (f.airJumps > 0) {
        f.airJumps -= 1;
        f.vy = f.def.jumpPower * 0.88;
        this.spawnChakraRing(f.x, GROUND_Y - f.y - 40, f.def.colors.glow);
        this.onSound("jump");
      }
    }

    if (airborne || f.state === "air") {
      if (held.left) f.vx = clamp(f.vx - 0.42, -6.4, 6.4);
      if (held.right) f.vx = clamp(f.vx + 0.42, -6.4, 6.4);
      f.state = "air";
      if (this.tryAttack(f, pressed, true)) return;
      this.integrate(f);
      return;
    }

    // 地面防御
    if (held.guard || held.down) {
      f.state = "block";
      f.crouch = true;
      f.vx *= 0.4;
      this.integrate(f);
      return;
    }

    // 地面攻击
    if (this.tryAttack(f, pressed, false)) {
      this.integrate(f);
      return;
    }

    // 冲刺（双击方向键）
    const tap = pressed.has("left") ? -1 : pressed.has("right") ? 1 : 0;
    if (tap !== 0) {
      if (f.tapDir === tap && f.tapTimer > 0) {
        f.vx = tap * 8.4;
        f.tapTimer = 0;
        f.tapDir = 0;
        this.spawnDust(f.x, GROUND_Y, 6, f.def.colors.glow);
      } else {
        f.tapDir = tap as -1 | 1;
        f.tapTimer = 15;
      }
    }

    const dir = (held.left ? -1 : 0) + (held.right ? 1 : 0);
    if (dir !== 0) {
      const forward = dir === f.facing;
      f.x += dir * f.def.walkSpeed * (forward ? 1 : 0.82);
      f.state = "walk";
      f.stateFrame += 1;
      if (this.frame % 16 === 0) this.spawnDust(f.x, GROUND_Y, 2, f.def.colors.trim);
    } else {
      f.state = "idle";
      f.stateFrame += 1;
    }
    f.crouch = false;
    this.integrate(f);
  }

  private tryAttack(f: Fighter, pressed: Set<string>, airborne: boolean): boolean {
    for (const kind of ATTACK_ORDER) {
      if (!pressed.has(kind)) continue;
      if (airborne && (kind === "special" || kind === "super")) continue;
      const move = f.def.moves[kind];
      if (move.cost > f.chakra) continue;
      this.startMove(f, kind);
      return true;
    }
    return false;
  }

  private startMove(f: Fighter, kind: AttackKind): void {
    const move = f.def.moves[kind];
    f.chakra = clampChakra(f.chakra - move.cost);
    f.state = "attack";
    f.stateFrame = 0;
    f.move = move;
    f.moveFrame = 0;
    f.hitsDone = move.hits.map(() => false);
    f.crouch = false;
    if (move.freeze) {
      this.hitstop = move.freeze;
      this.freezeOwner = f.side;
      this.freezeTimer = move.freeze;
      this.flashScreen = 0.4;
      this.shake = Math.max(this.shake, 5);
      this.setBanner(move.name, f.def.id, move.freeze + 34);
      this.onSound("super");
    } else if (move.cost > 0) {
      this.onSound("special");
      this.spawnChakraRing(f.x, GROUND_Y - f.y - 60, f.def.colors.glow);
    }
    f.superGlow = move.cost > 0 ? 24 : 0;
  }

  private advanceMove(f: Fighter, foe: Fighter, pressed: Set<string>): void {
    const move = f.move;
    if (!move) return;
    f.moveFrame += 1;

    if (move.lunge !== 0 && f.moveFrame === move.lungeFrame) {
      f.vx = f.facing * move.lunge;
      if (move.lunge > 3) this.spawnDust(f.x, GROUND_Y, 5, f.def.colors.glow);
    }

    for (let i = 0; i < move.hits.length; i += 1) {
      if (f.hitsDone[i]) continue;
      const hit = move.hits[i];
      if (f.moveFrame < hit.from || f.moveFrame > hit.to) continue;
      if (hit.projectile) {
        if (f.moveFrame === hit.from) {
          f.hitsDone[i] = true;
          this.spawnProjectile(f, hit);
        }
        continue;
      }
      const box = this.hitBox(f, hit.box);
      if (this.overlaps(box, this.hurtBox(foe))) {
        f.hitsDone[i] = true;
        this.applyHit(f, foe, hit, i, box);
      }
    }

    if (f.moveFrame >= move.cancelFrom) {
      for (const kind of ATTACK_ORDER) {
        if (!pressed.has(kind)) continue;
        if (!move.cancelInto.includes(kind)) continue;
        const next = f.def.moves[kind];
        if (next.cost > f.chakra) continue;
        this.startMove(f, kind);
        return;
      }
    }

    if (f.moveFrame >= move.total) {
      f.move = null;
      f.state = f.y > 0.5 ? "air" : "idle";
      f.stateFrame = 0;
      f.hitsDone = [];
    }
  }

  // ── 判定与结算 ─────────────────────────────────────────────

  private hurtBox(f: Fighter): Box {
    const height = f.crouch || f.state === "block" ? CROUCH_H : BODY_H;
    return { x: f.x - BODY_W / 2, y: GROUND_Y - f.y - height, w: BODY_W, h: height };
  }

  private hitBox(f: Fighter, box: Box): Box {
    const left = f.facing === 1 ? f.x + box.x : f.x - box.x - box.w;
    return { x: left, y: GROUND_Y - f.y - box.y - box.h, w: box.w, h: box.h };
  }

  private overlaps(a: Box, b: Box): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  private isGuarding(f: Fighter): boolean {
    const held = this.heldFor(f.side);
    return held.guard || held.down;
  }

  private applyHit(attacker: Fighter, defender: Fighter, hit: HitSpec, hitIndex: number, box: Box): void {
    if (defender.invuln > 0) return;

    const view: DefenderView = {
      grounded: defender.y <= 0.5,
      attacking: defender.state === "attack",
      hitstun: defender.hitstun,
      holdingGuard: this.isGuarding(defender),
      guard: defender.guard,
    };
    const blocked = canBlock(view);
    const comboIndex = attacker.combo;
    const base = hit.damage * (attacker.y > 0.5 ? 0.85 : 1);
    const damage = blocked ? blockedDamage(base, comboIndex) : scaledDamage(base, comboIndex);
    const contactX = clamp(defender.x, box.x, box.x + box.w);
    const contactY = box.y + box.h * 0.5;

    if (blocked) {
      defender.hp = Math.max(0, defender.hp - damage);
      defender.guard = guardAfter(defender.guard, hit.damage);
      defender.blockstun = Math.max(defender.blockstun, hit.blockstun);
      defender.blockFlash = 9;
      defender.state = "block";
      defender.crouch = true;
      defender.vx = attacker.facing * hit.knockback * 0.55;
      attacker.chakra = clampChakra(attacker.chakra + chakraFromDealing(8, true));
      defender.chakra = clampChakra(defender.chakra + chakraFromTaking(damage) * 0.5);
      this.hitstop = Math.max(this.hitstop, Math.min(7, hit.hitstop));
      this.shake = Math.max(this.shake, 1.6);
      this.onSound("block");
      this.spawnBlockSparks(contactX, contactY, defender.facing);
      this.spawnFloater(defender.x, contactY - 20, "GUARD", "#a9d6ff", 16);
      if (isGuardBroken(defender.guard) && defender.guardBroken <= 0) {
        defender.guard = 0;
        defender.guardBroken = GUARD_BREAK_FRAMES;
        defender.hitstun = GUARD_BREAK_FRAMES;
        defender.state = "hit";
        defender.vx = attacker.facing * 3.4;
        this.hitstop = Math.max(this.hitstop, 12);
        this.shake = Math.max(this.shake, 7);
        this.setCallout("GUARD BREAK", "warn", 60);
        this.spawnRing(contactX, contactY, "#ffd75e", 60);
        this.onSound("ko");
      }
    } else {
      defender.hp = Math.max(0, defender.hp - damage);
      defender.hitstun = hit.hitstun;
      defender.state = defender.y > 0.01 ? "launch" : "hit";
      defender.vx = (attacker.facing * hit.knockback) / defender.def.weight;
      defender.vy = -hit.lift / defender.def.weight;
      if (defender.state === "hit") defender.y = Math.max(defender.y, 0);
      defender.flash = 8;
      defender.combo = 0;
      defender.comboTimer = 0;
      attacker.combo += 1;
      attacker.comboTimer = 84;
      attacker.maxCombo = Math.max(attacker.maxCombo, attacker.combo);
      if (attacker.side === 0) this.maxComboSeen = Math.max(this.maxComboSeen, attacker.combo);
      attacker.damageDealt += damage;
      if (attacker.side === 0) this.damageTotal = this.fighters[0].damageDealt + this.fighters[1].damageDealt;
      const gain = attacker.move ? attacker.move.gain / Math.max(1, attacker.move.hits.length) : 8;
      attacker.chakra = clampChakra(attacker.chakra + chakraFromDealing(gain, false));
      defender.chakra = clampChakra(defender.chakra + chakraFromTaking(damage));
      this.hitstop = Math.max(this.hitstop, hit.hitstop);
      this.shake = Math.max(this.shake, hit.shake ?? 2.4);
      this.onSound(hit.sound);
      this.spawnHitSparks(contactX, contactY, attacker.facing, attacker.def.colors.glow, hit.damage > 10);
      this.spawnFloater(defender.x, contactY - 18, String(damage), "#ffffff", hit.damage > 10 ? 30 : 23);
      if (attacker.combo >= 3) {
        this.spawnFloater(defender.x, contactY - 58, `${attacker.combo} HIT`, attacker.def.colors.glow, 18);
      }
      if (defender.hp <= 0) {
        defender.state = "ko";
        defender.vy = 4.4;
        defender.vx = attacker.facing * 5.2;
        this.slowFrames = 24;
        this.flashScreen = 0.5;
        this.shake = Math.max(this.shake, 10);
      }
    }

    defender.facing = attacker.x >= defender.x ? 1 : -1;
    attacker.vx = -attacker.facing * Math.min(2.2, hit.knockback * 0.18);
  }

  private spawnProjectile(f: Fighter, hit: HitSpec): void {
    const spec = hit.projectile;
    if (!spec) return;
    const dir = f.facing;
    this.projectiles.push({
      owner: f.side,
      x: f.x + dir * spec.offsetX,
      y: GROUND_Y - f.y - spec.offsetY - spec.h * 0.5,
      vx: dir * spec.speed,
      w: spec.w,
      h: spec.h,
      life: spec.life,
      maxLife: spec.life,
      color: spec.color,
      spec,
      hit,
      alive: true,
      seed: this.frame * 7.13,
    });
    this.onSound("special");
    this.spawnChakraRing(this.projectiles[this.projectiles.length - 1].x, this.projectiles[this.projectiles.length - 1].y, spec.color);
  }

  private updateProjectiles(): void {
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      p.x += p.vx;
      p.life -= 1;
      if (p.spec.speed > 0 && this.frame % 2 === 0) {
        this.particles.push({
          kind: "flame",
          x: p.x - Math.sign(p.vx) * 14,
          y: p.y + (Math.random() - 0.5) * 18,
          vx: -p.vx * 0.12,
          vy: -0.4 - Math.random(),
          life: 16,
          maxLife: 16,
          size: 8 + Math.random() * 8,
          angle: 0,
          spin: 0,
          color: p.color,
          gravity: -0.02,
        });
      }
      const target = this.fighters[1 - p.owner];
      if (target.invuln <= 0 && this.overlaps({ x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h }, this.hurtBox(target))) {
        const attacker = this.fighters[p.owner];
        this.applyHit(attacker, target, p.hit, 0, { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h });
        p.alive = false;
        this.spawnRing(p.x, p.y, p.color, 44);
      }
      if (p.life <= 0) p.alive = false;
    }
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      if (!this.projectiles[i].alive) this.projectiles.splice(i, 1);
    }
  }

  private separate(): void {
    const [a, b] = this.fighters;
    const min = BODY_W * 0.68;
    let dx = b.x - a.x;
    const dist = Math.abs(dx);
    if (dist >= min) return;
    if (dist < 0.001) dx = 1;
    const push = (min - dist) / 2;
    const sign = dx >= 0 ? 1 : -1;
    a.x = clamp(a.x - push * sign, WORLD_LEFT, WORLD_RIGHT);
    b.x = clamp(b.x + push * sign, WORLD_LEFT, WORLD_RIGHT);
  }

  private integrate(f: Fighter): boolean {
    const grounded = f.y <= 0.01;
    if (!grounded || f.vy !== 0) {
      f.vy -= GRAVITY;
    }
    f.x += f.vx;
    f.y += f.vy;
    let landed = false;
    if (f.y <= 0) {
      if (f.vy < 0) {
        const impact = f.vy;
        f.y = 0;
        f.vy = 0;
        f.vx *= 0.72;
        landed = f.state === "air" || f.state === "launch" || f.state === "ko" ? true : false;
        if (landed && impact < -6) {
          this.spawnDust(f.x, GROUND_Y, 7, f.def.colors.trim);
          if (f.state === "air") this.onSound("land");
        }
        if (landed && f.state === "air") {
          f.state = "idle";
          f.airJumps = 1;
        }
      } else {
        f.y = 0;
        f.vy = 0;
      }
    }
    f.vx *= f.y > 0.01 ? AIR_FRICTION : GROUND_FRICTION;
    if (Math.abs(f.vx) < 0.05) f.vx = 0;
    f.x = clamp(f.x, WORLD_LEFT, WORLD_RIGHT);
    return landed;
  }

  private updateCamera(): void {
    const [a, b] = this.fighters;
    const mid = (a.x + b.x) / 2;
    const target = clamp(mid - 480, 0, 1400 - 960);
    this.camX += (target - this.camX) * 0.14;
  }

  // ── 粒子与飘字 ─────────────────────────────────────────────

  private pushParticle(p: Particle): void {
    if (this.particles.length > 460) this.particles.shift();
    this.particles.push(p);
  }

  private spawnHitSparks(x: number, y: number, dir: number, color: string, heavy: boolean): void {
    const count = heavy ? 16 : 10;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.random() - 0.5) * Math.PI * 1.4 + (dir > 0 ? 0 : Math.PI);
      const speed = 2 + Math.random() * (heavy ? 7 : 5);
      this.pushParticle({
        kind: "spark",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 12 + Math.random() * 10,
        maxLife: 22,
        size: 1.6 + Math.random() * 2.4,
        angle,
        spin: 0,
        color: i % 3 === 0 ? "#ffffff" : color,
        gravity: 0.16,
      });
    }
    this.pushParticle({
      kind: "ring",
      x,
      y,
      vx: 0,
      vy: 0,
      life: heavy ? 18 : 13,
      maxLife: heavy ? 18 : 13,
      size: heavy ? 46 : 30,
      angle: 0,
      spin: 0,
      color,
      gravity: 0,
    });
    this.pushParticle({
      kind: "slash",
      x,
      y,
      vx: 0,
      vy: 0,
      life: 10,
      maxLife: 10,
      size: heavy ? 90 : 62,
      angle: (Math.random() - 0.5) * 0.8,
      spin: 0,
      color: "#ffffff",
      gravity: 0,
    });
  }

  private spawnBlockSparks(x: number, y: number, facing: number): void {
    for (let i = 0; i < 7; i += 1) {
      this.pushParticle({
        kind: "spark",
        x,
        y,
        vx: facing * (1 + Math.random() * 3) + (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 4,
        life: 10 + Math.random() * 8,
        maxLife: 18,
        size: 1.4 + Math.random() * 1.6,
        angle: 0,
        spin: 0,
        color: "#b9e4ff",
        gravity: 0.1,
      });
    }
  }

  private spawnRing(x: number, y: number, color: string, size: number): void {
    this.pushParticle({
      kind: "ring",
      x,
      y,
      vx: 0,
      vy: 0,
      life: 20,
      maxLife: 20,
      size,
      angle: 0,
      spin: 0,
      color,
      gravity: 0,
    });
  }

  private spawnChakraRing(x: number, y: number, color: string): void {
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      this.pushParticle({
        kind: "chakra",
        x: x + Math.cos(angle) * 10,
        y: y + Math.sin(angle) * 12,
        vx: Math.cos(angle) * 1.6,
        vy: Math.sin(angle) * 1.6 - 0.6,
        life: 20,
        maxLife: 20,
        size: 3 + Math.random() * 3,
        angle,
        spin: 0,
        color,
        gravity: -0.02,
      });
    }
  }

  private spawnDust(x: number, y: number, count: number, color: string): void {
    for (let i = 0; i < count; i += 1) {
      this.pushParticle({
        kind: "dust",
        x: x + (Math.random() - 0.5) * 26,
        y: y - Math.random() * 8,
        vx: (Math.random() - 0.5) * 3,
        vy: -0.4 - Math.random() * 1.6,
        life: 18 + Math.random() * 16,
        maxLife: 34,
        size: 3 + Math.random() * 7,
        angle: 0,
        spin: 0,
        color,
        gravity: 0.02,
      });
    }
  }

  spawnFloater(x: number, y: number, text: string, color: string, size: number): void {
    if (this.floaters.length > 26) this.floaters.shift();
    this.floaters.push({ x: x + (Math.random() - 0.5) * 18, y, vy: -1.5, life: 34, maxLife: 34, text, color, size });
  }

  private updateParticles(): void {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= 1;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.98;
      if (p.kind === "dust") {
        p.vx *= 0.96;
        p.vy *= 0.98;
      }
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  private updateFloaters(): void {
    for (let i = this.floaters.length - 1; i >= 0; i -= 1) {
      const f = this.floaters[i];
      f.life -= 1;
      f.y += f.vy;
      f.vy *= 0.92;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
  }

  private updateTrails(): void {
    for (const f of this.fighters) {
      const wantTrail = f.superGlow > 0 || (f.state === "attack" && f.move && f.move.lunge > 3) || f.state === "launch";
      for (let i = f.trail.length - 1; i >= 0; i -= 1) {
        f.trail[i].age += 1;
        if (f.trail[i].age > 12) f.trail.splice(i, 1);
      }
      if (!wantTrail) continue;
      if (this.frame % 2 !== 0) continue;
      const sample: TrailSample = {
        x: f.x,
        y: f.y,
        facing: f.facing,
        state: f.state,
        moveFrame: f.moveFrame,
        kind: f.move ? f.move.kind : null,
        age: 0,
      };
      f.trail.push(sample);
      if (f.trail.length > 7) f.trail.shift();
    }
  }

  private onSound(name: SoundName): void {
    this.opts.onSound(name);
  }

  // ── HUD ────────────────────────────────────────────────────

  private pushHud(): void {
    this.opts.onHud({
      p1: {
        id: this.fighters[0].def.id,
        name: this.fighters[0].def.name,
        hp: this.fighters[0].hp,
        hpMax: this.fighters[0].def.maxHp,
        chakra: this.fighters[0].chakra,
        guard: this.fighters[0].guard,
        combo: this.fighters[0].combo,
        state: this.fighters[0].state,
        flash: this.fighters[0].flash,
      },
      p2: {
        id: this.fighters[1].def.id,
        name: this.fighters[1].def.name,
        hp: this.fighters[1].hp,
        hpMax: this.fighters[1].def.maxHp,
        chakra: this.fighters[1].chakra,
        guard: this.fighters[1].guard,
        combo: this.fighters[1].combo,
        state: this.fighters[1].state,
        flash: this.fighters[1].flash,
      },
      time: this.timer / 60,
      round: this.round,
      wins: [this.wins[0], this.wins[1]],
      phase: this.phase,
      callout: this.callout,
      calloutTone: this.calloutTone,
      banner: this.banner,
      bannerTone: this.bannerTone,
      calloutTimer: this.calloutTimer,
    });
  }

  /** 供渲染层读取的临时值：命中停顿中的镜头抖动强度。 */
  get cameraShake(): number {
    return this.shake;
  }

  get stageDef(): StageDef {
    return this.stage;
  }

  get freezeActive(): boolean {
    return this.freezeTimer > 0;
  }

}
