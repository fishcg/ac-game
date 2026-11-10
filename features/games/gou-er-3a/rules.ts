/**
 * 纯计分层：把游戏撤离结算里的「用时 / 命中率 / 摧毁机械 / 重试次数」
 * 换算成平台行动积分。这里不碰 DOM、不碰 iframe，可以被单独测试。
 */

export type MissionStats = {
  timeSeconds: number;
  accuracy: number | null;
  kills: number;
  retries: number;
};

export type ParsedDebrief = MissionStats;

/** 撤离成功的基础分：只要登船就至少拿得到。 */
export const COMPLETION_BASE = 1000;
/** 每摧毁一台机械的积分。 */
export const KILL_SCORE = 120;
/** 命中率拉满（100%）时的额外积分。 */
export const ACCURACY_SCORE = 1200;
/** 用时奖励的封顶秒数：超过这个时间不再倒扣奖励。 */
export const TIME_BONUS_CAP = 480;
/** 每快 1 秒的额外积分。 */
export const TIME_BONUS_PER_SECOND = 4;
/** 每重试一次的扣分。 */
export const RETRY_PENALTY = 150;
/** 无论打得多差，成功撤离也保底这个分数。 */
export const MIN_SCORE = 100;

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function toNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

/**
 * 解析游戏结算里的 mm:ss。游戏固定输出两位分钟、两位秒，
 * 这里也接受纯秒数，方便调试与容错。
 */
export function parseMissionTime(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const clock = /^(\d{1,3}):([0-5]\d)$/.exec(text);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const seconds = Number(text);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.floor(seconds);
}

/** 解析命中率，例如 "56%" → 0.56；"—" 表示本局没有开过枪。 */
export function parseAccuracy(raw: string): number | null {
  const text = raw.trim().replace(/%$/, "");
  if (!text || text === "—" || text === "-") return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return clamp(value / 100, 0, 1);
}

/** 解析摧毁数与重试次数；多余的单位或空白一律忽略。 */
export function parseCount(raw: string): number {
  const text = raw.replace(/[^\d]/g, "");
  if (!text) return 0;
  const value = Number(text);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/** 撤离成功后的行动积分。时间越短、命中越高、失误越少，分数越高。 */
export function computeScore(stats: MissionStats): number {
  const time = clamp(stats.timeSeconds, 0, 60 * 60);
  const accuracy = clamp(stats.accuracy ?? 0, 0, 1);
  const kills = toNonNegativeInteger(stats.kills);
  const retries = toNonNegativeInteger(stats.retries);
  const timeBonus = Math.round(Math.max(0, TIME_BONUS_CAP - time) * TIME_BONUS_PER_SECOND);
  const raw =
    COMPLETION_BASE +
    kills * KILL_SCORE +
    Math.round(accuracy * ACCURACY_SCORE) +
    timeBonus -
    retries * RETRY_PENALTY;
  return Math.max(MIN_SCORE, Math.round(raw));
}

/** 把游戏行动简报里的文本一次性解析成可计分的数字。 */
export function parseDebrief(fields: {
  time: string;
  accuracy: string;
  kills: string;
  retries: string;
}): ParsedDebrief | null {
  const timeSeconds = parseMissionTime(fields.time);
  if (timeSeconds === null) return null;
  return {
    timeSeconds,
    accuracy: parseAccuracy(fields.accuracy),
    kills: parseCount(fields.kills),
    retries: parseCount(fields.retries),
  };
}

/** 紧凑显示：3544 → "3,544"。 */
export function formatScore(score: number): string {
  return Math.max(0, Math.round(score)).toLocaleString("zh-CN");
}
