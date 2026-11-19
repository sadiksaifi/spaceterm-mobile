import { describe, expect, it } from "vitest";

import type { TerminalTheme } from "./model";
import { createPreferencesStore, type KeyValueStorage } from "./store";

/** Storage that keeps its values in memory, as the device's would across launches. */
function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItemSync: (key) => values.get(key) ?? null,
    setItemSync: (key, value) => void values.set(key, value),
  };
}

const colors: TerminalTheme["colors"] = {
  background: "#23272e",
  foreground: "#abb2bf",
  cursor: "#528bff",
  normal: ["#3f4451", "#e05561", "#8cc265", "#d18f52", "#4aa5f0", "#c162de", "#42b3c2", "#d7dae0"],
  bright: ["#4f5666", "#ff616e", "#a5e075", "#f0a45d", "#4dc4ff", "#de73ff", "#4cd1e0", "#e6e6e6"],
};
const oneDark: TerminalTheme = {
  id: "one-dark-pro/One Dark Pro",
  name: "One Dark Pro",
  appearance: "dark",
  source: { kind: "extension", id: "one-dark-pro", name: "One Dark Pro" },
  colors,
};
const oneLight: TerminalTheme = {
  ...oneDark,
  id: "one-dark-pro/One Light",
  name: "One Light",
  appearance: "light",
};
const modern: TerminalTheme = {
  ...oneDark,
  id: "vscode-dark-modern/VSCode Dark Modern",
  name: "VSCode Dark Modern",
  source: { kind: "extension", id: "vscode-dark-modern", name: "VSCode Dark Modern" },
};

describe("the preferences store", () => {
  it("starts with SpaceTerm's themes, 13 pt text, and programs kept from the clipboard", () => {
    const { fontSize, privacy, appearance, chosen, themes } =
      createPreferencesStore(memoryStorage()).getSnapshot();

    expect(fontSize).toBe(13);
    expect(privacy).toEqual({
      notifications: true,
      terminalAttention: true,
      programsCopyText: true,
      programsReadClipboard: false,
    });
    expect(appearance).toBe("automatic");
    expect(chosen).toEqual({ light: "spaceterm-light", dark: "spaceterm-dark" });
    expect(themes.map((theme) => theme.name)).toEqual(["SpaceTerm Light", "SpaceTerm Dark"]);
  });

  it("keeps every change for the next launch", () => {
    const storage = memoryStorage();
    const store = createPreferencesStore(storage);
    store.setFontSize(15);
    store.setPrivacy("programsReadClipboard", true);
    store.setAppearance("dark");
    store.addThemes([oneDark]);
    store.chooseTheme(oneDark.id);

    const next = createPreferencesStore(storage).getSnapshot();
    expect(next.fontSize).toBe(15);
    expect(next.privacy.programsReadClipboard).toBe(true);
    expect(next.appearance).toBe("dark");
    expect(next.chosen.dark).toBe(oneDark.id);
    expect(next.themes.at(-1)).toEqual(oneDark);
  });

  it("tells its subscribers about a change, with a new snapshot", () => {
    const store = createPreferencesStore(memoryStorage());
    const before = store.getSnapshot();
    let changes = 0;
    store.subscribe(() => changes++);

    store.setFontSize(14);

    expect(changes).toBe(1);
    expect(store.getSnapshot()).not.toBe(before);
    expect(store.getSnapshot().fontSize).toBe(14);
  });

  it("shows no change it could not save, and tells the caller", () => {
    const storage = memoryStorage();
    const store = createPreferencesStore({
      ...storage,
      setItemSync: () => {
        throw new Error("database or disk is full");
      },
    });
    let changes = 0;
    store.subscribe(() => changes++);

    expect(() => store.addThemes([oneDark])).toThrow("database or disk is full");
    expect(changes).toBe(0);
    expect(store.getSnapshot().themes.map((theme) => theme.id)).not.toContain(oneDark.id);
  });

  it("keeps the text size between 9 and 18 pt", () => {
    const store = createPreferencesStore(memoryStorage());
    store.setFontSize(40);
    expect(store.getSnapshot().fontSize).toBe(18);
    store.setFontSize(2);
    expect(store.getSnapshot().fontSize).toBe(9);
  });

  it("starts from the defaults where what it kept cannot be read", () => {
    const garbled = createPreferencesStore(memoryStorage({ preferences: "{not json" }));
    expect(garbled.getSnapshot().fontSize).toBe(13);

    const partly = createPreferencesStore(
      memoryStorage({
        preferences: JSON.stringify({
          fontSize: "big",
          appearance: "sepia",
          privacy: { notifications: false, programsCopyText: "yes" },
          chosen: { dark: "gone/Theme" },
          added: [oneDark, { name: "half a theme" }],
        }),
      }),
    ).getSnapshot();
    expect(partly.fontSize).toBe(13);
    expect(partly.appearance).toBe("automatic");
    expect(partly.privacy).toMatchObject({ notifications: false, programsCopyText: true });
    expect(partly.chosen.dark).toBe("spaceterm-dark");
    expect(partly.themes.map((theme) => theme.id)).toEqual([
      "spaceterm-light",
      "spaceterm-dark",
      oneDark.id,
    ]);
  });

  it("chooses a theme for the appearance it is made for", () => {
    const store = createPreferencesStore(memoryStorage());
    store.addThemes([oneDark, oneLight]);

    store.chooseTheme(oneLight.id);
    store.chooseTheme(oneDark.id);

    expect(store.getSnapshot().chosen).toEqual({ light: oneLight.id, dark: oneDark.id });
  });

  it("puts a theme added again in its old place, without a second copy", () => {
    const store = createPreferencesStore(memoryStorage());
    store.addThemes([oneDark, modern]);
    store.addThemes([{ ...oneDark, colors: { ...colors, background: "#000000" } }]);

    const added = store.getSnapshot().themes.slice(2);
    expect(added.map((theme) => theme.id)).toEqual([oneDark.id, modern.id]);
    expect(added[0]?.colors.background).toBe("#000000");
  });

  it("goes back to SpaceTerm's theme when the chosen theme is removed", () => {
    const store = createPreferencesStore(memoryStorage());
    store.addThemes([oneDark, modern]);
    store.chooseTheme(oneDark.id);

    store.removeTheme(oneDark.id);

    const { chosen, themes } = store.getSnapshot();
    expect(chosen.dark).toBe("spaceterm-dark");
    expect(themes.map((theme) => theme.id)).not.toContain(oneDark.id);
  });

  it("keeps the built-in themes", () => {
    const store = createPreferencesStore(memoryStorage());
    store.removeTheme("spaceterm-dark");
    expect(store.getSnapshot().themes).toHaveLength(2);
  });

  it("removes every theme an extension added, and only those", () => {
    const store = createPreferencesStore(memoryStorage());
    store.addThemes([oneDark, modern, oneLight]);
    store.chooseTheme(oneLight.id);

    store.removeExtension("one-dark-pro");

    const { chosen, themes } = store.getSnapshot();
    expect(themes.map((theme) => theme.id)).toEqual([
      "spaceterm-light",
      "spaceterm-dark",
      modern.id,
    ]);
    expect(chosen.light).toBe("spaceterm-light");
  });
});
