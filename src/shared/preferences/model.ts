/** Light or Dark: a Terminal Theme is made for one, and each has its own chosen theme. */
export type ThemeAppearance = "light" | "dark";

/** Which chosen theme the terminal uses: Light's, Dark's, or the one matching the system. */
export type Appearance = ThemeAppearance | "automatic";

/** Black, red, green, yellow, blue, magenta, cyan and white, as `#rrggbb`. */
export type AnsiColors = readonly [string, string, string, string, string, string, string, string];

/** The colors a terminal draws with, as `#rrggbb`. */
export type TerminalColors = {
  background: string;
  foreground: string;
  cursor: string;
  normal: AnsiColors;
  bright: AnsiColors;
};

/** Where a theme came from, which decides whether it can be removed and what its row says. */
export type ThemeSource =
  | { kind: "built-in" }
  /** A Zed extension from Get More Themes, which may hold several themes. */
  | { kind: "extension"; id: string; name: string }
  /** A Zed theme file picked with Import from File, named after the family it holds. */
  | { kind: "file"; name: string };

/** A Terminal Theme on this device. It colors terminals only, never the app around them. */
export type TerminalTheme = {
  id: string;
  name: string;
  appearance: ThemeAppearance;
  source: ThemeSource;
  colors: TerminalColors;
};

export type PrivacySetting =
  | "notifications"
  | "terminalAttention"
  | "programsCopyText"
  | "programsReadClipboard";

/** What this device keeps for its terminals across launches. */
export type Preferences = {
  /** Terminal text size, in points. */
  fontSize: number;
  privacy: Readonly<Record<PrivacySetting, boolean>>;
  appearance: Appearance;
  /** The id of the theme chosen for each appearance. */
  chosen: Readonly<Record<ThemeAppearance, string>>;
  /** The built-in themes, then the added ones in the order they were added. */
  themes: readonly TerminalTheme[];
};
