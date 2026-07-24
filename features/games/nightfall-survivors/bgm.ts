import { gameAudio } from "@/lib/audio/gameAudio";

const TRACKS = [
  "/assets/nightfall-survivors/audio/nightfall-adventure.ogg",
  "/assets/nightfall-survivors/audio/nightfall-mystic.ogg",
  "/assets/nightfall-survivors/audio/nightfall-crown.ogg",
] as const;
const STAGE_TRACK = [0, 0, 1, 1, 1, 2] as const;
const PLAYING_VOLUME = .16;
const PAUSED_VOLUME = .045;

export class NightfallBgm {
  private active: HTMLAudioElement | null = null;
  private fadingOut: HTMLAudioElement | null = null;
  private activeTrack = -1;
  private paused = false;
  private muted = gameAudio.isMuted();
  private fadeTimer: number | null = null;
  private unsubscribe = gameAudio.subscribe((muted) => {
    this.muted = muted;
    if (this.active) this.active.volume = this.targetVolume();
  });

  start(stageIndex = 0) {
    this.setStage(stageIndex);
  }

  setStage(stageIndex: number) {
    if (typeof Audio === "undefined") return;
    const trackIndex = STAGE_TRACK[Math.max(0, Math.min(STAGE_TRACK.length - 1, stageIndex))];
    if (trackIndex === this.activeTrack && this.active) return;
    const previous = this.active;
    this.clearFade();
    const next = new Audio(TRACKS[trackIndex]);
    next.loop = true; next.preload = "auto"; next.volume = 0;
    this.active = next; this.activeTrack = trackIndex;
    void next.play().then(() => this.crossfade(previous, next)).catch(() => {
      if (this.active === next) { this.active = previous; this.activeTrack = -1; }
    });
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    if (this.active && this.fadeTimer === null) this.active.volume = this.targetVolume();
  }

  stop() {
    this.clearFade();
    if (this.active) { this.active.pause(); this.active.currentTime = 0; }
    this.active = null; this.activeTrack = -1;
  }

  destroy() {
    this.stop(); this.unsubscribe();
  }

  private targetVolume() {
    if (this.muted) return 0;
    return this.paused ? PAUSED_VOLUME : PLAYING_VOLUME;
  }

  private crossfade(previous: HTMLAudioElement | null, next: HTMLAudioElement) {
    const startedAt = performance.now(); const duration = 720; const previousVolume = previous?.volume ?? 0;
    this.fadingOut = previous;
    this.fadeTimer = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / duration);
      if (this.active === next) next.volume = this.targetVolume() * progress;
      if (previous) previous.volume = previousVolume * (1 - progress);
      if (progress < 1) return;
      if (previous) { previous.pause(); previous.currentTime = 0; }
      this.fadingOut = null; this.clearFade(false);
    }, 32);
  }

  private clearFade(stopFadingOut = true) {
    if (this.fadeTimer !== null) window.clearInterval(this.fadeTimer);
    this.fadeTimer = null;
    if (stopFadingOut && this.fadingOut) { this.fadingOut.pause(); this.fadingOut.currentTime = 0; }
    this.fadingOut = null;
  }
}
