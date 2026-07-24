import type { GuestProfile } from "@/lib/game-sdk/types";
import { games } from "@/config/games";
import { BoxIcon, ChevronIcon, ClockIcon, GameIcon, HomeIcon, SparkIcon, TrophyIcon } from "@/components/ui/Icons";

type Props = {
  open: boolean;
  profile: GuestProfile | null;
  totalScore: number;
  onClose: () => void;
  onRename: () => void;
};

export function Sidebar({ open, profile, totalScore, onClose, onRename }: Props) {
  return (
    <aside className={`sidebar ${open ? "sidebar--open" : ""}`}>
      <a className="brand" href="#top" aria-label="狗耳GAME 首页"><span className="brand-mark"><i /><i /><i /></span><strong>狗耳GAME</strong></a>
      <nav className="main-nav" aria-label="主导航">
        <a className="nav-item nav-item--active" href="#top" onClick={onClose}><HomeIcon /><span>发现</span></a>
        <a className="nav-item" href="#games" onClick={onClose}><GameIcon /><span>全部游戏</span><em>{games.length}</em></a>
        <a className="nav-item" href="#recent" onClick={onClose}><ClockIcon /><span>最近游玩</span></a>
        <a className="nav-item" href="#records" onClick={onClose}><TrophyIcon /><span>我的记录</span></a>
        <a className="nav-item" href="#ranking" onClick={onClose}><SparkIcon /><span>玩家排名</span></a>
      </nav>
      <div className="sidebar-spacer" />
      <div className="daily-card">
        <span><SparkIcon size={17} /> 今日挑战</span><strong>赢得 300 分</strong>
        <div className="progress"><i style={{ width: `${Math.min(100, totalScore / 3)}%` }} /></div>
        <small>{Math.min(totalScore, 300)} / 300</small>
      </div>
      <a href="#assets" className="nav-item nav-item--bottom" onClick={onClose}><BoxIcon /><span>免费素材库</span></a>
      <button className="profile-mini" onClick={onRename}>
        <span className="avatar">{profile?.displayName.slice(0, 1) || "游"}</span>
        <span><strong>{profile?.displayName || "未命名玩家"}</strong><small>本地玩家</small></span>
        <ChevronIcon size={16} />
      </button>
    </aside>
  );
}
