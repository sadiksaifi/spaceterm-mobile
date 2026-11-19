import { useRouter } from "expo-router";
import { useColorScheme } from "react-native";

import { useMachines } from "@/shared/machines/client";
import { themeInUse } from "@/shared/preferences/in-use";
import { usePreferences, usePreferencesStore } from "@/shared/preferences/provider";
import { useRedrawWhenNotSaved } from "@/shared/preferences/use-redraw";

import SettingsScreen from "./screen";

/** Add Machine does not exist yet. Its row works and stays on Settings until it is built. */
const stayOnSettings = () => {};

/** Settings: the paired Machines, the Terminal Theme, Font Size and Privacy. */
export default function SettingsRoute() {
  const { machines } = useMachines();
  const preferences = usePreferences();
  const store = usePreferencesStore();
  const system = useColorScheme();
  const router = useRouter();
  const redraw = useRedrawWhenNotSaved();

  return (
    <SettingsScreen
      key={redraw.key}
      machines={machines}
      themeName={themeInUse(preferences, system).name}
      fontSize={preferences.fontSize}
      privacy={preferences.privacy}
      // Navigate, not push: a second tap before the page shows must not open it twice.
      onOpenMachine={(machineId) =>
        router.navigate({ pathname: "/settings/machines/[machineId]", params: { machineId } })
      }
      onAddMachine={stayOnSettings}
      onOpenThemes={() => router.navigate("/settings/themes")}
      onFontSize={(points) => redraw.check(store.setFontSize(points))}
      onPrivacy={(setting, on) => redraw.check(store.setPrivacy(setting, on))}
    />
  );
}
