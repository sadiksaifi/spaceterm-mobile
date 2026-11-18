import type { ColorValue } from "react-native";

/**
 * The app's color roles, one name per role on both platforms. Each resolves to a system color:
 * an iOS semantic color or a Material color role (DESIGN.md, "Colors and icons").
 *
 * A role that exists on one platform only, such as a Material tonal container, comes straight
 * from that platform's API: `Color.ios` from expo-router, or `useMaterialColors()` from
 * `@expo/ui/jetpack-compose`.
 */
export type Colors = {
  /** A plain screen. */
  background: ColorValue;
  /** A screen of grouped rows. */
  groupedBackground: ColorValue;
  /** A row or card on the grouped background. */
  groupedRow: ColorValue;
  text: ColorValue;
  secondaryText: ColorValue;
  separator: ColorValue;
  tint: ColorValue;
  error: ColorValue;
};

/** The color roles for the current appearance. */
export function useColors(): Colors;
