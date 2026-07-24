import type { WeaponDefinition, WeaponId, WeaponInventory } from "./types";

export const WEAPONS: Record<WeaponId, WeaponDefinition> = {
  bazooka: { id: "bazooka", name: "松果火箭", icon: "➤", description: "受风力影响的直击火箭", damage: 48, radius: 58, terrainRadius: 50, speedMin: 175, speedMax: 420, fuse: 0, initialStock: -1 },
  grenade: { id: "grenade", name: "跳跳果雷", icon: "●", description: "弹跳后延时爆炸", damage: 56, radius: 66, terrainRadius: 58, speedMin: 150, speedMax: 365, fuse: 2.7, initialStock: 3 },
  cluster: { id: "cluster", name: "星裂果雷", icon: "✦", description: "空中裂成五枚小炸弹", damage: 26, radius: 42, terrainRadius: 34, speedMin: 155, speedMax: 355, fuse: 2.15, initialStock: 2 },
  airstrike: { id: "airstrike", name: "蒲公英空袭", icon: "▼", description: "指定横向区域进行五连轰炸", damage: 34, radius: 46, terrainRadius: 39, speedMin: 0, speedMax: 0, fuse: 0, initialStock: 1 },
};

export const WEAPON_ORDER: WeaponId[] = ["bazooka", "grenade", "cluster", "airstrike"];
export const PLAYER_NAMES = ["青团", "豆芽", "栗子"];
export const ENEMY_NAMES = ["红椒", "刺头", "煤球"];
export const TURN_SECONDS = 24;
export const MAX_TURNS = 20;
export const MOVE_FUEL = 105;

export function createInventory(): WeaponInventory {
  return { bazooka: -1, grenade: WEAPONS.grenade.initialStock, cluster: WEAPONS.cluster.initialStock, airstrike: WEAPONS.airstrike.initialStock };
}
