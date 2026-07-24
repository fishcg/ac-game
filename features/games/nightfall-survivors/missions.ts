import type { ActiveSkillId, MissionId } from "./types";

export const MISSIONS: Record<MissionId, { name: string; description: string; target: number; rewardXp: number; activeSkill: ActiveSkillId; rewardHeal?: number }> = {
  first_hunt: { name: "清剿夜潮", description: "本关击杀 240 名敌人", target: 240, rewardXp: 30, activeSkill: "starfall" },
  arsenal: { name: "临阵磨枪", description: "本关完成 4 次升级", target: 4, rewardXp: 35, activeSkill: "time_stop" },
  survivor: { name: "熬过夜色", description: "本关坚持战斗 180 秒", target: 180, rewardXp: 50, rewardHeal: 25, activeSkill: "sanctuary" },
  veteran: { name: "愈战愈强", description: "本关提升 5 级", target: 5, rewardXp: 65, activeSkill: "magnet" },
  boss_hunter: { name: "斩首行动", description: "本关击败 2 名小 Boss", target: 2, rewardXp: 100, rewardHeal: 35, activeSkill: "judgement" },
  horde_breaker: { name: "夜潮克星", description: "本关完整击退 2 次怪物潮", target: 2, rewardXp: 80, activeSkill: "holy_bomb" },
};

export const MISSION_IDS = Object.keys(MISSIONS) as MissionId[];
