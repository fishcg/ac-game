export type RunePegStatus = "idle" | "aiming" | "rolling" | "paused" | "upgrade" | "won" | "lost";
export type PegKind = "normal" | "critical" | "bomb" | "refresh";
export type Peg = { id: number; x: number; y: number; kind: PegKind; lit: boolean; consumed: boolean };
export type Ball = { x: number; y: number; vx: number; vy: number; trail: { x: number; y: number }[] };
export type RuneEnemy = { id: number; name: string; hp: number; maxHp: number; attack: number; color: string; kind: "slime" | "golem" | "warden" };
export type RuneUpgradeId = "power" | "echo" | "blast" | "armor" | "heal" | "prism";
export type RuneUpgrade = { id: RuneUpgradeId; name: string; icon: string; description: string };
export type RunePegHud = { score: number; wave: number; totalWaves: number; hp: number; maxHp: number; damage: number; shot: number; message: string; enemyName: string; enemyHp: number; enemyMaxHp: number; relics: string[] };
export type RunePegCallbacks = {
  onHud: (hud: RunePegHud) => void;
  onStatus: (status: RunePegStatus, score: number, message: string) => void;
  onUpgrade: (choices: RuneUpgrade[]) => void;
};
