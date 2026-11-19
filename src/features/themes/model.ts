import type { Preferences, TerminalTheme, ThemeAppearance } from "@/shared/preferences/model";

/**
 * The themes the list shows: those made for `appearance`, in the order they were added, narrowed
 * to names that contain the query, whatever its case.
 */
export function themesFor(
  preferences: Preferences,
  appearance: ThemeAppearance,
  query: string,
): readonly TerminalTheme[] {
  const needle = query.trim().toLocaleLowerCase();
  return preferences.themes.filter(
    (theme) =>
      theme.appearance === appearance &&
      (needle === "" || theme.name.toLocaleLowerCase().includes(needle)),
  );
}

/** A built-in theme stays; any other can be removed. */
export const removable = (theme: TerminalTheme) => theme.source.kind !== "built-in";
