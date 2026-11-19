import type { Appearance, TerminalTheme, ThemeAppearance } from "@/shared/preferences/model";
import { cased } from "@/shared/text";

export const text = {
  title: "Themes",
  edit: "Edit",
  done: "Done",
  appearance: "Appearance",
  light: "Light",
  dark: "Dark",
  automatic: "Automatic",
  currentTheme: cased("Current Theme", "Current theme"),
  cardsFooter: "Select Light or Dark, then choose a Terminal Theme for it.",
  themesFor: (appearance: ThemeAppearance) =>
    appearance === "light"
      ? cased("Light Themes", "Light themes")
      : cased("Dark Themes", "Dark themes"),
  getMoreThemes: cased("Get More Themes…", "Get more themes"),
  /** The iOS search field placeholder; the toolbar has no room for more. */
  search: "Search",
  searchThemes: "Search themes",
  back: "Back",
  clearText: "Clear text",
  cancel: "Cancel",
  remove: "Remove",
  removeLabel: (name: string) => `Remove ${name}`,
  /** iOS sets a name in an alert title in quotation marks; Android does not. */
  removeTitle: (name: string) => cased(`Remove “${name}”?`, `Remove ${name}?`),
  noResultsTitle: (query: string) => cased(`No Results for “${query}”`, `No results for ${query}`),
  noResultsBody: "Check the spelling or try a new search.",
};

/** The Appearance choices, in the order they show. */
export const appearances: readonly { value: Appearance; label: string }[] = [
  { value: "light", label: text.light },
  { value: "dark", label: text.dark },
  { value: "automatic", label: text.automatic },
];

/** Where a theme came from, as its row says it. */
export function themeSource(theme: TerminalTheme): string {
  switch (theme.source.kind) {
    case "built-in":
      return cased("Built In", "Built in");
    case "extension":
      return `${theme.source.name} · Zed extension`;
    case "file":
      return `${theme.source.name} · Imported`;
  }
}
