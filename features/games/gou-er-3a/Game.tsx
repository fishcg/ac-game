"use client";

import { useEffect, useRef, useState } from "react";

import { gameAudio } from "@/lib/audio/gameAudio";

import type { MiniGameProps } from "../types";
import { connectGame, type GameBridge, type GameScreen } from "./bridge";
import { formatScore } from "./rules";

import styles from "./GouEr3a.module.css";

const GAME_URL = "/games/gou-er-3a/index.html";

export function GouEr3a({ bestScore, onScore }: MiniGameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<GameBridge | null>(null);
  const mutedRef = useRef(false);
  const onScoreRef = useRef(onScore);
  const [loaded, setLoaded] = useState(false);
  const [muted, setMuted] = useState(() => gameAudio.isMuted());
  const [screen, setScreen] = useState<GameScreen>("none");
  const [earned, setEarned] = useState<number | null>(null);

  useEffect(() => {
    onScoreRef.current = onScore;
  }, [onScore]);

  useEffect(() => gameAudio.subscribe(setMuted), []);

  useEffect(() => {
    mutedRef.current = muted;
    bridgeRef.current?.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let cancelled = false;

    const connect = () => {
      if (cancelled || !iframeRef.current) return;
      bridgeRef.current?.dispose();
      bridgeRef.current = connectGame(iframeRef.current, {
        initialMuted: mutedRef.current,
        onScreen: (next) => {
          setScreen(next);
          if (next !== "complete") setEarned(null);
        },
        onComplete: ({ score }) => {
          setEarned(score);
          onScoreRef.current(score);
        },
      });
      setLoaded(true);
    };

    const handleLoad = () => {
      let path = "";
      try {
        path = iframe.contentWindow?.location.pathname ?? "";
      } catch {
        return;
      }
      if (iframe.contentDocument?.readyState !== "complete" || path !== "/games/gou-er-3a/index.html") return;
      connect();
    };

    iframe.addEventListener("load", handleLoad);
    handleLoad();

    return () => {
      cancelled = true;
      iframe.removeEventListener("load", handleLoad);
      bridgeRef.current?.dispose();
      bridgeRef.current = null;
    };
  }, []);

  return (
    <div className={styles.stage}>
      <iframe
        ref={iframeRef}
        className={styles.frame}
        src={GAME_URL}
        title="狗耳3A大作"
        allow="fullscreen; autoplay; gamepad"
        allowFullScreen
      />
      <div className={styles.loading} data-hidden={loaded ? "true" : "false"} aria-hidden={loaded}>
        <div className={styles.loadingInner}>
          <i className={styles.spinner} aria-hidden="true" />
          <span className={styles.loadingText}>正在装载狗耳港区</span>
          <span className={styles.loadingSub}>B4-0271 · 05:42</span>
        </div>
      </div>
      {screen === "complete" && earned !== null && (
        <div className={styles.score} role="status">
          <span className={styles.scoreLabel}>行动积分</span>
          <strong className={styles.scoreValue}>{formatScore(earned)}</strong>
          <span className={styles.scoreBest}>平台最高 {formatScore(Math.max(bestScore, earned))}</span>
        </div>
      )}
    </div>
  );
}
