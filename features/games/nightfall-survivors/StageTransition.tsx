import type { CSSProperties } from "react";
import type { StageTransitionInfo } from "./stages";
import styles from "./StageTransition.module.css";

export function StageTransition({ transition }: { transition: StageTransitionInfo }) {
  const colors = {
    "--stage-from": transition.from.base,
    "--stage-to": transition.to.base,
    "--stage-accent": transition.to.accent,
  } as CSSProperties;

  return <div className={styles.overlay} style={colors} role="status" aria-label={`正在前往${transition.to.name}`}>
    <div className={styles.wipe} />
    <div className={styles.content}>
      <small>STAGE CLEAR</small>
      <span>{transition.from.chapter} · {transition.from.name}</span>
      <i>◆</i>
      <em>NEXT DESTINATION</em>
      <strong>{transition.to.chapter} · {transition.to.name}</strong>
      <p>{transition.to.subtitle}</p>
      <b><u /></b>
    </div>
  </div>;
}
