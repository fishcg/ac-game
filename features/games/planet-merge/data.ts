export const PLANET_WIDTH = 960;
export const PLANET_HEIGHT = 540;
export const BIN_LEFT = 240;
export const BIN_RIGHT = 720;
export const BIN_FLOOR = 505;
export const WARNING_Y = 170;
export const MAX_PLANETS = 58;

export type PlanetLayout = {
  width: number;
  height: number;
  binLeft: number;
  binRight: number;
  binTop: number;
  binFloor: number;
  warningY: number;
  dropY: number;
  portrait: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * 保持物理世界等比缩放，同时让竖屏设备获得真正的纵向星仓。
 * 不能只拉伸 canvas，否则球会变成椭圆，触摸坐标也会失真。
 */
export function createPlanetLayout(viewWidth: number, viewHeight: number): PlanetLayout {
  const aspect = Math.max(0.35, viewWidth / Math.max(1, viewHeight));
  const portrait = aspect < 0.9;
  const width = portrait ? 540 : PLANET_WIDTH;
  const height = Math.round(clamp(width / aspect, portrait ? 760 : PLANET_HEIGHT, portrait ? 1120 : 680));
  const binLeft = portrait ? 32 : BIN_LEFT;
  const binRight = portrait ? width - 32 : BIN_RIGHT;
  const binTop = portrait ? 205 : 112;
  const binFloor = height - (portrait ? 150 : 35);

  return {
    width,
    height,
    binLeft,
    binRight,
    binTop,
    binFloor,
    warningY: portrait ? Math.min(binTop + 138, binFloor - 360) : WARNING_Y,
    dropY: portrait ? 170 : 78,
    portrait,
  };
}

export const PLANET_TIERS = [
  { name: "星尘泡泡", radius: 14, color: "#7be8ff", shade: "#3878d8", score: 12 },
  { name: "薄荷卫星", radius: 18, color: "#7df0ba", shade: "#2d9b83", score: 28 },
  { name: "莓果月球", radius: 23, color: "#ff8eb4", shade: "#c64e83", score: 60 },
  { name: "蜜糖行星", radius: 29, color: "#ffd469", shade: "#d88738", score: 125 },
  { name: "珊瑚火星", radius: 36, color: "#ff806c", shade: "#b94657", score: 260 },
  { name: "翡翠环星", radius: 44, color: "#5be0a5", shade: "#217d76", score: 520 },
  { name: "蔚蓝巨星", radius: 53, color: "#60b8ff", shade: "#3c58bd", score: 980 },
  { name: "紫晶天王", radius: 64, color: "#a98aff", shade: "#633fa7", score: 1750 },
  { name: "黄金星核", radius: 76, color: "#ffe36e", shade: "#db7738", score: 3000 },
  { name: "虹彩恒星", radius: 89, color: "#ff9fe5", shade: "#735ce6", score: 5200 },
  { name: "大 Saber", radius: 104, color: "#fff1a3", shade: "#ff6b8a", score: 10000 },
] as const;

export const MISSIONS = [
  "合成一颗莓果月球",
  "制造第一颗珊瑚火星",
  "把星海推进到蔚蓝巨星",
  "合成黄金星核",
  "合成最大的 Saber",
] as const;
