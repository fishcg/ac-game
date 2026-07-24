export type GuestProfile = {
  id: string;
  displayName: string;
  createdAt: number;
};

export type ScoreEntry = {
  gameId: string;
  score: number;
  updatedAt: number;
};

export type UserRankingEntry = {
  userId: string;
  displayName: string;
  totalScore: number;
  gamesPlayed: number;
  updatedAt: number;
};

export interface AuthModule {
  getProfile(): GuestProfile;
  setDisplayName(name: string): GuestProfile;
  login?(): Promise<GuestProfile>;
  logout?(): Promise<void>;
}

export interface StorageModule {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
}

export interface LeaderboardModule {
  submit(gameId: string, score: number): ScoreEntry;
  getBest(gameId: string): number;
  getAll(): ScoreEntry[];
  getUserRanking(): UserRankingEntry[];
}

export interface AnalyticsModule {
  track(event: string, payload?: Record<string, unknown>): void;
}

export interface PaymentModule {
  isAvailable(): boolean;
  purchase(productId: string): Promise<never>;
}

export interface GameSDK {
  auth: AuthModule;
  storage: StorageModule;
  leaderboard: LeaderboardModule;
  analytics: AnalyticsModule;
  payment: PaymentModule;
}
