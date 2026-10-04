"use client";

import { useEffect, useMemo, useState, useRef } from "react";

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
  potLabel?: string;
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
  potLabel,
  players,
  onClose,
  onQuickWin,
  onQuickSplit
}: SettlementModalProps) {
  const { isZh } = useLanguage();
  const eligibleIds = JSON.stringify(players.map((player) => player.id));
  const defaultSelection = useMemo<string[]>(() => (JSON.parse(eligibleIds) as string[]).slice(0, 1), [eligibleIds]);
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultSelection);

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(defaultSelection);
    }
  }, [isOpen, defaultSelection, potLabel]);

  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = dialogRef.current;
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? []);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); }
      if (event.key !== "Tab") return;
      const nodes = focusable();
      if (!nodes.length) return;
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes[nodes.length-1].focus(); }
      else if (!event.shiftKey && document.activeElement === nodes[nodes.length-1]) { event.preventDefault(); nodes[0].focus(); }
    };
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const canQuickWin = selectedIds.length === 1 && status === "pre-settlement";
  const canQuickSplit = selectedIds.length >= 2 && status === "pre-settlement";

  return (
    <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center bg-black/55 px-4 pb-4 pt-12">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={isZh ? "结算弹窗" : "Settlement tool"}
        className="settlement-dialog w-full max-w-[460px] rounded-2xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5 shadow-[0_18px_48px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="mt-1 font-headline text-2xl text-stitch-onSurface">{isZh ? "结算工具" : "Settlement Tool"}</h2>
          </div>
          <Badge variant="primary">{status}</Badge>
        </div>

        <p className="mt-3 text-sm text-stitch-onSurfaceVariant">{isZh ? `当前待分配底池 ${potLabel ?? ""}。选择本池赢家，边池将依次结算。` : `Current pot ${potLabel ?? ""}. Choose its winners; side pots are settled separately.`}</p>
        <div className="mt-4 max-h-60 space-y-2 overflow-y-auto pr-1">
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
                aria-pressed={selected}
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
              "min-h-11 rounded-xl bg-stitch-primary px-3 py-2 text-sm font-label font-semibold text-stitch-onPrimary disabled:cursor-not-allowed disabled:opacity-45",
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
              "min-h-11 rounded-xl bg-stitch-mint/20 px-3 py-2 text-sm font-label font-semibold text-stitch-mint disabled:cursor-not-allowed disabled:opacity-45",
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
