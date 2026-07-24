import Image from "next/image";
import type { CSSProperties } from "react";
import { NIGHTFALL_SPRITES } from "./assets";
import type { ClassUltimateHud as ClassUltimateHudData, CooldownUltimateHud } from "./types";
import styles from "./ClassUltimateHud.module.css";

type Props = { ultimate: ClassUltimateHudData; onUse: () => void };

export function ClassUltimateHud({ ultimate, onUse }: Props) {
  const progress = Math.round(ultimate.charge * 100);
  const status = ultimate.active ? "大招释放中" : ultimate.ready ? ultimate.readyText : `祭坛充能 ${progress}%`;

  return (
    <button
      className={`${styles.ultimate} ${ultimate.ready ? styles.ready : ""} ${ultimate.active ? styles.active : ""}`}
      onClick={onUse}
      disabled={!ultimate.ready || ultimate.active}
      title={ultimate.description}
      style={{ "--ultimate-color": ultimate.color } as CSSProperties}
    >
      <i><Image src={NIGHTFALL_SPRITES[ultimate.visual]} alt="" width={44} height={44} /></i>
      <span>
        <small>职业大招 · {ultimate.hotkey}</small>
        <strong>{ultimate.name}</strong>
        <em>{status}</em>
      </span>
      <b><u style={{ width: `${progress}%` }} /></b>
    </button>
  );
}

type CooldownProps = { ultimate: CooldownUltimateHud; onUse: () => void };

export function DragonUltimateHud({ ultimate, onUse }: CooldownProps) {
  const ready = ultimate.cooldown <= 0 && !ultimate.active;
  const progress = ultimate.active ? 100 : Math.max(0, 100 - ultimate.cooldown / ultimate.cooldownMax * 100);
  return (
    <button
      className={`${styles.ultimate} ${styles.secondary} ${ready ? styles.ready : ""} ${ultimate.active ? styles.active : ""}`}
      onClick={onUse}
      disabled={!ready}
      title={ultimate.description}
      style={{ "--ultimate-color": ultimate.color } as CSSProperties}
    >
      <i><Image src={NIGHTFALL_SPRITES[ultimate.visual]} alt="" width={44} height={44} /></i>
      <span>
        <small>死灵终极技 · {ultimate.hotkey}</small>
        <strong>{ultimate.name}</strong>
        <em>{ultimate.active ? "骷髅巨龙降临" : ready ? "READY" : `${ultimate.cooldown.toFixed(1)}s`}</em>
      </span>
      <b><u style={{ width: `${progress}%` }} /></b>
    </button>
  );
}
