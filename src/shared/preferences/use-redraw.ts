import { useState } from "react";

import type { Saved } from "./store";

/**
 * A key for a screen of native controls, and a check for each change it saves. A native control
 * moves before its change is saved, so a change that was not saved draws the screen again, which
 * puts each control back where the saved preferences are.
 */
export function useRedrawWhenNotSaved(): { key: number; check: (saved: Saved) => void } {
  const [key, setKey] = useState(0);
  return {
    key,
    check: (saved) => {
      if (saved === "not-saved") setKey((count) => count + 1);
    },
  };
}
