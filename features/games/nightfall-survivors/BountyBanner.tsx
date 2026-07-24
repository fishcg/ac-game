import styles from "./BountyBanner.module.css";

export function BountyBanner({ name, remaining }: { name: string | null; remaining: number }) {
  if (!name || remaining <= 0) return null;
  const progress = Math.min(100, (remaining / 30) * 100);
  return (
    <div className={styles.banner} role="status">
      <div><span>BOUNTY HUNT</span><strong>{name}</strong></div>
      <em>{Math.ceil(remaining)}s</em>
      <i><b style={{ width: `${progress}%` }} /></i>
      <small>击败金色精英，获得主动技能或大量经验</small>
    </div>
  );
}
