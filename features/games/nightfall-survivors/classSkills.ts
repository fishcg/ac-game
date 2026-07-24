import type { NightfallSprite } from "./assets";
import type { WeaponId } from "./types";

export type SignatureSkillId =
  | "shield" | "consecrate" | "lance"
  | "volley" | "windshot" | "trap" | "falcon" | "ricochet"
  | "bones" | "skeletons" | "curse"
  | "yin" | "yang"
  | "elvenArrow" | "moonArrow" | "vineArrow" | "spiritHawk" | "leafStorm" | "starTrap" | "ancientBow";

export type SignatureSkillPattern = "nova" | "burst" | "strike" | "fan" | "homing" | "rain" | "trap";

export type SignatureSkillDefinition = {
  pattern: SignatureSkillPattern;
  visual: NightfallSprite;
  color: string;
  radius: number;
  count: number;
  speed?: number;
  pierce?: number;
  ttl?: number;
  damageScale?: number;
  slow?: number;
  freeze?: number;
  knockback?: number;
  heal?: number;
};

export const SIGNATURE_SKILLS: Record<SignatureSkillId, SignatureSkillDefinition> = {
  shield: { pattern: "nova", visual: "paladinAegis", color: "#83c8ff", radius: 78, count: 1, damageScale: .85, knockback: 56 },
  consecrate: { pattern: "trap", visual: "paladinSanctuary", color: "#ffd23f", radius: 72, count: 1, damageScale: .75, slow: 1.2, heal: 2 },
  lance: { pattern: "strike", visual: "paladinLance", color: "#ffbd32", radius: 28, count: 2, damageScale: 1.05, pierce: 2 },

  volley: { pattern: "fan", visual: "rangerVolley", color: "#ffd27b", radius: 8, count: 3, speed: 430, pierce: 0, ttl: 1.45, damageScale: .72 },
  windshot: { pattern: "fan", visual: "rangerWindArrow", color: "#7ff1dc", radius: 9, count: 1, speed: 590, pierce: 4, ttl: 1.8, damageScale: 1.15, knockback: 24 },
  trap: { pattern: "trap", visual: "rangerTrap", color: "#e9a75e", radius: 64, count: 2, damageScale: .8, slow: 2.2 },
  falcon: { pattern: "homing", visual: "rangerFalcon", color: "#ffb95f", radius: 10, count: 1, speed: 370, pierce: 1, ttl: 3.1, damageScale: 1.1 },
  ricochet: { pattern: "strike", visual: "rangerRicochet", color: "#ffef80", radius: 24, count: 4, damageScale: .68, pierce: 5 },

  bones: { pattern: "fan", visual: "vfxBones", color: "#d9b98c", radius: 10, count: 3, speed: 360, pierce: 2, ttl: 2.2, damageScale: .78 },
  skeletons: { pattern: "homing", visual: "vfxSkeletons", color: "#a879ff", radius: 13, count: 2, speed: 255, pierce: 3, ttl: 4.2, damageScale: .62 },
  curse: { pattern: "burst", visual: "vfxCurse", color: "#bd71ff", radius: 68, count: 2, damageScale: .82, slow: 2.4 },

  yin: { pattern: "nova", visual: "mageYinWheel", color: "#9787ff", radius: 92, count: 1, damageScale: .72, freeze: .7 },
  yang: { pattern: "rain", visual: "mageYangSeal", color: "#ffd12f", radius: 52, count: 3, damageScale: .74, knockback: 18 },

  elvenArrow: { pattern: "fan", visual: "elfLongArrow", color: "#b6ff83", radius: 8, count: 1, speed: 660, pierce: 3, ttl: 1.65, damageScale: 1.2 },
  moonArrow: { pattern: "rain", visual: "elfMoonArrow", color: "#7894ff", radius: 46, count: 4, damageScale: .64 },
  vineArrow: { pattern: "strike", visual: "elfVineArrow", color: "#74d66d", radius: 30, count: 3, damageScale: .8, slow: 2.8 },
  spiritHawk: { pattern: "homing", visual: "elfSpiritHawk", color: "#8ff4bc", radius: 11, count: 1, speed: 410, pierce: 2, ttl: 3.4, damageScale: 1.05 },
  leafStorm: { pattern: "nova", visual: "elfLeafStorm", color: "#78dc72", radius: 108, count: 1, damageScale: .65, knockback: 36 },
  starTrap: { pattern: "trap", visual: "elfStarTrap", color: "#d1b6ff", radius: 72, count: 2, damageScale: .72, freeze: 1.1 },
  ancientBow: { pattern: "fan", visual: "elfAncientBow", color: "#e2ff8a", radius: 10, count: 5, speed: 520, pierce: 1, ttl: 1.8, damageScale: .52 },
};

export const isSignatureSkill = (id: WeaponId): id is SignatureSkillId => id in SIGNATURE_SKILLS;
