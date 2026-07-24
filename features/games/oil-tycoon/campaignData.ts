import type { OilPlot } from "./types";

export type CampaignStatus = "intro" | "character" | "auction" | "running" | "paused" | "ranking";
export type CharacterId = "blanche" | "carl" | "isabel" | "joshua";

export type OilCharacter = {
  id: CharacterId;
  name: string;
  portrait: string;
  title: string;
  quote: string;
};
export type RivalState = {
  id: string;
  name: string;
  portrait: string;
  color: string;
  capital: number;
};

export type AuctionBid = {
  bidderId: string | null;
  amount: number;
};

export const OIL_CHARACTERS: OilCharacter[] = [
  { id: "blanche", name: "布兰奇", portrait: "👩🏻‍💼", title: "精明商人", quote: "市场会说谎，但数字不会。我会在最高价时卖出最后一桶油。" },
  { id: "carl", name: "卡尔", portrait: "🧑🏻‍🔧", title: "机械工程师", quote: "给我一座井架和几根管道，我会让整片土地开始工作。" },
  { id: "isabel", name: "莎贝尔", portrait: "👩🏼‍🌾", title: "土地专家", quote: "地表的颜色、山坡的走向，都藏着地下油田的线索。" },
  { id: "joshua", name: "约书亚", portrait: "🧔🏻", title: "西部拓荒者", quote: "别人害怕空井，我只担心自己没有勇气再钻深一点。" },
];

export const createInitialRivals = (): RivalState[] => [
  { id: "rival-henry", name: "亨利", portrait: "🎩", color: "#d2644b", capital: 2600 },
  { id: "rival-martha", name: "玛莎", portrait: "👒", color: "#567fb0", capital: 2600 },
  { id: "rival-walter", name: "沃尔特", portrait: "🧔🏼", color: "#5a9a66", capital: 2600 },
  { id: "rival-doris", name: "多丽丝", portrait: "👩🏽", color: "#9b67a5", capital: 2600 },
];

export const createAuctionBids = (plots: OilPlot[]): Record<number, AuctionBid> => Object.fromEntries(plots.map((plot) => [plot.id, {
  bidderId: null,
  amount: Math.max(50, Math.round(plot.bid * .42 / 10) * 10),
}]));

export const createAiTargets = (plots: OilPlot[], rivals: RivalState[]): Record<string, number> => {
  const remaining = [...plots];
  const targets: Record<string, number> = {};
  rivals.forEach((rival, rivalIndex) => {
    const ranked = remaining
      .map((plot) => ({ plot, score: plot.reserve * (.82 + Math.random() * .36) - plot.bid * .18 + rivalIndex * 2 }))
      .sort((left, right) => right.score - left.score);
    const choice = ranked[0]?.plot;
    if (!choice) return;
    targets[rival.id] = choice.id;
    remaining.splice(remaining.findIndex((plot) => plot.id === choice.id), 1);
  });
  return targets;
};
