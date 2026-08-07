import type { GameId } from "@/config/games";

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape" | "portrait") => Promise<void>;
  unlock?: () => void;
};

const PORTRAIT_FULLSCREEN_GAMES = new Set<GameId>([
  "thunder-wing",
  "planet-merge",
  "bamboo-cicada",
  "orbit-dash",
  "stack-up",
  "memory-pairs",
  "beat-rush",
  "hamster-roll",
  "minesweeper",
  "go",
]);

export function preferredMobileOrientation(gameId: GameId): "portrait" | "landscape" {
  return PORTRAIT_FULLSCREEN_GAMES.has(gameId) ? "portrait" : "landscape";
}

export function prefersLandscapeFullscreen(gameId: GameId) {
  return preferredMobileOrientation(gameId) === "landscape";
}

export function isPortraitViewport() {
  return window.innerHeight > window.innerWidth;
}

export async function lockLandscapeOrientation() {
  return lockOrientation("landscape");
}

export async function lockPortraitOrientation() {
  return lockOrientation("portrait");
}

async function lockOrientation(direction: "landscape" | "portrait") {
  const orientation = screen.orientation as LockableScreenOrientation | undefined;
  if (!orientation?.lock) return false;

  try {
    await orientation.lock(direction);
    return true;
  } catch {
    return false;
  }
}

export function unlockOrientation() {
  const orientation = screen.orientation as LockableScreenOrientation | undefined;
  orientation?.unlock?.();
}
