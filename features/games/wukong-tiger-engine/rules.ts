/**
 * 纯计分层：把虎先锋战斗的胜负、用时与双方剩余血量换算成平台积分。
 * 这里不碰 DOM、不碰 iframe，可以被单独测试。
 */

export type BattleOutcome = "victory" | "defeat";

export type BattleStats = {
  outcome: BattleOutcome;
  seconds: number;
  playerHp: number;
  playerMaxHp: number;
  bossHp: number;
  bossMaxHp: number;
};

export type BattleResult = BattleStats & {
  score: number;
};

/** 击破虎先锋的基础分。 */
export const VICTORY_BASE = 2000;
/** 时间奖励的参考时长：超过 10 分钟不再获得速度奖励。 */
export const TIME_LIMIT = 600;
/** 每提前 1 秒的积分。 */
export const TIME_BONUS_PER_SECOND = 2;
/** 胜利时按剩余血量比例获得的积分上限。 */
export const HEALTH_BONUS = 800;
/** 失败时按对虎先锋造成的伤害比例获得的积分上限。 */
export const DEFEAT_DAMAGE_SCORE = 1000;

export type BattleSnapshot = {
  state: string;
  simTime: number;
  player?: { hp: number; maxHp: number } | null;
  boss?: { hp: number; maxHp: number } | null;
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return value < min ? min : value > max ? max : value;
}

function safeHp(hp: number, maxHp: number): { hp: number; maxHp: number } {
  const max = Math.max(1, Math.round(Number.isFinite(maxHp) ? maxHp : 1));
  return { hp: clamp(hp, 0, max), maxHp: max };
}

/** 胜利：基础分 + 速度奖励 + 剩余血量奖励；失败：按对 Boss 造成的伤害计分。 */
export function computeScore(stats: BattleStats): number {
  if (stats.outcome === "victory") {
    const seconds = clamp(stats.seconds, 0, TIME_LIMIT);
    const player = safeHp(stats.playerHp, stats.playerMaxHp);
    const timeBonus = Math.round((TIME_LIMIT - seconds) * TIME_BONUS_PER_SECOND);
    const healthBonus = Math.round((player.hp / player.maxHp) * HEALTH_BONUS);
    return Math.max(0, Math.round(VICTORY_BASE + timeBonus + healthBonus));
  }

  const boss = safeHp(stats.bossHp, stats.bossMaxHp);
  const damageDealt = 1 - boss.hp / boss.maxHp;
  return Math.max(0, Math.round(damageDealt * DEFEAT_DAMAGE_SCORE));
}

/** 只接受游戏调试接口给出的 victory / defeat 状态。 */
export function readResult(state: BattleSnapshot | null | undefined): BattleResult | null {
  if (!state || (state.state !== "victory" && state.state !== "defeat")) return null;
  if (!state.player || !state.boss) return null;
  const player = safeHp(state.player.hp, state.player.maxHp);
  const boss = safeHp(state.boss.hp, state.boss.maxHp);
  const stats: BattleStats = {
    outcome: state.state,
    seconds: clamp(state.simTime, 0, 24 * 60 * 60),
    playerHp: player.hp,
    playerMaxHp: player.maxHp,
    bossHp: boss.hp,
    bossMaxHp: boss.maxHp,
  };
  return { ...stats, score: computeScore(stats) };
}

/** 紧凑显示：3200 → "3,200"。 */
export function formatScore(score: number): string {
  return Math.max(0, Math.round(score)).toLocaleString("zh-CN");
}

/** 战斗用时：95 → "01:35"。 */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
