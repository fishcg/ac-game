"use client";

import { useEffect, useRef, useState } from "react";
import type { MiniGameProps } from "../types";
import { MOVE_FUEL, WEAPONS, WEAPON_ORDER } from "./data";
import { WormFrontEngine } from "./WormFrontEngine";
import type { WeaponId, WormGameStatus, WormHud } from "./types";
import styles from "./WormFront.module.css";

const INITIAL_HUD: WormHud = {
  status: "idle", phase: "intro", activeTeam: "player", activeName: "青团", turn: 1, turnTime: 24, wind: 0,
  power: 0.38, charging: false, selectedWeapon: "bazooka", inventory: { bazooka: -1, grenade: 3, cluster: 2, airstrike: 1 },
  playerHealth: 300, enemyHealth: 300, playerAlive: 3, enemyAlive: 3, moveFuel: MOVE_FUEL, score: 0, aimDegrees: 41, mapName: "苔风牧场", notice: "准备战斗",
};

export function WormFront({ bestScore, onScore }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<WormFrontEngine | null>(null);
  const scoreRef = useRef(onScore);
  const statusRef = useRef<WormGameStatus>("idle");
  const [status, setStatus] = useState<WormGameStatus>("idle");
  const [hud, setHud] = useState<WormHud>(INITIAL_HUD);
  const [resultMessage, setResultMessage] = useState("");

  useEffect(() => { scoreRef.current = onScore; }, [onScore]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new WormFrontEngine(canvas, {
      onHud: setHud,
      onStatus: (next, score, message) => {
        statusRef.current = next;
        setStatus(next);
        setResultMessage(message);
        if (next === "won" || next === "lost") scoreRef.current(score);
      },
    });
    engineRef.current = engine;

    const resize = () => engine.resize();
    const keyDown = (event: KeyboardEvent) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
      if (event.repeat && ["Space", "KeyW", "KeyP"].includes(event.code)) return;
      if (event.code === "KeyA" || event.code === "ArrowLeft") engine.setMove(-1);
      if (event.code === "KeyD" || event.code === "ArrowRight") engine.setMove(1);
      if (event.code === "KeyW") engine.jump();
      if (event.code === "ArrowUp") engine.adjustAim(1);
      if (event.code === "ArrowDown") engine.adjustAim(-1);
      if (event.code === "Space") engine.beginCharge();
      if (event.code === "KeyP") engine.togglePause();
      if (event.code === "Digit1") engine.selectWeapon("bazooka");
      if (event.code === "Digit2") engine.selectWeapon("grenade");
      if (event.code === "Digit3") engine.selectWeapon("cluster");
      if (event.code === "Digit4") engine.selectWeapon("airstrike");
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "KeyA" || event.code === "ArrowLeft" || event.code === "KeyD" || event.code === "ArrowRight") engine.setMove(0);
      if (event.code === "Space") engine.releaseCharge();
    };
    const pointerUp = () => engine.releaseCharge();
    const visibility = () => { if (document.hidden && statusRef.current === "playing") engine.togglePause(); };
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", keyDown, { passive: false });
    window.addEventListener("keyup", keyUp);
    window.addEventListener("pointerup", pointerUp);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      engine.destroy();
      engineRef.current = null;
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("pointerup", pointerUp);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  const worldPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * 960, y: (event.clientY - rect.top) / rect.height * 540 };
  };
  const aim = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = worldPoint(event);
    engineRef.current?.aimAt(point.x, point.y);
  };
  const pointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    aim(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    engineRef.current?.beginCharge();
  };
  const start = () => engineRef.current?.start();
  const moveLeft = (event: React.PointerEvent<HTMLButtonElement>) => { event.currentTarget.setPointerCapture(event.pointerId); engineRef.current?.setMove(-1); };
  const moveRight = (event: React.PointerEvent<HTMLButtonElement>) => { event.currentTarget.setPointerCapture(event.pointerId); engineRef.current?.setMove(1); };
  const stopMove = () => engineRef.current?.setMove(0);
  const chooseWeapon = (weapon: WeaponId) => engineRef.current?.selectWeapon(weapon);

  const playerPercent = Math.max(0, hud.playerHealth / 300 * 100);
  const enemyPercent = Math.max(0, hud.enemyHealth / 300 * 100);
  const windDirection = hud.wind === 0 ? "无风" : hud.wind > 0 ? "向右" : "向左";

  return (
    <div className={styles.game}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        aria-label="荒丘虫兵可破坏地形战场"
        onPointerMove={aim}
        onPointerDown={pointerDown}
        onPointerUp={() => engineRef.current?.releaseCharge()}
        onContextMenu={(event) => event.preventDefault()}
      />

      {status !== "idle" && <>
        <div className={styles.topHud}>
          <div className={`${styles.teamPanel} ${styles.playerPanel}`}>
            <span className={styles.teamBadge}>青团小队</span>
            <strong>{hud.playerHealth}<small> / 300 HP</small></strong>
            <i className={styles.healthTrack}><b style={{ width: `${playerPercent}%` }} /></i>
            <em>{hud.playerAlive} 名存活</em>
          </div>
          <div className={styles.turnPanel}>
            <span>回合 {hud.turn} / 20</span>
            <strong className={hud.turnTime <= 6 ? styles.dangerTime : ""}>{Math.ceil(hud.turnTime)}</strong>
            <small>{hud.activeTeam === "player" ? "你的行动" : "敌方行动"} · {hud.activeName}</small>
          </div>
          <div className={`${styles.teamPanel} ${styles.enemyPanel}`}>
            <span className={styles.teamBadge}>红椒军团</span>
            <strong>{hud.enemyHealth}<small> / 300 HP</small></strong>
            <i className={styles.healthTrack}><b style={{ width: `${enemyPercent}%` }} /></i>
            <em>{hud.enemyAlive} 名存活</em>
          </div>
          <button className={styles.pauseButton} onClick={() => engineRef.current?.togglePause()} aria-label={status === "paused" ? "继续战斗" : "暂停战斗"}>{status === "paused" ? "▶" : "Ⅱ"}</button>
        </div>

        <div className={styles.windPanel}>
          <span className={styles.mapName}>{hud.mapName}</span>
          <span>风力</span>
          <i className={hud.wind < 0 ? styles.windLeft : ""}>➜</i>
          <strong>{windDirection} {Math.abs(hud.wind)}</strong>
        </div>
        <div className={styles.notice}>{hud.notice}</div>
        <div className={styles.score}>战绩 <strong>{hud.score.toLocaleString()}</strong></div>

        <div className={styles.bottomHud}>
          <div className={styles.mobility}>
            <span>行动力</span>
            <i><b style={{ width: `${hud.moveFuel / MOVE_FUEL * 100}%` }} /></i>
          </div>
          <div className={styles.weaponBar} role="group" aria-label="武器选择">
            {WEAPON_ORDER.map((weapon, index) => {
              const definition = WEAPONS[weapon];
              const stock = hud.inventory[weapon];
              return <button key={weapon} disabled={stock === 0 || hud.activeTeam !== "player"} className={hud.selectedWeapon === weapon ? styles.selectedWeapon : ""} onClick={() => chooseWeapon(weapon)} title={definition.description}>
                <kbd>{index + 1}</kbd><i>{definition.icon}</i><span>{definition.name}</span><small>{stock < 0 ? "∞" : `×${stock}`}</small>
              </button>;
            })}
          </div>
          <div className={styles.aimReadout}><span>仰角</span><strong>{hud.aimDegrees}°</strong></div>
        </div>

        <div className={`${styles.powerPanel} ${hud.charging ? styles.powerCharging : ""}`}>
          <span>发射力度</span>
          <i><b style={{ width: `${hud.power * 100}%` }} /></i>
          <strong>{Math.round(hud.power * 100)}%</strong>
        </div>

        <div className={styles.touchControls}>
          <div className={styles.touchMove}>
            <button onPointerDown={moveLeft} onPointerUp={stopMove} onPointerCancel={stopMove} aria-label="向左移动">◀</button>
            <button onClick={() => engineRef.current?.jump()} aria-label="跳跃">跳</button>
            <button onPointerDown={moveRight} onPointerUp={stopMove} onPointerCancel={stopMove} aria-label="向右移动">▶</button>
          </div>
          <div className={styles.touchAim}>
            <button onPointerDown={() => engineRef.current?.adjustAim(1)} aria-label="抬高准星">▲</button>
            <button onPointerDown={() => engineRef.current?.adjustAim(-1)} aria-label="降低准星">▼</button>
            <button className={styles.fireButton} onPointerDown={() => engineRef.current?.beginCharge()} onPointerUp={() => engineRef.current?.releaseCharge()} onPointerCancel={() => engineRef.current?.releaseCharge()} aria-label="按住蓄力，松开发射">FIRE</button>
          </div>
        </div>
      </>}

      {status === "idle" && <div className={styles.overlay}>
        <div className={styles.titleArt}><i className={styles.heroWorm}><b /><b /></i><span>VS</span><i className={`${styles.heroWorm} ${styles.enemyWorm}`}><b /><b /></i></div>
        <span className={styles.kicker}>回合制物理炮战</span>
        <h3>荒丘虫兵</h3>
        <p>带领三名虫兵观察风向、调整抛物线并炸穿泥土与建筑。山脊、洞穴和村落每局都会重新生成，先全灭对手的一方获胜。</p>
        <div className={styles.features}>
          <span><b>01</b> 随机复杂地图</span><span><b>02</b> 建筑可炸毁</span><span><b>03</b> 四种战术武器</span>
        </div>
        <div className={styles.instructions}><span>A/D 移动 · W 跳跃</span><span>鼠标 / ↑↓ 瞄准</span><span>按住空格蓄力，松开发射</span></div>
        <button className={styles.primaryButton} onClick={start}>吹响开战号角</button>
        <small className={styles.credit}>爆炸粒子：Kenney Particle Pack · CC0</small>
      </div>}

      {status === "paused" && <div className={`${styles.overlay} ${styles.pauseOverlay}`}>
        <span className={styles.kicker}>战场暂停</span><h3>先喘口气</h3><p>倒计时、弹道、AI 和所有物理状态均已冻结。</p>
        <button className={styles.primaryButton} onClick={() => engineRef.current?.togglePause()}>继续战斗</button>
      </div>}

      {(status === "won" || status === "lost") && <div className={`${styles.overlay} ${styles.resultOverlay}`}>
        <span className={styles.resultMark}>{status === "won" ? "✦" : "☁"}</span>
        <span className={styles.kicker}>{status === "won" ? "荒丘保卫成功" : "整队待命重来"}</span>
        <h3>{status === "won" ? "青团小队获胜！" : "红椒军团占领荒丘"}</h3>
        <p>{resultMessage} 本局获得 <strong>{hud.score.toLocaleString()}</strong> 分，历史最高 {Math.max(bestScore, hud.score).toLocaleString()}。</p>
        <button className={styles.primaryButton} onClick={start}>再战一局</button>
      </div>}
    </div>
  );
}
