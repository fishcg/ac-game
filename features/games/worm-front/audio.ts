import { gameAudio } from "@/lib/audio/gameAudio";

export type WormSound = "start" | "turn" | "jump" | "charge" | "fire" | "bounce" | "explode" | "hurt" | "miss" | "win" | "lose";

const SOUND_MAP: Record<WormSound, Parameters<typeof gameAudio.play>[0]> = {
  start: "start",
  turn: "tap",
  jump: "move",
  charge: "great",
  fire: "drop",
  bounce: "flip",
  explode: "crash",
  hurt: "mismatch",
  miss: "miss",
  win: "win",
  lose: "miss",
};

export function playWormSound(sound: WormSound) {
  gameAudio.play(SOUND_MAP[sound]);
}
