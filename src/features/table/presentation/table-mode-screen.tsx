"use client";

import { BottomActionPanel } from "@/components/actions/bottom-action-panel";
import { useLanguage } from "@/components/i18n/language-provider";
import { AppTopBar } from "@/components/layout/app-top-bar";
import { SettlementModalPlaceholder } from "@/components/settlement/settlement-modal-placeholder";
import { PokerTable } from "@/components/table/poker-table";
import type { TableModeAdapter } from "@/features/table/mode/types";

type TableModeScreenProps = {
  adapter: TableModeAdapter;
};

const BANNER_CLASS_BY_TONE: Record<NonNullable<TableModeAdapter["banner"]>["tone"], string> = {
  info: "border-stitch-primary/30 bg-stitch-primary/10 text-stitch-primary",
  warning: "border-stitch-tertiary/35 bg-stitch-tertiary/10 text-stitch-tertiary"
};

export function TableModeScreen({ adapter }: TableModeScreenProps) {
  const { isZh, localeTag } = useLanguage();
  const showActionPanel = adapter.showActionPanel !== false;
  const resume = adapter.resume;
  const savedAtLabel =
    resume?.savedAtIso ? new Date(resume.savedAtIso).toLocaleString(localeTag) : null;

  return (
    <main
      className={[
        "mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-stitch-background",
        showActionPanel ? "pb-44" : "pb-8"
      ].join(" ")}
    >
      <AppTopBar
        title={adapter.title}
        playerCount={adapter.playerCount}
        onPlayerCountChange={adapter.onPlayerCountChange}
        backHref={adapter.backHref}
      />

      <section className="flex-1 space-y-3 px-4 pb-4 pt-4">
        {adapter.banner ? (
          <article
            className={[
              "rounded-2xl border p-3 text-xs",
              BANNER_CLASS_BY_TONE[adapter.banner.tone]
            ].join(" ")}
          >
            {adapter.banner.message}
          </article>
        ) : null}

        {resume?.available ? (
          <article className="rounded-2xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-4">
            <h2 className="text-sm font-semibold text-stitch-onSurface">
              {isZh ? "发现本地恢复快照" : "Local Resume Snapshot Found"}
            </h2>
            <p className="mt-1 text-xs text-stitch-onSurfaceVariant">
              {savedAtLabel
                ? isZh
                  ? `保存时间：${savedAtLabel}`
                  : `Saved at: ${savedAtLabel}`
                : isZh
                  ? "可恢复上次本地进度。"
                  : "You can restore the previous local progress."}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="rounded-xl bg-stitch-primary px-3 py-2 text-xs font-semibold text-stitch-onPrimary"
                onClick={resume.onResume}
              >
                {isZh ? "恢复" : "Resume"}
              </button>
              <button
                type="button"
                className="rounded-xl bg-stitch-surfaceContainerHigh px-3 py-2 text-xs text-stitch-onSurfaceVariant"
                onClick={resume.onDiscard}
              >
                {isZh ? "丢弃快照" : "Discard"}
              </button>
            </div>
          </article>
        ) : null}

        <PokerTable
          players={adapter.players}
          potLabel={adapter.potLabel}
          streetLabel={adapter.streetLabel}
          statusLabel={adapter.statusLabel}
          street={adapter.street}
          handKey={adapter.handKey}
        />

        {adapter.supplementaryContent ? adapter.supplementaryContent : null}

        {adapter.statusHint ? (
          <article className="rounded-xl bg-stitch-surfaceContainerHigh px-3 py-2 text-xs text-stitch-onSurfaceVariant">
            {adapter.statusHint}
          </article>
        ) : null}
      </section>

      {showActionPanel ? (
        <BottomActionPanel
          mainActions={adapter.mainActions}
          utilityActions={adapter.utilityActions}
          canOpenSettlement={adapter.canOpenSettlement}
          onOpenSettlement={adapter.onOpenSettlement}
          amountControl={adapter.amountControl}
        />
      ) : null}

      {adapter.settlement ? (
        <SettlementModalPlaceholder
          isOpen={adapter.settlement.isOpen}
          status={adapter.status}
          players={adapter.settlement.players}
          canUndo={adapter.settlement.canUndo}
          canReopen={adapter.settlement.canReopen}
          onClose={adapter.settlement.onClose}
          onQuickWin={adapter.settlement.onQuickWin}
          onQuickSplit={adapter.settlement.onQuickSplit}
          onUndo={adapter.settlement.onUndo}
          onEditHand={adapter.settlement.onEditHand}
          onReopenSettlement={adapter.settlement.onReopenSettlement}
        />
      ) : null}
    </main>
  );
}
