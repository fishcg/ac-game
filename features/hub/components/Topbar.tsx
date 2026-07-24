import { SearchIcon, UserIcon } from "@/components/ui/Icons";

type Props = { query: string; onQuery: (value: string) => void; onMenu: () => void };

export function Topbar({ query, onQuery, onMenu }: Props) {
  return (
    <header className="topbar">
      <button className="mobile-menu" onClick={onMenu} aria-label="打开菜单"><span /><span /></button>
      <div className="search-box"><SearchIcon size={19} /><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="搜索一款游戏..." aria-label="搜索游戏" /><kbd>⌘ K</kbd></div>
      <div className="top-actions"><span className="online-dot">全部服务正常</span><span className="top-avatar"><UserIcon size={17} /></span></div>
    </header>
  );
}
