import { SETTINGS } from "./settings";

/**
 * Sound effects. Files live in /public/audio/sfx. Volume comes from the "Sound effects volume" setting
 * (0 = off). Effects are meant to sit under the gameplay, so every one gets a small per-sound trim.
 */
export type Sfx =
  | "teleport_expand" | "teleport_success" | "fire_ground" | "fire_air"
  | "spring_place" | "spring_reset" | "wall_place";

const TRIM: Record<Sfx, number> = {
  teleport_expand: 0.8, teleport_success: 0.9, fire_ground: 0.8, fire_air: 0.85,
  spring_place: 0.8, spring_reset: 0.7, wall_place: 0.9,
};

const cache = new Map<Sfx, HTMLAudioElement>();

export function playSfx(id: Sfx, gain = 1) {
  if (typeof window === "undefined") return;
  const vol = (SETTINGS.sfxVolume ?? 50) / 100;
  if (vol <= 0) return;
  try {
    let base = cache.get(id);
    if (!base) {
      base = new Audio(`/audio/sfx/${id}.mp3`);
      base.preload = "auto";
      cache.set(id, base);
    }
    const el = base.cloneNode() as HTMLAudioElement; // lets the same sound overlap itself
    el.volume = Math.max(0, Math.min(1, vol * TRIM[id] * gain));
    void el.play().catch(() => { /* blocked until a user gesture */ });
  } catch { /* ignore */ }
}
