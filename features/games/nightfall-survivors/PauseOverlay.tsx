import styles from "./PauseOverlay.module.css";

type Props = {
  paused: boolean;
  onToggle: () => void;
};

export function PauseOverlay({ paused, onToggle }: Props) {
  return (
    <>
      <button className={styles.pauseButton} onClick={onToggle} aria-label={paused ? "继续游戏" : "暂停游戏"}>
        {paused ? "▶" : "Ⅱ"}
      </button>
      {paused && (
        <div className={styles.overlay} role="status" aria-label="游戏已暂停">
          <span>PAUSED</span>
          <h3>永夜暂歇</h3>
          <p>战斗、计时和敌人行动均已暂停。</p>
          <button onClick={onToggle}>继续游戏</button>
          <small>按 P 也可以继续</small>
        </div>
      )}
    </>
  );
}
