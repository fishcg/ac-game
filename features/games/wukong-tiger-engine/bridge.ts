import { POLL_MS } from "./data";
import { readResult, type BattleResult, type BattleSnapshot } from "./rules";

/**
 * 同源 iframe 桥：读取虎先锋战斗的调试状态、同步平台静音，并提供暂停遮罩。
 * 游戏没有 postMessage / 成绩钩子，所以直接访问 iframe 的 window.__WK_DEBUG__ 与 DOM。
 */

type WukongAudio = {
  applyVolume?: () => void;
  volume?: number;
  muted?: boolean;
  master?: { gain?: { value: number } } | null;
};

type WukongGame = {
  state?: string;
  paused?: boolean;
  input?: { enabled?: boolean };
  audio?: WukongAudio;
};

type WukongDebug = {
  state?: () => BattleSnapshot;
  game?: WukongGame;
};

type WukongWindow = Window & {
  __WK_DEBUG__?: WukongDebug;
};

export type WukongBridgeOptions = {
  initialMuted?: boolean;
  onResult: (result: BattleResult) => void;
  onStateChange?: (state: string) => void;
};

export type WukongBridge = {
  setMuted: (muted: boolean) => void;
  dispose: () => void;
};

const PAUSE_ID = "wk-platform-pause";
const PAUSE_STYLE_ID = "wk-platform-pause-style";

