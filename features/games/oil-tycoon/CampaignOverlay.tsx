import type { CSSProperties } from "react";
import type { OilPlot } from "./types";
import type { AuctionBid, CampaignStatus, OilCharacter, RivalState } from "./campaignData";
import styles from "./OilTycoon.module.css";

type RankingEntry = { id: string; name: string; portrait: string; capital: number; player: boolean };

type CampaignOverlayProps = {
  status: CampaignStatus;
  round: number;
  cash: number;
  sold: number;
  characters: OilCharacter[];
  selectedCharacterId: string | null;
  rivals: RivalState[];
  plots: OilPlot[];
  selectedPlotId: number | null;
  auctionBids: Record<number, AuctionBid>;
  auctionSeconds: number;
  ranking: RankingEntry[];
  onStart: () => void;
  onChooseCharacter: (character: OilCharacter) => void;
  onSelectPlot: (plot: OilPlot) => void;
  onBid: () => void;
  onLease: () => void;
  onResume: () => void;
  onNextRound: () => void;
};

export function CampaignOverlay({ status, round, cash, sold, characters, selectedCharacterId, rivals, plots, selectedPlotId, auctionBids, auctionSeconds, ranking, onStart, onChooseCharacter, onSelectPlot, onBid, onLease, onResume, onNextRound }: CampaignOverlayProps) {
  if (status === "running") return null;

  if (status === "character") return <div className={styles.overlay}>
    <div className={`${styles.overlayPanel} ${styles.characterPanel}`}>
      <div className={styles.woodTitle}>选择角色</div>
      <p>选择你的石油商人。角色会陪伴整个经营生涯，资本与排名会延续到下一年。</p>
      <div className={styles.characterGrid}>
        {characters.map((character) => <button key={character.id} className={`${styles.characterCard} ${selectedCharacterId === character.id ? styles.characterSelected : ""}`} onClick={() => onChooseCharacter(character)}>
          <span className={styles.characterPortrait}>{character.portrait}</span>
          <strong>{character.name}</strong><small>{character.title}</small><em>{character.quote}</em>
        </button>)}
      </div>
    </div>
  </div>;

  if (status === "auction") {
    const selectedPlot = plots.find((plot) => plot.id === selectedPlotId) ?? null;
    const selectedBid = selectedPlot ? auctionBids[selectedPlot.id] : null;
    const leader = selectedBid?.bidderId === "player" ? "你正在领先" : selectedBid?.bidderId ? rivals.find((rival) => rival.id === selectedBid.bidderId)?.name ?? "竞争者" : "尚无人出价";
    const playerLeading = selectedBid?.bidderId === "player";
    return <div className={styles.overlay}>
      <div className={`${styles.overlayPanel} ${styles.auctionPanel}`}>
        <div className={styles.auctionSidebar}>
          <span>第 {round} 年土地拍卖</span><strong>${Math.floor(cash)}</strong>
          <p>圆点代表可租地块。高储量土地更受 AI 商人关注，价格也会持续上涨。</p>
          <div className={styles.auctionClock}>{auctionSeconds > 0 ? `竞价中 · ${auctionSeconds}s` : "AI 竞价结束"}</div>
          {selectedPlot ? <div className={styles.auctionSelection}><b>{selectedPlot.name}</b><small>{selectedPlot.geology}地层 · 地下储量未知</small><strong>${selectedBid?.amount ?? 0}</strong><em>{leader}</em></div> : <div className={styles.auctionSelection}>从地图选择一块土地</div>}
          <button className={styles.bidButton} onClick={onBid} disabled={!selectedPlot}>{auctionSeconds > 0 ? "追加竞价 +$25" : "延长竞价并出价 +$25"}</button>
          <button className={styles.primary} onClick={onLease} disabled={!playerLeading}>租下领先地块</button>
        </div>
        <div className={styles.auctionMap}>
          <div className={styles.auctionRiver} />
          {plots.map((plot) => {
            const bid = auctionBids[plot.id];
            const rival = bid?.bidderId ? rivals.find((item) => item.id === bid.bidderId) : null;
            return <button key={plot.id} className={`${styles.mapPlot} ${selectedPlotId === plot.id ? styles.mapPlotSelected : ""} ${bid?.bidderId === "player" ? styles.mapPlotPlayer : ""}`} style={{ left: `${plot.x}%`, top: `${clampMapY(plot.y)}%`, "--bid-color": rival?.color ?? "#f1c766" } as CSSProperties} onClick={() => onSelectPlot(plot)}>
              <i>{bid?.bidderId === "player" ? "你" : rival?.portrait ?? "○"}</i><strong>{plot.name}</strong><small>${bid?.amount ?? 0}</small>
            </button>;
          })}
        </div>
      </div>
    </div>;
  }

  if (status === "ranking") return <div className={`${styles.overlay} ${styles.overlayReveal}`}>
    <div className={`${styles.overlayPanel} ${styles.rankingPanel}`}>
      <h2>第 {round} 年资本排名</h2><p>本年卖出 {Math.floor(sold)} 桶原油。排名按土地、设备、库存结算后的当前现金计算。</p>
      <div className={styles.capitalRanking}>{ranking.map((entry, index) => <div key={entry.id} className={entry.player ? styles.rankingPlayer : ""}><b>#{index + 1}</b><span>{entry.portrait}</span><strong>{entry.name}{entry.player ? " · 你" : ""}</strong><em>${Math.floor(entry.capital)}</em></div>)}</div>
      <button className={styles.primary} onClick={onNextRound}>进入第 {round + 1} 年拍卖</button>
    </div>
  </div>;

  const paused = status === "paused";
  return <div className={styles.overlay}><div className={styles.overlayPanel}><span className={styles.mark}>⛽</span><h2>{paused ? "暂停营业" : "1899 · 石油热潮"}</h2><p>{paused ? "时间、油价和油井都已暂停。" : "选择角色，与四名 AI 商人竞拍土地、勘探油田并经营一家跨年度延续的石油公司。"}</p><button className={styles.primary} onClick={paused ? onResume : onStart}>{paused ? "继续钻探" : "开始经营"}</button></div></div>;
}

const clampMapY = (value: number) => Math.max(14, Math.min(86, 8 + value * .82));
