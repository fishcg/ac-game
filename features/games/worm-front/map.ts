export type MapThemeId = "meadow" | "village" | "ruins" | "highland";
export type StructureKind = "cottage" | "tower" | "windmill" | "ruin" | "bunker";

export type MapPalette = {
  skyTop: string;
  skyMiddle: string;
  skyBottom: string;
  mountainFar: string;
  mountainNear: string;
  ridge: string;
  grassDark: string;
  grassLight: string;
  dirt: [number, number, number];
};

export type MapTheme = {
  id: MapThemeId;
  name: string;
  baseHeight: number;
  palette: MapPalette;
  structures: StructureKind[];
};

export type MapStructure = {
  id: number;
  kind: StructureKind;
  x: number;
  groundY: number;
  width: number;
  height: number;
  variant: number;
};

export type MapCave = { x: number; y: number; radiusX: number; radiusY: number; angle: number };
export type MapDecoration = { x: number; kind: "flower" | "grass" | "sign" | "rock"; color: string; scale: number };

export type WormMapLayout = {
  seed: number;
  theme: MapTheme;
  surface: number[];
  structures: MapStructure[];
  caves: MapCave[];
  decorations: MapDecoration[];
};

const WIDTH = 960;
const SPAWN_X = [118, 302, 452, 548, 680, 842];

export const MAP_THEMES: MapTheme[] = [
  {
    id: "meadow", name: "苔风牧场", baseHeight: 322, structures: ["cottage", "windmill", "bunker"],
    palette: { skyTop: "#5c94c5", skyMiddle: "#b8d9d0", skyBottom: "#e7ca91", mountainFar: "#78998e", mountainNear: "#527268", ridge: "#466b57", grassDark: "#6f994c", grassLight: "#b8cf68", dirt: [116, 76, 49] },
  },
  {
    id: "village", name: "橡木村落", baseHeight: 330, structures: ["cottage", "cottage", "tower", "windmill"],
    palette: { skyTop: "#6499bb", skyMiddle: "#c6d6bd", skyBottom: "#efd0a1", mountainFar: "#879882", mountainNear: "#64765e", ridge: "#52664d", grassDark: "#7e964c", grassLight: "#c3ce6c", dirt: [124, 79, 50] },
  },
  {
    id: "ruins", name: "灰岩旧堡", baseHeight: 316, structures: ["ruin", "tower", "bunker", "ruin"],
    palette: { skyTop: "#687e9a", skyMiddle: "#aeb8b2", skyBottom: "#d3b995", mountainFar: "#777f7a", mountainNear: "#555f5d", ridge: "#46524d", grassDark: "#768052", grassLight: "#abb06b", dirt: [105, 72, 57] },
  },
  {
    id: "highland", name: "风车高地", baseHeight: 305, structures: ["windmill", "tower", "cottage", "bunker"],
    palette: { skyTop: "#4d8cb9", skyMiddle: "#a7d0cf", skyBottom: "#e5cf9d", mountainFar: "#698e8d", mountainNear: "#456b68", ridge: "#3e625b", grassDark: "#63935c", grassLight: "#a8d074", dirt: [109, 72, 47] },
  },
];

