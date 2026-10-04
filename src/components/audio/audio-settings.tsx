"use client";

import { useEffect, useRef, useState } from "react";
import { SpeakerSimpleHigh } from "@phosphor-icons/react/dist/csr/SpeakerSimpleHigh";
import { SpeakerSimpleSlash } from "@phosphor-icons/react/dist/csr/SpeakerSimpleSlash";
import { useLanguage } from "@/components/i18n/language-provider";
import { useAudioSettings } from "./audio-provider";

export function AudioSettings() {
  const { isZh } = useLanguage();
  const { preferences, available, musicScene, toggle } = useAudioSettings();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const active = preferences.effects || preferences.music;
  const Icon = active ? SpeakerSimpleHigh : SpeakerSimpleSlash;

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return <div className="audio-settings" ref={root} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} className="audio-trigger" type="button" aria-label={isZh ? "声音设置" : "Sound settings"}
      aria-expanded={open} aria-controls="audio-settings-panel" onClick={() => setOpen(!open)}>
      <Icon size={20} aria-hidden="true" />
    </button>
    {open && <div className="audio-settings-panel" id="audio-settings-panel" role="group" aria-label={isZh ? "声音设置" : "Sound settings"}>
      <p className="audio-settings-title">{isZh ? "声音" : "SOUND"}</p>
      {(["effects", "music"] as const).map((channel) => <button key={channel} type="button" className="audio-option"
        role="switch" aria-checked={preferences[channel]} disabled={!available} data-ui-sound="off" onClick={() => toggle(channel)}>
        <span>{channel === "effects" ? isZh ? "按钮音效" : "Button sounds" : isZh ? "背景音乐" : "Background music"}
          {channel === "music" && <small className="audio-track">{musicScene === "table" ? isZh ? "对战" : "In play" : isZh ? "大厅" : "Lobby"}</small>}
        </span>
        <span className="audio-state" aria-hidden="true">{preferences[channel] ? isZh ? "开" : "On" : isZh ? "关" : "Off"}</span>
      </button>)}
      {!available && <p className="audio-unavailable">{isZh ? "此浏览器不支持音频" : "Audio unavailable in this browser"}</p>}
    </div>}
  </div>;
}
