import type { TerminalColors } from "@/shared/preferences/model";

/** The terminal color a piece of the preview takes. */
export type PreviewRole =
  | "foreground"
  | "blue"
  | "magenta"
  | "green"
  | "brightBlue"
  | "red"
  | "cursor";

export function roleColor(colors: TerminalColors, role: PreviewRole): string {
  switch (role) {
    case "foreground":
      return colors.foreground;
    case "red":
      return colors.normal[1];
    case "green":
      return colors.normal[2];
    case "blue":
      return colors.normal[4];
    case "magenta":
      return colors.normal[5];
    case "brightBlue":
      return colors.bright[4];
    case "cursor":
      return colors.cursor;
  }
}

const prompt = [
  { text: "~/spaceterm", role: "blue" },
  { text: " main", role: "magenta" },
  { text: " ❯", role: "green" },
] as const;

/** A short shell session in a theme's colors, line by line, as the design draws it. */
export const PREVIEW_LINES: readonly (readonly { text: string; role: PreviewRole }[])[] = [
  [...prompt, { text: " ls", role: "foreground" }],
  [
    { text: "docs  src  ", role: "brightBlue" },
    { text: "Cargo.toml  README.md", role: "foreground" },
  ],
  [...prompt, { text: " git status -s", role: "foreground" }],
  [
    { text: " M ", role: "red" },
    { text: "src/main.rs", role: "foreground" },
  ],
  [
    { text: "A  ", role: "green" },
    { text: "src/theme.rs", role: "foreground" },
  ],
  [...prompt, { text: " ", role: "foreground" }, { text: "█", role: "cursor" }],
];

/** The bars of a list row's thumbnail, row by row: each a width in points and a color role. */
export const THUMBNAIL_BARS: readonly (readonly { width: number; role: PreviewRole }[])[] = [
  [
    { width: 10, role: "blue" },
    { width: 6, role: "magenta" },
    { width: 7, role: "foreground" },
  ],
  [
    { width: 8, role: "brightBlue" },
    { width: 15, role: "foreground" },
  ],
  [
    { width: 4, role: "red" },
    { width: 13, role: "foreground" },
  ],
  [
    { width: 4, role: "green" },
    { width: 11, role: "foreground" },
  ],
];

/** The thumbnail's size, as the design draws it. */
export const THUMBNAIL = { width: 46, height: 36, bar: 3, rowGap: 3, barGap: 2, inset: 8 } as const;

/** The preview's type in the two sizes the design draws: on a card, and alone. */
export const PREVIEW_SIZES = {
  card: { font: 7.5, lineHeight: 11, padding: 10 },
  single: { font: 12, lineHeight: 18, padding: 16 },
} as const;
