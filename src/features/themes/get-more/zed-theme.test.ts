import { describe, expect, it } from "vitest";

import { builtInThemes } from "@/shared/preferences/built-in-themes";

import { readZedThemes } from "./zed-theme";

const oneDarkPro = { kind: "extension", id: "one-dark-pro", name: "One Dark Pro" } as const;

/** The terminal part of One Dark Pro's theme file, as Zed's extension store serves it. */
const oneDarkProFile = JSON.stringify({
  name: "One Dark Pro",
  author: "One Dark Pro: Zed Theme Importer",
  themes: [
    {
      name: "One Dark Pro",
      appearance: "dark",
      style: {
        background: "#23272e",
        "editor.foreground": "#abb2bf",
        text: null,
        "terminal.background": "#23272e",
        "terminal.foreground": null,
        "terminal.ansi.black": "#3f4451",
        "terminal.ansi.bright_black": "#4f5666",
        "terminal.ansi.red": "#e05561",
        "terminal.ansi.bright_red": "#ff616e",
        "terminal.ansi.green": "#8cc265",
        "terminal.ansi.bright_green": "#a5e075",
        "terminal.ansi.yellow": "#d18f52",
        "terminal.ansi.bright_yellow": "#f0a45d",
        "terminal.ansi.blue": "#4aa5f0",
        "terminal.ansi.bright_blue": "#4dc4ff",
        "terminal.ansi.magenta": "#c162de",
        "terminal.ansi.bright_magenta": "#de73ff",
        "terminal.ansi.cyan": "#42b3c2",
        "terminal.ansi.bright_cyan": "#4cd1e0",
        "terminal.ansi.white": "#d7dae0",
        "terminal.ansi.bright_white": "#e6e6e6",
        players: [{ cursor: "#74ade8ff", background: "#74ade8ff" }],
      },
    },
  ],
});

describe("reading a Zed theme file", () => {
  it("takes each theme's terminal colors", () => {
    expect(readZedThemes(oneDarkProFile, oneDarkPro)).toEqual([
      {
        id: "one-dark-pro/One Dark Pro",
        name: "One Dark Pro",
        appearance: "dark",
        source: oneDarkPro,
        colors: {
          background: "#23272e",
          // Its terminal and text colors are empty, so the editor's text color stands in.
          foreground: "#abb2bf",
          // The first player's cursor, without its alpha.
          cursor: "#74ade8",
          normal: [
            "#3f4451",
            "#e05561",
            "#8cc265",
            "#d18f52",
            "#4aa5f0",
            "#c162de",
            "#42b3c2",
            "#d7dae0",
          ],
          bright: [
            "#4f5666",
            "#ff616e",
            "#a5e075",
            "#f0a45d",
            "#4dc4ff",
            "#de73ff",
            "#4cd1e0",
            "#e6e6e6",
          ],
        },
      },
    ]);
  });

  it("reads a file with comments and trailing commas, as Zed does", () => {
    const file = `// Made by hand
    {
      "name": "Paper", /* a family of one */
      "themes": [
        {
          "name": "Paper Light",
          "appearance": "light",
          "style": {
            "terminal.background": "#FFF",
            "terminal.foreground": "#1a1a1aCC",
            "link": "https://example.com/a//b",
          },
        },
      ],
    }`;
    const [paper] = readZedThemes(file, { kind: "file", fileName: "paper.json" });

    expect(paper?.id).toBe("file/Paper/Paper Light");
    // A theme from a file is named after its family.
    expect(paper?.source).toEqual({ kind: "file", name: "Paper" });
    expect(paper?.appearance).toBe("light");
    expect(paper?.colors.background).toBe("#ffffff");
    // 80 % #1a1a1a over white: 0x1a + (0xff - 0x1a) * 51 / 255 = 0x48.
    expect(paper?.colors.foreground).toBe("#484848");
    // With no player, the cursor takes the text color.
    expect(paper?.colors.cursor).toBe("#484848");
    // With no ANSI colors, SpaceTerm's own palette for the appearance stands in.
    expect(paper?.colors.normal).toEqual(builtInThemes.light.colors.normal);
    expect(paper?.colors.bright).toEqual(builtInThemes.light.colors.bright);
  });

  it("reads a file that starts with a byte order mark", () => {
    const file = `\uFEFF${JSON.stringify({
      name: "Paper",
      themes: [{ name: "Paper Light", appearance: "light", style: {} }],
    })}`;
    expect(readZedThemes(file, { kind: "file", fileName: "paper.json" })).toHaveLength(1);
  });

  it("lays a see-through color over the background, and skips a fully clear one", () => {
    const file = JSON.stringify({
      themes: [
        {
          name: "Glass",
          appearance: "dark",
          style: {
            "terminal.background": "#00000000",
            "editor.background": "#202020",
            "terminal.foreground": "#ffffff80",
            "terminal.ansi.red": "#ff000040",
          },
        },
      ],
    });
    const [glass] = readZedThemes(file, { kind: "file", fileName: "glass.json" });

    // The clear terminal background gives way to the editor's.
    expect(glass?.colors.background).toBe("#202020");
    // Half white over #202020: 0x20 + (0xff - 0x20) * 128 / 255 = 0x90.
    expect(glass?.colors.foreground).toBe("#909090");
    // A quarter red over #202020: 0x20 + (0xff - 0x20) * 64 / 255 = 0x58 for red, 0x18 for the rest.
    expect(glass?.colors.normal[1]).toBe("#581818");
  });

  it("finds no theme in a file that is not a Zed theme", () => {
    const file = { kind: "file", fileName: "notes.json" } as const;
    expect(readZedThemes("not json at all", file)).toEqual([]);
    expect(readZedThemes(JSON.stringify({ name: "settings", theme: "One Dark" }), file)).toEqual(
      [],
    );
    expect(
      readZedThemes(
        JSON.stringify({ themes: [{ name: "Half", appearance: "sepia", style: {} }, null] }),
        file,
      ),
    ).toEqual([]);
  });

  it("finds no theme in a Zed icon theme, which has no style", () => {
    const icons = JSON.stringify({
      name: "Material Icons",
      author: "Zed",
      themes: [
        {
          name: "Material Icons Dark",
          appearance: "dark",
          directory_icons: { collapsed: "./icons/folder.svg" },
          file_icons: { rust: { path: "./icons/rust.svg" } },
        },
      ],
    });
    expect(readZedThemes(icons, { kind: "file", fileName: "icons.json" })).toEqual([]);
  });
});
