"use client";

import { OnlineAuthGate } from "@/components/auth/online-auth-gate";
import { useLanguage } from "@/components/i18n/language-provider";
import { PageShell } from "@/components/layout/page-shell";
import { useMatchmaking } from "@/features/matchmaking/use-matchmaking";

function Matchmaking() {
  const { isZh, localeTag } = useLanguage();
  const { match, settings, busy, error, elapsed, start, cancel } = useMatchmaking();
  const waiting = match.status === "waiting";
  const matched = match.status === "matched";
  const number = (value: number | undefined) => value === undefined ? "—" : value.toLocaleString(localeTag);
  const errorCopy = error === "connection"
    ? (isZh ? "连接中断，正在重试…" : "Connection interrupted. Retrying…")
    : error === "cancel"
      ? (isZh ? "无法取消，请重试。" : "Could not cancel. Please try again.")
      : error === "expired"
        ? (isZh ? "匹配已暂停，请重新开始。" : "Search paused. Please start again.")
        : (isZh ? "暂时无法匹配，请重试。" : "Matching is unavailable. Please try again.");
  return <PageShell title={isZh ? "随机匹配" : "Quick match"} backHref="/online" className="match-shell">
    <section className="match-panel" aria-label={isZh ? "线上双人匹配" : "Online heads-up match"}>
      <dl className="match-rules">
        <div><dt>{isZh ? "人数" : "Players"}</dt><dd>{number(settings?.maxPlayers)}</dd></div>
        <div><dt>{isZh ? "起始筹码" : "Starting chips"}</dt><dd>{number(settings?.startingStack)}</dd></div>
        <div><dt>{isZh ? "盲注" : "Blinds"}</dt><dd>{settings ? `${number(settings.smallBlind)} / ${number(settings.bigBlind)}` : "—"}</dd></div>
      </dl>
      <div className="match-search-state">
        <p role="status">{matched ? (isZh ? "正在进入牌桌…" : "Entering table…") : waiting ? (isZh ? "正在寻找对手…" : "Searching for an opponent…") : busy ? (isZh ? "正在连接…" : "Connecting…") : (isZh ? "随机对手 · 线上发牌" : "Random opponent · Online dealing")}</p>
        {waiting && <time aria-label={isZh ? "已等待时间" : "Time waiting"} dateTime={`PT${elapsed}S`}>{Math.floor(elapsed / 60).toString().padStart(2, "0")}:{(elapsed % 60).toString().padStart(2, "0")}</time>}
      </div>
      {error && <p role="alert" className="match-error">{errorCopy}</p>}
      {waiting ? <button className="button-secondary match-control" type="button" disabled={busy} onClick={() => { void cancel(); }}>{busy ? (isZh ? "正在取消…" : "Cancelling…") : (isZh ? "取消匹配" : "Cancel search")}</button>
        : <button className="button-primary match-control" type="button" disabled={busy || matched} onClick={() => { void start(); }}>{busy ? (isZh ? "正在连接…" : "Connecting…") : matched ? (isZh ? "正在进入…" : "Entering…") : (isZh ? "开始匹配" : "Find opponent")}</button>}
    </section>
  </PageShell>;
}

export default function MatchPage() {
  const { isZh } = useLanguage();
  return <OnlineAuthGate title={isZh ? "随机匹配" : "Quick match"} backHref="/online"><Matchmaking /></OnlineAuthGate>;
}
