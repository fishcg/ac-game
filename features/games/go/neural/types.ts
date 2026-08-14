export type Player = "black" | "white";
export type Intersection = Player | null;
export type BoardState = Intersection[][];
export type GameRules = "japanese" | "chinese" | "korean";
export type KataGoBackendPreference = "webgpu" | "wasm" | "cpu";
export type FloatArray = Float32Array | number[];

export interface Move {
  x: number;
  y: number;
  player: Player;
}

export type RegionOfInterest = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};
