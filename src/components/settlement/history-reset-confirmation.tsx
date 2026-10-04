"use client";

import { useEffect, useRef } from "react";
import { useLanguage } from "@/components/i18n/language-provider";

export function HistoryResetConfirmation({ isOpen, busy, error, onCancel, onConfirm }: {
  isOpen: boolean; busy: boolean; error: string | null; onCancel: () => void; onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { isZh } = useLanguage();
  useEffect(() => {
    if (!isOpen) return;
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, [isOpen]);
  return <dialog ref={ref} className="session-settlement-dialog session-end-confirmation" aria-labelledby="history-reset-title" aria-describedby="history-reset-description" onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
    {isOpen && <><h2 id="history-reset-title">{isZh ? "重置所有牌局？" : "Reset all sessions?"}</h2>
      <p id="history-reset-description">{isZh ? "清空你的线上、本地盈亏和历史，以及此设备的本地历史。无法撤销。其他玩家的记录和进行中的牌局不受影响。" : "Clear your online and local totals and history, including local history on this device. This cannot be undone. Other players’ records and ongoing games stay intact."}</p>
      {error && <p role="alert" className="text-stitch-tertiary">{error}</p>}
      <div><button type="button" className="button-secondary" autoFocus disabled={busy} onClick={onCancel}>{isZh ? "取消" : "Cancel"}</button><button type="button" className="button-primary" disabled={busy} onClick={onConfirm}>{busy ? (isZh ? "重置中…" : "Resetting…") : (isZh ? "清空记录" : "Clear records")}</button></div>
    </>}
  </dialog>;
}
