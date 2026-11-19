import { Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { MachinesProvider } from "@/shared/machines/client";
import { PreferencesProvider } from "@/shared/preferences/provider";
import { useNavigationTheme } from "@/shared/theme/navigation";

// Home sits under every route, so a link that opens New Workspace from a stopped app still has
// Home to go back to.
export const unstable_settings = { anchor: "index" };

export default function RootLayout() {
  return (
    <MachinesProvider>
      <PreferencesProvider>
        <ThemeProvider value={useNavigationTheme()}>
          <Stack>
            <Stack.Screen
              name="new-workspace"
              options={{
                // iOS shows New Workspace in a sheet; Android shows it as full-screen pages.
                presentation: process.env.EXPO_OS === "ios" ? "modal" : "card",
                headerShown: false,
              }}
            />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </PreferencesProvider>
    </MachinesProvider>
  );
}
