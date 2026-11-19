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
    // With no ANSI colors, SpaceTerm's own normal palette for the appearance stands in.
    expect(paper?.colors.normal).toEqual(builtInThemes.light.colors.normal);
    expect(paper?.colors.bright).toEqual(builtInThemes.light.colors.normal);
  });

  it("falls back to the colors SpaceTerm Desktop falls back to", () => {
    const file = JSON.stringify({
      themes: [
        {
          name: "Partial",
          appearance: "dark",
          style: {
            "terminal.ansi.background": "#102030",
            "editor.background": "#fefefe",
            text: "#aaaaaa",
            "editor.foreground": "#bbbbbb",
            "terminal.ansi.red": "#ff0000",
            "terminal.ansi.bright_green": "#00ff00",
          },
        },
      ],
    });
    const [partial] = readZedThemes(file, { kind: "file", fileName: "partial.json" });

    expect(partial?.colors.background).toBe("#102030");
    expect(partial?.colors.foreground).toBe("#bbbbbb");
    // With no player, the cursor takes the editor's text color.
    expect(partial?.colors.cursor).toBe("#bbbbbb");
    // A bright color the theme leaves out takes its own normal one, then SpaceTerm's.
    expect(partial?.colors.bright[1]).toBe("#ff0000");
    expect(partial?.colors.bright[2]).toBe("#00ff00");
    expect(partial?.colors.bright[4]).toBe(builtInThemes.dark.colors.normal[4]);
  });

  it("passes over a color with space around it, as Desktop does", () => {
    const file = JSON.stringify({
      themes: [
        {
          name: "Padded",
          appearance: "dark",
          style: { "terminal.foreground": " #0000 ", "editor.foreground": "#ffffff" },
        },
      ],
    });
    const [padded] = readZedThemes(file, { kind: "file", fileName: "padded.json" });

    expect(padded?.colors.foreground).toBe("#ffffff");
  });

  it("finds no theme in a file Zed could not read, however lenient", () => {
    const theme = '{ "name": "Paper Light", "appearance": "light", "style": {} }';
    const read = (file: string) => readZedThemes(file, { kind: "file", fileName: "paper.json" });

    expect(read(`{ "themes": [${theme}] }`)).toHaveLength(1);
    expect(read(`{ "themes": [${theme}] } /* never closed`)).toEqual([]);
    expect(
      read(`{ "themes": [{ "name": "Paper", "appearance": "light", "style": {,} }] }`),
    ).toEqual([]);
    expect(read(`{ "themes": [, ${theme}] }`)).toEqual([]);
  });

  it("reads a file that starts with a byte order mark", () => {
    const file = `\uFEFF${JSON.stringify({
      name: "Paper",
      themes: [{ name: "Paper Light", appearance: "light", style: {} }],
    })}`;
    expect(readZedThemes(file, { kind: "file", fileName: "paper.json" })).toHaveLength(1);
  });

  it("lays a see-through color over what is under it, as Desktop does a fully clear one", () => {
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

    // The clear terminal background is still the one chosen, laid over SpaceTerm's own.
    const under = builtInThemes.dark.colors.background;
    expect(glass?.colors.background).toBe(under);
    // Half white and a quarter red, laid over it.
    const mix = (channel: number, color: number, alpha: number) =>
      Math.round(channel + (color - channel) * alpha);
    const [r, g, b] = [1, 3, 5].map((at) => Number.parseInt(under.slice(at, at + 2), 16));
    const hex = (...channels: number[]) =>
      `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
    expect(glass?.colors.foreground).toBe(
      hex(mix(r ?? 0, 255, 128 / 255), mix(g ?? 0, 255, 128 / 255), mix(b ?? 0, 255, 128 / 255)),
    );
    expect(glass?.colors.normal[1]).toBe(
      hex(mix(r ?? 0, 255, 64 / 255), mix(g ?? 0, 0, 64 / 255), mix(b ?? 0, 0, 64 / 255)),
    );
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

  it("leaves out a name longer than any a person would pick", () => {
    const long = "x".repeat(201);
    const file = JSON.stringify({
      name: long,
      themes: [
        { name: long, appearance: "dark", style: {} },
        { name: "y".repeat(200), appearance: "dark", style: {} },
      ],
    });

    const themes = readZedThemes(file, { kind: "file", fileName: "long.json" });

    // The family is named after its file instead, and the theme with the long name is left out.
    expect(themes.map((theme) => theme.id)).toEqual([`file/long/${"y".repeat(200)}`]);
  });

  it("gives two themes different ids, whatever slashes their names hold", () => {
    const family = (name: string, theme: string) =>
      JSON.stringify({ name, themes: [{ name: theme, appearance: "dark", style: {} }] });
    const ids = [
      family("Acme/Team", "Dusk"),
      family("Acme", "Team/Dusk"),
      family("Acme%2FTeam", "Dusk"),
    ].map((file) => readZedThemes(file, { kind: "file", fileName: "acme.json" })[0]?.id);
    const extension = { kind: "extension", id: "acme", name: "Acme" } as const;
    const fromExtension = readZedThemes(family("Acme", "Team/Dusk"), extension)[0];

    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => id?.startsWith("file/"))).toBe(true);
    expect(fromExtension?.id.startsWith("acme/")).toBe(true);
    expect(fromExtension?.name).toBe("Team/Dusk");
  });

  it("stops one theme past the room it is given", () => {
    const file = JSON.stringify({
      name: "Many",
      themes: Array.from({ length: 600 }, (_, index) => ({
        name: `Many ${index}`,
        appearance: "dark",
        style: {},
      })),
    });

    expect(readZedThemes(file, { kind: "file", fileName: "many.json" }, 10)).toHaveLength(11);
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
