import { Color } from "expo-router";

import type { useColors as Contract, Colors } from "./colors";

/** Semantic colors resolve again on their own when the appearance changes, so one object serves. */
const colors: Colors = {
  background: Color.ios.systemBackground,
  groupedBackground: Color.ios.systemGroupedBackground,
  groupedRow: Color.ios.secondarySystemGroupedBackground,
  text: Color.ios.label,
  secondaryText: Color.ios.secondaryLabel,
  separator: Color.ios.separator,
  tint: Color.ios.systemBlue,
  error: Color.ios.systemRed,
};

export function useColors(): Colors {
  return colors;
}

useColors satisfies typeof Contract;
