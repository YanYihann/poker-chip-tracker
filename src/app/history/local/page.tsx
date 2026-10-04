"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import { AppTopBar } from "@/components/layout/app-top-bar";
import { SessionSettlementModal } from "@/components/settlement/session-settlement-modal";
import type { SessionSummary } from "@/features/settlement/session-summary";
import { useArchiveStore } from "@/store/useArchiveStore";

export default function LocalHistoryPage() {
  const { isZh, localeTag } = useLanguage();
  const entries = useArchiveStore((state) => state.entries);
  const hydrated = useArchiveStore((state) => state.hydrated);
  const [selected, setSelected] = useState<SessionSummary | null>(null);
  useEffect(() => { useArchiveStore.getState().hydrate(); }, []);
  const summaries = entries.flatMap((entry) => entry.summary ? [entry.summary] : []);
  return <main className="app-shell">
    <AppTopBar title={isZh ? "本地历史" : "Local history"} backHref="/local" />
    <section className="page-content local-session-history">
      {!hydrated ? <p role="status" className="session-empty">{isZh ? "正在加载…" : "Loading…"}</p> : summaries.length ? summaries.map((summary) => <button type="button" key={summary.id} onClick={() => setSelected(summary)} className="local-session-history-row">
        <span><strong>{summary.name}</strong><small>{new Date(summary.endedAtIso).toLocaleString(localeTag)} · {summary.hands.length} {isZh ? "手" : "hands"}</small></span>
        <span>{isZh ? "查看结算" : "View settlement"} <span aria-hidden="true">→</span></span>
      </button>) : <p className="session-empty">{isZh ? "暂无已完成的本地牌局。" : "No completed local sessions yet."}</p>}
    </section>
    <SessionSettlementModal isOpen={Boolean(selected)} summary={selected} onClose={() => setSelected(null)} />
  </main>;
}
