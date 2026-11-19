import { fetch } from "expo/fetch";
import { useRouter } from "expo-router";

import { usePreferencesStore } from "@/shared/preferences/provider";
import type { PreferencesStore } from "@/shared/preferences/store";

import { createZedCatalog } from "./catalog";
import { createInstalls, type Installs } from "./installs";
import { pickThemeFile } from "./pick-file";
import GetMoreScreen from "./screen";
import { useGetMore } from "./use-get-more";

const catalog = createZedCatalog(fetch);
// A Get outlives the page that started it, so the Gets live as long as the store they add to.
const installsByStore = new WeakMap<PreferencesStore, Installs>();

function installsFor(store: PreferencesStore): Installs {
  let installs = installsByStore.get(store);
  if (installs === undefined) {
    installs = createInstalls(catalog, store);
    installsByStore.set(store, installs);
  }
  return installs;
}

/** Get More Themes: themes made for Zed, from Zed's extension store or from a file. */
export default function GetMoreRoute() {
  const router = useRouter();
  const page = useGetMore(catalog, installsFor(usePreferencesStore()), pickThemeFile);
  return <GetMoreScreen page={page} onClose={() => router.back()} />;
}
