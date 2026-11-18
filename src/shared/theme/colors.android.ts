import { getMaterialColors, type MaterialColors } from "@expo/ui/jetpack-compose";
import { useColorScheme } from "react-native";

import type { useColors as Contract, Colors } from "./colors";

type Scheme = "light" | "dark";

/**
 * Reading the palette is a blocking native call, and `@expo/ui` caches only seeded palettes
 * (https://github.com/expo/expo/issues/50477). So each scheme is read once per launch; a new
 * wallpaper palette shows after a restart.
 */
const palettes = new Map<Scheme, Colors>();

/**
 * Material color roles, resolved for the current scheme. The native header keeps a
 * `PlatformColor` it has resolved once, so `Color.android.dynamic` would leave it in the old scheme.
 */
export function useColors(): Colors {
  const scheme: Scheme = useColorScheme() === "dark" ? "dark" : "light";
  let colors = palettes.get(scheme);
  if (colors === undefined) {
    colors = toColors(getMaterialColors({ scheme }));
    palettes.set(scheme, colors);
  }
  return colors;
}

useColors satisfies typeof Contract;

function toColors(palette: MaterialColors): Colors {
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
 * `getMaterialColors()` returns `#RRGGBBAA`. The native header reads 8-digit hex as `#AARRGGBB`
 * and ignores `rgba()` strings, so pass `#RRGGBB`. Every role used here is opaque.
 */
function hex(color: string): string {
  return color.slice(0, 7);
}
