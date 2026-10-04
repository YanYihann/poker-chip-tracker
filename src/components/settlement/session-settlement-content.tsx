"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import { buildChipTransfers, type SessionSummary } from "@/features/settlement/session-summary";

export function SessionSettlementContent({ summary }: { summary: SessionSummary }) {
  const { isZh, localeTag } = useLanguage();
  const chips = (value: number) => new Intl.NumberFormat(localeTag, { maximumFractionDigits: 0 }).format(value);
  const signed = (value: number) => `${value > 0 ? "+" : ""}${chips(value)}`;
  const transfers = buildChipTransfers(summary.players);
  const names = new Map(summary.players.map((p) => [p.id, p.name]));
  const validBalance = summary.players.every((p) => Number.isSafeInteger(p.netChange)) && summary.players.reduce((sum, p) => sum + p.netChange, 0) === 0;
  return <div className="session-settlement-content">
    <div className="session-report-meta"><strong>{summary.name}</strong><span>{summary.hands.length} {isZh ? "手" : "hands"} · {new Date(summary.endedAtIso).toLocaleString(localeTag)}</span></div>
    {!summary.historyComplete && <p className="session-report-note">{isZh ? "旧快照没有完整历史。本面板仅统计恢复后记录的牌局，起始筹码按恢复时的余额计算。" : "The older snapshot has no full history. This report covers newly recorded hands, using the restored balances as starting chips."}</p>}
    <section aria-labelledby="session-transfers-title">
      <h3 id="session-transfers-title">{isZh ? "筹码转移" : "Chip transfers"}</h3>
      <p className="session-section-caption">{isZh ? "按整场净盈亏计算。" : "Based on each player's session net change."}</p>
      {!validBalance ? <p className="session-report-note">{isZh ? "筹码总额不一致，无法计算转移方案。" : "The chip totals do not balance. Transfers cannot be calculated."}</p> : transfers.length ? <ul className="session-transfers">
        {transfers.map((transfer, index) => <li key={index}><span>{names.get(transfer.fromPlayerId)}</span><span aria-hidden="true">→</span><span>{names.get(transfer.toPlayerId)}</span><strong>{chips(transfer.amount)} <small>{isZh ? "筹码" : "chips"}</small></strong></li>)}
      </ul> : <p className="session-empty">{isZh ? "无需转移筹码。" : "No chips to transfer."}</p>}
    </section>
    <section aria-labelledby="session-players-title">
      <h3 id="session-players-title">{isZh ? "玩家结果" : "Player results"}</h3>
      <div className="session-player-head" aria-hidden="true"><span>{isZh ? "玩家" : "Player"}</span><span>{isZh ? "赢牌手数" : "Hands won"}</span><span>{isZh ? "最终筹码" : "Final chips"}</span><span>{isZh ? "净盈亏" : "Net"}</span></div>
      <ul className="session-player-results">{summary.players.map((player) => <li key={player.id}>
        <div className="session-player-name"><strong>{player.name}</strong><small>{isZh ? "起始" : "Start"} {chips(player.startStack)}</small></div>
        <div><small>{isZh ? "赢牌手数" : "Hands won"}</small><strong>{player.handsWon}</strong></div>
        <div><small>{isZh ? "最终筹码" : "Final chips"}</small><strong>{chips(player.endStack)}</strong></div>
        <div data-result={player.netChange < 0 ? "loss" : player.netChange > 0 ? "win" : "even"}><small>{isZh ? "净盈亏" : "Net"}</small><strong>{signed(player.netChange)}</strong></div>
      </li>)}</ul>
    </section>
    <section aria-labelledby="session-hands-title">
      <h3 id="session-hands-title">{isZh ? "逐手记录" : "Hand history"}</h3>
      <p className="session-section-caption">{isZh ? "点击一手查看所有玩家的详细盈亏。赢牌手数按获得底池的手数统计，平分也计一手。" : "Open a hand for each player's result. Winning any pot counts as one hand won; splits count for each winner."}</p>
      <div className="session-hands">{summary.hands.map((hand) => {
        const winners = hand.results.filter((result) => result.amountWon > 0);
        return <details key={hand.handNumber} className="session-hand">
          <summary><span className="session-hand-number">{isZh ? `第 ${hand.handNumber} 手` : `Hand ${hand.handNumber}`}</span><span className="session-hand-winners">{winners.map((winner) => <span key={winner.playerId}><strong>{winner.name}</strong> {isZh ? "赢得" : "collected"} {chips(winner.amountWon)} <em data-result={winner.netChange < 0 ? "loss" : "win"}>({signed(winner.netChange)})</em></span>)}</span><span className="session-hand-chevron" aria-hidden="true">⌄</span></summary>
          <div className="session-hand-details"><p>{isZh ? "底池" : "Pot"} {chips(hand.potTotal)} {isZh ? "筹码" : "chips"}</p><div className="session-hand-scroll"><table><thead><tr><th>{isZh ? "玩家" : "Player"}</th><th>{isZh ? "赢得底池" : "Collected"}</th><th>{isZh ? "净盈亏" : "Net"}</th><th>{isZh ? "手末筹码" : "End chips"}</th></tr></thead><tbody>{hand.results.map((result) => <tr key={result.playerId}><th scope="row">{result.name}</th><td>{chips(result.amountWon)}</td><td data-result={result.netChange < 0 ? "loss" : result.netChange > 0 ? "win" : "even"}>{signed(result.netChange)}</td><td>{chips(result.endStack)}</td></tr>)}</tbody></table></div></div>
        </details>;
      })}</div>
      {!summary.hands.length && <p className="session-empty">{isZh ? "没有逐手记录。" : "No hand records available."}</p>}
    </section>
  </div>;
}
