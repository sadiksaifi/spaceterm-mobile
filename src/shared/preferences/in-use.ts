import { builtInThemes } from "./built-in-themes";
import type { Preferences, TerminalTheme, ThemeAppearance } from "./model";

/** The system's appearance, as React Native reports it; unknown reads as light. */
export type SystemScheme = "light" | "dark" | "unspecified" | null | undefined;

/** The appearance whose theme terminals use: the one chosen, or under Automatic the system's. */
export function appearanceInUse(appearance: Preferences["appearance"], system: SystemScheme) {
  if (appearance !== "automatic") return appearance;
  return system === "dark" ? "dark" : "light";
}

/** The Terminal Theme terminals use now. */
export function themeInUse(preferences: Preferences, system: SystemScheme): TerminalTheme {
  return chosenTheme(preferences, appearanceInUse(preferences.appearance, system));
}

/** The theme chosen for `appearance`. */
export function chosenTheme(preferences: Preferences, appearance: ThemeAppearance): TerminalTheme {
  const id = preferences.chosen[appearance];
  return preferences.themes.find((theme) => theme.id === id) ?? builtInThemes[appearance];
}
