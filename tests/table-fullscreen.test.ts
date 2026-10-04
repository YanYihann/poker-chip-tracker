import assert from "node:assert/strict";
import test from "node:test";
import { requestTableFullscreen, releaseTableFullscreen } from "../src/lib/table-fullscreen";

test("fullscreen is optional, only requested once, and exits only a table-owned session", async () => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  let mobile = true;
  let calls = 0;
  let exits = 0;
  let deny = false;
  const root = { requestFullscreen: async () => { calls++; if (deny) throw new Error("Denied"); doc.fullscreenElement = root; } };
  const doc = { fullscreenEnabled: true, fullscreenElement: null as object | null, documentElement: root, exitFullscreen: async () => { exits++; doc.fullscreenElement = null; } };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { matchMedia: () => ({ matches: mobile }) } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
  try {
    mobile = false; await requestTableFullscreen(); assert.equal(calls, 0);
    mobile = true; doc.fullscreenEnabled = false; await requestTableFullscreen(); assert.equal(calls, 0);
    doc.fullscreenEnabled = true; deny = true;
    await requestTableFullscreen(); await requestTableFullscreen(); assert.equal(calls, 1);
    releaseTableFullscreen(); assert.equal(exits, 0);
    deny = false; await requestTableFullscreen(); assert.equal(calls, 2);
    // The user exits manually; subsequent betting must not force fullscreen again.
    doc.fullscreenElement = null; await requestTableFullscreen(); assert.equal(calls, 2);
    releaseTableFullscreen(); assert.equal(exits, 0);
    await requestTableFullscreen(); releaseTableFullscreen(); assert.equal(exits, 1);
    doc.fullscreenElement = {}; await requestTableFullscreen(); releaseTableFullscreen(); assert.equal(exits, 1);
    doc.fullscreenElement = null;
    const pending = requestTableFullscreen(); releaseTableFullscreen(); await pending;
    assert.equal(doc.fullscreenElement, null, "leaving before a pending request resolves releases fullscreen");
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument); else Reflect.deleteProperty(globalThis, "document");
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow); else Reflect.deleteProperty(globalThis, "window");
  }
});
