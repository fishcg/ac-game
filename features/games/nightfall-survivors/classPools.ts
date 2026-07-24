import type { CharacterId, WeaponId } from "./types";

export const CHARACTER_WEAPON_POOLS: Record<CharacterId, WeaponId[]> = {
  paladin: ["whip", "holy", "axes", "frost", "shield", "consecrate", "lance"],
  ranger: ["boomerang", "chain", "volley", "windshot", "trap", "falcon", "ricochet"],
  necromancer: ["bats", "skeletonGuard", "boneMage", "wraithSummon", "graveGolem", "boneArchers", "deathKnight"],
  mage: ["metal", "wood", "water", "fire", "earth", "yin", "yang"],
  elf: ["elvenArrow", "moonArrow", "vineArrow", "spiritHawk", "leafStorm", "starTrap", "ancientBow"],
};

export const CHARACTER_COMBAT_STYLES: Record<CharacterId, string> = {
  paladin: "近战 · 圣光 · 防御",
  ranger: "远程 · 连射 · 自然",
  necromancer: "亡灵召唤 · 骸骨军团 · 巨龙",
  mage: "金 · 木 · 水 · 火 · 土",
  elf: "长弓 · 自然 · 月光",
};

export const CHARACTER_PROFILES: Record<CharacterId, { role: string; difficulty: string; introduction: string; strength: string }> = {
  paladin: {
    role: "近战守护者", difficulty: "简单",
    introduction: "贴近敌阵挥动圣焰武器，以高生命、护盾和持续恢复正面承受压力，适合第一次踏入永夜的玩家。",
    strength: "生存稳定 · 近身击退 · 少量圣光治疗",
  },
  ranger: {
    role: "高速游击手", difficulty: "中等",
    introduction: "保持移动距离，用回旋镖、连锁箭和陷阱清理敌群；站位越灵活，越容易让箭雨贯穿更多目标。",
    strength: "远程穿透 · 连射弹射 · 陷阱控场",
  },
  necromancer: {
    role: "亡灵统帅", difficulty: "简单",
    introduction: "召唤蝙蝠、骷髅卫兵与亡灵军团代替自己作战，召唤物拥有独立生命，适合稳步扩张阵线。",
    strength: "自动召唤 · 阵线推进 · 骷髅巨龙",
  },
  mage: {
    role: "五行术师", difficulty: "困难",
    introduction: "以金木水火土相生触发强力连招，需要留意元素顺序与触发窗口；操作要求最高，爆发伤害也最高。",
    strength: "元素相生 · 聚怪连招 · 极限爆发",
  },
  elf: {
    role: "月影猎手", difficulty: "中等",
    introduction: "依靠长弓、月光箭与自然束缚远距离猎杀关键目标，兼具精准输出和持续控制能力。",
    strength: "精准长弓 · 自然束缚 · 月光追猎",
  },
};
