import type { NightfallSprite } from "./assets";
import type { ElementComboKey } from "./types";

export type ElementComboVfxPattern = "inferno" | "magma" | "blades" | "iceRain" | "vortex";

export const ELEMENT_COMBOS: Record<ElementComboKey, {
  name: string;
  multiplier: number;
  primary: string;
  secondary: string;
  visual: NightfallSprite;
  visual2: NightfallSprite;
  pattern: ElementComboVfxPattern;
}> = {
  "wood-fire": { name: "木生火 · 森罗天火", multiplier: 2.4, primary: "#55f06f", secondary: "#ff542f", visual: "elementComboForestInferno", visual2: "elementFireMeteor", pattern: "inferno" },
  "fire-earth": { name: "火生土 · 熔岩山崩", multiplier: 2.05, primary: "#ff5a32", secondary: "#ffc14f", visual: "elementComboMagmaEruption", visual2: "elementEarthSpikes", pattern: "magma" },
  "earth-metal": { name: "土生金 · 万刃归宗", multiplier: 1.9, primary: "#e58a2f", secondary: "#8fe7ff", visual: "elementComboBladeArray", visual2: "elementMetalBlade", pattern: "blades" },
  "metal-water": { name: "金生水 · 寒刃暴雨", multiplier: 1.75, primary: "#9cecff", secondary: "#1dbdff", visual: "elementComboFrozenBladeRain", visual2: "elementWaterCrest", pattern: "iceRain" },
  "water-wood": { name: "水生木 · 沧海森罗", multiplier: 1.65, primary: "#45cfff", secondary: "#64ee72", visual: "elementComboTidalVines", visual2: "elementWoodRoots", pattern: "vortex" },
};

export function isElementComboKey(value: string): value is ElementComboKey { return value in ELEMENT_COMBOS; }
