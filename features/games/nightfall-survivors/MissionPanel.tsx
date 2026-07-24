import type { MissionHud } from "./types";
import styles from "./MissionPanel.module.css";

export function MissionPanel({ missions }: { missions: MissionHud[] }) {
  const activeMissions = missions.filter((mission) => !mission.completed);
  if (activeMissions.length === 0) return null;
  return (
    <aside className={styles.panel} aria-label="局内任务">
      <header><span>MISSIONS</span><strong>局内任务</strong></header>
      <div className={styles.list}>
        {activeMissions.map((mission) => {
          const progress = Math.min(100, (mission.progress / mission.target) * 100);
          return <div key={mission.id}>
            <span><strong>{mission.name}</strong><em>{mission.progress}/{mission.target}</em></span>
            <small>{mission.description} · 奖励 {mission.reward}</small>
            <i><b style={{ width: `${progress}%` }} /></i>
          </div>;
        })}
      </div>
    </aside>
  );
}
