import { gameAudio } from "@/lib/audio/gameAudio";

type NightSound = "attack" | "frost" | "holy" | "gem" | "level" | "hurt" | "evolve" | "death";
const mapping: Record<NightSound, string> = {
  attack: "/assets/kenney-space-shooter/sfx_laser1.ogg", frost: "/assets/kenney-space-shooter/sfx_shieldUp.ogg",
  holy: "/assets/kenney-space-shooter/sfx_twoTone.ogg", gem: "/assets/kenney-space-shooter/sfx_zap.ogg",
  level: "/assets/kenney-space-shooter/sfx_shieldUp.ogg", hurt: "/assets/kenney-space-shooter/sfx_shieldDown.ogg",
  evolve: "/assets/kenney-space-shooter/sfx_twoTone.ogg", death: "/assets/kenney-space-shooter/sfx_lose.ogg",
};
const volume: Record<NightSound, number> = { attack: .055, frost: .1, holy: .12, gem: .045, level: .18, hurt: .13, evolve: .22, death: .2 };
const pools = new Map<NightSound, HTMLAudioElement[]>();

export function playNightSound(sound: NightSound) {
  if (gameAudio.isMuted() || typeof Audio === "undefined") return;
  if (!pools.has(sound)) pools.set(sound, Array.from({ length: sound === "attack" || sound === "gem" ? 5 : 2 }, () => {
    const audio = new Audio(mapping[sound]); audio.preload = "auto"; audio.volume = volume[sound]; return audio;
  }));
  const pool = pools.get(sound)!;
  const audio = pool.find((item) => item.paused || item.ended) ?? pool[0];
  audio.currentTime = 0;
  void audio.play().catch(() => undefined);
}
