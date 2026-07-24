export type PlanetPortrait = {
  character: string;
  shortName: string;
  src: string;
};

export const VICTORY_CG_SRC = "/assets/planet-merge/cg/victory-saber.webp";

export const PLANET_PORTRAITS: readonly PlanetPortrait[] = [
  { character: "玛修·基列莱特", shortName: "玛修", src: "/assets/planet-merge/fate/mash.webp" },
  { character: "远坂凛", shortName: "凛", src: "/assets/planet-merge/fate/rin.webp" },
  { character: "间桐樱", shortName: "樱", src: "/assets/planet-merge/fate/sakura.webp" },
  { character: "伊莉雅丝菲尔", shortName: "伊莉雅", src: "/assets/planet-merge/fate/illya.webp" },
  { character: "阿斯托尔福", shortName: "阿福", src: "/assets/planet-merge/fate/astolfo.webp" },
  { character: "美杜莎", shortName: "美杜莎", src: "/assets/planet-merge/fate/medusa.webp" },
  { character: "库·丘林", shortName: "库丘林", src: "/assets/planet-merge/fate/cu.webp" },
  { character: "卫宫", shortName: "卫宫", src: "/assets/planet-merge/fate/archer.webp" },
  { character: "贞德", shortName: "贞德", src: "/assets/planet-merge/fate/jeanne.webp" },
  { character: "吉尔伽美什", shortName: "吉尔", src: "/assets/planet-merge/fate/gilgamesh.webp" },
  { character: "阿尔托莉雅", shortName: "Saber", src: "/assets/planet-merge/fate/artoria.webp" },
] as const;

export function preloadPlanetPortraits(onAssetReady: (tier: number) => void) {
  if (typeof Image === "undefined") return [];

  return PLANET_PORTRAITS.map(({ src }, tier) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => onAssetReady(tier);
    image.src = src;
    return image;
  });
}
