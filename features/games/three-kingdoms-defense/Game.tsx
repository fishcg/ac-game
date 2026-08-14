"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DECREES, TOWERS, TOWER_UPGRADE_COST } from "./data";
import { ThreeKingdomsDefenseEngine } from "./Engine";
import type { DecreeId, DefenseHud, DefenseStatus, TowerType } from "./types";
import styles from "./Game.module.css";

type Props = { bestScore: number; onScore: (score: number) => void };

const INITIAL_HUD: DefenseHud = {
  castleHp: 20, maxCastleHp: 20, food: 520, morale: 35, score: 0, wave: 0, totalWaves: 6,
  waveName: "布置防线", enemiesAlive: 0, nextWaveIn: 8, selectedSlotId: null, selectedTower: null,
  heroCharge: 0, heroReady: false, fireReady: true, speed: 1,
  message: "先在营地上建造防御，再迎击黄巾军", bossHp: null, bossName: null,
};

const TOWER_ICON: Record<TowerType, string> = { archer: "弓", spear: "枪", catapult: "石" };

export function ThreeKingdomsDefense({ bestScore, onScore }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ThreeKingdomsDefenseEngine | null>(null);
  const submittedRef = useRef(false);
  const [status, setStatus] = useState<DefenseStatus>("idle");
  const [hud, setHud] = useState(INITIAL_HUD);
  const [result, setResult] = useState({ score: 0, message: "" });
  const [decreeChoices, setDecreeChoices] = useState<DecreeId[]>([]);

  const handleStatus = useCallback((next: DefenseStatus, score: number, message: string) => {
    setStatus(next);
    if (next === "won" || next === "lost") {
      setResult({ score, message });
      if (!submittedRef.current) { submittedRef.current = true; onScore(score); }
    }
  }, [onScore]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new ThreeKingdomsDefenseEngine(canvas, {
      onHud: setHud,
      onStatus: handleStatus,
      onDecree: (choices) => setDecreeChoices(choices),
    });
    engineRef.current = engine;
    const resize = () => engine.resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener("resize", resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
      engine.destroy();
      engineRef.current = null;
    };
  }, [handleStatus]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "p") engineRef.current?.togglePause();
      if (event.key === " ") { event.preventDefault(); engineRef.current?.callWaveEarly(); }
      if (event.key.toLowerCase() === "q") engineRef.current?.useHeroUltimate();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);

  const start = () => {
    submittedRef.current = false;
    setDecreeChoices([]);
    setResult({ score: 0, message: "" });
    const params = new URLSearchParams(window.location.search);
    const debugWave = process.env.NODE_ENV === "development" ? Number(params.get("tkWave")) : Number.NaN;
    engineRef.current?.start(Number.isFinite(debugWave) && debugWave >= 1 ? {
      debugWave: Math.min(5, debugWave - 1), debugFood: 5000,
      debugNoDefense: process.env.NODE_ENV === "development" && params.get("tkLose") === "1",
    } : undefined);
  };

  const selectedTowerConfig = hud.selectedTower ? TOWERS[hud.selectedTower.type] : null;
  const canShowBranch = hud.selectedTower?.level === 1;
  const upgradeCost = hud.selectedTower?.level === 1 || hud.selectedTower?.level === 2 ? TOWER_UPGRADE_COST[hud.selectedTower.level] : 0;
  const hpPercent = `${Math.max(0, hud.castleHp / hud.maxCastleHp * 100)}%`;
  const moralePercent = `${Math.max(0, hud.morale)}%`;
  const chargePercent = `${Math.max(0, hud.heroCharge)}%`;
  const title = useMemo(() => status === "won" ? "威震黄巾" : "城门陷落", [status]);

  return (
    <div className={styles.game} data-status={status}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onPointerDown={(event) => engineRef.current?.pointer(event.clientX, event.clientY)}
        aria-label="三国烽火守城战场"
      />

      <div className={styles.topHud}>
        <div className={styles.resourceCard}>
          <div className={styles.castleRow}><span>城门</span><strong>{hud.castleHp}/{hud.maxCastleHp}</strong></div>
          <div className={styles.bar}><i className={styles.hpFill} style={{ width: hpPercent }} /></div>
          <div className={styles.resourceRow}><span>🌾 {hud.food}</span><span>🔥 {hud.morale}</span><span>★ {hud.score}</span></div>
        </div>
        <div className={styles.waveCard}>
          <small>{hud.wave ? `第 ${hud.wave}/${hud.totalWaves} 波` : "备战"}</small>
          <strong>{hud.waveName}</strong>
          <span>{hud.enemiesAlive ? `敌军 ${hud.enemiesAlive}` : `来袭 ${Math.ceil(hud.nextWaveIn)}s`}</span>
        </div>
        <div className={styles.topActions}>
          <button onClick={() => engineRef.current?.setSpeed(hud.speed === 1 ? 2 : 1)} aria-label="切换游戏速度">×{hud.speed}</button>
          <button onClick={() => engineRef.current?.togglePause()} aria-label={status === "paused" ? "继续" : "暂停"}>{status === "paused" ? "▶" : "Ⅱ"}</button>
        </div>
      </div>

      {hud.bossHp !== null && (
        <div className={styles.bossHud}>
          <div><span>{hud.bossName}</span><strong>{Math.ceil(hud.bossHp * 100)}%</strong></div>
          <div className={styles.bar}><i className={styles.bossFill} style={{ width: `${hud.bossHp * 100}%` }} /></div>
        </div>
      )}

      <div className={styles.message}>{hud.message}</div>

      {hud.selectedSlotId !== null && status === "playing" && (
        <section className={styles.buildPanel} aria-label="营地建造菜单">
          <header><span>营地 {hud.selectedSlotId}</span><button onClick={() => engineRef.current?.clearSelection()} aria-label="关闭建造菜单">×</button></header>
          {!hud.selectedTower ? (
            <div className={styles.towerChoices}>
              {(Object.keys(TOWERS) as TowerType[]).map((type) => {
                const tower = TOWERS[type];
                return <button key={type} disabled={hud.food < tower.cost} onClick={() => engineRef.current?.buildTower(type)}>
                  <b>{TOWER_ICON[type]}</b><span><strong>{tower.name}</strong><small>{tower.description}</small></span><em>{tower.cost}</em>
                </button>;
              })}
            </div>
          ) : (
            <div className={styles.upgradePanel}>
              <div className={styles.towerSummary}>
                <b>{TOWER_ICON[hud.selectedTower.type]}</b>
                <span><strong>{selectedTowerConfig?.name} · LV.{hud.selectedTower.level}</strong><small>{hud.selectedTower.branch ? "专精已解锁" : selectedTowerConfig?.description}</small></span>
              </div>
              {canShowBranch && selectedTowerConfig && <div className={styles.branchChoices}>{selectedTowerConfig.branches.map((branch) => (
                <button key={branch.id} disabled={hud.food < upgradeCost} onClick={() => engineRef.current?.upgradeTower(branch.id)}>
                  <strong>{branch.name}</strong><small>{branch.description}</small><em>{upgradeCost}</em>
                </button>
              ))}</div>}
              {!canShowBranch && hud.selectedTower.level < 3 && <button className={styles.levelButton} disabled={hud.food < upgradeCost} onClick={() => engineRef.current?.upgradeTower()}>
                强化至 LV.{hud.selectedTower.level + 1} <em>{upgradeCost} 军粮</em>
              </button>}
              {hud.selectedTower.level === 3 && <div className={styles.maxLevel}>已达最高等级</div>}
              <button className={styles.sellButton} onClick={() => engineRef.current?.sellTower()}>撤除 · 返还 65%</button>
            </div>
          )}
        </section>
      )}

      <div className={styles.skillDock}>
        <button className={`${styles.skillButton} ${hud.fireReady ? styles.ready : ""}`} onClick={() => engineRef.current?.prepareFire()}>
          <b>🔥</b><span>火攻</span><small>30 士气</small>
        </button>
        <div className={styles.moraleGauge}><span>士气</span><i><b style={{ width: moralePercent }} /></i></div>
        <button className={`${styles.skillButton} ${hud.heroReady ? styles.ready : ""}`} disabled={!hud.heroReady} onClick={() => engineRef.current?.useHeroUltimate()}>
          <b>青</b><span>千军辟易</span><small>{hud.heroReady ? "可释放" : `${Math.floor(hud.heroCharge)}%`}</small>
          <i className={styles.skillCharge} style={{ width: chargePercent }} />
        </button>
      </div>

      {!hud.enemiesAlive && status === "playing" && hud.wave < hud.totalWaves && (
        <button className={styles.earlyWave} onClick={() => engineRef.current?.callWaveEarly()}>
          迎敌 <span>{Math.ceil(hud.nextWaveIn)}s</span>
        </button>
      )}

      {status === "idle" && (
        <div className={styles.overlay}>
          <div className={styles.introCard}>
            <span className={styles.eyebrow}>第一章 · 黄巾围村</span>
            <h3>三国：烽火守城</h3>
            <p>张梁率黄巾前锋直逼涿郡。用有限军粮建起弓哨、枪营与投石台，调动关羽守住六轮进攻。</p>
            <div className={styles.tutorialGrid}>
              <span><b>1</b>点击圆形营地建塔</span><span><b>2</b>按兵种克制升级</span><span><b>3</b>点军旗调动关羽</span><span><b>4</b>积攒士气发动火攻</span>
            </div>
            <button className={styles.primaryButton} onClick={start}>擂鼓迎敌</button>
            <small>最高战功 {bestScore} · 单局约 6–8 分钟</small>
          </div>
        </div>
      )}

      {status === "paused" && (
        <div className={styles.pauseActions}><button className={styles.primaryButton} onClick={() => engineRef.current?.togglePause()}>继续战斗</button><button onClick={start}>重新布阵</button></div>
      )}

      {status === "decree" && (
        <div className={styles.overlay}>
          <div className={styles.decreeCard}>
            <span className={styles.eyebrow}>主公军令 · 三选一</span><h3>重整防线</h3><p>战局已冻结，选择一项永久强化。</p>
            <div className={styles.decreeChoices}>{decreeChoices.map((id) => <button key={id} onClick={() => engineRef.current?.chooseDecree(id)}>
              <b>{DECREES[id].icon}</b><strong>{DECREES[id].name}</strong><span>{DECREES[id].description}</span>
            </button>)}</div>
          </div>
        </div>
      )}

      {(status === "won" || status === "lost") && (
        <div className={styles.overlay}>
          <div className={styles.resultCard} data-result={status}>
            <span className={styles.eyebrow}>{status === "won" ? "VICTORY" : "DEFEAT"}</span><h3>{title}</h3><p>{result.message}</p>
            <div className={styles.resultScore}><span>本局战功</span><strong>{result.score}</strong><small>历史最高 {Math.max(bestScore, result.score)}</small></div>
            <button className={styles.primaryButton} onClick={start}>再守一局</button>
          </div>
        </div>
      )}
    </div>
  );
}
