import type { GameSDK, GuestProfile, ScoreEntry, UserRankingEntry } from "./types";

const PREFIX = "ac-game:";
const LEGACY_PREFIX = "playnest:";

const canUseDOM = () => typeof window !== "undefined";

const storage = {
  get<T>(key: string, fallback: T): T {
    if (!canUseDOM()) return fallback;
    try {
      let raw = window.localStorage.getItem(PREFIX + key);
      if (raw === null) {
        raw = window.localStorage.getItem(LEGACY_PREFIX + key);
        if (raw !== null) window.localStorage.setItem(PREFIX + key, raw);
      }
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T) {
    if (canUseDOM()) window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  },
};

function newProfile(): GuestProfile {
  return {
    id: `guest_${Math.random().toString(36).slice(2, 10)}`,
    displayName: "",
    createdAt: Date.now(),
  };
}

function getOrCreateProfile() {
  const profile = storage.get<GuestProfile | null>("profile", null);
  if (profile) return profile;
  const created = newProfile();
  storage.set("profile", created);
  return created;
}

function scoresKey(userId: string) {
  return `scores:${userId}`;
}

function updateUserRanking(profile: GuestProfile, scores: ScoreEntry[]) {
  if (!profile.displayName) return;
  const ranking = storage.get<UserRankingEntry[]>("user-ranking", []);
  const entry: UserRankingEntry = {
    userId: profile.id,
    displayName: profile.displayName,
    totalScore: scores.reduce((sum, score) => sum + score.score, 0),
    gamesPlayed: scores.length,
    updatedAt: Date.now(),
  };
  storage.set("user-ranking", [...ranking.filter((item) => item.userId !== profile.id), entry]);
}

export const guestSDK: GameSDK = {
  storage,
  auth: {
    getProfile() {
      return getOrCreateProfile();
    },
    setDisplayName(name: string) {
      const current = getOrCreateProfile();
      const displayName = name.trim().replace(/\s+/g, " ").slice(0, 16);
      const profile = { ...current, displayName: displayName || current.displayName };
      storage.set("profile", profile);
      const key = scoresKey(profile.id);
      let scores = storage.get<ScoreEntry[]>(key, []);
      if (!scores.length) {
        const legacyScores = storage.get<ScoreEntry[]>("scores", []);
        if (legacyScores.length) {
          scores = legacyScores;
          storage.set(key, legacyScores);
        }
      }
      updateUserRanking(profile, scores);
      return profile;
    },
  },
  leaderboard: {
    submit(gameId: string, score: number) {
      const profile = getOrCreateProfile();
      const key = scoresKey(profile.id);
      const entries = storage.get<ScoreEntry[]>(key, []);
      const previous = entries.find((item) => item.gameId === gameId);
      const entry = { gameId, score: Math.max(score, previous?.score ?? 0), updatedAt: Date.now() };
      const nextEntries = [...entries.filter((item) => item.gameId !== gameId), entry];
      storage.set(key, nextEntries);
      updateUserRanking(profile, nextEntries);
      return entry;
    },
    getBest(gameId: string) {
      const profile = getOrCreateProfile();
      return storage.get<ScoreEntry[]>(scoresKey(profile.id), []).find((item) => item.gameId === gameId)?.score ?? 0;
    },
    getAll() {
      const profile = getOrCreateProfile();
      return storage.get<ScoreEntry[]>(scoresKey(profile.id), []);
    },
    getUserRanking() {
      return storage.get<UserRankingEntry[]>("user-ranking", []).sort((a, b) => b.totalScore - a.totalScore || a.updatedAt - b.updatedAt);
    },
  },
  analytics: {
    track(event, payload = {}) {
      if (process.env.NODE_ENV === "development") console.info(`[狗耳GAME] ${event}`, payload);
    },
  },
  payment: {
    isAvailable: () => false,
    async purchase() {
      throw new Error("游客模式暂未开放支付");
    },
  },
};
