import type { GameId } from "@/config/games";

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
  unlock?: () => void;
};

const PORTRAIT_FULLSCREEN_GAMES = new Set<GameId>([
  "thunder-wing",
  "planet-merge",
]);

export function prefersLandscapeFullscreen(gameId: GameId) {
  return !PORTRAIT_FULLSCREEN_GAMES.has(gameId);
}

export function isPortraitViewport() {
  return window.innerHeight > window.innerWidth;
}

export async function lockLandscapeOrientation() {
  const orientation = screen.orientation as LockableScreenOrientation | undefined;
  if (!orientation?.lock) return false;

  try {
    await orientation.lock("landscape");
    return true;
  } catch {
    return false;
  }
}

export function unlockOrientation() {
  const orientation = screen.orientation as LockableScreenOrientation | undefined;
  orientation?.unlock?.();
}
