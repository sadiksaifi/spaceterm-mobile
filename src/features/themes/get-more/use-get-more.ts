import { useEffect, useState, useSyncExternalStore } from "react";

import { usePreferences, usePreferencesStore } from "@/shared/preferences/provider";

import type { CatalogExtension, ThemeCatalog } from "./catalog";
import type { GetFailure, Installs } from "./installs";
import { MAX_THEMES, readZedThemes } from "./zed-theme";

/** A file the person picked: its name and its text, or why it could not be read. */
export type PickedFile =
  | { kind: "read"; name: string; text: string }
  | { kind: "failed"; name: string | null; reason: "too-large" | "unreadable" };

export type CatalogList =
  | { kind: "loading" }
  | { kind: "ready"; extensions: readonly CatalogExtension[] }
  | { kind: "unavailable" };

/** Get or Import from File that did not add a theme. A new failure is a new object. */
export type GetMoreFailure =
  | GetFailure
  | {
      kind: "import";
      /** `null` when the picker failed before it named the file. */
      fileName: string | null;
      reason: "not-a-theme" | "too-large" | "unreadable";
    };

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
  /** Takes away `failure` if it is still the one shown. */
  dismissFailure: (failure: GetMoreFailure) => void;
  /** Try Again on `failure`, if it is still the one shown: Get or Import from File again. */
  retryFailure: (failure: GetMoreFailure) => void;
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

  function dismissFailure(shown: GetMoreFailure) {
    if (shown.kind === "import")
      setImportFailure((current) => (current === shown ? null : current));
    else installs.dismissFailure(shown);
  }

  async function importNow() {
    let picked: PickedFile | null;
    try {
      picked = await pickFile();
    } catch {
      // The picker failed while it copied the file, before it gave the file's name.
      picked = { kind: "failed", name: null, reason: "unreadable" };
    }
    if (picked === null) return;
    if (picked.kind === "failed") {
      setImportFailure({ kind: "import", fileName: picked.name, reason: picked.reason });
      return;
    }
    const themes = readZedThemes(picked.text, { kind: "file", fileName: picked.name });
    if (themes.length === 0) {
      setImportFailure({ kind: "import", fileName: picked.name, reason: "not-a-theme" });
    } else if (themes.length > MAX_THEMES) {
      setImportFailure({ kind: "import", fileName: picked.name, reason: "too-large" });
    } else {
      store.addThemes(themes);
    }
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
    retryFailure: (shown) => {
      // A Try Again from a failure that has since been answered or replaced does nothing.
      if (shown !== failure) return;
      dismissFailure(shown);
      if (shown.kind === "get") installs.get(shown.extension);
      else void importNow();
    },
  };
}
