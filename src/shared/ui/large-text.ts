import { useWindowDimensions } from "react-native";

/**
 * The font scale from which a row stacks its parts instead of fitting them side by side. It falls
 * between the largest standard size and the first accessibility size: iOS Accessibility Medium
 * is 1.79, Android's largest steps are 1.8 and 2.0.
 */
const STACKED_ROW_SCALE = 1.75;

/** Whether text is set at an accessibility size, where a row shows one part per line. */
export function useLargeText(): boolean {
  return useWindowDimensions().fontScale >= STACKED_ROW_SCALE;
}
