import { describe, expect, it } from "vitest";

import type { Pane } from "@/shared/machines/model";

import { splitOf, type Split } from "./layout";

function pane(id: string, source: string | null = null, side: Pane["side"] = "right"): Pane {
  return { id, name: id, source, side, running: false, controlledElsewhere: false };
}

/** The split as nested arrays of Pane ids, for reading. */
function shape(split: Split | null): unknown {
  if (split === null) return null;
  if (split.kind === "pane") return split.pane.id;
  return { [split.axis]: [shape(split.first), shape(split.second)] };
}

describe("the split of a Tab", () => {
  it("halves the Pane each one was placed beside, on its side", () => {
    const panes = [pane("expo"), pane("zsh", "expo", "right"), pane("log", "zsh", "down")];
    expect(shape(splitOf(panes))).toEqual({ row: ["expo", { column: ["zsh", "log"] }] });
  });

  it("puts a Pane placed left of or above its source first", () => {
    const panes = [pane("a"), pane("b", "a", "left"), pane("c", "a", "up")];
    expect(shape(splitOf(panes))).toEqual({ row: ["b", { column: ["c", "a"] }] });
  });

  it("halves the first Pane for a Pane whose source is gone", () => {
    expect(shape(splitOf([pane("a"), pane("b", "closed", "down")]))).toEqual({
      column: ["a", "b"],
    });
  });

  it("is one Pane, or nothing for a Tab without Panes", () => {
    expect(shape(splitOf([pane("a")]))).toBe("a");
    expect(splitOf([])).toBeNull();
  });
});
