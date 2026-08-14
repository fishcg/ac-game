import type { GameInfo, GameId } from "@/config/games";
import { GameArtwork } from "@/components/ui/GameArtwork";
import { PlayIcon, TrophyIcon } from "@/components/ui/Icons";

export const categories = ["全部", "射击", "反应", "益智", "治愈", "音乐", "经营", "策略"] as const;
export type Category = (typeof categories)[number];

type Props = { games: GameInfo[]; category: Category; onCategory: (value: Category) => void; onPlay: (game: GameInfo) => void; getBest: (id: GameId) => number };

export function GameCatalog({ games, category, onCategory, onPlay, getBest }: Props) {
  return (
    <section className="game-section" id="games">
      <div className="section-heading"><div><span className="section-kicker"><i /> PLAYGROUND</span><h2>挑一款，玩起来</h2></div><div className="category-tabs">{categories.map((item) => <button key={item} onClick={() => onCategory(item)} className={category === item ? "active" : ""}>{item}</button>)}</div></div>
      <div className="games-grid">
        {games.map((game, index) => (
          <article className={`game-card ${index === 0 ? "game-card--wide" : ""}`} key={game.id}>
            <button className="game-card__art" onClick={() => onPlay(game)} aria-label={`游玩${game.title}`}><GameArtwork type={game.art} compact={index !== 0} /><span className="hover-play"><PlayIcon /></span></button>
            <div className="game-card__body"><div><span className="game-category">{game.category}</span><h3>{game.title}</h3><p>{game.description}</p></div><div className="game-card__footer"><span>{game.players} 人玩过</span><span>·</span><span>{game.duration}</span>{getBest(game.id) > 0 && <strong><TrophyIcon size={14} /> {getBest(game.id)}</strong>}</div></div>
          </article>
        ))}
        {games.length === 0 && <div className="empty-search">没找到这款游戏，换个关键词试试。</div>}
      </div>
    </section>
  );
}
