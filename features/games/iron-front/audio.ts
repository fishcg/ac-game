import { gameAudio } from "@/lib/audio/gameAudio";

type IronSound = "shoot" | "shotgun" | "hit" | "explode" | "pickup" | "hurt" | "win";

const files: Record<IronSound, string> = {
  shoot: "/assets/kenney-space-shooter/sfx_laser1.ogg",
  shotgun: "/assets/kenney-space-shooter/sfx_laser2.ogg",
  hit: "/assets/kenney-space-shooter/sfx_zap.ogg",
  explode: "/assets/kenney-space-shooter/sfx_twoTone.ogg",
  pickup: "/assets/kenney-space-shooter/sfx_shieldUp.ogg",
  hurt: "/assets/kenney-space-shooter/sfx_shieldDown.ogg",
  win: "/assets/kenney-space-shooter/sfx_twoTone.ogg",
};

const volume: Record<IronSound, number> = { shoot: 0.11, shotgun: 0.17, hit: 0.09, explode: 0.2, pickup: 0.18, hurt: 0.16, win: 0.22 };
const pools = new Map<IronSound, HTMLAudioElement[]>();

export function primeIronAudio() {
  if (typeof Audio === "undefined" || pools.size) return;
  (Object.keys(files) as IronSound[]).forEach((sound) => pools.set(sound, Array.from({ length: sound === "shoot" ? 6 : 3 }, () => {
    const audio = new Audio(files[sound]);
    audio.preload = "auto";
    audio.volume = volume[sound];
    return audio;
  })));
}

export function playIronSound(sound: IronSound) {
  if (gameAudio.isMuted()) return;
  primeIronAudio();
  const pool = pools.get(sound);
  if (!pool) return;
  const audio = pool.find((item) => item.paused || item.ended) ?? pool[0];
  audio.currentTime = 0;
  void audio.play().catch(() => undefined);
}
