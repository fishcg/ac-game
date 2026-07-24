export type Suit = "wan" | "tiao" | "tong";
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type TileKey = `${Suit}-${Rank}`;

export type Tile = {
  id: number;
  suit: Suit;
  rank: Rank;
};

export type MeldKind = "pong" | "open-kong" | "concealed-kong" | "added-kong";

export type Meld = {
  kind: MeldKind;
  tiles: Tile[];
  fromSeat: number | null;
};

export type BeanKind = "point" | "concealed" | "added";

export type BeanEvent = {
  kind: BeanKind;
  owner: number;
  payer: number | null;
  fan: number;
  tile: TileKey;
};

export type WinPattern =
  | "平胡"
  | "大对子"
  | "七对"
  | "龙七对"
  | "清一色"
  | "清大对"
  | "清七对"
  | "清龙背";

export type WinAnalysis = {
  valid: boolean;
  pattern: WinPattern | null;
  fan: number;
  pureSuit: boolean;
  sevenPairs: boolean;
  dragonPairs: boolean;
  allTriplets: boolean;
};

export type ChickenCharge = {
  tile: TileKey;
  discarder: number;
  claimant: number | null;
};

export type RoundScorePlayer = {
  seat: number;
  ready: boolean;
  tiles: Tile[];
  analysis: WinAnalysis | null;
};

export type RoundScoreInput = {
  players: RoundScorePlayer[];
  winner: number | null;
  discarder: number | null;
  dealer: number;
  selfDraw: boolean;
  indicator: Tile;
  beanEvents: BeanEvent[];
  charge: ChickenCharge | null;
  liabilityPayer?: number | null;
  burnedSeats?: number[];
  base?: number;
};

export type MahjongSound = "start" | "draw" | "discard" | "pong" | "kong" | "hu" | "chicken" | "pass" | "lose";

export type MahjongCallbacks = {
  onState: (state: MahjongState) => void;
  onSound: (sound: MahjongSound) => void;
  onScore: (score: number) => void;
};

export type ScoreLine = {
  label: string;
  from: number;
  to: number;
  amount: number;
};

export type RoundScore = {
  deltas: number[];
  lines: ScoreLine[];
  chickenKey: TileKey;
  chickenFan: number[];
};

export type MahjongPhase =
  | "idle"
  | "dealing"
  | "player-turn"
  | "ai-turn"
  | "response"
  | "paused"
  | "chicken-reveal"
  | "round-end"
  | "match-end";

export type ActionKind = "pong" | "kong" | "hu" | "pass" | "discard";

export type ActionOption = {
  kind: ActionKind;
  tile?: TileKey;
  label: string;
};

export type PlayerState = {
  seat: number;
  name: string;
  avatar: string;
  score: number;
  hand: Tile[];
  melds: Meld[];
  discards: Tile[];
  ready: boolean;
  declaredReady: boolean;
  beanCount: number;
};

export type TableEffect = {
  id: number;
  seat: number;
  kind: "deal" | "draw" | "discard" | "pong" | "kong" | "hu" | "chicken" | "ready";
  label: string;
};

export type RoundSettlement = {
  winner: number | null;
  title: string;
  subtitle: string;
  indicator: Tile;
  chickenKey: TileKey;
  deltas: number[];
  lines: ScoreLine[];
  patterns: Array<{ seat: number; pattern: string; fan: number }>;
};

export type MahjongState = {
  phase: MahjongPhase;
  resumePhase: MahjongPhase | null;
  round: number;
  dealer: number;
  current: number;
  players: PlayerState[];
  wall: Tile[];
  lastDiscard: { seat: number; tile: Tile } | null;
  selectedTileId: number | null;
  drawnTileId: number | null;
  actions: ActionOption[];
  beanEvents: BeanEvent[];
  charge: ChickenCharge | null;
  effect: TableEffect | null;
  message: string;
  turnNumber: number;
  settlement: RoundSettlement | null;
};
