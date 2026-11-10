export type FighterId = "kage" | "rai" | "jumon";

export type AttackKind = "light" | "heavy" | "special" | "super";

export type ActionName =
  | "left"
  | "right"
  | "up"
  | "down"
  | "guard"
  | "light"
  | "heavy"
  | "special"
  | "super";

export type InputState = {
  held: Record<ActionName, boolean>;
  queue: ActionName[];
};

export function createInput(): InputState {
  return {
    held: {
      left: false,
      right: false,
      up: false,
      down: false,
      guard: false,
      light: false,
      heavy: false,
      special: false,
      super: false,
    },
    queue: [],
  };
}

export function releaseInput(input: InputState): void {
  for (const key of Object.keys(input.held) as ActionName[]) input.held[key] = false;
  input.queue.length = 0;
}

/**
 * 以「角色朝向」为基准的判定盒。
 * x：从身体中心向前为正；y：下边缘离地高度，向上为正。
 */
export type Box = { x: number; y: number; w: number; h: number };

export type ProjectileSpec = {
  speed: number;
  offsetX: number;
  offsetY: number;
  w: number;
  h: number;
  life: number;
  color: string;
};

export type HitSpec = {
  from: number;
  to: number;
  box: Box;
  damage: number;
  hitstun: number;
  blockstun: number;
  hitstop: number;
  knockback: number;
  lift: number;
  height: "high" | "mid" | "low";
  sound: "light" | "heavy" | "special" | "super";
  shake?: number;
  projectile?: ProjectileSpec;
};

export type MoveDef = {
  kind: AttackKind;
  name: string;
  total: number;
  cost: number;
  gain: number;
  hits: HitSpec[];
  cancelFrom: number;
  cancelInto: AttackKind[];
  lunge: number;
  lungeFrame: number;
  airborne?: boolean;
  freeze?: number;
  shake?: number;
};

export type Palette = {
  body: string;
  bodyDark: string;
  cloth: string;
  trim: string;
  glow: string;
  skin: string;
};

export type CharacterDef = {
  id: FighterId;
  name: string;
  title: string;
  blurb: string;
  weapon: "kunai" | "katana" | "chain";
  style: string;
  colors: Palette;
  maxHp: number;
  walkSpeed: number;
  jumpPower: number;
  weight: number;
  specialName: string;
  superName: string;
  moves: Record<AttackKind, MoveDef>;
};

export type FighterState =
  | "idle"
  | "walk"
  | "air"
  | "block"
  | "attack"
  | "hit"
  | "launch"
  | "down"
  | "getup"
  | "ko"
  | "victory";

export type TrailSample = {
  x: number;
  y: number;
  facing: 1 | -1;
  state: FighterState;
  moveFrame: number;
  kind: AttackKind | null;
  age: number;
};

export type Fighter = {
  side: 0 | 1;
  def: CharacterDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  chakra: number;
  guard: number;
  state: FighterState;
  stateFrame: number;
  move: MoveDef | null;
  moveFrame: number;
  hitsDone: boolean[];
  hitstun: number;
  blockstun: number;
  invuln: number;
  combo: number;
  comboTimer: number;
  maxCombo: number;
  damageDealt: number;
  airJumps: number;
  flash: number;
  guardBroken: number;
  blockFlash: number;
  crouch: boolean;
  tapDir: -1 | 0 | 1;
  tapTimer: number;
  trail: TrailSample[];
  landed: boolean;
  superGlow: number;
};

export type Projectile = {
  owner: 0 | 1;
  x: number;
  y: number;
  vx: number;
  w: number;
  h: number;
  life: number;
  maxLife: number;
  color: string;
  spec: ProjectileSpec;
  hit: HitSpec;
  alive: boolean;
  seed: number;
};

export type ParticleKind = "spark" | "ring" | "dust" | "ember" | "flame" | "slash" | "chakra" | "rain" | "shard";

export type Particle = {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  angle: number;
  spin: number;
  color: string;
  gravity: number;
};

export type MatchPhase = "intro" | "round" | "roundEnd" | "matchEnd";

export type FighterHud = {
  id: FighterId;
  name: string;
  hp: number;
  hpMax: number;
  chakra: number;
  guard: number;
  combo: number;
  state: FighterState;
  flash: number;
};

export type HudSnapshot = {
  p1: FighterHud;
  p2: FighterHud;
  time: number;
  round: number;
  wins: [number, number];
  phase: MatchPhase;
  callout: string;
  calloutTone: "normal" | "warn" | "win";
  banner: string;
  bannerTone: FighterId | null;
  calloutTimer: number;
};

export type MatchResult = {
  win: boolean;
  score: number;
  wins: [number, number];
  maxCombo: number;
  perfect: boolean;
  title: string;
};

export type SoundName =
  | "select"
  | "light"
  | "heavy"
  | "block"
  | "special"
  | "super"
  | "ko"
  | "jump"
  | "land"
  | "round"
  | "win"
  | "lose";

export type StageId = "bamboo" | "shrine" | "volcano";

export type StageDef = {
  id: StageId;
  name: string;
  sky: [string, string, string];
  accent: string;
};

export type Difficulty = 1 | 2 | 3;
export type MatchMode = "cpu" | "local";
