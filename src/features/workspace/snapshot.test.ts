import { describe, expect, it } from "vitest";

import type { ScreenRun } from "@/shared/machines/model";

import { runColors } from "./snapshot";

const theme = { foreground: "#d8d8dc", background: "#1c1c1e" };
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

  it("trades foreground and background for an inverse run where backgrounds draw", () => {
    expect(runColors(run({ inverse: true }), theme, true)).toEqual({
      foreground: "#1c1c1e",
      background: "#d8d8dc",
    });
    expect(runColors(run({ inverse: true, foreground: "#7bc47f" }), theme, false)).toEqual({
      foreground: "#7bc47f",
      background: null,
    });
  });

  it("draws faint text at half strength", () => {
    expect(runColors(run({ faint: true }), theme, false).foreground).toBe("#d8d8dc80");
  });
});
