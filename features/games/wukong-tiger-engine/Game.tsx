"use client";

import { useEffect, useRef, useState } from "react";

import { gameAudio } from "@/lib/audio/gameAudio";

import type { MiniGameProps } from "../types";
import { connectWukong, type WukongBridge } from "./bridge";
import { GAME_SUBTITLE, GAME_TITLE, GAME_URL } from "./data";
import { formatDuration, formatScore, type BattleResult } from "./rules";

import styles from "./WukongTiger.module.css";

export function WukongTigerEngine({ bestScore, onScore }: MiniGameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<WukongBridge | null>(null);
  const mutedRef = useRef(false);
  const onScoreRef = useRef(onScore);
  const [loaded, setLoaded] = useState(false);
  const [muted, setMuted] = useState(() => gameAudio.isMuted());
  const [result, setResult] = useState<BattleResult | null>(null);

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
      bridgeRef.current = connectWukong(iframeRef.current, {
        initialMuted: mutedRef.current,
        onStateChange: (next) => {
          if (next === "fight") setResult(null);
        },
        onResult: (next) => {
          setResult(next);
          if (next.score > 0) onScoreRef.current(next.score);
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
      if (iframe.contentDocument?.readyState !== "complete" || !path.startsWith("/games/wukong-tiger-engine/")) return;
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
        title={GAME_TITLE}
        allow="fullscreen; autoplay; gamepad; pointer-lock"
        allowFullScreen
      />
      <div className={styles.loading} data-hidden={loaded ? "true" : "false"} aria-hidden={loaded}>
        <div className={styles.loadingInner}>
          <i className={styles.spinner} aria-hidden="true" />
          <span className={styles.loadingText}>正在进入卧虎寺</span>
          <span className={styles.loadingSub}>{GAME_SUBTITLE}</span>
        </div>
      </div>
      {result && (
        <div className={styles.score} role="status">
          <span className={styles.scoreLabel}>{result.outcome === "victory" ? "得胜" : "身死"}</span>
          <strong className={styles.scoreValue}>{formatScore(result.score)}</strong>
          <span className={styles.scoreMeta}>
            战斗评分 · 用时 {formatDuration(result.seconds)}
            {result.outcome === "defeat" && result.score === 0 ? " · 未造成伤害" : ""}
          </span>
          <span className={styles.scoreBest}>平台最高 {formatScore(Math.max(bestScore, result.score))}</span>
        </div>
      )}
    </div>
  );
}
