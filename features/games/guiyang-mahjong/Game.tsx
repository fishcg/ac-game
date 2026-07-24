"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { MiniGameProps } from "../types";
import { createPlayers, RULE_SECTIONS } from "./data";
import { GuiyangMahjongEngine } from "./Engine";
import { guiyangMahjongAudio } from "./audio";
import { MAHJONG_ASSETS } from "./assets";
import { MahjongTable } from "./Table";
import { MahjongTile } from "./MahjongTile";
import { tileFromKey } from "./rules";
import type { MahjongState } from "./types";
import styles from "./GuiyangMahjong.module.css";

const INITIAL: MahjongState = {
  phase: "idle", resumePhase: null, round: 0, dealer: 0, current: 0, players: createPlayers(), wall: [],
  lastDiscard: null, selectedTileId: null, drawnTileId: null, actions: [], beanEvents: [], charge: null,
  effect: null, message: "准备开桌", turnNumber: 0, settlement: null,
};

export function GuiyangMahjong({ bestScore, onScore }: MiniGameProps) {
  const engineRef = useRef<GuiyangMahjongEngine | null>(null);
  const scoreRef = useRef(onScore);
  const pausedForRules = useRef(false);
  const [state, setState] = useState(INITIAL);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => { scoreRef.current = onScore; }, [onScore]);

  useEffect(() => {
    const engine = new GuiyangMahjongEngine({
      onState: setState,
      onSound: (sound) => guiyangMahjongAudio.play(sound),
      onScore: (score) => scoreRef.current(score),
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      guiyangMahjongAudio.stopBgm();
    };
  }, []);

  useEffect(() => {
    guiyangMahjongAudio.setPaused(state.phase === "paused");
  }, [state.phase]);

  const start = () => {
    guiyangMahjongAudio.startBgm();
    engineRef.current?.start();
  };
  const openRules = () => {
    const active = ["dealing", "player-turn", "ai-turn", "response"].includes(state.phase);
    pausedForRules.current = active;
    if (active) engineRef.current?.togglePause();
    setShowRules(true);
  };
  const closeRules = () => {
    setShowRules(false);
    if (pausedForRules.current && state.phase === "paused") engineRef.current?.togglePause();
    pausedForRules.current = false;
  };
  const ranking = [...state.players].sort((left, right) => right.score - left.score);
  const settlement = state.settlement;

  return (
    <div className={styles.game}>
      <Image className={styles.room} src={MAHJONG_ASSETS.room} alt="贵阳夜景牌馆" fill sizes="100vw" priority />
      <div className={styles.roomShade} />

      {state.phase !== "idle" && (
        <>
          <MahjongTable
            state={state}
            onSelect={(id) => engineRef.current?.selectTile(id)}
            onDiscard={() => engineRef.current?.discardSelected()}
            onAction={(kind, tile) => engineRef.current?.act(kind, tile)}
          />
          <div className={styles.utilityButtons}>
            <button onClick={openRules}>规则</button>
            <button onClick={() => engineRef.current?.togglePause()}>{state.phase === "paused" ? "继续" : "暂停"}</button>
          </div>
        </>
      )}

      {state.phase === "idle" && (
        <div className={styles.intro}>
          <div className={styles.introMark}><span>黔</span><i>🐓</i></div>
          <small>GUIYANG TABLE</small>
          <h3>贵阳捉鸡麻将</h3>
          <p>四人本地对局。做豆拿通行证，保鸡、冲锋、翻金鸡，在四局积分赛中坐上黔城牌王。</p>
          <div className={styles.introRules}>
            <span><b>108</b>张序数牌</span><span><b>不可吃</b>可碰杠</span><span><b>四局</b>累计积分</span>
          </div>
          <div className={styles.introActions}><button onClick={start}>入座开牌</button><button onClick={openRules}>先看规则</button></div>
          <em>原创 MIDI 风格 BGM《黔城牌局》</em>
        </div>
      )}

      {state.phase === "paused" && !showRules && (
        <div className={styles.modalBackdrop}>
          <div className={styles.pausePanel}><span>Ⅱ</span><h3>牌局暂停</h3><p>AI 思考与回合计时均已冻结。</p><button onClick={() => engineRef.current?.togglePause()}>继续牌局</button></div>
        </div>
      )}

      {state.phase === "round-end" && settlement && (
        <div className={styles.modalBackdrop}>
          <div className={styles.settlement}>
            <div className={styles.chickenReveal}>
              <div><small>翻牌</small><MahjongTile tile={settlement.indicator} /></div>
              <span>➜</span>
              <div><small>本局鸡牌</small><MahjongTile tile={tileFromKey(settlement.chickenKey)} /></div>
              <i>🐓</i>
            </div>
            <small>第 {state.round} 局结算</small>
            <h3>{settlement.title}</h3>
            <p>{settlement.subtitle}</p>
            <div className={styles.scoreRows}>
              {state.players.map((player) => (
                <div key={player.seat} className={settlement.winner === player.seat ? styles.scoreWinner : ""}>
                  <span>{player.avatar}</span><b>{player.name}</b><em>{settlement.patterns.find((item) => item.seat === player.seat)?.pattern ?? (player.ready ? "听牌" : "未听")}</em>
                  <strong className={settlement.deltas[player.seat] >= 0 ? styles.scoreUp : styles.scoreDown}>{settlement.deltas[player.seat] >= 0 ? "+" : ""}{settlement.deltas[player.seat]}</strong>
                  <small>累计 {player.score}</small>
                </div>
              ))}
            </div>
            <details><summary>查看 {settlement.lines.length} 条结算明细</summary>{settlement.lines.slice(0, 18).map((line, index) => <p key={`${line.label}-${index}`}>{state.players[line.from].name} → {state.players[line.to].name}　{line.label} {line.amount}</p>)}</details>
            <button onClick={() => engineRef.current?.advance()}>{state.round >= 4 ? "查看总排名" : "下一局"}</button>
          </div>
        </div>
      )}

      {state.phase === "match-end" && (
        <div className={styles.modalBackdrop}>
          <div className={styles.matchEnd}>
            <span className={styles.crown}>♛</span><small>四局积分赛</small><h3>{ranking[0].seat === 0 ? "黔城牌王！" : `${ranking[0].name}拔得头筹`}</h3>
            <div className={styles.ranking}>{ranking.map((player, index) => <div key={player.seat}><i>{index + 1}</i><span>{player.avatar}</span><b>{player.name}</b><strong>{player.score} 分</strong></div>)}</div>
            <p>本场成绩已提交。历史最高 {Math.max(bestScore, Math.max(0, state.players[0].score * 100)).toLocaleString()}。</p>
            <button onClick={() => engineRef.current?.advance()}>再开一桌</button>
          </div>
        </div>
      )}

      {showRules && (
        <div className={styles.modalBackdrop}>
          <div className={styles.rulesPanel} role="dialog" aria-modal="true" aria-label="贵阳捉鸡麻将规则">
            <button className={styles.closeRules} onClick={closeRules} aria-label="关闭规则">×</button>
            <small>本桌房规</small><h3>贵阳捉鸡 · 完整规则</h3>
            <div>{RULE_SECTIONS.map((section, index) => <article key={section.title}><i>{index + 1}</i><span><b>{section.title}</b><p>{section.text}</p></span></article>)}</div>
            <button className={styles.rulesConfirm} onClick={closeRules}>明白了</button>
          </div>
        </div>
      )}
    </div>
  );
}
