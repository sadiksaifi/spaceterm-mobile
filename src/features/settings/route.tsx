import { useColorScheme } from "react-native";

import { useMachines } from "@/shared/machines/client";
import { themeInUse } from "@/shared/preferences/in-use";
import { usePreferences, usePreferencesStore } from "@/shared/preferences/provider";

import SettingsScreen from "./screen";

/**
 * The pages these rows open do not exist yet: a Machine, Add Machine and Themes. Each row works
 * and stays on Settings until its page is built.
 */
const stayOnSettings = () => {};

/** Settings: the paired Machines, the Terminal Theme, Font Size and Privacy. */
export default function SettingsRoute() {
  const { machines } = useMachines();
  const preferences = usePreferences();
  const store = usePreferencesStore();
  const system = useColorScheme();

  return (
    <SettingsScreen
      machines={machines}
      themeName={themeInUse(preferences, system).name}
      fontSize={preferences.fontSize}
      privacy={preferences.privacy}
      onOpenMachine={stayOnSettings}
      onAddMachine={stayOnSettings}
      onOpenThemes={stayOnSettings}
      onFontSize={store.setFontSize}
      onPrivacy={store.setPrivacy}
    />
  );
}
