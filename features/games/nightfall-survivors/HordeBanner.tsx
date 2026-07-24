import styles from "./HordeBanner.module.css";

export function HordeBanner({ remaining, nextIn, index }: { remaining: number; nextIn: number; index: number }) {
  if (remaining <= 0 && nextIn > 5) return null;
  const active = remaining > 0;
  return <div className={`${styles.banner} ${active ? styles.active : ""}`} role="status">
    <strong>{active ? `第 ${index} 波怪物潮` : "怪物潮即将来袭"}</strong>
    <span>{Math.ceil(active ? remaining : nextIn)}s</span>
  </div>;
}
