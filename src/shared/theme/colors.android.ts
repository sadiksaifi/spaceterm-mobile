import { useMaterialColors } from "@expo/ui/jetpack-compose";
import { useColorScheme } from "react-native";

import type { Colors } from "./colors";

/**
 * Material color roles, resolved for the current scheme. The native header keeps a
 * `PlatformColor` it has resolved once, so `Color.android.dynamic` would leave it in the old scheme.
 */
export function useColors(): Colors {
  const palette = useMaterialColors({
    colorScheme: useColorScheme() === "dark" ? "dark" : "light",
  });
  return {
    background: hex(palette.surface),
    groupedBackground: hex(palette.surface),
    groupedRow: hex(palette.surfaceContainer),
    text: hex(palette.onSurface),
    secondaryText: hex(palette.onSurfaceVariant),
    separator: hex(palette.outlineVariant),
    tint: hex(palette.primary),
    error: hex(palette.error),
  };
}

/**
 * `useMaterialColors()` returns `#RRGGBBAA`. The native header reads 8-digit hex as `#AARRGGBB`
 * and ignores `rgba()` strings, so pass `#RRGGBB`. Every role used here is opaque.
 */
function hex(color: string): string {
  return color.slice(0, 7);
}
