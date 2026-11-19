import { useRouter } from "expo-router";
import { useState } from "react";
import { useColorScheme } from "react-native";

import { appearanceInUse, chosenTheme } from "@/shared/preferences/in-use";
import type { TerminalTheme, ThemeAppearance } from "@/shared/preferences/model";
import { usePreferences, usePreferencesStore } from "@/shared/preferences/provider";
import { useRedrawWhenNotSaved } from "@/shared/preferences/use-redraw";

import { themesFor } from "./model";
import ThemesScreen from "./screen";

/** Themes: the appearance terminals use, and the Terminal Theme chosen for Light and for Dark. */
export default function ThemesRoute() {
  const preferences = usePreferences();
  const store = usePreferencesStore();
  const router = useRouter();
  const system = useColorScheme();
  // Under Automatic the page opens on the appearance the system shows now.
  const [selected, setSelected] = useState<ThemeAppearance>(() =>
    appearanceInUse("automatic", system),
  );
  const [query, setQuery] = useState("");
  const [removing, setRemoving] = useState<TerminalTheme | null>(null);
  const redraw = useRedrawWhenNotSaved();
  const shown = preferences.appearance === "automatic" ? selected : preferences.appearance;

  return (
    <ThemesScreen
      key={redraw.key}
      appearance={preferences.appearance}
      shown={shown}
      chosen={{ light: chosenTheme(preferences, "light"), dark: chosenTheme(preferences, "dark") }}
      themes={themesFor(preferences, shown, query)}
      query={query}
      removing={removing}
      onAppearance={(appearance) => {
        const saved = store.setAppearance(appearance);
        redraw.check(saved);
        // Leaving Automatic for Light or Dark, then coming back, keeps the list on that one.
        if (saved === "saved" && appearance !== "automatic") setSelected(appearance);
      }}
      onShow={setSelected}
      onChoose={(themeId) => redraw.check(store.chooseTheme(themeId))}
      onQuery={setQuery}
      onAskRemove={setRemoving}
      // A system alert reports Cancel after its other button too; both close it.
      onCancelRemove={() => setRemoving(null)}
      onRemove={() => {
        if (removing !== null) redraw.check(store.removeTheme(removing.id));
        setRemoving(null);
      }}
      onGetMore={() => router.navigate("/settings/themes/get-more")}
    />
  );
}
