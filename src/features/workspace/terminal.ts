import { useColorScheme } from "react-native";

import { themeInUse } from "@/shared/preferences/in-use";
import { usePreferences } from "@/shared/preferences/provider";

/** The background of the Terminal Theme in use, which a Pane's snapshot is drawn on. */
export function useTerminalBackground(): string {
  return themeInUse(usePreferences(), useColorScheme()).colors.background;
}
