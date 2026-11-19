import { useEffect, useState, useSyncExternalStore } from "react";

import { usePreferences, usePreferencesStore } from "@/shared/preferences/provider";

import type { CatalogExtension, ThemeCatalog } from "./catalog";
import type { GetFailure, Installs } from "./installs";
import { readZedThemes } from "./zed-theme";

/** A file the person picked: its name and its text. */
export type PickedFile = { name: string; text: string };

export type CatalogList =
  | { kind: "loading" }
  | { kind: "ready"; extensions: readonly CatalogExtension[] }
  | { kind: "unavailable" };

/** Get or Import from File that did not add a theme. A new failure is a new object. */
export type GetMoreFailure = GetFailure | { kind: "import"; fileName: string };

export type GetMorePage = {
  query: string;
  setQuery: (query: string) => void;
  list: CatalogList;
  /** Get, a Get underway, or Remove for an extension whose themes are on this device. */
  state: (extension: CatalogExtension) => "get" | "installing" | "installed";
  get: (extension: CatalogExtension) => void;
  /** The extension whose removal waits for the person to confirm it. */
  removing: CatalogExtension | null;
  askRemove: (extension: CatalogExtension) => void;
  /** Cancel, or the alert closing by itself. A system alert reports it after Remove too. */
  cancelRemove: () => void;
  remove: () => void;
  importFile: () => void;
  /** Try Again: loads the list again. */
  retry: () => void;
  failure: GetMoreFailure | null;
  dismissFailure: () => void;
  /** Try Again on a failure: Get or Import from File again. */
  retryFailure: () => void;
};

/** Typing waits this long for a pause before it searches. */
const SEARCH_DELAY = 300;

/** Get More Themes: Zed's theme extensions, searched, got and removed, and themes from a file. */
export function useGetMore(
  catalog: ThemeCatalog,
  installs: Installs,
  pickFile: () => Promise<PickedFile | null>,
): GetMorePage {
  const preferences = usePreferences();
  const store = usePreferencesStore();
  const [query, setQuery] = useState("");
  const [attempt, setAttempt] = useState(0);
  // The latest answer, with the search it answers; the list loads until the current one answers.
  const [answer, setAnswer] = useState<{ search: string; list: CatalogList } | null>(null);
  const gets = useSyncExternalStore(installs.subscribe, installs.getSnapshot);
  const [removing, setRemoving] = useState<CatalogExtension | null>(null);
  const [importFailure, setImportFailure] = useState<GetMoreFailure | null>(null);
  // An import failure is the person's latest action, so it shows first.
  const failure = importFailure ?? gets.failure;

  const trimmed = query.trim();
  const search = `${attempt}:${trimmed}`;
  useEffect(() => {
    let current = true;
    const timer = setTimeout(
      async () => {
        const result = await catalog.search(trimmed);
        // A newer search, or leaving the page, makes this answer stale.
        if (!current) return;
        setAnswer({
          search,
          list:
            result === "unavailable"
              ? { kind: "unavailable" }
              : { kind: "ready", extensions: result },
        });
      },
      trimmed === "" ? 0 : SEARCH_DELAY,
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [catalog, trimmed, search]);
  const list: CatalogList = answer?.search === search ? answer.list : { kind: "loading" };

  const installed = new Set(
    preferences.themes.flatMap((theme) =>
      theme.source.kind === "extension" ? [theme.source.id] : [],
    ),
  );

  function dismissFailure() {
    if (importFailure !== null) setImportFailure(null);
    else installs.dismissFailure();
  }

  async function importNow() {
    let picked: PickedFile | null;
    try {
      picked = await pickFile();
    } catch {
      picked = null;
    }
    if (picked === null) return;
    const themes = readZedThemes(picked.text, { kind: "file", fileName: picked.name });
    if (themes.length === 0) setImportFailure({ kind: "import", fileName: picked.name });
    else store.addThemes(themes);
  }

  return {
    query,
    setQuery,
    list,
    state: (extension) =>
      gets.installing.has(extension.id)
        ? "installing"
        : installed.has(extension.id)
          ? "installed"
          : "get",
    get: installs.get,
    removing,
    askRemove: setRemoving,
    cancelRemove: () => setRemoving(null),
    remove: () => {
      if (removing !== null) store.removeExtension(removing.id);
      setRemoving(null);
    },
    importFile: () => void importNow(),
    retry: () => setAttempt((count) => count + 1),
    failure,
    dismissFailure,
    retryFailure: () => {
      dismissFailure();
      if (failure?.kind === "get") installs.get(failure.extension);
      else if (failure?.kind === "import") void importNow();
    },
  };
}
