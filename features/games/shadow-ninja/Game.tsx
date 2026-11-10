"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";

import { gameAudio } from "@/lib/audio/gameAudio";

import type { MiniGameProps } from "../types";
import { DuelEngine } from "./Engine";
import { playSfx, unlockAudio } from "./audio";
import { characterList, characters, DIFFICULTY_LABEL, VIEW_H, VIEW_W } from "./data";
import { renderScene } from "./render";
import type {
  ActionName,
  CharacterDef,
  Difficulty,
  FighterHud,
  FighterId,
  HudSnapshot,
  MatchMode,
  MatchResult,
} from "./types";

import styles from "./ShadowNinja.module.css";

type Screen = "select" | "fight";
type Slot = 0 | 1;

type Config = {
  p1: FighterId;
  p2: FighterId;
  mode: MatchMode;
  difficulty: Difficulty;
};

const STORAGE_KEY = "doggame.shadow-ninja.config.v1";

const DEFAULT_CONFIG: Config = { p1: "kage", p2: "rai", mode: "cpu", difficulty: 2 };

const KEYS_P1: Record<string, ActionName> = {
  KeyA: "left",
  KeyD: "right",
  KeyW: "up",
  KeyS: "down",
  KeyJ: "light",
  KeyK: "heavy",
  KeyL: "guard",
  KeyI: "special",
  KeyU: "super",
};

const KEYS_P2: Record<string, ActionName> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  Digit1: "light",
  Digit2: "heavy",
  Digit3: "guard",
  Digit4: "special",
  Digit5: "super",
};

const ACTION_KEYS: ActionName[] = ["left", "right", "up", "down", "guard", "light", "heavy", "special", "super"];

function loadConfig(): Config {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<Config>;
    return {
      p1: parsed.p1 && characters[parsed.p1] ? parsed.p1 : DEFAULT_CONFIG.p1,
      p2: parsed.p2 && characters[parsed.p2] ? parsed.p2 : DEFAULT_CONFIG.p2,
      mode: parsed.mode === "local" ? "local" : "cpu",
      difficulty: parsed.difficulty === 1 || parsed.difficulty === 3 ? parsed.difficulty : 2,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config: Config): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    /* 忽略隐私模式下的写入失败 */
  }
}

