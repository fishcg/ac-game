import type { GameInfo, GameId } from "@/config/games";
import { GameArtwork } from "@/components/ui/GameArtwork";
import { ClockIcon, GameIcon, PlayIcon, TrophyIcon } from "@/components/ui/Icons";

type Props = { recentGames: GameInfo[]; scoreCount: number; totalScore: number; getBest: (id: GameId) => number; onPlay: (game: GameInfo) => void; fallbackGame: GameInfo };

export function PlayerPanels({ recentGames, scoreCount, totalScore, getBest, onPlay, fallbackGame }: Props) {
  return (
    <section className="split-section">
      <div className="recent-panel" id="recent">
        <div className="panel-heading"><div><span className="section-kicker"><i /> CONTINUE</span><h2>继续上次的快乐</h2></div><ClockIcon /></div>
        {recentGames.length ? <div className="recent-list">{recentGames.map((game) => <button key={game.id} onClick={() => onPlay(game)}><GameArtwork type={game.art} compact /><span><strong>{game.title}</strong><small>最高分 {getBest(game.id)} · {game.category}</small></span><i><PlayIcon size={14} /></i></button>)}</div> : <div className="empty-recent"><span><GameIcon /></span><p>游玩过的游戏会出现在这里</p><button onClick={() => onPlay(fallbackGame)}>试试第一款</button></div>}
      </div>
      <div className="record-panel" id="records">
        <div className="panel-heading"><div><span className="section-kicker"><i /> YOUR STATS</span><h2>玩家档案</h2></div><TrophyIcon /></div>
        <div className="stat-grid"><div><strong>{scoreCount}</strong><span>玩过游戏</span></div><div><strong>{totalScore}</strong><span>累计积分</span></div><div><strong>{recentGames.length ? "连续 1 天" : "待开启"}</strong><span>游玩记录</span></div></div>
        <p className="record-note">当前为本地玩家数据。未来登录后，可以同步到所有设备。</p>
      </div>
    </section>
  );
}
