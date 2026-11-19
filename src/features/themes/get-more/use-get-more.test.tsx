import { expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import type { TerminalTheme } from "@/shared/preferences/model";
import { PreferencesProvider } from "@/shared/preferences/provider";
import { createPreferencesStore, type KeyValueStorage } from "@/shared/preferences/store";

import type { CatalogExtension, ThemeCatalog } from "./catalog";
import { createInstalls } from "./installs";
import { useGetMore, type PickedFile } from "./use-get-more";

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
const nightfox: CatalogExtension = {
  id: "nightfox",
  name: "Nightfox",
  author: "cange",
  downloads: 301_000,
};

const colors: TerminalTheme["colors"] = {
  background: "#1e1e2e",
  foreground: "#cdd6f4",
  cursor: "#f5e0dc",
  normal: ["#45475a", "#f38ba8", "#a6e3a1", "#f9e2af", "#89b4fa", "#f5c2e7", "#94e2d5", "#bac2de"],
  bright: ["#585b70", "#f38ba8", "#a6e3a1", "#f9e2af", "#89b4fa", "#f5c2e7", "#94e2d5", "#a6adc8"],
};
const mocha: TerminalTheme = {
  id: "catppuccin/Catppuccin Mocha",
  name: "Catppuccin Mocha",
  appearance: "dark",
  source: { kind: "extension", id: "catppuccin", name: "Catppuccin" },
  colors,
};

/** A promise whose answer the test gives when it chooses. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

/** Lets debounced searches start and answered promises settle. Effects run when an act ends. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 400));

async function render(
  catalog: ThemeCatalog,
  pickFile: () => Promise<PickedFile | null> = async () => null,
  storage: KeyValueStorage = memoryStorage(),
) {
  const store = createPreferencesStore(storage);
  const installs = createInstalls(catalog, store);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <PreferencesProvider store={store}>{children}</PreferencesProvider>
  );
  const open = () => renderHook(() => useGetMore(catalog, installs, pickFile), { wrapper });
  const hook = await open();
  return { ...hook, store, open };
}

it("lists the newest search's results, even when an older search answers last", async () => {
  const first = deferred<CatalogExtension[] | "unavailable">();
  const second = deferred<CatalogExtension[] | "unavailable">();
  const search = jest
    .fn<ThemeCatalog["search"]>()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const { result } = await render({ search, themes: jest.fn<ThemeCatalog["themes"]>() });
  await act(settle);
  expect(result.current.list).toEqual({ kind: "loading" });

  await act(async () => result.current.setQuery("night"));
  await act(settle);
  await act(async () => {
    second.resolve([nightfox]);
    await settle();
  });
  await act(async () => {
    first.resolve([catppuccin, nightfox]);
    await settle();
  });

  expect(search.mock.calls.map(([query]) => query)).toEqual(["", "night"]);
  expect(result.current.list).toEqual({ kind: "ready", extensions: [nightfox] });
});

it("loads a search again when it comes back to an earlier one, without its old answer", async () => {
  const again = deferred<CatalogExtension[] | "unavailable">();
  const search = jest
    .fn<ThemeCatalog["search"]>()
    .mockResolvedValueOnce([catppuccin])
    .mockResolvedValueOnce("unavailable")
    .mockReturnValueOnce(again.promise);
  const { result } = await render({ search, themes: jest.fn<ThemeCatalog["themes"]>() });
  await act(settle);

  await act(async () => result.current.setQuery("nord"));
  await act(settle);
  expect(result.current.list).toEqual({ kind: "unavailable" });

  // "nordic" never searches: "nord" comes back before the pause ends.
  await act(async () => result.current.setQuery("nordic"));
  await act(async () => result.current.setQuery("nord"));
  expect(result.current.list).toEqual({ kind: "loading" });
  await act(settle);
  expect(result.current.list).toEqual({ kind: "loading" });

  await act(async () => {
    again.resolve([catppuccin]);
    await settle();
  });
  expect(search.mock.calls.map(([query]) => query)).toEqual(["", "nord", "nord"]);
  expect(result.current.list).toEqual({ kind: "ready", extensions: [catppuccin] });
});

it("searches again after edits that end where they started", async () => {
  const search = jest
    .fn<ThemeCatalog["search"]>()
    .mockResolvedValueOnce([catppuccin])
    .mockResolvedValueOnce([nightfox]);
  const { result } = await render({ search, themes: jest.fn<ThemeCatalog["themes"]>() });
  await act(settle);

  // Both edits land in one render.
  await act(async () => {
    result.current.setQuery("n");
    result.current.setQuery("");
  });
  await act(settle);

  expect(result.current.list).toEqual({ kind: "ready", extensions: [nightfox] });
});

it("loads the list again with Try Again after it could not load", async () => {
  const search = jest
    .fn<ThemeCatalog["search"]>()
    .mockResolvedValueOnce("unavailable")
    .mockResolvedValueOnce([catppuccin]);
  const { result } = await render({ search, themes: jest.fn<ThemeCatalog["themes"]>() });
  await act(settle);
  expect(result.current.list).toEqual({ kind: "unavailable" });

  await act(async () => result.current.retry());
  await act(settle);
  expect(result.current.list).toEqual({ kind: "ready", extensions: [catppuccin] });
});

it("gets every theme in an extension, which then shows Remove, and Remove takes them away", async () => {
  const answer = deferred<TerminalTheme[] | "unavailable" | "no-themes">();
  const themes = jest.fn<ThemeCatalog["themes"]>().mockReturnValue(answer.promise);
  const { result, store } = await render({
    search: async () => [catppuccin],
    themes,
  });
  await act(settle);

  await act(async () => {
    result.current.get(catppuccin);
    result.current.get(catppuccin);
  });
  expect(result.current.state(catppuccin)).toBe("installing");
  await act(async () => {
    answer.resolve([mocha]);
    await settle();
  });

  expect(themes).toHaveBeenCalledTimes(1);
  expect(store.getSnapshot().themes.at(-1)).toEqual(mocha);
  expect(result.current.state(catppuccin)).toBe("installed");

  await act(async () => result.current.askRemove(catppuccin));
  expect(result.current.removing).toEqual(catppuccin);
  await act(async () => result.current.remove());
  expect(result.current.removing).toBeNull();
  expect(store.getSnapshot().themes.map((theme) => theme.id)).not.toContain(mocha.id);
  expect(result.current.state(catppuccin)).toBe("get");
});

it("keeps a Get going after the page closes, and shows it under way when the page opens again", async () => {
  const answer = deferred<TerminalTheme[] | "unavailable" | "no-themes">();
  const themes = jest.fn<ThemeCatalog["themes"]>().mockReturnValue(answer.promise);
  const first = await render({ search: async () => [catppuccin], themes });
  await act(settle);
  await act(async () => first.result.current.get(catppuccin));
  await act(async () => first.unmount());

  const { result } = await first.open();
  await act(settle);
  expect(result.current.state(catppuccin)).toBe("installing");
  await act(async () => result.current.get(catppuccin));
  await act(async () => {
    answer.resolve([mocha]);
    await settle();
  });

  expect(themes).toHaveBeenCalledTimes(1);
  expect(result.current.state(catppuccin)).toBe("installed");
});

it("reports an extension it could not get, leaves Get on it, and tries again", async () => {
  const themes = jest
    .fn<ThemeCatalog["themes"]>()
    .mockResolvedValueOnce("unavailable")
    .mockResolvedValueOnce([mocha]);
  const { result, store } = await render({ search: async () => [catppuccin], themes });
  await act(settle);

  await act(async () => {
    result.current.get(catppuccin);
    await settle();
  });
  expect(result.current.failure).toEqual({
    kind: "get",
    extension: catppuccin,
    reason: "unavailable",
  });
  expect(result.current.state(catppuccin)).toBe("get");

  await act(async () => {
    const failure = result.current.failure;
    if (failure !== null) result.current.retryFailure(failure);
    await settle();
  });
  expect(result.current.failure).toBeNull();
  expect(store.getSnapshot().themes.at(-1)).toEqual(mocha);
});

it("tries again on a failure still on screen after a newer one, and keeps the newer one", async () => {
  const themes = jest
    .fn<ThemeCatalog["themes"]>()
    .mockResolvedValueOnce("unavailable")
    .mockResolvedValueOnce("unavailable")
    .mockResolvedValueOnce([mocha]);
  const { result, store } = await render({ search: async () => [catppuccin, nightfox], themes });
  await act(settle);

  await act(async () => {
    result.current.get(catppuccin);
    await settle();
  });
  // iOS keeps showing this failure in its alert after a newer one arrives.
  const shown = result.current.failure;
  await act(async () => {
    result.current.get(nightfox);
    await settle();
  });
  const newer = result.current.failure;
  expect(newer).toMatchObject({ extension: nightfox });

  await act(async () => {
    if (shown !== null) result.current.retryFailure(shown);
    await settle();
  });
  expect(themes).toHaveBeenLastCalledWith(catppuccin);
  expect(store.getSnapshot().themes.at(-1)).toEqual(mocha);
  expect(result.current.failure).toBe(newer);

  // Once its extension is in, Try Again on it again does nothing.
  await act(async () => {
    if (shown !== null) result.current.retryFailure(shown);
    await settle();
  });
  expect(themes).toHaveBeenCalledTimes(3);
});

it("imports the themes in a picked Zed theme file, and reports a file it could not use", async () => {
  const theme = JSON.stringify({
    name: "Paper",
    themes: [{ name: "Paper Light", appearance: "light", style: {} }],
  });
  const pickFile = jest
    .fn<() => Promise<PickedFile | null>>()
    .mockResolvedValueOnce({ kind: "read", name: "paper.json", text: theme })
    .mockResolvedValueOnce({ kind: "read", name: "notes.json", text: "{}" })
    .mockResolvedValueOnce(null)
    .mockRejectedValueOnce(new Error("The provider failed to copy the file"));
  const { result, store } = await render(
    { search: async () => [], themes: jest.fn<ThemeCatalog["themes"]>() },
    pickFile,
  );

  await act(async () => {
    result.current.importFile();
    await settle();
  });
  expect(store.getSnapshot().themes.at(-1)?.id).toBe("file/Paper/Paper Light");
  expect(result.current.failure).toBeNull();

  await act(async () => {
    result.current.importFile();
    await settle();
  });
  expect(result.current.failure).toEqual({
    kind: "import",
    fileName: "notes.json",
    reason: "not-a-theme",
  });

  // Cancel in the picker changes nothing.
  await act(async () => {
    const failure = result.current.failure;
    if (failure !== null) result.current.dismissFailure(failure);
    result.current.importFile();
    await settle();
  });
  expect(result.current.failure).toBeNull();
  expect(store.getSnapshot().themes).toHaveLength(3);

  // A picker that fails is reported, not taken for Cancel.
  await act(async () => {
    result.current.importFile();
    await settle();
  });
  expect(result.current.failure).toEqual({ kind: "import", fileName: null, reason: "unreadable" });
});

it("refuses a file with more themes than one import adds", async () => {
  const themes = Array.from({ length: 501 }, (_, index) => ({
    name: `Many ${index}`,
    appearance: "dark",
    style: {},
  }));
  const pickFile = async (): Promise<PickedFile> => ({
    kind: "read",
    name: "many.json",
    text: JSON.stringify({ name: "Many", themes }),
  });
  const { result, store } = await render(
    { search: async () => [], themes: jest.fn<ThemeCatalog["themes"]>() },
    pickFile,
  );

  await act(async () => {
    result.current.importFile();
    await settle();
  });

  expect(result.current.failure).toEqual({
    kind: "import",
    fileName: "many.json",
    reason: "too-large",
  });
  expect(store.getSnapshot().themes).toHaveLength(2);
});

it("starts one import at a time, and a new import answers the last one's failure", async () => {
  const paper = JSON.stringify({
    name: "Paper",
    themes: [{ name: "Paper Light", appearance: "light", style: {} }],
  });
  const picked = deferred<PickedFile | null>();
  const pickFile = jest
    .fn<() => Promise<PickedFile | null>>()
    .mockResolvedValueOnce({ kind: "read", name: "notes.json", text: "{}" })
    .mockReturnValueOnce(picked.promise);
  const { result } = await render(
    { search: async () => [], themes: jest.fn<ThemeCatalog["themes"]>() },
    pickFile,
  );

  await act(async () => {
    result.current.importFile();
    await settle();
  });
  expect(result.current.failure).toMatchObject({ kind: "import", reason: "not-a-theme" });

  // A second tap while the picker is open opens no second picker.
  await act(async () => {
    result.current.importFile();
    result.current.importFile();
    await settle();
  });
  expect(pickFile).toHaveBeenCalledTimes(2);
  expect(result.current.failure).toBeNull();

  await act(async () => {
    picked.resolve({ kind: "read", name: "paper.json", text: paper });
    await settle();
  });
  expect(result.current.failure).toBeNull();
});

it("reports a file whose themes could not be saved on the device", async () => {
  const theme = JSON.stringify({
    name: "Paper",
    themes: [{ name: "Paper Light", appearance: "light", style: {} }],
  });
  const { result } = await render(
    { search: async () => [], themes: jest.fn<ThemeCatalog["themes"]>() },
    async () => ({ kind: "read", name: "paper.json", text: theme }),
    {
      ...memoryStorage(),
      setItemSync: () => {
        throw new Error("database or disk is full");
      },
    },
  );

  await act(async () => {
    result.current.importFile();
    await settle();
  });

  expect(result.current.failure).toEqual({
    kind: "import",
    fileName: "paper.json",
    reason: "not-saved",
  });
});
