import { describe, expect, it, vi } from "vitest";

import type { TerminalTheme } from "@/shared/preferences/model";
import { createPreferencesStore, type KeyValueStorage } from "@/shared/preferences/store";

import type { CatalogExtension, ThemeCatalog } from "./catalog";
import { createInstalls } from "./installs";

const memoryStorage = (): KeyValueStorage => {
  const values = new Map<string, string>();
  return {
    getItemSync: (key) => values.get(key) ?? null,
    setItemSync: (key, value) => void values.set(key, value),
  };
};

const catppuccin: CatalogExtension = {
  id: "catppuccin",
  name: "Catppuccin",
  author: "Catppuccin",
  downloads: 1_233_350,
};
const nord: CatalogExtension = { id: "nord", name: "Nord", author: "Nord", downloads: 157_000 };
const mocha: TerminalTheme = {
  id: "catppuccin/Catppuccin Mocha",
  name: "Catppuccin Mocha",
  appearance: "dark",
  source: { kind: "extension", id: "catppuccin", name: "Catppuccin" },
  colors: {
    background: "#1e1e2e",
    foreground: "#cdd6f4",
    cursor: "#f5e0dc",
    normal: [
      "#45475a",
      "#f38ba8",
      "#a6e3a1",
      "#f9e2af",
      "#89b4fa",
      "#f5c2e7",
      "#94e2d5",
      "#bac2de",
    ],
    bright: [
      "#585b70",
      "#f38ba8",
      "#a6e3a1",
      "#f9e2af",
      "#89b4fa",
      "#f5c2e7",
      "#94e2d5",
      "#a6adc8",
    ],
  },
};

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const catalogWith = (themes: ThemeCatalog["themes"]): ThemeCatalog => ({
  search: async () => [],
  themes,
});

describe("Gets under way", () => {
  it("downloads an extension once however often Get is tapped, and adds its themes", async () => {
    const answer = deferred<TerminalTheme[] | "unavailable" | "no-themes">();
    let downloads = 0;
    const store = createPreferencesStore(memoryStorage());
    const installs = createInstalls(
      catalogWith(() => {
        downloads++;
        return answer.promise;
      }),
      store,
    );

    installs.get(catppuccin);
    installs.get(catppuccin);
    expect(installs.getSnapshot().installing.has("catppuccin")).toBe(true);
    answer.resolve([mocha]);
    await answer.promise;
    await Promise.resolve();

    expect(downloads).toBe(1);
    expect(installs.getSnapshot().installing.size).toBe(0);
    expect(store.getSnapshot().themes.at(-1)).toEqual(mocha);
  });

  it("keeps a failure until it is dismissed, and treats a thrown error as unavailable", async () => {
    const answer = deferred<TerminalTheme[] | "unavailable" | "no-themes">();
    const installs = createInstalls(
      catalogWith(() => answer.promise),
      createPreferencesStore(memoryStorage()),
    );
    let changes = 0;
    installs.subscribe(() => changes++);

    installs.get(catppuccin);
    answer.reject(new Error("storage full"));
    await answer.promise.catch(() => {});
    await Promise.resolve();

    expect(installs.getSnapshot()).toEqual({
      installing: new Set(),
      failure: { kind: "get", extension: catppuccin, reason: "unavailable" },
    });
    expect(changes).toBeGreaterThan(0);
    const failure = installs.getSnapshot().failure;
    if (failure !== null) installs.dismissFailure(failure);
    expect(installs.getSnapshot().failure).toBeNull();
  });

  it("answers an extension's failure with a new Get, so the old Try Again does nothing", async () => {
    const themes = vi
      .fn<ThemeCatalog["themes"]>()
      .mockResolvedValueOnce("unavailable")
      .mockResolvedValueOnce([mocha]);
    const installs = createInstalls(catalogWith(themes), createPreferencesStore(memoryStorage()));

    installs.get(catppuccin);
    await vi.waitFor(() => expect(installs.getSnapshot().failure).not.toBeNull());
    const stale = installs.getSnapshot().failure;
    installs.get(catppuccin);
    expect(installs.getSnapshot().failure).toBeNull();
    await vi.waitFor(() => expect(installs.getSnapshot().installing.size).toBe(0));

    // A failure of another extension stays when the stale one is dismissed.
    themes.mockResolvedValueOnce("no-themes");
    installs.get(nord);
    await vi.waitFor(() => expect(installs.getSnapshot().failure).not.toBeNull());
    if (stale !== null) installs.dismissFailure(stale);
    expect(installs.getSnapshot().failure?.extension).toEqual(nord);
  });

  it("reports themes it got but could not save on the device", async () => {
    const store = createPreferencesStore({
      ...memoryStorage(),
      setItemSync: () => {
        throw new Error("database or disk is full");
      },
    });
    const installs = createInstalls(
      catalogWith(async () => [mocha]),
      store,
    );

    installs.get(catppuccin);
    await vi.waitFor(() => expect(installs.getSnapshot().installing.size).toBe(0));

    expect(installs.getSnapshot().failure).toEqual({
      kind: "get",
      extension: catppuccin,
      reason: "not-saved",
    });
  });
});
