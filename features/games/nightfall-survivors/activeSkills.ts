import type { ActiveSkillId } from "./types";

export const ACTIVE_SKILLS: Record<ActiveSkillId, { name: string; icon: string; description: string }> = {
  starfall: { name: "星陨轰击", icon: "☄", description: "轰炸附近最多40名敌人，造成45%生命伤害" },
  time_stop: { name: "永夜时停", icon: "⌛", description: "冻结全部敌人，Boss持续时间减半" },
  sanctuary: { name: "圣泉赐福", icon: "✚", description: "恢复50%生命并获得一次伤害护盾" },
  magnet: { name: "灵魂磁暴", icon: "◉", description: "立即吸收场上全部经验宝石" },
  judgement: { name: "终焉裁决", icon: "✦", description: "重创全场敌人，对Boss造成额外伤害" },
  holy_bomb: { name: "圣光炸弹", icon: "✺", description: "对周围敌人造成35%生命伤害并强力击退" },
};

export const ACTIVE_SKILL_IDS = Object.keys(ACTIVE_SKILLS) as ActiveSkillId[];
