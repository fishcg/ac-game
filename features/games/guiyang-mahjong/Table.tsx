import { getReadyDiscards, tileFromKey, tileKey } from "./rules";
import type { ActionKind, MahjongState, Meld, PlayerState, TileKey } from "./types";
import { MahjongTile } from "./MahjongTile";
import styles from "./GuiyangMahjong.module.css";

const SEAT_CLASS = [styles.seatBottom, styles.seatRight, styles.seatTop, styles.seatLeft];
const DISCARD_CLASS = [styles.discardsBottom, styles.discardsRight, styles.discardsTop, styles.discardsLeft];
const WIND = ["东", "南", "西", "北"];

function MeldGroup({ meld }: { meld: Meld }) {
  return (
    <span className={styles.meldGroup} data-kind={meld.kind}>
      {meld.tiles.map((tile, index) => (
        <MahjongTile
          key={tile.id}
          tile={tile}
          compact
          hidden={meld.kind === "concealed-kong" && (index === 0 || index === meld.tiles.length - 1)}
        />
      ))}
    </span>
  );
}
function SeatBadge({ player, active, dealer }: { player: PlayerState; active: boolean; dealer: boolean }) {
  return (
    <div className={`${styles.seatBadge} ${active ? styles.seatBadgeActive : ""}`}>
      <span className={styles.avatar}>{player.avatar}</span>
      <span><b>{player.name}</b><small>{player.score > 0 ? "+" : ""}{player.score} 分</small></span>
      <i>{dealer ? "庄" : WIND[player.seat]}</i>
      {player.ready && <em>听</em>}
      {player.beanCount > 0 && <strong>豆 ×{player.beanCount}</strong>}
    </div>
  );
}

function OpponentSeat({ player, active, dealer }: { player: PlayerState; active: boolean; dealer: boolean }) {
  return (
    <div className={`${styles.seat} ${SEAT_CLASS[player.seat]}`}>
      <SeatBadge player={player} active={active} dealer={dealer} />
      <div className={styles.hiddenRack} aria-label={`${player.name}还有 ${player.hand.length} 张手牌`}>
        {Array.from({ length: player.hand.length }, (_, index) => <span key={index} />)}
      </div>
      {player.melds.length > 0 && <div className={styles.melds}>{player.melds.map((meld, index) => <MeldGroup key={`${meld.kind}-${index}`} meld={meld} />)}</div>}
    </div>
  );
}

type Props = {
  state: MahjongState;
  onSelect: (id: number) => void;
  onDiscard: () => void;
  onAction: (kind: ActionKind, tile?: TileKey) => void;
};

export function MahjongTable({ state, onSelect, onDiscard, onAction }: Props) {
  const human = state.players[0];
  const readyDiscards = state.phase === "player-turn" && human.hand.length % 3 === 2 ? getReadyDiscards(human.hand, human.melds) : [];
  const selected = human.hand.find((tile) => tile.id === state.selectedTileId);
  const selectedHint = selected ? readyDiscards.find((item) => item.discard === tileKey(selected)) : null;
  const interactive = state.phase === "player-turn" && state.current === 0 && human.hand.length % 3 === 2;

  return (
    <div className={styles.table}>
      <i className={`${styles.corner} ${styles.cornerA}`} /><i className={`${styles.corner} ${styles.cornerB}`} />
      <i className={`${styles.corner} ${styles.cornerC}`} /><i className={`${styles.corner} ${styles.cornerD}`} />

      {state.players.slice(1).map((player) => (
        <OpponentSeat key={player.seat} player={player} active={state.current === player.seat} dealer={state.dealer === player.seat} />
      ))}

      {state.players.map((player) => (
        <div key={`discards-${player.seat}`} className={`${styles.discards} ${DISCARD_CLASS[player.seat]}`}>
          {player.discards.map((tile) => (
            <span key={tile.id} className={state.lastDiscard?.tile.id === tile.id ? styles.lastDiscard : ""}>
              <MahjongTile tile={tile} compact />
            </span>
          ))}
        </div>
      ))}

      <div className={styles.centerDial}>
        <span className={styles.roundSeal}>黔</span>
        <div><small>第 {state.round || 1} 局</small><b>{state.wall.length}</b><em>余牌</em></div>
        <p>{state.message}</p>
        {state.charge && <strong>冲锋鸡 · {state.charge.tile === "tiao-1" ? "幺鸡" : "乌骨鸡"}{state.charge.claimant !== null ? " · 已成责任鸡" : ""}</strong>}
      </div>

      {state.effect && (
        <div key={state.effect.id} className={`${styles.effect} ${styles[`effectSeat${state.effect.seat}`]} ${styles[`effect${state.effect.kind}`]}`}>
          <span>{state.effect.label}</span><i /><i /><i /><i />
        </div>
      )}

      <div className={`${styles.seat} ${styles.seatBottom}`}>
        <SeatBadge player={human} active={state.current === 0} dealer={state.dealer === 0} />
        {human.melds.length > 0 && <div className={styles.humanMelds}>{human.melds.map((meld, index) => <MeldGroup key={`${meld.kind}-${index}`} meld={meld} />)}</div>}
      </div>

      <div className={styles.handArea}>
        {selectedHint && (
          <div className={styles.readyHint}>
            打出后听 {selectedHint.waits.slice(0, 8).map((key) => <MahjongTile key={key} tile={tileFromKey(key)} compact />)}
            <b>{selectedHint.waits.length} 张</b>
          </div>
        )}
        {state.actions.length > 0 && (
          <div className={styles.actions}>
            {state.actions.map((action, index) => (
              <button
                key={`${action.kind}-${action.tile ?? index}`}
                className={action.kind === "hu" ? styles.actionHu : action.kind === "kong" ? styles.actionKong : action.kind === "pong" ? styles.actionPong : styles.actionPass}
                onClick={() => onAction(action.kind, action.tile)}
              >
                <b>{action.kind === "hu" ? "胡" : action.kind === "kong" ? "杠" : action.kind === "pong" ? "碰" : "过"}</b>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}
        <div className={styles.handRack}>
          {human.hand.map((tile) => (
            <MahjongTile
              key={tile.id}
              tile={tile}
              selected={tile.id === state.selectedTileId}
              drawn={tile.id === state.drawnTileId}
              disabled={!interactive}
              onClick={() => onSelect(tile.id)}
            />
          ))}
        </div>
        <button className={styles.discardButton} onClick={onDiscard} disabled={!interactive || state.selectedTileId === null}>
          出牌
        </button>
      </div>
    </div>
  );
}
