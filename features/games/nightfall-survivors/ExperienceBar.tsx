import styles from "./ExperienceBar.module.css";

type Props = { level: number; xp: number; nextXp: number; waveName: string };

export function ExperienceBar({ level, xp, nextXp, waveName }: Props) {
  const progress = Math.min(100, (xp / nextXp) * 100);
  return (
    <div className={styles.wrap} aria-label={`经验 ${xp}/${nextXp}`}>
      <span>LV.{level}</span>
      <i><b style={{ width: `${progress}%` }} /></i>
      <strong>{xp}/{nextXp}</strong>
      <em>{waveName}</em>
    </div>
  );
}
