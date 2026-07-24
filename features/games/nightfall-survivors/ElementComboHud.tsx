import type { ElementId } from "./types";
import styles from "./ElementComboHud.module.css";

const ELEMENTS: Array<{ id: ElementId; name: string; icon: string }> = [
  { id: "metal", name: "金", icon: "◇" },
  { id: "water", name: "水", icon: "≈" },
  { id: "wood", name: "木", icon: "♣" },
  { id: "fire", name: "火", icon: "♨" },
  { id: "earth", name: "土", icon: "▰" },
];

type Props = {
  last: ElementId | null;
  next: ElementId | null;
  comboName: string | null;
  comboTime: number;
  cooldown: number;
  window: number;
};

export function ElementComboHud({ last, next, comboName, comboTime, cooldown, window }: Props) {
  if (!last && !comboName) return null;
  return <aside className={styles.panel} style={{ top: "72px" }} aria-label="五行连携">
    <span>WUXING CHAIN</span>
    <div>{ELEMENTS.map((element) => <i key={element.id} className={element.id === last ? styles.active : element.id === next ? styles.next : ""} title={element.name}>{element.icon}<small>{element.name}</small></i>)}</div>
    {comboName ? <strong>{comboName}<em>{comboTime.toFixed(1)}s</em></strong> : cooldown > 0 ? <p style={{ color: "#ffb77d" }}>连携调息 · {cooldown.toFixed(1)}s</p> : <p>{last ? `${ELEMENTS.find((item) => item.id === last)?.name}生${ELEMENTS.find((item) => item.id === next)?.name}` : ""} · {window.toFixed(1)}s · 需4目标</p>}
  </aside>;
}
