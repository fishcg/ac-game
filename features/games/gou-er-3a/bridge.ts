import { computeScore, parseDebrief, type ParsedDebrief } from "./rules";

/**
 * 同源 iframe 桥：读取游戏菜单状态、行动简报，并把平台静音同步给游戏音频。
 * 游戏本身没有 postMessage，所以这里直接读 iframe 的 DOM 与 window.__G。
 */

export type GameScreen = "none" | "title" | "paused" | "dead" | "complete" | "unknown";

export type CompleteResult = {
  score: number;
  stats: ParsedDebrief;
};

export type GameBridgeOptions = {
  initialMuted?: boolean;
  onScreen?: (screen: GameScreen) => void;
  onComplete: (result: CompleteResult) => void;
};

export type GameBridge = {
  setMuted: (muted: boolean) => void;
  dispose: () => void;
};

type GameAudio = {
  setVolume?: (value: number) => void;
};

type GameWindow = Window & {
  __G?: {
    audio?: GameAudio;
  };
};

const SETTINGS_KEY = "saltline.settings.v1";
const DEFAULT_VOLUME = 0.8;
const POLL_MS = 200;
const KNOWN_SCREENS = new Set(["title", "paused", "dead", "complete"]);

function readStoredVolume(win: GameWindow): number {
  try {
    const raw = win.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_VOLUME;
    const parsed = JSON.parse(raw) as { volume?: unknown };
    const value = Number(parsed.volume);
    if (!Number.isFinite(value)) return DEFAULT_VOLUME;
    return Math.min(1, Math.max(0, value));
  } catch {
    return DEFAULT_VOLUME;
  }
}

export function connectGame(iframe: HTMLIFrameElement, options: GameBridgeOptions): GameBridge {
  const frameWindow = iframe.contentWindow as GameWindow | null;
  const frameDoc = iframe.contentDocument;
  if (!frameWindow || !frameDoc) {
    return { setMuted: () => {}, dispose: () => {} };
  }
  const win: GameWindow = frameWindow;
  const doc: Document = frameDoc;

  let disposed = false;
  let muted = options.initialMuted ?? false;
  let lastScreen: GameScreen | null = null;
  let scored = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let restoreVolume: (() => void) | null = null;

  function readScreen(): GameScreen {
    const menu = doc.querySelector<HTMLElement>(".menu");
    const raw = menu?.dataset.screen;
    if (!raw || raw === "none") return "none";
    return KNOWN_SCREENS.has(raw) ? (raw as GameScreen) : "unknown";
  }

  function readDebrief(): CompleteResult | null {
    const menu = doc.querySelector<HTMLElement>(".menu");
    if (!menu) return null;
    const field = (name: string) => menu.querySelector(`[data-f="${name}"]`)?.textContent ?? "";
    const stats = parseDebrief({
      time: field("time"),
      accuracy: field("acc"),
      kills: field("kills"),
      retries: field("retries"),
    });
    if (!stats) return null;
    return { stats, score: computeScore(stats) };
  }

  function applyVolume(): void {
    const audio = win.__G?.audio;
    if (typeof audio?.setVolume !== "function") return;
    audio.setVolume(muted ? 0 : readStoredVolume(win));
  }

  function installAudio(): void {
    const audio = win.__G?.audio;
    if (!audio || typeof audio.setVolume !== "function" || restoreVolume) return;
    const original = audio.setVolume;
    const wrapped = (value: number) => {
      original.call(audio, muted ? 0 : value);
    };
    audio.setVolume = wrapped;
    restoreVolume = () => {
      if (audio.setVolume === wrapped) audio.setVolume = original;
    };
    if (muted) wrapped(0);
  }

  function setMuted(next: boolean): void {
    if (disposed || muted === next) return;
    muted = next;
    installAudio();
    applyVolume();
  }

  function tick(): void {
    if (disposed) return;
    installAudio();

    const screen = readScreen();
    if (screen !== lastScreen) {
      const previous = lastScreen;
      lastScreen = screen;
      if (screen !== "complete") scored = false;
      options.onScreen?.(screen);
      if (previous === "complete" && screen !== "complete") scored = false;
    }

    if (screen === "complete" && !scored) {
      const result = readDebrief();
      if (result) {
        scored = true;
        options.onComplete(result);
      }
    }

    timer = setTimeout(tick, POLL_MS);
  }

  tick();

  return {
    setMuted,
    dispose() {
      disposed = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      restoreVolume?.();
      restoreVolume = null;
    },
  };
}
