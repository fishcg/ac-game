export const DEFENSE_ASSETS = {
  battlefield: "/assets/three-kingdoms-defense/battlefield.webp",
  guanYu: "/assets/three-kingdoms-defense/guan-yu.webp",
  zhangLiang: "/assets/three-kingdoms-defense/zhang-liang.webp",
  archer: "/assets/three-kingdoms-defense/archer-tower.webp",
  spear: "/assets/three-kingdoms-defense/spear-barracks.webp",
  catapult: "/assets/three-kingdoms-defense/catapult.webp",
  infantry: "/assets/three-kingdoms-defense/infantry.webp",
  shield: "/assets/three-kingdoms-defense/shield.webp",
  cavalry: "/assets/three-kingdoms-defense/cavalry.webp",
  siege: "/assets/three-kingdoms-defense/siege.webp",
  fireEffect: "/assets/three-kingdoms-defense/fire-effect.webp",
  heroEffect: "/assets/three-kingdoms-defense/hero-effect.webp",
  sandEffect: "/assets/three-kingdoms-defense/sand-effect.webp",
} as const;

export type DefenseAssetId = keyof typeof DEFENSE_ASSETS;
