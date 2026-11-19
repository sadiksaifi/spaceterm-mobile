import Storage from "expo-sqlite/kv-store";
import { createContext, use, useState, useSyncExternalStore, type ReactNode } from "react";

import type { Preferences } from "./model";
import { createPreferencesStore, type PreferencesStore } from "./store";

const PreferencesContext = createContext<PreferencesStore | null>(null);

/** Supplies this device's preferences, kept in its SQLite key-value storage, to the screens inside. */
export function PreferencesProvider({
  store,
  children,
}: {
  store?: PreferencesStore;
  children: ReactNode;
}) {
  const [value] = useState(() => store ?? createPreferencesStore(Storage));
  return <PreferencesContext value={value}>{children}</PreferencesContext>;
}

export function usePreferencesStore(): PreferencesStore {
  const store = use(PreferencesContext);
  if (store === null) throw new Error("usePreferencesStore needs a PreferencesProvider");
  return store;
}

/** This device's preferences, updated as they change. */
export function usePreferences(): Preferences {
  const store = usePreferencesStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
