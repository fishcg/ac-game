import type { CSSProperties, ReactNode } from "react";
import type { GameId } from "@/config/games";

type ViewportSpec = {
  width: number;
  height: number;
};

const LANDSCAPE_16_9: ViewportSpec = { width: 16, height: 9 };

const FIXED_VIEWPORTS: Partial<Record<GameId, ViewportSpec>> = {
  "worm-front": LANDSCAPE_16_9,
  "prism-dash": LANDSCAPE_16_9,
  "rune-peg": LANDSCAPE_16_9,
  "nightfall-survivors": { width: 8, height: 5 },
  "iron-front": LANDSCAPE_16_9,
  "thunder-wing": { width: 540, height: 760 },
  zuma: LANDSCAPE_16_9,
  "perfect-parking": LANDSCAPE_16_9,
  "moon-swing": LANDSCAPE_16_9,
  "bamboo-cicada": LANDSCAPE_16_9,
};

export function GameViewport({ gameId, children }: { gameId: GameId; children: ReactNode }) {
  const spec = FIXED_VIEWPORTS[gameId];
  const style = spec
    ? ({ "--game-aspect": `${spec.width} / ${spec.height}` } as CSSProperties)
    : undefined;

  return (
    <div
      className={`game-stage__viewport ${spec ? "game-stage__viewport--fixed" : "game-stage__viewport--adaptive"}`}
      data-game-id={gameId}
      style={style}
    >
      {children}
      {spec && spec.width > spec.height && <span className="game-stage__orientation-hint">横屏游玩，画面更大</span>}
    </div>
  );
}