export function connectWukong(iframe: HTMLIFrameElement, options: WukongBridgeOptions): WukongBridge {
  const frameWindow = iframe.contentWindow as WukongWindow | null;
  const frameDoc = iframe.contentDocument;
  if (!frameWindow || !frameDoc) {
    return { setMuted: () => {}, dispose: () => {} };
  }
  const win: WukongWindow = frameWindow;
  const doc: Document = frameDoc;

  let disposed = false;
  let muted = options.initialMuted ?? false;
  let submitted = false;
  let lastState: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let restoreAudio: (() => void) | null = null;
  let pauseEl: HTMLDivElement | null = null;
  let pauseStyle: HTMLStyleElement | null = null;
  let pauseButton: HTMLButtonElement | null = null;
  let pauseHandler: (() => void) | null = null;
  let hiddenHelpByPlatform = false;

  const debug = (): WukongDebug | undefined => win.__WK_DEBUG__;

  function requestPointerLock(): void {
    try {
      doc.querySelector<HTMLCanvasElement>("#app canvas")?.requestPointerLock?.();
    } catch {
      // 浏览器可能在非用户手势外拒绝指针锁定；玩家再次点击画面即可。
    }
  }

  function pause(): void {
    const game = debug()?.game;
    if (!game || game.state !== "fight") return;
    game.paused = true;
    if (game.input) game.input.enabled = false;
    doc.exitPointerLock?.();
    pauseEl?.classList.add("is-open");
    pauseEl?.setAttribute("aria-hidden", "false");
  }

  function resume(): void {
    const game = debug()?.game;
    if (game) {
      game.paused = false;
      if (game.input) game.input.enabled = true;
    }
    pauseEl?.classList.remove("is-open");
    pauseEl?.setAttribute("aria-hidden", "true");
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.code !== "Escape") return;
    const game = debug()?.game;
    if (!game || game.state !== "fight") return;
    event.preventDefault();
    event.stopPropagation();
    if (game.paused) {
      resume();
      requestPointerLock();
    } else {
      pause();
    }
  }

  function installPauseUi(): void {
    if (pauseEl || !doc.head || !doc.body) return;
    pauseStyle = doc.createElement("style");
    pauseStyle.id = PAUSE_STYLE_ID;
    pauseStyle.textContent = `
      #${PAUSE_ID}{position:fixed;inset:0;z-index:99999;display:none;place-items:center;background:rgba(3,4,3,.72);backdrop-filter:blur(3px);font-family:Georgia,"Songti SC",serif;color:#eadfc6}
      #${PAUSE_ID}.is-open{display:grid}
      #${PAUSE_ID} .wk-pause-card{display:grid;justify-items:center;gap:10px;padding:28px 44px 24px;border:1px solid #b58a4a80;background:linear-gradient(160deg,#17130e,#090a08);box-shadow:0 24px 80px #000c;text-align:center}
      #${PAUSE_ID} .wk-pause-kicker{font-size:10px;letter-spacing:.32em;color:#c9a86a}
      #${PAUSE_ID} .wk-pause-title{font-size:34px;letter-spacing:.16em;color:#f0e4c8;text-shadow:0 0 18px #8c5a2b66}
      #${PAUSE_ID} .wk-pause-sub{font-size:12px;letter-spacing:.12em;color:#9d9079}
      #${PAUSE_ID} button{margin-top:8px;padding:10px 30px;border:1px solid #c39a58;background:#c39a58;color:#15110b;font:inherit;font-size:14px;letter-spacing:.12em;cursor:pointer}
      #${PAUSE_ID} button:hover{background:#e0b878}
      #${PAUSE_ID} .wk-pause-hint{font-size:10px;letter-spacing:.1em;color:#7d7464}
    `;
    doc.head.appendChild(pauseStyle);

    pauseEl = doc.createElement("div");
    pauseEl.id = PAUSE_ID;
    pauseEl.setAttribute("aria-hidden", "true");
    pauseEl.innerHTML = `<div class="wk-pause-card"><span class="wk-pause-kicker">PAUSED</span><strong class="wk-pause-title">已暂停</strong><span class="wk-pause-sub">虎先锋的战斗已冻结</span><button type="button">继续战斗</button><span class="wk-pause-hint">也可以按 Esc 继续</span></div>`;
    doc.body.appendChild(pauseEl);
    pauseButton = pauseEl.querySelector("button");
    pauseHandler = () => {
      resume();
      requestPointerLock();
    };
    pauseButton?.addEventListener("click", pauseHandler);
    doc.addEventListener("keydown", onKeyDown, true);
  }

  function syncResultChrome(active: boolean): void {
    const help = doc.querySelector<HTMLElement>("#help");
    if (!help) return;
    if (active) {
      if (help.classList.contains("hidden")) return;
      help.classList.add("hidden");
      hiddenHelpByPlatform = true;
    } else if (hiddenHelpByPlatform) {
      help.classList.remove("hidden");
      hiddenHelpByPlatform = false;
    }
  }

  function installAudio(): void {
    const audio = debug()?.game?.audio;
    if (!audio || typeof audio.applyVolume !== "function" || restoreAudio) return;
    const original = audio.applyVolume;
    const wrapped = function (this: WukongAudio) {
      if (muted) {
        if (this.master?.gain) this.master.gain.value = 0;
        return;
      }
      original.call(this);
    };
    audio.applyVolume = wrapped;
    restoreAudio = () => {
      if (audio.applyVolume === wrapped) audio.applyVolume = original;
      original.call(audio);
    };
    if (muted) wrapped.call(audio);
  }

  function setMuted(next: boolean): void {
    if (disposed || muted === next) return;
    muted = next;
    installAudio();
    debug()?.game?.audio?.applyVolume?.();
  }

  function tick(): void {
    if (disposed) return;
    const api = debug();
    if (api?.game) {
      installAudio();
      installPauseUi();
    }

    let snapshot: BattleSnapshot | null = null;
    try {
      snapshot = api?.state?.() ?? null;
    } catch {
      snapshot = null;
    }

    if (snapshot) {
      if (snapshot.state !== lastState) {
        lastState = snapshot.state;
        options.onStateChange?.(snapshot.state);
      }

      if (snapshot.state === "fight" || snapshot.state === "ready") {
        submitted = false;
        syncResultChrome(false);
      }

      if (!submitted && (snapshot.state === "victory" || snapshot.state === "defeat")) {
        const result = readResult(snapshot);
        if (result) {
          submitted = true;
          resume();
          syncResultChrome(true);
          options.onResult(result);
        }
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
      doc.removeEventListener("keydown", onKeyDown, true);
      if (pauseButton && pauseHandler) pauseButton.removeEventListener("click", pauseHandler);
      pauseHandler = null;
      pauseEl?.remove();
      pauseStyle?.remove();
      pauseEl = null;
      pauseStyle = null;
      pauseButton = null;
      restoreAudio?.();
      restoreAudio = null;
      syncResultChrome(false);
      const game = debug()?.game;
      if (game) {
        game.paused = false;
        if (game.input) game.input.enabled = true;
      }
    },
  };
}
