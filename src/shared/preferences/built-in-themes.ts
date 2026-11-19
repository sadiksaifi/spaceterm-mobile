import type { TerminalTheme, ThemeAppearance } from "./model";

/** SpaceTerm's own palettes, the same as SpaceTerm Desktop's. */
export const builtInThemes: Readonly<Record<ThemeAppearance, TerminalTheme>> = {
  light: {
    id: "spaceterm-light",
    name: "SpaceTerm Light",
    appearance: "light",
    source: { kind: "built-in" },
    colors: {
      background: "#fdfdfd",
      foreground: "#242424",
      cursor: "#3a3a3a",
      normal: [
        "#2e2e2e",
        "#b3313c",
        "#2a7a3b",
        "#8c5a00",
        "#2d62a8",
        "#8a4ba0",
        "#16767e",
        "#6e6e6e",
      ],
      bright: [
        "#767676",
        "#cc4450",
        "#3a9450",
        "#a86c0a",
        "#3f7cc8",
        "#a566bb",
        "#258f98",
        "#242424",
      ],
    },
  },
  dark: {
    id: "spaceterm-dark",
    name: "SpaceTerm Dark",
    appearance: "dark",
    source: { kind: "built-in" },
    colors: {
      background: "#191919",
      foreground: "#d8d8d8",
      cursor: "#d8d8d8",
      normal: [
        "#2e2e2e",
        "#e5696b",
        "#83c07e",
        "#e6b85c",
        "#5fa3f0",
        "#c387d9",
        "#5fc0c8",
        "#c8c8c8",
      ],
      bright: [
        "#6e6e6e",
        "#f28a8b",
        "#9fd39a",
        "#f0cb80",
        "#84b9f6",
        "#d5a4e6",
        "#82d3d9",
        "#f0f0f0",
      ],
    },
  },
};
