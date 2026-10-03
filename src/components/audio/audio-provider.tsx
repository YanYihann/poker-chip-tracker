"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AUDIO_STORAGE_KEY, DEFAULT_AUDIO, PokerAudio, readAudioPreferences, type AudioPreferences } from "@/lib/audio";

const AudioSettingsContext = createContext<{
  preferences: AudioPreferences;
  available: boolean;
  toggle: (channel: keyof AudioPreferences) => void;
} | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<AudioPreferences>({ ...DEFAULT_AUDIO });
  const [available, setAvailable] = useState(true);
  const engine = useRef<PokerAudio | null>(null);
  const current = useRef<AudioPreferences>({ ...DEFAULT_AUDIO });

  useEffect(() => {
    const player = new PokerAudio();
    engine.current = player;
    setAvailable(typeof window.AudioContext === "function");
    let restored = { ...DEFAULT_AUDIO };
    try { restored = readAudioPreferences(localStorage.getItem(AUDIO_STORAGE_KEY)); } catch { /* Storage may be blocked; keep sound off. */ }
    current.current = restored;
    setPreferences(restored);
    player.configure(restored);
    const visibility = () => player.setVisible(document.visibilityState === "visible");
    const unlock = () => player.unlock();
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const control = target?.closest("button, a[href], summary, [role=button], input[type=checkbox], input[type=radio]");
      if (!control || control.closest('[data-ui-sound="off"], [inert]') || control.matches(':disabled, [aria-disabled="true"]')) return;
      player.playClick();
    };
    visibility();
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown", unlock, true);
    document.addEventListener("click", click, true);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      document.removeEventListener("click", click, true);
      document.removeEventListener("visibilitychange", visibility);
      player.dispose();
      engine.current = null;
    };
  }, []);

  function toggle(channel: keyof AudioPreferences) {
    const next = { ...current.current, [channel]: !current.current[channel] };
    current.current = next;
    setPreferences(next);
    try { localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(next)); } catch { /* Settings still work for this visit. */ }
    engine.current?.configure(next);
    engine.current?.unlock();
    if (channel === "effects" && next.effects) engine.current?.playClick();
  }

  return <AudioSettingsContext.Provider value={{ preferences, available, toggle }}>{children}</AudioSettingsContext.Provider>;
}

export function useAudioSettings() {
  const value = useContext(AudioSettingsContext);
  if (!value) throw new Error("Audio settings require AudioProvider");
  return value;
}
