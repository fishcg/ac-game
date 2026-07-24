import type { NightfallSprite } from "./assets";
import type { CharacterId } from "./types";

export type ClassUltimateDefinition = {
  name: string;
  icon: string;
  description: string;
  readyText: string;
  visual: NightfallSprite;
  color: string;
  duration: number;
};

export const ULTIMATE_CHARGE_SECONDS = 5;

export const CLASS_ULTIMATES: Record<CharacterId, ClassUltimateDefinition> = {
  paladin: {
    name: "天穹圣裁",
    icon: "⚔",
    description: "圣剑裁决近身敌人，恢复生命并获得 5 秒无敌。",
    readyText: "圣裁已就绪",
    visual: "ultimatePaladin",
    color: "#ffe078",
    duration: 1.5,
  },
  ranger: {
    name: "万箭天幕",
    icon: "➶",
    description: "向四周释放 32 支高速穿透箭，击退沿途敌人。",
    readyText: "箭阵已就绪",
    visual: "ultimateRanger",
    color: "#69e8ff",
    duration: 2.6,
  },
  necromancer: {
    name: "死亡军团",
    icon: "♟",
    description: "召唤 6 名全新骷髅战士组成死亡军团，最多战斗 10 秒。",
    readyText: "军团已集结",
    visual: "summonLegion",
    color: "#c790ff",
    duration: 10,
  },
  mage: {
    name: "五行归一",
    icon: "☯",
    description: "金木水火土同时共鸣，聚怪、冻结、破甲并引爆最高伤害。",
    readyText: "五行已归一",
    visual: "ultimateMage",
    color: "#fff1a3",
    duration: 2.2,
  },
  elf: {
    name: "世界树月蚀",
    icon: "☾",
    description: "树根束缚全场，月光箭精准追猎最多 20 个目标。",
    readyText: "月蚀已就绪",
    visual: "ultimateElf",
    color: "#9cff8b",
    duration: 2.8,
  },
};
