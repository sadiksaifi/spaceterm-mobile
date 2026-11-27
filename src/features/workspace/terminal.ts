import { useColorScheme } from "react-native";

import type { TerminalColors } from "@/shared/preferences/model";
import { themeInUse } from "@/shared/preferences/in-use";
import { usePreferences } from "@/shared/preferences/provider";

/** The colors of the Terminal Theme in use, which a Pane's snapshot is drawn with. */
export function useTerminalColors(): TerminalColors {
  return themeInUse(usePreferences(), useColorScheme()).colors;
}
