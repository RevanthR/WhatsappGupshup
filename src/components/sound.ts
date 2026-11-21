"use client";

import { useSyncExternalStore } from "react";

const KEY = "wa:sound";
const EVT = "wa:sound-change";

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return false;
  }
}

export function setSound(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {}
  window.dispatchEvent(new Event(EVT));
  if (on) chime();
}

export function useSound(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVT, cb);
      window.addEventListener("storage", cb);
      return () => {
        window.removeEventListener(EVT, cb);
        window.removeEventListener("storage", cb);
      };
    },
    read,
    () => false,
  );
}

let ctx: AudioContext | null = null;

// A short, soft two-note chime. Silently does nothing if the browser blocks audio.
export function chime() {
  if (!read()) return;
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime;
    for (const [i, f] of [880, 1320].entries()) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t + i * 0.12);
      g.gain.linearRampToValueAtTime(0.08, t + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(t + i * 0.12);
      o.stop(t + i * 0.12 + 0.4);
    }
  } catch {}
}
