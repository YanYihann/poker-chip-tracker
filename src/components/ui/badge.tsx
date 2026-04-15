import { cn } from "@/lib/cn";

type BadgeVariant = "neutral" | "primary" | "mint" | "tertiary";
type BadgeSize = "sm" | "md";

type BadgeProps = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
};

const variantStyles: Record<BadgeVariant, string> = {
  neutral: "bg-stitch-surface-container-high text-stitch-on-surface-variant border border-stitch-outlineVariant/50",
  primary: "bg-stitch-primary/15 text-stitch-primary border border-stitch-primary/30",
  mint: "bg-stitch-mint/15 text-stitch-mint border border-stitch-mint/30",
  tertiary: "bg-stitch-tertiary/15 text-stitch-tertiary border border-stitch-tertiary/30"
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-1.5 py-0.5 text-[9px] tracking-[0.14em]",
  md: "px-2 py-0.5 text-[10px] tracking-[0.16em]"
};

export function Badge({ children, variant = "neutral", size = "md", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full font-label font-semibold uppercase leading-none",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
}
