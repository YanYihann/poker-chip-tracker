import { cn } from "@/lib/cn";

type MainActionItem = {
  id: string;
  topLabel: string;
  mainLabel: string;
  onPress: () => void;
};

type UtilityActionItem = {
  id: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

type BottomActionPanelProps = {
  mainActions: MainActionItem[];
  utilityActions: UtilityActionItem[];
  canOpenSettlement: boolean;
  onOpenSettlement: () => void;
};

export function BottomActionPanel({
  mainActions,
  utilityActions,
  canOpenSettlement,
  onOpenSettlement
}: BottomActionPanelProps) {
  return (
    <section className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 rounded-t-[28px] border-t border-stitch-primary/10 bg-stitch-surface-container/95 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
      <div className="flex items-center justify-center gap-2">
        {utilityActions.map((action) => (
          <button
            key={action.id}
            type="button"
            className={cn(
              "rounded-full border border-stitch-outlineVariant/20 px-3 py-1 text-[11px] font-label text-stitch-onSurfaceVariant transition",
              action.disabled ? "cursor-not-allowed opacity-40" : "hover:bg-stitch-surfaceBright/50"
            )}
            onClick={action.onPress}
            disabled={action.disabled}
          >
            {action.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {mainActions.length > 0 ? (
          mainActions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={cn(
                "flex h-16 flex-col items-center justify-center rounded-2xl border px-2 text-center transition active:scale-95",
                action.id === "all-in"
                  ? "border-stitch-primary/40 bg-stitch-surfaceContainerHighest text-stitch-primary"
                  : action.id === "bet" || action.id === "raise"
                    ? "border-stitch-primary/20 bg-gradient-to-b from-stitch-primary to-stitch-primaryContainer text-stitch-onPrimary shadow-[0_10px_30px_rgba(242,202,80,0.3)]"
                    : action.id === "fold"
                      ? "border-stitch-tertiary/25 bg-stitch-tertiary/10 text-stitch-tertiary"
                      : "border-stitch-mint/25 bg-stitch-surfaceContainerHighest text-stitch-mint"
              )}
              onClick={action.onPress}
            >
              <span className="font-label text-[9px] uppercase tracking-[0.2em] opacity-80">{action.topLabel}</span>
              <span className="mt-1 font-headline text-base font-bold italic">{action.mainLabel}</span>
            </button>
          ))
        ) : (
          <div className="col-span-4 rounded-2xl border border-stitch-outlineVariant/25 bg-stitch-surfaceContainerHigh p-3 text-center text-xs text-stitch-onSurfaceVariant">
            当前阶段无可执行下注动作
          </div>
        )}
      </div>

      {canOpenSettlement ? (
        <button
          type="button"
          className="mt-3 w-full rounded-2xl bg-stitch-primary px-4 py-3 text-sm font-label font-semibold uppercase tracking-[0.14em] text-stitch-onPrimary transition hover:brightness-105"
          onClick={onOpenSettlement}
        >
          打开结算面板
        </button>
      ) : null}
    </section>
  );
}
