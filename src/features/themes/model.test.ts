import { describe, expect, it } from "vitest";

import type { TerminalTheme } from "@/shared/preferences/model";
import { createPreferencesStore } from "@/shared/preferences/store";

import { themesFor } from "./model";

const added = (name: string, appearance: "light" | "dark"): TerminalTheme => ({
  id: `ext/${name}`,
  name,
  appearance,
  source: { kind: "extension", id: "ext", name: "Ext" },
  colors: {
    background: "#000000",
    foreground: "#ffffff",
    cursor: "#ffffff",
    normal: [
      "#000000",
      "#000000",
      "#000000",
      "#000000",
      "#000000",
      "#000000",
      "#000000",
      "#000000",
    ],
    bright: [
      "#000000",
      "#000000",
      "#000000",
      "#000000",
      "#000000",
      "#000000",
      "#000000",
      "#000000",
    ],
  },
});

function preferences() {
  const store = createPreferencesStore({ getItemSync: () => null, setItemSync: () => {} });
  store.addThemes([
    added("One Dark Pro", "dark"),
    added("One Light", "light"),
    added("Dracula", "dark"),
  ]);
  return store.getSnapshot();
}

describe("the Themes list", () => {
  it("shows the themes made for the appearance being chosen for", () => {
    expect(themesFor(preferences(), "dark", "").map((theme) => theme.name)).toEqual([
      "SpaceTerm Dark",
      "One Dark Pro",
      "Dracula",
    ]);
    expect(themesFor(preferences(), "light", "").map((theme) => theme.name)).toEqual([
      "SpaceTerm Light",
      "One Light",
    ]);
  });

  it("narrows to names holding the search, whatever its case", () => {
    expect(themesFor(preferences(), "dark", " one ").map((theme) => theme.name)).toEqual([
      "One Dark Pro",
    ]);
    expect(themesFor(preferences(), "dark", "solarized")).toEqual([]);
  });
});
