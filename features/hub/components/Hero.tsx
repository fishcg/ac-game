import type { GameInfo } from "@/config/games";
import { GameArtwork } from "@/components/ui/GameArtwork";
import { ArrowIcon, PlayIcon } from "@/components/ui/Icons";

export function Hero({ featured, onPlay }: { featured: GameInfo; onPlay: (game: GameInfo) => void }) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <span className="section-kicker"><i /> 即点即玩 · 无需登录</span>
        <h1>让快乐，<br />随时<span>开一局。</span></h1>
        <p>精选轻量小游戏，没有下载，没有等待。<br />给忙碌生活留一点轻松的空隙。</p>
        <div className="hero-actions"><button className="primary-button" onClick={() => onPlay(featured)}><PlayIcon size={16} /> 开始游玩</button><a href="#games" className="text-button">浏览全部 <ArrowIcon size={17} /></a></div>
        <div className="hero-proof"><span className="avatar-stack"><i>芽</i><i>牧</i><i>野</i></span><span><strong>28,000+</strong> 位玩家正在放松</span></div>
      </div>
      <button className="featured-game" onClick={() => onPlay(featured)} aria-label={`游玩${featured.title}`}>
        <GameArtwork type={featured.art} /><span className="featured-badge">FEATURED</span>
        <span className="featured-info"><span><small>{featured.eyebrow}</small><strong>{featured.title}</strong></span><i className="round-play"><PlayIcon size={19} /></i></span>
      </button>
    </section>
  );
}
