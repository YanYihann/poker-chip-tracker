"use client";

import { useEffect, useMemo, useState } from "react";

import { useLanguage } from "@/components/i18n/language-provider";
import { Badge } from "@/components/ui/badge";
import type { HandStatus } from "@/types/domain";

type SettlementPlayerModel = {
  id: string;
  name: string;
  stackLabel: string;
  status: string;
};

type SettlementModalProps = {
  isOpen: boolean;
  status: HandStatus;
  players: SettlementPlayerModel[];
  canUndo: boolean;
  canReopen: boolean;
  onClose: () => void;
  onQuickWin: (winnerId: string) => void;
  onQuickSplit: (winnerIds: string[]) => void;
  onUndo: () => void;
  onEditHand: () => void;
  onReopenSettlement: () => void;
};

export function SettlementModalPlaceholder({
  isOpen,
  status,
  players,
  onClose,
  onQuickWin,
  onQuickSplit
}: SettlementModalProps) {
  const { isZh } = useLanguage();
  const defaultSelection = useMemo(() => players.slice(0, 2).map((player) => player.id), [players]);
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultSelection);

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(defaultSelection);
    }
  }, [isOpen, defaultSelection]);

  if (!isOpen) {
    return null;
  }

  const canQuickWin = selectedIds.length >= 1;
  const canQuickSplit = selectedIds.length >= 2;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 px-4 pb-4 pt-12">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="结算弹窗"
        className="w-full max-w-[460px] rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5 shadow-[0_18px_48px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-label text-[10px] uppercase tracking-[0.2em] text-stitch-onSurfaceVariant">Settlement</p>
            <h2 className="mt-1 font-headline text-2xl text-stitch-onSurface">{isZh ? "结算工具" : "Settlement Tool"}</h2>
          </div>
          <Badge variant="primary">{status}</Badge>
        </div>

        <div className="mt-4 max-h-44 space-y-2 overflow-y-auto pr-1">
          {players.map((player) => {
            const selected = selectedIds.includes(player.id);

            return (
              <button
                key={player.id}
                type="button"
                className={[
                  "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition",
                  selected
                    ? "border-stitch-mint/40 bg-stitch-mint/10"
                    : "border-stitch-outlineVariant/35 bg-stitch-surfaceContainerHigh"
                ].join(" ")}
                onClick={() => {
                  setSelectedIds((prev) =>
                    prev.includes(player.id)
                      ? prev.filter((id) => id !== player.id)
                      : [...prev, player.id]
                  );
                }}
              >
                <div>
                  <p className="text-sm font-semibold text-stitch-onSurface">{player.name}</p>
                  <p className="text-xs text-stitch-onSurfaceVariant">{player.stackLabel}</p>
                </div>
                <Badge variant={selected ? "mint" : "neutral"} size="sm">
                  {selected ? (isZh ? "已选中" : "Selected") : player.status}
                </Badge>
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            className={[
              "rounded-xl bg-stitch-primary px-3 py-2 text-sm font-label font-semibold text-stitch-onPrimary disabled:cursor-not-allowed disabled:opacity-45",
              isZh ? "" : "uppercase tracking-[0.14em]"
            ].join(" ")}
            disabled={!canQuickWin}
            onClick={() => onQuickWin(selectedIds[0])}
          >
            {isZh ? "胜出" : "Win"}
          </button>
          <button
            type="button"
            className={[
              "rounded-xl bg-stitch-mint/20 px-3 py-2 text-sm font-label font-semibold text-stitch-mint disabled:cursor-not-allowed disabled:opacity-45",
              isZh ? "" : "uppercase tracking-[0.14em]"
            ].join(" ")}
            disabled={!canQuickSplit}
            onClick={() => onQuickSplit(selectedIds)}
          >
            {isZh ? "平分" : "Split"}
          </button>
        </div>

        <button
          type="button"
          className="mt-3 w-full rounded-xl border border-stitch-outlineVariant/35 bg-stitch-surfaceContainerHigh px-4 py-2 text-sm text-stitch-onSurface"
          onClick={onClose}
        >
          {isZh ? "关闭" : "Close"}
        </button>
      </section>
    </div>
  );
}
