import { SUIT_LABEL } from "./data";
import type { Tile } from "./types";
import styles from "./GuiyangMahjong.module.css";

const TILE_BASE = { wan: 0x1f007, tiao: 0x1f010, tong: 0x1f019 } as const;

type Props = {
  tile?: Tile;
  hidden?: boolean;
  compact?: boolean;
  selected?: boolean;
  drawn?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

export function MahjongTile({ tile, hidden = false, compact = false, selected = false, drawn = false, disabled = false, onClick }: Props) {
  const glyph = tile ? String.fromCodePoint(TILE_BASE[tile.suit] + tile.rank - 1) : "";
  const label = tile ? `${tile.rank}${SUIT_LABEL[tile.suit]}` : "牌背";
  const className = [
    styles.tile,
    tile ? styles[`tile${tile.suit[0].toUpperCase()}${tile.suit.slice(1)}`] : "",
    compact ? styles.tileCompact : "",
    hidden ? styles.tileHidden : "",
    selected ? styles.tileSelected : "",
    drawn ? styles.tileDrawn : "",
  ].filter(Boolean).join(" ");
  const content = hidden ? <i className={styles.tileBackMark}>贵</i> : <><span className={styles.tileGlyph}>{glyph}</span><small>{label}</small></>;

  if (onClick) {
    return <button type="button" className={className} disabled={disabled} onClick={onClick} aria-label={label}>{content}</button>;
  }
  return <span className={className} aria-label={label}>{content}</span>;
}
