import styles from "./ComboHud.module.css";

type Props = { combo: number; comboTime: number; feverRemaining: number };

export function ComboHud({ combo, comboTime, feverRemaining }: Props) {
  if (combo < 2 && feverRemaining <= 0) return null;
  const fever = feverRemaining > 0;
  const progress = fever ? Math.min(100, (feverRemaining / 4) * 100) : Math.min(100, (comboTime / 4) * 100);
  return (
    <div className={`${styles.combo} ${fever ? styles.fever : ""}`} role="status">
      <span>{fever ? "FEVER" : "COMBO"}</span>
      <strong>{combo}<small>连杀</small></strong>
      <i><b style={{ width: `${progress}%` }} /></i>
      {fever && <em>伤害 +15% · 移速 +10%</em>}
    </div>
  );
}
