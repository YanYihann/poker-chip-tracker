"use client";

import { useLanguage } from "@/components/i18n/language-provider";
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

type AmountControlModel = {
  value: string;
  onValueChange: (next: string) => void;
  onStep: (delta: number) => void;
  helperText?: string;
};

type BottomActionPanelProps = {
  mainActions: MainActionItem[];
  utilityActions: UtilityActionItem[];
  canOpenSettlement: boolean;
  onOpenSettlement: () => void;
  amountControl?: AmountControlModel | null;
  previousActionHint?: string | null;
};

export function BottomActionPanel({
  mainActions,
  utilityActions,
  canOpenSettlement,
  onOpenSettlement,
  amountControl,
  previousActionHint
}: BottomActionPanelProps) {
  const { isZh } = useLanguage();
  const shouldShowEmptyMainActions = mainActions.length === 0 && utilityActions.length === 0 && !canOpenSettlement;

  return (
    <section className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 rounded-t-[22px] border-t border-stitch-primary/10 bg-stitch-surface-container/95 px-2 pb-[max(0.9rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:rounded-t-[28px] sm:px-4 sm:pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pt-3">
      {utilityActions.length > 0 ? (
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
      ) : null}

      {previousActionHint ? (
        <article className="mt-1.5 rounded-lg border border-[#39ff14]/45 bg-[#39ff14]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#8dff72] shadow-[0_0_10px_rgba(57,255,20,0.28)] sm:mt-2">
          {previousActionHint}
        </article>
      ) : null}

      {amountControl ? (
        <div className="mt-1.5 sm:mt-2">
          <div className="grid grid-cols-5 gap-1 rounded-lg border border-stitch-outlineVariant/30 bg-stitch-surfaceContainerHigh/90 p-1 sm:rounded-xl">
            <button
              type="button"
              className="h-7 min-w-0 rounded-md bg-stitch-tertiary/20 px-1 text-[10px] font-semibold text-stitch-tertiary transition hover:brightness-110 sm:h-8 sm:rounded-lg sm:text-[11px]"
              onClick={() => amountControl.onStep(-100)}
            >
              -100
            </button>
            <button
              type="button"
              className="h-7 min-w-0 rounded-md bg-stitch-tertiary/20 px-1 text-[10px] font-semibold text-stitch-tertiary transition hover:brightness-110 sm:h-8 sm:rounded-lg sm:text-[11px]"
              onClick={() => amountControl.onStep(-50)}
            >
              -50
            </button>
            <input
              type="text"
              inputMode="numeric"
              value={amountControl.value}
              onChange={(event) => amountControl.onValueChange(event.target.value)}
              className="h-7 min-w-0 w-full rounded-md border border-stitch-outlineVariant/35 bg-stitch-surfaceContainer px-1 text-center text-[13px] text-stitch-onSurface outline-none focus:border-stitch-primary/50 sm:h-8 sm:rounded-lg sm:text-sm"
            />
            <button
              type="button"
              className="h-7 min-w-0 rounded-md bg-stitch-mint/20 px-1 text-[10px] font-semibold text-stitch-mint transition hover:brightness-110 sm:h-8 sm:rounded-lg sm:text-[11px]"
              onClick={() => amountControl.onStep(50)}
            >
              +50
            </button>
            <button
              type="button"
              className="h-7 min-w-0 rounded-md bg-stitch-mint/20 px-1 text-[10px] font-semibold text-stitch-mint transition hover:brightness-110 sm:h-8 sm:rounded-lg sm:text-[11px]"
              onClick={() => amountControl.onStep(100)}
            >
              +100
            </button>
          </div>

          {amountControl.helperText ? (
            <p className="mt-1 px-1 text-[10px] text-stitch-onSurfaceVariant">{amountControl.helperText}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-1.5 grid grid-cols-4 gap-1.5 sm:mt-2 sm:gap-2">
        {mainActions.length > 0 ? (
          mainActions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={cn(
                "flex h-14 flex-col items-center justify-center rounded-xl border px-1.5 text-center transition active:scale-95 sm:h-16 sm:rounded-2xl sm:px-2",
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
              {!isZh ? (
                <span className="font-label text-[8px] uppercase tracking-[0.16em] opacity-80 sm:text-[9px] sm:tracking-[0.2em]">
                  {action.topLabel}
                </span>
              ) : null}
              <span
                className={cn(
                  "font-headline text-[1.02rem] font-bold italic sm:text-base",
                  !isZh ? "mt-0.5 sm:mt-1" : ""
                )}
              >
                {action.mainLabel}
              </span>
            </button>
          ))
        ) : shouldShowEmptyMainActions ? (
          <div className="col-span-4 rounded-2xl border border-stitch-outlineVariant/25 bg-stitch-surfaceContainerHigh p-3 text-center text-xs text-stitch-onSurfaceVariant">
            {isZh ? "\u5f53\u524d\u65e0\u53ef\u6267\u884c\u64cd\u4f5c" : "No available betting actions in this phase."}
          </div>
        ) : null}
      </div>

      {canOpenSettlement ? (
        <button
          type="button"
          className="mt-3 w-full rounded-2xl bg-stitch-primary px-4 py-3 text-sm font-label font-semibold uppercase tracking-[0.14em] text-stitch-onPrimary transition hover:brightness-105"
          onClick={onOpenSettlement}
        >
          {isZh ? "\u6253\u5f00\u7ed3\u7b97\u9762\u677f" : "Open Settlement"}
        </button>
      ) : null}
    </section>
  );
}
