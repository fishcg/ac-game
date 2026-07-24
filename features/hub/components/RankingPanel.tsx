import { TrophyIcon } from "@/components/ui/Icons";
import type { UserRankingEntry } from "@/lib/game-sdk/types";
import styles from "./RankingPanel.module.css";

export function RankingPanel({ ranking, currentUserId }: { ranking: UserRankingEntry[]; currentUserId: string }) {
  const currentIndex = ranking.findIndex((entry) => entry.userId === currentUserId);

  return (
    <section className={styles.section} id="ranking">
      <div className={styles.heading}>
        <div><span className="section-kicker"><i /> LEADERBOARD</span><h2>玩家排名</h2><p>各游戏历史最高分的总和排名</p></div>
        <span className={styles.localBadge}>本地榜</span>
      </div>
      <div className={styles.board}>
        <div className={styles.tableHead}><span>排名</span><span>玩家</span><span>玩过</span><span>总积分</span></div>
        <div className={styles.rows}>
          {ranking.slice(0, 10).map((entry, index) => (
            <div className={`${styles.row} ${entry.userId === currentUserId ? styles.current : ""}`} key={entry.userId}>
              <span className={`${styles.rank} ${index < 3 ? styles[`top${index + 1}`] : ""}`}>{index < 3 ? <TrophyIcon size={16} /> : index + 1}</span>
              <span className={styles.player}><i>{entry.displayName.slice(0, 1).toUpperCase()}</i><span><strong>{entry.displayName}</strong>{entry.userId === currentUserId && <small>你</small>}</span></span>
              <span className={styles.games}>{entry.gamesPlayed} 款</span>
              <strong className={styles.score}>{entry.totalScore.toLocaleString("zh-CN")}</strong>
            </div>
          ))}
        </div>
        {ranking.length === 0 && <div className={styles.empty}>完成一局游戏后，你的名字会出现在这里。</div>}
      </div>
      <div className={styles.note}><span>当前排名：{currentIndex >= 0 ? `第 ${currentIndex + 1} 名` : "暂无"}</span><span>排行榜数据仅保存在当前浏览器，接入账号服务后可升级为全站榜。</span></div>
    </section>
  );
}
