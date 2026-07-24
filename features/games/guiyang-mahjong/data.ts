import type { PlayerState, Suit, TileKey } from "./types";

export const PLAYER_PROFILES = [
  { name: "你", avatar: "黔" },
  { name: "阿明", avatar: "明" },
  { name: "小敏", avatar: "敏" },
  { name: "老周", avatar: "周" },
] as const;

export const SUIT_LABEL: Record<Suit, string> = { wan: "万", tiao: "条", tong: "筒" };
export const SUIT_MARK: Record<Suit, string> = { wan: "萬", tiao: "索", tong: "筒" };

export const RULE_SECTIONS = [
  { title: "基础", text: "四人使用万、条、筒共 108 张牌。可以碰、杠、胡，不可以吃；一人胡牌后本局结束。" },
  { title: "豆通行证", text: "杠牌称为豆。无豆时，平胡只能自摸；大对子及以上牌型可点胡。有任意豆后，平胡也可点胡。" },
  { title: "三类豆", text: "点豆由放杠者付 1 番；闷豆由其余三家各付 2 番；碰后补杠为爬坡豆，其余三家各付 3 番。" },
  { title: "捉鸡", text: "胡牌后翻牌墙首张为指示牌，同花色顺位下一张为鸡，9 后回到 1。幺鸡是一条，1 番；乌骨鸡是八筒，2 番。翻牌鸡与它们重合时成为金鸡并翻倍。" },
  { title: "冲锋与责任", text: "本局第一张被打出的幺鸡或乌骨鸡是冲锋鸡，结算加倍；若被碰或杠走，打出者承担责任鸡的额外赔付。" },
  { title: "牌型", text: "平胡 1 番、大对子 5 番、七对 7 番、龙七对 10 番、清一色 10 番、清大对 15 番、清七对 17 番、清龙背 20 番。" },
  { title: "黄牌查叫", text: "牌墙摸完无人胡牌时查叫：未听牌者向听牌者支付其可胡牌型番数，鸡和有效豆继续参与结算。" },
] as const;

export const SPECIAL_CHICKENS: TileKey[] = ["tiao-1", "tong-8"];

export function createPlayers(): PlayerState[] {
  return PLAYER_PROFILES.map((profile, seat) => ({
    seat,
    name: profile.name,
    avatar: profile.avatar,
    score: 100,
    hand: [],
    melds: [],
    discards: [],
    ready: false,
    declaredReady: false,
    beanCount: 0,
  }));
}