export function seededRandom(seed: number) {
  return () => {
    let value = seed += 0x6d2b79f5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function smoothStep(value: number) {
  return value * value * (3 - 2 * value);
}

function flattenSpawn(surface: number[], center: number) {
  const target = surface[center];
  for (let offset = -25; offset <= 25; offset += 1) {
    const x = center + offset;
    if (x < 0 || x >= surface.length) continue;
    const blend = Math.max(0, 1 - Math.abs(offset) / 26);
    surface[x] = Math.round(surface[x] * (1 - blend) + target * blend);
  }
}

function dimensions(kind: StructureKind, random: () => number) {
  switch (kind) {
    case "cottage": return { width: 52 + Math.round(random() * 12), height: 48 + Math.round(random() * 9) };
    case "tower": return { width: 38 + Math.round(random() * 8), height: 68 + Math.round(random() * 15) };
    case "windmill": return { width: 40 + Math.round(random() * 7), height: 76 + Math.round(random() * 13) };
    case "ruin": return { width: 58 + Math.round(random() * 13), height: 46 + Math.round(random() * 16) };
    case "bunker": return { width: 58 + Math.round(random() * 13), height: 31 + Math.round(random() * 8) };
  }
}

export function createWormMap(seed: number): WormMapLayout {
  const random = seededRandom(seed ^ 0x91c7);
  const theme = MAP_THEMES[Math.abs(seed) % MAP_THEMES.length];
  const anchorGap = 80;
  const anchors: number[] = [];
  let drift = (random() - 0.5) * 26;
  for (let index = 0; index <= WIDTH / anchorGap + 1; index += 1) {
    drift = clamp(drift + (random() - 0.5) * 34, -42, 42);
    anchors.push(theme.baseHeight + drift + (random() - 0.5) * 42);
  }

  const features = Array.from({ length: 3 }, () => ({
    x: 120 + random() * 720,
    width: 65 + random() * 105,
    height: (random() > 0.5 ? 1 : -1) * (18 + random() * 36),
  }));
  const surface = new Array<number>(WIDTH);
  for (let x = 0; x < WIDTH; x += 1) {
    const anchor = Math.floor(x / anchorGap);
    const local = smoothStep((x % anchorGap) / anchorGap);
    let y = anchors[anchor] * (1 - local) + anchors[anchor + 1] * local;
    y += Math.sin(x * 0.024 + seed * 0.001) * 8;
    for (const feature of features) {
      const distance = (x - feature.x) / feature.width;
      y += feature.height * Math.exp(-distance * distance * 2.2);
    }
    y += Math.max(0, 48 - x) * 0.45 + Math.max(0, x - 912) * 0.45;
    surface[x] = clamp(Math.round(y), 238, 398);
  }
  for (let pass = 0; pass < 2; pass += 1) {
    const copy = surface.slice();
    for (let x = 2; x < WIDTH - 2; x += 1) surface[x] = Math.round((copy[x - 2] + copy[x - 1] * 2 + copy[x] * 3 + copy[x + 1] * 2 + copy[x + 2]) / 9);
  }
  SPAWN_X.forEach((x) => flattenSpawn(surface, x));

  const candidates = [205, 380, 615, 760].map((x) => x + Math.round((random() - 0.5) * 28));
  candidates.sort(() => random() - 0.5);
  const structureCount = 2 + Math.floor(random() * 3);
  const structures = candidates.slice(0, structureCount).map((x, index): MapStructure => {
    const kind = theme.structures[Math.floor(random() * theme.structures.length)];
    const size = dimensions(kind, random);
    return { id: index + 1, kind, x, groundY: surface[Math.round(x)] + 2, width: size.width, height: size.height, variant: Math.floor(random() * 4) };
  });

  const caves: MapCave[] = Array.from({ length: 2 + Math.floor(random() * 2) }, () => {
    const x = 90 + random() * 780;
    const radiusX = 31 + random() * 31;
    const radiusY = 18 + random() * 18;
    return { x, y: clamp(surface[Math.round(x)] + 68 + random() * 98, 340, 500), radiusX, radiusY, angle: (random() - 0.5) * 0.3 };
  });

  const colors = ["#e6c45b", "#eb765b", "#9fd079", "#d99de2"];
  const decorations: MapDecoration[] = Array.from({ length: 18 }, (_, index) => {
    const x = 30 + random() * 900;
    const roll = random();
    return { x, kind: roll < 0.5 ? "grass" : roll < 0.75 ? "flower" : roll < 0.9 ? "rock" : "sign", color: colors[index % colors.length], scale: 0.65 + random() * 0.65 };
  });

  return { seed, theme, surface, structures, caves, decorations };
}
