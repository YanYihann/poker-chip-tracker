"use client";

import { useEffect, useRef } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import { SessionSettlementContent } from "./session-settlement-content";
import type { SessionSummary } from "@/features/settlement/session-summary";

export type SessionSettlementModel = {
  isOpen: boolean;
  summary: SessionSummary | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onClose: () => void;
};

export function SessionSettlementModal({ isOpen, summary, loading, error, onRetry, onClose }: SessionSettlementModel) {
  const { isZh } = useLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen) return;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = overflow; };
  }, [isOpen]);
  return <dialog ref={dialogRef} className="session-settlement-dialog" aria-labelledby="session-settlement-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    {isOpen && <><header className="session-settlement-header"><h2 id="session-settlement-title">{isZh ? "最终结算" : "Session settlement"}</h2><button type="button" onClick={onClose}>{isZh ? "关闭" : "Close"}</button></header>
      {loading ? <p role="status" className="session-empty">{isZh ? "正在加载最终结算…" : "Loading settlement…"}</p> : error ? <div className="session-empty"><p role="alert">{error}</p>{onRetry && <button type="button" onClick={onRetry}>{isZh ? "重试" : "Retry"}</button>}</div> : summary ? <SessionSettlementContent summary={summary} /> : <p className="session-empty">{isZh ? "结算记录暂不可用。" : "Settlement is not available yet."}</p>}
    </>}
  </dialog>;
}
