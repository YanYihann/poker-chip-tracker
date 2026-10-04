export const MOBILE_TABLE_QUERY = "(max-width: 767px), (max-width: 1023px) and (max-height: 600px)";

let requested = false;
let owned = false;
let generation = 0;

// Invoke inside the Start/Resume gesture; automatically joined guests get one
// attempt on their first table interaction instead.
export async function requestTableFullscreen(): Promise<void> {
  if (typeof document === "undefined" || !window.matchMedia(MOBILE_TABLE_QUERY).matches ||
      !document.fullscreenEnabled || document.fullscreenElement || requested) return;
  requested = true;
  const current = generation;
  try {
    await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    if (current !== generation) {
      if (document.fullscreenElement === document.documentElement) void document.exitFullscreen().catch(() => undefined);
      return;
    }
    owned = true;
  } catch {
    // Browser policies and iPhone browsers may reject this. The viewport layout
    // also works with browser chrome visible.
  }
}

export function releaseTableFullscreen(): void {
  generation++;
  requested = false;
  if (owned && document.fullscreenElement === document.documentElement) {
    void document.exitFullscreen().catch(() => undefined);
  }
  owned = false;
}
