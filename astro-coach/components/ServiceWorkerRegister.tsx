"use client";

import { useEffect } from "react";

/** Registers the push-notification service worker on mount. Silently no-ops
 * on unsupported browsers (older Safari, some in-app webviews). */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Non-fatal — push notifications just won't be available
      });
    }
  }, []);

  return null;
}
