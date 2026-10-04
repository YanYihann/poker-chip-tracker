"use client";

import { useEffect, useState } from "react";
import { MOBILE_TABLE_QUERY, releaseTableFullscreen, requestTableFullscreen } from "@/lib/table-fullscreen";

export function useMobileTableViewport(active: boolean): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(MOBILE_TABLE_QUERY);
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!active || !mobile) return;
    const root = document.documentElement;
    const update = () => {
      const viewport = window.visualViewport;
      // Respect accessibility zoom: only track browser chrome / keyboard changes.
      const unzoomed = !viewport || viewport.scale === 1;
      root.style.setProperty("--table-viewport-height", `${unzoomed && viewport ? viewport.height : window.innerHeight}px`);
      root.style.setProperty("--table-viewport-top", `${unzoomed && viewport ? viewport.offsetTop : 0}px`);
    };
    root.classList.add("mobile-table-open");
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    const enterFullscreen = () => { void requestTableFullscreen(); };
    document.addEventListener("pointerup", enterFullscreen, { once: true });
    document.addEventListener("keydown", enterFullscreen, { once: true });
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      document.removeEventListener("pointerup", enterFullscreen);
      document.removeEventListener("keydown", enterFullscreen);
      root.classList.remove("mobile-table-open");
      root.style.removeProperty("--table-viewport-height");
      root.style.removeProperty("--table-viewport-top");
      releaseTableFullscreen();
      window.scrollTo(0, 0);
    };
  }, [active, mobile]);
  return active && mobile;
}
