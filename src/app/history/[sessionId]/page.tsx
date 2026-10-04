"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { OnlineAuthGate } from "@/components/auth/online-auth-gate";
import { useLanguage } from "@/components/i18n/language-provider";
import { AppTopBar } from "@/components/layout/app-top-bar";
import { SessionSettlementContent } from "@/components/settlement/session-settlement-content";
import { fetchSessionDetail, type SessionDetail } from "@/features/auth/api";
import { summarizeOnlineSession } from "@/features/settlement/session-summary";

function SessionDetailPageContent() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId ?? "";
  const { isZh } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setDetail(null);
    if (!sessionId) { setLoading(false); return; }
    void fetchSessionDetail(sessionId).then((data) => { if (active) setDetail(data); }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load settlement.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionId]);
  return <main className="app-shell history-detail-shell">
    <AppTopBar title={isZh ? "最终结算" : "Session settlement"} backHref="/history" />
    <section className="page-content session-history-report">
      {loading && <p role="status" className="session-empty">{isZh ? "正在加载结算…" : "Loading settlement…"}</p>}
      {error && <p role="alert" className="session-empty">{error}</p>}
      {detail && <SessionSettlementContent summary={summarizeOnlineSession(detail)} />}
    </section>
  </main>;
}

export default function SessionDetailPage() {
  return <OnlineAuthGate title="Session settlement" backHref="/history"><SessionDetailPageContent /></OnlineAuthGate>;
}