function SpecialKeys({ side }: { side: 0 | 1 }) {
  const rows =
    side === 0
      ? [
          ["移动", "A / D"],
          ["跳跃", "W"],
          ["蹲下", "S"],
          ["轻攻击", "J"],
          ["重攻击", "K"],
          ["防御", "L"],
          ["忍术", "I"],
          ["奥义", "U"],
        ]
      : [
          ["移动", "← / →"],
          ["跳跃", "↑"],
          ["蹲下", "↓"],
          ["轻攻击", "1"],
          ["重攻击", "2"],
          ["防御", "3"],
          ["忍术", "4"],
          ["奥义", "5"],
        ];
  return (
    <dl className={styles.keys}>
      {rows.map(([label, key]) => (
        <div key={label} className={styles.keyRow}>
          <dt>{label}</dt>
          <dd>{key}</dd>
        </div>
      ))}
    </dl>
  );
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.statBar}>
      <span>{label}</span>
      <div className={styles.statTrack}>
        <div className={styles.statFill} style={{ width: `${Math.max(8, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function FighterBar({
  hud,
  side,
  wins,
}: {
  hud: FighterHud;
  side: "left" | "right";
  wins: number;
}) {
  const hpPct = Math.max(0, Math.min(100, (hud.hp / Math.max(1, hud.hpMax)) * 100));
  const low = hpPct <= 25;
  const guard = Math.max(0, Math.min(100, hud.guard));
  return (
    <div className={`${styles.fighterBar} ${side === "right" ? styles.fighterBarRight : ""}`}>
      <div className={styles.fighterMeta}>
        <span className={styles.fighterName}>{hud.name}</span>
        <span className={styles.wins}>
          {[0, 1].map((i) => (
            <i key={i} className={i < wins ? styles.winDotOn : styles.winDot} />
          ))}
        </span>
      </div>
      <div className={`${styles.hpTrack} ${low ? styles.hpLow : ""}`}>
        <div className={styles.hpFill} style={{ width: `${hpPct}%` }} />
        <div className={styles.hpGhost} style={{ width: `${hpPct}%` }} />
      </div>
      <div className={styles.guardTrack}>
        <div className={styles.guardFill} style={{ width: `${guard}%` }} />
      </div>
    </div>
  );
}

function Meter({
  side,
  hud,
  def,
}: {
  side: "left" | "right";
  hud: FighterHud;
  def: CharacterDef;
}) {
  const chakra = Math.max(0, Math.min(100, hud.chakra));
  const specialReady = chakra >= def.moves.special.cost;
  const superReady = chakra >= def.moves.super.cost;
  return (
    <div className={`${styles.meter} ${side === "right" ? styles.meterRight : ""}`}>
      <div className={styles.meterNames}>
        <span className={specialReady ? styles.ready : styles.costed}>
          忍术 · {def.specialName}
        </span>
        <span className={superReady ? styles.readySuper : styles.costed}>
          奥义 · {def.superName}
        </span>
      </div>
      <div className={`${styles.chakraTrack} ${superReady ? styles.chakraFull : ""}`}>
        <div className={styles.chakraFill} style={{ width: `${chakra}%` }} />
        <i className={styles.chakraMark} style={{ left: `${def.moves.special.cost}%` }} />
        <i className={styles.chakraMark} style={{ left: `${def.moves.super.cost}%` }} />
      </div>
    </div>
  );
}

export function ShadowNinja({ bestScore, onScore }: MiniGameProps) {
  const [screen, setScreen] = useState<Screen>("select");
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [slot, setSlot] = useState<Slot>(0);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [runId, setRunId] = useState(0);
  const [isFull, setIsFull] = useState(false);
  const [muteState, setMuteState] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<DuelEngine | null>(null);
  const configRef = useRef<Config>(DEFAULT_CONFIG);
  const scoreRef = useRef(onScore);
  const pausedRef = useRef(false);
  const resultRef = useRef<MatchResult | null>(null);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    scoreRef.current = onScore;
  }, [onScore]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setConfig(loadConfig());
      setMuteState(gameAudio.isMuted());
    });
    const unsubscribe = gameAudio.subscribe((next) => setMuteState(next));
    return () => {
      window.cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, []);

  const updateConfig = useCallback((patch: Partial<Config>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      saveConfig(next);
      return next;
    });
  }, []);

  const startMatch = useCallback(() => {
    unlockAudio();
    playSfx("select");
    setResult(null);
    setPaused(false);
    setHud(null);
    setScreen("fight");
    setRunId((n) => n + 1);
  }, []);

  const backToSelect = useCallback(() => {
    setScreen("select");
    setResult(null);
    setPaused(false);
    setHud(null);
  }, []);

  const restart = useCallback(() => {
    setResult(null);
    setPaused(false);
    setRunId((n) => n + 1);
  }, []);

  // ── 引擎生命周期 ──────────────────────────────────────────
  useEffect(() => {
    if (screen !== "fight") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cfg = configRef.current;
    const engine = new DuelEngine({
      p1: cfg.p1,
      p2: cfg.p2,
      mode: cfg.mode,
      difficulty: cfg.difficulty,
      onHud: (next) => setHud(next),
      onSound: (name) => playSfx(name),
      onEnd: (outcome) => {
        setResult(outcome);
        if (outcome.score > 0) scoreRef.current(outcome.score);
      },
    });
    engineRef.current = engine;

    const ctx = canvas.getContext("2d");
    let dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 1) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = now - last;
      last = now;
      engine.update(dt);
      if (ctx) renderScene(ctx, engine, canvas.width, canvas.height, engine.time);
    };
    raf = requestAnimationFrame(loop);

    const onVisibility = () => {
      if (document.hidden && !resultRef.current) setPaused(true);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      engine.dispose();
      engineRef.current = null;
    };
  }, [screen, runId]);

  useEffect(() => {
    engineRef.current?.setPaused(paused);
  }, [paused]);

  // ── 键盘 ──────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "fight") return;

    const setAction = (side: Slot, action: ActionName, down: boolean) => {
      const engine = engineRef.current;
      if (!engine) return;
      const input = side === 0 ? engine.input1 : engine.input2;
      if (down) {
        if (!input.held[action]) input.queue.push(action);
        input.held[action] = true;
      } else {
        input.held[action] = false;
      }
    };

    const releaseAll = () => {
      const engine = engineRef.current;
      if (!engine) return;
      for (const action of ACTION_KEYS) {
        engine.input1.held[action] = false;
        engine.input2.held[action] = false;
      }
    };

    // Esc 在捕获阶段拦下，避免被外层的关闭弹窗逻辑吃掉。
    const onEscape = (e: KeyboardEvent) => {
      if (e.code !== "Escape" || resultRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      setPaused((p) => !p);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") return;
      if (e.code === "Enter" && resultRef.current) {
        e.preventDefault();
        restart();
        return;
      }
      if (pausedRef.current || resultRef.current) return;
      const local = configRef.current.mode === "local";
      const p1 = KEYS_P1[e.code];
      const p2 = local ? KEYS_P2[e.code] : undefined;
      if (!p1 && !p2) return;
      e.preventDefault();
      if (e.repeat) return;
      if (p1) setAction(0, p1, true);
      if (p2) setAction(1, p2, true);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const local = configRef.current.mode === "local";
      const p1 = KEYS_P1[e.code];
      const p2 = local ? KEYS_P2[e.code] : undefined;
      if (!p1 && !p2) return;
      e.preventDefault();
      if (p1) setAction(0, p1, false);
      if (p2) setAction(1, p2, false);
    };

    window.addEventListener("keydown", onEscape, { capture: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("keydown", onEscape, { capture: true });
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseAll);
      releaseAll();
    };
  }, [screen, restart]);

  // ── 全屏 ──────────────────────────────────────────────────
  useEffect(() => {
    const onChange = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void root.requestFullscreen?.().catch(() => undefined);
    }
  }, []);

  const toggleMute = useCallback(() => {
    gameAudio.setMuted(!gameAudio.isMuted());
  }, []);

  const holdProps = useCallback((side: Slot, action: ActionName) => {
    const set = (down: boolean) => {
      const engine = engineRef.current;
      if (!engine) return;
      const input = side === 0 ? engine.input1 : engine.input2;
      if (down) {
        if (!input.held[action]) input.queue.push(action);
        input.held[action] = true;
      } else {
        input.held[action] = false;
      }
    };
    return {
      onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        set(true);
      },
      onPointerUp: () => set(false),
      onPointerCancel: () => set(false),
      onPointerLeave: () => set(false),
      onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
    };
  }, []);

  const p1Def = characters[config.p1];
  const p2Def = characters[config.p2];

  const hudP1 = hud?.p1;
  const hudP2 = hud?.p2;
  const calloutVisible = Boolean(hud && hud.callout && hud.calloutTimer > 0);
  const bannerVisible = Boolean(hud && hud.banner);

  return (
    <div ref={rootRef} className={styles.stage}>
      <div className={styles.frame}>
        <canvas ref={canvasRef} className={styles.canvas} width={VIEW_W} height={VIEW_H} aria-label="影忍对决战斗画面" />

        {screen === "fight" && hud && (
          <>
            <div className={styles.hud}>
              <div className={styles.hudTop}>
                <FighterBar hud={hud.p1} side="left" wins={hud.wins[0]} />
                <div className={styles.center}>
                  <div className={styles.timer}>{Math.ceil(hud.time)}</div>
                  <div className={styles.roundTag}>第 {hud.round} 回合</div>
                </div>
                <FighterBar hud={hud.p2} side="right" wins={hud.wins[1]} />
              </div>

              <div className={styles.comboRow}>
                <div className={styles.comboSide}>
                  {hudP1 && hudP1.combo > 1 && <span className={styles.combo}>{hudP1.combo}<i>连击</i></span>}
                </div>
                <div className={`${styles.comboSide} ${styles.comboSideRight}`}>
                  {hudP2 && hudP2.combo > 1 && <span className={styles.combo}>{hudP2.combo}<i>连击</i></span>}
                </div>
              </div>

              <div className={styles.meters}>
                <Meter side="left" hud={hud.p1} def={p1Def} />
                <Meter side="right" hud={hud.p2} def={p2Def} />
              </div>
            </div>

            {calloutVisible && (
              <div
                key={`${hud.callout}-${hud.calloutTimer > 60 ? "in" : hud.calloutTimer}`}
                className={`${styles.callout} ${hud.calloutTone === "warn" ? styles.calloutWarn : ""} ${
                  hud.calloutTone === "win" ? styles.calloutWin : ""
                }`}
              >
                {hud.callout}
              </div>
            )}

            {bannerVisible && hud.bannerTone && (
              <div
                className={styles.banner}
                style={{
                  background: `linear-gradient(90deg, transparent, ${characters[hud.bannerTone].colors.glow}22 20%, ${characters[hud.bannerTone].colors.glow}44 50%, ${characters[hud.bannerTone].colors.glow}22 80%, transparent)`,
                }}
              >
                <span style={{ color: characters[hud.bannerTone].colors.glow }}>{hud.banner}</span>
              </div>
            )}
          </>
        )}

        {screen === "select" && (
          <div className={styles.select}>
            <header className={styles.selectHead}>
              <p className={styles.eyebrow}>SHADOW NINJA DUEL</p>
              <h2>影忍对决</h2>
              <p className={styles.sub}>原创忍者 · 帧级格斗 · 三局两胜。选两名忍者，试探、拆招、攒查克拉，用忍术与奥义终结对手。</p>
            </header>

            <div className={styles.pickers}>
              <section className={`${styles.picker} ${slot === 0 ? styles.pickerActive : ""}`} onPointerEnter={() => setSlot(0)}>
                <div className={styles.pickerHead}>
                  <span className={styles.sideTag}>P1</span>
                  <span>{p1Def.name}</span>
                  <span className={styles.pickerTitle}>{p1Def.title}</span>
                </div>
                <div className={styles.cardRow}>
                  {characterList.map((def) => (
                    <button
                      key={def.id}
                      type="button"
                      onClick={() => {
                        updateConfig({ p1: def.id });
                        playSfx("select");
                      }}
                      className={`${styles.card} ${config.p1 === def.id ? styles.cardOn : ""}`}
                      style={{ "--glow": def.colors.glow, "--accent": def.colors.trim } as CSSProperties}
                    >
                      <span className={styles.cardName}>{def.name}</span>
                      <span className={styles.cardStyle}>{def.style}</span>
                    </button>
                  ))}
                </div>
                <StatBar label="体魄" value={(p1Def.maxHp / 220) * 100} />
                <StatBar label="迅捷" value={(p1Def.walkSpeed / 4.1) * 100} />
                <StatBar label="重量" value={(p1Def.weight / 1.25) * 100} />
                <p className={styles.blurb}>{p1Def.blurb}</p>
                <SpecialKeys side={0} />
              </section>

              <div className={styles.vs}>VS</div>

              <section className={`${styles.picker} ${slot === 1 ? styles.pickerActive : ""}`} onPointerEnter={() => setSlot(1)}>
                <div className={styles.pickerHead}>
                  <span className={styles.sideTag}>P2</span>
                  <span>{p2Def.name}</span>
                  <span className={styles.pickerTitle}>{p2Def.title}</span>
                </div>
                <div className={styles.cardRow}>
                  {characterList.map((def) => (
                    <button
                      key={def.id}
                      type="button"
                      onClick={() => {
                        updateConfig({ p2: def.id });
                        playSfx("select");
                      }}
                      className={`${styles.card} ${config.p2 === def.id ? styles.cardOn : ""}`}
                      style={{ "--glow": def.colors.glow, "--accent": def.colors.trim } as CSSProperties}
                    >
                      <span className={styles.cardName}>{def.name}</span>
                      <span className={styles.cardStyle}>{def.style}</span>
                    </button>
                  ))}
                </div>
                <StatBar label="体魄" value={(p2Def.maxHp / 220) * 100} />
                <StatBar label="迅捷" value={(p2Def.walkSpeed / 4.1) * 100} />
                <StatBar label="重量" value={(p2Def.weight / 1.25) * 100} />
                <p className={styles.blurb}>{p2Def.blurb}</p>
                <SpecialKeys side={1} />
              </section>
            </div>

            <div className={styles.options}>
              <div className={styles.segGroup} role="group" aria-label="对战模式">
                <button
                  type="button"
                  className={`${styles.seg} ${config.mode === "cpu" ? styles.segOn : ""}`}
                  onClick={() => {
                    updateConfig({ mode: "cpu" });
                    playSfx("select");
                  }}
                >
                  单人挑战
                </button>
                <button
                  type="button"
                  className={`${styles.seg} ${config.mode === "local" ? styles.segOn : ""}`}
                  onClick={() => {
                    updateConfig({ mode: "local" });
                    playSfx("select");
                  }}
                >
                  双人同屏
                </button>
              </div>

              <div className={styles.segGroup} role="group" aria-label="难度">
                {([1, 2, 3] as Difficulty[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`${styles.seg} ${config.difficulty === level ? styles.segOn : ""}`}
                    onClick={() => {
                      updateConfig({ difficulty: level });
                      playSfx("select");
                    }}
                    disabled={config.mode === "local"}
                  >
                    {DIFFICULTY_LABEL[level]}
                  </button>
                ))}
              </div>

              <button type="button" className={styles.start} onClick={startMatch}>
                开始对决
              </button>
            </div>

            <p className={styles.tip}>
              提示：重攻击可破防，防御会消耗护盾，查克拉攒满时按奥义可直接终结。当前最高分 {bestScore.toLocaleString("zh-CN")}。
            </p>
          </div>
        )}

        {screen === "fight" && !result && (
          <div className={styles.toolbar}>
            <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? "继续" : "暂停"}>
              {paused ? "继续" : "暂停"}
            </button>
            <button type="button" onClick={toggleFullscreen} aria-label="全屏">
              {isFull ? "退出全屏" : "全屏"}
            </button>
            <button type="button" onClick={toggleMute} aria-label="静音">
              {muteState ? "开声音" : "静音"}
            </button>
          </div>
        )}

        {paused && !result && screen === "fight" && (
          <div className={styles.overlay}>
            <div className={styles.panelSmall}>
              <h3>已暂停</h3>
              <p>按 Esc 或点击继续回到战斗。</p>
              <div className={styles.panelActions}>
                <button type="button" className={styles.primaryBtn} onClick={() => setPaused(false)}>
                  继续
                </button>
                <button type="button" className={styles.ghostBtn} onClick={backToSelect}>
                  更换角色
                </button>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className={styles.overlay}>
            <div className={styles.panel}>
              <p className={styles.resultEyebrow}>{result.win ? "MATCH WIN" : "MATCH LOSE"}</p>
              <h3 className={result.win ? styles.resultWin : styles.resultLose}>{result.title}</h3>
              <div className={styles.resultGrid}>
                <div>
                  <span>比分</span>
                  <strong>
                    {result.wins[0]} : {result.wins[1]}
                  </strong>
                </div>
                <div>
                  <span>最高连击</span>
                  <strong>{result.maxCombo}</strong>
                </div>
                <div>
                  <span>本局得分</span>
                  <strong>{result.score.toLocaleString("zh-CN")}</strong>
                </div>
                <div>
                  <span>历史最高</span>
                  <strong>{Math.max(bestScore, result.score).toLocaleString("zh-CN")}</strong>
                </div>
              </div>
              {result.perfect && <p className={styles.perfect}>完胜：一局未失，连击压制</p>}
              <div className={styles.panelActions}>
                <button type="button" className={styles.primaryBtn} onClick={restart}>
                  再战一局
                </button>
                <button type="button" className={styles.ghostBtn} onClick={backToSelect}>
                  更换角色
                </button>
              </div>
              <p className={styles.hintLine}>按 Enter 直接再战</p>
            </div>
          </div>
        )}

        {screen === "fight" && (
          <div className={styles.touch}>
            <div className={styles.touchLeft}>
              <button type="button" className={`${styles.pad} ${styles.padUp}`} aria-label="跳跃" {...holdProps(0, "up")}>
                ↑
              </button>
              <button type="button" className={`${styles.pad} ${styles.padLeft}`} aria-label="左移" {...holdProps(0, "left")}>
                ←
              </button>
              <button type="button" className={`${styles.pad} ${styles.padRight}`} aria-label="右移" {...holdProps(0, "right")}>
                →
              </button>
              <button type="button" className={`${styles.pad} ${styles.padDown}`} aria-label="蹲下" {...holdProps(0, "down")}>
                ↓
              </button>
            </div>
            <div className={styles.touchRight}>
              <button type="button" className={`${styles.pad} ${styles.padGuard}`} aria-label="防御" {...holdProps(0, "guard")}>
                盾
              </button>
              <button type="button" className={`${styles.pad} ${styles.padLight}`} aria-label="轻攻击" {...holdProps(0, "light")}>
                轻
              </button>
              <button type="button" className={`${styles.pad} ${styles.padHeavy}`} aria-label="重攻击" {...holdProps(0, "heavy")}>
                重
              </button>
              <button type="button" className={`${styles.pad} ${styles.padSpecial}`} aria-label="忍术" {...holdProps(0, "special")}>
                术
              </button>
              <button type="button" className={`${styles.pad} ${styles.padSuper}`} aria-label="奥义" {...holdProps(0, "super")}>
                奥
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

