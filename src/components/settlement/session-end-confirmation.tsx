"use client";

import { useEffect, useRef } from "react";
import { useLanguage } from "@/components/i18n/language-provider";

export function SessionEndConfirmation({ isOpen, onCancel, onConfirm }: { isOpen: boolean; onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { isZh } = useLanguage();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !isOpen) return;
    dialog.showModal();
    return () => dialog.close();
  }, [isOpen]);
  return <dialog ref={ref} className="session-settlement-dialog session-end-confirmation" aria-labelledby="session-end-title" onCancel={(event) => { event.preventDefault(); onCancel(); }}>
    {isOpen && <><h2 id="session-end-title">{isZh ? "结束牌局？" : "End session?"}</h2>
      <p>{isZh ? "保存最终结算后，本场结果将锁定。" : "The final settlement will be saved and this session's results locked."}</p>
      <div><button type="button" className="button-secondary" autoFocus onClick={onCancel}>{isZh ? "继续牌局" : "Keep playing"}</button><button type="button" className="button-primary" onClick={onConfirm}>{isZh ? "结束并保存" : "End & save"}</button></div>
    </>}
  </dialog>;
}
