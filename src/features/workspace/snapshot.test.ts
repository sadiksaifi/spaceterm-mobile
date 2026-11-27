import { describe, expect, it } from "vitest";

import type { ScreenRun } from "@/shared/machines/model";

import { runColors } from "./snapshot";

const normal = [
  "#000001",
  "#e06c75",
  "#000003",
  "#000004",
  "#000005",
  "#000006",
  "#000007",
  "#000008",
] as const;
const bright = [
  "#100001",
  "#ff7b86",
  "#100003",
  "#100004",
  "#100005",
  "#100006",
  "#100007",
  "#100008",
] as const;
const theme = { foreground: "#d8d8dc", background: "#1c1c1e", normal, bright };
const run = (extra: Partial<ScreenRun>): ScreenRun => ({
  text: "x",
  foreground: null,
  background: null,
  inverse: false,
  bold: false,
  faint: false,
  italic: false,
  underline: false,
  strikethrough: false,
  ...extra,
});

describe("a run's colors", () => {
  it("takes the Terminal Theme's where the Machine names none", () => {
    expect(runColors(run({}), theme, true)).toEqual({ foreground: "#d8d8dc", background: null });
    expect(runColors(run({ foreground: "#7bc47f", background: "#000000" }), theme, true)).toEqual({
      foreground: "#7bc47f",
      background: "#000000",
    });
  });

  it("trades foreground and background for an inverse run", () => {
    expect(runColors(run({ inverse: true }), theme, true)).toEqual({
      foreground: "#1c1c1e",
      background: "#d8d8dc",
    });
  });

  it("colors a filled run's text with its fill where backgrounds do not draw", () => {
    const blackOnWhite = run({ foreground: "#000000", background: "#ffffff" });
    expect(runColors(blackOnWhite, theme, false)).toEqual({
      foreground: "#ffffff",
      background: null,
    });
    expect(runColors(run({ inverse: true, foreground: "#7bc47f" }), theme, false)).toEqual({
      foreground: "#7bc47f",
      background: null,
    });
  });

  it("takes a palette color's first 16 from the Terminal Theme", () => {
    expect(runColors(run({ foreground: 1, background: 9 }), theme, true)).toEqual({
      foreground: "#e06c75",
      background: "#ff7b86",
    });
    expect(runColors(run({ inverse: true, background: 1 }), theme, true).foreground).toBe(
      "#e06c75",
    );
  });

  it("takes the rest of the 256 palette colors from xterm's cube and grays", () => {
    const shown = (index: number) => runColors(run({ foreground: index }), theme, true).foreground;
    expect([16, 196, 110, 231].map(shown)).toEqual(["#000000", "#ff0000", "#87afd7", "#ffffff"]);
    expect([232, 255].map(shown)).toEqual(["#080808", "#eeeeee"]);
  });

  it("draws faint text at half strength", () => {
    expect(runColors(run({ faint: true }), theme, false).foreground).toBe("#d8d8dc80");
  });
});
