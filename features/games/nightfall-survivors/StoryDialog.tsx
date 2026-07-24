import { useState } from "react";
import type { StoryScene } from "./stages";
import styles from "./StoryDialog.module.css";

type Props = { scene: StoryScene; onComplete: () => void };

export function StoryDialog({ scene, onComplete }: Props) {
  const [index, setIndex] = useState(0);
  const line = scene.lines[index]; const last = index >= scene.lines.length - 1;
  return <div className={styles.overlay} role="dialog" aria-label={scene.title}>
    <div className={styles.scene}>
      <span>{scene.eyebrow}</span>
      <h3>{scene.title}</h3>
      <div className={styles.line}>
        <strong>{line.speaker}</strong>
        <p>{line.text}</p>
      </div>
      <footer><small>{index + 1} / {scene.lines.length}</small><button onClick={() => last ? onComplete() : setIndex((value) => value + 1)}>{last ? "继续前进" : "下一句"}<i>›</i></button></footer>
    </div>
  </div>;
}
