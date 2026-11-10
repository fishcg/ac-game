import { createInput } from "./types";
import type { ActionName, Fighter, FighterId } from "./types";

type Level = 1 | 2 | 3;

const ACTIONS: ActionName[] = [
  "left",
  "right",
  "up",
  "down",
  "guard",
  "light",
  "heavy",
  "special",
  "super",
];

type Tuning = {
  decide: [number, number];
  aggression: number;
  block: number;
  special: number;
  superUse: number;
  jumpIn: number;
  retreat: number;
  combo: number;
};

const TUNING: Record<Level, Tuning> = {
  1: { decide: [16, 30], aggression: 0.46, block: 0.38, special: 0.22, superUse: 0.2, jumpIn: 0.07, retreat: 0.2, combo: 0.2 },
  2: { decide: [10, 20], aggression: 0.63, block: 0.6, special: 0.44, superUse: 0.36, jumpIn: 0.12, retreat: 0.13, combo: 0.45 },
  3: { decide: [6, 13], aggression: 0.82, block: 0.8, special: 0.62, superUse: 0.52, jumpIn: 0.16, retreat: 0.09, combo: 0.7 },
};

const REACH: Record<FighterId, number> = { kage: 96, rai: 92, jumon: 104 };

/**
 * 人机对手：用「计划 + 冷却」模拟真人节奏。
 * 它读的是与玩家完全相同的 InputState，因此所有判定、伤害、资源消耗都走同一套引擎，
 * 不存在额外加成的隐藏 AI 属性。
 */
export class DuelAi {
  readonly input = createInput();
  private level: Level;
  private decideTimer = 0;
  private guardHold = 0;
  private guardPlan = 0;
  private holdDir: -1 | 0 | 1 = 0;
  private attackCd = 0;
  private followTimer = 0;
  private followAction: ActionName | null = null;
  private wantJump = false;

  constructor(level: Level) {
    // 存档里可能残留非法难度，统一回落到普通。
    this.level = level === 1 || level === 3 ? level : 2;
  }

  reset(): void {
    this.decideTimer = 0;
    this.guardHold = 0;
    this.guardPlan = 0;
    this.holdDir = 0;
    this.attackCd = 0;
    this.followTimer = 0;
    this.followAction = null;
    this.wantJump = false;
    for (const key of ACTIONS) this.input.held[key] = false;
    this.input.queue.length = 0;
  }

  private press(action: ActionName): void {
    this.input.queue.push(action);
  }

  update(me: Fighter, foe: Fighter): void {
    const input = this.input;
    for (const key of ACTIONS) input.held[key] = false;

    if (me.state === "ko" || me.state === "victory") return;

    if (this.attackCd > 0) this.attackCd -= 1;
    if (this.guardHold > 0) this.guardHold -= 1;
    if (this.decideTimer > 0) this.decideTimer -= 1;
    if (this.followTimer > 0) {
      this.followTimer -= 1;
      if (this.followTimer === 0 && this.followAction) {
        this.press(this.followAction);
        this.followAction = null;
        this.attackCd = 6;
      }
    }

    const t = TUNING[this.level] ?? TUNING[2];
    const toFoe = foe.x >= me.x ? 1 : -1;
    const dist = Math.abs(foe.x - me.x);
    const reach = REACH[me.def.id];
    const canAct =
      me.state !== "attack" &&
      me.state !== "hit" &&
      me.state !== "launch" &&
      me.state !== "down" &&
      me.state !== "getup" &&
      me.hitstun <= 0;

    if (!canAct) return;

    const foeWindingUp =
      foe.state === "attack" &&
      foe.move !== null &&
      foe.moveFrame <= (foe.move.hits[0]?.to ?? 0) + 2 &&
      foe.moveFrame >= Math.max(0, (foe.move.hits[0]?.from ?? 0) - 6);

    // 先决定是否抬手防御：这是让 AI 看起来「看得懂招式」的关键。
    if (this.guardHold <= 0 && me.state !== "air" && foeWindingUp && dist < 190) {
      const pressure = me.hp < me.def.maxHp * 0.35 ? 0.2 : 0;
      if (Math.random() < t.block + pressure) {
        this.guardHold = 9 + Math.floor(Math.random() * 12);
        this.guardPlan = this.guardHold;
      }
    }

    if (this.guardHold > 0) {
      input.held.guard = true;
      return;
    }

    if (me.state === "air") {
      // 空中只做两件事：继续压过去，或者在对手头顶出招落下。
      if (dist > reach * 0.8 && me.vy < 6 && Math.random() < 0.5) {
        input.held[toFoe > 0 ? "right" : "left"] = true;
      }
      if (dist < reach + 26 && me.vy > -4 && this.attackCd <= 0 && Math.random() < 0.28) {
        this.press("light");
        this.attackCd = 18;
      }
      return;
    }

    // 奥义：有资源且在中距离，直接开，观赏性也够。
    if (me.chakra >= 100 && dist < 300 && this.attackCd <= 0 && Math.random() < t.superUse) {
      this.press("super");
      this.attackCd = 46;
      return;
    }

    if (me.chakra >= 30 && this.attackCd <= 0 && dist > reach * 1.1 && dist < 360 && Math.random() < t.special) {
      this.press("special");
      this.attackCd = 28;
      return;
    }

    if (this.decideTimer > 0) {
      if (this.holdDir !== 0) input.held[this.holdDir > 0 ? "right" : "left"] = true;
      if (this.wantJump) {
        this.press("up");
        this.wantJump = false;
      }
      return;
    }

    this.decideTimer = t.decide[0] + Math.floor(Math.random() * (t.decide[1] - t.decide[0] + 1));
    this.holdDir = 0;

    if (dist < reach + 8) {
      // 近身：出招，并按难度接后续
      if (this.attackCd <= 0) {
        const r = Math.random();
        if (r < 0.52) {
          this.press("light");
          this.attackCd = 6;
          if (Math.random() < t.combo) {
            this.followAction = Math.random() < 0.6 ? "heavy" : "special";
            this.followTimer = 5;
          }
        } else if (r < 0.84) {
          this.press("heavy");
          this.attackCd = 12;
        } else if (me.chakra >= 30) {
          this.press("special");
          this.attackCd = 18;
        } else {
          this.press("light");
          this.attackCd = 8;
        }
      } else if (Math.random() < t.retreat) {
        this.holdDir = toFoe > 0 ? -1 : 1;
      }
      return;
    }

    if (dist > reach * 3.4) {
      // 远距离：压上去，偶尔用跳跃缩短距离
      if (Math.random() < t.jumpIn) {
        this.holdDir = toFoe;
        this.wantJump = true;
        this.press("up");
      } else {
        this.holdDir = toFoe;
      }
      return;
    }

    // 中距离：试探、后撤、或者直接突进
    const r = Math.random();
    if (r < t.aggression) {
      this.holdDir = toFoe;
      if (Math.random() < 0.22) {
        this.wantJump = true;
        this.press("up");
      }
    } else if (r < t.aggression + t.retreat) {
      this.holdDir = toFoe > 0 ? -1 : 1;
    } else {
      this.holdDir = 0;
    }
  }

  get guarding(): boolean {
    return this.guardPlan > 0 && this.guardHold > 0;
  }
}
