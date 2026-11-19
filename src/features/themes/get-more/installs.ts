import type { PreferencesStore } from "@/shared/preferences/store";

import type { CatalogExtension, ThemeCatalog } from "./catalog";

/** A Get that did not add a theme. A new failure is a new object. */
export type GetFailure = {
  kind: "get";
  extension: CatalogExtension;
  reason: "unavailable" | "no-themes";
};

export type InstallsSnapshot = {
  /** The ids of the extensions whose Get is under way. */
  installing: ReadonlySet<string>;
  failure: GetFailure | null;
};

/**
 * The Gets under way, which outlive Get More Themes: closing the page leaves a download to finish,
 * and a failure while it is closed waits for it to open again.
 */
export type Installs = {
  getSnapshot: () => InstallsSnapshot;
  subscribe: (listener: () => void) => () => void;
  /** Gets every theme in an extension. A Get already under way for it is left to finish. */
  get: (extension: CatalogExtension) => void;
  dismissFailure: () => void;
};

export function createInstalls(catalog: ThemeCatalog, store: PreferencesStore): Installs {
  let snapshot: InstallsSnapshot = { installing: new Set(), failure: null };
  const listeners = new Set<() => void>();

  function change(next: Partial<InstallsSnapshot>) {
    snapshot = { ...snapshot, ...next };
    for (const listener of listeners) listener();
  }

  function withInstalling(id: string, underway: boolean) {
    const installing = new Set(snapshot.installing);
    if (underway) installing.add(id);
    else installing.delete(id);
    return installing;
  }

  async function getNow(extension: CatalogExtension) {
    change({ installing: withInstalling(extension.id, true) });
    let failure: GetFailure | null = null;
    try {
      const themes = await catalog.themes(extension);
      if (typeof themes === "string") failure = { kind: "get", extension, reason: themes };
      else store.addThemes(themes);
    } catch {
      failure = { kind: "get", extension, reason: "unavailable" };
    } finally {
      change({
        installing: withInstalling(extension.id, false),
        ...(failure === null ? {} : { failure }),
      });
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get: (extension) => {
      if (snapshot.installing.has(extension.id)) return;
      void getNow(extension);
    },
    dismissFailure: () => change({ failure: null }),
  };
}
