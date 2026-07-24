import type { StageId } from "./types";
import styles from "./StageHud.module.css";

type Props = { index: number; count: number; id: StageId; name: string; subtitle: string; elapsed: number; duration: number; bossAt: number; bossSpawned: boolean };

function time(seconds: number) {
  const safe = Math.max(0, seconds); return `${Math.floor(safe / 60).toString().padStart(2, "0")}:${Math.floor(safe % 60).toString().padStart(2, "0")}`;
}

export function StageHud({ index, count, id, name, subtitle, elapsed, duration, bossAt, bossSpawned }: Props) {
  const progress = Math.min(1, elapsed / duration);
  return <aside className={`${styles.stage} ${styles[id]}`} aria-label="当前关卡">
    <header><span>STAGE {index + 1}/{count}</span><strong>{name}</strong><em>{subtitle}</em></header>
    <i><b style={{ width: `${progress * 100}%` }} /></i>
    <footer>{bossSpawned ? <strong>终结 Boss 已降临</strong> : <span>终结 Boss · {time(bossAt - elapsed)}</span>}<em>目标 {time(duration)}</em></footer>
  </aside>;
}
