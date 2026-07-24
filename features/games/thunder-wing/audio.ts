import { gameAudio } from "@/lib/audio/gameAudio";
import { ASSET_ROOT } from "./assets";

type ThunderSound = "shoot" | "enemyShoot" | "hit" | "explode" | "powerup" | "shield" | "gameOver";

const soundFiles: Record<ThunderSound, string> = {
  shoot: "sfx_laser1.ogg",
  enemyShoot: "sfx_laser2.ogg",
  hit: "sfx_zap.ogg",
  explode: "sfx_twoTone.ogg",
  powerup: "sfx_shieldUp.ogg",
  shield: "sfx_shieldDown.ogg",
  gameOver: "sfx_lose.ogg",
};

const volumes: Record<ThunderSound, number> = {
  shoot: 0.12,
  enemyShoot: 0.08,
  hit: 0.11,
  explode: 0.16,
  powerup: 0.2,
  shield: 0.18,
  gameOver: 0.22,
};

const pools = new Map<ThunderSound, HTMLAudioElement[]>();

export function primeThunderAudio() {
  if (typeof Audio === "undefined" || pools.size) return;
  (Object.keys(soundFiles) as ThunderSound[]).forEach((sound) => {
    const count = sound === "shoot" ? 5 : 2;
    const pool = Array.from({ length: count }, () => {
      const audio = new Audio(`${ASSET_ROOT}/${soundFiles[sound]}`);
      audio.preload = "auto";
      audio.volume = volumes[sound];
      return audio;
    });
    pools.set(sound, pool);
  });
}

export function playThunderSound(sound: ThunderSound) {
  if (gameAudio.isMuted()) return;
  primeThunderAudio();
  const pool = pools.get(sound);
  if (!pool) return;
  const audio = pool.find((item) => item.paused || item.ended) ?? pool[0];
  audio.currentTime = 0;
  void audio.play().catch(() => undefined);
}
