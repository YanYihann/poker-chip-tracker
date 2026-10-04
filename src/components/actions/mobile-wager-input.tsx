"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";

// Keep controls reachable without a soft keyboard consuming the phone viewport.
export function MobileWagerInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { isZh } = useLanguage();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const replaceOnDigit = useRef(true);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    dialog.showModal();
    return () => dialog.close();
  }, [open]);
  return <>
    <button type="button" id="wager-amount" className="mobile-wager-value" aria-label={isZh ? "本轮下注总额" : "Total wager this round"} aria-haspopup="dialog" onClick={() => {
      setDraft(value); replaceOnDigit.current = true; setOpen(true);
    }}>{value || "0"}</button>
    <dialog ref={ref} className="mobile-wager-dialog" aria-labelledby="wager-dialog-title" onCancel={(event) => { event.preventDefault(); setOpen(false); }}>
      <h2 id="wager-dialog-title">{isZh ? "本轮下注总额" : "Total wager this round"}</h2>
      <output aria-live="polite">{draft || "0"}</output>
      <div className="wager-keypad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "backspace"].map((key) => <button type="button" key={key} aria-label={key === "clear" ? (isZh ? "清空" : "Clear") : key === "backspace" ? (isZh ? "退格" : "Backspace") : key} onClick={() => {
          if (key === "clear") setDraft("");
          else if (key === "backspace") { setDraft((current) => current.slice(0, -1)); replaceOnDigit.current = false; }
          else { const replace = replaceOnDigit.current; replaceOnDigit.current = false; setDraft((current) => (replace ? key : current + key).slice(0, 10)); }
        }}>{key === "clear" ? (isZh ? "清空" : "Clear") : key === "backspace" ? "⌫" : key}</button>)}
      </div>
      <footer><button type="button" autoFocus onClick={() => setOpen(false)}>{isZh ? "取消" : "Cancel"}</button><button type="button" className="button-primary" onClick={() => { onChange(draft || "0"); setOpen(false); }}>{isZh ? "确定" : "Apply"}</button></footer>
    </dialog>
  </>;
}
